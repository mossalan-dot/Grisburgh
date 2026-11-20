# Hoe een summon in het gevecht belandt

*20 november 2026 — naar aanleiding van de Familiars-deur in Naslag.*

Achter de deur **Familiars** staan 116 kaartjes: 91 beesten en 25 wezens die een
class, een subclass of een spreuk je geeft. Je kunt ze opzoeken, je ziet welke
gedaantes je kunt kiezen, en bij een spreuk kun je doorklikken naar de spreuk.
Wat je er niet mee kunt is het enige wat aan tafel telt: hem **neerzetten**.
Een speler die Summon Beast cast zegt het hardop, de DM typt met de hand een
combatant bij, en wat die beer kan staat op het telefoonscherm van de speler in
een spreuktekst die de DM niet voor zich heeft.

Dit voorstel zegt hoe dat wél kan, en waarom het niet voor alle 25 hetzelfde
kan zijn.

## Wat er al staat

De machinerie voor "een wezen dat van een speler is" bestaat, en ze is gebouwd
voor de huisdieren:

- Een combatant kent `type: 'summon'` en `ownerId`. Hij krijgt **het initiatief
  van zijn baasje** — dat is de regel in 5e en het staat er al.
- `POST /combat/voeg-metgezellen` zet alle geadopteerde dieren van de actieve
  party neer, met een **bevroren** statblok dat meeschaalt met het level van
  het baasje (`_petStatblockInfo`, `statblockTiers`).
- Een gevecht opruimen (`DELETE /combat`) haalt ze vanzelf weer weg. Er is dus
  geen aparte "de summon verdwijnt"-mechaniek nodig.

Wat ontbreekt is de weg van een **spreuk** of een **feature** naar diezelfde
combatant.

## De meting die alles bepaalt

Van de 25 metgezellen kunnen we er **7** compleet neerzetten en **18** niet:

| | aantal | waarom |
|---|---|---|
| Via zijn gedaantes | 6 | Find Familiar, Pact of the Chain, Wild Companion, Faithful Steed, Find Greater Steed, Animate Dead — hun vormen (Owl, Warhorse, Skeleton…) zijn gewone SRD-wezens en die hebben we |
| Eigen SRD-statblok | 1 | Homunculus Servant |
| Statblok staat in de spreuk | 12 | de twaalf *Spirits* van Summon Aberration tot Summon Undead, plus de twee demonenspreuken |
| Nergens een statblok | 6 | Primal Companion, Drake Companion, Steel Defender, Reanimated Companion, Vestige Companion, Dragon Companion |

Die 18 zijn geen gat in onze data: hun cijfers staan in een boek waaruit wij
niets mogen overnemen. Een Bestial Spirit heeft bovendien geen vást statblok —
zijn HP, AC en schade hangen af van het slotniveau waarop je hem cast. Een app
die dat zelf invult zou het óf verzinnen óf overschrijven.

**Dus: de app kan voor 7 van de 25 de getallen weten, en voor 18 niet.** Elk
ontwerp dat doet alsof dat wél kan, liegt bij driekwart van de gevallen.

## Het voorstel: één knop, twee snelheden

Eén route, `POST /combat/summon`, aan te roepen door de **speler zelf** — zoals
Wild Shape en Hunter's Mark ook door de speler zelf gaan — of door de DM namens
hem. Hij weigert als er geen gevecht loopt (409).

**Kennen we het wezen, dan is het één klik.** De server zoekt de gekozen
gedaante op in dezelfde bron als de deur Familiars (`_beesten()`,
`srd-monsters.json`, en wat de campagne zelf in `monsters.json` heeft), vriest
het statblok in op de combatant en zet hem neer met het initiatief van zijn
baasje. Precies wat `voeg-metgezellen` voor een huisdier doet.

**Kennen we het niet, dan vraagt hij het één keer.** Dezelfde knop opent een
klein venster met naam, HP en AC — leeg de eerste keer, want wij hebben die
getallen niet. De speler leest ze van zijn eigen spreuktekst en tikt ze in. Dat
is dezelfde afspraak als bij de loot-DC en de winkelprijs: *de app rekent niet,
de app onthoudt.*

En onthouden is hier het hele punt. `dmState.playerSummons[charId][summonId] =
{ naam, vorm, hp, ac, level }` bewaart wat hij invulde, dus de **tweede** keer
dat hij Summon Beast op hetzelfde slotniveau cast is het ook één klik. Zonder
dat geheugen is dit een formulier dat je elke sessie opnieuw invult, en dan
gebruikt niemand het.

### Waar de knop staat

Op drie plekken, en alle drie zijn het plekken waar hij al hoort te zijn:

1. **In je spreukenboek** — bij een spreuk die `_metgezel` draagt (die vlag
   bestaat sinds vandaag) staat *Roep op* zodra er een gevecht loopt.
2. **Op het kaartje in Naslag → Familiars** — dezelfde knop, want dat is het
   kaartje waarop staat wat hij kan.
3. **In het DM-paneel** — de bestaande knop *Metgezellen toevoegen* krijgt de
   summons van de aanwezige spelers erbij, zodat de DM ze ook namens iemand
   kan neerzetten.

### Wat er níét bij hoort

- **Geen slotverbruik.** Casten gaat al langs het spreukenboek; een tweede plek
  die een slot afvinkt geeft twee administraties van hetzelfde.
- **Geen duur die afloopt.** Grisburgh telt nergens rondes af (zie Rage: "de
  duur loopt niet op een klok"). Het gevecht sluiten haalt de summon weg; dat is
  genoeg.
- **Geen statblok in onze data.** Voor die 18 blijft het bij een naam, de
  getallen van de speler, en de knop naar de spreuk waar de rest staat.

## Wat het kost

Eén route, één bak in `dm-state.json`, een knop op drie plekken en een klein
venster. De helft van de machinerie (`type: 'summon'`, `ownerId`, initiatief van
het baasje, opruimen bij het einde) staat er al sinds de huisdieren.

## Open vraag voor de DM

Mag een speler zijn eigen summon neerzetten, of stelt hij hem voor en zet de DM
hem neer? De app doet het eerste bij Wild Shape en het tweede bij een
multiclass-verzoek. Mijn voorstel is **het eerste**: een summon is een spreuk
die hij zelf cast, en de DM ziet hem meteen op het canvas verschijnen. Loopt dat
uit de hand, dan is een schakelaar per campagne de kleinste reparatie.
