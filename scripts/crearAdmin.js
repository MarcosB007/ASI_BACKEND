// Crea (o actualiza la contraseña de) el usuario administrador inicial.
// Uso:  npm run crear-admin   (lee ADMIN_USERNAME, ADMIN_PASSWORD y ADMIN_EMAIL del .env)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../database/db.js';

const username = process.env.ADMIN_USERNAME || 'admin';
const clave = process.env.ADMIN_PASSWORD;
const email = process.env.ADMIN_EMAIL || 'admin@agropulse.local';

if (!clave || clave.length < 6) {
    console.error('Definí ADMIN_PASSWORD (mínimo 6 caracteres) en el archivo .env');
    process.exit(1);
}

try {
    const hash = await bcrypt.hash(clave, 10);
    await pool.query(
        `INSERT INTO usuario (nombre, apellido, email, username, password, rol)
         VALUES ('Administrador', 'AgroPulse', ?, ?, ?, 'ADMIN')
         ON DUPLICATE KEY UPDATE password = VALUES(password), rol = 'ADMIN', estado = 1`,
        [email, username, hash]
    );
    console.log(`Administrador listo. Usuario: ${username}`);
} catch (e) {
    console.error('No se pudo crear el administrador:', e.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
