import { Router } from "express";
import routerAuth from "./auth.routes.js";
import routerEmpleados from "./admin.emp.routes.js";
import routerClientes from "./admin.clientes.routes.js";

const router = Router();

router.use(routerAuth);
router.use(routerEmpleados);
router.use(routerClientes);


export default router;