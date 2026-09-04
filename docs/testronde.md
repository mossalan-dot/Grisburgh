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
- [ ] **Landingspagina** (ALL) — portretten van de party's, carousel, inzoomen op een portret *(titel, embleem en portretten per campagne: gefikst 4 sep)*
- [ ] **Portretfilmpje bij inzoomen** (ALL) — speelt af, stopt na 6 seconden (`LANDING_VIDEO_MAX_SEC`)
- [ ] **Eén wachtwoordveld** — groepswachtwoord → alleen díé party in de kiezer; DM-wachtwoord → meteen DM
- [ ] **Personagekiezer** — de speler kiest zijn personage, wachtwoord wordt onthouden
- [ ] **DM-wachtwoord wijzigen** (DM) — Instellingen → *Jouw DM-wachtwoord*; oude werkt daarna niet meer
- [ ] **Groepswachtwoorden** (DM) — Instellingen → Party's, slotje toont of er één staat
- [ ] **Tafelscherm aanzetten** (DM) — Instellingen → Tafelscherm; dít scherm wordt de tablet
- [x] **Uitloggen als speler** (SP) — knop rechtsboven vraagt eerst, met de naam van je personage *(gebouwd 4 sep)*
- [ ] **Uitloggen + sessie overleeft herstart** — na `pm2 restart` blijft iedereen ingelogd
- [ ] **Campagnepad** — `/grisburgh` en `/prewett`; kaal domein stuurt door, `?display=1` blijft werken
- [ ] **PWA** — installeren op beginscherm, naam en startpad kloppen per campagne

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
