'use strict';

const IGDB_API = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const FETCH_TIMEOUT_MS = 2500;

/** RAWG parent_platforms → IDs de platform IGDB (subconjunto estável). */
const PARENT_TO_IGDB_PLATFORMS = {
  '1': [6, 14, 3], // PC / Mac / Linux
  '2': [7, 8, 9, 48, 167, 165], // PlayStation family
  '3': [11, 12, 49, 169], // Xbox family
  '7': [4, 5, 18, 19, 20, 21, 22, 33, 37, 130, 137, 160], // Nintendo family
  '11': [29, 30, 32, 35, 64, 78, 86, 84], // SEGA
  '9': [59, 60, 66, 67, 70], // Atari
  '10': [15, 16, 25, 26], // Commodore / Amiga
};

let tokenCache = {
  accessToken: '',
  clientId: '',
  expiresAt: 0,
};

function hasIgdbCredentials() {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

function igdbImage(imageId, size = 't_cover_big') {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

function escapeApicalypseString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toUnixDate(isoDate, endOfDay = false) {
  const raw = String(isoDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const iso = endOfDay ? `${raw}T23:59:59.000Z` : `${raw}T00:00:00.000Z`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function mapOrdering(ordering) {
  switch (String(ordering || '')) {
    case '-metacritic':
      return 'aggregated_rating desc';
    case '-released':
      return 'first_release_date desc';
    case 'released':
      return 'first_release_date asc';
    case 'name':
      return 'name asc';
    case '-added':
    default:
      return 'total_rating_count desc';
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getTwitchToken() {
  const clientId = process.env.TWITCH_CLIENT_ID || '';
  const clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('IGDB credentials missing'), { code: 'NO_CREDS' });
  }

  const now = Date.now();
  if (
    tokenCache.accessToken &&
    tokenCache.clientId === clientId &&
    tokenCache.expiresAt > now + 60_000
  ) {
    return { accessToken: tokenCache.accessToken, clientId };
  }

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('grant_type', 'client_credentials');

  const res = await fetchWithTimeout(url, { method: 'POST' }, 4000);
  if (!res.ok) {
    throw Object.assign(new Error('Twitch token failed'), { code: 'TOKEN', status: res.status });
  }
  const data = await res.json();
  const accessToken = data && data.access_token;
  const expiresIn = Number(data && data.expires_in) || 3600;
  if (!accessToken) {
    throw Object.assign(new Error('Twitch token empty'), { code: 'TOKEN' });
  }

  tokenCache = {
    accessToken,
    clientId,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return { accessToken, clientId };
}

async function igdbRequest(endpoint, body) {
  const { accessToken, clientId } = await getTwitchToken();
  const res = await fetchWithTimeout(`${IGDB_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'text/plain',
    },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : [];
  } catch {
    throw Object.assign(new Error('IGDB invalid JSON'), { code: 'BAD_JSON', status: res.status });
  }
  if (!res.ok) {
    throw Object.assign(new Error('IGDB upstream error'), {
      code: 'UPSTREAM',
      status: res.status,
      body: json,
    });
  }
  return json;
}

function buildWhereClauses(searchParams) {
  const clauses = ['cover != null'];
  const dates = String(searchParams.get('dates') || '');
  if (dates.includes(',')) {
    const [from, to] = dates.split(',', 2);
    const fromUnix = toUnixDate(from, false);
    const toUnix = toUnixDate(to, true);
    if (fromUnix != null) clauses.push(`first_release_date >= ${fromUnix}`);
    if (toUnix != null) clauses.push(`first_release_date <= ${toUnix}`);
  }

  const parent = String(searchParams.get('parent_platforms') || '');
  if (parent && PARENT_TO_IGDB_PLATFORMS[parent]) {
    clauses.push(`platforms = (${PARENT_TO_IGDB_PLATFORMS[parent].join(',')})`);
  }
  return clauses;
}

function buildListQuery(searchParams) {
  const pageSize = Math.min(40, Math.max(1, Number(searchParams.get('page_size')) || 20));
  const page = Math.max(1, Math.min(1000, Number(searchParams.get('page')) || 1));
  const offset = (page - 1) * pageSize;
  const search = String(searchParams.get('search') || '').trim().slice(0, 120);
  const ordering = mapOrdering(searchParams.get('ordering'));
  const where = buildWhereClauses(searchParams);

  const lines = [];
  if (search) {
    lines.push(`search "${escapeApicalypseString(search)}";`);
  }
  lines.push(
    'fields name,cover.image_id,first_release_date,aggregated_rating,rating,genres.name,platforms.name,screenshots.image_id,summary;'
  );
  if (where.length) lines.push(`where ${where.join(' & ')};`);
  if (!search) lines.push(`sort ${ordering};`);
  lines.push(`limit ${pageSize};`);
  lines.push(`offset ${offset};`);
  return { body: `${lines.join('\n')}\n`, page, pageSize };
}

function buildCountQuery(searchParams) {
  const search = String(searchParams.get('search') || '').trim().slice(0, 120);
  const where = buildWhereClauses(searchParams);
  const lines = [];
  if (search) lines.push(`search "${escapeApicalypseString(search)}";`);
  if (where.length) lines.push(`where ${where.join(' & ')};`);
  return `${lines.join('\n')}\n`;
}

function unixToIsoDate(unix) {
  if (!unix || !Number.isFinite(Number(unix))) return null;
  return new Date(Number(unix) * 1000).toISOString().slice(0, 10);
}

function normalizeIgdbGame(game, { detail = false } = {}) {
  const id = `igdb:${game.id}`;
  const cover = igdbImage(game.cover && game.cover.image_id, 't_cover_big');
  const screenshots = Array.isArray(game.screenshots)
    ? game.screenshots
        .map((s) => igdbImage(s && s.image_id, 't_screenshot_med'))
        .filter(Boolean)
    : [];
  const platforms = Array.isArray(game.platforms)
    ? game.platforms.map((p) => (p && p.name) || '').filter(Boolean)
    : [];
  const genres = Array.isArray(game.genres)
    ? game.genres.map((g) => (g && g.name) || '').filter(Boolean)
    : [];
  const metacritic = game.aggregated_rating != null
    ? Math.round(Number(game.aggregated_rating))
    : null;
  const rating = game.rating != null ? Number(game.rating) / 20 : null; // 0–100 → ~0–5

  const out = {
    id,
    source: 'igdb',
    name: game.name || 'Sem título',
    released: unixToIsoDate(game.first_release_date),
    metacritic,
    rating,
    background_image: cover,
    short_screenshots: [cover, ...screenshots].filter(Boolean).map((image, i) => ({ id: i, image })),
    parent_platforms: platforms.map((name) => ({ platform: { name } })),
    genres: genres.map((name) => ({ name })),
  };

  if (detail) {
    out.description_raw = game.summary || '';
    out.website = null;
    out.developers = Array.isArray(game.involved_companies)
      ? game.involved_companies
          .filter((c) => c && c.developer && c.company && c.company.name)
          .map((c) => ({ name: c.company.name }))
      : [];
    out.publishers = Array.isArray(game.involved_companies)
      ? game.involved_companies
          .filter((c) => c && c.publisher && c.company && c.company.name)
          .map((c) => ({ name: c.company.name }))
      : [];
  }
  return out;
}

function parseGameId(rawId) {
  const value = decodeURIComponent(String(rawId || ''));
  const m = value.match(/^(?:igdb:)?(\d+)$/i);
  if (!m) return null;
  return m[1];
}

async function igdbListGames(searchParams) {
  const { body, page, pageSize } = buildListQuery(searchParams);
  const [rows, countPayload] = await Promise.all([
    igdbRequest('games', body),
    igdbRequest('games/count', buildCountQuery(searchParams)).catch(() => null),
  ]);
  const results = Array.isArray(rows) ? rows.map((g) => normalizeIgdbGame(g)) : [];
  const count = countPayload && typeof countPayload.count === 'number'
    ? countPayload.count
    : results.length + (page - 1) * pageSize;
  return { results, count, page, pageSize };
}

async function igdbGameDetail(rawId) {
  const id = parseGameId(rawId);
  if (!id) {
    throw Object.assign(new Error('Invalid IGDB id'), { code: 'BAD_ID', status: 404 });
  }
  const body = [
    `fields name,cover.image_id,first_release_date,aggregated_rating,rating,genres.name,platforms.name,screenshots.image_id,summary,involved_companies.company.name,involved_companies.developer,involved_companies.publisher;`,
    `where id = ${id};`,
    'limit 1;',
  ].join('\n');
  const rows = await igdbRequest('games', `${body}\n`);
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error('IGDB game not found'), { code: 'NOT_FOUND', status: 404 });
  }
  return normalizeIgdbGame(rows[0], { detail: true });
}

async function igdbScreenshots(rawId) {
  const detail = await igdbGameDetail(rawId);
  const images = (detail.short_screenshots || [])
    .map((s) => s && s.image)
    .filter(Boolean)
    .slice(1); // skip cover-as-first
  return {
    results: images.map((image, i) => ({
      id: i + 1,
      image,
      is_deleted: false,
    })),
  };
}

/** @visibleForTesting */
function __resetTokenCacheForTests() {
  tokenCache = { accessToken: '', clientId: '', expiresAt: 0 };
}

module.exports = {
  hasIgdbCredentials,
  igdbImage,
  mapOrdering,
  buildListQuery,
  normalizeIgdbGame,
  parseGameId,
  igdbListGames,
  igdbGameDetail,
  igdbScreenshots,
  PARENT_TO_IGDB_PLATFORMS,
  __resetTokenCacheForTests,
};
