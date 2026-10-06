# Houding van personages tegenover de avonturiers

Specificatie voor het Grisburgh-campagnedashboard (`grisburgh-campagne-7.html`).

## Doel

Elk personagekaartje vertelt hoe dat personage tegenover de groep staat. Dat gebeurt met één waarde op een schaal van 1 tot 5. Op het kaartje voegt dat niets toe in rust. De houding wordt alleen zichtbaar als een glans of schaduw die over het kaartje trekt, met hetzelfde effect dat nu al bij zeldzame en legendarische items zit.

De feature sluit aan op wat er al in de app zit: de entiteitstypen, de typewissel bij een onthulling, de DM-notities, het renownsysteem voor facties en de glans bij items.

## Schaal

De schaal bouwt voort op de drie houdingen uit de DMG (vijandig, onverschillig, vriendelijk), met twee extra tussenstappen.

| Waarde | Naam | DMG-houding |
|---|---|---|
| 1 | Vijandig | Vijandig |
| 2 | Wantrouwig | Vijandig, maar aanspreekbaar |
| 3 | Onverschillig | Onverschillig |
| 4 | Welgezind | Vriendelijk |
| 5 | Bondgenoot | Vriendelijk, neemt risico voor de groep |

De houding geldt voor de hele groep. Een houding per speler is bewust geparkeerd (zie "Buiten scope").

### Vijf of zeven stappen

Leg de schaal vast in één tabel in de code: per stap de naam, de DMG-houding, de instellingen van het effect en de toasttekst. Dan is overstappen van vijf naar zeven stappen een wijziging op één plek.

Een mogelijke indeling in zeven stappen:

| Waarde | Naam | DMG-houding |
|---|---|---|
| 1 | Vijandig | Vijandig |
| 2 | Afkerig | Vijandig |
| 3 | Wantrouwig | Onverschillig |
| 4 | Onverschillig | Onverschillig |
| 5 | Welwillend | Onverschillig |
| 6 | Welgezind | Vriendelijk |
| 7 | Bondgenoot | Vriendelijk |

Met zeven stappen worden de verschillen tussen de effecten klein en lastig te zien. Begin daarom met vijf, en stap pas over als je aan tafel merkt dat je een tussenstap mist. Opgeslagen waarden moeten bij een overstap worden omgerekend (5-schaal naar 7-schaal: 1→1, 2→3, 3→4, 4→6, 5→7, zodat elke naam dezelfde blijft).

## Welke houding geldt

Het veld `houding` blijft leeg tot de DM het zelf instelt. Zolang het leeg is, rekent de app de houding uit. De eerste regel die van toepassing is, wint:

1. **Eigen houding.** De DM heeft het schuifje ingesteld. Die waarde wint altijd.
2. **Renown van de factie.** Het personage hoort bij een factie en heeft geen eigen houding. Dan neemt het de stand van die factie over (zie "Koppeling met renown").
3. **Standaard van het type.**

| Type | Standaard |
|---|---|
| NPC | 3, onverschillig |
| Verkoper | 3, onverschillig |
| Huisdier | 4, welgezind |
| Antagonist | 1, vijandig |

## Weergave: licht en schaduw

Het effect is hetzelfde als de glans bij zeldzame en legendarische items: een baan die bij hover over het kaartje trekt. Het verschil zit in een paar CSS-variabelen. Vriendelijk is licht dat over het kaartje trekt, vijandig is schaduw.

| Waarde | Effect | Blend mode | Kleur (voorstel) | Sterkte |
|---|---|---|---|---|
| 1 | Donkere schaduw, iets trager, met een randje roestrood | `multiply` | Roestrood `#9a3328` | Sterk |
| 2 | Vage schaduw | `multiply` | Koper `#b5652e` | Zwak |
| 3 | Geen effect | | | |
| 4 | Zachte warme glans | `screen` | Warm goud `#e8c56a` | Zwak |
| 5 | Heldere gouden glans, zoals bij een legendarisch item | `screen` | Goud `#f2d27a` | Sterk |

Stem de kleuren af op de variabelen die al in de app bestaan.

**Uitwerking:**
- Hergebruik de bestaande keyframes van de itemglans. Stuur kleur, sterkte, snelheid en blend mode aan met variabelen op het kaartje, bijvoorbeeld `--sheen-color`, `--sheen-opacity`, `--sheen-duration` en `--sheen-blend`.
- Gebruik een iets andere hoek of timing dan bij items, zodat een personage niet aanvoelt als een voorwerp. Dit is optioneel: items en personages staan in aparte tabbladen.

**Wanneer het effect afspeelt:**
- Op desktop als je met de muis over het kaartje gaat.
- Op mobiel één keer bij het openen van de detailmodal, over de grote afbeelding bovenin.
- Het effect speelt één keer af en loopt nooit eindeloos door.
- Bij `prefers-reduced-motion: reduce` trekt er geen baan over het kaartje. In plaats daarvan vervaagt het kaartje kort naar de tint van de houding en weer terug, zonder beweging.

**In rust is niets te zien.** Spelers ontdekken de houding als ze even stilstaan bij een personage. Zo blijft het kaartje rustig, en voegt de feature geen extra element toe.

### Bediening voor de DM

In de bewerkmodus van een kaartje komt een schuifje van 1 tot 5, met de naam van het niveau ernaast. Is het veld leeg, dan toont het schuifje de berekende waarde met de tekst "Standaard". Een knop "Terug naar standaard" maakt het veld weer leeg. Het kaartje zelf laat niet zien of een houding zelf ingesteld of berekend is.

## Typewissel bij een onthulling

Wordt een NPC tot antagonist gemaakt, dan gaat `houding` naar 1. Op dat moment trekt er één keer langzaam een donkere schaduw over het kaartje: het onthullingsmoment. Gebeurt de onthulling via het tafelscherm, dan speelt het effect daar ook af.

Wil de DM dat de antagonist zich nog even vriendelijk voordoet, dan zet die het schuifje na de wissel gewoon terug.

## Koppeling met passive insight

Spelers krijgen naast passive perception ook **passive insight**. Elk personage krijgt een **insight-DC**. Is de passive insight van een speler gelijk aan of hoger dan die DC, dan krijgt die speler een toast met wat hij of zij aanvoelt.

### Passive insight

- De app berekent het automatisch: 10 + Wisdom-modifier, plus proficiency bonus als de speler proficient is in Insight.
- Het is handmatig te overschrijven, net als passive perception.

### Insight-DC per personage

- De standaard is een vast getal, bijvoorbeeld 12. Leg dat vast als één instelling, zodat je het op één plek kunt aanpassen.
- Per personage kun je de DC handmatig aanpassen. Een open boek krijgt een lage DC, een sluwe intrigant een hoge, bijvoorbeeld 18 of meer.
- Optioneel: als een personage een statblock met een Deception-bonus heeft, kan de standaard 10 + die bonus zijn.

De DC is ook de plek waar je een verborgen houding kwijt kunt. Een antagonist die nog als NPC rondloopt en zich vriendelijk voordoet, krijgt een hoge DC. Alleen een scherpe speler voelt dan dat er iets niet klopt, en de rest ziet niets.

### De toast

De tekst hangt af van de houding:

| Houding | Toast |
|---|---|
| 1 | Je voelt dat [naam] je vijandig gezind is. |
| 2 | Je merkt dat [naam] je niet vertrouwt. |
| 3 | [Naam] lijkt niet veel om je te geven. |
| 4 | Je voelt dat [naam] je wel mag. |
| 5 | Je weet zeker dat [naam] aan jouw kant staat. |

**Regels:**
- De toast verschijnt automatisch op de telefoon van de speler, bij het openen van het kaartje van het personage. De app moet daarvoor weten welke speler op welk apparaat zit.
- Een speler krijgt de toast één keer per houding. Pas als de houding verandert, kan er een nieuwe toast komen. Bewaar daarvoor per speler welke houding hij of zij al heeft gezien.

### Wie ziet het effect

Het effect is zichtbaar voor de hele groep. Om te voorkomen dat het alles verraadt voordat iemand de insight-check haalt, geldt dit:

- **De DM** ziet het effect altijd.
- **Spelers** zien geen effect zolang nog niemand in de groep de DC van dat personage heeft gehaald. Het kaartje gedraagt zich dan als onverschillig. Er lekt dus niets uit: een stil kaartje kan alles betekenen.
- Zodra **één speler** de DC haalt, krijgt die speler de toast. Vanaf dat moment ziet de hele groep het echte effect: de speler heeft het de anderen verteld.
- Verandert de houding later, dan ziet de groep het nieuwe effect direct. Spelers die de DC halen, krijgen opnieuw een toast.

## Koppeling met renown

Renown en houding beantwoorden dezelfde vraag: hoe staat de wereld tegenover de groep? Renown doet dat voor een factie, houding voor één persoon.

- **Dezelfde beeldtaal.** Factiekaartjes krijgen hetzelfde effect van licht en schaduw, op basis van de renownrang. Daardoor leest een factiekaartje hetzelfde als een personagekaartje.
- **Renown als standaard voor leden.** Een lid zonder eigen houding neemt de stand van de factie over. Stijgt je renown bij de stadswacht, dan wordt elke wachter zonder eigen houding vanzelf vriendelijker. Een corrupte sergeant of een spion krijgt een eigen houding, en die wint.

De omrekening van renown naar 1 tot 5 hangt af van hoe de renownschaal in de app nu werkt. Maak daar één vertaaltabel voor, zodat je hem op één plek kunt aanpassen.

## Redenen en geschiedenis

Waarom een houding verschuift, schrijft de DM op in de DM-notities die er al zijn. Een aparte geschiedenis per verschuiving is niet nodig.

## Data

```json
{
  "id": "alenya-cassalanter",
  "type": "npc",
  "factie": "raad-van-grisburgh",
  "houding": null,
  "insightDC": null
}
```

- `houding`: `null` of een geheel getal van 1 tot 5.
- `insightDC`: `null` (dan geldt de standaard) of een geheel getal.
- Per speler: welke houdingen van welke personages al gezien zijn, voor de eenmalige toast. Per personage: of iemand in de groep de DC al heeft gehaald.
- Bij export en import blijft `null` gewoon `null`, zodat berekende waarden na import ook berekend blijven.
- Oude exports zonder deze velden werken: een ontbrekend veld telt als `null`.

## Buiten scope

- **Houding per speler.** Geparkeerd, omdat het te veel complexiteit toevoegt aan de rest van de app.
- **Een aparte laag voor schijn tegenover werkelijkheid.** Niet nodig. De typewissel bij een onthulling en een hoge insight-DC doen dit al.
- **Een geschiedenis van verschuivingen.** Dat gaat via de DM-notities.
- **Een extra element op het kaartje**, zoals een ring, rand of zegel. Bewust niet gekozen om het kaartje rustig te houden.

## Klaar als

- [ ] Bij hover (desktop) of het openen van de modal (mobiel) trekt het effect van de geldende houding over het kaartje: licht voor 4 en 5, niets voor 3, schaduw voor 1 en 2.
- [ ] Het effect hergebruikt de bestaande glans van items, aangestuurd met CSS-variabelen.
- [ ] Bij reduced motion vervaagt het kaartje kort naar de tint van de houding, zonder beweging.
- [ ] Een lege houding valt eerst terug op de renown van de factie en daarna op de standaard van het type.
- [ ] De DM kan de houding instellen en terugzetten naar de standaard.
- [ ] Bij een wissel van NPC naar antagonist gaat de houding naar 1 en trekt één keer een donkere schaduw over het kaartje.
- [ ] Factiekaartjes gebruiken hetzelfde effect op basis van renown.
- [ ] Spelers hebben een passive insight die automatisch berekend wordt en handmatig te overschrijven is.
- [ ] Elk personage heeft een insight-DC met een vaste standaard die per personage aan te passen is.
- [ ] Spelers zien geen effect tot iemand in de groep de DC heeft gehaald. Een speler die de DC haalt, krijgt één keer per houding een toast op de eigen telefoon.
- [ ] Export en import bewaren de nieuwe velden, en oude exports blijven werken.
