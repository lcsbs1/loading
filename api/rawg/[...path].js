'use strict';

const { proxyRawg, segmentsFromPath } = require('../../lib/upstream');

module.exports = async function rawgHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = new URL(req.url || '/', 'https://loading.local');
  const segments = segmentsFromPath(url.pathname, '/api/rawg/');
  const result = await proxyRawg(segments, url.searchParams);
  res.setHeader('Cache-Control', result.headers['Cache-Control']);
  res.status(result.status).json(result.body);
};
