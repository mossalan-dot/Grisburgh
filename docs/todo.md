# Todo

Eén plek voor wat er nog ligt. Bijgewerkt 4 sep 2026. De uitwerking staat in de
werkdocumenten waar naar verwezen wordt; hier staat alleen wát er ligt en hoe
groot het is. Bijgewerkt 15 sep 2026.

## Nu aan de beurt

- [x] **De tekst ís het script** — gedaan 14-15 sep 2026. Schrijfscherm
      (`akte-schrijven.js`) met elf regieblokken, de lade onderin met dezelfde
      renderer en dezelfde knoppen, secties verslepen, een potlood per blok,
      naast elkaar schrijven, plaatshouders vanuit de tekst, geheimen onthullen
      uit de tekst, en "N na te kijken" in de regie-balk. Het blokkerende stuk
      (`GET /meta` stuurde `tekst`/`script`/`monsters` naar elke ingelogde
      speler) is dicht en staat in `tests/akte-regie.test.js`.
      **Wat er aan jouw kant nog ligt:** de vijftien hoofdstukken erin zetten (de
      importer bewaart de `.md` nu wél), de beelden koppelen, en één sectie
      echt spelen om te zien of de knoppen doen wat je aan tafel nodig hebt.

- [x] **De Markt, stap 1 en 2** — gedaan 15 sep 2026: de lijst met winkels,
      zoeken over alle voorraad heen met de prijzen naast elkaar, en filteren op
      gebied (afgeleid uit de `Gebied`-keten op het locatiekaartje). Wat nog
      ligt is **stap 3** (boodschappenlijst met de beurs erbij) en **stap 4**
      (één DM-tabel om voorraad en prijzen bij te stellen).
      Losse vondst om zelf te doen: *Oosterkwartier* en *Het Oude
      Glasblazershuis* hebben **zichzelf** als Gebied, dus die twee winkels
      komen nooit onder Grisburgh uit.

- [x] ~~**De Markt — één plek voor alle winkels**~~ → `docs/voorstel-markt.md`.
      Gevraagd 15 sep 2026. Negen winkels, 122 voorraadregels, en geen enkel
      scherm waar je ziet dát ze bestaan: je moet het kaartje weten te vinden.
      De machinerie (kopen, verkopen, onderhandelen, humeur, rotatie) staat al —
      wat ontbreekt is de ingang. Stap 1 (de lijst) en 2 (zoeken en prijzen
      vergelijken) zijn samen ongeveer een dag. **Valkuil:** `GET
      /shops/:id/beschikbaar` *maakt* de rotatie van een roterende winkel en
      schrijft dm-state; de Markt heeft dus een eigen leesroute nodig.

- [x] **Conditions in het Nederlands** — gedaan 15 sep 2026. Het waren er drie
      lijsten (38 Engels bij de DM, 18 Nederlands bij de speler, 16 in het
      dashboard); nu één bron in `public/js/conditions.js`. Bijvangst: een
      conditie die alleen de DM-lijst kende (Dodging, Half Cover, Raging) kwam
      bij de speler als het kale id in beeld.

- [ ] **Spelerstabbladen natesten** — de reviewrondes van sep 2026 (voorwerpen,
      documenten, spreuken) zijn vooral vanuit de DM getest. Wat aan de
      spelerskant nog langs moet, met een échte spelerssessie:
      · **Spreukenboek** — een spreuk toevoegen uit de bibliotheek bewaart een
        *kopie* van de tekst in `playerSpells`. In een campagne zonder
        bronteksten is dat de SRD-tekst; daar hoort dus ook de bronvermelding te
        staan, en die toont het spreukenboek nu níét. Ook: een spreuk zonder
        tekst — krijgt de speler daar de verwijzing te zien?
      · **Eigen spreuken van de DM** in de spreukenkiezer (nu gerepareerd; nog
        aan tafel controleren).
      · **Boedel** — lexicon-uitleg op het voorwerpblad, damage/healing-pillen.
      · **Documenten als kaartje** — bladwijzer, vaag document (waas + geen
        beschrijving), perkamentweergave en bladeren op een telefoon.
      · **Progressie** — het verwijsblok bij een feature zonder tekst.
      · **Bladwijzers** — de ster klopt meteen na inloggen, ook zonder eerst je
        eigen tabblad te openen.

- [ ] **Testronde afmaken** — blok 1 rest: portretfilmpje bij inzoomen, en of het
      groepswachtwoord in de DM-ingang echt alleen díé party toont. Daarna blok 2
      t/m 10. → `docs/testronde.md`

## Tafelscherm-effecten → `docs/tafelscherm-effecten.md`

- [x] **Effectlaag naar `<body>`** — gedaan 1 okt 2026 (op 99990, niet 90:
      de stapel loopt tot 99999).
      Oud: — moet eerst: nu zit `.display-fx` op z-index 5
      binnen het sfeerscherm, terwijl het gevecht er als fixed overlay (55)
      overheen ligt. Zonder dit werkt geen enkel effect tijdens een gevecht — en
      dat is juist waar laag HP ontstaat. Klein werk.
- [x] **Catalogus + geluid** — gedaan 1 okt 2026: `lib/display-fx.js`, zestien
      effecten, klank gesynthetiseerd met een eigen bestand als overschrijving.
      Oud: — dertien effecten, flits vs. toestand, klank vast aan
      het effect (WebAudio, geen bestanden).
- [x] **Wond-flits automatisch** — gedaan 1 okt 2026, aan één route (`PATCH /player-hp`)
      en standaard uit.
      Oud: bij `player:hp-updated`, per campagne aan/uit.
- [x] Vier openstaande vragen beantwoord (1 okt 2026) in dat document. Oud: (welke effecten, auto aan/uit,
      lopen toestanden af, gesynthetiseerd of samples).

## Multi-DM, resterende stappen → `docs/multi-dm-plan.md`

- [x] **Foutmeldingen** — gedaan 14 okt 2026. Drie wegen naar één boekje
      (`lib/fouten.js`, ringbuffer van 200 in `data/fouten.json`):
      de foutafhandelaar van Express, de vangers in de browser
      (`render-melding.js`) en een uitklapper onderin elk hulpboekje. Ontdubbeld op soort +
      melding + eerste stackregel met een teller; meldingen van mensen juist
      niet, en die staan bovenaan. Alleen campagne-id, route en rol — nooit de
      inhoud van een campagne. Te lezen bij Instellingen → *Wat er misging*
      (alleen beheerder), per stuk weg te strepen.
      Nog open: de cijfers per campagne naast het schijfgebruik dat er al staat.

- [x] **Uitnodigingslink voor een nieuwe DM** — gedaan 14 okt 2026,
      `lib/uitnodigingen.js`. Eenmalig token (alleen de afdruk bewaard), zeven
      dagen geldig, intrekbaar, één open uitnodiging per campagne. Legt een
      nieuwe campagne meteen aan zónder wachtwoord; de genodigde kiest dat zelf
      op een eigen scherm en zit daarna in zijn wizard. Kan niet op een campagne
      die al een DM heeft — dat is een overname, daarvoor is de noodingang.
      Acht tests in `tests/uitnodigingen.test.js`, waaronder: een gewone DM mag
      níét uitnodigen maar wél zijn eigen party's beheren.

- [x] **6. Wizard** — gedaan 2 okt 2026, `public/js/wizard.js`. Zes stappen,
      in de campagne zelf, door de DM van die campagne. Modules zitten er
      bewust níét in: die staan op `requireBeheerder` en horen dus bij wie de
      campagne aanmaakt — zie `docs/beheerder.md`. De minicampagne is
      verschoven naar stap 7, waar hij thuishoort.
- [ ] **7. Handleiding + visuele rondleiding + de minicampagne** — leunt op stap 6,
      die er nu is. De minicampagne hoort hier: hij bestaat om schermafbeeldingen
      te leveren zonder Grisburgh te verklappen.
      - [x] **De handleiding** — gedaan 14 okt 2026, `public/js/render-handleiding.js`.
            Geen tweede tekst: hij leest `_resolveHelp`, dus dezelfde boekjes als
            bij de schermen zelf, inclusief wat een campagne er zelf van maakte.
            Vier hoofdstukken uit de sleutelnaam (meesterkamer, kaartjes,
            instellingen, spelers), 139 boekjes, inhoudsopgave in twee lagen,
            afdrukstijl en een `.md` om te bewaren. Knop aan het eind van de
            wizard en bij Instellingen → Campagne.
      - [ ] **De minicampagne** — nog niet gemaakt; nodig voor de schermafbeeldingen.
      - [ ] **De rondleiding** — doorklikbare pagina met die schermafbeeldingen.
- [x] **Checklist vóór het spelen** — gedaan 14 okt 2026. Een nieuwe DM weet niet wat er aan tafel
      allemaal klaar moet staan, en een ervaren DM vergeet het ene ding dat hij
      deze keer níét standaard had. Een korte lijst die je afvinkt vlak voor je
      een akte start — geen handleiding, een checklist: één scherm, hooguit acht
      regels, en wat de app zelf kan controleren staat er al aangevinkt.

      Wat erin hoort:
      - **Tafelscherm** aan, ingelogd en op tafelstand (`?display=1` of
        Instellingen → Tafelscherm). *De app kan dit zelf zien: een tablet die
        verbonden is zit in de campagne-room.*
      - **Party** — staat de juiste groep actief, en klopt *Actieve spelers*
        (afwezigen uitgevinkt)? Dat stuurt rust, loot en het vullen van een
        gevecht.
      - **Muziek** — Spotify gekoppeld, het juiste apparaat gekozen, en
        **privésessie aan** (of je sfeerlijsten uitgesloten van je smaakprofiel).
        *De koppeling en het apparaat weet de app; de privésessie niet — Spotify
        geeft dat niet vrij, dus dat blijft een handmatig vinkje.*
      - **Geluid uit de goede boxen** — laptop of tafelscherm op de speaker
        gekoppeld, en niet per ongeluk op de ingebouwde luidspreker. Dit is de
        klassieker: alles werkt, maar niemand hoort het.
      - **Bereikbaarheid** — klopt wat er tijdens deze akte open is (diensten,
        kaartjes) en staat *Grisburgh verlaten* goed?
      - **Akte geladen** in de regie-balk, verhaaltekst ernaast open.

      Waar hij hoort: een knop naast *Akte spelen* (de plek waar je de regie-balk
      laadt), en nog een keer in de handleiding van stap 7. Bewaren hoeft niet —
      dit is een lijst om te lezen, geen formulier; alleen wat de app zélf kan
      controleren toont een vinkje.

      **Zo gebouwd.** `GET /api/checklist` (alleen DM) levert wat na te kijken
      valt; `_checklistOpen()` in `dm-panel.js` zet er zeven regels van. Knop in
      de kop van het tabblad Aktes — niet op elke akterij, want het gaat over de
      avond en niet over één akte. Drie merktekens: vinkje (nagekeken en goed),
      kruisje (nagekeken en niet goed), open rondje (alleen jij weet het).
      Tafelschermen worden geteld in de socketroom `_displayRoom`. Het boekje
      `dm_checklist` staat in HELP_CONFIG, dus hij staat vanzelf ook in de
      handleiding.
- [x] **Verkleinen bij upload** — gedaan 15 sep 2026. Elk binnenkomend beeld
      wordt WebP (q82, max 2560 px); gif en svg blijven met rust en wat er niet
      kleiner van wordt ook. De bestaande bestanden gaan met
      `scripts/beelden-naar-webp.js`.
- [x] **8. Mediabudget en het beheerdersoverzicht** — gedaan 6 okt 2026.
      Instellingen → Campagnes toont per campagne schijfgebruik, kaartjes,
      party's, spelers, actieve onderdelen, wanneer er voor het laatst gespeeld
      is, en wat er mis is. Daarmee ook de vraag beantwoord of er een
      `grisburgh.nl/admin` moet komen: nee — het was vijf knoppen, en wat
      ontbrak was zicht, geen tweede site met een tweede inlogdeur.
- [ ] **9. Gefaseerd uitrollen** — vlag per campagne, deployvolgorde, en een
      teruggang die geoefend is.

## In de vriezer — opruimen vanaf 15 oktober 2026

- [ ] **Originelen van de WebP-omzetting weggooien.** Op 15 sep 2026 zijn de
      beelden van **alle drie de campagnes** omgezet naar WebP — Grisburgh
      (2.053 → 208 MB), Test (78 → 8 MB) en prewett (114 → 10 MB). De originelen
      staan een maand in `data/campaigns/<campagne>/files-origineel-2026-09-15/`
      (samen 2,3 GB).
      Ze zitten **niet in de nachtelijke backup** (`files/` zit daar sowieso
      nooit in), dus dit is de enige kopie — vandaar de wachttijd.
      Ziet alles er goed uit, dan:
      ```bash
      ssh root@46.224.156.154 "rm -rf /var/www/grisburgh/data/campaigns/*/files-origineel-2026-09-15"
      ```
      Gecontroleerd op 15 sep: alle 1.252 beelden leesbaar, 0 kapot, 0
      verwijzingen op een kaartje kwijt.

      **Grisburgh is diezelfde dag meegegaan**: 1.122 bestanden, 2.053 → 208 MB;
      `files/` staat nu op 340 MB (de rest is geluid, video en pdf). De
      originelen daarvan (2,1 GB) staan in dezelfde map naast de campagne.

## Metgezellen op de character sheet

Nagekeken 17 sep 2026, naar aanleiding van "bevat de sheet alles?". Het blad is
completer dan gedacht — zegeningen en eden staan er gewoon op, want die zitten in
`playerItems` en komen als boedelregel mee. Wat er **niet** op staat is een
**metgezel**: een geadopteerd dier of een meelopende NPC. Dat is blijvend (anders
dan een buff of een conditie, die bij de eerstvolgende lange rust vervallen — die
horen er dus juist níét op).

**Waarom het nu niet gebouwd is: er is geen data.** Over alle vier de campagnes
samen: **1** metgezel (Pieter Pannenkoek), **0** met een baasje
(`companionOwners` is overal leeg), en de 6 dier-kaartjes in Grisburgh hebben
wel een `stats`-skelet maar **elk veld is leeg**. Een blok bouwen zou vandaag bij
niemand iets afdrukken, uit velden die niemand heeft ingevuld.

**De ontwerpkeuze is al gemaakt, zodat het straks een half uurtje is:**

- Een metgezel hoort op het blad van **zijn baasje** —
  `groups[gid].companionOwners[petId] === charId`. Niet op ieders blad: de lijst
  `groups[gid].companions` is party-breed, en `GET /api/party/sheets` drukt de
  hele groep af; zonder die regel staat hetzelfde dier vier keer in de stapel.
- Een metgezel **zonder baasje** is van de party. Die hoort op geen enkel
  persoonlijk blad; hooguit ooit op een partyblad.
- Toon de **actieve tier**, niet de basis: een dier schaalt mee met het level van
  zijn baasje (`_activeTier()`), dus de cijfers op het blad moeten die van
  vandaag zijn.
- **Klein beginnen:** naam, soort, AC, HP, Speed en één regel aantekening. Genoeg
  om te weten wat er naast je staat.
- **Een volledig statblok is een ander verhaal.** `lib/character-sheet.js` kan
  helemaal geen statblokken; de renderer staat client-side in
  `render-statblock.js`. Dat is dezelfde "één renderer, twee ingangen"-oefening
  als bij de winkelvoorraad (15 sep). Pas doen als iemand écht een dierstatblok
  invult — nu is er niets om te tonen.

**Trigger:** zodra de eerste speler een dier adopteert bij de magizoöloog (dan
wordt `companionOwners` gevuld), is dit het moment.

## Gecodeerde brief → `docs/voorstel-gecodeerde-brief.md`

Een document dat je niet kunt lezen tot het ontcijferd wordt, en dan vliegen
de letters naar hun plek. Bron is het prototype van 2 okt 2026: geen
cijferschrift maar een anagram door verplaatsing, in drie bereiken (per woord,
per regel, hele brief), met een eigen tempo voor het tafelscherm. Het
knelpunt staat in het voorstel: de echte tekst mag er niet staan voordat hij
onthuld is, dus het husselen hoort op de server en de klare tekst komt pas bij
de onthulling mee.

## Houding van personages → `docs/voorstel-houding.md`

De spec staat ernaast als `docs/houding-npc-spec.md`. Eén waarde per personage
(1–5), alleen zichtbaar als een glans of schaduw bij hover, met een insight-DC
en een toast naar de speler die hem haalt. Gemeten op 6 okt 2026: de glans
bestaat al (`card-sheen`), maar loopt eindeloos door en zit op een
`::before` die op personagekaartjes al bezet is. Vijf aannames in de spec
kloppen niet meer met de app; die staan in het voorstel, met de volgorde.

## Nog te verzinnen

- [ ] **Een gerechtshof als dienst.** Uit de Heeren komt één idee dat het waard
      is om te bewaren: een boete die je kunt aanvechten, met een advocaat die
      met je Persuasion-bonus afdingt. Dat hoort niet bij een factie maar bij
      een stadsgezag — vandaar een eigen dienst, aan een organisatie-kaartje
      gehangen. **Incidenteel**: het komt een paar keer per campagne voor, dus
      het mag klein blijven. De oude Heeren-machinerie (klussenbord én boetes)
      is bewust laten vallen, zie `docs/voorstel-facties.md` §5 — de
      klusgenerator hoeft er ook niet uit gered te worden (21 sep 2026).

## Scherven (klein, los op te pakken)

- [ ] **Meenemen & overnemen — één plek voor de hele app.** De knop stond in
      het Heldenboek (een downloadpijl naast de hulpknop) en niemand begreep
      waarom juist dáár. Weggehaald op 6 okt 2026; de machinerie staat er nog
      (`vaardigheden.deelVenster/exporteer/importeer`, `GET
      /progression/export`, `POST /progression/import`, met tests) maar is
      nergens aan te klikken — zie het commentaar bij `deelVenster()`.
      Het probleem is breder dan de progressie: wat een DM zelf intikt bij
      **spreuken, tafels, kaartjes en diensten** zit net zo goed vast in zijn
      campagne. Dat hoort één venster te zijn — "wat neem je mee?" met vinkjes
      per soort — op één plek (Meesterkamer, bij de campagne zelf), niet een
      knop per tabblad. Let op dezelfde grens als nu: zelf verzonnen mag mee,
      overgenomen tekst niet.

- [x] **De Heeren-dienst opruimen** — gedaan 21 sep 2026. Negen routes, de
      DM-tab, `#section-heeren`, `HEEREN_*`, `renderHeeren()` en de tien
      api-wrappers weg; ruim 550 regels. De briefstijl `heeren` (schaduwbrief)
      is blijven staan — dat is opmaak voor brieven die er al liggen.
- [x] **Facties & Aanzien heeft geen sectienaam** — gedaan 24 sep 2026.
      `meta.factiesLabel`, in te stellen in de Facties-tab; zijbalk, sectiekop,
      DM-tab, opslagknop en hulptekst lezen `window._factiesLabel()`. Bijvangst:
      `_dienstNaam('facties')` zocht in `meta.facties` naar een `.naam`, maar dat
      is een **lijst facties** — de zijbalk zei daardoor "Facties" terwijl de
      sectie erboven "Facties & Aanzien" heette.
- [x] **App-iconen en logo zijn van Grisburgh** — gedaan 24 sep 2026.
      `meta.appIcon` (Instellingen → App-icoon, dezelfde mediakiezer als het
      embleem) en een **publieke** route `GET /app-icon-<maat>.png` die hem met
      sharp op 180/192/512 zet — publiek omdat het besturingssysteem de iconen
      ophaalt tijdens het installeren, en dat is geen ingelogde browser. Zonder
      eigen icoon komt het meegeleverde wapen eruit, dus er verandert niets
      zolang niemand er een kiest. Let op: de querystring moet `campagne` heten,
      anders valt `_campagneVan` terug op de **actieve** campagne.
- [x] **Oude bestanden op de server** — gedaan 24 sep 2026. Het waren er meer
      dan drie: ook `css/app.js`, `css/dm-panel.js`, `css/index.html`,
      `js/index.html`, `js/theme.css` en `js/glossary.js` (het bestand dat in
      juni een kapotte checkout maskeerde). Samen 2,8 MB; kopie op de server als
      `/root/grisburgh-public-opruiming-20260924.tar.gz`.
      **Belangrijker was wat het blootlegde:** een ontbrekend `.js` gaf een
      **200 met HTML** terug via de SPA-fallback — precies de stille fout uit
      CLAUDE.md. `server.js` geeft nu 404 voor elk pad met een extensie;
      bewaakt door `tests/frontend-imports.test.js`.
- [x] **De tweede campagnelijst is weg** — opgeruimd 6 okt 2026.
      `_loadAndRenderCampagnes` en `_renderCampagnes` tekenden een campagnelijst
      met een eigen kaartvorm die nergens werd aangeroepen; de tab waar hij in
      hoorde had al geen knop meer. Twee weergaven van hetzelfde lopen uit
      elkaar, en dat gebeurde ook: het beheerdersoverzicht belandde eerst in de
      dode variant. 78 regels JS, een tab-div in de shell en een ongebruikte
      `_INSTELLINGEN_TABS`-set.

- [ ] **Dode code van de previewtoggle** — de knop is uit de balk, `dmToggleClick`
      en `state.dmPreview` staan er nog. Laten staan tot zeker is dat je hem niet
      terugwilt.
      **Bevinding 24 sep 2026:** hij kán niet terugkomen zoals hij was. De
      toggle zet alleen een vlag in de browser, terwijl de **server** op 33
      plekken op `req.role` beslist welke data hij meestuurt. Een "bekijk als
      speler" zou dus spelers-chrome om DM-data heen tekenen — inclusief
      geheimen die de party niet kent. Wil je die stand écht, dan moet het langs
      de server (een tweede sessie of een expliciete preview-rol).

## Personage-kaartje → `docs/personage-kaartje.md`

- [x] **Ras, klasse en alignment als keuzelijst** *(5 sep)* — zoekbaar, met vrije
      invoer; lijsten in `bronnen/volken-klassen.json`.
- [x] **Meerdere geheimen per kaartje** *(5 sep)* — lijst in `data.geheimen`, per
      regel te onthullen, badge toont "1/3".
- [x] **Flavour op dezelfde manier** *(5 sep)* — `data.flavours`, en de herberg
      pikt per avond een regel die nog niet verteld is in plaats van één vlag per
      personage.
- [x] **Missiegever afleiden uit de missie** *(5 sep)* — `geverId` op de missie,
      zoekveld in de missie-editor, naam op het missiekaartje, en een blokje
      *Missies* op het personage- of organisatiekaartje.
- [ ] **Gevangene als toestand** — `groups[gid].gevangenen[entityId]`, zichtbaar
      in het partytabblad naast de medestanders, met een knop op het kaartje.
      **Oppakken wanneer we de partytab doen**, want daar willen we toch al
      portretjes van medestanders laten zien.
- [ ] **Tier-editor**: zeg dat tiers optioneel zijn (een rijdier of summon groeit
      niet mee met het level van zijn baasje).
- [x] **Subtypes opsplitsen** *(5 sep)* — vier subtypes (NPC, speler, dier, god),
      twee rollen als tag (verkoper, antagonist) en een veld *kant in gevecht*.
      33 kaartjes gemigreerd; oude subtypes blijven meetellen via `_heeftRol`.
- [x] **Spreuken koppelen aan de bibliotheek** *(5 sep)* — zoekveld in het
      Spells-paneel, chips met niveau en naam, klikken opent het spreukdetail.
      De losse tekstvelden staan er nog voor wat niet in de bibliotheek zit.
- [x] **Eigen spreuk kunnen aanmaken** in het spreukentabblad — kan sinds de
      +-knop naast het boekje; sinds 11 sep 2026 met een herkomstveld erbij.

## Vegen en pijltjes: één manier om door een rij te bladeren

Gevraagd op 14 sep 2026, gebouwd op 14 sep 2026.

- [x] **Eén hulpje voor alles** — `window._veegNavigatie(el, {vorige, volgende,
      toetsen})` in `app.js`: ≥ 60 px opzij, < 45 px op of neer, negeert gebaren
      die beginnen in iets dat zélf horizontaal schuift of in een invoerveld, en
      hangt ← en → aan `document` zolang het element openstaat.
- [x] **Detailvenster van een kaartje** — buren in de lijst zoals je hem nú
      gefilterd ziet; `window._bladerBron` laat een ander scherm (bestiarium)
      dezelfde rij leveren. Bladeren en de terugknop sluiten elkaar uit: zolang
      `_modalHistory` gevuld is bladert er niets.
- [x] **Spreukdetail**, **subtabbladen van de speler**, **beeldcarrousel**,
      **lightbox** (behalve ingezoomd — dan is slepen pannen), **bladeren door
      een brief** en het **hulpvenster** met meerdere stappen.
- [x] **Missiebord op een telefoon** — `.prikbord[data-kolom]` met een media-query
      op 760 px: één kolom tegelijk, statusnamen als strip erboven.
- [x] **Waar we het níét doen** — de wereldkaart en de dungeonkaart, het tekenen
      van kamers, en elk veld waar je in typt of schuift.

- [ ] **Bijwerking: ← en → in het archiefraster zelf** (zonder venster) — selectie
      verplaatsen en Enter opent. Blijft liggen: het bladeren ín het venster
      staat er nu, en twee toetsmodellen door elkaar is erger dan één.

## Op de telefoon

- [x] **Het missiebord heeft geen telefoonweergave** — opgelost 14 sep 2026: één
      kolom tegelijk onder 760 px, met de statusnamen als strip erboven en vegen
      ertussen.

- [ ] **"Aangevraagd" zegt niet wie het vroeg.** De kolom is de wachtrij van
      spelersaanvragen (Facties → *Missie aanvragen*), maar op het kaartje staat
      geen naam: `questStates[questId]` bewaart alleen de status, en wie het
      vroeg gaat alleen als socket-melding langs. Het label zegt nu *Aangevraagd
      door een party* met uitleg in de tooltip; de naam erbij vraagt een
      datawijziging (`{ status, door, opTijd }`) en is dat op zichzelf misschien
      waard zodra er meerdere party's tegelijk spelen.

- [ ] **Alles nog eens doorlopen op een telefoon.** De app wordt aan tafel op
      laptops en een tablet gebruikt, dus daar is hij op gebouwd — maar spelers
      pakken hun telefoon. Wat er tot nu toe uitkwam: de partypijl hing halverwege
      een gestapelde rij portretten, er was geen teken dat je verder kon scrollen,
      en het DM-wachtwoordveld liep over het wapen heen (alle drie gefikst 5 sep).
      Dat is precies het soort ding dat je alleen ziet door het vast te houden.
      Loop de blokken uit `testronde.md` daarom nog een keer door op een telefoon
      — in elk geval blok 1 (binnenkomen), 4 (spelerstabblad) en 5 (diensten),
      want dat is wat een speler daadwerkelijk in zijn hand heeft.

## Wat alleen de beheerder mag

- [ ] **Helpteksten vastzetten.** `PUT/DELETE /help-content/:key` staat op
      `requireDM`, dus elke DM kan de uitleg in zijn eigen campagne herschrijven.
      Ze staan per campagne in `dm-state.json` (`helpContent`), dus hij verpest er
      niets van een ander — maar het is wél de uitleg die wij schrijven om de app
      te leren kennen, en die hoort niet half overschreven te raken. Zet die twee
      routes op `requireBeheerder` en laat de bewerkknop bij een andere DM weg.
      Denk daarbij aan de vervolgvraag: wil een tweede DM straks tóch eigen
      uitleg (zijn eigen huisregels), dan is dat een aparte laag bovenop de onze,
      geen vervanging ervan.

## Stijlen per campagne

- [ ] **Een echte reeks stijlen bedenken** → `docs/stijlen-per-campagne.md`
      (gemeten 1 okt 2026, bewust voor later). Denkrichting: **steampunk,
      sci-fi, noir/detective, gothic horror, mythisch Grieks, wildwest,
      post-apocalyptisch**.
      **De oude aanname hier — "een stijl is een blok CSS-variabelen" — klopt
      niet**, en dat is nu gemeten: 7.200 harde kleuren tegenover 609 keer
      `var()`, 31 variabelen, en het bestaande `hp`-thema werkt via 120 losse
      overschrijvingen. Het goede nieuws: die 995 unieke kleuren zijn maar
      **124 families**, en de top-30 dekt 88 % — het is dus ongeveer dertig
      beslissingen, geen duizend. Eén opruimdag maakt de aanname alsnog waar.
      En een thema is méér dan kleur: oppervlak en textuur, de vorm van hoeken,
      vier lettertyperollen, een afwijkingenlijst van tien iconen (niet 127),
      de tafelscherm-effecten en de ornamenten. Volgorde en valkuilen staan in
      het werkdocument.

- [ ] **Beelden die in het papier uitlopen** (optie, 1 okt 2026). Naar aanleiding
      van [Homebrewery](https://homebrewery.naturalcrit.com), dat D&D-boeken
      nabootst. De broncode erbij gehaald, want de beschrijvingen op het web
      kloppen niet: er zit géén `filter: blur()` in. Het is puur `mask-image`
      met een PNG die een zachte of gescheurde alfa-rand heeft, plus
      `--offsetX/--offsetY/--rotation` om het masker te verschuiven
      (`themes/V3/Blank/style.less`, 37 hoek-, 8 rand- en 16 centrummaskers).
      Voor ons interessant omdat onze Midjourney-beelden nu vierkant op een
      pagina staan die nergens anders recht is: kaartportretten en
      akte-achtergronden zouden in het perkament kunnen uitlopen. Valt netjes
      terug — zonder maskerondersteuning staat de rechthoek er gewoon.
      **Niet hun PNG's overnemen** (MIT-code, maar de maskers zijn aangeleverde
      assets met een eigen herkomst): zelf maken met een inline SVG
      (`feTurbulence` + `feDisplacementMap` over een alfaverloop), dan is er
      niets te downloaden en kan elke kaart een eigen seed krijgen.
      **Eerst meten** bij de bewegende portretten: een masker over een `<video>`
      is op een telefoon duurder dan over een afbeelding. De rest van
      Homebrewery gaat over gedrukte A4-pagina's en is voor ons niet bruikbaar.
      Proef: de portretten in de kop van een detailvenster, waar het verschil
      het grootst is.

- [ ] **Zelf een dungeon tekenen** (optie, uitgezocht 1 okt 2026). Nu laad je een
      verrijkte kaart als afbeelding en plot je daar kamers overheen voor de
      mist. Dat blijft; de vraag was of er daarnáást een eigen editor kan met
      stijlpresets en een D&D-grid.
      **Het meeste staat er al.** `render-dungeon.js` kent kamers als vector
      (`shape: rect | ovaal | poly`, `points`), mist per kamer per party,
      verbindingslijnen, conditie-iconen, verdiepingen (`gebouwId`), en loot en
      gevechten die aan een kamer hangen (`dungeonId`/`roomId`). Een getekende
      dungeon is dezelfde kaart met een getekende ondergrond in plaats van een
      geüploade: `fileId` is al optioneel op `POST /dungeons`.
      **Wat ontbreekt**, in volgorde van gewicht:
      1. **Een coördinatenstelsel dat een grid aankan.** `points` staat in
         *procenten van de afbeelding*. Eén vakje is dan 2,5% van een kaart van
         veertig breed, en een kamer die je op 2,47% tekent ligt scheef. Een
         getekende dungeon hoort in **hele vakjes** te rekenen. Dit is de
         ontwerpkeuze die eerst gemaakt moet worden: een tweede stelsel naast
         het bestaande, of alles omzetten.
      2. **Het vakje moet 5 voet zijn**, anders kun je er geen beweging op
         aflezen — en dat is het halve nut van een grid aan tafel.
      3. **Vastklikken tijdens het tekenen** op datzelfde raster.
      4. **Stijlpresets**: vloerkleur, muurlijn, arcering. Alles is al SVG, dus
         een preset is een handvol variabelen en één `<pattern>` — dezelfde
         aanpak als de campagnestijlen hierboven, en dus werk dat twee keer
         rendeert.
      5. **Deuren als ding** tussen twee kamers, nu een lijn.
      Schatting: een dag voor grid + getekende ondergrond + één stijl, een
      tweede voor presets en deuren. Niets ervan raakt de bestaande kaarten
      zolang een getekende dungeon een eigen soort is.

- [ ] **Scripts laten hun backup in `backups/` leggen.** `scripts/backups-opruimen.js`
      ruimt de rommel op (en deed dat op 1 okt 2026: 72 bestanden, 19 MB), maar
      de oorzaak blijft: elke migratie en elk eenmalig script legt zijn kopie in
      de wortel van de campagne, met een eigen naamgeving. Zes conventies voor
      hetzelfde ding. Een gedeelde helper — `backupNaast(bestand, label)` die in
      `backups/` schrijft met het stempel dat `writeJSON` ook gebruikt — maakt
      het opruimscript op termijn overbodig. Klein werk; het wachten is op een
      moment waarop er toch aan die scripts gezeten wordt.

- [ ] **De archieftab, vervolgstappen** (begonnen 1 okt 2026). De band met
      klassen, volken, achtergronden en subklassen staat; wat er nog ligt:
      1. [x] Overzichtskaartje per klasse — gedaan 1 okt 2026. Zonder saves en
         proficiencies: die staan in geen bestand dat we mogen gebruiken.
      2. [x] Hetzelfde voor een subklasse, met het veld uit
         `docs/subklasse-velden.md` erbij. Gedaan 1 okt 2026.
      3. [x] **De omgekeerde index** — gedaan 1 okt 2026, in drie regels op het
         klassekaartje: *Aangewezen* (de DM vinkt de klassen aan bij een feat),
         *Via de eis* (de feat draagt "Medium armor training", en welke klassen
         dat geven weet `klasse-basis.json` — dat rekent zichzelf uit), en
         *Genoemd* (de feattekst noemt de klasse). Met eronder hoeveel feats er
         niet bekeken konden worden, want van 58 van de 67 hebben we geen tekst.
         Wat nog open ligt: de derde koppeling die we bespraken — een feat die
         een **spreuk** geeft die op jouw lijst staat. Daarvoor moet een feat
         weten wélke spreuk hij geeft, en dat staat nergens; het vraagt een
         derde veld ("geeft spreuk") of een scan over de spreuknamen in de
         feattekst, en die tekst is er meestal niet. Pas zinvol als de
         feattekstem gevuld raken.
      4. [x] **Spreuken erbij** — gedaan 1 okt 2026: hoeveel spreuken er op de
         lijst staan (geteld uit `spells-2024.json`), hoe de tellers meegroeien
         van 1 naar 20, en een knop naar de bibliotheek met de zeef al goed.
         Daarmee is dit rijtje af.

      5. [x] De koppeling **andersom** op het kaartje van een feat — gedaan.
      6. [x] Een kaartje voor een **volk** en een **achtergrond** — gedaan.
      7. [x] De feat-koppelingen ingevuld: **60 van de 63**. Over: Mounted
         Combatant, Skulker en Weapon Master; die weet ik niet zeker genoeg.

      **Daarmee is dit tabblad af.** Wat er in de toekomst nog bij zou kunnen:
      - Een kaartje voor een **subklasse-veld** koppelen aan zijn uitleg (nu
        staat er alleen de naam van de feature die een eigen teller krijgt).
      - De **39 subklassen zonder tekst** vullen — handwerk voor de DM, maar de
        app wijst er nu wel naartoe. Zie `docs/subklasse-velden.md`.
      - [x] De **feat-koppelingen worden meegeleverd** (1 okt 2026,
        `bronnen/feat-koppelingen.json`) in plaats van per campagne ingetikt.
        Wat de DM zelf invult wint ervan.
      - Hetzelfde zou kunnen voor **ingetikte subklasseteksten**, maar dat kán
        niet: die komen uit het Player's Handbook. Wat wél kan is een
        **exportknop** bij de progressie-editor, zodat een DM zijn eigen
        invoer met een andere DM kan delen zonder dat wij hem meeleveren.

## Setup-wizard voor een nieuwe DM

- [ ] **De keuzes die een campagne bepalen, één keer langslopen.** Ze staan nu
      verspreid bij Instellingen, waar een nieuwe DM ze moet vinden. De wizard is
      de plek waar hij ze één keer beantwoordt en daarna nooit meer hoeft te
      zoeken. Wat er in elk geval in hoort, met de huidige standaard erbij:
      - Titel, ondertitel, embleem en app-icoon.
      - Munten: hoe heten gold, silver en copper hier? (Gold/Silver/Copper)
      - Level omhoog: milestone of XP, hoe de HP erbij komt, hoogste level.
        (milestone, gemiddelde, 20)
      - **In het gevecht: wat zien spelers van andermans HP?** binair / staat /
        volledig. (staat — een balk en een woord) AC en statblock lopen altijd
        via het bestiarium; dat is geen keuze en hoeft dus niet gevraagd.
      - Welke modules aan? (de `startset` uit `lib/modules.js`)
      - Thema, zodra er meer dan één is — zie hierboven.
      Elke nieuwe instelling die een **speelstijl** vastlegt hoort hier een regel
      te krijgen op het moment dat hij gebouwd wordt, niet achteraf; zie
      *Wat betekent deze functie voor een andere DM?* in CLAUDE.md.

## Helpteksten

- [ ] **Een gouden standaard schrijven.** Elke DM mag de uitleg in zijn campagne
      aanpassen (potlood in het uitlegvenster), en met de resetknop bij
      Instellingen → Beheer komt de meegeleverde tekst terug. Die meegeleverde
      tekst is nu gegroeid met de app mee en spreekt niet overal dezelfde taal:
      soms een rondleiding in stappen, soms één alinea, soms met plaatje en soms
      zonder. Nodig: één vorm (wat is het, wat kun je ermee, waar klik je), één
      toon, en per sectie evenveel stappen. Dat is meteen de basis voor de
      wizard voor een nieuwe DM.

## Campagneboek en snapshot

- [ ] **Snapshot eruit?** `lib/snapshot.js` maakt een HTML-export van de hele
      campagne (`/api/export` + `/api/export/campagneboek`), uit de tijd dat de
      app niet altijd draaide. Op 15 sep 2026 zei de DM: *"ik vind die snapshot
      niet zo boeiend meer met een live app"* — dus de vraag is niet meer óf we
      hem houden maar wanneer hij weg mag. Wat er dan mee weggaat: 1.700 regels
      `lib/snapshot.js`, twee routes, de knoppen in Instellingen, en
      `tests/export-geheimen.test.js`. Het **campagneboek** (de gedrukte vorm,
      met inhoudsopgave) is een ander ding dan de snapshot en is misschien wél
      het bewaren waard; beslis die twee apart. De printbare character sheets
      staan hier los van en blijven.
- [x] **Lekt het campagneboek geheimen?** — nagekeken 15 sep 2026. Het
      **campagneboek** niet (dat rendert alleen HTML), de **snapshot** wél en
      erger dan gedacht: die plakt zijn datamodel als JSON in het bestand, dus
      alles wat de filter laat staan is leesbaar in een teksteditor. 40 van de
      41 geheimregels gingen mee, plus de antagonist-vlaggen, de DM-
      aantekeningen en de 619 stappen van het regie-script. Beide exports
      gebruiken nu `filterEntityForPlayer` uit `routes/api.js` — dezelfde filter
      als de app, inclusief de geheime verbindingen. `tests/export-geheimen.test.js`.

## Geheimen

- [x] **Een stabiel id per geheimregel.** — gedaan; `scripts/geheim-ids.js` is gedraaid, in Grisburgh dragen alle 46 geheimregels een id en nul niet.
      Oorspronkelijke notitie: `data.geheimen` is een lijst teksten
      en alles wat ernaar wijst doet dat op positie: de onthulstand per party
      (`secretReveals`), de antagonist-vlaggen en sinds 8 sep de geheime
      verbindingen. Bij het opslaan worden die verwijzingen nu meeverschoven
      (`_geheimKaart`), wat delete, verslepen en bijschaven opvangt — maar het
      blijft raden op basis van tekst. Met `{ id, tekst }` per regel is het
      exact. Kost een migratie van `geheimen`, `geheimenAntagonist` en
      `secretReveals` in alle campagnes; daarom nu de goedkope reparatie en dit
      voor later.

## Boedel

- [x] **Healen doet nog niets** — gedaan 14 sep 2026. `POST /items/:id/gebruik`
      rolt, telt op tot het maximum, schrijft een charge af en laat een eenmalig
      drankje van de stapel verdwijnen; de melding zegt "+7 HP · <voorwerp>".
      Let op: in Grisburgh heeft momenteel **geen enkel** voorwerp een
      genezingsformule, dus de knop verschijnt pas als er een ingevuld wordt.

      *Zoals het er stond:*
- [x] ~~**Healen doet nog niets.**~~ Klikken op de genezingsknop in de boedel gooit
      alleen de formule in het dobbelpaneel: er gaat geen HP omhoog en er wordt
      geen charge afgeschreven. Wat het moet worden: rollen, het resultaat bij
      de HP optellen (gemaximeerd op het maximum), en één charge afschrijven als
      het voorwerp die heeft — met een weigering als ze op zijn, plus een
      melding "+7 HP · <voorwerp>". Alleen voor de speler in zijn eigen boedel,
      niet in het archief van de DM.
- [x] **Verbruikt bij gebruik** — gedaan 14 sep 2026, als vinkje *Verdwijnt bij
      gebruik* bij de werking healing. Doet niets zodra het voorwerp charges
      heeft: dan raak je een charge kwijt, geen exemplaar.

      *Zoals het er stond:*
- [x] ~~**Verbruikt bij gebruik.**~~ Een Potion of Healing zonder charges is na één
      slok leeg, maar de app kent geen "verdwijnt bij gebruik". Een vinkje bij de
      werking zou de stapel met één laten afnemen. Hoort bij het punt hierboven;
      samen oppakken zodra we bij de boedel zijn. Afgesproken 7 sep 2026.

## Geld en schuld → `docs/voorstel-op-de-pof.md`

Opgepakt zodra we met de **diensten** aan de slag gaan; de winkelkant haken we
daar dan in. (Het eerste punt — diensten die de gedeelde beurs omzeilden — is op
8 sep 2026 al gedaan.)

- [x] **De rente van de Tweespalt loopt op de kalender** — opgelost 15 sep 2026.
      Rente per lange rust (`g.rustTellers.long`), met een plafond van vijf keer
      de hoofdsom; één plek rekent het uit (`_tsSchuld`). De lening stond op
      4,5 × 10¹⁹ centeling en staat weer op zijn hoofdsom van 2.880 cl.
      **Twee dingen kwamen daarbij boven:** die lening staat op naam van
      `e_1777039913779_c0ud`, een personage dat **niet meer bestaat** in
      `entities.json` — een weesschuld, die ik heb laten staan omdat weggooien
      een keuze van de DM is. En er is **geen route om af te lossen**: de enige
      uitweg is dat de DM het schuldbewijs uit de boedel haalt. Hoort bij
      `docs/voorstel-op-de-pof.md`.
- [x] **Eén schuldenregister** — gedaan 1-2 okt 2026, en uitgegroeid tot een
      eigen dienst: **de Woekeraar**. Zie `docs/voorstel-woekeraar.md`. Register,
      aflossen (ook deels), kwijtschelden, lenen via een verzoek aan de DM, drie
      escalatietrappen, de renown-afspraak, en een instelscherm.
- [x] **Het gokhuis leent ook via de DM** — opgelost 2 okt 2026. `/tweespalt/leen`
      maakt nu hetzelfde verzoek als de woekeraar, met `bron: 'gokhuis'`. Eén
      geldschieter, één regel.
- [x] **Op de pof in de winkel** — anders opgelost dan hier bedacht, en beter:
      geen winkel die aanschrijft, maar de **woekeraar die opduikt** op het
      moment dat je iets wilt wat je niet kunt betalen. Eén geldschieter, één
      mechaniek, één register — in plaats van per dienst een eigen soort schuld.
      Niet bij de herberg (daar gaat het om een bed en een biertje) en niet bij
      de tempel (lenen om een zegen te kopen voelt blasfemisch).
- [x] **Een winkel heeft een kas** — gedaan 2 okt 2026, en inderdaad pas zinvol
      nu er geleend kan worden. Per winkel een bedrag per lange rust
      (`winkelConfig.kasPerRust`; 0 = onbeperkt, dus bestaande winkels
      veranderen niet). Is de kas op, dan weigert de app met wat er nog in zit
      en vraagt of de DM er toch doorheen wil — hij beslist, de app rekent voor.

## Afgesproken maar nog niet ingepland

- [ ] **Samenvoegen van party's** — verhuizen laat voorwerpbezit en onthulde
      geheimen achter. Als dit vaker gaat spelen: één actie die de twaalf
      groepsvelden echt omzet, geen losse verhuisknop.

- [ ] **Voorwerp-werking koppelen aan de stats van een speler** — stap 3 uit
      `docs/voorstel-voorwerp-werking.md`: een vrij bonus-vinkje
      (ability/skill/save + waarde) voor dingen als Gauntlets of Ogre Power of
      een Cloak of Protection, en dat laten doorwerken in het character sheet.
      Stap 1 (werking los van type) en stap 2 (spells koppelen i.p.v. kopiëren)
      zijn goedgekeurd op 7 sep 2026; dit derde stuk is bewust uitgesteld tot
      die twee staan — het is de vaagste categorie en raakt als enige de
      berekeningen op het blad.

- [x] **Standaard-statblokken voor NPC's (presets).** Gedaan op 8 sep 2026: de
      SRD 5.2 wordt meegeleverd (`bronnen/srd-monsters.json`, 331 wezens waarvan
      26 generieke NPC's) en vult een kaartje, een tier of een monster. De acht overgebleven
      losse bibliotheekmonsters zijn nagelopen: het bleken geen wegwerpregels
      maar troepen met een campagnenaam, waarvan er vijf in encounters zitten.
      Ze zijn dus blijven staan; wat wél weg moest was de rommel van de oude
      importer (zie `scripts/monster-opschonen.js`).


- [x] **Twee vragen uit het opschonen — beantwoord 9 sep 2026.**
      **Xerxes en Sarabi** stond op `maxHp 4` bij een worp van `4d10+4`; dat is
      nu het gemiddelde, 26 (`26 (4d10+4)`).
      **Kaptein Haringh** houdt bewust hetzelfde statblok als de
      Wervelingbootsman — dat is als preset hergebruikt, geen slordigheid. Net
      als Maenfortmatroos = Wervelingpiraat. `monster-opschonen.js` blijft ze
      melden; dat is een signaal, geen fout.

- [ ] **Roos?** — een volledig uitgewerkt spellcaster-statblok in de
      monsterbibliotheek, met een vraagteken in de naam, zonder kaartje, zonder
      beschrijving en zonder encounter. Ofwel er hoort een personage-kaartje bij
      (zoals de elf andere NPC's er een kregen), ofwel het is een restant.


## Uit de sessie van 8-9 sep 2026 — nog te doen

- [x] **HP uitrollen bij een encounter** — gedaan 11 sep 2026, per monsterregel
      en per exemplaar. Oorspronkelijke notitie:
- [x] ~~**HP uitrollen bij een encounter.**~~ Nu het hp-veld de worp weer bevat
      ("11 (2d8+2)") kan een gevecht per monster rollen in plaats van het
      gemiddelde te nemen. Dat maakt elke ontmoeting net iets anders. Voorstel:
      een vinkje in de encounter-editor (*HP uitrollen*) dat op de encounter
      staat, en `POST /encounters/:id/start` rolt dan per exemplaar — vier
      goblins krijgen dan vier verschillende totalen, wat nu niet kan omdat de
      rij één getal bewaart. Zonder vinkje verandert er niets.

- [x] **Monsters zijn agnostisch gemaakt** (11 sep 2026): `chapter` eruit, de
      koppeling naar `meta.hoofdstukken[key].monsters`, filter leest die lijst
      plus de encounters van die akte. Oorspronkelijke notitie:
- [x] ~~**Monsters zijn niet agnostisch.**~~ De monster-editor heeft een veld
      *Akte*, precies wat we bij documenten hebben weggehaald ("Kaartjes zijn
      agnostisch"). Het veld is nu verborgen in het bestiarium-venster, maar
      staat nog in de Meesterkamer omdat de aktefilter in de monsterlijst erop
      leunt. Echte oplossing: `chapter` eruit, filter vervangen door de
      encounters die naar dat monster wijzen.

- [x] **Documenten: uitleg naar de knoppenbalk + WYSIWYG-tabblad** — gedaan
      11 sep 2026. Titel en Ondertekening zijn knoppen geworden, en boven het
      tekstvak staan twee tabbladen (*Schrijven* / *Zoals de speler het ziet*).

- [x] **Statblokvelden hebben een knoppenbalk** — gedaan 11 sep 2026, inclusief
      een `Naam.`-knop voor de `***Bite.***`-vorm en een voorbeeld dat de
      statblok-render gebruikt. De monster-editor in de Meesterkamer had er als
      enige nog geen.

- [x] **Spreuken: het is geen naslagwerk meer** — gedaan 11 sep 2026. De
      ondertitel, de hulptekst en de hulp bij het spreukenboek zeggen nu dat de
      bibliotheek ook bevat wat de campagne zelf verzon. Er is een veld
      **Herkomst** bij (zelf verzonnen / aangepast / overgenomen), dat als tag
      op het kaartje staat — een aantekening, geen slot, maar wél de plek waar
      straks staat wat je niet mag doorgeven.

- [x] **Blanco kaartjes** — opgelost 11 sep 2026. Het lag niet aan de maat maar
      aan `_beeld`: dat vroeg "bestaat er een bestand met dit id?", en bij een
      document is dat vaak een pdf of mp3. Nu `storage.bestandIsBeeld()`.

- [x] **Testomgeving gevuld** (11 sep 2026): één document per briefstijl, een
      stijl-override, een vaag document, een pdf-scan, een geluidsfragment, een
      personage met filmpje, een locatie met gevel en een Armor met alle
      mechanische velden. Zie de sectie *Testomgeving* in CLAUDE.md.

- [x] **Voorwerp-detail: leeg valutaveld — opgelost 9 sep 2026.** Het was geen
      weergavefout: *Kroon van Vlas* in de testomgeving had letterlijk
      `prijs: "—"` opgeslagen. De waarde is leeggemaakt, en het detailvenster
      leest een los streepje voortaan als "geen prijs" — anders staat er een
      muntje met een liggend streepje ernaast.

- [x] **Spreukafbeeldingen meegeven aan een nieuwe campagne** — gedaan 2 okt
      2026 als stap in de opstartwizard, en terug te vinden bij Instellingen →
      Campagne. Kopiëren dus, niet verwijzen; het vult alleen aan en
      overschrijft nooit.

- [x] **Een spreuk in je boek hoort langs de DM** — gedaan 11 sep 2026.
      Verzoek in `groups[gid].spellRequests`, balk bovenin het spreukentabblad met
      de voorrekening ernaast, bericht terug via `_meldVerzoekAntwoord`. Geen
      automatische weigering; hieronder stond al waarom, en dat blijft gelden.

      *Zoals het er stond:* Vanuit het spreukentabblad zet
      een speler nu rechtstreeks een spreuk in zijn boek: `POST
      /player-spells/:characterId` laat het toe zodra het zijn eigen personage
      is (`render-spreuken.js` → `addToBook`). Bij een **voorwerp** gaat dat
      juist wél langs de DM (`itemRequests`, met goedkeuren/afwijzen en sinds
      11 sep een bericht terug). Dat verschil is niet bedoeld: het spreukenboek
      is net zo goed administratie waar de DM over gaat.
      Werk: hetzelfde patroon als bij voorwerpen — een verzoek in
      `groups[gid].spellRequests`, een rij in het DM-paneel, en `_meldVerzoek-
      Antwoord` hergebruiken voor het bericht terug.

      **Automatisch afwijzen: niet doen — wél voorrekenen.** De verleiding is om
      op class en level te toetsen, maar de uitzonderingen zijn in 5e eerder
      regel dan uitzondering: multiclass (twee lijsten, één slottabel), feats
      als Magic Initiate, Fey Touched en Ritual Caster, uitgebreide
      subklasselijsten (domein, patroon, Arcane Trickster, Eldritch Knight),
      een Wizard die uit een scroll overschrijft, en de eigen klassen en
      `eigenSpreuken` van deze campagne — waar "de juiste class" is wat de DM
      besloot. Een harde weigering zou vaak genoeg fout zitten dat je hem gaat
      wantrouwen, en dan is hij erger dan niets.
      Voorstel: **de app rekent voor, de DM beslist** — dezelfde regel als bij
      de loot-DC ("de DC is een aantekening, geen mechaniek"). Naast het verzoek
      staat dan: *"Wizard 7 · Fireball is Level 3 · staat op de Wizard-lijst"*
      of *"staat niet op de Wizard-lijst — wel te verklaren via Magic Initiate
      of een scroll"*. Eén klik, met de reden ernaast.

- [ ] **Echte WYSIWYG in de tekstvelden?** Gevraagd op 11 sep 2026. Voor nu
      opgelost met een **oogje** op de opmaakbalk (kijkstand) plus Ctrl+B/I/U.
      Een echte rich-text editor blijft mogelijk, maar het is geen middagwerk:
      de markdown is het opgeslagen formaat en wordt door zeven renderers
      gelezen (twee op de server), dus een contenteditable moet bij élke
      opslagbeurt het hele dialect lossless terugvertalen — inclusief
      `[[wikilinks]]`, `{kleur:tekst}` en `^smallcaps^`. De faalstand is stille
      tekstvervuiling, en dat is precies wat je in een campagne niet wilt.
      Als het er ooit komt: eerst een round-trip-test over álle bestaande
      teksten (parse → serialiseer → vergelijk), vóór er ook maar iets
      opgeslagen wordt.