# Tafelscherm: effecten en geluid

Werkdocument, 4 sep 2026. **Nog niets gebouwd** — dit is het voorstel.

## Wat er nu is

Drie effecten: **bliksem**, **windvlaag**, **duister**. De DM drukt op een knop
in de sfeerstrook, `POST /display/effect` controleert de naam tegen een lijstje
van drie en stuurt `display:effect` naar de campagne-room; `_displayEffect()` in
`app.js` legt er een `.display-fx`-laag overheen (of laat de embers één keer
opwaaien) en haalt die na een paar seconden weg. Geluid zit er niet aan vast.

Geluid werkt al wél zo bij loot: `sounds.json` → `momenten.lootReveal` is een
fileId, en de server stuurt `sound:reveal` op het moment dat de kist opengaat.
Dat is precies het haakje dat effecten nodig hebben.

## Wat het moet worden

**Elk effect is een moment met een optioneel geluid.** Eén catalogus in
`lib/display-fx.js`, en daaruit volgt alles: de knoppen bij de DM, de
whitelist op de server, de CSS-klasse op het tafelscherm en de rij in de
Geluiden-tab waar je er een klank aan hangt.

```js
{ id: 'wond', label: 'Wond', soort: 'flits', duur: 900 }
```

- **`flits`** — eenmalig, ruimt zichzelf op. Bliksem, wond, genezing.
- **`toestand`** — blijft staan tot de DM hem uitzet (`effect: 'uit'`).
  Mist, duisternis, het rode scherm bij 0 HP.

Het onderscheid is er omdat een toestand een uitknop nodig heeft en een flits
niet; zonder dat verschil krijg je een scherm dat blauw blijft omdat iemand
tweemaal drukte.

## Voorgestelde effecten

Volgorde = wat ik als eerste zou bouwen. Alles is CSS of canvas; geen
afbeeldingen nodig, dus het kost niets aan schijfruimte of laadtijd.

| Effect | Soort | Beeld | Wanneer |
|---|---|---|---|
| **Wond** | flits | rode vignette klapt vanaf de randen naar binnen, 0,9 s | iemand incasseert een klap |
| **Kritiek** | flits | zelfde maar feller, korter en met een schok in het beeld | crit, of een klap die telt |
| **Op sterven na dood** | toestand | donkerrode vignette die traag ademt | speler op 0 HP; blijft tot hij weer bijkomt |
| **Genezing** | flits | warme gouden gloed die van onderaf opzwelt en wegtrekt | healing word, potion |
| **Vuur** | toestand | oranje gloed onderin, vonken versneld omhoog | brandende kamer, fireball-nasleep |
| **Vrieskou** | toestand | blauwwitte rijp kruipt vanuit de hoeken naar binnen | koude, ijs, een winterse nacht |
| **Gif** | toestand | groene waas die langzaam golft | gifwolk, ziekte, moeras |
| **Magie** | flits | paarsblauwe schokgolf vanuit het midden | een bezwering die aanslaat |
| **Aardbeving** | flits | het hele scherm schudt 1,5 s, stof dwarrelt | instorting, iets groots dat landt |
| **Regen** | toestand | druppels over het scherm (canvas) | storm, reis in de regen |
| **Mist** | toestand | trage grijze sluier die opkomt en blijft | moeras, spookachtige stilte |
| **Fluistering** | toestand | randen die langzaam in- en uitademen | onheil, iets dat meeluistert |
| **Glinstering** | flits | korte gouden schittering over het beeld | schat, een zegen, iets kostbaars |

De bestaande drie (bliksem, windvlaag, duister) blijven en verhuizen naar
dezelfde catalogus.

## Geluid: vast aan het effect

Het geluid hoort bij het effect, niet bij de campagne — een wond klinkt overal
hetzelfde. Dus geen instelling per campagne die een nieuwe DM eerst moet vullen:
**de klank zit in de catalogus, naast het beeld.**

Blijft de vraag waar die klank vandaan komt. Twee wegen:

**a. Gemaakt in de browser (voorkeur).** Korte klanken laten zich synthetiseren
met de WebAudio API: een dreun is een lage sinus die in 200 ms wegzakt met een
ruisflard eroverheen, een schittering een paar hoge tonen met lange uitloop,
regen is gefilterde ruis. Kost **nul bestanden**, geen licentiegedoe, geen
laadtijd, werkt offline, en het is regelbaar per effect (harder, lager, langer).
Nadeel: het klinkt gemaakt. Voor een dreun of een schittering is dat prima; een
overtuigende donderslag of echte regen krijg je er niet mee.

**b. Meegeleverde bestanden.** Een handvol korte CC0-samples in
`public/assets/sfx/`. Klinkt beter, maar iemand moet ze zoeken en de licentie
bijhouden, en ze gaan mee in elke deploy. Ik kan ze niet zelf maken — die zou jij
moeten aanleveren.

Voorstel: **(a) voor alles wat een dreun, tik of glinstering is, (b) later voor
donder, regen en vuur** als je die echt wilt horen. En voor beide geldt: de DM
mag een effect alsnog een eigen klank uit de bibliotheek geven
(`sounds.json` → `momenten.fx.<effect-id>`), maar hoeft dat nooit — het werkt uit
zichzelf. Een **toestand** mag een lus zijn (regen die blijft ruisen), een
**flits** nooit; dat volgt uit de catalogus.

## Vanzelf laten gebeuren

Het mooiste effect is er een waar niemand op hoeft te drukken. Twee kandidaten,
allebei uit gebeurtenissen die er al zijn:

- **Wond bij schade.** De DM past HP aan → `player:hp-updated` gaat toch al naar
  de campagne-room. Daalt het HP, dan flitst het tafelscherm rood; valt iemand
  op 0, dan schakelt het naar de toestand *op sterven na dood* tot hij weer boven
  nul komt.
- **Vuur/duister bij een sfeerwissel.** Sfeerloops schakelen al per sectie; een
  effect eraan hangen is dezelfde haak.

Wel **per campagne aan of uit** (`meta.tafelscherm.autoFx`), want niet elke tafel
wil dat het scherm meepraat bij elke schrammetje. Standaard uit.

## Over een gevecht heen — nu nog niet

Dit is precies waar het misgaat, en het is niet toevallig het geval waarvoor je
het wilt: laag HP ontstaat in een gevecht.

`.display-fx` staat nu `position: absolute; z-index: 5` **binnen** `#display-idle`
— het sfeerscherm. De gevechtsweergave op de tablet is `.combat-overlay`,
`position: fixed; z-index: 55`, en dekt dat sfeerscherm volledig af. Een effect
tijdens een gevecht is dus onzichtbaar; het zit eronder, in een container die op
dat moment niet eens in beeld is.

De oplossing is klein maar moet vóór de rest: **de effectlaag wordt een eigen
overlay op `<body>`**, `position: fixed`, `inset: 0`, `pointer-events: none`,
`z-index: 90` — boven het gevecht (55), boven de brief- en lootcinematics, onder
niets. Dan werkt hetzelfde effect over het sfeerscherm, een getoonde afbeelding,
de dungeonkaart én het gevecht. Dat is ook waarom de wond-flits pas iets waard
is als dit eerst gebeurt.

## Waar het misgaat als we niet opletten

- **Twee effecten tegelijk.** Een tweede flits over een eerste heen geeft een
  knipperend scherm. De laag moet de vorige vervangen, niet stapelen — behalve
  een toestand, waar een flits juist overheen mag.
- **Epilepsie.** Bliksem en kritiek zijn felle wisselingen. `prefers-reduced-motion`
  respecteren (zachter, geen schok), en niet sneller dan drie flitsen per seconde.
- **De tablet is geen speler.** Alles gaat naar de campagne-room, niet naar een
  speler-socket; `_isDisplayMode` bepaalt wie het toont. Zelfde patroon als
  `brief:display` en `loot:display`.
- **Geluid zonder gebruikersgebaar.** Browsers blokkeren audio tot er één keer
  geklikt is op dat scherm. Het tafelscherm wordt door de DM omgezet, dus dat
  gebaar is er — maar na een herstart van de tablet niet meer. Bij het opstarten
  van het tafelscherm één "tik om te beginnen" is genoeg.

## Openstaande vragen

1. Welke effecten uit de tabel wil je echt? Alles bouwen is zonde als de helft
   nooit gebruikt wordt.
2. Automatische wond-flits: aan of uit bij Grisburgh?
3. Moet een toestand ook vanzelf aflopen (bijvoorbeeld mist na tien minuten), of
   blijft hij tot de DM hem wegklikt?
4. Gesynthetiseerd geluid voor alles, of lever je losse samples aan voor donder,
   regen en vuur?
