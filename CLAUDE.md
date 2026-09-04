# Grisburgh — CLAUDE.md

D&D-campagne-manager: Node/Express backend, vanilla JS frontend (ES-modules),
Socket.io voor realtime updates. Geen framework, geen bundler.

> **Wachtwoorden** staan in `CLAUDE.local.md` (gitignored, niet op GitHub).

---

## Werkwijze: leg het uit ("teach as you go")

De gebruiker wil al doende leren — niet alleen een werkend resultaat. **Leg per
onderdeel dat je bouwt kort uit** (2–4 zinnen, luchtig, geen college): welke
techniek of term je gebruikt en waaróm. Voorbeelden: "`object-position` om het
focuspunt van een afbeelding te sturen", "negatieve lookbehind in de regex zodat
'non-instantaneous' niet matcht", "event-delegation: één handler op `document`
i.p.v. één per element", "ES-module met `?v=`-cachebusting". Doel: de gebruiker
snapt de codebase gaandeweg steeds beter. Hou het bij de onderdelen die je
daadwerkelijk aanraakt; overdrijf niet.

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

> **Sessies overleven een herstart.** `server.js` gebruikt een bestandsstore
> (`session-file-store`) met de sessies in `data/sessions/`. Voorheen hield
> express-session alles in het procesgeheugen en logde elke `pm2 restart`
> iedereen uit — DM, spelers én de tablet. Bewust géén reaper-interval: die
> timer houdt het testproces open waardoor `npm test` niet afsluit; verlopen
> bestanden worden eenmalig bij het opstarten opgeruimd (TTL 30 dagen).
> Bij een deploy van `package.json` hoort een `npm install --omit=dev` op de server.

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

### Backups draaien vanzelf

Elke nacht om **05:15** draait op de server `/usr/local/bin/grisburgh-backup`
(bron: `scripts/backup-campagnes.sh`, via cron van root). Die maakt in
`/var/backups/grisburgh/<datum>/` een snapshot van **alle campagnes**: alle JSON
plus de `thumbs/`. Bewust níét mee: `files/` (2,2 GB originelen — die blijven
alleen op de server) en `campaigns/*/backups/` (de per-schrijfactie-kopieën die
`lib/storage.js` zelf al bijhoudt).

Dertig dagen historie kost geen dertig keer de ruimte: `rsync --link-dest`
hardlinkt ongewijzigde bestanden aan de vorige dag, dus twee snapshots van 58 MB
staan samen voor 59 MB op schijf. Een oude dag weggooien blijft daardoor veilig
— pas als de laatste link weg is, verdwijnt het bestand echt. Let bij het lezen
van `/var/log/grisburgh-backup.log` op: de maat van één dag zegt niets, `du`
telt een hardlink vol mee. Het totaal is wat er echt staat.

> **De volgorde van de rsync-filters telt.** rsync neemt de eerste regel die
> past, dus `--exclude='files/'` en `--exclude='backups/'` staan vóór
> `--include='*/'`. Andersom haalt die include eerst álle mappen binnen en komen
> de JSON-bestanden ín `backups/` alsnog mee.

Naast de data schrijft de backup ook de **character sheets** per party weg als
HTML (`scripts/sheets-bewaren.js` → `<datum>/<campagne>/sheets/<party>.html`).
De JSON is de echte kopie; dit is de leesbare — een blad dat je kunt printen
zonder dat er een app draait. Mislukt dat, dan zegt de log het en gaat de
datakopie gewoon door.

**Op de laptop** haalt een launchd-agent (`nl.grisburgh.backup`, elke dag 19:00,
script `~/bin/grisburgh-backup-ophalen` uit `scripts/backup-ophalen.sh`) de boel
op naar `~/Grisburgh-backups/`: `laatste/` is de huidige stand mét thumbnails
(58 MB), `json/<datum>/` is dertig dagen JSON-historie (~2,4 MB per dag). Staat
de laptop om 19:00 uit, dan draait launchd de gemiste beurt zodra hij weer aan
gaat. De historie is daar JSON-only omdat macOS `openrsync` levert, dat geen
hardlinks kopieert — dertig volle dagen zouden dan 1,7 GB kosten.

Handmatig draaien of terugzetten:

```bash
ssh root@46.224.156.154 "/usr/local/bin/grisburgh-backup"     # nu een snapshot
~/bin/grisburgh-backup-ophalen                                 # nu ophalen

# Eén bestand terug (voorbeeld):
ssh root@46.224.156.154 "cp /var/backups/grisburgh/2026-09-04/grisburgh/archief.json \
  /var/www/grisburgh/data/campaigns/grisburgh/ && pm2 restart grisburgh"
```

De handmatige backup vóór een wijziging aan spelersdata (zie boven) blijft
staan: de nachtelijke is van vannacht, niet van vijf minuten geleden.

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
| `public/js/render-spreuken.js` | `public/js/app.js` → `import … render-spreuken.js?v=N` |
| `public/js/media-picker.js` | `public/js/app.js` → `import './media-picker.js?v=N'` (side-effect import) |
| overige render-*.js, socket-client.js | idem in app.js |

**Huidige versies (bij te houden):**

```
index.html  : theme.css?v=441   app.js?v=591   sound-manager.js?v=8
app.js      : api.js?v=262      render-campagne.js?v=130   render-archief.js?v=75
              render-kaart.js?v=19  render-dungeon.js?v=33  render-relatiemap.js?v=22
              render-progressie.js?v=44  socket-client.js?v=59
              render-bestiarium.js?v=20  render-statblock.js?v=3
              dm-panel.js?v=197    render-dashboard.js?v=9
              render-spreuken.js?v=14   media-picker.js?v=7
dm-panel.js : combat-canvas.js?v=22   render-statblock.js?v=3
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

> **Lange & korte rust (party-breed, cinematisch).** DM triggert via het rust-paneel (`dm-panel.js`,
> rond de oude maanknop): **Lange rust** / **Korte rust** + locatie-toggle **Veld / herberg**. Endpoints:
> `POST /party/long-rest` (HP→max, slots, item-charges, Hit Dice helft; bij herberg `overnachtingPrijs` p.p.
> afschrijven + `2×spelers` entiteit-roddels onthullen via `flavourUitgesproken`), `POST /party/short-rest`
> (shortRest-items + Warlock pact-slots; Hit Dice interactief), `POST /characters/:id/spend-hit-die`,
> `GET /characters/:id/hit-dice`. Server emit `party:rest` → `socket-client.js` → `window._rustCinematic`
> (fullscreen overlay, nacht/maan vs. kampvuur). **Hit Dice afgeleid** uit klasse+level (incl. multiklasse) via
> `CLASS_HIT_DIE`/`_hitDicePool` (server) + `_clientHitDicePool` (app.js); verbruik per dobbeltype in
> `dmState.playerHitDice[charId].spent`. Het oude handmatige `hitDie`-tekstveld op de sheet is vervangen door
> een afgeleide dots-weergave (alleen fallback voor onbekende klassen). Herberg-config kreeg `overnachtingPrijs`.
> **Sfeer-uitbreidingen:** (1) lange-rust-overlay toont de **actuele maanfase** (`_moonPhase`/`_moonSvg` in app.js,
> SVG-terminator uit de datum). (2) **Backdrops** per scenario via `meta.rust` (`veldBackdropId`,
> `korteRustBackdropId`; herberg hergebruikt `meta.herberg.backdropId`) — `_rustBackdrop()` server-side, overlay toont
> ze via `.rust-cinematic--has-bg` + `--rust-bg`. Ingesteld in de Rust-sectie van het herberg-paneel (`PUT /meta/rust`).
> (3) **d100-rustgebeurtenis** bij lange rust: `_rolRustGebeurtenis()` rolt de in `meta.rust.eventTableId` gekozen
> **weighted** tabel; een regel kan een valuta-token bevatten dat automatisch verrekend wordt — formaat
> `1-5: tekst {+3kn}` (of `{-1fl}`, optioneel `{+2kn @party}`); standaard treft het een willekeurige speler,
> `@party` iedereen. **Per speler**: bij een lange rust rolt elke speler een eigen voorval (eigen tekst + eigen
> valuta op zichzelf); de speler ziet in de overlay alleen zijn eigen regel, het tafelscherm (display) een lijst van
> allen. Payload: `perPlayer[charId].gebeurtenis` + platte `gebeurtenissen[]` voor display/DM. **Aparte tabel per locatie**: `meta.rust.veldEventTableId` (buiten) en `herbergEventTableId`
> (binnen); `eventTableId` is een fallback. De campagne heeft twee md-bronnen omgezet naar tabellen
> `tbl_rust_wildernis` + `tbl_rust_herberg` (conversiescript-patroon: md-rij `| 01-02 | **Naam** | Beschrijving | \`+6 knakers\` |`
> → `1-2: Naam — Beschrijving {+6kn}`; munt-namen florinde/knaker/centeling → fl/kn/cl). (4) **Tabletmodus**: op het gedeelde scherm (`_isDisplayMode`, geen `characterId`) toont de overlay
> een party-brede variant zonder per-speler-knoppen.

> **Brief vanuit de akteregie (regie-stap, cinematisch).** Naast image/entity/encounter/dungeon/rust
> kent het regie-script een **6e staptype `brief`**. De DM stelt 'm op via het mail-icoon in de
> picker (`render-archief.js` → `_scriptBriefCompose` compose-modal: ontvanger party/speler, afzender +
> NPC-koppeling, in-world datum, briefstijl/thema, onderwerp, tekst) → `_scriptBriefSave` bewaart de stap
> in `meta.hoofdstukken[ch].script`. Tijdens het spelen verstuurt de DM 'm vanuit de **regie-balk**
> (mail-knop, `dm-panel.js` → `_regieBalkBrief` → `api.sendPost({…, cinematic:true})`). Server (`POST /post`)
> zet `cinematic` op het bericht (speler krijgt de reveal) én broadcast **`brief:display`** met de volledige
> briefdata naar de campagne-room voor de **tablet** (die geen speler-socket is). `socket-client.js` toont
> die alleen in `_isDisplayMode`. De **reveal** (`_briefCinematic` in app.js) is twee-traps: verzegelde
> envelop → klik op het **zegel** (nu een `<button>`) → de volledige brief vouwt open (`.brief-cinematic-open`
> / `.brief-cinematic-letter`). Hergebruikt door de bestaande factie-uitnodiging (ook twee-traps geworden).

> **Akte-afbeeldingen uploaden vanuit de Meesterkamer.** De regie-script beeld-picker
> (`render-archief.js` → `_renderAkteScriptInner`, `pickerState.mode==='image'`) heeft een
> **"Upload afbeelding"**-knop (`_scriptUploadImages`). Voorheen moest je afbeeldingen eerst
> in het Logboek uploaden (in een sessielog-entry) en pas daarna in de picker selecteren —
> want `allImages` wordt afgeleid uit `sessieLog[].images` van die akte, en reveal draait op
> `updateSessieLog(sessieId,{images})` (flipt `visible`). De uploadknop houdt dat datamodel
> intact: hij maakt/hergebruikt een **verborgen** `korteSamenvatting:'Scène-afbeeldingen'`-
> sessielog-entry (zelfde patroon als de akte-importer), uploadt elk bestand via
> `api.uploadFile` en zet ze als `{id,caption,visible:false}` op die entry. Zo werken picker,
> bannerkeuze (`_editAkte`), reveal én logboek-carousel meteen — géén server-wijziging nodig.
> Uploads verschijnen als thumbnails; klikken voegt ze als beeld-stap aan het script toe.
> Óók vanuit de **"Nieuwe akte"-modal** (`dm-panel.js` → `_akteNieuw`): een optioneel
> afbeelding-veld (`#dm-akte-n-imgs`) hangt na het aanmaken dezelfde `_scriptUploadImages`
> aan de nieuwe akte, zodat je bij het aanmaken al beeldmateriaal meegeeft.

> **Loot-events.** Een *vondst* is één ding dat de party kan vinden: de geldzak in
> de haard, het zwaard onder de plavuizen. Eén kamer kan er meerdere hebben, elk
> met een eigen **DC — en die DC is een aantekening, geen mechaniek**: de spelers
> gooien aan tafel, de DM ziet het getal staan en beslist. Onthullen is dus altijd
> een klik; er wordt nergens een worp ingevoerd of per speler bijgehouden.
> Opslag: `loot.json` (`{ events: [] }`), beheerd in het **Loot-tabblad** van de
> Meesterkamer. Endpoints: `GET/POST /loot/events`, `PUT/DELETE /loot/events/:id`,
> `POST /loot/events/:id/kopie` en `POST /loot/verdeling` (`{eventIds}`).
> Die laatste bundelt één of meer vondsten tot de bestaande `dmState.lootPhase` —
> claimen, afrollen en uitdelen blijven dus ongewijzigd. Elk item krijgt een
> `bron`-veld met de naam van zijn vondst, zodat "uit de haard" en "onder de
> plavuizen" gescheiden blijven als je ze samen onthult. De fase komt **niet**
> meteen actief te staan: de DM stelt eerst bij en drukt daarna op onthullen.
> **Electrum en platinum** hebben geen eigen plek in de beurs: `ep` (5 zilver)
> en `pp` (10 goud) worden bij het invoeren omgerekend, zowel in prijzen
> (`parsePrijs`) als in de loot-editor (`_tekstNaarCl`) en de valuta-tokens van
> tabellen (`{+2pp}`). Een vondst mág dus een platinum stuk bevatten; het staat
> daarna gewoon als 10 goud in de beurs, en de kommanotatie blijft ongemoeid.
> **Munten met een komma:** in de editor vul je één bedrag in — `1,34` is
> 1 florinde, 3 knakers en 4 centelingen (de knaker is een tiende florinde, de
> centeling een honderdste, dus het leest als gewoon geld; zelfde idee als bij de
> Tweespalt). Intern telt de server alles in **centelingen** op en rekent pas op
> het eind terug met `fromCl()`, anders krijg je 13 knakers in plaats van
> 1 florinde en 3 knakers. Helpers client-side: `_tekstNaarCl` / `_clNaarTekst`.
> **Geluid bij het onthullen:** één generieke keuze per campagne, in te stellen in
> de **Geluiden-tab** onder *Momenten* (`sounds.json` → `momenten.lootReveal`,
> whitelist `_MOMENT_SOUND_KEYS`). Klinkt bij `POST /combat/loot/reveal` — dus op
> het moment dat de spelers de buit zien — via het bestaande `sound:reveal`-event.
> Bewust géén sfeerloop en dus niet in `serviceAmbiance`: dit is een korte klank
> die één keer speelt.
> **Toeval wordt bij het onthullen gerold**, niet bij het aanmaken: een bedrag
> tussen twee grenzen (`goudRandom`) of een `willekeurig`-item dat een voorwerp-
> kaartje van de gevraagde rarity uitkiest. Zo ziet de DM wat het geworden is
> voordat het scherm opengaat. Een **sjabloon** wordt bij gebruik gekopieerd, dus
> later sleutelen aan het sjabloon verandert niets aan wat al ergens ligt.
> Deelnemers komen uit het lopende gevecht, of anders uit de spelers die
> "momenteel actief" staan (zie aanwezigheid).
> **Koppeling aan een dungeonkamer werkt van twee kanten**: in de kamerzijbalk
> (`render-dungeon.js`, sectie *Vondsten*) maak of koppel je er een, en in de
> loot-editor kies je een dungeon + kamer. De vondsten leven in `loot.json`, niet
> in de dungeonkaart — zo kun je ze ook los onthullen en blijft de kaart over
> vorm en fog-of-war gaan. Loskoppelen (`dungeonId/roomId → null`) gooit niets
> weg. Het muntje-knopje in de kamer roept `window.dmPanel.lootVerdelingOpenen()`
> aan: er is één plek waar loot echt wordt uitgedeeld, namelijk het lootvenster.
> **Op de tablet** (`_isDisplayMode`) is er een eigen onthulling, in dezelfde
> twee traps als de verzegelde brief: er staat een **gesloten kist**
> (`public/assets/loot-kist-dicht.jpg`), iemand tikt erop, de animatie speelt
> (`loot-kist.mp4`, 624×624, stil — het geluid komt uit de geluidenbibliotheek)
> en daarna verschijnt de buit met portretjes van wie wat claimt: "geclaimd door
> X", "X, Y en Z maken ruzie om de buit", "gaat naar X". Code: `_lootCinematic()`
> in `app.js`. Het tafelscherm is **geen speler** en kan claims dus niet uit een
> sessie afleiden; daarom stuurt de server een eigen payload `loot:display`
> (`_lootDisplay()`) mét namen en portret-ids — zelfde patroon als
> `brief:display`. Die gaat uit bij het onthullen, bij elke claim en bij de
> uitslag; alleen het lijstje wordt dan hertekend, niet de hele cinematic, anders
> gaat de kist telkens weer dicht.
> **Akte-stap:** het regie-script kent een 7e staptype **`loot`**
> (`{type:'loot', lootId, name}`), toe te voegen via het muntje in de picker en
> tijdens het spelen te onthullen met de muntknop in de regie-balk
> (`_regieBalkLoot` → `_lootVerdelingOpenen`). Sjablonen komen niet in de picker:
> die liggen nergens.
> **Mimic:** een vondst met `mimicEncounterId` levert géén verdeling op. De
> server geeft `{ mimic: {...} }` terug, het tafelscherm krijgt dezelfde kist te
> zien met een andere ontknoping ("Het is geen kist."), en de DM krijgt de vraag
> of het gevecht meteen moet starten (`_encStart`). De kist blijft dus tot het
> laatste moment een kist — dat is de hele grap.

> **Aanwezigheid per sessie.** `groups[gid].afwezig` is de lijst met spelers die
> **niet** meedoen (afwezigen bewaren, niet aanwezigen: dan doet een nieuw
> personage automatisch mee). In te stellen bij Instellingen → Party's
> ("Actieve spelers" — bewust niet "momenteel actief", dat las als de
> actieve *party*). Server-helper `_aanwezigeSpelers()`; client houdt
> `window._groepAfwezig` bij in `renderGroupSwitcher`. Van kracht bij lange/korte
> rust, lootdeelnemers en het automatisch vullen van een gevecht — **niet** bij
> wat de hele party betreft (character sheets, berichten, factieboons).
> Endpoint: `PUT /groups/:id/aanwezigheid`.

> **Bereikbaarheid per akte.** Wat een party kan bereiken hangt af van wáár ze
> zijn, en dat volgt uit de akte die ze spelen. Per akte staat in
> `meta.hoofdstukken[key].onbereikbaar` wat er **niet** bereikbaar is
> (`{diensten:[], entiteiten:[]}`) — uitvinken dus, zodat een nieuwe dienst
> overal automatisch bereikbaar is. In te stellen in de akte-editor
> (*Bereikbaar tijdens deze akte*), endpoint `PUT /meta/akte/:key/bereikbaarheid`.
> `GET /meta` levert een **afgeleid** `bereikbaarheid`-blok voor de aanvrager
> (`_bereikbaarheidVoor()`): de client hoeft niet zelf te weten welke akte loopt.
> Let op: `groups[gid].activeAkte` is een **object** `{key,num,title}`, niet de
> sleutel. Twee lagen die allebei waar moeten zijn: de groep bepaalt wát een
> party kent (`dienstenToegang`), de akte bepaalt waar ze zijn. De knop
> **"Grisburgh verlaten"** (`meta.buitenGrisburgh`) blijft als overschrijving:
> dan is alles dicht behalve `buitenGrisburgEntiteiten`. Zonder lopende akte
> geldt de instelling van de laatst gespeelde akte — `activeAkte` wordt nooit
> leeggemaakt. Client: `window._dienstDicht(key)` en `window._entiteitDicht(id)`;
> de DM ziet altijd alles.

> **Verhaal naast de regie + secties.** Het regie-script kent een staptype
> **`kop`** (`{type:'kop', titel}`): een sectiekop die niets onthult maar de
> strook opdeelt — geen tweede niveau in de data, dus niets aan bestaande aktes
> hoeft te veranderen. De **`##`-koppen uit de verhaaltekst worden bij het
> importeren vanzelf sectiekoppen** (`_parseAkteMarkdown` hield de sectie al bij
> per token), waardoor tekst en script dezelfde indeling en dezelfde namen delen.
> Naast de regie-balk schuift een **verhaalpaneel** open (knop *Verhaal*), dat de
> helft van het scherm inneemt — de plek waar tijdens het spelen Obsidian stond.
> Het **duwt de app opzij** (`body.verhaal-open`) in plaats van eroverheen te
> vallen, zodat de andere helft blijft werken. Let op: de app schakelt naar zijn
> compacte indeling op **vensterbreedte**, en het venster wordt niet smaller —
> daarom herhaalt `body.verhaal-open` een handvol smal-scherm-regels, anders
> lopen de titel en de navigatie over elkaar.
> Klikken werkt **beide kanten op**: een sectie in het paneel schuift de balk
> naar de bijbehorende kop (die kort oplicht), en een kop in de balk springt naar
> die sectie in de tekst — gekoppeld op genormaliseerde titel.

> **Verhaaltekst per akte.** De lopende tekst van een hoofdstuk staat in
> `meta.hoofdstukken[key].tekst` en verschijnt als sectie **Verhaal** boven het
> regie-script in de Aktes-tab. Twee wegen naar binnen: een `.md` inlezen (de
> **browser** leest het bestand en stuurt de tekst, dus geen aparte upload-route)
> of plakken met het potlood. Endpoint: `PUT /meta/akte/:key/tekst`.
> **De `[[ ]]` zijn niet alleen opmaak.** `GET /meta/akte/:key/namen` haalt de
> wikilinks uit de tekst en zegt per naam: heeft hij een **kaartje**
> (`entities.json` + documenten, genormaliseerd via `_impNorm`), en is hij
> **nieuw** of **terugkerend** — dat laatste door te vergelijken met de teksten
> van alle aktes met een lager `num`. Een alias (`[[Naam|zoals getoond]]`) en een
> dubbele vermelding tellen als één naam. Namen zonder kaartje krijgen in de
> namenrij een keuzelijstje om er meteen een aan te maken.
> Dit is ook de opstap naar het afleiden van `entity.links` uit de teksten (nog
> te doen; zie de valkuil bij de Verbindingen-tab hieronder).

> **Verdiepingen in een dungeon.** Een kaart kan een `verdieping` hebben
> (0 = begane grond, negatief = kelder; leeg = hoort niet bij een gebouw met
> verdiepingen), in te stellen bij *Kaart bewerken* in de kaartengalerij. Welke
> kaarten samen één gebouw vormen is **afgeleid uit de trappen ertussen** — geen
> apart `gebouwId`, dus de DM vult alleen het nummer in en tekent de trap.
> Een **trap is een kamer met `trapNaar: {mapId, roomId}`**: op de kaart een pijl
> (omlaag, of 180° gedraaid als het omhoog gaat) die je naar die verdieping
> brengt met de doelkamer geselecteerd — daardoor zweeft een kleine kelderkaart
> niet meer gecentreerd in het niets. Trappen worden **tweezijdig** gelegd: de
> tegenhanger wordt automatisch aangemaakt en bij verwijderen ook weer opgeruimd.
> Een trap **telt niet mee** in de onthul-teller (het is doorgang, geen kamer om
> te ontdekken). Bovenin staan de verdiepingen als knopjes (BG · 1 · −1);
> `_verdiepingStripHtml()` bouwt ze, `_verversVerdiepingen()` houdt ze bij.
> Let op: `_renderMapView()` tekende de kamerlijst pas ná het laden van de
> afbeelding — bij een kaart zonder afbeelding bleef de lijst van de vórige kaart
> staan. Dat luistert nu ook naar `error`.

> **Filmpje bij een personage.** Het bestand heet `<entityId>_video`; daar kijkt
> `routes/auth.js` rechtstreeks naar (het veld `data.portraitVideoId` bleek ooit
> onbetrouwbaar). Het speelt op de **landingspagina** tijdens het inzoomen op een
> portret, en in het spelersdashboard bij een klik op het portret. Uploaden gaat
> nu via de personage-editor (sectie *Filmpje*, alleen bij een bestaand kaartje).
> **Er is geen ffmpeg** — niet lokaal en niet op de server — dus knippen of
> hercoderen kan niet: te groot (>8 MB) weigeren we vóór het uploaden, en te lang
> laten we toe maar het **afspelen** stopt na 6 seconden
> (`LANDING_VIDEO_MAX_SEC` in `app.js`). De duur wordt vóór het uploaden in de
> browser gemeten met een `<video>`-element, dus er gaat niets onnodig over de
> lijn. In het dashboard speelt het filmpje wél helemaal uit: daar klikt de
> speler er zelf op.

> **Spelers geven elkaar voorwerpen.** `POST /items/:itemId/geef` met
> `{targetId}` — **direct**, zonder tussenkomst van de DM: aan tafel schuif je een
> ding over de tafel en dan is het van de ander. Knop *"Geven aan…"* onder een
> voorwerp in de Boedel, met een klein menu van je medespelers (portret + naam).
> Werkt voor voorwerp-kaartjes (`itemOwners`, ook stapelbaar — de hele stapel
> verhuist en telt op bij de ontvanger) én losse boedelregels (`playerItems`).
> Grenzen: alleen je eigen spullen, alleen binnen je eigen party, niet aan
> jezelf, en de DM kan het per party uitzetten met `tradeAllowed`. **Geld gaat
> niet zo** — dat heeft zijn eigen wegen (gedeelde beurs, losse munten).
> Het oudere verzoek-met-goedkeuring (`/items/:itemId/request`, `type:'trade'`)
> blijft bestaan maar wordt door de frontend niet gebruikt.

> **Printbare character sheets (DM).** `lib/character-sheet.js` rendert een print-pagina
> met een blad per personage; `GET /api/characters/:id/sheet` (één) en `GET /api/party/sheets?groep=`
> (hele groep) zijn **DM-only**. De DM opent 'm en drukt op print — of bewaart als pdf via het
> printdialoog. Bewust **geen fillable WotC-pdf**: dat formulier heeft geen vakjes voor boedel,
> de eigen munt (Florinde/Knaker/Centeling) of factie-titels, knijpt de spreukenlijst dicht op
> 28 regels en zou een template van 15,5 MB buiten git op de server vragen. De browser is al een
> prima pdf-generator, dus dit kost géén extra dependency.
> Bladen: 1 = abilities/saves/skills (met passive Perception/Insight/Investigation als
> eigen reeks kadertjes), stats, HP, attacks & cantrips, proficiencies, **Class Resources &
> Traits** (`playerTraits` + `playerTrackers`, gevuld bolletje = verbruikt, met een
> "blad N"-verwijzing naar de uitleg) en een gelinieerd **Notes**-veld dat met `flex:1` de
> restruimte pakt. **Inventory** (voorwerp-kaartjes uit `groups[gid].itemOwners` + losse
> `playerItems`, plus de beurs) krijgt **altijd** een eigen blad — inline onderaan blad 1
> paste het in de praktijk nooit, en de schatting die dat moest beslissen liet de browser er
> soms een pagina bij breken; de voorwerp-uitleg vult de rest van dat blad. Daarna
> spellcasting + spreukentabel, spell descriptions (volledige teksten) en features & traits
> uit `progression.json`. Elk blad heeft een voettekst met naam + campagne/groep +
> "blad X van Y" — per personage genummerd, zodat een uitgedeelde stapel te sorteren is.
> Rechtsboven op blad 1 staan de **party-portretten** (`/api/thumb/<imageId|entityId>` +
> `imgFocus`, initialen als vangnet).
> **Zelf pagineren:** `mdBlok()` schat per tekstblok de hoogte (±140 tekens per regel,
> gekalibreerd op een geprinte pdf) en `pakInBladen()` verdeelt de blokken over bladen, zodat
> "blad X van Y" niet liegt. Controle: print naar pdf en vergelijk het aantal fysieke
> pagina's met het laatste "blad X van Y" — die moeten gelijk zijn.
> **Markdown in bronteksten:** `mdInline()` doet `**vet**`, `*cursief*` en `_cursief_`;
> `mdBlok()` doet daarnaast `|`-tabellen (Nathair's Mischief) en `###`-kopjes. **Beurs:** zelfde regel als `_effectiveCurrency()` — staat de
> gedeelde beurs aan, dan is dát de partybeurs en telt `playerCurrency` niet mee.
> **Tekstopschoning:** SRD-teksten dragen markdown (`**_Sound._**`) en afbreekstreepjes uit
> de bron-pdf ("repre- sented") mee; `schoon()` + `mdInline()` in `lib/character-sheet.js`
> halen die eruit. Triggers: knop **Sheets** in de Aktes-tabkop,
> een scroll-icoon in de **regie-balk**, en een herinnering direct na `_regieBalkPauze()`
> (einde sessie = definitieve stand van level, HP en boedel).
> Let op bij CSS-wijzigingen: het `@media print`-blok staat **onderaan** de stylesheet — bij
> gelijke specificiteit wint de laatste regel, en `.balk { display:flex }` overrulde anders
> `.geenprint { display:none }`.

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
bronnen/               Meegeleverde brondata (spreuken, class features, backgrounds).
                       Stond in public/data/ — nu buiten public/, dus alleen via
                       GET /api/bron/:naam (achter een sessie, kaal buiten de
                       beheercampagne). Zie lib/bronnen.js.
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
| `loot.json` | loot-events: de bibliotheek van vondsten (naam, DC, items, goud, sjablonen) |
| `media.json` | mediabibliotheek: per fileId weergavenaam + auto-info (type, MIME, afmetingen, upload-datum). Gebruik wordt NIET opgeslagen maar live berekend via `lib/media-usage.js` |

---

## Icon-systeem

```javascript
// Helper beschikbaar als window.icon() overal in de frontend
icon('sword')                         // → <svg><use href="/img/icons.svg?v=8#icon-sword"/></svg>
icon('heart', { cls: 'icon-lg' })     // met extra CSS-klasse
icon('shield', { title: 'Verdediging' }) // met tooltip
```

**Beschikbare iconen** (icons.svg, v=8):
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

**Toegevoegd voor conditie-weergave** (Lucide, ISC): `angry` `arrow-down` `ban`
`battery-low` `bed` `brick-wall` `circle-dashed` `droplet` `ear-off` `flame` `ghost`
`fast-forward` `grab` `hand` `hourglass` `music` `pause` `rabbit` `shield-half` `shield-plus` `sparkle` `venetian-mask`
`waves` `wind`

> **Conditie-iconen** leven in `COND_ICON` (`combat-canvas.js`): per conditie een
> `[sprite-icoon, kleur]`. Drie kleurgroepen — gekleurd = PHB-condition, goud
> (`_CLASS_GOLD`) = klassefeature, staalblauw (`_SIT_STEEL`) = situationeel
> (Dodging, Cover, Hidden, Flying…). De picker in `dm-panel.js` groepeert met
> `_CC` en `_SIT`. `USE_SPRITE_COND_ICONS = false` zet de oude geschilderde
> PNG-set (`public/img/conditions/`) weer aan.

**Nooit emoji gebruiken in HTML-output.** Altijd `icon()` of Unicode-tekens die een functionele staat hebben (★/☆ voor favorieten).

---

## Authenticatie & rollen

> **"Actieve campagne" is niet waar jij bent.** Sinds elke campagne haar eigen
> pad heeft (`/grisburgh`), bepaalt `PUT /campaigns/active` alleen nog waar het
> **kale domein** en een verzoek **zonder sessie** landen — de terugval, verder
> niets. Je eigen scherm verhuist er niet door mee: daarvoor ga je naar `/naam`
> (knop *Openen* in het campagneoverzicht) en log je in met het DM-wachtwoord van
> díé campagne. Het oude `campaign:switched`-event, dat iedereen uitlogde, is weg;
> dat hoorde bij de tijd dat er één campagne tegelijk kon draaien. Een nieuwe
> campagne krijgt bij het aanmaken meteen een eigen DM-wachtwoord mee
> (`POST /campaigns` met `dmPassword`), anders kan niemand erin — alleen de
> standaardcampagne valt terug op `DM_PASSWORD`.

> **Elke login noemt zijn campagne.** Sinds stap 1 van het multi-DM-plan hoort
> bij elk inlogverzoek een `campagne`; zonder die naam weet de server niet wiens
> wachtwoord hij controleert. Een campagne heeft haar eigen DM-wachtwoord in
> `dm-state.json` (`dmPassword`), **gehasht met scrypt** (`scrypt$zout$sleutel`)
> — die bestanden gaan mee in de backups, en daar hoort andermans wachtwoord
> niet leesbaar in te staan. Een met de hand ingevuld, nog leesbaar wachtwoord
> werkt gewoon en wordt bij de **eerste geslaagde login** omgezet
> (`_dmLoginKlopt`). Instellen kan de DM zelf: Instellingen → *Jouw
> DM-wachtwoord* (`PUT /api/dm-wachtwoord`, minstens 8 tekens). Leegmaken mag
> alleen in de standaardcampagne — anders zou er niemand meer in kunnen.
> Alleen de **standaardcampagne** valt terug op `DM_PASSWORD` uit de omgeving,
> zodat de bestaande login blijft werken tot daar een eigen wachtwoord staat;
> zodra die campagne een eigen `dmPassword` heeft, telt de env-waarde niet meer.
> **Groepswachtwoorden blijven bewust leesbaar**: die deel je per appje en moet
> je kunnen opzoeken. Wachtwoorden worden vergeleken met
> `crypto.timingSafeEqual` (`_zelfdeGeheim`), zodat de reactietijd niet verklapt
> hoe ver je kwam. Ook de **tabletlogin** krijgt een campagne mee — zonder
> campagne-id belandt zijn socket in de algemene kamer en mist hij alles.

- **Eén wachtwoordveld:** POST `/api/auth/toegang` met `{ campagne, wachtwoord }` →
  `{rol:'dm'}` (meteen ingelogd) of `{rol:'groep', groep, personages}` (de kiezer
  toont dan alleen díé party; het wachtwoord wordt onthouden zodat de speler het
  niet twee keer intikt). Dat veld staat op de landingspagina in plaats van de
  knoppen *Dungeon Master* en *Tablet*.
- **Tabletmodus** heeft geen eigen wachtwoord meer: je logt in als DM en zet dít
  scherm om via Instellingen → Tafelscherm. **`?display=1` doet dat alleen voor
  wie is ingelogd** (DM of speler): zonder sessie werd elk bezoekend scherm
  anders meteen een kiosk, en omdat de vlag in `localStorage` belandt bleef het
  dat ook. Een scherm dat al is omgezet houdt tabletmodus; `?display=0` haalt
  het eraf. De inlossing gebeurt in `_displayModeInlossen()` in `init()`, dus
  ná het ophalen van de rol. Zo hoeft er niets getypt te worden op
  een scherm dat op tafel ligt. `/api/auth/tablet-login` bestaat nog (en zet nu
  wél een `campaignId`), maar de knop ernaartoe is weg.
- **DM:** POST `/api/auth/login` met `{ campagne, password }` → sessie krijgt `role: 'dm'` + `campaignId`
- **Speler:** POST `/api/auth/player-login` met `{ campagne, characterId, password }` → sessie krijgt `characterId` + `campaignId`
- **Testlogin (browser):** `window.app.testLogin()` → overlay met wachtwoord + karakterkeuze
- **DM-wachtwoord productie:** staat in PM2-env als `DM_PASSWORD` (niet in code)
- **Groepswachtwoord:** staat in `dm-state.json` → `groups[groepId].password`

Sessies worden gedeeld per browsertab (één cookie). DM en speler kunnen **niet** tegelijk in dezelfde browser ingelogd zijn.

> **Landing-knoppen Showcase + Testomgeving verwijderd (27 jun 2026).** De entry-knoppen
> én hun modals zijn uit `public/index.html` gehaald — alleen **Dungeon Master + Tablet**
> resten in de `.landing-footer`. Reden: testen gaat nu via local/prod (als DM zie je
> sowieso alles wat spelers zien), en de showcase/sandbox liet echte speeldata (aktes)
> doorschemeren. **De JS-handlers blijven bewust staan als dode code** — `testLogin`,
> `testLoginSubmit`, `closeTestLoginModal`, `sandboxLoginSubmit`, `closeSandboxModal`,
> `_landingTestLogin`, `_landingSandboxLogin` (in `app.js` + het `window.app`-object) plus
> de server-side **sandbox-campagne** — onbereikbaar vanuit de UI, maar bewaard voor
> mogelijke heropleving. `window.app.testLogin()` werkt nog vanaf de console. Wil je het
> ooit écht weghalen: knoppen+modals zijn al weg, dus dan rest het opruimen van die
> handlers + de sandbox-routing.

---

## Bronteksten: structuur naar buiten, tekst binnen

De 539 spreuken, de class features en de backgrounds stonden in `public/data/`
en waren dus **zonder inloggen** op te halen — 760 kB volledige PHB-tekst voor
wie het pad raadde. Ze staan nu in `bronnen/` (buiten `public/`) en gaan via
`GET /api/bron/:naam`, met een whitelist van vijf namen.

- **Wie krijgt wat?** `meta.bronTeksten` bepaalt het; ontbreekt die, dan geldt
  "alleen de beheercampagne" (`config.beheerCampagne`). Een andere campagne
  krijgt **structuur zonder tekst**: naam, niveau, school, casting time, range,
  components, duration en klassen blijven staan — genoeg om een spreuk te
  herkennen en te kiezen — maar `desc` en `higher_level` komen leeg binnen.
  Hetzelfde geldt voor `/api/progression` (features houden naam en level,
  verliezen hun `desc`) en voor de backgrounds.
- **Wat de DM zelf schrijft is van hem** en gaat altijd mee, ook in een kale
  campagne: `spells.json` per campagne (`{ eigen: { <index>: { desc, higher_level } } }`),
  te bewerken in het spreukdetail (`PUT /bron/spreuk/:index`). Leeg opslaan wist
  het weer. Een campagne met een **eigen** `progression.json` (zoals Grisburgh)
  krijgt die ongemoeid terug — kaal maken geldt alleen voor de meegeleverde seed.
- **`attachRole` is geen inlogcontrole.** Die zet de rol standaard op `'player'`,
  dus `if (!req.role)` gaat nooit af. De bron-route kijkt daarom expliciet naar
  `session.role === 'dm' || session.characterId` — dezelfde valkuil als eerder
  bij `/api/files/:id`.

Regenereren van de bronbestanden: zie `scripts/srd-2024/` (paden wijzen nu naar
`bronnen/`).

---

## Modules per campagne

Niet elke campagne heeft alles nodig, en niet alles is klaar om buiten Grisburgh
gebruikt te worden. `lib/modules.js` is de **enige** plek waar staat welke module
welke knoppen dekt: `secties` (zijbalk, `data-section`), `logtabs` (Logboek-menu),
`dmTabs` (Meesterkamer) en `spelerTabs` (subtabs van het spelerstabblad).

- **Stand per campagne:** `meta.modules` (`{ id: true|false }`). Ontbreekt een
  sleutel, dan geldt `startset` uit de catalogus — zo krijgt een bestaande
  campagne een nieuwe module vanzelf. Grisburgh staat expliciet op alles `true`.
- **De client rekent niets uit.** `GET /meta` levert `modules` (id → bool) én
  `verborgen` (de vier lijstjes hierboven). `_pasModulesToe()` in `app.js` zet
  `.module-uit` (`display:none !important`) op wat weg moet en veegt eerst schoon,
  zodat aanzetten ook zonder herladen werkt. Client-helpers: `window._moduleAan`,
  `window._dmTabAan`, `window._spelerTabAan`.
- **Uit is weg**, geen grijze "binnenkort"-knop. Een menuknop waarvan alle items
  uit staan verdwijnt zelf ook (Archief, Logboek, Diensten).
- **Alleen de beheerder zet modules aan**: Instellingen → Campagnes, per campagne
  een uitklap met vinkjes (`PUT /campaigns/:id/modules`).

> **Beheer is niet hetzelfde als DM zijn.** `requireBeheerder` (in `routes/auth.js`)
> laat alleen de DM van `config.beheerCampagne` (env `BEHEER_CAMPAGNE`, standaard
> `grisburgh`) bij `/campaigns` (lijst, aanmaken, actieve campagne wisselen) en bij
> de modules. Dat was eerder `requireDM`, en daarmee kon de DM van campagne B de
> **actieve** campagne verzetten — de campagne waar het kale domein naartoe
> stuurt en waar een verzoek zonder sessie in landt. Bewust een vaste naam uit de
> config en niet "de actieve campagne": die kan wisselen, en dan zou iemand
> zichzelf het beheer in kunnen schuiven.

**Een nieuwe module toevoegen:** regel erbij in `MODULES` (id, label, groep,
`startset`, en de UI-sleutels die hij dekt) — verder niets. De filtering,
de catalogus in het beheerscherm en de `verborgen`-lijstjes volgen daaruit.

---

## Niets van Grisburgh in gedeelde code

De app draait meerdere campagnes; wat van Grisburgh is, hoort in Grisburghs
**data** te staan, niet in de code. Drie plekken waar dat mis kan gaan:

- **Munten.** `meta.currency` bepaalt de namen; de sleutels `fl`/`kn`/`cl`
  blijven de gouden, zilveren en koperen plek in de verhouding 1:10:100 (daar
  hangt te veel opgeslagen bezit aan). Vangnet is `storage.MUNT_STANDAARD`
  (`Gold`/`Silver`/`Copper`), client-side `window._muntNamen()` — **nooit** een
  eigen `|| { fl: 'Florinde', … }` in nieuwe code. De DM hernoemt ze bij
  Instellingen → *Munten* (`PUT /meta/app` met `currency`). Grisburgh heeft zijn
  Florinde/Knaker/Centeling nu expliciet in `meta.json` staan; daarvóór kwam die
  uit een fallback in de code, waardoor een tweede campagne ze ook kreeg.
- **Plaatsnamen in teksten.** `window._campagneNaam()` (= `meta.appTitle`) voor
  regels als "In {naam} — klik om te verlaten" of "Ontdekt in {naam}". De
  datasleutels blijven zoals ze zijn (`meta.buitenGrisburgh`,
  `buitenGrisburgEntiteiten`) — die hernoemen kost een migratie en levert niets.
- **Kaarten.** Er is géén ingebouwd vangnet meer: Grisburgh heeft zijn stadskaart
  en Isfār gewoon in `map.json`. Een campagne zonder kaarten toont een lege staat
  (`_legeStaat()` in `render-kaart.js`) in plaats van andermans stadskaart.

**Titel en PWA-manifest komen van de server.** `index.html` is één bestand voor
alle campagnes, dus staat er in de shell geen naam meer. De SPA-fallback in
`server.js` vult `<title>` en `apple-mobile-web-app-title` in en hangt
`?campagne=<id>` aan de manifest-link; `GET /manifest.webmanifest` serveert daarop
naam, `start_url` en `scope` van díé campagne. Welke campagne dat is bepaalt
`_campagneVan(req)`: **eerst het pad**, dan `?campagne=`, dan de sessie — een
bezoeker zonder sessie op `/prewett` hoort niet Grisburghs titel te zien. De
app-iconen zijn nog van Grisburgh; eigen beeld per campagne is werk voor later.

---

## Campagnes & scoping

> **Elke campagne heeft haar eigen pad:** `/grisburgh`, `/prewett`. Het kale
> domein stuurt door naar de standaardcampagne (mét querystring, dus `?display=1`
> blijft werken), zodat bestaande bladwijzers blijven werken. De client leest de
> campagne uit `location.pathname` (`campagneUitUrl()` in `api.js`) en stuurt 'm
> mee bij elke login; komt iemand via een oud adres binnen, dan vertelt
> `GET /api/campagne` welke campagne erbij hoort. De scoping-middleware in
> `server.js` kiest in deze volgorde: **sessie → `?campagne=` → standaard**.
> Die querystring is nodig voor wat vóór het inloggen moet werken (de
> personagekiezer op de landingspagina).
>
> **Het pad bepaalt de campagne, de sessie bepaalt je rol.** De client hangt
> `?campagne=` aan elk verzoek (uit het pad in de adresbalk) en die wint van de
> sessie — anders zag een DM van A die `/B` opent nog steeds A. Dat maakt de
> querystring géén sleutel: `sessieHoortHier()` in `routes/auth.js` telt een
> sessie alleen mee als haar `campaignId` gelijk is aan de campagne waarin het
> verzoek draait (`storage.huidigeCampagne()`). `attachRole`, `requireDM`,
> `requireBeheerder` én `GET /auth/role` gebruiken die controle, dus in een
> vreemde campagne ben je een bezoeker: je krijgt de landingspagina en logt in
> met háár wachtwoord. `tests/campagne-isolatie.test.js` bewaakt precies dat.

> **Bestanden zitten achter die scope.** `/api/files/:id` en `/api/thumb/:id`
> vragen een sessie; de enige uitzondering is het portret (en portretfilmpje) van
> een personage dat de landingspagina toch al opsomt — zie `_magBestandZien()`.
> Vóór stap 1 was élk bestand publiek: `attachRole` zet `req.role` standaard op
> `'player'`, waardoor de controle `if (!req.role)` nooit afging.
>
> **`tests/campagne-isolatie.test.js` bewaakt dit** (14 tests, geen todo meer):
> logins kruislings, lezen en schrijven in andermans campagne, bestanden, de
> socketkamers en een veegtest over alle GET-routes met een kanarie.

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

**7. Entiteit-kiezers zijn zoekbaar, geen volledige `<select>`-lijst.** Overal
waar de DM een personage/locatie/voorwerp/document kiest uit een mogelijk lange
lijst: gebruik een **zoekbaar `<input list="…">` + gedeelde `<datalist>`** (type
om te filteren) i.p.v. een `<select>` met alle entiteiten. Patroon: de datalist
één keer renderen met `<option value="<naam>">`, de input houdt de getypte naam,
en de handler resolvet **naam → id** (`list.find(x => x.name.toLowerCase() === naam.toLowerCase())`)
met een korte foutflits (`.dm-input--err`) als er geen match is. Referentie:
de factie-leden-picker (`factie-lid-add-*` + `factie-pers-dl` in `dm-panel.js`)
en de monster-datalist (`dm-enc-monsters-dl`).

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
- Seed: `bronnen/class-progression.json` (12 klassen, 13 soorten — 2024 PHB)
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

- **Bibliotheek:** 16 PHB-2024-backgrounds in `bronnen/backgrounds-2024.json` (geëxtraheerd uit
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
- **Verbindingen-tab bestaat niet meer.** Koppelingen leg je in de tekst met
  `[[Naam]]`; `mdToHtml()` in `app.js` maakt daar klikbare links van. Het veld
  `entity.links` bestaat nog — kaartjes-preview, zoeken, dashboard en de
  campagneboek-export lezen het — en wordt bij het **uitserveren aangevuld** met
  de `[[ ]]` uit de eigen tekst (`_linksMetTekst()` in `routes/api.js`, met een
  naam→type-index die op mtime cachet). **Aanvullen, niet vervangen**: van de
  1041 handmatig gelegde verbindingen in deze campagne staat maar 40% ook in de
  tekst — puur afleiden zou er 632 wegvagen. Wat opgeslagen is blijft dus staan.
  De editor stuurt `links` niet meer mee bij het opslaan, anders zouden de
  afgeleide verbindingen ongemerkt vastgelegd worden.
- **Personages tussen party's verhuizen** → halve verhuizing. `entity.data.groep`
  is één veld, maar de groep houdt zelf `itemOwners`, `secretReveals`,
  `visibility`, `docVisibility`, `companions`, `itemCharges`, `sharedPurse`,
  `factieZichtbaar`, `voorspellingen`, `dienstenToegang`, `bestiarium` en
  `deceased` bij. Die blijven achter; alleen `playerItems` en `playerCurrency`
  (per characterId) reizen mee. Twee party's samenvoegen kan dus niet zonder die
  velden bewust om te zetten — voorwerpbezit en onthulde geheimen raak je anders
  kwijt.
- **Een eigennaam van Grisburgh in gedeelde code** → een tweede campagne ziet
  hem ook. Munten via `window._muntNamen()` / `storage.MUNT_STANDAARD`,
  plaatsnamen via `window._campagneNaam()`, geen ingebouwde kaart als vangnet.
- **Emoji in HTML-output** → vervang door `icon()`. Emoji zijn onaanvaardbaar in de UI.
  Let ook op `placeholder=""`-attributen: daar kan geen SVG in, dus zet het icoon
  ernaast in plaats van een emoji in de tekst.
- **Lichte tekstkleur in een DM-tab** → onzichtbaar. Alleen de **zijbalk** met de
  tabknoppen is donker; de tab-inhoud en het instellingenvenster zijn licht
  perkament. Gebruik `#3a2410` (als `.dm-input`) voor tekst en `#7a6040` (als
  `.dm-hint`) voor bijschriften. Twee keer misgegaan: de aanwezigheids-chips en
  de loot-regels.
- **`sed` met speciale tekens op de server** → schrijf een tijdelijk .js-bestand en voer dat uit met `node`.
- **DM en speler dezelfde browser** → session cookie gedeeld. Gebruik incognito of ander apparaat voor gelijktijdig testen.
- **Socket-event naar verkeerde campagne** → altijd `io.to(campaignId).emit()`, nooit `io.emit()`.
- **Dangling module-import na een revert** → als een feature wordt teruggedraaid, verwijder óók de `import`-regel in `app.js`. Een import van een verwijderd `.js`-bestand laat de node-server `index.html` (HTML) terugsturen i.p.v. JS → **de hele app.js module-graaf faalt stil** (`window.app` half-geïnitialiseerd, `window.progressie`/andere globals undefined, geen console-error). Symptoom: spelerstab half kapot, sync/handlers werken niet. Zo ging het mis met `glossary.js` (juni 2026): productie bleef werken omdat het oude bestand daar nog stond, maar een verse checkout was stuk.
- **Nieuwe dienst toevoegen → Geluiden-tab meenemen.** Een nieuwe dienst-sectie (zoals herberg/tempel/magizoo) heeft een sfeerloop nodig op drie plekken, anders speelt 'm niet en/of staat de lijst scheef:
  1. `routes/api.js` → `_DIENST_SVC_KEYS` (validator voor `serviceAmbiance`-keys in `PUT /sounds`).
  2. `public/js/app.js` → `_DIENST_AMB_LABELS` (section-key → label; `switchSection` triggert hierop `setServiceAmbiance`).
  3. `public/js/dm-panel.js` → `_DIENSTEN` in `_renderGeluiden` (rij waar de DM de loop instelt).
  Facties zijn al dynamisch (uit `meta.facties`, key `factie:<id>`); rust-loops zijn vast (`rust-veld|rust-herberg|rust-kort`). Een sectie zonder per-stuk-wisseling (zoals het Facties-overzicht) krijgt géén entry in `_DIENST_AMB_LABELS` — de loop schakelt dan in de open-handler (bv. `_factieOpen`).

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

> **Werk-trunk = `main`** (sinds 23 jun 2026). `main` wijst nu naar de live
> productiecode (voorheen branch `claude/mediabibliotheek-herstel`, nu opgeruimd).
> **Tak nieuwe features af van `main`** en deploy via `scp` uit de werkmap.
> De oude, achtergebleven main-lijn (PWA-docs, oudere Facties/Glossary — nooit op
> productie) is gearchiveerd als `main-oud-github` + `main-oud-lokaal` op origin;
> die hoeven niet teruggemerged. Historische context over hoe de mediabibliotheek
> 22 jun stil verloren ging bij een deploy vanuit een oude branch: zie
> [[mediabibliotheek-hersteld-juni-2026]].

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
