import { pool } from '../database/db.js';
import { esAdmin } from '../middleware/auth.middleware.js';
import { prohibido, noEncontrado } from './http.js';

// Ids de fincas que el usuario puede ver. null = todas (ADMIN, dueño de todas las tierras).
// El ENCARGADO ve únicamente las fincas de las que es responsable.
export const fincasPermitidas = async (req) => {
    if (esAdmin(req)) return null;
    const [filas] = await pool.query('SELECT idFINCA AS id FROM finca WHERE USUARIO_idPROPIETARIO = ?', [req.usuario.id]);
    return filas.map((f) => f.id);
};

// Fragmento SQL "columna IN (...)" para filtrar por las fincas permitidas
export const filtroFincas = (ids, columna) => {
    if (ids === null) return { sql: '1 = 1', params: [] };
    if (ids.length === 0) return { sql: '1 = 0', params: [] };
    return { sql: `${columna} IN (?)`, params: [ids] };
};

export const exigirFinca = async (req, idFinca) => {
    const ids = await fincasPermitidas(req);
    if (ids !== null && !ids.includes(Number(idFinca))) throw prohibido('No tenés acceso a esa finca');
};

// Solo el ADMIN o el encargado responsable pueden operar sobre la finca en sí. Devuelve el id del responsable.
export const exigirPropietario = async (req, idFinca) => {
    const [f] = await pool.query('SELECT USUARIO_idPROPIETARIO AS dueno FROM finca WHERE idFINCA = ?', [idFinca]);
    if (!f.length) throw noEncontrado('Finca no encontrada');
    if (!esAdmin(req) && f[0].dueno !== req.usuario.id) throw prohibido('No tenés acceso a esa finca');
    return f[0].dueno;
};

// Encargados cuya libreta de clientes/proveedores puede ver el usuario. null = todos (ADMIN).
export const propietariosVisibles = async (req) => (esAdmin(req) ? null : [req.usuario.id]);

// Lote con su finca, validando que el usuario tenga acceso
export const lotePermitido = async (req, idLote) => {
    const [l] = await pool.query('SELECT idLOTE, FINCA_idFINCA, superficie FROM lote WHERE idLOTE = ?', [idLote]);
    if (!l.length) throw noEncontrado('Lote no encontrado');
    await exigirFinca(req, l[0].FINCA_idFINCA);
    return l[0];
};

// Ciclo con su finca, validando acceso
export const cicloPermitido = async (req, idCiclo) => {
    const [c] = await pool.query(
        `SELECT c.idCICLO, c.LOTE_idLOTE, c.CULTIVO_idCULTIVO, c.superficie_cultivada, c.estado, l.FINCA_idFINCA
           FROM ciclo_productivo c JOIN lote l ON l.idLOTE = c.LOTE_idLOTE
          WHERE c.idCICLO = ?`,
        [idCiclo]
    );
    if (!c.length) throw noEncontrado('Ciclo productivo no encontrado');
    await exigirFinca(req, c[0].FINCA_idFINCA);
    return c[0];
};

// Valida que el cliente/proveedor pertenezca al encargado de la finca.
// El ADMIN puede usar cualquiera: para él solo se verifica que exista.
export const contactoDeFinca = async (req, tabla, columnaId, id, idFinca) => {
    const [r] = esAdmin(req)
        ? await pool.query(`SELECT 1 FROM ${tabla} WHERE ${columnaId} = ?`, [id])
        : await pool.query(
              `SELECT 1 FROM ${tabla} t JOIN finca f ON f.USUARIO_idPROPIETARIO = t.USUARIO_idPROPIETARIO
                WHERE t.${columnaId} = ? AND f.idFINCA = ?`,
              [id, idFinca]
          );
    if (!r.length) throw noEncontrado(`${tabla === 'cliente' ? 'Cliente' : 'Proveedor'} no encontrado para esta finca`);
};
