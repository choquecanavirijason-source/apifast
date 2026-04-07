import api from '../api';

export const AuthService = {
    login: async (credentials: any) => {
        const username = credentials.username ?? credentials.email;
        return api.post('/auth/login', {
            username,
            password: credentials.password
        });
    },

    register: async (userData: any) => {
        return api.post('/auth/register', userData);
    },

    // Endpoint clave para recuperar la sesión
    me: async () => {
        return api.get('/auth/me');
    },

    session: async () => {
        return api.get('/auth/session');
    },

    refresh: async () => {
        return api.post('/auth/refresh');
    },

    logout: async () => {
        return api.post('/auth/logout');
    }
};