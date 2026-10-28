/**
 * Loading... — cliente Supabase (Auth + Postgres).
 * Depende de CONFIG e do UMD `@supabase/supabase-js` (global `supabase`).
 */
(function initLoadingSupabase(global) {
  'use strict';

  function readConfig() {
    const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {};
    const url = (cfg.SUPABASE_URL || '').trim();
    const key = (cfg.SUPABASE_ANON_KEY || '').trim();
    return { url, key };
  }

  function createClient() {
    const { url, key } = readConfig();
    if (!url || !key) {
      console.warn('[Loading...] Supabase não configurado: defina CONFIG.SUPABASE_URL e CONFIG.SUPABASE_ANON_KEY.');
      return null;
    }
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      console.error('[Loading...] Biblioteca @supabase/supabase-js não carregada.');
      return null;
    }
    return global.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'loading.supabase.auth',
      },
    });
  }

  let client = null;

  global.LoadingSupabase = {
    getClient() {
      if (!client) client = createClient();
      return client;
    },
    isConfigured() {
      const { url, key } = readConfig();
      return Boolean(url && key);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
