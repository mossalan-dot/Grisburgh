# Stijlen per campagne

Werkdocument, 1 oktober 2026, **bijgewerkt 6 november 2026** met een nieuwe
meting en de keuzes van de DM (zie *Besloten* hieronder). **Nog niets
gebouwd.** Afgesproken: dit wordt gebouwd en uitgerold als **één eigen ronde,
pas als al het andere werk live staat** — de opruimronde raakt bijna elk
bestand en mag niet tegelijk lopen met ander werk.

## Besloten (6 nov 2026)

1. **Waarvoor:** voor andere DM's die een andere sfeer willen — een sci-fi- of
   noircampagne. Grisburgh zelf blijft perkament.
2. **Hoe breed:** breed. Kleur, lettertypes, hoeken, oppervlakken, iconen
   (een ganzenveer bij sci-fi is gek) en de effecten op het tafelscherm.
3. **Geen wissel binnen een campagne.** Geen licht/donker-schakelaar, geen
   dag/avond. Een thema is één vaste look.
4. **De DM kiest**, per campagne (Instellingen → Campagne, en een stap in de
   wizard). Spelers kiezen niets.
5. **Het tafelscherm volgt het thema van de campagne**, geen eigen keuze.
6. **`hp` verdwijnt.** Niet in gebruik en niet mooi genoeg om te bewaren.
   Campagnes die `theme: 'hp'` dragen gaan naar het standaardthema. Let op:
   `skillSet: 'hp'` en `spellSource: 'hp'` (de vaardigheden en spreuken van
   Wands & Wizards) zijn **inhoud, geen stijl**, en blijven bestaan. De
   onderdelen waar het hp-thema iets eigens deed dat niet gewoon kleur is
   (volgens de DM de klasse-typen en de statblokken) bekijken we bij het
   schrappen apart, voordat de regels weggaan.
7. **Geen eigen kleuren** door de DM: alleen uit vaste thema's kiezen.
8. **De opruimronde mag de huidige look minimaal verschuiven.** Bij twijfel
   een voor-en-na van de grootste wijzigingen aan de DM laten zien vóór het
   doorgaat.
9. **Het printbare blad en de HTML-export volgen het thema.**
10. **Woorden:** *akte* en *hoofdstuk* blijven overal. De rest gaat langs
    (zie *Woorden* hieronder).
11. **Tempo:** een eigen ronde waarin verder niets gebouwd wordt, en pas als
    alle andere wijzigingen live staan.

## Meting 6 nov 2026

| | 1 okt | 6 nov |
|---|---|---|
| regels `theme.css` | 28.651 | 32.672 |
| harde hex (uniek) | 3.180 (995) | 4.056 (1.161) |
| harde `rgb()`/`rgba()` | 3.919 | 4.324 |
| `var(--…)` | 609 | 756 |
| variabelen | 31 | 31 |
| `font-family` | — | 1.360 (Cinzel 772, Crimson 346, IM Fell 212) |
| `border-radius` | — | 1.131 |
| `box-shadow` | — | 451 |
| gradiënten | 419 | 518 (345 linear, 173 radial) |
| `[data-theme="hp"]`-regels | 120 | 116 |

**De kloof groeit**: alles wat sinds oktober gebouwd is kwam met harde kleuren.
Vandaar dat de bewaking (stap 6 hieronder) geen bijzaak is.

**Buiten `theme.css`, en die stonden niet in de eerste meting:**

- **De Tailwind-config in `index.html`** herhaalt het palet (`room`, `ink`,
  `gold`, `seal`, `blue-ink`, `green-wax`, `purple-codex`, `parchment`) en
  vier lettertypes. Die klassen worden **540 keer** gebruikt
  (`text-ink-bright`, `bg-room-…`) en `font-cinzel` enz. 132 keer. Dat is een
  tweede bron van waarheid; die config moet naar de variabelen gaan wijzen
  (`ink: { bright: 'var(--inkt)' }`), niet hun waarden herhalen.
- **Inline `style=""` in de JS**: dm-panel.js 379, app.js 146,
  render-archief.js 78, render-campagne.js 58 — een deel zet een kleur.
- **Kleur in JS-code**: app.js 153, combat-canvas.js 138 (het canvas tekent
  zelf; daar komt geen CSS aan), klassekracht.js 48, render-relatiemap.js 42
  (Cytoscape), render-spreuken.js en render-vaardigheden.js 31 elk,
  conditions.js 20 (conditiekleuren), render-dungeon.js 23.
- **`lib/character-sheet.js`**: 83 eigen kleuren — en dat blad gaat het thema
  volgen (besluit 9), dus die horen bij de ronde.
- **`lib/display-fx.js`**: 15 kleuren in de effectcatalogus.
- **Twee polariteiten in één thema.** Het grootste deel is donkere inkt op
  licht perkament, maar 148 plekken zijn een donker vlak (dienstpanelen op
  0,76, overlays, tafelscherm, de cinematics). Een thema levert dus altijd
  **beide** sets: tekst op licht en tekst op donker. Dat is geen wissel
  (besluit 3), het is dat ene thema op twee soorten ondergrond.

### De proef met het `hp`-thema (6 nov)

Aangezet op vijf schermen. Waar iemand een overschrijving schreef klopt het
(kop, detailvenster, spreukenraster); al het andere blijft perkament en wordt
onleesbaar: de archieftegel blijft licht, de sectiekop wordt groen op paars,
de partypil en de naamchip zijn donker op donker, de herberg-melding staat
kaal op de achtergrond. Precies wat je verwacht van overschrijvingen: **elke
nieuwe feature valt erbuiten**, want niemand schrijft er een hp-regel bij.
Schermafdrukken: `data/screenshots/t-*-hp.png` (lokaal, niet in git).

## Waarom dit er ligt

Er zijn nu twee thema's: het standaardthema en `hp` (Harry Potter), een restant
van één one-shot. Dat is geen keuze maar een toevalligheid. De denkrichting is
een echte reeks: **noir, sci-fi, steampunk, gothic horror, mythisch Grieks,
wildwest, post-apocalyptisch**.

De aanname in `docs/todo.md` was: *"een stijl is een blok CSS-variabelen — geen
tweede set componenten."* **Die aanname klopt vandaag niet.** Hieronder waarom,
en wat het wél kost.

## De meting van 1 oktober (achtergrond)

`public/css/theme.css`, 28.651 regels:

| | aantal |
|---|---|
| harde hex-kleuren | 3.180 |
| harde `rgb()` / `rgba()` | 3.919 |
| gebruik van `var(--…)` | 609 |
| bestaande variabelen | 31 |

Dus ruim **7.200 harde kleuren tegenover 609 variabelen**. En het `hp`-thema
werkt niet via variabelen maar door **120 losse selectors te overschrijven** —
precies de "tweede set componenten" die we zeiden niet te willen.

### Maar: 995 kleuren zijn 124 families

De 3.180 hex-vermeldingen gebruiken 995 unieke waarden. Geclusterd op
RGB-afstand (≤ 28) vallen die uiteen in **124 families**, en de verdeling is
scheef:

| | dekking |
|---|---|
| top-10 families | 62 % |
| top-20 families | 81 % |
| top-30 families | 88 % |
| top-50 families | 95 % |

De grootste families, met het aantal varianten waarin ze voorkomen:

```
#2a1a08    84 varianten   423×      donkerbruin (de ondergrond)
#8a7050    30 varianten   383×      inkt-middentint
#f2e8d2   100 varianten   264×      perkamentwit
#c4a87a    26 varianten   178×      lijnen en randen
#5a4030    28 varianten   156×      inkt-donker
#9a7008    24 varianten   154×      goud-dof
#b8860b    11 varianten   123×      goud
```

Dat is geen rijk palet. Dat is **dezelfde handvol kleuren die twee jaar lang
net iets anders is ingetikt**. Perkamentwit bestaat in honderd varianten omdat
niemand ooit opzocht welke het ook alweer was.

**Gevolg voor de omvang:** het is geen 995 beslissingen maar ongeveer dertig.
Een pass die de top-30 families naar een token trekt dekt 88 % van alle
kleurvermeldingen. De staart mag blijven staan — een eenmalige accentkleur in
één component hoeft geen token.

## Een thema is meer dan kleur

Dit is de kern van wat er mist in de oorspronkelijke aanname. Noir is niet
"grijs in plaats van bruin", en sci-fi is niet "blauw". Wat er nog meer aan
vastzit, met de huidige stand erbij:

### 1. Materiaal en textuur
Nu: **289 linear-gradients en 130 radial-gradients**, vrijwel allemaal hout,
perkament en leer. Precies twee texturen zijn procedureel; de rest is kleur.

Een metalen thema wil geborsteld staal (een fijne lijnenstructuur), een
sci-fi-thema een glad vlak met een gloed, noir een korrel. Dat zijn **vormen**,
geen kleuren — ze horen in een eigen laag, bijvoorbeeld als een `--oppervlak`
die per thema een andere `background-image` krijgt (procedureel, geen bestand,
zoals bij de dungeonstijlen van vandaag).

### 2. Randen en hoeken
Nu: `border-radius` in 6 px (168×), 4 px (136×), 8 px (104×), 5 px (86×)…
Zachte hoeken horen bij perkament. **Noir en sci-fi willen scherpe hoeken**
(0 px), steampunk wil klinknagels, gothic wil een punt. Dat betekent dat de
radius een token moet worden, en dat is een ander soort token dan een kleur:
een maat, met een paar sprongen (`--hoek-klein`, `--hoek-groot`).

### 3. Lettertypes
Nu: **Cinzel** (622×, de kapitalen), **Crimson Text** (271×, broodtekst),
**IM Fell English** (172×, het oude drukwerk), **Kalam** (31×, handschrift).
Dat zijn vier rollen, en elke stijl wil er andere lettertypes in: noir een
condensed schreefloze, sci-fi een technische. **Vier variabelen, meer niet** —
mits elke `font-family` via zo'n rol loopt in plaats van rechtstreeks. Nu doet
hij dat nergens.

### 4. Iconen
Nu: één sprite met **127 iconen** (`public/img/icons.svg`), overal via
`icon('naam')`. Een sci-fi-thema wil geen ganzenveer bij "schrijven" en geen
kerk bij "tempel".

Hier is de goedkope uitweg: **niet 127 iconen per thema hertekenen**, maar een
**afwijkingenlijst** per thema — tien tot twintig iconen die er echt naast
zitten, de rest blijft. De sprite kan meerdere varianten dragen (`#icon-church`
en `#icon-church--scifi`), en `icon()` kiest op het actieve thema. Dan kost een
thema tien iconen in plaats van honderdzevenentwintig.

### 5. Effecten en beweging
De tafelscherm-effecten (`lib/display-fx.js`, 1 okt 2026) dragen hun kleur al
in de catalogus. Maar een noir-thema wil geen gouden glinstering en een
sci-fi-thema geen vonken maar een scanline. Dat is **per effect één regel** in
de catalogus die per thema mag afwijken — dezelfde aanpak als de kleur.

Idem voor de deeltjes op het sfeerscherm (`--deeltje-kern`, `--deeltje-rand`:
die twee variabelen bestaan al) en de ornamenten in de interface (✦ 20×, ◆ 10×)
— die horen per thema anders te zijn, en het zijn maar twee tekens.

### 6. Woorden
Niet vergeten: de app noemt dingen "perkament", "herberg", "akte". Bij een
sci-fi-campagne klopt dat niet meer. Dat is geen CSS maar het hoort wel bij een
stijl, en het raakt aan de bestaande afspraak dat de app campagne-agnostisch
hoort te zijn. Mogelijk deels op te lossen met de namen die de DM al kan
instellen (diensten hernoemen kan al).

## Het ontwerp

### De lagen van een thema

Eén blok per thema, `[data-theme="naam"] { … }`, met alleen variabelen. Geen
selectors van componenten. Een component gebruikt nooit een harde kleur, maar
een **rol**:

| laag | ongeveer | voorbeeld |
|---|---|---|
| kleur, lichte ondergrond | ~14 | `--vlak`, `--vlak-hoog`, `--lijn`, `--inkt`, `--inkt-mid`, `--inkt-zacht`, `--accent` (goud), `--accent-dof`, `--gevaar` (zegelrood), `--goed`, `--magie` |
| kleur, donkere ondergrond | ~8 | `--donker`, `--donker-vlak`, `--licht-inkt`, `--licht-inkt-zacht`, `--accent-op-donker` |
| vaste betekenissen | ~10 | deelnemerstypen (bestaan al), rariteit (5), schoolkleuren (8), conditiegroepen (3) — per thema bij te stellen, maar ze blíjven onderscheidbaar |
| lettertypes | 4 | `--letter-kop` (Cinzel), `--letter-tekst` (Crimson), `--letter-oud` (IM Fell), `--letter-hand` (Kalam); de briefstijlen houden hun eigen letters |
| vorm | 3 | `--hoek-klein`, `--hoek`, `--hoek-groot` |
| oppervlak | 3 | `--oppervlak` (de textuur van body::before), `--oppervlak-paneel`, `--schaduw` |
| ornament | 2 | `--ornament` (✦), `--scheiding` |

Rond de veertig variabelen. De staart van kleuren die één keer voorkomen in
één component blijft hard staan — tokeniseren om het tokeniseren helpt niemand.

**JS en canvas lezen de tokens**, in plaats van hun eigen hex:
`getComputedStyle(document.documentElement).getPropertyValue('--inkt')`, één
keer per thema opgehaald en gecachet (`window._themaKleur(rol)`). Zo blijven
combat-canvas, Cytoscape en de conditiekleuren met het thema meelopen.

### Iconen

Geen 127 iconen per thema, maar **een afwijkingenlijst**: `THEMA_ICONEN` per
thema (`{ feather: 'keyboard', church: 'radio-tower', … }`), en `icon()` zoekt
daar eerst. De sprite krijgt de vervangers erbij via `scripts/sprite-aanvullen.js`.
Kandidaten die genre dragen (gevonden in de code): `feather`, `scroll-text`,
`castle`, `church`, `potion`, `flask-conical`, `beer`, `sword`, `swords`,
`crossed-swords`, `stiletto`, `shield`, `landmark`, `crown`, `tree-pine`,
`mountain`, `backpack`, `open-book`, `book-open`, `coins`, `skull`. Niet alles
hoeft per thema anders; het zijn er per thema eerder tien dan twintig.
D&D-iconen (classes, condities) blijven: een Fighter blijft een Fighter.

### Tafelscherm-effecten

`lib/display-fx.js` en de cinematics (rust, loot, brief, terugblik, regie,
klassekracht, stemronde) lezen hun kleuren uit de tokens. Een thema mag per
effect één regel afwijken (sci-fi: een scanline in plaats van vonken).
`--deeltje-kern`/`--deeltje-rand` bestaan al.

### Het printbare blad

`lib/character-sheet.js` rendert op de server en kent het thema niet. Het
krijgt `meta.theme` mee en zet dezelfde `data-theme` op zijn `<html>`; de
variabelen komen uit een gedeeld bestand (`public/css/themas.css`) dat zowel
de app als het blad laadt. Met één eis: **op papier blijft het leesbaar** —
een donker thema wordt bij `@media print` zijn lichte set, want niemand print
een zwart vel.

### Woorden

*Akte* en *hoofdstuk* blijven (besluit 10). Wat genregebonden is, per
voorkomen in de JS:

- **Al instelbaar**: de namen van de diensten (herberg, tempel, …), de munten,
  de factie-sectie, de campagnenaam.
- **Door te lopen**: *perkament* (47×, vooral intern en in de editor —
  "brieftekst"), *boedel*/*knapzak* (108×), *archief* (120×), *logboek*
  (192×), *meesterkamer* (69×), *heldenboek* (76×), *prikbord* (46×),
  *waard* (40×), *lakzegel*/*zegel* (28×), *kasboek* (9×). Veel daarvan zijn
  sleutels in de code, niet woorden in beeld — die blijven. Per woord dat wél
  in beeld staat beslissen: vast laten, per thema een vertaling (zoals
  `THEMA_ICONEN`), of instelbaar zoals de dienstnamen.
- *Rust* (294×) is een D&D-term (Long Rest / Short Rest) en blijft.

### De keuze

`meta.theme` bestaat al, `applyAppMeta()` zet hem al op `<html>`. Erbij:
een keuze bij Instellingen → Campagne (met een voorbeeldje per thema, geen
uitleg eronder — die gaat in `inst_campagne`), een stap in de wizard, en het
formulier voor een nieuwe campagne. Een onbekende waarde valt terug op het
standaardthema.

## Volgorde (als het zover is)

1. **Tokenlaag neerzetten** met het standaardthema als waarden. Tailwind-config
   naar de variabelen. Verandert niets aan de look.
2. **Opruimronde kleur**: script per familie (RGB-afstand ≤ 28 → token), met
   handmatige controle. Per familie een **schermafdrukvergelijking** van een
   vaste set schermen (archief, detailvenster, spelerstab, Meesterkamer, een
   dienst, het tafelscherm, het blad); wijkt een scherm zichtbaar af, dan gaat
   die afdruk naar de DM vóór we verdergaan (besluit 8).
3. **Lettertypes, hoeken, schaduwen** naar hun rollen.
4. **JS, canvas, Cytoscape, conditions, display-fx, character-sheet** naar de
   tokens.
5. **`hp` schrappen** (en `theme: 'hp'` → `default`); eerst kijken wat het bij
   de klasse-typen en de statblokken deed.
6. **Bewaking**: een test die nieuwe harde kleuren en `font-family`'s weigert
   buiten een lijst van toegestane plekken (zoals de briefstijlen). Zonder dat
   loopt de kloof binnen een maand weer op.
7. **Eén nieuw thema helemaal af** — noir of sci-fi — inclusief iconen,
   oppervlak, effecten en het blad. Dán weten we wat thema nummer twee kost.
8. **De keuze** in Instellingen en de wizard.
9. Uitrollen, als één geheel.

## Waar het misgaat als we niet opletten

- **Kleur heeft geen tests.** 545 tests zeggen niets over een tint die een
  halve stap verschuift. Bij de opruimdag hoort per familie een voor-en-na van
  dezelfde drie schermen; anders merkt niemand het tot iemand aan tafel zit.
- **De staart is geen fout.** 124 families betekent niet dat er 124 tokens
  moeten komen. Wat één keer voorkomt in één component mag hard blijven staan —
  tokeniseren om het tokeniseren maakt het alleen moeilijker te lezen.
- **Niet elke stijl hoeft alles.** Een thema dat alleen kleuren en lettertypes
  omzet is een geldig thema. Oppervlakken, iconen en effecten zijn een trap
  waar je op kunt stoppen.
- **Het `hp`-thema gaat weg** (besluit 6). De proef dat de tokenlaag compleet
  is wordt daarom het eerste nieuwe thema, niet een omgebouwd `hp`.
- **Een donker thema op donkere vlakken.** De 148 plekken die nu al donker
  zijn moeten in een donker thema nog steeds te onderscheiden zijn van de
  ondergrond — vandaar twee sets tokens in elk thema.
- **Contrast is meetbaar.** Bij elk nieuw thema de hoofdcombinaties door een
  contrastcheck halen (WCAG AA, 4,5:1 voor tekst); de app heeft al twee keer
  onzichtbare tekst gehad (contrast 1,19 en 1,6).
