# hotelsync-loyalty-service

HotelSync loyalty microservice (tiers, points, earn and redeem). Part of the HotelSync platform - one repo per microservice.

## Endpoints

- `GET /v1/me` - loyalty account + recent transactions (auto-creates silver/0 account)
- `POST /v1/me/redeem` - redeem points `{ points, reason }`
- `GET /v1/levels` - public tier levels and multipliers
- `GET /health` - health check

Auth is HS256 (`AUTH_JWT_SECRET`, must be identical to user-service). Consumes `booking.completed` from RabbitMQ to earn points.

## Local dev

```bash
npm install
npx prisma generate
npm run dev
```

Required env (see monorepo `services/loyalty-service/.env.example`): `DATABASE_URL`, `AUTH_JWT_SECRET`, `BOOKING_SERVICE_URL`, `USER_SERVICE_URL`, `RABBITMQ_URL`.
