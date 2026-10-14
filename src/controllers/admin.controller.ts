import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { processEarn } from "../services/loyalty.service";

export const getUserLoyalty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const account = await prisma.loyaltyAccount.findUnique({ where: { user_id: userId } });
    
    const transactions = await prisma.pointsTransaction.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 20,
    });

    res.json({ data: { account: account || null, transactions } });
  } catch (error) { next(error); }
};

export const adjustPointsManual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, points, reason, booking_id } = req.body;
    // Utilizamos un amount simulado que resulte en los puntos deseados (asumiendo tier actual)
    // Para V1, un ajuste de admin crea un "earn" directo.
    const transaction = await prisma.$transaction(async (tx) => {
       const account = await tx.loyaltyAccount.findUnique({ where: { user_id } });
       const balance = account ? account.points_balance : 0;
       
       await tx.loyaltyAccount.upsert({
         where: { user_id },
         update: { points_balance: balance + points },
         create: { user_id, tier: "silver", points_balance: points },
       });

       return tx.pointsTransaction.create({
         data: { user_id, type: "earn", points, reason, booking_id }
       });
    });

    res.json({ data: transaction });
  } catch (error) { next(error); }
};