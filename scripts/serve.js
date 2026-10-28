'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(path.join(__dirname, '..'));
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

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': Buffer.byteLength(payload),
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
  if (normalized === '/' || normalized === '') normalized = '/reload/index.html';

  // Strip leading slashes so join stays under ROOT, then resolve.
  const relative = normalized.replace(/^\/+/, '');
  const candidate = path.resolve(ROOT, relative);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;

  if (candidate !== ROOT && !candidate.startsWith(rootWithSep)) {
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

  let filePath = resolveSafePath(req.url || '/');
  if (!filePath) {
    sendText(res, 400, 'Bad Request');
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
