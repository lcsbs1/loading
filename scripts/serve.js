'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(path.join(__dirname, '..'));
const PUBLIC_ROOT = path.join(ROOT, 'reload');
const { proxyRawg, proxyTranslate, segmentsFromPath } = require(path.join(ROOT, 'lib', 'upstream'));

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function sendText(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=UTF-8' });
  res.end(body);
}

function resolveSafePath(urlPath) {
  if (!urlPath || urlPath.includes('\0')) return null;

  let decoded;
  try {
    decoded = decodeURI(urlPath.split('?')[0]);
  } catch {
    return null;
  }

  if (decoded.includes('\0')) return null;

  // Normalize URL path separators and reject absolute Windows paths.
  let normalized = decoded.replace(/\\/g, '/');
  if (normalized === '/' || normalized === '' || normalized === '/reload' || normalized === '/reload/') {
    normalized = '/reload/index.html';
  }
  if (!normalized.startsWith('/reload/')) return null;

  // Strip leading slashes so join stays under ROOT, then resolve.
  const relative = normalized.replace(/^\/+/, '');
  const candidate = path.resolve(ROOT, relative);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  const publicWithSep = PUBLIC_ROOT.endsWith(path.sep) ? PUBLIC_ROOT : PUBLIC_ROOT + path.sep;

  if (candidate !== ROOT && !candidate.startsWith(rootWithSep)) {
    return null;
  }
  if (candidate !== PUBLIC_ROOT && !candidate.startsWith(publicWithSep)) {
    return null;
  }

  return candidate;
}

const server = http.createServer((req, res) => {
  let reqPath;
  try {
    reqPath = decodeURI((req.url || '/').split('?')[0]);
  } catch {
    sendText(res, 400, 'Bad Request');
    return;
  }

  const pathname = reqPath.replace(/\/+$/, '') || '/';

  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    sendJson(res, 410, {
      error: {
        code: 'AUTH_MOVED',
        message: 'Auth moved to Supabase. Use the browser client (supabase.auth).',
      },
    });
    return;
  }

  if (pathname === '/api/rawg' || pathname.startsWith('/api/rawg/')) {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    proxyRawg(segmentsFromPath(url.pathname, '/api/rawg/'), url.searchParams)
      .then(result => sendJson(res, result.status, result.body, result.headers))
      .catch(() => sendJson(res, 502, { error: 'Catálogo indisponível.' }));
    return;
  }

  if (pathname === '/api/translate') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    proxyTranslate(url.searchParams)
      .then(result => sendJson(res, result.status, result.body, result.headers))
      .catch(() => sendJson(res, 502, { responseStatus: 502, responseDetails: 'Tradução indisponível.' }));
    return;
  }

  let filePath = resolveSafePath(req.url || '/');
  if (!filePath) {
    sendText(res, 404, '404 Not Found');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexPath = path.resolve(filePath, 'index.html');
    const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
    if (indexPath !== ROOT && !indexPath.startsWith(rootWithSep)) {
      sendText(res, 404, '404 Not Found');
      return;
    }
    filePath = indexPath;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendText(res, 404, '404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\nServidor local ativo em: http://localhost:${PORT}`);
  console.log(`Aplicacao: http://localhost:${PORT}/reload/index.html`);
  console.log(`Auth/forum/feedback: Supabase (client-side)\n`);
});
