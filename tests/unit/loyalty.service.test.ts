jest.mock("../../src/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    loyaltyAccount: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    pointsTransaction: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "../../src/lib/prisma";
import {
  getBookingPoints,
  processEarn,
  processReversal,
} from "../../src/services/loyalty.service";

const mockPrisma = prisma as any;
const USER_ID = "11111111-2222-4333-8444-555555555555";
const BOOKING_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const tx = {
  loyaltyAccount: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  pointsTransaction: { findUnique: jest.fn(), create: jest.fn() },
};

describe("loyalty.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback: (t: unknown) => unknown) =>
      callback(tx)
    );
    tx.pointsTransaction.create.mockImplementation((args: any) => ({ ...args.data }));
  });

  describe("processEarn", () => {
    it("acredita puntos al multiplicador del tier actual", async () => {
      tx.pointsTransaction.findUnique.mockResolvedValue(null);
      tx.loyaltyAccount.findUnique.mockResolvedValue({
        user_id: USER_ID,
        tier: "silver",
        points_balance: 0,
      });
      tx.loyaltyAccount.update.mockResolvedValue({});

      const result = await processEarn(USER_ID, BOOKING_ID, 250);

      expect(result.points).toBe(250);
      expect(tx.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
        data: { points_balance: 250, tier: "silver" },
      });
      expect(tx.pointsTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: USER_ID,
          type: "earn",
          points: 250,
          booking_id: BOOKING_ID,
        }),
      });
    });

    it("sube de tier al cruzar el umbral", async () => {
      tx.pointsTransaction.findUnique.mockResolvedValue(null);
      tx.loyaltyAccount.findUnique.mockResolvedValue({
        user_id: USER_ID,
        tier: "silver",
        points_balance: 950,
      });
      tx.loyaltyAccount.update.mockResolvedValue({});

      await processEarn(USER_ID, BOOKING_ID, 100);

      expect(tx.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
        data: { points_balance: 1050, tier: "gold" },
      });
    });

    it("es idempotente por (booking, earn)", async () => {
      const existing = { transaction_id: "tx-1", type: "earn", points: 100 };
      tx.pointsTransaction.findUnique.mockResolvedValue(existing);

      const result = await processEarn(USER_ID, BOOKING_ID, 999);

      expect(result).toBe(existing);
      expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
      expect(tx.pointsTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe("processReversal", () => {
    it("revierte los puntos y recalcula el tier (admite downgrade)", async () => {
      tx.pointsTransaction.findUnique
        .mockResolvedValueOnce({ user_id: USER_ID, type: "earn", points: 500 })
        .mockResolvedValueOnce(null);
      tx.loyaltyAccount.findUnique.mockResolvedValue({
        user_id: USER_ID,
        tier: "gold",
        points_balance: 1200,
      });
      tx.loyaltyAccount.update.mockResolvedValue({});

      const result = await processReversal(BOOKING_ID);

      expect(result!.points).toBe(500);
      expect(result!.type).toBe("reverse");
      expect(tx.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
        data: { points_balance: 700, tier: "silver" },
      });
    });

    it("no deja el saldo negativo si ya se canjearon puntos", async () => {
      tx.pointsTransaction.findUnique
        .mockResolvedValueOnce({ user_id: USER_ID, type: "earn", points: 500 })
        .mockResolvedValueOnce(null);
      tx.loyaltyAccount.findUnique.mockResolvedValue({
        user_id: USER_ID,
        tier: "gold",
        points_balance: 200,
      });
      tx.loyaltyAccount.update.mockResolvedValue({});

      const result = await processReversal(BOOKING_ID);

      expect(result!.points).toBe(200);
      expect(tx.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
        data: { points_balance: 0, tier: "silver" },
      });
    });

    it("es idempotente por (booking, reverse)", async () => {
      const reversed = { transaction_id: "tx-2", type: "reverse", points: 500 };
      tx.pointsTransaction.findUnique
        .mockResolvedValueOnce({ user_id: USER_ID, type: "earn", points: 500 })
        .mockResolvedValueOnce(reversed);

      const result = await processReversal(BOOKING_ID);

      expect(result).toBe(reversed);
      expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
      expect(tx.pointsTransaction.create).not.toHaveBeenCalled();
    });

    it("no hace nada si la reserva nunca acreditó puntos", async () => {
      tx.pointsTransaction.findUnique.mockResolvedValue(null);

      const result = await processReversal(BOOKING_ID);

      expect(result).toBeNull();
      expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
    });
  });

  describe("getBookingPoints", () => {
    it("devuelve null sin transacción earn", async () => {
      mockPrisma.pointsTransaction.findMany.mockResolvedValue([]);

      const result = await getBookingPoints(USER_ID, BOOKING_ID);

      expect(result).toBeNull();
    });

    it("devuelve earn y reverse cuando existen", async () => {
      const earn = { type: "earn", points: 300 };
      const reverse = { type: "reverse", points: 300 };
      mockPrisma.pointsTransaction.findMany.mockResolvedValue([earn, reverse]);

      const result = await getBookingPoints(USER_ID, BOOKING_ID);

      expect(result).toEqual({ earn, reverse });
    });

    it("devuelve solo earn mientras no haya reversión", async () => {
      const earn = { type: "earn", points: 300 };
      mockPrisma.pointsTransaction.findMany.mockResolvedValue([earn]);

      const result = await getBookingPoints(USER_ID, BOOKING_ID);

      expect(result).toEqual({ earn, reverse: null });
    });
  });
});
