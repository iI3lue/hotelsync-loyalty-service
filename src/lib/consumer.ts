import { connect } from "./broker";
import { processEarn, processReversal } from "../services/loyalty.service";
import { getBookingDetails } from "./booking-client";
import { checkUserActive } from "./user-client";

const QUEUE_NAME = "loyalty.points";
const ROUTING_KEYS = ["payment.completed", "booking.completed", "booking.cancelled"];

export async function startConsumer() {
  const channel = await connect();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  for (const key of ROUTING_KEYS) {
    await channel.bindQueue(QUEUE_NAME, "hotelsync.events", key);
  }
  await channel.prefetch(1);

  console.log(`[consumer] Escuchando en cola ${QUEUE_NAME} para ${ROUTING_KEYS.join(", ")}`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const { booking_id } = JSON.parse(msg.content.toString());
      if (!booking_id) return channel.ack(msg);

      if (msg.fields.routingKey === "booking.cancelled") {
        await handleCancellation(booking_id);
      } else {
        await handleEarn(booking_id);
      }
      channel.ack(msg);
    } catch (error: any) {
      console.error("[consumer] Error procesando evento", error);
      if (error.status === 502 || error.status === 503) {
        setTimeout(() => channel.nack(msg, false, true), 5000);
      } else {
        channel.nack(msg, false, false);
      }
    }
  }, { noAck: false });
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
