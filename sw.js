// Garde l'appli disponible hors connexion. Les appels aux sources de cours ne sont jamais mis en cache.
const CACHE = "patrimoine-v16";
const FILES = ["./", "index.html", "app.js?v=16", "intro.js?v=16", "styles.css?v=16", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting() });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim() });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // réseau d'abord pour avoir la dernière version, cache si hors ligne
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r }).catch(() => caches.match(e.request)));
});
