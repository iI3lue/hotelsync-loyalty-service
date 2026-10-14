import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error-handler";

const TIERS = {
  silver: { min: 0, max: 999, multiplier: 1.0 },
  gold: { min: 1000, max: 4999, multiplier: 1.25 },
  platinum: { min: 5000, max: Infinity, multiplier: 1.50 },
} as const;

type Tier = keyof typeof TIERS;

function determineTier(balance: number, currentTier: Tier): Tier {
  let newTier: Tier = "silver";
  if (balance >= TIERS.platinum.min) newTier = "platinum";
  else if (balance >= TIERS.gold.min) newTier = "gold";

  const order = { silver: 1, gold: 2, platinum: 3 };
  return order[newTier] > order[currentTier] ? newTier : currentTier;
}

export async function processEarn(userId: string, bookingId: string, totalAmount: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pointsTransaction.findUnique({ where: { booking_id: bookingId } });
    if (existing) return existing;

    let account = await tx.loyaltyAccount.findUnique({ where: { user_id: userId } });
    if (!account) {
      account = await tx.loyaltyAccount.create({ data: { user_id: userId, tier: "silver", points_balance: 0 } });
    }

    const currentTier = account.tier as Tier;
    const pointsToEarn = Math.floor(totalAmount * TIERS[currentTier].multiplier);
    const newBalance = account.points_balance + pointsToEarn;
    const newTier = determineTier(newBalance, currentTier);

    await tx.loyaltyAccount.update({
      where: { user_id: userId },
      data: { points_balance: newBalance, tier: newTier },
    });

    return tx.pointsTransaction.create({
      data: { user_id: userId, type: "earn", points: pointsToEarn, booking_id: bookingId, reason: `Booking ${bookingId}` },
    });
  });
}
export async function processRedeem(
  userId: string,
  pointsToRedeem: number,
  reason: string
) {
  if (pointsToRedeem <= 0) throw new AppError(400, "Los puntos deben ser mayor a cero", "InvalidAmount");

  return prisma.$transaction(async (tx) => {
    const account = await tx.loyaltyAccount.findUnique({
      where: { user_id: userId },
    });

    if (!account) throw new AppError(404, "Cuenta no encontrada", "NotFound");
    if (account.points_balance < pointsToRedeem) {
      throw new AppError(400, "Saldo insuficiente", "InsufficientFunds");
    }

    await tx.loyaltyAccount.update({
      where: { user_id: userId },
      data: { points_balance: account.points_balance - pointsToRedeem },
    });

    return tx.pointsTransaction.create({
      data: {
        user_id: userId,
        type: "redeem",
        points: pointsToRedeem,
        reason,
      },
    });
  });
}