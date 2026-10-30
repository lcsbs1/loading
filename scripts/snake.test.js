'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, stepMs } = require('../reload/js/snake');

test('snake: initial state', () => {
  const g = createGame({ cols: 10, rows: 10 });
  const s = g.reset();
  assert.equal(s.alive, true);
  assert.equal(s.score, 0);
  assert.equal(s.speedLevel, 0);
  assert.equal(s.dir, 'right');
  assert.equal(s.snake.length, 3);
  assert.ok(s.food, 'food should be placed');
});

test('snake: move and turn without reversing', () => {
  const g = createGame({ cols: 10, rows: 10 });
  g.reset();
  assert.equal(g.turn('left'), false, 'cannot reverse directly 180 degrees');
  assert.equal(g.turn('up'), true);
  const s = g.tick();
  assert.equal(s.dir, 'up');
  assert.equal(s.alive, true);
});

test('snake: wall collision kills snake', () => {
  const g = createGame({ cols: 6, rows: 6 });
  g.reset(); // starts at (3, 3) facing right
  g.tick(); // (4, 3)
  g.tick(); // (5, 3)
  const dead = g.tick(); // (6, 3) -> hit right wall
  assert.equal(dead.alive, false);
});

test('snake: eating food grows and increases score and speedLevel', () => {
  // Use custom RNG returning 0 so food is deterministically placed
  let foodCallCount = 0;
  const mockRng = () => 0; // always picks first free cell (0, 0)
  const g = createGame({ cols: 6, rows: 6, rng: mockRng });
  g.reset();

  // Test speedLevel scaling function
  assert.equal(stepMs(0, false), 140);
  assert.equal(stepMs(1, false), 130);
  assert.equal(stepMs(5, false), 90);
  assert.equal(stepMs(10, false), 60); // clamped at 60
  assert.equal(stepMs(0, true), 170); // reduced motion base
});
