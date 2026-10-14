export async function checkUserActive(userId: string) {
  const url = `${process.env.USER_SERVICE_URL}/users/${userId}`;
  const res = await fetch(url, {
    headers: { "x-service-key": process.env.USER_SERVICE_KEY || "" }
  });
  if (!res.ok) {
    if (res.status === 404) return false;
    throw Object.assign(new Error("User fetch failed"), { status: res.status });
  }
  // Retorna true si el usuario existe (ajusta según el contrato exacto de tu user-service)
  return true; 
}