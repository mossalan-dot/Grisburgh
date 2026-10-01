# De Woekeraar — een dienst voor schuld

*Ontworpen 1 okt 2026, na `docs/voorstel-op-de-pof.md`. Nog niet gebouwd.*

Dit vervangt het tweede en derde punt uit het op-de-pof-voorstel. De vorm die
daar werd gezocht — "één schuldenregister waar de Tweespalt-lening een soort
van wordt" — krijgt hier een thuis.

## Waarom een eigen dienst

Niet om de woekeraar. Om het **register**.

Een schuld kan uit het gokhuis komen, maar net zo goed uit een winkel die
aanschrijft, uit losgeld of uit een begrafenis. Zolang `leningen` in een hoek
van het gokhuis zit (`dmState.tweespalt.leningen`), kan er maar één soort
schuld bestaan en is er nergens een overzicht. Een eigen dienst geeft dat
overzicht een plek, en elke toekomstige schuldsoort een rij.

En hij is het enige onderdeel van de app dat **neemt**. De markt geeft
voorwerpen, de tempel zegeningen, de magizoöloog dieren, het gokhuis soms
winst. De woekeraar is de gevolgenmachine die er niet is — en zijn wapen is
tijd, en tijd modelleren we al (`g.rustTellers.long`).

## Vorm

```js
{ id: 'woekeraar', label: 'Woekeraar', groep: 'dienst',
  startset: false, secties: ['woekeraar'] }
```

**Uit by default.** Dit is een stevige smaakkeuze: niet elke tafel wil een
schuldeiser die aanklopt.

Deelfuncties (`ouder: 'woekeraar'`), zodat een DM de scherpe kanten los kan
uitzetten:

| deel | wat het aanzet |
|---|---|
| `woekeraar-escalatie` | de drie trappen hieronder; uit = de schuld groeit alleen |
| `woekeraar-casino` | het aanbod verschijnt bij een verloren weddenschap |
| `woekeraar-winkel` | op de pof kopen op de Markt (later; zie onderaan) |

## Van wie is de schuld

**Van de speler die hem aangaat.** De schuldbrief staat op zijn naam, de
gevolgen treffen hem. De party mag meebetalen uit de gedeelde beurs — dat is
een keuze aan tafel, geen regel in de app.

Dat is bewust het persoonlijke drama: één speler die iets verzwijgt is een
betere scène dan een groepsadministratie. Het register toont per personage.

## Het register

Eén plek: `dmState.schulden` — een lijst, geen map per dienst.

```js
{
  id: 'sch_…',
  characterId: 'e_…',          // van wie
  schuldeiser: { naam, entityId },   // bij wie — een kaartje, geen vrije tekst
  hoofdsomCl: 2880,
  rentePerRust: 30,            // procent per lange rust
  maxFactor: 5,                // het plafond uit _tsSchuld; blijft
  rustStand: 41,               // de stand van rustTellers.long bij afsluiten
  bron: 'gokhuis' | 'winkel' | 'dm',
  trap: 0,                     // 0 niets · 1 brief · 2 onderpand · 3 bezoek
  trapRust: null,              // bij welke ruststand de laatste trap viel
  onderpand: null,             // itemId dat hij nam, als trap 2 viel
  ontspannen: false,           // de-escalatie via renown: rente staat stil
}
```

De bestaande Tweespalt-lening wordt bij de migratie één rij met
`bron: 'gokhuis'`. `_tsSchuld` blijft de rekenmachine, maar verhuist naar een
gedeelde helper — één plek die uitrekent wat er nu staat, zoals het nu ook al
is.

## De drie trappen

De schuld wordt opeisbaar zodra hij het plafond raakt (vijf keer de hoofdsom)
of zodra de DM hem opeist. Daarna escaleert hij per **lange rust**, en elke
trap is een voorstel: **de app rekent, de DM handelt.** Dat is dezelfde regel
als bij de loot-DC en de multiclass-eisen.

### Trap 1 — de brief
Een verzegelde brief van de schuldeiser in zijn post (`_bezorgBrief`, dat er
al ligt, met `cinematic: true` zodat hij op het tafelscherm opengaat). Herhaalt
het bedrag en de termijn. Kost niets, doet alles: hij komt binnen op het moment
dat de speler denkt dat het goed gaat.

### Trap 2 — het onderpand
Bij Verzoeken meldt zich: *"Taevin wil onderpand van Sarbek."* De DM ziet de
boedel van die speler en **wijst zelf een voorwerp aan** — niet willekeurig, en
niet automatisch. Dat voorwerp gaat naar de schuldeiser; de speler ziet het als
onderpand in zijn boedel staan, doorgestreept, met wat het terugkopen kost.

*Waarom de DM kiest:* de app weet niet wat een voorwerp aan tafel betekent. Het
zwaard van je vader en een touw van tien voet staan allebei in de knapzak.

### Trap 3 — het bezoek
De schuld krijgt een **encounter** aangehangen (dezelfde koppeling als bij een
dungeonkamer en een arenapartij: `encounterId` op de schuld). De DM start hem
wanneer het uitkomt. Daarmee wordt de dreiging een scène in plaats van een
getal, en het hergebruikt alles wat het gevecht al kan.

## De-escalatie: renown

**Sta je hoog genoeg bij het Dievengilde of de stadswacht, dan stopt de rente.**
Je betaalt nog wat je geleend hebt — en verder niets.

Dat is geen kwijtschelding en geen verdwijning, maar een afspraak: iemand met
gezag heeft een woordje gedaan. De schuld blijft bestaan, het woekeren stopt.

Technisch: per campagne stelt de DM in welke facties dat gezag hebben en vanaf
welke renown (`meta.woekeraar.ontspanBij = [{ factieId, renown }]`). Zodra een
party daaraan voldoet, krijgt elke lopende schuld van haar leden
`ontspannen: true`: het verschuldigde bedrag valt terug naar de hoofdsom, de
rente telt niet meer, en de escalatie stopt waar hij staat.

Gaat de renown weer omlaag, dan begint het tellen opnieuw vanaf dát moment —
niet met terugwerkende kracht. Een gunst die je verspeelt kost je de toekomst,
niet het verleden.

## Lenen: twee ingangen

### Zijn eigen deur — de gewone weg
Op het dienstscherm staat wat hij vraagt (rente per nacht, het plafond, tot
welk bedrag hij gaat) en één formulier: **hoeveel, en waarvoor**. Je hoeft
niet verloren te hebben om bij hem aan te kloppen — losgeld, een paard, een
begrafenis, een omkoping, een voorwerp op de Markt dat je net niet kunt
betalen. Dat is de hoofdingang; het gokhuis is de zijdeur.

Het gaat **langs de DM**, als verzoek. Dezelfde weg als een spreuk, een
multiclass of een verkoop: de app rekent voor wat het gaat kosten, de DM
beslist of Taevin aan déze persoon leent — en mag het bedrag en de rente
bijstellen voor hij tekent. Een woekeraar die automatisch ja zegt is een
geldautomaat.

Het veld **waarvoor** is geen administratie maar materiaal: een schuldeiser
die weet waar je geld heen ging, weet waar je zwak zit. Het komt mee in het
verzoek en blijft bij de schuld staan.

Per campagne stelt de DM in: het hoogste bedrag dat hij uitleent, de rente per
nacht, en of een speler meerdere schulden tegelijk mag hebben (standaard: nee —
één schuld per personage houdt het verhaal leesbaar).

### Bij het gokhuis — de zijdeur
Verlies je je inleg bij een weddenschap of in het strijdperk en je beurs is
leeg, dan verschijnt hetzelfde aanbod **daar**, op het moment dat het pijn
doet. Eén knop onder de uitslag, geen apart bezoek — maar wel hetzelfde
verzoek, dus ook hier beslist de DM.

## Aflossen — en dit moet eerst

Vandaag kun je niet aflossen. De hulptekst zegt het zelf: *"dat doe je door het
schuldbewijs uit de boedel van de speler te halen."* Een speler die het geld
bij elkaar spaarde kan dus niets.

Dat is de eerste bouwstap, los van al het bovenstaande: **een knop bij de
banner.** Bedrag eraf, schuldbewijs weg, regel uit het register. Ook deels
aflossen — dan daalt de hoofdsom en gaat het tellen verder over de rest.

## Volgorde van bouwen

1. **Aflossen** (halve dag). Maakt het bestaande meteen heel, en hangt nergens
   aan vast.
2. **Het register + de dienst** (dag). Migratie van de Tweespalt-lening, het
   DM-overzicht, en de dienst zelf: zijn voorwaarden, het leenformulier en het
   verzoek dat daaruit komt.
3. **De drie trappen** (dag). Brief, onderpand via Verzoeken, encounter.
4. **De renown-de-escalatie** (halve dag). Hangt aan 2.
5. **Het casino-aanbod** (paar uur) — de zijdeur, zodra de hoofdingang werkt.
6. **Op de pof in de winkel** — pas hierna, want dan is het een tweede `bron`
   in een register dat al werkt, in plaats van een tweede mechaniek.

## Wat eerst rechtgezet moet worden

- De hulptekst bij *Gokken → Leningen* belooft: *"Een lening van een personage
  dat niet meer bestaat kun je hier weghalen."* **Die knop bestaat niet** — het
  woord "lening" komt in het hele DM-paneel niet voor. Of bouwen, of de zin
  weghalen; nu staat er een aanwijzing naar een plek die er niet is.
- De hulptekst *"Aflossen gaat via jou"* kan weg zodra stap 1 er is.

## Open gelaten

- **De winkel heeft geen kas.** Blijft zoals het is (zie het oude voorstel).
  Heroverwegen als stap 6 er is: dan wordt "de smid is blut" wél een verhaal.
- **Rente per schuldeiser.** Nu één percentage per schuld; of een schuldeiser
  een eigen tarief heeft is een vraag voor als er meer dan één is.
