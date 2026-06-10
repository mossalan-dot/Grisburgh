# PWA-opzet voor Grisburgh — implementatieplan

Doel: Grisburgh installeerbaar maken op telefoons (eigen icoon, fullscreen, splash,
nette offline-pagina) **zonder** de bestaande werking te raken. Tevens de fundering
voor een latere Capacitor-store-app.

Stack-context: Express serveert `public/` statisch; `index.html` is de SPA-shell;
cache-busting via `?v=N`; HTTPS al geregeld via Caddy (PWA vereist HTTPS — ✅).

---

## Bestanden die we toevoegen

### 1. `public/manifest.json`
```json
{
  "name": "Grisburgh",
  "short_name": "Grisburgh",
  "description": "D&D-campagnebeheer voor Grisburgh",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f2e8d2",
  "theme_color": "#c4a87a",
  "icons": [
    { "src": "/img/pwa/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/img/pwa/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/img/pwa/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 2. App-iconen → `public/img/pwa/`
Nodig:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-maskable-512.png` (512×512, met ~10% safe-zone marge rondom — voor Android adaptive icons)
- `apple-touch-icon.png` (180×180, voor iOS; aparte tag in `<head>`)

Bron: het bestaande Grisburgh-logo/zegel op een perkament/oker achtergrond.
Maskable-versie: logo gecentreerd met ruime marge (anders snijdt Android het bij).

### 3. `public/sw.js` (service worker — bewust simpel)
Strategie:
- **App-shell** (`index.html`, `theme.css`, `app.js`, iconen, fonts) → **stale-while-revalidate**
  of cache-first, zodat de app snel opent en zonder net niet crasht.
- **API (`/api/...`) en Socket.io (`/socket.io/...`)** → **network-only**, NOOIT cachen
  (realtime/DM-sync; gecachete spelersdata zou fout zijn).
- **Navigatie-fallback** → bij offline een nette `/offline.html` tonen i.p.v. een
  browserfout.
- Cache-naam met versienummer (bv. `grisburgh-shell-v1`); oude caches opruimen in
  `activate`. **Bump deze bij elke shell-wijziging** (sluit aan op het bestaande
  `?v=N`-ritme — zie CLAUDE.md).

Let op: SW moet vanaf de **root** geserveerd worden (`/sw.js`) om scope `/` te krijgen.

### 4. `public/offline.html`
Statische, in-stijl perkamentpagina: "Geen verbinding — Grisburgh heeft internet
nodig. Probeer het zo opnieuw." Geen JS/afhankelijkheden.

---

## Wijzigingen in `public/index.html` (`<head>`)
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#c4a87a">
<link rel="apple-touch-icon" href="/img/pwa/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Grisburgh">
```
En onderaan (na de bestaande scripts) SW-registratie:
```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
  }
</script>
```

---

## Server (Express) — kleine checks
- `manifest.json`, `sw.js`, `offline.html` worden al door de statische `public/`-serving
  geleverd — geen route nodig.
- `sw.js` bij voorkeur met `Cache-Control: no-cache` serveren zodat de browser een
  nieuwe SW snel oppikt (anders blijft een oude SW hangen). Eventueel een mini-route
  of header-config in `server.js`.
- Geen `pm2 restart` nodig (alleen statische bestanden), tenzij we header-config in
  `server.js` aanpassen.

---

## Valkuilen / wijsheid
- **Service worker + caching kan oude bestanden vastpinnen.** Daarom: API/socket nooit
  cachen, shell-cache met versienummer, en de SW zelf `no-cache` serveren. Bij twijfel
  tijdens dev: DevTools → Application → Service Workers → "Update on reload".
- **iOS-beperkingen:** geen automatische install-prompt (gebruiker doet het via het
  deel-menu in Safari); push-notificaties op iOS-PWA's zijn beperkt/laat geïntroduceerd.
  Voor volwaardige push → de Capacitor-stap.
- **Online-afhankelijk blijft online-afhankelijk:** de PWA verbetert opstart en geeft
  een nette offline-pagina, maar tovert geen offline-multiplayer.
- **Niet over-cachen in v1.** Begin met shell-cache + offline-pagina. Push, achtergrond-
  sync e.d. pas later (en deels pas zinvol in Capacitor).

---

## Volgorde van uitvoeren (klein → groot)
1. Iconen genereren (192/512/maskable/apple-touch) → `public/img/pwa/`.
2. `manifest.json` + `<head>`-tags toevoegen → test "Toevoegen aan beginscherm"
   (icoon + standalone werkt al, nog zonder SW).
3. `offline.html` + `sw.js` (shell-cache + network-only API + offline-fallback) +
   registratie.
4. Testen: Lighthouse PWA-audit (Chrome DevTools), installeren op een echte Android-
   en iPhone, offline-gedrag checken.
5. Versie-discipline: cachenaam-bump opnemen in het `?v=N`-deploylijstje in CLAUDE.md.

## Daarna (apart traject): Capacitor-store-app
- `npx @capacitor/cli init`, iOS + Android platform toevoegen, de site/build laden.
- Native toevoegen zodat Apple guideline 4.2 't doorlaat: splash, push-notificaties
  (DM-brief!), statusbalk-styling, deep links.
- Apple Developer ($99/jr) + Google Play ($25) + privacyverklaring + testaccount voor
  reviewers.
