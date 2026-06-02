# Grisburgh — CLAUDE.md

D&D-campagne-manager: Node/Express backend, vanilla JS frontend (ES-modules),
Socket.io voor realtime updates. Geen framework, geen bundler.

> **Wachtwoorden** staan in `CLAUDE.local.md` (gitignored, niet op GitHub).

---

## UI & campagne-afspraken

- **Taal: altijd Nederlands.** Labels, knopteksten, toastberichten, foutmeldingen — alles NL.
  Engelse D&D-termen (cantrip, feat, ASI, proficiency) zijn toegestaan als er geen gangbare NL-vertaling is.
- **Geen destructieve DM-acties zonder expliciete bevestiging.** Verwijderen, resetten en
  overschrijven altijd via `confirm()` of een zichtbare knop die de actie beschrijft.
  Nooit stilletjes iets wissen op basis van een impliciet pad.
- **Perkament/middeleeuws thema bewaken.** Geen moderne UI-patronen die het thema doorbreken.
  Fonts: Cinzel (koppen), Crimson Text (broodtekst), IM Fell English (cursieve notities).
  Kleuren: warme okertinten (`#c4a87a`, `#f2e8d2`, `#2a1a08`). Geen vlakke Material/Bootstrap-look.
  Icoontjes via `icon()`, nooit emoji in gerenderde HTML.

---

## Testomgeving

**Testgroep:** Groep 3 (ID: `groep_1777039899017_94g1`)

| Karakter | ID | Klasse |
|---|---|---|
| Test McTestface | `e_1778689148089_pypw` | Wizard L7, subklasse Evoker |
| Dummy Drakenbaard | `e_test_1779133509945_f2rbc` | — |
| Proto Toverstaf | `e_test_1779133509946_yzhly` | — |

**Browser-testlogin** (als speler): `window.app.testLogin()` → wachtwoord + karakterkeuze.
Wachtwoord groep 3: zie `CLAUDE.local.md`.

**Aandachtspunt sessie-cookies:** DM en speler kunnen niet tegelijk in dezelfde browser ingelogd zijn.
Gebruik tab 1 voor DM, open een incognito-venster of ander apparaat voor de spelerstestlogin.

---

## Server & Deploy

**Productie-server:** `root@46.224.156.154`  
**Pad:** `/var/www/grisburgh/`  
**Proces:** PM2, naam `grisburgh`, poort 3000 (Caddy reverse proxy → grisburgh.nl)

### Deploy-workflow (standaard)

```bash
# JS bestanden
scp "public/js/app.js" "public/js/dm-panel.js" root@46.224.156.154:/var/www/grisburgh/public/js/

# CSS
scp "public/css/theme.css" root@46.224.156.154:/var/www/grisburgh/public/css/

# HTML
scp "public/index.html" root@46.224.156.154:/var/www/grisburgh/public/

# Server-side (routes/api.js, lib/, server.js, config.js)
scp "routes/api.js" root@46.224.156.154:/var/www/grisburgh/routes/

# Herstart (altijd na server-side wijzigingen)
ssh root@46.224.156.154 "pm2 restart grisburgh"
```

Bij nieuwe JS-bestanden ook het `public/data/`-mapje deployen als daar bestanden bij zitten.

---

## Versienummers — ALTIJD bumpen bij deploy

De app gebruikt querystring cache-busting (`?v=N`). **Vergeten = browser haalt oud bestand op.**

### Waar staat wat

| Bestand | Versie staat in |
|---|---|
| `public/css/theme.css` | `public/index.html` → `theme.css?v=N` |
| `public/js/app.js` | `public/index.html` → `app.js?v=N` |
| `public/js/dm-panel.js` | `public/js/app.js` → `import … dm-panel.js?v=N` |
| `public/js/render-progressie.js` | `public/js/app.js` → `import … render-progressie.js?v=N` |
| `public/js/render-campagne.js` | `public/js/app.js` → `import … render-campagne.js?v=N` |
| `public/js/render-archief.js` | `public/js/app.js` → `import … render-archief.js?v=N` |
| `public/js/api.js` | `public/js/app.js` → `import … api.js?v=N` |
| overige render-*.js, socket-client.js | idem in app.js |

**Huidige versies (bij te houden):**

```
index.html  : theme.css?v=214   app.js?v=269
app.js      : api.js?v=222      render-campagne.js?v=81   render-archief.js?v=32
              render-kaart.js?v=3  render-dungeon.js?v=18  render-relatiemap.js?v=10
              glossary.js?v=1   render-progressie.js?v=3   socket-client.js?v=13
              dm-panel.js?v=52
```

---

## Projectstructuur

```
server.js              Express + Socket.io entry point
config.js              PORT, sessionSecret, dmPassword (uit env)
lib/storage.js         Lees/schrijf JSON-bestanden, per-campagne via AsyncLocalStorage
lib/api.js             (lib/snapshot.js is legacy, niet meer in gebruik)
routes/api.js          Alle REST-endpoints (~3000 regels)
routes/auth.js         Login (DM + speler), session
public/
  index.html           SPA shell, Tailwind CDN, alle <script> imports
  css/theme.css        ~17k regels custom CSS (geen Tailwind in CSS)
  js/
    app.js             ~8k regels: spelerstabblad, dice, tempel, diensten, state
    dm-panel.js        DM-configuratiepaneel
    render-campagne.js Entiteitskaartjes, detail-modals, zoeken
    render-progressie.js Skill trees / klasse-progressie
    render-archief.js  Documenten, logboek
    render-kaart.js    Leaflet-kaart met pins
    render-dungeon.js  Dungeon-kaarten
    render-relatiemap.js Cytoscape relatienetwerk
    api.js             Client-side API wrapper (fetch)
    socket-client.js   Socket.io client
    dm-panel.js        DM-configuratiepaneel
  data/
    class-progression.json  Seed-data voor skill trees (12 klassen, 13 soorten)
  img/
    icons.svg          Lucide SVG-sprite (zie iconlijst hieronder)
data/
  campaigns/
    grisburgh/         Actieve campagne (entities.json, dm-state.json, …)
    prewett/           Tweede campagne
    sandbox/           Demo-omgeving (reset bij opstart)
```

### Data-bestanden per campagne

| Bestand | Inhoud |
|---|---|
| `entities.json` | personages, locaties, organisaties, voorwerpen |
| `dm-state.json` | groepen, zichtbaarheid, playerProfiles, playerItems, combat, tempel-config, … |
| `archief.json` | documenten, logEntries, sessieLog, brieven |
| `combat.json` | actief gevecht, combatants |
| `map.json` | kaartpins |
| `monsters.json` | monster-statblokken |
| `encounters.json` | vooraf gebouwde encounters |
| `sounds.json` | geluidsbibliotheek + emotes |
| `tables.json` | willekeurige tabellen |
| `meta.json` | campagnenaam, thema, valuta, spellSource |
| `relations.json` | relatienetwerk (edges, posities) |
| `dungeon-maps.json` | dungeon-kaarten |
| `player-notes.json` | per-speler notities |

---

## Icon-systeem

```javascript
// Helper beschikbaar als window.icon() overal in de frontend
icon('sword')                         // → <svg><use href="/img/icons.svg?v=3#icon-sword"/></svg>
icon('heart', { cls: 'icon-lg' })     // met extra CSS-klasse
icon('shield', { title: 'Verdediging' }) // met tooltip
```

**Beschikbare iconen** (icons.svg, v=3):
`beer` `book-open` `building` `camera` `castle` `check` `check-circle`
`chevron-left` `chevron-right` `church` `clipboard-list` `coins` `crossed-swords`
`dice` `download` `eye` `eye-off` `flask-conical` `folder-open` `globe`
`heart` `hexagon` `house` `image` `landmark` `link` `lock` `lock-open`
`mail` `map` `map-pin` `maximize-2` `message-circle` `minus` `monitor`
`moon` `mountain` `mouse-pointer-2` `open-book` `package` `paw-print`
`pencil` `pin` `play` `plus` `potion` `refresh-cw` `save` `scroll-text`
`search` `settings` `shield` `skull` `sparkles` `square` `star` `stiletto`
`sword` `swords` `target` `trash` `tree-pine` `user` `users` `volume-2`
`x` `zap`

**Nooit emoji gebruiken in HTML-output.** Altijd `icon()` of Unicode-tekens die een functionele staat hebben (★/☆ voor favorieten).

---

## Authenticatie & rollen

- **DM:** POST `/api/auth/login` met `{ password }` → sessie krijgt `role: 'dm'`
- **Speler:** POST `/api/auth/player-login` met `{ characterId, password }` → sessie krijgt `characterId`
- **Testlogin (browser):** `window.app.testLogin()` → overlay met wachtwoord + karakterkeuze
- **DM-wachtwoord productie:** staat in PM2-env als `DM_PASSWORD` (niet in code)
- **Groepswachtwoord:** staat in `dm-state.json` → `groups[groepId].password`

Sessies worden gedeeld per browsertab (één cookie). DM en speler kunnen **niet** tegelijk in dezelfde browser ingelogd zijn.

---

## Campagnes & scoping

Storage gebruikt `AsyncLocalStorage` voor per-request campagne-scoping:
- Actieve campagne: `storage.getActiveCampaignId()` (standaard `'grisburgh'`)
- Sandbox: sessie heeft `campaignId: 'sandbox'` → alle opslag gaat naar `data/campaigns/sandbox/`
- Per-request override: `storage.runInCampaign(id, next)` in de Express middleware

---

## Socket.io rooms

Elke verbinding joint de room `campaignId` (of `'main'` als er geen sessie-campagne is).
`io.to(campaignId).emit(...)` stuurt naar alle clients in dezelfde campagne.

Spelers registreren hun `characterId` via `socket.emit('player:register', characterId)`.
De DM kan directe berichten sturen via `playerSockets.get(characterId)`.

---

## Spelerstabblad — subtabs

Volgorde: **Party → Personage → Boedel → Progressie → Spreukenboek → Berichten**

Lazy rendering: subtab-panels worden pas gevuld als de tab actief wordt (via `_setPlayerSubTab`).
Context voor lazy render staat in `window._lastPlayerProfile`, `window._lastPlayerEntity`, `window._lastCharId`.

---

## Skill trees / Progressie

- Data: `GET/PUT /api/progression` (DM-only voor schrijven)
- Seed: `public/data/class-progression.json` (12 klassen, 13 soorten — 2024 PHB)
- Klassenamen: Engels, case-insensitief, aliassen ondersteund
- Subklasse-matching: fuzzy (`includes`-check in beide richtingen)
- Keuze-features: `feat.choice: true` of `_kind: 'shared'` (ASI, Epic Boon)
- Keuzes opgeslagen in `playerProfile.featChoices` (JSON-string: `{ featKey → tekst }`)
- featKey-formaat: `"KlasseNaam|level|FeatureNaam"`

---

## Zeldzaamheid (rarity) voor voorwerpen

Veld: `entity.data.rariteit` (NL of EN, genormaliseerd via `_rarityKey()` in render-campagne.js)

| Waarde | CSS data-attribuut | Kleur |
|---|---|---|
| Common / Gewoon | `data-rarity="common"` | grijs |
| Uncommon / Ongewoon | `data-rarity="uncommon"` | groen |
| Rare / Zeldzaam | `data-rarity="rare"` | blauw |
| Very Rare / Zeer zeldzaam | `data-rarity="very-rare"` | paars |
| Legendary / Legendarisch | `data-rarity="legendary"` | goud |

---

## Veelgemaakte fouten

- **Vergeten versie te bumpen** → browser toont oude JS/CSS. Check altijd index.html + app.js imports.
- **`api.getEntities()` bestaat niet** → gebruik `api.listEntities('personages')` etc.
- **Emoji in HTML-output** → vervang door `icon()`. Emoji zijn onaanvaardbaar in de UI.
- **`sed` met speciale tekens op de server** → schrijf een tijdelijk .js-bestand en voer dat uit met `node`.
- **DM en speler dezelfde browser** → session cookie gedeeld. Gebruik incognito of ander apparaat voor gelijktijdig testen.
- **Socket-event naar verkeerde campagne** → altijd `io.to(campaignId).emit()`, nooit `io.emit()`.

---

## Git-conventies

- Branch-prefix voor feature-branches: `claude/<beschrijving>-<id>` (automatisch bij worktrees)
- Cherry-picks van feature-branches: versienummer-conflicten altijd in het voordeel van HEAD (hogere versie wint)
- Commit-berichten: Nederlands, bondige eerste regel + bulleted body
- Co-author tag verplicht: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## Lokale ontwikkeling

```bash
cd "/Users/alan/Library/Mobile Documents/com~apple~CloudDocs/DnD app/Grisburgh-main"
npm start          # of: node server.js
# → http://localhost:3000
```

Tests:
```bash
npm test           # Jest (tests/ map)
```

---

## Git push-strategie

**Standaard: push aan het einde van elke werksessie**, niet na elke deploy.
`origin/main` fungeert als dagelijkse back-up; de server is de bron van waarheid.

```bash
git push origin main
```

---

## Openstaande feature-branches (prioriteitsvolgorde)

Branches op `origin/claude/…` die nog niet gemerged zijn, gesorteerd op aanbevolen volgorde.
Cherry-picken via `git cherry-pick <sha> …` — versienummer-conflicten altijd in het voordeel van HEAD.

| Prioriteit | Branch | Wat zit erin | Reden |
|---|---|---|---|
| 1 | `zoeken-verbeteren` | Diakriet-matching (ë, é…), multi-woord, toetsenbordnav, highlight | Hoge dagelijkse impact, nul DM-configuratie nodig |
| 2 | `status-uitleg` | Statuspictogrammen + tikbare uitleg in personagetabblad | Maakt spelerstab zelfuitleggend |
| 3 | `lightbox-zoom-pan` | Pinch/knop-zoom en pannen in afbeeldingsmodals | Afbeeldingen staan overal; kwaliteitssprong |
| 4 | `speler-data-veiligheid` | Invoerbescherming, per-akte back-ups van spelersdata | Veiligheid voor productie |
| 5 | `heeren-van-de-nacht-YC1Rx` | Facties: boons, titels, rang-progressie | Vraagt DM-configuratie; inplannen als campagne er klaar voor is |
| 6 | `glossary-hover-uitleg` | Hover-uitleg bij D&D-termen | Nice-to-have; eerder gerevert, mogelijk instabiel |
| 7 | `dm-npc-generator-LtaPQ` | NPC-generator in DM-paneel | DM-tool, lage spelersprio |
| 8 | `app-feature-exploration-eBRFB` | Almanak, downtime, orakel, weersysteem | Grote features; apart plannen per onderdeel |

De rarity-commits uit `app-feature-exploration` zijn al gemerged.
`dobbelsteen-formules` en `dobbelsteen-voordeel` zijn al gemerged (dice-roller is live).
`grisburgh-code-review-WGRUg` bevat een CODE-REVIEW.md + snapshot-verwijdering — apart beoordelen.
