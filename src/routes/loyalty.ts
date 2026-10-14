import { Router } from "express";
import { getMyLoyalty, redeemPoints } from "../controllers/loyalty.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { RedeemSchema } from "../validators/loyalty";

const router = Router();
router.use(requireAuth);
router.get("/", getMyLoyalty);
router.post("/redeem", validate(RedeemSchema), redeemPoints);
export { router as loyaltyRouter };