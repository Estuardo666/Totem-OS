// Totem owns its VAPID subscriptions and notification delivery.
// Every push must display a notification, including while a client is focused.
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Show a fallback below. */ }
  const title = typeof payload.title === "string" ? payload.title : "Totem OS";
  const body = typeof payload.body === "string" ? payload.body : "Tienes una nueva notificación.";
  const url = notificationURL(payload.url);
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-v2-192x192.png",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: { url },
    });
    // OS delivery and the in-app banner are separate surfaces. Keep the
    // required system notification even when a page is currently focused.
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.visibilityState === "visible") client.postMessage({ type: "PUSH_NOTIFICATION", title, body });
    }
  })());
});

function notificationURL(value) {
  try {
    const url = new URL(typeof value === "string" ? value : "/", self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin + "/";
  } catch { return self.location.origin + "/"; }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = notificationURL(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url === url);
    if (existing) return existing.focus();
    return self.clients.openWindow(url);
  })());
});

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

const CACHE_NAME = "totem-os-v9";
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
