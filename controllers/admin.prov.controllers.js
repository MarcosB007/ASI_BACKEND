import { pool } from '../database/db.js';

export const obtenerProveedores = async (req, res) => {
    try {
        const [filas] = await pool.query('SELECT * FROM proveedor WHERE estado = 1');
        res.json(filas);
    } catch (error) {
        console.error("Error al obtener proveedores:", error);
        res.status(500).json({ mensaje: "Error al obtener los proveedores desde la base de datos" });
    }
};

export const obtenerProveedorPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [filas] = await pool.query('SELECT * FROM proveedor WHERE idPROVEEDOR = ?', [id]);

        if (filas.length === 0) {
            return res.status(404).json({ mensaje: "Proveedor no encontrado" });
        }

        res.json(filas[0]);
    } catch (error) {
        console.error("Error al obtener proveedor:", error);
        res.status(500).json({ mensaje: "Error al obtener el proveedor desde la base de datos" });
    }
};

export const crearProveedor = async (req, res) => {
    try {
        const { nombre, email, direccion, descripcion, rubro, EMPLEADO_idEMPLEADO } = req.body;

        if (!nombre || !email) {
            return res.status(400).json({ mensaje: "El nombre y el correo electrónico son requeridos" });
        }

        const [resultado] = await pool.query(
            `INSERT INTO proveedor 
             (nombre, email, direccion, descripcion, rubro, EMPLEADO_idEMPLEADO, estado)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [nombre, email, direccion, descripcion, rubro, EMPLEADO_idEMPLEADO]
        );

        res.status(201).json({
            mensaje: "Proveedor creado con éxito",
            id: resultado.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ mensaje: "El correo electrónico ya se encuentra registrado" });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ mensaje: "El ID del empleado asignado no existe" });
        }
        console.error("Error al crear proveedor:", error);
        res.status(500).json({ mensaje: "Error al guardar el proveedor en la base de datos" });
    }
};

export const modificarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, direccion, descripcion, rubro, EMPLEADO_idEMPLEADO } = req.body;

        const [resultado] = await pool.query(
            `UPDATE proveedor
             SET nombre = ?, email = ?, direccion = ?, descripcion = ?, rubro = ?, EMPLEADO_idEMPLEADO = ?
             WHERE idPROVEEDOR = ?`,
            [nombre, email, direccion, descripcion, rubro, EMPLEADO_idEMPLEADO, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Proveedor no encontrado" });
        }

        res.json({ mensaje: "Proveedor actualizado correctamente" });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ mensaje: "El correo electrónico ya pertenece a otro proveedor" });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ mensaje: "El ID del empleado asignado no existe" });
        }
        console.error("Error al modificar proveedor:", error);
        res.status(500).json({ mensaje: "Error al actualizar en la base de datos" });
    }
};

export const bajaLogicaProveedor = async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            'UPDATE proveedor SET estado = 0 WHERE idPROVEEDOR = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Proveedor no encontrado" });
        }

        res.json({ mensaje: "Proveedor dado de baja exitosamente" });
    } catch (error) {
        console.error("Error en la baja lógica:", error);
        res.status(500).json({ mensaje: "Error al dar de baja en la base de datos" });
    }
};

// Para reactivar
export const altaProveedor = async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            'UPDATE proveedor SET estado = 1 WHERE idPROVEEDOR = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Proveedor no encontrado" });
        }

        res.json({ mensaje: "Proveedor reactivado exitosamente" });
    } catch (error) {
        console.error("Error al reactivar proveedor:", error);
        res.status(500).json({ mensaje: "Error al reactivar en la base de datos" });
    }
};