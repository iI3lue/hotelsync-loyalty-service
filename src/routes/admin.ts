import { Router } from "express";
import { getUserLoyalty, adjustPointsManual } from "../controllers/admin.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AdjustPointsSchema } from "../validators/loyalty";

const router = Router();
// Exige autenticación y que el rol sea STAFF directivo
router.use(requireAuth, requireRole(["SUPER_ADMIN", "MANAGER", "ADMIN"]));

router.get("/users/:userId/loyalty", getUserLoyalty);
router.post("/points", validate(AdjustPointsSchema), adjustPointsManual);
export { router as adminRouter };