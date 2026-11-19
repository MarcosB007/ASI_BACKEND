import { pool } from '../database/db.js';

const limpiarIp = (ip) => (ip ? String(ip).replace(/^::ffff:/, '').slice(0, 45) : null);

// Guarda una línea en el registro de actividad. Nunca rompe la operación que se está registrando.
export const registrar = async ({ usuarioId = null, usuario = null, accion, entidad, entidadId = null, detalle = null, ip = null }) => {
    try {
        let nombre = usuario;
        if (!nombre && usuarioId) {
            const [u] = await pool.query('SELECT username FROM usuario WHERE idUSUARIO = ?', [usuarioId]);
            nombre = u[0]?.username ?? null;
        }
        await pool.query(
            'INSERT INTO registro_actividad (USUARIO_idUSUARIO, usuario, accion, entidad, entidad_id, detalle, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                usuarioId,
                nombre ? String(nombre).slice(0, 60) : null,
                accion,
                entidad,
                Number.isInteger(entidadId) && entidadId > 0 ? entidadId : null,
                detalle ? String(detalle).slice(0, 255) : null,
                limpiarIp(ip),
            ]
        );
    } catch (e) {
        console.error('No se pudo registrar la actividad:', e.message);
    }
};

// Recurso de la URL → nombre de la entidad que se guarda
const ENTIDADES = {
    usuarios: 'usuario',
    fincas: 'finca',
    lotes: 'lote',
    ciclos: 'cultivo',
    cultivos: 'tipo_cultivo',
    produccion: 'produccion',
    gastos: 'gasto',
    ventas: 'venta',
    clientes: 'cliente',
    proveedores: 'proveedor',
    actividades: 'labor',
};

const accionDe = (metodo, sub) => {
    if (metodo === 'POST') return 'CREAR';
    if (metodo === 'DELETE') return 'ELIMINAR';
    if (sub === 'baja') return 'BAJA';
    if (sub === 'alta') return 'ALTA';
    if (sub === 'hecha') return 'COMPLETAR';
    return 'MODIFICAR';
};

// Middleware: registra toda operación que modifica datos y termina bien (código menor a 400).
// Guarda quién, qué, sobre qué registro y el mensaje de la respuesta; nunca guarda el cuerpo
// del pedido, para no almacenar contraseñas ni otros datos sensibles.
export const auditar = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    let cuerpo;
    const json = res.json.bind(res);
    res.json = (b) => {
        cuerpo = b;
        return json(b);
    };

    res.on('finish', () => {
        if (res.statusCode >= 400) return;
        const [recurso, id, sub] = new URL(req.originalUrl, 'http://local').pathname.split('/').filter(Boolean);
        registrar({
            usuarioId: req.usuario?.id ?? null,
            accion: accionDe(req.method, sub),
            entidad: ENTIDADES[recurso] ?? recurso ?? 'desconocido',
            entidadId: Number(id) || Number(cuerpo?.id) || null,
            detalle: cuerpo?.mensaje,
            ip: req.ip,
        });
    });
    next();
};
