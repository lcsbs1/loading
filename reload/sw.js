'use strict';

const CACHE_NAME = 'loading-shell-v2';
const API_CACHE_NAME = 'loading-api-v2';
const IMG_CACHE_NAME = 'loading-img-v2';

const PRECACHE_URLS = [
  './',
  'index.html',
  'css/style.css',
  'js/config.js',
  'js/config.local.js',
  'js/supabaseClient.js',
  'js/i18n.js',
  'js/app.js',
  'js/snake.js',
  'js/pwa.js',
  'js/sfx.js',
  'manifest.webmanifest',
  'assets/snake/head.svg',
  'assets/snake/body.svg',
  'assets/snake/seed.svg',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE_URLS.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn('[SW] Precache ignorado para:', url, err);
          });
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (![CACHE_NAME, API_CACHE_NAME, IMG_CACHE_NAME].includes(key)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // NUNCA cachear ou interceptar Supabase, tradução ou CDN externa que não seja mídia
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/translate')) {
    return;
  }

  // 1. Navegação (HTML): network-first, cai para o index.html em cache se offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('index.html') || caches.match('./');
      })
    );
    return;
  }

  // 2. Capas e mídias de jogos (media.rawg.io): cache-first com limite de 300
  if (url.hostname === 'media.rawg.io') {
    event.respondWith(
      caches.open(IMG_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.status === 200 || res.type === 'opaque') {
            cache.put(req, res.clone());
          }
          return res;
        } catch (_) {
          return cached;
        }
      })
    );
    return;
  }

  // 3. Catálogo RAWG (/api/rawg/games): stale-while-revalidate com limite
  if (url.pathname.startsWith('/api/rawg')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then((res) => {
          if (res.status === 200) {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. Arquivos estáticos do próprio site (same-origin): stale-while-revalidate no shell
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
