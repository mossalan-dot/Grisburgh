# Een feature die je iets laat kiezen

Werkdocument, 19 oktober 2026. Aanleiding: *"Sommige features geven meer
vaardigheden. Sommige features geven de keuze (soms binair, soms
multiple-choice). Kunnen we iets maken waarbij de speler iets kan aanvinken?"*

## Wat er nu is

Er staat al een mechaniek klaar, en die wordt nergens gebruikt.

- `playerProfile.featChoices` is een map `"Klasse|level|Featurenaam" → tekst`.
- `_choiceField()` in `render-progressie.js` tekent daarvoor een **vrij
  tekstveld** ("Noteer jouw keuze…") bij elke feature met `choice: true`.
- Alleen **Ability Score Improvement** en **Epic Boon** krijgen iets beters:
  een echte kiezer. Die twee komen niet uit de data maar worden bijgeprikt
  (`_kind: 'shared'`).
- Het printbare blad leest `featChoices` al uit.

**En nu het getal dat telt: van de 889 features in Grisburgh staat er `choice:
true` bij precies nul.** Dat veld bestaat in de editor niet, dus niemand heeft
het ooit gezet. De speler ziet dus nergens een keuzeveld behalve bij die twee
bijgeprikte.

## Wat er in de teksten zit

Geteld over dezelfde 889 features, op de formuleringen waarmee een boek een
keuze aankondigt:

| vorm | aantal | voorbeeld |
|---|---|---|
| kies één uit een lijst | 72 | Totem Spirit (Bear · Eagle · Elk · Tiger · Wolf) |
| kies een skill, tool of taal | 34 | Primal Knowledge, Expertise |
| wisselen bij een level-up | 33 | "you can replace one of the spells you know" |
| kies een spreuk of cantrip | 22 | Giant's Power (druidcraft of thaumaturgy) |
| kies er twee, drie of vier | 18 | Path of the Kensei, Metamagic |
| opnieuw na een rust | 7 | Circle of the Land (elk Long Rest een ander terrein) |

Die rijen overlappen: Spellcasting valt in vier categorieën tegelijk. Wat
eruit springt is dat **de grootste groep "kies er één" is** — en dat is precies
de vorm die met een vinkje af is.

## Het voorstel

Eén blok op een feature, naast `desc`:

```json
"keuze": {
  "label":   "Totem Spirit",
  "aantal":  1,
  "opties":  ["Bear", "Eagle", "Elk", "Tiger", "Wolf"],
  "opnieuw": "nooit"
}
```

- **`aantal: 1`** geeft rondjes, **meer** geeft vinkjes met een teller
  ("2 van 3 gekozen"). Eén veld voor allebei; het verschil is geen tweede
  soort.
- **`opnieuw`** is `nooit`, `levelup` of `langerust`. Dat is de as die
  hieronder bij de uitzonderingen terugkomt.
- Ontbreekt `keuze`, dan verandert er niets aan dat kaartje.

De DM vult het in bij het bewerken van een featurekaartje, onder de
beschrijving. Met een knop **Opties uit de tekst halen**: die leest een
opsomming uit de beschrijving (`Bear, Eagle, Elk, Tiger, or Wolf`) en zet ze
klaar, zodat hij ze niet overtikt. Hij mag ze daarna bijschaven — het blijft
zijn lijst.

De speler ziet ze op het kaartje in zijn **Progressie**-tijdlijn, waar het
vrije tekstveld nu ook staat, en ze gaan mee naar het printbare blad.

### Opslag

`featChoices` blijft, maar een waarde mag voortaan ook een **lijst** zijn:

```json
{ "Barbarian|3|Totem Spirit": ["Bear"],
  "Monk|3|Path of the Kensei": ["Longsword", "Longbow"] }
```

Een string blijft een string — wat er nu staat blijft werken, en een feature
zonder `opties` houdt zijn vrije veld. Eén lezer (`alsObject` in
`lib/character-sheet.js`) moet leren dat een array ook kan.

## Wat het níét wordt

Dit is het deel waar de uitzonderingen zitten, en ze zijn belangrijker dan de
hoofdregel.

**Geen tweede plek voor een skill.** Dertig van die vierendertig "kies een
skill" gaan over proficiencies, en die staan al op het spelersblad. Een vinkje
hier zou betekenen dat dezelfde waarheid op twee plekken staat, en dan lopen ze
uiteen — dat is precies de fout die deze app elders steeds opruimt. Een feature
die skills geeft krijgt dus **geen** eigen lijstje: hij krijgt een knop die
naar zijn blad springt, naar het veld waar het hoort.

**Geen tweede spreukenkiezer.** De 22 spreukkeuzes lopen al via de
spreukenbibliotheek en `_openSpreukKeuzes()`, met de tellers uit
`srd-spreukentellers.json`. Een cantrip kiezen op een featurekaartje zou een
tweede weg naar hetzelfde boek zijn.

**Geen vervanging van ASI en Epic Boon.** Die hebben een eigen kiezer die meer
doet dan aanvinken (hij schrijft de feat door naar Kenmerken & Eigenschappen).
Die blijft.

**Niet blokkeren bij het aantal.** Staat er `aantal: 2` en vinkt iemand er
drie aan, dan telt de app het voor ("3 van 2") en laat het staan. Dezelfde
afspraak als bij de multiclass-eisen en de loot-DC: *de app rekent voor, de DM
tekent af.* Aan tafel is de uitzondering vaak juist de bedoeling.

**"Opnieuw na een rust" is geen keuze maar een stand.** Circle of the Land
kiest elke lange rust een ander terrein; dat hoort bij de rust, niet bij een
kaartje dat je één keer invult. In fase 1 krijgt zo'n feature gewoon een keuze
die je zelf overschrijft. Pas als blijkt dat dat aan tafel schuurt, haken we
hem aan `POST /party/long-rest` — en dan hoort er ook een regel over in de
rust-overlay, want anders vergeet iedereen het.

**Multiclass.** De sleutel bevat de class (`Barbarian|3|…`), dus twee classes
met een gelijknamige feature botsen niet. Dat was bij de kaartjes in het
Heldenboek wél een probleem en is daar vandaag gerepareerd; hier zat het al
goed.

## Fasering

| fase | wat |
|---|---|
| **1** | Het `keuze`-blok, de editor erbij, rondjes en vinkjes op de tijdlijn, lijst in `featChoices`, meenemen naar het blad |
| **2** | *Opties uit de tekst halen* — de knop die de opsomming voorleest |
| **3** | De sprong naar het spelersblad bij een skill-, tool- of taalkeuze |
| **4** | `opnieuw: langerust` aanhaken op de lange rust, als fase 1 laat zien dat het nodig is |

Fase 1 is op zichzelf bruikbaar: zonder fase 2 tikt de DM de opties zelf in,
en dat is voor de 72 "kies één"-features een regel of vier per stuk.

## Wat ik eerst zou doen

Niet fase 1. **Eerst tien features met de hand van een `keuze` voorzien** —
Totem Spirit, Divine Order, Elven Lineage, Fighting Style, Path of the Kensei —
en dáárop kijken of het vinkje op de tijdlijn leest zoals het hoort. Tien is
genoeg om te zien of de vorm klopt, en het is weggegooid werk als hij niet
klopt. Daarna pas de editor, want dan weet je wat erin moet.
