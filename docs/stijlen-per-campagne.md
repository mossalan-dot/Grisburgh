# Stijlen per campagne

Werkdocument, 1 oktober 2026. **Nog niets gebouwd** — dit is de meting en het
voorstel. Afgesproken: voor later, maar de bevindingen moeten vastliggen zodat
de volgende ronde niet opnieuw begint met schatten.

## Waarom dit er ligt

Er zijn nu twee thema's: het standaardthema en `hp` (Harry Potter), een restant
van één one-shot. Dat is geen keuze maar een toevalligheid. De denkrichting is
een echte reeks: **noir, sci-fi, steampunk, gothic horror, mythisch Grieks,
wildwest, post-apocalyptisch**.

De aanname in `docs/todo.md` was: *"een stijl is een blok CSS-variabelen — geen
tweede set componenten."* **Die aanname klopt vandaag niet.** Hieronder waarom,
en wat het wél kost.

## De meting

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

## Voorgestelde volgorde

1. **De opruimdag.** Top-30 kleurfamilies naar tokens, script-gestuurd met
   handmatige controle per familie. Dekt 88 %. Hierna is een thema pas echt
   "een blok variabelen". Schatting: een dag, misschien anderhalve.
2. **De vier lettertyperollen** en de twee hoekmaten erbij. Een paar uur.
3. **Het `hp`-thema omzetten** van 120 overschrijvingen naar tokens. Dat is
   meteen de proef of stap 1 en 2 genoeg waren — als het niet lukt, weten we
   wat er nog mist voordat we zeven stijlen bouwen.
4. **Eén nieuwe stijl helemaal af** (noir of sci-fi), inclusief oppervlak,
   iconafwijkingen en effecten. Dán weten we wat stijl nummer drie kost.
5. Pas daarna de rest, en de keuze terug in de setup-wizard.

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
- **Het `hp`-thema is de maatstaf, niet het voorbeeld.** Het werkt, maar op de
  manier die we niet willen. Zolang het er is, is het de beste test die we
  hebben.
