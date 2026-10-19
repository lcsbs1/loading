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
  };

  /* ── Acervo local (funciona sem chave/offline) ── */
  const SEED = [
    { id: 's1', name: 'The Legend of Zelda: Breath of the Wild', released: '2017-03-03', metacritic: 97, platforms: ['Nintendo'], genres: ['Ação', 'Aventura'], developers: ['Nintendo EPD'], publishers: ['Nintendo'], tags: [7],
      image: 'https://media.rawg.io/media/games/cc1/cc196a5ad763955d6532cdba236f730c.jpg',
      imageHover: 'https://media.rawg.io/media/screenshots/b77/b771adc0585c655f8a747d3160e5325a.jpg',
      description: 'Link desperta após cem anos em um Hyrule devastado e precisa derrotar Calamity Ganon. O mundo aberto pode ser explorado em qualquer ordem, com física e química que permitem resolver desafios de muitas formas.' },
    { id: 's2', name: 'Grand Theft Auto V', released: '2013-09-17', metacritic: 97, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Ação'], developers: ['Rockstar North'], publishers: ['Rockstar Games'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_32aa18ab3175e3002217862dd5917646d298ab6b.600x338.jpg',
      description: 'Três criminosos — Michael, Franklin e Trevor — cruzam caminhos em Los Santos, uma sátira da Califórnia contemporânea. Inclui o modo online GTA Online.' },
    { id: 's3', name: 'Elden Ring', released: '2022-02-25', metacritic: 96, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Ação', 'RPG'], developers: ['FromSoftware'], publishers: ['Bandai Namco Entertainment'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_943bf6fe62352757d9070c1d33e50b92fe8539f1.600x338.jpg',
      description: 'RPG de ação em mundo aberto nas Terras Intermédias, com construção de mundo em colaboração com George R. R. Martin. Combate exigente e liberdade de exploração.' },
    { id: 's4', name: 'Half-Life 2', released: '2004-11-16', metacritic: 96, platforms: ['PC', 'Xbox'], genres: ['Tiro'], developers: ['Valve'], publishers: ['Valve'], tags: [1, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/ss_47b4105b396de408cb8b6b4f358c69e5e2a62dae.600x338.jpg',
      description: 'Gordon Freeman retorna a uma Terra dominada pela Aliança em City 17. Referência em narrativa sem cortes e física interativa, com a Gravity Gun.' },
    { id: 's5', name: 'The Witcher 3: Wild Hunt', released: '2015-05-19', metacritic: 93, platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo'], genres: ['RPG'], developers: ['CD Projekt Red'], publishers: ['CD Projekt'], tags: [1, 2, 3, 7],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/f7f564ecedd09b3e503b071a637aeefdedbeedd8/ss_f7f564ecedd09b3e503b071a637aeefdedbeedd8.600x338.jpg',
      description: 'Geralt de Rívia procura Ciri, sua filha adotiva, perseguida pela Caçada Selvagem. Mundo aberto com missões secundárias de escrita marcante.' },
    { id: 's6', name: 'Red Dead Redemption 2', released: '2018-10-26', metacritic: 97, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Ação', 'Aventura'], developers: ['Rockstar Games'], publishers: ['Rockstar Games'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_66b553f4c209476d3e4ce25fa4714002cc914c4f.600x338.jpg',
      description: 'Em 1899, Arthur Morgan e a gangue de Dutch van der Linde fogem pelo oeste americano em declínio. Mundo aberto de grande densidade de detalhes.' },
    { id: 's7', name: 'Super Mario Odyssey', released: '2017-10-27', metacritic: 97, platforms: ['Nintendo'], genres: ['Plataforma'], developers: ['Nintendo EPD'], publishers: ['Nintendo'], tags: [7],
      image: 'https://media.rawg.io/media/games/267/267bd0dbc496f52692487d07d014c061.jpg',
      imageHover: 'https://media.rawg.io/media/screenshots/259/259c7b0d3a1e85f3339d07d0b65133e0.jpg',
      description: 'Mario viaja por reinos variados com Cappy, um chapéu capaz de capturar inimigos e objetos, para impedir o casamento de Bowser com Peach.' },
    { id: 's8', name: 'Minecraft', released: '2011-11-18', metacritic: 93, platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo'], genres: ['Sandbox', 'Sobrevivência'], developers: ['Mojang Studios'], publishers: ['Mojang Studios', 'Xbox Game Studios'], tags: [1, 2, 3, 7],
      image: 'https://media.rawg.io/media/games/b4e/b4e4c73d5aa4ec66bbf75375c4847a2b.jpg',
      imageHover: 'https://media.rawg.io/media/screenshots/324/32454b11adde40d87c046f310f0d710d.jpg',
      description: 'Mundo de blocos gerado proceduralmente para explorar, minerar e construir. Um dos jogos mais vendidos da história.' },
    { id: 's9', name: 'Portal 2', released: '2011-04-19', metacritic: 95, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Quebra-cabeça'], developers: ['Valve'], publishers: ['Valve'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_f3f6787d74739d3b2ec8a484b5c994b3d31ef325.600x338.jpg',
      description: 'Chell volta ao Aperture Science e enfrenta GLaDOS e Wheatley. Quebra-cabeças com portais, campanha solo e cooperativa.' },
    { id: 's10', name: 'Hollow Knight', released: '2017-02-24', metacritic: 87, platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo'], genres: ['Metroidvania'], developers: ['Team Cherry'], publishers: ['Team Cherry'], tags: [1, 2, 3, 7],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/367520/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/367520/ss_5384f9f8b96a0b9934b2bc35a4058376211636d2.600x338.jpg',
      description: 'Metroidvania desenhado à mão no reino arruinado de Hallownest. Exploração não linear e combate preciso.' },
    { id: 's11', name: 'God of War', released: '2018-04-20', metacritic: 94, platforms: ['PlayStation', 'PC'], genres: ['Ação'], developers: ['Santa Monica Studio'], publishers: ['Sony Interactive Entertainment'], tags: [2, 1],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_6eccc970b5de2943546d93d319be1b5c0618f21b.600x338.jpg',
      description: 'Kratos e seu filho Atreus viajam pelos reinos nórdicos para espalhar as cinzas da esposa do alto da montanha mais alta.' },
    { id: 's12', name: 'Sonic the Hedgehog', released: '1991-06-23', metacritic: null, platforms: ['SEGA'], genres: ['Plataforma'], developers: ['Sonic Team'], publishers: ['Sega'], tags: [11],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1794960/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1794960/ss_5c7a8a7c506fe2a0e606de768b291a5c24a2763f.600x338.jpg',
      description: 'Estreia do ouriço azul no Mega Drive: velocidade, loops e a luta contra o Dr. Robotnik pela Green Hill Zone e além.' },
  ];

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
  const state = { key: localStorage.getItem(LS.key) || RAWG_KEY, query: '', platform: '', next: null, ctrl: null, current: null };
  const knownGames = new Set(SEED.map(g => g.name));

  const els = {
    games: $('#games'), status: $('#status'), more: $('#more'), q: $('#q'), platforms: $('#platforms'),
    dlg: $('#game-dialog'), topics: $('#topics'), form: $('#topic-form'), fErr: $('#f-err'),
    forumQ: $('#forum-q'), gameList: $('#game-list'), themeBtn: $('#theme-btn'),
  };

  /* ── Tema manual (além do automático do sistema) ── */
  let themeIdx = 0;
  const urlTheme = new URLSearchParams(location.search).get('theme');
  const storedTheme = urlTheme || localStorage.getItem(LS.theme);
  if (storedTheme === 'light') { themeIdx = 1; document.documentElement.dataset.theme = 'light'; }
  else if (storedTheme === 'dark') { themeIdx = 2; document.documentElement.dataset.theme = 'dark'; }
  const updateThemeBtn = () => {
    const mode = ['Auto', 'Claro', 'Escuro'][themeIdx];
    if (els.themeBtn) els.themeBtn.textContent = `Tema: ${mode}`;
  };
  updateThemeBtn();
  els.themeBtn?.addEventListener('click', () => {
    themeIdx = (themeIdx + 1) % 3;
    if (themeIdx === 0) {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(LS.theme);
    } else if (themeIdx === 1) {
      document.documentElement.dataset.theme = 'light';
      localStorage.setItem(LS.theme, 'light');
    } else {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem(LS.theme, 'dark');
    }
    updateThemeBtn();
  });

  const setStatus = (msg, link) => {
    els.status.replaceChildren(msg);
    if (link) els.status.append(' ', h('a', { href: '#config', text: link }));
  };

  /* ── Normalização ── */
  const fromRawg = g => {
    const hoverShot = (g.short_screenshots || []).find(s => s && s.image && s.image !== g.background_image);
    return {
      id: g.id, source: 'rawg', name: g.name, released: g.released, metacritic: g.metacritic, rating: g.rating,
      image: g.background_image,
      imageHover: hoverShot ? hoverShot.image : null,
      platforms: (g.parent_platforms || []).map(p => p.platform.name),
      genres: (g.genres || []).map(x => (typeof I18N !== 'undefined' ? I18N.genre(x.name) : x.name)),
    };
  };

  /* ── Otimização de imagens RAWG ── */
  const rawgCrop = url => (url && url.startsWith('https://media.rawg.io/media/'))
    ? url.replace(/\/media\/(games|screenshots)\//, '/media/crop/600/400/$1/')
    : url;

  /* ── Cards ── */
  const cover = g => {
    if (g.image) {
      const mainImg = h('img', {
        class: 'cover-img cover-img--main',
        src: rawgCrop(g.image),
        alt: `Capa de ${g.name}`,
        loading: 'lazy',
        decoding: 'async',
        width: 600,
        height: 338,
      });

      if (g.imageHover) {
        const hoverImg = h('img', {
          class: 'cover-img cover-img--hover',
          'data-src': rawgCrop(g.imageHover),
          alt: '',
          loading: 'lazy',
          decoding: 'async',
          width: 600,
          height: 338,
          'aria-hidden': 'true',
        });
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

  const card = g => {
    const shownPlats = g.platforms.slice(0, 3).map(p => h('span', { class: 'plat-tag', text: shortPlat(p) }));
    if (g.platforms.length > 3) {
      shownPlats.push(h('span', { class: 'plat-tag', text: `+${g.platforms.length - 3}` }));
    }

    const btn = h('button', { class: 'card-hit', type: 'button', 'aria-haspopup': 'dialog', onclick: () => openGame(g) },
      h('div', { class: 'cover' }, cover(g)),
      h('div', { class: 'card-hud-top' },
        h('span', { class: 'card-year', text: year(g.released) }),
        g.metacritic ? h('span', { class: 'score', title: 'Metacritic', text: g.metacritic }) : null),
      h('div', { class: 'card-body' },
        shownPlats.length ? h('div', { class: 'card-platforms' }, shownPlats) : null,
        h('h3', { class: 'card-title', text: g.name }),
        h('div', { class: 'card-extra' },
          h('span', { class: 'card-genres', text: g.genres.length ? g.genres.slice(0, 2).join(' · ') : 'Explorar' }),
          h('span', { class: 'card-cta', 'aria-hidden': 'true', text: 'Ficha ↗' }))));

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

    return h('li', { class: 'card' }, btn);
  };

  const render = (list, append) => {
    const frag = document.createDocumentFragment();
    list.forEach(g => { frag.append(card(g)); knownGames.add(g.name); });
    append ? els.games.append(frag) : els.games.replaceChildren(frag);
    refreshDatalist();
  };

  /* ── Carregamento ── */
  function loadSeed() {
    const q = state.query.toLowerCase();
    const plats = state.platform ? state.platform.split(',').map(Number) : null;
    const list = SEED.filter(g => (!q || g.name.toLowerCase().includes(q)) && (!plats || g.tags.some(t => plats.includes(t))));
    render(list.map(g => ({ ...g, source: 'seed' })));
    els.more.hidden = true;
    $('#fact-count').textContent = '500 mil+';
    setStatus(list.length
      ? `Seleção local · ${list.length} jogo${list.length > 1 ? 's' : ''}.`
      : 'Nenhum jogo na seleção local.', 'Ative o acervo completo →');
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

  async function loadGames(append = false) {
    if (!state.key) return loadSeed();
    state.ctrl?.abort();
    state.ctrl = new AbortController();
    let url;
    if (append && state.next) url = state.next;
    else {
      const p = new URLSearchParams({ key: state.key, page_size: '12' });
      if (state.query) { p.set('search', state.query); p.set('search_precise', 'true'); }
      else p.set('ordering', '-added');
      if (state.platform) p.set('parent_platforms', state.platform);
      url = `${API}/games?${p}`;
    }
    setStatus('Carregando…');
    els.games.setAttribute('aria-busy', 'true');
    try {
      let data = !append ? getCache(url) : null;
      if (!data) {
        const res = await fetch(url, { signal: state.ctrl.signal });
        if (res.status === 401) throw Object.assign(new Error('key'), { code: 401 });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
        setCache(url, data);
      }
      state.next = data.next;
      render(data.results.map(fromRawg), append);
      els.more.hidden = !data.next;
      setStatus(data.count
        ? `${data.count.toLocaleString('pt-BR')} jogos encontrados${state.query ? ` para “${state.query}”` : ''}.`
        : 'Nenhum jogo encontrado.');
      if (!state.query && !state.platform) $('#fact-count').textContent = data.count.toLocaleString('pt-BR');
    } catch (e) {
      if (e.name === 'AbortError') return;
      loadSeed();
      setStatus(e.code === 401 ? 'Chave RAWG inválida. Mostrando a seleção local.' : 'Sem conexão com a RAWG. Mostrando a seleção local.', 'Verificar chave →');
    } finally {
      els.games.removeAttribute('aria-busy');
    }
  }

  /* ── Ficha do jogo ── */
  const spec = (k, v) => {
    if (!v || (Array.isArray(v) && !v.length)) return null;
    const val = v instanceof Node ? v : (Array.isArray(v) ? v.join(', ') : String(v));
    return h('div', {}, h('dt', { class: 'label', text: k }), h('dd', {}, val));
  };

  /* ── Descrição com suporte a tradução e alternância de idioma ── */
  function renderDescription(g) {
    if (g.description == null) {
      $('#g-desc').replaceChildren(h('p', { class: 'muted', text: 'Carregando descrição…' }));
      return;
    }
    if (!g.description) {
      $('#g-desc').replaceChildren(h('p', { class: 'muted', text: 'Sem descrição disponível.' }));
      return;
    }

    const showTranslated = !!g.translatedDesc && !g.showOriginal;
    const activeText = showTranslated ? g.translatedDesc : g.description;
    const paras = activeText.split(/\n{2,}/).map(t => h('p', { text: t.trim() }));
    const kids = [...paras];

    if (g.isTranslating) {
      kids.push(h('p', { class: 'label tr-note', text: 'Traduzindo para o português…' }));
    } else if (g.translatedDesc) {
      const toggleBtn = h('button', {
        type: 'button',
        class: 'tr-toggle link',
        text: g.showOriginal ? 'Ver tradução em português' : 'Ver original em inglês',
        onclick: () => {
          g.showOriginal = !g.showOriginal;
          if (state.current === g) renderDescription(g);
        },
      });
      kids.push(h('div', { class: 'tr-bar' },
        h('span', { class: 'label tr-note', text: showTranslated ? 'Traduzido automaticamente' : 'Texto original em inglês' }),
        h('span', { class: 'muted', 'aria-hidden': 'true', text: '·' }),
        toggleBtn
      ));
    }

    $('#g-desc').replaceChildren(...kids);
  }

  async function translateGameDesc(g) {
    if (!g.description || g.translatedDesc || g.source !== 'rawg' || typeof I18N === 'undefined') return;
    g.isTranslating = true;
    if (state.current === g) renderDescription(g);
    try {
      const res = await I18N.text(g.id, g.description);
      if (res && res !== g.description) {
        g.translatedDesc = res;
        g.showOriginal = false;
      }
    } catch (err) {
      console.warn('[I18N] Falha na tradução da descrição:', err);
    } finally {
      g.isTranslating = false;
      if (state.current === g) renderDescription(g);
    }
  }

  function fillDialog(g) {
    const dlgCover = g.image ? [h('img', { src: g.image, alt: `Imagem de ${g.name}`, decoding: 'async' })] : [].concat(cover(g));
    $('#g-cover').replaceChildren(...dlgCover);
    $('#g-title').textContent = g.name;
    $('#g-sub').textContent = [year(g.released), g.platforms.join(' · ')].filter(Boolean).join(' — ');
    $('#g-specs').replaceChildren(...[
      spec('Lançamento', fmtDate(g.released)),
      spec('Plataformas', g.platforms),
      spec('Gêneros', g.genres),
      spec('Desenvolvedor', g.developers),
      spec('Publicadora', g.publishers),
      spec('Metacritic', g.metacritic ? h('span', { class: 'spec-badge', text: String(g.metacritic) }) : null),
      spec('Nota RAWG', g.rating ? h('span', { class: 'spec-badge', text: `${g.rating.toFixed(2)} / 5` }) : null),
      g.website ? h('div', {}, h('dt', { class: 'label', text: 'Site oficial' }),
        h('dd', {}, h('a', { class: 'link', href: g.website, rel: 'noopener', target: '_blank', text: new URL(g.website).hostname + ' ↗' }))) : null,
    ].filter(Boolean));
    renderDescription(g);
  }

  async function openGame(g) {
    state.current = g;
    const base = (g.source === 'rawg' && g.description == null) ? { ...g, description: null } : g;
    fillDialog(base);
    els.dlg.showModal();

    if (g.source === 'rawg') {
      if (g.description == null) {
        try {
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
          fillDialog(g);
        } catch {
          if (state.current === g) $('#g-desc').replaceChildren(h('p', { class: 'muted', text: 'Não foi possível carregar a descrição.' }));
          return;
        }
      }
      translateGameDesc(g);
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
  els.platforms.addEventListener('click', e => {
    const b = e.target.closest('button[data-p]');
    if (!b) return;
    els.platforms.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    state.platform = b.dataset.p; state.next = null; loadGames();
  });
  els.more.addEventListener('click', () => loadGames(true));

  /* ── Chave ── */
  const keyInput = $('#api-key');
  keyInput.value = localStorage.getItem(LS.key) || '';
  $('#config').addEventListener('submit', e => {
    e.preventDefault();
    const v = keyInput.value.trim();
    if (!/^[a-f0-9]{32}$/i.test(v)) { $('#key-status').textContent = 'A chave RAWG tem 32 caracteres hexadecimais.'; return; }
    localStorage.setItem(LS.key, v); state.key = v;
    $('#key-status').textContent = 'Chave salva. Acervo completo ativado.';
    apiCache.clear();
    loadGames();
  });
  $('#key-clear').addEventListener('click', () => {
    localStorage.removeItem(LS.key); keyInput.value = ''; state.key = RAWG_KEY;
    $('#key-status').textContent = 'Chave removida.';
    apiCache.clear();
    loadGames();
  });

  /* ── Fórum ── */
  const now = Date.now(), H = 3600e3;
  const SEED_TOPICS = [
    { id: 't1', pinned: true, author: 'Loading...', game: 'Geral', title: 'Boas-vindas: como usar o fórum',
      body: 'Abra a ficha de qualquer jogo no acervo e use “Discutir no fórum” para criar um tópico já marcado com o jogo.\nSeja direto, cite a plataforma e evite spoilers no título.', at: now - 72 * H, replies: [] },
    { id: 't2', author: 'ana_retro', game: 'Half-Life 2', title: 'Half-Life 2 ainda se sustenta em 2026?',
      body: 'Rejoguei no PC e a física continua impressionante. O ritmo de Ravenholm é o melhor da série pra mim.', at: now - 20 * H,
      replies: [{ author: 'gordon', body: 'Envelheceu muito bem. Os episódios valem a pena logo depois.', at: now - 18 * H }] },
    { id: 't3', author: 'lucas', game: 'Hollow Knight', title: 'Ordem recomendada de áreas para iniciantes',
      body: 'Travei depois de Greenpath. Alguém tem uma sugestão de rota sem spoilers pesados?', at: now - 5 * H, replies: [] },
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

  function topicEl(t) {
    const replyForm = h('form', { class: 'reply-form', novalidate: true },
      h('label', { class: 'sr-only', for: `r-${t.id}`, text: `Responder a ${t.title}` }),
      h('textarea', { class: 'input', id: `r-${t.id}`, name: 'body', maxlength: '1000', required: true, placeholder: 'Sua resposta…' }),
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
    return h('article', { class: 'topic', id: `topic-${t.id}`, 'aria-labelledby': `th-${t.id}` },
      h('h3', { id: `th-${t.id}` }, t.pinned ? h('span', { class: 'pin', text: 'Fixado · ' }) : null, t.title),
      h('p', { class: 'label topic-meta' },
        h('span', { class: 'tag', text: t.game || 'Geral' }),
        h('span', { text: t.author }),
        h('time', { datetime: new Date(t.at).toISOString(), text: ago(t.at) })),
      h('p', { class: 'topic-body', text: t.body }),
      h('details', {},
        h('summary', { text: n ? `${n} resposta${n > 1 ? 's' : ''}` : 'Responder' }),
        n ? h('ol', { class: 'replies' }, t.replies.map(r => h('li', { class: 'reply' },
          h('p', { class: 'label' }, `${r.author} · `, h('time', { datetime: new Date(r.at).toISOString(), text: ago(r.at) })),
          h('p', { text: r.body })))) : null,
        replyForm));
  }

  function renderTopics(openId) {
    const q = els.forumQ.value.trim().toLowerCase();
    const list = topics
      .filter(t => !q || [t.title, t.game, t.author, t.body].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || lastActivity(b) - lastActivity(a));
    els.topics.replaceChildren(...(list.length ? list.map(topicEl) : [h('p', { class: 'muted empty', text: 'Nenhum tópico encontrado.' })]));
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
    if (body.length < 10) { els.fErr.textContent = 'A mensagem precisa de pelo menos 10 caracteres.'; f.body.setAttribute('aria-invalid', 'true'); f.body.focus(); return; }
    f.title.removeAttribute('aria-invalid'); f.body.removeAttribute('aria-invalid');
    const t = { id: 'u' + Date.now().toString(36), author: clean(f.author.value, 40) || 'Anônimo', game: clean(f.game.value, 80) || 'Geral', title, body, at: Date.now(), replies: [] };
    topics.unshift(t); saveTopics();
    f.title.value = ''; f.body.value = ''; f.game.value = '';
    els.fErr.textContent = 'Tópico publicado.';
    els.forumQ.value = '';
    renderTopics();
    $(`#topic-${t.id}`)?.scrollIntoView({ block: 'nearest' });
  });

  /* ── Animação de fundo e transição no scroll ── */
  let scrollTicking = false;
  let snakeEngine = null;
  const navLinks = document.querySelectorAll('.site-nav a[href^="#"]');
  const trackedSections = ['inicio', 'acervo', 'forum', 'manifesto'].map(id => document.getElementById(id)).filter(Boolean);

  function updateScrollEffects() {
    const scrollY = window.scrollY || window.pageYOffset;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const pct = Math.min(1, Math.max(0, scrollY / maxScroll));

    // Parallax suave na grade cósmica (módulo 48px para ciclo contínuo sem cortes)
    const offset = (-(scrollY * 0.22) % 48).toFixed(2);
    document.documentElement.style.setProperty('--scroll-offset', `${offset}px`);

    // Aura de iluminação acompanha suavemente a altura da rolagem
    const glowY = (10 + pct * 75).toFixed(1);
    document.documentElement.style.setProperty('--glow-pos', `${glowY}%`);

    // Destaque da seção ativa no menu
    let activeId = '';
    for (const sec of trackedSections) {
      if (scrollY >= sec.offsetTop - 140) activeId = sec.id;
    }
    navLinks.forEach(a => {
      const target = a.getAttribute('href').slice(1);
      a.classList.toggle('active', target === activeId);
    });

    // Sincroniza o motor da cobrinha com a rolagem e o deslocamento da grade
    if (snakeEngine) {
      snakeEngine.onScroll(pct, parseFloat(offset));
    }

    scrollTicking = false;
  }

  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(updateScrollEffects);
      scrollTicking = true;
    }
  }, { passive: true });
  updateScrollEffects();

  /* ───────── Jogo da Cobrinha (Background Snake Engine) ───────── */
  function initBackgroundSnake() {
    const canvas = document.getElementById('snake-canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const CELL_SIZE = 48; // Grid sincronizado com .bg-grid-plane
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 0;
    let height = 0;
    let dpr = 1;
    let scrollOffset = 0;
    let targetProgress = 0;
    let currentProgress = 0;
    let lastProgress = 0;
    let rAFId = null;

    // Carregador de Sprites (Paper / Higgsfield) com Fallback Vetorial Nativo
    const sprites = {
      head: new Image(),
      body: new Image(),
      seed: new Image(),
      loaded: { head: false, body: false, seed: false },
    };
    sprites.head.onload = () => { sprites.loaded.head = true; };
    sprites.body.onload = () => { sprites.loaded.body = true; };
    sprites.seed.onload = () => { sprites.loaded.seed = true; };
    sprites.head.src = 'assets/snake/head.svg';
    sprites.body.src = 'assets/snake/body.svg';
    sprites.seed.src = 'assets/snake/seed.svg';

    // Sistema de Partículas Minimalistas (Particle Burst)
    const particles = [];
    function triggerBurst(x, y, color) {
      for (let i = 0; i < 26; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 3,
          life: 1.0,
          decay: 0.02 + Math.random() * 0.025,
          color,
        });
      }
    }

    // Leitura Dinâmica das Variáveis CSS do Tema
    function getThemeColors() {
      const s = getComputedStyle(document.documentElement);
      return {
        accent: s.getPropertyValue('--accent').trim() || '#00F0FF',
        accentGlow: s.getPropertyValue('--accent-glow').trim() || 'rgba(0, 240, 255, 0.22)',
        fg: s.getPropertyValue('--fg').trim() || '#E6EDF3',
        line: s.getPropertyValue('--line').trim() || '#14171D',
      };
    }

    // Waypoints e Sementes nas 4 Seções (Acervo, Fórum, Manifesto)
    const waypoints = [
      { id: 'acervo', pct: 0.28, collected: false, x: 0, y: 0 },
      { id: 'forum', pct: 0.62, collected: false, x: 0, y: 0 },
      { id: 'manifesto', pct: 0.88, collected: false, x: 0, y: 0 },
    ];

    function calculateSectionPcts() {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const acervoEl = document.getElementById('acervo');
      const forumEl = document.getElementById('forum');
      const manifestoEl = document.getElementById('manifesto');

      if (acervoEl) waypoints[0].pct = Math.max(0.12, Math.min(0.42, (acervoEl.offsetTop - 140) / maxScroll));
      if (forumEl) waypoints[1].pct = Math.max(0.44, Math.min(0.74, (forumEl.offsetTop - 140) / maxScroll));
      if (manifestoEl) waypoints[2].pct = Math.max(0.76, Math.min(0.96, (manifestoEl.offsetTop - 140) / maxScroll));
    }

    // Geração do Caminho Ortogonal Rígido (curvas de 90° alinhadas a CELL_SIZE)
    let pathSegments = [];
    let totalPathLength = 0;

    function buildOrthogonalPath() {
      const cols = Math.max(6, Math.floor(width / CELL_SIZE));
      const rows = Math.max(6, Math.floor(height / CELL_SIZE));
      const maxC = Math.max(2, cols - 2);
      const maxR = Math.max(2, rows - 2);
      const c = (ratio) => Math.max(1, Math.min(maxC, Math.round(ratio * maxC)));
      const r = (ratio) => Math.max(1, Math.min(maxR, Math.round(ratio * maxR)));

      // Sequência de nós em coordenadas de grade ortogonal
      const gridNodes = [
        { c: c(0.08), r: r(0.06) },
        { c: c(0.85), r: r(0.06) },
        { c: c(0.85), r: r(0.22) },
        { c: c(0.18), r: r(0.22) },
        // Waypoint 1 (Acervo)
        { c: c(0.18), r: r(0.42) },
        { c: c(0.82), r: r(0.42) },
        { c: c(0.82), r: r(0.58) },
        // Waypoint 2 (Fórum)
        { c: c(0.14), r: r(0.58) },
        { c: c(0.14), r: r(0.76) },
        { c: c(0.8),  r: r(0.76) },
        // Waypoint 3 (Manifesto)
        { c: c(0.8),  r: r(0.88) },
        { c: c(0.22), r: r(0.88) },
        { c: c(0.22), r: r(0.96) },
        { c: c(0.88), r: r(0.96) },
      ];

      // Decompõe nós em pontos estritamente ortogonais (curvas 90°)
      const orthogonalPoints = [];
      for (let i = 0; i < gridNodes.length; i++) {
        const curr = gridNodes[i];
        if (i === 0) {
          orthogonalPoints.push({
            x: curr.c * CELL_SIZE + CELL_SIZE / 2,
            y: curr.r * CELL_SIZE + CELL_SIZE / 2,
          });
        } else {
          const prev = gridNodes[i - 1];
          if (curr.c !== prev.c && curr.r !== prev.r) {
            orthogonalPoints.push({
              x: curr.c * CELL_SIZE + CELL_SIZE / 2,
              y: prev.r * CELL_SIZE + CELL_SIZE / 2,
            });
          }
          orthogonalPoints.push({
            x: curr.c * CELL_SIZE + CELL_SIZE / 2,
            y: curr.r * CELL_SIZE + CELL_SIZE / 2,
          });
        }
      }

      // Constrói segmentos com comprimento cumulativo para amostragem contínua
      pathSegments = [];
      totalPathLength = 0;
      for (let i = 0; i < orthogonalPoints.length - 1; i++) {
        const p1 = orthogonalPoints[i];
        const p2 = orthogonalPoints[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          const angle = Math.atan2(dy, dx);
          pathSegments.push({
            p1,
            p2,
            length: len,
            startDist: totalPathLength,
            endDist: totalPathLength + len,
            angle,
          });
          totalPathLength += len;
        }
      }

      // Atualiza coordenadas físicas das sementes
      waypoints.forEach(w => {
        const d = w.pct * totalPathLength;
        const pt = samplePath(d);
        w.x = pt.x;
        w.y = pt.y;
      });
    }

    function samplePath(dist) {
      if (pathSegments.length === 0) return { x: 0, y: 0, angle: 0 };
      const d = Math.max(0, Math.min(totalPathLength, dist));
      for (let i = 0; i < pathSegments.length; i++) {
        const seg = pathSegments[i];
        if (d >= seg.startDist && d <= seg.endDist) {
          const t = seg.length > 0 ? (d - seg.startDist) / seg.length : 0;
          return {
            x: seg.p1.x + (seg.p2.x - seg.p1.x) * t,
            y: seg.p1.y + (seg.p2.y - seg.p1.y) * t,
            angle: seg.angle,
          };
        }
      }
      const lastSeg = pathSegments[pathSegments.length - 1];
      return { x: lastSeg.p2.x, y: lastSeg.p2.y, angle: lastSeg.angle };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      calculateSectionPcts();
      buildOrthogonalPath();
    }

    window.addEventListener('resize', debounce(resize, 150));
    resize();

    // Renderização da Cabeça (Chanfro 45° tipo .btn--accent + HUD Neon)
    function drawHead(x, y, angle, colors) {
      ctx.save();
      ctx.translate(x, y + scrollOffset);
      ctx.rotate(angle);

      if (sprites.loaded.head) {
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 14;
        ctx.drawImage(sprites.head, -24, -24, 48, 48);
        ctx.restore();
        return;
      }

      // Renderização Vetorial Nativa
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 14;

      // Casco principal chanfrado em 45°
      ctx.beginPath();
      ctx.moveTo(-16, -14);
      ctx.lineTo(8, -14);
      ctx.lineTo(18, -4);
      ctx.lineTo(18, 14);
      ctx.lineTo(-16, 14);
      ctx.closePath();

      ctx.fillStyle = '#040D14';
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.75;
      ctx.stroke();

      // Viseira cibernética
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(6, -8);
      ctx.lineTo(12, -2);
      ctx.lineTo(12, 4);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fillStyle = colors.accent;
      ctx.fill();

      // Mira holográfica / HUD
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, -18);
      ctx.lineTo(2, -14);
      ctx.moveTo(22, 6);
      ctx.lineTo(26, 6);
      ctx.stroke();

      ctx.restore();
    }

    // Renderização de Segmento Modular
    function drawSegment(x, y, angle, alpha, colors) {
      ctx.save();
      ctx.translate(x, y + scrollOffset);
      ctx.rotate(angle);
      ctx.globalAlpha = Math.max(0.12, Math.min(1.0, alpha));

      if (sprites.loaded.body) {
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 8 * alpha;
        ctx.drawImage(sprites.body, -20, -20, 40, 40);
        ctx.restore();
        return;
      }

      // Geometria chanfrada octogonal
      const s = 14;
      const c = 5;
      ctx.beginPath();
      ctx.moveTo(-s + c, -s);
      ctx.lineTo(s - c, -s);
      ctx.lineTo(s, -s + c);
      ctx.lineTo(s, s - c);
      ctx.lineTo(s - c, s);
      ctx.lineTo(-s + c, s);
      ctx.lineTo(-s, s - c);
      ctx.lineTo(-s, -s + c);
      ctx.closePath();

      ctx.fillStyle = '#030A10';
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.25;
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 8 * alpha;
      ctx.stroke();

      // Núcleo de energia interno
      ctx.fillStyle = colors.accent;
      ctx.fillRect(-3, -3, 6, 6);

      ctx.restore();
    }

    // Renderização de Semente / Cubo de Energia
    function drawSeed(seed, time, colors) {
      ctx.save();
      ctx.translate(seed.x, seed.y + scrollOffset);

      const pulse = 1 + 0.15 * Math.sin(time * 0.005);
      const rot = (time * 0.001) % (Math.PI * 2);

      if (sprites.loaded.seed) {
        ctx.shadowColor = colors.accent;
        ctx.shadowBlur = 18 * pulse;
        ctx.scale(pulse, pulse);
        ctx.drawImage(sprites.seed, -24, -24, 48, 48);
        ctx.restore();
        return;
      }

      // Anel rotativo de contenção
      ctx.save();
      ctx.rotate(rot);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(-16, -16, 32, 32);
      ctx.restore();

      // Cubo de energia ciano pulsante em 45°
      ctx.save();
      ctx.rotate(Math.PI / 4);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 16;
      ctx.fillStyle = colors.accent;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();

      // Ponto quântico central
      ctx.fillStyle = colors.fg;
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Loop Principal de Animação com Lerp
    function render(time) {
      if (reducedMotionQuery.matches) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      // Lerp Suavizado do Scroll: currentProgress += (targetScrollPct - currentProgress) * 0.08
      currentProgress += (targetProgress - currentProgress) * 0.08;

      ctx.clearRect(0, 0, width, height);
      const colors = getThemeColors();

      // Atualiza estado das sementes e dispara particle burst ao atingir waypoint
      let eatenCount = 0;
      waypoints.forEach(w => {
        const wasCollected = w.collected;
        if (currentProgress >= w.pct) {
          w.collected = true;
          eatenCount++;
          if (!wasCollected && lastProgress < w.pct) {
            triggerBurst(w.x, w.y + scrollOffset, colors.accent);
          }
        } else {
          // Reversibilidade: devolve a semente ao rolar para cima
          w.collected = false;
        }
      });
      lastProgress = currentProgress;

      // Desenha sementes ativas (não coletadas)
      waypoints.forEach(w => {
        if (!w.collected) {
          drawSeed(w, time, colors);
        }
      });

      // Crescimento: 4 segmentos base + 3 por semente consumida
      const numSegments = 4 + eatenCount * 3;
      const headDist = currentProgress * totalPathLength;
      const headPt = samplePath(headDist);

      // Traçado sutil do caminho da cobrinha (guia cinético)
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < pathSegments.length; i++) {
        const s = pathSegments[i];
        if (i === 0) ctx.moveTo(s.p1.x, s.p1.y + scrollOffset);
        ctx.lineTo(s.p2.x, s.p2.y + scrollOffset);
      }
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.stroke();
      ctx.restore();

      // Desenha segmentos do corpo (da cauda para o pescoço com gradiente de opacidade)
      const SEG_SPACING = 30;
      for (let i = numSegments; i >= 1; i--) {
        const segDist = headDist - i * SEG_SPACING;
        if (segDist >= 0) {
          const pt = samplePath(segDist);
          const alpha = 0.95 * Math.pow(1 - i / (numSegments + 1), 0.6) + 0.15;
          drawSegment(pt.x, pt.y, pt.angle, alpha, colors);
        }
      }

      // Desenha a cabeça
      drawHead(headPt.x, headPt.y, headPt.angle, colors);

      // Atualiza e renderiza partículas
      if (particles.length > 0) {
        ctx.save();
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.life -= p.decay;

          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.restore();
      }

      rAFId = requestAnimationFrame(render);
    }

    rAFId = requestAnimationFrame(render);

    reducedMotionQuery.addEventListener('change', e => {
      if (e.matches) {
        if (rAFId) cancelAnimationFrame(rAFId);
        ctx.clearRect(0, 0, width, height);
      } else {
        rAFId = requestAnimationFrame(render);
      }
    });

    return {
      onScroll(pct, offset) {
        targetProgress = pct;
        scrollOffset = offset;
      },
      recalculate() {
        calculateSectionPcts();
        buildOrthogonalPath();
      },
    };
  }

  /* ── Revelação suave ── */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(r => io.observe(r));
  } else reveals.forEach(r => r.classList.add('in'));

  $('#year').textContent = new Date().getFullYear();
  renderTopics();
  loadGames();
  snakeEngine = initBackgroundSnake();
  updateScrollEffects();
})();
