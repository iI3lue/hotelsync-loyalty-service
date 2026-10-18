-- Una reserva puede tener a lo sumo una transacción por tipo (earn / reverse),
-- lo que da idempotencia a la acreditación y a la reversión.
DROP INDEX "points_transactions_booking_id_key";

CREATE UNIQUE INDEX "points_transactions_booking_id_type_key" ON "points_transactions"("booking_id", "type");
