/**
 * Copie este arquivo para config.local.js (gitignored) e preencha sua chave RAWG.
 * Obtenha em: https://rawg.io/apidocs
 *
 *   copy reload\js\config.local.example.js reload\js\config.local.js
 */
(function applyLocalConfig() {
  if (typeof CONFIG === 'undefined') return;
  CONFIG.RAWG_KEY = ''; // cole sua chave de 32 caracteres hex aqui
  // CONFIG.TRANSLATE.email = 'voce@exemplo.com'; // opcional, cota MyMemory
})();
