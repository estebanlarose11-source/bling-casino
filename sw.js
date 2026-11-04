// SpinBet Casino service worker: makes the site installable and opens it even on a weak connection.
// Pages are network-first (updates show up right away), the app's own images are cache-first.
const CACHE = 'spinbet-v36';
const CORE = ['./', './index.html', './manifest.webmanifest', './assets/icon-192.png', './assets/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Firebase, fonts: straight to the network
  const home = url.pathname === '/' || url.pathname.endsWith('/index.html');
  if (url.pathname.endsWith('.apk')) return; // the Android app: always the latest file, straight from the site
  if (url.pathname.endsWith('.mp4')) return; // videos are read in pieces (Range): the browser handles them itself
  // other pages (jeux/ for Google, google…html, ads/): straight to the network, never kept as the home page
  if (!home && (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/'))) return;
  if (home) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});

// Phone notifications (push.js on the site, sent by tools/push/send.mjs): { title, body, url, tag }.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'SpinBet Casino', {
    body: d.body || '',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    tag: d.tag || 'spinbet',
    renotify: !!d.tag,
    data: { url: d.url || './' },
  }));
});

// A tap on the notification: brings the open site forward on the right page, or opens it.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.registration.scope));
    if (open) return open.focus().then((c) => (c && 'navigate' in c ? c.navigate(url) : c));
    return self.clients.openWindow(url);
  }));
});
