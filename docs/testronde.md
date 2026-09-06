# Grisburgh — opfris-, test- en debugronde

Werkdocument, gestart 4 sep 2026. Doel: elke feature één keer bewust doorlopen,
opfrissen wat hij ook alweer deed, en fouten eruit halen vóór er een tweede DM
op komt. **Werkwijze:** één blok per sessie, van boven naar beneden. Per regel:
Alan test in de app, Claude kijkt mee in de code, bevindingen komen achter de
regel te staan. Afgevinkt = getest én goedgekeurd; een `!` = bevinding open.

Legenda voor wie het ziet: **DM** = alleen de Meesterkamer-kant, **SP** = wat
een speler ziet, **TAB** = het tafelscherm (`?display=1`), **ALL** = alle drie.

---

## Blok 1 — Binnenkomen en rollen

`public/index.html` (landing) · `routes/auth.js` · `public/js/app.js`

- [x] **Openingspagina** (ALL) — keuzepagina op het kale domein: alle campagnes die zich laten zien *(gebouwd 4 sep)*
- [x] **Landingspagina** (ALL) — portretten van de party's, carousel, inzoomen op een portret *(titel, embleem en portretten per campagne: gefikst 4 sep)*
- [ ] **Portretfilmpje bij inzoomen** (ALL) — speelt af, stopt na 6 seconden (`LANDING_VIDEO_MAX_SEC`)
- [x] **Eén wachtwoordveld** — groepswachtwoord → alleen díé party in de kiezer; DM-wachtwoord → meteen DM
- [x] **Personagekiezer** — de speler kiest zijn personage, wachtwoord wordt onthouden
- [ ] **DM-wachtwoord wijzigen** (DM) — Instellingen → *Jouw DM-wachtwoord*; oude werkt daarna niet meer
- [ ] **Groepswachtwoorden** (DM) — Instellingen → Party's, slotje toont of er één staat
- [x] **Tafelscherm aanzetten** (DM) — knop in de balk rechtsboven; dít scherm wordt de tablet, kruisje brengt je terug
- [x] **Uitloggen als speler** (SP) — knop rechtsboven vraagt eerst, met de naam van je personage *(gebouwd 4 sep)*
- [x] **Sessie overleeft een herstart** *(geverifieerd 5 sep: DM-sessie bleef geldig over `pm2 restart` heen)* — deploy een serverbestand, `pm2 restart grisburgh`, en kijk of je nog ingelogd bent (DM, speler én tablet). Sessies staan in `data/sessions/`; voorheen logde elke herstart iedereen uit
- [x] **Campagnepad** — `/grisburgh` en `/prewett`; kaal domein stuurt door, `?display=1` blijft werken
- [ ] **PWA installeren** — via Safari/Chrome "Zet op beginscherm": de app komt als icoon te staan, opent zonder browserbalk, draagt de naam van de campagne en start op haar eigen pad. Het icoon zelf is nog van Grisburgh (staat op de todo)
- [x] **DM-ingang rechtsboven** (DM) — wachtwoordveld met label, Enter volstaat, verdwijnt zodra een speler een portret kiest
- [x] **Partypijl op de landing** (SP) — gouden pijl valt op, tweede party bereikbaar
- [ ] **Kopbalk klapt in** (ALL) — maak het venster smaller en kijk of de tabs op iconen overgaan in plaats van over de titel te schuiven; ook direct na terugkeer uit tafelscherm

## Blok 2 — Archief

`public/js/render-campagne.js` · `render-bestiarium.js` · `render-statblock.js` · `render-spreuken.js`

- [ ] **Personages** (ALL) — kaartjes met portret; filter op subtype (speler, NPC, dier), zoeken op naam én op tekst; klik opent het detailvenster met portret, stats en beschrijving; `[[Naam]]` in een tekst is klikbaar en springt naar dat kaartje
- [ ] **Personage-editor** (DM) — alle velden bewaren; portret uit de mediabibliotheek met versleepbaar focuspunt; extra afbeeldingen; **filmpje via dezelfde mediabibliotheek** (kiezen uit wat er staat of nieuw uploaden); zichtbaarheid per party; van party wisselen waarschuwt eerst — maar bij één party mag die waarschuwing níét komen
- [ ] **Dobbelpaneel** (ALL) — het formulier-invoerveld is weg; gooien gaat met de dobbelknoppen
- [ ] **Locaties** (ALL) — type *Winkel* geeft een voorraad met prijzen — koop en verkoop als speler en controleer geld én boedel; een gepinde locatie toont de kaartknop die naar de juiste plek vliegt
- [ ] **Organisaties** (ALL) — kaartjes, leden die eraan hangen, detailvenster, zichtbaarheid per party
- [ ] **Voorwerpen** (ALL) — gekleurde rand per rarity (grijs → goud), gloed en shimmer bij Very Rare en Legendary; damage-pill klikken opent het dobbelpaneel met die formule; rariteit in kleur in het detailvenster
- [ ] **Documenten** (ALL) — eigen editor en viewer (niet het detailvenster van de andere tabs); markdown met `[[links]]`; per party vrijgeven en weer verbergen
- [ ] **Bestiarium** (DM) — kaartjes, statblock-modal met acties en eigenschappen, eigen editor in de Meesterkamer; spelers zien deze tab niet
- [ ] **Spreuken** (ALL) — filters op niveau en klasse, zoeken, detailvenster met casting time, range, components en duration; afbeelding kiezen en focuspunt zetten; glossary-tooltips op D&D-termen
- [ ] **Verwijzing naar een andere spreuk** (ALL) — in een spreuktekst met `[[Wall of Force]]` staat die naam als klikbare verwijzing (opent die spreuk), niet als tekst met dubbele haken
- [ ] **Eigen spreukbeschrijving** (DM) — uitklap in het spreukdetail: schrijf een tekst, sla op, herlaad — hij blijft en vervangt de bron; leeg opslaan zet hem terug
- [ ] **Overleden markeren** (DM) — kaartje markeren; de speler ziet het meteen (`entity:deceased`), party en archief tonen hem als overleden
- [ ] **Geheimen onthullen** (DM) — een geheim vrijgeven komt live binnen bij de speler (`entity:secret`) zonder herladen; terugdraaien verbergt het weer
- [ ] **Bladwijzers** (SP) — ☆ wordt ★ (duidelijk zichtbaar op elk portret) en blijft na herladen. Terugvinden kan op twee plekken: open het zoekvenster en typ niets — je bladwijzers staan er onder *Jouw bladwijzers* — en in het tabblad zelf staat een chip **★ Bladwijzers** in de filterbalk die de lijst terugbrengt tot wat je gemarkeerd hebt
- [ ] **Korte zoekterm** (ALL) — typ één letter: je krijgt alleen kaartjes waarvan de naam daarmee begint, niet de halve campagne. Vanaf twee letters telt de hele naam mee, vanaf drie ook de teksten
- [ ] **Globaal zoeken** — sneltoets of vergrootglas; het venster is perkament (niet donker); resultaten uit alle types door elkaar, klikken opent het juiste kaartje; als speler zie je alleen wat vrijgegeven is
- [ ] **Spreuken en bestiarium in het zoeken** (ALL) — zoek op een spreuknaam of een monster: ze staan onder eigen kopjes, met een chip om erop te filteren, en klikken opent het spreukvenster respectievelijk het statblock
- [ ] **Zoeken laat zien wáárom** (ALL) — zoek op een naam die alleen in de tekst van een ánder kaartje voorkomt: onder dat kaartje staat het stukje tekst met de term erin gemarkeerd; de regel waar je op staat blijft goed leesbaar en de kopjes hebben SVG-iconen (geen emoji)
- [ ] **Zoeken zet de naam bovenaan** (ALL) — zoek op een deel van een naam: het kaartje zelf staat boven kaartjes die die naam alleen in hun tekst noemen
- [ ] **Filters en sortering** (ALL) — de trechter per type (winkel, subtype, rariteit), sorteren op naam, en of de keuze blijft staan als je een kaartje opent en terugkomt
- [ ] **Zichtbaarheid per party** (DM) — een kaartje vrijgeven aan de ene party en niet aan de andere; wissel van party en controleer beide kanten
- [ ] **Voorwerp aan een speler geven** (DM) — vanuit het kaartje toewijzen aan een personage; het verschijnt in zijn boedel met de juiste rariteit
- [ ] **Voorraad van een winkel** (DM) — regels toevoegen, prijzen zetten, uitverkocht markeren per party
- [ ] **Character sheet als het printblad** (DM) — het tabblad van een speler toont dezelfde indeling als de pdf: links abilities met saving throws en skills (bolletje voor proficiency, dubbel voor expertise), rechts AC/Initiative/Speed/Proficiency, de passieve scores, HP en spell save DC, daaronder proficiencies en de spreuken per niveau. De cijfers komen uit hetzelfde profiel als de print, dus scherm en papier zeggen hetzelfde
- [ ] **NPC toont een statblock** (DM) — bij een NPC of god staat op dat tabblad het statblock in de vorm van het bestiarium, niet een half ingevuld character sheet
- [ ] **Uitleg bewerken** (DM) — het potlood náást de helpknop is weg; open de uitleg en er staat rechtsboven *Bewerken* (alleen voor de DM)

- [ ] **Blad afdrukken** (DM) — open het tabblad van een spelerspersonage: het heet *Character Sheet* en de knop *Blad afdrukken* opent zijn eigen blad in een nieuw tabblad (printen of bewaren als pdf). Bij een NPC, dier of god heet het tabblad *Statblock* en opent *Statblock afdrukken* een printvenster met alleen dat blok — bij een huisdier het tier dat bij het level van het baasje hoort

- [ ] **God-kaartje** (DM) — type *god*: Origin en Class verdwijnen uit de editor, Domein en Heilig symbool komen ervoor in de plaats; het domein staat op het kaartje en in de kopregel van het detailvenster. Wissel van type en terug: de velden verschijnen en verdwijnen meteen

- [ ] **Locatietypes gegroepeerd** (DM) — de typelijst staat in groepen (*Met eigen instellingen*, Gebied, Gebouw, Landschap, Overig); een bestaand kaartje houdt zijn type, en een type dat niet meer in de lijst staat krijgt een eigen regel *Nog uit een oudere lijst* in plaats van leeg te lopen
- [ ] **Gebied is een koppeling** (DM/ORG) — het veld heet Gebied (was Wijk) en zoekt in de locatiekaartjes: staat er al *Haveplein*, dan verschijnt eronder een knop naar dat kaartje. Vrije tekst mag ook; typ je iets dat niet bestaat, dan biedt hij aan er een leeg kaartje voor te maken
- [ ] **Wie hoort hier bij** (DM/ORG) — één lijst met per regel een naam (personage óf organisatie) en een rol (Eigenaar, Waard, Personeel, Stamgast…). Bestaande eigenaar-tekst staat er bij het openen al in als regel *Eigenaar*, en blijft na opslaan ook als los veld bestaan (campagneboek). In het detailvenster staan de gekoppelde namen als knop, de losse namen als tekst
- [ ] **Herberg koppelen** (DM) — locatie met type *Herberg*: vinkje *Dit is de herberg van de campagne* zet de dienst op dit kaartje; een andere herberg aanvinken laat de vorige vanzelf los (het is één veld)
- [ ] **Tempel aan een god** (DM) — locatie met type *Tempel*: keuzelijst met de goden uit de Tempel-dienst; een god die al elders hangt staat er met *staat nu elders* bij en verhuist als je hem kiest. Zichtbaar in de Meesterkamer bij die god
- [ ] **Organisatie aan een factie** (DM) — op een organisatiekaartje kies je een factie uit het Facties-paneel; die koppeling is dezelfde als `entityId` daar
- [ ] **Dungeonkaart aan een locatie** (DM) — kies een dungeonkaart en eventueel één kamer; zonder kaart staat de kamerlijst uit. Bewaart mee met Opslaan (het is data van het kaartje, niet van de dienst)
- [ ] **Speld zetten vanaf het kaartje** (DM) — in de editor het tabblad **Kaart**: kies een kaart, klik in het beeld en de speld staat er. Nog eens klikken verplaatst hem, *Van de kaart halen* wist hem. Controleer op het Kaart-tabblad van de app dat hij op dezelfde plek staat
- [ ] **Inzoomen bij het plaatsen** (DM) — met − en + tot 600%; ingezoomd **sleep** je de kaart om te schuiven (niet de afbeelding naar een nieuw tabblad), en een klik komt nog steeds op dezelfde plek uit. Na het zoomen staat de speld weer in beeld
- [ ] **Terug uit de fullscreen-kaart** (DM/SP) — vanuit het tabblad Kaart naar de hele kaart: linksboven staat een knop met de naam van het kaartje die je terugbrengt in dat detailvenster. Open je de kaart vanuit de galerij, dan staat die knop er niet
- [ ] **Kaart als eigen tabblad** (DM) — een locatiekaartje heeft in de editor het tabblad *Kaart*, met daarop de speld én de dungeonkoppeling; in het detailvenster verschijnt het alleen als er ook echt een speld of een plattegrond aan hangt
- [ ] **Dubbelklikken zoomt** (DM) — dubbelklik in de kaartpicker zoomt in op die plek; op de hoogste stand zoomt hij weer helemaal uit
- [ ] **Speldknop op elk kaartje** (DM/SP) — een locatie met een speld heeft rechtsonder op zijn kaartje een knopje dat de juiste kaart opent, óók zonder dat je het Kaart-tabblad eerst bezocht hebt
- [ ] **Uitleg per tabblad** (DM/SP) — rechts in de tabbalk van een kaartje staat één boekje, dat meeloopt met het open tabblad, met doorklikstappen die de hele pagina afgaan. Staat er voor een tabblad niets, dan staat er ook geen knop
- [ ] **Andere uitleg in kijken dan in bewerken** (DM) — het detailvenster is wat een speler ziet, dus die uitleg gaat over lezen en ontdekken; de editor gaat over invullen. Open dezelfde locatie in beide en vergelijk: het zijn andere teksten (`hulp_kijk_*` en `hulp_bewerk_*`), allebei apart aan te passen
- [ ] **Koppelingen alleen waar ze bestaan** (DM) — de sectie *Koppelingen* op een locatie verschijnt alleen bij type Herberg of Tempel; wissel het type en hij verschijnt of verdwijnt meteen. Bij een organisatie staat hij er altijd (factiekeuze)
- [ ] **Dungeon volgt de mist** (SP) — koppel een locatie aan één kamer van een plattegrond: de speler ziet het Dungeon-blok pas als zijn party toegang tot die kaart heeft **én** die kamer onthuld is. Een andere kamer onthullen helpt niet. Zonder gekoppelde kamer volstaat toegang tot de kaart. De speler krijgt nooit de kale plattegrond te zien — alleen de naam en de knop naar de dungeonweergave, mét mist
- [ ] **Speld bij een nieuw kaartje** (DM) — maak een nieuwe locatie, zet vóór het opslaan al een speld: na *Opslaan* staat hij op de kaart. De koppelingen aan dienst/dungeon verschijnen pas ná het bewaren
- [ ] **Op de kaart in het detailvenster** (DM/SP) — tabblad *Kaart*: een uitsnede rond de speld plus *Toon op de hele kaart*. Die knop sluit het venster en opent **die kaart** fullscreen (met sluitknop) — eerder kwam je in de kaartengalerij zonder weg terug. Tabblad *Dungeon* toont de gekoppelde plattegrond, de kamer en een knop om hem te openen
- [ ] **Verkoper staat bij Hoort bij** (DM) — het losse blok *Verkoopt bij* is weg; het staat nu als regel **Verkoper** in de Hoort bij-lijst, en doorklikken opent nog steeds het voorraadtabblad van die winkel
- [ ] **Eigenaar van een dier per party** (DM) — bij een dier staat één regel per party met de spelers van díé party. Zo kan hetzelfde dierkaartje in twee party's meelopen, elk met een eigen baasje, zonder van groep te wisselen
- [ ] **Koppelingen bewaren zichzelf** (DM) — herberg, god en factie liggen in meta.json en worden bij het wisselen meteen bewaard (toast), zónder op Opslaan te drukken
- [ ] **Kaartje aanmaken vanuit een koppelveld** (DM) — typ bij *Wie hoort hier bij?* of bij *Gebied* een naam die nog niet bestaat: er verschijnt een vraag — *“Klaas Kolder” heeft nog geen kaartje. Aanmaken als [Personage] [Organisatie]?* Bij Gebied staat er alleen [Locatie]. Klikken maakt een leeg kaartje (een personage krijgt subtype NPC en staat overal verborgen) en de regel wordt meteen een klikbare koppeling. Zonder klik gebeurt er niets — de naam blijft dan gewoon als tekst staan
- [ ] **Koppeling naar iets onontdekts** (SP) — zet een locatie zichtbaar waarvan de eigenaar nog verborgen is: de speler ziet de náám wel staan (die schreef de DM op dat kaartje), maar hij is geen knop en er valt niet op door te klikken. Zodra dat kaartje onthuld wordt, wordt hij het wél. Zelfde voor Gebied; de dungeonkoppeling ziet de speler helemaal niet
- [ ] **Organisatie compleet** (DM) — een organisatiekaartje heeft nu ook **flavour teksten**, **geheimen** en **aantekeningen voor de DM**, net als een personage of locatie; onthullen gaat per regel en per party. De doodskop-knop heet hier *Opgeheven*
- [ ] **Organisatietypes gegroepeerd** (DM) — de typelijst staat in groepen (Macht & bestuur, Handel & ambacht, Geloof & kennis, Onderwereld, Overig); bestaande types houden hun waarde
- [ ] **Factie op het kaartje** (DM/SP) — is de organisatie aan een factie gekoppeld, dan staat dat bij *Hoort bij* als rol **Factie**, met een knop naar dat factiepaneel. Een speler ziet hem alleen als de factie voor zijn party onthuld is
- [ ] **Organisatie: leden op hun eigen tabblad** (DM) — *Wie hoort hier bij?* en *Hoort bij* staan bij een organisatie op het tabblad **Organogram**, niet meer bij Informatie. Bij een locatie blijft de lijst gewoon bij Informatie staan
- [ ] **Valt onder leest als bijzin** (DM) — het veld staat ingesprongen onder de regel waar het bij hoort, met het label *Valt onder* ervoor; leeg betekent bovenaan
- [ ] **Gedeelde bovenste plek** (DM) — twee leiders zonder chef staan naast elkaar bovenaan; de rest hangt onder de héle rij, niet onder de eerste. Met expliciete chefs krijgt elke leider zijn eigen tak
- [ ] **Aantekeningen overal op dezelfde plek** (DM) — *Aantekeningen voor de DM* is het laatste veld op Informatie bij alle vier de soorten kaartjes, en is hetzelfde vak als in het detailvenster (typen slaat direct op)
- [ ] **Kopbalk** (DM/SP) — één uitklapmenu tegelijk: Archief openen sluit Logboek en Diensten. Hoveren doet niets (bewust: naast deze drie staan knoppen zonder menu). Het actieve tabblad heeft geen eigen gele vlak meer, alleen het gouden streepje
- [ ] **Onbekende leden** (SP) — een lid van wie de speler het kaartje nog niet kent staat als **Onbekend** in *Wie hoort hier bij?* én in het organogram: de rol blijft staan (dát er een penningmeester is mag je weten), de naam niet. Een naam die nooit aan een kaartje gekoppeld was blijft wél gewoon leesbaar. Hangt er iemand ónder zo'n onbekende, dan blijft die tak gewoon staan met *Onbekend* erboven
- [ ] **Organogram** (DM/SP) — tabblad *Organogram* op een organisatie met leden: een boom met portretjes, namen en rollen, doorklikbaar. Vul bij *Wie hoort hier bij?* het veld **Valt onder** om de structuur te bepalen; laat je dat leeg, dan maakt hij een tweelaags schema op rol (leiders boven). Een kring (A onder B, B onder A) zet iedereen naast elkaar in plaats van vast te lopen
- [ ] **Hernoemen loopt door in koppelingen** (DM) — hernoem een personage dat ergens eigenaar of lid is: op dát kaartje staat meteen de nieuwe naam, ook in *Valt onder* van het organogram en in het losse eigenaar-veld. Hernoem een locatie die als *Gebied* gebruikt wordt: idem
- [ ] **Verwijderen laat geen dode knop achter** (DM) — gooi een gekoppeld personage weg: zijn naam blijft in *Wie hoort hier bij?* staan, maar hij is geen knop meer
- [ ] **DM-gereedschap blijft van de DM** (SP) — vul *Aantekeningen voor de DM* in en zet het kaartje zichtbaar: een speler ziet het niet, óók niet in de netwerktab. Idem voor de verraad-administratie en de bijhouding van vertelde roddels
- [ ] **Verkoopt bij staat bij de verbindingen** (DM) — op een verkoperskaartje staat *Verkoopt bij* onderin de sectie **Wat hoort hier bij?**, met een streepje ertussen; niet meer als los veld elders op het blad
- [ ] **Rol vult aan** (DM) — het rolveld bij *Wat hoort hier bij?* stelt dezelfde rollen voor als bij *Wie hoort hier bij?* (Eigenaar, Lid, Personeel…)
- [ ] **Nieuw kaartje verschijnt meteen** (DM) — maak vanuit een koppelveld een leeg kaartje aan en ga naar dat tabblad: het staat er. Eerder zag je het niet en maakte je met + per ongeluk een tweede
- [ ] **Hoort bij vanaf het personage** (DM) — op een personage- of organisatiekaartje staat een sectie *Hoort bij*: kies een locatie of organisatie plus een rol en druk op Opslaan. Die regel verschijnt daarna bij *Wie hoort hier bij?* van dát kaartje — het staat maar op één plek. Weghalen werkt ook beide kanten op
- [ ] **Melding bij een type met extra's** (DM) — Winkel, Herberg en Tempel staan gewoon bij de gebouwen (geen aparte groep meer). Kies er een: onder de keuzelijst staat wat dat oplevert, met een link naar *Koppelingen* die ernaartoe springt en de sectie kort laat oplichten. Bij andere types staat er niets
- [ ] **Gevonden kaartje in het veld** (DM) — zodra een naam in *Gebied*, *Wie hoort hier bij?* of *Hoort bij* een bestaand kaartje raakt, verschijnt het type-pictogram rechts in het invoerveld (klikbaar naar dat kaartje); de losse regel eronder is weg
- [ ] **Hoort bij (omgekeerde kant)** (DM/SP) — open het kaartje van een personage of organisatie die ergens in *Wie hoort hier bij?* staat: onderaan staat een regel **Hoort bij** met rol + kaartje, doorklikbaar. Haal je hem bij de locatie weg, dan verdwijnt hij hier ook (het is afgeleid, niet opgeslagen). Een speler ziet alleen de kaartjes die zijn party mag zien
- [ ] **Geen vijandvinkje buiten personages** (DM) — een geheim op een locatie of organisatie heeft géén vinkje *Onthullen maakt het personage een vijand*
- [ ] **Markering heet wat het is** (DM) — de doodskop-knop in het detailvenster heet *Overleden* bij een personage, *Verwoest* bij een locatie, *Opgeheven* bij een organisatie en *Verloren* bij een voorwerp
- [ ] **Huisdier-kaartje** (DM) — type *dier*: het veld heet **Eigenaar** (was Baasje) en **Prijs** (was Adoptieprijs), allebei zonder uitlegregel eronder — wat de keuze doet staat in de tooltip. Verder: adoptie (te adopteren, prijs, wat voor dier) staat bij **Informatie**, de **tiers** op het tabblad Character Sheet; in het detailvenster staat het geschaalde statblok óók onder Character Sheet en niet bij Informatie. Adoptieprijs met een komma (12,34 = 12 goud, 3 zilver, 4 koper); *Type* zegt wat voor dier het is; controleer daarna of adopteren klopt bij de dienst die dieren aanbiedt
- [ ] **Helpknop per tab** (ALL) — het vraagteken opent de uitleg met stappen en afbeeldingen; vorige/volgende werken
- [ ] **Ontdekkingsmeter volgt de party** (DM) — wissel van party: de meter in de kop telt opnieuw voor díé party (een party die niets ontdekt heeft toont 0/…)
- [ ] **Helpteksten bewerken** (DM) — de uitleg aanpassen en opslaan; herlaad en kijk of je tekst er nog staat (let op: dit hoort straks alleen voor de beheerder te zijn — zie `docs/todo.md`)
- [ ] **Afbeeldingen in het detailvenster** (ALL) — extra afbeeldingen bladeren, lightbox openen, zoomen
- [ ] **Editor in tabbladen** (DM) — de bewerkmodus heeft tabs: Informatie, Beeld, Character Sheet en (bij een verkoper) Winkel; wisselen bewaart wat je hebt ingevuld
- [ ] **Winkel-tab volgt het vinkje** (DM) — vink *verkoper* aan: het tabblad Winkel verschijnt meteen, zonder opnieuw openen; uitvinken laat het verdwijnen en springt terug naar Informatie als je erop stond. Hetzelfde bij een locatie die je op type *Winkel* zet
- [ ] **DM-velden herkenbaar** (DM) — aantekeningen en geheimen staan in een koele tint met "alleen jij" ernaast — je ziet meteen dat spelers dit niet lezen
- [ ] **Afbeeldingen en banner** (DM) — één knop voegt toe, de ster maakt er de banner van, het kruisje koppelt los (bestand blijft in de bibliotheek); het focuspunt zit op de banner
- [ ] **Ras, klasse, alignment** (DM) — keuzelijst in perkament: typen filtert, pijltjes en Enter werken, en iets intikken wat er niet in staat mag ook
- [ ] **Meerdere geheimen** (DM/SP) — twee geheimen op één kaartje, één onthullen: de speler ziet alleen dat ene, de kaart toont 1/2
- [ ] **Roddel met de hand vertellen** (DM/SP) — knop op de rol perkament in het detailvenster; daarna ziet de speler die roddel, en terugdraaien kan
- [ ] **Rollen en kant** (DM) — verkoper aanvinken zet de voorraad aan, antagonist geeft de badge, en de kant bepaalt waar hij in het gevecht bovenaan staat
- [ ] **Gekoppelde spreuken** (DM/SP) — spreuk zoeken in het Spells-paneel, chip verschijnt, klikken opent het spreukdetail met de volledige tekst
- [ ] **Geheime antagonist per geheim** (DM) — vink bij één van twee geheimen "Onthullen maakt het personage een vijand" aan; in het detailvenster staat bij dát geheim een rood merkje *Maakt vijand* en vraagt de app om bevestiging voor hij het omzet; dat geheim onthullen geeft hem de badge én zet zijn kant op vijand, het andere geheim doet niets; terugdraaien haalt de badge weg en zet zijn oude kant én alignment terug. Alignment schuift bij het onthullen naar Evil met behoud van de as: Neutral Good → Neutral Evil, Lawful Neutral → Lawful Evil; Unaligned blijft
- [ ] **Focuspunt met preview** (DM) — de picker toont de héle afbeelding; sleep het kruisje en de twee voorbeelden (kaartje + rond portret) schuiven mee; klikken in de zwarte band naast het beeld springt niet naar 0%/100%
- [ ] **Meerdere afbeeldingen in het detailvenster** (ALL) — een kaartje met banner én extra afbeelding toont een carousel waarin de éérste dia de banner is (geen gebroken plaatje); pijltjes en bolletjes lopen erdoorheen, de pijl licht op als je erover gaat, en een klik op de afbeelding opent de vergrote weergave waarin je met de pijltjes dóór de hele reeks kunt bladeren
- [ ] **Geen ruwe JSON in het detailvenster** (ALL) — geheimen, flavours en rollen staan in hun eigen blok, niet als pil met `["tekst"]` erin

- [ ] **Medestander vanuit het detailvenster** (DM) — het zwaardenicoon in de DM-rij (naast de doodskop) koppelt een NPC als medestander aan de **actieve** party; de knop kleurt op, nogmaals klikken koppelt los, en de bewerkmodus heeft die knop niet meer

- [ ] **Wachtwoordveld boven het toetsenbord** (SP) — kies op een tablet een personage met wachtwoord: het invoerveld schuift boven het toetsenbord in beeld en blijft zichtbaar tijdens het typen

- [ ] **Volle hoogte op een tablet** (ALL) — open een tab met veel kaartjes op de iPad: het laatste rijtje is helemaal te bereiken en er staat geen lege strook perkament onder; draai het scherm en controleer opnieuw

- [ ] **Kaartjes bij hover** (ALL) — een kaartje tilt op als je erover gaat, maar kantelt niet meer met de muis mee
- [ ] **Meerdere roddels op het kaartje** (DM/SP) — bij twee onthulde flavourregels staat rechtsonder "1/2 ›"; klikken toont de volgende zonder dat het kaartje opengaat, en de DM ziet nog-niet-vertelde regels lichter
- [ ] **Rollen blijven rollen** (DM) — vink een kant aan (Bondgenoot/Neutraal/Vijand) en sla op: die waarde komt níét als rol in `data.tags` terecht (geen "Vijand"-badge naast Verkoper)

- [ ] **Rollen als badge** (ALL) — een verkoper die ook antagonist is toont bééde badges op het kaartje en in het detailvenster; zonder rol staat er het type (NPC, Speler, Dier, God)

- [ ] **Afrekenen aan tafel** (DM) — muntknop achter een voorraadregel: kies een speler, tik een ander bedrag in dan de vraagprijs, afrekenen. Het bedrag gaat van de (gedeelde of eigen) beurs af, het voorwerp staat in zijn boedel, en de regel is uitverkocht
- [ ] **Inkopen van de party** (DM) — onderaan het winkelvenster: boedel ophalen, zoeken, aanvinken, aantal kiezen bij een stapel, bedrag invullen, overnemen. Het voorwerp verdwijnt bij die speler (bij een stapel alleen het gekozen aantal) en het geld komt erbij
- [ ] **Geen afdingknop meer** (SP) — een speler ziet in de winkel geen "Onderhandelen" en geen eigen verkooplijst; kopen kan hij nog wel

- [ ] **Verkoper wijst naar zijn winkel** (DM) — vink *verkoper* aan: onder de rollen (tab Informatie) verschijnt "Verkoopt bij" met een zoekbare locatielijst. Een personage heeft géén Winkel-tabblad meer; op zijn kaartje staat "Verkoopt bij <locatie>" met een doorklik naar de voorraad daar
- [ ] **Voorraad op de locatie** (ALL) — de winkel-tab van een locatie toont de voorraad; ook bij een locatie die géén type *Winkel* heeft maar wel waren (tempel, ziekenhuis)

- [ ] **Roddel toont zijn stand meteen** (DM) — een nog niet vertelde roddel staat lichter zodra het venster opent, niet pas na doorbladeren; de knop en de opmaak zeggen hetzelfde
- [ ] **Geheimen verspringen niet** (DM) — onthullen verandert het woord op de knop, maar het tekstvak ernaast blijft op zijn plek
- [ ] **Aantekeningen van de spelers** (DM) — schrijf met twee spelers een aantekening bij hetzelfde kaartje: de DM ziet er één tegelijk, mét naam en "‹ 1/2 ›" om tussen spelers te wisselen, boven de knoppenbalk

- [ ] **Verborgen kaartje in een tekst** (DM/SP) — verberg een kaartje waarnaar een `[[link]]` verwijst: de speler kan er niet meer op klikken (zonder te herladen), en de DM ziet de link als *dicht* gemarkeerd

- [ ] **Waarschuwing bij van party wisselen** (DM) — wissel van party terwijl er een akte loopt of een speler is ingelogd: er komt een vraag die zegt wát er speelt en waar je naartoe gaat. Speelt er niets, dan wissel je zonder vraag

- [ ] **Baasje van een huisdier** (DM) — kies bij een dier onder *Adoptie* een baasje: het dier staat daarna op het partytabblad van die speler, is zichtbaar, laadt mee in een gevecht en zijn tier volgt het level van dat personage
- [ ] **Tiers als statblok** (DM) — *Tier toevoegen* geeft **precies** dezelfde velden als het statblok zelf, in dezelfde volgorde: Prof. Bonus op zijn eigen plek (geen Hit Dice-veld), de ability-modifier verschijnt naast het label zodra je een score intikt, en Traits, Gear en alle Actions-velden hebben de opmaakbalk (vet, cursief, kleur). Erboven staat het level vanaf wanneer hij geldt; twee tiers vanaf hetzelfde level kan niet (het tweede schuift op, met een melding)
- [ ] **HP van een tier** (DM) — één veld, als op het blad: `32 (5d8+10)`. Het detailvenster toont die tekst en gebruikt het getal als max-HP
- [ ] **Dier heeft geen tabbladen** (DM) — bij type *dier* staat het statblok plat: alle velden onder elkaar met **Actions** onderaan, geen Combat/Actions/Spells-balk en geen spreukenlijst. Bij een NPC staan de drie tabs er nog wel
- [ ] **Het statblok is de basis** (DM) — bij een dier staat boven het statblok dat het vanaf level 1 geldt, en onderaan begint de tierladder met een regel *Basis · vanaf level 1*. Een nieuw tier begint op level 2 of hoger, nooit op 1
- [ ] **Een tier zegt alleen wat verandert** (DM) — vul in een tier alleen AC en HP in en laat de rest leeg: bij een baasje dat dat level haalt toont het detailvenster de nieuwe AC en HP, maar speed, creature type en traits van het basisstatblok
- [ ] **Spelers zien één statblok** (SP) — het huisdier in het detailvenster toont het tier dat bij het level van het baasje hoort, niet de tiers eronder of erboven; de regel erboven zegt welk tier het is (*Tier 2/3*), van wie het dier is en op welk level het volgende tier komt
- [ ] **Instellingen klapt in en uit** (DM) — elke sectie is een uitklap; wat je dichtklapt blijft dicht, ook na een wijziging die het scherm hertekent (party toevoegen, wachtwoord, modules) en na herladen
- [ ] **Instellingen springt niet omhoog** (DM) — scroll naar beneden, wijzig iets dat zichzelf bewaart (party hernoemen, een speler toevoegen): je blijft staan waar je was
- [ ] **Instellingen leest als één scherm** (DM) — alle knoppen even groot, met icoon én woord, en dezelfde soort per bedoeling (goud = opslaan, omlijnd = de rest — óók *Gedeelde beurs aan/uitzetten*); de koppen *Personages* en *Actief* bij een party zijn even groot als die boven de muntvelden; onder *Beheer* staan geen scheidingslijnen tussen de tussenkopjes en het kopje heet *Wachtwoorden per groep*

- [ ] **Party samenstellen** (DM) — Instellingen → Party's: onder elke party staan de personages als chips; typ een naam in *Personage toevoegen* om er iemand bij te zetten (met waarschuwing als hij uit een andere party komt) en klik het kruisje om iemand eruit te halen. Op het kaartje zelf blijft het veld *Party* hetzelfde doen

- [ ] **Eén notitieveld** (DM) — er is nog maar één DM-notitie per kaartje: *Aantekeningen voor de DM*, boven de knoppenbalk. Typ erin, herlaad, en open de bewerkmodus: dezelfde tekst staat er
- [ ] **Wikilinks bij een speler** (SP) — een `[[Naam]]` naar een kaartje dat de speler niet mag zien staat als gewone tekst in de zin, zónder dubbele haken; een naam die hij wél kent is klikbaar. Herlaad de pagina: de links staan er meteen goed (niet eerst als haakjes)
- [ ] **Geheim-onthuld op het kaartje** (SP) — bij een onthuld geheim staat een pill *Geheim onthuld* boven de rolbadge, niet meer boven op de bladwijzer-ster
- [ ] **Wachtwoord opslaan meldt zich** (DM) — een partywachtwoord instellen of wissen geeft een bevestiging, net als het DM-wachtwoord

- [ ] **Detailvenster: kop zegt het al** (ALL) — onder de naam staat rol · origin · class · alignment; diezelfde waarden staan niet nóg eens als pil eronder
- [ ] **Roddels doorbladeren in het detailvenster** (DM/SP) — één rol perkament met "‹ 1/3 ›"; de knop *Vertellen* / *Verteld* hoort bij de regel die je ziet, en stapt mee
- [ ] **Open kaartje gaat live mee** (SP) — laat de speler een kaartje openhouden en onthul als DM een geheim of roddel: het venster werkt zichzelf meteen bij, zonder sluiten en opnieuw openen, en blijft op het tabblad waar hij stond

- [ ] **Speler ziet álles wat onthuld is** (SP) — onthul twee geheimen en twee roddels: de speler ziet er twee van elk, met "‹ 1/2 ›" om door te bladeren (niet alleen de eerste)

- [ ] **Geheimen als doorbladerblok** (DM) — geheimen staan in hetzelfde blok als de roddels: één tekst, rechts de knop (Onthullen/Onthuld) met de pijltjes eronder; een geheim is te herkennen aan de rode rand en rechte letters
- [ ] **Onthulknoppen uniform** (DM) — roddels en geheimen hebben dezelfde knop op dezelfde plek en dezelfde woorden (Onthullen / Onthuld), en allebei een kop met teller: *Roddels — 1 van 3 onthuld*, *Geheimen — 1 van 2 onthuld*
- [ ] **Vergrote weergave loopt rond** (ALL) — in de lightbox blijven beide pijlen staan en ga je van de laatste afbeelding naar de eerste; ze lichten op bij hover, net als de pijlen in de carousel en in het logboek
- [ ] **DM-acties met tekst** (DM) — de knoppenbalk toont icoon + woord (Zichtbaar/Verborgen, Overleden, Medestander, Bewerken); *Verbergen* verandert meteen zichtbaar van stand
- [ ] **Lege tabbladen weg** (ALL) — een kaartje zonder character sheet toont die tab niet, en een verkoper zonder eigen voorraad heeft geen Voorraad/Log-tab (die staan bij de winkel)
- [ ] **Lightbox boven het venster** (ALL) — klik een afbeelding in het detailvenster: de viewer opent er bovenop, niet erachter

- [ ] **Nieuw personage begint als NPC** (DM) — het Type-veld staat meteen op NPC; opslaan zonder te kiezen levert geen typeloos kaartje op
- [ ] **Knoppen in de bewerkmodus** (DM) — onderaan staat *Aanmaken* / *Opslaan*, *Verwijderen* en *Annuleren* met tekst, niet alleen pictogrammen
- [ ] **Rollen en kant uit elkaar** (DM) — de vinkjes voor rollen staan op één regel, met daaronder het kopje *Kant in gevecht* en dan pas Bondgenoot/Neutraal/Vijand
- [ ] **Kaartje zonder afbeelding** (ALL) — geen lege beeldstrook bovenin, en de badge (NPC, Verkoper, Dier) staat gewoon boven de naam
- [ ] **URL volgt de sectie** (ALL) — plak `#locaties` achter het adres of gebruik de terugknop van de browser: de app springt naar dat tabblad
- [ ] **Eén geldnotatie** (DM) — overal waar je een bedrag intikt (afrekenen, inkopen, adoptieprijs, loot) werkt `12,34`; munten mogen ook (`5 gp 2 sp`, `2 pp`, `3 ep`) en worden omgerekend. Bij loot blijft de uitleg in muntnamen staan: *23 Florinde · 5 Knaker*, niet 23,5
- [ ] **Afrekenen meldt zich** (DM) — na afrekenen verschijnt een melding met wie er betaalde en hoeveel
- [ ] **Losse boedelregels in de inkooplijst** (DM) — spullen die geen voorwerpkaartje zijn (touw, gereedschap) staan óók in *Inkopen van de party*
- [ ] **Geen doodskop op een locatie** (DM) — *Overleden* staat alleen bij personages, niet bij locaties, organisaties of voorwerpen

- [ ] **Kop van de editor** (DM) — nieuw kaartje heet "Nieuw personage" / "Nieuwe locatie" / "Nieuwe organisatie" / "Nieuw voorwerp" / "Nieuw document", bewerken heet "Personage bewerken" enzovoort; er staat geen losse ondertitel meer onder

- [ ] **Volgorde in de editor** (DM) — Informatie loopt van boven naar beneden: korte omschrijving, Origin/Class/Alignment, rollen, Beschrijving, Flavour teksten, Geheimen, Aantekeningen

- [ ] **Statblok → monsterbibliotheek** (DM) — vul HP én AC op een NPC-kaartje: hij staat meteen in de monsterlijst van de Meesterkamer (met "van kaartje") en is toe te voegen aan een encounter, maar verschijnt **niet** in het bestiarium van de spelers; HP of AC weer leegmaken haalt hem uit de lijst. Een kaartje met subtype *speler* komt er nooit in
- [ ] **Statblok leesbaar ingedeeld** (DM) — Ability Scores, Proficiencies & Defenses, Senses & Languages en Traits staan als gouden sectiekop met een streep erboven, duidelijk anders dan de veldlabels; Gear staat bij Skills (niet bij Languages) en heeft de opmaakbalk, dus **vet** komt vet terug in het detailvenster

- [ ] **Statblok compleet** (DM) — Size en Creature Type als dropdown, Initiative, XP, Gear, Lair Actions en Damage Vulnerabilities zijn in te vullen en komen terug in het detailvenster ("Medium Humanoid" boven het blok)
- [ ] **Vrije spells** (DM) — het vak "Niet in de bibliotheek" staat dicht bij een leeg kaartje en open zodra er tekst in staat; oude losse cantrips staan er na één keer opslaan bij in
- [ ] **Dobbelknop van de DM** (DM) — buiten een lopende akte is de d20-knop rechtsonder weg; speel een akte af en hij staat er weer

- [ ] **Missies op een kaartje** (DM) — koppel een gever aan een missie; zijn naam staat op het missiekaartje en de missie staat als blokje op zijn eigen kaartje, met status

## Blok 3 — Logboek, kaarten en dungeons

`public/js/render-archief.js` · `render-kaart.js` · `render-dungeon.js` · `render-relatiemap.js`

- [ ] **Sessieverslagen** (ALL) — entries per akte, afbeeldingen in een carousel, per beeld onthullen zodat het pas dán bij de speler verschijnt
- [ ] **Missies** (ALL) — status open/voltooid/gefaald; een speler vraagt er een aan, de DM keurt goed of af, beide kanten krijgen een melding
- [ ] **Prikbord / relatiemap** (ALL) — netwerk van personages en organisaties, slepen bewaart de positie, onthulde relaties verschijnen bij de speler
- [ ] **Kaartengalerij** (ALL) — hoofdkaarten en dungeons als kaartjes, plus-knop voor de DM
- [ ] **Wereldkaart** (ALL) — zoomen met wiel en knoppen, pannen, pins openen de locatie; een speler stelt een pin voor en de DM keurt goed
- [ ] **Kaart toevoegen/bewerken** (DM) — nieuwe kaart met naam en afbeelding, hernoemen, verwijderen; zonder kaarten verschijnt de lege staat met een knop
- [ ] **Dungeon** (ALL) — kamers openklikken, fog-of-war per kamer onthullen, teller onderaan klopt
- [ ] **Verdiepingen** (DM) — knopjes BG · 1 · −1; een trap brengt je naar de andere verdieping mét doelkamer, de tegenhanger wordt vanzelf aangelegd, en telt niet mee in de teller
- [ ] **Vondsten vanuit de kamer** (DM) — sectie *Vondsten* in de kamerzijbalk: aanmaken of koppelen; het muntje opent het lootvenster; loskoppelen gooit niets weg
- [ ] **Dungeon op het tafelscherm** (TAB) — de DM toont een dungeonkaart; de tablet toont alleen de onthulde kamers
- [ ] **Logboek per akte** (ALL) — verslagen gegroepeerd per akte, met de banner-afbeelding van die akte
- [ ] **Sessieverslag schrijven** (DM) — nieuwe entry, markdown, afbeeldingen uploaden, opslaan en teruglezen
- [ ] **Missie aanmaken** (DM) — titel, beschrijving, koppeling aan een factie of locatie, en zichtbaar maken
- [ ] **Pin voorstellen en goedkeuren** (SP/DM) — speler stelt voor, DM keurt goed of af, beide zien de uitkomst
- [ ] **Dungeon aanmaken** (DM) — nieuwe dungeonkaart met afbeelding, kamers tekenen, namen geven
- [ ] **Kamerzijbalk** (DM) — beschrijving, monsters, vondsten en trap per kamer
- [ ] **Dungeon vrijgeven aan een party** (DM) — toegang per groep; een speler zonder toegang ziet de kaart niet
- [ ] **Missiegever kiezen** (DM) — zoekveld *Gegeven door* in de missie-editor kent personages én organisaties; leeg laten mag

## Blok 4 — Spelerstabblad

`public/js/app.js` (subtabs Party · Personage · Facties · Boedel · Progressie · Spreukenboek · Berichten)

- [ ] **Party** (SP) — medespelers met portret en HP-balk, ontdekkingsteller per categorie, en wie er vanavond meespeelt
- [ ] **Personage** (SP) — stats en modifiers, saves, skills met proficiency, AC, snelheid, conditions met iconen, inspiration, buffs en vloek
- [ ] **HP en Hit Dice** (SP/DM) — DM past HP aan → speler ziet het meteen; Hit Dice afgeleid uit klasse en level (ook multiklasse), getoond als bolletjes
- [ ] **Medestanders** (SP) — een gekoppeld dier of NPC verschijnt bij de party met een melding, en verdwijnt bij ontkoppelen
- [ ] **Boedel** (SP) — voorwerp-kaartjes en losse regels, stapelbare items met aantal, notitie per regel, bladeren met de pijltjes
- [ ] **Beurs** (SP) — eigen munten of de gedeelde partybeurs (dan telt eigen geld niet mee); bedragen kloppen na kopen, verkopen en loot
- [ ] **Geven aan…** (SP) — knop onder een voorwerp, medespeler kiezen met portret; de hele stapel verhuist en telt op bij de ontvanger. Niet aan jezelf, niet buiten je party, geld gaat niet mee
- [ ] **Progressie** (SP) — tijdlijn en kaartweergave, features per level met subklasse-tag, vergrendelde levels, keuzevelden die bewaard blijven
- [ ] **Spreukenboek** (SP) — eigen lijst, slots per niveau, voorbereid-stempel, glossary-tooltips, spreuken toevoegen vanuit de bibliotheek
- [ ] **Berichten** (SP) — ongelezen-badge, brieven van de DM, cinematische reveal: verzegelde envelop → klik op het lakzegel → de brief vouwt open
- [ ] **Notities** (SP) — blijven per speler bewaard en zijn voor niemand anders zichtbaar
- [ ] **Subtabs onthouden** (SP) — wissel van subtab, ga naar een andere sectie en terug — je staat weer op dezelfde subtab
- [ ] **Conditie-uitleg** (SP) — tik op een conditie-icoon voor de uitleg
- [ ] **Inspiration** (SP/DM) — de DM geeft inspiration, de speler ziet het meteen en kan het inzetten
- [ ] **Vloek en buffs** (SP/DM) — toekennen en weghalen; de speler ziet het verschil in zijn stats
- [ ] **Damage-pill gooien** (SP) — klik op de schade van een wapen of spreuk en controleer de worp in het dobbelpaneel
- [ ] **Voorwerp gebruiken** (SP) — charges verbruiken en na een rust weer terugkrijgen
- [ ] **Loot claimen** (SP) — tijdens een verdeling claimen, en zien wat je krijgt na het afrollen
- [ ] **Brief openen** (SP) — verzegelde brief in Berichten, zegel aanklikken, tekst lezen en teruggaan
- [ ] **Level omhoog** (SP/DM) — de DM verhoogt het level; nieuwe features verschijnen in Progressie en de sheet klopt

## Blok 5 — Diensten

`public/js/app.js` (secties) · `dm-panel.js` (instellingen per dienst)

- [ ] **Herberg** (SP/DM) — roddels vragen (met cooldown), bestellen bij de tap, backdrop en waard uit de instellingen
- [ ] **De Tweespalt** (SP/DM) — inzetten met een komma-bedrag, uitslag verwerken, godenwedden aan of uit
- [ ] **De Gock** (SP/DM) — onderzoek aanvragen, rapport klaarzetten, de speler krijgt bericht
- [ ] **Madame Ursula** (SP/DM) — vier zintuigen kiezen, voorspelling tonen, brief in Berichten, per party resetten
- [ ] **Tempel** (SP/DM) — goden met priester en domein, Zegening kopen, Eed zweren met cinematic; een eed blokkeert de andere; heffen en verbreken werken
- [ ] **Magizoöloog** (SP/DM) — huisdier adopteren, prijs in de eigen munt, cooldown, het dier verschijnt bij de party
- [ ] **Facties & Aanzien** (SP/DM) — renown opbouwen, rangen, boons toekennen, titels; de speler ziet zijn stand
- [ ] **Heeren van de Nacht** (SP/DM) — rangen, klussen genereren, advocaat inschakelen, betalen, uitslag verwerken
- [ ] **Verzegelde uitnodigingsbrief** (DM) — per factie of dienst versturen; de speler krijgt de tweetraps reveal met lakzegel
- [ ] **Toegang per groep** (DM) — per dienst en per party zichtbaar/beschikbaar zetten; de speler ziet het verschil meteen
- [ ] **Bereikbaarheid per akte** (DM) — wat dicht zit volgt de lopende akte; "de stad verlaten" overschrijft alles behalve wat je als buiten-bereikbaar hebt gemarkeerd
- [ ] **Wereld-instellingen** (DM) — onder Diensten → Toegang: de stad verlaten, en winkels die ook buiten bereikbaar blijven
- [ ] **Namen van diensten** (DM) — hernoem een dienst in zijn eigen paneel; zijbalk, sectiekop en briefhoofd volgen
- [ ] **Dienst hernoemen** (DM) — naam wijzigen in het paneel van die dienst; zijbalk, sectiekop en briefhoofd volgen
- [ ] **Sfeerloop per dienst** (DM/TAB) — open een dienst en hoor de bijbehorende loop wisselen
- [ ] **Prijzen en cooldowns** (DM) — instellen en als speler tegen de grens aanlopen
- [ ] **Backdrop per dienst** (DM) — afbeelding kiezen; de speler ziet hem achter de sectie
- [ ] **Dienst uitzetten als module** (BEHEER) — de dienst verdwijnt uit de zijbalk én uit de Diensten-tab

## Blok 6 — Meesterkamer: spelen

`public/js/dm-panel.js` · `render-archief.js` (aktes) · `combat-canvas.js`

- [ ] **Aktes — verhaal** (DM) — `.md` inlezen of plakken; `##`-koppen worden sectiekoppen in het script
- [ ] **Aktes — namenrij** (DM) — `[[ ]]` uit de tekst: heeft een kaartje of niet, nieuw of terugkerend; zonder kaartje kun je er meteen een aanmaken
- [ ] **Aktes — regie-script** (DM) — stappen toevoegen van elk type: beeld, entiteit, encounter, dungeon, rust, brief, loot en kop; volgorde verslepen
- [ ] **Akte-afbeeldingen uploaden** (DM) — vanuit de picker én bij *Nieuwe akte*; ze verschijnen als thumbnails en zijn daarna te onthullen
- [ ] **Regie-balk** (DM) — akte spelen, stap voor stap onthullen, pauzeren, en de sheets-herinnering na afloop
- [ ] **Verhaalpaneel** (DM) — schuift open naast de regie, duwt de app opzij; klikken in de tekst schuift de balk mee en andersom
- [ ] **Gevecht** (DM/TAB) — initiatief, beurten, HP, condities met iconen; op de tablet de volledige weergave
- [ ] **Monsters & Encounters** (DM) — statblokken beheren, encounter bouwen, automatisch vullen met de aanwezige spelers
- [ ] **Loot** (DM/SP/TAB) — vondsten aanmaken, DC als aantekening, onthullen, claimen, afrollen, uitdelen; op de tablet de kist-animatie; een mimic start het gevecht
- [ ] **Rust** (DM/SP/TAB) — lange en korte rust, veld of herberg, maanfase in de overlay, d100-gebeurtenis per speler met valuta-token
- [ ] **Hit Dice besteden** (SP) — tijdens een korte rust een Hit Die inzetten; HP en voorraad kloppen daarna
- [ ] **Akte aanmaken** (DM) — nieuwe akte met nummer, titel en optioneel afbeeldingen
- [ ] **Akte importeren** (DM) — een `.md` inlezen en controleren of koppen, namen en beelden goed landen
- [ ] **Stap onthullen** (DM/SP) — elk staptype één keer onthullen en bij de speler controleren wat er verschijnt
- [ ] **Encounter starten vanuit de regie** (DM) — stap onthullen start het gevecht met de juiste monsters
- [ ] **Initiatief en beurten** (DM) — toevoegen, sorteren, beurt doorgeven, ronde ophogen
- [ ] **Condities in gevecht** (DM) — toekennen en weghalen; de iconen kloppen bij speler en tafelscherm
- [ ] **Monster-HP en schade** (DM) — schade uitdelen, monster verslaan, en de kaart bijwerken
- [ ] **Loot na gevecht** (DM) — vondst koppelen aan het gevecht en meteen verdelen
- [ ] **Rust met herberg-prijs** (DM/SP) — overnachten in de herberg schrijft de prijs per speler af
- [ ] **Rustgebeurtenis per speler** (SP) — iedere speler krijgt zijn eigen voorval; het tafelscherm toont de lijst
- [ ] **Kaartje kiezen bij een gevecht** (DM) — bij Monster én Medestander kun je nu een kaartje kiezen; wie op de kaart als vijand of bondgenoot staat, staat bovenaan

## Blok 7 — Meesterkamer: sfeer en beheer

- [ ] **Geluiden** (DM/TAB) — bibliotheek, sfeerloop per dienst, emotes, en het moment-geluid bij loot reveal
- [ ] **Tafels** (DM) — willekeurige tabellen, weighted rijen, valuta-tokens `{+3kn}`, rollen en het resultaat tonen
- [ ] **Dobbelstenen** (ALL) — formules, voordeel en nadeel, de DM-variant, en klikbare dice in spreukteksten
- [ ] **Media** (DM) — bibliotheek met weergavenaam, live berekend gebruik, uploaden via de picker, verwijderen
- [ ] **Berichten** (DM) — bericht of brief sturen, per speler of party, sjablonen bewaren en hergebruiken, cinematic aanzetten
- [ ] **Instellingen — titel** (DM) — campagnetitel, ondertitel en embleem; ze werken meteen door in kop en landingspagina
- [ ] **Instellingen — munten** (DM) — namen hernoemen (gp/sp/cp, plus electrum en platinum); de verhouding blijft 1 : 10 : 100
- [ ] **Instellingen — party's** (DM) — aanmaken, hernoemen, verwijderen (met de waarschuwing), en wie er vanavond meespeelt
- [ ] **Instellingen — modules** (BEHEER) — per campagne aan en uit; uit betekent weg uit de zijbalk, de Meesterkamer én bij de spelers
- [ ] **Instellingen — wereld** (DM) — verhuisd naar Diensten → Toegang
- [ ] **Instellingen — gedeelde beurs** (DM) — aanzetten, saldo bijwerken, uitzetten; de spelers zien het verschil in hun beurs
- [ ] **Campagnes** (BEHEER) — lijst, aanmaken met wachtwoord, openen, en aanwijzen als standaard
- [ ] **Instellingen — één opslaanknop** (DM) — campagne, munten en beheer in één keer; party's bewaren zichzelf
- [ ] **Instellingen — beheerblok** (DM) — DM-wachtwoord, openingspagina, tafelscherm, campagnes en modules
- [ ] **Electrum & platinum** (DM) — "2 pp" en "3 ep" in prijzen, loot en tabeltokens worden omgerekend
- [ ] **Sheets in de backup** — `<datum>/<campagne>/sheets/<party>.html` naast de datakopie
- [ ] **Campagne aanmaken** (BEHEER) — met DM-wachtwoord in één keer; daarna *Openen* en inloggen
- [ ] **Wachtwoord per campagne** (BEHEER) — veld op het campagnekaartje, slotje verandert mee
- [ ] **Ctrl+S in Instellingen** (DM) — slaat op zolang het paneel in beeld is; Enter in een veld ook
- [ ] **Geluid uploaden** (DM) — bestand toevoegen aan de bibliotheek, hernoemen, afspelen en verwijderen
- [ ] **Emote versturen** (DM) — een emote klinkt bij de spelers en op het tafelscherm
- [ ] **Tafel maken en rollen** (DM) — nieuwe tabel met gewichten, rollen, en het resultaat delen
- [ ] **Naamgenerator** (DM) — namen trekken uit een tabel
- [ ] **Sjabloon voor een bericht** (DM) — bewaren, hergebruiken en verwijderen
- [ ] **Instellingen — embleem** (DM) — kiezen, wissen, en controleren op landingspagina én in de kop
- [ ] **Instellingen — openingspagina** (DM) — de campagne uit het overzicht halen en terugzetten
- [ ] **Instellingen — Ctrl+S** (DM) — sneltoets slaat op zolang het paneel in beeld is; Enter in een veld ook
- [ ] **Helpteksten in de Meesterkamer** (DM) — de uitleg per DM-tab openen en bewerken

## Blok 8 — Tafelscherm en realtime

`public/js/socket-client.js` · `app.js` (`_isDisplayMode`)

- [ ] **Sfeerscherm** (TAB) — campagnetitel en ondertitel, embers, terugval naar idle na een tijd zonder presentatie
- [ ] **Beeld tonen** (DM→TAB) — de DM stuurt een afbeelding naar de tablet, met effect; sluiten brengt hem terug naar idle
- [ ] **Brief op de tablet** (TAB) — de brief verschijnt verzegeld, iemand tikt op het zegel en hij vouwt open
- [ ] **Loot op de tablet** (TAB) — gesloten kist, filmpje, daarna de buit met portretjes van wie wat claimt
- [ ] **Rust op de tablet** (TAB) — party-brede variant zonder per-speler-knoppen
- [ ] **Gevecht op de tablet** (TAB) — volledige weergave, nooit geminimaliseerd
- [ ] **Live-updates** (ALL) — entiteit, archief, missies, HP, boedel en geld komen binnen zonder herladen
- [ ] **Geluid** (TAB) — sfeerloop wisselt per sectie, emotes klinken, en de reveal-klank speelt bij loot
- [ ] **Terug uit tafelscherm** (TAB) — kruisje brengt je terug in je eigen DM-scherm, zonder opnieuw inloggen
- [ ] **Geen dobbelknop op tafel** (TAB) — d20 en het paneel blijven daar verborgen
- [ ] **Tafelscherm aanzetten en terug** (DM/TAB) — knop in de balk zet dit scherm om; het kruisje brengt je terug zonder opnieuw inloggen
- [ ] **Sfeer wisselen** (DM/TAB) — sfeerkeuze verandert de embers en de achtergrond
- [ ] **Effecten** (DM/TAB) — bliksem, windvlaag en duister; let erop dat ze tijdens een gevecht (nog) niet zichtbaar zijn — zie `docs/tafelscherm-effecten.md`
- [ ] **Tablet na herstart** (TAB) — server herstarten en kijken of de tablet ingelogd blijft en zijn kamer terugvindt

## Blok 9 — Uitvoer en onderhoud

- [ ] **Character sheets** (DM) — één personage en de hele party; print naar pdf en vergelijk het aantal pagina's met het laatste "blad X van Y"
- [ ] **Sheets-triggers** (DM) — knop in de Aktes-tabkop, scroll-icoon in de regie-balk, en de herinnering na het pauzeren
- [ ] **Export / campagneboek** (DM) — beide downloads openen en steekproefsgewijs controleren of de inhoud klopt
- [ ] **Tunnel** (DM) — cloudflared starten en stoppen, de url delen en zien dat hij werkt
- [ ] **Backups** — nachtelijke snapshot op de server, ophalen op de laptop, en één bestand terugzetten
- [ ] **Media-opruiming** — ongebruikte bestanden vinden en verwijderen zonder dat er iets kapot gaat
- [ ] **Sheets van één personage** (DM) — openen vanuit het kaartje; alle blokken staan er en de voettekst klopt
- [ ] **Sheets met lange teksten** (DM) — een personage met veel spreuken en features: de paginering moet kloppen
- [ ] **Backup terugzetten** (DM) — één JSON terugzetten uit een snapshot en controleren dat de app het oppakt
- [ ] **Sheets in de backup** (DM) — `sheets/<party>.html` uit de nachtelijke snapshot openen in een browser

## Blok 10 — Meerdere campagnes

- [ ] **Isolatie** (BEHEER) — als DM van A niets van B kunnen lezen of schrijven (`tests/campagne-isolatie.test.js`, 16 tests)
- [ ] **Modules** — startset klopt voor een verse campagne; uitgezet is echt weg, ook bij de spelers
- [ ] **Bronteksten** — kale spreuken en features buiten de beheercampagne; eigen tekst blijft van de DM
- [ ] **Generiek** — geen Grisburgh-kaart, -munten, -naam, -embleem of -dienstnamen in een tweede campagne
- [ ] **Beheer** — `/campaigns` en de modules alleen voor de beheerder
- [ ] **Vreemde campagne = bezoeker** (BEHEER) — open `/andere-campagne` als DM: je krijgt haar landingspagina, niet je eigen scherm met haar naam
- [ ] **Nieuwe campagne opzetten** (BEHEER) — aanmaken met wachtwoord, openen, inloggen, en de eerste party en personage maken
- [ ] **Bronteksten van een tweede campagne** (BEHEER) — spreuken en features komen kaal binnen; de eigen tekst van die DM blijft
- [ ] **Wachtwoord van een andere campagne** (BEHEER) — zetten vanaf het campagnekaartje en er daarna mee inloggen
- [ ] **Helpteksten afschermen** (BEHEER) — nog te bouwen: een tweede DM hoort de uitleg niet te kunnen herschrijven (`docs/todo.md`)

---

## Bevindingen

Per bevinding: waar, wat, en of het opgelost is. Nieuwe regels onderaan.

| # | Blok | Wat | Status |
|---|---|---|---|
| 1 | 1 | Geen keuzepagina: het kale domein stuurde meteen door naar Grisburgh, dus een tweede campagne was alleen via een getypt pad te bereiken | opgelost — overzicht op `/`, met opt-out per campagne; `?display=1` stuurt nog door |
| 2 | 1 | De spelersknop rechtsboven gooide je zonder waarschuwing terug naar de landingspagina | opgelost — vraagt eerst, en logt daarna ook echt uit |
| 3 | 1 | `/prewett` toonde titel, ondertitel en embleem van Grisburgh, en de portretten laadden niet | opgelost — elk API-verzoek noemt zijn campagne (`metCampagne()` in `api.js`), ook bij `fileUrl`/`thumbUrl` |
| 4 | 1 | Het embleem zat als vast pad in `index.html` | opgelost — `meta.embleem` met mediakiezer; geen embleem = geen plaatje |
| 5 | 1 | Geen weg terug naar de campagnekeuze | opgelost — link onder het wachtwoordveld |
| 6 | 1 | Een fractie van een seconde schemert de app door voordat de landing eroverheen valt | opgelost — `body.boot` houdt alles behalve de landing onzichtbaar tot init() weet wie er kijkt |
| 7 | 1 | De weg terug naar de campagnekeuze stond naast het wachtwoordveld, in de weg van de enige handeling die daar telt | opgelost — linksboven |
| 8 | 4 | Een speler naar een andere party verplaatsen kon zonder waarschuwing, terwijl voorwerpbezit en onthulde geheimen achterblijven | opgelost — de editor vraagt eerst en noemt het aantal voorwerpkaartjes (`GET /characters/:id/verhuis-info`) |
| 9 | 7 | Instellingen opende als enige in de Meesterkamer als venster over de rest heen, niet als tab | opgelost — gewone tab met vaste tabkop; het tandwiel bovenaan schakelt ernaartoe |
| 10 | 1 | Ondertitel en voetnoot op de keuzepagina waren overbodig | opgelost — weg |
| 11 | 1 | De pijl naar de tweede party viel niet op | opgelost — vol goud, groter, met gloed en rustige pulse |
| 12 | 1 | Spelers tikten hun wachtwoord in het DM-veld; de Verder-knop was overbodig | opgelost — veld naar rechtsboven met label "Dungeon Master", knop weg, Enter volstaat |
| 13 | 1 | "Wachtwoord voor 2…" — 2 is de partynaam, dat las als een raadsel | opgelost — "Wachtwoord van party 2…", en de DM-ingang verdwijnt zolang die prompt open staat |
| 14 | 7 | Instellingen had een opslaanknop per blok, uitleg die niemand nodig had, en campagnes prominent in beeld | opgelost — één opslaanknop, uitleg naar hover, nieuw blok *Beheer* met DM-wachtwoord, openingspagina, tafelscherm en (ingeklapt) campagnes + modules |
| 15 | 5 | Wereld-instellingen ("de stad verlaten") stonden bij Instellingen | opgelost — verhuisd naar Diensten → Toegang |
| 16 | 7 | Gedeelde beurs: knop zonder tekst, bedragen met FL/KN/CL-afkortingen | opgelost — knop zegt wat hij doet, velden dragen de muntnamen van de campagne |
| 17 | 7 | Geen spatie tussen icoon en tekst in knoppen | opgelost — `.dm-btn { gap: 6px }`; `inline-flex` slikte de spatie op |
| 18 | 9 | De backup bevatte geen character sheets | opgelost — `scripts/sheets-bewaren.js` schrijft ze per party als HTML mee |
| 19 | 7 | Electrum en platinum ontbraken | opgelost — `ep` (5 zilver) en `pp` (10 goud) worden bij invoer omgerekend; kommanotatie blijft |
| 20 | 1 | `?display=1` zette elk bezoekend scherm in tabletmodus, zonder inloggen — en dat bleef hangen in localStorage | opgelost — de vlag wordt pas ingelost als er een sessie is (DM of speler) |
| 21 | 8 | Terug uit tafelscherm vroeg opnieuw inloggen | opgelost — je keert terug naar je eigen scherm, `?display=1` gaat uit de URL |
| 22 | 1 | De kopbalk klapt niet in en de items vallen over elkaar (o.a. na terugkeer uit tafelscherm) | opgelost — de kop werd gemeten vóórdat Cinzel geladen was, dus paste alles "net"; nu opnieuw meten bij `fonts.ready`, na 400 ms en bij `pageshow` |
| 23 | 1 | Na uitloggen als speler was de DM-ingang verdwenen | opgelost — een verse landing zet hem terug (dichtgeklapt), en het onthouden groepswachtwoord wordt bij uitloggen gewist |
| 24 | 8 | De dobbelknop stond op het tafelscherm (sinds de tablet als DM inlogt) | opgelost — beide varianten en het paneel blijven daar verborgen |
| 25 | 7 | Een nieuwe campagne "activeren" veranderde niets: je bleef in Grisburgh | opgelost — knop *Openen* (naar `/naam`), en "Als standaard" heet nu wat het is: waar het kale domein landt. Aanmaken vraagt meteen een DM-wachtwoord, anders kun je er niet in |
| 26 | 10 | Ook via *Openen* bleef je in Grisburgh: je sessie won van het pad | opgelost — het pad (`?campagne=`) bepaalt de campagne, de sessie alleen je rol. In een vreemde campagne ben je bezoeker en log je opnieuw in (`sessieHoortHier()`, zestiende isolatietest) |
| 27 | 1 | Een andere campagne standaard maken sloot je buiten Grisburgh: het serverwachtwoord hing aan de *actieve* campagne | opgelost — het hangt nu aan `config.beheerCampagne`, die vastligt. Zelfde fout zat in de regel die leegmaken toestond |
