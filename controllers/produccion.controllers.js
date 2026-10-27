import { pool } from '../database/db.js';
import { noEncontrado } from '../utils/http.js';
import { numero, entero, fecha, texto, opcion, idQuery, fechaQuery, UNIDADES } from '../utils/validar.js';
import { fincasPermitidas, filtroFincas, exigirFinca, cicloPermitido } from '../utils/acceso.js';
import { crearFiltro } from '../utils/filtro.js';

// RF-18/19: historial filtrable por finca, lote, cultivo y período.
// RF-20: rendimiento por hectárea = cantidad / superficie cultivada del ciclo (en la misma unidad).
export const obtenerProduccion = async (req, res) => {
    const f = filtroFincas(await fincasPermitidas(req), 'l.FINCA_idFINCA');
    const filtro = crearFiltro()
        .add(f.sql, ...f.params)
        .si(idQuery(req.query.finca), 'l.FINCA_idFINCA = ?')
        .si(idQuery(req.query.lote), 'c.LOTE_idLOTE = ?')
        .si(idQuery(req.query.cultivo), 'c.CULTIVO_idCULTIVO = ?')
        .si(fechaQuery(req.query.desde), 'p.fecha_cosecha >= ?')
        .si(fechaQuery(req.query.hasta), 'p.fecha_cosecha <= ?');

    const [filas] = await pool.query(
        `SELECT p.*, cu.nombre AS cultivo, c.campania, c.superficie_cultivada,
                l.nombre AS lote, f.nombre AS finca,
                ROUND(p.cantidad / c.superficie_cultivada, 2) AS rendimiento_ha
           FROM produccion p
           JOIN ciclo_productivo c ON c.idCICLO = p.CICLO_idCICLO
           JOIN cultivo cu         ON cu.idCULTIVO = c.CULTIVO_idCULTIVO
           JOIN lote l             ON l.idLOTE = c.LOTE_idLOTE
           JOIN finca f            ON f.idFINCA = l.FINCA_idFINCA
          ${filtro.where}
          ORDER BY p.fecha_cosecha DESC, p.idPRODUCCION DESC`,
        filtro.params
    );
    res.json(filas);
};

const leerProduccion = async (req, b) => {
    await cicloPermitido(req, entero(b.CICLO_idCICLO, 'El ciclo productivo', { req: true }));
    return {
        CICLO_idCICLO: Number(b.CICLO_idCICLO),
        cantidad: numero(b.cantidad, 'La cantidad', { req: true, positivo: true }),
        unidad: opcion(b.unidad, UNIDADES, 'La unidad', { porDefecto: 'TN' }),
        fecha_cosecha: fecha(b.fecha_cosecha, 'La fecha de cosecha', { req: true }),
        observaciones: texto(b.observaciones, 'Las observaciones', { max: 255 }),
    };
};

const COLUMNAS = ['CICLO_idCICLO', 'cantidad', 'unidad', 'fecha_cosecha', 'observaciones'];

// Verifica que el usuario pueda tocar el registro existente
const exigirRegistro = async (req, id) => {
    const [r] = await pool.query(
        `SELECT l.FINCA_idFINCA AS finca FROM produccion p
           JOIN ciclo_productivo c ON c.idCICLO = p.CICLO_idCICLO
           JOIN lote l ON l.idLOTE = c.LOTE_idLOTE
          WHERE p.idPRODUCCION = ?`,
        [id]
    );
    if (!r.length) throw noEncontrado('Producción no encontrada');
    await exigirFinca(req, r[0].finca);
};

export const crearProduccion = async (req, res) => {
    const d = await leerProduccion(req, req.body);
    const [r] = await pool.query(
        `INSERT INTO produccion (${COLUMNAS.join(', ')}) VALUES (?, ?, ?, ?, ?)`,
        COLUMNAS.map((c) => d[c])
    );
    res.status(201).json({ mensaje: 'Producción registrada con éxito', id: r.insertId });
};

export const modificarProduccion = async (req, res) => {
    await exigirRegistro(req, req.params.id);
    const d = await leerProduccion(req, req.body);
    await pool.query(
        `UPDATE produccion SET ${COLUMNAS.map((c) => `${c} = ?`).join(', ')} WHERE idPRODUCCION = ?`,
        [...COLUMNAS.map((c) => d[c]), req.params.id]
    );
    res.json({ mensaje: 'Producción actualizada correctamente' });
};

export const eliminarProduccion = async (req, res) => {
    await exigirRegistro(req, req.params.id);
    await pool.query('DELETE FROM produccion WHERE idPRODUCCION = ?', [req.params.id]);
    res.json({ mensaje: 'Producción eliminada' });
};
