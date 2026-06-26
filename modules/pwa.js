(function(){
  if (window.__plotpalsPwaSupport) return;
  window.__plotpalsPwaSupport = true;

  const STATUS_ONLINE = 'online';
  const STATUS_OFFLINE = 'offline';
  const PWA_PROTOCOLS = new Set(['http:', 'https:']);
  const canUsePwaOrigin = PWA_PROTOCOLS.has(window.location.protocol) && window.location.origin !== 'null';
  let deferredPrompt = null;

  function show(msg, ms){
    if (typeof window.showStatus === 'function') window.showStatus(msg, ms || 2600);
    else console.info(msg);
  }

  function updateNetworkStatus(){
    const status = navigator.onLine ? STATUS_ONLINE : STATUS_OFFLINE;
    document.documentElement.dataset.networkStatus = status;
    window.PLOTPALS_NETWORK_STATUS = status;
  }

  function ensureManifestLink(){
    if (!canUsePwaOrigin) return;
    if (document.querySelector('link[rel="manifest"]')) return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = './manifest.webmanifest';
    document.head.appendChild(link);
  }

  async function registerServiceWorker(){
    if (!canUsePwaOrigin) {
      window.PLOTPALS_SERVICE_WORKER_READY = false;
      console.info('PlotPals PWA service worker skipped: open the app from localhost, HTTPS, or your deployed site. file:// cannot register service workers.');
      return;
    }
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
      window.PLOTPALS_SERVICE_WORKER_READY = true;
      registration.update().catch(() => {});
    } catch (error) {
      console.warn('PlotPals PWA service worker registration failed.', error);
    }
  }

  function ensureInstallButton(){
    if (!canUsePwaOrigin) return;
    if (document.getElementById('plotpalsInstallAppButton')) return;
    const btn = document.createElement('button');
    btn.id = 'plotpalsInstallAppButton';
    btn.type = 'button';
    btn.className = 'ghost-btn plotpals-install-app-button hidden';
    btn.textContent = 'Install App';
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        show('Install is available from your browser menu if supported.');
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      btn.classList.add('hidden');
    });
    document.body.appendChild(btn);
  }

  window.addEventListener('beforeinstallprompt', event => {
    if (!canUsePwaOrigin) return;
    event.preventDefault();
    deferredPrompt = event;
    ensureInstallButton();
    document.getElementById('plotpalsInstallAppButton')?.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('plotpalsInstallAppButton')?.classList.add('hidden');
    show('PlotPals installed.');
  });

  window.addEventListener('online', () => {
    updateNetworkStatus();
    show('Back online. Supabase sync is available.');
    if (typeof window.retryCloudSave === 'function') window.retryCloudSave();
    else if (typeof window.scheduleCloudSave === 'function') window.scheduleCloudSave();
  });

  window.addEventListener('offline', () => {
    updateNetworkStatus();
    show('Offline mode: local writing is available. Supabase will sync when online.', 4200);
  });

  document.addEventListener('DOMContentLoaded', () => {
    updateNetworkStatus();
    ensureManifestLink();
    ensureInstallButton();
    registerServiceWorker();
  });
})();
