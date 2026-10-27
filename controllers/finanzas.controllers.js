import { pool } from '../database/db.js';
import { rolDe } from '../middleware/auth.middleware.js';
import { prohibido, badRequest } from '../utils/http.js';
import { opcion, idQuery, fechaQuery } from '../utils/validar.js';
import { fincasPermitidas, filtroFincas } from '../utils/acceso.js';
import { crearFiltro } from '../utils/filtro.js';

// Pasa cantidades a toneladas para poder sumar producción de distintas unidades
const A_TONELADAS = `CASE p.unidad WHEN 'TN' THEN p.cantidad WHEN 'KG' THEN p.cantidad / 1000 WHEN 'QQ' THEN p.cantidad / 10 END`;

const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Resuelve el alcance (fincas permitidas ∩ finca elegida) y el período pedido
const leerAlcance = async (req) => {
    let ids = await fincasPermitidas(req);
    const finca = idQuery(req.query.finca);
    if (finca) {
        if (ids !== null && !ids.includes(finca)) throw prohibido('No tenés acceso a esa finca');
        ids = [finca];
    }
    const desde = fechaQuery(req.query.desde);
    const hasta = fechaQuery(req.query.hasta);
    if (desde && hasta && hasta < desde) throw badRequest('La fecha "hasta" no puede ser anterior a "desde"');
    return { ids, desde, hasta };
};

// ---------------------------------------------------------------- DASHBOARD (RF-40 a RF-44)
export const obtenerDashboard = async (req, res) => {
    const { ids, desde, hasta } = await leerAlcance(req);
    // El encargado carga datos pero no ve ventas ni resultados económicos
    const verIngresos = rolDe(req) !== 'ENCARGADO';

    // Filtro de fincas + período sobre la tabla/alias que corresponda
    const periodo = (colFinca, colFecha) => {
        const f = filtroFincas(ids, colFinca);
        return crearFiltro().add(f.sql, ...f.params).si(desde, `${colFecha} >= ?`).si(hasta, `${colFecha} <= ?`);
    };

    const fFincas = filtroFincas(ids, 'f.idFINCA');
    const fLotes = filtroFincas(ids, 'l.FINCA_idFINCA');
    const prod = periodo('l.FINCA_idFINCA', 'p.fecha_cosecha');
    const mov = periodo('m.finca_id', 'm.fecha');
    const movSerie = periodo('m.finca_id', 'm.fecha');
    const movCultivo = periodo('m.finca_id', 'm.fecha');
    const movCategoria = periodo('g.FINCA_idFINCA', 'g.fecha');

    const [[fincas], [lotes], [hect], [produccion], [totales], [serie], [porCultivo], [porCategoria]] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS n FROM finca f WHERE f.estado = 1 AND ${fFincas.sql}`, fFincas.params),
        pool.query(`SELECT COUNT(*) AS n FROM lote l WHERE l.estado = 1 AND ${fLotes.sql}`, fLotes.params),
        pool.query(
            `SELECT COALESCE(SUM(c.superficie_cultivada), 0) AS ha
               FROM ciclo_productivo c JOIN lote l ON l.idLOTE = c.LOTE_idLOTE
              WHERE c.estado IN ('SEMBRADO', 'EN_DESARROLLO') AND ${fLotes.sql}`,
            fLotes.params
        ),
        pool.query(
            `SELECT COALESCE(SUM(${A_TONELADAS}), 0) AS tn
               FROM produccion p
               JOIN ciclo_productivo c ON c.idCICLO = p.CICLO_idCICLO
               JOIN lote l ON l.idLOTE = c.LOTE_idLOTE
              ${prod.where}`,
            prod.params
        ),
        pool.query(
            `SELECT COALESCE(SUM(m.ingreso), 0) AS ingresos, COALESCE(SUM(m.gasto), 0) AS gastos
               FROM v_movimiento m ${mov.where}`,
            mov.params
        ),
        pool.query(
            `SELECT DATE_FORMAT(m.fecha, '%Y-%m') AS mes, SUM(m.ingreso) AS ingresos, SUM(m.gasto) AS gastos
               FROM v_movimiento m ${movSerie.where}
              GROUP BY mes ORDER BY mes`,
            movSerie.params
        ),
        pool.query(
            `SELECT cu.nombre AS cultivo, SUM(m.ingreso) AS ingresos, SUM(m.gasto) AS gastos,
                    SUM(m.ingreso) - SUM(m.gasto) AS ganancia
               FROM v_movimiento m JOIN cultivo cu ON cu.idCULTIVO = m.cultivo_id
              ${movCultivo.where}
              GROUP BY cu.idCULTIVO, cu.nombre ORDER BY ganancia DESC`,
            movCultivo.params
        ),
        pool.query(
            `SELECT cat.nombre AS categoria, SUM(g.importe) AS total
               FROM gasto g JOIN categoria_gasto cat ON cat.idCATEGORIA = g.CATEGORIA_idCATEGORIA
              ${movCategoria.where}
              GROUP BY cat.idCATEGORIA, cat.nombre ORDER BY total DESC`,
            movCategoria.params
        ),
    ]);

    const ingresos = redondear(totales[0].ingresos);
    const gastos = redondear(totales[0].gastos);

    res.json({
        kpis: {
            fincas: fincas[0].n,
            lotes: lotes[0].n,
            hectareas_cultivadas: hect[0].ha,
            produccion_tn: redondear(produccion[0].tn),
            ingresos: verIngresos ? ingresos : null,
            gastos,
            ganancia: verIngresos ? redondear(ingresos - gastos) : null,
        },
        serie_mensual: serie.map((s) => ({
            mes: s.mes,
            ingresos: verIngresos ? s.ingresos : null,
            gastos: s.gastos,
        })),
        por_cultivo: verIngresos ? porCultivo : [],
        gastos_por_categoria: porCategoria,
    });
};

// ---------------------------------------------------------------- RENTABILIDAD (RF-34 a RF-39)
// Ganancia = ingresos − gastos, agrupada por finca, lote, cultivo o campaña.
// Los gastos que no están ligados a un cultivo/lote se muestran como "generales".
const AGRUPACIONES = {
    finca: {
        joins: 'JOIN finca f ON f.idFINCA = m.finca_id',
        clave: 'm.finca_id',
        nombre: 'f.nombre',
        groupBy: 'm.finca_id, f.nombre',
    },
    lote: {
        joins: 'JOIN finca f ON f.idFINCA = m.finca_id LEFT JOIN lote l ON l.idLOTE = m.lote_id',
        clave: "CONCAT(m.finca_id, '-', COALESCE(m.lote_id, 0))",
        nombre: "CONCAT(f.nombre, ' · ', COALESCE(l.nombre, 'Gastos generales'))",
        groupBy: 'm.finca_id, m.lote_id, f.nombre, l.nombre',
    },
    cultivo: {
        joins: 'LEFT JOIN cultivo cu ON cu.idCULTIVO = m.cultivo_id',
        clave: 'COALESCE(m.cultivo_id, 0)',
        nombre: "COALESCE(cu.nombre, 'Gastos generales')",
        groupBy: 'm.cultivo_id, cu.nombre',
    },
    campania: {
        joins: '',
        clave: "COALESCE(m.campania, '')",
        nombre: "COALESCE(m.campania, 'Sin campaña')",
        groupBy: 'm.campania',
    },
};

export const obtenerRentabilidad = async (req, res) => {
    const agrupar = opcion(req.query.agrupar, Object.keys(AGRUPACIONES).map((k) => k.toUpperCase()), 'La agrupación', {
        porDefecto: 'CULTIVO',
    }).toLowerCase();
    const a = AGRUPACIONES[agrupar];
    const { ids, desde, hasta } = await leerAlcance(req);

    const f = filtroFincas(ids, 'm.finca_id');
    const filtro = crearFiltro()
        .add(f.sql, ...f.params)
        .si(idQuery(req.query.cultivo), 'm.cultivo_id = ?')
        .si(desde, 'm.fecha >= ?')
        .si(hasta, 'm.fecha <= ?');

    const [filas] = await pool.query(
        `SELECT ${a.clave} AS clave, ${a.nombre} AS nombre,
                SUM(m.ingreso) AS ingresos, SUM(m.gasto) AS gastos,
                SUM(m.ingreso) - SUM(m.gasto) AS ganancia
           FROM v_movimiento m ${a.joins}
          ${filtro.where}
          GROUP BY ${a.groupBy}
          ORDER BY ganancia DESC`,
        filtro.params
    );

    // Rentabilidad = ganancia sobre lo invertido (%). Sin gastos no se puede calcular.
    const grupos = filas.map((r) => ({
        clave: String(r.clave),
        nombre: r.nombre,
        ingresos: redondear(r.ingresos),
        gastos: redondear(r.gastos),
        ganancia: redondear(r.ganancia),
        rentabilidad_pct: r.gastos > 0 ? redondear((r.ganancia / r.gastos) * 100) : null,
    }));

    const ingresos = redondear(grupos.reduce((s, g) => s + g.ingresos, 0));
    const gastos = redondear(grupos.reduce((s, g) => s + g.gastos, 0));
    res.json({
        agrupar,
        totales: {
            ingresos,
            gastos,
            ganancia: redondear(ingresos - gastos),
            rentabilidad_pct: gastos > 0 ? redondear(((ingresos - gastos) / gastos) * 100) : null,
        },
        grupos,
    });
};
