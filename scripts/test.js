const assert = require('assert');
const {
  filterSeedGames,
  starsFromRating,
  mapRawgGame,
  moreButtonVisible,
} = require('./lib/catalog');

const seed = [
  { name: 'Elden Ring', platforms: ['PC', 'PlayStation', 'Xbox'] },
  { name: 'Zelda', platforms: ['Nintendo'] },
  { name: 'Portal 2', platforms: ['PC', 'PlayStation', 'Xbox'] },
];

assert.strictEqual(filterSeedGames(seed, { query: 'elden' }).length, 1);
assert.strictEqual(filterSeedGames(seed, { platform: '8' }).length, 1);
assert.strictEqual(filterSeedGames(seed, { platform: '1', query: 'portal' }).length, 1);
assert.strictEqual(filterSeedGames(seed, { platform: '8', query: 'portal' }).length, 0);

assert.deepStrictEqual(starsFromRating(5), { text: '★★★★★', label: '5 de 5 estrelas' });
assert.deepStrictEqual(starsFromRating(3), { text: '★★★☆☆', label: '3 de 5 estrelas' });
assert.deepStrictEqual(starsFromRating(0), { text: '', label: 'Sem nota' });
assert.deepStrictEqual(starsFromRating(99), { text: '★★★★★', label: '5 de 5 estrelas' });

const mapped = mapRawgGame({
  id: 1,
  name: 'Test',
  released: '2020-01-01',
  metacritic: 90,
  rating: 4.5,
  parent_platforms: [{ platform: { name: 'PC' } }],
  genres: [{ name: 'Action' }],
  tags: [],
  background_image: 'https://example.com/a.jpg',
  short_screenshots: [{ id: -1, image: 'x' }, { id: 1, image: 'https://example.com/s.jpg' }],
}, name => (name === 'Action' ? 'Ação' : name));

assert.strictEqual(mapped.source, 'rawg');
assert.strictEqual(mapped.genres[0], 'Ação');
assert.deepStrictEqual(mapped.platforms, ['PC']);
assert.deepStrictEqual(mapped.screenshots, ['https://example.com/s.jpg']);

assert.strictEqual(moreButtonVisible('https://api/next', false), true);
assert.strictEqual(moreButtonVisible(null, false), false);
assert.strictEqual(moreButtonVisible('https://api/next', true), false);

console.log('OK: todos os testes unitários passaram (' + 12 + ' asserções).');
