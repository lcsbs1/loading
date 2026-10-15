/**
 * ====================================================================
 * LOADING... — Configurações e Chaves de API
 * ====================================================================
 * 
 * Para ativar a busca e paginação em tempo real de +500.000 jogos na
 * base de dados global da RAWG Video Games Database:
 * 
 * 1. Obtenha sua chave gratuita em: https://rawg.io/apidocs
 * 2. Cole a chave de 32 caracteres na constante RAWG_KEY abaixo.
 * 
 * Exemplo:
 *   RAWG_KEY: 'abc0123456789def0123456789abcdef',
 * 
 * Nota: Você também pode salvar a chave diretamente pela interface
 * do site, no campo "Chave da API RAWG" situado no rodapé.
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
};
