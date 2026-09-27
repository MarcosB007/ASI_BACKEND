import { Router } from 'express';
import {
    register,
    obtenerEmpleados,
    obtenerEmpleadoPorId,
    modificarEmpleado,
    bajaLogicaEmpleado,
    altaEmpleado
} from '../controllers/admin.emp.controllers.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/empleados', verificarToken, obtenerEmpleados);
router.get('/empleados/:id', verificarToken, obtenerEmpleadoPorId);
router.post('/empleados', verificarToken, register);
router.put('/empleados/:id', verificarToken, modificarEmpleado);
router.patch('/empleados/:id/baja', verificarToken, bajaLogicaEmpleado);
router.patch('/empleados/:id/alta', verificarToken, altaEmpleado);

export default router;