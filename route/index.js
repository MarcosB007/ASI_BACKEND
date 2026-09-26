import { Router } from "express";
import routerAuth from "./auth.routes.js";

const router = Router();

router.use(routerAuth);

export default router;