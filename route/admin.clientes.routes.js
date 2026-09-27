
import { Router } from 'express';
import { 
    obtenerClientes, 
    crearCliente, 
    modificarCliente, 
    bajaLogicaCliente 
} from '../controllers/admin.clientes.controllers.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/clientes', verificarToken, obtenerClientes);
router.post('/clientes', verificarToken, crearCliente);
router.put('/clientes/:id', verificarToken, modificarCliente);
router.patch('/clientes/:id/baja', verificarToken, bajaLogicaCliente);

export default router;