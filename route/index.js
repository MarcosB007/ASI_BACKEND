import { Router } from 'express';
import { verificarToken, soloAdmin, adminProductor, todosLosRoles } from '../middleware/auth.middleware.js';

import { register, login, olvidePassword, restablecerPassword } from '../controllers/auth.controllers.js';
import * as usuarios from '../controllers/usuarios.controllers.js';
import * as fincas from '../controllers/fincas.controllers.js';
import * as cultivos from '../controllers/cultivos.controllers.js';
import * as produccion from '../controllers/produccion.controllers.js';
import * as gastos from '../controllers/gastos.controllers.js';
import * as ventas from '../controllers/ventas.controllers.js';
import { clientes, proveedores } from '../controllers/contactos.controllers.js';
import * as finanzas from '../controllers/finanzas.controllers.js';

const router = Router();

// ---- Públicas (RF-01, RF-02)
router.post('/register', register);
router.post('/login', login);
router.post('/olvide-password', olvidePassword);
router.post('/restablecer-password', restablecerPassword);

// Todo lo que sigue requiere sesión
router.use(verificarToken);

// ---- Usuarios (RF-03 a RF-05)
router.get('/usuarios', soloAdmin, usuarios.obtenerUsuarios);
router.post('/usuarios', soloAdmin, usuarios.crearUsuario);
router.put('/usuarios/:id', soloAdmin, usuarios.modificarUsuario);
router.patch('/usuarios/:id/baja', soloAdmin, usuarios.bajaUsuario);
router.patch('/usuarios/:id/alta', soloAdmin, usuarios.altaUsuario);
router.get('/encargados', adminProductor, usuarios.obtenerEncargados);

// ---- Fincas y lotes
router.get('/fincas', todosLosRoles, fincas.obtenerFincas);
router.post('/fincas', adminProductor, fincas.crearFinca);
router.put('/fincas/:id', adminProductor, fincas.modificarFinca);
router.patch('/fincas/:id/baja', adminProductor, fincas.bajaFinca);
router.patch('/fincas/:id/alta', adminProductor, fincas.altaFinca);
router.get('/fincas/:id/encargados', adminProductor, fincas.obtenerEncargadosDeFinca);
router.put('/fincas/:id/encargados', adminProductor, fincas.asignarEncargados);

router.get('/lotes', todosLosRoles, fincas.obtenerLotes);
router.post('/lotes', adminProductor, fincas.crearLote);
router.put('/lotes/:id', adminProductor, fincas.modificarLote);
router.patch('/lotes/:id/baja', adminProductor, fincas.bajaLote);
router.patch('/lotes/:id/alta', adminProductor, fincas.altaLote);

// ---- Cultivos y ciclos productivos
router.get('/cultivos', todosLosRoles, cultivos.obtenerCultivos);
router.post('/cultivos', adminProductor, cultivos.crearCultivo);
router.get('/categorias-gasto', todosLosRoles, cultivos.obtenerCategoriasGasto);

router.get('/ciclos', todosLosRoles, cultivos.obtenerCiclos);
router.post('/ciclos', todosLosRoles, cultivos.crearCiclo);
router.put('/ciclos/:id', todosLosRoles, cultivos.modificarCiclo);
router.patch('/ciclos/:id/baja', adminProductor, cultivos.bajaCiclo);
router.patch('/ciclos/:id/alta', adminProductor, cultivos.altaCiclo);

// ---- Producción: el encargado registra y corrige, pero no elimina
router.get('/produccion', todosLosRoles, produccion.obtenerProduccion);
router.post('/produccion', todosLosRoles, produccion.crearProduccion);
router.put('/produccion/:id', todosLosRoles, produccion.modificarProduccion);
router.delete('/produccion/:id', adminProductor, produccion.eliminarProduccion);

// ---- Gastos: ídem
router.get('/gastos', todosLosRoles, gastos.obtenerGastos);
router.post('/gastos', todosLosRoles, gastos.crearGasto);
router.put('/gastos/:id', todosLosRoles, gastos.modificarGasto);
router.delete('/gastos/:id', adminProductor, gastos.eliminarGasto);

// ---- Ventas: solo ADMIN y PRODUCTOR
router.get('/ventas', adminProductor, ventas.obtenerVentas);
router.post('/ventas', adminProductor, ventas.crearVenta);
router.put('/ventas/:id', adminProductor, ventas.modificarVenta);
router.delete('/ventas/:id', adminProductor, ventas.eliminarVenta);

// ---- Clientes (ADMIN/PRODUCTOR) y proveedores (el encargado puede consultarlos para cargar gastos)
router.get('/clientes', adminProductor, clientes.listar);
router.post('/clientes', adminProductor, clientes.crear);
router.put('/clientes/:id', adminProductor, clientes.modificar);
router.patch('/clientes/:id/baja', adminProductor, clientes.baja);
router.patch('/clientes/:id/alta', adminProductor, clientes.alta);
router.get('/clientes/:id/historial', adminProductor, clientes.historial);

router.get('/proveedores', todosLosRoles, proveedores.listar);
router.post('/proveedores', adminProductor, proveedores.crear);
router.put('/proveedores/:id', adminProductor, proveedores.modificar);
router.patch('/proveedores/:id/baja', adminProductor, proveedores.baja);
router.patch('/proveedores/:id/alta', adminProductor, proveedores.alta);
router.get('/proveedores/:id/historial', adminProductor, proveedores.historial);

// ---- Finanzas
router.get('/dashboard', todosLosRoles, finanzas.obtenerDashboard);
router.get('/rentabilidad', adminProductor, finanzas.obtenerRentabilidad);

export default router;
