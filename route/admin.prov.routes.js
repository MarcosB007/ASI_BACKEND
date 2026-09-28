import { Router } from 'express';
import {
    obtenerProveedores,
    obtenerProveedorPorId,
    crearProveedor,
    modificarProveedor,
    bajaLogicaProveedor,
    altaProveedor
} from '../controllers/admin.prov.controllers.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/proveedores', verificarToken, obtenerProveedores);
router.get('/proveedores/:id', verificarToken, obtenerProveedorPorId);
router.post('/proveedores', verificarToken, crearProveedor);
router.put('/proveedores/:id', verificarToken, modificarProveedor);
router.patch('/proveedores/:id/baja', verificarToken, bajaLogicaProveedor);
router.patch('/proveedores/:id/alta', verificarToken, altaProveedor);

export default router;
