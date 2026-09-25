// PDV Pro - Minimal service worker for PWA install
const VERSION = "pdvpro-v1";
const CORE = ["/", "/manifest.json", "/pwa-icon-192.png", "/pwa-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return; // let API pass through
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(VERSION).then((c) => c.put(event.request, copy)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(event.request))
  );
});
