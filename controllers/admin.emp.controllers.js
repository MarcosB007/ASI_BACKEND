import {pool} from '../database/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET;

// --- REGISTRAR UN EMPLEADO ---
export const register = async (req, res) => {
    const { nombre, apellido, dni, fecha_nac, email, password, username, domicilio, USUARIO_idUSUARIO, SECTOR_idSECTOR, CARGO_idCARGO } = req.body;

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
        const token = jwt.sign({ id: newUserId }, JWT_SECRET, {
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