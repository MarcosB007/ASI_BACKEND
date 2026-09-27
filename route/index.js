import { Router } from "express";
import routerAuth from "./auth.routes.js";
import routerEmpleados from "./admin.emp.routes.js";

const router = Router();

router.use(routerAuth);
router.use(routerEmpleados);

export default router;