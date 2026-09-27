_56 sleutels · 16 aangepast in **grisburgh** · rest is de standaard uit de code._

# Helpteksten

Gegenereerd met `node scripts/helpteksten.js grisburgh`.

Pas de tekst hieronder aan en voer hem terug met:

```bash
node scripts/helpteksten.js grisburgh --lees docs/helpteksten.md            # tonen wat er verandert
node scripts/helpteksten.js grisburgh --lees docs/helpteksten.md --schrijf  # doorvoeren
```

**Wat je mag wijzigen:** de regel achter `Titel:` en de tekst onder elke `###`-kop.
Laat de `##`-regel met de sleutel staan — daar wordt op gematcht. De `>`-regels zijn
aantekeningen en worden genegeerd. Markdown in de tekst mag: `**vet**`, `*cursief*`,
en `[[Naam]]` wordt een link naar een kaartje.

Elke `###`-kop is één **stap**: de uitleg bladert erdoorheen met pijltjes. Een stap
erbij zetten of weghalen mag, zolang er minstens één overblijft.

Teksten die gelijk blijven aan de standaard worden **niet** vastgelegd in deze campagne,
zodat latere verbeteringen in de code vanzelf doorkomen.

---

## `akte_schrijven`

> Helpknop in: akte-schrijven.js:691
> Nu: de standaard uit de code

Titel: Een akte schrijven

### Schrijven en spelen in één scherm

Links staan de **secties** van je hoofdstuk — elke `##`-kop is er een. Je kunt ze **verslepen** om een scène te verplaatsen; alles wat eronder hangt gaat mee. Onderaan die kolom staat wat niet bij één plek in de tekst hoort: **Rust** en de **character sheets**.

### Invoegen zonder tekens te typen

Onder **Invoegen** staat alles wat je in een akte kwijt kunt: een sectie, een lijst, een tabel, een voorleesblok, een gevecht, een tabel om te rollen, een vondst, een kamer, muziek, een brief. Elk item heeft een sneltoets (**Alt** + de letter erachter). *Kaartje* en *Beeld* staan los, want die gebruik je in bijna elke alinea; een kaartje kan ook met `[[` — dan zoekt de app mee.

### Tekst en beeld, en Spelen

**Tekst en beeld** zet je tekst links en het perkament rechts, zodat je ziet wat je maakt. **Spelen** toont alleen het perkament, met de knoppen erbij: onthullen bij een naam, *Toon aan spelers* bij een beeld, *Start gevecht* bij een gevechtsblok. Diezelfde weergave krijg je tijdens het spelen in de lade onderin.

### Namen, importeren en exporteren

**Namen** laat zien welke `[[namen]]` uit je tekst nog geen kaartje hebben — het getal op de knop is dat aantal, en je maakt ze er meteen bij. Achter **⋯** kun je een `.md` **importeren** (dat vervángt de tekst) of je hoofdstuk **exporteren** als bestand, bijvoorbeeld om het in je Obsidian-vault te zetten. Opslaan hoeft niet: dat gebeurt terwijl je typt.

---

## `bestiarium`

> Helpknop in: render-bestiarium.js:112
> Nu: **aangepast in deze campagne**
> De standaard telt 3 stap(pen).

Titel: Bestiarium

### Bestiarium

Het bestiarium toont alle wezens die de party heeft ontmoet. Hoe meer je van een wezen weet, hoe meer info je ziet. De DM onthult wezens automatisch bij het eerste contact. Verdere kennis moet je verdienen.

### Kennisniveaus

Er zijn drie kennisniveaus. 
- Naam: je herkent het wezen maar weet verder niets. 
- Deels: je kent de basisstats, wapenresistenties en zintuigen. 
- Volledig: je kent alles: traits, actions en Challenge Rating. 
De Magizoöloog kan het kennisniveau verhogen.

---

## `dm_gevecht`

> Geen aanroep gevonden — mogelijk ongebruikt.
> Nu: **aangepast in deze campagne**

Titel: Gevechten en monsters

### Initiative tracker

Voeg spelers en monsters toe aan het gevecht. Klik op "Start gevecht" om de initiative-ronde te beginnen. Het combat-scherm is zichtbaar voor alle spelers.

### HP beheren

Klik op het HP-getal van een combatant om schade of genezing toe te passen. Gebruik het schildicoon voor tijdelijke HP.

### Monsters toevoegen

Ga naar het subtabblad "Monsters" om monsters uit het bestiarium toe te voegen. Kies een encounter of voeg individuele monsters toe.

---

## `documenten`

> Helpknop in: render-campagne.js:2861 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> De standaard telt 1 stap(pen).

Titel: Documenten

### Documenten

Het **archief**: brieven, aktes, kaarten en aantekeningen die je onderweg verzamelt. De DM onthult documenten wanneer ze relevant worden.

---

## `dungeon`

> Helpknop in: app.js:3253, render-dungeon.js:194
> Nu: de standaard uit de code

Titel: Dungeonkaarten

### Fog of war

Een dungeon is een plattegrond waarvan de kamers per party onthuld worden. Wat nog niet onthuld is, blijft voor spelers in het duister. Klik een kamer aan en gebruik "Onthul" — of het oogje in de kamerlijst — om hem zichtbaar te maken. Verbergen kan net zo goed weer.

### Kamers tekenen

Met de gereedschappen bovenin teken je een rechthoek of een veelhoek over de plattegrond. Met het schakelicoon verbind je twee kamers met een lijn, zodat spelers zien welke doorgangen er zijn.

### Symbolen

Per kamer kun je symbolen zetten: vijanden, buit, vergrendeld of uitgewist. Elk symbool kun je zichtbaar of verborgen maken voor de party — zo geef je een hint zonder alles te verklappen.

### Vondsten in een kamer

Onder "Vondsten" hangt de buit die in deze kamer te halen valt. Typ wat er te vinden is en druk op plus, of koppel een vondst die je al in het Loot-tabblad gemaakt hebt. De DC ernaast is een aantekening voor jou — de spelers gooien aan tafel en jij beslist. Met het muntje maak je er een verdeling van; het kruisje koppelt de vondst weer los zonder hem weg te gooien.

### Party-toegang

Per party stel je in of een dungeon nog niet, nu of al uitgespeeld is. Zo kun je dezelfde kaart voor meerdere groepen gebruiken zonder dat hun voortgang door elkaar loopt.

---

## `facties`

> Helpknop in: app.js:8547, app.js:13507, app.js:13618
> Nu: **aangepast in deze campagne**
> De standaard telt 4 stap(pen).

Titel: Facties & aanzien

### Facties en aanzien

Facties zijn organisaties in Grisburgh waarmee de groep een band kan opbouwen. Door missies te voltooien, bouw je aanzien op bij een factie. Hoe meer aanzien, hoe hoger je rang en hoe meer voordelen je krijgt.

### Rangen en voordelen

Elke factie heeft een hiërarchie. Als je genoeg aanzien hebt opgebouwd om de volgende rang te bereiken, ontvang je automatisch een voordeel, een dienst die factie voor je uitvoert. Bekijk het kaartje dat je ontvangt voor de exacte werking.

### Missies accepteren

Bij elke factie staan beschikbare missies. Klik op "Accepteer" om een missie aan te vragen. De DM keurt dit goed of af. De groep kan per factie maar één actieve missie tegelijk hebben.

### Aanzien en beloning

Als de DM een missie markeert als voltooid, ontvang je automatisch extra aanzien.  Bereik je daarmee een nieuwe rang, dan worden bijbehorende gunsten direct uitgedeeld. Een eventueel geldbedrag gaat naar de groepskas of wordt eerlijk verdeeld.

---

## `gevecht`

> Geen aanroep gevonden — mogelijk ongebruikt.
> Nu: de standaard uit de code

Titel: Gevecht

### Gevechtsweergave

Tijdens een gevecht zie je bovenaan de initiatiefvolgorde met wie er aan de beurt is. De actieve deelnemer is goudgekleurd gemarkeerd. Condities (vergiftigd, verblind, etc.) zijn zichtbaar als iconen naast de naam.

### HP-balken van vijanden

Vijanden zonder bestiarium-kennis tonen een ruwe balk in drie segmenten: gezond, gewond, kritiek. Als je het wezen deels of volledig kent (via de Magizoöloog), zie je een nauwkeurige balk met exacte HP.

---

## `gock`

> Helpknop in: app.js:12378
> Nu: **aangepast in deze campagne**
> De standaard telt 1 stap(pen).

Titel: Juliaan de Gock

### Juliaan de Gock

Juliaan de Gock is een privédetective. Je kunt hem inhuren om een persoon, locatie of organisatie te onderzoeken. Na een dag levert hij een rapport op dat in jullie postvakje verschijnt.

---

## `herberg`

> Helpknop in: app.js:12168
> Nu: **aangepast in deze campagne**
> De standaard telt 2 stap(pen).

Titel: De Swarte Cat

### Roddels

Brÿlwaen, de waardin van herberg De Swarte Cat, vertelt je roddels en geruchten die ze aan de toog heeft opgevangen. Het is druk, dus ze heeft niet altijd tijd voor je.

### Lange rust

Bij De Swarte Cat kun je overnachten en rusten. Een lange rust herstelt je HP en *spell slots* volledig. De kosten voor een overnachting worden automatisch van je beurs afgeschreven.

---

## `hulp_bewerk_beeld`

> Kaartjes-editor (alleen de DM) — elk soort kaartje (terugval), tabblad **beeld**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Beeld

### Afbeelding

Het portret of de gevel van dit kaartje. Met het **focuspunt** bepaal je welk deel in beeld blijft als de afbeelding bijgesneden wordt — handig bij een portret waar het hoofd niet in het midden staat. De twee voorbeelden ernaast tonen de echte uitsnedes: het kaartje (breed) en het ronde portret.

### Meer beelden

Extra afbeeldingen komen als carrousel in het detailvenster te staan. Bij een spelerspersonage kun je ook een kort **filmpje** meegeven: dat speelt op de landingspagina bij het inzoomen op het portret, en in het dashboard als de speler erop klikt.

---

## `hulp_bewerk_locaties_info`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **locaties**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Een locatie

### Type

Het **type** zegt wat voor plek dit is. De lijst staat in groepen: gebieden (rijk, streek, stad, dorp, wijk), gebouwen, landschap en overig. Drie types kunnen méér, en onder de keuzelijst staat wat dat is: *Winkel* krijgt een eigen tabblad met voorraad, en *Herberg* en *Tempel* kunnen aan een dienst gekoppeld worden. Kunnen, niet moeten — je kunt drie herbergen hebben waarvan er één de dienst is.

### Gebied

Waar dit in ligt: een stad, een streek, een wijk of een gebouw. Wijst het naar een bestaand locatiekaartje, dan kun je doorklikken en ontstaan er ketens — een herberg in een wijk, in een stad, in een streek. Vrije tekst mag ook; bestaat de naam nog niet, dan biedt hij aan er een kaartje voor te maken.

### Wie hoort hier bij?

Eigenaar, waard, personeel, stamgasten — personages én organisaties, met per regel een rol. Een naam die een kaartje heeft wordt een knop waar je doorheen klikt; wat geen kaartje heeft blijft gewoon tekst. Dezelfde regel verschijnt bij *Waar hoort dit … bij?* op dát kaartje — de kop noemt daar het soort kaartje: een verbinding staat maar op één plek, dus je legt en verwijdert hem van beide kanten.

### Flavour & geheimen

**Flavour** zijn losse zinnetjes om voor te lezen; de app houdt per regel bij of hij al verteld is, dus iemand met drie roddels levert drie avonden op. **Geheimen** onthul je per regel en per party, in het detailvenster.

### Koppelingen

Onderaan staat wat dit kaartje **elders** is: de herberg van de campagne, of de tempel van een god uit de Tempel-dienst. Die koppeling staat maar op één plek — je kunt hem hier leggen of in het paneel van die dienst, en je ziet aan beide kanten hetzelfde.

---

## `hulp_bewerk_locaties_kaart`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **locaties**, tabblad **kaart**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Kaart & dungeon

### Op de kaart

Kies een kaart en **klik in het beeld** om de speld te zetten; nog eens klikken verplaatst hem. **Dubbelklikken** zoomt in op die plek (en op de hoogste stand weer helemaal uit), ingezoomd sleep je om te schuiven. Ook bij een nieuw kaartje: de speld wordt geplaatst zodra je opslaat.

### Wat het oplevert

Een kaartje met een speld krijgt rechtsonder een knopje dat meteen de juiste kaart opent, en toont in het detailvenster een uitsnede van zijn omgeving. Vanuit de grote kaart brengt de knop linksboven je terug naar het kaartje.

### Dungeonkaart

Hangt er een plattegrond aan deze plek, kies hem dan hier. Een kamer kiezen mag, maar hoeft niet — de hele kaart volstaat. De plattegrond zelf teken en beheer je bij Dungeons; hier leg je alleen de koppeling.

---

## `hulp_bewerk_locaties_winkel`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **locaties**, tabblad **winkel**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: De winkel

### Voorraad

Wat hier te koop is. Voeg voorwerpen toe, of laad de voorraad van een andere winkel in als vertrekpunt. Prijzen schrijf je met een komma — `12,34` is 12 goud, 3 zilver en 4 koper — of in munten (`5 gp 2 sp`). De voorraad hoort bij de **locatie**; een verkoper wijst er alleen naar.

### Wisselend assortiment

Niet alles ligt altijd in de schappen: laat de winkel elke zoveel uur een deel van de voorraad tonen. Winkels met hetzelfde woord bij *Zelfde selectie als* verversen tegelijk en tonen dezelfde selectie.

### Verkopen en inkopen

In het detailvenster van de winkel reken je af namens een speler, en koop je met *Inkopen van de party* spullen van hen over: je vinkt aan wat de winkel overneemt, zet er een bedrag per stuk bij en rekent af. Het voorwerp verdwijnt uit de boedel; het geld gaat naar de partybeurs als die gedeeld is, anders naar die speler. Wat de winkel niet inkoopt zet je op het voorwerpkaartje zelf uit.

---

## `hulp_bewerk_organisaties_info`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **organisaties**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Een organisatie

### Type en motto

Gilden, ordes, facties en bendes. Het **type** en het **motto** komen op het kaartje te staan; de beschrijving vertelt waar ze voor staan.

### Gebied en leden

Bij **Gebied** koppel je waar ze zitten. Bij **Wie hoort hier bij?** zet je de leider en de leden neer, met per regel hun rang of rol — personages én andere organisaties. Die regels verschijnen ook op hun eigen kaartjes.

### Factie

Onderaan koppel je dit kaartje aan een **factie** uit het Facties-paneel. Dat is dezelfde koppeling die daar staat, dus je kunt hem van twee kanten leggen; renown, rangen en boons blijven in dat paneel.

---

## `hulp_bewerk_organisaties_organogram`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **organisaties**, tabblad **organogram**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Organogram

### Waar het vandaan komt

De ledenlijst staat op dit tabblad: één regel per persoon of organisatie, met een rol. Vul je bij een regel *Valt onder* een naam uit diezelfde lijst in, dan komt hij daaronder te hangen. Onder de lijst staat **Waar hoort deze organisatie bij?**: dezelfde vraag van de andere kant, voor als deze organisatie zelf ergens onder valt.

### Zonder invullen

Heb je nergens *Valt onder* ingevuld, dan maakt hij er een tweelaags schema van op rol: wie leidt (Leider, Oprichter, Eigenaar, Hoofd, Kapitein…) staat boven, de rest eronder. Dat is een vertrekpunt, geen echte structuur — vul de chefs in en het klopt.

### Wat spelers zien

Een lid waarvan hun party het kaartje nog niet kent staat er als **Onbekend** — met zijn rol, zonder zijn naam. Zo zien ze de vorm van de organisatie en blijft het uitzoeken wie erin zit het spel. Een naam die je nooit aan een kaartje koppelt blijft wél gewoon leesbaar.

---

## `hulp_bewerk_personages_info`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **personages**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Een personage

### Type, rollen en kant

Drie verschillende vragen. **Type** zegt wat voor kaartje dit is: NPC, speler, dier of god. **Rollen** zeggen welke functie hij vervult — *verkoper* zet een voorraad aan, *antagonist* geeft kleur en een badge, allebei tegelijk mag. **Kant** zegt aan welke kant hij in een gevecht staat.

### Flavour & geheimen

**Flavour** zijn zinnetjes om voor te lezen; de app onthoudt per regel of hij al verteld is. **Geheimen** onthul je per regel en per party. Bij een personage kun je per geheim aanvinken dat het onthullen hem tot vijand maakt: hij krijgt dan de rol antagonist, komt aan de kant van de vijand te staan en zijn alignment schuift op naar Evil.

### Waar hoort dit personage bij?

Waar dit personage bij hoort: eigenaar van een herberg, lid van een gilde. Kies een locatie of organisatie plus een rol met **Verbinding toevoegen**. Diezelfde regel komt te staan bij *Wie hoort hier bij?* van dát kaartje — een verbinding staat maar op één plek, dus je kunt hem van beide kanten leggen en van beide kanten weghalen. Onderaan staat **Verkoopt bij**: dat is dezelfde soort verbinding, maar dan naar de winkel waar zijn waren liggen.

### Bij een dier

Een dier kun je te adopteren zetten met een prijs, en per party een **eigenaar** geven. Het dier staat dan op hun partytabblad, is te vullen in een gevecht, en zijn statblok groeit mee met het level van dat personage.

### Aantekeningen

Wat je zelf wilt onthouden: hoe je hem speelt, wat er nog moet gebeuren, welke stem hij heeft. Spelers krijgen dit nooit te zien, ook niet als het kaartje zichtbaar is.

---

## `hulp_bewerk_personages_sheet`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **personages**, tabblad **sheet**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Statblock

### Statblock

De gevechtsgegevens: AC, HP, speed, abilities, traits en actions. Vul je hier iets in, dan verschijnt het kaartje in de **monsterbibliotheek** en kun je hem in een gevecht zetten — hij komt níét in het bestiarium, want dat is wat de spelers aan beesten verzamelen. HP schrijf je zoals in een statblock: `32 (5d8+10)`.

### Meegroeien met het baasje

Bij een dier is het blok hierboven het dier vanaf level 1. Een **tier** neemt het over zodra zijn eigenaar dat level haalt, en zegt alleen wát er verandert — wat je leeg laat komt uit de basis. "Hetzelfde beest, maar taaier" is dus een AC en een HP, geen overgetypt blok. Twee tiers vanaf hetzelfde level kan niet.

### Afdrukken

Bij een spelerspersonage heet dit blad *Character Sheet* en kun je het afdrukken of als pdf bewaren; bij een NPC, dier of god drukt hij alleen het statblok af.

---

## `hulp_bewerk_voorwerpen_info`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **voorwerpen**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Een voorwerp

### Type en rarity

Het **type** staat in groepen (wapens & harnas, magische voorwerpen, verbruik, uitrusting) en bepaalt welke velden erbij komen — onder de keuzelijst staat wat je krijgt. De **rarity** kleurt de rand van het kaartje; Very Rare en Legendary krijgen bovendien een gloed.

### Prijs en exemplaren

De **prijs** mag met een komma (`12,34`) of in munten (`5 gp 2 sp`). Bij **exemplaren** kies je of er maar één van is, of meerdere spelers er elk één van kunnen hebben, of ieder er een aantal van bijhoudt (met teller). Wat winkels niet mogen overnemen vink je aan bij *Niet te verkopen aan winkels*.

### Charges

Heeft het voorwerp ladingen, zet dan *Charges* aan. Het **maximum** is een getal. **Herlaadt bij** kent drie standen: helemaal vol na een lange rust, helemaal vol na een korte rust, of een deel terug met een worp — dan verschijnt het veld waarin je die worp zet (`1d3`). *Speler mag zijn eigen maximum bijstellen* geeft de speler ±-knopjes bij de bolletjes in zijn boedel; handig als het maximum per exemplaar verschilt.

### Wie heeft het

Bij een bestaand voorwerp staat rechts het tabblad **Bezit**: wie het heeft, in welke party, hoeveel exemplaren en hoeveel charges er nog in zitten. Daar deel je het ook uit — en neem je het weer af als je één keer te veel klikte.

### Waar het te koop is

Dat leg je niet hier vast maar in de **voorraad van de winkel**. Het voorwerp toont daarna vanzelf een regel *Te koop* met de winkel erachter — één plek, twee kanten, net als bij de betrokkenen op een locatie.

---

## `hulp_kaart_dungeon`

> Helpknop in: app.js:3253
> Nu: de standaard uit de code

Titel: Een dungeon bewerken

### Naam, beschrijving en beeld

De thumbnail is het plaatje op het kaartje in de galerij. Dat kaartje snijdt bij, dus sleep het kruisje naar wat in beeld moet blijven — net als bij een personage of een aktebanner.

### Verdieping

**0** is de begane grond, **−1** een kelder, **1** de eerste verdieping. Leeg laten als deze kaart niet bij een gebouw met verdiepingen hoort. Welke kaarten samen één gebouw vormen leidt de app af uit de **trappen** die je ertussen tekent; bovenin verschijnen dan knopjes om te wisselen.

### Zichtbaarheid

Die zet je niet hier maar op het kaartje zelf, met het oogje — en hij geldt voor de **actieve party**, net als bij elk ander kaartje. Drie standen: verborgen, zichtbaar met fog-of-war (kamers onthul je één voor één), en uitgespeeld (de hele plattegrond ligt open).

---

## `hulp_kaart_wereld`

> Helpknop in: app.js:3253
> Nu: de standaard uit de code

Titel: Een kaart bewerken

### Naam en beschrijving

De naam staat op het kaartje in de galerij en boven de kaart zelf; de beschrijving staat eronder, zodat je bij zes kaarten nog weet welke welke is.

### Wie ziet wat

Een hoofdkaart is voor iedereen zichtbaar. Wat een speler erop ziet hangt aan de **locaties**: een speld erft de zichtbaarheid van het kaartje waar hij bij hoort. Verberg dus de locatie, niet de kaart.

---

## `hulp_kijk_locaties_info`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **locaties**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Deze plek

### Wat je ziet

De beschrijving vertelt wat deze plek is. Onder de naam staat het **type** en het gebied waarin het ligt. Namen in de tekst die je al kent zijn klikbaar: zo loop je van een herberg naar zijn waard en verder.

### Wie hier bij hoort

Onder de beschrijving staat wie aan deze plek verbonden is — de eigenaar, de waard, vaste gasten — met hun rol ervoor. Staat er een knop omheen, dan heb je dat kaartje al ontdekt en kun je erop klikken.

### Roddels en geheimen

De **roddel** is wat je hier hebt opgevangen; er komen er soms meer bij naarmate je vaker langsgaat. Bij meerdere blader je met de pijltjes. Een **geheim** verschijnt pas als je het ontdekt hebt — wat je niet ziet, weet je nog niet.

---

## `hulp_kijk_locaties_kaart`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **locaties**, tabblad **kaart**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Waar ligt dit

### Op de kaart

Een uitsnede van de kaart rond deze plek, met een rode stip erop. *Toon op de hele kaart* opent de kaart zelf; linksboven kom je met één klik weer terug bij dit kaartje.

### Plattegrond

Staat er een plattegrond bij, dan hoort die bij dit gebouw of deze kelder. Je ziet er alleen de ruimtes op die je party al ontdekt heeft — de rest blijft in het donker tot je er bent geweest.

---

## `hulp_kijk_locaties_voorraad`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **locaties**, tabblad **voorraad**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: De voorraad

### Kopen

Wat hier in de schappen ligt, met de prijs in de munt van de campagne. Klik een voorwerp om het te kopen; het bedrag gaat van je beurs af (of van de gedeelde beurs, als je die gebruikt) en het voorwerp komt in je boedel.

### Niet alles ligt er altijd

Sommige winkels tonen maar een deel van hun voorraad en verversen dat om de zoveel tijd. Kom je later terug, dan kan er iets anders liggen.

---

## `hulp_kijk_organisaties_info`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **organisaties**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Deze organisatie

### Wat je ziet

Het type en het motto staan onder de naam; de beschrijving vertelt waar ze voor staan. Onder **Wie hoort hier bij?** staan de leden die je kent, met hun rol of rang; onder **Waar hoort deze organisatie bij?** staat waar de organisatie zelf onder valt — en of ze een **factie** zijn waar je aanzien bij kunt opbouwen.

### Roddels en geheimen

Wat er over ze verteld wordt staat bij de **roddel**; bij meerdere blader je met de pijltjes. Een **geheim** verschijnt pas als je het ontdekt hebt — bij een gilde of een bende is dat vaak het interessantste dat er over te weten valt.

---

## `hulp_kijk_organisaties_organogram`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **organisaties**, tabblad **organogram**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Organogram

### Wie staat boven wie

De structuur zoals je die kent: bovenaan wie leidt, daaronder wie aan hem rapporteert. Klik een naam om zijn kaartje te openen.

### Onbekend

Staat er **Onbekend**, dan weet je dát die plek bestaat maar niet wie hem vult — de rol staat er wel bij. Ontmoet je hem later, dan verschijnt zijn naam vanzelf op deze plek.

---

## `hulp_kijk_personages_info`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **personages**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Dit personage

### Wie is dit

Onder de naam staan zijn rol, volk en klasse. De beschrijving vertelt wat je van hem weet; namen die je al kent zijn klikbaar. Een badge op de kaart laat zien of hij een verkoper is of je in de weg staat.

### Roddels en geheimen

De **roddel** is wat er over hem verteld wordt — bij meerdere blader je met de pijltjes. Een **geheim** zie je pas als je het ontdekt hebt; onthulde geheimen kunnen alles veranderen wat je van iemand dacht te weten.

### Waar hoort hij bij

Onder **Waar hoort dit personage bij?** staat waaraan hij verbonden is: eigenaar van een herberg, lid van een gilde, verkoper in een winkel. Klik erop om daarheen te gaan.

---

## `hulp_kijk_personages_sheet`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **personages**, tabblad **sheet**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Het blad

### Statblock

De gevechtsgegevens: **AC** (hoe moeilijk hij te raken is), **HP**, speed, de zes ability scores met hun modifier, en zijn traits en actions. Bij een huisdier hoort het blok dat past bij het level van zijn baasje — hij groeit met je mee.

---

## `hulp_kijk_voorwerpen_info`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **voorwerpen**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code

Titel: Dit voorwerp

### Wat je ziet

De kleur van de rand is de **rarity**: grijs (Common) tot goud (Legendary). Staat er *Requires Attunement*, dan moet je je er tijdens een rust aan binden voordat het werkt. Een schadewaarde is een knop: klik erop om de dobbelsteen te gooien.

### Charges

Heeft het voorwerp ladingen, dan staan die als bolletjes in je boedel. Ze laden vanzelf weer op bij het soort rust dat erbij vermeld staat.

---

## `hulp_muziek`

> Helpknop in: dm-panel.js:10790
> Nu: de standaard uit de code

Titel: Muziek uit Spotify

### Koppelen: de client-id

Maak op **developer.spotify.com/dashboard** een app aan — die hoort bij jóúw Spotify-account, en de client-id eruit is niet geheim. Zet in die app het **Redirect-URI** dat hier in het scherm staat; het moet er letterlijk in staan, inclusief het campagnepad. Kies bij de instellingen van die app **Web API**, en ook **Web Playback SDK** als je het geluid uit het tafelscherm wilt laten komen. Een tweede campagne heeft dus een eigen redirect-URI in datzelfde dashboard.

### Hoe het werkt

Grisburgh speelt zelf niets af: het drukt op **play** bij Spotify. In een akte zet je een muziekstap neer (de muzieknoot in het regie-script); tijdens het spelen start je die met de muzieknoot in de regie-balk. Per stap kies je of het nummer één keer speelt of blijft herhalen.

### Waar komt het geluid uit

Standaard uit het apparaat waarop jij Spotify hebt draaien — meestal de laptop waarop je de regie bedient. Kies je *Het tafelscherm*, dan meldt de tablet zich zelf aan als Spotify-speler; die moet dan wel open staan en één keer aangeraakt zijn, want een browser mag pas geluid maken na een aanraking.

### Wat Spotify eist

**Premium**, anders weigert Spotify het afspelen op afstand. En er speelt maar **één stream per account**: luistert er iemand anders op hetzelfde account, dan nemen jullie het van elkaar over.

### Het volume

Het getal stuurt het volume van de speler waar je naartoe speelt. Laat je het leeg, dan blijft staan wat er stond — handig als je het aan tafel met de knop op je speaker regelt.

### Je aanbevelingen

Wat je aan tafel draait telt gewoon mee voor Discover Weekly en Wrapped. Een **privésessie** valt niet vanuit een app aan te zetten — Spotify heeft daar geen knop voor in zijn API. Zet hem zelf aan in Spotify (profiel → *Privésessie*), of — handiger omdat je het niet kunt vergeten — zet je sfeermuziek in eigen afspeellijsten en vink daar *Uitsluiten van je smaakprofiel* aan.

---

## `inst_beheer`

> Helpknop in: dm-panel.js:10783
> Nu: de standaard uit de code

Titel: Beheer

### Jouw DM-wachtwoord

Geldt alleen voor deze campagne en wordt **versleuteld** opgeslagen, zodat het niet leesbaar in een backup staat. Twee keer intikken, want met een typefout hierin sluit je jezelf buiten.

### Op de openingspagina

Het kale adres toont een keuzepagina met alle campagnes die zich laten zien. Vink dit uit en deze campagne staat er niet tussen; wie het pad kent komt er nog gewoon in.

### Naslag elders

Niet elke regeltekst mag in de app staan: wat niet in de vrije SRD zit heeft bij ons geen beschrijving. **Linken mag wel.** Hier zet je waarnaar die verwijzing gaat — een zoekopdracht met `{zoek}` erin, of `{naam}` en `{soort}` als je het zelf wil samenstellen. Leeg is een zoekmachine, en dat werkt beter dan een diepe link: die verlept zodra de andere site zijn adressen verandert.

### Campagnes en modules

Alleen de beheerder ziet dit. Per campagne staat hier het DM-wachtwoord, welke campagne de **standaard** is (waar het kale adres naartoe stuurt) en welke **modules** aanstaan. Wat uit staat verdwijnt uit beeld — bij de DM én bij zijn spelers; er komt geen grijze "binnenkort"-knop voor in de plaats.

---

## `inst_beurs`

> Helpknop in: dm-panel.js:10459
> Nu: de standaard uit de code

Titel: De gedeelde beurs

### Eén zak of ieder zijn eigen

Staat de gedeelde beurs **aan**, dan is dát de portemonnee van de party: iedereen ziet hetzelfde bedrag, en alles wat gekocht of gevonden wordt gaat erin en eruit. Staat hij **uit**, dan heeft elke speler zijn eigen beurs.

### Per party

De schakelaar geldt per party, en hij staat daarom in het kaartje van díé party — zo verzet je nooit per ongeluk de beurs van een tafel die je niet bedoelde. Wil je ze naast elkaar zien, open dan de party's een voor een; er is bewust geen tweede lijst met alle saldo's, want twee weergaven van hetzelfde bedrag lopen vroeg of laat uit elkaar.

### Omzetten raakt geen geld kwijt

De twee zakken bestaan naast elkaar: zet je de gedeelde beurs uit, dan komt ieders eigen beurs weer tevoorschijn zoals die was, en het gedeelde bedrag blijft staan tot je hem weer aanzet. Er verdwijnt dus niets, maar reken er ook niet op dat geld mee verhuist.

---

## `inst_campagne`

> Helpknop in: dm-panel.js:10644
> Nu: de standaard uit de code

Titel: De campagne

### Titel en ondertitel

De **titel** is de naam van je wereld: hij staat op de landingspagina, in de kop en als naam van de app op een beginscherm. De **ondertitel** staat eronder — een regel sfeer, of de naam van de groep.

### Embleem: het wapen ín de app

Het **embleem** is het wapen dat je in de app zelf ziet: groot op de landingspagina, klein in de kop. Het is een gewone afbeelding uit de mediabibliotheek, dus een schild, een zegel of een wapenschild werkt allemaal.

### App-icoon: het wapen búiten de app

Het **app-icoon** is een ander ding: dat is het plaatje dat je telefoon of tablet gebruikt zodra je de app aan je beginscherm toevoegt, plus het icoon in het tabblad van de browser. Daarom staat het los van het embleem — een embleem mag een brede tekening zijn, een icoon moet als vierkantje van een halve centimeter nog leesbaar zijn. Laat je het leeg, dan wordt het meegeleverde wapen gebruikt. Een app die al op een beginscherm staat houdt zijn oude icoon tot hij er opnieuw op wordt gezet; dat bewaart het besturingssysteem, daar kunnen wij niets aan doen.

---

## `inst_campagnes`

> Helpknop in: dm-panel.js:10752
> Nu: de standaard uit de code

Titel: Campagnes en modules

### Alleen de beheerder

Dit blok zie jij omdat je de beheerder bent. Elke campagne heeft haar eigen wereld, party's en wachtwoord; hier staan ze naast elkaar. *Openen* brengt je erheen — je logt daar in met **haar** DM-wachtwoord, niet het jouwe.

### De standaard

Eén campagne is de standaard: daar landt het kale webadres, en daar komt een bezoeker terecht die nog nergens is ingelogd. De rest is bereikbaar via zijn eigen adres.

### Modules

Wat uit staat verdwijnt uit beeld — bij jou én bij je spelers. Er komt geen grijze "binnenkort"-knop voor in de plaats: een dienst die deze campagne niet heeft, bestaat er gewoon niet. Aanzetten kan altijd weer, en er gaat niets verloren zolang hij uit staat.

### Een nieuwe campagne

Naam, ondertitel en meteen een **DM-wachtwoord** — zonder dat komt er niemand in, want alleen de standaardcampagne valt terug op het serverwachtwoord. De vraag *XP of Milestone* staat er ook bij; die bepaalt de hele level-up-kant, en je kunt hem later omzetten bij Campagne → Level omhoog.

---

## `inst_export`

> Helpknop in: dm-panel.js:10801
> Nu: de standaard uit de code

Titel: Export & backup

### Drie uitdraaien

De **snapshot** is een HTML-bestand met de stand van de campagne, het **campagneboek** is de verhalende vorm met inhoudsopgave, en de **character sheets** zijn de printbare bladen van de actieve party — die kun je in je browser als pdf bewaren.

### Wat er níét in staat

Beide exports gebruiken dezelfde filter als de app zelf: wat een party nog niet ontdekt heeft, gaat niet mee. Geef je een bestand aan je spelers, dan staan jouw aantekeningen, de geheimen en het regie-script er dus niet in.

### De echte backup draait vanzelf

Dit is een uitdraai om te lezen, geen reservekopie. Elke nacht maakt de server een kopie van alle campagnes en bewaart die dertig dagen; de character sheets gaan daar als HTML in mee. Je hoeft hier dus niets te doen om veilig te zitten.

---

## `inst_levelup`

> Helpknop in: dm-panel.js:10717
> Nu: de standaard uit de code

Titel: Level omhoog

### XP of Milestone

Bij **Milestone** gun jij het level: je zet een level-up klaar wanneer het verhaal daar is. Bij **XP** wordt hij verdiend — je deelt punten uit met de XP-knop in de regie-balk (die het bedrag van het lopende gevecht al voorstelt) en de level-up staat vanzelf klaar zodra iemand over de drempel komt. Omzetten kan altijd.

### De nullijn bij XP

Speelde je eerst op Milestone, dan heeft iedereen wel een level maar nog geen XP en staat elke balk op nul. De knop **Ieders XP op de nullijn zetten** geeft ieder het minimum dat bij zijn huidige level hoort; wie al meer had houdt dat, en niemand krijgt er een level-up van. Twee keer drukken kan dus geen kwaad.

### Hoe komt de HP erbij

Drie manieren: het **gemiddelde** (het vaste getal uit het boek), **in de app gooien** (de server gooit de hit die) of **zelf gooien** aan tafel, waarna de speler zijn worp intikt en de server hem toetst. Wat je hier uitvinkt kan een speler niet kiezen; de server weigert een manier die uitstaat. Vink je alles uit, dan kan niemand meer omhoog — dat wordt daarom geweigerd.

### Hoogste level

Waar de tijdlijn ophoudt. Twintig is de normale grens van 5e; hoger zet hem alleen open, het vult geen nieuwe features in.

---

## `inst_partys`

> Helpknop in: dm-panel.js:10764
> Nu: de standaard uit de code

Titel: Party's

### Eén regel per party

Elke party staat op één regel met het aantal personages en een slotje als er een wachtwoord is. Klik erop en je krijgt alles van díé party bij elkaar: naam, wachtwoord, wie erbij hoort, wie er vanavond meespeelt en de gedeelde beurs.

### Personages: koppelen en losmaken

Onder **Personages** staat wie bij deze party hóórt — dat is blijvend, het staat op het kaartje van het personage zelf. Losmaken met het kruisje betekent dat hij bij geen enkele party meer hoort en dus niets meer van de campagne ziet. Wat bij de party ligt blijft daar: voorwerpkaartjes, onthulde geheimen en welke kaartjes ontdekt zijn staan per party, niet per personage. De vraag vóór het losmaken zegt precies hoeveel dat er zijn.

### Waarvan actief is iets anders

Onder **Waarvan actief** zet je iemand tijdelijk buiten de sessie — de speler die er niet is. Dat bepaalt wie meedoet bij rust, bij het verdelen van buit en bij het vullen van een gevecht, en het is met één klik terug te draaien. Bewust de afwezigen die bewaard worden en niet de aanwezigen: een personage dat erbij komt doet dan vanzelf mee.

### Het wachtwoord van een party

Dat is wat je je spelers stuurt; ze kiezen daarna zelf hun personage. Groepswachtwoorden blijven leesbaar staan — je moet ze kunnen opzoeken als iemand het kwijt is. Jouw eigen DM-wachtwoord staat onder **Beheer** en wordt wél versleuteld.

---

## `inst_valuta`

> Helpknop in: dm-panel.js:10667
> Nu: de standaard uit de code

Titel: Namen voor valuta

### Drie munten, vaste verhouding

Je campagne mag haar munten noemen zoals je wilt — de verhouding blijft die van het boek: **1 gold = 10 silver = 100 copper**. De afkortingen gp/sp/cp staan erbij zodat een tabel uit een boek altijd klopt, ook als jouw munten Florinde, Knaker en Centeling heten.

### Electrum en platinum

Die twee hebben géén eigen plek in de beurs: wat je erin typt wordt bij het invoeren omgerekend (ep = 5 silver, pp = 10 gold). Een vondst mag dus een platinum stuk bevatten; het staat daarna gewoon als goud in de beurs. Geef je ze een naam, dan wordt die alleen gebruikt om te tónen: *"waaronder 3 Lion d'or"* bij een vondst.

### Hernoemen kan altijd

De namen zijn opmaak, geen administratie — al het bezit staat als getal opgeslagen. Je kunt dus halverwege een campagne je munten omdopen zonder dat er iets kwijtraakt.

---

## `kaart`

> Helpknop in: app.js:3018, render-kaart.js:134
> Nu: de standaard uit de code

Titel: De kaart

### Wereld- en stadskaart

Wissel tussen de **wereldkaart** en de **stadskaart**. Pins markeren ontdekte locaties — klik een pin om het bijbehorende kaartje te openen. Zoom met de knoppen of scroll.

---

## `knapzak`

> Helpknop in: app.js:8572
> Nu: **aangepast in deze campagne**
> De standaard telt 3 stap(pen).

Titel: Boedel

### Boedel en knapzak

Hier staan al je bezittingen: je beurs, jouw voorwerpen en de zegeningen en voordelen die je hebt. Scroll door de carrousel om al je voorwerpen te zien. Klik op een kaartje om het volledig te bekijken. Je kunt ook nieuwe voorwerpen, waarvoor de DM (nog) geen kaartje heeft aangemaakt, handmatig toevoegen.

### Charges en gebruik

Sommige voorwerpen hebben charges (oplaadpunten). Klik op een bolletje om een charge te verbruiken. Wapens met schade tonen een knopje. Klik erop om een dobbelsteen te werpen.

### Zegeningen, vloeken en voordelen

Je actieve zegeningen, eden, vloeken en factievoordelen staan apart vermeld. Klik op "bekijk zegening" of "bekijk eed" om het bijbehorende voorwerpkaartje te openen.

### Gedeelde beurs

Standaard houd je je eigen geldbeurs bij. Als de groep daarvoor kiest, kan de beurs ook gedeeld worden. Je moet elkaar dan wel een beetje vertrouwen.

---

## `locaties`

> Helpknop in: render-campagne.js:2861 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> De standaard telt 1 stap(pen).

Titel: Locaties

### Locaties

De **plekken** van Grisburgh en daarbuiten. Een locatie met het type *Winkel* heeft een voorraad waar je voorwerpen kunt kopen en verkopen. Filter via de trechter op o.a. *Winkel*. Klik op een kaart voor meer informatie.

---

## `logboek`

> Helpknop in: render-archief.js:200
> Nu: de standaard uit de code

Titel: Logboek

### Verslagen

Hier staan de sessieverslagen van de campagne, aangevuld met notities van de DM. Je kunt door aktes bladeren via de navigatie bovenaan.

### Missies (prikbord)

Op het prikbord staan alle missies van de campagne, ingedeeld op status: Beschikbaar, In uitvoering, Voltooid en Mislukt. Klik op een missiekaartje voor de details.

---

## `magizoo`

> Helpknop in: app.js:12539
> Nu: **aangepast in deze campagne**
> De standaard telt 2 stap(pen).

Titel: Vivarius

### Vivarius

Vivarius onderzoekt wezens die de groep heeft gezien of bevochten. Per onderzoek onthult hij meer over het wezen in je bestiarium, van enkel een naam, naar rudimentaire gegevens tot een volledig plaatje. Elk onderzoek kost geld en heeft tijd nodig.

### Kennisniveaus en gevechten

Er zijn drie kennisniveaus: naam (alleen de identiteit van het wezen), deels (AC, ability scores, resistances en talen) en volledig (traits, actions en CR). Hoe meer je weet, hoe beter je de HP-balk in een gevecht kunt aflezen. Bij deels/volledig zie je het exacte HP.

---

## `markt`

> Helpknop in: app.js:11786
> Nu: de standaard uit de code

Titel: De Markt

### Waarom dit scherm er is

Een winkel is een tabblad **op een kaartje**: om iets te kopen moest je weten dat die winkel bestaat, hem opzoeken in Locaties en dan het tabblad vinden. De Markt is de ingang — alle winkels die je party kent en nu kan bereiken, op één plek.

### Zoeken over alle winkels tegelijk

Typ een voorwerp en je ziet **waar het ligt en wat het kost**, goedkoopste bovenaan. Scheelt prijs per winkel, dan staat er *goedkoopst* bij; zijn ze allemaal gelijk, dan staat er niets — dat is dan geen keuze. Een prijs die je met de beurs van de party niet kunt betalen kleurt rood.

### Kopen doe je in de winkel

Klikken opent het kaartje van die winkel op zijn **winkeltabblad**. Daar reken je af, met de winkelier, zijn humeur en het onderhandelen dat daarbij hoort. De Markt zegt alleen waar je heen kunt.

### Wat je niet ziet

Alleen winkels die je party **ontdekt heeft** en die tijdens deze akte bereikbaar zijn. Een winkel met een **wisselend assortiment** die je nog niet bezocht hebt, geeft zijn voorraad niet prijs — daar moet je langs. De DM ziet alles, met erbij waarom iets voor de party dicht zit.

---

## `organisaties`

> Helpknop in: render-campagne.js:2861 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> De standaard telt 1 stap(pen).

Titel: Organisaties

### Organisaties

Gilden, ordes en groeperingen in de wereld. Klik op een kaart voor hun doel, leden en banden met andere partijen.

---

## `party`

> Helpknop in: app.js:8031
> Nu: **aangepast in deze campagne**
> De standaard telt 2 stap(pen).

Titel: Party

### Party

Dit tabblad toont de andere leden van jouw groep. Je kunt zien wie aanwezig is voor de sessie.

---

## `personage`

> Helpknop in: app.js:8165
> Nu: **aangepast in deze campagne**
> De standaard telt 3 stap(pen).

Titel: Mijn personage

### Combat stats

Hier stel je je gevechtswaarden in: AC, snelheid, initiative bonus, proficiency bonus en hit dice. Deze worden niet allemaal automatisch berekend. Vul ze in vanuit je character sheet.

### HP bijhouden

Gebruik de + en − knoppen om HP bij te houden tijdens gevecht. Je kunt ook Temporary HP instellen.

### Ability Scores

Je ability scores en skill proficiencies stel je in op dit tabblad. Modifiers worden automatisch berekend. Klik twee keer op een skill om Expertise te noteren. Met de pijltjes kun je handmatig aanpassingen doen, bijvoorbeeld omdat een nieuwe vaardigheid dat aangeeft.

### Kenmerken en eigenschappen

Hier staan de kenmerken en eigenschappen die je ontvangt vanwege je origin, class, subclass of background. Deze worden grotendeels automatisch ingevuld, maar soms helpt de DM mee met knutselen. Je kunt een aantal bolletjes per eigenschap instellen, die je dan makkelijk als reminder kunt afvinken zodra je een eigenschap hebt gebruikt.

---

## `personages`

> Helpknop in: render-campagne.js:2861 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: de standaard uit de code

Titel: Personages

### Personages

Hier vind je de **personages** die je hebt ontmoet — NPC’s én de avonturiers van het gezelschap. Klik een kaart voor details, geheimen en relaties. De DM bepaalt wie zichtbaar is.

---

## `prikbord`

> Helpknop in: render-relatiemap.js:98
> Nu: de standaard uit de code

Titel: Het prikbord

### Wat het is

Een bord van de **party**: wie horen bij wie, wie hebben jullie waar gezien, welk vermoeden hangt aan welke naam. Elke party heeft haar eigen bord en iedereen in die party ziet hetzelfde.

### Prikken en verbinden

**Kaartje** zet een personage, locatie of organisatie op het bord — of een blanco notitie met je eigen tekst. **Draad** spant een lijn tussen twee kaartjes; klik op een draad om er een woord bij te zetten of hem weg te halen. Kaartjes sleep je waar je ze hebben wilt.

### Organogram

Zet een hele organisatie in één keer neer: de leden komen eronder te hangen, met een draad naar hun baas. Wat de party nog niet kent, komt niet mee — ook geen verbinding die achter een geheim zit.

---

## `progressie`

> Helpknop in: render-progressie.js:385
> Nu: de standaard uit de code

Titel: Progressie

### Jouw progressie

Dit tabblad toont alle class features en abilities van je karakter, geordend per level. Vergrendelde levels (hoger dan je huidige level) zijn grijs weergegeven. Je kunt wisselen tussen tijdlijn- en kaartweergave.

### Waar de tekst vandaan komt

De features komen uit de progressie van deze campagne. Staat daar een **samengevat** startpunt, dan is dat de meegeleverde set — de DM kan die in de editor nakijken en aanvullen. Beschrijvingen die niet in de vrij te gebruiken SRD staan blijven leeg, met een verwijzing naar een plek waar ze wél staan.

### Favorieten & keuzes

Markeer een feature als favoriet door op ☆ te klikken — zo vind je hem snel terug. Bij keuze-features (zoals Ability Score Improvement) kun je je keuze noteren. Dit wordt opgeslagen en is zichtbaar op het kaartje.

---

## `spreuken`

> Helpknop in: render-spreuken.js:379
> Nu: de standaard uit de code

Titel: Spreuken — de bibliotheek

### Dit zijn niet jouw spreuken

Deze bibliotheek bevat álle spreuken die in deze wereld bestaan — honderden, van elke klasse en elk niveau, en daarnaast wat de DM voor deze campagne zelf verzon. Je kunt er alles in opzoeken, maar je kent het niet uit je hoofd: wat jouw personage daadwerkelijk kan, staat in je eigen Spreukenboek onder je personage.

### Waar staan mijn eigen spreuken dan?

Ga naar je personage en kies het tabblad Spreukenboek. Daar staat alleen wat jij kent, met je Spell Save DC, je spell attack bonus en je spell slots. Wat je daar niet ziet, kun je ook niet casten — hoe verleidelijk het hier ook staat.

### Waar is het dan goed voor?

Om op te zoeken wat een spreuk van een tegenstander doet, om te kijken wat je bij een volgend level zou kunnen leren, of om een scroll of staf op te zoeken die je gevonden hebt. Filter op class, level of school, of zoek op naam.

### Nieuwe spreuken leren

Spreuken komen in je eigen boek terecht via je klasse (bij een levelup), via een scroll of via de DM. Rondkijken in de bibliotheek voegt niets toe aan je boek — vraag het je DM als je denkt dat er iets ontbreekt.

---

## `spreukenboek`

> Helpknop in: app.js:8918
> Nu: de standaard uit de code

Titel: Spreukenboek

### Spreukenboek

Hier staan JOUW spreuken, geordend op level — niet te verwarren met het tabblad Spreuken in de zijbalk, dat de hele bibliotheek toont. Bovenaan zie je je Spell Save DC, spell attack bonus en beschikbare spell slots. Klik op een spreuk voor de volledige beschrijving.

### Spell slots

Je spell slots worden weergegeven als bolletjes per level. Een gevuld bolletje is beschikbaar, een leeg bolletje is verbruikt. Klik op een bolletje om het te markeren als verbruikt, of klik opnieuw om het terug te zetten. Slots herstellen na een lange rust.

### Vastgepinde spreuken

Veelgebruikte spreuken kun je vastpinnen via de ster (★) op het kaartje. Ze verschijnen dan ook als snelknoppen op het Party-tabblad, zodat je ze snel kunt raadplegen tijdens gevecht.

---

## `tempel`

> Helpknop in: app.js:12876, app.js:12943
> Nu: **aangepast in deze campagne**
> De standaard telt 3 stap(pen).

Titel: De Tempel

### De Tempel

De Tempel is de plek waar je de goden van Grisburgh kunt vereren. Elke god heeft een eigen priester, een eigen domein en eigen gunsten. Bidden kost geld, maar de zegeningen en eden die je ontvangt, kunnen je lot in gevecht drastisch veranderen.

### Zegeningen

Een zegening is een tijdelijk voordeel van een god. Je rolt een dobbelworp en ontvangt één van de zegens van die god, elk met een ander effect. Je kunt maar één zegening van een god hebben. Ontvang je een nieuwe, dan verdwijnt de oude. Verbruik je de zegening, dan is hij weg tot je een nieuwe koopt.

### Eden & Vloeken

Een eed is een permanente verbintenis met een god. Je ontvangt een blijvende bonus (bijv. STR +1), maar als je de eed verzaakt, krijg je een vloek. Een vloek kun je afkopen door boete te doen in de tempel, maar daar hangt een stevig prijskaartje aan. Je kunt maar één eed tegelijk dragen.

---

## `tweespalt`

> Helpknop in: app.js:13258
> Nu: **aangepast in deze campagne**
> De standaard telt 0 stap(pen).

Titel: De Tweespalt

### De Tweespalt

Bij De Tweespalt kun je wedden op gevechten en verkiezingen. Kies een weddenschapsoptie, bepaal je inzet en bevestig. Als de uitkomst in jouw voordeel uitvalt, keert de DM de winst uit.

### Leningen

Als je goud tekort komt kun je een lening afsluiten bij ~~woekeraar~~ lommerd Taevin Woekeling. Let op: leningen hebben rente en moeten terugbetaald worden. Kom je niet na, dan volgen er mogelijk nare consequenties.

---

## `ursula`

> Helpknop in: app.js:12798
> Nu: **aangepast in deze campagne**
> De standaard telt 2 stap(pen).

Titel: Madame Ursula

### Madame Ursula

Madame Ursula leest de toekomst aan de hand van vijf zintuiglijke gewaarwordeningen. Eén keer per akte kan de groep een voorspelling vragen. De uitslag is voor iedereen tegelijk zichtbaar. De voorspelling is vaag en poëtisch, nooit een belofte.

### De zintuigen

De zintuigen zijn zien, horen, ruiken, proeven, voelen. Als je goed dobbelt, ziet Ursula een concreet persoon of locatie.

---

## `vaardigheden`

> Helpknop in: render-vaardigheden.js:632
> Nu: de standaard uit de code

Titel: Vaardigheden

### Alles bij elkaar, niet alleen wat jij hebt

Hier staan de **class features**, **subclass features**, **species traits**, **feats**, **Epic Boons** en **backgrounds** van deze wereld bij elkaar. Wat jóuw personage ervan heeft, staat op je tijdlijn onder Progressie; dit is de plek om op te zoeken wat er te krijgen valt.

### Waar is het goed voor?

Om te kijken wat *Sentinel* doet vóórdat je hem kiest, om te zien wat een andere subclass op level 6 krijgt, of om na te lezen wat een tegenstander met zijn class feature kan. Filter op soort, op klasse of soort, of op het level waarop iets komt — of zoek gewoon op naam.

### Staat er soms geen tekst?

Dan mag hij hier niet staan. De **SRD**-teksten zijn vrij te gebruiken en staan er voluit; de rest niet, en daar staat een knop *Lees hem elders* die je naar een naslagpagina brengt. Wat de DM zelf schreef staat er altijd.

---

## `voorwerpen`

> Helpknop in: render-campagne.js:2861 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> De standaard telt 1 stap(pen).

Titel: Voorwerpen

### Voorwerpen

Wapens, uitrusting en magische items. Je kunt voorwerpen claimen, ruilen en in winkels kopen en verkopen. **Zegeningen & Gunsten** (tempel- en factie-beloningen) staan onder een eigen filter, los van de gewone voorwerpen.

### Geclaimde en geschonken voorwerpen

Voorwerpen die je hebt geclaimd of die de DM je heeft gegeven, verschijnen op je personagetabblad. Sommige voorwerpen kunnen maar een aantal keer gebruikt worden. Andere voorwerpen hebben een beperkt aantal *charges*, die opladen na een Short of Long Rest.

---
