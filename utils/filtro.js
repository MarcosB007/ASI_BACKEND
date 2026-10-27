// Arma un WHERE con parámetros, sumando condiciones solo cuando el filtro viene informado
export const crearFiltro = () => {
    const condiciones = [];
    const params = [];

    const filtro = {
        // Condición fija (ej: el filtro por fincas permitidas)
        add(sql, ...valores) {
            condiciones.push(sql);
            params.push(...valores);
            return filtro;
        },
        // Condición opcional: solo si el valor vino informado. Usa un "?" por valor.
        si(valor, sql) {
            if (valor !== null && valor !== undefined) {
                condiciones.push(sql);
                params.push(valor);
            }
            return filtro;
        },
        get where() {
            return condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
        },
        params,
    };
    return filtro;
};
