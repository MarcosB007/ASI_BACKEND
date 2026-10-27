import { pool } from '../database/db.js';
import { noEncontrado } from '../utils/http.js';
import { numero, entero, fecha, texto, opcion, idQuery, fechaQuery, UNIDADES } from '../utils/validar.js';
import { fincasPermitidas, filtroFincas, exigirFinca, cicloPermitido, contactoDeFinca } from '../utils/acceso.js';
import { crearFiltro } from '../utils/filtro.js';

// RF-31/32: historial de ventas por período, finca y cultivo. El total lo calcula MySQL (columna generada).
export const obtenerVentas = async (req, res) => {
    const f = filtroFincas(await fincasPermitidas(req), 'l.FINCA_idFINCA');
    const filtro = crearFiltro()
        .add(f.sql, ...f.params)
        .si(idQuery(req.query.finca), 'l.FINCA_idFINCA = ?')
        .si(idQuery(req.query.cultivo), 'c.CULTIVO_idCULTIVO = ?')
        .si(idQuery(req.query.cliente), 'v.CLIENTE_idCLIENTE = ?')
        .si(fechaQuery(req.query.desde), 'v.fecha >= ?')
        .si(fechaQuery(req.query.hasta), 'v.fecha <= ?');

    const [filas] = await pool.query(
        `SELECT v.*, cu.nombre AS cultivo, c.campania, l.nombre AS lote, f.nombre AS finca, cl.nombre AS cliente
           FROM venta v
           JOIN ciclo_productivo c ON c.idCICLO = v.CICLO_idCICLO
           JOIN cultivo cu         ON cu.idCULTIVO = c.CULTIVO_idCULTIVO
           JOIN lote l             ON l.idLOTE = c.LOTE_idLOTE
           JOIN finca f            ON f.idFINCA = l.FINCA_idFINCA
           LEFT JOIN cliente cl    ON cl.idCLIENTE = v.CLIENTE_idCLIENTE
          ${filtro.where}
          ORDER BY v.fecha DESC, v.idVENTA DESC`,
        filtro.params
    );
    res.json(filas);
};

const leerVenta = async (req, b) => {
    const ciclo = await cicloPermitido(req, entero(b.CICLO_idCICLO, 'El cultivo / ciclo', { req: true }));
    const cliente = entero(b.CLIENTE_idCLIENTE, 'El cliente');
    if (cliente) await contactoDeFinca('cliente', 'idCLIENTE', cliente, ciclo.FINCA_idFINCA);

    return {
        CICLO_idCICLO: ciclo.idCICLO,
        CLIENTE_idCLIENTE: cliente,
        cantidad: numero(b.cantidad, 'La cantidad', { req: true, positivo: true }),
        unidad: opcion(b.unidad, UNIDADES, 'La unidad', { porDefecto: 'TN' }),
        precio_unitario: numero(b.precio_unitario, 'El precio unitario', { req: true, min: 0 }),
        fecha: fecha(b.fecha, 'La fecha', { req: true }),
        observaciones: texto(b.observaciones, 'Las observaciones', { max: 255 }),
    };
};

const COLUMNAS = ['CICLO_idCICLO', 'CLIENTE_idCLIENTE', 'cantidad', 'unidad', 'precio_unitario', 'fecha', 'observaciones'];

const exigirRegistro = async (req, id) => {
    const [r] = await pool.query(
        `SELECT l.FINCA_idFINCA AS finca FROM venta v
           JOIN ciclo_productivo c ON c.idCICLO = v.CICLO_idCICLO
           JOIN lote l ON l.idLOTE = c.LOTE_idLOTE
          WHERE v.idVENTA = ?`,
        [id]
    );
    if (!r.length) throw noEncontrado('Venta no encontrada');
    await exigirFinca(req, r[0].finca);
};

export const crearVenta = async (req, res) => {
    const d = await leerVenta(req, req.body);
    const [r] = await pool.query(
        `INSERT INTO venta (${COLUMNAS.join(', ')}) VALUES (${COLUMNAS.map(() => '?').join(', ')})`,
        COLUMNAS.map((c) => d[c])
    );
    res.status(201).json({ mensaje: 'Venta registrada con éxito', id: r.insertId });
};

export const modificarVenta = async (req, res) => {
    await exigirRegistro(req, req.params.id);
    const d = await leerVenta(req, req.body);
    await pool.query(
        `UPDATE venta SET ${COLUMNAS.map((c) => `${c} = ?`).join(', ')} WHERE idVENTA = ?`,
        [...COLUMNAS.map((c) => d[c]), req.params.id]
    );
    res.json({ mensaje: 'Venta actualizada correctamente' });
};

export const eliminarVenta = async (req, res) => {
    await exigirRegistro(req, req.params.id);
    await pool.query('DELETE FROM venta WHERE idVENTA = ?', [req.params.id]);
    res.json({ mensaje: 'Venta eliminada' });
};
