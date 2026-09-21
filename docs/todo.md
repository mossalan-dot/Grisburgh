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

- [ ] **Effectlaag naar `<body>`** — moet eerst: nu zit `.display-fx` op z-index 5
      binnen het sfeerscherm, terwijl het gevecht er als fixed overlay (55)
      overheen ligt. Zonder dit werkt geen enkel effect tijdens een gevecht — en
      dat is juist waar laag HP ontstaat. Klein werk.
- [ ] **Catalogus + geluid** — dertien effecten, flits vs. toestand, klank vast aan
      het effect (WebAudio, geen bestanden).
- [ ] **Wond-flits automatisch** bij `player:hp-updated`, per campagne aan/uit.
- [ ] Vier openstaande vragen onderaan dat document (welke effecten, auto aan/uit,
      lopen toestanden af, gesynthetiseerd of samples).

## Multi-DM, resterende stappen → `docs/multi-dm-plan.md`

- [ ] **6. Wizard + minicampagne** — campagnenaam → munten → modules → **namen van
      diensten** → kaart → eerste party met wachtwoord → eerste personage.
      Waarschuwen dat party's later niet samen te voegen zijn. Grootste stap.
- [ ] **7. Handleiding + visuele rondleiding** — leunt op stap 6.
- [ ] **Checklist vóór het spelen.** Een nieuwe DM weet niet wat er aan tafel
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
- [x] **Verkleinen bij upload** — gedaan 15 sep 2026. Elk binnenkomend beeld
      wordt WebP (q82, max 2560 px); gif en svg blijven met rust en wat er niet
      kleiner van wordt ook. De bestaande bestanden gaan met
      `scripts/beelden-naar-webp.js`.
- [ ] **8. Mediabudget** — teller per campagne. De helft van dit punt (verkleinen
      bij upload) is gedaan; wat rest is de DM laten zien hoeveel hij gebruikt.
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

- [ ] **De Heeren-dienst opruimen** — de mechaniek is vervallen (klussenbord en
      boetes laten we vallen, 21 sep 2026) en de factie *Heeren van de Nacht*
      staat al in `meta.facties`. Weg kunnen: de negen `/heeren/*`-routes, de
      DM-tab, `#section-heeren`, `HEEREN_*` en `renderHeeren()`. Er is geen
      ingang naartoe, dus niemand raakt iets kwijt.
- [ ] **Facties & Aanzien heeft geen sectienaam** — losse facties wel, de sectie
      niet. Kleinste oplossing: `meta.factiesLabel`.
- [ ] **App-iconen en logo zijn van Grisburgh** — de PWA installeert bij elke
      campagne met hetzelfde wapen. Embleem is al per campagne; de iconen niet.
- [ ] **Oude bestanden op de server** — `/var/www/grisburgh/public/` heeft nog
      losse `app.js`, `theme.css` en `render-relatiemap.js` uit deploys van juni.
      Nergens meer naar gelinkt; opruimen zodra we zeker weten dat niets ze pakt.
- [ ] **Dode code van de previewtoggle** — de knop is uit de balk, `dmToggleClick`
      en `state.dmPreview` staan er nog. Laten staan tot zeker is dat je hem niet
      terugwilt.

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

- [ ] **Een echte reeks stijlen bedenken.** Er waren twee thema's — fantasy en
      Harry Potter — en dat is geen keuze maar een restant van één one-shot. De
      keuzelijst is uit het paneel gehaald (5 sep); nieuwe campagnes krijgen het
      standaardthema, bestaande houden wat ze hebben.
      Denkrichting: **steampunk, sci-fi, noir/detective, gothic horror, mythisch
      Grieks, wildwest, post-apocalyptisch**. Per stijl gaat het om dezelfde
      handvol dingen: een palet (grond, inkt, accent), twee lettertypes (kop en
      broodtekst), de textuur van het papier, en de vorm van randen en zegels.
      De app leest dat al via `data-theme` op de root, dus een stijl is een blok
      CSS-variabelen — geen tweede set componenten. Pas als er drie of vier
      overtuigend staan, hoort de keuze terug in de wizard.

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

- [ ] **Een stabiel id per geheimregel.** `data.geheimen` is een lijst teksten
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
- [ ] **Eén schuldenregister** (`dmState.schulden`) waar de Tweespalt-lening een
      soort van wordt, met een DM-overzicht (wie, bij wie, hoofdsom, wat er nu
      staat) en knoppen om af te betalen — ook deels — of kwijt te schelden. Dat
      overzicht ontbreekt nu helemaal: een schuld die niemand ziet is geen
      verhaallijn.
- [ ] **Op de pof in de winkel.** Per winkel: schrijft aan ja/nee, tot welk
      bedrag, welke rente per lange rust. Bij te weinig geld komt er naast de
      weigering een knop *Op de pof*; de speler krijgt het voorwerp en een
      schuldbrief in zijn boedel. Bij een lange rust meldt een opeisbaar
      geworden schuld zich bij de DM — bij voorkeur als verzegelde brief van de
      schuldeiser (`_bezorgBrief` ligt er al), zodat het aan tafel binnenkomt.
      Wat er daarna gebeurt verzint de DM.
- [ ] **Een winkel heeft geen kas.** Inkopen van de party lukt altijd, hoe duur
      ook: dat geld komt uit het niets. Bewust zo gelaten — de DM beslist aan
      tafel of de handelaar het kan betalen, en een kas die je eerst moet
      bijvullen is meer administratie dan spel. Heroverwegen zodra het krediet
      hierboven er is, want dan wordt "de smid is blut" opeens wél een verhaal.

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
- [ ] ~~**HP uitrollen bij een encounter.**~~ Nu het hp-veld de worp weer bevat
      ("11 (2d8+2)") kan een gevecht per monster rollen in plaats van het
      gemiddelde te nemen. Dat maakt elke ontmoeting net iets anders. Voorstel:
      een vinkje in de encounter-editor (*HP uitrollen*) dat op de encounter
      staat, en `POST /encounters/:id/start` rolt dan per exemplaar — vier
      goblins krijgen dan vier verschillende totalen, wat nu niet kan omdat de
      rij één getal bewaart. Zonder vinkje verandert er niets.

- [x] **Monsters zijn agnostisch gemaakt** (11 sep 2026): `chapter` eruit, de
      koppeling naar `meta.hoofdstukken[key].monsters`, filter leest die lijst
      plus de encounters van die akte. Oorspronkelijke notitie:
- [ ] ~~**Monsters zijn niet agnostisch.**~~ De monster-editor heeft een veld
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

- [ ] **Spreukafbeeldingen meegeven aan een nieuwe campagne.** Grisburgh heeft er
      48 met een focuspunt. Vraag in de aanmaak-wizard: wil je die erbij? Ze zijn
      niet van WotC (eigen beeld), dus delen mag — maar het is wel een keuze, en
      een campagne met een eigen sfeer wil ze misschien niet. Let op de omvang:
      dit zijn bestanden, geen JSON, dus kopiëren of verwijzen is een echte
      afweging.

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