import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { pool } from '../database/db.js';
import { badRequest, HttpError } from '../utils/http.js';
import { texto, password } from '../utils/validar.js';
import { registrar } from '../utils/auditoria.js';

const JWT_SECRET = process.env.JWT_SECRET;

const firmar = (u) => jwt.sign({ id: u.idUSUARIO, rol: u.rol }, JWT_SECRET, { expiresIn: '1h' });

const datosPublicos = (u) => ({
    id: u.idUSUARIO,
    nombre: u.nombre,
    apellido: u.apellido,
    username: u.username,
    email: u.email,
    rol: u.rol,
});

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

// Acepta el nombre de usuario o el email
export const login = async (req, res) => {
    const { username, password: clave } = req.body;
    if (!username || !clave) throw badRequest('Usuario y contraseña son requeridos');

    const [filas] = await pool.query('SELECT * FROM usuario WHERE username = ? OR email = ?', [username, username]);
    const u = filas[0];

    if (!u || !(await bcrypt.compare(String(clave), u.password))) {
        await registrar({ usuarioId: u?.idUSUARIO ?? null, usuario: String(username), accion: 'INGRESO_FALLIDO', entidad: 'sesion', detalle: 'Usuario o contraseña incorrectos', ip: req.ip });
        throw new HttpError(401, 'Usuario o contraseña incorrectos');
    }
    if (!u.estado) {
        await registrar({ usuarioId: u.idUSUARIO, usuario: u.username, accion: 'INGRESO_FALLIDO', entidad: 'sesion', detalle: 'Intento de ingreso con el usuario desactivado', ip: req.ip });
        throw new HttpError(403, 'Tu usuario está desactivado. Consultá con el administrador');
    }
    await registrar({ usuarioId: u.idUSUARIO, usuario: u.username, accion: 'INGRESO', entidad: 'sesion', detalle: 'Inicio de sesión', ip: req.ip });

    res.json({ token: firmar(u), user: datosPublicos(u) });
};

// RF-02: genera un token de un solo uso (vale 30 min). Sin servidor de correo configurado,
// el token se imprime en la consola del backend y, fuera de producción, vuelve en la respuesta.
export const olvidePassword = async (req, res) => {
    const id = texto(req.body.identificador, 'El usuario o email', { req: true });
    const [filas] = await pool.query('SELECT idUSUARIO, username FROM usuario WHERE (username = ? OR email = ?) AND estado = 1', [id, id]);

    const respuesta = { mensaje: 'Si el usuario existe, se generó un código para restablecer la contraseña' };

    if (filas.length) {
        const token = crypto.randomBytes(24).toString('hex');
        await pool.query(
            'UPDATE usuario SET reset_token_hash = ?, reset_expira = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE idUSUARIO = ?',
            [hashToken(token), filas[0].idUSUARIO]
        );
        await registrar({ usuarioId: filas[0].idUSUARIO, usuario: filas[0].username, accion: 'RECUPERAR_CLAVE', entidad: 'usuario', entidadId: filas[0].idUSUARIO, detalle: 'Se pidió un código para restablecer la contraseña', ip: req.ip });
        console.log(`[AgroPulse] Código de recuperación para "${filas[0].username}": ${token}`);
        if (process.env.NODE_ENV !== 'production') respuesta.token_dev = token;
    }
    res.json(respuesta);
};

export const restablecerPassword = async (req, res) => {
    const token = texto(req.body.token, 'El código', { req: true });
    const hash = await bcrypt.hash(password(req.body.password), 10);

    const [r] = await pool.query(
        `UPDATE usuario SET password = ?, reset_token_hash = NULL, reset_expira = NULL
          WHERE reset_token_hash = ? AND reset_expira > NOW() AND estado = 1`,
        [hash, hashToken(token)]
    );
    if (r.affectedRows === 0) throw badRequest('El código es inválido o ya venció');
    await registrar({ accion: 'CLAVE_RESTABLECIDA', entidad: 'usuario', detalle: 'La contraseña se restableció con un código de recuperación', ip: req.ip });
    res.json({ mensaje: 'Contraseña actualizada. Ya podés ingresar' });
};
