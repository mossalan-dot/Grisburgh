# Een kaartje dat iemand anders blijkt te zijn

*Voorstel, 26 november 2026. Gevraagd door de DM.*

> **Gebouwd op 26 november 2026**, met de drie keuzes die onderaan beantwoord
> staan. Wat het geworden is staat in CLAUDE.md onder *Twee kaartjes die iemand
> anders blijken te zijn*; de toetsen zijn `tests/alias.test.js`,
> `tests/alias-editor.test.js` en `tests/alias-tafelscherm.test.js`. Eén ding
> week af van dit stuk: het moment op het tafelscherm speelt alleen bij de
> **overgang** van dicht naar open — dat stond hier niet in, en zonder die vlag
> speelt de onthulling opnieuw zodra de DM er een volgend geheim bij onthult.

Harmen Jonker ís in het geheim Hugo Grisburgh II. De DM heeft dan twee
kaartjes: het **pseudoniem** dat de party kent, en het **echte** dat ze nog
niet kennen. Op het moment van de onthulling moeten die samenvallen.

De vraag is niet of dat kan — het kan — maar hoe, zonder dat het de rest van de
app tegenspreekt. Dit stuk zoekt dat uit en eindigt met drie keuzes die de DM
moet maken.

---

## Wat er al ligt

**De haak bestaat.** Een geheimregel kan een gevolg dragen: zet je `antagonist`
op een regel, dan wordt het kaartje bij het onthullen van díé regel een
antagonist — rol, kant en alignment schuiven mee, en terugdraaien zet ze terug
(`PUT /entities/:type/:id/secret` in `routes/api.js`, zoek op *Geheime
antagonist*). Twee kaartjes in Grisburgh gebruiken hem.

Een alias is precies zo'n gevolg. Er hoeft dus geen nieuw mechaniek bij: een
geheimregel krijgt naast `antagonist` een tweede mogelijke uitkomst.

**En er is een tweede moment**: het zichtbaar maken van het echte kaartje. Ook
dat is een bestaande route (`PUT /entities/:type/:id/visibility`). De DM kiest
welk van de twee de onthulling is — vaak valt het samen.

---

## De kink in de kabel

**Onthullen is per party. Een kaartje is van de hele campagne.**

`secretReveals` staat in `groups[gid]`; `entities.json` niet. De bestaande
antagonist-haak loopt daar al tegenaan: onthult party A het verraad, dan
schrijft de server `tags: ["antagonist"]` en `kant: "vijand"` in het kaartje —
en `filterEntityForPlayer` knipt die velden niet weg. Party B ziet de rode
badge dus ook, zonder te weten waarom. Vandaag bijt dat niet (de twee kaartjes
die de vlag dragen zijn voor beide party's gelijk), maar het is dezelfde fout
die we deze week elf keer uit de routes hebben gehaald: *de ene tafel die iets
van de andere te zien krijgt.*

Voor een alias is die eigenschap fataal. **Het aliaskaartje weggooien kan niet
per party.** Gooi je het weg omdat party A het doorheeft, dan is Harmen Jonker
ook verdwenen voor party B — die hem nog gewoon als waard kent, zijn naam in
hun logboek heeft staan en volgende week met hem praat.

Daar komt bij wat we deze week geleerd hebben van de opruimrondes: een kaartje
weggooien laat verwijzingen achter. De verwijderroute ruimt tegenwoordig
netjes op (bezit, charges, zichtbaarheid, geheimen), maar `betrokkenen` houden
hun naam, een akte noemt hem in de tekst, en een sessieverslag ook. Een naam
die uit het archief verdwijnt terwijl hij in vijf teksten staat, levert precies
de wezen op waar `verwijzingen-nalopen.js` voor bestaat.

---

## Het voorstel

### 1. De alias is een verwijzing, geen fusie

Op het **aliaskaartje** komt één veld:

```
data.aliasVan = "<id van het echte kaartje>"
```

Meer niet. Het echte kaartje hoeft niets te weten: de omgekeerde kant is af te
leiden, precies zoals `betrokkenen` op één plek staan en `_hoortBij` de andere
kant berekent. Eén bron, twee kanten — de afspraak die in dit project al geldt.

### 2. Samenvallen is een stand per party, geen verwijdering

Naast `secretReveals` komt `groups[gid].aliasOnthuld[<aliasId>] = true`.

Wat een party ziet hangt daarvan af:

| | party die het niet weet | party die het doorheeft |
|---|---|---|
| **aliaskaartje** | gewoon *Harmen Jonker*, waard | *Harmen Jonker* met een regel **Is in werkelijkheid Hugo Grisburgh II** en een knop ernaartoe |
| **echte kaartje** | wat de zichtbaarheid zegt (meestal verborgen) | zichtbaar, met **ook bekend als Harmen Jonker** |

Niemands kaartje verdwijnt, geen verwijzing breekt, en twee tafels kunnen
ongestoord in verschillende werkelijkheden spelen. Dat laatste is geen
compromis maar de hele reden dat zichtbaarheid in deze app per party staat.

### 3. Opruimen is een losse, bewuste daad van de DM

Wil de DM na afloop echt één kaartje overhouden — en dat wíl je soms, een
archief met dubbelgangers wordt rommelig — dan is dat een aparte knop op het
aliaskaartje: **Samenvoegen met Hugo Grisburgh II**. Die:

- zet de naam van het alias als `data.ookBekendAls` op het echte kaartje;
- verhuist wat erop staat en nergens anders bestaat (portret, roddels,
  betrokkenen, bezit) — of meldt wat hij níét kan verhuizen;
- laat elke `[[Harmen Jonker]]` in teksten naar het echte kaartje wijzen, door
  die naam als alias in de naamindex te zetten (`_buildEntityIndex`);
- en gooit het aliaskaartje pas dán weg, via de bestaande verwijderroute, met
  de prullenbak eronder.

Dat is een handeling van de DM op één moment, campagnebreed, met een
bevestiging die zegt wat er gebeurt — zoals elke andere destructieve actie hier.
Nooit een bijwerking van een onthulling.

### 4. Het moment op tafel

*X is eigenlijk Y!* hoort op het tafelscherm, in dezelfde familie als de
level-up en de verzegelde brief: een eigen socket-event naar de **display-room**
(`_displayRoom(req)`, nooit naar de hele campagne — anders leest een speler het
in zijn netwerktab voordat het op tafel staat).

De vorm ligt voor de hand omdat de app hem al kent: twee portretten die naar
elkaar toe schuiven en samensmelten, de oude naam die wegvaagt, de echte die
blijft staan. Het dichtstbijzijnde bestaande voorbeeld is het slotshot van de
terugblik (`terugblik.js`, portretten in gouden ringen).

---

## Wat dit níét doet

- **Geen automatische verwijdering.** Zie boven; dat is een aparte knop.
- **Geen tweede ledenlijst of tweede naamveld op het echte kaartje.** Het alias
  staat op één plek, de andere kant is afgeleid.
- **Geen zoekmagie.** Zoeken op "Hugo" vindt het echte kaartje alleen als je
  het mag zien; het aliaskaartje blijft vindbaar op zijn eigen naam. Anders
  verklapt het zoekveld wat het geheim verbergt.

---

## De drie keuzes, beantwoord (26 nov 2026)

1. **Allebei de momenten, als keuze per kaartje.** Een geheimregel kan het doen
   (zoals de antagonist-vlag), en het zichtbaar worden van het echte kaartje
   ook. De DM zet per aliaskaartje welke van de twee geldt.
2. **Het aliaskaartje blijft staan, met een verwijzing.** Samenvoegen blijft
   een losse, bewuste knop — niet een bijwerking van een onthulling.
3. **Eén alias per kaartje.** Geen lijst; één regel, één verwijzing.

---

## En een vondst onderweg

Het nalopen hiervoor legde bloot dat de **bestaande** antagonist-haak de
party-grens niet respecteert: `tags` en `kant` worden globaal geschreven en
`filterEntityForPlayer` knipt ze niet weg. Twee kaartjes in Grisburgh dragen
die vlag; vandaag valt het niet op omdat beide party's er hetzelfde voor staan.
Dat hoort los van dit voorstel rechtgezet te worden — het is dezelfde familie
als de elf routes die deze week omgezet zijn.
