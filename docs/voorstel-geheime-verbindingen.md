# Geheime verbindingen

*Opgesteld 8 sep 2026. Nog niet gebouwd — ligt ter beoordeling.*

## Wat er nu misgaat

De vriendelijke waard Bram staat op het kaartje van De Roodzwaarden als
*Leider*. Beide kaartjes mogen bekend zijn — de herberg is bekend, de bende is
bekend — maar dát Bram hun leider is, is de plot. Vandaag is er geen manier om
die ene regel achter te houden: een verbinding is zichtbaar zodra beide
kaartjes zichtbaar zijn.

## Waar we op voortbouwen

Twee dingen die er al zijn en die precies passen:

- **Een geheim is een lijst, per regel te onthullen, per party.**
  `data.geheimen` met `groups[gid].secretReveals[id]` als lijst booleans.
- **Een geheimregel kan al een gevolg dragen.** `data.geheimenAntagonist` is een
  parallelle lijst vinkjes: onthul je díé regel, dan wordt het personage een
  antagonist (kleur, badge, kant in gevecht). Dat is exact de vorm die we hier
  nodig hebben — een tweede soort gevolg naast de eerste.

## Het voorstel

Een regel in `data.betrokkenen` krijgt een optioneel veld:

```
{ naam: 'Bram Kruik', rol: 'Leider', id: 'e_…', geheim: { id: 'e_…', i: 2 } }
```

`geheim` wijst naar een **geheimregel op een kaartje**: welk kaartje, welke
regel. Zolang die regel voor een party niet onthuld is, bestaat de verbinding
voor die party niet. Onthul je hem, dan verschijnt de verbinding — aan beide
kanten tegelijk, want de andere kant is afgeleid.

Waarom aan een geheim en niet gewoon een vinkje "verborgen": een kale verbinding
die uit het niets verschijnt is geen onthulling. Het geheim is waar het verhaal
staat ("De waard telt 's nachts andermans geld"), en de verbinding is wat er
mechanisch uit volgt. Eén handeling, twee gevolgen — net als bij de antagonist.

**Welk kaartje het geheim draagt, kiest de DM.** Het ligt voor de hand op Bram
("Bram is de leider van De Roodzwaarden") óf op de bende ("hun leider schenkt
overdag bier"). Allebei mag; de verwijzing bevat het id, dus de regel hoeft niet
op hetzelfde kaartje te staan als de verbinding. In de editor bied je bij het
aanvinken de geheimen van de twee betrokken kaartjes aan, plus *nieuw geheim
schrijven*.

## Wat de speler ziet

**Niets.** Geen regel, geen rol, geen "onbekend". Dat is bewust anders dan de
bestaande behandeling van een betrokkene wiens kaartje de party nog niet kent:
daar staat wél een regel met een rol en een schuilnaam, want dát er iemand is
mag je weten. Bij een geheime verbinding is juist het bestáán ervan de clou —
"Leider — Onbekend" op het bendekaartje verklapt dat er een leider is die je
kent.

## Wat de DM ziet

De regel staat er gewoon, met een slotje en de eerste woorden van het geheim
waar hij aan hangt. Klikken opent dat geheim, zodat onthullen één klik is vanaf
de plek waar je de verbinding ziet staan.

## Waar het in de code raakt

- `filterEntityForPlayer()` — bij het filteren van `betrokkenen` de regels
  weglaten waarvan het gekoppelde geheim voor deze party nog dicht staat.
- Diezelfde filter op `_hoortBij` (de afgeleide andere kant), zodat de
  verbinding ook niet op het personagekaartje opduikt.
- `_betrokkenIndex()` blijft ongemoeid: die is campagnebreed en gecachet op
  mtime; het per-party weglaten hoort in de filter, niet in de index.
- De **campagneboek-export** (`lib/snapshot.js`) en de printbare sheets moeten
  dezelfde regel volgen, anders lekt het via papier.

## Risico's om nu al te noemen

- **Het organogram valt niet uit elkaar.** Er is al een mechanisme voor
  onbekende leden: die krijgen een vaste schuilnaam die ook in de `chef`-velden
  wordt teruggeschreven, zodat de tak eronder blijft hangen. Een wegvallende
  regel is iets anders dan een geanonimiseerde: als Bram de chef is van drie
  anderen en Bram verdwijnt, moeten die drie ergens blijven. Voorstel: hangen
  onder dezelfde ouder als Bram, met een lege plek waar hij stond.
- **Twee waarheden.** Als het geheim op kaartje A staat en de verbinding op
  kaartje B, en A wordt verwijderd, dan hangt de verbinding aan niets. Bij het
  verwijderen van een kaartje moeten gekoppelde `geheim`-verwijzingen mee
  opgeruimd worden — net als de id's in `betrokkenen`, `eigenaar` en `wijk` nu al.
- **Een geheim dat je terugdraait** verbergt de verbinding weer. Dat is de
  bedoeling, maar het kan verwarren als een speler het al gezien heeft. Geen
  techniek voor nodig; wel iets om in de hulptekst te zetten.

## Wat ik niet zou doen

Een aparte "geheime verbindingen"-lijst naast de gewone. Dan heb je twee lijsten
die hetzelfde zeggen, en dat is precies de fout die bij de betrokkenen al eens
gemaakt is en waar we vanaf zijn.
