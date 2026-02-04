const CACHE_NAME = "totem-os-v2";
const STATIC_ASSETS = [
  "/",
  "/content",
  "/finance",
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
  if (requestUrl.pathname.startsWith("/_next/") || requestUrl.pathname.startsWith("/icons/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isHtmlRequest = event.request.headers.get("accept")?.includes("text/html");
  const isClientsRoute = new URL(event.request.url).pathname.startsWith("/clients");

  if (isHtmlRequest || isClientsRoute) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse ?? Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => cachedResponse ?? Response.error());
    })
  );
});
