const BASE = (window.APP_URL || '') + '/api';

function getToken() {
    return localStorage.getItem('fridge_token');
}

async function request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
    });

    if (res.status === 204) return null;

    const data = await res.json();

    if (!res.ok) {
        const err = new Error(data.message || 'Błąd serwera');
        err.errors = data.errors || {};
        err.status = res.status;
        throw err;
    }

    return data;
}

export const api = {
    get:    (path)        => request('GET',    path),
    post:   (path, body)  => request('POST',   path, body),
    put:    (path, body)  => request('PUT',    path, body),
    delete: (path)        => request('DELETE', path),

    auth: {
        register: (d) => api.post('/auth/register', d),
        login:    (d) => api.post('/auth/login', d),
        logout:         ()  => api.post('/auth/logout'),
        me:             ()  => api.get('/auth/me'),
        forgotPassword: (d) => api.post('/auth/forgot-password', d),
        resetPassword:  (d) => api.post('/auth/reset-password', d),
    },

    family: {
        get:            ()    => api.get('/family'),
        update:         (d)   => api.put('/family', d),
        join:           (d)   => api.post('/family/join', d),
        regenerateCode: ()    => api.post('/family/regenerate-code'),
        removeMember:   (id)  => api.delete(`/family/members/${id}`),
    },

    zones: {
        list:   ()     => api.get('/storage-zones'),
        create: (d)    => api.post('/storage-zones', d),
        update: (id,d) => api.put(`/storage-zones/${id}`, d),
        delete: (id)   => api.delete(`/storage-zones/${id}`),
    },

    products: {
        list:    (params = {}) => {
            const q = new URLSearchParams(params).toString();
            return api.get('/products' + (q ? '?' + q : ''));
        },
        create:  (d)   => api.post('/products', d),
        update:  (id,d) => api.put(`/products/${id}`, d),
        delete:  (id)  => api.delete(`/products/${id}`),
        open:    (id)  => api.post(`/products/${id}/open`),
        consume: (id)  => api.post(`/products/${id}/consume`),
        waste:          (id)      => api.post(`/products/${id}/waste`),
        findByBarcode:  (barcode) => api.get(`/products/by-barcode/${encodeURIComponent(barcode)}`),
    },

    stats: {
        get: () => api.get('/stats'),
    },

    recipes: {
        suggest:       ()      => api.get('/recipes/suggest'),
        detail:        (id)    => api.get(`/recipes/${id}`),
        customDetail:  (id)    => api.get(`/recipes/custom/${id}`),
        customCreate:  (d)     => api.post('/recipes/custom', d),
        customUpdate:  (id, d) => api.put(`/recipes/custom/${id}`, d),
        customDelete:  (id)    => api.delete(`/recipes/custom/${id}`),
    },

    shopping: {
        list:         ()      => api.get('/shopping-list'),
        add:          (d)     => api.post('/shopping-list', d),
        update:       (id, d) => api.put(`/shopping-list/${id}`, d),
        delete:       (id)    => api.delete(`/shopping-list/${id}`),
        clearBought:  ()      => api.delete('/shopping-list/clear-bought'),
        moveToFridge: (d)     => api.post('/shopping-list/move-to-fridge', d),
    },

    receipts: {
        scan: (formData) => {
            const token = getToken();
            const headers = { 'Accept': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            return fetch((window.APP_URL || '') + '/api/receipts/scan', {
                method: 'POST',
                headers,
                body: formData,
            }).then(async res => {
                const data = await res.json();
                if (!res.ok) {
                    const err = new Error(data.message || 'Błąd serwera');
                    err.errors = data.errors || {};
                    throw err;
                }
                return data;
            });
        },
        confirm: (products) => api.post('/receipts/confirm', { products }),
    },

    support: {
        list:  ()        => api.get('/support'),
        send:  (d)       => api.post('/support', d),
        reply: (id, d)   => api.post(`/support/${id}/reply`, d),
        close: (id)      => api.post(`/support/${id}/close`),
    },

    foodSharing: {
        list:          (lat, lng, radius = 5) => api.get(`/food-sharing?lat=${lat}&lng=${lng}&radius=${radius}`),
        my:            ()         => api.get('/food-sharing/my'),
        get:           (id)       => api.get(`/food-sharing/${id}`),
        create:        (d)        => api.post('/food-sharing', d),
        reserve:       (id)       => api.post(`/food-sharing/${id}/reserve`),
        cancelReserve: (id)       => api.post(`/food-sharing/${id}/cancel-reserve`),
        give:          (id)       => api.post(`/food-sharing/${id}/give`),
        cancel:        (id)       => api.delete(`/food-sharing/${id}`),
        purge:         (id)       => api.delete(`/food-sharing/${id}/purge`),
        sendMessage:   (id, d)    => api.post(`/food-sharing/${id}/messages`, d),
    },
};
