# Feature-plan: Mediabibliotheek

_Ontwerp op basis van gesprek 11 juni 2026. Nog niet geïmplementeerd._
_Branch hiervoor: `claude/media-library-dark-mode-svixvi`._

---

## Visie

Eén centrale bibliotheek waarin de DM alle geüploade media (afbeeldingen **én audio**) kan
bekijken, zoeken, hernoemen, hergebruiken en opruimen. Elke plek in de app waar nu een kale
upload-knop zit, krijgt een **picker-modal**: "kies uit bibliotheek óf upload nieuw".
Bestanden worden daarmee herbruikbaar over entiteiten, monsters, diensten en sessielogs heen.

**Waarom:** er is nu geen enkel overzicht van geüploade bestanden, geen hergebruik
(elke plek uploadt z'n eigen kopie), geen opruimmechanisme (weesbestanden stapelen zich op),
en bestandsnamen zijn Midjourney-prompts waaruit niet blijkt waar ze voor dienen.

---

## Genomen besluiten

| Vraag | Besluit |
|---|---|
| Mediatypen v1 | **Afbeeldingen + audio** (PDF/video later eventueel) |
| Picker-uitrol | **Overal direct** — alle bestaande uploadplekken krijgen de picker in v1 |
| Cascade-delete | **Usage-check**: bestand wordt alleen mee-verwijderd als dit de laatste verwijzing was |
| Metadata | **Weergavenaam + auto-info** (datum, type, afmetingen, gebruik). Naam is **bewerkbaar** — bestaande Midjourney-namen kunnen opgefrist worden |

### Naamgevingsconventie (afgesproken)

Voortaan duidelijke weergavenamen volgens patroon **`[naam]-[categorie]`**, bijv.
`gareth-personages`, `kasteelzaal-document`, `moeras-backdrop`. De bibliotheek toont een
hint bij het naamveld; afdwingen doen we niet. Bestaande bestanden worden eenmalig
handmatig hernoemd via de bibliotheek (zie Fase 5).

---

## Kernprincipe: ID ≠ naam

Bestanden staan op schijf als `{fileId}.{ext}` en **alle verwijzingen in de data gebruiken
dat fileId** (`imageId`, `backdropId`, `audioId`, `thumbId`, sessielog `images[].id`, …).
De weergavenaam leeft uitsluitend in `media.json`. Gevolgen:

- **Hernoemen is altijd veilig** — geen enkele verwijzing verandert.
- **Hergebruik = hetzelfde fileId op meerdere plekken zetten.** Geen kopieën.
- De picker geeft een bestaand fileId terug; de huidige upload-flow (nieuw id genereren)
  blijft bestaan voor "upload nieuw".

---

## Datamodel: `media.json` (nieuw, per campagne)

```json
{
  "files": {
    "monster_img_001": {
      "naam": "gareth-personages",
      "type": "afbeelding",
      "mime": "image/png",
      "grootte": 482133,
      "breedte": 1024,
      "hoogte": 1024,
      "geupload": "2026-06-11T09:30:00Z",
      "origineleNaam": "fantasy_knight_portrait_v6.png"
    }
  }
}
```

- `type`: `afbeelding` | `audio` (afgeleid uit MIME).
- `breedte`/`hoogte` alleen voor afbeeldingen (via sharp); audio krijgt evt. later `duur`.
- `origineleNaam` wordt vanaf nu bij upload meegestuurd (zit al in de multer-file);
  voor bestaande bestanden ontbreekt hij.
- **Backfill:** bij de eerste `GET /api/media` worden bestanden in `files/` die nog niet in
  `media.json` staan automatisch toegevoegd met `naam = fileId`, mtime als `geupload`,
  en afmetingen lazy bepaald. Geen apart migratiescript nodig.

**"In gebruik door" wordt NIET opgeslagen** maar live berekend (zie usage-scan) — opgeslagen
verwijzingen lopen onvermijdelijk uit de pas.

---

## Server

### Nieuwe endpoints (alle DM-only behalve bestaand file-serven)

| Endpoint | Doel |
|---|---|
| `GET /api/media` | Lijst: metadata + per bestand `gebruik: [{bestand, label}]` |
| `PATCH /api/media/:id` | Weergavenaam wijzigen |
| `DELETE /api/media/:id` | Verwijderen; **weigert** (409 + gebruikslijst) als het bestand nog in gebruik is, tenzij `?force=1` |

`POST /api/files/:id` (bestaand) wordt uitgebreid: registreert het bestand in `media.json`
(originele naam, MIME, datum). Bestaande aanroepen blijven ongewijzigd werken.

### Usage-scan: `lib/media-usage.js` (nieuw)

**Generieke deep-scan**: doorzoek alle campagne-JSON-bestanden (`entities.json`,
`dm-state.json`, `monsters.json`, `encounters.json`, `combat.json`, `map.json`,
`archief.json`, `sounds.json`, `dungeon-maps.json`, `meta.json`) recursief op
string-waarden die exact gelijk zijn aan een fileId.

- **Waarom generiek i.p.v. een veldenregister:** fileId's zijn opaque en lang — kans op
  false positives is verwaarloosbaar, en nieuwe `imageId`-achtige velden in de toekomst
  worden automatisch meegenomen. Een register van 30+ velden veroudert gegarandeerd.
- Resultaat per match: bronbestand + leesbaar label (bijv. "Monster: Owlbear",
  "Tempel: Helior (backdrop)", "Sessielog 12-03"). Labels via een kleine mapper per
  bronbestand; onbekende paden vallen terug op de bestandsnaam.
- Prestaties: O(bestanden × JSON-grootte), prima op deze schaal. Eén scan levert de
  gebruiksmap voor **alle** fileId's tegelijk (één pass, niet per bestand).

### Cascade-delete wordt guarded

Nieuwe helper `storage.deleteFileIfUnused(id)` (of in routes/api.js): draait de usage-scan
en wist alleen als er géén verwijzing meer over is. Alle bestaande cascade-plekken gaan
hierop over:

- Monster verwijderen → `imageId` + `backdropId` (routes/api.js ~2643)
- Encounter verwijderen → `backdropId` (~2972)
- Kaart verwijderen → geüploade kaartafbeelding (~3601)

Let op volgorde: **eerst** de entiteit/het record verwijderen, **dan** de check draaien —
anders telt de te verwijderen verwijzing zelf nog mee.

---

## Client

### 1. DM-paneel: nieuw tabblad "Media"

- **Grid-weergave** voor afbeeldingen via bestaande `GET /api/thumb/:id` (WebP 600px, gecachet).
- **Audio als rijen**: `icon('volume-2')`, naam, duur/grootte, afspeelknop (`new Audio(api.fileUrl(id))`).
- **Zoeken** op weergavenaam (en originele naam), **filter** op type (afbeelding/audio),
  **filter "wezen"** (= 0 verwijzingen), **sortering** nieuwste/naam.
- Per bestand: weergavenaam **inline bewerkbaar** (potlood-icoon), gebruik-badges
  ("in gebruik door: Tempel · Owlbear"), verwijderknop.
- **Verwijderen altijd via `confirm()`** met de gebruikslijst in de tekst; bij gebruik > 0
  een expliciete tweede bevestiging (force). Geen stille verwijdering — campagneregel.
- Bulk: selectievakjes + "Verwijder geselecteerde wezen" (alleen wezen-bestanden bulken).

### 2. Picker-modal: `media-picker.js` (nieuw module-bestand)

```javascript
window.mediaPicker.open({
  type: 'afbeelding',          // of 'audio' — filtert de bibliotheek
  onSelect: (fileId) => { … }  // bestaand id óf vers geüpload id
});
```

- Twee tabs: **Bibliotheek** (zelfde grid als DM-tab, compacter) en **Upload nieuw**
  (bestaande flow: id genereren → `api.uploadFile` → meteen `onSelect`).
- Bij upload via de picker: naamveld vooraf ingevuld volgens conventie waar de context dat
  weet (bijv. vanuit een monster-editor: `{monsternaam}-monster`).
- Styling: perkamentthema, `.media-picker-*` klassen in theme.css. Geen emoji, `icon()` overal.
- **Let op de module-import**: `import` in app.js mét `?v=1` querystring, en bij een
  eventuele revert óók de import-regel weghalen (zie "Veelgemaakte fouten" in CLAUDE.md —
  dangling import laat de hele module-graaf stil falen).

### 3. Integratieplekken (alle bestaande upload-call-sites → picker)

| Bestand | Plek(ken) | Wat |
|---|---|---|
| `dm-panel.js` | ~2655 | Monster `imageId`/`backdropId` |
| `dm-panel.js` | ~3789, 4098, 4194, 4301, 4424, 4600 | Diensten: Herberg, Tweespalt, De Gock, Magizoo, Ursula, Heeren (`imageId`/`backdropId`) |
| `dm-panel.js` | ~4826 | Tempel: per god `imageId`/`priestImageId`/`backdropId` |
| `render-campagne.js` | ~379, 2417, 3286–3300 | Entiteitsportret, galerij-afbeeldingen, entiteits-**audio** (`audioId`) |
| `render-archief.js` | ~1468, 2003, 2406, 2689 | Documenten, sessielog-`images[]`, aktes |
| `render-kaart.js` | ~671 | Kaartafbeelding/`thumbId` |
| `render-progressie.js` | ~999 | Progressie-afbeelding (klasse-editor) |
| `app.js` | ~2228 | (controleren welke flow — vermoedelijk spreuk-/spelerafbeelding) |
| DM-geluidenpaneel | sounds-config in dm-panel | Standaardgeluiden, emotes, playerTurn, serviceAmbiance, ambiance-scenes → picker met `type:'audio'` |

De diensten-dropdowns die nu entiteitsportretten hergebruiken blijven werken (zelfde
fileId-principe); de picker komt er als alternatief naast of vervangt ze — per plek bekijken.

---

## Fasering

1. **Server-fundament** — `media.json` + registratie bij upload, `GET/PATCH/DELETE /api/media`,
   `lib/media-usage.js`, guarded cascade-delete. Testbaar via curl, nul UI-risico.
2. **DM-tab "Media"** — grid, zoeken, filters, hernoemen, verwijderen, wezen-filter.
3. **Picker-modal + afbeeldingsplekken** — `media-picker.js`, alle image-call-sites omzetten.
4. **Audio-integratie** — picker `type:'audio'` op de geluidsplekken (sounds-config,
   entiteits-audio). `sounds.json`-structuur blijft ongewijzigd (verwijst al naar fileId's).
5. **Opruimronde (handmatig, met DM)** — bestaande bestanden hernoemen volgens
   `[naam]-[categorie]`, wezen-bestanden beoordelen en wissen.

Fase 1+2 vormen samen een zelfstandig nuttige eerste deploy; 3 en 4 kunnen per stuk volgen.

---

## Deploy-checklist (per fase)

- [ ] Nieuwe bestanden: `lib/media-usage.js`, `public/js/media-picker.js`
- [ ] Versiebumps: `app.js` (import media-picker `?v=N` + eigen versie in index.html),
      `dm-panel.js`-import in app.js, `api.js`-import, `theme.css` in index.html
- [ ] Server-side gewijzigd (routes/api.js, lib/) → `pm2 restart grisburgh`
- [ ] **Backup vóór deploy van fase 1** (raakt server-side opslag):
      `dm-state.json` + `archief.json` bak-kopieën conform CLAUDE.md
- [ ] `media.json` toevoegen aan de tabel "Data-bestanden per campagne" in CLAUDE.md

---

## Testplan

### Server (fase 1)
- [ ] `GET /api/media` op grisburgh: alle bestanden uit `files/` aanwezig, backfill gevuld
- [ ] Upload nieuw bestand → verschijnt in media.json mét originele naam
- [ ] `PATCH` naam → blijft na herstart; verwijzingen ongewijzigd
- [ ] `DELETE` op bestand in gebruik → 409 met gebruikslijst; met `force=1` → weg
- [ ] Monster met **gedeelde** afbeelding verwijderen → bestand blijft; laatste gebruiker
      verwijderen → bestand weg
- [ ] Sandbox-campagne: eigen media.json, geen lekkage tussen campagnes

### DM-tab (fase 2)
- [ ] Grid toont thumbnails; audio-rijen spelen af
- [ ] Zoeken/filteren/sorteren werkt; wezen-filter toont alleen ongebruikte bestanden
- [ ] Hernoemen inline; gebruik-badges kloppen (check tempel-god + monster + sessielog)
- [ ] Verwijderen: confirm toont gebruikslijst; wees verwijderen lukt direct

### Picker (fase 3/4)
- [ ] Monster-editor: bestaande afbeelding kiezen → zelfde fileId op twee monsters
- [ ] Upload via picker → direct geselecteerd én zichtbaar in bibliotheek
- [ ] Sessielog: afbeelding uit bibliotheek toevoegen + reveal werkt als voorheen
- [ ] Audio-picker bij emotes/ambiance: kiezen + afspelen werkt
- [ ] Speler ziet niets nieuws (bibliotheek is 100% DM-only)

---

## Open punten

- `app.js:2228` — uitzoeken welke upload-flow dit is en of de picker daar past.
- Diensten-dropdowns (entiteitsportret kiezen): vervangen door picker of laten bestaan?
- Audio-`duur` in metadata: vergt decoderen server-side — v2, niet blokkeren.
- PDF/video later toevoegen aan de bibliotheek? Whitelist staat het al toe; alleen
  weergave (geen thumb) zou nodig zijn.
- Thumbs-cache (`thumbs/`) opruimen bij verwijderen bestand — meenemen in `DELETE`.
