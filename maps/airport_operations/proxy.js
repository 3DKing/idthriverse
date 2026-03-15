// proxy.js - Node/Express minimal proxy for OpenSky
// Run: npm init -y && npm i express node-fetch node-cache dotenv
// Then: OPEN_SKY_CLIENT_ID=... OPEN_SKY_CLIENT_SECRET=... node proxy.js

const express = require('express');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 8 }); // cache 8s by default

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // allow your domain in production
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const OPEN_SKY_ROOT = 'https://opensky-network.org/api';

// helper: simple GET with optional auth header
async function openSkyGet(path, authHeader) {
  const url = `${OPEN_SKY_ROOT}${path}`;
  const r = await fetch(url, { headers: authHeader ? { Authorization: authHeader } : {} });
  if (!r.ok) throw new Error(`OpenSky ${r.status}`);
  return r.json();
}

let tokenCache = null;
async function getAuthHeader() {
  // OpenSky supports OAuth2 client credentials flow (see docs)
  // For a quick approach you can use Basic auth with username:password (older)
  // Here we assume client_id/client_secret -> get token route (adjust if OpenSky uses Basic)
  const clientId = process.env.OPEN_SKY_CLIENT_ID;
  const clientSecret = process.env.OPEN_SKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  // Many guides use Basic auth: simply set Authorization: 'Basic base64(user:pass)'
  const basic = 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64');
  return basic;
}

app.get('/api/opensky/states', async (req, res) => {
  try {
    // Accept bbox query param (left,bottom,right,top)
    const bbox = req.query.bbox;
    const cacheKey = `states:${bbox || 'global'}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const authHeader = await getAuthHeader();
    // Build path to OpenSky states API
    let path = '/states/all';
    if (bbox) path += `?bbox=${bbox}`;
    const data = await openSkyGet(path, authHeader);
    cache.set(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`OpenSky proxy listening on ${port}`));