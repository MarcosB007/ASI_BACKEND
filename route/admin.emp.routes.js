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

router.get('/empleados', verificarToken, obtenerEmpleados); //FUNCIONANDO
router.get('/empleados/:id', verificarToken, obtenerEmpleadoPorId); //FUNCIONANDO
router.post('/empleados', verificarToken, register); //FUNCIONANDO
router.put('/edit_empleado/:id', verificarToken, modificarEmpleado); //FUNCIONANDO
router.patch('/baja_empleado/:id', verificarToken, bajaLogicaEmpleado); //FUNCIONANDO
router.patch('/alta_empleado/:id', verificarToken, altaEmpleado); //FUNCIONANDO

export default router;