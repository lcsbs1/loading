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

  // Supabase (Auth + fórum/feedback permanentes). Anon/publishable key é segura no browser.
  SUPABASE_URL: 'https://kljsbctjldyanqakqevo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsanNiY3RqbGR5YW5xYWtxZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMDAyODYsImV4cCI6MjEwODc3NjI4Nn0.cA62lQp0GhHBIkU_Dp9yIoXbLXuj5hsqQWx7hplb-QM',

  // Identificadores de armazenamento local (localStorage)
  STORAGE_KEYS: {
    key: 'loading.rawgKey',
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
    pageSize: 15,
    infiniteScroll: false,
  },
};
