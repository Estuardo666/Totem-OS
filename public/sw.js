// Register message handler at initial evaluation so the browser can bind it
// before any async work (required by the SW spec; avoids the "must be added on
// initial evaluation" warning from OneSignal/WorkBox).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Import OneSignal SDK for push notifications (must be at the top)
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = "totem-os-v5";
const STATIC_ASSETS = [
  // Mantenemos solo manifest para instalación PWA; evitamos precache de rutas HTML
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

const SUPPORTED_PROTOCOLS = ["http:", "https:"];

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const protocol = new URL(event.request.url).protocol;
  if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // Para todas las rutas, preferimos siempre red. Cache solo se usa si el fetch falla.
  event.respondWith(
    fetch(event.request).catch(async () => {
      // Fallback opcional: manifest o assets precacheados
      const cachedResponse = await caches.match(event.request);
      return cachedResponse ?? Response.error();
    })
  );
});
