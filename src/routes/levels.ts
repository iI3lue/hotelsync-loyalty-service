import { Router } from "express";
import { getLevels } from "../controllers/levels.controller";

const router = Router();
router.get("/", getLevels);
export { router as levelsRouter };