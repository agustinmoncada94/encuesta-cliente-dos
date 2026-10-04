// Servidor local para desarrollo. Usa una base de datos en memoria (se pierde al reiniciar)
// en vez del Redis real, para poder previsualizar cambios sin tocar datos de producción.
//
// Uso: npm run dev   →   http://localhost:3000/login.html
// Login: Admin / mateomartino  (o Profesor / profesor123)

const path = require('path');

const store = new Map();
const fakeClient = {
    isOpen: true,
    connect: async () => {},
    on: () => {},
    get: async (k) => (store.has(k) ? store.get(k) : null),
    set: async (k, v) => { store.set(k, v); return 'OK'; },
    del: async (k) => { const existed = store.has(k); store.delete(k); return existed ? 1 : 0; },
    exists: async (k) => (store.has(k) ? 1 : 0),
    keys: async (pattern) => {
        const prefix = String(pattern).replace('*', '');
        return [...store.keys()].filter(k => k.startsWith(prefix));
    },
    expire: async () => 1,
};

// Reemplaza el cliente real de Redis por el simulado antes de que api/index.js lo use
const redisPath = require.resolve('redis');
require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: { createClient: () => fakeClient },
};

const express = require('express');
const apiApp = require('./api/index.js');

const server = express();
server.use(express.static(path.join(__dirname, 'public')));
server.use(apiApp);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de desarrollo local en http://localhost:${PORT}/login.html`);
    console.log('Base de datos: en memoria (no es la de producción, se reinicia vacía cada vez)');
});
