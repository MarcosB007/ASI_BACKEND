import { pool } from '../database/db.js';

// Listas para armar los desplegables del formulario de empleados (sector y cargo)
export const obtenerSectores = async (req, res) => {
    try {
        const [filas] = await pool.query('SELECT idSECTOR, nombre FROM sector ORDER BY nombre');
        res.json(filas);
    } catch (error) {
        console.error("Error al obtener sectores:", error);
        res.status(500).json({ mensaje: "Error al obtener los sectores desde la base de datos" });
    }
};

export const obtenerCargos = async (req, res) => {
    try {
        const [filas] = await pool.query('SELECT idCARGO, nombre FROM cargo ORDER BY nombre');
        res.json(filas);
    } catch (error) {
        console.error("Error al obtener cargos:", error);
        res.status(500).json({ mensaje: "Error al obtener los cargos desde la base de datos" });
    }
};
