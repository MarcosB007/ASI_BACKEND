import { Router } from 'express';
import {
    register,
    obtenerEmpleados,
    obtenerEmpleadoPorId,
    modificarEmpleado,
    bajaLogicaEmpleado,
    altaEmpleado,
    obtenerSectores,
    obtenerCargos
} from '../controllers/admin.emp.controllers.js';
import { verificarToken, soloAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/empleados', verificarToken, obtenerEmpleados); //FUNCIONANDO
router.get('/empleados/:id', verificarToken, obtenerEmpleadoPorId); //FUNCIONANDO
router.post('/empleados', verificarToken, soloAdmin, register); //FUNCIONANDO
router.put('/edit_empleado/:id', verificarToken, soloAdmin, modificarEmpleado); //FUNCIONANDO
router.patch('/baja_empleado/:id', verificarToken, soloAdmin, bajaLogicaEmpleado); //FUNCIONANDO
router.patch('/alta_empleado/:id', verificarToken, soloAdmin, altaEmpleado); //FUNCIONANDO
router.get('/sectores', obtenerSectores);
router.get('/cargos', obtenerCargos);

export default router;