/*
  sw.js — Siralim Ultimate Build Calculator service worker (Tier 1: cache correctness).

  WHY: content-hash `?v=` busting fixes every SUB-resource, but it cannot bust
  index.html itself — the entry document is fetched by its plain URL, GitHub Pages
  serves it `Cache-Control: max-age=600` (no header override on Pages), and browsers
  add heuristic/bfcache freshness on top. A stale index.html points at the OLD `?v=`
  hashes, defeating the whole chain at the root — the classic "I keep having to
  hard-refresh to see my update". This SW closes the gap: navigations are
  network-first, so an online user always revalidates the HTML shell (fresh pointers).

  STRATEGY (complementary, not redundant):
    - navigation / HTML  -> network-first  (fresh pointers online; cache offline)
    - everything else     -> cache-first    (safe: `?v=<hash>` assets are immutable,
                             so a new build is a new URL = guaranteed cache miss;
                             the multi-MB data.js is not refetched every load).
    - BUILD below is stamped by build-data.mjs each build; when it changes,
      `activate` purges every older cache.

  Tier 1 is invisible (no install prompt, no manifest). Tier 2 (installability) is
  the separate manifest.webmanifest — inert until shipping to the user base.
*/
const BUILD = "9dd5de37"; // build-data.mjs stamps a content hash here on each build
const CACHE = `su-bc-${BUILD}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

function isNavigation(req) {
  return (
    req.mode === "navigate" ||
    (req.method === "GET" && (req.headers.get("accept") || "").includes("text/html"))
  );
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let CDN/analytics pass straight through

  if (isNavigation(request)) {
    e.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match("./index.html")) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  e.respondWith(
    (async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const fresh = await fetch(request);
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }
      return fresh;
    })()
  );
});
