import { Router } from 'express';
import { 
    obtenerClientes, 
    crearCliente, 
    modificarCliente, 
    bajaLogicaCliente 
} from '../controllers/admin.clientes.controllers.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/clientes', verificarToken, obtenerClientes); //FUNCIONANDO
router.post('/clientes', verificarToken, crearCliente); //FUNCIONANDO
router.put('/clientes/:id', verificarToken, modificarCliente); //FUNCIONANDO
router.delete('/clientes/:id', verificarToken, bajaLogicaCliente); //FUNCIONANDO

export default router;