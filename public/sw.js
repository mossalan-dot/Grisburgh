// sw.js — minimale service worker.
// Doel: de app installeerbaar maken (Android vereist een service worker met een
// fetch-handler). BEWUST geen caching: deze app update vaak via ?v=-versienummers;
// agressief cachen zou ná een deploy oude code blijven serveren (klassieke PWA-valkuil).
// Daarom: alleen navigatieverzoeken via het netwerk, de rest laat de browser zelf doen.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request));
  }
  // overige requests: geen respondWith → normale browserafhandeling (netwerk + HTTP-cache)
});
