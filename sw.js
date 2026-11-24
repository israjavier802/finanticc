// Service worker de FinanTic: guarda la app en caché para que abra sin internet.
// Al publicar una versión nueva, cambia el nombre de CACHE para que los celulares la actualicen.
const CACHE = 'finantic-v1.1';
const ARCHIVOS = [
  './', './index.html', './manifest.json', './css/estilos.css',
  './js/utilidades.js', './js/cifrado.js', './js/basedatos.js', './js/app.js', './js/acceso.js', './js/inicio.js',
  './img/icon.svg', './img/icon-192.png', './img/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
