import { Request, Response } from "express";

const TIERS = [
  { name: "silver", multiplier: 1.0, min_balance: 0 },
  { name: "gold", multiplier: 1.25, min_balance: 1000 },
  { name: "platinum", multiplier: 1.50, min_balance: 5000 },
];

export const getLevels = (req: Request, res: Response) => {
  res.json({ data: TIERS });
};