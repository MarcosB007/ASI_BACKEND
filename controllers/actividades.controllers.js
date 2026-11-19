import { pool } from '../database/db.js';
import { badRequest, noEncontrado } from '../utils/http.js';
import { texto, entero, fecha, opcion, idQuery, fechaQuery } from '../utils/validar.js';
import { fincasPermitidas, filtroFincas, exigirFinca, lotePermitido, cicloPermitido } from '../utils/acceso.js';
import { crearFiltro } from '../utils/filtro.js';

const TIPOS = ['SIEMBRA', 'FERTILIZACION', 'AGROQUIMICOS', 'COSECHA', 'OTRA'];
const ESTADOS = ['PENDIENTE', 'HECHA', 'CANCELADA'];

// ---------------------------------------------------------------- LABORES (RF 28)

// `dias` = días que faltan para la fecha programada (negativo = ya pasó)
export const obtenerActividades = async (req, res) => {
    const f = filtroFincas(await fincasPermitidas(req), 'a.FINCA_idFINCA');
    const filtro = crearFiltro()
        .add(f.sql, ...f.params)
        .si(idQuery(req.query.finca), 'a.FINCA_idFINCA = ?')
        .si(opcion(req.query.estado, ESTADOS, 'El estado', { req: false }), 'a.estado = ?')
        .si(opcion(req.query.tipo, TIPOS, 'El tipo', { req: false }), 'a.tipo = ?')
        .si(fechaQuery(req.query.desde), 'a.fecha_programada >= ?')
        .si(fechaQuery(req.query.hasta), 'a.fecha_programada <= ?');

    const [filas] = await pool.query(
        `SELECT a.*, f.nombre AS finca, l.nombre AS lote, cu.nombre AS cultivo, c.campania,
                DATEDIFF(a.fecha_programada, CURDATE()) AS dias
           FROM actividad a
           JOIN finca f                 ON f.idFINCA = a.FINCA_idFINCA
           LEFT JOIN lote l             ON l.idLOTE = a.LOTE_idLOTE
           LEFT JOIN ciclo_productivo c ON c.idCICLO = a.CICLO_idCICLO
           LEFT JOIN cultivo cu         ON cu.idCULTIVO = c.CULTIVO_idCULTIVO
          ${filtro.where}
          ORDER BY a.fecha_programada ASC, a.idACTIVIDAD ASC`,
        filtro.params
    );
    res.json(filas);
};

// El lote y el cultivo deben ser de la finca elegida. Si se indica un cultivo, el lote se completa solo.
const leerActividad = async (req, b) => {
    const finca = entero(b.FINCA_idFINCA, 'La finca', { req: true });
    await exigirFinca(req, finca);

    let lote = entero(b.LOTE_idLOTE, 'El lote');
    const ciclo = entero(b.CICLO_idCICLO, 'El cultivo');
    if (ciclo) {
        const c = await cicloPermitido(req, ciclo);
        if (c.FINCA_idFINCA !== finca) throw badRequest('El cultivo elegido no pertenece a esa finca');
        if (lote && lote !== c.LOTE_idLOTE) throw badRequest('El cultivo elegido no corresponde a ese lote');
        lote = c.LOTE_idLOTE;
    } else if (lote) {
        const l = await lotePermitido(req, lote);
        if (l.FINCA_idFINCA !== finca) throw badRequest('El lote no pertenece a esa finca');
    }

    const estado = opcion(b.estado, ESTADOS, 'El estado', { porDefecto: 'PENDIENTE' });
    return {
        FINCA_idFINCA: finca,
        LOTE_idLOTE: lote,
        CICLO_idCICLO: ciclo,
        tipo: opcion(b.tipo, TIPOS, 'El tipo', { porDefecto: 'OTRA' }),
        descripcion: texto(b.descripcion, 'La descripción', { max: 150, req: true }),
        fecha_programada: fecha(b.fecha_programada, 'La fecha programada', { req: true }),
        estado,
        // al marcarla como hecha se guarda cuándo; si no, queda vacía
        fecha_realizada: estado === 'HECHA' ? (fecha(b.fecha_realizada, 'La fecha de realización') ?? new Date().toISOString().slice(0, 10)) : null,
        observaciones: texto(b.observaciones, 'Las observaciones', { max: 255 }),
    };
};

const COLUMNAS = ['FINCA_idFINCA', 'LOTE_idLOTE', 'CICLO_idCICLO', 'tipo', 'descripcion', 'fecha_programada', 'estado', 'fecha_realizada', 'observaciones'];

const exigirRegistro = async (req, id) => {
    const [r] = await pool.query('SELECT FINCA_idFINCA AS finca FROM actividad WHERE idACTIVIDAD = ?', [id]);
    if (!r.length) throw noEncontrado('Labor no encontrada');
    await exigirFinca(req, r[0].finca);
};

export const crearActividad = async (req, res) => {
    const d = await leerActividad(req, req.body);
    const [r] = await pool.query(
        `INSERT INTO actividad (${COLUMNAS.join(', ')}) VALUES (${COLUMNAS.map(() => '?').join(', ')})`,
        COLUMNAS.map((c) => d[c])
    );
    res.status(201).json({ mensaje: 'Labor programada con éxito', id: r.insertId });
};

export const modificarActividad = async (req, res) => {
    await exigirRegistro(req, req.params.id);
    const d = await leerActividad(req, req.body);
    await pool.query(
        `UPDATE actividad SET ${COLUMNAS.map((c) => `${c} = ?`).join(', ')} WHERE idACTIVIDAD = ?`,
        [...COLUMNAS.map((c) => d[c]), req.params.id]
    );
    res.json({ mensaje: 'Labor actualizada correctamente' });
};

// Atajo: marcar una labor como hecha hoy
export const completarActividad = async (req, res) => {
    await exigirRegistro(req, req.params.id);
    await pool.query("UPDATE actividad SET estado = 'HECHA', fecha_realizada = CURDATE() WHERE idACTIVIDAD = ?", [req.params.id]);
    res.json({ mensaje: 'Labor marcada como hecha' });
};

export const eliminarActividad = async (req, res) => {
    await exigirRegistro(req, req.params.id);
    await pool.query('DELETE FROM actividad WHERE idACTIVIDAD = ?', [req.params.id]);
    res.json({ mensaje: 'Labor eliminada' });
};

// ---------------------------------------------------------------- ALERTAS (RF 29)
// Qué hay que atender: labores pendientes vencidas o próximas, y además los avisos que salen solos
// de las fechas de los cultivos (siembra prevista de un cultivo planificado y cosecha estimada de
// uno en curso). Si ya hay una labor pendiente del mismo tipo para ese cultivo, no se repite.
export const obtenerAlertas = async (req, res) => {
    const dias = Math.min(Math.max(Number(req.query.dias) || 7, 1), 60);
    const ids = await fincasPermitidas(req);
    const fa = filtroFincas(ids, 'a.FINCA_idFINCA');
    const fl = filtroFincas(ids, 'l.FINCA_idFINCA');

    const [[labores], [ciclos]] = await Promise.all([
        pool.query(
            `SELECT a.idACTIVIDAD AS id, a.tipo, a.descripcion AS titulo, f.nombre AS finca, l.nombre AS lote, cu.nombre AS cultivo,
                    a.fecha_programada AS fecha, DATEDIFF(a.fecha_programada, CURDATE()) AS dias
               FROM actividad a
               JOIN finca f                 ON f.idFINCA = a.FINCA_idFINCA
               LEFT JOIN lote l             ON l.idLOTE = a.LOTE_idLOTE
               LEFT JOIN ciclo_productivo c ON c.idCICLO = a.CICLO_idCICLO
               LEFT JOIN cultivo cu         ON cu.idCULTIVO = c.CULTIVO_idCULTIVO
              WHERE a.estado = 'PENDIENTE' AND ${fa.sql}
                AND a.fecha_programada <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
            [...fa.params, dias]
        ),
        pool.query(
            `SELECT * FROM (
                 SELECT c.idCICLO AS id,
                        IF(c.estado = 'PLANIFICADO', 'SIEMBRA', 'COSECHA') AS tipo,
                        CONCAT(IF(c.estado = 'PLANIFICADO', 'Siembra prevista de ', 'Cosecha estimada de '), cu.nombre) AS titulo,
                        f.nombre AS finca, l.nombre AS lote, cu.nombre AS cultivo,
                        IF(c.estado = 'PLANIFICADO', c.fecha_siembra, c.fecha_estimada_cosecha) AS fecha,
                        DATEDIFF(IF(c.estado = 'PLANIFICADO', c.fecha_siembra, c.fecha_estimada_cosecha), CURDATE()) AS dias
                   FROM ciclo_productivo c
                   JOIN cultivo cu ON cu.idCULTIVO = c.CULTIVO_idCULTIVO
                   JOIN lote l     ON l.idLOTE = c.LOTE_idLOTE
                   JOIN finca f    ON f.idFINCA = l.FINCA_idFINCA
                  WHERE ${fl.sql}
                    AND ((c.estado = 'PLANIFICADO' AND c.fecha_siembra IS NOT NULL)
                      OR (c.estado IN ('SEMBRADO', 'EN_DESARROLLO') AND c.fecha_estimada_cosecha IS NOT NULL))
                    AND NOT EXISTS (SELECT 1 FROM actividad a
                                     WHERE a.CICLO_idCICLO = c.idCICLO AND a.estado = 'PENDIENTE'
                                       AND a.tipo = IF(c.estado = 'PLANIFICADO', 'SIEMBRA', 'COSECHA'))
             ) t WHERE t.dias <= ?`,
            [...fl.params, dias]
        ),
    ]);

    const items = [
        ...labores.map((x) => ({ ...x, origen: 'LABOR' })),
        ...ciclos.map((x) => ({ ...x, origen: 'CULTIVO' })),
    ]
        .map((x) => ({ ...x, severidad: x.dias < 0 ? 'VENCIDA' : x.dias === 0 ? 'HOY' : 'PROXIMA' }))
        .sort((a, b) => a.dias - b.dias);

    res.json({
        dias,
        total: items.length,
        vencidas: items.filter((i) => i.severidad === 'VENCIDA').length,
        hoy: items.filter((i) => i.severidad === 'HOY').length,
        proximas: items.filter((i) => i.severidad === 'PROXIMA').length,
        items,
    });
};
