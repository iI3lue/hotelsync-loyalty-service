import { connect } from "./broker";
import { handleDelivery } from "./consumer-delivery";
import { processEarn, processReversal } from "../services/loyalty.service";
import { getBookingDetails } from "./booking-client";
import { checkUserActive } from "./user-client";

const QUEUE_NAME = "loyalty.points";
const ROUTING_KEYS = ["payment.completed", "booking.completed", "booking.cancelled"];

export async function startConsumer() {
  const channel = await connect();
  const deadLetterQueue = `${QUEUE_NAME}.dlq`;
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.assertQueue(deadLetterQueue, { durable: true });
  for (const key of ROUTING_KEYS) {
    await channel.bindQueue(QUEUE_NAME, "hotelsync.events", key);
  }
  await channel.prefetch(1);

  console.log(`[consumer] Escuchando en cola ${QUEUE_NAME} para ${ROUTING_KEYS.join(", ")}`);

  channel.consume(
    QUEUE_NAME,
    (msg) => {
      if (!msg) return;
      void handleDelivery(channel, QUEUE_NAME, deadLetterQueue, handleLoyaltyEvent, msg);
    },
    { noAck: false }
  );
}

/** Aplica un evento del ciclo de la reserva; un mensaje sin booking_id se descarta. */
async function handleLoyaltyEvent(routingKey: string, payload: unknown): Promise<void> {
  const bookingId = (payload as { booking_id?: unknown } | null)?.booking_id;
  if (typeof bookingId !== "string" || bookingId.length === 0) {
    console.warn("[consumer] Evento sin booking_id, se descarta");
    return;
  }

  if (routingKey === "booking.cancelled") {
    await handleCancellation(bookingId);
  } else {
    await handleEarn(bookingId);
  }
}

/** Acredita puntos al pagarse la reserva (payment.completed; booking.completed queda como respaldo idempotente). */
async function handleEarn(bookingId: string) {
  const booking = await getBookingDetails(bookingId);
  if (!booking) return;
  if (booking.status === "cancelled") {
    console.log(`[consumer] Reserva cancelada ${bookingId}, sin puntos`);
    return;
  }
  if (!booking.booked_by_user_id) {
    console.log(`[consumer] Ignorando reserva guest ${bookingId}`);
    return;
  }

  const isUserActive = await checkUserActive(booking.booked_by_user_id);
  if (!isUserActive) {
    console.warn(`[consumer] Usuario inactivo, ignorando ${booking.booked_by_user_id}`);
    return;
  }

  await processEarn(booking.booked_by_user_id, bookingId, booking.total_amount);
}

/** Revierte puntos al cancelarse la reserva; no-op si nunca se acreditó (o ya se revirtió). */
async function handleCancellation(bookingId: string) {
  const reversal = await processReversal(bookingId);
  if (reversal) {
    console.log(`[consumer] Revertidos ${reversal.points} puntos de ${bookingId}`);
  }
}
