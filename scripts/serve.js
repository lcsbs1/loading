const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..');
const LOCAL_CONFIG = path.join(ROOT, 'reload', 'js', 'config.local.js');

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

function safeResolve(reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, '');
  const resolved = path.resolve(ROOT, normalized);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (resolved !== ROOT && !resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function virtualLocalConfig() {
  const key = (process.env.RAWG_KEY || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(key)) return null;
  return `(function(){if(typeof CONFIG==='undefined')return;CONFIG.RAWG_KEY=${JSON.stringify(key)};})();\n`;
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/reload/index.html';

  // Injeta chave via env quando config.local.js não existe
  if (reqPath === '/reload/js/config.local.js' && !fs.existsSync(LOCAL_CONFIG)) {
    const injected = virtualLocalConfig();
    if (injected) {
      send(res, 200, {
        'Content-Type': 'application/javascript; charset=UTF-8',
        'Cache-Control': 'no-store',
      }, injected);
      return;
    }
    send(res, 204, { 'Cache-Control': 'no-store' }, '');
    return;
  }

  let filePath = safeResolve(reqPath);
  if (!filePath) {
    send(res, 403, { 'Content-Type': 'text/plain; charset=UTF-8' }, '403 Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
      send(res, 403, { 'Content-Type': 'text/plain; charset=UTF-8' }, '403 Forbidden');
      return;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      send(res, 404, { 'Content-Type': 'text/plain; charset=UTF-8' }, '404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nServidor local: http://localhost:${PORT}`);
  console.log(`App: http://localhost:${PORT}/reload/index.html`);
  if (process.env.RAWG_KEY) console.log('RAWG_KEY detectada no ambiente (injetada se não houver config.local.js).\n');
  else console.log('Dica: copie config.local.example.js → config.local.js ou use RAWG_KEY=...\n');
});
