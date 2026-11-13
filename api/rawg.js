'use strict';

const { segmentsFromPath } = require('../lib/upstream');
const { proxyCatalog, PROVIDER_HEADER } = require('../lib/catalog');

/** Alias de /api/catalog — mantém compatibilidade com clients/SW antigos. */
module.exports = async function rawgHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = new URL(req.url || '/', 'https://loading.local');
  const querySegments = req.query && req.query.segments;
  const fromQuery = String(url.searchParams.get('segments') || querySegments || '');
  const segments = fromQuery
    ? fromQuery.split('/').filter(Boolean).map((s) => decodeURIComponent(s))
    : segmentsFromPath(url.pathname, '/api/rawg/').map((s) => {
        try { return decodeURIComponent(s); } catch { return s; }
      });
  url.searchParams.delete('segments');

  const result = await proxyCatalog(segments, url.searchParams, { basePath: '/api/rawg' });
  if (result.headers && result.headers['Cache-Control']) {
    res.setHeader('Cache-Control', result.headers['Cache-Control']);
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  if (result.provider) {
    res.setHeader(PROVIDER_HEADER, result.provider);
  } else if (result.headers && result.headers[PROVIDER_HEADER]) {
    res.setHeader(PROVIDER_HEADER, result.headers[PROVIDER_HEADER]);
  }
  if (result.headers && result.headers['X-Catalog-Fallback']) {
    res.setHeader('X-Catalog-Fallback', result.headers['X-Catalog-Fallback']);
  }
  res.status(result.status).json(result.body);
};
