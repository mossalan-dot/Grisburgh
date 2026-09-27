_104 sleutels · 16 aangepast in **grisburgh** · rest is de standaard uit de code._

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

## `dm_detective`

> Helpknop in: dm-panel.js:6181
> Nu: de standaard uit de code

Titel: De detective

### Wat hij doet

Spelers leggen een vraag bij hem neer over een persoon, plek of voorwerp. Dat kost geld en tijd; het antwoord schrijf jij. Zo kunnen ze iets uitzoeken zonder dat de hele tafel stilvalt.

### Het antwoord is een scène

Schrijf wat hij *gevonden* heeft, niet wat waar is — een detective kan zich vergissen, of net te laat komen. Dat maakt van een opzoekactie een verhaallijn.

---

## `dm_facties`

> Helpknop in: dm-panel.js:6874
> Nu: de standaard uit de code

Titel: Facties

### Wat een factie is

Een groep met een naam, een embleem en een **ladder** van zes treden. Hoe meer aanzien een party heeft, hoe hoger ze staan — en hoe meer er voor hen opengaat.

### Hoe de sectie heet

De naam boven dit onderdeel stel je zelf in (bij ons *Facties & Aanzien*). Zo kan het in jouw wereld net zo goed *Huizen* of *Orden* heten.

### Zich voorstellen per brief

Een factie kan zich met één klik voorstellen aan de actieve party: dat onthult haar en bezorgt elke speler een verzegelde brief. Een mooiere binnenkomst dan een vinkje omzetten.

---

## `dm_facties_leden`

> Helpknop in: dm-panel.js:6953
> Nu: de standaard uit de code

Titel: Leden van een factie

### Wie erbij hoort

Koppel personagekaartjes aan de factie. Dat werkt twee kanten op: op hun eigen kaartje staat daarna dat ze hierbij horen.

### Wat de spelers zien

Een lid dat de party nog niet kent, verschijnt niet bij naam. Een organisatie ontmantelen is het spel; de ledenlijst is niet gratis.

---

## `dm_facties_rangen`

> Helpknop in: dm-panel.js:6975
> Nu: de standaard uit de code

Titel: Rangen

### Zes treden

Elke trede heeft een naam en een drempel aan aanzien (0, 1, 3, 10, 25, 50). Alleen trede 0 krijgt standaard een naam — *Buitenstaander* — want die beschrijft de mechaniek en niet jouw wereld.

### Wat een trede oplevert

Een titel, en wat jij eraan hangt: toegang, een gunst, een korting. De app rekent de trede uit; wat hij betekent is een afspraak aan tafel.

---

## `dm_geluiden_condities`

> Helpknop in: dm-panel.js:7642
> Nu: de standaard uit de code

Titel: Conditiegeluiden

### Alle condities die de app kent

De lijst komt uit dezelfde bron als de conditiekaartjes en de tokens, dus elke condition die je op een deelnemer kunt zetten staat hier — je hoeft niet meer te kiezen uit een handvol.

### De zwaarste wint

Staan er meerdere tegelijk op iemand, dan klinkt alleen de zwaarste. Anders zou het bij een goede ronde een kakofonie worden.

### Concentration is de uitzondering

Die klinkt niet bij het toepassen maar bij het begin van elke nieuwe ronde, zolang er iemand concentreert — het is een herinnering, geen gebeurtenis.

---

## `dm_geluiden_decors`

> Helpknop in: dm-panel.js:7627 (de subtab-balk stelt de sleutel samen uit het actieve tabje)
> Nu: de standaard uit de code

Titel: Decors

### Wat een decor is

Een sfeerloop die je aanzet voor de hele tafel: regen op een dak, een drukke markt, wind over een vlakte. Hij klinkt vooral op het **tafelscherm** (dat is de speaker die iedereen hoort); een speler kan hem op zijn eigen toestel aanzetten met de dempknop in de kop.

### Eén tegelijk

Er speelt één decor. Zet je een ander aan, dan vervangt die de vorige — je hoeft dus niets uit te zetten voor je iets anders kiest.

### Momenten en diensten

Daaronder staan de klanken die de app **zelf** op het juiste moment speelt: een korte klank bij het onthullen van buit of een level-up, de loop tijdens een rust, en een sfeerloop per dienst die begint zodra iemand daar binnenloopt.

---

## `dm_geluiden_diensten`

> Helpknop in: dm-panel.js:7573
> Nu: de standaard uit de code

Titel: Geluid per dienst

### Begint vanzelf

Loopt iemand een dienst binnen — de herberg, de tempel, het gokhuis — dan begint deze loop op zijn eigen toestel. Daar is geen sessie of tafelscherm voor nodig.

### Een decor gaat voor

Speelt er een decor voor de hele tafel, dan heeft dat voorrang: dat is het geluid van de scène waar jullie samen in zitten.

### Ook per factie

Elke factie kan een eigen loop hebben, zodat het gildehuis anders klinkt dan de tempel.

---

## `dm_geluiden_facties`

> Helpknop in: dm-panel.js:7575
> Nu: de standaard uit de code

Titel: Sfeerloop per factie

### Wat het doet

Opent een speler het scherm van deze factie, dan begint deze loop zachtjes te spelen. Zo klinkt het gilde anders dan de tempel, zonder dat jij iets hoeft te starten.

### Kies iets dat mag herhalen

Het speelt in een lus zolang dat scherm openstaat, dus kies iets zonder duidelijk begin en eind. Een fanfare van acht seconden wordt na drie keer een grap.

---

## `dm_geluiden_momenten`

> Geen aanroep gevonden — mogelijk ongebruikt.
> Nu: de standaard uit de code

Titel: Momenten

### Eén keer, op een vast punt

Een korte klank die de app zelf speelt: als de spelers de buit te zien krijgen, of als iemand een level omhoog gaat. Geen loop — hij klinkt en is weg.

### De rust hoort er ook bij

Die staat eronder, met een eigen kop, want technisch is het wél een loop: hij speelt zolang het rustscherm in beeld is. Drie plekken: buiten, in de herberg, en de korte rust.

---

## `dm_geluiden_rust`

> Helpknop in: dm-panel.js:7610
> Nu: de standaard uit de code

Titel: Geluid bij de rust

### Drie momenten

Een loop voor de rust in het veld, een voor de herberg en een voor de korte rust. Die klinkt zolang het rustscherm in beeld is — bij de spelers en op het tafelscherm.

### Zachter is beter

Onder een rustscherm wordt er gepraat: dit is achtergrond, geen muziek om naar te luisteren. Krekels, een haardvuur, regen op een dak.

---

## `dm_geluiden_spelers`

> Helpknop in: dm-panel.js:7627 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:7649
> Nu: de standaard uit de code

Titel: Spelersgeluiden

### Een beurtgeluid

Per speler kun je een klank instellen die speelt als hij aan de beurt is. Handig aan een volle tafel: je hoort dat het jouw beurt is voordat je het ziet.

### Vier emotes

Elk een label en een geluid. Ze verschijnen als knoppen op zijn eigen kaartje en in de gevechtsoverlay, zodat een speler zelf iets kan laten klinken — een strijdkreet, een zucht, een lach.

### Van de speler, niet van jou

Laat ze er zelf een kiezen. Het is het enige geluid in de app dat van hén is, en dat is precies waarom het werkt.

---

## `dm_geluiden_standaard`

> Helpknop in: dm-panel.js:7627 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:7638
> Nu: de standaard uit de code

Titel: Vaste geluiden

### Wanneer ze klinken

Deze spelen vanzelf: bij schade en genezing, bij een beurtwisseling, en aan het eind van een gevecht. Je hoeft er tijdens het spelen niets voor te doen.

### Laat ze kort zijn

Ze klinken bovenop wat er al speelt en soms een paar keer per ronde. Een klank van een halve seconde werkt; een fanfare gaat irriteren.

### Ook op een vast moment

Onderaan staan de klanken die bij één gebeurtenis horen: als de spelers de buit te zien krijgen, en als iemand een level omhoog gaat. Die klinken één keer — geen loop.

### Leeg mag ook

Wat je niet invult, klinkt niet. Er komt geen vervanging uit de app — stilte is een keuze.

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

## `dm_gokhuis`

> Helpknop in: dm-panel.js:5880
> Nu: de standaard uit de code

Titel: Het gokhuis

### Wat het is

Een huis waar spelers geld kunnen inzetten: op een spel, op een gevecht in het strijdperk, of bij de geldschieter. De naam, de baas en de sfeer stel je hier in.

### Lenen kost

De geldschieter rekent rente **per lange rust**, niet per kalenderdag — de party bepaalt zo zelf het tempo. Er zit een plafond op; daarna stopt het tellen en komt hij het halen. Dat is een scène, geen som.

### Aflossen gaat via jou

Er is nog geen knop om een lening af te betalen: dat doe je door het schuldbewijs uit de boedel van de speler te halen. Dan is de schuld weg.

---

## `dm_gokhuis_beheer`

> Helpknop in: dm-panel.js:5939
> Nu: de standaard uit de code

Titel: Gokhuis — beheer

### Wat hier staat

De lopende leningen, de open kampen en de events. Dit is de administratie achter de schermen; de spelers zien er niets van.

### Opruimen

Een lening van een personage dat niet meer bestaat kun je hier weghalen. Laat hem niet slepen: hij telt door en niemand kan hem afbetalen.

---

## `dm_gokhuis_event`

> Helpknop in: dm-panel.js:5944
> Nu: de standaard uit de code

Titel: Een event aanmaken

### Waar wordt op gewed

Geef het event een naam en minstens twee opties — paardenrace, hanengevecht, welke raadsheer het haalt. De spelers kiezen er een en zetten in.

### De uitbetaling

Per optie stel je de verhouding in. Een uitslag die iedereen zag aankomen levert weinig op; de verrassing betaalt.

---

## `dm_gokhuis_inschrijvingen`

> Helpknop in: dm-panel.js:5926
> Nu: de standaard uit de code

Titel: Strijdperk — inschrijvingen

### Wie heeft ingezet

Per speler de inzet en op wie. Zolang het kamp loopt kun je zien waar de tafel op gokt; handig om te weten wie er belang bij heeft.

### Zelf meevechten

Een speler kan ook zelf het perk in. Zijn inzet is dan zijn eigen kamp — en verliezen doet meer pijn dan geld.

---

## `dm_gokhuis_partijen`

> Helpknop in: dm-panel.js:5912
> Nu: de standaard uit de code

Titel: Strijdperk — partijen

### Wie vecht er

De twee kanten van een kamp, met hun naam en hun kans. Waar de spelers op inzetten en wat het uitbetaalt, volgt hieruit.

### De uitslag bepaal jij

Het gevecht wordt aan tafel gespeeld of verteld; jij zet daarna wie er gewonnen heeft. Die keuze is onomkeerbaar — de inzetten worden er meteen mee verrekend — dus hij vraagt een bevestiging.

---

## `dm_herberg_tap`

> Helpknop in: dm-panel.js:5618
> Nu: de standaard uit de code

Titel: Aan de tap

### Het menu

Wat er te drinken en te eten is, met een prijs. Een speler bestelt het zelf; het bedrag gaat van zijn beurs af, of van de gedeelde beurs als die aanstaat.

### Temp HP en een status

Per regel kun je **temp HP** meegeven (een getal of een worp als `1d6`) en een status met een korte beschrijving. Allebei gelden tot de volgende lange rust. Het is een aantekening die de speler bij zich draagt, geen regel die de app afdwingt.

### Koppel het aan een voorwerpkaartje

Bestaat het drankje ook als kaartje, koppel het dan. Vanaf dat moment bepaalt het **kaartje** wat het doet — tijdelijke HP, de status, genezing — en bepaalt deze regel alleen de prijs en de sfeertekst. Hetzelfde drankje doet dan precies hetzelfde of je het aan de bar drinkt of straks uit je knapzak pakt. Een regel zonder koppeling houdt zijn eigen velden, zoals hij ze had.

### Sfeer boven mechaniek

Een bestelling is vooral een reden om iets te laten gebeuren — de waard vertelt een roddel, iemand aan de bar kijkt op. Wat een drankje verder doet, beslis jij aan tafel.

---

## `dm_loot_deelnemers`

> Helpknop in: dm-panel.js:8084
> Nu: de standaard uit de code

Titel: Wie deelt mee

### Waar de lijst vandaan komt

Loopt er een gevecht, dan zijn het de spelers daaruit; anders iedereen die bij de party *actief* staat. Zo deelt een speler die er vanavond niet is ook niet mee in de buit.

### Zelf bijstellen

Vink iemand aan of uit voordat je onthult. Handig als een personage bewust ergens anders was, of juist meeliep zonder in het gevecht te staan.

---

## `dm_loot_editor`

> Helpknop in: dm-panel.js:8397
> Nu: de standaard uit de code

Titel: Een vondst maken

### Wat een vondst is

Eén ding dat de party kan vinden: de geldzak in de haard, het zwaard onder de plavuizen. Eén kamer kan er meerdere hebben, en elk krijgt zijn eigen naam — die naam staat later bij de buit, zodat "uit de haard" en "onder de plavuizen" gescheiden blijven.

### De DC is een aantekening

Het getal is voor jou, niet voor de app. De spelers gooien aan tafel en jij beslist; onthullen is altijd een klik. Er wordt dus nergens een worp ingevoerd of bijgehouden wie wat gooide.

### Geld

Vul één bedrag in met een komma: **1,34** is 1 Gold, 3 Silver en 4 Copper. Wil je het aan het toeval overlaten, zet dan een bereik bij *Of gerold* — dat wordt pas bij het onthullen gegooid, zodat je ziet wat het geworden is voordat het scherm opengaat.

### Waar hij ligt

Koppel de vondst aan een kamer van een **dungeon**, dan verschijnt daar vanzelf het muntje — alleen op jouw scherm, met een stippellijn. Klikken op dat muntje bouwt meteen de verdeling.

### Een voorwerp, of een worp

Een regel is óf een vast voorwerp (eventueel gekoppeld aan een kaartje, dan kan de speler het openen), óf een **worp op een tafel**. Die twee sluiten elkaar uit. Kies je een tafel, dan bepaalt de worp bij het onthullen wat erin lag — en komt de naam overeen met een voorwerpkaartje, dan wordt dat vanzelf gekoppeld.

### Waarom een tafel en geen loterij

Er wás een knop "willekeurig, van deze zeldzaamheid". Die trok uit álle voorwerpkaartjes van dat niveau — ook het zwaard van de antagonist of een questvoorwerp dat nooit in een kist hoort te liggen. Een tafel is een lijst die jij hebt samengesteld: daar staat alleen in wat mág vallen. Oude regels met die knop blijven werken; nieuwe krijgen hem niet meer.

### Mimic

Vink *Dit is een mimic* aan en de kist blijkt een wezen: er valt niets te verdelen, het tafelscherm krijgt dezelfde kist met een andere ontknoping, en jij krijgt de vraag of het gevecht meteen moet beginnen. Het mimic-gevecht hoef je niet zelf te maken — de app zet het klaar met het Mimic-statblok uit de SRD, en gebruikt daarna steeds dat ene.

---

## `dm_loot_goud`

> Helpknop in: dm-panel.js:8431
> Nu: de standaard uit de code

Titel: Goud in een vondst

### Eén bedrag met een komma

Vul in wat erin zit: **1,34** is 1 Gold, 3 Silver en 4 Copper — het leest als gewoon geld, want de tweede munt is een tiende van de eerste en de derde een honderdste.

### Of laat het rollen

Vul in plaats daarvan een bereik in, in één veld: **2-5**, of met komma's **2,34-8,10**. Het bedrag wordt dan pas **bij het onthullen** gegooid, zodat je ziet wat het geworden is voordat het scherm opengaat — en zodat dezelfde kist twee keer iets anders kan opleveren.

### Electrum en platinum

Die worden bij het invoeren omgerekend (ep = 5 zilver, pp = 10 goud): in de beurs bestaan ze niet. In de vondst worden ze wél bij naam genoemd — het is oud geld dat je víndt — en dan staat er bij de buit "waaronder 3 Lion d'or".

---

## `dm_loot_sjablonen`

> Helpknop in: dm-panel.js:8351
> Nu: de standaard uit de code

Titel: Oude sjablonen

### Waarom ze weg zijn

Een sjabloon was een vondst die nergens lag en niet onthuld kon worden — een tweede soort ding om te onthouden, voor iets wat je in de praktijk oploste met "geef me zoiets als die vorige kist". Dat doet **kopiëren** nu, bij het aanmaken.

### Wat je ermee doet

Wat je al had staat er nog. *Gebruiken* maakt er een gewone vondst van; daarna kun je het sjabloon weggooien. Er gaat niets verloren.

---

## `dm_loot_uitslag`

> Helpknop in: dm-panel.js:7940
> Nu: de standaard uit de code

Titel: De uitslag

### Wie krijgt wat

Per voorwerp staat hier wie het geclaimd heeft en wat de worp was. Bij meerdere claims wint de hoogste worp; bij gelijkspel gooien alleen die spelers opnieuw.

### Bijstellen mag

De uitslag is een voorstel, geen vonnis — je kunt een voorwerp alsnog aan iemand anders geven voordat je afsluit. Aan tafel wordt er nu eenmaal geruild.

### Afsluiten

Bij het afsluiten gaat alles daadwerkelijk naar de boedel van de spelers en wordt het goud verdeeld. Daarna is de fase voorbij en staat de vondst als onthuld te boek.

---

## `dm_loot_vondsten`

> Helpknop in: dm-panel.js:8333
> Nu: de standaard uit de code

Titel: De vondsten

### De bibliotheek van wat er ligt

Elke vondst is één ding dat de party kan vinden. Ze blijven staan nadat je ze onthuld hebt (met de melding *onthuld*), zodat je terug kunt zien wat waar lag.

### Onthullen

Vink één of meer vondsten aan en klik op de knop eronder. Dat bouwt één verdeling waarin elk voorwerp onthoudt uit wélke vondst het komt — "uit de haard" en "onder de plavuizen" blijven dus gescheiden. In het venster dat opent stel je nog bij; pas als je op onthullen drukt, zien de spelers iets.

### Kopiëren in plaats van sjablonen

Wil je zoiets als een vondst die je al hebt, kies hem dan bij *of kopieer een bestaande*. Je krijgt een nieuwe vondst met dezelfde DC, hetzelfde goud en dezelfde voorwerpen — alleen niet op dezelfde plek, want twee kisten liggen zelden in dezelfde kamer.

---

## `dm_magizoo`

> Helpknop in: dm-panel.js:6340
> Nu: de standaard uit de code

Titel: De magizoöloog

### Twee dingen

Hij verkoopt **metgezellen** en hij weet iets van **wezens**: tegen betaling brengt hij het bestiarium van de party een niveau verder. Wat er te koop is en wat het kost, stel je hier in.

### Een dier groeit mee

Een metgezel heeft statblokken per niveau; welke geldt, hangt af van het level van zijn baasje. Eén dier per party, en als hij sneuvelt is dat echt — dat hoort bij het aangaan van de band.

---

## `dm_markt`

> Helpknop in: dm-panel.js:6271
> Nu: de standaard uit de code

Titel: De Markt

### Eén plek voor alle winkels

De Markt is een **weergave**, geen tweede voorraad: hij toont de winkels die deze party kan zien, met hun schappen. Klikken opent de winkel zelf. De voorraad blijft dus op het kaartje van die winkel staan, en daar beheer je hem ook.

### Zoeken over alles heen

Zoeken gaat over alle winkels tegelijk en zet de prijzen naast elkaar — handig, want hetzelfde voorwerp ligt soms bij drie winkels voor drie prijzen.

### Een roterende winkel rolt hier niet

De Markt leest de schappen alleen. Had een winkel zijn assortiment nog niet gerold, dan staat hij hier leeg in plaats van dat de app het stiekem voor hem doet — anders zou een blik op de Markt ieders schappen in één klap vastzetten.

---

## `dm_markt_gebieden`

> Helpknop in: dm-panel.js:6274
> Nu: de standaard uit de code

Titel: Gebieden om op te filteren

### Waar een winkel ligt is afgeleid

Uit het veld *Gebied* op het locatiekaartje van de winkel, dat naar een andere locatie wijst — Boekenwyrm › Luimpoort › Grisburgh › Continent. Een winkel valt onder élk lid van die keten.

### Jij kiest welke laag telt

Alle wijken als losse knop is zelden wat je wilt. Vink daarom aan welke gebieden als filter op de Markt verschijnen; jouw volgorde is de volgorde op het scherm. Staat er niets, dan leidt de app ze zelf af.

---

## `dm_markt_winkels`

> Helpknop in: dm-panel.js:6294
> Nu: de standaard uit de code

Titel: Winkels die de Markt vindt

### Een controlelijst

Alle winkels met de gebiedsketen die eruit volgt. Hiermee zie je je eigen data: een winkel die zichzelf als gebied heeft, komt nooit onder de stad uit — dat valt hier meteen op.

### Wat een speler ziet

De Markt toont alleen winkels die deze party kan zien, en een doorklik naar het voorwerpkaartje alleen als ze dat kaartje kennen. Naam, prijs en beeld gaan wel mee: dat ligt in de etalage.

---

## `dm_post_brief`

> Helpknop in: dm-panel.js:10243
> Nu: de standaard uit de code

Titel: Een brief sturen

### Aan wie

Aan één speler of aan de hele party. De brief komt in hun Berichten-tab te staan en blijft daar bewaard — het is post, geen melding die voorbijschiet.

### Afzender en stijl

Koppel een afzender aan een kaartje, dan leest de speler een naam die hij kent. De **briefstijl** bepaalt hoe het eruitziet: handschrift, drukwerk, knipsel, gotisch. Twee schrijvers horen er verschillend uit te zien.

### Cinematisch bezorgen

Zet je *cinematisch* aan, dan krijgt de speler eerst een verzegelde envelop die hij zelf moet openbreken — en gaat dezelfde brief naar het tafelscherm. Bewaar dat voor de brieven die ertoe doen; als alles een gebeurtenis is, is niets het.

---

## `dm_post_geschiedenis`

> Helpknop in: dm-panel.js:10315
> Nu: de standaard uit de code

Titel: Verstuurde post

### Wat hier staat

Alles wat je eerder verstuurde, met datum en ontvanger. Handig om terug te lezen wat een NPC ooit beloofd heeft — spelers onthouden dat namelijk wél.

### Opnieuw gebruiken

Een eerdere brief is de snelste opzet voor de volgende: open hem, pas de tekst aan en stuur hem naar iemand anders.

---

## `dm_rust_levelup`

> Helpknop in: dm-panel.js:8753
> Nu: de standaard uit de code

Titel: Level omhoog (hier)

### Waarom hier

Omdat het aan tafel op hetzelfde moment gebeurt: einde sessie, of bij de lange rust erna. Je zet een level-up **klaar** voor iedereen die vanavond meespeelt; de spelers kiezen daarna zelf hoe ze aan hun HP komen en wat ze met een ASI doen.

### Milestone of XP

Speelt de campagne op **Milestone**, dan is dit de knop waarmee je het gunt. Op **XP** staat een level-up vanzelf klaar zodra iemand over de drempel komt en hoef je hier niets te doen — punten uitdelen gaat met de XP-knop in de regie-balk. Welk van de twee geldt, stel je in bij Instellingen → Campagne → Level omhoog.

### Terugdraaien kan

Een per ongeluk gegund level haal je met dezelfde knop weer weg zolang de speler hem nog niet verzilverd heeft. Daarna is het zijn blad, en draai je het terug op zijn personage.

---

## `dm_rust_sfeer`

> Helpknop in: dm-panel.js:8704
> Nu: de standaard uit de code

Titel: Sfeer & gebeurtenissen

### Een beeld per soort rust

Kies een achtergrond voor het veld en voor de korte rust; de herberg gebruikt zijn eigen gevel. Die verschijnt achter het rustscherm, dus het is meteen duidelijk wáár ze slapen.

### Een voorval per speler

Koppel een tabel en elke speler rolt bij een lange rust zijn **eigen** voorval — hij ziet alleen het zijne, het tafelscherm toont ze allemaal. Bevat een regel een bedrag (`{+3kn}`), dan wordt dat meteen verrekend bij die speler.

### Binnen en buiten apart

Je kunt een aparte tabel zetten voor het veld en voor de herberg: wat je wakker maakt in het bos is iets anders dan wat er in een taveerne gebeurt. De algemene tabel is het vangnet als er voor die plek niets staat.

---

## `dm_rust_starten`

> Helpknop in: dm-panel.js:8686
> Nu: de standaard uit de code

Titel: Rust starten

### Waar en wat

Kies eerst de plek — **in het veld** of **in de herberg** — en dan lang of kort. De rust geldt voor de hele party en iedereen krijgt hetzelfde cinematische scherm te zien; het tafelscherm toont de partybrede variant.

### Wat er gebeurt

Een lange rust zet HP op maximum, herlaadt spell slots en item-charges, geeft de helft van de Hit Dice terug en haalt één niveau exhaustion weg. Een korte rust doet de shortRest-items en de pact-slots van een Warlock; Hit Dice besteden doet de speler daar zelf.

### In de herberg kost het geld

Daar wordt de overnachtingsprijs per speler afgeschreven en worden er twee roddels per speler onthuld — die prijs stel je in bij Diensten → Herberg. Wie vanavond niet meespeelt (zie *Waarvan actief* bij de party) doet ook hier niet mee.

---

## `dm_tafels_namen`

> Helpknop in: dm-panel.js:3189
> Nu: de standaard uit de code

Titel: Namen trekken

### Waarvoor

Voor het moment dat een speler vraagt hoe de herbergier heet en jij dat nooit bedacht hebt. Eén klik geeft een naam die bij deze wereld past; neem hem over of gooi opnieuw.

### Waar ze vandaan komen

Uit je eigen naamtabellen, gesplitst naar mannelijk en vrouwelijk. Zijn er geen, dan valt hij terug op de meegeleverde lijst. Wil je andere namen, maak dan een tabel met het type *namen* bij **Tabellen** hieronder.

### Meteen een kaartje

Een naam die blijft hangen verdient een kaartje: tik hem over in een nieuw personage, of schrijf hem in je akte als `[[Naam]]` — dan krijg je daar de plus om hem ter plekke aan te maken.

---

## `dm_tafels_tabellen`

> Helpknop in: dm-panel.js:3213
> Nu: de standaard uit de code

Titel: Tabellen

### Wat een tafel is

Een lijst met uitkomsten waar je op gooit: geruchten in de haven, wat er in de zak van een dief zit, welk voorval de nacht verstoort. Kies er een en gooi; de uitslag komt eronder te staan.

### Bereiken en gewicht

Een regel mag een bereik dragen (`1-5: tekst`) zodat de ene uitkomst vaker valt dan de andere. Met **Dobbel** kies je de steen — leeg is d100. Eén getal mag ook (`7: tekst`).

### Geld in een regel

Een regel kan een bedrag verrekenen: `{+3kn}` of `{-1fl}` treft één willekeurige speler, met `@party` erachter iedereen. Zo betaalt een nachtelijke dief zich vanzelf uit.

### Waar ze nog meer opduiken

Een tafel is ook te koppelen aan een **voorwerp** (een Wand of Wonder), aan de **rust** als gebeurtenissen-tabel, en aan een `|`-tabel in een akte — die krijgt daar zijn eigen worpknop.

---

## `dm_tafels_weer`

> Helpknop in: dm-panel.js:3197
> Nu: de standaard uit de code

Titel: Het weer

### Eén worp, één dag

Kies het seizoen en gooi: je krijgt temperatuur, neerslag en wind. Bedoeld om aan tafel voor te lezen als de party naar buiten stapt — er wordt niets van opgeslagen en het heeft geen effect op regels.

### Het seizoen bepaalt de kansen

Elke tabel heeft zijn eigen verdeling: een winterworp geeft vaker vorst, een zomerworp vaker warmte en onweer. Het seizoen blijft staan tot je het zelf verzet.

---

## `dm_tempel`

> Helpknop in: dm-panel.js:6592
> Nu: de standaard uit de code

Titel: De tempel

### Waar de goden vandaan komen

Er is geen ingebouwd pantheon: een god ontstaat uit **Blessing-kaartjes met een godnaam** (zegen, eed of vloek). Hier voeg je daar volgorde, domein, symbool, prijs en portretten aan toe.

### Zegen, eed, vloek

Een **zegen** koop je en komt in je boedel. Een **eed** is een belofte met een gevolg — wie er een zweert, kan geen tweede zweren. Een **vloek** hangt iemand aan tot hij hem kwijtraakt.

---

## `dm_tempel_eden`

> Helpknop in: dm-panel.js:6626
> Nu: de standaard uit de code

Titel: Actieve eden & vloeken

### Wie draagt wat

Per speler wat er op hem rust. Zo zie je in één blik waarom iemand iets niet mag of juist moet — en hoef je het niet op zijn blad te zoeken.

### Losmaken doe jij

Een eed of vloek verdwijnt niet vanzelf: die haal je hier weg als de scène daarom vraagt. Dat is bewust een handeling van de DM, geen aftellende klok.

---

## `dm_tempel_goden`

> Helpknop in: dm-panel.js:6629
> Nu: de standaard uit de code

Titel: Goden — metadata

### Het uiterlijk van een god

Domein, symbool, portret, het beeld van de priester en zijn begroeting. Dit bepaalt hoe het altaar eruitziet als een speler binnenloopt.

### Volgorde is redactie

De volgorde die je hier zet is de volgorde in de tempel. Zet de goden die er in jouw verhaal toe doen bovenaan; de rest mag daaronder wachten.

---

## `dm_toegang_diensten`

> Helpknop in: dm-panel.js:1556
> Nu: de standaard uit de code

Titel: Diensten per party

### Drie standen

**Beschikbaar** — ze kunnen er alles. **Zichtbaar** — ze zien dat het bestaat maar kunnen er niets (handig voor iets dat nog gesloten is). **Verborgen** — het bestaat niet voor hen.

### De server bewaakt het mee

Dit is geen kwestie van een tabblad verbergen: de schrijfroutes van een dienst weigeren een speler wiens party hem niet open heeft. Een scherm dat nog openstond blijft dus niet stiekem werken.

### Jij komt er altijd langs

Als DM kun je elke dienst openen en er namens de tafel handelen, ook als hij voor die party dicht staat. Anders kon je niet testen wat je net hebt ingesteld.

---

## `dm_toegang_facties`

> Helpknop in: dm-panel.js:1554
> Nu: de standaard uit de code

Titel: Facties per party

### Kennen ze deze factie?

Een factie die uitstaat bestaat voor die party niet: hij staat niet in de lijst, en hun aanzien erbij is onzichtbaar. Zet hem aan op het moment dat ze ervan horen — dat is vaak een scène waard.

### Per party, niet per campagne

Twee party's in dezelfde wereld hoeven niet dezelfde namen te kennen. Wat de ene groep ontdekt heeft, blijft voor de andere dicht.

---

## `dm_verzoeken_multiclass`

> Helpknop in: dm-panel.js:10198
> Nu: de standaard uit de code

Titel: Multiclass-verzoeken

### Waarom het langs jou gaat

Een tweede klasse verandert het personage ingrijpend en is in de meeste campagnes een gesprek, geen knop. De speler vraagt het aan; jij keurt goed of af.

### Wat er gebeurt bij goedkeuren

De klasse komt op het profiel te staan met level **0**. Pas bij zijn volgende level-up krijgt hij daar zijn eerste level in — inclusief de Hit Die en de features die daarbij horen. Twee klassen is het maximum.

### De eisen staan erbij

Je ziet wat 5e vraagt en wat dit personage heeft, maar ook hier blokkeert de app niets: een campagne mag zijn eigen afspraken hebben.

---

## `dm_verzoeken_onderzoek`

> Helpknop in: dm-panel.js:10203
> Nu: de standaard uit de code

Titel: Onderzoeksdossiers

### Wat hier staat

De vragen die spelers bij de detective hebben neergelegd. Elk dossier is één vraag over een persoon, plek of voorwerp; jij schrijft het antwoord en bepaalt wanneer het klaar is.

### Tijd en prijs

Een dossier kost geld en tijd — dat is de hele charme: de party moet wachten en ondertussen doorspelen. Zet hem op klaar wanneer het verhaal daaraan toe is, niet wanneer de klok het zegt.

---

## `dm_verzoeken_spreuken`

> Helpknop in: dm-panel.js:10188
> Nu: de standaard uit de code

Titel: Spreukverzoeken

### Wat hier staat

Een speler die een spreuk uit de bibliotheek in zijn eigen boek wil, vraagt het eerst aan jou — net als bij een voorwerp. Keur je goed, dan schrijft de app hem in zijn boek; wijs je af, dan krijgt hij dat te horen.

### De regel wordt voorgerekend, niet afgedwongen

Bij het verzoek staat of de spreuk op de lijst van zijn klasse staat — maar de app weigert niets uit zichzelf. De uitzonderingen zijn in 5e eerder regel dan uitzondering: Magic Initiate, een feat, een scroll, multiclass, een uitgebreide subklasselijst. Jij beslist.

---

## `dm_verzoeken_voorwerpen`

> Helpknop in: dm-panel.js:10193
> Nu: de standaard uit de code

Titel: Voorwerpverzoeken

### Wat hier staat

Een speler vraagt een voorwerp uit de bibliotheek aan, of wil er een van een ander overnemen. Keur je goed, dan komt het in zijn boedel te staan met het aantal dat je meegeeft.

### Onderling geven gaat buiten jou om

Spullen die spelers aan elkaar geven komen hier niet langs — dat is een ding over de tafel schuiven. Wil je dat niet, dan zet je het ruilen uit bij de party.

---

## `dm_waarzegger`

> Helpknop in: dm-panel.js:6458
> Nu: de standaard uit de code

Titel: De waarzegger

### Wat ze doet

Een speler komt langs voor een voorspelling: hij kiest vier zintuiglijke indrukken en krijgt daarna een brief met wat zij daarin ziet. Prijs en sfeer stel je hier in.

### De tekst is van jou

Een voorspelling hoort vaag genoeg te zijn om later te kloppen, en scherp genoeg om aan tafel iets los te maken. Wat zij zegt schrijf jij dus zelf, per akte.

---

## `dm_waarzegger_akte`

> Helpknop in: dm-panel.js:6484
> Nu: de standaard uit de code

Titel: Voorspellingen per akte

### Waarom per akte

Wat zij ziet hangt af van waar het verhaal staat. Per akte leg je vast wat er te voorspellen valt; komt een speler langs, dan krijgt hij wat bij dít hoofdstuk hoort.

### Eén per speler

De app onthoudt wie welke voorspelling al gehad heeft, zodat twee spelers niet hetzelfde briefje krijgen.

---

## `dm_wereld_buiten`

> Helpknop in: dm-panel.js:5477
> Nu: de standaard uit de code

Titel: Bereikbaar van onderweg

### Wat blijft er open

De kaartjes die je hier aanvinkt blijven bereikbaar terwijl de party buiten de stad is — een reisgenoot die meeloopt, een dienst die per brief werkt, een god die overal luistert.

### Waarom uitvinken en niet invullen

Alles staat standaard dicht zodra ze weg zijn; je wijst dus alleen de uitzonderingen aan. Een dienst die je later toevoegt is dan vanzelf óók dicht op reis, en dat is de veilige kant.

---

## `dm_wereld_locatie`

> Helpknop in: dm-panel.js:5460
> Nu: de standaard uit de code

Titel: Waar is de party?

### Waar ze zijn bepaalt wat open is

Staat de party **in de campagne**, dan zijn de diensten bereikbaar zoals je ze hebt opengezet. Zet je ze erbuiten, dan gaat alles dicht — behalve wat je hieronder als uitzondering aanwijst.

### Een grove schakelaar, met opzet

Dit is de knop voor "we zijn op reis". Wat er per **akte** bereikbaar is, stel je fijner in bij de akte zelf; die instelling geldt zolang je binnen de stad speelt. Deze schakelaar wint van allebei.

---

## `documenten`

> Helpknop in: render-campagne.js:2876 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> De standaard telt 1 stap(pen).

Titel: Documenten

### Documenten

Het **archief**: brieven, aktes, kaarten en aantekeningen die je onderweg verzamelt. De DM onthult documenten wanneer ze relevant worden.

---

## `dungeon`

> Helpknop in: app.js:3258, render-dungeon.js:194
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

> Helpknop in: app.js:8573, app.js:13533, app.js:13644
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

> Helpknop in: app.js:12404
> Nu: **aangepast in deze campagne**
> De standaard telt 1 stap(pen).

Titel: Juliaan de Gock

### Juliaan de Gock

Juliaan de Gock is een privédetective. Je kunt hem inhuren om een persoon, locatie of organisatie te onderzoeken. Na een dag levert hij een rapport op dat in jullie postvakje verschijnt.

---

## `herberg`

> Helpknop in: app.js:12194
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

### Wat het doet bij gebruik

Onder de werking **healing** staan drie velden: een *genezingsformule* (echte HP, afgetopt op je maximum), *tijdelijke HP* (komt er bovenop, telt niet mee in je maximum, en de hoogste wint — ze stapelen niet) en een *status* met een korte beschrijving, die geldt tot de volgende lange rust. Een kroegdrankje vult meestal alleen die laatste twee.

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

> Helpknop in: app.js:3258
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

> Helpknop in: app.js:3258
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

> Helpknop in: dm-panel.js:11166
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

> Helpknop in: dm-panel.js:7627 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:11159
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

## `inst_campagne`

> Helpknop in: dm-panel.js:7627 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:11018
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

> Helpknop in: dm-panel.js:11128
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

> Helpknop in: dm-panel.js:11177
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

> Helpknop in: dm-panel.js:11093
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

> Helpknop in: dm-panel.js:7627 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:11140
> Nu: de standaard uit de code

Titel: Party's

### Eén regel per party

Elke party staat op één regel met het aantal personages en een slotje als er een wachtwoord is. Klik erop en je krijgt alles van díé party bij elkaar: naam, wachtwoord, wie erbij hoort, wie er vanavond meespeelt en de gedeelde beurs.

### Personages: koppelen en losmaken

Onder **Personages** staat wie bij deze party hóórt — dat is blijvend, het staat op het kaartje van het personage zelf. Losmaken met het kruisje betekent dat hij bij geen enkele party meer hoort en dus niets meer van de campagne ziet. Wat bij de party ligt blijft daar: voorwerpkaartjes, onthulde geheimen en welke kaartjes ontdekt zijn staan per party, niet per personage. De vraag vóór het losmaken zegt precies hoeveel dat er zijn.

### Waarvan actief is iets anders

Onder **Waarvan actief** zet je iemand tijdelijk buiten de sessie — de speler die er niet is. Dat bepaalt wie meedoet bij rust, bij het verdelen van buit en bij het vullen van een gevecht, en het is met één klik terug te draaien. Bewust de afwezigen die bewaard worden en niet de aanwezigen: een personage dat erbij komt doet dan vanzelf mee.

### Eén zak of ieder zijn eigen

Staat de gedeelde beurs **aan**, dan is dát de portemonnee van de party: iedereen ziet hetzelfde bedrag, en alles wat gekocht of gevonden wordt gaat erin en eruit. Staat hij **uit**, dan heeft elke speler zijn eigen beurs.

### Per party

De schakelaar geldt per party, en hij staat daarom in het kaartje van díé party — zo verzet je nooit per ongeluk de beurs van een tafel die je niet bedoelde. Wil je ze naast elkaar zien, open dan de party's een voor een; er is bewust geen tweede lijst met alle saldo's, want twee weergaven van hetzelfde bedrag lopen vroeg of laat uit elkaar.

### Omzetten raakt geen geld kwijt

De twee zakken bestaan naast elkaar: zet je de gedeelde beurs uit, dan komt ieders eigen beurs weer tevoorschijn zoals die was, en het gedeelde bedrag blijft staan tot je hem weer aanzet. Er verdwijnt dus niets, maar reken er ook niet op dat geld mee verhuist.

### Het wachtwoord van een party

Dat is wat je je spelers stuurt; ze kiezen daarna zelf hun personage. Groepswachtwoorden blijven leesbaar staan — je moet ze kunnen opzoeken als iemand het kwijt is. Jouw eigen DM-wachtwoord staat onder **Beheer** en wordt wél versleuteld.

---

## `inst_valuta`

> Helpknop in: dm-panel.js:11041
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

> Helpknop in: app.js:3023, render-kaart.js:134
> Nu: de standaard uit de code

Titel: De kaart

### Wereld- en stadskaart

Wissel tussen de **wereldkaart** en de **stadskaart**. Pins markeren ontdekte locaties — klik een pin om het bijbehorende kaartje te openen. Zoom met de knoppen of scroll.

---

## `knapzak`

> Helpknop in: app.js:8598
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

> Helpknop in: render-campagne.js:2876 (de kaartjes-tab geeft het entiteitstype als sleutel door)
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

> Helpknop in: app.js:12565
> Nu: **aangepast in deze campagne**
> De standaard telt 2 stap(pen).

Titel: Vivarius

### Vivarius

Vivarius onderzoekt wezens die de groep heeft gezien of bevochten. Per onderzoek onthult hij meer over het wezen in je bestiarium, van enkel een naam, naar rudimentaire gegevens tot een volledig plaatje. Elk onderzoek kost geld en heeft tijd nodig.

### Kennisniveaus en gevechten

Er zijn drie kennisniveaus: naam (alleen de identiteit van het wezen), deels (AC, ability scores, resistances en talen) en volledig (traits, actions en CR). Hoe meer je weet, hoe beter je de HP-balk in een gevecht kunt aflezen. Bij deels/volledig zie je het exacte HP.

---

## `markt`

> Helpknop in: app.js:11812
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

> Helpknop in: render-campagne.js:2876 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> De standaard telt 1 stap(pen).

Titel: Organisaties

### Organisaties

Gilden, ordes en groeperingen in de wereld. Klik op een kaart voor hun doel, leden en banden met andere partijen.

---

## `party`

> Helpknop in: app.js:8057
> Nu: **aangepast in deze campagne**
> De standaard telt 2 stap(pen).

Titel: Party

### Party

Dit tabblad toont de andere leden van jouw groep. Je kunt zien wie aanwezig is voor de sessie.

---

## `personage`

> Helpknop in: app.js:8191
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

> Helpknop in: render-campagne.js:2876 (de kaartjes-tab geeft het entiteitstype als sleutel door)
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

> Helpknop in: app.js:8944
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

> Helpknop in: app.js:12902, app.js:12969
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

> Helpknop in: app.js:13284
> Nu: **aangepast in deze campagne**
> De standaard telt 0 stap(pen).

Titel: De Tweespalt

### De Tweespalt

Bij De Tweespalt kun je wedden op gevechten en verkiezingen. Kies een weddenschapsoptie, bepaal je inzet en bevestig. Als de uitkomst in jouw voordeel uitvalt, keert de DM de winst uit.

### Leningen

Als je goud tekort komt kun je een lening afsluiten bij ~~woekeraar~~ lommerd Taevin Woekeling. Let op: leningen hebben rente en moeten terugbetaald worden. Kom je niet na, dan volgen er mogelijk nare consequenties.

---

## `ursula`

> Helpknop in: app.js:12824
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

> Helpknop in: render-campagne.js:2876 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> De standaard telt 1 stap(pen).

Titel: Voorwerpen

### Voorwerpen

Wapens, uitrusting en magische items. Je kunt voorwerpen claimen, ruilen en in winkels kopen en verkopen. **Zegeningen & Gunsten** (tempel- en factie-beloningen) staan onder een eigen filter, los van de gewone voorwerpen.

### Geclaimde en geschonken voorwerpen

Voorwerpen die je hebt geclaimd of die de DM je heeft gegeven, verschijnen op je personagetabblad. Sommige voorwerpen kunnen maar een aantal keer gebruikt worden. Andere voorwerpen hebben een beperkt aantal *charges*, die opladen na een Short of Long Rest.

---
