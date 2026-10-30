(() => {
  'use strict';

  let deferredPrompt = null;
  let refreshing = false;

  function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    document.documentElement.classList.toggle('is-offline', !isOnline);

    const labels = document.querySelectorAll('[data-net-status]');
    labels.forEach((el) => {
      el.textContent = isOnline ? 'ONLINE' : 'OFFLINE · MODO CACHE';
    });

    window.dispatchEvent(new CustomEvent('loading:net', { detail: { online: isOnline } }));
  }

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // Registro do Service Worker
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        // Notificação de atualização disponível
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              const banner = document.getElementById('pwa-update');
              if (banner) banner.hidden = false;
            }
          });
        });
      }).catch((err) => {
        console.warn('[PWA] Falha ao registrar Service Worker:', err);
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      const reloadBtn = document.getElementById('pwa-reload');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
          navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg && reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      }
    });
  }

  // Captura do evento de instalação (PWA Install Prompt)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('pwa-install');
    if (installBtn) {
      installBtn.hidden = false;
      installBtn.addEventListener('click', async () => {
        installBtn.hidden = true;
        if (deferredPrompt) {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
        }
      }, { once: true });
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBtn = document.getElementById('pwa-install');
    if (installBtn) installBtn.hidden = true;
  });

  window.LoadingPwa = {
    isOnline: () => navigator.onLine,
  };
})();
