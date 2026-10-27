import { badRequest } from './http.js';

const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

// Cada validador devuelve el valor limpio, o null si el campo es opcional y vino vacío.

export const texto = (v, nombre, { max = 255, req = false } = {}) => {
    if (vacio(v)) {
        if (req) throw badRequest(`${nombre} es requerido`);
        return null;
    }
    const t = String(v).trim();
    if (t.length > max) throw badRequest(`${nombre} no puede superar los ${max} caracteres`);
    return t;
};

export const numero = (v, nombre, { min, req = false, positivo = false } = {}) => {
    if (vacio(v)) {
        if (req) throw badRequest(`${nombre} es requerido`);
        return null;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) throw badRequest(`${nombre} debe ser un número`);
    if (positivo && n <= 0) throw badRequest(`${nombre} debe ser mayor a 0`);
    if (min !== undefined && n < min) throw badRequest(`${nombre} no puede ser menor a ${min}`);
    return n;
};

export const entero = (v, nombre, { req = false } = {}) => {
    const n = numero(v, nombre, { req });
    if (n !== null && (!Number.isInteger(n) || n <= 0)) throw badRequest(`${nombre} no es válido`);
    return n;
};

export const fecha = (v, nombre, { req = false } = {}) => {
    if (vacio(v)) {
        if (req) throw badRequest(`${nombre} es requerida`);
        return null;
    }
    const s = String(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
        throw badRequest(`${nombre} no es una fecha válida (AAAA-MM-DD)`);
    }
    return s;
};

export const opcion = (v, lista, nombre, { req = true, porDefecto = null } = {}) => {
    if (vacio(v)) {
        if (porDefecto !== null) return porDefecto;
        if (req) throw badRequest(`${nombre} es requerido`);
        return null;
    }
    const s = String(v).trim().toUpperCase();
    if (!lista.includes(s)) throw badRequest(`${nombre} debe ser uno de: ${lista.join(', ')}`);
    return s;
};

export const email = (v, nombre = 'El email', { req = false } = {}) => {
    const t = texto(v, nombre, { max: 120, req });
    if (t !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw badRequest(`${nombre} no es válido`);
    return t;
};

export const password = (v) => {
    if (typeof v !== 'string' || v.length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
    return v;
};

export const UNIDADES = ['TN', 'KG', 'QQ'];
export const ESTADOS_CICLO = ['PLANIFICADO', 'SEMBRADO', 'EN_DESARROLLO', 'COSECHADO', 'CANCELADO'];
export const ROLES = ['ADMIN', 'PRODUCTOR', 'ENCARGADO'];

// Filtros de listado opcionales (?finca=1&desde=2026-01-01). Un valor inválido se ignora.
export const idQuery = (v) => {
    if (vacio(v)) return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};
export const fechaQuery = (v) => (vacio(v) ? null : fecha(v, 'La fecha'));
