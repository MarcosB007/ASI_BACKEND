import { pool } from '../database/db.js';
import { esAdmin } from '../middleware/auth.middleware.js';
import { badRequest, noEncontrado } from '../utils/http.js';
import { texto, numero, entero } from '../utils/validar.js';
import { fincasPermitidas, filtroFincas, exigirPropietario } from '../utils/acceso.js';

// ---------------------------------------------------------------- FINCAS (RF-06 a RF-09)

// ADMIN ve todas; PRODUCTOR las suyas; ENCARGADO las que tiene asignadas.
// Se devuelven también las inactivas para poder reactivarlas.
export const obtenerFincas = async (req, res) => {
    const f = filtroFincas(await fincasPermitidas(req), 'f.idFINCA');
    const [filas] = await pool.query(
        `SELECT f.*, CONCAT(u.nombre, ' ', u.apellido) AS propietario,
                (SELECT COUNT(*) FROM lote l WHERE l.FINCA_idFINCA = f.idFINCA AND l.estado = 1) AS cant_lotes
           FROM finca f JOIN usuario u ON u.idUSUARIO = f.USUARIO_idPROPIETARIO
          WHERE ${f.sql}
          ORDER BY f.estado DESC, f.nombre`,
        f.params
    );
    res.json(filas);
};

const leerFinca = (b) => ({
    nombre: texto(b.nombre, 'El nombre', { max: 100, req: true }),
    ubicacion: texto(b.ubicacion, 'La ubicación', { max: 150 }),
    superficie_total: numero(b.superficie_total, 'La superficie total', { req: true, positivo: true }),
    descripcion: texto(b.descripcion, 'La descripción', { max: 500 }),
});

export const crearFinca = async (req, res) => {
    const d = leerFinca(req.body);

    // El PRODUCTOR crea fincas propias; el ADMIN elige el dueño
    let dueno = req.usuario.id;
    if (esAdmin(req)) {
        dueno = entero(req.body.USUARIO_idPROPIETARIO, 'El propietario', { req: true });
        const [u] = await pool.query("SELECT 1 FROM usuario WHERE idUSUARIO = ? AND rol = 'PRODUCTOR' AND estado = 1", [dueno]);
        if (!u.length) throw badRequest('El propietario debe ser un productor activo');
    }

    const [r] = await pool.query(
        'INSERT INTO finca (USUARIO_idPROPIETARIO, nombre, ubicacion, superficie_total, descripcion) VALUES (?, ?, ?, ?, ?)',
        [dueno, d.nombre, d.ubicacion, d.superficie_total, d.descripcion]
    );
    res.status(201).json({ mensaje: 'Finca creada con éxito', id: r.insertId });
};

export const modificarFinca = async (req, res) => {
    const { id } = req.params;
    await exigirPropietario(req, id);
    const d = leerFinca(req.body);

    const [lotes] = await pool.query('SELECT COALESCE(SUM(superficie), 0) AS suma FROM lote WHERE FINCA_idFINCA = ? AND estado = 1', [id]);
    if (d.superficie_total < lotes[0].suma) {
        throw badRequest(`La superficie no puede ser menor a la suma de sus lotes (${lotes[0].suma} ha)`);
    }

    await pool.query(
        'UPDATE finca SET nombre = ?, ubicacion = ?, superficie_total = ?, descripcion = ? WHERE idFINCA = ?',
        [d.nombre, d.ubicacion, d.superficie_total, d.descripcion, id]
    );
    res.json({ mensaje: 'Finca actualizada correctamente' });
};

const cambiarEstadoFinca = (estado, mensaje) => async (req, res) => {
    await exigirPropietario(req, req.params.id);
    await pool.query('UPDATE finca SET estado = ? WHERE idFINCA = ?', [estado, req.params.id]);
    res.json({ mensaje });
};
export const bajaFinca = cambiarEstadoFinca(0, 'Finca desactivada');
export const altaFinca = cambiarEstadoFinca(1, 'Finca reactivada');

// Encargados asignados a una finca
export const obtenerEncargadosDeFinca = async (req, res) => {
    await exigirPropietario(req, req.params.id);
    const [filas] = await pool.query('SELECT USUARIO_idUSUARIO AS id FROM finca_encargado WHERE FINCA_idFINCA = ?', [req.params.id]);
    res.json(filas.map((f) => f.id));
};

export const asignarEncargados = async (req, res) => {
    const { id } = req.params;
    await exigirPropietario(req, id);

    const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(Number))];
    if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw badRequest('Lista de encargados inválida');

    if (ids.length) {
        const [ok] = await pool.query("SELECT COUNT(*) AS n FROM usuario WHERE idUSUARIO IN (?) AND rol = 'ENCARGADO' AND estado = 1", [ids]);
        if (ok[0].n !== ids.length) throw badRequest('Solo se pueden asignar usuarios con rol Encargado');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM finca_encargado WHERE FINCA_idFINCA = ?', [id]);
        if (ids.length) {
            await conn.query('INSERT INTO finca_encargado (FINCA_idFINCA, USUARIO_idUSUARIO) VALUES ?', [ids.map((u) => [id, u])]);
        }
        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
    res.json({ mensaje: 'Encargados actualizados' });
};

// ---------------------------------------------------------------- LOTES (RF-10 a RF-12)

export const obtenerLotes = async (req, res) => {
    const f = filtroFincas(await fincasPermitidas(req), 'l.FINCA_idFINCA');
    const [filas] = await pool.query(
        `SELECT l.*, f.nombre AS finca
           FROM lote l JOIN finca f ON f.idFINCA = l.FINCA_idFINCA
          WHERE ${f.sql}
          ORDER BY f.nombre, l.nombre`,
        f.params
    );
    res.json(filas);
};

// La suma de los lotes activos no puede superar la superficie de la finca
const validarSuperficie = async (idFinca, superficie, idLoteActual = 0) => {
    const [r] = await pool.query(
        `SELECT f.superficie_total AS total,
                (SELECT COALESCE(SUM(superficie), 0) FROM lote WHERE FINCA_idFINCA = f.idFINCA AND estado = 1 AND idLOTE <> ?) AS usada
           FROM finca f WHERE f.idFINCA = ?`,
        [idLoteActual, idFinca]
    );
    if (!r.length) throw noEncontrado('Finca no encontrada');
    if (r[0].usada + superficie > r[0].total) {
        const libre = Math.max(0, r[0].total - r[0].usada);
        throw badRequest(`La suma de lotes supera la superficie de la finca (disponible: ${libre} ha)`);
    }
};

export const crearLote = async (req, res) => {
    const finca = entero(req.body.FINCA_idFINCA, 'La finca', { req: true });
    const nombre = texto(req.body.nombre, 'El nombre', { max: 80, req: true });
    const superficie = numero(req.body.superficie, 'La superficie', { req: true, positivo: true });

    await exigirPropietario(req, finca);
    await validarSuperficie(finca, superficie);

    const [r] = await pool.query('INSERT INTO lote (FINCA_idFINCA, nombre, superficie) VALUES (?, ?, ?)', [finca, nombre, superficie]);
    res.status(201).json({ mensaje: 'Lote creado con éxito', id: r.insertId });
};

const cargarLote = async (req, id) => {
    const [l] = await pool.query('SELECT * FROM lote WHERE idLOTE = ?', [id]);
    if (!l.length) throw noEncontrado('Lote no encontrado');
    await exigirPropietario(req, l[0].FINCA_idFINCA);
    return l[0];
};

export const modificarLote = async (req, res) => {
    const lote = await cargarLote(req, req.params.id);
    const nombre = texto(req.body.nombre, 'El nombre', { max: 80, req: true });
    const superficie = numero(req.body.superficie, 'La superficie', { req: true, positivo: true });

    await validarSuperficie(lote.FINCA_idFINCA, superficie, lote.idLOTE);
    await pool.query('UPDATE lote SET nombre = ?, superficie = ? WHERE idLOTE = ?', [nombre, superficie, lote.idLOTE]);
    res.json({ mensaje: 'Lote actualizado correctamente' });
};

export const bajaLote = async (req, res) => {
    const lote = await cargarLote(req, req.params.id);
    await pool.query('UPDATE lote SET estado = 0 WHERE idLOTE = ?', [lote.idLOTE]);
    res.json({ mensaje: 'Lote desactivado' });
};

export const altaLote = async (req, res) => {
    const lote = await cargarLote(req, req.params.id);
    await validarSuperficie(lote.FINCA_idFINCA, lote.superficie, lote.idLOTE);
    await pool.query('UPDATE lote SET estado = 1 WHERE idLOTE = ?', [lote.idLOTE]);
    res.json({ mensaje: 'Lote reactivado' });
};
