# Voorstel: de Markt — één plek voor alle winkels

Gevraagd op 15 september 2026: *"een dienst waarin we alle winkels (met
voorraad) bundelen. Dat scheelt zoeken in de locatieapp, en we kunnen er
allerlei nieuwe functionaliteiten over bedenken."*

---

## Wat er nu staat

Een winkel is geen eigen ding in de app: het is een **tabblad op een kaartje**.
Een locatie (of een personage met de rol *verkoper*) krijgt bij `data.voorraad`
een tab *Winkel*, en daar zit de hele machinerie achter:

| bestaat al | waar |
|---|---|
| voorraad, prijzen, uitverkocht per party | `data.voorraad`, `g.shopUitverkocht` |
| wisselend assortiment, ververst na een rust | `winkelConfig.roterend`, `_ligtInDeSchappen`, `g.shopRotatie` |
| kopen en verkopen, met de gedeelde beurs | `POST /shops/:id/koop` · `/verkoop` |
| onderhandelen | `POST /shops/:id/onderhandel` |
| humeur van de winkelier, tijdelijke korting | `/humeur`, `g.shopTempDiscount` |
| DM verkoopt of koopt namens de winkel | `/dm-verkoop`, `/dm-inkoop`, `/party-boedel` |
| wat er verkocht is | `GET /shops/:id/log` |

**De machinerie is dus niet het probleem — de ingang is het.** Er is geen enkel
scherm waar je ziet dát er negen winkels zijn. Je moet weten dat Stoom en Staal
bestaat, het kaartje opzoeken in Locaties, en dan het tabblad vinden.

### Wat er in Grisburgh ligt (15 sep 2026)

- **9 winkels**, samen **122 voorraadregels**. 79 daarvan wijzen naar een
  voorwerp-kaartje, 43 zijn losse tekst.
- Eén winkel is roterend (Mystieke Magazijn); de rest ligt vast.
- **16 voorwerpen liggen bij meer dan één winkel.** Een Potion of Healing is bij
  vier plekken te koop — en bij Bobo's Biologische Brouwsels kost hij **40 fl**
  waar hij elders **20 fl** is.

Die laatste regel is het hele argument. Dat prijsverschil bestáát al, het is
alleen door niemand ooit gezien.

---

## Wat de Markt is

Een **dienst** (`secties: ['markt']`, één regel in `lib/modules.js`) met één
scherm: alle winkels die deze party kent en nu kan bereiken, met wat er vandaag
in de schappen ligt.

**Het is een weergave, geen tweede opslag.** De voorraad blijft op het kaartje
staan. Zelfde regel als bij `betrokkenen`: één plek, twee kanten. Kopen,
verkopen en onderhandelen gaan door dezelfde routes als nu — de Markt is een
andere deur naar hetzelfde huis.

### Twee ingangen, geen derde scherm

Klikken op een winkel in de Markt opent het **bestaande** winkeltabblad. Er komt
dus geen tweede koopscherm bij dat uit de pas gaat lopen.

---

## Wat het nieuw mogelijk maakt

Dit is waar het interessant wordt, en het is allemaal alleen mogelijk zodra de
winkels naast elkaar staan.

1. **Zoeken over alle winkels heen.** "Waar kan ik een Potion of Healing
   krijgen?" is nu een vraag aan de DM. Het wordt een zoekveld. Zelfde
   machinerie als de spreukenbibliotheek (`window._normSearch`/`_searchTokens`).
2. **Prijzen naast elkaar.** Voor de 16 voorwerpen die op meerdere plekken
   liggen: waar het goedkoopst is, en hoeveel je bespaart met lopen. Dat maakt
   van "ik koop een drankje" een keuze.
3. **Wat de party kan betalen.** De beurs staat erbij (via `_effectiveCurrency`,
   dus de gedeelde beurs als die aanstaat), en wat je niet kunt betalen is
   zichtbaar te duur in plaats van pas bij het afrekenen.
4. **Nieuw in de schappen.** Een roterende winkel ververst na een lange rust;
   een markering "nieuw sinds jullie laatste nacht" geeft een reden om terug te
   komen. De teller bestaat al (`g.rustTellers.long`).
5. **Een boodschappenlijst.** Vink aan wat je wil, zie het totaal, en wat er
   bij welke winkel ligt. Aan tafel is dat precies het gesprek dat je wil
   ("we halen dit hier, de rest bij Bobo").
6. **Voor de DM: één overzicht.** Nu stel je prijzen en voorraad per kaartje in.
   Eén tabel over alle winkels maakt bijstellen vóór een sessie een minuut werk
   in plaats van negen kaartjes langs.

De opstap naar **op de pof** (`docs/voorstel-op-de-pof.md`) ligt hier ook: dat
voorstel geeft elke winkel een kredietinstelling, en dit is het scherm waar je
ziet wie je wat schuldig bent.

---

## Waar het mis kan gaan

Vier dingen, en de eerste is een echte val.

### 1. `GET /shops/:id/beschikbaar` schrijft

Bij een roterende winkel **maakt** die route de rotatie als die er nog niet is,
en schrijft `dm-state.json`. Een Markt-scherm dat netjes alle negen winkels
opvraagt, rolt dus in één klap ieders schappen — op een moment dat niemand die
winkel bezocht.

**Dus:** de Markt krijgt zijn **eigen leesroute** (`GET /markt`) die de rotatie
*leest* maar nooit aanmaakt. Ligt er nog geen selectie, dan toont de Markt de
winkel zonder lijst ("kom langs om te zien wat er ligt"). De rotatie ontstaat
pas als je de winkel binnenloopt — wat precies is wat de rotatie betekent.

### 2. Het mag de wereld niet kleiner maken

Een smid vinden is spel. De Markt toont daarom **alleen** wat deze party al
ontdekt heeft (`g.visibility`) én wat tijdens deze akte bereikbaar is
(`meta.hoofdstukken[key].onbereikbaar`, `_bereikbaarheidVoor`). Beide regels
bestaan al; de Markt volgt ze, hij omzeilt ze niet.

Een winkel die je nog niet kent staat er niet — ook niet als "onbekende winkel".
Zelfde clou als bij een geheime verbinding: dát er iets is, is de helft.

### 3. Het assortiment mag niet uitlekken

`_ligtInDeSchappen` bepaalt wat er vandaag ligt. De Markt toont dát, nooit de
hele pool — anders is de verrassing van een roterende winkel weg.

### 4. Prijsnotatie

De voorraad bewaart prijzen als tekst: `20 fl`, `1 kn.` (mét punt). Zolang je
alleen kijkt is dat prima, maar vergelijken en optellen vraagt een getal. Dat
kan met de bestaande `parsePrijs` (die kent ook `ep`/`pp`), maar een regel die
hij niet leest moet zichtbaar overgeslagen worden — niet stil op 0 gezet.

---

## Volgorde

**Stap 1 — de lijst.** Sectie *Markt*, module in `lib/modules.js`, route
`GET /markt` die per bereikbare winkel naam, beeld, soort, aantal items en
sfeertekst geeft. Klikken opent het bestaande winkeltabblad. Klein, en op
zichzelf al de winst die gevraagd is: geen zoeken meer.

**Stap 2 — zoeken en vergelijken.** Eén zoekveld over alle voorraad, met per
treffer waar het ligt en wat het kost. Hier komt het prijsverschil boven water.

**Stap 3 — de beurs en de boodschappenlijst.** Wat kun je betalen, wat kost het
samen, waar moet je heen.

**Stap 4 — het DM-overzicht.** Eén tabel om voorraad en prijzen bij te stellen.

Stap 1 en 2 zijn samen ongeveer een dag. Stap 3 en 4 zijn los bruikbaar en
kunnen wachten.

---

## Wat het níét wordt

Geen webshop. Je koopt niets vanaf de bank: de Markt is een **overzicht van waar
je heen kunt**, en het afrekenen gebeurt in de winkel — met de winkelier, zijn
humeur en het onderhandelen dat daarbij hoort. Dat is het spel; een knop
*Bestellen* haalt het eruit.
