(function(){
  let deferredInstallPrompt = null;

  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function updateInstallButtons(){
    const buttons = document.querySelectorAll('[data-pwa-install]');
    buttons.forEach(button => {
      if (isStandalone()) {
        button.textContent = '✓ PWA Installed';
        button.disabled = true;
        button.classList.add('installed');
      } else if (!deferredInstallPrompt) {
        button.textContent = '📲 Get the App';
        button.disabled = false;
      } else {
        button.textContent = '📲 Install PlotPals App';
        button.disabled = false;
      }
    });
  }

  function showInstallHelp(){
    const message = 'To install PlotPals as an app, use your browser menu and choose “Install app,” “Add to Home Screen,” or “Create shortcut.” PlotPals still works normally in this browser.';
    alert(message);
  }

  async function installPwa(){
    if (isStandalone()) return;
    if (!deferredInstallPrompt) {
      showInstallHelp();
      return;
    }
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch (error) { console.warn('PWA install prompt closed:', error); }
    deferredInstallPrompt = null;
    updateInstallButtons();
  }

  window.installPlotPalsPwa = installPwa;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtons();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButtons();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(error => {
        console.warn('PlotPals service worker registration failed:', error);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', updateInstallButtons);
})();
