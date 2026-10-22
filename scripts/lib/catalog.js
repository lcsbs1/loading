/**
 * Funções puras do catálogo — usadas pela app (via espelho) e pelos testes Node.
 */

const PLAT_LABEL = {
  '1': 'PC',
  '2': 'PlayStation',
  '3': 'Xbox',
  '8': 'Nintendo',
};

function filterSeedGames(seed, { query = '', platform = '' } = {}) {
  const q = String(query || '').toLowerCase().trim();
  const platLabel = PLAT_LABEL[platform] || '';
  return (seed || []).filter(g => {
    if (q && !String(g.name || '').toLowerCase().includes(q)) return false;
    if (platLabel) {
      const plats = g.platforms || [];
      if (!plats.some(p => String(p).toLowerCase().includes(platLabel.toLowerCase()))) return false;
    }
    return true;
  });
}

function starsFromRating(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  if (!n) return { text: '', label: 'Sem nota' };
  return { text: '★'.repeat(n) + '☆'.repeat(5 - n), label: `${n} de 5 estrelas` };
}

function mapRawgGame(g, genreFn) {
  const genre = typeof genreFn === 'function' ? genreFn : (n => n);
  return {
    id: g.id,
    name: g.name,
    released: g.released,
    metacritic: g.metacritic,
    rating: g.rating,
    platforms: (g.parent_platforms || []).map(p => p.platform.name),
    genres: (g.genres || []).map(x => genre(x.name)),
    developers: [],
    publishers: [],
    tags: (g.tags || []).slice(0, 8).map(t => t.id),
    image: g.background_image,
    imageHover: (g.short_screenshots && g.short_screenshots[1] && g.short_screenshots[1].image) || null,
    screenshots: (g.short_screenshots || []).filter(s => s && s.image && s.id !== -1).map(s => s.image),
    description: null,
    website: null,
    source: 'rawg',
  };
}

function moreButtonVisible(hasNext, infiniteScroll) {
  return Boolean(hasNext) && !infiniteScroll;
}

module.exports = {
  PLAT_LABEL,
  filterSeedGames,
  starsFromRating,
  mapRawgGame,
  moreButtonVisible,
};
