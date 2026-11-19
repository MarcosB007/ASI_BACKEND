import { Router } from 'express';
import { verificarToken, soloAdmin, todosLosRoles } from '../middleware/auth.middleware.js';

import { login, olvidePassword, restablecerPassword } from '../controllers/auth.controllers.js';
import * as usuarios from '../controllers/usuarios.controllers.js';
import * as fincas from '../controllers/fincas.controllers.js';
import * as cultivos from '../controllers/cultivos.controllers.js';
import * as produccion from '../controllers/produccion.controllers.js';
import * as gastos from '../controllers/gastos.controllers.js';
import * as ventas from '../controllers/ventas.controllers.js';
import { clientes, proveedores } from '../controllers/contactos.controllers.js';
import * as finanzas from '../controllers/finanzas.controllers.js';
import * as actividades from '../controllers/actividades.controllers.js';
import * as reportes from '../controllers/reportes.controllers.js';
import * as auditoria from '../controllers/auditoria.controllers.js';
import { auditar } from '../utils/auditoria.js';

const router = Router();

// ---- Públicas: no hay registro abierto; el ADMIN da de alta a los usuarios (RF 1 a RF 3)
router.post('/login', login);
router.post('/olvide-password', olvidePassword);
router.post('/restablecer-password', restablecerPassword);

// Todo lo que sigue requiere sesión. Roles: ADMIN (dueño de las tierras) y ENCARGADO (responsable de sus fincas)
router.use(verificarToken);
router.use(auditar); // deja asentado en el registro de actividad todo lo que modifica datos

// ---- Usuarios: solo ADMIN
router.get('/usuarios', soloAdmin, usuarios.obtenerUsuarios);
router.post('/usuarios', soloAdmin, usuarios.crearUsuario);
router.put('/usuarios/:id', soloAdmin, usuarios.modificarUsuario);
router.patch('/usuarios/:id/baja', soloAdmin, usuarios.bajaUsuario);
router.patch('/usuarios/:id/alta', soloAdmin, usuarios.altaUsuario);

// ---- Fincas: las crea, modifica, desactiva y asigna el ADMIN; cada encargado consulta las suyas
router.get('/fincas', todosLosRoles, fincas.obtenerFincas);
router.post('/fincas', soloAdmin, fincas.crearFinca);
router.put('/fincas/:id', soloAdmin, fincas.modificarFinca);
router.patch('/fincas/:id/baja', soloAdmin, fincas.bajaFinca);
router.patch('/fincas/:id/alta', soloAdmin, fincas.altaFinca);

// ---- Lotes, cultivos y ciclos productivos
router.get('/lotes', todosLosRoles, fincas.obtenerLotes);
router.post('/lotes', todosLosRoles, fincas.crearLote);
router.put('/lotes/:id', todosLosRoles, fincas.modificarLote);
router.patch('/lotes/:id/baja', todosLosRoles, fincas.bajaLote);
router.patch('/lotes/:id/alta', todosLosRoles, fincas.altaLote);

router.get('/cultivos', todosLosRoles, cultivos.obtenerCultivos);
router.post('/cultivos', todosLosRoles, cultivos.crearCultivo);
router.get('/categorias-gasto', todosLosRoles, cultivos.obtenerCategoriasGasto);

router.get('/ciclos', todosLosRoles, cultivos.obtenerCiclos);
router.post('/ciclos', todosLosRoles, cultivos.crearCiclo);
router.put('/ciclos/:id', todosLosRoles, cultivos.modificarCiclo);
router.patch('/ciclos/:id/baja', todosLosRoles, cultivos.bajaCiclo);
router.patch('/ciclos/:id/alta', todosLosRoles, cultivos.altaCiclo);

// ---- Producción, gastos y ventas
router.get('/produccion', todosLosRoles, produccion.obtenerProduccion);
router.post('/produccion', todosLosRoles, produccion.crearProduccion);
router.put('/produccion/:id', todosLosRoles, produccion.modificarProduccion);
router.delete('/produccion/:id', todosLosRoles, produccion.eliminarProduccion);

router.get('/gastos', todosLosRoles, gastos.obtenerGastos);
router.post('/gastos', todosLosRoles, gastos.crearGasto);
router.put('/gastos/:id', todosLosRoles, gastos.modificarGasto);
router.delete('/gastos/:id', todosLosRoles, gastos.eliminarGasto);

router.get('/ventas', todosLosRoles, ventas.obtenerVentas);
router.post('/ventas', todosLosRoles, ventas.crearVenta);
router.put('/ventas/:id', todosLosRoles, ventas.modificarVenta);
router.delete('/ventas/:id', todosLosRoles, ventas.eliminarVenta);

// ---- Clientes y proveedores (cada encargado maneja su libreta; el ADMIN ve todas)
router.get('/clientes', todosLosRoles, clientes.listar);
router.post('/clientes', todosLosRoles, clientes.crear);
router.put('/clientes/:id', todosLosRoles, clientes.modificar);
router.patch('/clientes/:id/baja', todosLosRoles, clientes.baja);
router.patch('/clientes/:id/alta', todosLosRoles, clientes.alta);
router.get('/clientes/:id/historial', todosLosRoles, clientes.historial);

router.get('/proveedores', todosLosRoles, proveedores.listar);
router.post('/proveedores', todosLosRoles, proveedores.crear);
router.put('/proveedores/:id', todosLosRoles, proveedores.modificar);
router.patch('/proveedores/:id/baja', todosLosRoles, proveedores.baja);
router.patch('/proveedores/:id/alta', todosLosRoles, proveedores.alta);
router.get('/proveedores/:id/historial', todosLosRoles, proveedores.historial);

// ---- Calendario de labores y alertas (RF 28 y RF 29)
router.get('/actividades', todosLosRoles, actividades.obtenerActividades);
router.post('/actividades', todosLosRoles, actividades.crearActividad);
router.put('/actividades/:id', todosLosRoles, actividades.modificarActividad);
router.patch('/actividades/:id/hecha', todosLosRoles, actividades.completarActividad);
router.delete('/actividades/:id', todosLosRoles, actividades.eliminarActividad);
router.get('/alertas', todosLosRoles, actividades.obtenerAlertas);

// ---- Reportes en PDF y Excel (RF 27)
router.get('/reportes/:tipo', todosLosRoles, reportes.generarReporte);

// ---- Registro de actividad: solo ADMIN (RF 31)
router.get('/auditoria', soloAdmin, auditoria.obtenerRegistro);

// ---- Finanzas
router.get('/dashboard', todosLosRoles, finanzas.obtenerDashboard);
router.get('/rentabilidad', todosLosRoles, finanzas.obtenerRentabilidad);

export default router;
