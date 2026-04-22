// api.js - Cliente de API do WMS
const BASE_URL = '/api';

export const API = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('wms_token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        };

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            // Se o token expirou ou é inválido, redireciona para login
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
            throw new Error(error.detail || 'Erro na requisição');
        }

        return response.json();
    },

    auth: {
        async login(username, password) {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Login falhou');
            }

            const data = await response.json();
            localStorage.setItem('wms_token', data.access_token);
            return data;
        },

        async me() {
            return API.request('/auth/me');
        },

        logout() {
            localStorage.removeItem('wms_token');
            window.location.href = '/login';
        }
    },

    inventory: {
        async list() {
            return API.request('/inventory/');
        },
        async listDepots() {
            return API.request('/inventory/depots');
        },
        async createDepot(data) {
            return API.request('/inventory/depots', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },
        async listShelves(depotId) {
            return API.request(`/inventory/depots/${depotId}/shelves`);
        },
        async createShelf(data) {
            return API.request('/inventory/shelves', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },
        async drawers() {
            return API.request('/inventory/drawers');
        },
        async getDrawerItems(drawerId) {
            return API.request(`/inventory/drawers/${drawerId}/items`);
        },
        async getNearExpiry() {
            return API.request('/inventory/expiries/near');
        },
        async allocate(data) {
            return API.request('/inventory/allocate', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },
        async move(data) {
            return API.request('/inventory/move', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
    },

    receiving: {
        async upload(formData) {
            const token = localStorage.getItem('wms_token');
            const response = await fetch(`${BASE_URL}/receiving/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!response.ok) throw new Error('Falha no upload');
            return response.json();
        },
        async createSession(nfeData) {
            return API.request('/receiving/sessions', {
                method: 'POST',
                body: JSON.stringify(nfeData)
            });
        },
        async listSessions() {
            return API.request('/receiving/sessions');
        },
        async getSession(id) {
            return API.request(`/receiving/sessions/${id}`);
        },
        async registerCount(id, data) {
            return API.request(`/receiving/sessions/${id}/count`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
    },

    floorplan: {
        async getLayout(depotId) {
            return API.request(`/floorplan/${depotId}/layout`);
        },
        async updatePosition(depotId, shelfId, data) {
            return API.request(`/floorplan/${depotId}/shelves/${shelfId}/position`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
    },

    products: {
        async list() {
            return API.request('/products/');
        },
        async create(data) {
            return API.request('/products/', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
    },

    audit: {
        async list() {
            return API.request('/audit/');
        }
    },

    separation: {
        async listRomaneios() {
            return API.request('/separation/romaneios');
        },
        async getPickingList(romaneioId) {
            return API.request(`/separation/romaneios/${romaneioId}/picking-list`);
        },
        async createRomaneio(data) {
            return API.request('/separation/romaneios', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
    }
};
