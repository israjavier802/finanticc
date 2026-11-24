// FinanTic 1.1 · Arranque: modo sin conexión (service worker), indicador de red y acceso.
(() => {
  'use strict';
  const off = document.getElementById('offline');
  const red = () => { off.hidden = navigator.onLine !== false; };
  window.addEventListener('online', red); window.addEventListener('offline', red); red();

  // El service worker guarda la app en el celular para que abra sin internet.
  // Solo funciona cuando la app se abre desde https (o localhost).
  if ('serviceWorker' in navigator && window.isSecureContext && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  FT.acceso.iniciar();
})();
