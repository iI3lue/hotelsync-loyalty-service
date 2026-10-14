import { z } from "zod";

export const RedeemSchema = z.object({
  points: z.number().int().positive("Los puntos deben ser mayores a cero"),
  reason: z.string().min(5).max(200),
});

export const AdjustPointsSchema = z.object({
  user_id: z.string().uuid("El ID de usuario debe ser un UUID válido"),
  points: z.number().int().positive("Los puntos deben ser positivos"),
  reason: z.string().min(5).max(200),
  booking_id: z.string().uuid().optional(),
});