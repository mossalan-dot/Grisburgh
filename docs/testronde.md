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
- [ ] **Personage-editor** (DM) — alle velden bewaren; portret uit de mediabibliotheek met versleepbaar focuspunt; extra afbeeldingen; filmpje uploaden (weigert boven 8 MB); zichtbaarheid per party; van party wisselen waarschuwt eerst
- [ ] **Locaties** (ALL) — type *Winkel* geeft een voorraad met prijzen — koop en verkoop als speler en controleer geld én boedel; een gepinde locatie toont de kaartknop die naar de juiste plek vliegt
- [ ] **Organisaties** (ALL) — kaartjes, leden die eraan hangen, detailvenster, zichtbaarheid per party
- [ ] **Voorwerpen** (ALL) — gekleurde rand per rarity (grijs → goud), gloed en shimmer bij Very Rare en Legendary; damage-pill klikken opent het dobbelpaneel met die formule; rariteit in kleur in het detailvenster
- [ ] **Documenten** (ALL) — eigen editor en viewer (niet het detailvenster van de andere tabs); markdown met `[[links]]`; per party vrijgeven en weer verbergen
- [ ] **Bestiarium** (DM) — kaartjes, statblock-modal met acties en eigenschappen, eigen editor in de Meesterkamer; spelers zien deze tab niet
- [ ] **Spreuken** (ALL) — filters op niveau en klasse, zoeken, detailvenster met casting time, range, components en duration; afbeelding kiezen en focuspunt zetten; glossary-tooltips op D&D-termen
- [ ] **Eigen spreukbeschrijving** (DM) — uitklap in het spreukdetail: schrijf een tekst, sla op, herlaad — hij blijft en vervangt de bron; leeg opslaan zet hem terug
- [ ] **Overleden markeren** (DM) — kaartje markeren; de speler ziet het meteen (`entity:deceased`), party en archief tonen hem als overleden
- [ ] **Geheimen onthullen** (DM) — een geheim vrijgeven komt live binnen bij de speler (`entity:secret`) zonder herladen; terugdraaien verbergt het weer
- [ ] **Bladwijzers** (SP) — ☆ wordt ★, blijft na herladen, en de gemarkeerde kaartjes zijn terug te vinden
- [ ] **Globaal zoeken** — sneltoets of vergrootglas; resultaten uit alle types door elkaar, klikken opent het juiste kaartje; als speler zie je alleen wat vrijgegeven is
- [ ] **Filters en sortering** (ALL) — de trechter per type (winkel, subtype, rariteit), sorteren op naam, en of de keuze blijft staan als je een kaartje opent en terugkomt
- [ ] **Zichtbaarheid per party** (DM) — een kaartje vrijgeven aan de ene party en niet aan de andere; wissel van party en controleer beide kanten
- [ ] **Voorwerp aan een speler geven** (DM) — vanuit het kaartje toewijzen aan een personage; het verschijnt in zijn boedel met de juiste rariteit
- [ ] **Voorraad van een winkel** (DM) — regels toevoegen, prijzen zetten, uitverkocht markeren per party
- [ ] **Huisdier-kaartje** (DM) — subtype *dier*: adoptieprijs, tiers per level, en of het klopt in de Magizoöloog
- [ ] **Helpknop per tab** (ALL) — het vraagteken opent de uitleg met stappen en afbeeldingen; vorige/volgende werken
- [ ] **Helpteksten bewerken** (DM) — de uitleg aanpassen en opslaan; herlaad en kijk of je tekst er nog staat (let op: dit hoort straks alleen voor de beheerder te zijn — zie `docs/todo.md`)
- [ ] **Afbeeldingen in het detailvenster** (ALL) — extra afbeeldingen bladeren, lightbox openen, zoomen
- [ ] **Editor in tabbladen** (DM) — de bewerkmodus heeft tabs: Informatie, Beeld & geluid, Character Sheet en (bij een verkoper) Winkel; wisselen bewaart wat je hebt ingevuld
- [ ] **DM-velden herkenbaar** (DM) — aantekeningen en geheimen staan in een koele tint met "alleen jij" ernaast — je ziet meteen dat spelers dit niet lezen
- [ ] **Afbeeldingen en banner** (DM) — één knop voegt toe, de ster maakt er de banner van, het kruisje koppelt los (bestand blijft in de bibliotheek); het focuspunt zit op de banner
- [ ] **Ras, klasse, alignment** (DM) — keuzelijst in perkament: typen filtert, pijltjes en Enter werken, en iets intikken wat er niet in staat mag ook
- [ ] **Meerdere geheimen** (DM/SP) — twee geheimen op één kaartje, één onthullen: de speler ziet alleen dat ene, de kaart toont 1/2
- [ ] **Roddel met de hand vertellen** (DM/SP) — knop op de rol perkament in het detailvenster; daarna ziet de speler die roddel, en terugdraaien kan
- [ ] **Rollen en kant** (DM) — verkoper aanvinken zet de voorraad aan, antagonist geeft de badge, en de kant bepaalt waar hij in het gevecht bovenaan staat
- [ ] **Gekoppelde spreuken** (DM/SP) — spreuk zoeken in het Spells-paneel, chip verschijnt, klikken opent het spreukdetail met de volledige tekst
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
