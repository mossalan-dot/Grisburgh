# Grisburgh — CLAUDE.md

D&D-campagne-manager: Node/Express backend, vanilla JS frontend (ES-modules),
Socket.io voor realtime updates. Geen framework, geen bundler.

> **Wachtwoorden** staan in `CLAUDE.local.md` (gitignored, niet op GitHub).

---

## UI & campagne-afspraken

- **Taal: altijd Nederlands.** Labels, knopteksten, toastberichten, foutmeldingen — alles NL.
- **D&D-terminologie altijd in het Engels — nooit vertalen.** Spellnamen, feats, abilities,
  class features, conditions, categorielabels in progressie — altijd de Engelse PHB-term gebruiken,
  ook in beschrijvingen, chips, badges en knoppen die D&D-inhoud beschrijven.
  Voorbeelden: "Spell Slots", "Cunning Action", "Channel Divinity", "Saving Throw",
  "Ability Score Improvement" (niet "Versterking"), "Epic Boon" (niet "Epische gave"),
  "Combat" (niet "Aanval"), "Defense" (niet "Verdediging"), "Movement" (niet "Beweging"),
  "Healing" (niet "Genezing"), "Knowledge" (niet "Kennis"), "Senses" (niet "Zintuig"),
  "Magic" (niet "Magie"), "Social" (niet "Sociaal"), "General" (niet "Algemeen"),
  "Class" (niet "Klasse" als D&D-term), "Subclass" (niet "Subklasse").
  **Vuistregel:** als de term in de PHB voorkomt, staat hij in het Engels.
- **Geen destructieve DM-acties zonder expliciete bevestiging.** Verwijderen, resetten en
  overschrijven altijd via `confirm()` of een zichtbare knop die de actie beschrijft.
  Nooit stilletjes iets wissen op basis van een impliciet pad.
- **Perkament/middeleeuws thema bewaken.** Geen moderne UI-patronen die het thema doorbreken.
  Fonts: Cinzel (koppen), Crimson Text (broodtekst), IM Fell English (cursieve notities).
  Kleuren: warme okertinten (`#c4a87a`, `#f2e8d2`, `#2a1a08`). Geen vlakke Material/Bootstrap-look.
  Icoontjes via `icon()`, nooit emoji in gerenderde HTML.
- **Archief-tabbladen leven in meerdere bestanden — pas wijzigingen overal toe.** Een UI-/styling-
  aanpassing aan "de archief-tabbladen" raakt niet één bestand:
  - `render-campagne.js` — personages, locaties, organisaties, voorwerpen (kaarten, detailvenster, editor)
  - `render-archief.js` — **documenten** + logboek + aktes (eigen editor & viewer, NIET het detailvenster van render-campagne)
  - `render-bestiarium.js` + `render-statblock.js` — **bestiarium** (eigen kaart + statblock-modal, eigen editor in `dm-panel.js`)
  Documenten en bestiarium delen wél de `.entity-card`-kaartstijl, maar hebben **eigen** detail-/editor-
  vensters. Doe je iets aan labels/kaarten/vensters van de archief-tabs, check dan al deze bestanden.
- **Backup vóór elke wijziging aan spelersdata.** Voordat code of data op de server aangepast
  wordt die het spelerstabblad raakt (playerProfiles, playerItems, playerSpells, berichten, boedel),
  eerst een backup maken:
  ```bash
  ssh root@46.224.156.154 "cd /var/www/grisburgh/data/campaigns/grisburgh && \
    cp dm-state.json dm-state.bak.$(date +%Y%m%d_%H%M%S).json && \
    cp archief.json  archief.bak.$(date +%Y%m%d_%H%M%S).json"
  ```
  Backupbestanden zijn gitignored (staan in `data/`). Verwijder ze handmatig na succesvolle test.

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
index.html  : theme.css?v=299   app.js?v=432   sound-manager.js?v=4   icons.svg?v=4
app.js      : api.js?v=240      render-campagne.js?v=95   render-archief.js?v=44
              render-kaart.js?v=10  render-dungeon.js?v=23  render-relatiemap.js?v=14
              render-progressie.js?v=35  socket-client.js?v=38
              render-bestiarium.js?v=12  render-statblock.js?v=3
              dm-panel.js?v=93    render-dashboard.js?v=2
dm-panel.js : combat-canvas.js?v=7   render-statblock.js?v=3
```

> **Eén bestand = één URL.** ES-modules met verschillende `?v=`-nummers zijn aparte
> module-instanties (eigen state!) én omzeilen de cache-busting. Bij een versiebump dus
> **alle** importerende bestanden meenemen — ook de dynamische `import(...)`-aanroepen in
> `socket-client.js` en `render-archief.js`. Controle:
> `grep -ohE "\./[a-z-]+\.js(\?v=[0-9]+)?" public/js/*.js | sort | uniq -c`
> — elk bestand mag maar mét één versie voorkomen.

> **Verzegelde uitnodigingsbrieven (reveal-by-letter).** Een factie of dienst kan zich per
> brief voorstellen aan de actieve groep — dat onthult het doel én bezorgt elke speler een
> cinematische, verzegelde brief. Hergebruikt het brief-systeem (`_bezorgBrief`, thema `factie`
> met `kop`/`embleem`/`kleur`). Endpoints: `POST /facties/:id/uitnodiging`, `POST /diensten/:dienst/uitnodiging`.
> DM-triggers: knop in het Facties-paneel, mail-icoon per dienst in "Toegang per groep", én een
> mail-snelknop in de **regie-balk** (akteplay) met een factie/dienst-picker. Cinematic +
> lakzegel-styling: `_briefCinematic()` + `.brief-cinematic-*` / `.speler-brief-card--factie` (CSS).

> **Glossary/hover-uitleg:** geen los `glossary.js`-bestand (die revert staat hieronder). De
> hover-uitleg van D&D-termen leeft **inline in app.js**: `_SB_GLOSSARY` (termen + tips),
> `_sbApplyGlossary_DOM()` (wrapt termen in `.sb-gloss`-spans) en een globale tooltip-handler
> (`_initGlobalGlossary`, geactiveerd in `init()`). Publieke API: `window.glossary.applyDom(el)`.
> Gebruikt door spreukenboek én het progressie-detailmodal.

---

## Projectstructuur

```
server.js              Express + Socket.io entry point
config.js              PORT, sessionSecret, dmPassword (uit env)
lib/storage.js         Lees/schrijf JSON-bestanden, per-campagne via AsyncLocalStorage
lib/snapshot.js        HTML-export (/api/export + /api/export/campagneboek)
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
| `archief.json` | documenten, logEntries, sessieLog, brieven, aanplakbord, kampvuren, trofeeen, jachtbuit |
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

**Beschikbare iconen** (icons.svg, v=4):
`beer` `book-open` `building` `camera` `castle` `check` `check-circle`
`chevron-left` `chevron-right` `church` `clipboard-list` `coins` `crossed-swords`
`dice` `download` `eye` `eye-off` `flame` `flask-conical` `folder-open` `globe`
`heart` `hexagon` `hourglass` `house` `image` `landmark` `link` `lock` `lock-open`
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

## Meesterkamer — gouden standaard (DM-tabs)

Alle meesterkamer-tabs (`dm-panel.js`) volgen dezelfde opbouw. **Wijk hier niet
van af** en gebruik geen ad-hoc inline-`style=""` voor lay-out/spacing.

**1. Vaste tab-kop.** Elke top-tab met één content-blok begint met `_dmTabHead(...)`:
```js
el.innerHTML = `
  ${_dmTabHead({ icon: 'open-book', title: 'Spreuken', sub: 'optionele subtitel',
                 actions: helpBtn('dm_spreuken') })}
  <div class="dm-feature-section"> … </div>`;
```
- `icon` links, `title` (Cinzel), optionele `sub` (cursief), `actions` **altijd rechts**.
- De **help-knop hoort in `actions`** — nooit meer inline tussen velden of in een
  losse flex-wrapper.
- Tabs met **meerdere subtabs** (Gevecht, Diensten) gebruiken i.p.v. een kop de
  `.dm-subtab-nav` + `.dm-subtab-btn` (help-knop in een `dm-tab-head-actions`-achtige
  `<span style="margin-left:auto">` rechts in de nav).

**2. Inhoud in `.dm-feature-section`** met `.dm-section-label` voor subkopjes.
Geen losse `<div style="display:flex…">`-wrappers om label+knop heen.

**3. Laad-/foutstate** via `_dmLoading('Laden…')` (gedeelde helper).

**4. Toegestane bouwstenen (canon):** `.dm-feature-section`, `.dm-section-label`,
`.dm-feature-row`(`-sm`), `.dm-form-row`/`.dm-form-label`, `.dm-input`(`-sm`),
`.dm-btn`(+`-ghost`/`-primary`/`-danger`/`-icon`/`-sm`), `.dm-hint`,
`.dm-subtab-nav`/`.dm-subtab-btn`, `.dm-tab-head`(+`-icon`/`-title`/`-sub`/`-actions`).

**5. Container ophalen:** gebruik `_tabEl(name)` waar mogelijk. Tabs met een eigen
vaste content-id (`dm-tafels-content`, `dm-geluiden-content`) houden hun
`getElementById` — verander die niet zonder de bijbehorende HTML mee te wijzigen.

**6. Knoppen.** Gebruik altijd `.dm-btn` + een modifier — `-primary` (goud, voor
bevestigen/opslaan/versturen), `-ghost` (outline, secundair), `-danger` (rood),
`-sm`/`-icon` (compact). Geen losse knop-klassen buiten dit systeem in nieuwe code.
Een **losse actieknop in een `.dm-form-row`** rekt door de CSS-regel
`.dm-form-row:has(> .dm-btn:only-child) { align-items: flex-start; }` **niet** meer
uit tot volle breedte — opslaan-knoppen staan overal op natuurlijke breedte,
links uitgelijnd (net als in een `.dm-feature-row`). Zet hem dus niet handmatig
op `width:100%`.

Skelet voor een nieuwe tab → kopieer een bestaande enkel-content-tab (Spreuken/
Berichten) als referentie.

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

### Feature-beschrijvingen: Engelse SRD-bron (2024)

Alle `desc`-velden zijn **officiële Engelse 2024-tekst** (geen NL-vertalingen). Bron + regeneratie via
`scripts/srd-2024/`:

- **SRD 5.2 (CC-BY-4.0):** [`5e-bits/5e-database`](https://github.com/5e-bits/5e-database) →
  `src/2024/en/5e-SRD-Features.json` (class/subclass features) + `…-Traits.json` (species) +
  `…-Feats.json`. Dekt ~90% (alle basisklassen + de 12 SRD-subklassen).
- **Niet-SRD subklassen/species** (Twilight Domain, Swashbuckler, Wild Magic, Aasimar, Aarakocra,
  Tabaxi, Half-Elf): geëxtraheerd uit [`5etools-mirror-3/5etools-src`](https://github.com/5etools-mirror-3/5etools-src)
  `data/class/class-*.json` + `data/races.json` via `extract-5et.js` (`{@tag}`-stripper).
- **Structurele placeholders** (Divine Smite, lineage/legacy-spreuk-rijen): korte Engelse regels in
  de `PLACEHOLDERS`-map in `merge-srd.js`.

Regenereren: download de bronbestanden naar `/tmp`, draai `extract-5et.js` dan `merge-srd.js <file> --write`.
De seed én de campagne-eigen `data/campaigns/*/progression.json` moeten beide gemerged worden
(grisburgh heeft een custom; prewett/sandbox gebruiken de seed).

### Backgrounds (2024)

Naast Klassen/Soorten/Feats kent de progressie ook **backgrounds** (vierde editor-categorie).
Een background = `{ levels: { "1": [{name, desc}] } }` (zelfde vorm als species, dus hergebruikt
species-rendering en de level-editor — maar zonder level-labels). Onderdelen: Ability Scores,
Origin-feat, Skill Proficiencies, Tool Proficiency, Equipment.

- **Bibliotheek:** 16 PHB-2024-backgrounds in `public/data/backgrounds-2024.json` (geëxtraheerd uit
  5etools via `scripts/srd-2024/extract-backgrounds.js`).
- **Server:** `GET /api/progression` vult `backgrounds` aan uit dat bestand als de campagne nog geen
  eigen versie heeft opgeslagen (`PUT` bewaart `body.backgrounds`). Net als de class-seed-fallback.
- **Koppeling:** `playerProfile.background` (op het character sheet — nu een **dropdown** gevoed door
  `progData.backgrounds`, niet meer vrij tekstveld) → matcht fuzzy op de bibliotheek → toont een
  "Background"-sectie in de progressie-tijdlijn (alleen tonen; skills worden níét automatisch gezet).

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
- **Dangling module-import na een revert** → als een feature wordt teruggedraaid, verwijder óók de `import`-regel in `app.js`. Een import van een verwijderd `.js`-bestand laat de node-server `index.html` (HTML) terugsturen i.p.v. JS → **de hele app.js module-graaf faalt stil** (`window.app` half-geïnitialiseerd, `window.progressie`/andere globals undefined, geen console-error). Symptoom: spelerstab half kapot, sync/handlers werken niet. Zo ging het mis met `glossary.js` (juni 2026): productie bleef werken omdat het oude bestand daar nog stond, maar een verse checkout was stuk.

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
npm run dev        # node --watch (auto-reload) + DEV_AUTO_DM=1
# → http://localhost:3000
```

> **`npm run dev` logt je automatisch in als DM** — geen wachtwoord nodig. Dit komt door
> `DEV_AUTO_DM=1` in het dev-script (zie `config.js` → `devAutoDM`, middleware in `server.js`).
> Een verse sessie krijgt `role: 'dm'`. **Alleen lokaal:** productie draait via PM2 zonder die
> env-var, dus daar geldt de normale DM-login. Wil je lokaal als speler testen? `window.app.testLogin()`
> zet de rol expliciet op `player` (overschrijft de auto-DM). `npm start` (= `node server.js`) heeft de
> bypass óók niet — gebruik `npm run dev` voor de DM-bypass.

Tests:
```bash
npm test           # Jest (tests/ map)
```

---

## Git push-strategie

**Standaard: push aan het einde van elke werksessie**, niet na elke deploy.
De **server is de bron van waarheid**; `origin/main` is back-up van de lokale main.

```bash
git push origin main
```

Als origin/main afwijkt (bijv. door feature-branches die daar direct gemerged zijn):
gebruik `git push --force-with-lease origin main`. De Facties/feature-commits
blijven beschikbaar via hun eigen branch; ze hoeven niet in main te zitten.

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

---

## Te testen — wijzigingen vanaf 1 juni 2026

Testlogin: `window.app.testLogin()` → Test McTestface (groep 3, wachtwoord in `CLAUDE.local.md`).

### Diensten-toegang per groep
- [ ] DM-paneel → groepsinstellingen: schakelaar per dienst zichtbaar
- [ ] Dienst op "verborgen" zetten → speler ziet die dienst niet meer
- [ ] Terugzetten → dienst verschijnt weer

### Ursula: voorspelsessie + brief
- [ ] Diensten → Ursula → "Voorspelling vragen": zintuigenformulier verschijnt
- [ ] Vier zintuigen kiezen + bevestigen → voorspelling getoond
- [ ] Berichten-tab: brief van Ursula aanwezig met SVG-iconen (geen emoji)

### Tempel redesign
- [ ] Godlijst: ronde avatars, naam + doméin, eed-badge bij actieve eed
- [ ] Klik op god → interieur met terug-knop, priester-begroeting, Zegening + Eed knoppen
- [ ] Eed-cinema: zwart overlay, typewriter-tekst, bevestigen/annuleren werken
- [ ] Na eed: andere eden geblokkeerd voor deze speler
- [ ] Zegening: betaling + verschijnt in Boedel
- [ ] DM-paneel → tempel: per god imageId / priestImageId / backdropId / priesterGreet instelbaar

### Knapzak
- [ ] Geen "Boedelinventaris"-sectie meer zichtbaar
- [ ] Navigatiepijltjes staan **linksboven en rechtsboven** op het kaartje (niet verticaal gecentreerd)
- [ ] Damage pill klikken → dobbelsteenpaneel opent

### Zeldzaamheid op voorwerpkaartjes
- [ ] Archief → Voorwerpen: gekleurde rand per tier (grijs/groen/blauw/paars/goud)
- [ ] Very Rare + Legendary: permanente gloed + shimmer-animatie
- [ ] Detail-modal: rariteit in bijpassende kleur
- [ ] Boedel-carousel: rariteit-pill zichtbaar (◆ + label + glow voor VR/Leg)

*Testdata: Test McTestface heeft 5 items met elke zeldzaamheid.*

### Skill trees (Progressie-tabblad)
- [ ] Tab "Progressie" zichtbaar tussen Boedel en Spreukenboek
- [ ] Tijdlijn: Wizard-features op juiste levels, Evoker-features met "subklasse"-tag
- [ ] Human soort-traits zichtbaar (Resourceful, Skillful, Versatile)
- [ ] Levels > 7 zijn visueel vergrendeld
- [ ] Alle categorie-iconen zijn SVG (geen emoji)
- [ ] Kaartweergave: schakelbaar, vergrendelde kaartjes hebben slot
- [ ] Favorieten (☆ → ★) bewaard na herladen
- [ ] Feature-detail modal opent bij klikken
- [ ] DM: "✏️ Bewerk"-knop zichtbaar, editor werkt (klasse aanmaken, feature toevoegen, opslaan)

### Keuze-registratie bij features
- [ ] "Ability Score Improvement" in tijdlijn heeft invoerveld "Noteer jouw keuze…"
- [ ] Waarde invullen + verlaten → opgeslagen na herladen
- [ ] Kaartweergave: ingevulde keuze toont als donkere chip op de kaart
- [ ] Detail-modal: "Jouw keuze"-sectie aanwezig
- [ ] Vergrendeld niveau: invoerveld uitgeschakeld (grijs)

### Aanplakbord (herberg) — 11 juni 2026
- [ ] Herberg: knop "Aanplakbord" onder de roddel-lijst; klik → houten bord met posters
- [ ] DM-paneel → Diensten → Herberg: sectie "Aanplakbord" — bericht prikken (soort/titel/tekst/beloning/groepen)
- [ ] Bericht alleen zichtbaar voor aangevinkte groepen; andere groep ziet het niet
- [ ] Actieve missies (quest-prikbord status "actief") hangen automatisch op het bord
- [ ] Poster aanklikken → groot vel; klik sluit; terug-knop → herberg
- [ ] Verwijderen vraagt om bevestiging

### Kampvuurmodus — 11 juni 2026
- [ ] DM: vlam-knop in regie-balk én in Gevecht-tab → Rust; toggle ontsteekt/dooft
- [ ] Speler (actieve groep): rustscherm met vuur + sterrenhemel verschijnt live
- [ ] Speler: gedachte delen → verschijnt live bij alle groepsleden én DM (max 3 p.p., 280 tekens)
- [ ] Min-knop → sintel-knopje rechtsonder; klik → overlay terug
- [ ] Herladen tijdens brandend vuur → overlay komt terug (restore via GET /kampvuur)
- [ ] DM dooft → overlay vervaagt bij iedereen; quotes staan daarna in de Kroniek
- [ ] Kampvuur zonder quotes gedoofd → geen leeg blok in de Kroniek

### Korte rust (short rest met Hit Dice) — 11 juni 2026
- [ ] DM: zandloper-knop in regie-balk én in Gevecht-tab → Rust; toggle start/hervat
- [ ] Speler (actieve groep): adempauze-overlay (gouden lucht, lage zon, zwevend stof) verschijnt live
- [ ] Speler ziet HP-balk, Hit Dice-stippen (●○) en het juiste die-type (profiel `hitDie`, anders klasse-mapping)
- [ ] Worp invullen + "Besteed Hit Die" → HP stijgt (max. tot maximum), teller omlaag, regel live bij de hele groep
- [ ] Geen Hit Dice meer → invoer verdwijnt ("Je hebt geen Hit Dice meer over")
- [ ] DM "Hervat de tocht" → overlay vervaagt; Warlock-spelers krijgen Pact Magic-slots terug; items met
      "Herlaadt bij korte rust" naar max
- [ ] Lange rust: helft van de Hit Dice terug (min. 1) en shortRest-items laden óók (was een gat)
- [ ] Herladen tijdens adempauze → overlay komt terug (GET /shortrest)

### Trofeeënwand + jacht-economie (herberg/magizoo) — 11 juni 2026
- [ ] Monsterbibliotheek: per kaart vinkje "Levert trofee" (standaard aan) + "Trofeewaarde (fl)"
      — leeg gelaten = automatisch via CR uit het statblock (±25 fl per CR, hint toont het bedrag)
- [ ] Gevecht winnen (alle monsters 0 HP) + opruimen → verslagen monsters in de **jachtbuit**
      (zelfde naam = één regel met ×N; uitgevinkte monsters ontbreken)
- [ ] Verloren/afgebroken gevecht → géén jachtbuit
- [ ] Buit-composer: sectie "Trofeeën van de jacht" (aangevinkt, met waarde); prullenbak gooit weg
- [ ] Trofee claimen + buit sluiten → kaartje "Onbewerkte trofee: …" in Boedel van de claimer
- [ ] Trofeeënwand → "Jouw jachtbuit": **verkoop** tegen kaartprijs → munten erbij, kop aan de wand
      met "Verkocht door …"; waarde 0 = "de waard heeft geen interesse"
- [ ] Magizoo → "Trofeeën prepareren": prijs = prepareerfactor (magizoo-instellingen, standaard 1.5)
      × trofeewaarde, minimaal 5 fl; betalen → trofee gedragen aan de wand met paarse chip
      "de werking is een mysterie"
- [ ] Te weinig munten → preparatie geweigerd met nette foutmelding
- [ ] DM zet boon via potlood; speler ziet hem NIET (paarse chip), DM ziet "… (geheim)"
- [ ] **Attunement:** korte rust afronden mét gedragen geprepareerde trofee → boon onthuld op wand
      én op het Boedel-kaartje
- [ ] Herberg: knop "Trofeeënwand" naast het Aanplakbord; klik → donkere wand met haardgloed
- [ ] Plaquette: monsterportret (of schedel), koperen naamplaat, akte + datum; klik → groot detail
- [ ] DM: trofee verwijderen (met bevestiging) en handmatig toevoegen uit het bestiarium
- [ ] Per groep: andere groep ziet eigen wand
- [ ] Tweede trofee dragen → bevestiging, eerste wordt automatisch teruggehangen (max. 1 per jager)
- [ ] Andere speler ziet "Gedragen door …" en kan hem niet ook dragen
- [ ] Trofee-kaartje in Boedel weggooien als speler → geweigerd ("leg af bij de Trofeeënwand")
- [ ] "Leg af" bij de wand → kaartje uit Boedel, trofee hangt weer vrij; DM kan ook afleggen
- [ ] Boon wijzigen terwijl gedragen (en attuned) → kaartje in Boedel verandert mee

### Buit (loot-verdeler) — 11 juni 2026
- [ ] DM: pakket-knop in regie-balk én in Gevecht-tab → Rust & buit; opent composer
      (regels: voorwerp/aantal/info + munten FL/KN/CL)
- [ ] "Open de buit" → spelers van de actieve groep krijgen de buit-overlay live
- [ ] Speler claimt item → claim-chip live bij iedereen; "teruggeven"-knopje (−) werkt;
      op = "vergeven"
- [ ] Claims zijn reserveringen: vóór sluiten staat er níéts in de Boedel
- [ ] DM "Verdeel en sluit" (met bevestiging) → geclaimde items in Boedel van de claimers,
      munten gelijk verdeeld (rest blijft bij de DM), overlay sluit bij iedereen
- [ ] DM "Annuleer" → niets uitgedeeld
- [ ] Herladen tijdens open buit → overlay komt terug (GET /buit)
- [ ] DM-knop bij lopende buit → heropent de overlay i.p.v. een nieuwe composer

### Kroniek (logboek-leesmodus) — 11 juni 2026
- [ ] Logboek-dropdown: item "Kroniek" tussen Logboek en Kaarten
- [ ] Doorlopende boekrol: aktekoppen, datum, titel, citaat als pull-quote, volledige samenvatting (markdown)
- [ ] Initiaal (sierletter) op de eerste alinea per verslag
- [ ] Kampvuur-momenten als donker blok met vlam-icoon tussen de verslagen van de akte
- [ ] Speler ziet alleen zichtbare verslagen/aktes van eigen groep; DM ziet alles ("verborgen"-chip)
- [ ] Klik op verslag → bestaand detailvenster opent
