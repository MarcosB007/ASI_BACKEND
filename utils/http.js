// Error con código HTTP: se lanza desde los controllers y lo traduce manejarErrores
export class HttpError extends Error {
    constructor(status, mensaje) {
        super(mensaje);
        this.status = status;
    }
}

export const badRequest = (m) => new HttpError(400, m);
export const noEncontrado = (m = 'Registro no encontrado') => new HttpError(404, m);
export const prohibido = (m = 'No tenés permisos para realizar esta acción') => new HttpError(403, m);

// Middleware final de Express: convierte cualquier error en una respuesta JSON { mensaje }
export const manejarErrores = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) return res.status(err.status).json({ mensaje: err.message });

    switch (err.code) {
        case 'ER_DUP_ENTRY':
            return res.status(409).json({ mensaje: 'Ya existe un registro con esos datos (valor repetido)' });
        case 'ER_NO_REFERENCED_ROW_2':
            return res.status(400).json({ mensaje: 'Uno de los datos relacionados no existe' });
        case 'ER_ROW_IS_REFERENCED_2':
            return res.status(409).json({ mensaje: 'No se puede eliminar: tiene registros asociados' });
        case 'ER_CHECK_CONSTRAINT_VIOLATED':
            return res.status(400).json({ mensaje: 'Algún valor numérico está fuera del rango permitido' });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ mensaje: 'JSON inválido' });

    console.error(err);
    res.status(500).json({ mensaje: 'Error en el servidor' });
};
