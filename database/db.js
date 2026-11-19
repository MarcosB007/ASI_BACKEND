import { createPool } from 'mysql2/promise';
import 'dotenv/config';

export const pool = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    // DECIMAL llega como número (no como texto) y DATE como "AAAA-MM-DD" (sin correrse por zona horaria)
    decimalNumbers: true,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
});
