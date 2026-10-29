/**
 * ====================================================================
 * LOADING... — Configurações e Integração de APIs
 * ====================================================================
 * Base de dados global integrada (RAWG Video Games Database).
 */

const CONFIG = {
  // Catálogo RAWG via proxy do próprio site. A chave fica só no servidor.
  API_BASE_URL: '/api/rawg',

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
  },

  // Paginação do Acervo (scroll infinito desativado por padrão; ative com true a qualquer momento)
  PAGINATION: {
    pageSize: 15,
    infiniteScroll: false,
  },
};
