# Code review — uitgebreid

**Datum:** 2026-05-27
**Branch:** `claude/grisburgh-code-review-WGRUg`

**Scope:**
- Eerste pass: diff `HEAD~5..HEAD` (laatste 5 commits, ~458 regels).
- Tweede pass: bredere audit op server-side (`server.js`, `routes/api.js`,
  `routes/auth.js`, `lib/storage.js`, `config.js`), client (`app.js`,
  `dm-panel.js`, `socket-client.js`), en render-/combat-modules
  (`combat-canvas.js`, `render-archief.js`, `render-campagne.js`,
  `render-dungeon.js`, `render-kaart.js`, `render-relatiemap.js`).
- Derde pass: `lib/snapshot.js`, alle `import-*.js`-scripts, en de
  test-suite (`tests/*.test.js`).
- **Niet geaudit:** `public/data/*` (content, geen code).

**Methode:** parallelle research-agents per risico-oppervlak (security,
XSS, race conditions, memory leaks, autorisatie), gevolgd door
hand-verificatie van de kritieke bevindingen.

---

## ⚠️ Belangrijke correctie vooraf: `lib/snapshot.js`

`lib/snapshot.js` (1756 regels) is **geen backup/rollback-systeem** maar
de **export-feature** voor spelers:

- `buildSnapshot()` → interactieve standalone HTML-bundel (alles inline,
  base64-images via `sharp`).
- `buildCampagneboek()` → printklaar boek (PDF via browser-print).

Twee actieve DM-knoppen hangen eraan (`public/js/dm-panel.js:764-786,
858-886`), die fetchen naar `routes/api.js:3531` (`GET /api/export`) en
`:3548` (`GET /api/export/campagneboek`), beide `requireDM`. Geen
state-restore, geen disk-snapshots die live data overschrijven.

**Verwijderen breekt:** "Snapshot downloaden" en "Campagneboek downloaden"
in het DM-paneel. Bug-audit op de file zelf vond niets kritieks
(filename-slug is veilig, geen file-handle leaks, geen race-paden). Wel:
in-memory generatie kan bij zeer grote campagnes een RAM-spike geven —
niet urgent.

---

## 🔴 Critical — security & data-integriteit

### 1. `_spellMd` injecteert ongeescapeerd HTML in `innerHTML`
**Locaties:** `public/js/app.js:3505`, `:4738`, `:4774`

`_spellMd()` (regel 1679-1704) doet alleen markdown-substituties op de raw
string en escapet niets. Hij wordt direct in een template literal gestopt
die als `innerHTML` wordt toegekend. Gebruikers-content gaat zonder filter
door.

- `_invRenderEntityDetail` (`:3505`): item `desc` (DM-bewerkbaar in
  inventaris).
- Spellbook-detail (`:4738`): `s.desc` uit lokaal opgeslagen spell.
- Dnd5eapi-fallback (`:4774`): externe API-content.

**Reproductie:** DM zet `<img src=x onerror=alert(1)>` in een item-`desc`.
Iedere speler die het voorwerp opent voert het script uit. Speler kan in
groepen waar DM ook spelers laat items beheren via de inventaris zelfs
zelf injecteren.

**Fix:** laat `_spellMd` zelf HTML escapen vóór markdown-substitutie
(zoals `mdToHtml` op `:1141` doet — die helper is wél veilig).

---

### 2. Quest-titel en -description in `render-archief.js` zijn niet veilig geescaped
**Locaties:** `public/js/render-archief.js:349-350`, `:406-408`, `:434`, `:438`

```js
349:  `<div class="quest-card-title">${q.title.replace(/</g,'&lt;')}</div>`
438:  `<textarea id="qm-desc" rows="3">${existingQuest?.description || ''}</textarea>`
```

Alleen `<` wordt vervangen, niet `>`, `&`, `"`, `'`. En regel 438 propt de
description ongeescaped in een `<textarea>` — een description die
`</textarea><img src=x onerror=...>` bevat breekt eruit. Quests zijn
zichtbaar voor spelers, dus zowel speler-DM als speler-speler is een
vector als de DM ooit een quest met malafide naam aanmaakt (bijv.
geïmporteerd uit een Obsidian-vault).

**Fix:** gebruik `esc()` consistent.

---

### 3. `esc()` escapet géén apostrof of backslash; namen met `'` injecteren JS in onclick-handlers
**Locaties:** `public/js/render-archief.js:1867`, `:2498`, `:613` en
soortgelijke patronen in `render-campagne.js`

```js
// public/js/app.js:1030
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// Maar:
`<div onmousedown="window._addLogTag('${field}','${esc(n)}')">`  // ← single-quoted!
```

Een NPC-naam zoals `O'Brien'); alert(1);//` ontsnapt rechtstreeks de
single-quoted JS-string.

**Goed nieuws:** `escJS()` bestaat al (`:1036`) en doet wel `\\` en `\'`.
**Fix:** vervang `esc(n)` door `escJS(n)` overal waar binnen een
single-quoted attribuut, of switch naar `addEventListener` met data-attrs.

---

### 4. Shop-feedback HTML komt ongeescaped op het scherm
**Locatie:** `public/js/render-campagne.js:2060`

```js
fb.innerHTML = `✓ ${aantal > 1 ? `${aantal}× ` : ''}<strong>${itemNaam}</strong> gekocht!`;
```

`itemNaam` komt uit DM-data. Item met naam `<img src=x onerror=...>` →
script bij elke speler die koopt.

**Fix:** `esc(itemNaam)`.

---

### 5. `GET /player-hp/:characterId` lekt HP van iedere speler
**Locatie:** `routes/api.js:1512`

```js
router.get('/player-hp/:characterId', attachRole, (req, res) => {
  const hp = (dmState.playerHp || {})[req.params.characterId] || ...;
  res.json(hp);
});
```

Geen ownership-check. Vergelijk met `PATCH /player-hp/:characterId` (regel
1518) die wél `req.role !== 'dm' && req.session.characterId !== characterId`
afdwingt. Inconsistent — `GET` ontbreekt de guard.

**Reproductie:** ingelogde speler doet `GET /api/player-hp/<andereCharId>`
en ziet die speler's HP.

**Fix:** voeg dezelfde guard toe als bij PATCH.

---

### 6. `POST /entities/:type/:id/shop-reveal` is door iedere speler aanroepbaar zónder shop-context
**Locatie:** `routes/api.js:493`

```js
router.post('/entities/:type/:id/shop-reveal', attachRole, (req, res) => {
  ...
  g.visibility[id] = 'visible';
  storage.writeJSON('dm-state.json', dmState);
  ...
```

`attachRole` rejecteert niemand, het zet alleen defaults. Comment zegt
"Toegankelijk voor spelers zodat klikken vanuit de winkel voldoende is",
maar er is geen check dat het voorwerp daadwerkelijk in een actuele shop
zit. Een speler kan elk verborgen voorwerp in `voorwerpen` globaal voor
zijn groep onthullen via één POST.

**Fix:** verifieer dat `id` zich op dit moment in een geopende shop in
deze groep bevindt (controleer `g.shops[*].items` o.i.d.). Of vereis een
shop-id in de body en check dat het voorwerp daarin zit.

---

### 7. `PATCH /player-currency/:characterId` — speler kan zichzelf rijk patchen
**Locatie:** `routes/api.js:1607-1622`

Geen DM-only-check, geen audit-trail, geen rate-limit. Speler doet
`PATCH /api/player-currency/<eigen-id>` met `{"fl":99999}` en is rijk.
Vervolgens uit shops kopen, gokken bij Tweespalt etc.

**Fix:** of DM-only maken, of een server-side audit-log + delta-cap.

---

### 8. `PUT /player-spellslots/:characterId` — speler zet `max` op willekeurige waarde
**Locatie:** `routes/api.js:1668-1687`

Geen upperbound, geen DM-gate. Speler patcht zichzelf naar 99 derde-level
slots → 99 fireballs.

**Fix:** klem `max` op een spelregel-sane waarde (bv. 4) of vereis
DM-rol voor `max`-wijzigingen.

---

### 9. `GET /combat` is ongeauth — anonieme bezoeker leest live monster-stats
**Locatie:** `routes/api.js:3356`

```js
router.get('/combat', (req, res) => {     // ← geen middleware
  ...
});
```

Geeft volledige `combat.json` terug, inclusief monster HP, AC, condities,
backdrop-id. Iemand op `grisburgh.nl/api/combat` (zonder login!) ziet
live wat er in initiatief staat.

**Fix:** `attachRole` of `requirePlayer` toevoegen. Players-only is OK.

---

### 10. `GET /files/:id` en `GET /thumb/:id` zijn ongeauth — guessable IDs lekken
**Locaties:** `routes/api.js:21` (thumb), `:2804` (files)

File-IDs zijn entity-IDs (`e_<timestamp>_<rand4>`) en voor monster-art
zelfs voorspelbaar (`{monsterId}_img`, `{monsterId}_bg`, `spell-img-{i}`).
Spelers met devtools (of via een gelekt ID in een ander endpoint) downloaden
portrait-art of monster-backdrops die nog niet zijn onthuld.

**Fix:** of `attachRole` + zichtbaarheid-check per entity, of UUIDs voor
file-storage zodat raden niet werkt.

---

### 11. Sessie-secret en wachtwoorden hebben hardcoded fallback
**Locaties:** `config.js:1-7`, `server.js:28-33`

```js
sessionSecret: process.env.SESSION_SECRET || '***VERWIJDERD***'
dmPassword:    process.env.DM_PASSWORD    || 'grisburgh-dm'
tabletPassword:                            || '***VERWIJDERD***'
```

Cookies: alleen `httpOnly` + `sameSite:'lax'`. Geen `secure:true`, geen
`maxAge`. Als `SESSION_SECRET` ooit ongezet wordt in prod (rebuild,
container restart, env-vergeten) zijn alle sessies forge-baar.

**Fix:** crash bij opstart als `NODE_ENV=production` én één van deze
secrets ontbreekt. Zet `secure: true` als het achter HTTPS draait.

---

### 12. Login-endpoints zonder rate-limit; password compare met `===`
**Locaties:** `routes/auth.js:14, 26` (DM, tablet), `:117` (group-password)

Geen rate-limit op `/api/auth/login`, `/auth/tablet-login`,
`/auth/sandbox-login`, `/auth/player-login`. Combineer met regel 11 →
brute-force op DM-wachtwoord is wide open.

**Fix:** `express-rate-limit` op auth-routes (5 pogingen / 15 min /
IP+username).

---

### 13. Socket-broadcast lekt DM-only data naar hele room
**Locatie:** `socket-client.js:34, 52, 86, 116, 335, 357, 407` en
emit-zijde `routes/api.js:479, 525-529, 601-605, 1174-1179`

De client filtert op `window.app.isDM()` voor toasts, maar de payload
zelf wordt aan **alle** sockets in de room gestuurd. Speler met
devtools-console: `window._socket.on('items:request', console.log)` ziet
realtime alle claims, alle reveals, alle notes (incl. groep waar hij niet
in zit — `entity:visibility` op `:479` heeft geen groupId-filter).

**Fix:** broadcast per-groep room (`io.to(`${campaignId}:${groupId}`)`)
en voor DM-only events: `io.to(`${campaignId}:dm`)` met DM-sockets in
die room.

---

### 14. `sound:emote` spoof — speler stuurt namens andere speler
**Locatie:** `server.js:98-100`

```js
socket.on('sound:emote', data => socket.to(campaignId).emit('sound:emote', data))
```

Geen validatie dat `data.entityId` bij deze socket hoort. Speler A:
`_socket.emit('sound:emote', {entityId: '<id-B>', emoteId: 'huil'})` → B's
naam staat boven het geluid bij alle anderen. Troll-vector, geen
data-leak.

**Fix:** server zoekt `socket.id` op in `playerSockets`, overschrijft
`entityId` met de geregistreerde characterId.

---

## 🟠 High — bugs die echt brokken maken

### 15. `_landingStartZoom` negeert `hasVideo`-parameter (eerste pass)
**Locatie:** `public/js/app.js:746-842`

`hasVideo` doorgegeven via 4 functies, nergens gebruikt. Video-tag wordt
altijd aangemaakt → 404 + 800ms wachten voor karakters zonder video.

**Fix:** guard rond `<video>` op `:779-781`, dan grijpt de `if (!vid)`-tak
op `:833` (1000ms) het netjes af.

---

### 16. "+ notitie"-knop toont voor DM maar `_invSaveNote` faalt stil (eerste pass)
**Locaties:** `public/js/app.js:3445` (toon), `:3362` (silent return)

Knop zichtbaar voor DM, `_invSaveNote()` doet `if (!charId) return;` →
DM klikt, vult in, niets gebeurt.

**Fix:** of knop verbergen voor DM, of een DM-pad bouwen.

---

### 17. Speler zonder groep ziet items van DM's actieve groep (eerste pass)
**Locatie:** `routes/api.js:1105`

Player-zonder-groep valt door naar `getGroup(dmState)` = actieve DM-groep.

**Fix:** lege response bij `!playerGroupId`, of validatie dat spelers
altijd een geldige groep hebben.

---

### 18. `${icon}` ipv `${_attIcon}` — functie-source als HTML in attunement-swap
**Locatie:** `public/js/app.js:4414`

```js
const _attIcon = _ATT_TYPE_ICON[it.data?.itemType] || icon('sparkles');
return `<button ...>
  <span>${icon}</span> ${esc(it.name)}        // ← icon ipv _attIcon
</button>`;
```

`icon` is een globale functie (`:18`); JS coerced naar string ⇒ functie-source
in de DOM. Open attunement-swap popup met overflow-items → letterlijk
`(...a) => window.icon(...a)` in elke knop ipv het ikoon.

**Fix:** `${_attIcon}` ipv `${icon}`.

---

### 19. `_gockCheckReady` gebruikt undefined `req` — feature crasht stil
**Locatie:** `routes/api.js:3765-3766`

Helper is `function _gockCheckReady(dmState, io)` maar body verwijst naar
`req.session?.campaignId`. `ReferenceError` zodra een Gock-investigation
met secret-bearing entity afrondt; reveal mislukt zonder spoor.

**Fix:** geef `campaignId` als param mee, of haal het uit de aanroepers
en pass door.

---

### 20. Read-modify-write op `dm-state.json` zonder lock — lost updates
**Locatie:** `lib/storage.js:120-130`

`readJSON` + JS-mutate + `writeJSON` is nergens geserialiseerd. Twee
gelijktijdige requests (DM tikt items, speler claimt; twee spelers
betalen tegelijk in shop; gevecht-tick + currency-update) overschrijven
elkaars wijzigingen.

**Reproductie:** twee spelers doen tegelijk `POST /shops/:shopId/koop`,
één van de twee aankopen verdwijnt uit `playerItems` maar de currency
is wel afgetrokken.

**Fix:** een per-filename mutex (Map<filename, Promise> chain). Klein
patchje, hoge impact.

---

### 21. Onbegrensde tekst-velden van spelers in `dm-state.json` (DoS via bloat)
**Locaties:** `routes/api.js:1548-1565` (player-items), `:1937-1962`
(player-spells), `:2037` (trait-note — wél `.slice(0,2000)`)

Op `POST /player-items` gaan `name`, `note` ongeclipt naar disk. Speler
post een 4 MB `note` 10× → `dm-state.json` is nu 40 MB en elke
read-modify-write parsed dat (zie #20 — read+write keten).

**Fix:** input length limits (bv. `name.slice(0,200)`, `note.slice(0,5000)`)
in alle player-POST/PATCH endpoints.

---

### 22. Asynchroon accordion-toggle race in spellbook
**Locatie:** `public/js/app.js:4713-4781` en `:4833-4889`

`details.addEventListener('toggle', async () => { ... await fetch(...);
body.innerHTML = ...; })`. Tussen `await` en `innerHTML` kan de gebruiker
sluiten/heropenen, of een re-render maakt `body` los van de DOM. Spinner
blijft hangen, content komt nooit.

**Fix:** check vóór `innerHTML` of `body.isConnected`, of gebruik een
`AbortController` per toggle.

---

### 23. State-lek bij DM → speler-rolwissel in dezelfde tab
**Locatie:** `public/js/app.js:367-378` (`logout`)

Caches in `dm-panel.js` blijven in geheugen: `_monsters`, `_combat`,
`_lastCombat`, `_tables`, `_berichtenData` (incl. geheime berichten per
characterId), `_sjablonen`, `_rbScript`, `_revealQueue`, `_spellList`,
`_encounters`, `_setupPersonages`, en `window._dmPanelTunnelUrl`.

UI verbergt DM-paneel via `.hidden`, maar in devtools is alles uitleesbaar.

**Fix:** `location.reload()` na rolwissel (zoals al gebeurt bij
`campaign:switched` in `socket-client.js:434, 441`).

---

### 24. Bestandsuploads: geen file-type validatie (server én client)
**Locaties:** `routes/api.js:14` (multer config), `dm-panel.js:672, 1972, 3815`

`multer({ limits: { fileSize: 50MB }})` zonder `fileFilter`. Server haalt
extensie uit door-client-bepaalde `mimetype`. DM kan per ongeluk PSD,
WebM, of een verkeerd-getypeerd bestand uploaden — geen magic-byte sniff.

Aanvalsoppervlak klein (alleen DM kan uploaden), maar `dm-state.json`
+ disk vol-lopen is wél een risico.

**Fix:** `fileFilter` met whitelist (image/jpeg, image/png, image/webp,
audio/mpeg, audio/ogg, video/mp4), magic-byte sniff voor zekerheid, en
size-limit per upload-type.

---

## 🟡 Medium — correctheid & onderhoudbaarheid

### 25. `_dashChargeToggle/_dashQtyAdj/_dashMaxChargeAdj` accepteren `charId` van caller
**Locaties:** `public/js/app.js:5282, 5521, 5532`

```js
window._dashQtyAdj = (itemId, characterId, delta, ...) => {
  api.patchItemOwnerQty(itemId, characterId, delta);
}
```

`characterId` komt uit een onclick-string in de HTML; speler kan via
devtools `window._dashQtyAdj('item123', 'andermansCharId', -99, 1)`
aanroepen. De server **moet** dit zelf bewaken (en doet dat hopelijk —
check `PATCH /items/owners/:itemId/qty`!), maar er is geen client-side
sanity check. Vergelijk met `_invSaveNote` (`:3361`) die wél altijd
`state.characterId` gebruikt.

**Actie:** verifieer in `routes/api.js` dat `req.session.characterId`
de characterId in de URL overschrijft of dat de check `req.role === 'dm'
|| req.session.characterId === <eigenaar>` echt overal staat.

---

### 26. `_images` cache in `combat-canvas.js` groeit monotoon
**Locatie:** `public/js/combat-canvas.js:74, 195-211`; `_stop()`: `:133-141`

Image-objects worden toegevoegd, nooit verwijderd. Lange DM-sessie met
veel monster-wisselingen → tientallen MB`s in geheugen via gedecodeerde
HTMLImageElements.

**Fix:** in `_stop()` `_images = {}` zetten. Of na elke `_updateState`
de niet-meer-actieve ids opruimen.

---

### 27. Canvas mouse-coords negeren CSS-transforms op parent
**Locatie:** `public/js/combat-canvas.js:1232-1271`

`getBoundingClientRect()` geeft post-transform size; `_hitAreas` gevuld
in `_canvas.offsetWidth`. Als parent ooit een `transform: scale(...)`
krijgt (fit-to-screen-modus o.i.d.) raken klikken verschoven.

**Fix:**
```js
const sx = rect.width / _canvas.offsetWidth;
const sy = rect.height / _canvas.offsetHeight;
const mx = (e.clientX - rect.left) / sx;
const my = (e.clientY - rect.top) / sy;
```

---

### 28. Touch-tap selecteert combatant niet betrouwbaar op tablet
**Locatie:** `public/js/combat-canvas.js:1252-1255`

`_onTouch` (`touchstart`) roept alleen `_onMouseMove` aan; er is geen
`touchend` die `_onClick` triggert. Browsers wisselen of de synthetic
click op de canvas-container doorkomt.

**Fix:** voeg `touchend` toe die `_onClick` aanroept met laatste
touch-coords.

---

### 29. `_invSaveNote` doet `result.id` zonder null-check
**Locatie:** `public/js/app.js:3364-3365`

`await api.addPlayerItem(...)` kan `undefined`/`null`/`{}` terugeven
(204 No Content, body parse mislukt). Crash wordt opgevangen door
`catch`, maar UI raakt uit sync (toggle blijft open, input behoudt
content) zonder foutmelding.

**Fix:** check `if (!result?.id) { /* tonen foutmelding */ return; }`.

---

### 30. Veel volledige re-renders per socket-event
**Locatie:** `public/js/socket-client.js:18, 29, 82, 127, 310-314, 328`

Elke item-actie → 2 volledige `refreshSection`-calls per client. Tijdens
gevecht-ticks merkbaar als haperingen op tablets.

**Fix:** patch-renders (alleen de veranderde rij/kaart updaten), of
debounce `refreshSection` per sectie.

---

### 31. `_playerGroupId` doet disk-I/O per `/items/ownership`-call (eerste pass)
**Locatie:** `routes/api.js:127-134`

Leest `entities.json` opnieuw bij elke polltick van elke speler.

**Fix:** cache `entities.json` met dirty-flag, of bewaar `groep` in
`req.session` bij `/player-login`.

---

### 32. Globale state-overlap: `window._currentDetailId`, `_currentDetailTab`
**Locaties:** `render-campagne.js` en `render-archief.js` beide

Beide modules schrijven/lezen overlappende `window._*` keys zonder
duidelijk eigenaarschap. Sluit-actie van module A kan verkeerd
geïnterpreteerd worden door module B.

**Fix:** namespace per module (`window._archiefDetail = {...}` vs
`window._campagneDetail = {...}`), of een centrale `state`-store.

---

### 33. `_dashOpenPortraitVideo` lekt video-element bij re-render
**Locatie:** `public/js/app.js:4960-4977`

`<video>` aangemaakt en `appendChild`'d zonder ooit verwijderd te worden
bij re-render van `renderMijnKarakter`.

**Fix:** check eerst of er al een video-element bestaat, vervang of
verwijder.

---

### 34. `_lastEditorKeyFn` als gedeelde global tussen editors
**Locatie:** `public/js/render-campagne.js:2915-2924`

`window._lastEditorKeyFn` = één Ctrl+S-handler voor alle editors. Als
ooit een tweede editor (archief, dungeon) hetzelfde keypatroon
registreert, overschrijft hij stilletjes; sluitende editor verwijdert
de verkeerde listener.

**Fix:** per editor een eigen closure of een keyed Map.

---

## 🔵 Low — cleanup & efficiency

### 35. Dode CSS voor verwijderde markup (eerste pass)
**Locatie:** `public/css/theme.css:15551, :15626, :15964-15966`

`.inv-lh-type`, `.inv-row-type`, `.inv-beurs-coin/gold/silver/copper` —
markup is weg, selectors blijven hangen met `display: none`.

---

### 36. `hasVideo`-plumbing door 4 functies is dode code (eerste pass)
**Locaties:** `public/js/app.js:678, 693, 712, 720, 729, 746`

Schrap de keten ofwel benut hem (zie #15).

---

### 37. Rotatie-array kan een formule zijn (eerste pass)
**Locatie:** `public/js/app.js:3475-3477`

15-element array doet hetzelfde als `((seed % 11) - 5) * 0.96`. Cosmetisch.

---

### 38. `_attOpenSwap` lekt zwakke document-click handler
**Locatie:** `public/js/app.js:4419-4421`

`document.addEventListener('click', _close)` na `setTimeout(...,0)` blijft
hangen als popup voortijdig weggehaald wordt — `popup.remove()` is no-op
maar handler blijft staan.

**Fix:** registreer de listener pas wanneer de popup daadwerkelijk in
de DOM is, en verwijder hem in een `MutationObserver` op popup.

---

### 39. `pre-init` event-handler op `#lightbox` zonder optional chaining
**Locatie:** `public/js/app.js:1015`

`$('#lightbox').addEventListener(...)` op top-level zonder `?.`. Als het
element ooit weggehaald wordt blokkeert dit de init van het hele
bestand.

**Fix:** `?.addEventListener` (zoals op `:6482` wél staat).

---

### 40. Mouseover-listener van campagne-tooltip wordt bij HMR gestapeld
**Locatie:** `public/js/render-campagne.js:75-93`

`document.addEventListener('mouseover', ...)` op module-load is fine
in productie, maar bij hot-reload (vite/parcel/dev-server) stapelt het.
Geen prod-issue.

---

### 41. `_playerSpellList` cache zonder lock
**Locatie:** `public/js/app.js:4748-4752`

Twee tegelijk geopende spellbook-accordions doen beide een fetch.
Onbetekend, maar symptomatisch voor het bredere shared-globals-patroon.

---

## 🟠 High — derde pass (import-scripts & test-suite)

### 42. CLI import-scripts schrijven naar legacy data-pad → silent no-op
**Locaties:** `import-obsidian.js`, `import-schaduwvin.js`, `import-verhaal.js`

Alle drie scripts schrijven hardgecodeerd naar
`__dirname/data/entities.json` (en `data/dm-state.json`, `data/archief.json`).
Maar `lib/storage.js` is sinds de multi-campaign refactor verschoven naar
`data/campaigns/<id>/…`. Een DM die deze scripts vandaag draait vult een
legacy data-pad dat de server **niet meer leest** — vanuit de webapp is
het een stille no-op. Geen foutmelding, gewoon: "ik importeerde 200
NPC's maar in de app zie ik er nul".

**Status:** levende workflow voor DM via knop "Bestanden kiezen…"
(`public/js/dm-panel.js:810-855`) gaat via `POST /api/import/obsidian`
+ `_importMd` in `routes/api.js:2097-2215` — die loopt wél door
`lib/storage.js` en is dus campaign-aware. Dus de scripts zijn dubbel
geïmplementeerd: de webapp-route werkt, de CLI-scripts zijn stilletjes
kapot.

**Fix-keuze:**
- **Optie A — opruimen:** verwijder de drie CLI-scripts; de webapp-route
  vervangt ze.
- **Optie B — repareren:** laat ze via `lib/storage.js` (met
  `withCampaign(id, () => ...)`) schrijven; vereist refactor.

Optie A is veruit het simpelst en consistent met "app staat online,
één bron-van-waarheid".

---

### 43. `import-obsidian.js` gebruikt verouderd `dm-state` schema
**Locatie:** `import-obsidian.js:241`

```js
dmState.visibility[id]    = 'hidden';
dmState.secretReveals[id] = false;
```

Het huidige schema is `dmState.groups[groupId].visibility/secretReveals`
(zie `routes/api.js:2233-2241`). Zelfs als #42 wordt opgelost en het pad
klopt, schrijft dit script in een plat oud schema dat geen enkele groep
raakt. Imports zijn voor alle groepen `'hidden'` (default `undefined`
op `groups[*].visibility`) — kaartjes verschijnen nergens tot de DM ze
handmatig zichtbaar maakt.

`import-schaduwvin.js:563-571` doet het **wél correct** (loopt door
`dmState.groups`). Dus de fix bestaat al in een ander script — copy-paste.

**Fix:** of bij keuze "opruimen" (#42), of port de loop uit
`import-schaduwvin.js`.

---

### 44. Test-suite is grotendeels gebroken
**Locaties:** `tests/storage.test.js`, plus afhankelijkheidsketen

`npm test` → exit 1. Resultaten: **5 pass, 1 fail, 26 cancelled**.

Twee oorzaken:
1. **`node_modules` ontbreekt** in deze container — `require('express')`
   faalt → `api.test.js` en `filter.test.js` worden gecancelled. Wordt
   opgelost door `npm install`. Aanrader: SessionStart-hook die
   `npm install` doet als `node_modules/` ontbreekt.
2. **`storage.test.js` is achterhaald.** Verwacht `data/entities.json`
   bestaat — maar `lib/storage.js` schrijft tegenwoordig naar
   `data/campaigns/grisburgh/entities.json`. Test #1 faalt; tests #2-6
   slagen toevallig omdat ze read-back via dezelfde storage-API doen.

**Fix:** update `storage.test.js` voor het multi-campaign pad
(`path.join('data','campaigns','grisburgh','entities.json')`), en zet
`npm install` in de SessionStart-hook.

---

### 45. Test-coverage mist alle player-scoped endpoints
**Locatie:** `tests/api.test.js`

De suite dekt happy-paths van `/entities`, `/archief`, `/dm/notes`,
login. **Niet** gedekt — terwijl exact daar de critical-findings
zitten:

- `/player-hp`, `/player-currency`, `/player-spellslots` (cross-player
  leak / self-enrich) — bevindingen #5, #7, #8.
- `/shop-reveal` zonder shop-context — bevinding #6.
- `/combat` ongeauth — bevinding #9.
- `/files/:id`, `/thumb/:id` ongeauth — bevinding #10.
- Upload-validatie (#24).
- Storage race-conditions (#20).
- Socket.io DM-leak (#13), `sound:emote`-spoof (#14).

**Minstens 12 van de 41 bevindingen** in deze review zou een geschreven
test hebben gevangen vóór deploy.

**Fix:** drie nieuwe testfiles, in volgorde van waarde:
1. `tests/player-auth.test.js` — voor elke `/player-*`-route: speler A
   mag B niet lezen/schrijven; clamp-validatie van numerieke velden.
2. `tests/storage-race.test.js` — 50 parallel PATCHes naar dm-state,
   assert final count == 50.
3. `tests/sockets.test.js` — DM-only events bereiken speler-room niet;
   `sound:emote` accepteert geen gespoofte `entityId`.

---

## 🟡 Medium — derde pass

### 46. CLI import-scripts lossen geen lock met draaiende server
**Locatie:** `import-obsidian.js`, `import-schaduwvin.js`, `import-verhaal.js`

Zelfs als #42 + #43 zijn opgelost, doen deze scripts `readFileSync` +
mutate + `writeFileSync` zonder coördinatie met de draaiende server. Als
de DM tijdens een sessie een script start, kan elke gelijktijdige
`storage.writeJSON` van de server (currency-update, HP-tick) het script
overschrijven — buiten request-context. Geen documentatie dat de server
gestopt moet zijn.

**Fix:** als de scripts blijven, log een waarschuwing als de server
draait, of verifieer afwezigheid van een lock-file.

---

### 47. Tests draaien op echte `./data` zonder isolatie
**Locatie:** `tests/storage.test.js`, `tests/api.test.js`

Setup doet `fs.rmSync(DATA_DIR)` voor en na. Als een test crasht laat
hij `data/` in een vieze tussenstand achter. Gevaarlijker: als iemand
per ongeluk de tests draait in een omgeving met productie-data wordt
die weggegooid.

**Fix:** gebruik `os.tmpdir() + '/grisburgh-test-' + Date.now()` per
testrun; mock geen disk maar isoleer hem.

---

### 48. `import-spells-2024.js` vertrouwt SrD-input blind
**Locatie:** `scripts/import-spells-2024.js`

Schrijft `public/data/spells-2024.json`, een statische asset gedeeld
over alle campagnes. Geen versie-pinning, geen hash van de bron, geen
validatie dat `level/school/classes` geldig zijn — `parseInt(NaN)`
wordt geaccepteerd. Een corrupt of mismaakt PHB-bestand maakt de hele
spellbook stuk voor iedereen.

**Status:** dit script is wél actief — de output wordt door `app.js:2737`
en `:5754` geserveerd. Behouden, maar:

**Fix:** voeg input-validatie toe (level 0-9, school in whitelist,
classes in known-list) en faal de import bij een ongeldige spell ipv
hem stilletjes mee te exporteren.

---

## ℹ️ Geen issue (gecheckt en weggestreept)

- **`/party` voor DM** is correct: `routes/api.js:1761` returnt vroeg.
- **`data-portrait-video` → `dataset.portraitVideo`** mapping klopt.
- **Path traversal via `groepId`**: groep-IDs worden eerst in
  `dmState.groups[id]` opgezocht; geen pad-bytes naar disk.
- **XSS via stored player content (algemeen)**: meeste player-velden
  gaan door `esc()`. Restproblemen staan in #1-#4.
- **`mdToHtml` op `:1141`** escapet zelf — gebruik daarvan is veilig.
- **`lib/snapshot.js`** is geen rollback-systeem maar de export-feature
  voor spelers (zie correctie bovenin). Veilig, geen kritieke bugs.

---

## Volgorde van aanpakken (suggestie)

**Eerste week — security-bleeders:**
1. `#5` (HP-leak) — eenliner.
2. `#7`, `#8` (currency/spellslots) — speler kan zichzelf overbuffen.
3. `#9` (combat ongeauth) — eenliner.
4. `#1`, `#2`, `#3`, `#4` (XSS-spots) — gebruik `esc()`/`escJS()` consistent.
5. `#11`, `#12` (secrets + rate-limit) — productie-hardening.

**Tweede week — correctheid:**
6. `#15`, `#16`, `#17` (laatste-5-commits-restjes).
7. `#18` (`${icon}` bug) — eenliner.
8. `#19` (`_gockCheckReady` crash) — feature herstellen.
9. `#20` (storage mutex) — fundamenteel; pakt #21 grotendeels op.
10. `#42`, `#43` — CLI import-scripts: kies opruimen of repareren.

**Derde week — opschoning & test-veiligheid:**
11. `#23` (state-lek), `#26` (image cache), `#28` (touch-tap).
12. `#44` (test-suite repareren) + `#45` (drie nieuwe testfiles
    schrijven), zodat fixes uit week 1-2 niet stilletjes regresseren.
13. Restant van Medium/Low in één rondje.

---

## Wat niet beoordeeld is

- `public/data/*.json` — content, geen code.
- De socket-emit-zijde voor minder-kritieke events (`pin:*`, `notes:*`)
  is steekproefsgewijs gecheckt; niet uitputtend.

Daarmee is de codebase nu **volledig in scope geweest** behalve de
content-data. Voor toekomstige reviews na grote refactors: laat de
test-suite (na fix van #44) eerst groen draaien, doe dan een
diff-gerichte review op de feature.
