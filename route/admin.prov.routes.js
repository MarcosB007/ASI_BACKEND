import { Router } from 'express';
import {
    obtenerProveedores,
    obtenerProveedorPorId,
    crearProveedor,
    modificarProveedor,
    bajaLogicaProveedor,
    altaProveedor
} from '../controllers/admin.prov.controllers.js';
import { verificarToken, soloAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// Lectura: ADMIN ve todos; USER ve solo los proveedores que tiene a cargo (lo resuelve el controller)
router.get('/proveedores', verificarToken, obtenerProveedores);
router.get('/proveedores/:id', verificarToken, soloAdmin, obtenerProveedorPorId);

// Escritura: solo ADMIN
router.post('/proveedores', verificarToken, soloAdmin, crearProveedor);
router.put('/proveedores/:id', verificarToken, soloAdmin, modificarProveedor);
router.patch('/proveedores/:id/baja', verificarToken, soloAdmin, bajaLogicaProveedor);
router.patch('/proveedores/:id/alta', verificarToken, soloAdmin, altaProveedor);

export default router;
