# Grisburgh — Art-gids & generator-prompts

> App-brede inventaris van alle art-oppervlakken + een gedeelde stijl-prompt zodat álles dezelfde
> perkament-look krijgt. Begeleidt `FEATURE-PLANNEN.md` (diensten/Bestiarium/brieven).

## Technische regels (gelden overal)
- Afbeeldingen worden bij het serveren naar **600px-brede WebP** verkleind (origineel tot 1200px).
  **Genereer op ~1024–1536px** en lever aan als JPG/PNG/WebP; groter heeft geen zin.
- **Iconen, logo's en zegels: bij voorkeur SVG** (gaan ongewijzigd door, haarscherp, in CSS te
  tinten) of **transparante PNG** (~512px). Conditions/classes staan nu als PNG in `/img/...`.
- Portretten: vierkant **1:1** (rond getoond). Backdrops: liggend **16:10**, focuspunt boven-midden,
  onderkant mag donker (tint + leespaneel eroverheen).
- **Geen tekst/letters in de afbeelding** (behalve bewust bij het app-wordmark).

## Kleurwereld (uit `theme.css`)
Oker `#c4a87a` · crème `#f2e8d2` · diep sepia-bruin `#2a1a08`. Accenttints per thema: Ursula paars,
Gock blauw-zwart, Heeren nachtblauw, Tempel goud, Tweespalt donker, **Magizoöloog green-wax `#2a6a3a`**.

---

## 1. Complete art-inventaris (hele app)

Legenda: **App-breed** = gedeeld systeem-art · **Per-campagne** = DM uploadt content.
Status: ✅ bestaat · 🔄 bestaat, herziening optioneel · ⬜ nieuw/ontbreekt.

| Asset | Scope | Aantal | Status | Verhouding |
|---|---|---|---|---|
| **Class-icons** (Barbarian…Wizard) | App-breed | 12 | 🔄 | 1:1, transparant |
| **Species/race-icons** (Human, Elf, Dwarf, Halfling, Dragonborn, Gnome, Orc, Tiefling, Goliath, Aasimar, Aarakocra, Tabaxi, Half-Elf) | App-breed | 13 | ⬜ | 1:1, transparant |
| **Condition-icons** (blinded…burning) | App-breed | 18 | 🔄 | 1:1, transparant |
| **UI-icon sprite** (`icons.svg`, lucide) | App-breed | ~70 | ✅ | SVG |
| **App-logo / wordmark "Grisburgh"** | App-breed | 1 | ⬜ | vrij / liggend |
| **Favicon + apple-touch-icon** | App-breed | 1–2 | ⬜ | 1:1 (32/180/512px) |
| **Onthaal/landing-achtergrond** | App-breed | 1 | ⬜ | 16:9 |
| **Default fallback-silhouetten** (monster, dienst-portret, entity-portret) | App-breed | 3 | ⬜ | 1:1, transparant |
| **Default dienst-backdrop** (`herberg-bg`) | App-breed | 1 | ✅ | 16:10 |
| **Dienst-portret** (Herberg, Tweespalt, Gock, Ursula, Tempel, Heeren, Magizoöloog) | Per-campagne | 7 | ⬜/deels | 1:1 |
| **Dienst-backdrop** (idem) | Per-campagne | 7 | ⬜/deels | 16:10 |
| **Tempel: god-portret + priester-portret + backdrop** | Per-campagne | 3 per god | ⬜ | 1:1 + 16:10 |
| **Brief-logo / embleem** per dienst | Per-campagne | ~7 | ⬜ | 1:1, transparant (SVG) |
| **Brief-zegel (wax seal)** per dienst | Per-campagne | ~7 | ⬜ | rond, transparant |
| **Monster-portret** (Bestiarium/combat) | Per-campagne | n | ⬜ | 1:1 |
| **Monster-backdrop** (boss) | Per-campagne | enkele | ⬜ | 16:10 |
| **Entity-beelden** (personages/locaties/organisaties/voorwerpen) | Per-campagne | n | ✅ | vrij |
| **Spell-beelden** | Per-campagne | n | ✅ | vrij |
| **Encounter-backdrops** | Per-campagne | n | ✅ | 16:10 |
| **Dungeon-kamerbeelden / wereldkaart** | Per-campagne | n | ✅ | vrij |

**Prioriteit als je nú art laat maken:**
1. App-identiteit: **wordmark + favicon** (ontbreekt volledig; grootste merkwinst).
2. **Magizoöloog** portret + backdrop + brief-logo + zegel (nieuwe dienst).
3. **Brief-logo's + zegels** voor de bestaande diensten (Ursula/Gock/Tweespalt/Heeren).
4. **Monster-portretten** voor het Bestiarium (sfeerwinst per gevecht).
5. Optioneel: **species-icons** (13) + herziene class/condition-icons in één stijl.

---

## 2. Gedeelde stijl (de "master prompt")

> Prompts staan bewust in het **Engels** (beeldgeneratoren presteren daar beter op). Begin élke
> illustratie-prompt met dit **STYLE**-blok, en élke icoon/zegel-prompt met het bijbehorende basisblok.

**STYLE (illustraties — portretten, backdrops, monsters):**
```
hand-painted fantasy illustration, weathered medieval illuminated-manuscript aesthetic,
warm parchment palette of ochre, cream and deep sepia-brown, painterly oil texture with fine
aged-paper grain, soft warm candlelit lighting, muted earthy tones, atmospheric, high detail,
no text, no lettering, no watermark, no modern objects, no UI, no border
```

**ICON-BASE (class-, species-, condition-, brief-logo's):**
```
single emblematic icon, medieval woodcut and pen-and-ink engraving style, monochrome sepia ink,
fully transparent background, flat, centered, bold clear silhouette, high contrast,
no text, no frame, no background, no color gradient
```

**SEAL-BASE (wassen zegels):**
```
top-down render of a round pressed wax seal, rich {KLEUR} sealing wax with soft natural shadow,
embossed relief of {EMBLEEM}, slightly irregular organic edge, transparent background,
photorealistic wax texture, no text
```

**Universele NEGATIVE prompt** (waar de generator dat ondersteunt):
```
text, letters, signature, watermark, modern clothing, technology, frame, ui, low quality, blurry,
extra limbs, deformed
```

**Consistentie-tips:** gebruik dezelfde generator + (indien mogelijk) dezelfde **seed/stijl-referentie**
voor een hele categorie; genereer een categorie in één sessie; houd dezelfde belichting/achtergrond
per type aan.

---

## 3. Per-asset prompt-sjablonen

### Dienst-portret (1:1)
`STYLE` + :
```
head-and-chest portrait of {PERSONAGE}, centered, facing the viewer, dark vignette background,
composed for a circular crop, medieval fantasy character
```
**Voorbeeld — Magizoöloog:**
```
head-and-chest portrait of a weathered beast-scholar in worn leather field gear, a brass-rimmed
monocle and a small glowing specimen vial at the belt, kind sharp eyes, faint moss-green accents,
centered, facing the viewer, dark vignette background, composed for a circular crop
```

### Dienst-backdrop (16:10)
`STYLE` + :
```
wide atmospheric interior of {PLEK}, dim and moody, candor lantern light, focal interest in the
upper-center, lower third darker and emptier for an overlay, no characters in focus
```
**Voorbeeld — Magizoöloog:**
```
wide atmospheric interior of a naturalist's study filled with mounted beasts, jars of specimens,
hanging skeletons and field sketches, dim lantern light, moss-green undertone, focal interest upper-
center, lower third darker for overlay, no characters
```

### Monster-portret (1:1) / boss-backdrop (16:10)
`STYLE` + :
```
menacing portrait of a {MONSTER}, head and shoulders, dramatic rim light, dark background,
fantasy bestiary plate
```

### Species-icon / class-icon (1:1, transparant)
`ICON-BASE` + :
```
emblem representing {SOORT/KLASSE} ({KENMERKEND SYMBOOL, bv. "a dwarf: bearded helm and hammer"})
```

### Condition-icon (1:1, transparant)
`ICON-BASE` + :
```
emblem representing the condition "{CONDITION}" ({VISUEEL, bv. "Poisoned: a dripping skull-vial"})
```

### Brief-logo / embleem (1:1, transparant, liefst SVG)
`ICON-BASE` + :
```
heraldic emblem for {DIENST} ({MOTIEF, bv. "Ursula: an eye within a crescent moon and stars"})
```

### Brief-zegel / wax seal (rond, transparant)
`SEAL-BASE` met `{KLEUR}` = thema-tint en `{EMBLEEM}` = het dienst-motief.
**Voorbeeld — Magizoöloog:**
```
top-down render of a round pressed wax seal, rich moss-green sealing wax with soft natural shadow,
embossed relief of a stylized paw-print over an open book, irregular organic edge, transparent
background, photorealistic wax texture, no text
```

### App-wordmark "Grisburgh" (liggend) — uitzondering: mét tekst
```
ornate medieval wordmark reading "Grisburgh", hand-lettered blackletter/Cinzel-style capitals,
embossed gold-leaf on dark parchment, illuminated-manuscript flourish, centered, transparent or
dark background, no extra text
```

### Favicon / app-icon (1:1)
`ICON-BASE` + :
```
a single iconic emblem for the town of Grisburgh ({MOTIEF, bv. "a castle gate over an open ledger"}),
strong silhouette readable at 32px, sepia-on-parchment, app icon
```

### Onthaal/landing-achtergrond (16:9)
`STYLE` + :
```
sweeping establishing view of {CAMPAGNE-PLAATS}, golden-hour light, romantic and inviting, wide empty
sky/space in the upper area for a title, painterly
```

---

## 4. Werkwijze
1. Kies de categorie en het bijbehorende basisblok (STYLE / ICON-BASE / SEAL-BASE).
2. Vul de `{PLACEHOLDERS}` in; plak de NEGATIVE-prompt erachter.
3. Genereer de hele categorie in één sessie voor stijl-consistentie.
4. Exporteer op ~1024–1536px (illustraties) of als transparante SVG/PNG (iconen/zegels).
5. Upload via de DM-config (`imageId`/`backdropId` per dienst/monster; voor brieven straks
   `logoId`/`zegelId` — zie `FEATURE-PLANNEN.md`). App-brede assets (icons/classes/species/logo/
   favicon) komen in `public/img/...` en vereisen een versie-bump.
