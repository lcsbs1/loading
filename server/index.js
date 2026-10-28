'use strict';

const { URL } = require('url');
const config = require('./config');
const { handleAuth } = require('./routes/auth');
const { AppError } = require('./services/authService');

function isAuthApi(pathname) {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

function corsHeaders(req) {
  const requestOrigin = req.headers.origin;
  let origin = '*';
  if (config.corsOrigin && config.corsOrigin !== '*') {
    const list = config.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);
    if (requestOrigin && list.includes(requestOrigin)) origin = requestOrigin;
    else origin = list[0] || '*';
  } else if (requestOrigin) {
    origin = requestOrigin;
  }

  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (origin !== '*') headers.Vary = 'Origin';
  return headers;
}

function sendJson(res, status, body, extra = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extra,
  });
  res.end(payload);
}

function sendError(res, err, extra = {}) {
  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.fields && Object.keys(err.fields).length) body.error.fields = err.fields;
    sendJson(res, err.status || 500, body, extra);
    return;
  }

  if (err && err.statusCode === 400) {
    sendJson(res, 400, {
      error: { code: 'VALIDATION_ERROR', message: err.message || 'Invalid JSON body' },
    }, extra);
    return;
  }

  console.error('[server]', err);
  sendJson(res, 500, {
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  }, extra);
}

function readJsonBody(req, limit = 1_048_576) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 400 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Despacha requisições /api/auth/*.
 * @returns {Promise<boolean>} true se a requisição foi tratada
 */
async function handleApi(req, res) {
  let pathname;
  try {
    const host = req.headers.host || 'localhost';
    pathname = new URL(req.url || '/', `http://${host}`).pathname.replace(/\/+$/, '') || '/';
  } catch {
    sendJson(res, 400, { error: { code: 'VALIDATION_ERROR', message: 'Bad request URL' } });
    return true;
  }

  if (!isAuthApi(pathname)) return false;

  const headers = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return true;
  }

  try {
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      body = await readJsonBody(req);
    }
    const result = await handleAuth(req.method, pathname, body, req.headers);
    sendJson(res, result.status, result.body, headers);
    return true;
  } catch (err) {
    sendError(res, err, headers);
    return true;
  }
}

module.exports = { handleApi, isAuthApi };
