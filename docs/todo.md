# Todo

Eén plek voor wat er nog ligt. Bijgewerkt 4 sep 2026. De uitwerking staat in de
werkdocumenten waar naar verwezen wordt; hier staat alleen wát er ligt en hoe
groot het is.

## Nu aan de beurt

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
- [ ] **8. Mediabudget** — teller per campagne + verkleinen bij upload. Naar voren
      halen als de schijf eerder knelt.
- [ ] **9. Gefaseerd uitrollen** — vlag per campagne, deployvolgorde, en een
      teruggang die geoefend is.

## Scherven (klein, los op te pakken)

- [ ] **`meta.heeren` bestaat niet** — enige dienst zonder configuratieblok, dus
      niet te hernoemen; valt terug op "Dievengilde".
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
- [ ] **Missiegever afleiden uit de missie** — `missie.geverId` erbij, in de
      Missies-tab tonen, en op het kaartje een blokje met de draden die aan deze
      persoon hangen. Dan hoeft niemand een tag bij te houden.
- [ ] **Gevangene als toestand** — `groups[gid].gevangenen[entityId]`, zichtbaar
      in het partytabblad naast de medestanders, met een knop op het kaartje.
- [ ] **Tier-editor**: zeg dat tiers optioneel zijn (een rijdier of summon groeit
      niet mee met het level van zijn baasje).
- [x] **Subtypes opsplitsen** *(5 sep)* — vier subtypes (NPC, speler, dier, god),
      twee rollen als tag (verkoper, antagonist) en een veld *kant in gevecht*.
      33 kaartjes gemigreerd; oude subtypes blijven meetellen via `_heeftRol`.
- [x] **Spreuken koppelen aan de bibliotheek** *(5 sep)* — zoekveld in het
      Spells-paneel, chips met niveau en naam, klikken opent het spreukdetail.
      De losse tekstvelden staan er nog voor wat niet in de bibliotheek zit.
- [ ] **Eigen spreuk kunnen aanmaken** in het spreukentabblad — nodig zodra de
      koppeling er is, want dan kun je een zelfbedachte spreuk nergens meer
      kwijt. Uitzoeken of dat nu al kan.

## Op de telefoon

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

## Afgesproken maar nog niet ingepland

- [ ] **Samenvoegen van party's** — verhuizen laat voorwerpbezit en onthulde
      geheimen achter. Als dit vaker gaat spelen: één actie die de twaalf
      groepsvelden echt omzet, geen losse verhuisknop.
