import request from "supertest";
import express from "express";
import { levelsRouter } from "../../src/routes/levels";
import { loyaltyRouter } from "../../src/routes/loyalty";
import { adminRouter } from "../../src/routes/admin";
import { errorHandler } from "../../src/middleware/error-handler";

jest.mock("../../src/lib/prisma.js", () => ({
  __esModule: true,
  prisma: {
    loyaltyAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    pointsTransaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "../../src/lib/prisma.js";
import { signAccessToken } from "../helpers/tokens.js";

const mockPrisma = prisma as any;

// Este servicio verifica el JWT directo contra la env (sin fallback de test),
// así que el secreto tiene que existir antes de la primera petición.
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET || "test-secret-for-unit-tests-only-32b!";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const OTHER_ID = "99999999-8888-4777-8666-555555555555";

const tokenFor = (role: string, sub = USER_ID) =>
  signAccessToken({ sub, email: "guest@hotelsync.local", role, hotel_id: null });

const tx = {
  loyaltyAccount: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  pointsTransaction: { create: jest.fn(), findUnique: jest.fn() },
};

const app = express();
app.use(express.json());
app.use("/v1/levels", levelsRouter);
app.use("/v1/me", loyaltyRouter);
app.use("/v1/admin", adminRouter);
app.use(errorHandler);

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx));
});

describe("GET /v1/levels", () => {
  it("expone los niveles sin autenticación (200)", async () => {
    const res = await request(app).get("/v1/levels");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.map((t: any) => t.name)).toEqual([
      "silver",
      "gold",
      "platinum",
    ]);
  });
});

describe("GET /v1/me", () => {
  it("rechaza sin token (401)", async () => {
    const res = await request(app).get("/v1/me");
    expect(res.status).toBe(401);
  });

  it("rechaza un token con sub que no es UUID (401)", async () => {
    const res = await request(app)
      .get("/v1/me")
      .set("Authorization", `Bearer ${tokenFor("GUEST", "not-a-uuid")}`);
    expect(res.status).toBe(401);
  });

  it("devuelve la cuenta y las últimas transacciones (200)", async () => {
    mockPrisma.loyaltyAccount.findUnique.mockResolvedValue({
      user_id: USER_ID,
      tier: "gold",
      points_balance: 1200,
    });
    mockPrisma.pointsTransaction.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/v1/me")
      .set("Authorization", `Bearer ${tokenFor("GUEST")}`);

    expect(res.status).toBe(200);
    expect(res.body.data.account.points_balance).toBe(1200);
    expect(res.body.data.recent_transactions).toEqual([]);
  });

  it("crea la cuenta silver si es la primera visita (200)", async () => {
    mockPrisma.loyaltyAccount.findUnique.mockResolvedValue(null);
    mockPrisma.loyaltyAccount.create.mockResolvedValue({
      user_id: USER_ID,
      tier: "silver",
      points_balance: 0,
    });
    mockPrisma.pointsTransaction.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/v1/me")
      .set("Authorization", `Bearer ${tokenFor("GUEST")}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.loyaltyAccount.create).toHaveBeenCalledWith({
      data: { user_id: USER_ID, tier: "silver", points_balance: 0 },
    });
  });
});

describe("POST /v1/me/redeem", () => {
  it("rechaza puntos no positivos por validación (400)", async () => {
    const res = await request(app)
      .post("/v1/me/redeem")
      .set("Authorization", `Bearer ${tokenFor("GUEST")}`)
      .send({ points: 0, reason: "Canje demo" });
    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza el canje si el saldo es insuficiente (400)", async () => {
    tx.loyaltyAccount.findUnique.mockResolvedValue({
      user_id: USER_ID,
      tier: "silver",
      points_balance: 10,
    });

    const res = await request(app)
      .post("/v1/me/redeem")
      .set("Authorization", `Bearer ${tokenFor("GUEST")}`)
      .send({ points: 50, reason: "Canje demo" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Saldo insuficiente");
    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
  });

  it("descuenta el saldo y registra la transacción (200)", async () => {
    tx.loyaltyAccount.findUnique.mockResolvedValue({
      user_id: USER_ID,
      tier: "gold",
      points_balance: 500,
    });
    tx.loyaltyAccount.update.mockResolvedValue({});
    tx.pointsTransaction.create.mockResolvedValue({
      transaction_id: "t1",
      user_id: USER_ID,
      type: "redeem",
      points: 100,
      reason: "Canje demo",
    });

    const res = await request(app)
      .post("/v1/me/redeem")
      .set("Authorization", `Bearer ${tokenFor("GUEST")}`)
      .send({ points: 100, reason: "Canje demo" });

    expect(res.status).toBe(200);
    expect(tx.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
      data: { points_balance: 400 },
    });
    expect(res.body.data.type).toBe("redeem");
  });

  it("devuelve 404 si la cuenta no existe (200 con cuenta creada antes)", async () => {
    tx.loyaltyAccount.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/v1/me/redeem")
      .set("Authorization", `Bearer ${tokenFor("GUEST", OTHER_ID)}`)
      .send({ points: 50, reason: "Canje demo" });
    expect(res.status).toBe(404);
  });
});

describe("POST /v1/admin/points", () => {
  it("rechaza a un GUEST (403)", async () => {
    const res = await request(app)
      .post("/v1/admin/points")
      .set("Authorization", `Bearer ${tokenFor("GUEST")}`)
      .send({ user_id: USER_ID, points: 100, reason: "Ajuste manual" });
    expect(res.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("permite al MANAGER ajustar puntos (200)", async () => {
    tx.loyaltyAccount.findUnique.mockResolvedValue({
      user_id: USER_ID,
      points_balance: 200,
    });
    tx.loyaltyAccount.upsert.mockResolvedValue({});
    tx.pointsTransaction.create.mockResolvedValue({
      transaction_id: "t2",
      user_id: USER_ID,
      type: "earn",
      points: 100,
      reason: "Ajuste manual",
    });

    const res = await request(app)
      .post("/v1/admin/points")
      .set("Authorization", `Bearer ${tokenFor("MANAGER")}`)
      .send({ user_id: USER_ID, points: 100, reason: "Ajuste manual" });

    expect(res.status).toBe(200);
    expect(tx.loyaltyAccount.upsert).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
      update: { points_balance: 300 },
      create: { user_id: USER_ID, tier: "silver", points_balance: 100 },
    });
  });
});
