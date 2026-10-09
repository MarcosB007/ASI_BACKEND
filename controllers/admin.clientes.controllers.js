// 1. Importamos la conexión a la base de datos
import { pool } from '../database/db.js';
import { esAdmin } from '../middleware/auth.middleware.js';
import { idEmpleadoDeUsuario, normalizarEstado } from '../database/empleadoActual.js';

// ADMIN: ve todos los clientes (activos e inactivos, para poder reactivarlos).
// USER: solo ve los clientes activos que tiene a cargo.
export const obtenerClientes = async (req, res) => {
    try {
        if (esAdmin(req)) {
            const [filas] = await pool.query('SELECT * FROM cliente ORDER BY apellido, nombre');
            return res.json(filas);
        }

        const idEmpleado = await idEmpleadoDeUsuario(req.usuario.id);
        if (idEmpleado === null) return res.json([]);

        const [filas] = await pool.query(
            'SELECT * FROM cliente WHERE estado = 1 AND EMPLEADO_idEMPLEADO = ? ORDER BY apellido, nombre',
            [idEmpleado]
        );
        res.json(filas);
    } catch (error) {
        // Si la base de datos falla, evitamos que el servidor colapse
        console.error("Error en la consulta:", error);
        res.status(500).json({ mensaje: "Error al obtener los clientes desde la base de datos" });
    }
};

// Solo ADMIN (lo controla la ruta). Puede asignar el cliente a un empleado existente.
export const crearCliente = async (req, res) => {
    try {
        const { nombre, apellido, email, EMPLEADO_idEMPLEADO } = req.body;

        if (!nombre || !apellido || !EMPLEADO_idEMPLEADO) {
            return res.status(400).json({ mensaje: "Nombre, apellido y empleado a cargo son requeridos" });
        }

        const estado = normalizarEstado(req.body.estado);
        if (estado === null) {
            return res.status(400).json({ mensaje: "El estado debe ser 1 (activo) o 0 (inactivo)" });
        }

        const [resultado] = await pool.query(
            'INSERT INTO cliente (nombre, apellido, email, EMPLEADO_idEMPLEADO, estado) VALUES (?, ?, ?, ?, ?)',
            [nombre, apellido, email ?? null, EMPLEADO_idEMPLEADO, estado]
        );

        res.status(201).json({ 
            mensaje: "Cliente creado con éxito", 
            id: resultado.insertId 
        });
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ mensaje: "El empleado asignado no existe" });
        }
        console.error("Error al crear cliente:", error);
        res.status(500).json({ mensaje: "Error al guardar en la base de datos" });
    }
};


// Solo ADMIN. Además de los datos, permite reasignar el empleado a cargo y cambiar el estado.
export const modificarCliente = async (req, res) => {
    try {
        const { id } = req.params; 
        const { nombre, apellido, email, EMPLEADO_idEMPLEADO } = req.body;

        if (!nombre || !apellido || !EMPLEADO_idEMPLEADO) {
            return res.status(400).json({ mensaje: "Nombre, apellido y empleado a cargo son requeridos" });
        }

        const estado = normalizarEstado(req.body.estado);
        if (estado === null) {
            return res.status(400).json({ mensaje: "El estado debe ser 1 (activo) o 0 (inactivo)" });
        }

        const [resultado] = await pool.query(
            'UPDATE cliente SET nombre = ?, apellido = ?, email = ?, EMPLEADO_idEMPLEADO = ?, estado = ? WHERE idCLIENTE = ?',
            [nombre, apellido, email ?? null, EMPLEADO_idEMPLEADO, estado, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Cliente no encontrado" });
        }

        res.json({ mensaje: "Cliente actualizado correctamente" });
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ mensaje: "El empleado asignado no existe" });
        }
        console.error("Error al modificar cliente:", error);
        res.status(500).json({ mensaje: "Error al actualizar en la base de datos" });
    }
};


export const bajaLogicaCliente = async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            'UPDATE cliente SET estado = 0 WHERE idCLIENTE = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Cliente no encontrado" });
        }

         res.json({ mensaje: "Cliente dado de baja exitosamente" });
    } catch (error) {
        console.error("Error en la baja lógica:", error);
        res.status(500).json({ mensaje: "Error al dar de baja en la base de datos" });
    }
};
