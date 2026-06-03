# Grisburgh — Feature-bouwplannen

> Werkdocument met uitgewerkte bouwplannen voor gekozen features. **Nog niet gebouwd.**
> Pak één feature per branch; cherry-picken naar `main` blijft omslachtig, dus liever
> kleine, op zichzelf staande commits per feature.

**Algemene afspraken** (uit `CLAUDE.md`, gelden voor élke feature hieronder):
- UI-taal **Nederlands**, D&D-termen **Engels** (Concentration, Saving Throw, Condition…).
- Iconen via `icon()` — **nooit emoji** in gerenderde HTML.
- Perkament-thema bewaken (Cinzel/Crimson/IM Fell; okertinten).
- **Versienummers bumpen** bij elke deploy (index.html + app.js-imports).
- **Backup van spelersdata** vóór server-side wijziging die het spelerstabblad raakt.
- Socket altijd `io.to(campaignId).emit(...)`, nooit `io.emit(...)`.
- Destructieve acties achter `confirm()` / zichtbare knop.

## Prioriteit & inschatting

| # | Feature | Impact | Inschatting | Afhankelijk van |
|---|---|---|---|---|
| 1 | Concentratie & aflopende condities | Hoog (tafelspel) | M | combat |
| 2 | Geluidsdecors (ambiance) | Midden (sfeer) | S–M | sounds + socket |
| 3 | Bestiarium / Onderzoek | Hoog (ontdekking) | M–L | monsters + combat |
| 4 | Login/onthaal-scherm | Laag (cosmetisch) | S | index.html + auth |
| 5 | Ontdekkings-teller | Midden (gamification) | S | entity-visibility |

Aanbevolen volgorde: **4 → 2 → 5 → 1 → 3** (oplopend in complexiteit en risico).

---

## Bestaande code-ankers (referentie voor alle plannen)

**Combat** — `routes/api.js`
- Combatant aangemaakt: `POST /combat/combatant` (~3566), veld `conditions: req.body.conditions || []` (~3580).
- Combatant bijwerken: `PUT /combat/combatant/:id` (~3590).
- HP wijzigen in gevecht: `PATCH /combat/player-hp/:combatantId` (~3624) — kent de vorige HP vóór de update.
- Beurt/ronde: `PUT /combat` (~3549), beurtwissel-log bij `currentTurn`-verandering (~3557).
- Combat-log helper: `_combatLog(combat, text)` (~3503).
- Condities geleegd bij reset: ~1525–1530.
- Frontend speler: `app.js` ~4117 `conditions = myCombatant?.conditions || []`.

**Sounds** — `routes/api.js` `GET /sounds` (~2906), `PUT /sounds` (~2913, merge via `Object.assign`).
Vorm: `{ standard:{damage,healing,win,loss,nextRound,nextTurn}, emotes:{}, playerTurn:{} }`.
Client: `public/js/sound-manager.js` (speelt **alleen op DM-browser**, regel 33/96 `if (!isDM) return`).
Socket-relay: `socket-client.js` ~315 `socket.on('sound:emote', …)`; spelers emitten via `window._socket`.

**Monsters** — `routes/api.js` `/monsters` (~3383, allemaal `requireDM`). `monsters.json` = `{ monsters:[…] }`.

**Entity-zichtbaarheid** — `routes/api.js`
- Per groep: `dmState.groups[gid].visibility[entityId]` = `'hidden' | 'vague' | 'visible'`; daarnaast `secretReveals[entityId]`.
- Nieuw entity start `hidden` in álle groepen (~246–248).
- Speler-filter: visibility `hidden` → entity wordt `null` (~139); `vague` → beperkt (~148); `visible` → volledig.
- Groep van speler: `char.data.groep` → `_groupForPlayer` (~127–133).

**Login** — `public/index.html`: DM-login-overlay (~277), tablet (~295), test (~313).
Auth: `routes/auth.js` `POST /login`, `POST /player-login`, `GET /players`.

---

## 1. Concentratie & aflopende condities

### Wat & waarom
Twee veelvergeten regels automatiseren tijdens combat:
1. **Concentration**: zodra een geconcentreerde speler/monster schade krijgt → automatisch een
   Concentration-saveprompt (DC = `max(10, floor(schade/2))`).
2. **Aflopende condities**: een condition kan een rondeteller krijgen die vanzelf afloopt en
   verdwijnt, met logregel.

### Datamodel (combat.json → `combatants[]`)
Backward-compatible uitbreiden:
- `concentratie: { actief: boolean, spreuk: string }` — default `{ actief:false }`.
- `conditions`: nu een array van **strings**; uitbreiden zodat ook objecten mogen:
  `{ naam: 'Frightened', rondes: 3 }` (rondes optioneel/`null` = onbepaald). Render-laag moet
  beide vormen aankunnen (`typeof c === 'string' ? c : c.naam`).

### Server (`routes/api.js`)
- **Concentration-trigger** in `PATCH /combat/player-hp/:combatantId` (~3624):
  bereken `schade = vorigeHp - nieuweHp`. Als `schade > 0 && combatant.concentratie?.actief`:
  zet `combat.concentratiePrompt = { combatantId, dc: Math.max(10, Math.floor(schade/2)), ts: Date.now() }`
  en log via `_combatLog`. Emit `combat:updated`.
- **Save afhandelen**: hergebruik de bestaande dobbelsteen-uitkomst, of nieuw
  `POST /combat/concentratie/:combatantId` met `{ gehaald: boolean }` → bij `false`
  `concentratie.actief=false` + log "Concentration verbroken"; prompt wissen. Emit.
- **Condities aftellen**: in `PUT /combat` bij beurtwissel (~3557) of rondewissel: loop over
  combatants, decrementeer `rondes` van objecten-condities (kies één conventie: aftellen aan het
  **begin van de eigen beurt** is het meest 5e-correct). `rondes <= 0` → verwijderen + `_combatLog`.

### Frontend
- **Character sheet** (`app.js` ~4117): conditions-render aanpassen voor beide vormen; bij
  objecten een `rondes`-chip tonen (`icon('refresh-cw')` + getal). Concentratie-indicator
  (`icon('sparkles')` + spreuknaam) als `concentratie.actief`.
- **Concentratie-overlay** voor de betrokken speler: luister op `combat:updated`; als
  `concentratiePrompt.combatantId === mijnCombatantId` → perkament-overlay "Maak een Concentration
  Saving Throw — DC X" met een rol-knop die de bestaande dice-roller opent (CON-save). Resultaat ≥ DC
  → knop "Gehaald", anders "Verbroken" → `POST …/concentratie`.
- **DM-paneel combat**: per combatant een toggle "Concentreert op…" (tekstveld) en bij conditions
  een optioneel rondes-veld.

### Aandachtspunten
- Backward-compat: oude string-condities mogen niet breken.
- Geen dubbele prompts: `concentratiePrompt.ts` of een `afgehandeld`-flag.
- DM moet handmatig kunnen overrulen (save automatisch gehaald verklaren).

### Open keuzes
- Aftellen aan begin eigen beurt vs. einde ronde?
- Concentratie-save volledig automatisch (server rolt) of speler rolt zelf? (advies: speler rolt,
  past bij de bestaande dice-cultuur.)

---

## 2. Geluidsdecors (ambiance)

### Wat & waarom
DM kiest een **scène** (Herberg, Gevecht, Woud, Storm, Markt…) die een ambient-audioloop bij
**iedereen** afspeelt. Sfeerlaag bovenop de bestaande emote-geluiden.

### Belangrijk verschil met huidige sounds
`sound-manager.js` speelt nu **alleen op de DM-browser** (`if (!isDM) return`). Ambiance moet juist
op **alle** clients spelen. Let op browser-autoplay: audio start pas ná een user-gesture — spelers
hebben al geklikt (login), maar voeg een **"geluid aan/uit"-toggle per client** toe (localStorage)
en start de loop pas na de eerste interactie.

### Datamodel (`sounds.json`)
Nieuw blok naast `standard/emotes/playerTurn`:
```json
"ambiance": {
  "scenes": [ { "id": "amb_…", "label": "Herberg", "fileId": "…", "icon": "beer" } ],
  "actief": null,        // id van de nu spelende scène, of null
  "volume": 0.5
}
```
`PUT /sounds` mergt al via `Object.assign` — `ambiance` toevoegen aan de default in
`GET`/`PUT` (~2907/2915).

### Server
- DM zet scène aan/uit: `POST /sounds/ambiance` met `{ actief: id|null }` → opslaan +
  `io.to(campaignId).emit('sound:ambiance', { fileId, actief, volume })`.
- (Scènes beheren gaat via bestaande `PUT /sounds`.)

### Frontend
- **socket-client.js**: `socket.on('sound:ambiance', d => window.soundManager.setAmbiance(d))`.
- **sound-manager.js**: nieuwe `setAmbiance({fileId, volume})`: houd één langlevende
  `Audio`-instantie met `loop=true`; fade in/out; stop bij `actief=null`. **Niet** achter de
  `isDM`-guard. Respecteer de client-toggle + autoplay-gesture.
- **Speler-UI**: klein luidspreker-knopje (`icon('volume-2')`) ergens in de header/Party-tab dat
  ambiance lokaal dempt en de huidige scène-naam toont.
- **DM-paneel → Geluiden**: nieuwe sectie "Geluidsdecors": lijst scènes (label + icoon + upload via
  bestaande file-upload), klik = afspelen bij iedereen, "Stop" knop, volume-slider.

### Aandachtspunten
- Autoplay-policy: toon "Tik om geluid aan te zetten" als de eerste `play()` faalt.
- Mobiel: één Audio-element hergebruiken (geen stapel).
- Nieuwe scène-speler die later inlogt: stuur de huidige `actief`-staat mee in de eerste
  `/api/sounds`-load, zodat hij de loop oppakt.

---

## 3. Bestiarium / Onderzoek

### Wat & waarom
Spelers ontgrendelen geleidelijk de statblocks van monsters die ze tegenkomen (BG3-"Examine"-gevoel).
Beloont strijd met kennis; DM bepaalt wat bekend wordt. Eigen Bestiarium-weergave met
perkament-statkaarten.

### Datamodel
Kennis is **per groep** (net als entity-visibility). In `dm-state.json` per groep:
```json
"bestiarium": {
  "<monsterId>": { "niveau": "naam" | "deels" | "volledig", "ts": 169… }
}
```
- `naam`: alleen naam + afbeelding zichtbaar.
- `deels`: + type, AC, HP-balk (geen exacte waarden), bekende resistances.
- `volledig`: hele statblock.

### Server (`routes/api.js`)
- **Speler-endpoint** `GET /bestiarium` (`attachRole`): retourneer voor de groep van de speler de
  monsters met kennis ≥ `naam`, gefilterd op kennisniveau (server schoont velden weg die de speler
  nog niet mag zien — net als de entity-`vague`-logica ~148).
- **DM-toggle** `PUT /bestiarium/:monsterId` (`requireDM`) `{ niveau }` → opslaan in actieve groep +
  `io.to(campaignId).emit('bestiarium:updated')`.
- **Sneltoegang vanuit combat**: knop bij een monster-combatant "Onthul aan party" → roept
  bovenstaande aan met `deels`/`volledig`.

### Frontend
- **Nieuwe sectie of subtab "Bestiarium"** (speler). Twee opties:
  - a) Onder Archief-dropdown (naast Personages/Locaties…) — past in bestaande nav.
  - b) Player-subtab. *(Advies: a — het is archief-achtige naslag.)*
  - Render: grid van monster-kaartjes; vergrendelde delen tonen `icon('lock')` / silhouet.
  - Hergebruik de bestaande statblock-render uit het DM-paneel (extraheren naar gedeelde helper).
- **DM-paneel → Monsters / Combat**: kennisniveau-selector per monster (Onbekend / Naam / Deels /
  Volledig) + "Onthul aan party"-knop.
- Realtime: `socket-client.js` → `bestiarium:updated` → her-render als de sectie open is.

### Aandachtspunten
- Server moet velden écht wegfilteren (niet alleen client-side verbergen) — anti-cheat, zoals bij
  `vague` entities.
- Backward-compat: geen `bestiarium` in dm-state = alles onbekend.
- Statblock-render-helper delen tussen DM en speler om duplicatie te voorkomen.

### Open keuzes
- Auto-onthullen bij gevecht-start (naam) ja/nee? (advies: ja, naam automatisch bij toevoegen aan
  combat; diepere kennis handmatig of via een "Onderzoek"-actie.)

---

## 4. Login / onthaal-scherm

### Wat & waarom
Het publieke scherm vóór inloggen sfeervoller maken: campagne-titel, perkament-art, korte teaser.
Puur cosmetisch onthaal — eerste indruk.

### Aanpak (`public/index.html` + `theme.css`)
- De bestaande overlays (`#login-overlay` ~277 e.a.) blijven functioneel; voeg een **onthaal-laag**
  toe die getoond wordt zolang niemand is ingelogd:
  - Volledig perkament-achtergrond (`url(...)` uit `img/`), donker vignet.
  - Grote campagne-titel in Cinzel + ondertitel (lees uit `meta.json` → titel/ondertitel; al
    beschikbaar via de bestaande header-data).
  - Eén centrale "Betreed"-knop → opent de bestaande speler-login (`/players` → karakterkeuze) of
    DM-login.
  - Optioneel: subtiele animatie (kaarslicht-flikker via CSS `@keyframes`, geen JS nodig).
- **Geen** nieuwe server-logica nodig; titel/ondertitel/achtergrond komen uit bestaande
  campagne-meta. Eventueel een `meta.loginBackdropId` toevoegen die de DM in instellingen kiest.

### Aandachtspunten
- Niet de DM/tablet/test-loginflow breken — onthaal-laag is een schil eromheen.
- Mobiel-vriendelijk (achtergrond `cover`, knop groot genoeg).
- Respecteer dat DM en speler niet samen in één browser kunnen (bestaande cookie-regel).

### Open keuzes
- Wil je de achtergrond per campagne instelbaar maken (DM-instellingen) of vaste art?

---

## 5. Ontdekkings-teller (revealed kaartjes)

### Wat & waarom
Gamified verzamel-/ontdekkingsvoortgang voor spelers: *"Personages 23/40 ontdekt"* per
archiefcategorie. Maakt zichtbaar hoeveel van de wereld de party al heeft blootgelegd.

### Datamodel
Geen nieuwe opslag nodig — afleidbaar uit bestaande `dmState.groups[gid].visibility`.
- **Ontdekt** = entities met visibility `vague` óf `visible` (eventueel twee tellers:
  "gespot" = vague, "bekend" = visible).
- **Totaal** = alle niet-getrashte entities van dat type (DM kent de noemer; speler niet — daarom
  server-side berekenen).

### Server (`routes/api.js`)
Nieuw `GET /ontdekkingen` (`attachRole`): bepaal de groep van de speler en geef terug:
```json
{
  "personages":   { "ontdekt": 23, "totaal": 40 },
  "locaties":     { "ontdekt": 12, "totaal": 18 },
  "organisaties": { "ontdekt": 5,  "totaal": 9  },
  "voorwerpen":   { "ontdekt": 7,  "totaal": 30 }
}
```
Tel per type de entities waar `visibility[id]` ∈ {vague, visible}; `totaal` = aantal entities van het
type. (Documenten via `docStates` als je die wilt meenemen.)

### Frontend
- **Plek**: bovenaan de **Party-subtab** (de speler-"thuisbasis"), als rij perkament-meters.
  Per categorie: `icon(...)` + label + `X / Y` + een dunne voortgangsbalk. Subtiel, themavast.
- Laden in `renderMijnKarakter` (Party-render) via `api` (nieuwe wrapper `ontdekkingen()` in
  `public/js/api.js`).
- Realtime: luister op `entity:visibility` / `entity:updated` → meters verversen.

### Aandachtszaken
- Alleen voor spelers tonen (niet de DM, die ziet alles).
- Noemer kan "spoilen" hoeveel er nog komt — overweeg een DM-schakelaar
  `meta.toonOntdekkingsTeller` om de feature per campagne aan/uit te zetten, of toon alleen
  "ontdekt" zonder totaal als de DM dat wil.
- 0 entities van een type → meter verbergen (geen "0/0").

### Open keuzes
- Eén teller (visible) of twee-traps (gespot/bekend)?
- Totaal tonen of verbergen (anti-spoiler)?

---

## Niet gekozen (parkeren voor later)
Uit de brainstorm wél geopperd maar nu niet uitgewerkt: **De Meester vraagt een worp**
(groepsworp), **Almanak & Wereldklok**, **Downtime-activiteiten**, **De Kroniek (mijlpalen)**,
**Attunement & magische voorwerpen**. Pitches staan in de chatgeschiedenis; bij interesse hier
later een plan aan toevoegen.
