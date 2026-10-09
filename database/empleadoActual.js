import { pool } from './db.js';

// El token trae el id del USUARIO; clientes y proveedores se asignan a un EMPLEADO.
// Esta función busca el empleado (activo) que corresponde al usuario logueado.
export const idEmpleadoDeUsuario = async (idUsuario) => {
    const [filas] = await pool.query(
        'SELECT idEMPLEADO FROM empleado WHERE USUARIO_idUSUARIO = ? AND estado = 1',
        [idUsuario]
    );
    return filas.length ? filas[0].idEMPLEADO : null;
};

// Valida que estado sea 1 o 0 (acepta "1"/"0"). Devuelve null si no es válido.
export const normalizarEstado = (valor, porDefecto = 1) => {
    if (valor === undefined || valor === null || valor === '') return porDefecto;
    const n = Number(valor);
    return n === 0 || n === 1 ? n : null;
};
