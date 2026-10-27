import { pool } from '../database/db.js';
import { badRequest, noEncontrado } from '../utils/http.js';
import { numero, entero, fecha, texto, idQuery, fechaQuery } from '../utils/validar.js';
import { fincasPermitidas, filtroFincas, exigirFinca, lotePermitido, cicloPermitido, contactoDeFinca } from '../utils/acceso.js';
import { crearFiltro } from '../utils/filtro.js';

// RF-26: el listado devuelve los gastos filtrados; el total del período lo calcula el front
// (y el endpoint /rentabilidad lo agrupa por finca, lote, cultivo o campaña).
export const obtenerGastos = async (req, res) => {
    const f = filtroFincas(await fincasPermitidas(req), 'g.FINCA_idFINCA');
    const filtro = crearFiltro()
        .add(f.sql, ...f.params)
        .si(idQuery(req.query.finca), 'g.FINCA_idFINCA = ?')
        .si(idQuery(req.query.lote), 'g.LOTE_idLOTE = ?')
        .si(idQuery(req.query.categoria), 'g.CATEGORIA_idCATEGORIA = ?')
        .si(fechaQuery(req.query.desde), 'g.fecha >= ?')
        .si(fechaQuery(req.query.hasta), 'g.fecha <= ?');

    const [filas] = await pool.query(
        `SELECT g.*, f.nombre AS finca, l.nombre AS lote, cat.nombre AS categoria, p.nombre AS proveedor,
                cu.nombre AS cultivo, c.campania
           FROM gasto g
           JOIN finca f              ON f.idFINCA = g.FINCA_idFINCA
           JOIN categoria_gasto cat  ON cat.idCATEGORIA = g.CATEGORIA_idCATEGORIA
           LEFT JOIN lote l          ON l.idLOTE = g.LOTE_idLOTE
           LEFT JOIN proveedor p     ON p.idPROVEEDOR = g.PROVEEDOR_idPROVEEDOR
           LEFT JOIN ciclo_productivo c ON c.idCICLO = g.CICLO_idCICLO
           LEFT JOIN cultivo cu      ON cu.idCULTIVO = c.CULTIVO_idCULTIVO
          ${filtro.where}
          ORDER BY g.fecha DESC, g.idGASTO DESC`,
        filtro.params
    );
    res.json(filas);
};

// Valida las relaciones: el lote y el ciclo deben ser de la finca elegida.
// Si se indica un ciclo, el lote se completa solo con el del ciclo.
const leerGasto = async (req, b) => {
    const finca = entero(b.FINCA_idFINCA, 'La finca', { req: true });
    await exigirFinca(req, finca);

    let lote = entero(b.LOTE_idLOTE, 'El lote');
    const ciclo = entero(b.CICLO_idCICLO, 'El cultivo / ciclo');
    const proveedor = entero(b.PROVEEDOR_idPROVEEDOR, 'El proveedor');

    if (ciclo) {
        const c = await cicloPermitido(req, ciclo);
        if (c.FINCA_idFINCA !== finca) throw badRequest('El cultivo elegido no pertenece a esa finca');
        if (lote && lote !== c.LOTE_idLOTE) throw badRequest('El cultivo elegido no corresponde a ese lote');
        lote = c.LOTE_idLOTE;
    } else if (lote) {
        const l = await lotePermitido(req, lote);
        if (l.FINCA_idFINCA !== finca) throw badRequest('El lote no pertenece a esa finca');
    }
    if (proveedor) await contactoDeFinca('proveedor', 'idPROVEEDOR', proveedor, finca);

    return {
        FINCA_idFINCA: finca,
        LOTE_idLOTE: lote,
        CICLO_idCICLO: ciclo,
        CATEGORIA_idCATEGORIA: entero(b.CATEGORIA_idCATEGORIA, 'La categoría', { req: true }),
        PROVEEDOR_idPROVEEDOR: proveedor,
        concepto: texto(b.concepto, 'El concepto', { max: 150, req: true }),
        importe: numero(b.importe, 'El importe', { req: true, positivo: true }),
        fecha: fecha(b.fecha, 'La fecha', { req: true }),
        observaciones: texto(b.observaciones, 'Las observaciones', { max: 255 }),
    };
};

const COLUMNAS = [
    'FINCA_idFINCA', 'LOTE_idLOTE', 'CICLO_idCICLO', 'CATEGORIA_idCATEGORIA',
    'PROVEEDOR_idPROVEEDOR', 'concepto', 'importe', 'fecha', 'observaciones',
];

const exigirRegistro = async (req, id) => {
    const [r] = await pool.query('SELECT FINCA_idFINCA AS finca FROM gasto WHERE idGASTO = ?', [id]);
    if (!r.length) throw noEncontrado('Gasto no encontrado');
    await exigirFinca(req, r[0].finca);
};

export const crearGasto = async (req, res) => {
    const d = await leerGasto(req, req.body);
    const [r] = await pool.query(
        `INSERT INTO gasto (${COLUMNAS.join(', ')}) VALUES (${COLUMNAS.map(() => '?').join(', ')})`,
        COLUMNAS.map((c) => d[c])
    );
    res.status(201).json({ mensaje: 'Gasto registrado con éxito', id: r.insertId });
};

export const modificarGasto = async (req, res) => {
    await exigirRegistro(req, req.params.id);
    const d = await leerGasto(req, req.body);
    await pool.query(
        `UPDATE gasto SET ${COLUMNAS.map((c) => `${c} = ?`).join(', ')} WHERE idGASTO = ?`,
        [...COLUMNAS.map((c) => d[c]), req.params.id]
    );
    res.json({ mensaje: 'Gasto actualizado correctamente' });
};

export const eliminarGasto = async (req, res) => {
    await exigirRegistro(req, req.params.id);
    await pool.query('DELETE FROM gasto WHERE idGASTO = ?', [req.params.id]);
    res.json({ mensaje: 'Gasto eliminado' });
};
