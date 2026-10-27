import bcrypt from 'bcryptjs';
import { pool } from '../database/db.js';
import { badRequest, noEncontrado } from '../utils/http.js';
import { texto, email, password, opcion, ROLES } from '../utils/validar.js';

const COLUMNAS = 'idUSUARIO, nombre, apellido, email, username, rol, estado';

// RF-04 (solo ADMIN): lista todos los usuarios, activos e inactivos
export const obtenerUsuarios = async (req, res) => {
    const [filas] = await pool.query(`SELECT ${COLUMNAS} FROM usuario ORDER BY apellido, nombre`);
    res.json(filas);
};

// ADMIN y PRODUCTOR: encargados activos, para asignarlos a una finca
export const obtenerEncargados = async (req, res) => {
    const [filas] = await pool.query(
        `SELECT idUSUARIO, nombre, apellido, username FROM usuario WHERE rol = 'ENCARGADO' AND estado = 1 ORDER BY apellido, nombre`
    );
    res.json(filas);
};

const leerDatos = (b, { creando }) => {
    const datos = {
        nombre: texto(b.nombre, 'El nombre', { max: 80, req: true }),
        apellido: texto(b.apellido, 'El apellido', { max: 80, req: true }),
        email: email(b.email, 'El email', { req: true }),
        username: texto(b.username, 'El usuario', { max: 40, req: true }),
        rol: opcion(b.rol, ROLES, 'El rol'),
    };
    if (creando || (b.password !== undefined && b.password !== null && b.password !== '')) {
        datos.hash = password(b.password);
    }
    return datos;
};

export const crearUsuario = async (req, res) => {
    const d = leerDatos(req.body, { creando: true });
    const hash = await bcrypt.hash(d.hash, 10);
    const [r] = await pool.query(
        'INSERT INTO usuario (nombre, apellido, email, username, password, rol) VALUES (?, ?, ?, ?, ?, ?)',
        [d.nombre, d.apellido, d.email, d.username, hash, d.rol]
    );
    res.status(201).json({ mensaje: 'Usuario creado con éxito', id: r.insertId });
};

export const modificarUsuario = async (req, res) => {
    const { id } = req.params;
    const d = leerDatos(req.body, { creando: false });

    if (Number(id) === req.usuario.id && d.rol !== 'ADMIN') {
        throw badRequest('No podés quitarte a vos mismo el rol de administrador');
    }

    const campos = ['nombre = ?', 'apellido = ?', 'email = ?', 'username = ?', 'rol = ?'];
    const params = [d.nombre, d.apellido, d.email, d.username, d.rol];
    if (d.hash) {
        campos.push('password = ?');
        params.push(await bcrypt.hash(d.hash, 10));
    }

    const [r] = await pool.query(`UPDATE usuario SET ${campos.join(', ')} WHERE idUSUARIO = ?`, [...params, id]);
    if (r.affectedRows === 0) throw noEncontrado('Usuario no encontrado');
    res.json({ mensaje: 'Usuario actualizado correctamente' });
};

const cambiarEstado = (estado, mensaje) => async (req, res) => {
    const { id } = req.params;
    if (estado === 0 && Number(id) === req.usuario.id) throw badRequest('No podés desactivar tu propio usuario');
    const [r] = await pool.query('UPDATE usuario SET estado = ? WHERE idUSUARIO = ?', [estado, id]);
    if (r.affectedRows === 0) throw noEncontrado('Usuario no encontrado');
    res.json({ mensaje });
};

export const bajaUsuario = cambiarEstado(0, 'Usuario desactivado');
export const altaUsuario = cambiarEstado(1, 'Usuario reactivado');
