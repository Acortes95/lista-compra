// ============================================================
// Service Worker — cachea el "app shell" para que la app abra
// al instante y funcione mínimamente sin conexión.
// Los datos siempre vienen de Supabase (network), nunca de caché.
// ============================================================
const CACHE_NAME = 'lista-compra-v10';
const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css?v=10',
  './js/config.js?v=10',
  './js/supabaseClient.js?v=10',
  './js/avatars.js?v=10',
  './js/state.js?v=10',
  './js/toast.js?v=10',
  './js/auth.js?v=10',
  './js/groupSetup.js?v=10',
  './js/foods.js?v=10',
  './js/shopping.js?v=10',
  './js/realtime.js?v=10',
  './js/tasks.js?v=10',
  './js/settings.js?v=10',
  './js/app.js?v=10',
  './icons/avatars/apple.png',
  './icons/avatars/banana.png',
  './icons/avatars/avocado.png',
  './icons/avatars/strawberry.png',
  './icons/avatars/grapes.png',
  './icons/avatars/orange.png',
  './icons/avatars/pear.png',
  './icons/avatars/watermelon.png',
  './icons/avatars/tomato.png',
  './icons/avatars/broccoli.png',
  './icons/avatars/carrot.png',
  './icons/avatars/cucumber.png',
  './icons/avatars/cabbage.png',
  './icons/avatars/corn.png',
  './icons/avatars/eggplant.png',
  './icons/avatars/potato.png',
  './icons/avatars/garlic.png',
  './icons/avatars/onion.png',
  './icons/avatars/red_pepper.png',
  './icons/avatars/yellow_pepper.png',
  './icons/avatars/peas.png',
  './icons/avatars/pumpkin.png',
  './icons/avatars/chili.png',
  './icons/avatars/mushroom.png',
  './icons/avatars/milk.png',
  './icons/avatars/cheese.png',
  './icons/avatars/yogurt.png',
  './icons/avatars/egg.png',
  './icons/avatars/bread.png',
  './icons/avatars/rice.png',
  './icons/avatars/pasta.png',
  './icons/avatars/chocolate.png',
  './icons/avatars/donut.png',
  './icons/avatars/coffee.png',
  './icons/avatars/cookie.png',
  './icons/avatars/popcorn.png',
  './icons/avatars/jam.png',
  './icons/avatars/honey.png',
  './icons/avatars/olive.png',
  './icons/avatars/sushi.png',
  './icons/avatars/fish.png',
  './icons/avatars/chicken.png',
  './icons/avatars/steak.png',
  './icons/avatars/shrimp.png',
  './icons/avatars/canned_fish.png',
  './icons/avatars/water.png',
  './icons/avatars/tea.png',
  './icons/avatars/beer.png',
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
