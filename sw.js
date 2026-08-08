// CacheStorage is scoped to the whole origin, while a service worker's fetch
// control is scoped to its path. On a user.github.io domain every project
// shares one origin, so caches must be namespaced and cleanup must only ever
// touch caches this app owns.
const CACHE_PREFIX = 'cozy-draw-';
const CACHE_NAME = CACHE_PREFIX + 'v4';

const ASSETS = [
  './',
  './index.html',
  './companion.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Only these documents are worth persisting. Anything else that happens to be
// navigated to under this scope is served but never stored, so a stream of
// unique URLs cannot grow the cache without bound.
const CACHEABLE_PAGES = ['', 'index.html', 'companion.html'];

const scopePath = () => new URL('./', self.location.href).pathname;

// Canonical key: scope-relative path only. Query strings and fragments are
// dropped so ?a=1 and ?a=2 cannot become separate entries for one document.
function canonicalKey(rawUrl) {
  const u = new URL(rawUrl);
  u.search = '';
  u.hash = '';
  return u.href;
}

function isCacheablePage(rawUrl) {
  const u = new URL(rawUrl);
  if (u.origin !== self.location.origin) return false;
  const scope = scopePath();
  if (!u.pathname.startsWith(scope)) return false;
  return CACHEABLE_PAGES.indexOf(u.pathname.slice(scope.length)) !== -1;
}

self.addEventListener('install', event => {
  event.waitUntil(
    // Don't let one missing asset abort the whole install.
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(a => cache.add(a)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      // Delete only our own superseded caches. Caches belonging to other apps
      // on this origin are left alone.
      Promise.all(
        keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isPage) {
    // Network-first for pages so a deployed update reaches an installed
    // app on the next launch instead of being pinned to the cached copy.
    const key = canonicalKey(req.url);
    const storable = isCacheablePage(req.url);
    event.respondWith(
      fetch(req)
        .then(res => {
          if (storable && res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(key, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(key).then(hit => hit || caches.match('./companion.html')))
    );
    return;
  }

  // Static assets rarely change within a release: serve from cache, and
  // refresh the entry in the background for next time.
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
