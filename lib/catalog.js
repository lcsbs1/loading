'use strict';

const { proxyRawg } = require('./upstream');
const { catalogFallback } = require('./catalog-local');
const {
  hasIgdbCredentials,
  igdbListGames,
  igdbGameDetail,
  igdbScreenshots,
  parseGameId,
} = require('./igdb');

const PROVIDER_HEADER = 'X-Catalog-Provider';

function hasRawgCredentials() {
  return Boolean(process.env.RAWG_KEY);
}

function catalogSegmentsAllowed(segments) {
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 3) return false;
  if (segments[0] !== 'games') return false;
  if (segments.length === 1) return true;

  const id = decodeURIComponent(String(segments[1] || ''));
  if (!/^(?:rawg:|igdb:|local:)?\d+$/i.test(id)) return false;
  if (segments.length === 2) return true;
  return segments[2] === 'screenshots';
}

function parseCatalogId(raw) {
  const value = decodeURIComponent(String(raw || ''));
  const m = value.match(/^(rawg|igdb|local):(\d+)$/i);
  if (m) return { provider: m[1].toLowerCase(), id: m[2] };
  if (/^\d+$/.test(value)) return { provider: 'rawg', id: value, legacy: true };
  return null;
}

function prefixRawgId(id) {
  const raw = String(id ?? '');
  if (!raw) return raw;
  if (/^(?:rawg|igdb|local):/i.test(raw)) return raw;
  return `rawg:${raw}`;
}

function normalizeRawgGame(game) {
  if (!game || typeof game !== 'object') return game;
  return { ...game, id: prefixRawgId(game.id), source: game.source || 'rawg' };
}

function rewritePagingUrl(value, basePath) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('/api/rawg/')) {
    return value.replace(/^\/api\/rawg\//, `${basePath}/`);
  }
  if (value.startsWith('/api/catalog/')) {
    return basePath === '/api/catalog' ? value : value.replace(/^\/api\/catalog\//, `${basePath}/`);
  }
  return null;
}

function normalizeRawgListBody(body, basePath) {
  if (!body || typeof body !== 'object') return body;
  return {
    ...body,
    results: Array.isArray(body.results) ? body.results.map(normalizeRawgGame) : body.results,
    next: rewritePagingUrl(body.next, basePath),
    previous: rewritePagingUrl(body.previous, basePath),
  };
}

function buildIgdbNext(basePath, searchParams, page, pageSize, count) {
  if ((page * pageSize) >= count) return null;
  const p = new URLSearchParams(searchParams);
  p.set('page', String(page + 1));
  p.set('page_size', String(pageSize));
  return `${basePath}/games?${p.toString()}`;
}

function unavailable(status = 503) {
  return {
    status,
    body: { error: 'Catálogo indisponível.' },
    headers: { 'Cache-Control': 'no-store' },
    provider: null,
  };
}

async function tryRawg(segments, searchParams, basePath) {
  if (!hasRawgCredentials()) return null;
  const result = await proxyRawg(segments, searchParams);
  if (!result || result.status >= 500 || result.status === 401 || result.status === 403) {
    return null;
  }
  if (result.status >= 400) {
    return {
      ...result,
      body: Array.isArray(result.body?.results)
        ? normalizeRawgListBody(result.body, basePath)
        : (result.body && result.body.id != null ? normalizeRawgGame(result.body) : result.body),
      provider: 'rawg',
      headers: {
        ...(result.headers || {}),
        [PROVIDER_HEADER]: 'rawg',
      },
    };
  }

  let body = result.body;
  if (segments.length === 1) body = normalizeRawgListBody(body, basePath);
  else if (segments.length === 2) body = normalizeRawgGame(body);

  return {
    status: result.status,
    body,
    provider: 'rawg',
    headers: {
      ...(result.headers || {}),
      [PROVIDER_HEADER]: 'rawg',
    },
  };
}

async function tryIgdb(segments, searchParams, basePath) {
  if (!hasIgdbCredentials()) return null;
  try {
    if (segments.length === 1) {
      const { results, count, page, pageSize } = await igdbListGames(searchParams);
      return {
        status: 200,
        body: {
          count,
          next: buildIgdbNext(basePath, searchParams, page, pageSize, count),
          previous: null,
          results,
          source: 'igdb',
        },
        provider: 'igdb',
        headers: {
          'Cache-Control': 'public, max-age=120',
          [PROVIDER_HEADER]: 'igdb',
        },
      };
    }

    const parsed = parseCatalogId(segments[1]);
    if (parsed && (parsed.provider === 'rawg' || parsed.provider === 'local')) {
      return {
        status: 404,
        body: { error: 'Jogo não encontrado neste provedor.' },
        provider: 'igdb',
        headers: { 'Cache-Control': 'no-store', [PROVIDER_HEADER]: 'igdb' },
      };
    }

    const rawId = parsed ? parsed.id : parseGameId(segments[1]);
    if (!rawId) {
      return {
        status: 404,
        body: { error: 'Caminho não permitido.' },
        provider: 'igdb',
        headers: { 'Cache-Control': 'no-store', [PROVIDER_HEADER]: 'igdb' },
      };
    }

    if (segments.length === 2) {
      const game = await igdbGameDetail(rawId);
      return {
        status: 200,
        body: game,
        provider: 'igdb',
        headers: {
          'Cache-Control': 'public, max-age=120',
          [PROVIDER_HEADER]: 'igdb',
        },
      };
    }

    if (segments.length === 3 && segments[2] === 'screenshots') {
      const shots = await igdbScreenshots(rawId);
      return {
        status: 200,
        body: shots,
        provider: 'igdb',
        headers: {
          'Cache-Control': 'public, max-age=120',
          [PROVIDER_HEADER]: 'igdb',
        },
      };
    }

    return {
      status: 404,
      body: { error: 'Caminho não permitido.' },
      provider: 'igdb',
      headers: { 'Cache-Control': 'no-store', [PROVIDER_HEADER]: 'igdb' },
    };
  } catch (err) {
    if (err && err.status === 404) {
      return {
        status: 404,
        body: { error: 'Jogo não encontrado.' },
        provider: 'igdb',
        headers: { 'Cache-Control': 'no-store', [PROVIDER_HEADER]: 'igdb' },
      };
    }
    return null;
  }
}

function tryLocal(segments, searchParams, basePath) {
  return catalogFallback(segments, searchParams, basePath);
}

/**
 * Unified catalog: RAWG → IGDB → catálogo local (Steam/curadoria).
 */
async function proxyCatalog(segments, searchParams, opts = {}) {
  const basePath = opts.basePath || '/api/catalog';
  if (!catalogSegmentsAllowed(segments)) {
    return {
      status: 404,
      body: { error: 'Caminho não permitido.' },
      headers: { 'Cache-Control': 'no-store' },
      provider: null,
    };
  }

  const parsedId = segments[1] ? parseCatalogId(segments[1]) : null;
  const forceProvider = parsedId && !parsedId.legacy ? parsedId.provider : null;

  const rawgSegments = segments.map((part, idx) => {
    if (idx !== 1) return part;
    const parsed = parseCatalogId(part);
    return parsed ? parsed.id : part;
  });

  if (forceProvider === 'local') {
    return tryLocal(segments, searchParams, basePath);
  }

  if (forceProvider === 'igdb') {
    const igdb = await tryIgdb(segments, searchParams, basePath);
    return igdb || unavailable(503);
  }

  if (forceProvider === 'rawg') {
    const rawg = await tryRawg(rawgSegments, searchParams, basePath);
    if (rawg && rawg.status < 500) return rawg;
    const local = tryLocal(rawgSegments, searchParams, basePath);
    if (local && local.status === 200) return local;
    return rawg || unavailable(hasRawgCredentials() ? 502 : 503);
  }

  const rawg = await tryRawg(rawgSegments, searchParams, basePath);
  if (rawg && rawg.status < 500) return rawg;

  const igdb = await tryIgdb(segments, searchParams, basePath);
  if (igdb && igdb.status < 500) return igdb;

  const local = tryLocal(rawgSegments, searchParams, basePath);
  if (local && local.status === 200) return local;

  if (igdb) return igdb;
  if (!hasRawgCredentials() && !hasIgdbCredentials()) {
    return local || unavailable(503);
  }
  return local || unavailable(502);
}

module.exports = {
  PROVIDER_HEADER,
  catalogSegmentsAllowed,
  parseCatalogId,
  prefixRawgId,
  normalizeRawgGame,
  proxyCatalog,
  hasRawgCredentials,
  // Compat: main exportava catalogFallback deste módulo.
  catalogFallback: tryLocal,
};
