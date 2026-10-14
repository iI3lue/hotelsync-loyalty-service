/** Consulta si la cuenta sigue activa antes de acreditar puntos. */
export async function checkUserActive(userId: string) {
  const url = `${process.env.USER_SERVICE_URL}/users/internal/${userId}`;
  const res = await fetch(url, {
    headers: { "x-loyalty-key": process.env.LOYALTY_SERVICE_KEY || "" },
  });
  if (!res.ok) {
    if (res.status === 404) return false;
    throw Object.assign(new Error("User fetch failed"), { status: res.status });
  }
  const data = (await res.json()) as { status?: string };
  return data.status === "ACTIVE";
}
