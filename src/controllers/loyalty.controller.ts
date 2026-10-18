import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { getBookingPoints as getBookingPointsForUser, processRedeem } from "../services/loyalty.service";

export const getMyLoyalty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    let account = await prisma.loyaltyAccount.findUnique({ where: { user_id: userId } });
    
    if (!account) {
      account = await prisma.loyaltyAccount.create({
        data: { user_id: userId, tier: "silver", points_balance: 0 }
      });
    }

    const transactions = await prisma.pointsTransaction.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    res.json({ data: { account, recent_transactions: transactions } });
  } catch (error) { next(error); }
};

export const redeemPoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { points, reason } = req.body;
    const transaction = await processRedeem(userId, points, reason);
    res.json({ data: transaction });
  } catch (error) { next(error); }
};

export const getBookingPoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { bookingId } = req.params;
    const points = await getBookingPointsForUser(userId, bookingId);
    res.json({ data: points });
  } catch (error) { next(error); }
};