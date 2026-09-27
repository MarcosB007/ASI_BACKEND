import { Router } from 'express';
import {
    register,
    obtenerEmpleados,
    obtenerEmpleadoPorId,
    modificarEmpleado,
    bajaLogicaEmpleado,
    altaEmpleado
} from '../controllers/admin.emp.controllers.js';

const router = Router();

router.get('/empleados', obtenerEmpleados);
router.get('/empleados/:id', obtenerEmpleadoPorId);
router.post('/empleados', register);
router.put('/empleados/:id', modificarEmpleado);
router.patch('/empleados/:id/baja', bajaLogicaEmpleado);
router.patch('/empleados/:id/alta', altaEmpleado);

export default router;