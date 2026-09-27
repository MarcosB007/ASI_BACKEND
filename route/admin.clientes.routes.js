
import { Router } from 'express';
import { 
    obtenerClientes, 
    crearCliente, 
    modificarCliente, 
    bajaLogicaCliente 
} from '../controllers/admin.clientes.controllers.js';

const router = Router();

router.get('/clientes', obtenerClientes);
router.post('/clientes', crearCliente);
router.put('/clientes/:id', modificarCliente);
router.patch('/clientes/:id/baja', bajaLogicaCliente);

export default router;