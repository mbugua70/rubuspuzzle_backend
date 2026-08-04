import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.post("/login", adminController.login);
router.get("/me", requireAdmin, adminController.me);

export default router;
