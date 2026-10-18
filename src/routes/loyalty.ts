import { Router } from "express";
import { getBookingPoints, getMyLoyalty, redeemPoints } from "../controllers/loyalty.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { BookingIdParamSchema, RedeemSchema } from "../validators/loyalty";

const router = Router();
router.use(requireAuth);
router.get("/", getMyLoyalty);
router.get("/bookings/:bookingId/points", validate(BookingIdParamSchema, "params"), getBookingPoints);
router.post("/redeem", validate(RedeemSchema), redeemPoints);
export { router as loyaltyRouter };