import { connect } from "./broker";
import { processEarn } from "../services/loyalty.service";
import { getBookingDetails } from "./booking-client";
import { checkUserActive } from "./user-client";

const QUEUE_NAME = "loyalty.points";
const ROUTING_KEY = "booking.completed";

export async function startConsumer() {
  const channel = await connect();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, "hotelsync.events", ROUTING_KEY);
  await channel.prefetch(1);

  console.log(`[consumer] Escuchando en cola ${QUEUE_NAME} para ${ROUTING_KEY}`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const { booking_id } = JSON.parse(msg.content.toString());
      const booking = await getBookingDetails(booking_id);
      
      if (!booking) return channel.ack(msg);
      if (!booking.booked_by_user_id) {
        console.log(`[consumer] Ignorando reserva guest ${booking_id}`);
        return channel.ack(msg);
      }

      const isUserActive = await checkUserActive(booking.booked_by_user_id);
      if (!isUserActive) {
        console.warn(`[consumer] Usuario inactivo, ignorando ${booking.booked_by_user_id}`);
        return channel.ack(msg);
      }

      await processEarn(booking.booked_by_user_id, booking_id, booking.total_amount);
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