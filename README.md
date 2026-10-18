# HotelSync — Loyalty Service

Microservicio de fidelización de HotelSync: niveles, acumulación de puntos por estancia y canje.

- **Producción:** https://hotelsync-loyalty-service.onrender.com
- **Puerto local:** 3009
- **Base de datos:** `loyalty_db` (PostgreSQL 16)

## Responsabilidad

| Hace | No hace |
| --- | --- |
| Mantener cuentas de fidelidad y transacciones de puntos | Autenticar usuarios (consume el JWT de user-service) |
| Acreditar puntos al recibir `booking.completed` | Gestionar reservas o estadías |
| Permitir canje de puntos | Cobrar ni facturar |
| Ofrecer ajustes manuales de staff | Ser dueño del catálogo de niveles de otros servicios |

## Tecnologías

Node.js ≥20 · TypeScript · Express · Prisma · PostgreSQL 16 · Zod · RabbitMQ (consumidor de eventos).

## Arquitectura interna

`Route → Controller → Service → Prisma`, con Zod y `AppError`. El consumo de `booking.completed` (cola durable `loyalty.points`) es idempotente por reserva: valida la reserva y el usuario contra Booking y user-service, calcula los puntos y registra la transacción.

## Endpoints

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/health` | — | Estado del servicio |
| GET | `/v1/levels` | — | Niveles de fidelidad |
| GET | `/v1/me` | JWT | Mi cuenta y saldo de puntos |
| POST | `/v1/me/redeem` | JWT | Canjea puntos |
| GET | `/v1/admin/users/:userId/loyalty` | JWT + SUPER_ADMIN / MANAGER / ADMIN | Cuenta de un usuario |
| POST | `/v1/admin/points` | JWT + staff directivo | Ajuste manual de puntos |

## Modelo de datos

Tablas: `LoyaltyAccount`, `PointsTransaction`, `EventOutbox`.

Migraciones en `prisma/migrations` (1). El seed (`npm run seed`) es idempotente y crea tres cuentas demo, una por nivel, con su historial de transacciones:

| `user_id` | Nivel | Saldo | Uso |
| --- | --- | --- | --- |
| `11111111-1111-4111-8111-111111111111` | `silver` | 450 | Cuenta recién iniciada |
| `22222222-2222-4222-8222-222222222222` | `gold` | 1.850 | Cliente frecuente |
| `33333333-3333-4333-8333-333333333333` | `platinum` | 7.300 | Incluye un canje de 500 |

Esos UUID no tienen que existir en user-service para consultarlos con `GET /v1/admin/users/:userId/loyalty`; en una reserva real el `user_id` proviene del JWT. Volver a ejecutar el seed restaura el estado demo sin duplicar transacciones.

## Comunicación

- **Consume:** `booking.completed` (cola durable `loyalty.points`).
- **REST saliente:** Booking `GET /v1/bookings/:id` y user-service `GET /v1/users/internal/:id`, ambos con header `x-loyalty-key`.
- No publica eventos.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NODE_ENV` | No | `development` / `production` |
| `PORT` | No | Puerto HTTP (default 3009) |
| `DATABASE_URL` | Sí | PostgreSQL de `loyalty_db` |
| `AUTH_JWT_SECRET` | Sí | HS256 compartido |
| `LOYALTY_SERVICE_KEY` | Sí | Clave interna hacia Booking y user-service |
| `BOOKING_SERVICE_URL` | Sí | Base de booking-service |
| `USER_SERVICE_URL` | Sí | Base de user-service |
| `RABBITMQ_URL` | No | Sin ella no se acreditan puntos por eventos |

Copiar `.env.example` a `.env` y completar los valores.

## Ejecución local

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run seed
npm run dev                 # http://localhost:3009
```

## Despliegue

Render (Oregon, free): build `npm ci && npx prisma generate && npm run build`; start `npx prisma migrate deploy && npm start`; Neon `loyalty_db`. El plan free duerme a los 15 minutos. El front enruta `/api/loyalty/*` a este servicio.

## Pruebas y verificación

```bash
npm test
npm run lint
curl https://hotelsync-loyalty-service.onrender.com/health
```

## Respaldo de base de datos

```bash
pg_dump "$DATABASE_URL" -Fc -f loyalty_db.dump
pg_restore --clean --if-exists -d "$DATABASE_URL" loyalty_db.dump
```

## Estructura

```
src/{routes,controllers,services,validators,middleware,lib}
prisma/{schema.prisma,seed.ts,migrations}
tests/
```
