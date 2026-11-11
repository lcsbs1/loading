'use strict';

const { catalogFallback } = require('./catalog');

const RAWG_QUERY = new Set([
  'page',
  'page_size',
  'search',
  'search_precise',
  'ordering',
  'dates',
  'parent_platforms',
  'platforms',
]);

function rawgSegmentsAllowed(segments) {
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 3) return false;
  if (segments.some(part => typeof part !== 'string' || !/^[a-z0-9_-]+$/i.test(part))) return false;
  if (segments[0] !== 'games') return false;
  if (segments.length === 1) return true;
  if (!/^\d+$/.test(segments[1])) return false;
  if (segments.length === 2) return true;
  return segments[2] === 'screenshots';
}

function redact(text, secret) {
  if (!secret || !text) return text;
  return String(text).split(secret).join('');
}

function rewriteRawgPaging(value) {
  if (!value || typeof value !== 'string') return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.hostname !== 'api.rawg.io') return null;
  const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (!rawgSegmentsAllowed(segments)) return null;
  url.searchParams.delete('key');
  const qs = url.searchParams.toString();
  return `/api/rawg/${segments.join('/')}${qs ? `?${qs}` : ''}`;
}

function buildRawgUrl(segments, searchParams, key) {
  const url = new URL(`https://api.rawg.io/api/${segments.map(encodeURIComponent).join('/')}`);
  for (const [name, raw] of searchParams.entries()) {
    if (!RAWG_QUERY.has(name)) continue;
    const value = String(raw);
    if (!value || value.length > 200) continue;
    if (name === 'page_size') {
      const size = Math.min(40, Math.max(1, Number(value) || 20));
      url.searchParams.set(name, String(size));
      continue;
    }
    if (name === 'page') {
      const page = Math.max(1, Math.min(1000, Number(value) || 1));
      url.searchParams.set(name, String(page));
      continue;
    }
    url.searchParams.set(name, value);
  }
  url.searchParams.set('key', key);
  return url;
}

// Circuit breaker: se a RAWG cair, evita esperar o timeout a cada request.
let rawgCooldownUntil = 0;
const RAWG_TIMEOUT_MS = 4000;
const RAWG_COOLDOWN_MS = 5 * 60 * 1000;

function markRawgDown() {
  rawgCooldownUntil = Date.now() + RAWG_COOLDOWN_MS;
}

function markRawgUp() {
  rawgCooldownUntil = 0;
}

async function proxyRawg(segments, searchParams) {
  if (!rawgSegmentsAllowed(segments)) {
    return { status: 404, body: { error: 'Caminho não permitido.' }, headers: { 'Cache-Control': 'no-store' } };
  }

  const key = process.env.RAWG_KEY || '';
  // Sem chave ou RAWG em cooldown: responde pelo catálogo local (Steam + curadoria).
  if (!key || Date.now() < rawgCooldownUntil) {
    return catalogFallback(segments, searchParams);
  }

  const upstream = buildRawgUrl(segments, searchParams, key);
  let res;
  try {
    // RAWG costuma travar em 522; corta antes do maxDuration da Vercel (15s).
    res = await fetch(upstream, { signal: AbortSignal.timeout(RAWG_TIMEOUT_MS) });
  } catch {
    markRawgDown();
    return catalogFallback(segments, searchParams);
  }

  if (!res.ok) {
    markRawgDown();
    const fallback = catalogFallback(segments, searchParams);
    if (fallback.status === 200) return fallback;
    const text = redact(await res.text(), key);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: 'Catálogo indisponível.' };
    }
    return { status: res.status, body, headers: { 'Cache-Control': 'no-store' } };
  }

  const text = redact(await res.text(), key);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    markRawgDown();
    return catalogFallback(segments, searchParams);
  }

  markRawgUp();
  if (body && typeof body === 'object') {
    if (Object.prototype.hasOwnProperty.call(body, 'next')) body.next = rewriteRawgPaging(body.next);
    if (Object.prototype.hasOwnProperty.call(body, 'previous')) body.previous = rewriteRawgPaging(body.previous);
    body.source = 'rawg';
  }

  return {
    status: res.status,
    body,
    headers: {
      'Cache-Control': 'public, max-age=120',
    },
  };
}

async function proxyTranslate(searchParams) {
  const q = String(searchParams.get('q') || '');
  if (!q.trim() || q.length > 500) {
    return {
      status: 400,
      body: { responseStatus: 400, responseDetails: 'Texto inválido.' },
      headers: { 'Cache-Control': 'no-store' },
    };
  }
  const langpair = String(searchParams.get('langpair') || 'en|pt-BR');
  if (!/^en\|pt(-BR)?$/.test(langpair)) {
    return {
      status: 400,
      body: { responseStatus: 400, responseDetails: 'Idioma não permitido.' },
      headers: { 'Cache-Control': 'no-store' },
    };
  }

  const upstream = new URL('https://api.mymemory.translated.net/get');
  upstream.searchParams.set('q', q);
  upstream.searchParams.set('langpair', langpair);
  const email = process.env.MYMEMORY_EMAIL || '';
  if (email) upstream.searchParams.set('de', email);

  let res;
  try {
    res = await fetch(upstream, { signal: AbortSignal.timeout(8000) });
  } catch {
    return {
      status: 502,
      body: { responseStatus: 502, responseDetails: 'Tradução indisponível.' },
      headers: { 'Cache-Control': 'no-store' },
    };
  }

  const text = redact(await res.text(), email);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return {
      status: 502,
      body: { responseStatus: 502, responseDetails: 'Tradução indisponível.' },
      headers: { 'Cache-Control': 'no-store' },
    };
  }

  return {
    status: res.ok ? 200 : res.status,
    body,
    headers: {
      'Cache-Control': res.ok ? 'public, max-age=86400' : 'no-store',
    },
  };
}

function segmentsFromPath(pathname, prefix) {
  const rest = String(pathname || '').split('?')[0];
  if (!rest.startsWith(prefix)) return [];
  return rest.slice(prefix.length).split('/').filter(Boolean);
}

module.exports = {
  rawgSegmentsAllowed,
  rewriteRawgPaging,
  proxyRawg,
  proxyTranslate,
  segmentsFromPath,
};
