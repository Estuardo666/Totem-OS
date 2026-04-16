// Register message handler at initial evaluation so the browser can bind it
// before any async work (required by the SW spec; avoids the "must be added on
// initial evaluation" warning from OneSignal/WorkBox).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CACHE_URLS" && Array.isArray(event.data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        await Promise.all(
          event.data.urls.map(async (url) => {
            try {
              const response = await fetch(url, { credentials: "same-origin" });
              if (response.ok) {
                await cache.put(url, response.clone());
              }
            } catch {
              return null;
            }

            return null;
          })
        );
      })()
    );
  }
});

// Import OneSignal SDK for push notifications (must be at the top)
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = "totem-os-v6";
const STATIC_ASSETS = [
  // Mantenemos solo manifest para instalación PWA; evitamos precache de rutas HTML
  "/manifest.json",
];
const CACHEABLE_PREFIXES = ["/_next/static/", "/icons/", "/apple-splash/", "/fonts/"];
const CACHEABLE_ROUTES = ["/finance/transactions", "/finance/receivables", "/finance/expenses"];

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

function shouldCacheRequest(request, requestUrl) {
  if (requestUrl.origin !== self.location.origin) return false;
  if (requestUrl.pathname.startsWith("/api/")) return false;
  if (requestUrl.pathname.startsWith("/_next/image")) return false;
  if (request.mode === "navigate") return true;

  return (
    CACHEABLE_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix)) ||
    CACHEABLE_ROUTES.some(
      (route) => requestUrl.pathname === route || requestUrl.pathname.startsWith(`${route}/`)
    )
  );
}

async function cacheResponse(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());

  if (request.mode === "navigate") {
    const requestUrl = new URL(request.url);
    await cache.put(requestUrl.pathname, response.clone());
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const protocol = new URL(event.request.url).protocol;
  if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (!shouldCacheRequest(event.request, requestUrl)) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);

        if (response.ok) {
          await cacheResponse(event.request, response.clone());
        }

        return response;
      } catch {
        const cachedResponse =
          (await caches.match(event.request)) ||
          (event.request.mode === "navigate"
            ? await caches.match(requestUrl.pathname)
            : null);

        return cachedResponse ?? Response.error();
      }
    })()
  );
});
