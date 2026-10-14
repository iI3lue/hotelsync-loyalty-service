/** Lectura servidor-a-servidor de la reserva para acreditar puntos. */
export async function getBookingDetails(bookingId: string) {
  const url = `${process.env.BOOKING_SERVICE_URL}/bookings/${bookingId}`;
  const res = await fetch(url, {
    headers: { "x-loyalty-key": process.env.LOYALTY_SERVICE_KEY || "" },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw Object.assign(new Error("Booking fetch failed"), { status: res.status });
  }
  return res.json();
}
