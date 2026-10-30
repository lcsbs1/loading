/* Loading... — "Modo Diagnóstico": minigame Snake (cartucho de teste).
 * Lógica pura em createGame() (testável em Node) + UI de navegador em open(). */
(function (root) {
  'use strict';

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  /* ───────── Lógica pura ───────── */
  function createGame(opts) {
    opts = opts || {};
    var cols = opts.cols || 20;
    var rows = opts.rows || 20;
    var rng = typeof opts.rng === 'function' ? opts.rng : Math.random;

    var snake, dir, moved, queue, food, score, alive, won;

    function occupied(x, y) {
      for (var i = 0; i < snake.length; i++) {
        if (snake[i].x === x && snake[i].y === y) return true;
      }
      return false;
    }

    function placeFood() {
      var free = [];
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          if (!occupied(x, y)) free.push({ x: x, y: y });
        }
      }
      if (!free.length) return null;
      var r = Number(rng()) || 0;
      var idx = Math.floor(r * free.length);
      if (idx < 0) idx = 0;
      if (idx >= free.length) idx = free.length - 1;
      return free[idx];
    }

    function reset() {
      var cx = Math.floor(cols / 2);
      var cy = Math.floor(rows / 2);
      snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
      dir = 'right';
      moved = 'right';
      queue = [];
      score = 0;
      alive = true;
      won = false;
      food = null;
      food = placeFood();
      return state();
    }

    function state() {
      return {
        snake: snake.map(function (s) { return { x: s.x, y: s.y }; }),
        dir: dir,
        food: food ? { x: food.x, y: food.y } : null,
        score: score,
        alive: alive,
        won: won,
        speedLevel: Math.floor(score / 5),
        cols: cols,
        rows: rows
      };
    }

    function turn(next) {
      if (!alive || !DIRS[next] || queue.length >= 2) return false;
      var base = queue.length ? queue[queue.length - 1] : moved;
      if (next === base || next === OPPOSITE[base]) return false;
      queue.push(next);
      return true;
    }

    function tick() {
      if (!alive) return state();
      while (queue.length) {
        var q = queue.shift();
        if (q !== OPPOSITE[moved]) { dir = q; break; }
      }
      var d = DIRS[dir];
      var head = { x: snake[0].x + d.x, y: snake[0].y + d.y };
      moved = dir;

      if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows) {
        alive = false;
        return state();
      }
      var eating = !!food && head.x === food.x && head.y === food.y;
      // Sem comer, a cauda sai do lugar neste tick e não conta como colisão.
      var limit = eating ? snake.length : snake.length - 1;
      for (var i = 0; i < limit; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
          alive = false;
          return state();
        }
      }
      snake.unshift(head);
      if (eating) {
        score += 1;
        food = placeFood();
        if (!food) { won = true; alive = false; }
      } else {
        snake.pop();
      }
      return state();
    }

    reset();
    return { state: state, turn: turn, tick: tick, reset: reset };
  }

  /** Duração do passo (ms) para um nível de velocidade. */
  function stepMs(speedLevel, reducedMotion) {
    var base = reducedMotion ? 170 : 140;
    return Math.max(60, base - 10 * (speedLevel || 0));
  }

  var api = { createGame: createGame, stepMs: stepMs, open: function () {} };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createGame: createGame, stepMs: stepMs };
  }

  /* ───────── UI de navegador ───────── */
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    api.open = initBrowser();
    root.LoadingSnake = { createGame: createGame, open: api.open };
  }

  function initBrowser() {
    var BEST_KEY = 'loading.snake.best';
    var STATUS = {
      ready: 'PRONTO · PRESSIONE ENTER',
      running: 'EM TESTE · SETAS / WASD',
      paused: 'PAUSADO',
      over: 'FIM DE JOGO · ENTER PARA REINICIAR',
      won: 'DIAGNÓSTICO COMPLETO · ENTER PARA REINICIAR'
    };
    var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft',
      'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    var KEY_DIRS = {
      arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
      arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right'
    };

    var game = createGame();
    var mode = 'ready';
    var dialog, canvas, ctx, screenEl, scoreEl, bestEl, statusEl;
    var size = 0;
    var rafId = 0;
    var lastTs = 0;
    var acc = 0;
    var konamiPos = 0;
    var pointerStart = null;
    var best = readBest();
    var reducedMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    var sprites = {
      head: loadSprite('assets/snake/head.svg'),
      body: loadSprite('assets/snake/body.svg'),
      seed: loadSprite('assets/snake/seed.svg')
    };

    function loadSprite(src) {
      var img = new Image();
      img.decoding = 'async';
      img.addEventListener('load', function () { img._ok = true; if (ctx) draw(); });
      img.src = src;
      return img;
    }

    function reduced() { return !!(reducedMq && reducedMq.matches); }

    function readBest() {
      try { return parseInt(window.localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
    }
    function writeBest(v) {
      try { window.localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* storage indisponível */ }
    }

    function sfx(name) {
      try {
        if (window.LoadingSfx && typeof window.LoadingSfx.play === 'function') window.LoadingSfx.play(name);
      } catch (e) { /* som é opcional */ }
    }

    function cssVar(name, fallback) {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (v && v.trim()) || fallback;
    }

    function bind() {
      if (dialog) return true;
      dialog = document.getElementById('snake-dialog');
      if (!dialog) return false;
      canvas = dialog.querySelector('#snake-canvas') || dialog.querySelector('canvas');
      if (!canvas) { dialog = null; return false; }
      ctx = canvas.getContext('2d');
      screenEl = canvas.closest('.snake-screen') || canvas.parentElement;
      scoreEl = document.getElementById('snake-score');
      bestEl = document.getElementById('snake-best');
      statusEl = document.getElementById('snake-status');

      var closeBtn = document.getElementById('snake-close');
      if (closeBtn) closeBtn.addEventListener('click', function () { closeDialog(); });

      dialog.addEventListener('close', function () { pause(); stopLoop(); });
      dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeDialog(); // clique no backdrop
      });

      Array.prototype.forEach.call(dialog.querySelectorAll('[data-dir]'), function (btn) {
        btn.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          press(btn.getAttribute('data-dir'));
        });
        btn.addEventListener('click', function (e) {
          if (e.detail === 0) press(btn.getAttribute('data-dir')); // ativação por teclado
        });
      });

      canvas.addEventListener('pointerdown', function (e) {
        pointerStart = { x: e.clientX, y: e.clientY };
      });
      canvas.addEventListener('pointerup', function (e) {
        if (!pointerStart) return;
        var dx = e.clientX - pointerStart.x;
        var dy = e.clientY - pointerStart.y;
        pointerStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
          if (mode !== 'running') primary();
          return;
        }
        press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      });
      canvas.addEventListener('pointercancel', function () { pointerStart = null; });

      window.addEventListener('resize', function () { if (dialog.open) { resize(); draw(); } });
      return true;
    }

    function closeDialog() {
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else { dialog.removeAttribute('open'); pause(); stopLoop(); }
    }

    function open() {
      if (!bind()) return;
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      if (mode === 'running') mode = 'paused';
      resize();
      hud();
      draw();
    }

    /* ── Estado / loop ── */
    function setMode(m) { mode = m; hud(); }

    function start() {
      if (mode === 'over' || mode === 'won') game.reset();
      acc = 0;
      setMode('running');
      sfx('start');
      startLoop();
    }

    function pause() {
      if (mode === 'running') { setMode('paused'); draw(); }
    }

    function resume() {
      if (mode === 'paused') { setMode('running'); startLoop(); }
    }

    function primary() {
      if (mode === 'running') pause();
      else if (mode === 'paused') resume();
      else start();
    }

    function press(dir) {
      if (!DIRS[dir]) return;
      if (mode === 'ready' || mode === 'over' || mode === 'won') start();
      else if (mode === 'paused') resume();
      game.turn(dir);
    }

    function startLoop() {
      if (rafId) return;
      lastTs = 0;
      rafId = window.requestAnimationFrame(frame);
    }
    function stopLoop() {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function frame(ts) {
      rafId = 0;
      if (mode !== 'running') { draw(); return; }
      if (!lastTs) lastTs = ts;
      acc += Math.min(ts - lastTs, 250); // evita "espiral" após travadas
      lastTs = ts;
      var s = game.state();
      var step = stepMs(s.speedLevel, reduced());
      while (acc >= step && mode === 'running') {
        acc -= step;
        var before = s.score;
        s = game.tick();
        if (s.score > before) { sfx('eat'); step = stepMs(s.speedLevel, reduced()); }
        if (!s.alive) { gameOver(s); break; }
      }
      hud();
      draw();
      if (mode === 'running') rafId = window.requestAnimationFrame(frame);
    }

    function gameOver(s) {
      if (s.score > best) { best = s.score; writeBest(best); }
      setMode(s.won ? 'won' : 'over');
      sfx('die');
      if (!reduced() && screenEl) {
        screenEl.classList.remove('is-shake');
        void screenEl.offsetWidth; // reinicia a animação
        screenEl.classList.add('is-shake');
        screenEl.addEventListener('animationend', function done() {
          screenEl.classList.remove('is-shake');
          screenEl.removeEventListener('animationend', done);
        });
      }
    }

    function hud() {
      var s = game.state();
      if (scoreEl) scoreEl.textContent = String(s.score).padStart(3, '0');
      if (bestEl) bestEl.textContent = String(Math.max(best, s.score)).padStart(3, '0');
      if (statusEl) statusEl.textContent = STATUS[mode];
      if (dialog) dialog.setAttribute('data-mode', mode);
    }

    /* ── Render ── */
    function resize() {
      var rect = canvas.getBoundingClientRect();
      var css = Math.floor(Math.min(rect.width, rect.height || rect.width)) || canvas.width || 400;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      size = css;
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      if (!ctx || !dialog || !dialog.open) return;
      if (!size) resize();
      var s = game.state();
      var cell = size / s.cols;
      var yellow = cssVar('--hw-yellow', '#F5B700');
      var vermilion = cssVar('--hw-vermilion', '#E04F33');

      ctx.fillStyle = '#161616';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 1; i < s.cols; i++) {
        var p = Math.round(i * cell) + 0.5;
        ctx.moveTo(p, 0); ctx.lineTo(p, size);
        ctx.moveTo(0, p); ctx.lineTo(size, p);
      }
      ctx.stroke();

      if (s.food) {
        var pad = reduced() ? 0 : Math.sin(performance.now() / 180) * cell * 0.06;
        if (sprites.seed._ok) {
          ctx.drawImage(sprites.seed, s.food.x * cell - pad, s.food.y * cell - pad, cell + pad * 2, cell + pad * 2);
        } else {
          ctx.fillStyle = vermilion;
          ctx.fillRect(s.food.x * cell + cell * 0.25, s.food.y * cell + cell * 0.25, cell * 0.5, cell * 0.5);
        }
      }

      for (var j = s.snake.length - 1; j >= 1; j--) {
        var seg = s.snake[j];
        if (sprites.body._ok) ctx.drawImage(sprites.body, seg.x * cell, seg.y * cell, cell, cell);
        else {
          ctx.fillStyle = yellow;
          ctx.fillRect(seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2);
        }
      }

      var h = s.snake[0];
      var angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[s.dir];
      ctx.save();
      ctx.translate(h.x * cell + cell / 2, h.y * cell + cell / 2);
      ctx.rotate(angle);
      if (sprites.head._ok) ctx.drawImage(sprites.head, -cell / 2, -cell / 2, cell, cell);
      else {
        ctx.fillStyle = yellow;
        ctx.fillRect(-cell / 2 + 1, -cell / 2 + 1, cell - 2, cell - 2);
        ctx.fillStyle = '#161616';
        ctx.fillRect(cell * 0.1, -cell * 0.25, cell * 0.2, cell * 0.5);
      }
      ctx.restore();

      if (mode === 'over') {
        ctx.strokeStyle = vermilion;
        ctx.lineWidth = 2;
        ctx.strokeRect(h.x * cell + 1, h.y * cell + 1, cell - 2, cell - 2);
      }
      if (mode !== 'running') {
        ctx.fillStyle = 'rgba(22, 22, 22, 0.55)';
        ctx.fillRect(0, 0, size, size);
      }
    }

    /* ── Teclado global ── */
    function isEditable(el) {
      if (!el) return false;
      var tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    }

    document.addEventListener('keydown', function (e) {
      var key = (e.key || '').toLowerCase();
      var gameOpen = dialog && dialog.open;

      if (gameOpen) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (KEY_DIRS[key]) {
          e.preventDefault();
          press(KEY_DIRS[key]);
        } else if (key === ' ' || key === 'spacebar') {
          e.preventDefault();
          if (!e.repeat) primary();
        } else if (key === 'p') {
          e.preventDefault();
          if (mode === 'running') pause(); else if (mode === 'paused') resume();
        } else if (key === 'enter') {
          if (e.target && e.target.closest && e.target.closest('button')) return;
          e.preventDefault();
          if (mode !== 'running') primary();
        }
        return; // Escape: fechamento nativo do <dialog>
      }

      // Código Konami
      if (key === KONAMI[konamiPos]) {
        konamiPos++;
        if (konamiPos === KONAMI.length) { konamiPos = 0; open(); return; }
      } else {
        konamiPos = key === KONAMI[0] ? 1 : 0;
      }

      // Atalho "d"
      if (key === 'd' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
          !isEditable(e.target) && !isEditable(document.activeElement) &&
          !document.querySelector('dialog[open]')) {
        e.preventDefault();
        open();
      }
    });

    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-snake-open]') : null;
      if (t) { e.preventDefault(); open(); }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
    });

    return open;
  }
})(typeof window !== 'undefined' ? window : this);
