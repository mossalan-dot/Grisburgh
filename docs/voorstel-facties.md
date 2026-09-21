# Voorstel: de Heeren gaan op in de facties

*21 september 2026*

De Heeren van de Nacht zijn nooit afgemaakt, en gaandeweg bleek waarom: wat ze
doen is een factie doen. Een gilde met rangen, klussen en een naam die je
verdient — dat is precies waar de factiemachinerie voor is, alleen dan generiek.
Dit stuk kijkt naar wat er ligt, waar de Heeren van afwijken, wat het boek
erover zegt, en wat er bij moet om de Heeren als factie te kunnen spelen zonder
dat er een tweede systeem blijft staan.

---

## 1. Wat de factiemechaniek nu kan

`meta.facties[]` per campagne, stand per party in de groep. Een factie is:

| veld | wat het doet |
|---|---|
| `naam`, `embleem`, `beschrijving`, `stijl` | kop, zegel en toon van de kaart |
| `entityId` | het organisatie-kaartje erachter |
| `locatieEntityId`, `npcEntityId`, `npcEntityIdDag`, `npcGreet` | de scène: gevel, contactpersoon, groet — dag- en nachtvariant |
| `leden[{entityId, rang}]` | wie erbij hoort; volgt de zichtbaarheid van het personage-kaartje |
| `rangen[{naam, voordelen, titel, boons[]}]` | de ladder |
| `renownDrempels[]` | vanaf hoeveel renown welke rang geldt (standaard `0,1,3,10,25,50`) |

Per party: `g.factieZichtbaar[id]` (kent de party ze) en `g.factieRenown[id]`
(hoe ver ze staan). De rang wordt **afgeleid** uit renown — er is niets aparts
om bij te houden.

Wat er al werkt, en goed werkt:

- **Uitnodigingen.** `POST /facties/:id/uitnodiging` bezorgt elke speler van de
  actieve party een verzegelde brief met embleem en kleur van de factie, en
  onthult de factie in één beweging. Te versturen vanuit het factiepaneel, het
  mail-icoon per dienst, en de regie-balk tijdens het spelen.
- **Zichtbaarheid per party.** `POST /facties/:id/reveal`. Een factie die je
  niet kent bestaat niet — hij komt niet in `GET /facties` voor, en zijn missies
  ook niet.
- **Rangen met titels.** Een rang met een `titel` levert de speler een titel op
  die hij op zijn blad kan zetten (`playerProfile.factieTitel`); de keuzelijst
  vult zich met wat de party ontgrendeld heeft.
- **Quest givers.** Missies hángen al aan een factie: `{factieId, titel, tekst,
  vereistRenown, renownBeloning, valuta, stijl}`, met een statusstroom
  (beschikbaar → aangevraagd → actief → voltooid/gefaald) op het prikbord.
  `GET /missies` filtert per party op zichtbaarheid van de factie, op status én
  op renown — een missie waar je nog niet aan toe bent zie je niet.
- **Boons per rang.** `rangen[].boons[]` is tekst of een verwijzing naar een
  voorwerp-kaartje, en `POST /facties/:id/renown` deelt ze bij een rangstijging
  uit als regel in de boedel.
- **Eigen sfeerloop** per factie (`factie:<id>`) en een eigen scène-scherm.

Dat is meer dan het aanvoelt. De eisen *uitnodigingen*, *zichtbaarheid*,
*levels met titels* en *quest givers* zijn er dus al.

---

## 2. Waar de Heeren van afwijken

| de Heeren | de facties | oordeel |
|---|---|---|
| `g.heeren.rang`, **met de hand gezet** door de DM | rang **afgeleid** uit renown | facties winnen: één getal, geen tweede administratie |
| rangen dragen `min`/`max` — een **beloningsbereik** | rangen dragen `voordelen` + `boons` | overnemen: bereik is bruikbaar |
| **klussenbord** met willekeurig gegenereerde klussen | handgeschreven missies | zie hieronder |
| **boetes** per personage + een **advocaat** die met je Persuasion-bonus afdingt | — | past niet; zie §5 |
| `bordGrootte`, `honorarium`, `boeteFactor` | — | hoort bij de boetes |
| eigen scherm, eigen DM-tab, eigen routes | gedeelde machinerie | opruimen |

Het klussenbord is het enige stuk waar echt iets in zit dat facties missen:
`_heerenGenereerKlus()` pakt een willekeurig kaartje uit de campagne, plakt er
een zin-sjabloon omheen (`{doel}`) en rolt een beloning binnen het bereik van je
rang. Dat is aardig — maar het is een **schrijfhulp**, geen tweede
missiesysteem. Een gegenereerde klus mist alles wat een missie wél heeft:
zichtbaarheid per party, een renown-beloning, een statusstroom, een plek op het
prikbord.

Verder opgevallen, en het staat er los van dit voorstel: de klussengenerator
kiest bewust uit **álle** kaartjes, ook de onontdekte. Dat is verdedigbaar voor
een gilde dat je ergens heen stuurt, maar het betekent wel dat het bord een naam
kan laten vallen die de party nooit gehoord heeft.

---

## 3. Wat het boek zegt

Twee bronnen: de **AL Faction Guide v7.1** (de harde mechaniek) en **Waterdeep:
Dragon Heist** (hoe het aan tafel speelt).

**De ladder.** Vijf rangen op 0 / 3 / 10 / 25 / 50 renown. Onze standaard
(`0,1,3,10,25,50`) heeft er een extra trede tussen gezet; dat mag, want het is
per factie instelbaar, maar het is goed om te weten dat we daarmee van het boek
afwijken.

**Renown is niet de enige eis.** Vanaf rang 3 vraagt het boek er ook
*karakterlevel* en *een aantal geheime missies* bij (rang 3: level 5 en 1
missie; rang 4: level 11 en 3; rang 5: level 17 en 10). Dat is precies de
gelaagdheid die onze ladder mist: nu is renown de enige knop.

**Wat een rang oplevert**, oplopend: meedoen aan wat de factie doet → geheime
missies en een mentor → **een voorwerp kunnen verwerven** uit de lijst van jóúw
factie (per rariteit, tegen downtime en goud — je *koopt* het met moeite, je
krijgt het niet) → voor een medelid kunnen betalen → een lager lid inspiratie
geven. Elke factie heeft zijn **eigen** voorwerplijst; dat is wat een rang
betekenis geeft.

**Dragon Heist** zet daar de speelbare kant naast. Elke factie heeft een
**contactpersoon** die de missies uitdeelt — bij ons `npcEntityId`, dat hebben
we. En het belangrijkste voor dit voorstel: op renown-drempels kun je **hulp
inroepen**. Laag: een gewone agent helpt je een dag. Midden: een bekwaam
iemand. Hoog: een leider die met je meegaat. Dat is de tijdelijke medestander,
en het boek zet 'm bewust neer als iets wat je *inroept*, niet als iets wat je
permanent hebt.

Wat beide bronnen benadrukken en wat wij ter harte moeten nemen: in het boek
zijn die voordelen meestal **niet uitgeschreven**, en het advies aan de DM is om
juist wél op te schrijven wat een rang concreet mag. Daar is onze app goed in —
wij kunnen het opschrijven én laten zien.

---

## 4. Wat erbij moet

Vier dingen, en ze delen één idee: een rang moet iets **ontgrendelen**, niet
alleen iets *zeggen*.

### 4.1 Eén lijst `unlocks` in plaats van `boons`

`rangen[].boons[]` wordt `rangen[].unlocks[]`, met een `type`. De oude vorm
blijft gelezen worden als `{type:'tekst'}` of `{type:'voorwerp'}`, dus er hoeft
niets gemigreerd te worden.

| type | velden | wat er gebeurt bij het bereiken van de rang |
|---|---|---|
| `tekst` | `naam`, `tekst` | staat op de ladder; komt als regel in de boedel (zoals nu) |
| `voorwerp` | `entityId`, `aantal` | het **kaartje** komt in het bezit van de party (`itemOwners`), niet als losse boedelregel |
| `metgezel` | `entityId`, `duur` | een tijdelijke medestander, zie 4.2 |
| `verkoper` | `entityId` | een winkel van de factie gaat open, zie 4.3 |
| `titel` | `titel` | wat `rangen[].titel` nu al doet — zelfde lijst, één plek |

Waarom `voorwerp` via `itemOwners` en niet als boedelregel: dat is het verschil
tussen "je hebt een Cloak of Elvenkind" en "er staat een zin over een mantel in
je tas". Het kaartje heeft een beschrijving, een rariteit, charges, attunement
en een plek in de Markt; die gooien we nu weg.

### 4.2 Medestanders roept de party in, ze krijgen ze niet

Niet: op rang 3 loopt er voortaan een huurling mee. Wel: op rang 3 **mág** je
hulp inroepen. Dus een knop op de factiekaart, met een `duur` (tot de volgende
lange rust) en een `cooldown` (één keer per akte, bijvoorbeeld). Server zet het
personage bij `dmState.activeAllies` en haalt het er bij het aflopen weer af;
de DM kan het altijd eerder afbreken.

Zo blijft het een scène — je stuurt een bericht naar je contactpersoon en er
komt iemand — in plaats van een regel die stilletjes je party groter maakt. En
het is de enige vorm die klopt met wat een factie ís: ze zijn je niet
verschuldigd, ze doen je een gunst.

### 4.3 Verkopers zijn er al, ze moeten alleen gevonden worden

Een winkel is `data.voorraad` op een locatie- of personage-kaartje. Een factie
heeft al `leden[]` die naar zulke kaartjes wijzen. Dus: **niets opslaan**. Een
lid met voorraad is een verkoper van de factie, en dat leidt de app af —
dezelfde regel als bij *Waar hoort dit bij?* en bij het muntje in een
dungeonkamer: één plek, twee kanten.

Twee plekken profiteren meteen: op de factiekaart een regel *Hier kun je
terecht* met de winkels die deze party kent, en in de Markt een filterchip per
factie. Een `unlock` van het type `verkoper` is dan alleen nog nodig als de
winkel pas op een bepaalde rang **opengaat** — die zet dan de zichtbaarheid van
dat kaartje voor deze party.

### 4.4 Een rang mag meer eisen dan renown

`rangen[].vereist` met optioneel `{ level, missies }`, naar het model van het
boek. **Voorrekenen, niet blokkeren** — zelfde regel als bij multiclassen en
spreukverzoeken: de app zegt *"Rang 3 vraagt level 5 en één missie; jullie
hebben level 4 en twee missies"*, en de DM beslist. Een automatische weigering
die vaak genoeg fout zit ga je wantrouwen.

---

## 5. Wat er niet in past

**De boetes en de advocaat.** Dat is geen factiemechaniek maar een
gevolgsysteem van een stadsgezag: je wordt gepakt, je krijgt een boete, je kunt
iemand inhuren die er met een Persuasion-worp vanaf pingelt. Het hangt bij de
Heeren toevallig aan een gilde, maar het hoort bij de Luimpoort. Drie opties,
op volgorde van mijn voorkeur:

1. **Laten vallen.** Het is nooit gespeeld. Een boete is nu een regel in de
   boedel en een bedrag; dat kan de DM ook met een brief en een afschrijving.
2. **Bewaren als eigen voorstel** (`docs/voorstel-boetes.md`) en later bouwen
   als iets dat aan een *organisatie-kaartje* hangt, niet aan een factie.
3. Meenemen als vierde unlock-type. Niet doen: dan zit het gevolgsysteem van
   één stad voor altijd in de factiemachinerie van elke campagne.

**Het klussenbord, helemaal.** Eerst stond hier het voorstel om de generator te
bewaren als knop *Verzin een klus* in de missie-editor. Dat is 21 sep 2026
geschrapt: niet nodig. Een missie schrijf je zelf — dat is juist het leuke werk,
en een willekeurig doel uit de kaartenbak levert eerder een zin op die je toch
herschrijft. `rangen[].beloning` hoeft daarmee ook niet.

---

## 6. Datamodel

```js
// meta.facties[]
{
  id, naam, embleem, beschrijving, stijl,
  entityId, locatieEntityId, npcEntityId, npcEntityIdDag, npcGreet,
  leden: [{ entityId, rang }],
  renownDrempels: [0, 3, 10, 25, 50],
  rangen: [{
    naam, titel, voordelen,
    vereist:  { level, missies },        // nieuw — voorrekenen, niet blokkeren
    unlocks: [                           // was `boons`
      { type: 'tekst',     naam, tekst },
      { type: 'voorwerp',  entityId, aantal },
      { type: 'metgezel',  entityId, duur: 'langeRust', cooldown: 'akte' },
      { type: 'verkoper',  entityId },
      { type: 'titel',     titel },
    ],
  }],
}
```

Per party blijft het bij wat er al staat: `factieZichtbaar`, `factieRenown`,
`factieBoonsGegeven` (hernoemen naar `factieUnlocksGegeven`, oude sleutel blijft
gelezen). Boetes verdwijnen mee met de Heeren, of verhuizen naar hun eigen
voorstel.

---

## Gedaan op 21 september 2026

Stap 1 t/m 3 en de regelkant staan erin:

- `rangen[].unlocks[]` met de vijf types, met `boons` en het losse `titel`-veld
  als oude vorm (`_rangUnlocks()`). Er is niets gemigreerd.
- Een **voorwerp**-unlock geeft het kaartje echt in bezit (`_eigendomErbij`,
  dus uniek/gedeeld/stapelbaar werkt) en zet het zichtbaar. Een **verkoper**
  zet de winkel open voor die party. Een **titel** en een **metgezel** worden
  niet uitgedeeld: de eerste stond al op de ladder, de tweede wordt ingeroepen.
- **Hulp inroepen**: `POST /facties/:id/hulp` zet de metgezel in `g.companions`
  (waar de bondgenoten al stonden, dus hij staat meteen op het partytabblad en
  laadt mee in een gevecht) en `g.factieHulp[factieId]` onthoudt tot wanneer.
  De lange rust stuurt hem naar huis; daarna mag je opnieuw vragen.
  `DELETE` stuurt hem eerder weg.
- `rangen[].vereist = { level, missies }` wordt **voorgerekend** op de ladder,
  niet afgedwongen. Het partijlevel is dat van de hoogste speler; de
  missieteller telt de voltooide missies van díé factie.

Wat er nog ligt: **verkopers afleiden** uit `leden[]` + `data.voorraad` (nu
alleen als expliciete unlock), de **Heeren als factie** in Grisburgh zelf
(de factie bestáát al in `meta.facties`, alleen de oude dienst moet nog weg).

Het **klussenbord en de boetes zijn vervallen** (besluit 21 sep 2026), en de
klusgenerator hoeft er ook niet uit gered te worden. Het gerechtshof-idee staat
in `docs/todo.md`.

## 7. Volgorde

1. **`unlocks` met de vijf types**, met `boons` als oude vorm. Dit is het hart:
   zonder dit blijft een rang een mededeling.
2. **Voorwerp-unlock via `itemOwners`**, zodat een beloning een echt kaartje is.
3. **Medestander inroepen** (knop, duur, cooldown, `activeAllies`).
4. **Verkopers afleiden** uit `leden[]` + `data.voorraad`; chip in de Markt.
5. **`vereist` voorrekenen** op de ladder.
6. **De Heeren omzetten** naar een gewone factie in `meta.facties` van Grisburgh
   (script, kopie ernaast), met hun vijf rangen en hun beloningsbereiken. Daarna
   de negen routes, de DM-tab, `#section-heeren` en `HEEREN_*` weg.
7. **Klusgenerator** als knop in de missie-editor.

Stap 1 t/m 3 zijn de eisen; 4 t/m 7 maken het af.

---

## Onderweg gevonden

- **Een boon gaat naar álle spelers van de campagne, niet naar de party.**
  In `POST /facties/:id/renown`:

  ```js
  const groepSpelers = spelers.filter(p =>
    Object.values(dmState.groups || {}).some(grp =>
      grp === g && (grp.characters || []).includes(p.id)) || true);
  ```

  `grp.characters` bestaat in geen enkele campagne en komt in de hele codebase
  alleen op deze regel voor, dus de binnenste toets is altijd onwaar — en
  `|| true` maakt de filter vervolgens altijd waar. Stijgt party A in rang, dan
  krijgt party B de boon ook in de boedel. Groepslidmaatschap hoort via
  `_playerGroupId()` / `entity.data.groep` te lopen, zoals overal elders.

- **De schakelaar *Facties* in Toegang per groep doet niets.** Niet in de
  client, niet op de server. (Staat ook in de testronde van 21 sep.)

- **De Heeren zijn nergens te bereiken**: geen menu-item, geen enkele
  `switchSection('heeren')`, niet in `lib/modules.js`. Dat maakt stap 6
  goedkoop — er is geen gebruiker die iets kwijtraakt.

## Bronnen

- D&D Adventurers League — *A Guide to the Factions of Faerûn* v7.1 (rangen,
  drempels, item procurement, mentorschap)
- *Waterdeep: Dragon Heist* — factiecontacten, missiestructuur en hulp inroepen
  op renown-drempels
