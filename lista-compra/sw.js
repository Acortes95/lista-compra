// ============================================================
// Service Worker — cachea el "app shell" para que la app abra
// al instante y funcione mínimamente sin conexión.
// Los datos siempre vienen de Supabase (network), nunca de caché.
// ============================================================
const CACHE_NAME = 'lista-compra-v3';
const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css?v=3',
  './js/config.js?v=3',
  './js/supabaseClient.js?v=3',
  './js/state.js?v=3',
  './js/toast.js?v=3',
  './js/auth.js?v=3',
  './js/groupSetup.js?v=3',
  './js/foods.js?v=3',
  './js/shopping.js?v=3',
  './js/realtime.js?v=3',
  './js/settings.js?v=3',
  './js/app.js?v=3',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear llamadas a Supabase: los datos deben ser siempre frescos.
  if (url.hostname.endsWith('.supabase.co')) return;

  // Solo interceptamos peticiones GET del propio origen (app shell).
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
