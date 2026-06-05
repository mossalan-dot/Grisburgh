# Grisburgh — Diensten-gids

> Recept om een **nieuwe dienst** (zoals Herberg, Ursula, Gock…) toe te voegen, plus hoe zo'n
> tabblad eruit hoort te zien. Alle diensten delen één skelet; een nieuwe dienst is vooral
> "het patroon kopiëren en op de juiste plekken registreren". Regelnummers zijn richtinggevend
> (kunnen schuiven) — zoek op de genoemde symbolen.

De bestaande diensten: **herberg, tweespalt, gock, ursula, tempel, heeren** (+ `facties` is een
buitenbeentje). Gebruik **Gock** als simpelste template (config + dossier-flow).

---

## Bouwstappen (checklist)

Vervang overal `<dienst>` door de kleine sleutel, bv. `magizoo`.

### 1. Frontend — nav + sectie (`public/index.html`)
- **Dropdown-item** in `#diensten-menu`:
  ```html
  <button class="archief-menu-item" data-section="<dienst>" id="diensten-<dienst>-item">
    <svg class="icon" aria-hidden="true" focusable="false"><use href="/img/icons.svg?v=3#icon-XYZ"/></svg> Naam
  </button>
  ```
- **Sectie-container** bij de andere secties: `<div class="section" id="section-<dienst>"></div>`

### 2. Frontend — registreren (`public/js/app.js`)
Voeg `<dienst>` toe op **elke** plek waar de andere diensten staan:
- `DIENSTEN_SECTIONS` / `DIENST_SECTIES`-arrays (≈ r. 744, 7537) en de inline lijst in `switchSection`
  voor de diensten-nav-active toggle (≈ r. 214).
- `SECTION_COLORS` in `switchSection` (accenttint van de sectiebalk).
- `_updateDienstenMenu()` → de `KNOPPEN`-map (≈ r. 7568) — regelt zichtbaar/verborgen/vergrendeld.
- `_DIENST_AMB_LABELS` (≈ r. 252) — voor de diensten-sfeerloop (feature #2b).

### 3. Frontend — refreshSection-tak (`public/js/app.js`, ≈ r. 1948)
Kopieer een bestaand blok (toegang-guard zit er al in):
```js
else if (section === '<dienst>') {
  if (!window.app.isDM() && _getDienstToegang('<dienst>') === 'zichtbaar') {
    const _el = document.getElementById('section-<dienst>'); if (_el) _dienstNietBeschikbaar(_el, state.meta?.<dienst>?.naam || 'Naam');
  } else if (!window.app.isDM() && _getDienstToegang('<dienst>') === 'verborgen') {
    const _el = document.getElementById('section-<dienst>'); if (_el) _el.innerHTML = '';
  } else await render<Dienst>();
}
```

### 4. Frontend — renderfunctie (`public/js/app.js`)
`async function render<Dienst>()` — hergebruik het **gedeelde skelet** (zie "Hoe het eruit hoort te
zien"). Begin met de `meta.buitenGrisburgh`-guard (`_dienstNietBereikbaar`), toon een laad-state,
haal data via `api.get<Dienst>()`, render dan portret + backdrop + groet + inhoud.

### 5. Frontend — API-wrapper (`public/js/api.js`)
```js
get<Dienst>:  ()      => request('/<dienst>'),
<dienst>Actie: (body) => request('/<dienst>/actie', { method: 'POST', body: JSON.stringify(body) }),
```

### 6. Server (`routes/api.js`)
- `GET /<dienst>` (`attachRole`) → geeft `config` (uit `meta.<dienst>`) + de groep-specifieke staat terug.
- Actie-endpoints (`POST /<dienst>/...`) met de gebruikelijke guards.
- `PUT /meta/<dienst>` (`requireDM`) met een `allowed`-veldenlijst, bv.
  `['naam','imageId','backdropId','groet','prijs', …]` (kopieer van `PUT /meta/gock`, ≈ r. 4442).
- **Voeg `<dienst>` toe aan `_DIENSTEN_NAMEN`** (≈ r. 4079). Dat activeert automatisch de
  toegang-per-groep (zie hieronder) — niets extra's nodig.

### 7. Toegang per groep (gratis na stap 6)
`_getDienstToegang(dmState, '<dienst>', groupId)` → `'beschikbaar' | 'zichtbaar' | 'verborgen'`
(opgeslagen onder `groups[gid].dienstenToegang[<dienst>]`). De DM zet dit in de **Toegang**-subtab.
- `beschikbaar` = normaal te gebruiken · `zichtbaar` = in de lijst maar vergrendeld ·
  `verborgen` = onzichtbaar voor de speler.

### 8. DM-config-paneel (`public/js/dm-panel.js`)
Voeg een config-blok toe in `_renderDiensten` (≈ r. 483) — naam, portret + backdrop (kies een
entity-afbeelding óf upload), in-character groet, prijzen, en de inhoudspool. Opslaan via
`PUT /meta/<dienst>`. Registreer de subtab-key in `_DIENSTEN_TABS`.

### 9. Diensten-sfeerloop (feature #2b)
Voeg de dienst-key toe aan: `_DIENST_KEYS` (api.js, bij `_ensureAmbiance`), `_DIENSTEN` (dm-panel,
Geluiden-tab → "Diensten-sfeerloops") en `_DIENST_AMB_LABELS` (app.js). Dan krijgt de dienst
automatisch een lokale sfeerloop-slot.

### 10. CSS-tint (`public/css/theme.css`)
Hergebruik het skelet (zie hieronder) en voeg alleen een **tint-overlay** per dienst toe:
```css
.<dienst>-scene.herberg-scene[style]::before { background: rgba(R,G,B,0.40); }
```

---

## Hoe het eruit hoort te zien (gedeeld skelet)

Alle diensten gebruiken dezelfde bouwstenen — niet opnieuw uitvinden:

| Bouwsteen | Klasse | Inhoud |
|---|---|---|
| Scène-wrapper | `.herberg-scene` (+ `.<dienst>-scene` voor de tint) | volledige achtergrond = `config.backdropId` (`background-size:cover`, `center top`) met donkere tint-overlay |
| Leespaneel | `.herberg-content` | het leesbare blok over de backdrop |
| Portret | `.herberg-portrait-round` | rond getoond, `config.imageId`; fallback `icon(...)` |
| Groet (in-character) | `.herberg-groet` | cursief, **IM Fell English** — de uitbater begroet de speler |
| Beurs + vooruitbetaling | `.ts-beurs` | currency-weergave |
| Zoek/kies-lijst | `.herberg-zoek-wrap` / `.herberg-lijst` / `.herberg-item` | de keuzelijst (personen/monsters/onderwerpen) |
| Resultaat-/dossierblok | bv. `gock-dossier` | het rapport/resultaat na de actie |

**Thema-afspraken** (zie ook `CLAUDE.md` + `ART-GIDS.md`):
- **Taal NL**, D&D-termen Engels. Iconen via `icon()`, **nooit emoji** in gerenderde HTML.
- Fonts: Cinzel (koppen), Crimson Text (broodtekst), IM Fell English (cursieve groet/notitie).
- Art: portret **1:1** (rond), backdrop **16:10** met focuspunt boven-midden en donkere onderkant
  (de tint + het leespaneel zorgen voor leesbaarheid). Prompts staan in `ART-GIDS.md`.
- Per-dienst accenttint (Ursula paars, Gock blauw-zwart, Heeren nachtblauw, Tempel goud,
  Tweespalt donker, Magizoöloog green-wax `#2a6a3a`).

**Niet-beschikbaar-states** (al voorhanden, hergebruiken):
- `_dienstNietBereikbaar(el, naam)` — groep buiten Grisburgh (`meta.buitenGrisburgh`).
- `_dienstNietBeschikbaar(el, naam)` — DM heeft de dienst op `zichtbaar` (vergrendeld) gezet.

---

## Snelste route
Kopieer **Gock** end-to-end (`renderGock`, `GET /gock`, `PUT /meta/gock`, het Gock-config-blok in
`_renderDiensten`), hernoem, en loop daarna de checklist hierboven na om alle registratie-plekken
te raken. De `FEATURE-PLANNEN.md` beschrijft "De Magizoöloog" als concreet voorbeeld van een
nieuwe dienst gebouwd op dit patroon.
