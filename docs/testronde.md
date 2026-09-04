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

- [ ] **Personages** (ALL) — kaartjes, filters, zoeken, detailvenster, `[[links]]` in de tekst
- [ ] **Personage-editor** (DM) — velden, portret + focuspunt, filmpje uploaden, zichtbaarheid
- [ ] **Locaties** (ALL) — winkeltype met voorraad, kopen/verkopen, kaartknop bij gepinde locaties
- [ ] **Organisaties** (ALL) — kaartjes, leden, detail
- [ ] **Voorwerpen** (ALL) — rarity-randen en gloed (Very Rare/Legendary), damage-pill → dobbelsteen
- [ ] **Documenten** (ALL) — eigen editor en viewer (`render-archief.js`), zichtbaarheid per groep
- [ ] **Bestiarium** (DM) — kaartjes, statblock-modal, eigen editor
- [ ] **Spreuken** (ALL) — bibliotheek, filters op level/klasse, detail, afbeelding + focuspunt
- [ ] **Eigen spreukbeschrijving** (DM) — nieuw: veld in het spreukdetail, leeg = wissen
- [ ] **Overleden markeren** (DM) — `entity:deceased`, weergave bij de speler
- [ ] **Geheimen onthullen** (DM) — `entity:secret`, komt live binnen bij de speler
- [ ] **Bladwijzers** (SP) — ☆/★, blijft na herladen
- [ ] **Globaal zoeken** — sneltoets, resultaten over alle types

## Blok 3 — Logboek, kaarten en dungeons

`public/js/render-archief.js` · `render-kaart.js` · `render-dungeon.js` · `render-relatiemap.js`

- [ ] **Sessieverslagen** (ALL) — entries, afbeeldingen-carousel, onthullen per beeld
- [ ] **Missies** (ALL) — status, aanvragen door spelers, goedkeuren door de DM (`missie:*`-events)
- [ ] **Prikbord / relatiemap** (ALL) — netwerk, posities bewaren, onthulde relaties
- [ ] **Kaartengalerij** (ALL) — hoofdkaarten + dungeons als kaartjes
- [ ] **Wereldkaart** (ALL) — zoomen, pannen, pins, speler stelt pin voor → DM keurt goed
- [ ] **Kaart toevoegen/bewerken** (DM) — nieuw: lege staat als er nog geen kaart is
- [ ] **Dungeon** (ALL) — kamers, fog-of-war, onthullen, teller
- [ ] **Verdiepingen** (DM) — BG/1/−1-knopjes, trap tweezijdig, trap telt niet mee in de teller
- [ ] **Vondsten vanuit de kamer** (DM) — sectie *Vondsten*, muntknop opent het lootvenster
- [ ] **Dungeon op het tafelscherm** (TAB) — `display:showDungeon`

## Blok 4 — Spelerstabblad

`public/js/app.js` (subtabs Party · Personage · Facties · Boedel · Progressie · Spreukenboek · Berichten)

- [ ] **Party** (SP) — medespelers, HP-balken, ontdekkingsteller, aanwezigheid
- [ ] **Personage** (SP) — stats, saves, skills, conditions, inspiration, buffs, vloek
- [ ] **HP en Hit Dice** (SP/DM) — DM past HP aan → `player:hp-updated`; Hit Dice afgeleid uit klasse
- [ ] **Medestanders** (SP) — `companion:link`, dier/NPC vergezelt de groep
- [ ] **Boedel** (SP) — voorwerp-kaartjes + losse regels, stapelen, notitie, paginering
- [ ] **Beurs** (SP) — eigen munten vs. gedeelde partybeurs, munten met komma
- [ ] **Geven aan…** (SP) — direct naar een medespeler, alleen eigen spullen, niet aan jezelf; geld niet
- [ ] **Progressie** (SP) — tijdlijn en kaartweergave, vergrendelde levels, keuzes (ASI) bewaren
- [ ] **Spreukenboek** (SP) — eigen lijst, slots, voorbereid-stempel, glossary-tooltips
- [ ] **Berichten** (SP) — ongelezen-badge, brieven, cinematische reveal met lakzegel
- [ ] **Notities** (SP) — `player-notes.json`, blijft per speler

## Blok 5 — Diensten

`public/js/app.js` (secties) · `dm-panel.js` (instellingen per dienst)

- [ ] **Herberg** (SP/DM) — roddels, tap, bestellen, cooldown, backdrop
- [ ] **De Tweespalt** (SP/DM) — inzetten met komma-bedrag, uitslag, `tweespalt:uitslag`
- [ ] **De Gock** (SP/DM) — onderzoek aanvragen, rapport klaar (`gock:rapport-klaar`)
- [ ] **Madame Ursula** (SP/DM) — vier zintuigen, voorspelling, brief in Berichten
- [ ] **Tempel** (SP/DM) — goden, priester, Zegening kopen, Eed zweren (cinematic), eed blokkeert andere
- [ ] **Magizoöloog** (SP/DM) — huisdier adopteren, prijs in de eigen munt
- [ ] **Facties & Aanzien** (SP/DM) — renown, rangen, boons, titels
- [ ] **Heeren van de Nacht** (SP/DM) — rangen, advocaat, betalen
- [ ] **Verzegelde uitnodigingsbrief** (DM) — per factie of dienst, tweetraps reveal
- [ ] **Toegang per groep** (DM) — dienst verbergen voor een party
- [ ] **Bereikbaarheid per akte** (DM) — wat dicht zit volgt de lopende akte; "Grisburgh verlaten" overschrijft
- [ ] **Wereld-instellingen** (DM) — staan nu onder Diensten → Toegang: de stad verlaten + winkels die open blijven
- [ ] **Namen van diensten** (DM) — hernoem een dienst in zijn eigen paneel; zijbalk, sectiekop en briefhoofd volgen

## Blok 6 — Meesterkamer: spelen

`public/js/dm-panel.js` · `render-archief.js` (aktes) · `combat-canvas.js`

- [ ] **Aktes — verhaal** (DM) — `.md` inlezen of plakken, `##`-koppen worden sectiekoppen
- [ ] **Aktes — namenrij** (DM) — `[[ ]]` uit de tekst: heeft kaartje / nieuw of terugkerend
- [ ] **Aktes — regie-script** (DM) — stappen beeld/entiteit/encounter/dungeon/rust/brief/loot/kop
- [ ] **Akte-afbeeldingen uploaden** (DM) — vanuit de picker én bij *Nieuwe akte*
- [ ] **Regie-balk** (DM) — akte spelen, stap onthullen, pauze, sheets-herinnering
- [ ] **Verhaalpaneel** (DM) — schuift open, duwt de app opzij, klikken werkt beide kanten op
- [ ] **Gevecht** (DM/TAB) — initiatief, beurten, HP, condities met iconen, canvas op de tablet
- [ ] **Monsters & Encounters** (DM) — statblokken, encounter bouwen, automatisch vullen
- [ ] **Loot** (DM/SP/TAB) — vondsten, DC als aantekening, claimen, afrollen, kist-animatie, mimic
- [ ] **Rust** (DM/SP/TAB) — lange/korte rust, veld vs. herberg, maanfase, d100-gebeurtenis per speler
- [ ] **Hit Dice besteden** (SP) — tijdens korte rust

## Blok 7 — Meesterkamer: sfeer en beheer

- [ ] **Geluiden** (DM/TAB) — bibliotheek, sfeerloops per dienst, emotes, momenten (loot reveal)
- [ ] **Tafels** (DM) — willekeurige tabellen, weighted rijen, valuta-tokens `{+3kn}`
- [ ] **Dobbelstenen** (ALL) — formules, voordeel/nadeel, DM-variant, klikbare dice in teksten
- [ ] **Media** (DM) — bibliotheek, weergavenaam, gebruik live berekend, uploaden via de picker
- [ ] **Berichten** (DM) — bericht of brief sturen, per speler of party, cinematic aanzetten
- [ ] **Instellingen — titel** (DM) — campagnetitel en ondertitel
- [ ] **Instellingen — munten** (DM) — nieuw: namen hernoemen, verhouding blijft 1:10:100
- [ ] **Instellingen — party's** (DM) — aanmaken, hernoemen, wachtwoord, aanwezigheid
- [ ] **Instellingen — modules** (BEHEER) — nieuw: per campagne aan/uit, uit = weg uit beeld
- [ ] **Instellingen — wereld** (DM) — Grisburgh verlaten, winkels die buiten bereikbaar blijven
- [ ] **Instellingen — gedeelde beurs** (DM) — aan/uit, `_effectiveCurrency()`
- [ ] **Campagnes** (BEHEER) — lijst, aanmaken, actieve campagne wisselen
- [ ] **Instellingen — één opslaanknop** (DM) — campagne, munten en beheer in één keer; party's bewaren zichzelf
- [ ] **Instellingen — beheerblok** (DM) — DM-wachtwoord, openingspagina, tafelscherm, campagnes en modules
- [ ] **Electrum & platinum** (DM) — "2 pp" en "3 ep" in prijzen, loot en tabeltokens worden omgerekend
- [ ] **Sheets in de backup** — `<datum>/<campagne>/sheets/<party>.html` naast de datakopie
- [ ] **Campagne aanmaken** (BEHEER) — met DM-wachtwoord in één keer; daarna *Openen* en inloggen
- [ ] **Wachtwoord per campagne** (BEHEER) — veld op het campagnekaartje, slotje verandert mee
- [ ] **Ctrl+S in Instellingen** (DM) — slaat op zolang het paneel in beeld is; Enter in een veld ook

## Blok 8 — Tafelscherm en realtime

`public/js/socket-client.js` · `app.js` (`_isDisplayMode`)

- [ ] **Sfeerscherm** (TAB) — campagnetitel, ondertitel, embers, idle
- [ ] **Beeld tonen** (DM→TAB) — `display:showImage`, effecten
- [ ] **Brief op de tablet** (TAB) — `brief:display`, zegel openen
- [ ] **Loot op de tablet** (TAB) — gesloten kist, filmpje, claims met portretjes
- [ ] **Rust op de tablet** (TAB) — party-brede variant zonder per-speler-knoppen
- [ ] **Gevecht op de tablet** (TAB) — volledige weergave, nooit geminimaliseerd
- [ ] **Live-updates** (ALL) — entiteit, archief, missies, HP, boedel, geld komen binnen zonder herladen
- [ ] **Geluid** (TAB) — sfeerloop wisselt per sectie, emote, reveal-klank
- [ ] **Terug uit tafelscherm** (TAB) — kruisje brengt je terug in je eigen DM-scherm, zonder opnieuw inloggen
- [ ] **Geen dobbelknop op tafel** (TAB) — d20 en het paneel blijven daar verborgen

## Blok 9 — Uitvoer en onderhoud

- [ ] **Character sheets** (DM) — één personage en hele groep, "blad X van Y" klopt met de pdf
- [ ] **Sheets-triggers** (DM) — knop in de Aktes-tabkop, scroll-icoon in de regie-balk, na pauze
- [ ] **Export / campagneboek** (DM) — HTML-snapshot, `lib/snapshot.js`
- [ ] **Tunnel** (DM) — cloudflared-tunnel starten/stoppen, url delen
- [ ] **Backups** — nachtelijke snapshot op de server, ophalen op de laptop, terugzetten van één bestand
- [ ] **Media-opruiming** — ongebruikte bestanden vinden

## Blok 10 — Meerdere campagnes

- [ ] **Isolatie** (BEHEER) — als DM van A niets van B kunnen lezen of schrijven (`tests/campagne-isolatie.test.js`)
- [ ] **Modules** — startset klopt voor een verse campagne; uit = echt weg
- [ ] **Bronteksten** — kale spreuken en features buiten de beheercampagne; eigen tekst blijft
- [ ] **Generiek** — geen Grisburgh-kaart, -munten of -naam in een tweede campagne
- [ ] **Beheer** — `/campaigns` alleen voor de beheerder
- [ ] **Vreemde campagne = bezoeker** (BEHEER) — open `/andere-campagne` als DM: je krijgt haar landingspagina, niet je eigen scherm met haar naam

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
