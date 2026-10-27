import { pool } from '../database/db.js';
import { badRequest } from '../utils/http.js';
import { texto, numero, entero, fecha, opcion, idQuery, ESTADOS_CICLO } from '../utils/validar.js';
import { fincasPermitidas, filtroFincas, lotePermitido, cicloPermitido } from '../utils/acceso.js';
import { crearFiltro } from '../utils/filtro.js';

// ---------------------------------------------------------------- Catálogos

export const obtenerCultivos = async (req, res) => {
    const [filas] = await pool.query('SELECT idCULTIVO, nombre FROM cultivo ORDER BY nombre');
    res.json(filas);
};

export const crearCultivo = async (req, res) => {
    const nombre = texto(req.body.nombre, 'El nombre', { max: 60, req: true });
    const [r] = await pool.query('INSERT INTO cultivo (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ mensaje: 'Cultivo creado con éxito', id: r.insertId });
};

export const obtenerCategoriasGasto = async (req, res) => {
    const [filas] = await pool.query('SELECT idCATEGORIA, nombre FROM categoria_gasto ORDER BY nombre');
    res.json(filas);
};

// ---------------------------------------------------------------- Ciclos productivos (RF-13 a RF-15)
// Filtrando por ?lote= se obtiene el historial de cultivos de ese lote.

export const obtenerCiclos = async (req, res) => {
    const f = filtroFincas(await fincasPermitidas(req), 'l.FINCA_idFINCA');
    const filtro = crearFiltro()
        .add(f.sql, ...f.params)
        .si(idQuery(req.query.finca), 'l.FINCA_idFINCA = ?')
        .si(idQuery(req.query.lote), 'c.LOTE_idLOTE = ?')
        .si(idQuery(req.query.cultivo), 'c.CULTIVO_idCULTIVO = ?')
        .si(opcion(req.query.estado, ESTADOS_CICLO, 'El estado', { req: false }), 'c.estado = ?');

    const [filas] = await pool.query(
        `SELECT c.*, cu.nombre AS cultivo, l.nombre AS lote, l.FINCA_idFINCA, f.nombre AS finca
           FROM ciclo_productivo c
           JOIN cultivo cu ON cu.idCULTIVO = c.CULTIVO_idCULTIVO
           JOIN lote l     ON l.idLOTE = c.LOTE_idLOTE
           JOIN finca f    ON f.idFINCA = l.FINCA_idFINCA
          ${filtro.where}
          ORDER BY c.campania DESC, f.nombre, l.nombre`,
        filtro.params
    );
    res.json(filas);
};

const leerCiclo = async (req, b) => {
    const lote = await lotePermitido(req, entero(b.LOTE_idLOTE, 'El lote', { req: true }));
    const d = {
        LOTE_idLOTE: lote.idLOTE,
        CULTIVO_idCULTIVO: entero(b.CULTIVO_idCULTIVO, 'El cultivo', { req: true }),
        campania: texto(b.campania, 'La campaña', { max: 20, req: true }),
        fecha_siembra: fecha(b.fecha_siembra, 'La fecha de siembra'),
        fecha_estimada_cosecha: fecha(b.fecha_estimada_cosecha, 'La fecha estimada de cosecha'),
        fecha_cosecha: fecha(b.fecha_cosecha, 'La fecha de cosecha'),
        superficie_cultivada: numero(b.superficie_cultivada, 'La superficie cultivada', { req: true, positivo: true }),
        estado: opcion(b.estado, ESTADOS_CICLO, 'El estado', { porDefecto: 'PLANIFICADO' }),
    };

    if (d.superficie_cultivada > lote.superficie) {
        throw badRequest(`La superficie cultivada no puede superar la del lote (${lote.superficie} ha)`);
    }
    if (d.fecha_siembra && d.fecha_cosecha && d.fecha_cosecha < d.fecha_siembra) {
        throw badRequest('La cosecha no puede ser anterior a la siembra');
    }
    return d;
};

const COLUMNAS_CICLO = [
    'LOTE_idLOTE', 'CULTIVO_idCULTIVO', 'campania', 'fecha_siembra', 'fecha_estimada_cosecha',
    'fecha_cosecha', 'superficie_cultivada', 'estado',
];

export const crearCiclo = async (req, res) => {
    const d = await leerCiclo(req, req.body);
    const [r] = await pool.query(
        `INSERT INTO ciclo_productivo (${COLUMNAS_CICLO.join(', ')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        COLUMNAS_CICLO.map((c) => d[c])
    );
    res.status(201).json({ mensaje: 'Ciclo productivo creado con éxito', id: r.insertId });
};

export const modificarCiclo = async (req, res) => {
    await cicloPermitido(req, req.params.id); // el ciclo actual debe ser accesible
    const d = await leerCiclo(req, req.body); // y el lote de destino también
    await pool.query(
        `UPDATE ciclo_productivo SET ${COLUMNAS_CICLO.map((c) => `${c} = ?`).join(', ')} WHERE idCICLO = ?`,
        [...COLUMNAS_CICLO.map((c) => d[c]), req.params.id]
    );
    res.json({ mensaje: 'Ciclo productivo actualizado correctamente' });
};

// "Baja" = cancelar el ciclo (conserva el historial, la producción y las ventas asociadas)
export const bajaCiclo = async (req, res) => {
    await cicloPermitido(req, req.params.id);
    await pool.query("UPDATE ciclo_productivo SET estado = 'CANCELADO' WHERE idCICLO = ?", [req.params.id]);
    res.json({ mensaje: 'Ciclo cancelado' });
};

export const altaCiclo = async (req, res) => {
    await cicloPermitido(req, req.params.id);
    await pool.query("UPDATE ciclo_productivo SET estado = 'PLANIFICADO' WHERE idCICLO = ?", [req.params.id]);
    res.json({ mensaje: 'Ciclo reactivado como planificado' });
};
