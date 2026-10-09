import {pool} from '../database/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import "dotenv/config";
import { esAdmin } from '../middleware/auth.middleware.js';

const JWT_SECRET = process.env.JWT_SECRET;

// --- REGISTRAR UN EMPLEADO ---
export const register = async (req, res) => {
    const { nombre, apellido, dni, fecha_nac, email, password, username, domicilio, SECTOR_idSECTOR, CARGO_idCARGO } = req.body;

    // Necesitamos una conexión específica del pool para manejar la transacción
    let connection;

    try {

        const ROL_id = process.env.USER_DEFAULT_ROLE; // Asignar el rol de usuario por defecto

        connection = await pool.getConnection();

        // Iniciar la transacción
        await connection.beginTransaction();

        // Hashear la contraseña
        const passwordHash = await bcrypt.hash(password, 10);

        // Guardar en la tabla 'usuario'
        const [userResult] = await connection.query(
            'INSERT INTO usuario (username, password, rol) VALUES (?, ?, ?)',
            [username, passwordHash, ROL_id]
        );

        // Obtener el ID del usuario recién creado
        const newUserId = userResult.insertId;

        //  Guardar en la tabla 'empleado' usando el newUserId
        await connection.query(
            'INSERT INTO empleado (nombre, apellido, dni, fecha_nac, email, domicilio, USUARIO_idUSUARIO, SECTOR_idSECTOR, CARGO_idCARGO) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ? )',
            [nombre, apellido, dni, fecha_nac, email, domicilio, newUserId, SECTOR_idSECTOR, CARGO_idCARGO]
        );

        // confirmar los cambios
        await connection.commit();

        // Crear el token para el auto-login
        const token = jwt.sign({ id: newUserId, rol: ROL_id }, JWT_SECRET, {
            expiresIn: '1h',
        });

        const userPayload = {
            id: newUserId,
            nombre: nombre,
            apellido: apellido,
            email: email,
            rol: ROL_id
        };

        // Enviar la respuesta
        res.status(201).json({
            token,
            user: userPayload // <-- Envía el usuario también
        });

    } catch (error) {
        // Si algo falló, "deshace" todos los cambios de esta transacción
        if (connection) {
            await connection.rollback();
        }

        // Manejo de errores
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'El correo electrónico ya está en uso' });
        }
        console.error(error); // Es bueno ver el error completo en la consola del servidor
        res.status(500).json({ message: 'Error en el servidor', error: error.message });

    } finally {
        // Pase lo que pase, libera la conexión de vuelta al pool
        if (connection) {
            connection.release();
        }
    }
};

// --- LOGIN ---
export const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ mensaje: 'Usuario y contraseña son requeridos' });
    }

    try {
        const [filas] = await pool.query(
            'SELECT * FROM usuario WHERE username = ?',
            [username]
        );

        if (filas.length === 0) {
            return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
        }

        const usuario = filas[0];

        const passwordValida = await bcrypt.compare(password, usuario.password);

        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
        }

        const token = jwt.sign({ id: usuario.idUSUARIO, rol: usuario.rol }, JWT_SECRET, {
            expiresIn: '1h',
        });

        res.json({
            token,
            user: {
                id: usuario.idUSUARIO,
                username: usuario.username,
                rol: usuario.rol,
            },
        });
    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
};

// --- LISTAR EMPLEADOS ACTIVOS ---
export const obtenerEmpleados = async (req, res) => {
    try {
        // ADMIN ve a todos los empleados activos; USER solo su propio registro
        // (alcanza para que el frontend muestre el nombre del empleado "a cargo")
        const [filas] = esAdmin(req)
            ? await pool.query('SELECT * FROM empleado WHERE estado = 1')
            : await pool.query('SELECT * FROM empleado WHERE estado = 1 AND USUARIO_idUSUARIO = ?', [req.usuario.id]);
        res.json(filas);
    } catch (error) {
        console.error("Error al obtener empleados:", error);
        res.status(500).json({ mensaje: "Error al obtener los empleados desde la base de datos" });
    }
};

// --- OBTENER UN EMPLEADO POR ID ---
export const obtenerEmpleadoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const [filas] = await pool.query('SELECT * FROM empleado WHERE idEMPLEADO = ?', [id]);

        if (filas.length === 0) {
            return res.status(404).json({ mensaje: "Empleado no encontrado" });
        }

        // Un USER solo puede consultar su propio registro
        if (!esAdmin(req) && filas[0].USUARIO_idUSUARIO !== req.usuario.id) {
            return res.status(403).json({ mensaje: "No tenés permisos para ver este empleado" });
        }

        res.json(filas[0]);
    } catch (error) {
        console.error("Error al obtener empleado:", error);
        res.status(500).json({ mensaje: "Error al obtener el empleado desde la base de datos" });
    }
};

// --- MODIFICAR LOS DATOS DE UN EMPLEADO ---
export const modificarEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, dni, fecha_nac, email, domicilio, SECTOR_idSECTOR, CARGO_idCARGO } = req.body;

        const [resultado] = await pool.query(
            `UPDATE empleado
             SET nombre = ?, apellido = ?, dni = ?, fecha_nac = ?, email = ?, domicilio = ?, SECTOR_idSECTOR = ?, CARGO_idCARGO = ?
             WHERE idEMPLEADO = ?`,
            [nombre, apellido, dni, fecha_nac, email, domicilio, SECTOR_idSECTOR, CARGO_idCARGO, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Empleado no encontrado" });
        }

        res.json({ mensaje: "Empleado actualizado correctamente" });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ mensaje: "El DNI o el correo ya están en uso por otro empleado" });
        }
        console.error("Error al modificar empleado:", error);
        res.status(500).json({ mensaje: "Error al actualizar en la base de datos" });
    }
};

// --- BAJA LÓGICA (no se borra, se marca como inactivo) ---
export const bajaLogicaEmpleado = async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            'UPDATE empleado SET estado = 0 WHERE idEMPLEADO = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Empleado no encontrado" });
        }

        res.json({ mensaje: "Empleado dado de baja exitosamente" });
    } catch (error) {
        console.error("Error en la baja lógica:", error);
        res.status(500).json({ mensaje: "Error al dar de baja en la base de datos" });
    }
};

// --- REACTIVAR UN EMPLEADO DADO DE BAJA ---
export const altaEmpleado = async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            'UPDATE empleado SET estado = 1 WHERE idEMPLEADO = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Empleado no encontrado" });
        }

        res.json({ mensaje: "Empleado reactivado exitosamente" });
    } catch (error) {
        console.error("Error al reactivar empleado:", error);
        res.status(500).json({ mensaje: "Error al reactivar en la base de datos" });
    }
};

// --- OBTENER SECTORES ---
export const obtenerSectores = async (req, res) => {
    try {
        const [filas] = await pool.query(
            `SELECT idSECTOR, nombre
             FROM sector
             ORDER BY nombre ASC`
        );

        res.json(filas);
    } catch (error) {
        console.error("Error al obtener sectores:", error);
        res.status(500).json({
            mensaje: "Error al obtener los sectores desde la base de datos"
        });
    }
};

// --- OBTENER CARGOS ---
export const obtenerCargos = async (req, res) => {
    try {
        const [filas] = await pool.query(
            `SELECT idCARGO, nombre
             FROM cargo
             ORDER BY nombre ASC`
        );

        res.json(filas);
    } catch (error) {
        console.error("Error al obtener cargos:", error);
        res.status(500).json({
            mensaje: "Error al obtener los cargos desde la base de datos"
        });
    }
};