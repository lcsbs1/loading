(function applyLocalConfig() {
  if (typeof CONFIG === 'undefined') return;
  CONFIG.RAWG_KEY = '10fb0c58e08244639995c2976ac31800'; // cole sua chave de 32 caracteres hex aqui
  // CONFIG.TRANSLATE.email = 'voce@exemplo.com'; // opcional, cota MyMemory
  // Sobrescreva aqui se precisar apontar para outro projeto Supabase:
  // CONFIG.SUPABASE_URL = 'https://xxxx.supabase.co';
  // CONFIG.SUPABASE_ANON_KEY = 'eyJ...';
})();
