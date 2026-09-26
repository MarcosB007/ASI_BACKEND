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
    res.json({ mensaje: "Acá vamos a guardar un cliente nuevo" });
};

export const modificarCliente = async (req, res) => {
    res.json({ mensaje: "Acá vamos a editar los datos de un cliente" });
};

export const bajaLogicaCliente = async (req, res) => {
    res.json({ mensaje: "Acá cambiaremos el estado del cliente a inactivo" });
};