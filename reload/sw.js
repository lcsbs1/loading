'use strict';

const CACHE_NAME = 'loading-shell-v4';
const API_CACHE_NAME = 'loading-api-v4';

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
  // Ativa na hora: v3 interceptava CDN e quebrava todas as capas (net::ERR_FAILED).
  self.skipWaiting();
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
          if (![CACHE_NAME, API_CACHE_NAME].includes(key)) {
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

  // NUNCA interceptar Supabase, tradução ou CDN de capas.
  // Interceptar media.rawg.io / *.steamstatic.com no SW faz o Chrome falhar
  // as <img> com net::ERR_FAILED (resposta opaca / no-cors), mesmo com HTTP 200.
  if (
    url.hostname.includes('supabase.co')
    || url.pathname.startsWith('/api/translate')
    || url.hostname === 'media.rawg.io'
    || url.hostname === 'shared.akamai.steamstatic.com'
    || url.hostname.endsWith('.steamstatic.com')
  ) {
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

  // 2. Catálogo RAWG (/api/rawg): stale-while-revalidate
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

  // 3. Arquivos estáticos do próprio site (same-origin): stale-while-revalidate no shell
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
