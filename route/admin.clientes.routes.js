import { Router } from 'express';
import { 
    obtenerClientes, 
    crearCliente, 
    modificarCliente, 
    bajaLogicaCliente 
} from '../controllers/admin.clientes.controllers.js';
import { verificarToken, soloAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// Lectura: ADMIN ve todos; USER ve solo los clientes que tiene a cargo (lo resuelve el controller)
router.get('/clientes', verificarToken, obtenerClientes);

// Escritura: solo ADMIN
router.post('/clientes', verificarToken, soloAdmin, crearCliente);
router.put('/clientes/:id', verificarToken, soloAdmin, modificarCliente);
router.delete('/clientes/:id', verificarToken, soloAdmin, bajaLogicaCliente);

export default router;
