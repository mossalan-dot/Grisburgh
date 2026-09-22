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
- [ ] **Voorwerp-editor: types in groepen** (DM) — de keuzelijst *Type* staat in groepen (Wapens & harnas, Magische voorwerpen, Verbruik, Uitrusting, Goddelijk, Overig); een kaartje met een type dat er niet meer in staat houdt zijn waarde en toont die als "(oude waarde)"
- [ ] **Type zegt wat je krijgt** (DM) — kies *Weapon*: onder de lijst staat dat je schade en wapeneigenschappen krijgt, en die velden verschijnen; idem *Armor* (Base AC), *Scroll* (spellkiezer) en *Blessing* (Tempel-velden)
- [ ] **Volgorde in de voorwerp-editor** (DM) — Type, Rarity, Prijs, Exemplaren, Charges, Vereist attunement, Niet te verkopen aan winkels, Beschrijving; de typegebonden velden staan daaronder, en Flavour/Geheimen/Aantekeningen sluiten de rij
- [ ] **Charges leest als één ding** (DM) — vink *Charges* aan: *Maximum* is een getal (letters gaan er niet in), *Herlaadt bij* heeft drie standen, en het veld voor de worp verschijnt **alleen** bij "een deel terug, met een worp". Dageraad staat er niet meer bij (dat deed hetzelfde als lange rust)
- [ ] **Attunement met een voorwaarde** (DM) — vink *Vereist attunement* aan: er verschijnt een veld *Attunement alleen door*; vul "a Wizard" in en dat staat in het detailvenster achter Requires Attunement
- [ ] **Wapeneigenschappen met uitleg** (DM) — hover over een eigenschap in de kiezer van de voorwerp-editor: de PHB-uitleg verschijnt (die stond alleen op het spelerblad)
- [ ] **Geheimen op een voorwerp** (DM/SP) — een voorwerp heeft nu Flavour teksten én Geheimen als lijst, per regel te onthullen per party, net als bij een personage; de speler ziet alleen wat vrij is
- [ ] **Voorwerp-detailvenster is één blok** (ALL) — geen vier rijen losse pillen meer: rariteit en type staan (in kleur) in de ondertitel, en prijs, attunement, charges, schade en eigenschappen staan samen in één omkaderde strook
- [ ] **Voorwerp raak je kwijt door het weg te halen** (DM) — bij een voorwerp staat geen knop *Verloren* meer; een kaartje dat de markering al draagt houdt de knop wel, zodat je hem kunt terugdraaien
- [ ] **Tabblad Bezit** (DM) — open een voorwerp: het tabblad *Bezit* toont per party wie het heeft, hoeveel exemplaren en hoeveel charges; ± past het aantal aan, × haalt het eigendom weg. Losse boedelregels met dezelfde naam staan er gedempt bij
- [ ] **Bezit telt over party's heen** (DM) — geef een voorwerp aan iemand in party 2 terwijl je naar party 1 kijkt: hij staat onder party 2 in *Bezit*, en het ophogen of weghalen daar werkt (dat gaf eerder een foutmelding)
- [ ] **Geven meldt zich** (DM) — schenk een voorwerp vanuit het geef-venster: er verschijnt een korte melding en de teller achter die speler klopt meteen, ook als hij in een andere party zit
- [ ] **Eén klik te veel terugnemen** (DM) — bij een stapelbaar voorwerp staat in het geef-venster een min-knop achter een speler die het al heeft; klikken haalt er één af (en bij de laatste verdwijnt hij uit de lijst)
- [ ] **Te koop bij** (DM/SP) — zet een voorwerp in de voorraad van een winkel: op het voorwerp-kaartje staat onder *Waar hoort dit bij?* een regel **Te koop** met die winkel erachter, doorklikbaar naar het voorraadtabblad. Haal je hem uit de voorraad, dan verdwijnt de regel (het is afgeleid, niet opgeslagen)
- [ ] **Geen verzonnen categorie in de filterbalk** (ALL) — in Voorwerpen staat geen chip *Zegeningen & Gunsten* meer; Blessing en Boon zijn gewone chips en staan gewoon in de lijst
- [ ] **Documentkaartje zonder afbeelding** (ALL) — een document zonder beeld toont geen lege beeldstrook meer; de typebadge is dezelfde paarse pil als bij een kaartje mét beeld (was een balk over de volle breedte)
- [ ] **DM-knoppen in de documentviewer** (DM) — onderaan staan *Zichtbaar/Vaag zichtbaar/Verborgen*, *Bewerken* en *Verwijderen* met icoon én woord, niet drie naamloze vierkantjes
- [ ] **Schadepil op het kaartje** (ALL) — een wapen zonder afbeelding toont zijn schadeformule in de kaartbody en die is klikbaar (rolt in het dobbelpaneel); met afbeelding ligt hij als vanouds rechtsboven over het beeld
- [ ] **Geef-knop even groot** (DM) — bij een uniek voorwerp is de hele strook *Geef aan speler* aanklikbaar, net als bij een stapelbaar of gedeeld voorwerp
- [ ] **Werking als eigen secties** (DM) — vink meerdere werkingen aan: elke werking krijgt een eigen omkaderd blok met een kopje (Attack, Defense, Healing, Spell). Met alle vier tegelijk blijft het venster netjes; niets loopt over de rand
- [ ] **Werking volgt het type** (DM) — kies *Weapon* op een nieuw kaartje (Attack aan) en daarna *Armor*: het vinkje verspringt naar Defense. Zet je zelf een vinkje om, dan blijft dat staan bij een volgende typekeuze
- [ ] **Dex cap alleen bij Other** (DM) — kies *Light* of *Medium* bij "Hoe telt de AC": het veld Dex cap is er niet; bij *Other* wel
- [ ] **Spreuken koppelen** (DM/SP) — vink *Spell* aan en zoek een spreuk: hij komt als chip onder het veld, met een kruisje om los te koppelen. Meerdere mag (Staf van Vuur heeft er twee). In het detailvenster staan ze per niveau en opent een klik het spreukvenster
- [ ] **De eerste spreuk vult de velden** (DM) — koppel er een aan een leeg kaartje: casting time, range, components en duration worden ingevuld, en de beschrijving alleen als die nog leeg was. Een eigen tekst blijft dus staan
- [ ] **Proefvoorwerpen** (DM/SP) — in de Testgroep staan zestien kaartjes die met `Proef` beginnen, één per categorie en per werking (los te zoeken op "Proef"). Ze zijn alleen voor de Testgroep zichtbaar; vier ervan liggen in de boedel van Test McTestface. Opnieuw aanmaken of bijwerken kan met `node scripts/testvoorwerpen.js`
- [ ] **Werking los van type** (DM) — open een Wondrous Item, Ring of Amulet: bij *Werking* vink je Attack, Defense, Healing of Spell aan en de bijbehorende velden verschijnen. Een Ring kan dus AC geven en een Wondrous Item genezen; dat kon eerst niet
- [ ] **Type stelt een werking voor** (DM) — kies *Weapon* op een nieuw kaartje: Attack staat meteen aan. Kies daarna *Armor*: de al aangevinkte werking blijft staan (een keuze wordt nooit overschreven)
- [ ] **Bestaande kaartjes kloppen vanzelf** (DM) — een wapen met schade komt binnen met Attack aan, een harnas met Defense, een scroll met Spell. Er is niets gemigreerd: het wordt afgeleid uit wat er ingevuld staat
- [ ] **Genezing is een eigen veld** (ALL) — vul een *Genezingsformule* in: op het kaartje en in het detailvenster staat een groene knop met een hartje die de formule gooit, naast (niet in plaats van) een schadeknop
- [ ] **Typegebonden velden staan waar de melding ze belooft** (DM) — kies *Weapon*: de melding zegt dat je velden voor schade en wapeneigenschappen krijgt, en die staan direct eronder (niet pas onder de beschrijving)
- [ ] **Streep onder het charges-blok** (DM) — *Vereist attunement* en *Niet te verkopen aan winkels* staan onder een scheidingslijn, zodat ze niet bij de charges lijken te horen
- [ ] **Maximum accepteert alleen cijfers** (DM) — typ `e`, `-` of een punt in *Maximum*: er komt niets in het veld
- [ ] **Kenmerken zonder kader** (ALL) — in het detailvenster staan prijs, attunement en charges als losse chips op één regel, zonder omkadering die als invoerveld leest
- [ ] **Verwijderen zegt wie** (DM) — de bevestiging luidt "<voorwerp> verwijderen uit de inventaris van <speler>?"
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
- [ ] **Tabvolgorde bij een locatie** (DM) — de bewerkmodus toont Informatie, Beeld, Kaart, Winkel in die volgorde; het detailvenster zet Kaart vóór Voorraad
- [ ] **Voorraad inladen: erbij of in plaats van** (DM) — laad een winkel in terwijl er al regels staan: er wordt gevraagd of je toevoegt of vervangt, en bij toevoegen komen dubbele namen er niet twee keer in
- [ ] **Voorraadrijen even breed** (DM) — een regel mét gekoppeld kaartje is even breed als een regel zonder; het vinkje houdt zijn plek
- [ ] **Prijzen met een komma in de winkel** (SP) — zet `1,50` als prijs in de voorraad en koop er twee: er gaat 3 florinde af
- [ ] **Wisselend assortiment ververst op rust** (DM/SP) — zet *Toon steeds maar een deel*, vul `1d8` bij aantal en kies *na een lange rust*: de schappen blijven gelijk tot je rust, en daarna ligt er iets anders. Met `3` liggen er altijd precies drie; *nooit meer dan* begrenst de worp
- [ ] **De speler ziet niet wat er níét ligt** (SP) — bij een wisselend assortiment krijgt de speler alleen de actieve regels; de kolom *In schap* is DM-only en de rest van de voorraad is voor hem onzichtbaar. Kopen van iets dat er niet ligt lukt niet, ook niet als je de naam kent
- [ ] **Elke party haar eigen schappen** (DM/SP) — laat party 1 rusten: de schappen van party 2 blijven staan. En wat een speler ziet hangt aan zíjn party, niet aan de party waar de DM naar kijkt
- [ ] **Inkopen vraagt eerst** (DM) — vink twee regels aan met een bedrag en druk op Inkopen: je krijgt een opsomming met het totaal en de vraag of je doorgaat. Annuleren verandert niets; doorgaan geeft een melding in beeld ("2 voorwerpen ingekocht voor 5,00") en de lijst schuift niet naar boven weg
- [ ] **Aantal in de schappen is een bereik** (DM) — vul 2 tot en met 5 in: er ligt elke verversing een aantal daartussen, nooit meer dan er in de voorraad zit
- [ ] **Deelt schappen met** (DM) — wijs een andere winkel aan in de keuzelijst: onder het veld staat met welke winkel je deelt, klikbaar naar dat kaartje. Beide winkels tonen daarna dezelfde selectie en verversen tegelijk. Zet je de koppeling leeg, dan krijgt deze winkel weer een eigen selectie — de voorraadlijst blijft ongemoeid
- [ ] **Eén kaartje per voorraadregel** (DM) — koppel hetzelfde voorwerpkaartje aan een tweede regel: dat wordt geweigerd met de melding aan welke regel het al hangt
- [ ] **Kaartje dat verdwijnt zegt dat** (ALL) — laat een geopend kaartje ondertussen verwijderen of verbergen en ververs het venster: er staat "Dit kaartje is niet meer beschikbaar" in plaats van oude inhoud waar je niets mee kunt
- [ ] **Diensten betalen uit de partybeurs** (SP) — zet de gedeelde beurs aan en maak de eigen beurs leeg. Een voorspelling bij Ursula, een opdracht bij De Gock, een inzet of lening bij de Tweespalt en een boete bij De Heeren gaan allemaal van de partybeurs; het bedrag dat je daarna in beeld ziet klopt ook. Zet de gedeelde beurs uit en het gaat weer van de eigen
- [ ] **Te weinig geld zegt hoeveel** (SP/DM) — koop iets van 500 fl met 12,50 op zak: er staat "Niet genoeg geld — je komt 487 Florinde 5 Knaker tekort". Bij *Afrekenen* door de DM staat hetzelfde tekort in het paneel. Met de gedeelde beurs aan wordt die gemeten, niet de eigen
- [ ] **Inkoopbedrag is per stuk** (DM) — neem drie stuks over à 2,00: er wordt 6 florinde bijgeschreven, en naast het veld staat `= 6,00`
- [ ] **Kolomkoppen in de voorraad** (DM) — de kolommen heten *In schap*, *Uitverkocht* en *Afrekenen*, niet ✦, UV en —
- [ ] **Inventory van de party klapt open en dicht** (DM) — de knop onder de voorraad opent de lijst en sluit hem weer; de kolommen lopen gelijk, ook op regels met een aantal-teller
- [ ] **Inkopen** (DM) — de knop heet *Inkopen*; na afloop staat er hoeveel er ingekocht is en is de lijst bijgewerkt. Met de gedeelde beurs aan gaat het geld naar de partybeurs, anders naar de speler
- [ ] **Knoppen onder de bewerkmodus** (DM) — *Opslaan*, *Verwijderen* en *Annuleren* staan met icoon én woord; verwijderen is rood
- [ ] **Stapelbaar kopen levert het aantal dat je betaalt** (SP) — koop er drie van een stapelbaar voorwerp: er gaat drie keer de prijs af én er staan er drie in je boedel. Koop daarna nog eens: de winkel is niet "uitverkocht"
- [ ] **Gedeelde beurs betaalt in de winkel** (SP) — zet de gedeelde beurs aan, maak je eigen beurs leeg en koop iets: het lukt en het geld gaat van de partybeurs. Verkopen aan de winkel schrijft ook dáár bij
- [ ] **Gedeeld voorwerp heeft geen aantal-knopjes** (SP) — een voorwerp op *Meerdere spelers — ieder één exemplaar* toont in de Boedel géén − en +; die gaven een foutmelding omdat de server een aantal daar niet aanpast
- [ ] **Hit Dice na een lange rust** (SP) — verbruik er vier van de vijf (Wizard 5): je krijgt er twee terug, niet drie. Met maar één Hit Die in totaal krijg je die ene terug
- [ ] **Overnachting staat in beeld** (SP) — lange rust in de herberg: in de overlay staat wat het je kostte ("2 Florinde voor de overnachting"), en de knop *Sluiten* staat op zijn eigen regel onder het lijstje
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
- [ ] **Verkoopt bij staat bij de verbindingen** (DM) — op een verkoperskaartje staat *Verkoopt bij* onderin de sectie **Waar hoort dit bij?**, met een streepje ertussen; niet meer als los veld elders op het blad
- [ ] **Rol vult aan** (DM) — het rolveld bij *Waar hoort dit bij?* stelt dezelfde rollen voor als bij *Wie hoort hier bij?* (Eigenaar, Lid, Personeel…)
- [ ] **Nieuw kaartje verschijnt meteen** (DM) — maak vanuit een koppelveld een leeg kaartje aan en ga naar dat tabblad: het staat er. Eerder zag je het niet en maakte je met + per ongeluk een tweede
- [ ] **Valt onder kiest uit de eigen lijst** (DM) — het veld *Valt onder* stelt alleen namen voor die al bij deze organisatie staan, niet de hele campagne; voeg iemand toe en hij staat er meteen bij
- [ ] **Organogram tekent live mee** (DM) — vul bij een organisatie namen, rollen en *Valt onder* in: onder de lijst groeit het schema mee terwijl je tikt, dus een tikfout in een chefnaam zie je meteen
- [ ] **Naam in de kop van de editor** (DM) — bovenaan staat *Locatie bewerken › De Swarte Cat*; tik je in het naamveld een andere naam, dan loopt de kop mee. Bij een nieuw kaartje begint er *Nieuwe locatie* te staan en verschijnt de naam zodra je hem tikt — maak je hem weer leeg, dan verdwijnt ook de chevron
- [ ] **Twee rollen op dezelfde plek** (DM) — zet bij *Waar hoort dit bij?* dezelfde locatie twee keer neer, één keer als Eigenaar en één keer als Verkoper: na opslaan staan ze er allebei nog, en op dat kaartje staan ze allebei bij *Wie hoort hier bij?*. Tik je twee keer exact dezelfde rol in, dan blijft er één over
- [ ] **Hoort bij vanaf het personage** (DM) — op een personage- of organisatiekaartje staat een sectie *Hoort bij*: kies een locatie of organisatie plus een rol en druk op Opslaan. Die regel verschijnt daarna bij *Wie hoort hier bij?* van dát kaartje — het staat maar op één plek. Weghalen werkt ook beide kanten op
- [ ] **Melding bij een type met extra's** (DM) — Winkel, Herberg en Tempel staan gewoon bij de gebouwen (geen aparte groep meer). Kies er een: onder de keuzelijst staat wat dat oplevert, met een link naar *Koppelingen* die ernaartoe springt en de sectie kort laat oplichten. Bij andere types staat er niets
- [ ] **Gevonden kaartje in het veld** (DM) — zodra een naam in *Gebied*, *Wie hoort hier bij?* of *Hoort bij* een bestaand kaartje raakt, verschijnt het type-pictogram rechts in het invoerveld (klikbaar naar dat kaartje); de losse regel eronder is weg
- [ ] **Geheime verbinding** (DM/SP) — hang in *Wie hoort hier bij?* een regel aan een geheim (het slotje achter de regel). De speler ziet die regel dan helemaal niet — ook geen "onbekend"-regel, want dát er iemand is, is hier de clou. Onthul dat geheim: de verbinding verschijnt aan beide kanten. Terugdraaien verbergt hem weer
- [ ] **Geheim kiezen zonder tussentijds opslaan** (DM) — tik een nieuw geheim in het veld *Geheimen*, klik daarna op het slotje bij een verbinding: het net getikte geheim staat er al tussen. Ook de geheimen van het gekoppelde kaartje staan in de lijst
- [ ] **Document als kaartje** (DM/SP) — open Documenten: de kaartjes zien eruit als personages en locaties (beeld, naam, type in de ondertitel), de filterchips filteren op documenttype en het detailvenster toont beschrijving, perkamenttekst en — bij een pdf of geluidsfragment — het bestand eronder
- [ ] **Vijf spreuken erbij** (ALL) — zoek op *Confusion*, *Disintegrate*, *Flame Blade*, *Greater Restoration* en *Vitriolic Sphere*: die stonden niet in de lijst en staan er nu met volledige tekst, in elke campagne. *Bigby's Hand* staat er één keer (niet dubbel als "Arcane Hand")
- [ ] **Naslag elders instelbaar** (DM) — Instellingen → *Naslag elders*: vul een eigen sjabloon in met `{naam}` erin en open in een tweede campagne een spreuk zonder tekst; de knop wijst naar jouw adres. Leeg = de zoekpagina van D&D Beyond
- [ ] **SRD-tekst bij class features** (DM/SP) — in een campagne zonder bronteksten heeft *Rage* (Barbarian) gewoon zijn volledige beschrijving; een feature van een niet-SRD-subklasse heeft die niet en toont de verwijzing. Backgrounds blijven leeg (die staan niet in de SRD)
- [ ] **Naslag-chip op het spreukkaartje** (ALL) — in zo'n campagne staat op een spreuk zonder tekst (Booming Blade, Blade Ward) een chip *Naslag* tussen Ritual en Concentration; klikken opent de zoekpagina in een nieuw tabblad zonder het spreukvenster te openen. Bij een spreuk mét tekst staat die chip er niet
- [ ] **Ook bij class features** (DM/SP) — open in een campagne zonder bronteksten een feature in de Progressie-tijdlijn: geen leeg vak maar dezelfde mededeling met een knop naar buiten
- [ ] **SRD-tekst in een tweede campagne** (DM) — log in bij een campagne zónder `bronTeksten` en open *Fireball*: de volledige beschrijving staat er, met onderaan de regel "Tekst uit de SRD 5.2 · CC BY 4.0". Open *Booming Blade* (niet in de SRD): daar staat geen tekst maar een verwijsblok met een knop naar buiten. In Grisburgh zelf verandert er niets — daar staat de PHB-tekst en geen bronregel
- [ ] **Eigen spreuk schrijven** (DM) — Spreuken → de +-knop naast het boekje in de kop: vul minstens een naam in, kies niveau en school, vink componenten/klassen aan en sla op. De spreuk staat tussen de rest met een tag *Eigen*, is doorzoekbaar, en een speler met die klasse ziet hem onder *Alleen mijn klasse*. Een spreuk met alléén een naam (geen school) hoort óók in de lijst te staan. De klassenlijst bevat ook de eigen klassen van de campagne. In bewerkmodus staat de naam van de spreuk in de kop. Bewerken en verwijderen kan vanuit het spreukdetail; verwijderen laat de kopie in het boek van een speler staan
- [ ] **Herkomst van een eigen spreuk** (DM) — maak er een aan en kies bij *Herkomst* "Overgenomen uit ander materiaal": op het kaartje staat de tag *Overgenomen* in rood in plaats van *Eigen*. Herlaad: de keuze staat er nog en staat ook in het bewerkformulier. Niets kiezen mag ook — dan blijft het *Eigen*
- [ ] **Een spreuk aanvragen** (SP) — klik in de bibliotheek op + bij een spreuk die nog niet in je boek staat: de knop wordt een zandloper (*Aangevraagd — wacht op de DM*) en de spreuk staat nog **niet** in je spreukenboek. Herlaad: de zandloper blijft staan
- [ ] **Verzoek goedkeuren of weigeren** (DM) — bovenin het spreukentabblad staat een balk met naam, spreuk en een cursieve regel *Wizard 8 · Level 1 · staat (niet) op die lijst*. Goedkeuren zet de spreuk in het boek van die speler en stuurt hem een melding; weigeren doet dat niet, maar hij mag het daarna opnieuw vragen
- [ ] **De DM schrijft wél direct** (DM) — zet vanuit een spelersblad een spreuk in een boek: die komt er meteen in, zonder verzoek
- [ ] **Wie kent deze spreuk** (DM) — open een spreuk die een speler in zijn boek heeft: onder de knoppen staat *Wie kent deze spreuk?* met naam, party en of hij prepared is (en of er nu op geconcentreerd wordt). Kent niemand hem, dan staat dat er ook
- [ ] **Ritual en concentration filteren** (ALL) — achter de scholen staan twee knoppen; *Ritual* laat 33 spreuken over, *Concentration* de spreuken met concentratie. Ze combineren met niveau, school en klasse
- [ ] **Spreuken zijn te linken** (ALL) — open `…/grisburgh#spreuken` of herlaad de pagina met die hash: je landt op het spreukentabblad, niet op Personages. Idem voor `#bestiarium` en `#relatiemap`
- [ ] **Zoeken in de spreukenbibliotheek** (ALL) — zoek op *necromancy* (school), *wall of fire* (twee woorden) en *ritual*: alle drie geven resultaten, met de spreuk zelf bovenaan. Zoeken op een woord uit de beschrijving werkt vanaf drie letters
- [ ] **Schoolfilter bij spreuken** (ALL) — de scholen zitten achter de trechterknop (niveau, klasse, Ritual en Concentration staan er altijd); klap ze uit en klik *Necromancy*: alleen die spreuken blijven staan, elk met hun eigen icoon en kleur. *Alle scholen* zet het terug, en de rij blijft open zolang er een school gekozen is
- [ ] **Duur niet dubbel op het spreukkaartje** (ALL) — bij een concentratiespreuk staat bij *Duration* alleen "1 minuut" en eronder de tag Concentration, niet twee keer hetzelfde. Een te lange waarde (componenten) wordt afgekapt maar staat voluit in de tooltip
- [ ] **Aanvullende spreuken staan in de bibliotheek** (ALL) — zoek op *Silvery Barbs* of *Tasha's Caustic Brew*: die stonden alleen in de spreukenkiezer van de speler en nu ook in het naslagwerk, met een Engelse school
- [ ] **Bestiariumkop als de andere tabbladen** (DM) — zoekveld, trechter, monsterbibliotheek, uitleg en plus staan als vijf losse knoppen naast elkaar, elk met een eigen icoon (de bibliotheek is een lijstje, niet hetzelfde boekje als de uitleg). De typechips zitten achter de trechter en klappen open zodra je er een kiest; de trechter kleurt mee zolang er gefilterd is
- [ ] **Bestiarium zoeken en filteren** (ALL) — zoek op *undead* (type), *goblin* (naam, vindt ook Hobgoblin) en op een woord uit een beschrijving; de chips onder de kop filteren op creature type (Beast, Humanoid, Undead…). Bij de DM tellen ook nog niet ontdekte wezens mee
- [ ] **Spreuknamen in een statblok zijn klikbaar** (ALL) — open *Druid* in het bestiarium: achter *Cantrips:* en *1st (4):* staan de namen onderstreept in paars; klik *Entangle* en het spreukdetail opent erboven. Een woord dat geen spreuk is (of buiten zo'n lijstje staat) blijft gewone tekst
- [ ] **Lexicon in een statblok** (ALL) — in datzelfde statblok staan *bludgeoning*, *advantage* en *saving throw* onderstippeld met een uitleg bij hover, net als bij spreuken en voorwerpen
- [ ] **Duur niet dubbel in het spreukdetail** (ALL) — open *Entangle*: bij *Duration* staat "Concentration, up to 1 minute", niet met "(concentration)" er nog eens achter
- [ ] **Wezen aanmaken vanuit het bestiarium** (DM) — knop *Nieuw wezen* boven het raster opent dezelfde editor als in de Meesterkamer, maar als venster. Vul een naam in en sla op: het kaartje staat meteen in het raster. Annuleren laat niets achter
- [ ] **Bewerken zonder het tabblad te verlaten** (DM) — het potlood op een bestiariumkaartje opent datzelfde venster (voorheen sprong je naar de Meesterkamer). De knop *Monsterbibliotheek* brengt je nog steeds naar het overzicht met aktes, paginering en SRD-import
- [ ] **Uitleg waarom personen er niet in staan** (DM) — onder het raster staat een voetnoot; de link erin brengt je naar Personages. Een speler ziet die voetnoot niet
- [ ] **Monsters zonder akteveld** (DM) — de monster-editor heeft geen *Akte* meer. Waar een wezen opduikt zet je in de akte-editor onder *Monsters bij deze akte*; de aktefilter in de Meesterkamer blijft werken en telt ook de monsters mee die in de encounters van die akte staan
- [ ] **HP uitrollen** (DM) — bewerk een encounter met meerdere exemplaren van één monster: boven de regels staat *HP van deze monsters · Gemiddelde / Uitrollen*, en per regel een dobbelknopje. Zet uitrollen aan, sla op en start het gevecht: de vier Twig Blights hebben elk een ander aantal HP, en de gevechtslog noemt wat er gerold is. Een monster zonder worp in zijn statblok (Iridan Rogarr, "50") heeft géén dobbelknopje
- [ ] **De juiste gedaante bij een encounter** (DM) — Meesterkamer → Gevecht → Encounters, bewerk een encounter met een NPC die meerdere statblokken heeft: onder zijn regel staat *Deze party kent hem als* met een keuzelijst. Kies de andere versie; de Max HP van die regel springt mee, en op het kaartje staat dezelfde keuze
- [ ] **Focuspunt overal hetzelfde** (DM) — bij een kaartje, bij *Akte bewerken* (Bannerfocus) en in het spreukdetail (uitklapper *Focuspunt bijstellen*) zie je dezelfde kiezer: de hele afbeelding in beeld, een sleepbaar kruisje, en een preview met de échte uitsnede. Het kruisje komt waar je klikt, ook bij een liggende afbeelding
- [ ] **Statblok rekent goed met "16 (+3)"** (ALL) — open het statblok van een NPC-kaartje: onder elke ability staat een modifier en nergens `(NaN)`; bij Hit Points staat niet "70 (70)" en bij Challenge niet twee keer de XP
- [ ] **Statblokken lezen als een blad** (DM) — open in de Meesterkamer een monster dat uit de oude import kwam (Goblin, Hobgoblin, Wervelingpiraat): er staat *30 ft.* en niet *walk 30 ft.*, *AC 12* zonder het lege "(armor)", CR *1/8* in plaats van *0.125*, en bij HP het gemiddelde met de worp erachter
- [ ] **Worp landt op het kaartje** (ALL) — klik de schadepil op een voorwerp: er verschijnt een gloeiende kaart midden in beeld (niet het dobbelpaneel onderin), zonder geluid, met de formule als `1d8+3` — geen spatie voor de plus. Een genezingspil geeft dezelfde kaart in het **groen**
- [ ] **Geheime verbinding is te zien** (DM) — bij *Wie hoort hier bij?* op een locatie: het slotje wordt een **gevulde gouden knop** zodra de verbinding aan een geheim hangt, en de prullenbak staat ernaast op dezelfde regel (niet eronder)
- [ ] **Attunement staat bij de eigenschappen** (ALL) — op een voorwerp dat attunement vraagt staat *Requires Attunement* als eerste pil in de eigenschappenrij, in een paarse tint naast de grijze wapeneigenschappen — niet meer los onder de beschrijving
- [ ] **De kop noemt het soort kaartje** (ALL) — open een personage: boven de verbindingen staat *Waar hoort dit personage bij?*; bij een organisatie *Waar hoort deze organisatie bij?*, bij een locatie *deze locatie*, bij een voorwerp *dit voorwerp*. Ook in de editor, en de hulptekst noemt dezelfde kop
- [ ] **Standaard statblok invullen** (DM) — bewerk een personage, tab Statblock: bovenaan staat *Standaard statblok*. Typ *Guard* en klik Invullen: AC 16, HP 11 (2d8 + 2), Size *Medium*, de ability-modifiers eronder kloppen, en bij Actions staat de Spear. Stond er al iets, dan vraagt hij eerst om bevestiging
- [ ] **Preset als tweede gedaante** (DM) — dezelfde regel staat boven elke tier: geef de herbergier een tier *Guard* en hij verweert zich met dat statblok
- [ ] **SRD zoeken werkt zonder internet-omweg** (DM) — in de monster-editor opent *Standaard statblok (SRD 5.2)* meteen met de 26 gebruikelijke NPC's; typen filtert per letter (zoek *wolf* → Dire Wolf, Werewolf, Winter Wolf, Wolf, elk met hun CR)
- [ ] **Meerdere statblokken op een NPC** (DM) — open een personage met een statblok, bewerk hem: onder het blad staat *Meerdere statblokken* (geen "vanaf level", dat is alleen voor een dier). Voeg er een toe met een label en een afwijkende AC; sla op. Op het kaartje staat boven het statblok de strook *Deze party kent hem als* met **Basis** en jouw label
- [ ] **Afdruk noemt de gedaante** (DM) — kies een tweede statblock en klik *Statblock afdrukken*: de keuzestrook staat niet in het printvenster (daar valt niets te kiezen) en de titel leest "Ursûn Rogarr — In hide armor". Op Basis blijft de titel gewoon de naam
- [ ] **De gedaante staat per party** (DM) — kies het tweede statblok, wissel naar een andere party en open hetzelfde kaartje: die staat nog op Basis. Terug bij de eerste party staat jouw keuze er nog
- [ ] **De speler ziet één versie** (SP) — log in als speler van de party die de tweede gedaante kent: hij ziet dié AC en HP op het kaartje, en nergens een spoor van de andere statblokken
- [ ] **Het gevecht volgt de party** (DM) — zet de gedaante om en zet de NPC in een encounter: hij komt met de AC en HP van de gekozen versie in het gevecht (de monsterbibliotheek spiegelt de actieve party)
- [ ] **NPC's staan in de monsterbibliotheek maar niet in het bestiarium** (DM) — zoek in de Meesterkamer op *Barthen* of *Ursûn*: hij staat in de lijst met een verwijzing naar zijn kaartje, en spelers vinden hem niet in hun bestiarium
- [ ] **Statblock zonder dubbele kop** (ALL) — open een wezen: naam en "Medium Beast Unaligned" staan één keer, in de kop van het venster. In de Meesterkamer (monsterbibliotheek) staat de naam wél boven het statblock, want daar is geen venstertitel
- [ ] **Creature types in het Engels** (DM) — geen "Beest" of "ongebonden" meer; types en alignments staan als PHB-term (Beast, Humanoid, Unaligned, Neutral Evil). Een aantekening achter een komma blijft staan zoals hij was
- [ ] **Lexicon leest mee bij voorwerpen** (ALL) — open een voorwerp met een technische beschrijving (bv. *Amulet van het woud*): *resistance*, *bludgeoning*, *piercing*, *vulnerability*, *fire* en *cold* staan onderstippeld en geven bij hover een uitleg. Idem voor *charges*, *attunement* en *cursed*. Werkt zowel in het detailvenster als op het voorwerpblad in de Boedel
- [ ] **Opmaakbalk in de monster-editor** (DM) — Meesterkamer → Monsters (of het potlood in het bestiarium): Traits, Actions, Reactions en Legendary Actions hebben nu een opmaakbalk. De knop **Naam.** zet `***Bite.*** ` neer met de naam geselecteerd; het oogje toont het blok zoals het in het statblock komt, met de naam vetgedrukt-cursief
- [ ] **Oogje op de opmaakbalk** (DM) — elk tekstveld met opmaakknoppen (Beschrijving, Flavour, Geheimen, sessieverslag, akte-samenvatting) heeft een oogje: klik erop en het veld toont de tekst zoals hij eruitkomt — vet is vet, `{rood:…}` is rood, geen codes in beeld. Nog een keer klikken brengt je terug naar de tekst
- [ ] **Ctrl+U** (DM) — selecteer wat tekst in zo'n veld en druk Ctrl+U: er komt `__…__` omheen, net als Ctrl+B en Ctrl+I al deden
- [ ] **Schrijven of kijken** (DM) — bewerk een document: boven *De tekst zelf* staan twee tabbladen. *Zoals de speler het ziet* toont de brief in het juiste handschrift; wissel intussen het documenttype of de briefstijl en het voorbeeld verandert mee, zonder opslaan. Op dat tabblad is de opmaakbalk weg
- [ ] **Titel en Ondertekening zijn knoppen** (DM) — in dezelfde editor: klik *Titel*; er komt `---titel---` in de tekst met de regel eronder geselecteerd, zodat je meteen kunt typen. Onder het veld staat geen uitleg meer
- [ ] **Antwoord op een claim** (SP) — vraag als speler een voorwerp aan; keurt de DM het goed of af, dan krijg je daar een melding van (voorheen verdween het verzoek zonder bericht)
- [ ] **Gebed en aanplakbiljet** (DM, campagne *Test*) — *Avondgebed voor de Stille* staat in de gotische letter; *Gezocht: de Wervelingbootsman* is gecentreerd met een blackletter-kop en kleinkapitalen eronder. Allebei zonder de briefstijl handmatig te kiezen — het type bepaalt het
- [ ] **Briefstijlen** (DM, campagne *Test*) — loop de proefdocumenten langs: *Brief van de waard* (vlot handschrift), *Het lied van het Leemland* (sierlijk), *Kasboek Vlas & Vezel* (typemachine), *De Wolkenroder Bode* (gezet drukwerk), *Een briefje onder de deur* (uitgeknipte krantenletters), *Verhandeling over de Tweespalt* (oud handschrift). *Notitie met eigen stijl* is een Notitie die tóch als typemachine staat: de stijlkeuze wint van het type
- [ ] **Bestand onder een document** (DM, campagne *Test*) — *Blauwdruk (pdf-scan)* toont de scan in het venster (klik een pagina voor de lightbox); *Opname uit het Amberwoud* toont een audiospeler. Let op: in een tabblad dat niet op de voorgrond staat rendert pdf.js niet — dat is geen fout
- [ ] **Vaag document** (DM/SP, campagne *Test*) — *Verzegeld stuk* staat op vaag: de **DM leest de tekst** met een regel erboven dat de party een slot ziet; de speler ziet alleen dat slot, en de beschrijving komt niet mee over de lijn
- [ ] **Filmpje bij een personage** (DM, campagne *Test*) — *Proefheld met filmpje* heeft een portret en een startscherm-video; klik het portret in het spelersdashboard
- [ ] **Briefstijl kiezen in de eigen letter** (DM) — bewerk een document en open *Hoe ziet de tekst eruit?*: elke stijl staat in de keuzelijst geschreven zoals hij eruitkomt. Er staat maar één "geen keuze"-regel bovenaan. Wissel de stijl terwijl het voorbeeld openstaat: het voorbeeld verandert mee
- [ ] **Documentkaartje zonder afbeelding** (ALL) — een document met alleen een pdf of een mp3 eronder heeft géén leeg beeldvlak meer bovenaan; het kaartje begint bij de badge, net als op de andere tabbladen
- [ ] **Meteen na inloggen live** (SP) — log in als speler en laat de DM daarna iets onthullen **zonder tussendoor te verversen**: de melding komt binnen. Voorheen zat je socket nog in de kamer van een bezoeker en hoorde je niets tot je de pagina herlaadde
- [ ] **Onthulling zonder plaatje** (SP) — laat de DM een document onthullen dat geen afbeelding heeft: de speler krijgt een net kaartje zonder gebroken plaatje. Met afbeelding staat die er gewoon. *Bekijken* opent het document (sloot voorheen alleen het venster)
- [ ] **Documenttypes** (DM) — *Audiofragment* bestaat niet meer; de groep heet *Gesproken en gezongen* met **Lied** en **Opname**. De drie liederen en drie voxaalfles-opnames in Grisburgh staan op het juiste type. Onder Drukwerk staat nu ook **Aanplakbiljet**
- [ ] **Documentkaartje leest als de rest** (ALL) — op een documentkaartje staat het type als badge (net als bij een voorwerp of organisatie), de filterchips filteren op de *groep* (Brieven en aantekeningen, Drukwerk, Boeken en registers, Kaarten en tekeningen, Geluid) en zoeken op "brief" of "kasboek" zet die kaartjes bovenaan
- [ ] **Bladwijzer op een document** (SP) — klik de ster op een documentkaartje: hij wordt goud, de chip *★ Bladwijzers* verschijnt meteen in de filterbalk (niet pas na herladen) en filtert terug tot je gemarkeerde kaartjes. Haal de laatste weg: de chip verdwijnt weer
- [ ] **Ster klopt meteen na inloggen** (SP) — log in en ga rechtstreeks naar Documenten of Personages, zónder eerst je eigen tabblad te openen: op een kaartje dat je eerder gemarkeerd hebt staat een gouden ster
- [ ] **Briefstijl volgt het type** (ALL) — open een Brief (handschrift), een Kasboek (typemachine), een Krant (gezet drukwerk met gotische kop) en een Dreigbrief (uitgeknipte krantenletters): elk leest er anders uit. In de editor overschrijf je dat met *Hoe ziet de tekst eruit?* — handig als twee schrijvers herkenbaar moeten verschillen
- [ ] **Brief op ware grootte** (ALL) — een lange tekst staat in het detailvenster als inkijk met een vervaagde onderrand; klik erop of op *Lees de hele tekst*: de brief komt fullscreen. Escape sluit
- [ ] **Bladeren door een lange brief** (ALL) — beslaat de tekst meer dan één vel, dan staan er pijlen links en rechts en telt de voettekst mee ("Blad 2 van 7"); pijltjestoetsen werken ook. De tekst loopt door waar het vorige blad ophield — geen halve regel, geen herhaling
- [ ] **Documenten bij een akte** (DM) — Meesterkamer → Aktes → bewerk: koppel een document via *Documenten bij deze akte*; het verschijnt onderaan die akte in het Logboek en verdwijnt daar weer als je het loskoppelt. Op het kaartje zelf staat nergens een akte
- [ ] **Document onthullen** (DM/SP) — zet een document op zichtbaar: de speler krijgt de onthulling in beeld (één keer, niet twee overlays) en er komt één regel in het logboek, ook als je het daarna voor een tweede party onthult
- [ ] **Vaag beeld is echt vaag** (DM/SP) — zet een kaartje op *Vaag zichtbaar* en open bij de speler de netwerktab: `/api/thumb/<id>` levert een vervaagde afbeelding (klein bestand, geen detail), niet het origineel. Zet het kaartje op zichtbaar en ververs: het portret is weer scherp. Bij een vaag document met een pdf of geluidsfragment komt het bestand er helemaal niet uit, en staat er een slot met "Document nog niet volledig onthuld"
- [ ] **Vaag document verklapt zijn beschrijving niet** (DM/SP) — zet een document op *Vaag zichtbaar*: de speler ziet het kaartje met naam en soort, maar zowel op de kaart als in het detailvenster staat "Nog niet volledig onthuld…" in plaats van de beschrijving, en zoeken op een woord uit die beschrijving vindt het document niet
- [ ] **Geheim blijft zichzelf bij bewerken** (DM/SP) — onthul het derde van drie geheimen, haal daarna het eerste weg en draai de volgorde van de rest om: de speler ziet nog steeds datzelfde geheim (niet zijn buurman), en een geheime verbinding die eraan hing blijft aan díé regel hangen. Ook na het bijschaven van de tekst
- [ ] **Organogram blijft heel** (SP) — hangt er iemand onder een geheim gehouden persoon, dan schuift die een plek omhoog in plaats van aan een naam te hangen die er voor die party niet is
- [ ] **Hoort bij (omgekeerde kant)** (DM/SP) — open het kaartje van een personage of organisatie die ergens in *Wie hoort hier bij?* staat: onderaan staat een regel **Hoort bij** met rol + kaartje, doorklikbaar. Haal je hem bij de locatie weg, dan verdwijnt hij hier ook (het is afgeleid, niet opgeslagen). Een speler ziet alleen de kaartjes die zijn party mag zien
- [ ] **Geen vijandvinkje buiten personages** (DM) — een geheim op een locatie of organisatie heeft géén vinkje *Onthullen maakt het personage een vijand*
- [ ] **Markering heet wat het is** (DM) — de doodskop-knop in het detailvenster heet *Overleden* bij een personage, *Verwoest* bij een locatie en *Opgeheven* bij een organisatie; bij een voorwerp staat hij er niet (dat haal je gewoon weg)
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
- [ ] Prikbord: de knoppenbalk staat in perkamentstijl met *Kaartje · Draad · Organogram* links en de hulpknop rechts (niet meer in een eigen grijze balk)
- [ ] Klik op *Organogram*, kies een organisatie die de party kent → de organisatie staat bovenaan op het bord met haar leden eronder, met draden die de rol als label dragen
- [ ] Zit er een lid in dat de party nog niet kent, dan staat er *Onbekend — <rol>* zonder naam; een lid achter een nog niet onthulde geheimregel staat er helemaal niet bij
- [ ] Een organisatie die de party nog niet kent staat niet in de keuzelijst (en het verzoek wordt geweigerd)
- [ ] *Kaartje*, *Draad leggen* en *Draad bewerken* openen als gewoon perkamentvenster (geen donkere lijst, geen emoji in het zoekveld); de hulpknop staat één keer in beeld
- [ ] Een kaartje zonder portret toont een silhouet van zijn soort (poppetje / gebouw / speld), geen vraagteken of gebroken plaatje
- [ ] Lexicon op een telefoon: één tik op een onderstreept woord opent de uitleg meteen (niet pas bij de tweede tik); tikken naast het woord sluit hem

### Vaardigheden (archieftab)
- [ ] Archief → Vaardigheden toont kaartjes voor class features, subclass features, species traits, feats, Epic Boons en backgrounds; de tellers boven kloppen met wat je ziet
- [ ] Klik op een soort-chip → alleen die soort, en de bronnen- en levellijst eronder loopt mee (bij Feats is er geen level)
- [ ] Zoek op "unarmored defense" → de Barbarian- én de Monk-versie staan er allebei, elk met hun eigen klasse eronder
- [ ] Een background is één kaartje met zijn vijf onderdelen in het detailvenster, niet zestien keer "Ability Scores"
- [ ] Een feature zonder SRD-tekst (bijv. Sentinel) toont op het kaartje een chip *Naslag* en in het venster de verwijzing "Lees hem elders" — geen leeg vak
- [ ] Geen afbreekstreepjes uit de bron-pdf in de tekst ("Armor Class", niet "Ar- mor Class") — geldt ook op de Progressie-tijdlijn
- [ ] D&D-termen in een beschrijving krijgen lexicon-uitleg bij hover/tik
- [ ] Hulpvenster met meerdere stappen: veeg naar links/rechts (telefoon) of ← / → (laptop) bladert één stap per keer; na sluiten doet een pijltje niets meer
- [ ] Vaardigheden: klik op de trechter → de levelrij klapt open; kies een level en de trechter blijft gemarkeerd, ook als je hem weer dichtklapt
- [ ] Vaardigheden: een Barbarian-feature draagt een ander icoon dan een Wizard-feature (klasse-icoon), een species-trait dat van zijn volk
- [ ] Missiebord (DM): sleep een missiekaartje naar een andere kolom → het staat er meteen in, de kolom licht op terwijl je erboven hangt
- [ ] Missiebord: slepen naar *Aangevraagd* kan niet (die kolom licht niet op); eruit slepen wél
- [ ] Missiebord op een telefoon: de →-knop op het kaartje werkt nog gewoon (daar valt niets te slepen)
- [ ] Vaardigheden (DM): + rechtsboven → nieuwe vaardigheid met soort, bron, level, naam, herkomst, tekst en een afbeelding uit de mediabibliotheek; na opslaan staat hij meteen in de lijst
- [ ] Vaardigheden (DM): potlood op een kaartje → bewerken; van soort of level wisselen verplaatst hem (hij staat daarna maar op één plek)
- [ ] Vaardigheden: een eigen feat toevoegen laat de 51 meegeleverde feats en 12 Epic Boons staan (tellers boven kloppen nog)
- [ ] Vaardigheden (DM): verwijderen vraagt om bevestiging en haalt hem uit de lijst
- [ ] Een kaartje met eigen afbeelding toont die in plaats van het silhouet; de herkomst-tag staat erbij (rood bij *Overgenomen*)
- [ ] Vaardigheden: alle vier de subklassen van een klasse staan erin (bijv. Ranger → Hunter, Beast Master, Fey Wanderer, Gloom Stalker); die zonder SRD-tekst dragen de chip *Naslag*
- [ ] Vaardigheden: een background toont zijn feat als klikbare verwijzing ("Feat. **Magic Initiate** (Cleric)") die dat feat-kaartje opent
- [ ] Klik op *Naslag* of *Lees hem elders* → er opent een zoekpagina met "D&D 2024 <soort> <naam>" (niet de zoekpagina van D&D Beyond, die weigert een koude bezoeker)
- [ ] Progressie-tijdlijn: bij een Ability Score Improvement staat de volledige featlijst in de keuzelijst (67 + 12 Epic Boons), ook nadat de DM in Vaardigheden een eigen feat heeft opgeslagen
- [ ] Iconen: een moeras toont een plantje (geen vis), een eiland een palm, een werkplaats een aambeeld, een ziekenhuis een hartslag — op het kaartje én als kaartspeld
- [ ] Een factie-titel en de leiding van een factie dragen een kroon (niet de favorieten-ster); een boon een lintje, of het sprite-icoon dat de DM invulde
- [ ] Spelerstab Boedel draagt een rugzak, de Loot-tab in de Meesterkamer een kluis

### Akte schrijven
- [ ] Meesterkamer → Aktes → *Verhaal*: het ganzenveer-knopje opent een schrijfscherm over de volle hoogte
- [ ] Typ een regel → na een seconde staat er *bewaard*; sluit en heropen → de tekst staat er nog
- [ ] `##` op een regel → de sectie verschijnt links; klikken zet de cursor op die kop
- [ ] *Kaartje* → zoek een naam → er komt `[[Naam]]` op de cursorpositie; in het voorbeeld is dat een link (of, zonder kaartje, `[[haakjes]]` voor de DM)
- [ ] *Beeld* → mediabibliotheek → `![[fileId]]` in de tekst
- [ ] *Gevecht*, *Tabel*, *Buit* en *Kaart* tonen wat er in de campagne bestaat en zetten een `> [!blok] Naam` neer
- [ ] *Voorbeeld* toont de blokken als kader: Voorlezen op perkament, Notitie gedempt, Gevecht rood
- [ ] *Kopiëren* zet de markdown op het klembord; *Inlezen* vraagt eerst of de huidige tekst weg mag
- [ ] **Speler**: `/api/meta` bevat geen `tekst`, `script` of `monsters` van een akte (netwerktab), wel `num`, `title` en `short`
- [ ] **Export** (DM) — download een snapshot (Instellingen → exporteren) en zoek in het bestand met een teksteditor naar een geheim dat deze party níét kent: dat hoort er niet in te staan. Een geheim dat wél onthuld is staat er wel
- [ ] Plak een heel hoofdstuk uit Obsidian: koppen tot `######` staan in het overzicht (en ingesprongen naar niveau), `|`-tabellen worden echte tabellen, `- `-lijsten worden lijsten
- [ ] Elke `![[bestand.png]]` wordt een slot met de naam en een knop *Bestand kiezen*; kiezen vervangt álle verwijzingen met diezelfde naam
- [ ] Een `![[…mp3]]` of `.wav` opent de geluidenbibliotheek in plaats van de afbeeldingen
- [ ] `DC12 Religion check` in de lopende tekst wordt een blauwe chip (aantekening, er wordt niets gerold)
- [ ] *Namen* telt alleen echte `[[verwijzingen]]` — een `![[plaatje.png]]` staat er niet meer bij
- [ ] Knop **Spelen**: een naam die de party nog niet kent krijgt een oogje en een half oogje áchter de naam; klikken onthult echt (kijk op het spelerstabblad) en de knoppen verdwijnen
- [ ] Een naam die de party al kent heeft geen knoppen — anders staan er tientallen vinkjes door de tekst
- [ ] Een beeld in de speelstand heeft *Toon aan spelers*; na klikken staat het in het logboek en ziet de speler het
- [ ] `> [!tabel] <naam>` → *Rollen* zet de uitslag onder het blok; `> [!gevecht] <naam>` → *Start gevecht* start hem echt
- [ ] Een monsterlink uit 5e.tools of D&D Beyond wordt een chip met een schedelknop die het statblok opent (meervoud telt: "twig blights" vindt "Twig Blight"); een roll20-link krijgt geen knop
- [ ] Alle elf blokken: `[!voorlezen]`, `[!dm]`, `[!gevecht]`, `[!tabel]`, `[!buit]`, `[!kaart]`, `[!kamer]`, `[!rust]`, `[!muziek]`, `[!brief]`, `[!check]` — elk met de juiste knop (of geen, bij dm en check)
- [ ] `[!kamer] Pastorie van Velurut · W3: Ontvangsthal` → de party krijgt toegang tot die kaart én die ene kamer staat open (kijk als speler)
- [ ] `[!brief] <onderwerp>` met tekst eronder → de actieve party krijgt een verzegelde brief
- [ ] `[!muziek]` zonder Spotify-koppeling → nette melding onder het blok ("Koppel Spotify bij Instellingen → Muziek"), geen alert
- [ ] `[!voorlezen]` → *Op tafel*: het tafelscherm toont één vel perkament met de sectiekop erboven; de monitor-knop in de regie-balk zet hem terug op sfeer

### De lade (spelen met de tekst)
- [ ] Start een akte met tekst → knop *Verhaal* in de regie-balk opent een lade onderin (niet meer een paneel opzij)
- [ ] De sectiestrook loopt van hoofdstuk tot scène; een diepe kop (`######`) is kleiner en zonder rand
- [ ] De knoppen in de lade werken echt: onthullen, beeld tonen, gevecht starten, tabel rollen
- [ ] Zoeken in de lade toont de secties met een treffer plus een stukje tekst; klikken springt erheen
- [ ] De greep linksboven wisselt tussen half en hoog scherm
- [ ] Sluit de lade, open hem opnieuw → je staat op dezelfde sectie (ook na herladen)
- [ ] Ganzenveer in de lade → het schrijfscherm van díé akte
- [ ] Een akte met tekst maar zonder script-items: de balk zegt dat de knoppen in de tekst staan
- [ ] Zijbalk van het schrijfscherm: *Rust* opent het rustmenu, *Sheets* opent de printbare bladen
- [ ] De invoegbalk is één menu *Invoegen* met drie groepen; sectie, kaartje en beeld staan er los naast
- [ ] Alt+S, Alt+L, Alt+T, Alt+K, Alt+G … voegen hetzelfde in als het menu-item ernaast
- [ ] Enter in een opsomming maakt het volgende streepje; bij een genummerde lijst telt hij door; een lege regel sluit de lijst
- [ ] Genummerde lijst, citaat (`> `), scènebreuk (`---`) en tabel renderen in de speelstand zoals ze horen
- [ ] Sleep een sectie in de zijbalk naar een andere plek → de hele scène verhuist (ook zijn subkopjes); de tekst is verder onveranderd
- [ ] Knop *Naast elkaar*: links de tekst, rechts het perkament dat meeloopt terwijl je typt
- [ ] Potlood op een regieblok (speelstand én lade) → kop aanpassen of *Kies uit de campagne*; opslaan verandert één regel in de tekst
- [ ] Potlood → *Blok verwijderen* haalt de kopregel én zijn `>`-inhoud weg
- [ ] Hetzelfde potlood in de lade bewaart meteen en tekent de lade opnieuw
- [ ] De kop van het schrijfscherm: *Namen* met het aantal namen zonder kaartje, *Tekst en beeld*, *Spelen*, *⋯* (importeren/exporteren), hulpknop, sluiten — en nergens uitleg ónder een knop
- [ ] *Exporteren* levert een `.md`-bestand met de naam van de akte
- [ ] Importeer een akte via de Meesterkamer → de verhaaltekst van die akte is meteen gevuld (en bij *aanvullen* blijft bestaande tekst staan)
- [ ] Aktes-tab: elke akte-rij heeft ▷ spelen, ✒ schrijven, ✎ bewerken, 👁 zichtbaarheid
- [ ] Het Verhaal-blok toont één regel feiten (secties, regieblokken, woorden, namen zonder kaartje, beelden zonder bestand) — niet de hele tekst
- [ ] Er is nog maar één ingang naar de tekst: de ganzenveer (het oude tekstvak en de losse bestandskiezer zijn weg)
- [ ] Het schrijfscherm heeft géén onthulknoppen meer (wel potloden op de blokken); de lade heeft ze wél
- [ ] Een akte mét tekst toont de oude stappenlijst dichtgeklapt: "N stappen uit de oude import — tonen"
- [ ] De lade heeft drie standen (dicht / half / heel scherm) met de greep linksboven
- [ ] Zodra de lade openstaat verdwijnt de stappenstrook uit de balk en krimpt die tot één regel
- [ ] Onthul een naam in de lade → er verschijnt een ongedaan-maken-knop; klikken zet het kaartje weer op verborgen
- [ ] Een getoond beeld en een onthulde kamer houden een knop om het terug te draaien
- [ ] Een kaartje met geheimen die de party nog niet kent draagt een slotje in de tekst; klikken toont de regels met een knop *Onthullen* / *Weer sluiten* per regel
- [ ] Een `[[naam]]` zonder kaartje krijgt een groene **+**: kies personage/locatie/organisatie/voorwerp/document en het kaartje bestaat (verborgen, leeg — later in te vullen)
- [ ] De kaartjes-kiezer tijdens het schrijven heeft *Nieuw kaartje met de getypte naam*: hij zet de naam in de tekst én maakt het kaartje
- [ ] Akte-rij: de veer is de tékst, het tandwiel zijn de akte-instellingen
- [ ] Een kaartje dat via de plus is gemaakt draagt in het archief een gestippelde rand met *onaf*, en de tab heeft een chip **Onaf (N)** die erop filtert
- [ ] Bewaar dat kaartje in de editor → de rand en de chip verdwijnen
- [ ] Akte-samenvatting: de knop **N na te kijken** opent een lijst met namen zonder kaartje, lege kaartjes en beelden zonder bestand
- [ ] In die lijst: *Invullen* opent de editor, het vinkje haalt het kaartje uit de lijst zonder te openen, de keuzelijst maakt een kaartje voor een losse naam
- [ ] Open een akte met openstaand werk in de regie-balk → in de kop staat **N na te kijken**; klikken opent diezelfde lijst, en de drie aantallen daarin tellen op tot N
- [ ] Een dungeonkamer met een DM-aantekening die `[[Naam]]` noemt: de naam is opgemaakt (geen blokhaken meer), en bestaat het kaartje niet, dan staat er een groene **+** die er een leeg kaartje van maakt
- [ ] **Kaartengalerij** (ALL) — hoofdkaarten en dungeons als kaartjes, plus-knop voor de DM
- [ ] **Wereldkaart** (ALL) — zoomen met wiel en knoppen, pannen, pins openen de locatie; een speler stelt een pin voor en de DM keurt goed
- [ ] **Knoppenbalk over de kaart** (ALL) — open een hoofdkaart: de zoombalk zweeft óver het beeld en de kaart past in één keer helemaal in het venster (geen afgebroken onderkant). *Passend maken* doet hetzelfde na in- of uitzoomen
- [ ] **Pins dragen het type** (ALL) — een stad heeft een ander icoon dan een woud, een berg of een herberg; een locatie zonder type krijgt een speld, en een vaag kaartje een `?`
- [ ] **Locatiekiezer is perkament én zichtbaar** (DM) — dubbelklik op een kaart die je fullscreen geopend hebt: het kiezertje verschijnt (niet onzichtbaar achter de kaart) en staat in dezelfde perkamenttint als de rest
- [ ] **Van pin naar kaartje en terug** (ALL) — klik een pin: het locatievenster opent óver de kaart; sluiten brengt je terug op dezelfde plek op de kaart, niet in de kaartenlijst
- [ ] **Dubbelklik zoomt, de speldknop plaatst** (DM) — dubbelklikken op de wereldkaart zoomt in op dat punt (en na de laatste stap weer passend), precies zoals in de kaartkiezer van een locatiekaartje. Een locatie neerzetten gaat via het speld-icoon in de balk: kruisdraad, klik, kiezer
- [ ] **Heen en weer tussen kaartje en kaart** (DM) — zet in de editor van een locatie een speld (tabblad *Kaart*): hij staat meteen op de wereldkaart. Sleep hem daar; open de editor opnieuw en de speld staat op de nieuwe plek. *Van de kaart halen* en het kruisje op de speld halen hem er allebei af, aan beide kanten
- [ ] **De kiezer opent bij je speld** (DM) — een locatie die al op de stadskaart staat: het doek opent gecentreerd op de speld, niet in de linkerbovenhoek
- [ ] **Eén kaartweergave** (DM) — plaats of verwijder een speld terwijl de kaart fullscreen openstaat: de kaart werkt daarna nog (zoomen, passend maken, spelden hertekenen). Eerder stond er na zo'n wijziging een tweede, onzichtbare kaart in de DOM die alle knoppen opslokte
- [ ] **Dezelfde plek op twee kaarten** (DM) — pin een locatie op de stadskaart én op de continentkaart: het Kaart-tabblad van dat kaartje toont de **kleinste** kaart (Stad vóór Continent) en zet de andere eronder als knop
- [ ] **Kaart verwijderen** (DM) — *Kaart bewerken* heeft een verwijderknop met een bevestiging die zegt wat er meegaat; daarna is het kaartje uit de galerij en zijn de spelden weg, maar de locatiekaartjes niet
- [ ] **Kaart toevoegen/bewerken** (DM) — nieuwe kaart met naam en afbeelding, hernoemen, verwijderen; zonder kaarten verschijnt de lege staat met een knop
- [ ] **Dungeon** (ALL) — kamers openklikken, fog-of-war per kamer onthullen, teller onderaan klopt
- [ ] **Een gebouw in één keer uploaden** (DM) — *Nieuwe dungeonkaart*: naam, omslagafbeelding en drie plattegronden (−1, 0, 1). In de galerij staat één kaartje met knopjes −1 · BG · 1; elk knopje opent die verdieping, en het oogje zet ze alle drie tegelijk zichtbaar
- [ ] **Verdiepingen** (DM) — knopjes BG · 1 · −1; een trap brengt je naar de andere verdieping mét doelkamer, de tegenhanger wordt vanzelf aangelegd, en telt niet mee in de teller
- [ ] **Vondsten vanuit de kamer** (DM) — sectie *Vondsten* in de kamerzijbalk: aanmaken of koppelen; het muntje opent het lootvenster; loskoppelen gooit niets weg
- [ ] **Dungeon op het tafelscherm** (TAB) — de DM toont een dungeonkaart; de tablet toont alleen de onthulde kamers
- [ ] **Logboek per akte** (ALL) — verslagen gegroepeerd per akte, met de banner-afbeelding van die akte
- [ ] **Zoeken in het logboek** (ALL) — `Ursun` vindt net zo veel als `Ursûn`; twee woorden achter elkaar (`rogarr eendragt`) vindt de verslagen waar ze allebei in staan; de naam van een akte (`Lichtmis`) vindt alle verslagen van die akte
- [ ] **Zoeken blijft staan** (DM) — zoek iets, zet een verslag zichtbaar: je zoekresultaat blijft staan in plaats van terug te springen naar de hele lijst
- [ ] **Geen bergplaats in de tijdlijn** (ALL) — nergens een leeg kaartje "Scène-afbeeldingen" of "Geïmporteerde scène-afbeeldingen"; die beelden staan wél in de strip bovenaan de akte
- [ ] **Speler** — `/api/archief` levert een lege `logEntries` (netwerktab); alleen de DM krijgt daar iets in
- [ ] **Beelden blijven licht** (ALL) — open het Logboek met de netwerktab open: elk beeld komt van `/api/thumb/…`, geen enkele van `/api/files/…`; de banner haalt `?w=1200`
- [ ] **Dichtgeklapte akte** (ALL) — een akte die dicht staat is een lage balk waarop naam en dag leesbaar zijn, óók op een lichte banner; de akte die openstaat houdt zijn hoge banner. Het chevron rechts wijst opzij als hij dicht is en omlaag als hij open staat
- [ ] **Chips in het sessievenster** (ALL) — Personages/Locaties/Organisaties/Voorwerpen/Documenten hebben een icoon, geen emoji; het tekentje vóór een naam zegt met een tooltip of hij nieuw is of al eerder voorkwam
- [ ] **Sessieverslag schrijven** (DM) — nieuwe entry, markdown, afbeeldingen uploaden, opslaan en teruglezen
- [ ] **Missie aanmaken** (DM) — titel, beschrijving, koppeling aan een factie of locatie, en zichtbaar maken
- [ ] **Pin voorstellen en goedkeuren** (SP/DM) — speler stelt voor, DM keurt goed of af, beide zien de uitkomst
- [ ] **Kaart of dungeon aanmaken** (DM) — de +-knop boven een groep opent *Nieuwe kaart* respectievelijk *Nieuwe dungeonkaart* (niet de eerste bestaande kaart). Vul naam én beschrijving in, kies een afbeelding uit de bibliotheek: het kaartje staat er meteen, mét beeld en beschrijving, zonder de pagina te herladen
- [ ] **Een verborgen locatie op de kaart** (DM) — een speld van een locatie die de party nog niet kent is gewoon leesbaar, met een gestippelde rand; hij is niet half doorzichtig en verschijnt niet pas bij hover
- [ ] **Drankje met bevestiging** (SP) — klikken op de genezingsknop vraagt eerst of je het zeker weet, met wat het kost ("nog 2 van de 3" of "dit exemplaar is daarna op"); annuleren laat alles zoals het was
- [ ] **Dungeon aanmaken** (DM) — nieuwe dungeonkaart met afbeelding, kamers tekenen, namen geven
- [ ] **Kamer verslepen en bijstellen** (DM) — met het selecteergereedschap sleep je een kamer naar een andere plek; de geselecteerde kamer heeft handvatten op zijn punten om hem bij te stellen. Loslaten bewaart. Bij overlappende kamers pak je de bovenste — die je aanwijst
- [ ] **Ronde kamer** (DM) — met het cirkelgereedschap sleep je een ovaal; hij verschijnt als ronde vorm op de kaart, is aan te klikken (ook net buiten het vierkant eromheen niet), en de zijbalk zegt *Rond*
- [ ] **Een speler leest geen kamernamen vooruit** (SP) — open een dungeon met onthulde én onbekende kamers en kijk in de netwerktab bij `/api/dungeons`: alleen de onthulde kamers hebben een naam, de rest heeft een lege naam en geen symbolen (de vorm is er wel — daar tekent de mist op)
- [ ] **Gevecht aan een kamer** (DM) — sectie *Tegenstand*: maak er een aan of koppel een bestaand gevecht; op de kaart verschijnt de schedel gestippeld, en het zwaardje start het gevecht. Loskoppelen laat het gevecht in de bibliotheek staan
- [ ] **Muntje is de knop** (DM) — klik op het gestippelde muntje van een kamer met een vondst: het lootvenster opent met die vondst erin
- [ ] **Wegklikken sluit de bewerkstand** (DM) — klik naast een kamer: selectie en handvatten weg, zijbalk leeg
- [ ] **Kamerzijbalk** (DM) — beschrijving, monsters, vondsten en trap per kamer
- [ ] **Dungeonvensters openen** (DM) — *+ Nieuw* opent het venster *Nieuwe dungeon map* (en niet onzichtbaar achter de kaart). De prullenbak ernaast verwijdert de dungeon; de ronde kruisknop rechtsboven sluit alleen het venster
- [ ] **Dubbelklik zoomt in de dungeon** (DM) — met het selecteergereedschap zoomt dubbelklikken in op dat punt; met de polygoon sluit een dubbelklik nog steeds de vorm die je tekent
- [ ] **Conditie-iconen zijn geen emoji** (ALL) — schedel, munt, slot en vinkje staan als lijnicoon op de kaart, elk in hun eigen kleur
- [ ] **Het muntje volgt de vondst** (DM) — koppel een vondst aan een kamer: het muntje verschijnt gestippeld op de kaart zonder dat je een conditie toevoegt. De speler ziet het niet, tenzij de DM zelf een zichtbare Buit-conditie zet
- [ ] **Zichtbaarheid op het dungeonkaartje** (DM) — het oogje op een dungeon in de galerij loopt drie standen af voor de **actieve** party: verborgen, zichtbaar (fog-of-war) en uitgespeeld. Wissel van party: de stand verspringt mee, en de andere party houdt de zijne
- [ ] **Soort en uitsnede van een hoofdkaart** (DM) — *Kaart bewerken*: kies een soort (Stad, Continent…); die staat als badge op het kaartje. Sleep het kruisje en het kaartje toont die uitsnede
- [ ] **Sluiten vanuit de balk** (ALL) — zowel bij een hoofdkaart als bij een dungeon staat het kruisje in de balk, in perkamentstijl; er zweeft geen zwarte knop meer over het beeld
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
- [ ] **Een drankje drinken** (SP) — een voorwerp met een genezingsformule heeft in de boedel een groene knop: klikken rolt, telt de HP op (nooit boven het maximum) en meldt "+7 HP · <voorwerp>". Met charges gaat er één af en op is op; met *Verdwijnt bij gebruik* verdwijnt er één van de stapel
- [ ] **Andermans flesje** (SP) — een voorwerp dat je niet bezit levert "Dit voorwerp heb je niet"
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
- [ ] **Markt: achtergrond** (ALL) — achter de Markt staat de gevel van een van je winkels, met het bijschrift *Gevel van …*; verlaat de Markt en kom terug, dan is het een andere. Een winkel die deze party niet kent komt er nooit achter te staan
- [ ] **Bekijk kaartje** (ALL) — overal waar je naar een kaartje kunt doorklikken staat hetzelfde pijltje (↗ als icoon), niet ergens een boekje en ergens een los teken
- [ ] **Markt: een winkel binnenlopen** (ALL) — klik een winkel (of een regel in een zoekresultaat): je krijgt een scherm met de gevel als achtergrond, het portret van de winkelier en zijn voorraad, met een weg terug naar de markt. Kopen werkt daar net als op het kaartje
- [ ] **Markt: winkelier op het kaartje** (ALL) — op het overzicht staat het portret van de winkelier met zijn naam eronder; kent je party hem niet, dan staat er het icoon van het locatietype
- [ ] **Markt: de winkels** (ALL) — Diensten → Markt toont de winkels die je party kent; klikken opent het kaartje meteen op het winkeltabblad
- [ ] **Markt: zoeken** (ALL) — zoek "potion of healing": je ziet alle winkels die hem hebben met hun prijs, goedkoopste bovenaan. Vragen ze allemaal hetzelfde, dan staat er géén *goedkoopst*
- [ ] **Markt: gebied kiezen** (DM) — Meesterkamer → Diensten → Markt: vink *Grisburgh* en *Fort Adhmaid* aan; op de Markt staan dan precies die twee knoppen, in die volgorde. *Laat de app kiezen* zet het terug op automatisch
- [ ] **Markt: gebied** (ALL) — de chip *Grisburgh* toont ook de winkels in Luimpoort en Kalkwijk; *Overal* zet het filter uit
- [ ] **Markt: wat een speler niet ziet** (speler) — een winkel die deze party niet kent staat er niet; bij een voorwerp waarvan de party het kaartje niet kent staat wél naam en prijs, maar géén doorklik naar het kaartje
- [ ] **Markt: wisselend assortiment** (speler) — een roterende winkel die je nog niet bezocht hebt zegt "kom langs om te zien wat er ligt" en stuurt geen voorraad mee (netwerktab)
- [ ] **Toegang per groep werkt echt** (DM+speler) — zet een dienst voor je party op *verborgen* terwijl een speler hem open heeft staan: zijn scherm doet niets meer, ook niet als hij de knop nog ziet staan
- [ ] **Arena-uitslag** (DM) — *Overwinning* betaalt het prijzengeld uit en sluit de partij; *Nederlaag* doet dat niet. Er is geen derde uitkomst meer die stilletjes als verlies telt
- [ ] **Spreukenboek alleen waar het hoort** (speler) — een Fighter zonder spreuken heeft géén Spreukenboek-tab; geef hem één cantrip uit een feat en de tab staat er weer. Een Wizard van level 1 met een leeg boek houdt hem altijd
- [ ] **Subtabs van de speler** (speler) — alle zeven tabs zijn zichtbaar zonder te schuiven; op een telefoon houdt alleen de actieve tab zijn naam. *Berichten* met ongelezen post valt nooit buiten beeld
- [ ] **Spreukenboek sluit mee** (speler) — open je spreukenboek en laat de DM een bericht sturen: de app springt naar Berichten én het boek gaat dicht. De sluitknop brengt je terug naar de tab waar je vandaan kwam
- [ ] **Leesbaarheid van de diensten** (ALL) — loop alle diensten langs (ook de herberg): het vlak met de tekst is overal even stevig, en de tekst is leesbaar zonder dat je de achtergrond kwijt bent
- [ ] **Zoekveld bij Gock en de magizoöloog** (ALL) — typ een naam: je ziet wat je typt (het veld was wit-op-wit)
- [ ] **Wachtwoordveld op een telefoon** (ALL) — open op een smal scherm de DM-ingang op de landingspagina: het veld klapt over de volle breedte open en staat *onder* de regel "‹ Andere campagne", niet eroverheen
- [ ] **Upload verkleint** (DM) — upload een grote PNG (een paar MB): hij komt terug als `.webp`, ziet er hetzelfde uit, en is in de mediabibliotheek een fractie van de oorspronkelijke grootte. Een gif blijft een gif en blijft bewegen
- [ ] **Conditie-iconen** (DM) — zet stunned, restrained, poisoned, prone, concentration en mounted op een token: je ziet een spiraal, een gewicht, het biohazard-teken, een pijl naar de grond, hersenen en een schaakpaard — geen ster (dat is favoriet), geen kettingschakel (dat is een koppeling) en geen konijn
- [ ] **Condities heten overal hetzelfde** (ALL) — zet als DM *Restrained*, *Dodging* en *Raging* op een speler: de speler ziet in Actieve statussen exact diezelfde namen (Engels) met de PHB-uitleg eronder, niet een Nederlandse vertaling en niet een kaal id
- [ ] **Lening bij Taevin** (speler) — sluit een lening af: de banner zegt "0 nachten verstreken". Na een lange rust staat er 1 nacht en is het bedrag 30% hoger. Hij groeit nooit verder dan vijf keer de hoofdsom
- [ ] **Bereikbaarheid per akte** (DM) — wat dicht zit volgt de lopende akte; "de stad verlaten" overschrijft alles behalve wat je als buiten-bereikbaar hebt gemarkeerd
- [ ] **Wereld-instellingen** (DM) — onder Diensten → Toegang: de stad verlaten, en winkels die ook buiten bereikbaar blijven
- [ ] **Namen van diensten** (DM) — hernoem een dienst in zijn eigen paneel; zijbalk, sectiekop en briefhoofd volgen
- [ ] **Dienst hernoemen** (DM) — naam wijzigen in het paneel van die dienst; zijbalk, sectiekop en briefhoofd volgen
- [ ] **Sfeerloop per dienst** (DM/TAB) — open een dienst en hoor de bijbehorende loop wisselen
- [ ] **Prijzen en cooldowns** (DM) — instellen en als speler tegen de grens aanlopen
- [ ] **Backdrop per dienst** (DM) — afbeelding kiezen; de speler ziet hem achter de sectie
- [ ] **Dienst uitzetten als module** (BEHEER) — de dienst verdwijnt uit de zijbalk én uit de Diensten-tab

### Diensten doorgelicht (21 sep 2026)

Negen diensten naast elkaar gelegd — herberg, Tweespalt, Gock, Ursula, tempel,
magizoöloog, facties, Heeren, markt — op vier vragen: komt de schakelaar van de
DM ook op de server aan, gaat het geld via de twee helpers, klopt wat het scherm
belooft, en kan een speler iets doen wat hij niet zou mogen. Wat hieronder
**nu nog stuk** heet, is een bevinding uit die ronde en geen instructie-die-je-
fout-uitvoert.

**De schakelaar en de akte**

- [ ] **Verborgen betekent dicht, ook zonder scherm** (DM+speler) — zet een dienst op *verborgen* en laat de speler zijn openstaande tabblad gebruiken: elke schrijfactie komt terug met "Deze dienst is nu niet beschikbaar voor je groep" (403). Gecontroleerd voor herberg, Tweespalt, Gock, Ursula, tempel en magizoöloog — veertien routes.
- [ ] **De Heeren doen dat niet** (DM+speler) — blijft open: hun drie spelersroutes hebben geen slot. Wordt opgelost doordat de Heeren een gewone factie worden, zie `docs/voorstel-facties.md`.
- [ ] **Facties: de schakelaar werkt** (DM) — zet Facties op *verborgen*: de knop in het Diensten-menu blijft weg (hij kwam terug zodra er één onthulde factie was), `GET /facties` geeft niets meer terug en het prikbord is leeg, want een missie komt altijd van een factie. Op *zichtbaar* zie je het slot, zoals bij de andere diensten.
- [ ] **De akte sluit nu ook de route** (DM+speler) — zet een dienst in de akte-editor op onbereikbaar terwijl een speler zijn tabblad open heeft: zijn verzoek komt terug met "Daar kan je gezelschap nu niet heen" (403). Geldt voor alle veertien routes, en *De Markt* staat nu ook in dat lijstje — die kon je er eerst niet eens aanvinken.
- [ ] **Kopen bij een winkel die je niet kent** (speler) — kan niet meer: kopen, verkopen en onderhandelen toetsen nu of de party het winkelkaartje kent én of het deze akte bereikbaar is. (In Grisburgh staat per party één van de negen winkels op verborgen; die hoort dicht te zitten.) De DM komt er langs.

**Geld**

- [ ] **Alles gaat via de beurs die op het scherm staat** (speler) — zet de gedeelde beurs aan en doe in elke dienst één betaling (bestellen, inzetten, zegen, voorspelling, onderzoek, adoptie, lening): het bedrag gaat telkens van de partybeurs af, nooit uit een eigen zak die niemand ziet.
- [ ] **Inzet terug bij een geschrapt event** (DM) — verwijder een openstaand Tweespalt-event waar op ingezet is: iedereen krijgt zijn inzet terug. Een afgerond event is al uitbetaald en verandert niet meer.
- [ ] **Inzetten kan niet negatief** (speler) — een inzet van 0 of minder wordt geweigerd, en je kunt niet twee keer op hetzelfde event inzetten.
- [ ] **De lening heeft een plafond** (speler) — vraag meer dan het maximum: de route weigert het nu ook zelf. De grens staat in `meta.tweespalt.geldschieter.maxLeenCl` (standaard 100 fl) en niet langer als getal in de client.
- [ ] **De rente in de tekst klopt** (speler) — het leenvenster zegt nu "per nacht dat de party rust", net als de hulptekst; er stond "30% rente per dag".

**Wat er in je knapzak belandt**

- [ ] **Geen emoji in namen** (speler) — vraag een rapport bij de Gock, sluit een lening bij de Tweespalt en laat de DM een boete opleggen: de drie regels heten *Rapport — …*, *Schuldbewijs — …* en *Boete — …*, zonder plaatje ervoor. (De vijf zintuigen van Ursula droegen ook emoji; die werden nergens getekend en zijn eruit.)
- [ ] **Geen eigennaam uit één campagne** (ALL) — de geldschieter komt uit `meta.tweespalt.geldschieter` (naam, portret, leengrens); Grisburgh heeft Taevin Woekeling daar staan. Zet in een tweede campagne een eigen naam: banner, leenvenster, schuldbewijs en hulptekst volgen. Zonder invulling staat er "de geldschieter" en geen portret.

**Kleine dingen in beeld**

- [ ] **Diensten-knop licht op bij de Markt** (ALL) — sta je in de Markt, dan staat *Diensten* in de balk aan.
- [ ] **De Markt zegt het als de party er niet bij kan** (speler) — zet de Markt in de akte onbereikbaar, of verlaat de stad: je krijgt dezelfde "niet bereikbaar"-melding als bij de andere diensten in plaats van een leeg overzicht.
- [ ] **De Heeren zijn te bereiken** (ALL) — *nu nog stuk:* de sectie bestaat (`#section-heeren`), heeft een eigen DM-tab, routes, rangen, klussen en boetes, maar staat in geen enkel menu en er is nergens een knop die ernaartoe schakelt. Ook niet voor de DM.
- [ ] **Elke dienst kan uit als module** (BEHEER) — *nu nog stuk voor de Heeren:* die staat niet in `lib/modules.js` en is dus per campagne niet uit te zetten, terwijl de andere acht dat wel zijn.

**Wat goed stond**

- [ ] De veertien spelersroutes van herberg, Tweespalt, Gock, Ursula, tempel en magizoöloog weigeren keurig met 403 zodra de dienst dichtstaat (nagemeten: met de herberg open geeft een onzin-bestelling 404, met de herberg dicht 403 — het slot zit ervóór).
- [ ] Prijzen komen overal uit de configuratie van de dienst, met een terugval in muntsleutels (`fl`/`kn`/`cl`) en niet in muntnámen.
- [ ] Temp HP van een bestelling telt niet op maar houdt de hoogste waarde, zoals de regels zeggen.
- [ ] De Gock weigert onderzoek naar zichzelf; de magizoöloog weigert een wezen dat de party nog niet ontdekt heeft en een wezen dat al volledig bekend is.

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

### Muziek (Spotify)

- [ ] **Koppelen** (DM) — Instellingen → Muziek: client-id invullen, *Koppelen met Spotify*, toestemming geven. Je komt terug in de campagne met een melding "Spotify gekoppeld als …"; het adres in de balk bevat daarna geen `?code=` meer
- [ ] **Zoeken en toevoegen** (DM) — Aktes → regie-script → muzieknoot: typ een titel, kies een resultaat. De stap staat in het script met naam en artiest, en met "— herhalen" als je dat vinkje aan had
- [ ] **Starten tijdens het spelen** (DM) — muzieknoot in de regie-balk: de muziek begint op het gekozen apparaat. Nog een keer klikken start 'm opnieuw
- [ ] **Geen Spotify open** (DM) — zet alles uit en klik de stap aan: je krijgt "Geen actief Spotify-apparaat gevonden", geen stille mislukking
- [ ] **Tafelscherm als speler** (TAB) — zet *Geluid uit* op het tafelscherm, ververs de tablet en tik er één keer op: het meldt zich als apparaat en de muziek komt daar uit
- [ ] **Herhalen** (DM) — een stap met herhalen blijft doorspelen; zonder herhaling stopt hij na het nummer

### Bladeren met vegen en pijltjes

- [ ] **Kaartje na kaartje** (ALL) — open een kaartje en druk op → : het volgende kaartje uit het raster opent, ← gaat terug. Met een zoekterm actief blijft hij binnen die gefilterde lijst. Op een telefoon doet vegen hetzelfde
- [ ] **Spreuk na spreuk** (ALL) — zelfde in het spreukvenster, binnen de filters die aanstaan
- [ ] **Brief bladeren** (ALL) — vegen blaadert door een lange brief; de pijltjes deden dat al
- [ ] **Subtabbladen** (SP) — vegen wisselt tussen Party · Personage · Boedel · …; een veeg die in de voorwerp-carrousel begint hoort bij de carrousel en wisselt dus niet van tabblad
- [ ] **Niet waar het botst** (ALL) — op de wereldkaart en de dungeonkaart blijft slepen pannen, en in een tekstveld doen de pijltjes gewoon wat ze horen te doen

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

### Spell slots, multiclass en de signatuurkaart (17 sep 2026)

- Zet een speler op Wizard 5 zonder ooit slots in te vullen; zijn Spreukenboek toont 4/3/2 — afgeleid uit klasse en level, niet uit opgeslagen data.
- Pas het maximum van één slotniveau met de hand aan; dat niveau houdt jouw getal, de andere blijven meelopen met het level. Zet een niveau handmatig op 0 en het verdwijnt.
- Verbruik een slot, verander daarna het level: het aantal verbruikte slots blijft staan, het maximum groeit mee.
- Zet een personage op multiclass (Cleric 5 / Wizard 3): het geprinte blad zegt "Cleric 5 (Light Domain) / Wizard 3 (Evoker)" en de Hit Dice eronder staan als 5d8 · 3d6.
- Vul bij een multiclass de tweede subklasse in; de Progressie-tab toont de features van díé subklasse bij de tweede klasse — niet "Choose your subclass".
- Verhoog het level van de tweede klasse van een multiclass; de nieuwe features van díé klasse verschijnen in Kenmerken & Eigenschappen (vroeger alleen die van de eerste).
- Open de Personage-tab als Paladin: boven aan staat een Lay on Hands-kaart met een balk; de `−` verbruikt en het getal loopt terug, de `+` geeft terug en staat uit zolang je niets verbruikt hebt.
- Als Rogue staat er in plaats daarvan één getal (3d6 op level 5) zonder knoppen — er valt niets bij te houden.
- Als multiclass staan er twee kaarten, elk met het level van zijn eigen klasse in het labeltje.
- Klap een sectie op de Personage-tab dicht (alles behalve HP kan); ververs de pagina en hij staat nog steeds dicht. HP heeft geen chevron en kan niet dicht.

### Level omhoog (17 sep 2026)

- Meesterkamer → Instellingen → *Level omhoog*: vink een manier uit (bijv. Gemiddelde) en sla op; die knop is daarna weg in het level-upvenster van de speler, en een verzoek erom krijgt een 400.
- Vink alles uit en sla op: dat wordt geweigerd — met nul manieren kan niemand meer levelen.
- Rust-tab → *Party een level omhoog*: elke speler die vanavond meedoet krijgt een balk boven aan zijn Personage-tab; een afwezige speler niet.
- *Intrekken* haalt die balken weer weg.
- Speler klikt de balk: bij één klasse staat er alleen de HP-vraag, bij een multiclass eerst de klassekeuze met per klasse zijn eigen hit die.
- Kies *Zelf gegooid* en vul een getal buiten 1..die in; er komt een melding en er gebeurt niets.
- Kies *Gemiddelde* en ga omhoog: de omslag toont het oude level doorgestreept, het nieuwe groot, de klasse en "+N HP" met waar dat getal vandaan komt. Level, klasselevel, HP-maximum én huidige HP gaan omhoog (je bent niet ineens gewond).
- Zonder tegoed komt de speler er niet doorheen (409); de DM mag altijd.
- DM draait terug (`POST /api/characters/:id/level-up/undo`): level, klasselevel en HP staan weer op de oude stand en de regel is uit de geschiedenis. Bij een multiclass pakt het terugdraaien dezelfde klassehelft.
- Het level-upvenster toont onder *Wat krijg je erbij?* drie groepjes: wat je zelf kiest (ASI, subklasse), wat je krijgt (class features, met tekst of een verwijzing naar buiten) en wat vanzelf meegroeit (spell slots, proficiency bonus, een Hit Die). Klik een feature open en de beschrijving staat eronder.
- Bij een multiclass: wissel van klasse in stap 1; de features en de hit die veranderen mee (Wizard toont d6, Cleric d8) en het level dat geteld wordt is dat van díé klasse.
- Zet een Cleric op subklasse *Light Domain*: de Progressie-tab en het level-upvenster tonen Light Domain, niet Twilight Domain.
- Zet een scherm op tafelmodus en laat een speler omhoog gaan: er verschijnt een paneel met zijn portret (of initiaal), oud → nieuw level, klasse en +N HP. Gaat er een tweede speler omhoog, dan schuift die ernaast in plaats van het paneel te vervangen; na een halve minuut zonder nieuwe gaat het dicht.
- Zet een Elf op level 2 en ga naar 3: onder *Dit krijg je* staat "Lineage-spreuk (1e) (Elf)" — een species-trait hangt aan het personagelevel, dus hij hoort er ook te staan als je dat level in je tweede klasse haalt.
- Ga met een Wizard van 3 naar 4: onder *Dit groeit vanzelf mee* staat "1 cantrip erbij (4 in totaal)" en hoeveel spreuken je meer mag voorbereiden. Een Barbarian ziet die regels niet.
- Ga met een Wizard van 3 naar 4: in de omslag staat een knop *Kies je cantrip*. Klikken opent de spreukenbibliotheek met het niveaufilter op **C** en de klassekiezer op Wizard; het aantal kaartjes is precies het aantal cantrips van die klasse.
- Ga van 4 naar 5: de knop heet dan *Spreuken van niveau 3* en de bibliotheek opent op niveau 3. Een Barbarian krijgt geen knop.
- Ga omhoog met een klasse die een cantrip of een nieuw spreukniveau krijgt en sluit de omslag zónder te kiezen: op de Personage-tab staat een gestippelde regel ("Je mag nog een cantrip kiezen — sinds je level 4 werd") met een *Kiezen*-knop en een kruisje. Navigeer weg en terug: hij staat er nog.
- Vraag daarna een spreuk van dat niveau aan: de regel verdwijnt vanzelf, ook al staat de spreuk nog niet in je boek (hij wacht op de DM). Vraag je een spreuk aan die je al had aangevraagd, dan blijft de regel terecht staan — er is niets bij gekomen.
- Het kruisje haalt de regel weg en hij komt niet terug na een her-render.

### Party-tabblad: metgezellen, afwezigen en gevallenen (17 sep 2026)

- Koppel een dier aan een speler (kaartje → Baasjes): het verschijnt op de Party-tab met een pootafdruk-penning en "van <voornaam>" eronder, en met een HP-ring zoals iedereen.
- Koppel een NPC als metgezel: die krijgt een schild-penning in plaats van een pootafdruk, en zijn ras · klasse eronder.
- Zet een speler op afwezig (Instellingen → Party's → Actieve spelers): zijn portret is gedimd met "NIET MEE" eronder. Hij doet dan ook niet mee met rust, loot en het vullen van een gevecht — dat hoort één verhaal te zijn.
- Start een gevecht en geef iemand een conditie: dezelfde sprite en kleur als op zijn token verschijnen onder zijn portret in de partyrij én in de initiatieflijst (niet meer een eigen lijstje met `lock` voor restrained).
- Markeer iemand als overleden: hij komt in de sectie *Gevallenen*, grijs, met naam en rol. Alleen kaartjes die de party kent; de sectie is inklapbaar en onthoudt dat.
- Namen met een titel staan voluit: "Zuster Marelle" en "Jonkvrouw Elsje", niet "Zuster" en "Jonkvrouw".
- Op de Party-tab staat géén blok *Ontdekt in <campagne>* meer; dat staat nu boven de tijdlijn in Avontuur → Logboek, met een extra rij voor het Bestiarium (die ontbrak). Klap het dicht, ga naar een ander tabblad en terug: het staat nog dicht.
- Een categorie die helemaal ontdekt is (bijv. Documenten 14/14) krijgt een groen getal.

### Personage-tab: statsrij, abilities en skills (17 sep 2026)

- De statsrij staat als groep bij elkaar in plaats van over de volle breedte uitgesmeerd; alle vakjes lijnen onderaan uit, ook met een extra snelheid erbij.
- Klik het plusje bij *Speed*: er komt een vakje bij met een keuzelijst (Fly / Swim / Climb / Burrow / Hover) en een eigen waarde. Het kruisje haalt 'm weer weg, en het geprinte blad toont hem ook.
- Elke ability-kaart heeft zijn eigen tint, en de skills die eraan hangen dragen dezelfde kleur als streepje en labeltje — zo zie je in één oogopslag welke skills onder INT vallen.
- Onder elke ability staat nu **Save** bij het bolletje en het getal; de tooltip zegt of je proficient bent en wat klikken doet.
- De pijltjes bij een skill zeggen wat ze doen ("Eén hoger — voor een tijdelijke bonus…") in plaats van "Bonus −1".
- De klasse-eigen kaart (Rage, Arcane Recovery, Lay on Hands…) staat onder Skills in plaats van bovenaan.

### Verzoeken-tab in de Meesterkamer (18 sep 2026)

- Meesterkamer → **Vragen**: hier staan openstaande spreukverzoeken én claims op voorwerpen bij elkaar, met per verzoek wie wat wil.
- Bij een spreuk staat de voorrekening eronder ("Fighter 11 · Cantrip · staat niet op die lijst — wel te verklaren via Magic Initiate, een feat of een scroll"): een aantekening, geen oordeel.
- Goedkeuren zet de spreuk in het boek van die speler en haalt de regel uit de lijst; de teller in de kop loopt mee.
- Staat er niets open, dan zegt de kop "Alles is afgehandeld" en beide secties melden dat ze leeg zijn.

### Schrijfscherm: invoegknoppen, opmaakbalk en de rustknop (18 sep 2026)

- Klik in het schrijfscherm op *Kaartje* (of Alt+K): de kiezer opent **over** het schrijfscherm, niet eronder. Kies een kaartje en `[[Naam]]` staat in je tekst. Hetzelfde geldt voor Beeld, Plattegrond, Kamer, Gevecht, Worptabel, Buit en Muziek.
- De opmaakbalk heeft dezelfde knoppen als op een kaartje: vet, cursief, onderstreept, doorhalen, markeren, scheidingslijn, acht kleuren en het oogje met het voorbeeld.
- In de zijbalk staat géén *Rust*-knop meer. Die startte de echte party-rust (HP terug, slots terug, in een herberg geld afschrijven) vanuit een schrijfscherm — terwijl er in de invoegbalk óók een *Rust* zit die alleen een regieblok in je tekst zet. Rust starten doe je in de regie-balk of het rustpaneel. *Sheets* blijft wel staan.

### Bladwijzer en "Weet je nog?" (18 sep 2026)

- Open de lade van een akte: elke sectie heeft bij hover een speldje. Klik erop en die sectie is je bladwijzer (goudkleurig streepje eronder); nog een klik haalt hem weg, een klik op een ándere sectie verplaatst hem.
- Sluit de lade, ververs de pagina, open de akte opnieuw: je begint op de bladwijzer — ook in een andere browser, want hij staat bij de akte en niet in localStorage.
- Ook de naamloze eerste sectie ("Inleiding") is te bladwijzeren; die wordt op positie onthouden in plaats van op titel.
- Druk op **Pauzeren** in de regie-balk: de sectie waar je op dat moment staat wordt vanzelf de bladwijzer.
- Klik in de aktetekst op het belletje achter een kaartje dat de party al kent: elke speler krijgt een toast "Weet je nog? — <naam>" met een klik naar het kaartje. Er komt géén regel in het logboek en de zichtbaarheid verandert niet.
- Een belletje bij een kaartje dat de party níét kent bestaat niet; roep je de route toch aan, dan geeft hij een 409 ("onthul het eerst").
- Ga een level omhoog: het scherm loopt donker, er waaieren stralen achter de kaart, vonken spatten één keer weg en het nieuwe level komt naar voren — alles in de kleur van je klasse (een Wizard blauw, een Barbarian rood).
- Stel in Meesterkamer → Geluiden → *Momenten* een klank in bij **Level omhoog**: die klinkt bij de speler en op het tafelscherm op het moment van de omslag. Staat er niets, dan is het stil.
- Zet in je systeem "verminder beweging" aan: je krijgt hetzelfde tafereel zonder animatie.
- Voeg in het schrijfscherm een beeld in: hij vraagt meteen om een bijschrift. Dat komt als `![[id|Bijschrift]]` in de tekst, staat cursief onder het beeld, en gaat mee naar het logboek en naar de speler zodra je op *Toon aan spelers* drukt. Leeg laten mag; dan is er geen onderschrift.
- Pas een bijschrift in de aktetekst aan en toon het beeld opnieuw: het logboek volgt. De akte is de bron.

### Multiclassen bij een level-up (18 sep 2026)

- Open het level-upvenster met één klasse: naast je eigen klasse staat **Een klasse erbij**. Klikken toont alle klassen in twee groepen — waar je aan de eis voldoet en waar niet — met per klasse voorgerekend wat er gevraagd wordt en wat je hebt.
- Een Wizard met INT 17 en DEX 14 voldoet aan Fighter (STR 13 **of** DEX 13) en Rogue (DEX 13), niet aan Cleric (WIS 13). De "of" van de Fighter moet echt als "of" tellen.
- Vraag een klasse aan waar je *niet* aan voldoet: dat mag. De eis is een aantekening, geen poort — de DM beslist.
- Tweede verzoek naast een openstaand verzoek wordt geweigerd, en je eigen klasse aanvragen ook.
- Meesterkamer → **Vragen**: het verzoek staat er met de voorrekening eronder. Goedkeuren zet de klasse op het profiel met level 0; pas bij de volgende level-up kies je 'm en krijgt hij zijn eerste level.
- Level daarna die tweede klasse: de HP komt uit *zijn* hit die (een Rogue een d8, ook als je hoofdklasse een d6 heeft) en alleen dat klasselevel loopt op.
- Met twee klassen verdwijnt *Een klasse erbij*: een derde kan het datamodel niet bijhouden.
- De DM kan een level-up ook geven vanuit de akte: regieblok **Level omhoog** (Alt+O) in de tekst, en een *Level*-knop in de regie-balk. Beide zetten het klaar voor iedereen die vanavond meedoet; de spelers kiezen zelf hun HP.

### Exhaustion en XP (21 sep 2026)

- Open als DM het Personage-tabblad van een speler: onder Temporary HP staat **Exhaustion** met zes bolletjes en −/+. Zet hem op 2; de regel eronder zegt "−2 op elke d20 test · gaat met één omlaag na een lange rust". De speler ziet dezelfde bolletjes, zonder knoppen.
- Het getal wordt nergens automatisch van een worp afgetrokken — net als de loot-DC is het een aantekening die aan tafel geldt.
- Doe een lange rust met een speler op exhaustion 3: hij staat daarna op 2. Op 0 blijft hij 0 en verdwijnt het blokje.
- Meesterkamer → Instellingen → *Level omhoog* → **Systeem**: kies **XP** in plaats van milestone. Op de Personage-tab van elke speler verschijnt een XP-balk met zijn huidige XP en hoeveel er nog tot het volgende level te gaan is.
- Geef XP met de **XP**-knop in de regie-balk: loopt er een gevecht, dan staat het totaal van de statblokken al ingevuld. Iedereen die vanavond meedoet krijgt het; een afwezige speler niet.
- Gaat een speler daarmee over een drempel heen, dan krijgt hij de level-upbalk vanzelf — in XP-modus wordt het tegoed *verdiend*, de DM hoeft niets te gunnen. In milestone-modus verandert er niets: de DM gunt zoals hiervoor.
- Bij het aanmaken van een nieuwe campagne staat de vraag in het formulier; niets invullen geeft milestone.
- Zet een campagne die op mijlpaal speelde om naar XP: iedereen heeft dan een level en geen XP. In plaats van een dode balk op nul zegt de regel *"je level is met de hand gezet, dus je XP loopt nog niet mee (level 7 begint bij 23.000)"*.
- Instellingen → *Level omhoog* → **Ieders XP op de nullijn zetten**: elke speler gaat naar het minimum van zijn huidige level, de balk vult zich daarna weer normaal. Het geeft géén level-up cadeau.
- Druk de knop twee keer in, of gebruik hem bij iemand die al XP verdiend had: er gaat niets af — hij verlaagt nooit. De knop staat alleen in beeld als het systeem op XP staat.
- **Blad afdrukken** met exhaustion 3: de zes vakjes staan met drie gevuld op het blad, met *−3 op elke d20 test* erachter. Speelt de campagne op XP, dan staat achter klasse en background ook `23.000 / 34.000 XP`; op mijlpaal staat daar niets.
- **Subklasse onder zijn eigen klasse** (SP) — een personage met één klasse heeft *Class* met daaronder *Subclass*. Zet multiclass aan: dan staat er *Class · Subclass Wizard · Multiclass · Subclass Rogue* — elke subklasse direct onder de klasse waar hij bij hoort, en allebei met de naam van die klasse erbij. In een Wands & Wizards-campagne heet de eerste nog steeds *School of Magic*.

- [ ] **Een boon blijft bij de party die hem verdiende** (DM) — laat party A in rang stijgen bij een factie met een boon: alleen de spelers van party A krijgen hem in hun boedel. Party B, die de factie misschien niet eens kent, krijgt niets. (Hij ging naar élke speler van de campagne.)

### Facties: een rang ontgrendelt iets (21 sep 2026)

- [ ] **Vier soorten ontgrendeling** (DM) — geef een rang een tekst, een voorwerp-kaartje, een winkel en een titel. Bij de rangstijging: de tekst komt als regel in de boedel, het **kaartje** komt echt in bezit (met zijn rariteit, charges en plek in de Markt — het was een los regeltje), de **winkel** staat vanaf dan op de Markt, en de titel staat in de keuzelijst op het blad.
- [ ] **Alleen de party die hem haalde** (DM) — laat party A stijgen: party B krijgt niets. (Elke speler van de campagne kreeg hem.)
- [ ] **Hulp inroepen** (speler) — op een rang met een metgezel staat op de factiekaart *Hulp inroepen*. Klik: hij loopt mee op het partytabblad en laadt mee in een gevecht. Nog eens klikken kan niet zolang hij er is.
- [ ] **Hulp gaat naar huis** (DM) — na een lange rust loopt hij niet meer mee en mag je hem opnieuw vragen. *Bedanken* stuurt hem eerder weg. Zijn kaartje blijft zichtbaar — je hébt hem ontmoet.
- [ ] **Een factie die je niet kent stuurt niemand** (speler) — zet de factie op verborgen: hulp inroepen geeft een 403.
- [ ] **Wat een rang nog meer vraagt** (ALL) — vul bij een rang *level* en *voltooide missies* in: op de ladder staat wat gevraagd wordt en wat de party heeft, met een vinkje of een slotje. Het **blokkeert niets** — de rang komt gewoon op renown, zoals bij multiclassen en spreukverzoeken.
- [ ] **Oude facties blijven werken** (ALL) — een factie met `boons` en een los `titel`-veld (alles in Grisburgh) toont dezelfde chips als eerst; een boon mét kaartje-id geldt nu als voorwerp.
- [ ] **Verkopers van een factie** (speler) — hang een lid met voorraad aan een factie: op de factiekaart staat *Hier kun je terecht* met zijn winkel, en klikken opent die op het voorraadtabblad. Kent je party de wínkel nog niet, dan staat hij er **niet** — ook niet als je de persoon wel kent, want dát er een winkel is, is zelf iets om te ontdekken. De DM ziet hem wel, met een stippelrand.
- [ ] **Wie er achter de toonbank staat** (speler) — winkel open maar de verkoper onbekend: je ziet de winkel zonder naam erbij. Ken je hem wel, dan staat zijn naam erachter.
- [ ] **Factiefilter op de Markt** (speler) — onder de gebiedschips staat een rij facties; kies er een en je ziet alleen de winkels van die factie. Alleen facties die je party kent staan er — een chip met een onbekende naam zou zelf een onthulling zijn.
- [ ] **Persoon aan een factie koppelen** (DM) — open een personage-kaartje in de editor: onder *Koppelingen* staat **Lid van factie** met een rangveld. Kies een factie: hij staat meteen in de ledenlijst van het factiepaneel (één plek, twee kanten). Op zijn kaartje staat de factie in het *hoort bij*-rijtje, met zijn rang als rol; een factie die de party niet kent staat er voor de speler niet bij.
- [ ] **Een factie onthullen zet zijn kaartje goed** (DM) — onthul een factie met een gekoppeld organisatiekaartje: dat kaartje staat daarna op *zichtbaar*. (Het kwam in een eigen stand `zichtbaar` terecht die geen enkele filter herkende; één kaartje in Grisburgh stond zo.)

### Handelen namens een speler, en de Gock (21 sep 2026)

- [ ] **Handel namens** (DM) — open een dienst: linksonder staat een balk *Handel namens* met de spelers van de actieve party. Kies er een; de balk licht op en zegt "zijn beurs, zijn poorten". Bestel iets: het geld gaat van díé speler af en de temp HP landt bij hem. De keuze blijft staan als je van dienst wisselt en na herladen.
- [ ] **De poorten gelden gewoon** (DM) — zet de dienst voor die party op *verborgen*: als jezelf kom je er nog langs (je test, en je handelt namens de tafel), namens die speler krijg je dezelfde 403 als hij. Anders test je iets wat een speler nooit ziet.
- [ ] **Alleen de actieve party** (DM) — iemand uit een andere party staat niet in de lijst, en zijn id meesturen geeft een 403.
- [ ] **Een speler kan het niet** (speler) — de balk staat er niet, en `alsSpeler` meesturen doet niets: je handelt altijd voor jezelf.
- [ ] **De Gock leest de geheimenlijst** (speler) — laat een kaartje met meerdere geheimen onderzoeken: het rapport bevat een échte geheimregel, niet een willekeurig tidbit. (Hij las nog het oude enkelvoudige veld, dus een kaartje dat ooit in de nieuwe editor was opgeslagen leverde stilzwijgend een tidbit op.)
- [ ] **Het geheim gaat ook open op het kaartje** (speler) — na het ophalen van het dossier staat diezelfde regel als onthuld op het kaartje. Je hebt ervoor betaald; dan hoort de app niet te zeggen dat je het nog niet weet.
- [ ] **Tweede keer, ander geheim** (speler) — onderzoek dezelfde persoon nog eens: je krijgt de volgende regel. Zijn ze op, dan krijg je weer een tidbit.

### Diensten met tests afgedekt (21 sep 2026)

Alle **34 schrijfroutes** van de acht diensten komen nu in een test voor; dat
waren er 21. Drie nieuwe bestanden: `tests/tempel.test.js` (9),
`tests/tweespalt.test.js` (12) en `tests/ursula-magizoo.test.js` (12). Wat je
met de hand niet meer hoeft na te rekenen:

- **Tempel** — de prijs per god, één zegen tegelijk, afvinken tot hij op is, een
  eed die de andere goden afsluit, verzaken → vloek, boete → vrij, en heffen
  door de DM.
- **Tweespalt** — inzet meteen afgeschreven, uitbetaling = inzet + inzet × payout,
  niets bij verlies, inzet terug bij een geschrapt event, geen inzet van nul of
  boven je saldo, arena-inschrijving met inzet, prijzengeld bij overwinning, een
  partij die sluit zodra de tegenstander verslagen is, en geen derde uitkomst.
- **Ursula** — niets zonder geschreven inhoud, voorspelling over de vólgende
  akte, één per party per akte (en dus ook maar één keer betalen), reset door de
  DM, en niets te voorzien zonder volgende akte.
- **Magizoöloog** — alleen ontdekte wezens, naam → deels met de roddel erbij,
  volledig tegen de hogere prijs, niets meer aan een volledig bekend wezen, en
  één huisdier per party.

> **Gevonden bij het schrijven, en rechtgezet op 21 sep 2026:** de hulptekst
> zegt dat Ursula *"op een 1–5 één zintuig"* onthult, maar de route onthulde er
> **`roll`** — bij een 4 dus vier, waarmee een 5 bijna net zo goed was als een 6
> en de zes zijn betekenis verloor. De tekst is wat de speler leest, dus die is
> leidend geworden. Wil je het andersom, dan is het één woord in
> `POST /ursula/voorspel`.

### Gevecht en dungeonkaarten met tests afgedekt (21 sep 2026)

- [ ] **Een gevecht vult zich met wie er is** (DM) — zet een speler op afwezig (Instellingen → Party's) en start een encounter: hij staat níét op het veld. *Dit werkte niet:* de opstelling keek alleen naar de groep, terwijl de lange rust, de korte rust en de lootverdeling alle drie al naar de aanwezigheid keken. De DM kan hem altijd met de hand toevoegen; andersom is vervelender.
- [ ] **Meerdere van hetzelfde worden genummerd** (DM) — drie Veenwolven geven *Veenwolf 1/2/3*; met *Uitrollen* aan krijgt elk zijn eigen HP-totaal binnen het bereik van de worp.
- [ ] **Het bestiarium vult zich bij de start** (DM) — zodra het gevecht begint staan de monsters op niveau *naam* in het bestiarium van de party die meevecht.
- [ ] **Een speler komt alleen aan zijn eigen HP** (speler) — zijn eigen balkje werkt, dat van een monster of een medespeler geeft 403, en de waarde klemt tussen 0 en zijn maximum.
- [ ] **Na afloop klopt zijn kaartje** (DM) — sluit het gevecht: de HP waarmee hij eruit kwam staat op zijn personage, niet die van voor het gevecht.
- [ ] **Dungeon: een kamer geeft zijn naam pas prijs als hij onthuld is** (speler) — de vórm komt wel mee (daar tekent de mist op), de naam en de merktekens niet. Een aantekening van de DM komt er nooit in.
- [ ] **Dungeon: onthullen is per kamer én per party** (DM) — onthul een kamer voor party A: party B ziet niets. Terugdraaien sluit hem weer.
- [ ] **Dungeon: een verborgen merkteken blijft verborgen** (DM) — ook in een kamer die de party wél kent.

### Boedel en akte-onthullingen met tests afgedekt (21 sep 2026)

- [ ] **Alle beelden van een akte terugzetten werkt echt** (DM) — onthul tijdens het spelen twee beelden en druk daarna op *alle beelden terugzetten*: de speler ziet ze niet meer. *Dit werkte niet:* de route zette alleen de vlag op het verslag om, terwijl de onthulstand per party in `imageVis` staat — en die wint. Voor precies de beelden die je zojuist had getoond deed de knop dus niets.
- [ ] **Een beeld onthullen is per party** (DM) — onthul er een voor party A: party B ziet hem niet. Terugdraaien haalt hem weer weg, en het bijschrift van de regie-stap blijft bij het beeld staan.
- [ ] **Een verborgen verslag blijft weg** (speler) — een sessielog op onzichtbaar (zoals de beelddrager) staat niet in het archief van een speler; de DM ziet hem wel.
- [ ] **Een hele akte verbergen** (DM) — zet de akte voor één party op onzichtbaar: al zijn verslagen en beelden verdwijnen daar. Weer aanzetten geeft precies terug wat er open stond.
- [ ] **Drankje en staf** (speler) — een Potion geneest met een worp, telt nooit boven je maximum, en er gaat er één van de stapel af. Een Staff of Healing raakt een **charge** kwijt en blijft in je tas; bij nul charges weigert hij.
- [ ] **Je gebruikt alleen je eigen spullen** (speler) — een voorwerp van een medespeler geeft 403; de DM mag het wel namens iemand doen.
- [ ] **Doorgeven binnen de party** (speler) — geven verhuist het voorwerp echt; aan jezelf geven kan niet, iets wat je niet hebt ook niet, en met *ruilen uit* lukt het helemaal niet.

### Missies en brieven met tests afgedekt (21 sep 2026)

- [ ] **Een missie voltooien geeft álles wat de rang ontgrendelt** (DM) — zet een missie met renown-beloning op voltooid en laat de party daarmee een rang stijgen: de tekst komt als regel in de boedel, het voorwerp-kaartje komt écht in bezit, en een winkel-unlock gaat open. *Dit werkte half:* het voltooien had een eigen kopie van de rangstijging die alleen voorwerp-boons kende, ze als los regeltje uitdeelde en niet bijhield wat al gegeven was — dus dezelfde boon kon twee keer komen.
- [ ] **De beloning gaat naar de hele party** (DM) — ook naar een speler die zijn character sheet nog nooit heeft ingevuld. *Dit werkte niet:* de uitbetaling telde de party uit `playerProfiles`, en wie daar niet in stond kreeg stilzwijgend niets. Staat de gedeelde beurs aan, dan gaat het bedrag daarheen.
- [ ] **Het prikbord toont wat je toekomt** (speler) — een missie met een renown-drempel boven je stand zie je niet; een voltooide of mislukte verdwijnt; goedkeuren, voltooien en laten mislukken kan alleen de DM.
- [ ] **Een brief komt bij de juiste mensen** (DM) — aan één personage, of aan een hele party. De andere party krijgt niets, en de cinematische vlag staat op het bericht.
- [ ] **Post is van de ontvanger** (speler) — als gelezen markeren en weggooien kan alleen bij je eigen post; een speler kan zelf geen post versturen.

### Spreukenboek en progressie met tests afgedekt (21 sep 2026)

- [ ] **Slots volgen klasse en level, behalve waar jij ingreep** (DM) — een Wizard 5 heeft 4/3/2; ga naar 6 en het maximum groeit mee terwijl wat verbruikt is verbruikt blijft. Een handmatig gezet niveau blijft staan, ook als de tabel iets anders zegt.
- [ ] **Een spreuk in je boek gaat langs de DM** (speler) — een speler die er een toevoegt krijgt een openstaand verzoek; pas na goedkeuren staat hij in zijn boek. Afwijzen laat het boek ongemoeid. De DM schrijft rechtstreeks.
- [ ] **Voorbereiden en concentratie** (speler) — voorbereiden gaat aan en uit; op een tweede spreuk concentreren laat de eerste vanzelf los.
- [ ] **Andermans boek en andermans slots** (speler) — allebei 403.
- [ ] **Eigen vaardigheid erbij** (DM) — voeg een class feature toe op een level; hij staat er met zijn herkomst, en verwijderen haalt hem er weer uit.
- [ ] **De featbibliotheek blijft heel** (DM) — schrijf je eerste eigen feat: de meegestuurde bibliotheek wordt éénmalig vastgelegd. Een tweede eigen feat voegt er één toe en gooit er niets weg. (De bibliotheek zit niet in de seed op de server, dus dit is de plek waar hij kon verdwijnen.)
- [ ] **Multiclassen wordt voorgerekend, niet geblokkeerd** (speler) — een Wizard met DEX 16 en WIS 10 voldoet aan Rogue en niet aan Cleric, maar mag allebei aanvragen. Eén verzoek tegelijk; je eigen klasse en een derde klasse worden geweigerd.
- [ ] **Goedgekeurd betekent level 0** (DM) — de klasse staat op het blad met level 0, en een eventuele subklasse van een eerdere poging is weg. Pas bij de volgende level-up krijgt hij zijn eerste level. Afwijzen zet niets.

- [ ] **Geen emoji in de gevechtslog** (DM) — speel een gevecht en sluit het af: het gevechtslog komt als sessieverslag in het Logboek te staan met regels als *Ronde 2 begint* en *Hilde ontvangt 5 schade (12/20 HP)*, zonder ⚔️ 🔔 💥 💚 🏆 ervoor. Die tekst wordt gerenderd, dus daar geldt dezelfde afspraak als overal.

### Standaard-uitrusting meegeleverd (21 sep 2026)

- [ ] **Uit de SRD halen** (DM) — maak een nieuw voorwerp-kaartje: bovenaan staat *Standaard voorwerp* met een zoekveld. Typ `Battleaxe` en druk op Invullen: naam, type Weapon, prijs, gewicht, schadeformule `1d8 slashing` en de wapeneigenschappen staan er. `Plate Armor` vult Base AC 18, Stealth Disadvantage en Strength 15 in; `Shield` komt binnen als type **Shield** met `armorType: shield` en +2 (Open5e zet hem als zwaar harnas met AC 2 weg — dat zet het script recht).
- [ ] **Het vult alleen lege velden** (DM) — vul zelf een beschrijving in en haal daarna een standaardvoorwerp op: jouw tekst blijft staan. Alleen de naam wordt gezet als die nog leeg is.
- [ ] **Voorraadregels wijzen naar bestaande kaartjes** (DM) — `node scripts/voorraad-herkoppelen.js <campagne>` meldt nul dode koppelingen. In Grisburgh waren dat er 12 (de gewone wapens bij De Kromme Spijker); die zijn 21 sep hersteld.
- [ ] **Magische voorwerpen zitten in dezelfde kiezer** (DM) — typ `Bag of Holding`: type Wondrous item, rariteit Uncommon. `Cloak of Elvenkind` zet het attunement-vinkje aan; `Flame Tongue Longsword` vult ook de schadeformule in. In de keuzelijst staat achter een magisch voorwerp zijn rariteit (en *attunement* als dat nodig is), achter gewone uitrusting de prijs.
- [ ] **Ze staan níét als kaartje in het archief** (DM) — het archieftabblad Voorwerpen toont alleen wat jíj hebt aangemaakt. De 757 magische voorwerpen zijn een bron om uit te putten, geen inventaris.

### Testronde dienst 2 — de Herberg (21 sep 2026)

- [ ] **Bestellen** (speler) — bestel iets met temp HP: het bedrag gaat van de beurs die op het scherm staat (bij een gedeelde beurs dus de partybeurs), de worp wordt uitgevoerd en de temp HP staat op je blad. Staat er een **buff** bij het menu-item, dan komt die er als apart effect bij ("Verwarmd — voordeel op je eerste save tegen kou").
- [ ] **Roddels: drie en dan pauze** (speler) — vraag drie keer een roddel: je krijgt er drie, telkens over een ander kaartje, en de suggestielijst ververst zich. De vierde zegt *Cooldown actief*.
- [ ] **Handel namens: lezen en schrijven horen bij elkaar** (DM) — kies in de balk een speler en vraag een roddel: het scherm telt meteen mee. *Dit was stuk:* de vraag werd weggeschreven onder die speler maar teruggelezen onder de DM, dus je zag een lege teller en merkte pas bij de vierde klik dat het op was. Geldt nu voor de vijf dienstschermen (herberg, Gock, magizoöloog, tempel, Tweespalt).
- [ ] **Een ontbrekend portret breekt niets** (ALL) — staat het portret van de waard niet op schijf, dan verschijnt de perkamenten placeholder in plaats van het Safari-icoon.
