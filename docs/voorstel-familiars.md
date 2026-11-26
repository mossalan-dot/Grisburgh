# Wat roept het op?

*Voorstel, 26 november 2026. Gevraagd door de DM, na zijn eigen diagnose.*

> **De ruggengraat is omgezet op 26 november 2026.** De filterrij achter
> Familiars groepeert nu op oproepbron: *Spreuk 15 · Class feature 10 · Van
> deze wereld 6 · Beest 92*. `GET /bron/metgezellen` levert er twee groepen bij
> (voorwerpen met `data.metgezel`, en de dier-kaartjes van de campagne) en elke
> kaart draagt een `oproep`. De keuzes 1 en 3 onderaan zijn daarmee beantwoord
> zoals voorgesteld; voor 2 is het *Van deze wereld* geworden, want er staan
> ook dier-kaartjes bij die niemand geadopteerd heeft.
> **De knop is daarna de hoofdhandeling geworden** (zelfde dag): *Laad in het
> bestiarium* met het gouden accent, en onder de knop in één zin waaróm — hij
> staat dan klaar voor een gevecht en voor Wild Shape. Bij een **gedaante** van
> een metgezel staat er nu een **+** naast elke vorm die we kennen
> (`laadInBestiarium`), zodat je niet eerst naar de deur Beasts hoeft om hem
> daar op te zoeken. Dat was twee sprongen voor iets wat je hier al wist.
>
> **Nog niet gedaan:** de overschrijflaag om de familiar zélf aan te passen —
> zijn naam, zijn gedaantes, wat hem oproept. Zie hieronder.

De deur **Familiars** in het Heldenboek klopt niet, en de DM wees precies aan
waarom: *"het filter maakt onderscheid tussen Beasts en Metgezellen, maar ook
dat is een raar onderscheid, want de metgezellen daar zijn familiars."*

Hij heeft gelijk, en de oorzaak is scherper te maken dan "het voelt raar".

## Wat er nu staat

Gemeten op 26 november 2026, in Grisburgh:

| | aantal | waar vandaan |
|---|---|---|
| Beasts | 92 (86 SRD, 6 eigen) | `GET /bron/beesten` — SRD-monsters van type Beast, plus het bestiarium |
| Metgezellen | 25 | `bronnen/metgezellen.json` — 15 `soort: spreuk`, 10 `soort: feature` |

En de deur heeft een **tweede laag op CR**. Dat is de kern van het probleem:
CR is het antwoord op *"wat kan ik wórden"* — de Wild Shape-vraag, met zijn
grenzen op level 2, 4 en 8. De deur heet Familiars en belooft daarmee een
andere vraag: *"wat loopt er met me mee, en waar komt het vandaan?"* Twee
vragen in één la, en de filterchip Beasts/Metgezellen is wat ervan overblijft.

Daar komt bij dat de lijst zelf rommelde. Twee statblokken die bij een kaartje
horen (**Barthen**, een NPC, en **Xerxes en Sarabi**, het statblok achter een
dier-kaartje) stonden ertussen omdat deze deur als enige `inBestiarium: false`
negeerde. Dat is op dezelfde dag gerepareerd; het staat hier omdat het laat
zien hoe makkelijk er iets in deze la belandt dat er niet hoort.

## Eén correctie op de diagnose

De DM schreef: *"ze horen niet bij een brontekst."* Dat klopt niet — de 25
metgezellen zijn juist wél bronmateriaal: elk heeft een `soort` (spreuk of
feature), een `geeft` (*Find Familiar*, *Summon Beast*) en een `boek`. Het is
precies de lijst die volgens hem daar hoort te staan.

Wat ontbreekt is de **vierde** soort die hij noemt: een **voorwerp** dat iets
oproept. Die bestaat sinds vandaag wel als veld op een voorwerpkaartje
(`data.metgezel`, met tien figurines in de SRD-presets), maar hij voedt deze
deur niet. In Grisburgh staan er nu nul.

## Het voorstel: de ruggengraat wordt *wat roept het op*

Eén deur, en de tweede laag is niet CR maar de **bron van de oproep**:

| Groep | Wat erin staat | Nu |
|---|---|---|
| **Spreuk** | Find Familiar, Summon Beast, … | 15 |
| **Class feature** | Steel Defender, Find Steed, … | 10 |
| **Feat** | wat een feat oproept | 0 — de haak bestaat (`geeftSpreuk`) |
| **Voorwerp** | figurines, Staff of the Woodlands | 0 in Grisburgh, 10 in de presets |
| **Eigen** | geadopteerde huisdieren en eigen dier-kaartjes | 6 dier-kaartjes, 0 geadopteerd |
| **Beest** | de CR-ladder | 92 |

Vier winstpunten:

1. **De chip zegt iets.** "Spreuk 15 · Feature 10 · Voorwerp 3" beantwoordt de
   vraag waarmee je hier komt. "Beasts 92 · Metgezellen 25" niet.
2. **Huisdieren horen erbij.** De DM noemt dat zelf als tegenargument tegen een
   strikte scheiding, en met deze indeling is het geen uitzondering maar een
   groep: *eigen*, naast *spreuk* en *feature*.
3. **De beesten blijven**, als één groep met hun eigen CR-ladder eronder. Wie
   voor Wild Shape komt, vindt ze waar ze nu staan; wie voor een familiar komt,
   loopt er niet meer tegenaan.
4. **Een voorwerp dat oproept krijgt een plek.** Nu is dat een veld dat nergens
   te zien is.

## En de richting: van hier naar het bestiarium

De DM: *"Er staat nu dat we het dier moeten overnemen in het bestiarium en dat
het statblok daar verschijnt. Maar die logica is gek. Het moet andersom zijn."*

Ook hier heeft hij gelijk, en de app kan het al — ergens anders. Bij **spreuken**
geldt precies wat hij wil: de brontekst blijft de brontekst, en wat de DM zelf
schrijft staat in een eigen laag (`spells.json → eigenSpreuken` en
`spells.json → eigen[index]`) die bij het tonen wint. Niemand hoeft eerst iets
"over te nemen" om te kunnen schrijven.

Dus twee dingen:

- **Sleutelen mag hier.** Een familiar krijgt dezelfde overschrijflaag als een
  spreuk: wat de DM invult staat in de campagne en wint van de bron. De bron
  blijft onaangeraakt, dus latere verbeteringen aan de meegeleverde data komen
  binnen zolang hij niets eigens zette. Dat is de afspraak die hier al geldt
  voor `meta.naslagkaarten`; hij dekt nu alleen beeld, tekst en een paar velden.
- **Eén knop: *laad in het bestiarium*.** Niet als voorwaarde om te mogen
  bewerken, maar als wat het is: dit wezen heb ik nodig in een gevecht of als
  Wild Shape-gedaante, zet hem klaar. De knop bestaat al (`beestOvernemen`);
  hij staat alleen als troostprijs geformuleerd — *"wil je hem aanpassen, dan
  hoort hij eerst in je bestiarium te staan"*.

## Wat dit níét verandert

- **Het statblok blijft op één plek.** Zodra een wezen in het bestiarium staat,
  is dát zijn statblok — ook voor een gevecht en voor Wild Shape. Twee plekken
  met hetzelfde statblok lopen uit elkaar; dat is de reden dat het nu zo is, en
  die reden blijft gelden. De overschrijflaag hierboven gaat over het
  familiar-kaartje (wat hij is, wanneer hij verdwijnt, hoe hij eruitziet), niet
  over een tweede kopie van zijn cijfers.
- **De SRD-tekst blijft de SRD-tekst.** Wat de DM zelf schrijft is van hem en
  gaat niet mee de deur uit; zie *Bronteksten* in CLAUDE.md.

## Wat de DM nog moet beslissen

1. **Blijft het één deur?** Het voorstel zegt ja, met *Beest* als één groep
   ernaast. Alternatief is twee deuren (Familiars en Beasts), scherper maar dan
   zoek je een wolf op twee plekken.
2. **Hoe heet de groep met de huisdieren?** *Eigen*, *Van deze campagne*, of
   *Huisdieren* — dat laatste dekt de geadopteerde dieren maar niet een eigen
   dier-kaartje dat nergens geadopteerd is.
3. **Mag de CR-ladder weg uit de kop?** Hij blijft binnen de groep *Beest*
   staan; de vraag is of hij ook nog als filterchip nodig is.
