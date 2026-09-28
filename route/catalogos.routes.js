import { Router } from 'express';
import { obtenerSectores, obtenerCargos } from '../controllers/catalogos.controllers.js';

const router = Router();

// Públicas a propósito: la pantalla de registro también necesita estas listas
router.get('/sectores', obtenerSectores);
router.get('/cargos', obtenerCargos);

export default router;
