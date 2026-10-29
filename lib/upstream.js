'use strict';

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

async function proxyRawg(segments, searchParams) {
  const key = process.env.RAWG_KEY || '';
  if (!key) {
    return { status: 503, body: { error: 'Catálogo indisponível.' }, headers: { 'Cache-Control': 'no-store' } };
  }
  if (!rawgSegmentsAllowed(segments)) {
    return { status: 404, body: { error: 'Caminho não permitido.' }, headers: { 'Cache-Control': 'no-store' } };
  }

  const upstream = buildRawgUrl(segments, searchParams, key);
  let res;
  try {
    res = await fetch(upstream);
  } catch {
    return { status: 502, body: { error: 'Catálogo indisponível.' }, headers: { 'Cache-Control': 'no-store' } };
  }

  const text = redact(await res.text(), key);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { status: 502, body: { error: 'Resposta inválida do catálogo.' }, headers: { 'Cache-Control': 'no-store' } };
  }

  if (body && typeof body === 'object') {
    if (Object.prototype.hasOwnProperty.call(body, 'next')) body.next = rewriteRawgPaging(body.next);
    if (Object.prototype.hasOwnProperty.call(body, 'previous')) body.previous = rewriteRawgPaging(body.previous);
  }

  return {
    status: res.status,
    body,
    headers: {
      'Cache-Control': res.ok ? 'public, max-age=120' : 'no-store',
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
    res = await fetch(upstream);
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
