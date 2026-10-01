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
| `woekeraar-opduiken` | hij mengt zich waar het om iets groots gaat: de Markt |

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

### Trap 2 — het onderpand, en de scène eromheen
Bij Verzoeken meldt zich: *"Taevin komt iets halen voor de schuld van Sarbek."*
De DM kiest uit de spullen van **de hele party** en wijst zelf aan wat er
verdwijnt — niet willekeurig, en niet automatisch.

*Waarom de hele party:* Strum pakt wat voor het grijpen ligt, en dat is zelden
van de juiste persoon. Daarmee wordt een privéschuld een tafelprobleem. En de
brief die hij achterlaat gaat naar **iedereen**, met de naam van de schuldenaar
erin en waarvoor hij leende. Wie anoniem gokte heeft op dat moment iets uit te
leggen — en dát is de scène, niet het verloren voorwerp.

De DM kan die onthulling nog even bewaren: een vinkje maakt er *"iemand onder
jullie"* van. Dan weet de party dat er iemand in het krijt staat, maar niet wie.

*Waarom de DM het voorwerp kiest:* de app weet niet wat een voorwerp aan tafel
betekent. Het zwaard van je vader en een touw van tien voet staan allebei in de
knapzak. Niets kiezen mag ook — dan is hij langs geweest en vond hij niets van
zijn gading, en ook dat is een mededeling.

Het voorwerp komt terug bij wie het kwijt was zodra de schuld voldaan is.

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

### Waar je tekortkomt — hij mengt zich
**Hij is de enige die leent.** Een winkel schrijft niet aan, een tempel geeft
geen krediet, de herberg laat niet aanschrijven. Dat is geen beperking maar de
vorm: één geldschieter, één mechaniek, één register — in plaats van per dienst
een eigen soort schuld met eigen regels.

Wat er wél kan: **hij duikt op**. Kom je op de Markt geld tekort voor dat
harnas, dan staat er naast de weigering een tweede knop — niet *"de smid
schrijft aan"* maar *"Woekeling staat toevallig achter je"*. Hetzelfde
verzoek, dezelfde schuld, dezelfde trappen. Alleen de plek verschilt.

Dat is ook dramatisch juister: een woekeraar die precies opduikt waar je iets
wilt dat je niet kunt betalen is een personage. Een winkel met een
krediethokje is een formulier.

**Maar niet overal.** Hij duikt op bij de **Markt** en bij het **gokhuis**, en
daar houdt het op:

- **De herberg niet.** Daar gaat het om een bed en een biertje. Een woekeraar
  die opduikt omdat je drie koperstukken tekortkomt voor je avondmaal is geen
  dreiging maar een grap, en hij slijt.
- **De tempel niet.** Geld lenen om een zegen te kopen voelt blasfemisch, en
  dat is precies het soort wrijving dat je niet per ongeluk in een spel wilt
  hebben. Als een DM dat wél wil, is het een scène die hij zelf maakt — geen
  knop die de app aanbiedt.

De maat is dus: **waar het om iets groots gaat.** Een harnas, een paard, een
schuld die je aan tafel verliest. Niet waar je een rekening afrekent.

Eén deelfunctie (`woekeraar-opduiken`) zet de plekken aan of uit die er zijn.

### Bij het gokhuis — de zijdeur
Verlies je je inleg bij een weddenschap of in het strijdperk en je beurs is
leeg, dan verschijnt hetzelfde aanbod **daar**, op het moment dat het pijn
doet. Eén knop onder de uitslag, geen apart bezoek — maar wel hetzelfde
verzoek, dus ook hier beslist de DM.

**Die zijdeur bestaat alleen als de woekeraar aanstaat.** Dat is geen extra
regel maar wat `ouder: 'woekeraar'` al betekent: staat de dienst uit, dan doet
het deel er niet toe. Maar het staat hier expliciet omdat de knop in een
ánder scherm verschijnt dan de dienst waar hij bij hoort — het gokhuis moet
dus de woekeraar-module controleren, niet zijn eigen. Dat is de eerste keer
dat een dienst iets toont dat van een andere dienst is, en precies zo'n plek
waar het later stilletjes misgaat als het nergens staat.

Omgekeerd geldt het ook: zet een DM de woekeraar aan maar het casino-deel uit,
dan is er een woekeraar die je alleen aan zijn eigen deur spreekt. Dat is een
geldige campagne.

## Wat er gebeurt met een bestaande schuld als de dienst uitstaat

De Tweespalt-lening van vandaag verhuist bij de migratie naar het register. Is
de woekeraar dan uit, dan is die schuld onzichtbaar — niet weg, maar
onbereikbaar: de speler ziet geen banner en kan niet aflossen.

Twee uitwegen, en de tweede is beter:

1. De migratie zet de dienst aan in elke campagne die al een lening heeft.
   Werkt, maar het zet ongevraagd iets aan.
2. **De schuld blijft zichtbaar waar hij ontstond.** De banner bij het gokhuis
   blijft bestaan zolang er een schuld met `bron: 'gokhuis'` openstaat, ook met
   de woekeraar uit — inclusief de aflosknop uit stap 1. De dienst voegt het
   register, de trappen en het lenen tóe; hij is geen voorwaarde om een
   bestaande schuld te mogen zien.

Dat is ook de eerlijkere regel: een module uitzetten hoort te verbergen wat die
module brengt, niet wat er al was. Zelfde gedachte als bij de bereikbaarheid
van winkels — uitzetten laat niets achter wat je kwijtraakt.

## Aflossen — en dit moet eerst

Vandaag kun je niet aflossen. De hulptekst zegt het zelf: *"dat doe je door het
schuldbewijs uit de boedel van de speler te halen."* Een speler die het geld
bij elkaar spaarde kan dus niets.

Dat is de eerste bouwstap, los van al het bovenstaande: **een knop bij de
banner.** Bedrag eraf, schuldbewijs weg, regel uit het register. Ook deels
aflossen — dan daalt de hoofdsom en gaat het tellen verder over de rest.

## De koppeling in Grisburgh

De kaartjes bestaan al; de dienst hoeft ze alleen aan te wijzen.

| rol | kaartje |
|---|---|
| de schuldeiser | **Taevin Woekeling** (personage, `e_1773523435098_p3vxjp`) |
| zijn zaak | **Woekeling & Co.** (locatie, `e_1773523435071_ut1xxe`) |
| wie hij stuurt | **Strum** (personage, `e_1773523435098_yg2jmc`) |

Strum heeft nog **geen statblok en geen encounter** — die moeten gemaakt worden
voordat trap 3 iets kan starten. Dat is bewust werk van de DM: wie hij stuurt
en hoe zwaar dat weegt is een tafelbesluit, geen instelling. De dienst wijst
alleen de encounter aan die er dan is, zoals een arenapartij dat ook doet.

Niets hiervan staat in de code: de dienst heeft velden voor schuldeiser, zaak
en encounter, en Grisburgh vult ze in. Een andere campagne vult er haar eigen
namen in.

## Volgorde van bouwen

**Stap 1 t/m 5 zijn gebouwd op 1 okt 2026.** Wat er nog ligt is stap 6: hij
duikt op bij de Markt.

1. [x] **Aflossen** (halve dag). Maakt het bestaande meteen heel, en hangt nergens
   aan vast.
2. [x] **Het register + de dienst** (dag). Migratie van de Tweespalt-lening, het
   DM-overzicht, en de dienst zelf: zijn voorwaarden, het leenformulier en het
   verzoek dat daaruit komt.
3. [x] **De drie trappen** (dag). Brief, onderpand via Verzoeken, encounter.
4. [x] **De renown-de-escalatie** (halve dag). Hangt aan 2.
5. [ ] **Het casino-aanbod** (paar uur) — de zijdeur, zodra de hoofdingang werkt.
6. **Hij duikt op waar je tekortkomt** — op de Markt. Pas hierna,
   want dan is het dezelfde knop op een andere plek in plaats van een tweede
   mechaniek. Geen enkele dienst krijgt een eigen krediet.

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
