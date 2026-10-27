import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET;

// Verifica que venga un token válido en el header Authorization: Bearer <token>
export const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ mensaje: 'No se proporcionó un token de autenticación' });
    }

    try {
        req.usuario = jwt.verify(authHeader.split(' ')[1], JWT_SECRET); // { id, rol }
        next();
    } catch {
        return res.status(401).json({ mensaje: 'Token inválido o expirado' });
    }
};

// Normaliza el rol del token para compararlo siempre igual
export const rolDe = (req) => String(req.usuario?.rol ?? '').trim().toUpperCase();
export const esAdmin = (req) => rolDe(req) === 'ADMIN';

// permitir('ADMIN', 'PRODUCTOR') → solo deja pasar a esos roles (va DESPUÉS de verificarToken)
export const permitir = (...roles) => (req, res, next) => {
    if (!roles.includes(rolDe(req))) {
        return res.status(403).json({ mensaje: 'No tenés permisos para realizar esta acción' });
    }
    next();
};

export const soloAdmin = permitir('ADMIN');
export const adminProductor = permitir('ADMIN', 'PRODUCTOR');
export const todosLosRoles = permitir('ADMIN', 'PRODUCTOR', 'ENCARGADO');
