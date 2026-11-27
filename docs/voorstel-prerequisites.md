# Het Prerequisite-veld

> *"Ook dat kunnen we goed integreren en koppelen aan de mechaniek. Bekijk welke
> prerequisites er zijn. Dat kan een class, subclass, species, subspecies, feat,
> level zijn (en een spellcasting feature)."*

Dit stuk is eerst een **meting** en daarna een voorstel, want de meting draait
de vraag om. Wat er in de app aan eisen staat is veel smaller dan die lijst van
zeven — en de twee dingen die er wél staan zijn met de huidige opslag niet
betrouwbaar te lezen.

---

## Wat er nu staat

Eisen leven op twee velden van een feat:

| veld | vorm | wat erin staat |
|---|---|---|
| `vereist` | vrije tekst | alles behalve het level |
| `vereistLevel` | getal | het minimumlevel (33 feats op productie; 19 bij elke Epic Boon) |

De enige plek waar eisen **meegeleverd** worden is
`bronnen/feat-koppelingen.json`, 51 feats. Daarop valt elke campagne terug die
geen eigen feats heeft. Gemeten:

| aantal | eis | soort |
|---|---|---|
| 16 | `Geen eis` | **geen eis** — een leeg veld, uitgeschreven |
| 27 | `Strength 13`, `Strength of Dexterity 13`, `Intelligence, Wisdom of Charisma 13`, … | ability score ≥ 13 |
| 5 | `Light/Medium/Heavy armor training`, `Shield training` | een training |
| 3 | `Een spellcasting- of pact magic-feature` | kan casten |
| 1 | `Strength 13, Shield training` | twee eisen tegelijk |

**Drie soorten dus.** Van de zeven die je noemde komen *class*, *subclass*,
*species*, *subspecies* en *een andere feat* in de meegeleverde data **nergens**
voor. Ze bestaan wel in het bredere 2024-materiaal (Elven Accuracy vraagt een
Elf; sommige feats vragen een andere feat), maar in déze app staat er niets van.
Dat is geen reden om ze over te slaan — het is een reden om een model te kiezen
dat **niets kost zolang het leeg is**.

> Ik heb eerder in deze sessie "120 feats in 8 soorten" genoemd, met species- en
> feat-eisen erbij. Dat getal komt niet uit deze repository en klopt hier niet;
> bovenstaande tabel is wat er werkelijk ligt.

## Twee dingen die nu al stilletjes fout gingen

Allebei gerepareerd (27 nov 2026, `_eisUit` in `render-vaardigheden.js`,
`tests/prerequisite.test.js`), want ze staan los van welk model we kiezen:

- **`Geen eis` werd als eis gelezen.** Op de tegel kwam een plusje dat belooft
  dat er verderop meer staat, met als tooltip *Prerequisite: Geen eis*. Zestien
  stuks in elke campagne die op het koppelbestand terugvalt. Grisburgh zelf is
  schoon, dus daar was het onzichtbaar — een verse campagne begint er mee.
- **Een level dat als tékst is ingetikt kwam nooit op zijn penning.** De eigen
  tekst gaat voor op de meegeleverde koppeling, dus `vereistLevel` kwam niet aan
  de beurt en het level verdween in een tooltip. Op een datakopie waarin de Epic
  Boons `Level 19` als tekst droegen: 60 plusjes, nul eispenningen; na de
  reparatie 34 en 12.

## Waarom vrije tekst hier niet verder komt

Niet omdat tekst lelijk is, maar omdat **de komma twee tegengestelde dingen
betekent** en je dat van buiten niet kunt zien:

```
Intelligence, Wisdom of Charisma 13   →  één van deze drie         (OF, 6 feats)
Strength 13, Shield training          →  deze twee allebei          (EN, 1 feat)
```

Dezelfde scheidingsteken, omgekeerde betekenis. Elke parser die hierop gokt zit
bij een van de twee groepen fout, en dat merk je pas aan tafel — precies de
afweging die in `feat-koppelingen.json` zelf al staat opgeschreven. Daar komt
bij dat een eis in de praktijk **een drempelwaarde** heeft (13) die nu in de
tekst meeligt; om voor te rekenen moet je dat getal hebben.

## Voorstel: een lijst eisen, elk met een soort

Eén nieuw veld `eisen` op een feat — een **array van OF-groepen**, waarbij alles
in de array samen moet gelden (EN) en alles bínnen een groep een keuze is (OF).
Dat is precies de vorm die de data vraagt, en niet meer dan dat:

```js
// Shield Master: Strength 13 én Shield training
eisen: [
  [{ soort: 'ability', ab: 'str', min: 13 }],
  [{ soort: 'training', wat: 'Shields' }],
]

// Fey Touched: Intelligence, Wisdom óf Charisma 13
eisen: [
  [{ soort: 'ability', ab: 'int', min: 13 },
   { soort: 'ability', ab: 'wis', min: 13 },
   { soort: 'ability', ab: 'cha', min: 13 }],
]
```

De soorten, met wat ze nú al kunnen voorrekenen:

| soort | velden | valt af te leiden uit |
|---|---|---|
| `ability` | `ab`, `min` | het spelersblad — hard |
| `training` | `wat` (Light/Medium/Heavy/Shields) | `klasse-basis.json → armor` — hard |
| `caster` | — | `klasse-basis.json → castAbility` — hard |
| `level` | `min` | het level van de speler — hard |
| `class` / `subclass` | `naam` | het profiel — hard |
| `species` | `naam` | het profiel — hard |
| `feat` | `naam` | wat de speler al koos |
| `tekst` | `tekst` | niets; dit is de ontsnapping |

De laatste rij is het belangrijkste onderdeel. Een eis die we **niet** kunnen
ontleden blijft gewoon een zin, en gedraagt zich dan precies zoals het veld nu
doet. Daarmee is dit geen migratie-met-risico: `vereist` blijft bestaan en wordt
bij het lezen omgezet naar `[[{soort:'tekst', …}]]`.

### Wat het oplevert

**Voorrekenen, niet blokkeren** — zoals bij een spreukverzoek, een multiclass en
het bastion. Concreet, van minst naar meest werk:

1. **Op het kaartje van de feat** staat wat hij vraagt in leesbare vorm, met
   per onderdeel een vinkje of een streepje voor wie ingelogd is als speler:
   *Strength 13 ✓ · Shield training ✗*. Geen knop die weigert; een feat die niet
   past blijft te kiezen, want de DM beslist.
2. **De aansluit-afleiding wordt exact** in plaats van een regex. `_ARMOR_WOORDEN`
   doet dit al voor training en `casters: true` voor casten — dat is de helft van
   de soorten, en die twee regels vervallen dan ten gunste van één lus over
   `eisen`. Dit is de generalisatie waar je op doelde: wat nu per eis-soort is
   ingebakken wordt één tabel.
3. **In de personagemaker** staat nu *"Vereist: … Je DM kijkt of dat klopt"*
   (`personage-maken.js`). Met `eisen` kan daar staan wát er niet klopt, en
   blijft de keuze gewoon staan.
4. **Bij een level-up** kan de featlijst de passende feats bovenaan zetten —
   gesorteerd, niet gefilterd.

### Wat het niet moet doen

- **Niets weigeren.** De uitzonderingen zijn in 5e eerder regel dan uitzondering
  (een feat uit een background, een species-variant, een DM die iets toestaat),
  en een weigering die vaak genoeg fout zit ga je wantrouwen.
- **Geen tweede waarheid.** De eis staat op de feat en nergens anders; wat een
  klasse geeft staat in `klasse-basis.json` en nergens anders.
- **Geen migratie die tekst herschrijft.** Een parser mag `eisen` *voorstellen*
  in de editor (een knop *Lees de tekst uit*, met het resultaat ter controle),
  maar nooit stilzwijgend andermans veld omzetten — zie de komma hierboven.

## Stappen

1. ~~`Geen eis` filteren en een level uit de tekst lezen~~ — gedaan 27 nov 2026.
2. **De data opschonen**: de zestien `Geen eis` uit `feat-koppelingen.json`
   halen. De code vangt het nu op, maar het blijft een waarde die niets betekent.
3. `eisen` erbij als veld, met `tekst` als terugval en `vereist` die blijft
   werken. Lezen via één helper, zoals `_eisUit` nu.
4. De vinkjes op het kaartje (punt 1 hierboven) — de eerste plek waar een speler
   er iets aan heeft.
5. De aansluit-afleiding omzetten naar `eisen` en de twee ingebakken regels
   opruimen.
6. De editor: per eis een rijtje met soort + waarde, en de knop *Lees de tekst
   uit* die een voorstel doet.

Stap 2 en 3 zijn klein. Stap 4 is waar het zichtbaar wordt. Stap 5 en 6 kunnen
los, en pas als de rest staat.
