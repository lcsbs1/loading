'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApi, isAuthApi } = require('../server');
const config = require('../server/config');

const ROOT = path.join(__dirname, '..');

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

const server = http.createServer(async (req, res) => {
  let reqPath;
  try {
    reqPath = decodeURI((req.url || '/').split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('Bad Request');
    return;
  }

  const pathname = reqPath.replace(/\/+$/, '') || '/';

  if (isAuthApi(pathname) || pathname.startsWith('/api/auth')) {
    await handleApi(req, res);
    return;
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/reload/index.html';

  let filePath = path.join(ROOT, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found');
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

server.listen(config.port, config.host, () => {
  console.log(`\n🚀 Servidor local ativo em: http://localhost:${config.port}`);
  console.log(`⚡ Aplicação pronta em: http://localhost:${config.port}/reload/index.html`);
  console.log(`🔐 Auth API em: http://localhost:${config.port}/api/auth/*\n`);
});
