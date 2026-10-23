/**
 * ====================================================================
 * LOADING... — Configurações e Integração de APIs
 * ====================================================================
 * Base de dados global integrada (RAWG Video Games Database).
 */

const CONFIG = {
  // Cole sua chave da API RAWG entre as aspas:
  RAWG_KEY: '10fb0c58e08244639995c2976ac31800',

  // Endpoint base da API RAWG
  API_BASE_URL: 'https://api.rawg.io/api',

  // Identificadores de armazenamento local (localStorage)
  STORAGE_KEYS: {
    key: 'loading.rawgKey',
    topics: 'loading.topics',
    theme: 'loading.theme',
    translations: 'loading.tr',
  },

  // Tradução automática de conteúdo em inglês (descrições da RAWG)
  TRANSLATE: {
    enabled: true,
    target: 'pt-BR',
    email: 'lamounierlucasramiro@icloud.com', // amplia cota do MyMemory para 50k caracteres/dia
  },

  // Paginação do Acervo (scroll infinito desativado por padrão; ative com true a qualquer momento)
  PAGINATION: {
    pageSize: 12,
    infiniteScroll: false,
  },
};
