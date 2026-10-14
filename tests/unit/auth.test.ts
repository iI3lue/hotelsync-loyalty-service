import jwt from "jsonwebtoken";
import { requireAuth } from "../../src/middleware/auth";
import { AppError } from "../../src/middleware/error-handler";

const SECRET = "test-loyalty-secret-min-32-chars-ok!!";

function reqWith(token?: string) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as any;
}

describe("requireAuth", () => {
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = SECRET;
  });

  it("acepta un JWT con sub UUID", () => {
    const token = jwt.sign({ sub: "11111111-2222-4333-8444-555555555555" }, SECRET);
    const req = reqWith(token);
    const next = jest.fn();
    requireAuth(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user?.userId).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("rechaza con 401 un sub no-UUID antes de llegar a Prisma", () => {
    const token = jwt.sign({ sub: "diag-test" }, SECRET);
    const req = reqWith(token);
    const next = jest.fn();
    requireAuth(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(req.user).toBeUndefined();
  });

  it("rechaza con 401 un token con firma ajena", () => {
    const token = jwt.sign({ sub: "11111111-2222-4333-8444-555555555555" }, "otro-secreto");
    const req = reqWith(token);
    const next = jest.fn();
    requireAuth(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});
