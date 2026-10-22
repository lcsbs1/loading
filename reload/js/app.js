(() => {
  'use strict';
  document.documentElement.classList.add('js');

  /* Obtém chaves e endpoints de js/config.js com fallback seguro */
  const RAWG_KEY = (typeof CONFIG !== 'undefined' && CONFIG.RAWG_KEY) ? CONFIG.RAWG_KEY : '';
  const API = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : 'https://api.rawg.io/api';
  const LS = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS) ? CONFIG.STORAGE_KEYS : {
    key: 'loading.rawgKey',
    topics: 'loading.topics',
    theme: 'loading.theme',
    featuredData: 'loading.featured.data',
    featuredTime: 'loading.featured.timestamp',
  };
  const PAGE_SIZE = (typeof CONFIG !== 'undefined' && CONFIG.PAGINATION && CONFIG.PAGINATION.pageSize) ? CONFIG.PAGINATION.pageSize : 9;
  const ENABLE_INFINITE_SCROLL = (typeof CONFIG !== 'undefined' && CONFIG.PAGINATION && typeof CONFIG.PAGINATION.infiniteScroll === 'boolean') ? CONFIG.PAGINATION.infiniteScroll : false;
  const PLAT_LABEL = (typeof CONFIG !== 'undefined' && CONFIG.PLATFORMS) ? CONFIG.PLATFORMS : {
    '': 'Todas', '1': 'PC', '2': 'PlayStation', '3': 'Xbox', '8': 'Nintendo',
  };

  const SEED = (typeof LOADING_DATA !== 'undefined' && LOADING_DATA.SEED) ? LOADING_DATA.SEED : [];
  const TRENDING_POOL = (typeof LOADING_DATA !== 'undefined' && LOADING_DATA.TRENDING_POOL) ? LOADING_DATA.TRENDING_POOL : [];

  const starsFromRating = rating => {
    const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    if (!n) return null;
    return { text: '★'.repeat(n) + '☆'.repeat(5 - n), label: `${n} de 5 estrelas` };
  };

  const updateMoreVisibility = () => {
    const show = Boolean(state.next) && !ENABLE_INFINITE_SCROLL;
    if (els.moreWrap) els.moreWrap.hidden = !show && !(ENABLE_INFINITE_SCROLL && state.next);
    if (els.more) {
      els.more.hidden = !show;
      if (show) els.more.textContent = 'CARREGAR MAIS CARTUCHOS';
    }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null) n.append(c);
    return n;
  };
  const year = d => (d ? String(d).slice(0, 4) : '—');
  const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const initials = name => name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ── Estado ── */
  const state = {
    key: localStorage.getItem(LS.key) || RAWG_KEY,
    query: '',
    platform: '',
    next: null,
    ctrl: null,
    current: null,
    backdropGame: SEED[0], // Zelda: Breath of the Wild por padrão no Slot Ativo
  };
  const knownGames = new Set([...SEED, ...TRENDING_POOL].map(g => g.name));
  const gameImageMap = new Map([...SEED, ...TRENDING_POOL].map(g => [g.name.toLowerCase(), g.image]));

  const els = {
    games: $('#games'),
    featured: $('#featured-games'),
    cycleBadge: $('#featured-cycle-badge'),
    status: $('#status'),
    more: $('#more'),
    moreWrap: $('#more-wrap'),
    infiniteLoader: $('#infinite-loader'),
    q: $('#q'),
    platforms: $('#platforms'),
    dlg: $('#game-dialog'),
    topics: $('#topics'),
    form: $('#topic-form'),
    fErr: $('#f-err'),
    forumQ: $('#forum-q'),
    gameList: $('#game-list'),
    themeBtn: $('#theme-btn'),
    heroImg: $('#hero-backdrop-img'),
    heroCreditBtn: $('#hero-credit-btn'),
    heroCreditName: $('#hero-credit-name'),
    heroCreditStudio: $('#hero-credit-studio'),
    heroMetaBadge: $('#hero-meta-badge'),
  };

  /* ── Tema manual (Claro padrão estilo Hardware Tátil & Bento, Escuro e Auto) ── */
  let themeIdx = 1; // Claro como padrão visual da Opção 2
  const urlTheme = new URLSearchParams(location.search).get('theme');
  const storedTheme = urlTheme || localStorage.getItem(LS.theme) || 'light';
  if (storedTheme === 'dark') {
    themeIdx = 2;
    document.documentElement.dataset.theme = 'dark';
  } else if (storedTheme === 'auto') {
    themeIdx = 0;
    delete document.documentElement.dataset.theme;
  } else {
    themeIdx = 1;
    document.documentElement.dataset.theme = 'light';
  }

  const updateThemeBtn = () => {
    const mode = ['AUTO', 'CLARO', 'ESCURO'][themeIdx];
    if (els.themeBtn) els.themeBtn.textContent = `TEMA: ${mode}`;
  };
  updateThemeBtn();
  els.themeBtn?.addEventListener('click', () => {
    themeIdx = (themeIdx + 1) % 3;
    if (themeIdx === 0) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem(LS.theme, 'auto');
    } else if (themeIdx === 1) {
      document.documentElement.dataset.theme = 'light';
      localStorage.setItem(LS.theme, 'light');
    } else {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem(LS.theme, 'dark');
    }
    updateThemeBtn();
  });

  /* ── Atalho de teclado CTRL+K para busca rápida ── */
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      els.q?.focus();
      els.q?.select();
    }
  });

  const setStatus = msg => {
    els.status.replaceChildren(msg);
  };

  /* ── Normalização ── */
  const fromRawg = g => {
    const hoverShot = (g.short_screenshots || []).find(s => s && s.image && s.image !== g.background_image);
    return {
      id: g.id, source: 'rawg', name: g.name, released: g.released, metacritic: g.metacritic, rating: g.rating,
      image: g.background_image,
      imageHover: hoverShot ? hoverShot.image : null,
      screenshots: (g.short_screenshots || []).map(s => s && s.image).filter(Boolean),
      platforms: (g.parent_platforms || []).map(p => p.platform.name),
      genres: (g.genres || []).map(x => (typeof I18N !== 'undefined' ? I18N.genre(x.name) : x.name)),
    };
  };

  /* ── Otimização de imagens RAWG ── */
  const rawgCrop = url => (url && url.startsWith('https://media.rawg.io/media/'))
    ? url.replace(/\/media\/(games|screenshots)\//, '/media/crop/600/400/$1/')
    : url;

  const rawgSize = (url, w) => (url && url.startsWith('https://media.rawg.io/media/') && !/\/media\/(crop|resize)\//.test(url))
    ? url.replace('https://media.rawg.io/media/', `https://media.rawg.io/media/resize/${w}/-/`)
    : url;

  /* ── Slot Ativo de Cartucho no Hero (Gameplay Preview) ── */
  function setHeroDeckGame(candidate) {
    if (!els.heroImg || !candidate) return;
    state.backdropGame = candidate;
    const backdropUrl = candidate.image || candidate.imageHover;
    if (backdropUrl && els.heroImg.src !== backdropUrl) {
      els.heroImg.src = backdropUrl;
      els.heroImg.alt = `Cena de ${candidate.name}`;
    }
    const yr = year(candidate.released);
    if (els.heroCreditName) {
      els.heroCreditName.textContent = candidate.name.toUpperCase();
    }
    if (els.heroCreditStudio) {
      const studio = (candidate.developers && candidate.developers[0]) || (candidate.platforms && candidate.platforms[0]) || 'ARCHIVE';
      els.heroCreditStudio.textContent = yr !== '—' ? `${studio.toUpperCase()} · ${yr}` : studio.toUpperCase();
    }
    if (els.heroMetaBadge) {
      els.heroMetaBadge.textContent = candidate.metacritic ? `META ${candidate.metacritic}` : 'ROM OK';
    }
  }

  function updateHeroBackdrop(list) {
    if (!els.heroImg || !list || !list.length) return;
    const candidate = list.find(g => g.name.includes('Zelda')) || list.find(g => g.imageHover || g.image) || list[0];
    if (candidate) setHeroDeckGame(candidate);
  }

  els.heroCreditBtn?.addEventListener('click', () => {
    if (state.backdropGame) openGame(state.backdropGame);
  });
  $('#hero-backdrop')?.addEventListener('click', () => {
    if (state.backdropGame) openGame(state.backdropGame);
  });

  /* ── Galeria auxiliar ── */
  const galleryOf = g => [...new Set([g.image, ...(g.screenshots || []), g.imageHover].filter(Boolean))];

  /* ── Cards de Pôster 2:3 ── */
  const cover = (g, isAboveFold = false) => {
    if (g.image) {
      const mainProps = {
        class: 'cover-img cover-img--main',
        src: rawgCrop(g.image),
        alt: `Capa de ${g.name}`,
        decoding: 'async',
        width: 400,
        height: 600,
      };
      if (!isAboveFold) mainProps.loading = 'lazy';

      const mainImg = h('img', mainProps);

      if (g.imageHover) {
        const hoverProps = {
          class: 'cover-img cover-img--hover',
          'data-src': rawgCrop(g.imageHover),
          alt: '',
          loading: 'lazy',
          decoding: 'async',
          width: 400,
          height: 600,
          'aria-hidden': 'true',
        };
        if (isAboveFold) hoverProps.fetchpriority = 'low';
        const hoverImg = h('img', hoverProps);
        return [mainImg, hoverImg];
      }
      return [mainImg];
    }
    return [h('span', { class: 'monogram', 'aria-hidden': 'true', text: initials(g.name) })];
  };

  const shortPlat = p => {
    const map = {
      'Apple Macintosh': 'Mac',
      'PlayStation': 'PS',
      'Commodore / Amiga': 'Amiga',
    };
    return map[p] || p;
  };

  const card = (g, isAboveFold = false) => {
    const shots = galleryOf(g).length;
    const shownPlats = g.platforms.slice(0, 2).map(p => h('span', { class: 'plat-tag', text: shortPlat(p) }));
    if (g.platforms.length > 2) {
      shownPlats.push(h('span', { class: 'plat-tag', text: `+${g.platforms.length - 2}` }));
    }

    const hudBadges = [
      shots > 1 ? h('span', { class: 'cover-count', 'aria-label': `${shots} fotos`, text: `▣ ${shots}` }) : null,
      g.metacritic ? h('span', { class: 'score', title: 'Metacritic', text: String(g.metacritic) }) : null,
    ].filter(Boolean);

    const btn = h('button', { class: 'card-hit', type: 'button', 'aria-haspopup': 'dialog', onclick: () => openGame(g) },
      h('div', { class: 'cover' }, cover(g, isAboveFold)),
      h('div', { class: 'card-hud-top' },
        h('span', { class: 'card-year', text: year(g.released) }),
        hudBadges.length ? h('div', { class: 'card-hud-badges' }, hudBadges) : null),
      h('div', { class: 'card-body' },
        shownPlats.length ? h('div', { class: 'card-platforms' }, shownPlats) : null,
        h('h3', { class: 'card-title', text: g.name }),
        h('div', { class: 'card-extra' },
          h('span', { class: 'card-genres', text: g.genres.length ? g.genres.slice(0, 2).join(' · ') : 'Explorar' }),
          h('span', { class: 'card-cta', 'aria-hidden': 'true', text: '★' }))));

    if (g.imageHover) {
      const loadHover = () => {
        const hoverImg = btn.querySelector('.cover-img--hover[data-src]');
        if (hoverImg) {
          hoverImg.src = hoverImg.dataset.src;
          hoverImg.removeAttribute('data-src');
        }
      };
      btn.addEventListener('pointerenter', loadHover, { once: true, passive: true });
      btn.addEventListener('focusin', loadHover, { once: true, passive: true });
    }
    if (isAboveFold) {
      btn.addEventListener('pointerenter', () => setHeroDeckGame(g), { passive: true });
      btn.addEventListener('focusin', () => setHeroDeckGame(g), { passive: true });
    }

    return h('li', { class: 'card' }, btn);
  };

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  function updateCycleBadge(daysLeft) {
    if (els.cycleBadge) {
      els.cycleBadge.textContent = `CICLO SEMANAL · RENOVAÇÃO EM ${daysLeft}D`;
      els.cycleBadge.setAttribute('title', `Seleção de jogos em alta no momento. Próxima rotação em ${daysLeft} dia(s).`);
    }
  }

  function getWeeklySeedGames() {
    const weekIdx = Math.floor(Date.now() / SEVEN_DAYS_MS);
    const total = TRENDING_POOL.length;
    const result = [];
    for (let i = 0; i < 6; i++) {
      const idx = (weekIdx * 2 + i) % total;
      result.push({ ...TRENDING_POOL[idx], source: 'seed' });
    }
    return result;
  }

  function renderFeaturedStrip(list) {
    if (!els.featured || !list.length) return;
    const topSix = list.slice(0, 6);
    const frag = document.createDocumentFragment();
    topSix.forEach(g => frag.append(card(g, true)));
    els.featured.replaceChildren(frag);
  }

  async function loadFeaturedTrending() {
    if (!els.featured) return;

    let cachedData = null;
    let savedTime = 0;

    try {
      const rawTime = localStorage.getItem(LS.featuredTime || 'loading.featured.timestamp');
      const rawData = localStorage.getItem(LS.featuredData || 'loading.featured.data');
      if (rawTime && rawData) {
        savedTime = parseInt(rawTime, 10);
        cachedData = JSON.parse(rawData);
      }
    } catch (_) {}

    const now = Date.now();
    const isCacheValid = cachedData && Array.isArray(cachedData) && cachedData.length >= 6 && (now - savedTime < SEVEN_DAYS_MS);

    if (isCacheValid) {
      const elapsedDays = Math.floor((now - savedTime) / (24 * 60 * 60 * 1000));
      const daysLeft = Math.max(1, 7 - elapsedDays);
      updateCycleBadge(daysLeft);
      renderFeaturedStrip(cachedData);
      updateHeroBackdrop(cachedData);
      return;
    }

    // Cache expirado ou ausente: buscar jogos do momento na RAWG ou rotacionar seed
    let trendingGames = null;

    if (state.key) {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const past120Str = new Date(now - 120 * 86400000).toISOString().slice(0, 10);
        const url = `${API}/games?key=${state.key}&dates=${past120Str},${todayStr}&ordering=-added&page_size=6`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.results && json.results.length >= 6) {
            trendingGames = json.results.map(fromRawg);
          }
        }
      } catch (_) {}
    }

    if (!trendingGames || trendingGames.length < 6) {
      trendingGames = getWeeklySeedGames();
    }

    try {
      localStorage.setItem(LS.featuredTime || 'loading.featured.timestamp', String(now));
      localStorage.setItem(LS.featuredData || 'loading.featured.data', JSON.stringify(trendingGames));
    } catch (_) {}

    updateCycleBadge(7);
    renderFeaturedStrip(trendingGames);
    updateHeroBackdrop(trendingGames);
  }

  /* ── Revelação suave de cards ao rolar a tela ── */
  const cardRevealIo = ('IntersectionObserver' in window)
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            cardRevealIo.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -40px 0px' })
    : null;

  const render = (list, append) => {
    const frag = document.createDocumentFragment();
    list.forEach((g, idx) => {
      const c = card(g, false);
      if (append) {
        c.classList.add('card--reveal');
        c.style.transitionDelay = `${(idx % 6) * 45}ms`;
        if (cardRevealIo) cardRevealIo.observe(c);
        else c.classList.add('in');
      }
      frag.append(c);
      knownGames.add(g.name);
      if (g.image) gameImageMap.set(g.name.toLowerCase(), g.image);
    });
    append ? els.games.append(frag) : els.games.replaceChildren(frag);
    if (!append && !state.query && !state.platform && list.length && !state.backdropGame) {
      updateHeroBackdrop(list);
    }
    refreshDatalist();
    renderTopics();
  };

  /* ── Carregamento ── */
  function loadSeed() {
    const q = state.query.toLowerCase();
    const platLabel = PLAT_LABEL[state.platform] || '';
    const list = SEED.filter(g => {
      if (q && !g.name.toLowerCase().includes(q)) return false;
      if (state.platform && platLabel && platLabel !== 'Todas') {
        const ok = (g.platforms || []).some(p => String(p).toLowerCase().includes(platLabel.toLowerCase()));
        if (!ok) return false;
      }
      return true;
    });
    state.next = null;
    render(list.map(g => ({ ...g, source: 'seed' })));
    updateMoreVisibility();
    if (els.infiniteLoader) els.infiniteLoader.hidden = true;
    const fact = $('#fact-count');
    if (fact) fact.textContent = String(SEED.length);
    const filters = [q && `busca “${state.query}”`, state.platform && platLabel !== 'Todas' && platLabel].filter(Boolean);
    setStatus(list.length
      ? (filters.length
          ? `${list.length} jogo${list.length > 1 ? 's' : ''} na curadoria local (${filters.join(' · ')}).`
          : 'Top 9 · Curadoria local (sem chave RAWG ou modo offline).')
      : 'Nenhum jogo encontrado com esses filtros. Tente outra plataforma ou limpe a busca.');
  }

  /* ── Cache de requisições RAWG (memória + sessionStorage) ── */
  const apiCache = new Map();
  const getCache = key => {
    if (apiCache.has(key)) return apiCache.get(key);
    try {
      const item = sessionStorage.getItem('rawg:' + key);
      if (item) {
        const parsed = JSON.parse(item);
        apiCache.set(key, parsed);
        return parsed;
      }
    } catch (_) {}
    return null;
  };
  const setCache = (key, val) => {
    apiCache.set(key, val);
    try {
      sessionStorage.setItem('rawg:' + key, JSON.stringify(val));
    } catch (_) {}
  };

  let loadingMore = false;
  async function loadGames(append = false) {
    if (!state.key) return loadSeed();
    if (append) {
      if (loadingMore || !state.next) return;
      loadingMore = true;
      if (ENABLE_INFINITE_SCROLL) {
        if (els.infiniteLoader) els.infiniteLoader.hidden = false;
      } else if (els.more) {
        els.more.textContent = 'Carregando…';
        els.more.disabled = true;
      }
    } else {
      state.ctrl?.abort();
      state.ctrl = new AbortController();
      setStatus('Carregando catálogo…');
      els.games.setAttribute('aria-busy', 'true');
    }

    let url;
    if (append && state.next) url = state.next;
    else {
      const p = new URLSearchParams({ key: state.key, page_size: String(PAGE_SIZE) });
      if (state.query) { p.set('search', state.query); p.set('search_precise', 'true'); }
      else p.set('ordering', '-added');
      if (state.platform) p.set('parent_platforms', state.platform);
      url = `${API}/games?${p}`;
    }

    try {
      let data = !append ? getCache(url) : null;
      if (!data) {
        const res = await fetch(url, { signal: append ? undefined : state.ctrl.signal });
        if (res.status === 401) throw Object.assign(new Error('key'), { code: 401 });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
        setCache(url, data);
      }
      state.next = data.next;
      render(data.results.map(fromRawg), append);
      updateMoreVisibility();
      setStatus(data.count
        ? (state.query || state.platform
            ? `${data.count.toLocaleString('pt-BR')} jogos encontrados${state.query ? ` para “${state.query}”` : ''}${state.platform ? ` · ${PLAT_LABEL[state.platform] || ''}` : ''}.`
            : `Top ${PAGE_SIZE} · Ordenados por popularidade na RAWG.`)
        : 'Nenhum jogo encontrado. Ajuste busca ou plataforma.');
      const fact = $('#fact-count');
      if (fact && !state.query && !state.platform) fact.textContent = data.count.toLocaleString('pt-BR');
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (!append) {
        loadSeed();
        setStatus('API indisponível ou sem chave. Exibindo curadoria local offline.');
      } else {
        setStatus('Não foi possível carregar mais jogos. Tente de novo.');
      }
    } finally {
      if (append) {
        loadingMore = false;
        if (ENABLE_INFINITE_SCROLL) {
          if (els.infiniteLoader) els.infiniteLoader.hidden = true;
        } else if (els.more) {
          els.more.disabled = false;
          updateMoreVisibility();
        }
      } else {
        els.games.removeAttribute('aria-busy');
      }
    }
  }

  /* ── Ficha do jogo ── */
  const spec = (k, v) => {
    if (!v || (Array.isArray(v) && !v.length)) return null;
    const val = v instanceof Node ? v : (Array.isArray(v) ? v.join(', ') : String(v));
    return h('div', {}, h('dt', { class: 'label', text: k }), h('dd', {}, val));
  };

  /* ── Descrição com suporte a tradução simultânea e revelação em cascata ── */
  function renderDescription(g, cascade = false) {
    const discussWrap = $('#g-discuss')?.parentElement;
    if (g.description == null || g.isLoadingDesc) {
      $('#g-desc').replaceChildren(h('p', { class: 'desc-loading', text: 'Carregando sinopse…' }));
      if (discussWrap) {
        discussWrap.hidden = true;
        discussWrap.classList.remove('cascade-item');
      }
      return;
    }

    if (!g.description) {
      $('#g-desc').replaceChildren(h('p', { class: 'muted', text: 'Sem sinopse disponível.' }));
      if (discussWrap) {
        discussWrap.hidden = false;
        discussWrap.classList.remove('cascade-item');
      }
      return;
    }

    const showTranslated = !!g.translatedDesc && !g.showOriginal;
    const activeText = showTranslated ? g.translatedDesc : g.description;
    let idx = 0;

    const paras = activeText.split(/\n{2,}/).map(t => h('p', {
      class: cascade ? 'cascade-item' : null,
      style: cascade ? `--i:${idx++}` : null,
      text: t.trim(),
    }));
    const kids = [...paras];

    if (g.translatedDesc) {
      const toggleBtn = h('button', {
        type: 'button',
        class: 'tr-toggle link',
        text: g.showOriginal ? 'Ver tradução em português' : 'Ver original em inglês',
        onclick: () => {
          g.showOriginal = !g.showOriginal;
          if (state.current === g) renderDescription(g, true);
        },
      });
      kids.push(h('div', {
        class: cascade ? 'tr-bar cascade-item' : 'tr-bar',
        style: cascade ? `--i:${idx++}` : null,
      },
        h('span', { class: 'label tr-note', text: showTranslated ? 'Traduzido automaticamente' : 'Texto original em inglês' }),
        h('span', { class: 'muted', 'aria-hidden': 'true', text: '·' }),
        toggleBtn
      ));
    }

    $('#g-desc').replaceChildren(...kids);

    if (discussWrap) {
      discussWrap.hidden = false;
      discussWrap.classList.remove('cascade-item');
      if (cascade) {
        void discussWrap.offsetWidth;
        discussWrap.style.setProperty('--i', String(idx));
        discussWrap.classList.add('cascade-item');
      } else {
        discussWrap.style.removeProperty('--i');
      }
    }
  }

  function fillSpecs(g) {
    $('#g-specs').replaceChildren(...[
      spec('Lançamento', fmtDate(g.released)),
      spec('Plataformas', g.platforms),
      spec('Gêneros', g.genres),
      spec('Desenvolvedor', g.developers),
      spec('Publicadora', g.publishers),
      spec('Metacritic', g.metacritic ? h('span', { class: 'spec-badge', text: String(g.metacritic) }) : null),
      spec('Nota RAWG', g.rating ? h('span', { class: 'spec-badge', text: `★ ${g.rating.toFixed(2)} / 5` }) : null),
      g.website ? h('div', {}, h('dt', { class: 'label', text: 'Site oficial' }),
        h('dd', {}, h('a', { class: 'link', href: g.website, rel: 'noopener', target: '_blank', text: new URL(g.website).hostname + ' ↗' }))) : null,
    ].filter(Boolean));
  }

  /* ── Galeria / carrossel da ficha ── */
  let gallery = null;

  function buildGallery(g, start = 0) {
    const root = $('#g-cover');
    const imgs = galleryOf(g);
    gallery = null;
    if (!imgs.length) {
      root.classList.remove('gallery');
      root.replaceChildren(...[].concat(cover(g)));
      return;
    }
    root.classList.add('gallery');

    const many = imgs.length > 1;
    let idx = 0;
    const slides = imgs.map((src, n) => h('img', {
      class: 'gallery-slide',
      alt: `${g.name} — imagem ${n + 1} de ${imgs.length}`,
      decoding: 'async',
      draggable: 'false',
      'data-src': rawgSize(src, 1280),
    }));
    const track = h('div', { class: 'gallery-track' }, slides);
    const count = many ? h('span', { class: 'gallery-count', 'aria-live': 'polite' }) : null;
    const progress = many ? h('span', { class: 'gallery-progress', 'aria-hidden': 'true' }) : null;
    const nav = (dir, label, glyph) => h('button', {
      class: `gallery-nav gallery-nav--${dir}`, type: 'button', 'aria-label': label, text: glyph,
      onclick: () => go(idx + (dir === 'next' ? 1 : -1)),
    });
    const stage = h('div', { class: 'gallery-stage', role: 'region', 'aria-roledescription': 'carrossel', 'aria-label': `Imagens de ${g.name}` },
      track,
      many ? nav('prev', 'Imagem anterior', '‹') : null,
      many ? nav('next', 'Próxima imagem', '›') : null,
      count, progress);
    const thumbs = many ? imgs.map((src, n) => h('button', {
      class: 'gallery-thumb', type: 'button', 'aria-label': `Ver imagem ${n + 1}`, onclick: () => go(n),
    }, h('img', { src: rawgCrop(src), alt: '', loading: 'lazy', decoding: 'async' }))) : [];
    const thumbsWrap = many ? h('div', {
      class: `gallery-thumbs ${imgs.length <= 6 ? 'gallery-thumbs--fit' : 'gallery-thumbs--scroll'}`,
      style: `--thumb-count: ${imgs.length};`,
      'data-count': String(imgs.length),
    }, thumbs) : null;
    root.replaceChildren(...[stage, thumbsWrap].filter(Boolean));

    const load = n => {
      const s = slides[(n + imgs.length) % imgs.length];
      if (s && s.dataset.src) { s.src = s.dataset.src; s.removeAttribute('data-src'); }
    };
    function go(n) {
      idx = (n + imgs.length) % imgs.length;
      track.style.transform = `translateX(-${idx * 100}%)`;
      [idx, idx + 1, idx - 1].forEach(load);
      if (count) count.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(imgs.length).padStart(2, '0')}`;
      if (progress) progress.style.width = `${((idx + 1) / imgs.length) * 100}%`;
      thumbs.forEach((t, k) => t.setAttribute('aria-current', String(k === idx)));
      const t = thumbs[idx];
      if (t && thumbsWrap) thumbsWrap.scrollTo({ left: t.offsetLeft - (thumbsWrap.clientWidth - t.clientWidth) / 2, behavior: 'smooth' });
    }

    /* Swipe / arrastar no stage */
    if (many) {
      let x0 = null;
      stage.addEventListener('pointerdown', e => { if (!e.target.closest('button')) x0 = e.clientX; });
      stage.addEventListener('pointerup', e => {
        if (x0 == null) return;
        const dx = e.clientX - x0; x0 = null;
        if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
      });
      stage.addEventListener('pointercancel', () => { x0 = null; });
    }

    gallery = { many, go, get idx() { return idx; } };
    go(Math.min(start, imgs.length - 1));
  }

  /* Busca o conjunto completo de screenshots do jogo (além das ~6 da listagem) */
  async function loadScreenshots(g) {
    if (g.source !== 'rawg' || g.shotsFetched || !state.key) return;
    g.shotsFetched = true;
    try {
      const res = await fetch(`${API}/games/${g.id}/screenshots?key=${encodeURIComponent(state.key)}&page_size=20`);
      if (!res.ok) return;
      const d = await res.json();
      const before = galleryOf(g).length;
      const extra = (d.results || []).filter(s => s && s.image && !s.is_deleted).map(s => s.image);
      g.screenshots = [...new Set([...(g.screenshots || []), ...extra])];
      if (state.current === g && galleryOf(g).length !== before) buildGallery(g, gallery ? gallery.idx : 0);
    } catch (_) {
      g.shotsFetched = false;
    }
  }

  els.dlg.addEventListener('keydown', e => {
    if (!gallery || !gallery.many || e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); gallery.go(gallery.idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); gallery.go(gallery.idx - 1); }
  });

  function fillDialog(g, cascade = false) {
    buildGallery(g);
    $('#g-title').textContent = g.name;
    $('#g-sub').textContent = [year(g.released), g.platforms.join(' · ')].filter(Boolean).join(' — ');
    fillSpecs(g);
    renderDescription(g, cascade);
  }

  async function openGame(g) {
    state.current = g;
    const dlgBody = $('.dlg-body', els.dlg);
    if (dlgBody) dlgBody.scrollTop = 0;
    loadScreenshots(g);

    const needsFetch = g.source === 'rawg' && g.description == null;
    const needsTranslate = g.source === 'rawg' && !g.translatedDesc && !g.translationAttempted && typeof I18N !== 'undefined';

    if (needsFetch || needsTranslate) {
      g.isLoadingDesc = true;
      fillDialog(g, false);
      els.dlg.showModal();

      try {
        if (needsFetch) {
          const res = await fetch(`${API}/games/${g.id}?key=${encodeURIComponent(state.key)}`);
          if (!res.ok) throw new Error();
          const d = await res.json();
          if (state.current !== g) return;
          const description = (d.description_raw || '').split(/\n\s*(Español|Русский|Deutsch|Français)\s*\n/)[0].trim();
          Object.assign(g, {
            description,
            developers: (d.developers || []).map(x => x.name),
            publishers: (d.publishers || []).map(x => x.name),
            genres: (d.genres && d.genres.length) ? d.genres.map(x => (typeof I18N !== 'undefined' ? I18N.genre(x.name) : x.name)) : g.genres,
            website: d.website || null,
            image: g.image || d.background_image,
          });
          if (state.current === g) fillSpecs(g);
        }

        if (g.description && !g.translatedDesc && typeof I18N !== 'undefined') {
          try {
            const tr = await I18N.text(g.id, g.description);
            if (tr && tr !== g.description) {
              g.translatedDesc = tr;
              g.showOriginal = false;
            }
          } catch (err) {
            console.warn('[I18N] Falha na tradução da descrição:', err);
          }
        }
        g.translationAttempted = true;
      } catch {
        g.isLoadingDesc = false;
        if (state.current === g) {
          $('#g-desc').replaceChildren(h('p', { class: 'muted', text: 'Não foi possível carregar a descrição.' }));
          const discussWrap = $('#g-discuss')?.parentElement;
          if (discussWrap) discussWrap.hidden = false;
        }
        return;
      }

      g.isLoadingDesc = false;
      if (state.current === g) renderDescription(g, true);
    } else {
      g.isLoadingDesc = false;
      fillDialog(g, true);
      els.dlg.showModal();
    }
  }

  $('#dlg-close').addEventListener('click', () => els.dlg.close());
  els.dlg.addEventListener('click', e => { if (e.target === els.dlg) els.dlg.close(); });
  $('#g-discuss').addEventListener('click', () => {
    els.dlg.close();
    $('#f-game').value = state.current?.name || '';
    $('#forum').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    $('#f-title').focus({ preventScroll: true });
  });

  /* ── Busca & filtros ── */
  const onSearch = debounce(() => { state.query = els.q.value.trim(); state.next = null; loadGames(); }, 350);
  els.q.addEventListener('input', onSearch);
  $('#search-form').addEventListener('submit', e => {
    e.preventDefault(); onSearch();
    $('#acervo').scrollIntoView({ behavior: 'smooth' });
  });
  if (els.platforms) {
    els.platforms.addEventListener('click', e => {
      const b = e.target.closest('button[data-p]');
      if (!b) return;
      els.platforms.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      state.platform = b.dataset.p; state.next = null; loadGames();
    });
  }
  els.more?.addEventListener('click', () => loadGames(true));

  /* ── Scroll Infinito Automático (ativável via CONFIG.PAGINATION.infiniteScroll em config.js) ── */
  if (ENABLE_INFINITE_SCROLL && 'IntersectionObserver' in window && els.moreWrap) {
    const infiniteScrollIo = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && state.next && !loadingMore && !els.games.hasAttribute('aria-busy')) {
        loadGames(true);
      }
    }, { rootMargin: '350px 0px' });
    infiniteScrollIo.observe(els.moreWrap);
  }

  /* ── Avaliações & Fórum local (localStorage; não sincroniza entre aparelhos) ── */
  const now = Date.now(), H = 3600e3;
  const SEED_TOPICS = [
    { id: 't1', pinned: true, author: 'Loading...', game: 'Elden Ring', title: 'Boas-vindas: compartilhe suas avaliações e listas',
      body: 'Abra a ficha de qualquer jogo no acervo e clique em “Publicar análise no fórum”.\nOs tópicos ficam só neste navegador (localStorage).', at: now - 72 * H, rating: 0, replies: [] },
    { id: 't2', author: 'ana_retro', game: 'Half-Life 2', title: 'Half-Life 2 ainda se sustenta em 2026?',
      body: 'Rejoguei no PC e a física continua impressionante. O ritmo de Ravenholm é o melhor da série pra mim.', at: now - 20 * H, rating: 5,
      replies: [{ author: 'gordon', body: 'Envelheceu muito bem. Os episódios valem a pena logo depois.', at: now - 18 * H }] },
    { id: 't3', author: 'lucas', game: 'Hollow Knight', title: 'Direção de arte impecável e mapa interconectado',
      body: 'A transição de Dirtmouth para Greenpath com a trilha de Christopher Larkin é um dos momentos mais marcantes dos jogos independentes.', at: now - 5 * H, rating: 5, replies: [] },
  ];
  const loadTopics = () => {
    try {
      const t = JSON.parse(localStorage.getItem(LS.topics));
      if (Array.isArray(t)) {
        t.forEach(item => {
          if (item && item.author === 'Reload') item.author = 'Loading...';
        });
        return t;
      }
    } catch {}
    return SEED_TOPICS;
  };
  let topics = loadTopics();
  const saveTopics = () => { try { localStorage.setItem(LS.topics, JSON.stringify(topics)); } catch {} };

  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  const ago = t => {
    const s = (t - Date.now()) / 1000;
    for (const [u, n] of [['year', 31536e3], ['month', 2592e3], ['day', 86400], ['hour', 3600], ['minute', 60]])
      if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
    return 'agora';
  };
  const clean = (s, max) => String(s || '').replace(/\s+\n/g, '\n').trim().slice(0, max);
  const lastActivity = t => Math.max(t.at, ...t.replies.map(r => r.at));

  function findPosterForGame(gameName) {
    if (!gameName) return null;
    const key = gameName.toLowerCase().trim();
    if (gameImageMap.has(key)) return gameImageMap.get(key);
    for (const [k, url] of gameImageMap.entries()) {
      if (k.includes(key) || key.includes(k)) return url;
    }
    return null;
  }

  function topicEl(t) {
    const replyForm = h('form', { class: 'reply-form', novalidate: true },
      h('label', { class: 'sr-only', for: `r-${t.id}`, text: `Responder a ${t.title}` }),
      h('textarea', { class: 'input', id: `r-${t.id}`, name: 'body', maxlength: '1000', required: true, placeholder: 'Comentar nesta avaliação…' }),
      h('div', {}, h('button', { class: 'btn', type: 'submit', text: 'Responder' })));
    replyForm.addEventListener('submit', e => {
      e.preventDefault();
      const field = replyForm.elements.body;
      const body = clean(field.value, 1000);
      if (body.length < 2) { field.focus(); return; }
      const author = clean($('#f-author').value, 40) || 'Anônimo';
      t.replies.push({ author, body, at: Date.now() });
      saveTopics(); renderTopics(t.id);
    });

    const n = t.replies.length;
    const gameLabel = t.game || 'Geral';
    const posterUrl = findPosterForGame(gameLabel);
    const posterNode = h('div', { class: 'topic-poster', 'aria-hidden': 'true' },
      posterUrl
        ? h('img', { src: rawgCrop(posterUrl), alt: '', loading: 'lazy', decoding: 'async', width: 68, height: 102 })
        : h('span', { class: 'monogram', text: initials(gameLabel) })
    );

    return h('article', { class: 'topic', id: `topic-${t.id}`, 'aria-labelledby': `th-${t.id}` },
      posterNode,
      h('div', { class: 'topic-content' },
        h('div', { class: 'topic-header' },
          h('span', { class: 'topic-game', text: `[${gameLabel.toUpperCase()}]` }),
          (() => {
            const stars = starsFromRating(t.rating);
            return stars ? h('span', { class: 'topic-stars', 'aria-label': stars.label, text: stars.text }) : null;
          })(),
          t.pinned ? h('span', { class: 'pin', text: 'Fixado' }) : null
        ),
        h('h3', { id: `th-${t.id}` }, t.title),
        h('p', { class: 'topic-meta' },
          h('span', { text: 'Avaliado por ' }),
          h('span', { class: 'topic-author', text: t.author }),
          h('span', { 'aria-hidden': 'true', text: '·' }),
          h('time', { datetime: new Date(t.at).toISOString(), text: ago(t.at) })
        ),
        h('p', { class: 'topic-body', text: t.body }),
        h('details', {},
          h('summary', { text: n ? `💬 ${n} comentário${n > 1 ? 's' : ''}` : '💬 Comentar' }),
          n ? h('ol', { class: 'replies' }, t.replies.map(r => h('li', { class: 'reply' },
            h('p', { class: 'label' }, `${r.author} · `, h('time', { datetime: new Date(r.at).toISOString(), text: ago(r.at) })),
            h('p', { text: r.body })))) : null,
          replyForm)
      )
    );
  }

  function renderTopics(openId) {
    const q = els.forumQ.value.trim().toLowerCase();
    const list = topics
      .filter(t => !q || [t.title, t.game, t.author, t.body].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || lastActivity(b) - lastActivity(a));
    els.topics.replaceChildren(...(list.length ? list.map(topicEl) : [h('p', { class: 'muted empty', text: 'Nenhuma avaliação encontrada.' })]));
    topics.forEach(t => t.game && knownGames.add(t.game));
    refreshDatalist();
    if (openId) {
      const d = $(`#topic-${openId} details`);
      if (d) { d.open = true; d.querySelector('summary').focus(); }
    }
  }

  let lastDatalistSize = 0;
  function refreshDatalist() {
    if (knownGames.size === lastDatalistSize) return;
    lastDatalistSize = knownGames.size;
    els.gameList.replaceChildren(...[...knownGames].sort().slice(0, 300).map(v => h('option', { value: v })));
  }

  els.forumQ.addEventListener('input', debounce(() => renderTopics(), 200));

  els.form.addEventListener('submit', e => {
    e.preventDefault();
    const f = els.form.elements;
    const title = clean(f.title.value, 120), body = clean(f.body.value, 2000);
    if (title.length < 4) { els.fErr.textContent = 'O título precisa de pelo menos 4 caracteres.'; f.title.setAttribute('aria-invalid', 'true'); f.title.focus(); return; }
    if (body.length < 10) { els.fErr.textContent = 'A avaliação precisa de pelo menos 10 caracteres.'; f.body.setAttribute('aria-invalid', 'true'); f.body.focus(); return; }
    f.title.removeAttribute('aria-invalid'); f.body.removeAttribute('aria-invalid');
    const ratingRaw = Number(f.rating?.value);
    const rating = Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? Math.round(ratingRaw) : 0;
    const t = { id: 'u' + Date.now().toString(36), author: clean(f.author.value, 40) || 'Anônimo', game: clean(f.game.value, 80) || 'Geral', title, body, rating, at: Date.now(), replies: [] };
    topics.unshift(t); saveTopics();
    f.title.value = ''; f.body.value = ''; f.game.value = '';
    if (f.rating) f.rating.value = '';
    els.fErr.textContent = 'Avaliação publicada neste navegador.';
    els.forumQ.value = '';
    renderTopics();
    $(`#topic-${t.id}`)?.scrollIntoView({ block: 'nearest' });
  });

  /* ── Navegação ativa no scroll ── */
  let scrollTicking = false;
  const navLinks = document.querySelectorAll('.site-nav a[href^="#"]');
  const trackedSections = ['inicio', 'lets-you', 'acervo', 'forum', 'manifesto'].map(id => document.getElementById(id)).filter(Boolean);

  function updateScrollEffects() {
    const scrollY = window.scrollY || window.pageYOffset;
    let activeId = '';
    for (const sec of trackedSections) {
      if (scrollY >= sec.offsetTop - 160) activeId = sec.id;
    }
    navLinks.forEach(a => {
      const target = a.getAttribute('href').slice(1);
      a.classList.toggle('active', target === activeId);
    });
    scrollTicking = false;
  }

  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(updateScrollEffects);
      scrollTicking = true;
    }
  }, { passive: true });

  /* ── Revelação suave ── */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(r => io.observe(r));
  } else reveals.forEach(r => r.classList.add('in'));

  $('#year').textContent = new Date().getFullYear();
  loadFeaturedTrending();
  renderTopics();
  loadGames();
  updateScrollEffects();
})();
