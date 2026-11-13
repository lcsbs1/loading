'use strict';

const { proxyRawg } = require('./upstream');
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
  if (!/^(?:rawg:|igdb:)?\d+$/i.test(id) && !/^\d+$/.test(id)) return false;
  if (segments.length === 2) return true;
  return segments[2] === 'screenshots';
}

function parseCatalogId(raw) {
  const value = decodeURIComponent(String(raw || ''));
  const m = value.match(/^(rawg|igdb):(\d+)$/i);
  if (m) return { provider: m[1].toLowerCase(), id: m[2] };
  if (/^\d+$/.test(value)) return { provider: 'rawg', id: value, legacy: true };
  return null;
}

function prefixRawgId(id) {
  const raw = String(id ?? '');
  if (!raw) return raw;
  if (/^(?:rawg|igdb):/i.test(raw)) return raw;
  return `rawg:${raw}`;
}

function normalizeRawgGame(game) {
  if (!game || typeof game !== 'object') return game;
  const out = { ...game, id: prefixRawgId(game.id), source: 'rawg' };
  return out;
}

function rewritePagingUrl(value, basePath) {
  if (!value || typeof value !== 'string') return null;
  // Already rewritten by proxyRawg to /api/rawg/...
  if (value.startsWith('/api/rawg/')) {
    return value.replace(/^\/api\/rawg\//, `${basePath}/`);
  }
  if (value.startsWith('/api/catalog/')) return value;
  return null;
}

function normalizeRawgListBody(body, basePath) {
  if (!body || typeof body !== 'object') return body;
  const next = rewritePagingUrl(body.next, basePath);
  const previous = rewritePagingUrl(body.previous, basePath);
  const results = Array.isArray(body.results)
    ? body.results.map(normalizeRawgGame)
    : body.results;
  return {
    ...body,
    results,
    next,
    previous,
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
    // 404 etc. — don't failover for missing resource when provider was explicit rawg
    return {
      ...result,
      body: Array.isArray(result.body?.results)
        ? normalizeRawgListBody(result.body, basePath)
        : (result.body && result.body.id != null
            ? normalizeRawgGame(result.body)
            : result.body),
      provider: 'rawg',
      headers: {
        ...(result.headers || {}),
        [PROVIDER_HEADER]: 'rawg',
      },
    };
  }

  let body = result.body;
  if (segments.length === 1) {
    body = normalizeRawgListBody(body, basePath);
  } else if (segments.length === 2) {
    body = normalizeRawgGame(body);
  } else if (segments.length === 3 && segments[2] === 'screenshots') {
    // keep screenshots shape; ids stay local to the shot list
    body = body;
  }

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
        },
        provider: 'igdb',
        headers: {
          'Cache-Control': 'public, max-age=120',
          [PROVIDER_HEADER]: 'igdb',
        },
      };
    }

    const parsed = parseCatalogId(segments[1]);
    if (parsed && parsed.provider === 'rawg') {
      // Numeric/rawg id cannot be resolved on IGDB without crosswalk.
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

/**
 * Unified catalog proxy with RAWG → IGDB failover.
 * @param {string[]} segments
 * @param {URLSearchParams} searchParams
 * @param {{ basePath?: string }} [opts]
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

  // Rewrite segments for upstream RAWG (numeric id only).
  const rawgSegments = segments.map((part, idx) => {
    if (idx !== 1) return part;
    const parsed = parseCatalogId(part);
    return parsed ? parsed.id : part;
  });

  if (forceProvider === 'igdb') {
    const igdb = await tryIgdb(segments, searchParams, basePath);
    return igdb || unavailable(503);
  }

  if (forceProvider === 'rawg') {
    const rawg = await tryRawg(rawgSegments, searchParams, basePath);
    if (rawg) return rawg;
    // Explicit rawg id: do not invent an IGDB match.
    return unavailable(hasRawgCredentials() ? 502 : 503);
  }

  // Auto failover: RAWG first, then IGDB.
  const rawg = await tryRawg(rawgSegments, searchParams, basePath);
  if (rawg && rawg.status < 500) return rawg;

  const igdb = await tryIgdb(segments, searchParams, basePath);
  if (igdb) return igdb;

  if (!hasRawgCredentials() && !hasIgdbCredentials()) {
    return unavailable(503);
  }
  return unavailable(502);
}

module.exports = {
  PROVIDER_HEADER,
  catalogSegmentsAllowed,
  parseCatalogId,
  prefixRawgId,
  normalizeRawgGame,
  proxyCatalog,
  hasRawgCredentials,
};
