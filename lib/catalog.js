'use strict';

const path = require('path');
const fs = require('fs');

const PLATFORM_ID_TO_NAME = {
  '1': 'PC',
  '2': 'PlayStation',
  '3': 'Xbox',
  '7': 'Nintendo',
  '8': 'Android',
  '9': 'Atari',
  '10': 'Commodore',
  '11': 'SEGA',
};

let cachedGames = null;

function loadGames() {
  if (cachedGames) return cachedGames;
  const file = path.join(__dirname, 'catalog-data.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  cachedGames = Array.isArray(raw.games) ? raw.games : [];
  return cachedGames;
}

function cloneGame(game, { detail = false } = {}) {
  const copy = {
    id: game.id,
    slug: game.slug,
    name: game.name,
    released: game.released,
    metacritic: game.metacritic,
    rating: game.rating,
    background_image: game.background_image,
    short_screenshots: game.short_screenshots || [],
    parent_platforms: game.parent_platforms || [],
    genres: game.genres || [],
  };
  if (detail) {
    copy.description = game.description || game.description_raw || '';
    copy.description_raw = game.description_raw || game.description || '';
    copy.description_lang = game.description_lang || 'pt-BR';
    copy.developers = game.developers || [];
    copy.publishers = game.publishers || [];
    copy.website = game.website || null;
    copy.steam_app_id = game.steam_app_id || null;
  }
  return copy;
}

function yearOf(value) {
  const m = String(value || '').match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function matchesPlatform(game, parentPlatforms) {
  if (!parentPlatforms) return true;
  const wanted = String(parentPlatforms)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(id => PLATFORM_ID_TO_NAME[id] || id.toLowerCase());
  if (!wanted.length) return true;
  const names = (game.parent_platforms || []).map(p => (p.platform && p.platform.name) || '').filter(Boolean);
  return wanted.some(w => names.some(n => n.toLowerCase().includes(String(w).toLowerCase())));
}

function matchesDates(game, dates) {
  if (!dates || !String(dates).includes(',')) return true;
  const [start, end] = String(dates).split(',', 2);
  const y = yearOf(game.released);
  if (y == null) return true;
  const startY = yearOf(start);
  const endY = yearOf(end);
  if (startY != null && y < startY) return false;
  if (endY != null && y > endY) return false;
  return true;
}

function sortGames(list, ordering) {
  const arr = list.slice();
  switch (ordering) {
    case '-metacritic':
      arr.sort((a, b) => (b.metacritic || 0) - (a.metacritic || 0));
      break;
    case '-released':
      arr.sort((a, b) => String(b.released || '').localeCompare(String(a.released || '')));
      break;
    case 'released':
      arr.sort((a, b) => String(a.released || '').localeCompare(String(b.released || '')));
      break;
    case 'name':
      arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
      break;
    case '-added':
    default:
      arr.sort((a, b) => (b.metacritic || 0) - (a.metacritic || 0) || String(b.released || '').localeCompare(String(a.released || '')));
      break;
  }
  return arr;
}

function listGames(searchParams) {
  const games = loadGames();
  const search = String(searchParams.get('search') || '').trim().toLowerCase();
  const ordering = String(searchParams.get('ordering') || '-added');
  const parentPlatforms = searchParams.get('parent_platforms');
  const dates = searchParams.get('dates');
  const pageSize = Math.min(40, Math.max(1, Number(searchParams.get('page_size')) || 20));
  const page = Math.max(1, Math.min(1000, Number(searchParams.get('page')) || 1));

  let filtered = games.filter(g => {
    if (search && !String(g.name || '').toLowerCase().includes(search)) return false;
    if (!matchesPlatform(g, parentPlatforms)) return false;
    if (!matchesDates(g, dates)) return false;
    return true;
  });
  filtered = sortGames(filtered, ordering);

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const hasNext = start + pageSize < total;
  const hasPrev = page > 1;

  const qs = new URLSearchParams();
  for (const [k, v] of searchParams.entries()) {
    if (k === 'page' || k === 'segments') continue;
    qs.set(k, v);
  }
  qs.set('page_size', String(pageSize));

  const nextQs = new URLSearchParams(qs);
  nextQs.set('page', String(page + 1));
  const prevQs = new URLSearchParams(qs);
  prevQs.set('page', String(page - 1));

  return {
    status: 200,
    body: {
      count: total,
      next: hasNext ? `/api/rawg/games?${nextQs}` : null,
      previous: hasPrev ? `/api/rawg/games?${prevQs}` : null,
      results: slice.map(g => cloneGame(g)),
      source: 'catalog',
    },
    headers: { 'Cache-Control': 'public, max-age=120', 'X-Catalog-Fallback': '1' },
  };
}

function getGame(id) {
  const games = loadGames();
  const num = Number(id);
  const game = games.find(g => g.id === num || String(g.id) === String(id));
  if (!game) {
    return {
      status: 404,
      body: { detail: 'Not found.', source: 'catalog' },
      headers: { 'Cache-Control': 'no-store', 'X-Catalog-Fallback': '1' },
    };
  }
  return {
    status: 200,
    body: { ...cloneGame(game, { detail: true }), source: 'catalog' },
    headers: { 'Cache-Control': 'public, max-age=300', 'X-Catalog-Fallback': '1' },
  };
}

function getScreenshots(id) {
  const detail = getGame(id);
  if (detail.status !== 200) return detail;
  const results = (detail.body.short_screenshots || [])
    .map((s, i) => ({ id: s.id != null ? s.id : i, image: s.image }))
    .filter(s => s.image);
  return {
    status: 200,
    body: { count: results.length, next: null, previous: null, results, source: 'catalog' },
    headers: { 'Cache-Control': 'public, max-age=300', 'X-Catalog-Fallback': '1' },
  };
}

function catalogFallback(segments, searchParams) {
  if (!Array.isArray(segments) || segments[0] !== 'games') {
    return {
      status: 404,
      body: { error: 'Caminho não permitido.', source: 'catalog' },
      headers: { 'Cache-Control': 'no-store', 'X-Catalog-Fallback': '1' },
    };
  }
  if (segments.length === 1) return listGames(searchParams);
  if (segments.length === 2) return getGame(segments[1]);
  if (segments.length === 3 && segments[2] === 'screenshots') return getScreenshots(segments[1]);
  return {
    status: 404,
    body: { error: 'Caminho não permitido.', source: 'catalog' },
    headers: { 'Cache-Control': 'no-store', 'X-Catalog-Fallback': '1' },
  };
}

module.exports = {
  catalogFallback,
  listGames,
  getGame,
  loadGames,
};
