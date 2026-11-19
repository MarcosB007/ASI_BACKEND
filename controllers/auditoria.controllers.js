import { pool } from '../database/db.js';
import { texto, idQuery, fechaQuery } from '../utils/validar.js';
import { crearFiltro } from '../utils/filtro.js';

// Solo el ADMIN (lo controla la ruta). Los registros más nuevos primero.
export const obtenerRegistro = async (req, res) => {
    const limite = Math.min(Math.max(Number(req.query.limite) || 300, 1), 1000);
    const filtro = crearFiltro()
        .si(idQuery(req.query.usuario), 'r.USUARIO_idUSUARIO = ?')
        .si(texto(req.query.accion, 'La acción', { max: 20 }), 'r.accion = ?')
        .si(texto(req.query.entidad, 'La entidad', { max: 30 }), 'r.entidad = ?')
        .si(fechaQuery(req.query.desde), 'DATE(r.fecha) >= ?')
        .si(fechaQuery(req.query.hasta), 'DATE(r.fecha) <= ?');

    const [filas] = await pool.query(
        `SELECT r.idREGISTRO, r.fecha, r.accion, r.entidad, r.entidad_id, r.detalle, r.ip, r.USUARIO_idUSUARIO,
                COALESCE(CONCAT(u.nombre, ' ', u.apellido), r.usuario) AS nombre, r.usuario
           FROM registro_actividad r
           LEFT JOIN usuario u ON u.idUSUARIO = r.USUARIO_idUSUARIO
          ${filtro.where}
          ORDER BY r.fecha DESC, r.idREGISTRO DESC
          LIMIT ?`,
        [...filtro.params, limite]
    );
    res.json(filas);
};
