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

## Nieuw gebouwd? Schrijf meteen op hoe je het test

Bij elke feature die erbij komt hoort **dezelfde dag een regel in
`docs/testronde.md`** — in het blok waar hij thuishoort, ook als dat blok pas
later aan de beurt is. Eén regel, in de vorm van een handeling met een
verwachting: *wat doe je, en wat hoort er te gebeuren.* Niet "controleer de
missiegever" maar "koppel een gever aan een missie; zijn naam staat op het
missiekaartje en de missie staat op zijn eigen kaartje".

Waarom dit een afspraak is en geen goede gewoonte: de app groeit sneller dan de
lijst, en wat je niet opschrijft op het moment dat je het bouwt, schrijf je
nooit meer op — je weet dan niet meer wat de randgevallen waren. De lijst is
ook de plek waar staat wat een feature *hoort* te doen; dat is bij een
werkdocument als dit vaak de enige specificatie die er is.

Bevindingen komen in dezelfde file, in de tabel onderaan, met wat je gedaan
hebt. De gepubliceerde versie van de lijst leeft op claude.ai (zie de
projectgeschiedenis voor de link) en wordt bijgewerkt door `docs/testronde.md`
opnieuw om te zetten.

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
  - `render-archief.js` — logboek + sessieverslagen + aktes (documenten zijn sinds 8 sep 2026 gewone kaartjes en leven in `render-campagne.js`)
  - `render-bestiarium.js` + `render-statblock.js` — **bestiarium** (eigen kaart + statblock-modal, eigen editor in `dm-panel.js`)
  Het bestiarium deelt wél de `.entity-card`-kaartstijl, maar heeft een **eigen** detail-/editorvenster.
  Doe je iets aan labels/kaarten/vensters van de archief-tabs, check dan al deze bestanden.
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

> **Er zijn twee testplekken; verwar ze niet.** De campagne **`Test`**
> ("Een testomgeving", te bereiken op `/Test`) is de plek om vrij te spelen:
> eigen spelers (Wilmer Vlasbaard, Rozemarijn Doorn, Johannes Kanonnen), eigen
> voorwerpen, twee party's. Dáár horen nieuwe testkaartjes. De **Testgroep**
> hieronder is een party *binnen Grisburgh* en dient om te kijken hoe echte
> campagnedata zich gedraagt. Zegt de gebruiker "de testomgeving" of "de
> testruimte", dan bedoelt hij de campagne. Let op: het DM-wachtwoord van `Test`
> is gehasht, dus via de API inloggen kan niet zonder dat wachtwoord; een
> gegevenswijziging daar gaat met een node-script op de server (backup eerst).

> **De campagne `Test` is gevuld om weergaven te kunnen beoordelen** (11 sep 2026).
> Alle proefkaartjes hebben een herkenbaar id (`t_seed_doc_*`, `e_test_seed_*`,
> `loc_test_seed_*`, `gv_test_seed_*`) en zijn dus in één greep terug te vinden
> of weg te gooien. Er staat één document per **briefstijl** (hand, hand2,
> machine, drukwerk, knipsel, oud), één waarbij `briefstijl` het type
> overschrijft, één op **vaag** (waas-test), één met een **pdf-scan** en één met
> een **geluidsfragment**, plus een personage met portret én startscherm-filmpje,
> een locatie met gevel en een Armor met AC, Stealth-nadeel, Strength-eis en
> attunement. De media zijn **kopieën uit Grisburgh** met een eigen id; daar
> raakt dus niets zoek als je hier opruimt.

> **De campagne `Test` heeft nu één speler per klasse** (17 sep 2026). Dertien
> spelers, dertien klassen, dertien volken, verdeeld over de twee party's —
> aangemaakt met `node scripts/test-pcs-vullen.js Test --schrijf`. De ids zijn
> `t_pc_<klasse>`, dus in één greep terug te vinden of weg te gooien; het script
> slaat over wat er al is, dus opnieuw draaien kan geen kwaad.
> Bewust gevarieerd, want dat is juist wat je wil kunnen zien: **levels 1 t/m
> 11** (vergrendelde niveaus in de tijdlijn), **twee zonder subklasse** — de
> Warlock is level 2 en kiest pas op 3, de Artificer heeft er in de seed geen —
> en één volk uit `volkenOverig` (Tabaxi). Nagekeken: alle dertien sheets
> renderen (martials 4 bladen zonder spellcasting, casters 5 mét slots), een lege
> subklasse valt weg in plaats van "Warlock ()" te worden, en de progressie van
> een klasse zonder seed loopt niet stuk.
> Let op: het DM-wachtwoord van `Test` is gehasht en `DEV_AUTO_DM` geldt alleen
> de standaardcampagne — om daar lokaal als DM in te komen zet je in een
> **wegwerpkopie** even een leesbaar `dmPassword` in `dm-state.json`.

**Testgroep:** Groep 3 (ID: `groep_1777039899017_94g1`)

| Karakter | ID | Klasse |
|---|---|---|
| Test McTestface | `e_1778689148089_pypw` | Wizard L7, subklasse Evoker |
| Dummy Drakenbaard | `e_test_1779133509945_f2rbc` | — |
| Proto Toverstaf | `e_test_1779133509946_yzhly` | — |

> **Testen doe je in de testgroep — ook in een wegwerpkopie.** Voor een speelronde
> draai ik vaak een tweede server op een eigen poort met `GRISBURGH_DATA_DIR` naar
> een kopie van de productiedata; productie blijft dan gegarandeerd ongemoeid.
> Dat is niet genoeg: gebruik binnen die kopie ook **Groep 3** en zijn karakters,
> niet een party die echt gespeeld wordt. Twee redenen. Wie meekijkt ziet anders
> de naam van een echte speler in de uitvoer langskomen en kan niet zien of het
> nu een kopie was of niet. En één verkeerde poort of een vergeten env-var, en je
> schrijft in de boedel van iemand die volgende week verder speelt. Nieuwe
> testgegevens maak je in de testgroep aan; laat de bestaande party's met rust.

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
index.html  : theme.css?v=605   app.js?v=774   sound-manager.js?v=8
app.js      : api.js?v=285  dm-panel.js?v=225  media-picker.js?v=8
              render-archief.js?v=92  render-bestiarium.js?v=29  render-campagne.js?v=304
              render-dashboard.js?v=9  render-dungeon.js?v=53  render-kaart.js?v=31
              render-progressie.js?v=46  render-relatiemap.js?v=25  render-spreuken.js?v=39
              render-vaardigheden.js?v=1
              render-statblock.js?v=9  socket-client.js?v=71
dm-panel.js : combat-canvas.js?v=22   render-statblock.js?v=9
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

> **Een akte schrijf je in de app.** `public/js/akte-schrijven.js` — het
> ganzenveer-knopje bij *Verhaal* in de Aktes-tab — is een schrijfscherm over de
> volle hoogte: secties (`##`) als overzicht ernaast, opslaan tijdens het typen
> (gebundeld, 1,2 s), een voorbeeldstand, `.md` inlezen en de markdown
> kopiëren. Het verschil met Obsidian zit in de **invoegbalk**: die kent de
> campagne, dus `[[Naam]]`, `![[fileId]]` en een regieblok wijzen altijd naar
> iets dat bestáát. De regieblokken zijn **Obsidian-callouts**
> (`> [!voorlezen]`, `[!dm]`, `[!gevecht]`, `[!tabel]`, `[!buit]`, `[!kaart]`,
> `[!rust]`, `[!check]`) zodat de tekst heen en weer te kopiëren blijft;
> `REGIE_BLOKKEN` en `regieNaarHtml()` in dat bestand zijn de enige plek waar
> staat welke er zijn en hoe ze eruitzien. Plan: `docs/voorstel-akteregie.md`.
> **Drie ingrepen in plaats van een blokeditor.** (1) **Secties verslepen** in
> de zijbalk van het schrijfscherm: `_sectieBereik()` pakt de regels van die kop
> tot de volgende kop van hetzelfde niveau — inclusief zijn subkoppen — en
> `_sectieVerplaats()` schuift ze. Er wordt niets geparseerd en niets
> herschreven, dus dit kan je hoofdstuk niet stil veranderen. (2) Een
> **potlood op elk regieblok** (`blokBewerk`): dezelfde kiezer als bij het
> invoegen, of het blok weghalen. `_blokRegelVervang()` vervangt precies één
> regel en doet níéts als die regel er niet meer zo staat. In de lade is er geen
> tekstvak: daar bewaart hij meteen en roept `window._ladeHerlaad()`. (3)
> **Naast elkaar schrijven** (`split`): tekst links, perkament rechts, dat
> meeloopt met een korte vertraging. Geen blokeditor dus — die zou het
> ongedaan-maken van het tekstvak kosten en een lossless parse vragen; de
> afweging staat in `docs/voorstel-akteregie.md`.
>
> **De importer bewaart de `.md` nu wél.** Hij las het bestand, haalde de
> tokens eruit en gooide de tekst weg — precies waarom Obsidian tijdens het
> spelen nog openstond. `POST /import/akte/apply` neemt `md` mee en vult
> `meta.hoofdstukken[key].tekst`; bij *aanvullen* blijft bestaande tekst staan.
> De kop van het schrijfscherm: *Namen* (met het aantal namen zonder kaartje als
> badge), *Tekst en beeld*, *Spelen*, **⋯** met importeren/exporteren, en de
> hulpknop — uitleg staat in `hulp_akte_schrijven`, niet onder de knoppen.
>
> **De invoegbalk is een menu.** Twaalf pillen naast elkaar lazen als een
> gereedschapskist; nu staan sectie, kaartje en beeld los (die gebruik je in
> elke alinea) en zit de rest onder *Invoegen*, gegroepeerd, met **Alt + letter**
> ernaast (`INVOEG_MENU` in `akte-schrijven.js` is de enige lijst — menu, knop
> en sneltoets komen daar alle drie uit). Enter in een lijst maakt het volgende
> streepje of nummer; een lege regel sluit hem.
>
> **`regieNaarHtml()` doet meer dan `mdToHtml()`**, want een hoofdstuk bevat
> dingen die een kaartje-tekst niet heeft: koppen tot **zes** niveaus (`######`
> draagt in een akte de scènes), `|`-tabellen (een dobbeltabel krijgt
> `data-dobbel` mee voor de speel-kant), `- `-lijsten, en `![[bestand]]`. Dat
> laatste is het verschil tussen een vault en een campagne: een id dat wij
> kennen wordt een beeld, een bestandsnaam uit Obsidian wordt een **slot** met
> een knop die hem aan een bestand uit de bibliotheek koppelt — en dan meteen
> overal waar diezelfde naam staat. Een `DC12 Religion check` in de lopende
> tekst wordt een chip; een aantekening, zoals de loot-DC.
> **Elf regieblokken, en ze doen wat de regie-balk doet.** `REGIE_BLOKKEN`:
> `voorlezen` (naar het tafelscherm), `dm` (alleen jij), `gevecht` (start de
> encounter), `tabel` (rolt, uitslag onder het blok), `buit` (opent de
> verdeling), `kaart` (opent de dungeon), `kamer` (geeft toegang én onthult één
> kamer — schrijfwijze `[!kamer] Kaart · Kamer`), `rust` (het rustmenu),
> `muziek` (Spotify: een `spotify:`-uri of een naam die we opzoeken), `brief`
> (verstuurt de inhoud van het blok cinematisch aan de actieve party) en
> `check` (een DC als aantekening). Getest met een proefakte die ze alle elf
> bevat.
>
> **Voorleestekst op het tafelscherm.** `POST /display/tekst` → socket
> `display:tekst` → `window._displayTekst()` toont één vel perkament groot
> gezet, met de sectiekop erboven. Alleen het tafelscherm (`_isDisplayMode`),
> zoals `brief:display` en `loot:display`: de spelers hóren het, ze hoeven het
> niet op hun telefoon mee te lezen. Terug naar sfeer gaat met de
> monitor-knop in de regie-balk (`display:idle`).

> **Geheimen onthul je ook vanuit de tekst.** Een `[[naam]]` van een kaartje met
> geheimen die deze party nog niet kent draagt een **slotje**; dat opent de
> regels met per regel een knop (`geheimen`/`geheimToggle` → `PUT
> /entities/:type/:id/secret`). Een kaartje heeft er zelden één, dus geen blinde
> "onthul de eerste". De teller komt uit de naamindex, die daarvoor
> `_geheimTotaal`/`_geheimOnthuld` meedraagt (`_buildEntityIndex` in `app.js`);
> welke régel open staat leest de server uit (`_onthuld`), zodat de client geen
> posities telt.
>
> **Plaatshouders dragen `data.concept`.** Een kaartje dat vanuit een akte (of
> straks een dungeon) als plaatshouder is aangemaakt krijgt die vlag; de
> kaartjes-editor haalt hem er bij het opslaan af — dat ís invullen. In het
> archief filtert de chip **Onaf (N)** erop en draagt het kaartje een gestippelde
> rand; bij een akte staat er in de samenvatting **N na te kijken**, met een
> lijst van namen zonder kaartje, lege kaartjes en beelden zonder bestand.
> Bewust bij de akte en niet als belletje: dit hoort bij het voorbereiden van de
> akte die je gaat spelen. `GET /meta/akte/:key/namen` geeft per naam
> `concept` mee.
>
> **Een naam zonder kaartje krijgt een plus.** Schrijf je `[[Vrouwe Kwartel]]`
> en bestaat die niet, dan maak je hem ter plekke aan als leeg kaartje
> (`maakPlaceholder`): kies de soort, en de rest vul je later in. De
> kaartjes-kiezer heeft dezelfde uitweg (*Nieuw kaartje met de getypte naam*).
> De plus hangt aan `_potloden` (voorbereiden), de oogjes aan `_acties` (spelen).
>
> **De Markt — alle winkels op één plek.** Module `markt`, sectie `markt`,
> route `GET /markt`. Een winkel was een tabblad **op een kaartje**: de
> machinerie was compleet (rotatie, onderhandelen, humeur, uitverkocht), maar er
> was nergens een scherm waar je zag dát er negen winkels zijn. Dit is een
> **weergave**, geen tweede opslag: de voorraad blijft op het kaartje en klikken
> opent dat kaartje op zijn winkeltabblad (`_openDetail(soort, id, false,
> 'voorraad')`). Zoeken gaat over alle winkels tegelijk en zet de prijzen naast
> elkaar — in Grisburgh liggen zestien voorwerpen bij meer dan één winkel, en een
> Potion of Healing kost bij Bobo 40 fl waar hij elders 20 is.
>
> **Eigen leesroute, met opzet.** `GET /shops/:id/beschikbaar` *máákt* de rotatie
> van een roterende winkel als die er nog niet is, en schrijft `dm-state.json`.
> Een markt die alle winkels opvraagt zou dus in één klap ieders schappen rollen,
> op een moment dat niemand die winkel bezocht. `GET /markt` leest de rotatie
> alleen; is er nog geen, dan gaan er **nul items** mee (`rotatieOnbekend`) —
> de hele pool meesturen zou de verrassing wegnemen, en dat is niet in de
> weergave op te lossen want dan staat het alsnog in de netwerktab.
>
> **Twee onafhankelijke assen voor zichtbaarheid**, allebei bewaakt:
>  - de **winkel** bepaalt of zijn regels er zijn — `g.visibility[shopId]` plus
>    de bereikbaarheid van de lopende akte (`_bereikbaarheidVoor`);
>  - het **voorwerp-kaartje** bepaalt of je kunt doorklikken. Naam, prijs en
>    beeld gaan mee (dat ligt in de etalage, de DM heeft het daar neergezet),
>    maar `entityId` alleen als de party het kaartje kent — anders krijgt de
>    speler een knop naar iets wat hij niet mag zien. In Grisburgh gold dat voor
>    **59 van de 59** gekoppelde regels.
>    Nagemeten geval: een kaartje dat de party kent houdt zijn doorklik in élke
>    winkel die ze kunnen zien, en een verborgen winkel verdwijnt compleet —
>    inclusief zijn regel voor datzelfde voorwerp.
>
> **Filteren op gebied: de DM kiest, de app leidt af.** Waar een winkel ligt
> volgt uit het veld *Gebied* (`data.wijk`) op zijn locatiekaartje, dat naar een
> **ándere locatie** wijst — dus er zit een keten in: Boekenwyrm › Luimpoort ›
> Grisburgh › Continent (`_gebiedKeten()`, met lusbeveiliging). Een winkel valt
> onder élk lid van die keten, dus "Grisburgh" vangt ook alles in Luimpoort.
> **Welke laag van die keten betekenis heeft, weet alleen de DM**: alle wijken
> van de stad als losse knop is zelden wat je wilt. Hij vinkt ze daarom aan in
> **Meesterkamer → Diensten → Markt** (`meta.markt.gebieden`, `PUT /meta/markt`);
> zijn volgorde is de volgorde op het scherm, want dat is een redactionele keuze.
> Staat er niets, dan leidt de client ze af uit de ketens en sorteert op aantal
> winkels — zo werkt het meteen in een campagne waar niemand er nog naar keek.
> Datzelfde scherm toont onderaan de keten per winkel, en dáármee zie je je eigen
> data: in Grisburgh hebben *Oosterkwartier* en *Het Oude Glasblazershuis*
> **zichzelf** als Gebied, dus die twee komen nooit onder Grisburgh uit.
>
> **Klikken op een winkel opent een scène, geen tabblad.** Zelfde vorm als elke
> andere dienst: de gevel als achtergrond, een rond portret van de winkelier, de
> sfeertekst als groet, en een weg terug naar de markt. Daaronder staat
> **dezelfde voorraadtabel** als op het kaartje — letterlijk dezelfde, want die
> is uit `_openDetail` gelicht naar `window._winkelVoorraadHtml({e, tab,
> beschikbaarData, uitverkochtSet, shopCurrencyData, heeftVoorraad})` in
> `render-campagne.js`, en beide ingangen roepen hem aan. Twee tabellen die
> hetzelfde moeten zeggen lopen vroeg of laat uit elkaar — zelfde reden waarom
> er maar één monster-editor is. `window._winkelSceneData(soort, id)` haalt de
> drie dingen op die de renderer nodig heeft.
> **Het kaartje-tabblad blijft bestaan**: dat is de toonbank van de DM
> (uitverkocht zetten, afrekenen, inkopen van de party), en dat wil je tijdens
> een sessie vanuit het kaartje kunnen, niet via de Markt.
>
> **Op het kaartje in het overzicht staat de wínkelier**, niet de gevel — die
> hangt al als achtergrond achter het hele scherm. Wie dat is komt uit
> `winkelLocatieId` (alle negen winkels in Grisburgh hebben er een), anders uit
> een betrokkene met een rol die daarop lijkt (`_MARKT_ROL`). Kent de party die
> persoon niet, dan komt er geen portret: dat zou verklappen dát er iemand is.

> **De Markt leent een achtergrond.** Er staat geen gebouw — de Markt ís de
> optelsom van de winkels die je kent. Dus kiest hij bij elk **bezoek** de gevel
> van een willekeurige winkel die deze party open ziet (`_marktKiesGevel`), met
> een bijschrift eronder. Bewust één keuze per bezoek en niet per hertekening:
> anders wisselt de achtergrond onder je handen terwijl je in het zoekveld typt.
> Het inline `background-image` zet via de bestaande regel
> `.herberg-scene[style]` vanzelf de tint-overlay en het leesbaarheidspaneel aan
> — dezelfde machinerie als bij de andere diensten, dus er hoefde daar niets bij.

> **Nog open (stap 3 en 4 uit `docs/voorstel-markt.md`):** een boodschappenlijst
> over winkels heen, en één DM-tabel om voorraad en prijzen bij te stellen.

> **Beelden worden bij binnenkomst WebP.** Gemeten op 15 sep 2026: de
> bestanden van Grisburgh waren samen **2.053 MB**, gemiddeld 1.853 kB per
> beeld. Dat zat **niet in de afmetingen** — 843 van de 1.135 beelden zijn maar
> 600–1199 px breed — maar in het formaat: **907 PNG's namen 1.869 MB** in,
> gemiddeld 2.110 kB per stuk, terwijl dezelfde plaat in WebP ongeveer een
> tiende is (proef op tien willekeurige PNG's: 16,9 MB → 1,7 MB).
> `_beeldVerkleinen()` in `routes/api.js` zet daarom elk binnenkomend beeld om
> (q82, bovengrens 2560 px op de langste zijde) vóór `storage.saveFile`. Beide
> uploadpaden gebruiken hem: `POST /files/:id` en de akte-importer.
>  - **GIF en SVG blijven met rust** — een gif verliest zijn animatie, een svg is
>    een tekening en geen foto (sharp rastert hem).
>  - **Wordt het niet kleiner, dan blijft het origineel.** Een kleine,
>    al geoptimaliseerde jpeg kan in WebP juist groeien.
>  - `.rotate()` legt de EXIF-draaiing vast; zonder dat staat een telefoonfoto
>    die de browser goed toonde na de conversie op zijn kant.
>  - 2560 px is ruim: een 1440p-scherm op ware grootte, een 4K-tafelscherm op
>    tweederde. Dertien bestanden waren breder.
> Bewaakt door `tests/upload.test.js` (omzetting, bovengrens, en dat een gif
> ongemoeid blijft).
>
> **Bestaande bestanden:** `node scripts/beelden-naar-webp.js <campagne>` rekent
> voor, `--schrijf` doet het. Het **id blijft gelijk**, alleen de extensie
> verandert — `storage.getFile()` zoekt op het id-deel, dus er hoeft nergens een
> verwijzing mee. De originelen gaan naar `files-origineel-<datum>/` naast de
> campagnemap en worden niet weggegooid.
> Let op: `storage.deleteThumb()` ruimt sinds vandaag ook `<id>.w1200.webp` op
> (de brede variant voor aktebanners), anders blijft na een nieuwe upload de
> oude banner staan.

> **Condities staan op één plek: `public/js/conditions.js`.** Er waren er drie,
> en ze waren uit elkaar gelopen: de picker van de DM had er 38 in het Engels,
> het spelerstabblad 18 in het Nederlands (`PLAYER_COND_INFO`) en het dashboard
> nog eens 16 losse labels (`COND_LBL_MAP`). Dezelfde conditie heette dus
> *Restrained* bij de DM en *Vastgehouden* bij de speler — tegen de afspraak in
> dat een PHB-term Engels blijft, en een speler die op zijn token iets anders
> leest dan de DM zegt kan het niet opzoeken. Bijvangst: een conditie die
> alleen de DM-lijst kende (*Dodging*, *Half Cover*, *Raging*) kwam bij de
> speler als het kale id in beeld.
> Exports: `CONDITIONS` (de lijst), `COND_INFO` (id → {label, desc}),
> `COND_LABEL` (een Proxy die terugvalt op het id zelf, zodat iets eigens
> leesbaar blijft) en `COND_MET_PLAATJE` — bewust een **eigen** set, want die
> 18 PNG's in `public/img/conditions/` dekken niet alle 36 condities en
> afleiden gaf een `<img>` naar een bestand dat er niet is.
> De **iconen** stonden op een andere as in `combat-canvas.js`, maar zijn op
> 17 sep 2026 alsnog naar `conditions.js` verhuisd (`COND_ICON`, sprite +
> kleur). Reden: alleen het canvas kon erbij, dus het spelerstabblad hield een
> vierde lijstje van zestien met ronduit verkeerde keuzes — `lock` voor
> restrained én paralyzed, `minus` voor prone. Precies de versnippering die dit
> bestand moest opruimen. `combat-canvas.js` importeert hem nu.

> **De toegangsschakelaar per party geldt nu ook op de server.** De DM zet per
> groep in welke diensten open zijn (Diensten → Toegang per groep):
> `beschikbaar`, `zichtbaar` (je ziet hem, je kunt er niets) of `verborgen`. Dat
> werd **alleen in de client** afgedwongen — `switchSection` verbergt de sectie,
> maar de routes vroegen er niet naar. Een speler bij wie de herberg op
> verborgen stond kon dus gewoon `POST /herberg/bestel` doen: eten kopen, een
> zegen kopen, een eed zweren, geld lenen. Geen datalek, wél een gat: die
> schakelaar is precies de manier waarop de DM zegt "dit bestaat nog niet voor
> jullie", en een tabblad dat al openstond toen hij hem omzette bleef werken.
> `vereistDienst('<naam>')` zit nu als middleware op de **veertien**
> speler-schrijfroutes van de diensten. De DM komt er altijd langs — hij test,
> en hij handelt namens de tafel. Bewaakt door `tests/diensten-toegang.test.js`
> (zonder de poort vallen er twee om).

> **De arena-uitslag valt niet meer stil terug op een nederlaag.** Er stond
> `req.body?.uitkomst === 'overwinning' ? 'overwinning' : 'nederlaag'`, en die
> route is onomkeerbaar: de inschrijving verdwijnt, de speler krijgt een brief
> dat hij verloren heeft en zijn inzet is weg. Eén typefout of een client die
> een ander veld stuurt en de speler verliest een kamp die hij won — precies het
> impliciete destructieve pad dat we niet willen. Nu een 400 bij alles wat niet
> letterlijk `overwinning` of `nederlaag` is. Het DM-paneel stuurt allebei die
> waarden al expliciet (met een `confirm()` ervoor), dus er breekt niets.

> **De rente van de Tweespalt loopt per lange rust, niet op de kalender.**
> Taevin rekende 30% per dag, samengesteld, op échte dagen: de ene lening in
> Grisburgh (2.880 cl, aangegaan 26 april) stond in september op
> **4,5 × 10¹⁹ centeling**. Onbetaalbaar is het punt van een woekeraar, maar een
> getal dat niemand kan uitspreken is geen verhaallijn. Nu telt hij per nacht
> dat de party rust (`g.rustTellers.long`, zelfde bron als het verversen van een
> winkel) — de party bepaalt het tempo, niet de klok.
> Er zit ook een **plafond** op (`TS_MAX_FACTOR`, vijf keer de hoofdsom): zonder
> dat komt dezelfde fout terug, alleen langzamer — 1,3^50 is nog altijd een half
> miljoen keer de hoofdsom. Daarna stopt Taevin met tellen en komt hij het
> halen; dat is een scène, geen som. Eén plek rekent het uit: `_tsSchuld()`, dat
> ook `rusten` en `afgetopt` teruggeeft zodat de banner het kan navertellen.
> Een lening van vóór deze wijziging heeft geen `rustStand` en begint bij de
> hoofdsom — hoeveel nachten er sinds april voorbij zijn valt niet te
> achterhalen, en een verzonnen getal is erger dan opnieuw beginnen.
> **Nog open:** er is geen route om een lening áf te lossen. De enige uitweg is
> dat de DM het schuldbewijs uit de boedel haalt (dat wist de lening mee, zie
> `DELETE /player-items`). Hoort bij `docs/voorstel-op-de-pof.md`.
> De verweesde lening van 26 april (2.880 cl) is er op 22 sep 2026 uit gehaald
> met `scripts/wezen-opruimen.js grisburgh --schrijf`: de lener was een
> testpersonage waarvan het kaartje al weg was, dus hij viel nooit af te lossen
> en zag niemand hem. Die opruiming raakt **alleen** bakken op een personage-id
> (beurs, boedel, profiel, HP, lening) van een kaartje dat niet meer bestaat;
> de groepsvelden blijven met rust. Draai hem altijd eerst zonder `--schrijf`.

> **De snapshot had zijn eigen spelersfilter, en die liep jaren achter.**
> `/api/export` plakt zijn hele datamodel als JSON in het HTML-bestand
> (`const S = ${JSON.stringify(S)}`), dus alles wat de filter laat staan, staat
> letterlijk in een bestand dat je aan je spelers geeft — ook wat nergens op het
> scherm getekend wordt. `lib/snapshot.js` had daarvoor acht eigen regels die
> alleen het oude enkelvoudige `data.geheim` kenden. Gevolg in Grisburgh: **40
> van de 41** geheimregels gingen mee terwijl er één onthuld was, plus
> `geheimenAntagonist`, `persoonlijkheid` (de aantekeningen voor de DM) en de
> **619 stappen** van het regie-script in `meta.hoofdstukken` — precies het lek
> dat we in `GET /meta` dichtten, via de achterdeur.
>
> Nu gebruiken beide exports de échte filter: `routes/api.js` exporteert
> `filterEntityForPlayer` en `hoofdstukkenVoorSpeler`, en `snapshot.js` haalt ze
> op met een **lazy require** (`_apiFilters()`) — api.js laadt snapshot.js
> bovenin, dus een require bij het laden geeft een half geïnitialiseerde module
> terug. Wat de export er zelf nog bovenop doet is `_deceased`, want die staat
> bij de groep. Bewaakt door `tests/export-geheimen.test.js` (10 tests, met
> kanaries; op de oude code vallen er drie om).
>
> Het **campagneboek** lekte niets: dat rendert alleen HTML en heeft geen
> JSON-blok. Het gebruikte wel dezelfde verouderde filter, dus het is
> meeveranderd.

> **Het Logboek, doorgelopen (15 sep 2026).** Vier dingen rechtgezet:
>
> 1. **`GET /archief` stuurde `logEntries` ongefilterd naar iedereen.** Daar
>    staan de onthul-gebeurtenissen in — mét de náám van het document — en
>    straks de **missies**, die via `GET /missies` juist zorgvuldig per party op
>    factie, renown en status worden gefilterd. In Grisburgh las een speler er 58
>    regels, waarvan drie een document noemden dat zijn party niet kent. De
>    client leest het veld nergens; het gaat nu alleen nog naar de DM.
> 2. **Beelden gingen als origineel de deur uit.** De kaartjes in de tijdlijn en
>    de aktebanners gebruikten `api.fileUrl` in plaats van `api.thumbUrl`, en de
>    kaartjes hadden geen `loading="lazy"` — ook een dichtgeklapte akte haalde
>    dus alles op. Samen 62 MB om 34 postzegels te tekenen; nu 3 MB. Voor de
>    banner (een strook van ~1100 px) is 600 px te klein, dus `GET /thumb/:id`
>    kent één extra maat: `?w=1200`, gecachet als `<id>.w1200.webp`. Bewust een
>    whitelist van één waarde — een vrij getal schrijft de schijf vol met maten.
>    Client: `api.thumbUrlBreed(id)`.
> 3. **De beelddrager stond als verslag in de tijdlijn.** De akte-importer en de
>    uploadknop bewaren de beelden van een akte in een verborgen sessielog-entry
>    ("Scène-afbeeldingen"). Dat is een bergplaats, geen verslag, maar hij stond
>    er als leeg kaartje bij — en één ervan stond op zichtbaar, dus de spelers
>    keken ernaar. `_isBeelddrager()` houdt hem uit de tijdlijn en uit de
>    zoekresultaten; zijn beelden blijven in de strip bovenaan de akte. De
>    importer maakte er bovendien elke keer een nieuwe bij, met een eigen naam
>    ("Geïmporteerde scène-afbeeldingen"); hij hergebruikt nu dezelfde drager.
> 4. **Zoeken was diakriet-gevoelig.** `Ursun` gaf nul, `Ursûn` acht. De
>    kaartjes-tabs, de spreuken en het bestiarium gebruiken al
>    `window._normSearch`/`_searchTokens`; het logboek deed een kale `includes`.
>    Nu hetzelfde: diakriet weg, elk woord moet érgens matchen, en de **titel van
>    de akte** telt mee in de hooiberg. De vier plekken die de lijst opnieuw
>    tekenden hadden elk hun eigen kopie van dezelfde drie regels — één ervan
>    vergat de zoekterm, zodat een verslag zichtbaar maken je resultaat wegveegde.
>    Dat is nu `_logboekHerteken()`.
>
> **De dichtgeklapte akte is een balk geworden** (68 px in plaats van 110): met
> veertien aktes was je bijna twee schermen aan het scrollen voordat je bij het
> eerste verslag kwam; nu staan er negen op één scherm. De akte die je leest
> houdt zijn volle hoogte — daar is het beeld de kop van wat eronder staat. Twee
> dingen die daarbij hoorden: de **verduistering** liep van onder naar boven,
> prima onder een hoge banner maar in een lage balk staat de titel dan in het
> lichte deel (Op zee!, Een onverwachte toren waren onleesbaar) — dicht loopt hij
> van links naar rechts, een sluier achter de tekst met het beeld vrij rechts. En
> het **uitklapteken** was een goudkleurig driehoekje van 11 px dat wegviel op een
> lichte foto; nu een chevron in een donkere penning die een kwartslag draait.
> Alle regels staan onderaan `theme.css`, want `.logboek-chapter-banner--img`
> staat op regel 11239 en wint anders op volgorde.
>
> Daarnaast de emoji eruit: de chips in het sessievenster droegen 👤🏰🏛️⚔️📜 als
> sectiekopje en ✨/↩ per naam. Nu `icon()`, met een tooltip die zegt wat het
> merkteken betekent — dat stond nergens.

> **Een naam zonder kaartje krijgt óók in de dungeon een plus.** De aantekening
> van de DM in de kamerzijbalk (`room.dmNotes`) ging als platte tekst door
> `esc()`; hij gaat nu door `mdToHtml()` (`_notitieHtml` in
> `render-dungeon.js`) en een `[[naam]]` die nog geen kaartje heeft krijgt
> dezelfde plus als in een akte — `window._dngMaakKaartje` leent
> `akteSchrijven.maakPlaceholder()`. Eén weg naar een plaatshouder, twee plekken
> waar je hem nodig hebt.
>
> **De regie-balk zegt wat er nog ligt.** Bij het openen van een akte telt
> `_loadRegieBalk` namen zonder kaartje + lege kaartjes + beelden zonder bestand
> en zet dat als één knop in de kop (`.dm-rb-nakijken`, "31 na te kijken") die
> `window._akteNakijken(ch)` opent. Bewust een regel in de balk en geen venster
> dat opengaat: je ziet het op het moment dat je de akte opent, en je klikt
> erop wanneer jij dat wil. Let op dat `_akteNakijken` zijn tekst **vers**
> ophaalt (`api.akteRegie`): vanuit de balk is de module-`meta` van
> `render-archief.js` nog nooit gevuld, en dan telde het venster nul beelden
> terwijl de balk er zevenentwintig zag.

> **Voorbereiden en spelen zijn twee dingen.** In het schrijfscherm staan géén
> onthulknoppen (wel de potloden om een blok bij te stellen): daar kijk je. De
> échte knoppen — onthullen, beeld tonen, gevecht starten — zitten in de lade.
> `regieNaarHtml(md, { acties })` schakelt dat: `_acties` alleen in de lade,
> `_potloden` in allebei.
> **Onthullen kan terug**: na een klik verschijnt twaalf seconden een
> ongedaan-maken-knop (`onthulTerug`), en een getoond beeld (`beeldTerug`,
> `POST /sessieLog/:id/verberg`) of een onthulde kamer (`kamerTerug`) houdt zijn
> knop als "weer verbergen". Een gestart gevecht of een gerolde tabel niet: dat
> is dan gebeurd.
> **De lade heeft drie standen** (dicht/half/heel scherm) en de balk geeft zijn
> stappenstrook op zodra de lade openstaat — samen namen die ruim de helft van
> het scherm.
> **Een akte mét tekst toont de oude stappenlijst dichtgeklapt** ("79 stappen
> uit de oude import — tonen"): de stappen blijven bestaan (daar hangt
> onthulgeschiedenis aan), maar het is geen tweede lijst meer die hetzelfde zegt.
>
> **De tweede stand heet Spelen, niet Voorbeeld.** Daar zitten de knoppen: een
> `[[naam]]` die de party nog niet kent krijgt een oogje (en een half oogje voor
> vaag) áchter de naam in de zin; kent de party hem al, dan staat er niets —
> anders staan er in een hoofdstuk veertig vinkjes en zie je de twee die ertoe
> doen niet meer. Een beeld krijgt *Toon aan spelers* (via dezelfde verborgen
> `Scène-afbeeldingen`-sessielogentry als de regie-balk), een regieblok krijgt
> zijn eigen knop (`_blokActie`), en een compendiumlink wordt een chip met een
> statblok-knop als het wezen in `monsters.json` staat (`_vindOpNaam` probeert
> ook het enkelvoud: "twig blights" → *Twig Blight*).
> **Let op de volgorde in `_prozaHtml`:** `mdToHtml` escapet `<` en `>` in zijn
> invoer, dus HTML die je er vóóraf in zet komt er als zichtbare tekst weer uit.
> De externe links worden daarom ná `mdToHtml` omgezet — die laat
> `[label](url)` ongemoeid staan.
>
> **`_wikilinkNamen()` telt `![[…]]` niet meer mee**: een hoofdstuk staat vol
> ingesloten plaatjes, en die stonden als "naam zonder kaartje" in de lijst.
>
> **De verhaaltekst en het script gaan niet meer naar de speler.** `GET /meta`
> stuurde het hele meta-object naar iedereen met een sessie — inclusief
> `hoofdstukken[*].tekst`, `[*].script` en `[*].monsters`. Zolang er nergens
> tekst stond viel er niets te halen, maar de eerste akte die je erin plakt zou
> compleet met geheimen in de browser van je spelers staan. `GET /meta` knipt
> die drie velden er nu af voor wie geen DM is (`_hoofdstukkenVoorSpeler`); de
> kop (num/title/short) blijft, want daarop groepeert het logboek. De DM haalt
> één akte op met `GET /meta/akte/:key/regie`. Bewaakt door
> `tests/akte-regie.test.js`.

> **De lade: de tekst ís de regie tijdens het spelen.** De knop *Verhaal* in de
> regie-balk opent geen zijpaneel meer maar een **lade** die omhoog schuift uit
> de balk (`_ladeToggle` in `dm-panel.js`, `.regie-lade`): sectiestrook, zoeken
> in de akte, twee hoogtes, en de tekst met **dezelfde knoppen als in de
> speelstand van het schrijfscherm** — want het is dezelfde renderer
> (`regieNaarHtml(md, { acties: true })` uit `akte-schrijven.js`; `zetAkte()`
> vertelt die module welke akte er loopt). Bewust onderin en niet ernaast: een
> zijpaneel duwde de app in zijn smalle indeling, en je kijkt tijdens het spelen
> afwisselend naar de tekst en naar de kaartjes erboven.
> **Waar je gebleven was** staat per akte in `localStorage` (`akteLade:<key>`):
> volgende week open je de akte en sta je op dezelfde sectie.
> De lade meet de balk (`--rb-hoogte`) in plaats van een hoogte te gokken — die
> balk is nu eens één regel en dan weer twee.
> **Rust en Sheets staan in de zijbalk van het schrijfscherm**, onder de
> secties: ze horen niet bij één plek in de tekst. Een party gaat slapen
> wanneer het uitkomt, soms tussen twee aktes in.

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

> **Zichtbaarheid zit op het kaartje en geldt voor de actieve party.** Dat is de
> regel in de hele app, en een dungeon week ervan af: die had een venster met
> een tabel van álle party's, achter een knop tussen de tekengereedschappen. Nu
> staat er een oogje op het dungeonkaartje in de galerij dat drie standen
> doorloopt voor de **actieve** groep — verborgen → zichtbaar met fog-of-war →
> uitgespeeld (`_dngToegangStand` / `window._dngToegangCycle`, bovenop
> `partyAccess`/`partyCompleted`). De andere party's houden hun eigen stand.
>
> **Kaart bewerken is een echt formulier geworden.** Een hoofdkaart had alleen
> naam en beschrijving; er is een **Soort** bij (`_KAART_SOORTEN`, ook
> server-side bewaakt — Wereld, Continent, Streek, Stad, …) die op het kaartje
> in de galerij als badge staat in plaats van het generieke "Hoofdkaart", en een
> **focuspunt** (`thumbFocus`), want dat kaartje snijdt de afbeelding bij. Beide
> kaartsoorten gebruiken daarvoor de gedeelde kiezer `window._fpBlokHtml`.
> De uitleg onder *Verdieping* is weg en zit nu in de hulptekst
> (`hulp_kaart_wereld` / `hulp_kaart_dungeon`), zoals afgesproken.
>
> **De sluitknop hoort in de balk.** De zwarte ronde knop zweefde over het beeld
> (en lag over de werkbalk van de dungeon). Beide weergaven tekenen hem nu zelf
> in hun eigen balk, in perkamentstijl, wanneer `body.kaart-fs-active` staat.

> **De dungeonkaart hangt in dezelfde fullscreen-overlay, met dezelfde
> valkuilen.** `.dng-overlay` (elk dungeonvenster, inclusief *Nieuwe dungeon*)
> stond op z-index 500 onder die overlay van 1200: de knop leek kapot terwijl
> het venster onzichtbaar eronder opende. Ook de werkbalk liep onder de ronde
> sluitknop door. Beide opgelost met `body.kaart-fs-active`-regels — check dat
> bij elk nieuw venster dat vanaf een kaart opent.
>
> **Dubbelklikken zoomt, overal.** Ook hier (`_zoomTrapDng`), maar alleen met het
> selecteergereedschap: bij de polygoon sluit een dubbelklik de vorm die je
> tekent.
>
> **De naam van een onthulde kamer is het geheim, niet de vorm.** `GET /dungeons`
> stuurde een speler álle kamers mét naam; de mist verborg ze alleen in beeld.
> Wie in de netwerktab keek las "Schatkelder" voordat zijn personage er ooit
> geweest was. De **vorm** moet wel mee (daar tekent de client de mist mee), dus
> nu gaat de naam pas mee zodra de kamer voor díé party onthuld is — en de
> conditie-iconen ook. Zelfde soort lek als destijds bij een vaag document.
>
> **`_activeGroupId()` viel terug op de naam `'groep1'`.** Die groep bestaat in
> geen enkele campagne meer: een onthulling belandde dan bij een partij die
> niemand heeft, en de spelers zagen niets. Nu de eerste échte groep.
>
> **De kamerzijbalk, op één plek herzien.** De naam draagt de verdieping (twee
> lagen hebben vaak dezelfde kamernaam), onthullen is een **oogje** naast de
> titel in plaats van een groene balk over de volle breedte, en onder de naam
> staat de **aantekening van de DM** — niet de vorm van het vlak, die je zelf
> getekend hebt. *Bewerken* en *Verwijderen* staan naast elkaar. De
> symboolknoppen dragen hun eigen kleur, zodat de schedel niet wegvalt tussen
> drie andere lijntekeningen. Wegklikken op een leeg stuk kaart sluit de
> bewerkstand: selectie los, handvatten weg, zijbalk leeg.
>
> **Gevechten koppel je net als vondsten.** Sectie *Tegenstand* in de
> kamerzijbalk: een nieuw gevecht maken, een bestaand koppelen, starten (via
> `dmPanel.encStart`, die ook waarschuwt als er al een gevecht loopt) of
> loskoppelen. De koppeling staat op de **encounter** (`dungeonId`/`roomId` in
> `encounters.json`), niet in de dungeonkaart — zelfde reden als bij loot: de
> kaart gaat over vorm en mist, en hetzelfde gevecht moet ook los te starten
> zijn. De schedel op de kaart volgt die koppeling, zoals het muntje de vondst
> volgt.
>
> **Het afgeleide muntje is de knop.** Klikken op het muntje van een kamer met
> een gekoppelde vondst bouwt de verdeling en opent het lootvenster — anders zie
> je het icoon liggen en moet je de vondst alsnog in de zijbalk opzoeken. De
> schedel blijft bewust een markering: een gevecht start je niet met een klik op
> een icoontje van een halve centimeter.
>
> **Kamers zijn te verslepen en bij te stellen.** Met het selecteergereedschap
> verschuif je een kamer door hem te slepen; de geselecteerde kamer krijgt
> **handvatten** op elk opgeslagen punt (twee bij een rechthoek of ovaal, één per
> hoek bij een polygoon) waarmee je hem bijstelt. Alles werkt op dezelfde
> `points` in procenten, dus vorm en opslag blijven hetzelfde; opslaan gebeurt
> bij het loslaten. Slepen op een leeg stuk kaart pant nog steeds.
>
> **Wat je aanwijst, pak je.** Kamers overlappen elkaar vaak (elke kamer tekent
> zijn eigen buitenmuur); het slepen gebruikt het SVG-element waarop je drukt, en
> dat is de bovenste — precies wat je ziet liggen. De selectie was daarnaast een
> dun goudlijntje op een drukke plattegrond: nu een vollere lijn met een lichte
> vulling, zodat je ziet wélke kamer je beet hebt.
>
> **Het verbindingsgereedschap is eruit.** Een verbinding was een stippellijn
> tussen twee kamers die de speler te zien kreeg zodra één ervan onthuld was —
> een hint dat er verderop meer is. Mechanisch deed hij niets, en naast de kamers
> zelf voegde hij in de praktijk niets toe. Wat al getekend is blijft staan en
> blijft te verwijderen in de kamerzijbalk; alleen bijtekenen kan niet meer.
>
> **Een trap heet een doorgang.** In beeld dan: het kan net zo goed een lift, een
> luik of een teleportcirkel zijn. De sleutel in de data heet nog `trapNaar` —
> hernoemen kost een migratie en levert niets op.
>
> **Ronde kamers.** Naast rechthoek en polygoon is er een **ovaal**
> (`shape: 'ovaal'`). Hij bewaart precies hetzelfde als een rechthoek — twee
> punten, het omhullende vak — en tekent daar een `<ellipse>` uit. Zo hoefde er
> niets te veranderen aan de opslag, de mist-maskers of het slepen: alleen de
> vorm die eruit komt en de raakvlaktoets (`_pointInRoom` doet de
> ellipsvergelijking). Bewust een ovaal en geen strakke cirkel: dezelfde
> sleepbeweging, en een langwerpige zaal kan ook.
>
> **De werkbalk is alleen nog gereedschap.** De kaartkiezer, *+ Nieuw* en de
> prullenbak zijn eruit: aanmaken, verwijderen en kiezen doe je in de galerij,
> waar de kaartjes staan. Wat je nu bekijkt staat als naam in de kop
> (`.dng-kaart-naam`, met de verdieping erachter), en wisselen gaat met de
> verdiepingsstrook. Die loopt van **kelder naar zolder** (−1 · BG · 1), zoals je
> een gebouw leest; hij stond omgekeerd. De balk breekt niet meer af zodra de
> gereedschapshint verschijnt: één regel, en de hint krimpt mee met zijn tekst in
> de tooltip.
>
> **Party-toegang is geen gereedschap.** Die knop stond tussen rechthoek,
> polygoon en verbinding; wie een dungeon mag zien is een eigenschap van de
> kaart en staat nu in *Kaart bewerken* (galerij), naast naam, beschrijving en
> verdieping. Het oude venster is verwijderd, niet gedupliceerd.
>
> **Conditie-iconen kwamen uit twee bronnen.** `COND_TYPES` had naast `svgName`
> ook een emoji, en juist die werd op de kaart getekend (als `<text>`) terwijl de
> zijbalk de sprite gebruikte. Nu één bron: een genest `<svg>` met een `<use>`
> (`_condSpriteSvg`), met kleur per soort en een donkere gloed zodat een
> lijnicoon niet wegvalt in een drukke plattegrond.
>
> **Het muntje volgt de vondst.** Een kamer met een gekoppelde vondst
> (`loot.json`) krijgt het Buit-icoon vanzelf, **alleen op het scherm van de
> DM** en met een stippellijn. Anders leg je "hier ligt iets" twee keer vast —
> als vondst én als handmatig icoontje — en lopen die uit elkaar. Wat de speler
> ziet blijft een bewuste keuze van de DM.

> **Eén kaartje, meerdere plattegronden.** Bij het aanmaken geef je meteen alle
> verdiepingen op (*Verdieping erbij*), elk met een eigen nummer en afbeelding,
> plus een **omslagafbeelding** voor op het kaartje. De app maakt er één kaart per
> verdieping van met een gedeeld **`gebouwId`**; de galerij toont ze als één
> kaartje met knopjes (−1 · BG · 1) en het oogje zet de zichtbaarheid van het
> **hele gebouw** — anders bleef de kelder dicht omdat je de begane grond had
> onthuld. `_verdiepingenVan()` kijkt nu eerst naar dat `gebouwId` en daarna pas
> naar de trappen: trappen teken je later, maar bij elkaar horen ze meteen.
>
> **Verdiepingen in een dungeon.** (In beeld heet een trap een *doorgang*.) Een kaart kan een `verdieping` hebben
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

> **De focuspunt-kiezer staat op één plek.** `window._fpBlokHtml({src, value,
> previews, naam})` in `render-campagne.js` bouwt het blok; `_fpDown/_fpMove/
> _fpTouch/_fpApply/_fpTeken` bedienen het en `_fpZetBron(fileId)` verzet de
> bron. Gebruikt door de kaartjes-editor (previews *Kaartje* + *Portret*), de
> **aktebanner** (`render-archief.js`, preview *Banner*) en het **spreukdetail**
> (`render-spreuken.js`, in een uitklapper; bewaart meteen via de hook
> `window._fpOnChange`). Er waren drie eigen versies, en twee ervan toonden de
> afbeelding **cover** terwijl `_fpApply` contain-wiskunde doet — je klik landde
> daar dus ergens anders dan waar je wees. De kiezer toont altijd de héle
> afbeelding; de previews laten de echte uitsnede zien.
> Let op: de id's binnenin (`fp-wrap`, `fp-input`…) zijn vast en er kan meer dan
> één kiezer in de DOM staan (een spreukvenster bovenop een editor). Daarom zoekt
> `_fpBlok()` het laatste **zichtbare** `.fp-blok` en worden de velden dáárbinnen
> gezocht — vandaar ook dat `.fp-blok` een echte box moet houden
> (`display:contents` zou `offsetParent` op null zetten).

> **Standaard-statblokken (SRD 5.2) worden meegeleverd.** `bronnen/srd-monsters.json`
> (331 wezens, 466 kB) komt uit `node scripts/srd-2024/srd-monsters.js --schrijf`
> — Open5e, document `srd-2024`. Die tekst staat onder CC BY 4.0 en gaat dus bij
> **elke** campagne compleet de deur uit; `bronVoor()` kent er geen kale variant
> van, want dat onderscheid bestaat alleen voor bestanden met PHB-tekst.
> Vervangt de oude live-import bij `dnd5eapi.co`: dat was een externe host in het
> pad van een DM midden in een sessie, én de editie van 2014.
>
> **Waar je ze gebruikt:** de regel *Standaard statblok* boven het statblok in de
> personage-editor én boven elke tier (`window._presetRijHtml(tier)` /
> `_presetVullen` in `render-campagne.js`; `_PRESET_VELD` is de enige plek waar
> de sleutels van de bron en die van ons blad elkaar raken), en de uitklapper in
> de monster-editor (`_srdSearch`/`_srdImport` in `dm-panel.js`, nu lokaal en dus
> per toetsaanslag). 26 generieke NPC's (`npc: true`) staan vooraan — een
> herbergier die zich verweert is een *Guard*, geen Aboleth.
>
> **Drie dingen zet het script recht** (systematisch fout bij Open5e, zie de
> commentaren daar): `armor_detail` staat op "natural armor" bij 330 van de 331,
> `speed_all` vult de afgeleide kruip-/klim-/zwemsnelheden in die in 2024 voor
> iedereen gelden, en `size` is "Small" bij álle humanoids. Dat laatste klopt
> niet — de SRD schrijft daar "Small or Medium" — maar zó zetten we het er ook
> niet in: een preset vult het blad van één personage, en op dat blad is de
> keuze gemaakt (deze wachtpost is een mens, geen gnoom). Een NPC-preset krijgt
> dus **Medium**; "Small or Medium" hoort bij een sjabloon, niet bij een
> exemplaar, en staat daarom ook niet in `_SB_SIZES`.

> **Bij een standaard-statblok hoort een roddel.** `bronnen/srd-monsters.json`
> draagt per wezen een `roddel` — het gerucht dat de Magizoöloog op *deels*
> onthult — voor 200 van de 331. Gegenereerd met
> `node scripts/srd-2024/srd-roddels.js --schrijf`, **afgeleid uit het statblok**
> en nooit verzonnen: elke regel hangt aan een trait met een vaste naam, een
> immunity of een zintuig, en vuurt er niets, dan komt er geen roddel (131
> wezens, bijna allemaal gewone dieren en humanoids zonder traits — een kat
> heeft niets te verbergen). Het kwaliteitsfilter is *alleen wat je niet ziet*:
> "hij vliegt" is geen gerucht, "breng hem in de zon en hij mist" wel. Vandaar
> ook dat gif uit de lijst schadesoorten is gelaten — dat zou op 120 undead en
> constructs komen te staan, en wat overal geldt is geen nieuws. Per wezen gaan
> de twee best scorende regels mee, in de volgorde van `REGELS` in dat script.
> `_srdImport` vult het veld alleen als het leeg is, dus wat de DM zelf schreef
> blijft staan. Bewaakt door `tests/bronnen.test.js` (samengestelde zinnen heel,
> en er wordt niets verzonnen voor wie niets te verbergen heeft).

> **Meerdere statblokken op één kaartje (tiers).** Dezelfde man is niet elke akte
> dezelfde tegenstander. `statblockTiers` op een personage-kaartje bewaart de
> extra versies; `stats` blijft de **basis** en ligt onder elke tier, dus een tier
> zegt alleen wát er anders is. Twee smaken, één datamodel:
> een **dier** schaalt op het level van het baasje (`minLevel`, `_activeTier()`),
> een **NPC** heeft gedaantes waarvan de DM **per party** kiest welke geldt —
> `groups[gid].tierStand[entityId]`, endpoint `PUT /entities/:type/:id/tier`
> (`{gid, tierId}`; `'basis'` zet hem terug). Server-helpers: `_tierRegels()`
> (geeft elke tier een id, terugval `t0`, `t1`… zoals bij de geheimregels),
> `_tierStand(g, entity)` en `_tierToegepast(entity, tier)`.
> **Wat de speler ziet: niets.** `filterEntityForPlayer` gooit `stats` er al af
> (een statblok gaat nooit naar een speler; wat hij van een wezen weet loopt via
> het bestiarium, dat per kennisniveau afknipt) en sinds 9 sep ook
> `statblockTiers` — dat verklapt de gedaantes die hij nog niet ontmoet heeft.
> Let op de volgorde: een eerste versie zette de tier van de eigen party terug
> ín `stats`, ná die delete, en dáármee lekte juist elk kaartje mét tiers zijn
> hele statblok. `tests/filter.test.js` bewaakt het nu. **In een gevecht:** `_syncMonsterVanKaartje()`
> spiegelt het kaartje zoals de **actieve** party het kent (een gevecht gaat over
> één groep, en de combatant bevriest zijn cijfers bij het opstellen), en de
> tier-route hersynchroniseert. De keuzestrook staat boven het statblok in het
> detailvenster (`.tier-strook`, DM-only, en `geenprint` — in een afdruk valt er
> niets te kiezen; de gekozen gedaante komt daar in de **titel** te staan, zodat
> twee uitdraaien van dezelfde man uit elkaar te houden zijn); de editor toont dezelfde tier-velden
> als bij een dier, maar zonder "vanaf level" (`_tierVoorDier` in
> `render-campagne.js`).
>
> **HP uitrollen of het gemiddelde nemen — per monsterregel.** Het hp-veld van
> een statblok schrijft allebei op: `"65 (10d8+20)"`. Het getal vooraan is het
> gemiddelde en blijft de standaard; `row.hpRoll` op een encounterregel zegt dat
> er gerold moet worden. Dat gebeurt **server-side bij het opstellen**
> (`_hpUitrollen` in `POST /encounters/:id/start`) en **per exemplaar**: vier
> goblins krijgen vier totalen. Dat kan niet in de editor, want een regel bewaart
> één getal. Wat er gerold is komt in de gevechtslog te staan.
> De keuze staat naast het Max HP-veld waar hij over gaat, met één balk erboven
> (*Gemiddelde / Uitrollen*) die alle regels ineens omzet. Bewust **geen**
> campagne-instelling (te bot, en je vergeet dat hij aanstaat) en **geen** vraag
> bij het starten (elke keer een klik voor iets dat je per encounter één keer
> beslist). Een monster zónder worp in zijn statblok krijgt de knop niet — 13 van
> de 57 in Grisburgh hebben alleen een kaal getal, en een knop die niets kan doen
> is erger dan geen knop.

> **Bij het bouwen van een encounter** staat onder een monsterregel die van een
> kaartje komt de regel *"Deze party kent hem als"* met een keuzelijst
> (`_encTierRegel` / `encTierChange` in `dm-panel.js`); `GET /monsters` levert
> daarvoor `_tiers` en `_tierActief` mee. Omzetten verzet de **party**-stand —
> niet iets in de encounter zelf, want dan zou het gevecht iets anders zeggen dan
> het kaartje dat de spelers zien. De Max HP van de regel loopt mee.

> **De 19 losse NPC-statblokken zijn samengevoegd** met hun kaartje
> (`scripts/npc-statblok-naar-kaartje.js`, 8 sep 2026): 11 hadden een kaartje en
> kregen `entityId` + de ontbrekende velden uit de bibliotheek; het monster-id
> bleef staan want 11 encounters wijzen ernaar. Bewust **geen** automatische
> tiers — een tier maak je zelf. De 38 gemelde verschillen (kaartje wint) staan
> in de kopie `.voor-npcstatblok.<datum>.json` naast de datafiles.

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

> **Het spreukenboek: de plaat ligt ín het blad.** De illustratie stond op
> `inset: 0` met `object-fit: cover` en vulde de volle halve pagina — dat leest
> als een poster, niet als een blad uit een handschrift. Nu ligt hij ingelijst
> met perkament eromheen (marge 26 opzij, 42 boven, 58 onder: ruimte voor het
> incantatievers bovenaan en voor school, niveau, lakzegel en Save DC onderaan).
> **Valkuil:** een `<img>` is een *vervangen* element — vier inset-waarden rekken
> hem niet op, want met `width:auto` valt hij terug op zijn eigen afmeting en
> wordt `right` genegeerd. Vandaar `calc(100% - 52px)` in plaats van `inset`.
> Beide bladzijden kregen daarnaast de **kruisarcering** van `body::before`:
> ze bestonden alleen uit gradiënten, en die zijn volmaakt glad.
> Wat er al wél was en dus níét hoefde: de vouwschaduw bij de rug staat als
> `.sb-page-left::before` (30 px, tot `rgba(0,0,0,0.95)`) — niet als box-shadow,
> dus een zoektocht op `box-shadow` mist hem.

> **Glossary/hover-uitleg:** geen los `glossary.js`-bestand (die revert staat hieronder). De
> hover-uitleg van D&D-termen leeft **inline in app.js**: `_SB_GLOSSARY` (termen + tips),
> `_sbApplyGlossary_DOM()` (wrapt termen in `.sb-gloss`-spans) en een globale tooltip-handler
> (`_initGlobalGlossary`, geactiveerd in `init()`). Publieke API: `window.glossary.applyDom(el)`.
> Gebruikt door het spreukenboek, het progressie-detailmodal, de
> voorwerp-beschrijving in het detailvenster én het voorwerpblad in de Boedel
> (die laatste twee via `window.glossary.annotate(html)`; die geeft een string
> terug in plaats van een DOM-node te bewerken).
>
> **De lijst dekt ook de voorwerptaal.** Het mechaniek werkte al voor items, maar
> juist hún woorden ontbraken: de fysieke en elementaire schadesoorten
> (bludgeoning, piercing, slashing, fire, cold, lightning, acid, poison),
> resistance/vulnerability/immunity, attunement, charges, cursed en critical hit.
> Zonder die regels bleef een tekst als "resistance tegen bludgeoning damage"
> onaangeraakt terwijl "Bonus Action" ernaast wél een tip kreeg. Een term wordt
> **één keer per blok** uitgelegd (`seen` in `_sbGlossWalk`), en bij gelijke
> startpositie wint de langste match — vandaar dat "Requires Attunement" naast
> "Attunement" kan staan.

> **Muziek uit Spotify (akteregie).** Grisburgh speelt zelf niets af; het drukt
> op play bij Spotify. `lib/spotify.js` doet de OAuth (PKCE — er is géén client
> secret) en de player-endpoints; het regie-script kent een **9e staptype
> `muziek`** (`{type:'muziek', uri, name, herhaal}`), toe te voegen met de
> muzieknoot in de picker en tijdens het spelen te starten met de muzieknoot in
> de regie-balk (`_regieBalkMuziek`).
>
> **Waar het geluid uitkomt kiest de DM**: `meta.spotify.doel` is `'dm'` (het
> apparaat waarop hij Spotify al heeft draaien — de server stuurt een play zonder
> device-id, of naar een vast gekozen apparaat) of `'tafel'` (het tafelscherm
> laadt de Web Playback SDK, meldt zich als apparaat en geeft zijn device-id door
> via `POST /spotify/tafel-apparaat`). Eén keer of in herhaling staat per stap
> (`herhaal` → `PUT /me/player/repeat`, `track` bij een nummer en `context` bij
> een album of afspeellijst).
>
> **De client-id vult de DM zelf in** (Instellingen → Muziek), want die hoort bij
> zíjn Spotify-app; hij is niet geheim. De **redirect-URI moet letterlijk het
> campagne-adres zijn** (`https://grisburgh.nl/grisburgh`) — dat adres staat in
> het instellingenblok klaar om te kopiëren. Een tweede campagne heeft dus een
> eigen redirect-URI in het Spotify-dashboard.
>
> **Premium is verplicht** (de player-endpoints geven 403 op een gratis account),
> en er speelt maar **één stream per account**: luistert de DM elders mee, dan
> kapen ze elkaar. Een app in development mode mag 25 gebruikers hebben — voor
> één DM ruim genoeg, dus geen quota-aanvraag nodig.
>
> **De tokens staan buiten `data/campaigns/`** (in `data/spotify/<campagne>.json`,
> 0600). De nachtelijke backup kopieert álle JSON uit de campagnemap, en een
> refresh-token is een sleutel tot iemands account — die hoort niet dertig dagen
> aan snapshots te staan.
>
> **Een privésessie kan de app niet aanzetten.** Spotify heeft daar geen
> endpoint voor — het is een schakelaar in hun eigen app en er bestaat geen
> scope voor. Wat een speelavond met je aanbevelingen doet, doet hij dus gewoon.
> In de instellingen staat daarom het advies dat wél werkt: zet de sfeermuziek
> in een **eigen afspeellijst** en vink daar in Spotify *Uitsluiten van je
> smaakprofiel* aan — dat vergeet je niet elke sessie opnieuw, een privésessie
> wel.
>
> De bestaande geluidenbibliotheek blijft wat hij is: korte klanken en sfeerloops
> horen lokaal, want die moeten precies op het juiste moment klinken en werken
> zonder account of internet. Spotify is voor de lange muziek eronder.

> **Vegen en pijltjes: één hulpje.** `window._veegNavigatie(el, {vorige,
> volgende, toetsen})` in `app.js` bindt een horizontale veeg (≥ 60 px opzij,
> < 45 px op of neer) en standaard ← / → op `document`. Het negeert gebaren die
> beginnen in iets dat zélf horizontaal schuift (een carrousel, een kaart die je
> pant) of in een invoerveld — daar hoort de beweging al ergens bij. Wie het
> gebruikt, doet dat **lui**: dit bestand wordt geïmporteerd door `app.js`, dus
> tijdens het laden bestaat de helper nog niet (`_detailVegen()` hangt hem aan bij
> het eerste kaartje dat opengaat).
>
> Waar het aan hangt: het **gedeelde venster** (`openModal` bindt het één keer;
> wie het venster vult zegt via `window._bladerBron` wat "de volgende" is —
> zonder die haak is het een kaartje uit het archief, mét is het bijvoorbeeld het
> **bestiarium**), het **spreukdetail**, het **bladeren door een brief**, de
> **subtabbladen van de speler**, de **beeldcarrousel** in het logboek, de
> **lightbox** (behalve ingezoomd: dan is slepen pannen), het **missiebord** op
> een smal scherm en het **hulpvenster** met meerdere stappen (dat zichzelf per
> stap opnieuw tekent, dus de binding gaat er telkens af — anders stapelen de
> keydown-luisteraars zich op en springt één pijltje drie stappen).
>
> **Het missiebord op een telefoon** toont één kolom tegelijk met de statusnamen
> als strip erboven (`.prikbord[data-kolom]`, media-query op 760 px); op een breed
> scherm staat de strip uit en verandert er niets.
>
> **Wat "de volgende" betekent:** de volgende in de lijst **zoals je hem nu
> gefilterd ziet**. Anders spring je naar iets wat nergens op het scherm ligt.
>
> **Bladeren en de terugknop sluiten elkaar uit.** Kom je via een `[[link]]` in
> een kaartje, dan staat er linksboven een terugknop naar het kaartje waar je
> vandaan komt — en die wijst net zo goed naar rechts in de rij. Twee betekenissen
> voor één pijl naar links is er één te veel, dus zolang `_modalHistory` gevuld is
> bladert er niets; na een terugsprong mag het weer. En opzij bladeren **bouwt
> zelf geen terugweg op** (`_openDetail(..., true)`): het is geen stap dieper,
> en anders wees de terugknop straks naar een kaartje dat je alleen passeerde.

---

## Spreuken

De bibliotheek is **alles wat er in deze wereld bestaat** — het meegeleverde
materiaal én wat de campagne zelf verzon — niet wat de speler kent. Zijn eigen
boek staat in het spelerstabblad. Ze heette hier "naslagwerk", maar sinds de DM
er zelf spreuken in zet is dat woord te smal geworden. Drie bronnen lopen samen
in `_load()` (`render-spreuken.js`), ontdubbeld op `index`:

1. `bronnen/spells-2024.json` (539 regels, waarvan 22 zonder school — dat zijn
   magische voorwerpen en die vallen weg), of `hp-spells.json` in een
   Wands & Wizards-campagne;
2. `bronnen/extra-spells.json` — meegeleverde aanvullingen (Silvery Barbs, …);
3. `GET /spreuken/eigen` — wat **deze campagne** zelf verzon.

> **Een eigen spreuk hoort in de campagne, niet in de broncode.** Homebrew ging
> via het met de hand bijwerken van `bronnen/extra-spells.json` op de server, en
> dat is gedeelde broncode: wat de ene campagne verzint kregen alle andere erbij.
> Nu staat hij in `spells.json` → `eigenSpreuken[]`, in **exact het formaat van
> de bron** (`index`, `name`, `level`, `school`, `classes[{name}]`,
> `casting_time`, `range`, `components[V/S/M]`, `material`, `duration`,
> `ritual`, `concentration`, `damage`, `desc[]`, `higher_level[]`, `source`).
> Daardoor hoeven kaartje, detailvenster, spreukenboek en zoeken er niets van te
> weten. Alleen de naam is verplicht; wat leeg blijft laat `_spreukUitBody()`
> weg. Het id is `eigen-<slug>`, met een teller bij een dubbele naam.
> Routes: `GET /spreuken/eigen` (elke ingelogde), `POST`/`PUT`/`DELETE`
> (DM-only). Een eigen spreuk krijgt een tag op zijn kaartje en heeft
> geen overschrijf-tekstvak — die is er voor bróntekst.
>
> **Herkomst staat erbij, want niet alles mag mee.** `herkomst` is
> `zelfbedacht`, `aangepast` of `overgenomen` (whitelist `_SPREUK_HERKOMST` in
> `routes/api.js`; leeg mag ook). De tag op het kaartje toont die keuze — *Eigen*
> zolang er niets gekozen is, anders *Zelf verzonnen* / *Aangepast* /
> *Overgenomen*, die laatste in rood (`.spreuk-tag--overgenomen`). Het is
> bewust een **aantekening van de DM** en geen mechaniek: er wordt nergens iets
> op geblokkeerd. Maar zodra campagnes materiaal met elkaar gaan delen is dit de
> enige plek waar staat wat overgeschreven is uit andermans boek en dus niet mee
> de deur uit mag.
>
> **De klassenlijst komt van de server**, niet uit een lijstje in de frontend:
> `_spreukKlassen()` telt de eigen klassen van de campagne mee
> (`progression.json`) bovenop de negen PHB-casters, en valideert de invoer
> tegen diezelfde lijst. Homebrew-klassen kunnen dus gewoon spreuken hebben.
>
> **De school-zeef geldt alleen voor de bron.** `_load()` gooit bronregels
> zonder school weg (dat zijn de 22 magische voorwerpen die in `spells-2024.json`
> staan). Op een eigen spreuk mag die zeef niet: alleen de naam is verplicht, en
> een eigen spreuk zonder school verdween er stilzwijgend door uit de
> bibliotheek.
>
> **Let op de schoolnamen.** De tien spreuken in `extra-spells.json` stonden in
> het Nederlands (*Betovering*, *Bezwering*, *Evoking*), tegen de
> terminologie-afspraak in — en het schoolfilter kreeg er daardoor zes verzonnen
> scholen bij. Een school is een van de acht PHB-termen; de server bewaakt dat
> voor eigen spreuken (`_SPREUK_SCHOLEN`).

> **Een spreuk in je boek gaat langs de DM.** Een speler schreef vanuit de
> bibliotheek rechtstreeks in zijn eigen boek, terwijl een **voorwerp** juist wél
> langs de DM ging (`itemRequests`). Dat verschil was niet bedoeld. Nu komt er
> een verzoek in `groups[gid].spellRequests` (`POST /player-spells/:id` door een
> speler geeft `{ok:true, verzoek:true}`; de **DM** schrijft nog steeds direct
> door). Routes: `GET /spell-requests` (speler: zijn eigen openstaande; DM: die
> van álle party's), `POST /spells/request/:reqId/approve|reject`. De weg terug
> hergebruikt `_meldVerzoekAntwoord` met `type:'spreuk'`. Eén plek waar een
> spreuk echt in een boek belandt: `_spreukInBoek()`.
>
> **Automatisch afwijzen doen we niet — voorrekenen wel.** Toetsen op class en
> level klinkt logisch, maar de uitzonderingen zijn in 5e eerder regel dan
> uitzondering: multiclass, Magic Initiate, Fey Touched, Ritual Caster,
> uitgebreide subklasselijsten, een Wizard die uit een scroll overschrijft, en de
> eigen klassen van de campagne. Een weigering die vaak genoeg fout zit ga je
> wantrouwen, en dan is hij erger dan niets. Dus staat er naast het verzoek een
> regel als *"Wizard 8 · Level 1 · staat niet op die lijst — wel te verklaren via
> Magic Initiate, een feat of een scroll"* (`_spreukVoorrekenen()`, berekend op
> het moment van vragen, want dát was de stand waar de speler het over had).
> Zelfde regel als bij de loot-DC: een aantekening, geen mechaniek.
> De knop in de bibliotheek kent daardoor drie standen — vragen, aangevraagd
> (zandloper) en in je boek.
>
> **De toast woont nu op `window._showToast`.** Die zat opgesloten in
> `socket-client.js` terwijl andere modules dezelfde melding willen tonen. Eén
> implementatie is beter dan een tweede die er net iets anders uitziet.

> **Dezelfde regel voor class features, species traits en feats.** De SRD 5.2
> dekt daar zelfs **80%** van de seed (133 van 148 class features, 27 van 53
> species traits). `bronnen/srd-features.json` is de koppeling, gegenereerd met
> `node scripts/srd-2024/srd-featureteksten.js --schrijf` uit
> `5e-bits/5e-database` (Features, Traits, Feats). Sleutels zijn dezelfde als in
> `feature-descriptions.json` — `"Klasse|Naam"`, `"Subklasse|Naam"`,
> `"Soort|Naam"`, `"feat|Naam"` en de kale `"Naam"` — zodat `_srdDesc()` in
> `render-progressie.js` er zonder aanpassing mee overweg kan. `kaleProgressie()`
> zet de tekst terug waar de SRD hem heeft (`_srd`) en laat de rest leeg
> (`_geenTekst`), en `GET /bron/feature-descriptions` geeft aan een kale campagne
> dat SRD-deel in plaats van `{}`.
> **Backgrounds blijven kaal**: de SRD geeft daar alleen structuur
> (ability scores, proficiencies), geen beschrijvingen.

> **Waar wijst de app naartoe als een tekst er niet mag staan?** Eén sjabloon
> voor de hele app: `meta.bronLink` met `{naam}` en `{soort}`, in te stellen bij
> Instellingen → *Naslag elders*. Leeg = de standaard (de zoekpagina van
> D&D Beyond). Client-helper: `window.app.bronLink(naam, soort)`. Gebruikt door
> het spreukdetail en het progressie-detailvenster, allebei alleen waar de server
> `_geenTekst: true` meestuurde — nooit naast tekst die er wél staat. Op het
> spreukkaartje in het overzicht staat daarnaast een chip **Naslag**, zodat je de
> spreuk niet eerst hoeft te openen; die opent in een nieuw tabblad.
>
> **Bewust een zoek-URL en geen diepe link.** Het adres van een spreuk op
> D&D Beyond bevat een nummer dat nergens uit af te leiden is; een diepe link zou
> een koppeltabel vragen die geschraapt en eeuwig bijgehouden moet worden, en die
> stil 404't zodra zij hun adressen wijzigen. Een zoekpagina verlept niet.

> **Wie kent deze spreuk?** `GET /spells/:index/wie` (DM-only) loopt
> `dmState.playerSpells` langs en geeft per speler naam, party, prepared en of
> er nú op geconcentreerd wordt. Zelfde vraag en zelfde reden als
> `GET /items/:id/bezit` bij een voorwerp: de administratie staat per speler, dus
> zonder deze route moet de DM elk spelersboek los openen. Kijkt over álle
> party's heen — een spreuk hoort bij een personage, niet bij een groep.

> **Zoeken werkt hier net als op de kaartjes-tabbladen** (`_score` in
> `render-spreuken.js`): dezelfde drie bakken (naam / korte velden / tekst) en
> dezelfde scores, met de relevantie als volgorde zolang je zoekt. Filteren gaat
> op niveau, school, klasse (of "alleen mijn klasse" voor een speler), ritual en
> concentration. De filterbalk staat hier **bewust permanent open** in plaats van
> achter een trechterknop: zoeken en filteren is in een bibliotheek van 500+
> spreuken de normale handeling, niet de uitzondering. Eén uitzondering: de acht
> **scholen** zitten wél achter een trechterknop — dat is een brede rij die je
> minder vaak nodig hebt. Hij klapt vanzelf open zodra er een school gekozen is,
> zodat een actief filter nooit onzichtbaar is.

---

> **Vaardigheden: de bibliotheek naast de tijdlijn.** De Progressie-tab toont class
> features, traits en feats langs de tijdlijn van één personage — je ziet er dus
> pas iets als jouw level het ontsluit. De archieftab **Vaardigheden**
> (`render-vaardigheden.js`, sectie `vaardigheden`, module `vaardigheden`) zet dezelfde dingen
> naast elkaar als doorzoekbare bibliotheek: 148 class features, 73 subclass
> features, 53 species traits, 51 feats, 12 Epic Boons en 16 backgrounds in
> Grisburgh. Zelfde machinerie als de spreukenbibliotheek (drie zoekbakken in
> `_score`, permanent open filterbalk, `.entity-card`).
> **Eén plek weet waar een tekst vandaan komt:** `naslagBron()` in
> `render-progressie.js` levert `prog`, `backgrounds`, `feats`, `srdDesc`,
> `geenTekstBlok` en `md`. Dus geen tweede route en geen tweede regel over wie
> welke tekst mag zien — `GET /api/progression` knipt buiten de beheercampagne
> de `desc` er al af, en waar niets overblijft staat de verwijzing naar buiten
> (`window.app.bronLink`), op het kaartje én in het venster.
> Een **background** is één kaartje met zijn vijf onderdelen in het detail; als
> losse regels stond "Ability Scores" zestien keer in de lijst.
> De SRD-teksten dragen de afbreekstreepjes van de bron-pdf mee ("Ar- mor
> Class"); `_schoonTekst` in `render-progressie.js` haalt ze weg in `_md`, dus
> ook de tijdlijn profiteert — zelfde opschoning als `schoon()` in
> `lib/character-sheet.js`.
> **Een icoon per class en per species** (`KLASSE_ICOON` / `SPECIES_ICOON`): de
> soort bepaalt de kleur van het kaartje — dat is waar het filter op staat — en
> het icoon zegt wáárvan het is. Alles uit de bestaande sprite.
> De **twintig levels** zitten achter de trechter, net als de scholen bij de
> spreuken: je zoekt op naam of op soort, niet op "wat krijg ik op 14?".

> **Wat er niet in mag staan, mag er wel náár verwijzen.** `scripts/srd-2024/import-structuur.js`
> haalt de ontbrekende **subklassen en feats** binnen — alleen de **namen en de
> levels**, met een lege `desc`. Dezelfde afweging als bij de spreuken: de
> bibliotheek kent ze allemaal, de SRD-tekst gaat mee, de rest krijgt
> `_geenTekst` en een verwijzing (`window.app.bronLink`). Grisburgh had 15 van
> de 48 subklassen; een speler die op level 3 koos kon dus niet eens opzoeken
> wat de andere drie deden. Nu 50 (271 subclass-features, waarvan 198 zonder
> tekst). De featlijst staat sindsdien in `bronnen/feats-2024.json` (67 + 12
> Epic Boons) in plaats van als array in `render-progressie.js`; die arrays
> blijven als vangnet staan. Draaien: eerst de 5etools-bestanden naar `/tmp`
> (zie de kop van het script), dan `node scripts/srd-2024/import-structuur.js
> <campagne> --schrijf` — een campagne mét eigen `progression.json` krijgt de
> seed namelijk niet vanzelf. Het script vult alleen aan en zet een kopie
> ernaast; een subklasse die bij ons anders heet ("Wild Magic (Chaos)" tegenover
> "Wild Magic Sorcery") wordt herkend op het kenmerkende woord, anders stond hij
> er straks twee keer.
>
> **De verwijzing gaat naar een zoekmachine, niet naar D&D Beyond.** Hun
> zoekpagina weigert een bezoeker die er koud binnenkomt (Cloudflare), dus dan
> opent er niets. `BRON_LINK_STANDAARD` is nu `https://duckduckgo.com/?q={zoek}`,
> waarbij `{zoek}` de hele opdracht is inclusief context ("D&D 2024 feature
> Sentinel") — "Sentinel" alleen levert een bewakingscamera op. `{naam}` en
> `{soort}` blijven werken voor wie zijn eigen sjabloon invult
> (Instellingen → *Naslag elders*).
>
> **Een background noemt een feat, en die staat hier gewoon.** De onderdelen van
> een background worden als `[[Magic Initiate]]` weggeschreven en het
> detailvenster maakt daar een knop van (`_verwijzingen()` in
> `render-vaardigheden.js`) — zelfde truc als bij de spreuken, want de gewone
> wikilink-resolver kent alleen kaartjes uit het archief.

> **Een eigen vaardigheid hoort in de campagne, niet in de broncode** — zelfde
> regel als bij de spreuken. `POST /progression/feature` (DM) schrijft één regel
> weg en `POST /progression/feature/verwijderen` haalt hem eruit; bewust niet
> het hele blok via `PUT /progression`, want dan overschrijft de laatste
> opslagbeurt alles wat er tussendoor veranderde — en die tab staat open terwijl
> je speelt. De eerste bewerking legt de meegeleverde seed vast in
> `progression.json`; daarna is het campagnedata. Velden op de regel:
> `herkomst` (zelfde drie waarden als een spreuk, `_SPREUK_HERKOMST`) en `img`
> (een eigen id `feat-img-<random>`, via `POST /files/:id/copy-from/:srcId`, dus
> een hernoeming raakt de afbeelding niet).
> **Valkuil:** de featbibliotheek (51 general feats + 12 Epic Boons) zit **niet**
> in de progressie-seed maar in `render-progressie.js`. Schreef de DM zijn eerste
> eigen feat, dan stond er ineens `feats: { general: [dat ene], epic: [] }` en
> waren de rest verdwenen — ook uit de keuzelijst op de tijdlijn. Daarom stuurt
> de client bij een feat of boon `seedFeats` mee (de server legt die één keer
> vast) én telt een **lege** lijst in `naslagBron()` als "nog niets eigens".

> **Een missie verplaats je door te slepen.** De statussen zijn de kolommen van
> het bord, dus verschuiven is een `status`-wijziging en verder niets —
> `_prikbordSlepen()` in `render-archief.js` gebruikt dezelfde route als de
> →-knop. Bewust HTML5-drag: de browser regelt het sleepbeeld, het scrollen van
> een volle kolom en de cursor. Eén ding kan die niet — een `touchstart` wordt
> nooit een drag — en dáárom blijft de →-knop staan: op een telefoon staat er
> één kolom in beeld. **Aangevraagd** neemt niets aan: daar zet een spéler iets
> neer (`POST /quests/:id/aanvragen`); eruit slepen mag wel, dat is hem gunnen.

---

## Bestiarium

Het bestiarium is **wat de party ontdekt heeft**, niet de monsterbibliotheek:
`groups[gid].bestiarium[monsterId]` houdt per party een kennisniveau bij
(`naam` → `deels` → `volledig`) en `_bestiariumForTier()` in `routes/api.js`
knipt het statblock daarop af vóór het de deur uit gaat. De DM ziet alles, met
de niet-ontdekte kaartjes gedimd en een letterknop (O/N/D/V) om het niveau te
wisselen. Beheren (aanmaken, bewerken, verwijderen) gebeurt in de Meesterkamer →
Monsters; het tabblad linkt erheen.

> **Aanmaken en bewerken gebeurt in het tabblad zelf.** *Nieuw wezen* en het
> potlood op een kaartje openen de **editor uit de Meesterkamer als venster**
> (`dmPanel.monsterModal(id?)`): `_renderMonsters()` tekent in `_monsterEditorHost`
> zodra die gezet is, en `_monsterModalKlaar()` sluit het venster en ververst het
> bestiarium. Bewust één formulier op twee plekken — een tweede editor gaat uit de
> pas lopen. De knop *Monsterbibliotheek* blijft voor het overzicht (aktes,
> paginering, SRD-import). Onder het raster staat een **voetnoot** die uitlegt
> waarom personen (NPC's, antagonisten) hier niet staan, met een link naar
> Personages: hun statblok hoort bij hun kaartje.

> **Het lexicon leest mee in een statblok, en spreuknamen zijn klikbaar.**
> Beide gebeuren in `_sbMdBlock()` in `render-statblock.js`, de enige plek waar
> proza van een statblok door de renderer gaat — dus meteen in het bestiarium,
> op een personage-kaartje én in de Meesterkamer. Het lexicon draait via
> `window.glossary.annotate()` (string → string); statblokken stonden er vol mee
> (advantage, saving throw, difficult terrain, bludgeoning) en kregen als enige
> nooit uitleg.
> Spreuknamen gaan in twee stappen omdat de spreukenbibliotheek lui laadt:
> `_sbMarkeerSpells()` markeert bij het renderen alleen de **lijstjes**
> (`Cantrips: …`, `1st (3): …`, `2/day each: …`) als `.sb-spellijst`, en
> `window.spreuken.linkInDom(el)` maakt daarbinnen van elke naam die in de
> bibliotheek bestaat een `.sb-spell`-knop. Bewust alleen bínnen die lijstjes:
> buiten een spreuklijst is "Shield" een schild en "Light" gewoon licht. De
> drie aanroepers roepen `linkInDom` aan na het openen van hun venster.

> **`renderStatblock(m, { niveau, kop })`.** Het statblock tekent zijn eigen
> naamregel, want in het DM-paneel staat het zonder venstertitel. Het Bestiarium
> zet het in een modal die de naam al toont, en gaf dus twee keer
> "Wolf / Medium Beast Unaligned" onder elkaar — vandaar `kop: false`.

> **De sporen van de oude importer zijn opgeruimd.** `node scripts/monster-opschonen.js
> <campagne> --schrijf` haalt vier dingen weg die de live SRD-import (2014)
> achterliet en die nergens anders in de app voorkomen: `speed: "walk 30 ft."`
> (de sleutel voor de waarde geplakt), `ac: "12 (armor)"` (een invulwoord),
> `cr: "0.125"` in plaats van `1/8`, en een `hp`-veld met alleen de worp of
> helemaal leeg terwijl het gemiddelde in `maxHp` staat. Gedraaid 8 sep 2026:
> grisburgh 48 velden, Test 4; kopie ernaast als
> `monsters.voor-opschonen.<datum>.json`.
> Het script raakt **geen** namen, beschrijvingen, traits, actions of HP-totalen
> aan en gooit nooit iets weg. Twee wezens met hetzelfde statblok onder een
> andere naam (Maenfortmatroos = Wervelingpiraat) worden gemeld, niet
> samengevoegd — dat zijn twee facties, geen fout. En past `maxHp` niet bij de
> worp (Xerxes en Sarabi: 4 tegen gemiddeld 26), dan blijft het hp-veld met rust
> en komt er een melding: anders zet je het vermoedelijk foute getal juist vast.

> **Creature types en alignments zijn D&D-termen.** In `monsters.json` stonden
> zestien schrijfwijzen voor tien types ("Beest" naast "beast" en "Beast",
> "ongebonden" naast "unaligned"), waardoor filteren onmogelijk was én de
> terminologie-afspraak werd geschonden. `node scripts/monster-termen.js
> <campagne> --schrijf` trekt ze recht (kopie ernaast). Twee regels die het
> script bewust aanhoudt: alleen aanraken als er een **herkend** creature type
> in staat — anders is het tekst van de DM — en alles **na de eerste komma**
> blijft woordelijk staan ("Humanoid (half-orc), Circle of Spores Druid (4)").
> Namen worden nooit aangeraakt; dubbele namen (2× Wolf, 2× Goblin in Grisburgh)
> worden gemeld maar niet samengevoegd, want dat is een keuze van de DM.

---

## Voorwerpen

- **Types staan in groepen** (`ITEM_TYPE_GROEPEN` in `render-campagne.js`), zelfde
  vorm als bij locaties en organisaties: waarden blijven exact zoals ze
  opgeslagen zijn, alleen de indeling verandert. `ITEM_TYPE_MELDINGEN` zegt onder
  de keuzelijst wat een type extra oplevert (Weapon → schade, Armor → Base AC,
  Scroll → spellkiezer, Blessing → Tempel-velden) — anders is na het kiezen niet
  meer te zien dát dit een type met extra's was.
- **`_optiesHtml` verliest geen waarde meer.** Ook een platte `options`-lijst
  krijgt een extra regel "(oude waarde)" voor een opgeslagen waarde die niet meer
  in de lijst staat. Zonder dat stond zo'n veld op "—" en was de waarde na één
  keer opslaan stil verdwenen — precies wat er bij het schrappen van `dawn`
  gebeurd zou zijn.
- **`showWhen: { key, values }`** hangt een veld aan de waarde van een ánder veld
  op hetzelfde blad (keuzelijst óf vinkje); `showFor` kan alleen op `itemType`.
  Eén gedelegeerde `change`-luisteraar op `#m-body` houdt ze bij
  (`window._showWhenBijwerken`). Gebruikt door *Hoeveel komt er terug* (alleen bij
  `rechargeOn === 'longRestRoll'`) en *Attunement alleen door*.
- **Charges.** `maxCharges` is een getal (`type: 'getal'`), `rechargeOn` kent nog
  drie standen: `longRest` en `shortRest` zetten hem weer vol, `longRestRoll`
  rolt `rechargeRoll` en telt dat erbij tot het maximum. De vierde stand `dawn`
  is uit de keuzelijst gehaald — de server deed er precies hetzelfde mee als bij
  een lange rust en een dageraad-mechaniek bestaat niet. De terugval in
  `routes/api.js` blijft staan voor campagnes die de waarde nog hebben; Grisburgh
  is omgezet. `playerMaxAdjustable` geeft de speler ±-knopjes bij de bolletjes in
  zijn boedel (`groups[gid].itemMaxCharges[charId][itemId]`), voor als het
  maximum per exemplaar verschilt.
- **`gebruik` heet in beeld *Exemplaren*** — uniek (één speler), gedeeld
  (meerdere spelers, ieder één) of stapelbaar (ieder een aantal, met teller). De
  sleutel blijft `gebruik`; oude kaartjes met losse vinkjes `stapelbaar`/`gedeeld`
  tellen mee via `_gebruikVan()` (server) / `_getGebruik()` (client).
- **Wie het heeft staat per party.** `groups[gid].itemOwners` — dus de DM zag
  alleen de party waar hij toevallig naar keek. `GET /items/:id/bezit` (DM-only)
  loopt alle party's langs en geeft per groep de eigenaren met aantal en charges,
  plus de losse boedelregels (`playerItems`) die dezelfde naam dragen. Het
  tabblad **Bezit** in het detailvenster leeft daarop, en de geef-picker gebruikt
  het voor zijn tellers. `PATCH /items/:id/owner/:charId` zoekt de groep nu op bij
  het karakter (of `body.groupId`) in plaats van bij de actieve DM-groep; dat gaf
  een 404 zodra de speler in een andere party zat.
- **Waar het te koop is, is afgeleid.** Geen veld op het voorwerp: de voorraad
  van de winkel is de enige plek waar dat staat. `_betrokkenIndex()` in
  `routes/api.js` neemt `data.voorraad` van locaties en personages mee en levert
  het als `_hoortBij`-regel met rol *Te koop* en `tab: 'voorraad'`. Zelfde regel
  als bij de betrokkenen: één plek, twee kanten.
- **Het detailvenster heeft één kenmerkenstrook** (`.item-kenmerken`) in plaats
  van vier rijen losse pillen. Rariteit en type staan al in de ondertitel onder de
  naam (de rariteit daar in zijn kleur), dus die worden niet herhaald. De
  schadeknop is het enige aanklikbare in de strook en houdt daarom als enige zijn
  accent.
- **Geen knop *Verloren* meer bij een voorwerp.** Een kaartje dat "verloren" heet
  maar nog in de boedel staat leest als een misverstand; weg is weg. Alleen een
  kaartje dat de markering al draagt houdt de knop, anders viel hij niet terug te
  draaien.
- **Geen verzonnen categorie in de filterbalk.** De chip *Zegeningen & Gunsten*
  (Blessing + Boon samen, en die twee standaard uit de lijst gehouden) was een
  Grisburgh-indeling. Het zijn gewone PHB-termen en dus gewone chips.

> **Een voorwerp gebruiken om te genezen.** `POST /items/:id/gebruik` rolt de
> formule, telt de HP op (gemaximeerd op het maximum), schrijft één charge af en
> laat een eenmalig drankje verdwijnen. Alles server-side, net als bij de Hit
> Dice: een speler rekent zijn eigen HP niet uit. De knop in de boedel gooide
> alleen de formule in het dobbelpaneel — een knop die genezing belooft en niets
> doet.
> - De formule komt uit `data.healing`, met de oude vorm (`damage: "2d4+2
>   healing"`) als terugval; `_healingVan()` staat zowel op de server als in
>   `app.js` (`window._itemHealFormule`), en de twee pillen in de boedel komen
>   uit één functie (`window._itemWorpPillen`) — die stonden in tweevoud en de
>   ene kende `data.healing` niet, dus daar verscheen helemaal geen knop.
> - **Verdwijnt bij gebruik** (`data.verbruikt`, vinkje bij de werking *healing*)
>   haalt er één van de stapel af. Alleen als het voorwerp géén charges heeft: een
>   Staff of Healing raakt een charge kwijt, geen exemplaar. Een **Potion** krijgt
>   dat vinkje vanzelf bij het kiezen van het type — een drankje is na één slok op
>   en heeft geen charges; je hebt er simpelweg meerdere. Zelfde regel als bij de
>   werking: de suggestie blijft weg zodra de DM het vinkje zelf aanraakt.
> - **Eerst vragen.** De knop is klein en zit tussen de andere pillen, dus er komt
>   een bevestiging die zegt wat het kost: "Dat kost één charge; je hebt er nog 3
>   van de 5" bij een staf, "Je hebt er 3; daarna nog 2" bij een stapel drankjes.
> - Een speler moet het voorwerp ook echt bezitten (403), de DM mag het namens
>   iedereen doen.

---

## Verbindingen tussen kaartjes: één plek, twee kanten

Wie bij een locatie of organisatie hoort staat in **één** lijst:
`data.betrokkenen` op dát kaartje — een array van `{naam, rol, id, chef}`,
opgeslagen als JSON-string. Alles eromheen is afgeleid:

- **`Wie hoort hier bij?`** (locaties, organisaties) bewerkt die lijst direct.
- **`Waar hoort dit … bij?`** (personages, organisaties) is dezelfde verbinding
  van de andere kant. De kop noemt het soort kaartje ("Waar hoort dit personage
  bij?", "Waar hoort deze organisatie bij?") en staat voluit per type in
  `TYPE_META[...].hoortbij` — niet in elkaar gezet uit "Waar hoort " plus een
  woord, want het Nederlands wil *dit* personage maar *deze* locatie. Lezen gaat
  via `_hoortBijKop(tab)`. De **rol beschrijft altijd de persoon**, aan beide zijden:
  op de herberg staat `Eigenaar — Bram Kruik`, op Bram `Eigenaar — De Gouden
  Gans`. Vandaar deze vraagstelling en niet "Wat hoort hier bij?" — dat kaderde
  de rij als bezit, en dan zou er *Eigendom* moeten staan. Lezen gaat via `_betrokkenIndex()` in `routes/api.js`
  (omgekeerde index, gecachet op de mtime van `entities.json`) en komt mee als
  `_hoortBij`; schrijven gaat via `PUT /entities/:type/:id/hoortbij`, dat in de
  **doelkaartjes** schrijft. Bewust geen tweede lijst: twee lijsten die
  hetzelfde moeten zeggen lopen vroeg of laat uit elkaar.
- **`Verkoopt bij`** is `data.winkelLocatieId` op de verkoper en verschijnt in
  beide weergaven als een regel met rol *Verkoper*.
- Het **organogram** tekent zich uit dezelfde lijst; `chef` verwijst naar een
  **naam** uit die lijst (niet naar een id), zodat het ook leest als het kaartje
  erachter nog niet bestaat.

> **Een verbinding kan geheim zijn.** Een regel in `betrokkenen` mag
> `geheim: { id, gid }` dragen: een verwijzing naar geheimregel `gid` op
> kaartje `id` (de oude vorm `{ id, i }` wees naar regel *i* en wordt nog
> gelezen). Zolang die regel voor een party dicht staat bestaat de verbinding
> voor die party niet — niet op het kaartje, niet op de afgeleide andere kant, en
> er komt ook géén "onbekend"-regel voor in de plaats (anders verklap je dát er
> iemand is, en dat is nou juist de clou). Server-kant: `_geheimOpen()` in
> `routes/api.js`, toegepast in `filterEntityForPlayer` en op `_hoortBij`.
> Hangt er iemand onder een verborgen persoon, dan schuift die een plek omhoog
> in de chef-keten. Zelfde patroon als `geheimenAntagonist`: een geheimregel die
> een gevolg draagt. Zie `docs/voorstel-geheime-verbindingen.md`.

> **Een geheimregel heeft een eigen id.** `data.geheimen` is een lijst
> `{ id, tekst, antagonist? }`; de onthulstand per party
> (`groups[gid].secretReveals[id]` = `{ <regel-id>: true }`) en een geheime
> verbinding (`geheim.gid`) wijzen naar dát id. Verslepen, bijschaven of er een
> tussenuit halen raakt de administratie dus niet meer. Lezen gaat **altijd** via
> `_geheimRegels(data)` (server) of `_geheimRegelsUit(data)` (client) — schrijf
> nergens zelf een `JSON.parse(data.geheimen)`, want die helper vouwt vier oudere
> vormen in één: een lijst kale teksten, het enkelvoudige `data.geheim`, de
> losse vlaggenlijst `geheimenAntagonist` en het kaartjesbrede
> `geheimeAntagonist`. `_onthuldeIds(stand, regels)` doet hetzelfde voor de
> onthulstand (array booleans, id-object, of een kale `true`).
>
> Een kaartje dat nog niet om is krijgt `i0`, `i1`… als noodid — precies de
> positie waar zijn bestaande stand al naar wees. Zolang dat zo is blijft de
> stand een **array** (`_echteIds()` beslist dat in `PUT .../secret`) en schuift
> `_geheimKaart(oud, nieuw)` + `_geheimVerwijzingenBij()` de verwijzingen mee bij
> een bewerking, zoals vroeger. Omzetten doe je met
> `node scripts/geheim-ids.js <campagne> --schrijf`: dat geeft elke regel een id,
> zet de standen om naar id-vorm en `{id,i}` naar `{id,gid}`.

> **Eén kaartje, meerdere rollen.** Dezelfde persoon kan op dezelfde plek
> eigenaar én verkoper zijn: `PUT .../hoortbij` houdt een **lijst** rollen per
> doelkaartje bij, niet één. Alleen een exacte herhaling (zelfde kaartje,
> zelfde rol) valt weg — dat is dezelfde verbinding, twee keer ingetikt.

> **Een naam die meeverhuist.** Een regel bewaart een id én de naam zoals hij
> tóén was. Bij hernoemen loopt de naam mee (`betrokkenen[].naam`, `chef`,
> `eigenaar` en het gebiedslabel `wijk`) in de entity-PUT; bij verwijderen gaat
> alleen het id eraf en blijft de naam leesbaar staan.

> **Wat een speler ziet.** Een regel die naar een kaartje wijst dat zijn party
> nog niet kent verliest zijn **naam** en krijgt `onbekend: true` — de rol
> blijft staan. Een organisatie ontmantelen is het spel, dus de ledenlijst is
> niet gratis. Een naam die nooit aan een kaartje gekoppeld was blijft wél
> leesbaar: dat is tekst die de DM daar bewust neerzette. Omdat `chef` naar een
> naam wijst, krijgt een verborgen regel een vaste schuilnaam die ook in de
> chef-velden wordt teruggeschreven — anders valt de tak eronder van de boom.

> **Vaag is vaag, ook in het bestand.** Een vaag kaartje (`visibility: 'vague'`)
> en een vaag document (`docVisibility: 'blurred'`) werden alleen met opmaak
> verstopt: een donkere laag met `backdrop-filter: blur(3px)` over het portret,
> een `blur-sm` over de documentbeschrijving. Het origineel stond gewoon op
> `/api/thumb/<id>` en de beschrijving in de netwerktab — en de documentzoeker
> vond een document op een woord dat de speler niet mocht lezen. Nu beslist de
> server: `_waasVoor(req, id)` in `routes/api.js` kijkt of dit bestand bij een
> vaag kaartje of document van *deze party* hoort, `_waasBestand()` maakt met
> sharp een onomkeerbare waas (eerst naar 40px, dan blurren en weer opschalen —
> een CSS-blur is terug te draaien, dit niet) en cachet die als
> `thumbs/<id>.waas.webp`. Een pdf of geluidsfragment valt niet te vervagen en
> gaat er dus helemaal niet uit (403). `filterDocForPlayer` haalt `desc` eraf.
> De set bestanden per party wordt gecachet op de mtime van entities.json,
> archief.json en dm-state.json samen (`_waasStand()`), inclusief de geparste
> dm-state — anders parseert één kaartjespagina die 250 kB veertig keer.

> **Formulieren blijven schoon.** Uitleg hoort in de hulptekst (het boekje
> rechts in de tabbalk, sleutels `hulp_kijk_*` en `hulp_bewerk_*`), niet als
> grijze regel onder een veld.

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
    render-archief.js  Logboek, sessieverslagen, aktes + regie-script
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
| `entities.json` | personages, locaties, organisaties, voorwerpen, **documenten** |
| `dm-state.json` | groepen, zichtbaarheid, playerProfiles, playerItems, combat, tempel-config, … |
| `archief.json` | logEntries, sessieLog (documenten zijn kaartjes geworden) |
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
icon('sword')                         // → <svg><use href="/img/icons.svg?v=13#icon-sword"/></svg>
icon('heart', { cls: 'icon-lg' })     // met extra CSS-klasse
icon('shield', { title: 'Verdediging' }) // met tooltip
```

**Beschikbare iconen** (icons.svg, v=13):
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

**Toegevoegd voor locatietypes** (Lucide, ISC): `anchor` `door-open` `fish`
`graduation-cap` `hammer` `pickaxe` `store` `tent` `trees` `warehouse` `wheat`
**Toegevoegd voor de navigatie** (Lucide, ISC): `compass`
**Toegevoegd voor de klasse-iconen** (Lucide, ISC): `hand-fist` `bow-arrow`
**Toegevoegd voor de conditie-iconen** (Lucide, ISC, 15 sep 2026): `shell` (stunned — een
spiraal), `weight` (restrained), `biohazard` (poisoned), `chess-knight` (mounted), `brain`
(concentration), `arrow-down-to-line` (prone)
**Toegevoegd om een verkeerd signaal weg te halen** (Lucide, ISC): `sprout` (moeras — er
stond een vis), `tree-palm` (eiland — er stond een dennenboom), `anvil` (werkplaats — die
deelde de hamer met niets), `heart-pulse` (ziekenhuis), `feather` (aantekeningen: een
ganzenveer in plaats van een grafietpotlood), `crown` (factie-titel en de leiding van een
factie — `star` betekent in de app al *favoriet*), `award` (factie-boon), `backpack`
(spelerstab Boedel — dat deelde `package` met het archieftabblad Voorwerpen), `vault`
(de Loot-tab), `dices`, `quote` (het voorleesblok in een akte)

> **Eén icoon per soort plek.** `LOC_TYPE_ICOON` in `render-campagne.js` koppelt
> elk `data.locType` aan een sprite-naam; lezen doe je met
> `window._locIcoon(type)` (of `_locIcoonNaam`). De kaartpins toonden allemaal
> hetzelfde kasteeltje terwijl het type al op het kaartje stond — een haven, een
> woud en een gevangenis zien er nu uit als wat ze zijn. Onbekend of leeg type
> geeft `map-pin`, niet `castle`: een speld liegt niet. Een eigen `data.icon` op
> het kaartje wint nog, en een **vaag** kaartje toont een `?` — het type is ook
> informatie.

> **Zeven conditie-iconen vervangen (15 sep 2026).** Drie ervan botsten met een
> betekenis die de app elders al aan datzelfde icoon geeft, en dat is erger dan
> een matig icoon: `star` betekent hier **favoriet** (12 plekken), `link` een
> **koppeling** (9) en `refresh-cw` **opnieuw** (13). De andere vier gaven een
> verkeerd signaal. Wat het werd: stunned `star` → **shell** (een spiraal —
> `tornado` en `galaxy` waren kandidaat, maar op 16 px valt tornado uiteen in
> drie streepjes), restrained `link` → **weight** (`lasso` werd op tokenformaat
> een vlekje; `anchor` was al de haven), tides-of-chaos `refresh-cw` → **dices**
> (het is letterlijk een d20-mechaniek), poisoned `potion` → **biohazard** (een
> drankje is een vóórwerp, en `potion` is het icoon van itemtype Potion),
> mounted `rabbit` → **chess-knight**, concentration `sparkles` → **brain** (dat
> stond naast `sparkle` voor blessed — twee bijna gelijke tekeningen), en prone
> `arrow-down` → **arrow-down-to-line**.
> Beoordeeld op **twee maten**: een icoon dat op 34 px werkt kan op 16 px — de
> maat op een token — alsnog onleesbaar zijn. De hele Lucide-catalogus met
> trefwoorden staat op `https://unpkg.com/lucide-static@latest/tags.json`; dat
> is de snelste weg naar "wat hebben ze voor X".

> **Conditie-iconen** leven in `COND_ICON` (`combat-canvas.js`): per conditie een
> `[sprite-icoon, kleur]`. Drie kleurgroepen — gekleurd = PHB-condition, goud
> (`_CLASS_GOLD`) = klassefeature, staalblauw (`_SIT_STEEL`) = situationeel
> (Dodging, Cover, Hidden, Flying…). De picker in `dm-panel.js` groepeert met
> `_CC` en `_SIT`. `USE_SPRITE_COND_ICONS = false` zet de oude geschilderde
> PNG-set (`public/img/conditions/`) weer aan.

> **Eén gebaar voor "bekijk het kaartje".** Dat was drie dingen tegelijk: een
> los `↗`-teken (6×), het `open-book`-icoon (dat óók "spreukenboek" betekent) en
> een kale klikbare naam. Nu overal `icon('arrow-up-right')`. Zoek je er een:
> `grep "Bekijk kaartje"`.

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
- **De SRD 5.2 mág wél mee.** "Geen teksten naar buiten" was te streng: de
  **System Reference Document 5.2** staat onder **CC BY 4.0**, en die dekt
  **331 van onze 517 spreuken**. Een campagne zonder `bronTeksten` krijgt voor
  die spreuken dus de volledige SRD-tekst (`_srd: true`, waarop de app de
  verplichte bronvermelding toont) in plaats van een lege huls. Wat er níét in
  staat blijft leeg (`_geenTekst: true`) en de app zet er een verwijzing naar
  buiten bij — **linken mag, overnemen niet**. Het koppelbestand is
  `bronnen/srd-spells.json`, gegenereerd met
  `node scripts/srd-2024/srd-spelteksten.js --schrijf` (haalt document
  `srd-2024` bij Open5e op). Matchen gaat op naam, met één correctie: de SRD
  laat de ontwerpersnaam weg ("Tiny Hut" waar de PHB "Leomund's Tiny Hut"
  schrijft). De link is instelbaar met `meta.spreukLink` (sjabloon met
  `{naam}`); standaard de zoekpagina van D&D Beyond.
  Vijf SRD-spreuken die in onze lijst ontbraken zijn erbij gezet met
  `node scripts/srd-2024/srd-ontbrekende-spreuken.js --schrijf` (Confusion,
  Disintegrate, Flame Blade, Greater Restoration, Vitriolic Sphere). **Let op de
  hernoemde drie**: de SRD haalt de ontwerpersnaam weg, dus "Arcane Hand" is
  onze *Bigby's Hand*, "Arcane Sword" die van Mordenkainen en "Arcanist's Magic
  Aura" die van Nystul. Die staan er dus al — zonder `scripts/srd-2024/srd-namen.js`
  waren ze als nieuw toegevoegd (dubbel) én hadden ze hun SRD-tekst niet gekregen.
  Na het toevoegen van spreuken moet `srd-spelteksten.js --schrijf` opnieuw.
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

## Subtype, rollen en kant in gevecht

Een personage-kaartje beantwoordt drie verschillende vragen, en die zaten door
elkaar in één veld:

- **`subtype` — wat voor kaartje is dit?** Vier waarden: `NPC` (de standaard),
  `speler` (ontsluit party, boedel, progressie, sheet, login), `dier` (statblock
  dat meeschaalt met het baasje via `statblockTiers`, adoptie, meelopen — hier
  vallen ook summon, rijdier en familiar onder; tiers zijn optioneel) en `god`
  (de Tempel).
- **`data.tags` — welke rol speelt hij?** JSON-array, meerdere tegelijk:
  `verkoper` (zet de voorraad aan) en `antagonist` (kleur en badge). Zo kan een
  verkoper óók antagonist zijn.
- **`data.kant` — aan welke kant staat hij in een gevecht?** `bondgenoot`,
  `vijand` of `neutraal`. De kaart zegt wat iemand ís; `dmState.activeAllies`
  blijft zeggen wie er *nu* meeloopt.

> **Oude subtypes blijven meetellen.** `_heeftRol(e, 'verkoper')` (client:
> `window._heeftRol`, server: `_heeftRol` in `routes/api.js`) kijkt naar de tags
> én naar het oude subtype. Code die iets van een rol wil weten hoort die helper
> te gebruiken en niet zelf `subtype === 'verkoper'` te schrijven — anders valt
> een kaartje dat nog niet gemigreerd is buiten de boot.
> Opschonen kan met `scripts/migreer-rollen.js <campagne> --schrijf` (zet
> verkoper/antagonist om, geeft antagonisten `kant: vijand`, maakt een kopie).

De "geheime antagonist"-schakelaar zet nu de **rol** in plaats van het subtype
om te gooien bij het onthullen van een geheim.

---

## Geheimen en flavour zijn lijsten

Een NPC heeft zelden één geheim. `data.geheimen` en `data.flavours` zijn
JSON-arrays; de oude velden `geheim` en `flavour` blijven bestaan als **eerste
regel**, zodat alles wat al geschreven was blijft staan. Server-helpers:
`_tekstLijst(data, meervoud, enkelvoud)` en `_onthuld(waarde, aantal)` in
`routes/api.js`, client-kant `_tekstLijstUit()` in `render-campagne.js`.

- **Onthullen gaat per regel en per party.** `groups[gid].secretReveals[id]` is
  `{ <regel-id>: true }`; een oude array booleans of een kale `true` (= "de
  eerste regel is uit") wordt nog gelezen. `PUT /entities/:type/:id/secret`
  neemt bij voorkeur een `gid` mee, anders een `index` (zonder allebei: de
  eerste, dus oude aanroepen blijven werken).
- **Flavour houdt zijn stand op de entiteit** (`data.flavoursUitgesproken`),
  want dat is campagne-breed: de waard heeft die roddel verteld of niet. De
  herberg pikt bij een lange rust een régel die nog niet verteld is, niet een
  personage — iemand met drie roddels levert er dus drie op, over drie avonden.
- **In beeld:** de kaart toont "1/3" bij meerdere geheimen, het detailvenster
  geeft de DM een oogje per regel, en de speler ziet alleen wat onthuld is.

---

> **De Heeren van de Nacht zijn opgeheven** (21 sep 2026). Het was een halve
> dienst: negen routes, een DM-tab, een `#section-heeren` — en nergens een menu
> of een `switchSection` die erheen ging, dus onbereikbaar voor speler én DM.
> Wat hij deed doet een **factie** al, alleen generiek: rangen, titels,
> zichtbaarheid, uitnodigingen, quest givers. Zijn twee eigen mechanieken zijn
> bewust laten vallen — het klussenbord (een missie schrijf je zelf) en de
> boetes met de advocaat (dat hoort bij een stadsgezag, niet bij een gilde; het
> idee staat als *gerechtshof* in `docs/todo.md`). De factie *Heeren van de
> Nacht* stond al in `meta.facties`, en Grisburgh had nul boetes en geen
> `meta.heeren`, dus er ging geen data verloren.
> **Wat bleef:** de **briefstijl** `heeren` (de schaduwbrief) in de
> themalijst en in `theme.css` — brieven die er al liggen dragen dat thema en
> horen hun opmaak te houden. Die sleutel is dus opmaak, geen dienst.
> Achtergrond en afweging: `docs/voorstel-facties.md`.

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
- **Facties.** `FACTIES_DEFAULT` bevatte De Coöperatie, De Eendragt en De
  Roodzwaarden, met beschrijvingen die "rond Grisburgh" zeggen; die is leeg.
  Wat er generiek aan was — de **ladder** van zes treden op 0/1/3/10/25/50 —
  staat nu waar hij hoort: `_FACTIE_LADDER()` in `dm-panel.js` geeft een nieuwe
  factie meteen zes lege treden. Alleen trede 0 heeft een naam
  (*Buitenstaander*), want die beschrijft de mechaniek en niet de campagne.
- **Goden.** Er is géén ingebouwd pantheon meer. `TEMPEL_GODEN_DEFAULT` bevatte
  de twaalf goden van Grisburgh, compleet met eedteksten en `locatieEntityId`'s
  die alleen daar bestaan; elke campagne die de Tempel opende kreeg ze erbij.
  Een god ontstaat uit **Blessing-kaartjes met een `godNaam`** (zegen/eed/vloek),
  en `meta.tempel.goden` voegt daar volgorde, domein, symbool, prijs en
  portretten aan toe. Een campagne zonder goden toont een lege tempel, met voor
  de DM de uitleg hoe hij er een maakt. Grisburghs domeinen zijn met
  `scripts/tempel-goden-domein.js` naar zijn eigen `meta.json` verhuisd — ze
  waren daar al onzichtbaar geworden zodra die config gevuld raakte.
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

> **De kaart: knoppenbalk erover, perkamenten pins.** De zoombalk stond boven de
> kaart in de flow en at hoogte op, waardoor een grote kaart onderaan afbrak; hij
> zweeft nu erover (`.map-toolbar-float`, buiten `#map-scroll` — een absolute
> balk ín een scrollende bak scrollt mee weg). *Passend maken* kijkt sindsdien
> naar breedte **én** hoogte (`_fitZoom`), anders is "passend" een belofte die
> het knopje niet waarmaakt. Pins en de locatiekiezer stonden in bijna-zwart;
> dat las als een moderne app-marker op een licht vel en is nu perkament met
> inkt.
>
> **Dubbelklikken zoomt — overal.** In de kaartkiezer op een locatiekaartje zet
> één klik de speld en zoomt een dubbelklik in; op de wereldkaart maakte een
> dubbelklik juist een nieuwe speld. Twee schermen die dezelfde kaart tonen
> horen niet het tegenovergestelde te doen. De wereldkaart zoomt nu ook op
> dubbelklik (`_zoomTrap` = passend ×1/×2/×4/×8, daarna weer passend;
> `_zoomNaarPunt` houdt de aangewezen plek onder de muis), en neerzetten gaat
> via de **speldknop in de balk**: hij zet de kaart in speldmodus (kruisdraad,
> Esc stopt) en de eerstvolgende klik opent de kiezer daar. Op de grote kaart is
> klikken ook slepen, en een losse klik mag geen locatie aanmaken.
>
> **De kiezer opent bij je eigen speld.** Het doek in de editor toonde altijd de
> linkerbovenhoek; bij een stadskaart keek je dus naar een willekeurige wijk.
> `_pinNaarMidden()` scrollt ernaartoe, met een paar herkansingen omdat het
> Kaart-paneel nog verborgen (en dus 0 px breed) kan zijn als het tekent.
>
> **De speld is overal dezelfde speld.** Op de wereldkaart, in de kaartkiezer en
> in het Kaart-tabblad van het detailvenster: een perkamenten penning met het
> icoon van het locatietype. De laatste twee waren een rode stip.
>
> **Zichtbaarheid hangt aan de locatie, niet aan de speld** (zie `GET
> /map/pins`: `g.visibility[loc.id]`). De plaatser op de wereldkaart zette
> lokaal `visibility: 'hidden'` op een verse speld, die daardoor gedimd stond
> terwijl de spelers hem gewoon zagen.
>
> **De tweede knop heet Avontuur.** Hij dekt logboek, kaarten, missies en
> prikbord, maar heette zelf "Logboek" — net als zijn eerste menu-item, met
> hetzelfde boekicoon. Nu een kompas (`icon-compass`) met de groepsnaam; zodra je
> in een subtabblad zit toont hij dát (`LOGBOEK_LABELS`). Prikbord en Missies
> hadden ook al het kaart-icoon; dat zijn nu `pin` en `target`, en de groep
> *Hoofdkaarten* in de galerij kreeg `globe` omdat de sectiekop zelf `map` is.
>
> **Eén plek kan op meerdere kaarten staan** — Het Leemland ligt op de streekkaart
> én op de continentkaart. Welke toonde het kaartje dan? De eerste kaart in
> `map.json`, dus de volgorde waarin ze ooit zijn aangemaakt; daar valt niets aan
> af te lezen. Nu beslist de **soort**: hoe kleiner het gebied, hoe dichterbij je
> kijkt, dus die wint (`_KAART_SCHAAL` in `render-campagne.js`; een kaart zonder
> soort valt tussen de bekende in). De andere kaarten staan eronder als knop, dus
> je kunt er alsnog heen. Geldt ook voor het speldknopje op het kaartje zelf.
>
> **Verwijderen kon nergens meer.** De knop voor een hoofdkaart zat in de oude
> werkbalk boven de kaart en verdween met de galerij; nu staat hij in *Kaart
> bewerken*, met een `confirm()` die zegt wat er meegaat (spelden, respectievelijk
> kamers en onthullingen). De uitlegknop staat daar nu rechtsboven in plaats van
> onderaan tussen de knoppen.
>
> **Eén soort venster voor alle kaartformulieren.** *Nieuwe kaart* opende in het
> kleine zwevende bakje van de locatiekiezer (`.pin-placer-popup`, geen
> achtergrond), *Nieuwe dungeonkaart* in een eigen overlay en *Kaart bewerken* in
> het modal van de app — drie vensters voor hetzelfde soort formulier. Alle drie
> gebruiken nu `window.app.openModal()`. Het zwevende bakje blijft waar het bij
> hoort: de locatiekiezer, die je op een plek op de kaart aanwijst.
>
> **Aanmaken is een eigen formulier, geen halve.** Bij een hoofdkaart én een
> dungeon kon je alleen een naam en een afbeelding kwijt; de beschrijving stond
> pas in de bewerkmodus (en bij een dungeon gooide `POST /dungeons` hem zelfs
> stil weg). Beide vensters hebben nu naam, beschrijving en een afbeelding **uit
> de mediabibliotheek** — dat laatste scheelt een tweede weg voor hetzelfde ding:
> het dungeonvenster had als enige nog een kaal `<input type=file>`, met de
> systeemtypografie die daarbij hoort.
>
> **Een nieuwe kaart was pas na herladen te zien.** Allebei de vensters eindigden
> in een render die er niet meer is (`renderKaart()` zonder container /
> `#kaart-mode-content`). Nu `window._kaartVerversen()`.
>
> **Het kaartje van een nieuwe kaart bleef leeg.** De galerij zocht het beeld op
> `api.fileUrl(m.id)`, maar een kaart uit de mediabibliotheek staat onder
> `imageId` — alleen de meegeleverde kaarten en oude uploads staan onder het
> kaart-id. De kaart zelf opende wél (die gebruikt `_mapImgSrc`).
>
> **Een verborgen speld was een spook.** `.map-pin-hidden` dimde de hele speld
> (0.45) én het icoon kreeg er later nog eens 0.55 bovenop: samen 0.25, en je zag
> pas iets als je er met de muis overheen ging. Eén stand per soort, onderaan de
> stylesheet: een verborgen locatie is voor de DM gewoon leesbaar, met een
> gestippelde rand in plaats van halfdoorzichtig.
>
> **De +-knop maakt iets nieuws.** Hij riep `_openKaartFullscreen(type, null)`
> aan, en zonder id valt die terug op de **eerste bestaande kaart**: je drukte op
> + en keek naar Dreghaven. Nu opent hij het juiste venster
> (`window._kaartNieuw` → `nieuweKaart()` / `nieuweDungeon()`, allebei geëxporteerd).
> De kaart-toevoegen-popup eindigde bovendien in `renderKaart()` **zonder**
> container — precies de duplicaat-DOM hieronder. Nu `window._kaartVerversen()`.
>
> **Een `<select size=4>` begint zonder selectie.** In de locatiekiezer op de
> wereldkaart betekende dat: je ziet de lijst, je drukt op *Plaatsen*, en er
> gebeurt niets — zonder melding. De bovenste staat nu voorgeselecteerd (ook na
> filteren), dubbelklikken op een naam plaatst 'm, en is er tóch niets gekozen
> dan knippert het lijstje rood. Gold voor de DM-kiezer én de spelersvariant,
> die ook nog in de oude donkere opmaak stond.
>
> **Eén kaartweergave tegelijk.** `renderKaart()` zonder container valt terug op
> `#section-kaart`, en zo riep de socket-handler van `map:updated` hem aan —
> terwijl de kaart sinds de galerij in de **fullscreen-overlay** staat. Resultaat:
> twee weergaven in de DOM met dezelfde id's, en omdat `getElementById` de
> eerste pakt werkten zoomen, passend maken en het hertekenen van spelden daarna
> op de onzichtbare kopie. Er is nu één ingang: `window._kaartVerversen()` in
> `app.js` kiest zelf tussen de fullscreen-kaart en de galerij.

> **Eén klik heen is één klik terug.** Vanaf een kaartje ga je naar de kaart met
> *Toon op de hele kaart*, en die onthoudt de terugweg (`_kaartTerugNaar`).
> Andersom sloot een klik op een pin de hele kaart en zette je in de
> kaartenlijst. Het detailvenster komt nu **over** de fullscreen-kaart te liggen
> (`body.kaart-fs-active .modal-overlay`, z-index 1300) en sluiten brengt je
> terug op dezelfde plek. Zelfde valkuil trof de locatiekiezer (z-index 200
> onder een overlay van 1200): de DM dubbelklikte en zag niets gebeuren.

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

> **De tokengrootte verraadt de dreiging, en dat blijft zo.** Het canvas tekent
> het zwaarste monster het grootst (gesorteerd op maxHp, dan AC) — een bewuste
> keuze: je ziet in één oogopslag waar het gevaar zit. Het groepeerde daarvoor
> zélf op `maxHp|ac`, en die velden gaan niet meer naar een speler. De server
> rekent de rangorde nu uit en stuurt alleen de **plaats in de rij** mee
> (`_dreigingIdx`); `dreigSleutel()`/`dreigSort()` in `combat-canvas.js` vallen
> terug op de oude sleutel voor de DM en het tafelscherm. Zelfde beeld, geen
> getallen.
> Elke vraag van het soort "hoeveel heeft hij nog" of "ligt hij eruit" loopt in
> dat bestand via `_hpFrac(c)` / `_isUit(c)`: zonder die twee viel een vage
> deelnemer terug op 0/1 en tekende het canvas iedereen als dood.
> **Bestiarium-kennis telt mee aan beide kanten:** een monster dat de party op
> *deels* of *volledig* kent houdt zijn exacte HP. `GET /combat` deed dat al,
> de socket niet — dus verdween het bij de eerste update tot je verversde.

> **Een gevecht gaat niet ongefilterd de deur uit.** `combat:updated` stond op
> twaalf plekken als `io.to(campagne).emit(..., combat)` met het rauwe gevecht:
> de exacte hp, maxHp en AC van elk monster in de browser van elke speler,
> terwijl het scherm hem allang alleen een vaag label toonde. `_zendCombat(req,
> combat)` is nu het enige verzendpunt en `_combatVoorSpeler()` de enige filter:
> je eigen personage compleet, al het andere zonder cijfers (`hpStaat`, `hpCls`,
> `hpPct` — dezelfde zeven staten als `HP_LABELS` in dm-panel.js, dus dezelfde
> woorden). Ook `GET /combat` filtert; het `_statblock` daar blijft staan, want
> dát is wat de party in het bestiarium ontdekt heeft.
> `_zendCombat` loopt over de **sockets** en niet over `playerSockets`: die map
> houdt één socket per personage bij, dus een speler met twee tabbladen open
> zou in het oudste scherm niets meer zien.
>
> **De room komt uit het pad, niet uit de sessie.** `_campagneRoom(req)` gebruikt
> `storage.huidigeCampagne()` — wat de scoping-middleware heeft vastgesteld — en
> is de enige manier om een socket-room te bepalen. Er stond 229 keer
> `req.session?.campaignId || 'main'`, en dat is niet hetzelfde: een sessie
> zónder campaignId stuurt naar room `main` (de quarantaine voor sockets zónder
> sessie) terwijl de echte sockets in `grisburgh` zitten — dan komt er bij
> niemand iets aan. Alle 229 zijn omgezet; wat overblijft zijn vier plekken die
> vragen *wiens* campagne dit is (beheerrechten, Spotify-tokens, de naam bij
> `GET /campagne`) en dat is wél een sessievraag. `DEV_AUTO_DM` zet nu ook een
> campagne op de sessie, want juist daar liep het spaak.
> Bewaakt door `tests/campagne-isolatie.test.js`.

> **Het tafelscherm heeft een eigen room.** Wat alleen daar hoort — een
> verzegelde brief (`brief:display`), de voorleestekst (`display:tekst`), de
> kist die opengaat (`loot:display`), een level-up (`levelup:display`) en
> `display:idle` — ging naar de hele campagne-room, en alleen een `if
> (window._isDisplayMode)` in de client besliste of je het zag. Een speler met
> de netwerktab open las de brief dus voordat het lakzegel brak, en de
> voorleestekst voordat de DM hem voorlas — terwijl dat scherm er juist is
> zodat de spelers lúísteren in plaats van meelezen.
> Schermen melden zich nu met `display:register` (server.js; alleen wie is
> ingelogd) en komen in `display:<campagne>`; `_displayRoom(req)` in
> `routes/api.js` is de enige plek die die naam kent. **Bij elke connect**
> opnieuw melden, want een socket-room overleeft geen reconnect — een
> tafelscherm dat na een haperende wifi stil zijn room kwijt is, mist de rest
> van de avond alles. Aanzetten loopt via `_displayModeAan()` (één plek, twee
> ingangen: `?display=1` en de knop in Instellingen), uitzetten stuurt
> `display:unregister`.
> Let op bij een deploy: een tafelscherm dat al openstaat draait nog de oude JS
> en meldt zich dus niet — dat scherm moet één keer verversen.

Elke verbinding joint de room `campaignId` (of `'main'` als er geen sessie-campagne is).
`io.to(campaignId).emit(...)` stuurt naar alle clients in dezelfde campagne.

Spelers registreren hun `characterId` via `socket.emit('player:register', characterId)`.
De DM kan directe berichten sturen via `playerSockets.get(characterId)`.

> **Een socket kiest zijn kamer bij het verbinden — dus opnieuw verbinden na
> inloggen.** `server.js` leest `socket.request.session?.campaignId` op het
> moment van de handshake. Een bezoeker die de pagina opent is nog niet
> ingelogd, heeft dus geen campagne, en belandt in `main`. De landingspagina
> logt in **zonder de pagina te herladen** (`_landingFinishLogin`), dus die
> socket bleef in `main` terwijl de server naar `grisburgh` of `Test` stuurt:
> wie net was ingelogd kreeg de hele avond geen onthulling, geen gevechtsupdate
> en geen beursmelding — tot hij verversde. Elke inlogroute roept nu
> `window._socketHerverbind()` aan (socket-client.js): één nieuwe handshake
> leest de verse sessie. De `connect`-handler registreert het characterId
> daarna zelf opnieuw.

---

## Dienstschermen — de gedeelde romp

Elk dienstscherm (herberg, tempel, Gock, Ursula, magizoo, Tweespalt,
facties, markt) heeft dezelfde opbouw: `.herberg-scene` (schermvullend, met de
achtergrond) → `.herberg-content` (het paneel) → een rond portret
(`.herberg-portrait-round`) met een groet eronder. Die klassen heten `herberg-*`
omdat de herberg er het eerst was; één element draagt zelfs
`herberg-scene gock-scene facties-lijst-scene`. Hernoemen raakt honderden
CSS-regels en levert niets op wat je ziet — dus dat blijft zo, maar weet dat de
naam niets over de herberg zegt.

- **Eén paneelmaat: 460 px.** `.herberg-content` zet hem; wie afwijkt schrijft de
  reden erbij als `/* breder: zie .herberg-content */`. Er zijn er drie
  (Tweespalt 640, Marktoverzicht 1040, winkelscène 860) en die staan alle drie
  opgesomd bij `.herberg-content` zelf, zodat een vierde opvalt. Bewaakt door
  `tests/dienst-panelen.test.js`.
- **Een dienst noemt zichzelf.** Onder het portret de naam van de persoon
  (`.tempel-priester-naam` — priester, waard, factie-NPC) en daaronder zo nodig
  de naam van de zaak (`.dienst-huisnaam`). De herberg deed dat als enige niet:
  je zag een vrouw, een groet en knoppen, maar niet waar je was.
- **Begin een nieuwe dienst met `_dienstLaden(el)` en `_dienstFout(el, e)`**
  (in `app.js`, vlak boven `renderHerberg`). Die twee stonden **dertien keer**
  woordelijk in het bestand, inclusief een inline `style="opacity:.5"`.
- **`.herberg-content` is een kolom met `align-items: center`** — precies goed
  voor een portret met een groet, maar het laat een raster of een zoekveld
  krimpen tot de eigen inhoud. Wil je de volle breedte (zoals de Markt), zet dan
  `align-items: stretch` op je eigen contentklasse.
- **Niet elke dienst heeft een portret.** De Tempel gaat rechtstreeks naar een
  raster van goden, de Markt naar een zoekveld — dat is geen afwijking, daar
  staat gewoon niemand achter de toonbank.
- Facties wijkt wél echt af (lichte perkamentkaarten in plaats van het donkere
  paneel); dat is een overzicht en geen bezoek.

> **Het paneel staat op 0,76, en dat is met opzet stevig.** Het stond op 0,52
> met een blur van 3px, en dat werd per dienst aanmodderen: op een drukke of
> lichte achtergrond (de magizoöloog, een boekwinkel) moest je de tekstkleur
> bijstellen om het leesbaar te houden, op een donkere viel het vlak juist weg.
> Op 0,76 met blur 5px is het een échte ondergrond — je kunt er alles op zetten,
> tot een tabel met een lichte kop aan toe, zonder per scherm te sleutelen. De
> sfeer zit ín de achtergrond róndom het paneel, niet eronder.
> **De herberg viel daar buiten**: die zet zijn achtergrond op
> `body.herberg-actief` in plaats van als inline style op de scene, dus
> `.herberg-scene[style]` greep er nooit — de dienst waar de klasse naar
> vernoemd is, was de enige zónder paneel. Dat viel niet op omdat zijn
> achtergrond toevallig donker is. Er staat nu een tweede regel voor
> `body.herberg-actief .herberg-scene .herberg-content`.
> **Facties houdt bewust zijn eigen vorm** (lichte perkamentkaarten, geen donker
> paneel): dat is een overzicht en geen bezoek aan iemand.

> **`.herberg-zoek-input` had geen enkele CSS-regel** (15 sep 2026). Het veld
> stond op de witte browserstandaard terwijl de tekstkleur die het van elders
> meekreeg bijna wit was: contrast **1,19** — wat je typte was onzichtbaar,
> alleen de placeholder was te lezen omdat die zijn eigen kleur heeft. Het trof
> Gock en de magizoöloog. Het deelt nu de opmaak van `.herberg-search`, die er al
> was en klopt.

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

> **Het Spreukenboek verschijnt op data, niet op klasse.** Een Fighter zag een
> tab die alleen "Nog geen spreukenslots ingesteld" zei. Verbergen op **klasse**
> alleen zou te grof zijn: een Elf met Magic Initiate, een Eldritch Knight of
> iemand die via een feat of een scroll aan een spreuk komt hoort zijn boek
> gewoon te zien — en dat zijn in 5e geen uitzonderingen maar de regel (zelfde
> redenering als bij het níét automatisch afwijzen van een spreukverzoek).
> De tab staat er dus als **de klasse spreuken kán krijgen óf er ís al iets
> magisch**: een spreuk in het boek, een slot met `max > 0`, of een ingevulde
> Spell Save DC. Dat tweede vangt elk randgeval zonder dat we ze hoeven op te
> sommen. Stond de speler op het spreukenboek en heeft hij het niet meer, dan
> valt `_playerSubTab` terug op `personage` — anders kijkt hij naar een lege
> sectie zonder tab om op te klikken.



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

## Level omhoog

Een level-up is **administratie plus een moment**. De administratie loopt via
`POST /characters/:id/level-up` (en `/undo`), de rest is de omslag die de speler
te zien krijgt (`_levelUpCinematic()` in `app.js`) en op het tafelscherm
(`_levelUpDisplay()`).

- **Hoe de HP erbij komt kiest de DM**: `meta.levelup.methodes` is een deel van
  `LEVELUP_METHODES = ['gemiddelde','app','tafel']` — gemiddelde (vast getal),
  in de app rollen, of aan tafel rollen en het getal intikken. Alles uitvinken
  wordt geweigerd: dan kan niemand meer levelen.
- **Wat je erbij krijgt** komt uit `levelupFeatures()` in `render-progressie.js`:
  wat je zelf kiest (ASI, subklasse), wat je krijgt (class features) en wat
  vanzelf meegroeit (spell slots, proficiency bonus, een Hit Die). Species-traits
  hangen aan het **personage**level, niet aan het klasselevel — een Elf die zijn
  level in zijn tweede klasse haalt hoort zijn lineage-spreuk toch te zien.
- **Spreukkeuzes blijven openstaan.** Ga je omhoog en kies je nog geen cantrip,
  dan staat er een gestippelde regel op de Personage-tab tot je het doet
  (`_openSpreukKeuzes()`; tellers uit `bronnen/srd-spreukentellers.json`). Je moet
  immers naar de bibliotheek om te kiezen, en dat is wegnavigeren.
- **Multiclassen gaat langs de DM.** `_multiclassVoorrekenen()` zegt wat er
  gevraagd wordt en wat je hebt, maar blokkeert niets — zelfde regel als bij een
  spreukverzoek. `POST /characters/:id/multiclass-verzoek` → Meesterkamer →
  *Vragen*. Goedgekeurd zet de klasse op het profiel met level **0**; pas bij de
  volgende level-up krijgt hij zijn eerste level. Twee klassen is het maximum —
  een derde kan het datamodel (`class`/`multiKlasse`) niet bijhouden.

> **XP of milestone — `meta.levelup.systeem`.** Bij **milestone** (de standaard)
> gunt de DM een level-up: `groups[gid].levelUpTegoed[charId]`. Bij **xp** wordt
> datzelfde tegoed **verdiend**: `_levelupTegoed()` rekent het uit als het
> verschil tussen `_levelBijXp(dmState.playerXp[charId])` en het huidige level,
> dus er valt niets te gunnen en niets uit de pas te lopen. XP geven gaat met
> `POST /party/xp` (per personage, standaard party-breed, afwezigen overgeslagen)
> — in beeld de **XP**-knop in de regie-balk, die het totaal van het lopende
> gevecht al invult (`GET /encounters/:id/xp`, som van de statblokken × aantal).
> `XP_DREMPELS` in `routes/api.js` is met de hand overgetikt: de Character
> Advancement-tabel is de enige die in géén van de SRD-datasets staat.
> De vraag staat in Instellingen → *Level omhoog* en in het formulier voor een
> nieuwe campagne; niets kiezen is milestone, dus een bestaande campagne merkt er
> niets van.
>
> **De nullijn.** Wie halverwege overstapt heeft spelers mét een level en zónder
> XP — dan staat elke balk op nul en belooft hij een afstand die nergens op
> slaat. Twee dingen daartegen. `GET .../level-up` geeft `xp.scheef` mee (je XP
> ligt onder de drempel van je eigen level) en de balk zegt dat dan hardop in
> plaats van een dode balk te tonen. En `POST /party/xp/nullijn` (DM-only, knop
> in Instellingen → *Level omhoog*, alleen zichtbaar op XP) zet ieders XP op het
> minimum van zijn huidige level. Die **verlaagt nooit** (`Math.max`), dus twee
> keer drukken kan geen kwaad, en hij geeft géén level-up cadeau. Bewust een knop
> en geen automatische migratie bij het omzetten van de instelling: wat de stand
> van vanavond is, is een keuze van de DM en geen gevolg van een vinkje.

> **Exhaustion staat op het personage, niet op de combatant.** Het zat alleen in
> een gevecht (als conditie op een token), terwijl de zes niveaus juist dágen
> meegaan: `dmState.playerExhaustion[charId]` (0–6), te zetten met
> `PUT /characters/:id/exhaustion` (DM-only) en zichtbaar als zes bolletjes onder
> Temporary HP. Een lange rust haalt er één af (`POST /party/long-rest`).
> **Het getal wordt nergens van een worp afgetrokken** — zelfde regel als bij de
> loot-DC: de app zegt wat er geldt, de tafel rolt. Op het **printbare blad**
> staan de zes vakjes niet meer leeg: `vakjes(n, cls, aan)` vult de eerste `aan`
> ervan, want dat blad is de stand aan het eind van een sessie. Speelt de
> campagne op XP, dan staat het aantal punten daar ook in de klasseregel.

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

## Geld loopt altijd via twee helpers

`_effectiveCurrency(dmState, characterId)` om te lezen en `_deductCurrency(dmState,
characterId, cl)` om te betalen (een negatief bedrag schrijft bij). Staat de
gedeelde beurs van de party aan, dan is dát de portemonnee; anders de eigen.
**Schrijf nooit rechtstreeks in `dmState.playerCurrency`** — twee plekken mogen
dat: de helpers zelf, en `PATCH /player-currency/:id` (dat gaat expliciet over de
eigen beurs).

Ging eerder mis bij de winkel (7 sep) en daarna bij Ursula, De Gock, de
Tweespalt en De Heeren (8 sep): dertien plekken die betaalden uit — en zestien
die meldden over — een zak die het scherm niet toont zodra de gedeelde beurs
aanstaat. Gevolg: geld dat gestrand raakte, en een uitbetaling die nergens
zichtbaar werd. Ook de melding terug (`player:currency-updated` en het
antwoord van de route) hoort `_effectiveCurrency` te gebruiken.

---

## Kaartjes zijn agnostisch

Een kaartje beschrijft **wát iets is**, niet wanneer het in het verhaal
voorkomt. Er staat dus geen akte, geen hoofdstuk en geen sessienummer op een
personage, locatie, organisatie of voorwerp — en dat hoort ook niet te
gebeuren. Waar iets in het verhaal thuishoort staat aan de **akte**-kant: de
aktevorm, het regie-script (`meta.hoofdstukken[key].script`) en de verhaaltekst
per akte. Andersom mag wél: een akte noemt kaartjes.

Waarom dit een regel is en geen smaak: zodra het aan twee kanten staat lopen ze
uiteen. Bij de documenten gebeurde dat ook — 31 van de 31 hadden een
`hoofdstuk`-veld, 3 stonden in een aktescript, en in één geval noemden die twee
een andere akte. Zie `docs/voorstel-documenten.md`.

---

> **Ook een monster is agnostisch.** Het veld *Akte* (`chapter`) op een monster
> is vervallen — zelfde reden als bij documenten: een kaartje beschrijft wát een
> wezen is, niet wanneer het opduikt. Waar het thuishoort staat nu aan de
> aktekant in `meta.hoofdstukken[key].monsters`, te beheren in de akte-editor
> (*Monsters bij deze akte*), endpoint `PUT /meta/akte/:key/monsters`.
> De aktefilter in de Meesterkamer leest twee bronnen: die lijst **plus** de
> monsters die in de encounters van die akte staan (`_monstersPerAkte()` in
> `dm-panel.js`). Waarom een eigen lijst en niet puur afleiden: 11 van de 31
> monsters met een akte zaten in géén enkele encounter — troepen die klaarstaan
> maar nog nergens ingepland. Migratie:
> `node scripts/monster-akte-naar-meta.js <campagne> --schrijf` (gedraaid
> 11 sep 2026 op grisburgh en Test; 13 koppelingen overgezet, 18 kwamen al uit
> de encounters, kopieën ernaast als `*.voor-akteveld.<datum>.json`).

## Een document is een kaartje

Sinds 8 sep 2026 is `documenten` het **vijfde entiteitstype**. Daarvoor was het
hetzelfde ding, twee keer gebouwd: eigen opslag (`archief.json.documents`),
eigen zichtbaarheid met eigen woorden (`docStates` + `docVisibility`,
hidden/blurred/revealed), eigen kaart, detailvenster en editor (±615 regels), en
negen eigen routes. Dat is allemaal weg; wat overblijft is
`ENTITY_TYPES` + één `SCHEMA`-blok.

| vroeger | nu |
|---|---|
| `archief.json.documents[]` | `entities.json.documenten[]` (zelfde id, dus het bestand verhuist mee) |
| `tekstContent[id]` | `data.tekst` — de perkamenttekst |
| `type` + `cat` | `data.docType`, met `DOC_TYPE_GROEPEN` als indeling (de oude `cat` is de groep) |
| `npcs/locs/orgs/items/docs` | `links.{personages,locaties,organisaties,voorwerpen,documenten}` |
| `docStates` + `docVisibility` | `groups[gid].visibility` — revealed→visible, blurred→vague |
| `hoofdstuk` op het kaartje | `meta.hoofdstukken[key].documenten` (zie *Kaartjes zijn agnostisch*) |
| `hiddenLinks` | vervallen |
| `icon` (emoji) | vervallen; de app tekent zijn eigen iconen |

- **Wat document-eigen bleef:** de **perkamentweergave** (`renderParchment` in
  `render-campagne.js`, met `---titel---`, `--handtekening--` en `---`), het
  **bestand** (een pdf-scan of geluidsfragment onder het kaartje-id, met
  `_docBestandLaden` in het detailvenster en `_docBestandUpload` in de editor),
  en de **logboekregel + dramatische onthulling** bij het onthullen — die hangt nu
  aan `PUT /entities/documenten/:id/visibility`, en alleen de eerste keer dat het
  document érgens opengaat.
- **De akte noemt het document, niet andersom.** Te beheren in de akte-editor
  (*Documenten bij deze akte*), endpoint `PUT /meta/akte/:key/documenten`. Het
  Logboek groepeert daarop.
- **Migratie:** `node scripts/documenten-naar-kaartjes.js <campagne> --schrijf`
  (gedraaid op grisburgh 31, prewett 1, Test 1; kopie ernaast).

> **Markdown blijft het opgeslagen formaat; de opmaakbalk heeft een oogje.**
> De vraag "kunnen die velden niet WYSIWYG?" loopt stuk op de opslagkant: de
> tekst in `data.desc` en zijn soortgenoten wordt door **zeven** renderers
> gelezen, waarvan twee op de server (`lib/character-sheet.js` voor het
> printbare blad, `lib/snapshot.js` voor de campagneboek-export). Het formaat
> veranderen raakt die allemaal. En een contenteditable die markdown
> terugschrijft moet het hele dialect lossless kunnen: `**`, `*`, `__`, `~~`,
> `==`, `^smallcaps^`, `{kleur:tekst}`, `#`-koppen, `---`, en vooral
> `[[wikilinks]]` — die renderen als knop mét campagnestatus en moeten er weer
> precies zo uitkomen. Eén fout in die vertaalslag herschrijft bij elke
> opslagbeurt stilletjes andermans tekst.
> Daarom: de textarea blijft de bron, en elke opmaakbalk krijgt een **oogje**
> dat het veld omklapt naar `mdToHtml()` (`window._fmtVoorbeeld`). Kijkstand,
> geen tweede editor — er kan dus niets stuk. Het oogje staat **helemaal
> rechts**, los van de opmaakknoppen: het maakt niets op. In kijkstand wordt het
> een potlood, want een oog dat al open staat zegt niets meer. Sneltoetsen:
> Ctrl+B, Ctrl+I en sinds 11 sep ook Ctrl+U (`window._fmtKey`).
>
> **Statblokvelden hebben dezelfde balk**, met twee verschillen. Er staat een
> knop **`Naam.`** vooraan (`window._fmtStatblokNaam`) die de vorm zet die elk
> trait en elke action heeft: `***Bite.*** …`. En het voorbeeld gebruikt daar
> `window._sbMdBlokHtml` (de render van `render-statblock.js`) in plaats van
> `mdToHtml` — die laatste maakt van `***Naam.***` verkeerd geneste tags
> (`<strong><em>x</strong></em>`). De **monster-editor in de Meesterkamer** had
> als enige nog helemaal geen balk; die leent hem nu via
> `window._fmtToolbarHtml` uit `render-campagne.js`, zodat er geen derde kopie
> bij komt.

> **De brieftekst heeft twee tabbladen: schrijven en kijken.** Het veld
> `type: 'perkament'` krijgt boven het tekstvak *Schrijven* / *Zoals de speler
> het ziet* (`window._perkamentTab`); het voorbeeld draait dezelfde
> `renderParchment()` als het detailvenster en leest de stijl uit de vélden die
> op dat moment in het formulier staan — kies je een ander type of een andere
> briefstijl, dan verandert het voorbeeld mee zonder op te slaan. De
> opmaakbalk verdwijnt in het voorbeeld; knoppen die niets doen horen er niet.
> De drie structuurregels (`---titel---`, `--handtekening--`, `---`) stonden als
> **uitleg onder het veld** — je moest ze dus overtikken. Het zijn nu knoppen op
> de balk (`fmtToolbar(id, { perkament: true })` → `window._fmtStructuur`), die
> de markeerregel invoegen en de regel eronder selecteren.

> **`_beeld` betekent "er is een afbeelding", niet "er is een bestand".**
> `storage.bestandBestaat(id)` kijkt alleen of er iets onder dat id ligt — en
> onder het kaartje-id van een document ligt net zo vaak een **pdf-scan of een
> mp3** (15 van de 31 in Grisburgh). Gevolg: het kaartje zette `no-img` niet en
> reserveerde een leeg beeldvlak, en de onthulling stuurde dat id als `imageId`
> mee, waarna de speler een **gebroken plaatje** in beeld kreeg. Er is nu
> `storage.bestandIsBeeld(id)` (de bestandenindex cachet id → extensie); `_beeld`
> en de `archief:dramaticReveal`-payload gebruiken die. De `<img>` in de
> onthulling heeft daarnaast een `onerror` als vangnet, voor een bestand dat
> later weggehaald is.

> **Een documenttype zegt wat het ís, niet hoe het is opgeslagen.** De groep
> *Geluid* had *Audiofragment* als type — dat is een bestandsformaat: het staat
> al in het bestand eronder, en het kan geen briefstijl kiezen (zie
> `DOC_STIJL_BIJ_TYPE`). Die groep heet nu **Gesproken en gezongen** met **Lied**
> en **Opname**; de zes kaartjes die *Audiofragment* droegen waren in
> werkelijkheid drie liederen en drie voxaalfles-opnames (omgezet 11 sep 2026,
> backup ernaast). Onder Drukwerk kwam **Aanplakbiljet** erbij — het enige type
> dat in het spel steeds terugkwam en er niet stond.

> **Acht briefstijlen, niet één per type.** Zeven van de 22 documenttypes delen
> `drukwerk` en dat is meestal goed — een folder en een catalogus zien er
> hetzelfde uit. Twee gaten waren echt: een **gebed** stond in gewoon oud
> handschrift (nu `gotisch`, de letter die al geladen werd maar alleen als
> krantenkop diende) en een **aanplakbiljet** kreeg krantenkolommen terwijl het
> kort, gecentreerd en van een afstand leesbaar hoort te zijn (nu `aanplak`).
> Beide gebruiken fonts die al in de Google-Fonts-regel stonden, dus het kost
> geen extra verzoek.
> **Bewust géén stijl** voor de groep *Kaarten en tekeningen*: van die vier
> types heeft er in de hele campagne precies één ooit tekst (een blauwdruk).
> Een eigen lettertype bouwen voor één document is werk zonder lezer.

> **Briefstijlen en de brief op ware grootte.** Eén perkamentstijl maakte van een
> brief, een kasboek en een dreigbrief hetzelfde ding, terwijl het type al bekend
> was. `_docStijl(e)` leidt de stijl af uit `data.docType` (`DOC_STIJL_BIJ_TYPE`)
> en `data.briefstijl` overschrijft dat — zo verschillen twee schrijvers
> herkenbaar. De stijl staat als `data-stijl` op het blok, zodat dezelfde
> CSS-regels gelden in het detailvenster én in de vergrote weergave. Fonts komen
> uit de bestaande Google-Fonts-regel in `index.html` (Kalam, Dancing Script,
> Special Elite, UnifrakturMaguntia). **Uitgeknipte krantenletters** zijn geen
> lettertype maar opmaak per teken (`_knipselLetters`): de variatie hangt aan de
> tekencode, niet aan toeval, anders danst de brief bij elke hertekening — en elk
> woord zit in een `.knip-woord` die niet mag afbreken.
>
> **Het bladeren is gratis meegekomen met CSS-kolommen** (`_perkamentGroot`): geef
> het vel een vaste hoogte en breedte, zet `column-fill: auto`, en het aantal
> bladen is de totale breedte gedeeld door één vel. Geen tekst opmeten, geen
> handmatige afbreekpunten. Twee valkuilen: `column-width` neemt **geen
> percentage** (met `100%` valt de kolomindeling stil en wordt de tekst gewoon
> afgeknipt), dus die wordt in pixels gezet zodra het vel gemeten is; en gebruik
> **geen `requestAnimationFrame`** om de overlay te tonen — die staat stil in een
> tabblad dat niet op de voorgrond is.

## Wat een voorwerp is, en wat het doet

`data.itemType` zegt wát het is (badge, icoon, winkelindeling); `data.werking`
zegt wat het **doet** — een JSON-array met `attack`, `defense`, `healing` en/of
`spell`. Die twee lopen in D&D niet gelijk: een Staff kan slaan én spreuken
casten, een Ring kan AC geven, een Wondrous Item kan genezen. De mechanische
velden hingen aan het type en waren daardoor onbereikbaar voor driekwart van de
categorieën (31 Wondrous/Ring/Amulet-kaartjes in deze campagne hadden geen
enkele mechaniek, niet omdat ze niets doen maar omdat het niet kón).

- **Lees het nooit rechtstreeks uit.** `_werkingUit(data)` leidt het af als het
  veld ontbreekt: `damage` → attack (of healing als er "heal" in staat),
  `armorType`/`armorBaseAC` → defense, Scroll of een ingevulde casting time →
  spell. Daardoor is er **niets gemigreerd**: bestaande kaartjes komen goed
  binnen en er wordt pas iets opgeslagen als de DM ze zelf bewaart.
- **Velden hangen aan een werking** met `showWerking: 'attack'` in `SCHEMA`, niet
  meer aan `showFor: ['Weapon']`. `window._werkingBij()` toont en verbergt ze.
- **Het type stelt een werking voor**, meer niet: `ITEM_TYPE_WERKING` vinkt bij
  het kiezen van een type de gebruikelijke werking aan, maar alleen zolang er
  nog niets aanstaat — een bewuste keuze wordt nooit overschreven.
- **Genezing is een eigen veld** (`data.healing`) in plaats van een `damage` waar
  toevallig "heal" in stond. Die oude vorm blijft gelezen worden.

Zie `docs/voorstel-voorwerp-werking.md` voor het hele plan; stap 2 (spells
koppelen in plaats van kopiëren) staat daar nog open.

---

## Exemplaren: één helper, geen tweede kopie

`data.gebruik` zegt of een voorwerp uniek, gedeeld of stapelbaar is; oude
kaartjes hebben in plaats daarvan de losse vinkjes `stapelbaar`/`gedeeld`.
**Lees dat nooit rechtstreeks uit** — gebruik `_gebruikVan(data)` (server,
bovenaan `routes/api.js`) of `_getGebruik(entity)` (client). De winkelroutes
keken naar `data.stapelbaar === 'true'` en zagen een modern stapelbaar kaartje
dus voor uniek aan: je betaalde er drie, kreeg er één, en het voorwerp ging
meteen op uitverkocht. Toekennen loopt via `_eigendomErbij()`, zodat DM-geven,
winkelverkoop en DM-verkoop niet elk hun eigen versie van dezelfde drie regels
houden.

**Geld gaat via `_effectiveCurrency()` en `_deductCurrency()`.** Staat de
gedeelde beurs aan, dan is dát de portemonnee van de party. `POST /shops/:id/koop`
en `/verkoop` keken nog rechtstreeks in `dmState.playerCurrency`, waardoor een
speler met een gedeelde beurs uit zijn eigen zak betaalde terwijl het scherm de
partybeurs toonde — en de opbrengst van een verkoop in een zak verdween die
niemand ziet.

**Hit Dice na een lange rust rondt naar beneden af.** De PHB zegt "half your
total number of them (minimum of 1 die)", en D&D rondt naar beneden tenzij er
iets anders staat. Met `Math.ceil` kreeg een Wizard 5 (5d6) er drie terug in
plaats van twee — elke rust één te veel.

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
- **Een nieuwe CSS-regel bovenin de stylesheet verliest.** `theme.css` is één
  lang bestand en veel basisklassen staan pas op eenvijfde (`.dm-btn-ghost` rond
  regel 5600). Zet je een variant-regel met dezelfde specificiteit *erboven*,
  dan wint de basisklasse op volgorde en zie je niets veranderen. Twee keer
  misgegaan: `.betr-slot--aan` (de knop voor een geheime verbinding stond al
  maanden ongemarkeerd) en `.detail-weapon-tag--attune`. Nieuwe regels dus
  **onderaan** toevoegen, en een variant van een regel met twee klassen
  (`.item-kenmerken-rij--eigenschappen .detail-weapon-tag`) even specifiek maken.
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
