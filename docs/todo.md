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

- [ ] **Heeft de snapshot nog bestaansrecht?** `lib/snapshot.js` maakt een
      HTML-export van de hele campagne (`/api/export` + `/api/export/campagneboek`).
      Dat komt uit de tijd dat de app niet altijd draaide. Nu hij live is, is de
      vraag wat het nog toevoegt — anders dan de printbare character sheets, die
      wél een eigen reden hebben (papier aan tafel, en de definitieve stand na
      een sessie). Eerst beslissen of we hem houden; pas daarna erin sleutelen.
- [ ] **Lekt het campagneboek geheimen?** De export filtert op `data.geheim`
      (het oude enkelvoudige veld) terwijl de kaartjes allang `data.geheimen`
      als lijst gebruiken, per regel te onthullen. Vermoeden: alle regels gaan
      mee, ook de niet-onthulde. Nakijken zodra we aan de snapshot toekomen —
      en meenemen dat geheime verbindingen daar dezelfde regel moeten volgen
      (`docs/voorstel-geheime-verbindingen.md`).

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

- [ ] **Healen doet nog niets.** Klikken op de genezingsknop in de boedel gooit
      alleen de formule in het dobbelpaneel: er gaat geen HP omhoog en er wordt
      geen charge afgeschreven. Wat het moet worden: rollen, het resultaat bij
      de HP optellen (gemaximeerd op het maximum), en één charge afschrijven als
      het voorwerp die heeft — met een weigering als ze op zijn, plus een
      melding "+7 HP · <voorwerp>". Alleen voor de speler in zijn eigen boedel,
      niet in het archief van de DM.
- [ ] **Verbruikt bij gebruik.** Een Potion of Healing zonder charges is na één
      slok leeg, maar de app kent geen "verdwijnt bij gebruik". Een vinkje bij de
      werking zou de stapel met één laten afnemen. Hoort bij het punt hierboven;
      samen oppakken zodra we bij de boedel zijn. Afgesproken 7 sep 2026.

## Geld en schuld → `docs/voorstel-op-de-pof.md`

Opgepakt zodra we met de **diensten** aan de slag gaan; de winkelkant haken we
daar dan in. (Het eerste punt — diensten die de gedeelde beurs omzeilden — is op
8 sep 2026 al gedaan.)

- [ ] **De rente van de Tweespalt loopt op de kalender.** 30% per dag,
      samengesteld, op echte dagen. De ene openstaande lening in Grisburgh
      (28,80 florinde, aangegaan 26 april) staat daardoor op 5,8 × 10¹⁸
      centeling. Omzetten naar rente per lange rust (`g.rustTellers.long`, sinds
      7 sep beschikbaar) en die ene lening herstellen.
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
