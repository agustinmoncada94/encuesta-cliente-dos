const express = require('express');
const { createClient } = require('redis');
const app = express();
app.use(express.json({ limit: '4mb' }));

const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
        connectTimeout: 10000,
        reconnectStrategy: retries => Math.min(retries * 100, 3000)
    }
});

client.on('error', err => console.error('Error de Redis:', err));

async function conectar() {
    if (!client.isOpen) await client.connect();
}

// Registra el primer pago de un socio en su historial (usado al dar de alta)
async function guardarPrimerPago(dni, primerPago) {
    if (!primerPago || !primerPago.monto) return;
    const fechaPago = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const ahora = new Date();
    const mes   = ahora.toLocaleString('es-AR', { month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
    const anio  = ahora.toLocaleString('es-AR', { year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
    const pagos = [{
        id:       Date.now(),
        fecha:    fechaPago,
        concepto: primerPago.concepto || `Mensual ${mes} ${anio}`,
        monto:    primerPago.monto,
        metodo:   primerPago.metodo || 'Efectivo',
        estado:   'Pagado',
        observacion: primerPago.observacion || ''
    }];
    await client.set(`pagos:${dni}`, JSON.stringify(pagos));
}

// KEEPALIVE (evita que Redis Cloud elimine la BD gratuita por inactividad)
app.get('/api/keepalive', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    try {
        await conectar();
        await client.set('keepalive:ping', new Date().toISOString());
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// AUTH LOGIN
app.post('/api/auth/login', (req, res) => {
    const { usuario, password } = req.body;
    const adminUser = process.env.ADMIN_USER  || 'Admin';
    const adminPass = process.env.ADMIN_PASS  || 'mateomartino';
    const profUser  = process.env.PROFESOR_USER || 'Profesor';
    const profPass  = process.env.PROFESOR_PASS || 'profesor123';

    // Admins adicionales nombrados, definidos en Vercel como variable de entorno ADMIN_USERS
    // (JSON: [{"usuario":"Tomas","password":"..."}, ...]). No se hardcodean acá porque el repo es público.
    let adminsExtra = [];
    try { adminsExtra = JSON.parse(process.env.ADMIN_USERS || '[]'); } catch (e) { adminsExtra = []; }

    const token = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiry = Date.now() + 8 * 60 * 60 * 1000;

    const esAdminNombrado = adminsExtra.some(u => u.usuario === usuario && u.password === password);

    if ((usuario === adminUser && password === adminPass) || esAdminNombrado) {
        res.json({ ok: true, token: token(), expiry, role: 'admin', usuario });
    } else if (usuario === profUser && password === profPass) {
        res.json({ ok: true, token: token(), expiry, role: 'profesor', usuario });
    } else {
        res.status(401).json({ ok: false, message: 'Usuario o contraseña incorrectos.' });
    }
});

// OBTENER TODOS LOS SOCIOS
app.get('/api/socios/todos', async (req, res) => {
    try {
        await conectar();
        const keys = await client.keys('socio:*');
        const socios = await Promise.all(keys.map(async k => JSON.parse(await client.get(k))));
        res.json(socios.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// OBTENER UN SOLO SOCIO (usado por el portal del socio, para no exponer el padron completo)
app.get('/api/socios/:dni', async (req, res) => {
    try {
        await conectar();
        const raw = await client.get(`socio:${req.params.dni}`);
        if (!raw) return res.status(404).json({ error: 'Socio no encontrado' });
        res.json(JSON.parse(raw));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// LOGIN DEL SOCIO (PIN de 4 digitos, guardado aparte del registro del socio para que nunca
// aparezca en /api/socios/todos ni en ninguna otra respuesta que liste socios).
const PIN_VALIDO = p => typeof p === 'string' && /^\d{4}$/.test(p);

// Solo confirma si el DNI pertenece a un socio, sin devolver ningun dato personal
// (se usa en el primer paso del login, antes de pedir la contraseña).
app.get('/api/socios/:dni/existe', async (req, res) => {
    try {
        await conectar();
        const existe = await client.exists(`socio:${req.params.dni}`);
        res.json({ existe: !!existe });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Indica si el socio ya configuro su contraseña (para que el portal sepa que pantalla mostrar)
app.get('/api/socios/:dni/pin-estado', async (req, res) => {
    try {
        await conectar();
        const configurado = await client.exists(`socio_pin:${req.params.dni}`);
        res.json({ configurado: !!configurado });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Crea la contraseña la primera vez (no permite pisar una ya existente: para eso esta el reset del admin)
app.post('/api/socios/:dni/pin', async (req, res) => {
    try {
        await conectar();
        if (!PIN_VALIDO(req.body.pin)) return res.status(400).json({ error: 'La contraseña debe ser de 4 números' });

        const yaConfigurado = await client.exists(`socio_pin:${req.params.dni}`);
        if (yaConfigurado) return res.status(409).json({ error: 'Ya tenés una contraseña configurada' });

        await client.set(`socio_pin:${req.params.dni}`, req.body.pin);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Verifica el PIN al iniciar sesion
app.post('/api/socios/:dni/verificar-pin', async (req, res) => {
    try {
        await conectar();
        const guardado = await client.get(`socio_pin:${req.params.dni}`);
        if (!guardado) return res.status(404).json({ error: 'Este socio todavía no configuró su contraseña' });
        res.json({ ok: guardado === req.body.pin });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Resetear la contraseña de un socio (uso del admin, para cuando el socio se la olvida)
app.delete('/api/socios/:dni/pin', async (req, res) => {
    try {
        await conectar();
        await client.del(`socio_pin:${req.params.dni}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// REGISTRAR NUEVO
app.post('/api/registrar', async (req, res) => {
    try {
        await conectar();
        const { primerPago, comprobante, ...socio } = req.body;
        if (!socio.dni) return res.status(400).json({ error: 'Falta el DNI' });

        const yaExiste = await client.exists(`socio:${socio.dni}`);
        if (yaExiste) {
            return res.status(409).json({ error: 'Ya existe una inscripción registrada con ese DNI.' });
        }

        if (!socio.fechaInicio) socio.fechaInicio = new Date().toISOString();
        await client.set(`socio:${socio.dni}`, JSON.stringify(socio));

        // Guardar comprobante de pago adjuntado (preinscripción online)
        if (comprobante && comprobante.dataUrl) {
            await client.set(`comprobante:${socio.dni}`, JSON.stringify({
                dataUrl: comprobante.dataUrl,
                fecha: new Date().toISOString()
            }));
        }

        // Guardar primer pago en historial si se proporcionó monto
        await guardarPrimerPago(socio.dni, primerPago);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PREINSCRIPCIÓN PÚBLICA (queda pendiente de aprobación del admin)
app.post('/api/preinscripciones', async (req, res) => {
    try {
        await conectar();
        const { primerPago, comprobante, ...datos } = req.body;
        if (!datos.dni) return res.status(400).json({ error: 'Falta el DNI' });
        if (!comprobante || !comprobante.dataUrl) {
            return res.status(400).json({ error: 'Falta adjuntar el comprobante de pago.' });
        }

        const yaEsSocio = await client.exists(`socio:${datos.dni}`);
        if (yaEsSocio) {
            return res.status(409).json({ error: 'Ya existe una inscripción registrada con ese DNI.' });
        }

        const preinscripcion = {
            ...datos,
            estado: 'Pendiente',
            primerPago: primerPago || null,
            comprobante: { dataUrl: comprobante.dataUrl },
            fechaSolicitud: new Date().toISOString()
        };
        await client.set(`preinscripcion:${datos.dni}`, JSON.stringify(preinscripcion));

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// LISTAR PREINSCRIPCIONES PENDIENTES (panel admin)
app.get('/api/preinscripciones/todas', async (req, res) => {
    try {
        await conectar();
        const keys = await client.keys('preinscripcion:*');
        const pendientes = await Promise.all(keys.map(async k => JSON.parse(await client.get(k))));
        res.json(pendientes.sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud)));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ACEPTAR PREINSCRIPCIÓN → crea el socio activo
app.post('/api/preinscripciones/:dni/aceptar', async (req, res) => {
    try {
        await conectar();
        const dni = req.params.dni;
        const raw = await client.get(`preinscripcion:${dni}`);
        if (!raw) return res.status(404).json({ error: 'Preinscripción no encontrada' });

        const yaEsSocio = await client.exists(`socio:${dni}`);
        if (yaEsSocio) {
            return res.status(409).json({ error: 'Ya existe un socio registrado con ese DNI.' });
        }

        const { primerPago, comprobante, estado, fechaSolicitud, ...socio } = JSON.parse(raw);
        socio.estado = 'Activo';
        socio.fechaInicio = new Date().toISOString();
        await client.set(`socio:${dni}`, JSON.stringify(socio));

        if (comprobante && comprobante.dataUrl) {
            await client.set(`comprobante:${dni}`, JSON.stringify({
                dataUrl: comprobante.dataUrl,
                fecha: new Date().toISOString()
            }));
        }

        await guardarPrimerPago(dni, primerPago);
        await client.del(`preinscripcion:${dni}`);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// RECHAZAR / DESCARTAR PREINSCRIPCIÓN
app.delete('/api/preinscripciones/:dni', async (req, res) => {
    try {
        await conectar();
        await client.del(`preinscripcion:${req.params.dni}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// RUTA PARA ACTUALIZAR EL PAGO (COBRAR MES) - VERSIÓN REDIS
app.post('/api/socios/cobrar', async (req, res) => {
    const { dni, nuevaFecha, pago } = req.body;

    try {
        await conectar();
        const datosSocioJSON = await client.get(`socio:${dni}`);

        if (datosSocioJSON) {
            const socio = JSON.parse(datosSocioJSON);
            socio.fechaInicio = nuevaFecha;
            socio.estado = 'Activo';
            await client.set(`socio:${dni}`, JSON.stringify(socio));

            // Registrar pago con los datos del modal (o valores por defecto)
            const rawPagos = await client.get(`pagos:${dni}`);
            const pagos = rawPagos ? JSON.parse(rawPagos) : [];
            const ahora = new Date();
            const mes   = ahora.toLocaleString('es-AR', { month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
            const anio  = ahora.toLocaleString('es-AR', { year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
            const fechaPago = ahora.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
            pagos.unshift({
                id: Date.now(),
                fecha: fechaPago,
                concepto: pago?.concepto || `Mensual ${mes} ${anio}`,
                monto:    pago?.monto    || '',
                metodo:   pago?.metodo   || 'Efectivo',
                estado:   'Pagado',
                observacion: pago?.observacion || ''
            });
            await client.set(`pagos:${dni}`, JSON.stringify(pagos));

            res.status(200).json({ success: true, mensaje: "Pago actualizado con éxito" });
        } else {
            res.status(404).json({ mensaje: "No se encontró el socio" });
        }
    } catch (error) {
        console.error("Error al cobrar:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ACTUALIZAR (EDITAR O RENOVAR PAGO)
app.put('/api/socios/:dni', async (req, res) => {
    try {
        await conectar();
        await client.set(`socio:${req.params.dni}`, JSON.stringify(req.body));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Error al actualizar" });
    }
});

// OBTENER PAGOS DE UN SOCIO
app.get('/api/socios/:dni/pagos', async (req, res) => {
    try {
        await conectar();
        const raw = await client.get(`pagos:${req.params.dni}`);
        res.json(raw ? JSON.parse(raw) : []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// REGISTRAR PAGO MANUAL
app.post('/api/socios/:dni/pagos', async (req, res) => {
    try {
        await conectar();
        const raw = await client.get(`pagos:${req.params.dni}`);
        const pagos = raw ? JSON.parse(raw) : [];
        const nuevo = {
            id: Date.now(),
            fecha: req.body.fecha || new Date().toLocaleDateString('es-AR'),
            concepto: req.body.concepto || 'Mensual',
            monto: req.body.monto || '',
            metodo: req.body.metodo || 'Efectivo',
            estado: req.body.estado || 'Pagado',
            observacion: req.body.observacion || ''
        };
        pagos.unshift(nuevo);
        await client.set(`pagos:${req.params.dni}`, JSON.stringify(pagos));
        res.json({ success: true, pago: nuevo });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// CHECK-IN SOCIO (pantalla de acceso)
app.get('/api/checkin/:dni', async (req, res) => {
    try {
        await conectar();
        const raw = await client.get(`socio:${req.params.dni}`);
        if (!raw) return res.status(404).json({ estado: 'NO_ENCONTRADO', message: 'Socio no encontrado.' });

        const socio = JSON.parse(raw);
        const desde = new Date(socio.fechaInicio || socio.fechaPago);
        const hasta = new Date(desde);
        hasta.setDate(desde.getDate() + 30);
        const hoy = new Date(); hoy.setHours(0,0,0,0);

        if (socio.estado === 'Suspendido') {
            return res.json({ estado: 'VENCIDO', message: `Membresía suspendida para ${socio.nombre}.` });
        }
        if (hoy > hasta) {
            return res.json({ estado: 'VENCIDO', message: `Membresía vencida para ${socio.nombre}. Por favor regularizá tu situación.` });
        }

        // Guardar asistencia en Redis
        const fechaHoy = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        const horaAhora = new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });
        const claveAsist = `asistencia:${fechaHoy}`;
        const existente = await client.get(claveAsist);
        const registros = existente ? JSON.parse(existente) : [];
        registros.push({ dni: socio.dni, nombre: socio.nombre, hora: horaAhora });
        await client.set(claveAsist, JSON.stringify(registros));
        // Expirar en 35 días para no acumular indefinidamente
        await client.expire(claveAsist, 35 * 24 * 60 * 60);

        res.json({ estado: 'OK', message: `¡Hola ${socio.nombre}! Bienvenido al gym.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ASISTENCIA (últimos 7 días, o un rango desde/hasta si se especifica ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD)
app.get('/api/asistencia', async (req, res) => {
    try {
        await conectar();
        const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const { desde, hasta } = req.query;
        const resultado = [];

        if (desde && hasta) {
            const parse = s => {
                const [y, m, d] = String(s).split('-').map(Number);
                return (y && m && d) ? { y, m, d } : null;
            };
            const fd = parse(desde);
            const fh = parse(hasta);
            if (!fd || !fh) return res.status(400).json({ error: 'Formato de fecha inválido (usar YYYY-MM-DD)' });

            const inicioUTC = Date.UTC(fd.y, fd.m - 1, fd.d);
            const finUTC     = Date.UTC(fh.y, fh.m - 1, fh.d);
            if (finUTC < inicioUTC) return res.status(400).json({ error: 'La fecha "hasta" no puede ser anterior a "desde"' });

            const totalDias = Math.round((finUTC - inicioUTC) / 86400000) + 1;
            if (totalDias > 366) return res.status(400).json({ error: 'El rango no puede superar 366 días' });

            for (let i = 0; i < totalDias; i++) {
                const actual = new Date(inicioUTC + i * 86400000);
                const fecha = `${actual.getUTCDate()}/${actual.getUTCMonth() + 1}/${actual.getUTCFullYear()}`;
                const raw = await client.get(`asistencia:${fecha}`);
                const registros = raw ? JSON.parse(raw) : [];
                resultado.push({ dia: diasSemana[actual.getUTCDay()], fecha, cantidad: registros.length });
            }
        } else {
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const fecha = d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
                const raw = await client.get(`asistencia:${fecha}`);
                const registros = raw ? JSON.parse(raw) : [];
                resultado.push({ dia: diasSemana[d.getDay()], fecha, cantidad: registros.length });
            }
        }

        res.json(resultado);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ASISTENCIA DE UN SOLO SOCIO (para el portal del socio)
// Sin parametros: ultimos "dias" dias (default 30). Con ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD: ese rango exacto (para navegar meses del calendario).
app.get('/api/socios/:dni/asistencia', async (req, res) => {
    try {
        await conectar();
        const { desde, hasta } = req.query;
        const resultado = [];

        if (desde && hasta) {
            const parse = s => {
                const [y, m, d] = String(s).split('-').map(Number);
                return (y && m && d) ? { y, m, d } : null;
            };
            const fd = parse(desde);
            const fh = parse(hasta);
            if (!fd || !fh) return res.status(400).json({ error: 'Formato de fecha inválido (usar YYYY-MM-DD)' });

            const inicioUTC = Date.UTC(fd.y, fd.m - 1, fd.d);
            const finUTC     = Date.UTC(fh.y, fh.m - 1, fh.d);
            if (finUTC < inicioUTC) return res.status(400).json({ error: 'La fecha "hasta" no puede ser anterior a "desde"' });

            const totalDias = Math.round((finUTC - inicioUTC) / 86400000) + 1;
            if (totalDias > 62) return res.status(400).json({ error: 'El rango no puede superar 62 días' });

            for (let i = 0; i < totalDias; i++) {
                const actual = new Date(inicioUTC + i * 86400000);
                const fecha = `${actual.getUTCDate()}/${actual.getUTCMonth() + 1}/${actual.getUTCFullYear()}`;
                const raw = await client.get(`asistencia:${fecha}`);
                const registros = raw ? JSON.parse(raw) : [];
                const registro = [...registros].reverse().find(r => String(r.dni) === String(req.params.dni));
                resultado.push({ fecha, asistio: !!registro, hora: registro ? registro.hora : null });
            }
        } else {
            const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 30, 1), 90);
            for (let i = dias - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const fecha = d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
                const raw = await client.get(`asistencia:${fecha}`);
                const registros = raw ? JSON.parse(raw) : [];
                const registro = [...registros].reverse().find(r => String(r.dni) === String(req.params.dni));
                resultado.push({ fecha, asistio: !!registro, hora: registro ? registro.hora : null });
            }
        }

        res.json(resultado);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// EQUIPOS
app.get('/api/equipos', async (req, res) => {
    try {
        await conectar();
        const keys = await client.keys('equipo:*');
        const equipos = await Promise.all(keys.map(async k => JSON.parse(await client.get(k))));
        res.json(equipos.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipos', async (req, res) => {
    try {
        await conectar();
        const equipo = { id: Date.now(), ...req.body };
        await client.set(`equipo:${equipo.id}`, JSON.stringify(equipo));
        res.json({ success: true, equipo });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/equipos/:id', async (req, res) => {
    try {
        await conectar();
        const key = `equipo:${req.params.id}`;
        const existing = await client.get(key);
        if (!existing) return res.status(404).json({ error: 'Equipo no encontrado' });
        const updated = { ...JSON.parse(existing), ...req.body, id: parseInt(req.params.id) };
        await client.set(key, JSON.stringify(updated));
        res.json({ success: true, equipo: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipos/:id', async (req, res) => {
    try {
        await conectar();
        await client.del(`equipo:${req.params.id}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// INCIDENCIAS DE EQUIPO
app.get('/api/equipos/:id/incidencias', async (req, res) => {
    try {
        await conectar();
        const raw = await client.get(`incidencias:equipo:${req.params.id}`);
        res.json(raw ? JSON.parse(raw) : []);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipos/:id/incidencias', async (req, res) => {
    try {
        await conectar();
        const raw = await client.get(`incidencias:equipo:${req.params.id}`);
        const lista = raw ? JSON.parse(raw) : [];
        const ahora = new Date();
        const nueva = {
            id:          Date.now(),
            equipoId:    parseInt(req.params.id),
            fecha:       ahora.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
            tipo:        req.body.tipo        || 'Otro',
            prioridad:   req.body.prioridad   || 'Media',
            descripcion: req.body.descripcion || '',
            estado:      'Abierta',
            resolucion:  '',
            fechaResolucion: ''
        };
        lista.unshift(nueva);
        await client.set(`incidencias:equipo:${req.params.id}`, JSON.stringify(lista));
        res.json({ success: true, incidencia: nueva });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/equipos/:id/incidencias/:incId', async (req, res) => {
    try {
        await conectar();
        const raw = await client.get(`incidencias:equipo:${req.params.id}`);
        if (!raw) return res.status(404).json({ error: 'No hay incidencias para este equipo' });
        const lista = JSON.parse(raw);
        const idx = lista.findIndex(i => i.id === parseInt(req.params.incId));
        if (idx === -1) return res.status(404).json({ error: 'Incidencia no encontrada' });
        lista[idx] = { ...lista[idx], ...req.body };
        if (req.body.estado === 'Resuelta' && !lista[idx].fechaResolucion) {
            lista[idx].fechaResolucion = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        }
        await client.set(`incidencias:equipo:${req.params.id}`, JSON.stringify(lista));
        res.json({ success: true, incidencia: lista[idx] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipos/:id/incidencias/:incId', async (req, res) => {
    try {
        await conectar();
        const raw = await client.get(`incidencias:equipo:${req.params.id}`);
        if (!raw) return res.status(404).json({ error: 'No hay incidencias' });
        const lista = JSON.parse(raw).filter(i => i.id !== parseInt(req.params.incId));
        await client.set(`incidencias:equipo:${req.params.id}`, JSON.stringify(lista));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// TODAS LAS INCIDENCIAS (para panel de alertas)
app.get('/api/incidencias/todas', async (req, res) => {
    try {
        await conectar();
        const keys = await client.keys('incidencias:equipo:*');
        const todas = (await Promise.all(keys.map(async k => JSON.parse(await client.get(k))))).flat();
        res.json(todas.sort((a, b) => b.id - a.id));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PLANES
app.get('/api/planes', async (req, res) => {
    try {
        await conectar();
        const keys = await client.keys('plan:*');
        const planes = await Promise.all(keys.map(async k => JSON.parse(await client.get(k))));
        res.json(planes.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/planes', async (req, res) => {
    try {
        await conectar();
        const { nombre, monto, dias } = req.body;
        if (!nombre || !monto || !dias) return res.status(400).json({ error: 'Faltan datos del plan (nombre, monto, días)' });
        const plan = { id: Date.now(), nombre, monto, dias };
        await client.set(`plan:${plan.id}`, JSON.stringify(plan));
        res.json({ success: true, plan });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/planes/:id', async (req, res) => {
    try {
        await conectar();
        const key = `plan:${req.params.id}`;
        const existing = await client.get(key);
        if (!existing) return res.status(404).json({ error: 'Plan no encontrado' });
        const updated = { ...JSON.parse(existing), ...req.body, id: parseInt(req.params.id) };
        await client.set(key, JSON.stringify(updated));
        res.json({ success: true, plan: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/planes/:id', async (req, res) => {
    try {
        await conectar();
        await client.del(`plan:${req.params.id}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GASTOS (pestaña "Gastos" del Dashboard KPI)
app.get('/api/gastos', async (req, res) => {
    try {
        await conectar();
        const keys = await client.keys('gasto:*');
        const gastos = await Promise.all(keys.map(async k => JSON.parse(await client.get(k))));
        res.json(gastos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id)));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gastos', async (req, res) => {
    try {
        await conectar();
        const { fecha, concepto, metodo, monto, registradoPor } = req.body;
        if (!fecha || !concepto || !metodo) return res.status(400).json({ error: 'Faltan datos del gasto (fecha, concepto, método)' });
        const gasto = {
            id: Date.now(), fecha, concepto, metodo,
            monto: (monto !== undefined && monto !== null && monto !== '') ? Number(monto) : null,
            registradoPor: registradoPor || '—'
        };
        await client.set(`gasto:${gasto.id}`, JSON.stringify(gasto));
        res.json({ success: true, gasto });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gastos/:id', async (req, res) => {
    try {
        await conectar();
        const key = `gasto:${req.params.id}`;
        const existing = await client.get(key);
        if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });
        const updated = { ...JSON.parse(existing), ...req.body, id: parseInt(req.params.id) };
        await client.set(key, JSON.stringify(updated));
        res.json({ success: true, gasto: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gastos/:id', async (req, res) => {
    try {
        await conectar();
        await client.del(`gasto:${req.params.id}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PROFESORES Y VOTACION (1 a 5 estrellas)
// El voto se guarda con el DNI del socio solo para limitar a 2 votos por mes EN TOTAL
// (repartidos entre todos los profesores, no 2 por cada uno).
// Ese DNI nunca se devuelve en ninguna respuesta: solo se usan promedio y cantidad total.
function calcularResumenVotos(votos) {
    const total = votos.length;
    const promedio = total ? votos.reduce((s, v) => s + v.estrellas, 0) / total : 0;
    return { promedio: Math.round(promedio * 10) / 10, totalVotos: total };
}

// Cuenta cuantos votos emitio un socio en TODOS los profesores durante un mes/anio dado.
async function contarVotosDelMes(dni, mes, anio) {
    const keys = await client.keys('votos:profesor:*');
    let total = 0;
    for (const k of keys) {
        const raw = await client.get(k);
        const votos = raw ? JSON.parse(raw) : [];
        total += votos.filter(v => v.dni === String(dni) && v.mes === mes && v.anio === anio).length;
    }
    return total;
}

// Lista de profesores con su promedio. Si se pasa ?dni=..., incluye cuantos votos le quedan
// a ESE socio este mes en total (limite global de 2, no por profesor; no expone otros socios).
app.get('/api/profesores', async (req, res) => {
    try {
        await conectar();
        const keys = await client.keys('profesor:*');
        const dniConsulta = req.query.dni ? String(req.query.dni) : null;
        const ahora = new Date();
        const mesActual = parseInt(ahora.toLocaleString('es-AR', { month: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }), 10);
        const anioActual = parseInt(ahora.toLocaleString('es-AR', { year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }), 10);

        let votosRestantes = null;
        if (dniConsulta) {
            const votosDelSocioEsteMes = await contarVotosDelMes(dniConsulta, mesActual, anioActual);
            votosRestantes = Math.max(0, 2 - votosDelSocioEsteMes);
        }

        const profesores = await Promise.all(keys.map(async k => {
            const profesor = JSON.parse(await client.get(k));
            const rawVotos = await client.get(`votos:profesor:${profesor.id}`);
            const votos = rawVotos ? JSON.parse(rawVotos) : [];
            const resumen = calcularResumenVotos(votos);

            return { id: profesor.id, nombre: profesor.nombre, ...resumen, ...(dniConsulta ? { votosRestantes } : {}) };
        }));

        res.json(profesores.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/profesores', async (req, res) => {
    try {
        await conectar();
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ error: 'Falta el nombre del profesor' });
        const profesor = { id: Date.now(), nombre };
        await client.set(`profesor:${profesor.id}`, JSON.stringify(profesor));
        res.json({ success: true, profesor });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/profesores/:id', async (req, res) => {
    try {
        await conectar();
        const key = `profesor:${req.params.id}`;
        const existing = await client.get(key);
        if (!existing) return res.status(404).json({ error: 'Profesor no encontrado' });
        const updated = { ...JSON.parse(existing), ...req.body, id: parseInt(req.params.id) };
        await client.set(key, JSON.stringify(updated));
        res.json({ success: true, profesor: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/profesores/:id', async (req, res) => {
    try {
        await conectar();
        await client.del(`profesor:${req.params.id}`);
        await client.del(`votos:profesor:${req.params.id}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// REGISTRAR UN VOTO (1 a 5 estrellas) - maximo 2 votos por socio por mes calendario EN TOTAL
// (no 2 por profesor: se cuentan juntos los votos a cualquier profesor).
app.post('/api/profesores/:id/votar', async (req, res) => {
    try {
        await conectar();
        const { dni, estrellas } = req.body;
        const estrellasNum = parseInt(estrellas, 10);
        if (!dni) return res.status(400).json({ error: 'Falta el DNI del socio' });
        if (!estrellasNum || estrellasNum < 1 || estrellasNum > 5) return res.status(400).json({ error: 'El puntaje debe ser de 1 a 5' });

        const existeProfesor = await client.exists(`profesor:${req.params.id}`);
        if (!existeProfesor) return res.status(404).json({ error: 'Profesor no encontrado' });

        const ahora = new Date();
        const mes = parseInt(ahora.toLocaleString('es-AR', { month: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }), 10);
        const anio = parseInt(ahora.toLocaleString('es-AR', { year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }), 10);
        const fecha = ahora.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

        const votosEsteMes = await contarVotosDelMes(dni, mes, anio);
        if (votosEsteMes >= 2) {
            return res.status(429).json({ error: 'Ya usaste tus 2 votos de este mes.' });
        }

        const key = `votos:profesor:${req.params.id}`;
        const raw = await client.get(key);
        const votos = raw ? JSON.parse(raw) : [];
        votos.push({ id: Date.now(), dni: String(dni), estrellas: estrellasNum, mes, anio, fecha });
        await client.set(key, JSON.stringify(votos));

        res.json({ success: true, ...calcularResumenVotos(votos), votosRestantes: Math.max(0, 2 - (votosEsteMes + 1)) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// INGRESOS DEL MES (para KPI Dashboard)
app.get('/api/dashboard/ingresos', async (req, res) => {
    try {
        await conectar();
        const keys = await client.keys('pagos:*');

        const ahora = new Date();
        const mesActual  = ahora.getMonth();
        const anioActual = ahora.getFullYear();

        // Mes anterior
        const fechaMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
        const mesAnterior  = fechaMesAnt.getMonth();
        const anioAnterior = fechaMesAnt.getFullYear();

        let totalMesActual  = 0;
        let totalMesAnterior = 0;

        for (const key of keys) {
            const raw = await client.get(key);
            if (!raw) continue;
            const pagos = JSON.parse(raw);
            for (const p of pagos) {
                if (!p.monto) continue;
                // monto puede ser "$15.000" o "15000" o 15000
                const num = parseFloat(String(p.monto).replace(/[$.]/g, '').replace(',', '.'));
                if (isNaN(num)) continue;

                // fecha guardada como dd/mm/aaaa
                const partes = String(p.fecha).split('/');
                if (partes.length !== 3) continue;
                const d = parseInt(partes[0], 10);
                const m = parseInt(partes[1], 10) - 1; // 0-based
                const a = parseInt(partes[2], 10);

                if (m === mesActual  && a === anioActual)  totalMesActual  += num;
                if (m === mesAnterior && a === anioAnterior) totalMesAnterior += num;
            }
        }

        res.json({ mesActual: totalMesActual, mesAnterior: totalMesAnterior });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ELIMINAR SOCIO
app.delete('/api/socios/:dni', async (req, res) => {
    try {
        await conectar();
        const dniRequerido = String(req.params.dni).trim();

        // Primero intentamos borrar por la clave directa
        const resultado = await client.del(`socio:${dniRequerido}`);
        if (resultado >= 1) {
            return res.json({ success: true, mensaje: "Socio eliminado" });
        }

        // Si no se encontró, buscamos entre todas las claves
        // (por si la clave fue guardada con espacios u otro formato)
        const keys = await client.keys('socio:*');
        for (const key of keys) {
            const data = JSON.parse(await client.get(key));
            if (data && String(data.dni).trim() === dniRequerido) {
                await client.del(key);
                return res.json({ success: true, mensaje: "Socio eliminado" });
            }
        }

        res.status(404).json({ error: "Socio no encontrado" });
    } catch (e) {
        console.error("Error al eliminar:", e);
        res.status(500).json({ error: "Error interno" });
    }
});

module.exports = app;