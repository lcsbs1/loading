(() => {
  'use strict';
  document.documentElement.classList.add('js');

  /* Catálogo passa pelo proxy /api/rawg. A chave da RAWG não fica no browser. */
  const API = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '/api/rawg';
  const LS = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS) ? CONFIG.STORAGE_KEYS : {
    key: 'loading.rawgKey',
    theme: 'loading.theme',
    featuredData: 'loading.featured.data',
    featuredTime: 'loading.featured.timestamp',
  };

  const getSb = () => (typeof LoadingSupabase !== 'undefined' ? LoadingSupabase.getClient() : null);

  let authSessionUser = null;

  function displayNameOf(user) {
    if (!user) return '';
    return user.displayName || user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || (user.email ? user.email.split('@')[0] : 'membro');
  }

  function mapProfileUser(profile, authUser) {
    if (!authUser) return null;
    const firstName = profile?.first_name || authUser.user_metadata?.first_name || '';
    const lastName = profile?.last_name || authUser.user_metadata?.last_name || '';
    const displayName = profile?.display_name || [firstName, lastName].filter(Boolean).join(' ') || (authUser.email || '').split('@')[0] || 'membro';
    return {
      id: authUser.id,
      email: authUser.email || '',
      firstName,
      lastName,
      name: displayName,
      displayName,
      createdAt: profile?.created_at || authUser.created_at || null,
    };
  }

  async function fetchProfileFor(authUser) {
    const sb = getSb();
    if (!sb || !authUser) return mapProfileUser(null, authUser);
    const { data } = await sb.from('profiles').select('id, first_name, last_name, display_name, created_at').eq('id', authUser.id).maybeSingle();
    return mapProfileUser(data, authUser);
  }

  function requireAuth(message) {
    if (authSessionUser) return true;
    if (message) {
      const err = $('#f-err');
      const fb = $('#fb-status');
      if (err) err.textContent = message;
      if (fb) {
        fb.textContent = message;
        fb.className = 'status feedback-status is-error';
      }
    }
    window.location.hash = '#auth';
    return false;
  }

  function syncAuthorDisplays() {
    const label = authSessionUser ? displayNameOf(authSessionUser) : 'Faça login para publicar';
    const fDisp = $('#f-author-display');
    const fbDisp = $('#fb-author-display');
    if (fDisp) fDisp.value = label;
    if (fbDisp) fbDisp.value = authSessionUser ? label : 'Faça login para enviar';
    const hint = $('#forum-auth-hint');
    if (hint) hint.hidden = Boolean(authSessionUser);
  }
  const PAGE_SIZE = (typeof CONFIG !== 'undefined' && CONFIG.PAGINATION && CONFIG.PAGINATION.pageSize) ? CONFIG.PAGINATION.pageSize : 15;
  const ENABLE_INFINITE_SCROLL = (typeof CONFIG !== 'undefined' && CONFIG.PAGINATION && typeof CONFIG.PAGINATION.infiniteScroll === 'boolean') ? CONFIG.PAGINATION.infiniteScroll : false;

  /* ── Acervo local (funciona sem chave/offline) ── */
  const SEED = [
    { id: 's1', name: 'Grand Theft Auto V', released: '2013-09-17', metacritic: 97, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Ação'], developers: ['Rockstar North'], publishers: ['Rockstar Games'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_32aa18ab3175e3002217862dd5917646d298ab6b.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_8e70908c6a61fb232c45163b9ef77366d2146908.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_7be5bc656fc384ccad3d9c84e27f12e2df5ef79b.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_32aa18ab3175e3002217862dd5917646d298ab6b.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_6919a3b83c483a91b269ecfae15f6ee48cfb17d9.600x338.jpg"],
      description: 'Três criminosos — Michael, Franklin e Trevor — cruzam caminhos em Los Santos, uma sátira da Califórnia contemporânea. Inclui o modo online GTA Online.' },
    { id: 's2', name: 'The Witcher 3: Wild Hunt', released: '2015-05-19', metacritic: 93, platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo'], genres: ['RPG'], developers: ['CD Projekt Red'], publishers: ['CD Projekt'], tags: [1, 2, 3, 7],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/f7f564ecedd09b3e503b071a637aeefdedbeedd8/ss_f7f564ecedd09b3e503b071a637aeefdedbeedd8.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_107600c1337231660f50f52ba71477c3c66b2d00.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_8e762c2f42a0f8bfd463d1cb53f1f7e0bc27e3cc.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_75e01c0db721d7b0559eb431a478330ee0f4c084.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_c7df0e4d084eeec286dbdb9db8a7ba1e78687258.600x338.jpg"],
      description: 'Geralt de Rívia procura Ciri, sua filha adotiva, perseguida pela Caçada Selvagem. Mundo aberto com missões secundárias de escrita marcante.' },
    { id: 's3', name: 'Portal 2', released: '2011-04-19', metacritic: 95, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Quebra-cabeça'], developers: ['Valve'], publishers: ['Valve'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_f3f6787d74739d3b2ec8a484b5c994b3d31ef325.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_6a12b670d80c6534608db1426477e68c8b417e3f.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_bb936453664fa41a9d5926ecdbd0c722aebbe39c.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_3ab634c05cc7fef7bca458f2d5733d9942a00c63.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_f3f6787d74739d3b2ec8a484b5c994b3d31ef325.600x338.jpg"],
      description: 'Chell volta ao Aperture Science e enfrenta GLaDOS e Wheatley. Quebra-cabeças com portais, campanha solo e cooperativa.' },
    { id: 's4', name: 'Red Dead Redemption 2', released: '2018-10-26', metacritic: 97, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Ação', 'Aventura'], developers: ['Rockstar Games'], publishers: ['Rockstar Games'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_66b553f4c209476d3e4ce25fa4714002cc914c4f.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_fb2896fd2cf1cb82c5a1ecba840dd67ec927b2e3.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_f8df2d475ef21e6be794c4ec9d924045f86ce5b1.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_495ee8cbe7bbcf156dd3d61b6c006437d042ec7d.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_66b553f4c209476d3e4ce25fa4714002cc914c4f.600x338.jpg"],
      description: 'Em 1899, Arthur Morgan e a gangue de Dutch van der Linde fogem pelo oeste americano em declínio. Mundo aberto de grande densidade de detalhes.' },
    { id: 's5', name: 'The Legend of Zelda: Breath of the Wild', released: '2017-03-03', metacritic: 97, platforms: ['Nintendo'], genres: ['Ação', 'Aventura'], developers: ['Nintendo EPD'], publishers: ['Nintendo'], tags: [7],
      image: 'https://media.rawg.io/media/games/cc1/cc196a5ad763955d6532cdba236f730c.jpg',
      imageHover: 'https://media.rawg.io/media/screenshots/b77/b771adc0585c655f8a747d3160e5325a.jpg',
      screenshots: ["https://media.rawg.io/media/screenshots/b77/b771adc0585c655f8a747d3160e5325a.jpg","https://media.rawg.io/media/screenshots/f0d/f0da59e38ffc15b94236b2f7632ce60a.jpg","https://media.rawg.io/media/screenshots/a03/a037b5d13481eec647a40ca13dfc7bb6.jpg","https://media.rawg.io/media/screenshots/d0f/d0f2f3f9828551faaa6573c98894dfc1.jpg"],
      description: 'Link desperta após cem anos em um Hyrule devastado e precisa derrotar Calamity Ganon. O mundo aberto pode ser explorado em qualquer ordem, com física e química que permitem resolver desafios de muitas formas.' },
    { id: 's6', name: 'Elden Ring', released: '2022-02-25', metacritic: 96, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Ação', 'RPG'], developers: ['FromSoftware'], publishers: ['Bandai Namco Entertainment'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_943bf6fe62352757d9070c1d33e50b92fe8539f1.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_d397c88b90c05763a83f983a54b3834da465bf19.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_5471d2b78d21dfbc28e1d5300f898308bf3f6da2.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_3d98eb6c2f7ff0d0ea37ca3ff7b7194f4a38ff6a.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_943bf6fe62352757d9070c1d33e50b92fe8539f1.600x338.jpg"],
      description: 'RPG de ação em mundo aberto nas Terras Intermédias, com construção de mundo em colaboração com George R. R. Martin. Combate exigente e liberdade de exploração.' },
    { id: 's7', name: 'Half-Life 2', released: '2004-11-16', metacritic: 96, platforms: ['PC', 'Xbox'], genres: ['Tiro'], developers: ['Valve'], publishers: ['Valve'], tags: [1, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/ss_47b4105b396de408cb8b6b4f358c69e5e2a62dae.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/ss_6e91ea6b6777f98fb9787e91d58ebc760d40e94e.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/ss_3bfb098fbdd779ec4ea6ae9d8f8a846f48356f14.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/ss_1c69025e17a4198ee67b57b988f5bfcfba7a0d84.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/ss_47b4105b396de408cb8b6b4f358c69e5e2a62dae.600x338.jpg"],
      description: 'Gordon Freeman retorna a uma Terra dominada pela Aliança em City 17. Referência em narrativa sem cortes e física interativa, com a Gravity Gun.' },
    { id: 's8', name: 'Minecraft', released: '2011-11-18', metacritic: 93, platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo'], genres: ['Sandbox', 'Sobrevivência'], developers: ['Mojang Studios'], publishers: ['Mojang Studios', 'Xbox Game Studios'], tags: [1, 2, 3, 7],
      image: 'https://media.rawg.io/media/games/b4e/b4e4c73d5aa4ec66bbf75375c4847a2b.jpg',
      imageHover: 'https://media.rawg.io/media/screenshots/324/32454b11adde40d87c046f310f0d710d.jpg',
      screenshots: ["https://media.rawg.io/media/screenshots/324/32454b11adde40d87c046f310f0d710d.jpg","https://media.rawg.io/media/screenshots/b93/b9354784a08fd5357876a4a4087dfcfc.jpg","https://media.rawg.io/media/screenshots/f60/f6004abfb72837ff44ebfd588ff1ceb7.jpg","https://media.rawg.io/media/screenshots/36f/36fa18aa95a707a01c40b6e927027d14.jpg"],
      description: 'Mundo de blocos gerado proceduralmente para explorar, minerar e construir. Um dos jogos mais vendidos da história.' },
    { id: 's9', name: 'God of War', released: '2018-04-20', metacritic: 94, platforms: ['PlayStation', 'PC'], genres: ['Ação'], developers: ['Santa Monica Studio'], publishers: ['Sony Interactive Entertainment'], tags: [2, 1],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_6eccc970b5de2943546d93d319be1b5c0618f21b.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_3a8b444747ebc63833b5220c324c4e7ab91136b3.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_96e838f38bbd1945f3be4b563cb9671dbb065a28.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_3c0be8d5272a71d8717cfa8ebfc91c28b6d859a7.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_6eccc970b5de2943546d93d319be1b5c0618f21b.600x338.jpg"],
      description: 'Kratos e seu filho Atreus viajam pelos reinos nórdicos para espalhar as cinzas da esposa do alto da montanha mais alta.' },
  ];

  /* ── Pool de Jogos em Alta no Momento (Rotação Semanal de 7 Dias) ── */
  const TRENDING_POOL = [
    { id: 't1', name: 'Counter-Strike 2', released: '2023-09-27', metacritic: 82, platforms: ['PC'], genres: ['Tiro'], developers: ['Valve'], publishers: ['Valve'], tags: [1],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_e15a9ff866ec8f51a89c3db6f8ab51a80c98f8b8.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_95ecce886a1170aa5a48d88e09f583aa1e8f533a.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_e15a9ff866ec8f51a89c3db6f8ab51a80c98f8b8.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_a599292c3066324d9c7336cecfdb325dfd6efdf8.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_d8c47eb5cf77a28e93899532fe5ba60195ec47ee.600x338.jpg"],
      description: 'Maior jogo de tiro tático em primeira pessoa do mundo, com nova engine Source 2, física de fumaça volumétrica responsiva e taxa de tique sub-tick.' },
    { id: 't2', name: 'Elden Ring', released: '2022-02-25', metacritic: 96, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Ação', 'RPG'], developers: ['FromSoftware'], publishers: ['Bandai Namco Entertainment'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_943bf6fe62352757d9070c1d33e50b92fe8539f1.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_d397c88b90c05763a83f983a54b3834da465bf19.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_5471d2b78d21dfbc28e1d5300f898308bf3f6da2.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_3d98eb6c2f7ff0d0ea37ca3ff7b7194f4a38ff6a.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/ss_943bf6fe62352757d9070c1d33e50b92fe8539f1.600x338.jpg"],
      description: 'RPG de ação em mundo aberto nas Terras Intermédias com expansão recente Shadow of the Erdtree, mantendo recordes de jogadores simultâneos.' },
    { id: 't3', name: 'Cyberpunk 2077', released: '2020-12-10', metacritic: 86, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['RPG', 'Ação'], developers: ['CD Projekt Red'], publishers: ['CD Projekt'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_ff63f82fcdd82f256086f6eb8035850ab85aeeb8.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_bf5df18e38d06ee29f44f51e0ff05e60d2e85a6a.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_7e937d94cf75f34cf33db6ef9ec23f3640243403.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_6db033a8e4df4c1851e504cf66672c723f982181.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_ff63f82fcdd82f256086f6eb8035850ab85aeeb8.600x338.jpg"],
      description: 'RPG de ação futurista em Night City, totalmente revitalizado com a atualização 2.0 e expansão Phantom Liberty.' },
    { id: 't4', name: 'Baldur\'s Gate 3', released: '2023-08-03', metacritic: 96, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['RPG', 'Estratégia'], developers: ['Larian Studios'], publishers: ['Larian Studios'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_d6dd85785f75c4046d3e81ad8fec3b59b02a98e3.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_16315ecbe5e6382069cc88a6d4ee292215c2cebb.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_a39fc4159501a35794833dd72464b0f94605e554.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_bf13b5d275ceea158971f112e8cb769a91702e7a.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_d6dd85785f75c4046d3e81ad8fec3b59b02a98e3.600x338.jpg"],
      description: 'RPG premiado no universo de Dungeons & Dragons com liberdade sem precedentes, narrativa ramificada e combate tático profundo.' },
    { id: 't5', name: 'Grand Theft Auto V', released: '2013-09-17', metacritic: 97, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Ação'], developers: ['Rockstar North'], publishers: ['Rockstar Games'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_32aa18ab3175e3002217862dd5917646d298ab6b.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_8e70908c6a61fb232c45163b9ef77366d2146908.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_7be5bc656fc384ccad3d9c84e27f12e2df5ef79b.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_32aa18ab3175e3002217862dd5917646d298ab6b.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/ss_6919a3b83c483a91b269ecfae15f6ee48cfb17d9.600x338.jpg"],
      description: 'Fenômeno constante de audiência e jogadores ativos em Los Santos e GTA Online com atualizações de conteúdo frequentes.' },
    { id: 't6', name: 'The Witcher 3: Wild Hunt', released: '2015-05-19', metacritic: 93, platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo'], genres: ['RPG'], developers: ['CD Projekt Red'], publishers: ['CD Projekt'], tags: [1, 2, 3, 7],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/f7f564ecedd09b3e503b071a637aeefdedbeedd8/ss_f7f564ecedd09b3e503b071a637aeefdedbeedd8.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_107600c1337231660f50f52ba71477c3c66b2d00.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_8e762c2f42a0f8bfd463d1cb53f1f7e0bc27e3cc.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_75e01c0db721d7b0559eb431a478330ee0f4c084.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_c7df0e4d084eeec286dbdb9db8a7ba1e78687258.600x338.jpg"],
      description: 'A jornada de Geralt de Rívia com versão next-gen atualizada, permanecendo entre os RPGs mais jogados do mundo.' },
    { id: 't7', name: 'Red Dead Redemption 2', released: '2018-10-26', metacritic: 97, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Ação', 'Aventura'], developers: ['Rockstar Games'], publishers: ['Rockstar Games'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_66b553f4c209476d3e4ce25fa4714002cc914c4f.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_fb2896fd2cf1cb82c5a1ecba840dd67ec927b2e3.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_f8df2d475ef21e6be794c4ec9d924045f86ce5b1.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_495ee8cbe7bbcf156dd3d61b6c006437d042ec7d.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/ss_66b553f4c209476d3e4ce25fa4714002cc914c4f.600x338.jpg"],
      description: 'Obra-prima de mundo aberto narrando a queda da gangue de Dutch van der Linde, com comunidades ativas e gráficos de referência.' },
    { id: 't8', name: 'Helldivers 2', released: '2024-02-08', metacritic: 82, platforms: ['PC', 'PlayStation'], genres: ['Tiro', 'Ação'], developers: ['Arrowhead Game Studios'], publishers: ['Sony Interactive Entertainment'], tags: [1, 2],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/ss_8e72750e50e95c4e97669d0dbe9a81f8f3b7d727.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/ss_2b724580fb354d2e7ca856942ad3eb74044be8d1.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/ss_fa9740b2f483c7ce422bc7d8c7c941784ca1f76f.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/ss_bf83a45c61266d9c6c5ea3e9c52feea36ee5144b.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/ss_8e72750e50e95c4e97669d0dbe9a81f8f3b7d727.600x338.jpg"],
      description: 'Shooter cooperativo de ação galáctica em terceira pessoa contra Terminídios e Autômatos na luta pela Super Terra.' },
    { id: 't9', name: 'Minecraft', released: '2011-11-18', metacritic: 93, platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo'], genres: ['Sandbox', 'Sobrevivência'], developers: ['Mojang Studios'], publishers: ['Mojang Studios'], tags: [1, 2, 3, 7],
      image: 'https://media.rawg.io/media/games/b4e/b4e4c73d5aa4ec66bbf75375c4847a2b.jpg',
      imageHover: 'https://media.rawg.io/media/screenshots/324/32454b11adde40d87c046f310f0d710d.jpg',
      screenshots: ["https://media.rawg.io/media/screenshots/324/32454b11adde40d87c046f310f0d710d.jpg","https://media.rawg.io/media/screenshots/b93/b9354784a08fd5357876a4a4087dfcfc.jpg","https://media.rawg.io/media/screenshots/f60/f6004abfb72837ff44ebfd588ff1ceb7.jpg","https://media.rawg.io/media/screenshots/36f/36fa18aa95a707a01c40b6e927027d14.jpg"],
      description: 'O sandbox infinito mais jogado do planeta, com servidores ativos e milhões de jogadores em exploração constante.' },
    { id: 't10', name: 'God of War', released: '2018-04-20', metacritic: 94, platforms: ['PlayStation', 'PC'], genres: ['Ação'], developers: ['Santa Monica Studio'], publishers: ['Sony Interactive Entertainment'], tags: [2, 1],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_6eccc970b5de2943546d93d319be1b5c0618f21b.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_3a8b444747ebc63833b5220c324c4e7ab91136b3.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_96e838f38bbd1945f3be4b563cb9671dbb065a28.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_3c0be8d5272a71d8717cfa8ebfc91c28b6d859a7.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1593500/ss_6eccc970b5de2943546d93d319be1b5c0618f21b.600x338.jpg"],
      description: 'A jornada mitológica de Kratos e Atreus pelas terras nórdicas, com narrativa tocante e combate visceral.' },
    { id: 't11', name: 'The Legend of Zelda: Breath of the Wild', released: '2017-03-03', metacritic: 97, platforms: ['Nintendo'], genres: ['Ação', 'Aventura'], developers: ['Nintendo EPD'], publishers: ['Nintendo'], tags: [7],
      image: 'https://media.rawg.io/media/games/cc1/cc196a5ad763955d6532cdba236f730c.jpg',
      imageHover: 'https://media.rawg.io/media/screenshots/b77/b771adc0585c655f8a747d3160e5325a.jpg',
      screenshots: ["https://media.rawg.io/media/screenshots/b77/b771adc0585c655f8a747d3160e5325a.jpg","https://media.rawg.io/media/screenshots/f0d/f0da59e38ffc15b94236b2f7632ce60a.jpg","https://media.rawg.io/media/screenshots/a03/a037b5d13481eec647a40ca13dfc7bb6.jpg","https://media.rawg.io/media/screenshots/d0f/d0f2f3f9828551faaa6573c98894dfc1.jpg"],
      description: 'Marco do design de mundos abertos com exploração não linear, física emergente e aclamação contínua.' },
    { id: 't12', name: 'Portal 2', released: '2011-04-19', metacritic: 95, platforms: ['PC', 'PlayStation', 'Xbox'], genres: ['Quebra-cabeça'], developers: ['Valve'], publishers: ['Valve'], tags: [1, 2, 3],
      image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
      imageHover: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_f3f6787d74739d3b2ec8a484b5c994b3d31ef325.600x338.jpg',
      screenshots: ["https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_6a12b670d80c6534608db1426477e68c8b417e3f.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_bb936453664fa41a9d5926ecdbd0c722aebbe39c.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_3ab634c05cc7fef7bca458f2d5733d9942a00c63.600x338.jpg","https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/ss_f3f6787d74739d3b2ec8a484b5c994b3d31ef325.600x338.jpg"],
      description: 'Um dos quebra-cabeças em primeira pessoa mais celebrados da história, com modo cooperativo atemporal.' },
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
  try { localStorage.removeItem('loading.rawgKey'); } catch (_) {}

  const state = {
    query: '',
    platform: '',
    next: null,
    ctrl: null,
    current: null,
    backdropGame: SEED[0], // Zelda: Breath of the Wild por padrão no Slot Ativo
    popularPage: 1,
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
    refreshBtn: $('#acervo-refresh-btn'),
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

  /* ── Gerenciamento de Tema (Sol/Lua + Auto via Sistema) ── */
  const getSystemDark = () => {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  };

  const getStored = () => {
    try {
      const val = localStorage.getItem(LS.theme);
      if (val === 'light' || val === 'dark') return val;
      return null; // auto legado ou ausente = null
    } catch (_) {
      return null;
    }
  };

  const applyTheme = (theme) => {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    if (els.themeBtn) {
      els.themeBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      els.themeBtn.setAttribute('aria-label', isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro');
      els.themeBtn.setAttribute('title', isDark ? 'Tema escuro ativo (clique para tema claro)' : 'Tema claro ativo (clique para tema escuro)');
    }
  };

  const initialTheme = getStored() || (getSystemDark() ? 'dark' : 'light');
  applyTheme(initialTheme);

  els.themeBtn?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(LS.theme, next);
    } catch (_) {}
    applyTheme(next);
  });

  const mediaDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (mediaDark) {
    const handleMediaChange = (e) => {
      if (getStored() === null) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };
    if (mediaDark.addEventListener) {
      mediaDark.addEventListener('change', handleMediaChange);
    } else if (mediaDark.addListener) {
      mediaDark.addListener(handleMediaChange);
    }
  }

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

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const past120Str = new Date(now - 120 * 86400000).toISOString().slice(0, 10);
      const url = `${API}/games?dates=${past120Str},${todayStr}&ordering=-added&page_size=6`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.results && json.results.length >= 6) {
          trendingGames = json.results.map(fromRawg);
        }
      }
    } catch (_) {}

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
  function loadSeed(isRotate = false) {
    if (isRotate) {
      state.popularPage = (state.popularPage % 3) + 1;
      const combined = [...SEED, ...TRENDING_POOL];
      const start = ((state.popularPage - 1) * PAGE_SIZE) % combined.length;
      let slice = combined.slice(start, start + PAGE_SIZE);
      if (slice.length < PAGE_SIZE) {
        slice = slice.concat(combined.slice(0, PAGE_SIZE - slice.length));
      }
      render(slice.map(g => ({ ...g, source: 'seed' })));
      if (els.more) els.more.hidden = true;
      if (els.infiniteLoader) els.infiniteLoader.hidden = true;
      setStatus(`Modo offline. Jogos em alta · Página ${state.popularPage}.`);
      return;
    }
    const q = state.query.toLowerCase();
    const list = SEED.filter(g => (!q || g.name.toLowerCase().includes(q)));
    render(list.map(g => ({ ...g, source: 'seed' })));
    if (els.more) els.more.hidden = true;
    if (els.infiniteLoader) els.infiniteLoader.hidden = true;
    $('#fact-count').textContent = '500 mil+';
    setStatus(list.length
      ? (q ? `${list.length} jogo${list.length > 1 ? 's' : ''} encontrado${list.length > 1 ? 's' : ''}.` : 'Os jogos mais jogados e comentados na web (curadoria local).')
      : 'Nenhum jogo na curadoria local.');
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
  async function loadGames(append = false, isRefresh = false) {
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
      setStatus(isRefresh ? 'Atualizando jogos mais jogados…' : 'Carregando catálogo…');
      els.games.setAttribute('aria-busy', 'true');
    }

    let url;
    if (append && state.next) url = state.next;
    else {
      const p = new URLSearchParams({ page_size: String(PAGE_SIZE) });
      if (state.query) { p.set('search', state.query); p.set('search_precise', 'true'); }
      else {
        p.set('ordering', '-added');
        if (state.popularPage > 1) p.set('page', String(state.popularPage));
      }
      if (state.platform) p.set('parent_platforms', state.platform);
      url = `${API}/games?${p}`;
    }

    try {
      let data = (!append && !isRefresh) ? getCache(url) : null;
      if (!data) {
        const res = await fetch(url, { signal: append ? undefined : state.ctrl.signal });
        if (res.status === 401) throw Object.assign(new Error('key'), { code: 401 });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
        setCache(url, data);
      }
      state.next = data.next;
      render(data.results.map(fromRawg), append);
      if (els.more) {
        els.more.hidden = true;
      }
      setStatus(data.count
        ? (state.query
            ? `${data.count.toLocaleString('pt-BR')} jogos catalogados para “${state.query}”.`
            : (state.popularPage > 1
                ? `Os jogos mais jogados e comentados na web · Página ${state.popularPage}.`
                : 'Os jogos mais jogados e comentados na web.'))
        : 'Nenhum jogo encontrado.');
      if (!state.query && !state.platform) $('#fact-count').textContent = data.count.toLocaleString('pt-BR');
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (!append) {
        loadSeed(isRefresh);
        setStatus('Modo offline. Exibindo curadoria local.');
      }
    } finally {
      if (append) {
        loadingMore = false;
        if (ENABLE_INFINITE_SCROLL) {
          if (els.infiniteLoader) els.infiniteLoader.hidden = true;
        } else if (els.more) {
          els.more.textContent = 'Carregar mais jogos';
          els.more.disabled = false;
        }
      } else {
        els.games.removeAttribute('aria-busy');
      }
    }
  }

  /* ── Ficha do jogo & Trava de Rolagem (Scroll Lock) ── */
  function lockPageScroll() {
    const sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.setProperty('--scrollbar-comp', `${sbw}px`);
    document.documentElement.classList.add('is-modal-open');
    document.body.classList.add('is-modal-open');
  }

  function unlockPageScroll() {
    document.documentElement.classList.remove('is-modal-open');
    document.body.classList.remove('is-modal-open');
    document.body.style.removeProperty('--scrollbar-comp');
  }

  els.dlg.addEventListener('close', unlockPageScroll);

  const spec = (k, v) => {
    if (!v || (Array.isArray(v) && !v.length)) return null;
    const val = v instanceof Node ? v : (Array.isArray(v) ? v.join(', ') : String(v));
    return h('div', {}, h('dt', { class: 'label', text: k }), h('dd', {}, val));
  };

  function setDescStatus(status, label) {
    const pill = $('#g-desc-status');
    if (els.dlg) els.dlg.dataset.descState = status;
    if (!pill) return;
    pill.dataset.status = status;
    pill.textContent = label;
  }

  /* ── Descrição com suporte a tradução simultânea e revelação lateral ── */
  function renderDescription(g, cascade = false) {
    const descEl = $('#g-desc');
    const discussWrap = $('#g-discuss')?.parentElement;
    if (descEl) descEl.scrollTop = 0;

    if (g.description == null || g.isLoadingDesc) {
      setDescStatus('loading', 'SINCRONIZANDO…');
      const skelLines = Array.from({ length: 6 }, () => h('span', { class: 'desc-skel-line', 'aria-hidden': 'true' }));
      descEl.replaceChildren(
        h('div', { class: 'desc-loading-wrap' },
          h('p', { class: 'desc-loading', text: 'Sincronizando e traduzindo sinopse…' }),
          h('div', { class: 'desc-skel-lines', 'aria-hidden': 'true' }, skelLines)
        )
      );
      if (discussWrap) {
        discussWrap.hidden = false;
        discussWrap.classList.remove('cascade-item');
      }
      return;
    }

    if (!g.description) {
      setDescStatus('empty', 'INDISPONÍVEL');
      descEl.replaceChildren(h('p', { class: 'muted', text: 'Sem sinopse disponível.' }));
      if (discussWrap) {
        discussWrap.hidden = false;
        discussWrap.classList.remove('cascade-item');
      }
      return;
    }

    const showTranslated = !!g.translatedDesc && !g.showOriginal;
    setDescStatus('ready', showTranslated ? 'PT-BR // TRADUZIDO' : (g.translatedDesc ? 'EN // ORIGINAL' : 'SINOPSE PRONTA'));
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

    descEl.replaceChildren(...kids);

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

  function websiteLink(website) {
    try {
      const url = new URL(website);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return h('div', {}, h('dt', { class: 'label', text: 'Site oficial' }),
        h('dd', {}, h('a', { class: 'link', href: url.href, rel: 'noopener noreferrer', target: '_blank', text: `${url.hostname} ↗` })));
    } catch {
      return null;
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
      websiteLink(g.website),
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
    let thumbMoved = false;
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
      class: 'gallery-thumb',
      type: 'button',
      'aria-label': `Ver imagem ${n + 1}`,
      onclick: e => {
        if (thumbMoved) { e.preventDefault(); return; }
        go(n);
      },
    }, h('img', { src: rawgCrop(src), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }))) : [];
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

    /* Rolagem horizontal suave com roda do mouse ou arrasto nas miniaturas */
    if (thumbsWrap) {
      thumbsWrap.addEventListener('wheel', e => {
        if (thumbsWrap.scrollWidth <= thumbsWrap.clientWidth) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta !== 0) {
          e.preventDefault();
          thumbsWrap.scrollLeft += delta;
        }
      }, { passive: false });

      let tx0 = null;
      let sl0 = 0;
      thumbsWrap.addEventListener('pointerdown', e => {
        if (thumbsWrap.scrollWidth <= thumbsWrap.clientWidth) return;
        tx0 = e.clientX;
        sl0 = thumbsWrap.scrollLeft;
        thumbMoved = false;
      });
      thumbsWrap.addEventListener('pointermove', e => {
        if (tx0 == null) return;
        const dx = e.clientX - tx0;
        if (Math.abs(dx) > 6) {
          thumbMoved = true;
          thumbsWrap.scrollLeft = sl0 - dx;
        }
      });
      const endThumbDrag = () => { tx0 = null; setTimeout(() => { thumbMoved = false; }, 0); };
      thumbsWrap.addEventListener('pointerup', endThumbDrag);
      thumbsWrap.addEventListener('pointercancel', endThumbDrag);
      thumbsWrap.addEventListener('pointerleave', endThumbDrag);
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
    if (g.source !== 'rawg' || g.shotsFetched) return;
    g.shotsFetched = true;
    try {
      const res = await fetch(`${API}/games/${encodeURIComponent(g.id)}/screenshots?page_size=20`);
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
    const dlgMain = $('.dlg-main', els.dlg);
    if (dlgBody) dlgBody.scrollTop = 0;
    if (dlgMain) dlgMain.scrollTop = 0;
    loadScreenshots(g);

    const needsFetch = g.source === 'rawg' && g.description == null;
    const needsTranslate = g.source === 'rawg' && !g.translatedDesc && !g.translationAttempted && typeof I18N !== 'undefined';

    if (needsFetch || needsTranslate) {
      g.isLoadingDesc = true;
      fillDialog(g, false);
      lockPageScroll();
      if (!els.dlg.open) els.dlg.showModal();

      try {
        if (needsFetch) {
          const res = await fetch(`${API}/games/${encodeURIComponent(g.id)}`);
          if (!res.ok) throw new Error();
          const d = await res.json();
          if (state.current !== g) return;
          const description = (d.description_raw || '').split(/\n\s*(Español|Русский|Deutsch|Français)\s*\n/)[0].trim();
          Object.assign(g, {
            description,
            developers: (d.developers || []).map(x => x && x.name).filter(Boolean),
            publishers: (d.publishers || []).map(x => x && x.name).filter(Boolean),
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
          setDescStatus('empty', 'ERRO');
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
      lockPageScroll();
      if (!els.dlg.open) els.dlg.showModal();
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

  /* ── Botão de Atualização Dinâmica dos Jogos Mais Jogados ── */
  if (els.refreshBtn) {
    els.refreshBtn.addEventListener('click', async () => {
      if (els.refreshBtn.disabled || els.games.hasAttribute('aria-busy')) return;
      els.refreshBtn.classList.add('is-refreshing');
      els.refreshBtn.disabled = true;

      // Avança a página de mais jogados (1 a 10) e limpa busca de texto para ver populares
      state.popularPage = (state.popularPage % 10) + 1;
      if (els.q) els.q.value = '';
      state.query = '';
      state.next = null;

      try {
        await loadGames(false, true);
      } finally {
        els.refreshBtn.classList.remove('is-refreshing');
        els.refreshBtn.disabled = false;
      }
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

  /* ── Avaliações & Fórum (Supabase permanente) ── */
  let topics = [];

  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  const ago = t => {
    const s = (t - Date.now()) / 1000;
    for (const [u, n] of [['year', 31536e3], ['month', 2592e3], ['day', 86400], ['hour', 3600], ['minute', 60]])
      if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
    return 'agora';
  };
  const clean = (s, max) => String(s || '').replace(/\s+\n/g, '\n').trim().slice(0, max);
  const lastActivity = t => Math.max(t.at, ...(t.replies.length ? t.replies.map(r => r.at) : [t.at]));

  function mapTopicRow(row) {
    const replies = (row.forum_replies || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(r => ({
        id: r.id,
        author: r.author_display,
        authorId: r.author_id,
        body: r.body,
        at: new Date(r.created_at).getTime(),
      }));
    return {
      id: row.id,
      author: row.author_display,
      authorId: row.author_id,
      game: row.game || 'Geral',
      title: row.title,
      body: row.body,
      pinned: Boolean(row.pinned),
      at: new Date(row.created_at).getTime(),
      replies,
    };
  }

  async function loadTopicsFromServer() {
    const sb = getSb();
    if (!sb) {
      topics = [];
      return;
    }
    const { data, error } = await sb
      .from('forum_topics')
      .select('id, author_id, author_display, game, title, body, pinned, created_at, forum_replies(id, author_id, author_display, body, created_at)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[forum] load', error);
      topics = [];
      return;
    }
    topics = (data || []).map(mapTopicRow);
  }

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
      h('textarea', { class: 'input', id: `r-${t.id}`, name: 'body', maxlength: '1000', required: true, placeholder: authSessionUser ? 'Comentar nesta avaliação…' : 'Entre na conta para comentar…' }),
      h('div', {}, h('button', { class: 'btn', type: 'submit', text: 'Responder' })));
    replyForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!requireAuth('Entre na sua conta para responder neste tópico.')) return;
      const field = replyForm.elements.body;
      const body = clean(field.value, 1000);
      if (body.length < 2) { field.focus(); return; }
      const sb = getSb();
      if (!sb) {
        els.fErr.textContent = 'Supabase não configurado.';
        return;
      }
      const { error } = await sb.from('forum_replies').insert({
        topic_id: t.id,
        author_id: authSessionUser.id,
        author_display: displayNameOf(authSessionUser),
        body,
      });
      if (error) {
        els.fErr.textContent = error.message || 'Não foi possível publicar a resposta.';
        return;
      }
      field.value = '';
      els.fErr.textContent = 'Resposta publicada.';
      await loadTopicsFromServer();
      renderTopics(t.id);
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
          h('span', { class: 'topic-stars', 'aria-label': '5 estrelas', text: '★★★★★' }),
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
    if (!els.topics) return;
    const q = (els.forumQ?.value || '').trim().toLowerCase();
    const list = topics
      .filter(t => !q || [t.title, t.game, t.author, t.body].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || lastActivity(b) - lastActivity(a));
    const emptyMsg = getSb()
      ? (q ? 'Nenhuma avaliação encontrada.' : 'Nenhuma avaliação ainda. Seja o primeiro a publicar (é preciso entrar na conta).')
      : 'Configure o Supabase para carregar o fórum.';
    els.topics.replaceChildren(...(list.length ? list.map(topicEl) : [h('p', { class: 'muted empty', text: emptyMsg })]));
    topics.forEach(t => t.game && knownGames.add(t.game));
    refreshDatalist();
    if (openId) {
      const d = $(`#topic-${openId} details`);
      if (d) { d.open = true; d.querySelector('summary')?.focus(); }
    }
  }

  let lastDatalistSize = 0;
  function refreshDatalist() {
    if (!els.gameList) return;
    if (knownGames.size === lastDatalistSize) return;
    lastDatalistSize = knownGames.size;
    els.gameList.replaceChildren(...[...knownGames].sort().slice(0, 300).map(v => h('option', { value: v })));
  }

  els.forumQ?.addEventListener('input', debounce(() => renderTopics(), 200));

  els.form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!requireAuth('Entre na sua conta para publicar no fórum.')) return;
    const f = els.form.elements;
    const title = clean(f.title.value, 120);
    const body = clean(f.body.value, 2000);
    const game = clean(f.game.value, 80) || 'Geral';
    if (title.length < 4) { els.fErr.textContent = 'O título precisa de pelo menos 4 caracteres.'; f.title.setAttribute('aria-invalid', 'true'); f.title.focus(); return; }
    if (body.length < 10) { els.fErr.textContent = 'A avaliação precisa de pelo menos 10 caracteres.'; f.body.setAttribute('aria-invalid', 'true'); f.body.focus(); return; }
    f.title.removeAttribute('aria-invalid'); f.body.removeAttribute('aria-invalid');

    const sb = getSb();
    if (!sb) {
      els.fErr.textContent = 'Supabase não configurado.';
      return;
    }

    const submitBtn = $('#topic-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'PUBLICANDO…'; }

    const { data, error } = await sb.from('forum_topics').insert({
      author_id: authSessionUser.id,
      author_display: displayNameOf(authSessionUser),
      game,
      title,
      body,
    }).select('id').single();

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'PUBLICAR NO FÓRUM →'; }

    if (error) {
      els.fErr.textContent = error.message || 'Não foi possível publicar a avaliação.';
      return;
    }

    f.title.value = '';
    f.body.value = '';
    f.game.value = '';
    els.fErr.textContent = 'Avaliação publicada.';
    if (els.forumQ) els.forumQ.value = '';
    await loadTopicsFromServer();
    renderTopics(data?.id);
    if (data?.id) $(`#topic-${data.id}`)?.scrollIntoView({ block: 'nearest' });
  });

  /* ── 04 · Feedback e Sugestões da Comunidade (Supabase) ── */
  const fbCategoryLabels = {
    site: 'SITE',
    comunidade: 'COMUNIDADE',
    acervo: 'ACERVO',
    outro: 'SUGESTÃO',
  };

  let feedbacks = [];

  const fbElements = {
    form: $('#feedback-form'),
    category: $('#fb-category'),
    message: $('#fb-message'),
    status: $('#fb-status'),
    history: $('#fb-history'),
    list: $('#fb-list'),
    count: $('#fb-count'),
  };

  function feedbackItemEl(fb) {
    const catLabel = fbCategoryLabels[fb.category] || 'SUGESTÃO';
    const timeText = ago(fb.at);
    return h('li', { class: 'feedback-item', id: `fb-${fb.id}` },
      h('div', { class: 'feedback-item-top' },
        h('span', { class: 'feedback-item-meta' }, `${fb.author || 'membro'} · ${timeText}`),
        h('span', { class: 'feedback-item-tag' }, `[${catLabel}]`)
      ),
      h('p', { class: 'feedback-item-msg', text: fb.message })
    );
  }

  function renderFeedbacks() {
    if (!fbElements.history || !fbElements.list) return;
    if (feedbacks.length === 0) {
      fbElements.history.hidden = true;
      fbElements.list.replaceChildren();
      if (fbElements.count) fbElements.count.textContent = '0';
      return;
    }
    fbElements.history.hidden = false;
    if (fbElements.count) fbElements.count.textContent = String(feedbacks.length);
    fbElements.list.replaceChildren(...feedbacks.map(feedbackItemEl));
  }

  async function loadFeedbacksFromServer() {
    const sb = getSb();
    if (!sb) {
      feedbacks = [];
      return;
    }
    const { data, error } = await sb
      .from('feedbacks')
      .select('id, author_id, author_display, category, message, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[feedback]', error);
      feedbacks = [];
      return;
    }
    feedbacks = (data || []).map(row => ({
      id: row.id,
      author: row.author_display,
      authorId: row.author_id,
      category: row.category,
      message: row.message,
      at: new Date(row.created_at).getTime(),
    }));
  }

  function initFeedbacks() {
    if (!fbElements.form) return;

    renderFeedbacks();

    fbElements.form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!requireAuth('Entre na sua conta para enviar uma sugestão.')) return;

      const rawMsg = fbElements.message?.value || '';
      const message = clean(rawMsg, 500);

      if (message.length < 6) {
        if (fbElements.status) {
          fbElements.status.textContent = 'A sugestão precisa ter pelo menos 6 caracteres.';
          fbElements.status.className = 'status feedback-status is-error';
        }
        fbElements.message?.setAttribute('aria-invalid', 'true');
        fbElements.message?.focus();
        return;
      }

      fbElements.message?.removeAttribute('aria-invalid');
      const category = fbElements.category?.value || 'site';
      const sb = getSb();
      if (!sb) {
        if (fbElements.status) {
          fbElements.status.textContent = 'Supabase não configurado.';
          fbElements.status.className = 'status feedback-status is-error';
        }
        return;
      }

      if (fbElements.form.querySelector('#fb-submit')) {
        const btn = $('#fb-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'ENVIANDO…'; }
      }

      const { error } = await sb.from('feedbacks').insert({
        author_id: authSessionUser.id,
        author_display: displayNameOf(authSessionUser),
        category,
        message,
      });

      const btn = $('#fb-submit');
      if (btn) { btn.disabled = false; btn.textContent = 'ENVIAR SUGESTÃO →'; }

      if (error) {
        if (fbElements.status) {
          fbElements.status.textContent = error.message || 'Não foi possível enviar a sugestão.';
          fbElements.status.className = 'status feedback-status is-error';
        }
        return;
      }

      fbElements.message.value = '';
      if (fbElements.status) {
        fbElements.status.textContent = '✔ Sugestão enviada com sucesso! Obrigado pela colaboração.';
        fbElements.status.className = 'status feedback-status is-success';
        setTimeout(() => {
          if (fbElements.status && fbElements.status.textContent.includes('sucesso')) {
            fbElements.status.textContent = '';
            fbElements.status.className = 'status feedback-status';
          }
        }, 5000);
      }

      await loadFeedbacksFromServer();
      renderFeedbacks();
    });
  }

  async function refreshCommunityData() {
    await Promise.all([loadTopicsFromServer(), loadFeedbacksFromServer()]);
    renderTopics();
    renderFeedbacks();
    syncAuthorDisplays();
  }

  /* ── Navegação ativa no scroll (pílula deslizante proporcional à rolagem) ── */
  let scrollTicking = false;
  const siteNav = document.querySelector('.site-nav');
  const navPill = siteNav?.querySelector('.site-nav-pill');
  const siteHeader = document.querySelector('.site-header');
  const navSpy = [...document.querySelectorAll('.site-nav a[href^="#"]')]
    .map(a => ({ a, sec: document.getElementById(a.getAttribute('href').slice(1)) }))
    .filter(s => s.sec); // ordem do menu = ordem das seções na página

  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = t => t * t * (3 - 2 * t);

  function updateScrollEffects() {
    scrollTicking = false;
    // Nav escondido (< 68rem) ou sem seções: nada a fazer
    if (!siteNav || !navPill || !navSpy.length || getComputedStyle(siteNav).display === 'none') return;

    const vh = window.innerHeight;
    const y = window.scrollY || window.pageYOffset;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    const offset = (siteHeader?.offsetHeight || 0) + vh * 0.3; // linha de leitura
    const line = y + offset;
    const maxLine = maxScroll + offset;

    // Topo absoluto de cada seção (Destaques → Acervo → Fórum)
    const secAcervo = document.getElementById('acervo');
    const secForum = document.getElementById('forum');
    const topInicio = navSpy[0]?.sec ? (navSpy[0].sec.getBoundingClientRect().top + y) : 0;
    const topAcervo = secAcervo ? (secAcervo.getBoundingClientRect().top + y) : 0;
    const topForum = secForum ? (secForum.getBoundingClientRect().top + y) : maxLine;

    const tops = [
      Math.min(topInicio, maxLine - 1),
      Math.min(topAcervo, maxLine - 1),
      Math.min(topForum, maxLine - 1)
    ];

    let i = 0;
    while (i < tops.length - 1 && line >= tops[i + 1]) i++;

    // Zona de transição: últimos ~35% da viewport antes da próxima seção
    let t = 0;
    if (i < tops.length - 1) {
      const zone = Math.max(1, Math.min(vh * 0.35, tops[i + 1] - tops[i]));
      t = Math.max(0, Math.min(1, (line - (tops[i + 1] - zone)) / zone));
    }
    const j = Math.min(i + 1, navSpy.length - 1);
    const k = smoothstep(t);

    const navLeft = siteNav.getBoundingClientRect().left + siteNav.clientLeft;
    const rects = navSpy.map(s => s.a.getBoundingClientRect());
    const x = lerp(rects[i].left, rects[j].left, k) - navLeft;
    const w = lerp(rects[i].width, rects[j].width, k);
    siteNav.style.setProperty('--pill-x', x.toFixed(2) + 'px');
    siteNav.style.setProperty('--pill-w', w.toFixed(2) + 'px');

    const dominant = k < 0.5 ? i : j;
    navSpy.forEach((s, n) => {
      const L = rects[n].left - navLeft;
      const R = L + rects[n].width;
      const cover = Math.max(0, Math.min(R, x + w) - Math.max(L, x)) / (rects[n].width || 1);
      s.a.style.setProperty('--fill', cover.toFixed(3));
      const on = n === dominant;
      s.a.classList.toggle('active', on);
      if (on) s.a.setAttribute('aria-current', 'location');
      else s.a.removeAttribute('aria-current');
    });
    siteNav.classList.add('is-ready');
  }

  function requestScrollEffects() {
    if (!scrollTicking) {
      requestAnimationFrame(updateScrollEffects);
      scrollTicking = true;
    }
  }

  window.addEventListener('scroll', requestScrollEffects, { passive: true });
  window.addEventListener('resize', requestScrollEffects);
  document.fonts?.ready.then(requestScrollEffects);
  // Conteúdo assíncrono (destaques/acervo) altera a altura das seções
  if ('ResizeObserver' in window) {
    const mainEl = document.getElementById('conteudo');
    if (mainEl) new ResizeObserver(requestScrollEffects).observe(mainEl);
  }

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
  initFeedbacks();
  syncAuthorDisplays();
  refreshCommunityData();

  /* ── 05 · Roteador SPA de Vertentes (#auth vs Catálogo) & Autenticação Supabase ── */
  const authEls = {
    btn: $('#auth-btn'),
    btnIcon: $('#auth-btn .auth-btn-icon'),
    btnLabel: $('#auth-btn .auth-btn-label'),
    view: $('#view-auth'),
    closeBtn: $('#auth-close'),
    tabLogin: $('#tab-login'),
    tabRegister: $('#tab-register'),
    formLogin: $('#form-login'),
    formRegister: $('#form-register'),
    loginEmail: $('#login-email'),
    loginPassword: $('#login-password'),
    loginAlert: $('#login-alert'),
    loginSubmit: $('#login-submit'),
    regFirstName: $('#reg-first-name'),
    regLastName: $('#reg-last-name'),
    regEmail: $('#reg-email'),
    regPassword: $('#reg-password'),
    regAlert: $('#register-alert'),
    regSubmit: $('#register-submit'),
    errs: {
      loginEmail: $('#err-login-email'),
      loginPassword: $('#err-login-password'),
      regFirstName: $('#err-reg-firstName'),
      regLastName: $('#err-reg-lastName'),
      regEmail: $('#err-reg-email'),
      regPassword: $('#err-reg-password'),
    },
  };

  let lastCatalogHash = '#inicio';

  function formatAuthHandle(user) {
    if (!user) return '';
    const base = user.firstName || (user.name ? user.name.split(/\s+/)[0] : '') || (user.email ? user.email.split('@')[0] : 'membro');
    return base.toLowerCase().replace(/[^a-z0-9_.-]/gi, '') || 'membro';
  }

  function updateHeaderAuthUI(user) {
    authSessionUser = user || null;
    syncAuthorDisplays();
    if (!authEls.btn) return;
    if (user) {
      const handle = formatAuthHandle(user);
      authEls.btn.classList.add('is-logged');
      authEls.btn.setAttribute('aria-label', `Conectado como @${handle}. Clique para sair da conta`);
      authEls.btn.setAttribute('title', `Conectado como ${user.name || user.email} · Clique para sair`);
      if (authEls.btnIcon) authEls.btnIcon.textContent = '👤';
      if (authEls.btnLabel) authEls.btnLabel.textContent = `@${handle} · SAIR`;
    } else {
      authEls.btn.classList.remove('is-logged');
      authEls.btn.setAttribute('aria-label', 'Entrar ou criar conta');
      authEls.btn.removeAttribute('title');
      if (authEls.btnIcon) authEls.btnIcon.textContent = '👤';
      if (authEls.btnLabel) authEls.btnLabel.textContent = 'ENTRAR / REGISTRO';
    }
  }

  function clearAuthFeedback() {
    [authEls.loginAlert, authEls.regAlert].forEach(el => {
      if (el) {
        el.hidden = true;
        el.textContent = '';
        el.className = 'status auth-alert';
      }
    });
    Object.values(authEls.errs).forEach(el => {
      if (el) {
        el.hidden = true;
        el.textContent = '';
      }
    });
    [authEls.loginEmail, authEls.loginPassword, authEls.regFirstName, authEls.regLastName, authEls.regEmail, authEls.regPassword].forEach(inp => {
      if (inp) inp.removeAttribute('aria-invalid');
    });
  }

  function setAuthAlert(el, message, type = 'error') {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'status auth-alert';
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.className = `status auth-alert is-${type}`;
  }

  function switchAuthTab(mode = 'login') {
    const isLogin = mode !== 'register';
    clearAuthFeedback();
    if (authEls.tabLogin) {
      authEls.tabLogin.classList.toggle('active', isLogin);
      authEls.tabLogin.setAttribute('aria-selected', String(isLogin));
    }
    if (authEls.tabRegister) {
      authEls.tabRegister.classList.toggle('active', !isLogin);
      authEls.tabRegister.setAttribute('aria-selected', String(!isLogin));
    }
    if (authEls.formLogin) authEls.formLogin.hidden = !isLogin;
    if (authEls.formRegister) authEls.formRegister.hidden = isLogin;
  }

  function isAuthCallbackUrl() {
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search || '');
    return hashParams.has('access_token')
      || hashParams.has('refresh_token')
      || hashParams.has('error_description')
      || query.has('code')
      || query.has('error_description');
  }

  function leaveAuthCallback() {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    url.hash = 'inicio';
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== next) {
      history.replaceState(null, '', next);
    }
    syncSpaPartition();
  }

  function syncSpaPartition() {
    if (!authEls.view) return;
    if (isAuthCallbackUrl()) return;
    const hash = window.location.hash || '#inicio';
    const isAuthView = hash === '#auth' || hash === '#auth-login' || hash === '#auth-register';

    if (isAuthView) {
      if (hash === '#auth-register') switchAuthTab('register');
      else if (hash === '#auth-login') switchAuthTab('login');

      document.body.dataset.view = 'auth';
      authEls.view.hidden = false;
      authEls.view.classList.remove('is-leaving');
      authEls.view.classList.add('is-entering');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (['#inicio', '#acervo', '#forum'].includes(hash)) {
        lastCatalogHash = hash;
      }
      const wasAuth = document.body.dataset.view === 'auth';
      delete document.body.dataset.view;
      authEls.view.classList.remove('is-entering');
      authEls.view.hidden = true;

      if (wasAuth) {
        requestScrollEffects();
        const targetSec = document.querySelector(lastCatalogHash);
        if (targetSec) {
          targetSec.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }

  function mapSupabaseAuthError(error, fallback) {
    const msg = (error && error.message) ? String(error.message) : '';
    const lower = msg.toLowerCase();
    if (lower.includes('already registered') || lower.includes('user already')) {
      return 'Este e-mail já está cadastrado.';
    }
    if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
      return 'E-mail ou senha incorretos.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Confirme seu e-mail antes de entrar (verifique a caixa de entrada).';
    }
    return msg || fallback || 'Não foi possível concluir a solicitação.';
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    clearAuthFeedback();

    const email = (authEls.loginEmail?.value || '').trim();
    const password = authEls.loginPassword?.value || '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (authEls.errs.loginEmail) {
        authEls.errs.loginEmail.textContent = 'Informe um e-mail válido.';
        authEls.errs.loginEmail.hidden = false;
      }
      authEls.loginEmail?.setAttribute('aria-invalid', 'true');
      authEls.loginEmail?.focus();
      return;
    }
    if (!password || password.length < 8) {
      if (authEls.errs.loginPassword) {
        authEls.errs.loginPassword.textContent = 'A senha deve ter pelo menos 8 caracteres.';
        authEls.errs.loginPassword.hidden = false;
      }
      authEls.loginPassword?.setAttribute('aria-invalid', 'true');
      authEls.loginPassword?.focus();
      return;
    }

    const sb = getSb();
    if (!sb) {
      setAuthAlert(authEls.loginAlert, 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY.', 'error');
      return;
    }

    if (authEls.loginSubmit) {
      authEls.loginSubmit.disabled = true;
      authEls.loginSubmit.textContent = 'AUTENTICANDO…';
    }

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthAlert(authEls.loginAlert, mapSupabaseAuthError(error, 'E-mail ou senha incorretos.'), 'error');
        return;
      }

      const user = await fetchProfileFor(data.user);
      updateHeaderAuthUI(user);
      setAuthAlert(authEls.loginAlert, `✔ Bem-vindo de volta, ${user?.firstName || user?.name || email}!`, 'success');
      authEls.formLogin?.reset();

      setTimeout(() => {
        if (window.location.hash.startsWith('#auth')) {
          window.location.hash = lastCatalogHash || '#inicio';
        }
      }, 600);
    } catch (err) {
      setAuthAlert(authEls.loginAlert, mapSupabaseAuthError(err, 'Erro de conexão com o Supabase Auth.'), 'error');
    } finally {
      if (authEls.loginSubmit) {
        authEls.loginSubmit.disabled = false;
        authEls.loginSubmit.textContent = 'ENTRAR NA CONTA →';
      }
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    clearAuthFeedback();

    const firstName = (authEls.regFirstName?.value || '').trim();
    const lastName = (authEls.regLastName?.value || '').trim();
    const email = (authEls.regEmail?.value || '').trim();
    const password = authEls.regPassword?.value || '';

    let hasErr = false;
    if (!firstName || firstName.length > 50) {
      if (authEls.errs.regFirstName) {
        authEls.errs.regFirstName.textContent = 'Informe seu nome (1 a 50 caracteres).';
        authEls.errs.regFirstName.hidden = false;
      }
      authEls.regFirstName?.setAttribute('aria-invalid', 'true');
      hasErr = true;
    }
    if (!lastName || lastName.length > 50) {
      if (authEls.errs.regLastName) {
        authEls.errs.regLastName.textContent = 'Informe seu sobrenome (1 a 50 caracteres).';
        authEls.errs.regLastName.hidden = false;
      }
      authEls.regLastName?.setAttribute('aria-invalid', 'true');
      hasErr = true;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (authEls.errs.regEmail) {
        authEls.errs.regEmail.textContent = 'Informe um endereço de e-mail válido.';
        authEls.errs.regEmail.hidden = false;
      }
      authEls.regEmail?.setAttribute('aria-invalid', 'true');
      hasErr = true;
    }
    if (!password || password.length < 8) {
      if (authEls.errs.regPassword) {
        authEls.errs.regPassword.textContent = 'A senha precisa ter no mínimo 8 caracteres.';
        authEls.errs.regPassword.hidden = false;
      }
      authEls.regPassword?.setAttribute('aria-invalid', 'true');
      hasErr = true;
    }
    if (hasErr) return;

    const sb = getSb();
    if (!sb) {
      setAuthAlert(authEls.regAlert, 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY.', 'error');
      return;
    }

    if (authEls.regSubmit) {
      authEls.regSubmit.disabled = true;
      authEls.regSubmit.textContent = 'REGISTRANDO PERFIL…';
    }

    try {
      const name = `${firstName} ${lastName}`.trim();
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          data: {
            first_name: firstName,
            last_name: lastName,
            name,
          },
        },
      });

      if (error) {
        const message = mapSupabaseAuthError(error, 'Não foi possível criar a conta.');
        if (message.includes('já está cadastrado') && authEls.errs.regEmail) {
          authEls.errs.regEmail.textContent = message;
          authEls.errs.regEmail.hidden = false;
          authEls.regEmail?.setAttribute('aria-invalid', 'true');
        }
        setAuthAlert(authEls.regAlert, message, 'error');
        return;
      }

      if (data.session && data.user) {
        const user = await fetchProfileFor(data.user);
        updateHeaderAuthUI(user);
        setAuthAlert(authEls.regAlert, `✔ Conta criada com sucesso! Bem-vindo, ${user?.firstName || name}!`, 'success');
        authEls.formRegister?.reset();
        setTimeout(() => {
          if (window.location.hash.startsWith('#auth')) {
            window.location.hash = lastCatalogHash || '#inicio';
          }
        }, 650);
      } else {
        switchAuthTab('login');
        setAuthAlert(
          authEls.loginAlert,
          '✔ Conta criada. Se a confirmação de e-mail estiver ativa, confirme antes de entrar; caso contrário, faça login.',
          'success'
        );
        authEls.formRegister?.reset();
      }
    } catch (err) {
      setAuthAlert(authEls.regAlert, mapSupabaseAuthError(err, 'Erro de conexão com o Supabase Auth.'), 'error');
    } finally {
      if (authEls.regSubmit) {
        authEls.regSubmit.disabled = false;
        authEls.regSubmit.textContent = 'CRIAR CONTA & ATIVAR →';
      }
    }
  }

  async function handleLogout() {
    const sb = getSb();
    try {
      if (sb) await sb.auth.signOut();
    } catch {}
    updateHeaderAuthUI(null);
    if (window.location.hash.startsWith('#auth')) {
      switchAuthTab('login');
      setAuthAlert(authEls.loginAlert, 'Sessão encerrada com sucesso.', 'success');
    }
  }

  async function restoreAuthSession() {
    const sb = getSb();
    if (!sb) {
      updateHeaderAuthUI(null);
      return;
    }

    const openedFromCallback = isAuthCallbackUrl();
    try {
      const { data, error } = await sb.auth.getSession();
      if (openedFromCallback) leaveAuthCallback();
      if (error || !data.session?.user) {
        updateHeaderAuthUI(null);
      } else {
        const user = await fetchProfileFor(data.session.user);
        updateHeaderAuthUI(user);
      }
    } catch {
      if (openedFromCallback) leaveAuthCallback();
      updateHeaderAuthUI(null);
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        updateHeaderAuthUI(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        const user = await fetchProfileFor(session.user);
        updateHeaderAuthUI(user);
        if (isAuthCallbackUrl() || (openedFromCallback && !window.location.hash.startsWith('#inicio'))) {
          leaveAuthCallback();
        }
      }
    });
  }

  function initSpaAuth() {
    if (!authEls.view) return;

    // Clique no botão do cabeçalho: se logado faz logout; se deslogado abre a vertente #auth
    authEls.btn?.addEventListener('click', () => {
      if (authSessionUser) {
        handleLogout();
      } else {
        window.location.hash = '#auth';
      }
    });

    // Botão fechar / voltar ao acervo
    authEls.closeBtn?.addEventListener('click', () => {
      window.location.hash = lastCatalogHash || '#inicio';
    });

    // Alternância de abas Login / Registro
    authEls.tabLogin?.addEventListener('click', () => switchAuthTab('login'));
    authEls.tabRegister?.addEventListener('click', () => switchAuthTab('register'));

    // Toggles de visibilidade de senha
    document.querySelectorAll('.auth-pw-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(show));
        const useEl = btn.querySelector('use');
        if (useEl) useEl.setAttribute('href', show ? '#icon-eye-off' : '#icon-eye');
      });
    });

    // Submissão dos formulários
    authEls.formLogin?.addEventListener('submit', handleLoginSubmit);
    authEls.formRegister?.addEventListener('submit', handleRegisterSubmit);

    // Roteamento por hash (#auth vs #inicio/#acervo/#forum)
    window.addEventListener('hashchange', syncSpaPartition);
    syncSpaPartition();
    restoreAuthSession();
  }

  initSpaAuth();
  loadGames();
  updateScrollEffects();
})();
