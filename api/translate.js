'use strict';

const { proxyTranslate } = require('../lib/upstream');

module.exports = async function translateHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = new URL(req.url || '/', 'https://loading.local');
  const result = await proxyTranslate(url.searchParams);
  res.setHeader('Cache-Control', result.headers['Cache-Control']);
  res.status(result.status).json(result.body);
};
