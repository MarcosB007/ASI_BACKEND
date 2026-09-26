// 1. Importamos la conexión a la base de datos
import { pool } from '../database/db.js';

export const obtenerClientes = async (req, res) => {
    try {
        // Ejecutamos la consulta SQL asíncrona
        const [filas] = await pool.query('SELECT * FROM clientes WHERE estado = 1');
        
        // Devolvemos los datos al frontend
        res.json(filas);
    } catch (error) {
        // Si la base de datos falla, evitamos que el servidor colapse
        console.error("Error en la consulta:", error);
        res.status(500).json({ mensaje: "Error al obtener los clientes desde la base de datos" });
    }
};

export const crearCliente = async (req, res) => {
    try {
        
        const { nombre, apellido } = req.body;

        const [resultado] = await pool.query(
            'INSERT INTO clientes (nombre, apellido) VALUES (?, ?)',
            [nombre, apellido]
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
        const { nombre, apellido } = req.body; 

        const [resultado] = await pool.query(
            'UPDATE clientes SET nombre = ?, apellido = ? WHERE id = ?',
            [nombre, apellido, id]
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

export const bajaLogicaCliente = async (req, res) => {
    try {
        const { id } = req.params;

        
        const [resultado] = await pool.query(
            'UPDATE clientes SET estado = 0 WHERE id = ?',
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