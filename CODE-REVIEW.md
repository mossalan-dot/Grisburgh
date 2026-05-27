# Code review — laatste 5 commits

**Scope:** unified diff van `HEAD~5..HEAD` (~458 regels), plus context rondom geraakte
functies. Bestanden in scope: `public/css/theme.css`, `public/index.html`,
`public/js/app.js`, `routes/api.js`, `routes/auth.js`.

**Niet in scope:** de rest van de codebase (`dm-panel.js`, `combat-canvas.js`,
`render-*.js`, `lib/snapshot.js`, tests, etc.). Daar is geen uitspraak over gedaan.

**Commits in scope:**
- `5216b51` Fix: zoom speelt video af voor alle karakters
- `deadcc4` Fix: spelers zien altijd hun eigen groep in item-ownership
- `474c224` Landingspagina: video speelt alleen na wachtwoord
- `33cee52` Landingspagina: video-portret ondersteuning voor Madelief
- `34f6967` Boedelinventaris: visuele verbeteringen & bugfixes ronde 3

---

## 🔴 Bugs

### 1. `_landingStartZoom` negeert de `hasVideo`-parameter

**Locatie:** `public/js/app.js:746-842`

De parameter `hasVideo` wordt door vier functies heen doorgegeven
(`_landingPortraitClick` → `_landingShowPasswordPrompt` → `_landingSubmitPassword`
→ `_landingStartZoom`), maar wordt nergens in de body van `_landingStartZoom`
gebruikt. Het `<video>`-element op regel 779-781 wordt **altijd** aangemaakt,
ook voor karakters zónder portretvideo.

**Gevolg:** voor elk karakter zonder video doet de browser een mislukte GET
naar `/api/files/{charId}_video` (waarschijnlijk 404), wacht vervolgens 800ms
op de `error`-fallback (regel 838-841). Dat is precies de delay die niet nodig
zou zijn als de parameter wél gebruikt werd.

**Fix-richting:** gebruik `hasVideo` als guard rond regel 779-781. Bij
`!hasVideo` sla je het `<video>`-element over en de bestaande `if (!vid)`-tak
op regel 833 (`setTimeout(resolve, 1000)`) handelt het netjes af.

```js
${hasVideo ? `<video id="landing-zoom-video" class="landing-zoom-video" autoplay muted playsinline>
  <source src="/api/files/${esc(charId)}_video" type="video/mp4">
</video>` : ''}
```

---

### 2. "+ notitie"-knop zichtbaar voor DM maar opslaan faalt stil

**Locatie:** `public/js/app.js:3445` (toon-conditie) en `:3362` (silent return)

De wijziging
```js
addTrigger.style.display = (state.characterId || state.role === 'dm') ? '' : 'none';
```
toont de knop nu ook voor de DM. Maar `_invSaveNote()` doet:
```js
const charId = state.characterId;
if (!charId) return;          // <-- DM heeft geen characterId
```

**Gevolg:** DM klikt knop, vult titel + tekst in, drukt op "Voeg toe",
**er gebeurt niets, geen foutmelding**. Stille UX-bug.

**Fix-richting (kies één):**
- Houd de knop verborgen voor DM (rol de wijziging terug op regel 3445).
- Of: geef `_invSaveNote` een DM-pad dat bv. een groep-brede notitie maakt.
- Of minimaal: toon een toast/alert "DM kan geen persoonlijke notities aanmaken".

---

### 3. Speler zonder groep ziet items van de DM's actieve groep

**Locatie:** `routes/api.js:1103-1105`

```js
const charId = req.session?.characterId;
const playerGroupId = charId ? _playerGroupId(dmState, charId) : null;
const g = playerGroupId ? getGroup(dmState, playerGroupId) : getGroup(dmState);
```

Wanneer een ingelogde speler géén `data.groep` heeft (of de groep bestaat niet
meer in `dmState.groups`), valt `playerGroupId` op `null` en wordt
`getGroup(dmState)` = de **actieve DM-groep** gebruikt. Dat is precies de
bug die commit `deadcc4` zegt te fixen.

Voor spelers-met-groep is dit opgelost; voor spelers-zonder-groep niet.

**Fix-richting:** als de speler geen geldige groep heeft, geef dan een lege
owners-set terug in plaats van te leunen op de DM-selectie. Of zorg dat
spelers nooit zonder geldige groep kunnen zijn (validatie op `entities.json`).

---

## 🟡 Cleanup & efficiency

### 4. Dode CSS-regels voor verwijderde markup

**Locatie:** `public/css/theme.css:15551`, `:15626`, `:15964-15966`

`.inv-lh-type`, `.inv-row-type`, `.inv-beurs-coin`, `.inv-beurs-gold`,
`.inv-beurs-silver`, `.inv-beurs-copper` zijn nu allemaal `display: none`,
maar de elementen worden door `_invRender` niet meer in de DOM gezet
(zie diff in `app.js:3225` en `:3445`).

**Actie:** verwijder de selectors compleet — maskeert ruis bij grepjes.

---

### 5. `_playerGroupId` doet disk-I/O per `/items/ownership`-call

**Locatie:** `routes/api.js:127-134`

```js
function _playerGroupId(dmState, characterId) {
  if (!characterId) return null;
  const entities = storage.readJSON('entities.json');   // <-- disk read per call
  const char = (entities.personages || []).find(e => e.id === characterId);
  ...
}
```

Bij meerdere spelers die polling doen wordt `entities.json` meermaals per
seconde gelezen voor één veld (`data.groep`).

**Fix-richting:**
- Cache `entities.json` met dirty-flag, of
- Schrijf de speler-groep mee in `req.session` bij login (in `/player-login`),
  dan helemaal geen lookup nodig.

---

### 6. `hasVideo`-plumbing door 4 functies is dode code

**Locatie:** `public/js/app.js:678, 693, 712, 720, 729, 746`

Gerelateerd aan bug #1. Als je #1 oplost door de guard in `_landingStartZoom`
te gebruiken, is de plumbing nuttig. Los je het anders op (of laat je bewust
altijd-video), schrap dan de hele parameter-keten.

---

### 7. Rotatie-array kan korter

**Locatie:** `public/js/app.js:3475-3477`

```js
const rotSteps = [3.2, -2.1, 4.8, -3.7, 1.9, -4.4, 2.6, -1.5, 3.9, -2.8, 1.2, -4.1, 4.3, -0.9, 2.4];
const rot = rotSteps[seed % rotSteps.length];
```

Vrijwel identiek aan een formule als `((seed % 11) - 5) * 0.96`. Lees-overhead
voor lezers. Niet dringend.

---

## ℹ️ Notes (geen bug)

- **`/party` voor DM is OK** — regel 1761 in `routes/api.js` returnt vroeg met
  alle spelers; de nieuwe `if/else`-branch raakt DM niet. Geen regressie.
- **`data-portrait-video` mapping is correct** — `data-portrait-video` →
  `dataset.portraitVideo` (kebab→camel) klopt.
- **`12s timeout-cap` in `_landingStartZoom`** lekt theoretisch een `setTimeout`
  als zowel cap als `error` vuren, maar `Promise.resolve` is idempotent en
  gebruikersimpact is nul. Niet fixen.

---

## Volgorde van aanpakken (suggestie)

1. **#1** — meest zichtbare UX-bug (800ms vertraging op login)
2. **#2** — stille faal is verwarrend voor DM
3. **#3** — data-correctheid
4. **#4-#7** — in één opschoonronde meenemen
