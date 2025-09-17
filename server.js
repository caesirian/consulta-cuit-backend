// server.js
const express = require('express');
const fetch = require('node-fetch'); // instalar node-fetch@2 para require
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir frontend estático (public/index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Config TusFacturasAPP (opcional)
const TFA_BASE = 'https://www.tusfacturas.app/app/api/v2';
const TFA_CUIT_ENDPOINT = '/clientes/afip-info';
const TFA_APIKEY = process.env.TFA_APIKEY || '';
const TFA_USERTOKEN = process.env.TFA_USERTOKEN || '';
const TFA_APITOKEN = process.env.TFA_APITOKEN || '';

// API pública AFIP
const AFIP_BASE = 'https://soa.afip.gob.ar/sr-padron/v2/persona/';

// Endpoint unificado
app.post('/api/consultar_cuit', async (req, res) => {
  const { cuit, fuente } = req.body || {};
  if (!cuit || !/^\d{11}$/.test(cuit)) {
    return res.status(400).json({ error: 'CUIT inválido (11 dígitos)' });
  }

  try {
    if (fuente === 'tusfacturas') {
      // Validar credenciales
      if (!TFA_APIKEY || !TFA_USERTOKEN || !TFA_APITOKEN) {
        return res.status(500).json({ error: 'Faltan credenciales TusFacturasAPP' });
      }
      const body = {
        cliente: cuit,
        apikey: TFA_APIKEY,
        usertoken: TFA_USERTOKEN,
        apitoken: TFA_APITOKEN
      };
      const resp = await fetch(TFA_BASE + TFA_CUIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(502).json({ error: 'Error en TusFacturasAPP', detalle: txt });
      }
      const data = await resp.json();
      // Mapear salida
      return res.json({
        fuente: 'TusFacturasAPP',
        cuit,
        razon_social: data.razon_social || null,
        estado: data.estado || null,
        condicion_impositiva: data.condicion_impositiva || null,
        direccion: data.direccion || null,
        localidad: data.localidad || null,
        provincia: data.provincia || null,
        codigo_postal: data.codigopostal || null,
        actividades: data.actividad || [],
        consulta_fecha: new Date().toISOString()
      });
    }

    // Consulta AFIP pública
    const afipResp = await fetch(AFIP_BASE + cuit);
    if (!afipResp.ok) {
      const txt = await afipResp.text();
      return res.status(502).json({ error: 'Error en API AFIP', detalle: txt });
    }
    const afipJson = await afipResp.json();
    // Muchos responses vienen como { success: true, data: { ... } } o directamente data
    const persona = afipJson.data || afipJson;

    return res.json({
      fuente: 'AFIP',
      cuit,
      nombre: persona.nombre || persona.razonSocial || null,
      tipo_persona: persona.tipoPersona || null,
      estado: persona.estadoClave || persona.estado || null,
      direccion: persona.domicilioFiscal?.direccion || null,
      localidad: persona.domicilioFiscal?.localidad || null,
      provincia: persona.domicilioFiscal?.descripcionProvincia || null,
      codigo_postal: persona.domicilioFiscal?.codPostal || null,
      actividades: persona.actividades || [],
      impuestos: persona.impuestos || [],
      consulta_fecha: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error endpoint /api/consultar_cuit:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Para SPA: devolver index.html en todas las rutas no api
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
