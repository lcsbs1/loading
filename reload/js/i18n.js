/**
 * ====================================================================
 * LOADING... — Módulo i18n / Tradução Leve (RAWG → PT-BR)
 * ====================================================================
 * Zero dependências externas (~3KB).
 * - Gêneros: Dicionário fixo e instantâneo sem chamadas de rede.
 * - Descrições: Tradução sob demanda na abertura da ficha do jogo,
 *   com cache em localStorage e fallback gracioso.
 */

const I18N = (() => {
  'use strict';

  const C = (typeof CONFIG !== 'undefined' && CONFIG.TRANSLATE) || {
    enabled: true,
    target: 'pt-BR',
    email: '',
  };
  const KEY = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.translations) || 'loading.tr';

  /* 1. Dicionário de Gêneros da RAWG */
  const GENRES = {
    'Action': 'Ação',
    'Adventure': 'Aventura',
    'RPG': 'RPG',
    'Shooter': 'Tiro',
    'Strategy': 'Estratégia',
    'Puzzle': 'Quebra-cabeça',
    'Racing': 'Corrida',
    'Sports': 'Esportes',
    'Simulation': 'Simulação',
    'Platformer': 'Plataforma',
    'Fighting': 'Luta',
    'Arcade': 'Arcade',
    'Casual': 'Casual',
    'Indie': 'Indie',
    'Family': 'Família',
    'Board Games': 'Jogos de Tabuleiro',
    'Card': 'Cartas',
    'Educational': 'Educativo',
    'Massively Multiplayer': 'Multijogador Massivo',
  };

  const genre = name => (name && GENRES[name]) || name || '';

  /* 2. Cache em localStorage (máximo de 150 jogos) */
  const loadCache = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  };

  const saveCache = (id, text) => {
    if (!id || !text) return;
    const db = loadCache();
    db[id] = text;
    const keys = Object.keys(db);
    if (keys.length > 150) {
      delete db[keys[0]]; // remove o mais antigo
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
  };

  /* Decodificador de entidades HTML retornadas por APIs de tradução */
  const decodeHtml = str => {
    if (!str || !str.includes('&')) return str;
    const t = document.createElement('textarea');
    t.innerHTML = str;
    return t.value;
  };

  /* 3a. Tradutor On-Device Nativo (Chrome 138+ / W3C Translation API) */
  async function viaBrowser(text) {
    if (typeof self !== 'undefined' && 'Translator' in self) {
      const avail = await self.Translator.availability({ sourceLanguage: 'en', targetLanguage: 'pt' });
      if (avail !== 'unavailable') {
        const tr = await self.Translator.create({ sourceLanguage: 'en', targetLanguage: 'pt' });
        return await tr.translate(text);
      }
    }
    if (typeof self !== 'undefined' && self.ai && self.ai.translator) {
      const avail = await self.ai.translator.availability({ sourceLanguage: 'en', targetLanguage: 'pt' });
      if (avail !== 'unavailable') {
        const tr = await self.ai.translator.create({ sourceLanguage: 'en', targetLanguage: 'pt' });
        return await tr.translate(text);
      }
    }
    return null;
  }

  /* 3b. Divide texto em blocos de até 450 caracteres respeitando parágrafos e frases */
  function chunkText(text, maxLen = 450) {
    const rawBlocks = text.split(/\n{2,}/);
    const result = [];

    for (const block of rawBlocks) {
      if (block.length <= maxLen) {
        result.push(block.trim());
      } else {
        const sentences = block.match(/[^.!?\n]+[.!?]*\s*/g) || [block];
        let current = '';
        for (const s of sentences) {
          if ((current + s).length <= maxLen) {
            current += s;
          } else {
            if (current.trim()) result.push(current.trim());
            current = s;
          }
        }
        if (current.trim()) result.push(current.trim());
      }
    }
    return result.filter(Boolean);
  }

  /* 3c. MyMemory Translation API (Free tier com CORS liberado) */
  async function viaMyMemory(text) {
    const chunks = chunkText(text, 450);
    const translatedChunks = [];

    for (const piece of chunks) {
      if (!piece.trim()) continue;
      const params = new URLSearchParams({
        q: piece,
        langpair: `en|${C.target || 'pt-BR'}`,
      });
      if (C.email) params.set('de', C.email);

      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.responseStatus !== 200 || data.quotaFinished) {
        throw new Error(data.responseDetails || 'MyMemory quota exceeded');
      }

      const translated = decodeHtml(data.responseData.translatedText || piece);
      translatedChunks.push(translated);
    }

    return translatedChunks.join('\n\n');
  }

  /* API Pública */
  async function translateText(id, original) {
    if (!C.enabled || !original || typeof original !== 'string') return null;

    // 1. Tenta recuperar do cache
    const cache = loadCache();
    if (cache[id]) return cache[id];

    let result = null;

    // 2. Tenta navegador nativo (on-device)
    try {
      result = await viaBrowser(original);
    } catch {
      result = null;
    }

    // 3. Fallback para MyMemory
    if (!result) {
      try {
        result = await viaMyMemory(original);
      } catch (err) {
        console.warn('[I18N] Falha na tradução remota:', err);
        return null;
      }
    }

    if (result) {
      saveCache(id, result);
    }

    return result;
  }

  return {
    genre,
    text: translateText,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18N;
}

