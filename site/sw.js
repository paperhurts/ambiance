// Ambiance service worker: the app shell is cached on install; sounds are cached the first time
// they play (or all at once from Settings → Offline), so scenes keep working without a signal.
const VERSION = 'dev';
const SHELL = `ambiance-shell-${VERSION}`;
const AUDIO = 'ambiance-audio';

const SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/engine.js',
  'js/scenes.js',
  'js/visuals.js',
  'js/art.js',
  'js/store.js',
  'fonts/fraunces.woff2',
  'fonts/fraunces-italic.woff2',
  'fonts/nunito.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'audio/manifest.json',
  'audio/silence.mp3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('ambiance-shell-') && key !== SHELL) await caches.delete(key);
      }
      // drop sounds that the current manifest no longer uses (renamed or replaced recordings)
      try {
        const manifest = await (await fetch('audio/manifest.json', { cache: 'no-store' })).json();
        const keep = new Set(manifest.files || []);
        const cache = await caches.open(AUDIO);
        for (const req of await cache.keys()) {
          const path = new URL(req.url).pathname.replace(/^.*?\/audio\//, 'audio/');
          if (keep.size && !keep.has(path)) await cache.delete(req);
        }
      } catch {
        /* offline: keep everything */
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // recordings: cache first, keep whatever we fetch. A 'reload' is the app trying again at a
  // sound that failed: fetch it afresh and replace the stored copy (unless we're offline).
  if (/\/audio\/.+\.(m4a|mp3|ogg|opus|webm)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(AUDIO);
        const stored = async () => (await cache.match(req, { ignoreSearch: true })) || (await caches.match(req, { ignoreSearch: true }));
        if (req.cache !== 'reload') {
          const hit = await stored();
          if (hit) return hit;
        }
        try {
          const res = await fetch(req);
          if (res.ok && res.status === 200) cache.put(req, res.clone());
          return res;
        } catch (e) {
          const hit = await stored();
          if (hit) return hit;
          throw e;
        }
      })(),
    );
    return;
  }

  // pages and the sound list: network first so updates arrive, cache when offline
  if (req.mode === 'navigate' || url.pathname.endsWith('/audio/manifest.json')) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(SHELL)).put(req.mode === 'navigate' ? 'index.html' : req, res.clone());
          return res;
        } catch {
          return (await caches.match(req.mode === 'navigate' ? 'index.html' : req, { ignoreSearch: true })) || Response.error();
        }
      })(),
    );
    return;
  }

  // everything else in the shell: serve cached, refresh in the background
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(req, { ignoreSearch: true });
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return hit || (await refresh) || Response.error();
    })(),
  );
});
