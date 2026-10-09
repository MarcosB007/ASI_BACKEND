import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET;

// Verifica que venga un token válido en el header Authorization: Bearer <token>
export const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ mensaje: 'No se proporcionó un token de autenticación' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.usuario = payload; // queda disponible en los controllers como req.usuario
        next();
    } catch (error) {
        return res.status(401).json({ mensaje: 'Token inválido o expirado' });
    }
};

// Normaliza el rol del token ("admin", "ADMIN ", etc.) para compararlo siempre igual
export const rolDe = (req) => String(req.usuario?.rol ?? '').trim().toUpperCase();

export const esAdmin = (req) => rolDe(req) === 'ADMIN';

// Solo deja pasar a los usuarios con rol ADMIN (debe ir DESPUÉS de verificarToken)
export const soloAdmin = (req, res, next) => {
    if (!esAdmin(req)) {
        return res.status(403).json({ mensaje: 'No tenés permisos para realizar esta acción' });
    }
    next();
};
