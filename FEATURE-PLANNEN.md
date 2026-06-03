# Grisburgh — Feature-bouwplannen

> Werkdocument met uitgewerkte bouwplannen voor gekozen features. **Nog niet gebouwd.**
> Pak één feature per branch; cherry-picken naar `main` blijft omslachtig, dus liever
> kleine, op zichzelf staande commits per feature.
>
> Keuzes zijn vastgelegd na een tweak-ronde (zie **Beslissingen** bij elke feature).

**Algemene afspraken** (uit `CLAUDE.md`, gelden voor élke feature hieronder):
- UI-taal **Nederlands**, D&D-termen **Engels** (Concentration, Saving Throw, Condition…).
- Iconen via `icon()` — **nooit emoji** in gerenderde HTML.
- Perkament-thema bewaken (Cinzel/Crimson/IM Fell; okertinten).
- **Versienummers bumpen** bij elke deploy (index.html + app.js-imports).
- **Backup van spelersdata** vóór server-side wijziging die het spelerstabblad raakt.
- Socket altijd `io.to(campaignId).emit(...)`, nooit `io.emit(...)`.
- Destructieve acties achter `confirm()` / zichtbare knop.

## Prioriteit & inschatting

| # | Feature | Impact | Inschatting | Status |
|---|---|---|---|---|
| 1 | Concentratie-waarschuwing | Midden (tafelspel) | S | Klaar om te bouwen |
| 2 | Geluidsdecors (ambiance) | Midden (sfeer) | S–M | Klaar om te bouwen |
| 3 | Bestiarium / Onderzoek | Hoog (ontdekking) | M–L | Klaar om te bouwen |
| 4 | Login/onthaal-scherm | Laag (cosmetisch) | S | **Geparkeerd** (beeldkeuze open) |
| 5 | Ontdekkings-teller | Midden (gamification) | S | Klaar om te bouwen |

Aanbevolen volgorde: **2 → 5 → 1 → 3** (login geparkeerd).

---

## Bestaande code-ankers (referentie voor alle plannen)

**Combat** — `routes/api.js`
- Combatant aangemaakt: `POST /combat/combatant` (~3566), veld `conditions: req.body.conditions || []` (~3580).
- Combatant bijwerken: `PUT /combat/combatant/:id` (~3590).
- HP wijzigen in gevecht: `PATCH /combat/player-hp/:combatantId` (~3624) — kent de vorige HP vóór de update.
- Gevecht starten: `POST /combat/start` (~3527); combatants met `entityId` zijn spelers (~3511).
- Beurt/ronde: `PUT /combat` (~3549), beurtwissel-log bij `currentTurn`-verandering (~3557).
- Combat-log helper: `_combatLog(combat, text)` (~3503).
- Frontend speler: `app.js` ~4117 `conditions = myCombatant?.conditions || []`.

**Sounds** — `routes/api.js` `GET /sounds` (~2906), `PUT /sounds` (~2913, merge via `Object.assign`).
Vorm: `{ standard:{damage,healing,win,loss,nextRound,nextTurn}, emotes:{}, playerTurn:{} }`.
Client: `public/js/sound-manager.js` (speelt **alleen op DM-browser**, regel 33/96 `if (!isDM) return`).
Socket-relay: `socket-client.js` ~315 `socket.on('sound:emote', …)`; spelers emitten via `window._socket`.

**Monsters** — `routes/api.js` `/monsters` (~3383, allemaal `requireDM`). `monsters.json` = `{ monsters:[…] }`.
Statblock-render zit nu in `dm-panel.js` — moet **geëxtraheerd** worden naar een gedeelde helper (zie feature 3).

**Entity-zichtbaarheid** — `routes/api.js`
- Per groep: `dmState.groups[gid].visibility[entityId]` = `'hidden' | 'vague' | 'visible'`; daarnaast `secretReveals[entityId]`.
- Nieuw entity start `hidden` in álle groepen (~246–248).
- Speler-filter: visibility `hidden` → entity wordt `null` (~139); `vague` → beperkt (~148); `visible` → volledig.
- Groep van speler: `char.data.groep` → `_groupForPlayer` (~127–133).

**Login** — `public/index.html`: DM-login-overlay (~277), tablet (~295), test (~313).
Auth: `routes/auth.js` `POST /login`, `POST /player-login`, `GET /players`.

**Nav / secties** — `public/index.html` Archief-dropdown (~87–94, `data-section="…"`).
`app.js` `switchSection` + `refreshSection` schakelen secties; nieuwe sectie hier registreren.

---

## 1. Concentratie-waarschuwing

> **Beslissingen:** geen automatische save (DM regelt de uitkomst); melding = **speler-waarschuwing
> op het scherm + combat-logregel**; condities blijven **handmatig** (géén rondeteller — dat deel
> is geschrapt).

### Wat & waarom
Helpt de veelvergeten Concentration-regel: zodra een geconcentreerde combatant schade krijgt,
verschijnt bij die speler een waarschuwing "Maak een Concentration Saving Throw — DC X" en komt er
een regel in het combat-log. De speler rolt zelf (bestaande dice-roller); de DM/speler haalt de
concentratie-vlag handmatig weg als de save mislukt. Niets wordt automatisch beslist.

### Datamodel (combat.json → `combatants[]`)
- Nieuw veld `concentratie: { actief: boolean, spreuk: string }` — default `{ actief:false }`.
- Tijdelijke prompt op combat-niveau: `combat.concentratiePrompt = { combatantId, dc, ts }` (of `null`).
- **Condities ongewijzigd** (blijven strings; handmatig beheer zoals nu).

### Server (`routes/api.js`)
- In `PATCH /combat/player-hp/:combatantId` (~3624): bereken `schade = vorigeHp - nieuweHp`.
  Als `schade > 0 && combatant.concentratie?.actief`:
  - `combat.concentratiePrompt = { combatantId, dc: Math.max(10, Math.floor(schade/2)), ts: Date.now() }`.
  - `_combatLog(combat, 'Concentration save nodig — DC X (…spreuk…)')`.
  - emit `combat:updated`.
- Concentratie-vlag zetten/weghalen kan via bestaande `PUT /combat/combatant/:id` (geen nieuw endpoint nodig).

### Frontend
- **DM-paneel combat**: per combatant een toggle "Concentreert op…" (checkbox + tekstveld spreuknaam)
  → `PUT /combat/combatant/:id` met `concentratie`.
- **Speler-waarschuwing**: luister op `combat:updated`; als
  `concentratiePrompt.combatantId === mijnCombatantId` én `ts` nieuwer dan laatst gezien → toon een
  perkament-toast/overlay "Concentration Saving Throw — DC X" met knop "Rol CON-save" (opent de
  bestaande dice-roller). Geen automatische afhandeling.
- **Character sheet** (`app.js` ~4117 e.o.): concentratie-indicator (`icon('sparkles')` + spreuknaam)
  als `concentratie.actief`.

### Aandachtspunten
- Dubbele toasts voorkomen via `ts`-vergelijking (onthoud laatst getoonde ts per client).
- Backward-compat: ontbrekend `concentratie`-veld = niet actief.
- Vlag weghalen is handmatig — bewust, want de DM beslist de uitkomst.

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
- **Speler-UI**: klein luidspreker-knopje (`icon('volume-2')`) in de header/Party-tab dat
  ambiance lokaal dempt en de huidige scène-naam toont.
- **DM-paneel → Geluiden**: nieuwe sectie "Geluidsdecors": lijst scènes (label + icoon + upload via
  bestaande file-upload), klik = afspelen bij iedereen, "Stop"-knop, volume-slider.

### Aandachtspunten
- Autoplay-policy: toon "Tik om geluid aan te zetten" als de eerste `play()` faalt.
- Mobiel: één Audio-element hergebruiken (geen stapel).
- Late binnenkomer: stuur de huidige `actief`-staat mee in de eerste `/api/sounds`-load, zodat hij
  de loop oppakt.

---

## 3. Bestiarium / Onderzoek

> **Beslissingen:** eigen **tabblad in de Archief-dropdown**; **drie-traps** kennis
> (naam → deels → volledig); **auto op naam-niveau bij combat**, daarna handmatig verdiepen;
> kennis geldt **alleen voor de betrokken groep(en)**; hergebruik de bestaande monsterbibliotheek
> + **gedeelde statblock-render** (geen dubbele data, geen dubbele render).

### Wat & waarom
Spelers ontgrendelen geleidelijk de statblocks van monsters die ze tegenkomen (BG3-"Examine"-gevoel).
Beloont strijd met kennis; DM bepaalt hoe diep de kennis gaat. Eigen Bestiarium-tabblad met
perkament-statkaarten.

### Integratie met de monsterbibliotheek (geen dubbel werk)
Het Bestiarium is **geen aparte dataset** — het is een speler-view van diezelfde `monsters.json`-
entries, met een dunne **kennis-laag** per groep eroverheen. Concreet:
1. **Extraheer** de statblock-render uit `dm-panel.js` naar een gedeelde helper
   (bv. `public/js/render-statblock.js` met `renderStatblock(monster, { niveau })`).
2. DM-bibliotheek én speler-Bestiarium roepen **dezelfde** helper aan; alleen het `niveau`-argument
   verschilt (DM = altijd `volledig`).

### Veld-inventaris (bron: `monsters.json` + `dm-panel.js` `_statblockHtml`/`_statblockEditorHtml`)
**Top-level (monster):** `id`, `name`, `chapter` (organisatie/DM-only), `maxHp`, `initiative`
(DM-only), `imageId` (portret), `backdropId` (sfeerachtergrond).
**`statblock` (sb):** `size`, `type`, `alignment` · `ac`, `hp` (formule-tekst), `speed` ·
ability scores `str`/`dex`/`con`/`int`/`wis`/`cha` · `savingThrows`, `skills` ·
`damageVulnerabilities`, `damageResistances`, `damageImmunities`, `conditionImmunities` ·
`senses`, `languages` · `cr`, `xp` · markdown-blokken `traits`, `actions`, `reactions`,
`legendaryActions`.

### Kennis-laag (drie-traps) — veld → niveau

| Veld | `naam` | `deels` | `volledig` |
|---|:--:|:--:|:--:|
| `name` + `imageId` (portret) | ✓ | ✓ | ✓ |
| `size` · `type` · `alignment` (subtitel) | ✓ | ✓ | ✓ |
| HP als **relatieve balk** (gewond/gezond, géén getal) | ✓ | ✓ | ✓ |
| `ac` | — | ✓ | ✓ |
| exacte `maxHp` + `hp`-formule | — | ✓ | ✓ |
| `speed` | — | ✓ | ✓ |
| ability scores (STR…CHA) | — | ✓ | ✓ |
| `savingThrows` · `skills` | — | ✓ | ✓ |
| `damageVulnerabilities`/`Resistances`/`Immunities` · `conditionImmunities` | — | ✓ | ✓ |
| `senses` · `languages` | — | ✓ | ✓ |
| `traits` | — | — | ✓ |
| `actions` · `reactions` · `legendaryActions` | — | — | ✓ |
| `cr` · `xp` | — | — | ✓ |
| `backdropId` als kaart-achtergrond | — | — | ✓ |
| `chapter` · `initiative` | **nooit** (DM-only) | | |

Kort gezegd: **naam** = "wat is het + hoe gewond" (observeerbaar); **deels** = verdediging & stats
(je weet hoe taai het is); **volledig** = het complete repertoire (traits/actions) + CR. Vergrendelde
secties tonen `icon('lock')` met een "Nog niet onderzocht"-placeholder.

### Geruchten (roddel) — losse sectie, via de Herberg
> **Beslissing:** monsters krijgen alleen een **roddel** (géén "geheim" — dat voelt geforceerd);
> ontgrendeld via de **Herberg**; getoond in een **aparte sectie** op de kaart, los van de
> statblock-tiers. (Diepere monster-kennis ⇒ zie de geparkeerde dienst "Magizoöloog" onderaan.)

- **Nieuw monsterveld** `roddel` (string, of array van meerdere geruchten) in `monsters.json`.
  Spiegelt exact de bestaande entity-conventie `data.flavour` + `flavourUitgesproken`.
- **Koppeling Herberg**: breid `POST /herberg/vraag` (~5059) uit zodat de zoektocht naast
  `personages`/`locaties` (~5090) ook `monsters.json` doorzoekt. Bij een monster met `roddel`:
  de roddel onthullen en **per groep** als gehoord markeren in dm-state
  (`groups[gid].bestiariumRoddels[monsterId] = true`); zet het monster meteen op minstens
  `naam`-niveau zodat het in het Bestiarium verschijnt. Cooldown/max-vragen blijven gelden.
- **Weergave**: aparte sectie "Geruchten" (`icon('message-circle')`) op de Bestiarium-kaart,
  zichtbaar zodra gehoord — onafhankelijk van naam/deels/volledig. Nog niet gehoord ⇒ subtiele hint
  "Vraag ernaar in de Herberg".
- `GET /bestiarium` neemt de gehoorde roddels per groep mee; `GET /herberg` mag monsters met `roddel`
  als kiesbaar onderwerp aanbieden (thematisch: tavernepraat over beesten).

**Beslissing (Herberg-onderwerpen):** een monster is pas kiesbaar als Herberg-onderwerp zodra het
voor de groep op **minstens `naam`-niveau** bekend is (dus al in combat tegengekomen). Voorkomt
spoilers over monsters die de party nog nooit zag. `GET /herberg` filtert de monster-onderwerpen dus
op `bestiarium[monsterId] >= 'naam'` voor de groep; `POST /herberg/vraag` weigert een monster dat nog
onbekend is (404, net als bij ontbrekende roddel).

### Datamodel (`dm-state.json`, per groep — net als visibility)
```json
"bestiarium": { "<monsterId>": "naam" | "deels" | "volledig" }
```
Ontbrekend = onbekend. Per groep, dus opgeslagen onder `groups[gid].bestiarium`.

### Server (`routes/api.js`)
- **Auto-onthulling bij combat**: in `POST /combat/start` (~3527) — bepaal de groep(en) van de
  speler-combatants (`combatants.filter(c=>c.entityId)` → `_groupForPlayer`); zet voor elke
  monster-combatant `bestiarium[monsterId] = max(huidig, 'naam')` in **alleen die groep(en)**.
  emit `bestiarium:updated`.
- **DM verdiept**: `PUT /bestiarium/:monsterId` (`requireDM`) `{ niveau, groep? }` → opslaan in
  (actieve of meegegeven) groep + emit `bestiarium:updated`. Knop in de Monsterbibliotheek én bij een
  monster-combatant in combat ("Onthul aan party: Naam / Deels / Volledig").
- **Speler-endpoint** `GET /bestiarium` (`attachRole`): groep van de speler bepalen, monsters met
  kennis ≥ `naam` teruggeven, en **server-side de velden wegfilteren** die boven het kennisniveau
  liggen (zoals de `vague`-entity-logica ~148). Nooit verborgen statwaarden naar de client sturen.

### Frontend
- **Nieuw tabblad**: registreer "Bestiarium" in de Archief-dropdown (`index.html` ~87–94) +
  `switchSection`/`refreshSection` in `app.js`. Nieuw bestand `public/js/render-bestiarium.js`
  (import met `?v=N`, registreren in `app.js` + CLAUDE.md versietabel).
- Render: grid van monster-kaartjes; per kaart het juiste kennisniveau via `renderStatblock`.
  Vergrendelde delen tonen `icon('lock')` / silhouet.
- **DM**: kennisniveau-selector (Onbekend / Naam / Deels / Volledig) in de Monsterbibliotheek en in
  combat.
- Realtime: `socket-client.js` → `bestiarium:updated` → her-render als de sectie open is.

### Aandachtspunten
- Velden écht server-side wegfilteren (anti-cheat).
- Backward-compat: geen `bestiarium` in een groep = alles onbekend.
- Eén render-helper delen tussen DM en speler — dat is de kern van "geen dubbel werk".
- Auto-onthulling alleen voor groepen die daadwerkelijk in het gevecht zitten.
- **Auto-onthulling werkt alleen voor combatants met een `presetId`** (gekoppeld aan een
  bibliotheek-monster). Combatants met een inline-`statblock` zonder preset (`_showStatblockForCombatant`,
  dm-panel.js ~1750) staan niet in `monsters.json` en verschijnen dus niet in het Bestiarium — of we
  promoveren zo'n inline-monster eerst naar de bibliotheek.
- `imageId` ontbreekt vaak → val terug op een silhouet/`icon('skull')`-placeholder op `naam`-niveau.

### Open keuze (later)
- Moet "deels" ook automatisch komen na X rondes vechten, of altijd handmatig? (Nu: handmatig.)

---

## 4. Login / onthaal-scherm — GEPARKEERD

> **Beslissing:** voorlopig niet bouwen; de keuze voor het achtergrondbeeld
> ("welk bestaand beeld?") is nog open. Hieronder de aanpak voor als we het oppakken.

### Aanpak (`public/index.html` + `theme.css`)
Onthaal-laag boven de bestaande login-overlays (`#login-overlay` ~277 e.a.), getoond zolang niemand
is ingelogd: perkament-achtergrond + vignet, grote campagne-titel (Cinzel) + ondertitel uit
`meta.json`, één centrale "Betreed"-knop naar speler-/DM-login. Geen nieuwe serverlogica nodig.

### Nog te beslissen
- **Welk bestaand beeld** als achtergrond: wereldkaart, één door de DM aangewezen beeld, of een
  wisselend reeds onthuld locatie-/sfeerbeeld. (Hier zijn we voor nu "even gaan zitten".)

---

## 5. Ontdekkings-teller (revealed kaartjes)

> **Beslissingen:** toon **X / Y met voortgangsbalk**; **één teller** (alles wat niet meer `hidden`
> is telt als ontdekt — `vague` + `visible` samen).

### Wat & waarom
Gamified verzamel-/ontdekkingsvoortgang voor spelers: *"Personages 23/40 ontdekt"* per
archiefcategorie, met een dunne perkament-voortgangsbalk. Maakt zichtbaar hoeveel van de wereld de
party al heeft blootgelegd.

### Datamodel
Geen nieuwe opslag — afgeleid uit bestaande `dmState.groups[gid].visibility`.
- **Ontdekt** = entities met `visibility[id]` ∈ {`vague`, `visible`}.
- **Totaal** = alle niet-getrashte entities van dat type.

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
Per type tellen; `ontdekt` = aantal in {vague, visible}, `totaal` = aantal niet-getrashte entities.

### Frontend
- **Plek**: bovenaan de **Party-subtab**, als rij perkament-meters. Per categorie: `icon(...)` +
  label + `X / Y` + dunne voortgangsbalk (CSS, themavast).
- Laden in de Party-render via nieuwe wrapper `ontdekkingen()` in `public/js/api.js`.
- Realtime: luister op `entity:visibility` / `entity:updated` → meters verversen.

### Aandachtspunten
- Alleen voor spelers tonen (niet de DM — die ziet alles).
- Categorie met 0 entities → meter verbergen (geen "0/0").
- Geen DM-schakelaar nodig: X/Y is bewust gekozen (totalen mogen zichtbaar zijn).

---

## Niet gekozen (parkeren voor later)
Uit de brainstorm wél geopperd maar nu niet uitgewerkt: **De Meester vraagt een worp**
(groepsworp), **Almanak & Wereldklok**, **Downtime-activiteiten**, **De Kroniek (mijlpalen)**,
**Attunement & magische voorwerpen**. Pitches staan in de chatgeschiedenis; bij interesse hier
later een plan aan toevoegen.

### Nieuwe dienst: "De Magizoöloog" (idee, parkeren)
Een nieuwe dienst — een magizoöloog/beestenkenner (à la Newt Scamander) die spelers kunnen inhuren om
een monster diepgaand te **onderzoeken**, als tegenhanger van de Gock (die personen onderzoekt).
Sluit aan op het Bestiarium: waar de Herberg slechts een **roddel** geeft, levert de Magizoöloog
*echte kennis* — bv. het automatisch verhogen van het kennisniveau (`naam → deels` of `deels →
volledig`) of een uniek "veldnotitie"-stukje per monster (een nieuw veld `veldnotitie`/`observatie`).
Mechanisch te bouwen als kopie van de Gock-flow (betaal + wacht + rapport via `gock:rapport-klaar`-
achtig event), maar met `monsters.json` als doelwit i.p.v. entities. Past in de Diensten-dropdown
naast Herberg/Tweespalt/Gock/Ursula/Tempel/Heeren (`_DIENSTEN_NAMEN`, api.js ~3895).
**Volgorde:** pas oppakken nadat het Bestiarium zelf staat.
