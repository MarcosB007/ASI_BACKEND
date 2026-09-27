// 1. Importamos la conexión a la base de datos
import { pool } from '../database/db.js';

export const obtenerClientes = async (req, res) => {
    try {
        const [resultado] = await pool.query('SELECT * FROM CLIENTE');
        res.json(resultado);
    } catch (error) {
        console.error("Error al obtener clientes:", error);
        res.status(500).json({ mensaje: "Error en la base de datos" });
    }
};

export const crearCliente = async (req, res) => {
    try {
    
        const { nombre, apellido, email, EMPLEADO_idEMPLEADO } = req.body;

        
        const [resultado] = await pool.query(
            'INSERT INTO CLIENTE (nombre, apellido, email, EMPLEADO_idEMPLEADO) VALUES (?, ?, ?, ?)',
            [nombre, apellido, email, EMPLEADO_idEMPLEADO]
        );

        res.status(201).json({ 
            mensaje: "Cliente creado con éxito", 
            id: resultado.insertId 
        });
    } catch (error) {
        console.error("Error al crear cliente:", error);
        res.status(500).json({ mensaje: "Error al guardar en la base de datos" });
    }
};


export const modificarCliente = async (req, res) => {
    try {
        const { id } = req.params; 
        const { nombre, apellido, email } = req.body;

        const [resultado] = await pool.query(
            'UPDATE CLIENTE SET nombre = ?, apellido = ?, email = ? WHERE idCLIENTE = ?',
            [nombre, apellido, email, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Cliente no encontrado" });
        }

        res.json({ mensaje: "Cliente actualizado correctamente" });
    } catch (error) {
        console.error("Error al modificar cliente:", error);
        res.status(500).json({ mensaje: "Error al actualizar en la base de datos" });
    }
};


export const eliminarCliente = async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            'DELETE FROM CLIENTE WHERE idCLIENTE = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Cliente no encontrado" });
        }

        res.json({ mensaje: "Cliente eliminado exitosamente" });
    } catch (error) {
        console.error("Error al eliminar cliente:", error);
        res.status(500).json({ mensaje: "Error al eliminar en la base de datos" });
    }
};