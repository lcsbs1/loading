/**
 * ====================================================================
 * LOADING... — Configurações públicas
 * ====================================================================
 * Não coloque chaves de API neste arquivo (ele é versionado).
 * Para desenvolvimento local, copie config.local.example.js → config.local.js
 * ou defina a variável de ambiente RAWG_KEY ao usar `npm start`.
 */

const CONFIG = {
  // Deixe vazio no repositório. Override via config.local.js / localStorage / RAWG_KEY.
  RAWG_KEY: '',

  API_BASE_URL: 'https://api.rawg.io/api',

  STORAGE_KEYS: {
    key: 'loading.rawgKey',
    topics: 'loading.topics',
    theme: 'loading.theme',
    translations: 'loading.tr',
    featuredData: 'loading.featured.data',
    featuredTime: 'loading.featured.timestamp',
  },

  TRANSLATE: {
    enabled: true,
    target: 'pt-BR',
    // Opcional: e-mail genérico amplia cota MyMemory. Não use e-mail pessoal no repo.
    email: '',
  },

  PAGINATION: {
    pageSize: 9,
    infiniteScroll: false,
  },

  // IDs parent_platforms da RAWG → rótulo usado no seed offline
  PLATFORMS: {
    '': 'Todas',
    '1': 'PC',
    '2': 'PlayStation',
    '3': 'Xbox',
    '8': 'Nintendo',
  },
};
