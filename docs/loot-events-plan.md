# Loot-events — ontwerp

Status: **ontwerp, nog niets gebouwd.** Opgesteld 3 sep 2026.
Raakt de akteregie, de dungeonkaarten, de tabletmodus en het begrip "actieve
groep". Hangt samen met `docs/multi-dm-plan.md` (stap 4, modules).

---

## Wat er nu al is

`dmState.lootPhase` — één verdeling tegelijk, campagnebreed, met zeven endpoints
onder `/combat/loot`:

- Bron: uitsluitend `encounters.json` → `enc.loot` (goud + items), of wat de DM
  ter plekke intypt.
- Deelnemers: de spelers uit het actieve gevecht; is dat er niet, dan alle
  spelers van de actieve groep.
- Spelers claimen in hun **Boedel**-tab (badge op het tabblad). Claimen twee
  spelers hetzelfde item, dan rolt de server d20 met herrol bij gelijkspel.
- Toewijzen zet het item in `playerItems`; goud wordt verdeeld. Een lootitem mag
  verwijzen naar een echt voorwerp-kaartje (`entityId`).
- Socket: `loot:aangeboden`, `loot:claim-update`, `loot:verdeeld`.

**De tablet doet nu niets met loot.** `socket-client.js` kent bij deze events
geen `_isDisplayMode`-tak; de onthulling landt alleen op de telefoons.

**Dungeonkamers hebben geen loot.** Een kamer is `{id, name, dmNotes, shape,
points, entrances}` — geen vondsten, geen DC.

## Het model

Een **loot-event** is één vondst: een geldzak in de haard, een zwaard onder de
plavuizen. Eén kamer kan er meerdere hebben.

```
loot-event
  naam        "Geldzak in de haard"
  dc          12          ← vast getal, puur informatief
  vaardigheid "Investigation"
  items[]     meerdere, elk eventueel gekoppeld aan een voorwerp-kaartje
  goud        optioneel
  mimic       optioneel: verwijzing naar een encounter
```

**De DC is een aantekening, geen mechaniek.** De spelers gooien aan tafel; de DM
ziet de DC naast de vondst staan en beslist. Onthullen is dus altijd een klik van
de DM — nooit een ingevoerde worp, nooit iets per speler. Dat scheelt de hele
constructie van "wie zag wat".

**Waar een event aan hangt:** een dungeonkamer, een encounter, een akte-stap, of
nergens (los onthullen). Koppelen kan van **twee kanten** — vanuit de kamer een
vondst kiezen of maken, én vanuit het loot-tabje een kamer aanwijzen — want het
hangt ervan af waar je mee begint: de dungeon of de loot.

**Onthullen:** de DM vinkt één of meerdere vondsten aan en onthult ze in één
keer. In de verdeling blijven ze apart benoemd ("uit de haard", "onder de
plavuizen"), zodat de flavour niet in één hoop verdwijnt.

**Niet-onthulde loot vervalt.** Tijdens de akte kan de party terugkomen naar een
kamer, dus zolang de akte loopt blijft een vondst staan. Daarna is hij weg —
niet gevonden is niet gevonden, en de DM krijgt daar géén herinnering over. Wil
je 'm alsnog uitdelen, dan doe je dat met de hand.

**Sjablonen en toeval.** Vondsten zijn herbruikbaar als sjabloon (een standaard
wachtkamer-kist) en mogen toeval bevatten: een bedrag binnen een marge, of "een
willekeurig common item". Het toeval wordt gerold op het moment van onthullen,
zodat de DM ziet wat het geworden is; een sjabloon wordt bij gebruik gekopieerd,
zodat een latere wijziging aan het sjabloon niets omgooit wat al onthuld is.

## De tablet

Hier gebeurt het, in dezelfde twee-traps vorm als de verzegelde brief
(`_briefCinematic`): op het gedeelde scherm staat een **schatkist**. Er wordt op
geklikt, en dan pas verschijnt de buit.

Daarna toont de tablet de items zelf, met daaronder wie ze claimt: "geclaimd
door X" met het portretje van die speler. Claimen er meerdere, dan staan er
meerdere portretjes bij — "X en Y maken ruzie om de buit" — tot de afrol
uitsluitsel geeft. De telefoons houden hun huidige rol: daar claim je.

**De mimic** is dezelfde kist, maar bij het openklikken volgt geen buit maar een
cinematisch moment en daarna een encounter. Technisch is dat één veld op het
event: een verwijzing naar de encounter die dan start.

### Het beeldmateriaal

Er ligt een Midjourney-animatie van een openende kist (624×624, 5,21s). Die past
precies op de twee-traps vorm:

- **Frame 0** — de kist dicht. Dit is de poster op de tablet, vóór de klik.
- **Afspelen** — de vijf seconden waarin het deksel opengaat en het goud
  zichtbaar wordt.
- **Laatste frame** — de camera is dan ver ingezoomd: het deksel valt buiten
  beeld en je ziet vooral goud. Dat werkt als eindbeeld, maar wie de héle open
  kist in beeld wil, kan beter het frame rond **3,2s** bevriezen; daar staat de
  kist compleet open en volledig in beeld.

Aandachtspunten bij het inbouwen:
- Het bronbestand is 5,0 MB voor 624px — dat is ruim 8 Mbps, veel te hoog. Een
  heromzetting houdt dezelfde afmeting maar halveert het naar 2,2 MB.
  De losse frames als JPEG zijn ~120 KB tegen ~700 KB als PNG.
- Dit is **app-materiaal, geen campagne-inhoud**: elke DM krijgt dezelfde kist.
  Het hoort dus in `public/assets/` (net als de kaartafbeeldingen) en niet in de
  mediabibliotheek van een campagne, zodat het niet tegen het mediabudget telt.
- De itemlijst verschijnt ná de animatie. Omdat het eindbeeld een druk
  goud-close-up is, wil je daar waarschijnlijk overheen vloeien naar het rustiger
  3,2s-beeld voordat de namen en portretjes erop komen.

## Aanwezigheid per sessie

Losse vondst tijdens dit ontwerp, en breder dan loot alleen: **er bestaat geen
begrip "niet-actieve speler"**. In de data is Prinses Madelief gewoon een speler
in `groep1`, net als Orphéan en Sarbek — geen vlag op de entiteit, geen lijst in
de groep. Daardoor duikt ze overal op waar de code "alle spelers van de actieve
groep" ophaalt: **24 plekken** (veertien in `routes/api.js`, tien in de
frontend) — encounters, lootdeelnemers, rust, goudverdeling, party sheets.

Keuze: **aanwezigheid per sessie**, niet een permanent vinkje. Aan het begin van
een sessie vink je af wie er is; dat stuurt wie er in een encounter komt, wie mag
claimen, wie meedeelt in het goud en wie een rust meemaakt. Voor een nieuwe DM is
dat ook het makkelijkst uit te leggen: "wie zit er vanavond aan tafel?"

## Waar het in de Meesterkamer komt

Een **eigen tabblad**, niet onder Gevecht — daar staan al drie subtabs.

## Nog te beslissen bij de bouw

1. De endpoints heten nu `/combat/loot/...` terwijl loot losstaat van gevechten.
   Hernoemen naar `/loot/...` raakt `api.js`, `dm-panel.js` en `app.js` tegelijk:
   in één keer doen of laten staan.
2. Welke van de 24 "spelers van de groep"-plekken de aanwezigheid moeten
   respecteren. Encounters, loot en rust: ja. Party sheets: waarschijnlijk niet
   (je print voor de hele groep). Per plek langslopen.
3. Houdt de party de buit van een mimic nadat ze hem verslagen hebben? Dat kan
   door aan de mimic-encounter zelf een gewoon loot-event te hangen.
