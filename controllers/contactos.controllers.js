import { pool } from '../database/db.js';
import { esAdmin } from '../middleware/auth.middleware.js';
import { badRequest, noEncontrado, prohibido } from '../utils/http.js';
import { texto, email, entero } from '../utils/validar.js';
import { propietariosVisibles } from '../utils/acceso.js';

// Clientes y proveedores son casi iguales (RF-50 a RF-54), así que comparten esta fábrica.
// Cada productor tiene su propia libreta; el ADMIN ve todas.
const crearControllers = ({ tabla, id, singular, extras, historial }) => {
    const campos = ['nombre', 'cuit', 'telefono', 'email', ...extras];

    const leer = (b) => ({
        nombre: texto(b.nombre, 'El nombre', { max: 120, req: true }),
        cuit: texto(b.cuit, 'El CUIT', { max: 15 }),
        telefono: texto(b.telefono, 'El teléfono', { max: 30 }),
        email: email(b.email, 'El email'),
        rubro: texto(b.rubro, 'El rubro', { max: 60 }),
    });

    // Trae el registro y verifica que sea del usuario (o que sea ADMIN)
    const cargar = async (req, idRegistro) => {
        const [r] = await pool.query(`SELECT * FROM ${tabla} WHERE ${id} = ?`, [idRegistro]);
        if (!r.length) throw noEncontrado(`${singular} no encontrado`);
        if (!esAdmin(req) && r[0].USUARIO_idPROPIETARIO !== req.usuario.id) throw prohibido();
        return r[0];
    };

    return {
        listar: async (req, res) => {
            const duenos = await propietariosVisibles(req);
            if (duenos !== null && duenos.length === 0) return res.json([]);
            const [filas] = await pool.query(
                `SELECT t.*, CONCAT(u.nombre, ' ', u.apellido) AS propietario
                   FROM ${tabla} t JOIN usuario u ON u.idUSUARIO = t.USUARIO_idPROPIETARIO
                  ${duenos === null ? '' : 'WHERE t.USUARIO_idPROPIETARIO IN (?)'}
                  ORDER BY t.estado DESC, t.nombre`,
                duenos === null ? [] : [duenos]
            );
            res.json(filas);
        },

        crear: async (req, res) => {
            const d = leer(req.body);
            let dueno = req.usuario.id;
            if (esAdmin(req)) {
                dueno = entero(req.body.USUARIO_idPROPIETARIO, 'El propietario', { req: true });
                const [u] = await pool.query("SELECT 1 FROM usuario WHERE idUSUARIO = ? AND rol = 'PRODUCTOR' AND estado = 1", [dueno]);
                if (!u.length) throw badRequest('El propietario debe ser un productor activo');
            }
            const cols = ['USUARIO_idPROPIETARIO', ...campos];
            const [r] = await pool.query(
                `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
                [dueno, ...campos.map((c) => d[c])]
            );
            res.status(201).json({ mensaje: `${singular} creado con éxito`, id: r.insertId });
        },

        modificar: async (req, res) => {
            await cargar(req, req.params.id);
            const d = leer(req.body);
            await pool.query(
                `UPDATE ${tabla} SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE ${id} = ?`,
                [...campos.map((c) => d[c]), req.params.id]
            );
            res.json({ mensaje: `${singular} actualizado correctamente` });
        },

        baja: async (req, res) => {
            await cargar(req, req.params.id);
            await pool.query(`UPDATE ${tabla} SET estado = 0 WHERE ${id} = ?`, [req.params.id]);
            res.json({ mensaje: `${singular} dado de baja` });
        },

        alta: async (req, res) => {
            await cargar(req, req.params.id);
            await pool.query(`UPDATE ${tabla} SET estado = 1 WHERE ${id} = ?`, [req.params.id]);
            res.json({ mensaje: `${singular} reactivado` });
        },

        // RF-54: historial de operaciones (ventas del cliente / gastos del proveedor) con su total
        historial: async (req, res) => {
            const registro = await cargar(req, req.params.id);
            const [operaciones] = await pool.query(historial.sql, [registro[id]]);
            const total = operaciones.reduce((s, o) => s + o.total, 0);
            res.json({ nombre: registro.nombre, cantidad_operaciones: operaciones.length, total, operaciones });
        },
    };
};

export const clientes = crearControllers({
    tabla: 'cliente',
    id: 'idCLIENTE',
    singular: 'Cliente',
    extras: [],
    historial: {
        sql: `SELECT v.idVENTA AS id, v.fecha, cu.nombre AS detalle, f.nombre AS finca,
                     v.cantidad, v.unidad, v.precio_unitario, v.total
                FROM venta v
                JOIN ciclo_productivo c ON c.idCICLO = v.CICLO_idCICLO
                JOIN cultivo cu         ON cu.idCULTIVO = c.CULTIVO_idCULTIVO
                JOIN lote l             ON l.idLOTE = c.LOTE_idLOTE
                JOIN finca f            ON f.idFINCA = l.FINCA_idFINCA
               WHERE v.CLIENTE_idCLIENTE = ?
               ORDER BY v.fecha DESC`,
    },
});

export const proveedores = crearControllers({
    tabla: 'proveedor',
    id: 'idPROVEEDOR',
    singular: 'Proveedor',
    extras: ['rubro'],
    historial: {
        sql: `SELECT g.idGASTO AS id, g.fecha, g.concepto AS detalle, f.nombre AS finca,
                     cat.nombre AS categoria, g.importe AS total
                FROM gasto g
                JOIN finca f             ON f.idFINCA = g.FINCA_idFINCA
                JOIN categoria_gasto cat ON cat.idCATEGORIA = g.CATEGORIA_idCATEGORIA
               WHERE g.PROVEEDOR_idPROVEEDOR = ?
               ORDER BY g.fecha DESC`,
    },
});
