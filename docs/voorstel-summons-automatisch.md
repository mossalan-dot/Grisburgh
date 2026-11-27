# Moet een familiar vanzelf in het bestiarium komen?

*Voorstel, 27 november 2026. Gevraagd door de DM.*

> **Akkoord en gebouwd op 27 november 2026**, behalve het Wild Shape-verzoek
> (keuze 2 hieronder) — dat is een eigen stuk werk en staat nog open.
> Wat er staat: een opgeroepen wezen komt in `monsters.json` met
> `inBestiarium: false`, op naam ontdubbeld, met het wezen als naam en niet het
> koosnaampje van de speler. De deur heet nu **Summons & Animal Forms**.
> Bewaakt door `tests/summon-bibliotheek.test.js`.

> *"Als een speler beschikking krijgt over een feature, spell of item waaraan
> een familiar gekoppeld is, moet dat automatisch naar het bestiarium worden
> geïmporteerd."*

Het idee klopt. Maar bij het nameten bleek de keten die het moest dienen er al
te zijn, en bleek de data de automatisering nauwelijks te dragen. Dit stuk legt
uit wat er al werkt, wat automatiseren zou toevoegen, en waar het vastloopt.

## Eerst: de keten die je beschreef werkt — op één gat na

Je vroeg of je vanuit het Heldenboek een wezen kunt klaarzetten in het
bestiarium, zodat je het in een gevecht kunt gebruiken. Ja, en sinds vandaag
ook met één klik vanaf een gedaante. **Maar er zat een gat in**: `_srdImport`
schreef het creature type naar een veld dat niet bestaat (`dm-mon-sb-type` waar
het formulier `dm-mon-sb-creatureType` heet). Élk monster dat ooit uit de SRD
is overgenomen kwam daardoor binnen **zonder creature type** — en sinds de deur
Familiars daarop filtert, kwam een net overgenomen Hawk niet terug als eigen
beest. Dat is dezelfde dag gerepareerd, samen met `initiative` en `profBonus`,
die bij alle 331 wezens in de bron staan en nooit werden overgenomen.

## En dan: voor een gevecht hoeft het al niet

Een summon komt **vanzelf** op de kaart, zonder bestiarium:

- roept een speler iets op terwijl er een gevecht loopt, dan staat het er
  meteen bij, met het initiatief van zijn baasje (`POST
  /characters/:id/summons` → `opKaart: true`);
- begint er een gevecht terwijl hij al rondloopt, dan haalt
  `_summonsNaarCombat()` hem erbij.

En voor **Wild Shape** geldt iets soortgelijks: `_beesten()` leest de
SRD-beesten *plus* het bestiarium, dus alle 86 SRD-beesten zijn al een geldige
gedaante zonder dat er iets geïmporteerd hoeft te worden. Het bestiarium is
alleen nodig voor een beest dat déze campagne zelf verzon.

Waar een bestiarium-regel wél voor dient: een **encounter vooraf bouwen**. Daar
kiest de DM uit de monsterbibliotheek, en daar hoort een wezen dus wél in te
staan.

## Waar automatisch importeren op vastloopt

Van de 25 summons in `bronnen/metgezellen.json`:

| | aantal | wat er te importeren valt |
|---|---|---|
| één vast statblok | **1** | Homunculus Servant — dit kan |
| meerdere gedaantes | **7** | Familiar (14 vormen), Wild Companion (14), Faithful Steed (7), Greater Steed (5), Pact of the Chain (4), Primal Companion (3), Animated Undead (2) |
| geen statblok | **17** | de Spirits: hun HP en AC hangen van het slotniveau af, en de tekst staat in een boek waaruit we niets overnemen |

Dus: **bij één van de 25 is het eenduidig.** Bij zeven is de vraag "wélk wezen
dan" — importeer je alle veertien gedaantes van Find Familiar, dan komen er van
één spreuk veertien monsters bij. Dat is precies de fout waar je zelf voor
waarschuwde bij de voorwerpen: *"laten we ervoor zorgen dat een nieuwe campagne
niet meteen vol wordt geplempt."* En bij zeventien valt er niets te importeren.

## Het voorstel: hang het aan het oproepen, niet aan het krijgen

Op het moment dat een speler iets **krijgt** weet de app nog niet welk wezen het
wordt. Op het moment dat hij het **oproept** weet ze het precies: `POST
/characters/:id/summons` lost de gekozen gedaante al op naar een concreet
statblok (`sb`) — uit de SRD, uit een gekoppeld dier-kaartje met de tier die bij
het level hoort, of uit de bron zelf.

Dus: **roept een speler een wezen op dat nog niet in het bestiarium staat, dan
zet de app het erin.** Eén wezen, het juiste, op het moment dat het er toe doet.
Geen veertien, geen nul, en geen gokwerk.

Twee dingen die daarbij horen:

- **Met `inBestiarium: false`.** Dat is in deze app precies "wél bruikbaar, geen
  encyclopedie-item" — zo staat het statblok van een NPC bij zijn kaartje en zo
  ligt de Mimic klaar als verrassing. Een uil die een speler oproept is zijn
  eigen beest, geen ontdekking van de party; hem als onontdekt kaartje in het
  bestiarium zetten zou een verkeerde belofte zijn. *Dit is de keuze waar ik je
  antwoord op wil: zo, of toch als gewoon bestiarium-item?*
- **Stil, met een regel in het logboek.** Niet als melding die om aandacht
  vraagt: de DM heeft op dat moment een gevecht of een scène te doen.

## Wild Shape: een verzoek, geen automatisme

Je zei het zelf: dat is op aanvraag, en de DM hakt de knoop door — niet alleen
om de CR, maar ook omdat de speler dat dier *lore-technisch* gezien moet hebben,
en omdat je er een moment van kunt maken.

Die vorm bestaat al drie keer in de app: een spreukverzoek, een
multiclassverzoek en een voorwerpverzoek staan alle drie in
`groups[gid].…Requests` en komen samen onder *Vragen* in de Meesterkamer. Een
Wild Shape-verzoek past daar precies in: de speler kiest een gedaante uit wat
zijn level toelaat, de DM ziet erbij staan wat de regels zeggen (CR, vliegers,
Circle of the Moon) **en beslist zelf** — zoals bij een spreukverzoek de app
voorrekent en niets blokkeert.

Wat de app daarbij hoort te zeggen en wat niet:

- **wél**: "Mira (Druid 8) vraagt Dire Wolf — CR 1, dat mag op haar level";
- **niet**: of ze dat dier ooit gezien heeft. Dat weet de app niet, en een
  verzinsel is daar erger dan een leeg veld. Hoogstens als aantekening: "de
  party kent hem uit het bestiarium op niveau *deels*" — dát weet ze wel.

## Wat de DM nog moet beslissen

1. **Landt een opgeroepen wezen als `inBestiarium: false` of als gewoon
   bestiarium-item?** Mijn voorstel is het eerste, met de reden hierboven.
2. **Komt er een Wild Shape-verzoek?** Dat is een eigen stuk werk (route, bak,
   een kaart onder *Vragen*, en een knop op het blad van de speler).
3. **En de naam van de deur.** Zie hieronder.

## De naam

*Familiars* is te smal geworden: een familiar is één spreuk, en achter die deur
staan nu summons uit spreuken, features en voorwerpen, de dieren van deze
wereld, én de CR-ladder voor Wild Shape. Drie kandidaten:

| Naam | Voor | Tegen |
|---|---|---|
| **Summons & Animal Forms** | dekt beide helften precies; allebei PHB-termen, dus Engels is hier juist | lang voor een menuregel naast *Classes* en *Species* |
| **Summons** | kort, en het is wat de deur in de kern is | *Animal Forms* vallen er niet onder, en die zijn de helft van de inhoud |
| **Metgezellen** | Nederlands, en dekt wie er met je meeloopt | een Wild Shape-gedaante is geen metgezel, en "metgezel" is al de naam van een soort in de code |

Mijn voorkeur is **Summons & Animal Forms**, met dezelfde redenering als
waarom *Spell Slots* en *Epic Boon* in deze app Engels blijven: het zijn termen
uit het boek. De menuregel wordt er breder van, maar hij staat in een dropdown
en niet in een balk.
