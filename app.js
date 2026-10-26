import axios from 'axios';
import Cookies from 'js-cookie';

const instance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

// Adjunta el JWT guardado en la cookie a cada request
instance.interceptors.request.use((config) => {
    const token = Cookies.get('token');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Si el token vence o es inválido, se limpia la sesión y se vuelve al login
instance.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error.config?.url ?? '';
        const esRutaDeAuth =
            url.includes('/login') || url.includes('/register');

        if (error.response?.status === 401 && !esRutaDeAuth) {
            Cookies.remove('token');
            Cookies.remove('user');

            if (window.location.pathname !== '/login') {
                window.location.assign('/login');
            }
        }

        return Promise.reject(error);
    }
);

// Manejo de mensajes de error
export const mensajesDeError = (error) => {
    if (!error.response) {
        return ['No se pudo conectar con el servidor'];
    }

    const { status, data } = error.response;

    if (status === 404 && typeof data === 'string') {
        return ['El servidor no tiene disponible esta ruta (404)'];
    }

    const mensaje =
        data?.mensaje ?? data?.message ?? 'Ocurrió un error inesperado';

    return Array.isArray(mensaje) ? mensaje : [mensaje];
};

export default instance;