# Grisburgh voor meerdere DM's — werkdocument

Status: **stap 1 t/m 6 af.** Bijgewerkt 2 okt 2026.
Dit document leeft naast `CLAUDE.md`; als een stap af is, verhuist de blijvende
kennis daarheen en blijft hier alleen de voortgang staan.

---

## Doel en grenzen

Eerst **één, hooguit twee bevriende DM's** op dezelfde server, gratis, als
playtest. Gaat er iets stuk tijdens hun sessie, dan is dat geen incident maar
feedback — het wordt verwerkt, niet meteen gefikst. Pas na hun playtests komen
er eventueel meer bij.

Bewust **niet** in deze ronde:
- co-DM (speltechnisch onopgelost, niet alleen technisch)
- content delen tussen campagnes (alleen generieke zaken zouden ooit kunnen:
  spreuken, monsters, class features — geen noodzaak nu)
- import van bestaand materiaal (foutgevoelig; handmatig invoeren dus)
- eigen thema of logo per campagne (perkament blijft, take it or leave it)
- Engelse UI — Nederlands is juist het onderscheidende punt
- export/snapshot voor andere DM's

## Vaste keuzes

| Onderwerp | Keuze |
|---|---|
| Tenant | De campagne. Eén DM mag meerdere campagnes hebben, met meerdere groepen. |
| Speler | Per campagne een eigen personage en dus een eigen login; groepswachtwoord blijft (geen accounts, geen e-mail). |
| Wachtwoorden | De nieuwe DM stelt zijn eigen DM- én groepswachtwoorden in. |
| Inloggen | Op de campagnepagina één wachtwoordveld; wát je intikt bepaalt waar je uitkomt. Groepswachtwoord → personage kiezen. DM-wachtwoord → DM-modus. |
| Tabletmodus | Geen eigen wachtwoord meer: de DM logt in en zet **dat scherm** in tabletmodus. Er hoeft dan nooit een wachtwoord getypt te worden op een scherm dat op tafel ligt. |
| Uitnodigen | Alan maakt de DM handmatig aan. |
| Modules aanzetten | Alleen Alan, stapsgewijs, met uitleg erbij als een module vrijgegeven wordt. |
| Module uit | Verdwijnt volledig uit beeld (geen grijze "binnenkort"-items). |
| Valuta | D&D-generiek: gp/sp/cp als standaard, hernoembaar. Grisburgh houdt Florinde/Knaker/Centeling. |
| URL | `grisburgh.nl/<naam>` per campagne — Grisburgh wordt dus ook `/grisburgh`. De landingspagina is voor iedereen te bezoeken en toont de campagnes; alleen inloggen is afgeschermd. `grisburgh.nl` zonder pad stuurt door naar `/grisburgh`, zodat bestaande bladwijzers blijven werken. |
| Progressie & spreuken | Nieuwe campagnes krijgen de **structuur** (namen, levels, school, casting time…) zonder beschrijvingen, met een tekstveld dat de DM zelf vult. Per campagne opgeslagen. |
| Backups | Dagelijks alle JSON per campagne op de server, plus een kopie op Alans laptop via een geplande taak (launchd) die draait zodra de laptop aan staat — mist hij een dag, dan haalt hij het de volgende keer in. Raakt een wijziging andermans content, dan ook handmatig vooraf. De **thumbnails** gaan wél mee (samen 56 MB tegen 2,2 GB originelen): na een ramp staat de app er weer mét beeld, alleen op 600px. De originelen blijven bewust alleen op de server. Bewaartermijn dertig dagen. |
| Deploy tijdens andermans sessie | Even afstemmen per app; geen onderhoudsscherm nodig. |
| Tempo | Stapsgewijs, met smoke tests per stap. |

## Modules

**Mee in de startset**

Archief (personages, locaties, organisaties, voorwerpen, documenten) ·
Logboek · Missies · Prikbord (relatiemap) · Kaarten · Spelers & groepen ·
Boedel · Progressie · Spreukenboek · Berichten · Gevecht + encounters +
monsters *(zonder bestiarium-kaartjes; spelers krijgen geen statblocks, alleen
in de testcampagne)* · Tafels · Geluiden · Dobbelstenen · Herberg · Arena
*(nu De Tweespalt)* · Detective *(nu De Gock)* · Rust

Van arena en detective gaat de **mechaniek** mee, niet de **content**:
monsternamen en -stats, onderzoeksresultaten en vaste teksten blijven van
Grisburgh. Een nieuwe campagne krijgt de functie leeg opgeleverd.

**Nog niet mee** — onvoldoende doorontwikkeld of te campagne-eigen:

Tempel · Madame Ursula · Magizoöloog · Facties · Bestiarium · Aktes en de
regie/Meesterkamer-verhaallijn

## Bekende scherven (gevonden in de code, nog niet gefikst)

Het bestandslek is in stap 1 gedicht (`_magBestandZien()`); de kaart-fallback,
de munten, "Jonkers prikbord" en de hardcoded titel in stap 3; de PHB-teksten in
stap 5. Wat hieronder staat is wat er nog ligt.

Alle drie de scherven uit de eerste ronde zijn weg: **de Heeren** zijn opgeheven
(21 sep, wat zij deden doet een factie), **`meta.factiesLabel`** bestaat, en de
diensten zijn alle acht te hernoemen via `meta.<dienst>.naam` — inclusief de
markt, die als laatste een naamveld kreeg.

**Opnieuw gemeten op 2 okt 2026** met een scan over alle niet-commentaarregels
in `public/js`, `lib`, `routes` en `server.js`. Er stonden er nog acht, en één
was van diezelfde dag:

| Waar | Wat | Stand |
|---|---|---|
| `routes/api.js` — escalatiebrief woekeraar | "**Strum** komt langs" stond hard in een route die élke campagne draait | gefikst: `meta.woekeraar.handlanger`, anders "er komt iemand langs" |
| `dm-panel.js` — factie-uitnodiging (2×) | "Uw daden in **Grisburgh** zijn ons niet ontgaan" in de briefsjabloon | gefikst: `window._campagneNaam()` |
| `lib/snapshot.js` — kaarten | Grisburghs stadskaart en Isfār als terugval in de HTML-export | gefikst: geen kaarten is geen kaart |
| `lib/snapshot.js` — spelden | `p.mapId \|\| 'grisburgh'` — dezelfde migratie-als-standaardwaarde die in `routes/api.js` al was weggehaald | gefikst: de eerste kaart die er is |
| `app.js` — aflossen | "Vul het aantal **centeling** in" als terugval | gefikst: `_muntNamen()` |
| `app.js` — hulptekst bedragen | "*2,50* is 2 **florinden** en 5 **knaken**" | gefikst: de munten van de campagne |
| `app.js` — hulptekst herberg | "*De Swarte Cat*, niet *de herberg*" als voorbeeld | gefikst: geen eigennaam meer |
| `app.js` — hulptekst Spotify | "**Grisburgh** speelt zelf niets af" | gefikst: de campagnenaam |

Wat bewust blijft staan en géén scherf is: de **datasleutels**
(`meta.buitenGrisburgh`, `grisburgh-progressie-1`, `grisburgh_party_presence`) —
hernoemen kost een migratie en levert niets zichtbaars op; de **interne namen**
van drie diensten (`tweespalt`, `gock`, `ursula` als sleutel voor gokhuis,
detective en waarzegger) — hun lábel komt uit `meta`; en `BEHEER_CAMPAGNE` en
`GRISBURGH_DATA_DIR` in de omgeving.

## Serverbudget (gemeten 3 sep 2026 — achterhaald)

> **Deze cijfers zijn van vóór de WebP-omzetting (15 sep).** Beelden worden nu
> bij binnenkomst omgezet en zijn ongeveer een tiende van wat ze waren; de
> bestaande 2,2 GB van Grisburgh is met `scripts/beelden-naar-webp.js`
> teruggebracht. De rekensom hieronder ("acht à tien campagnes") is dus veel te
> somber, maar hij is niet opnieuw gemeten.


38 GB schijf, 27 GB vrij; 3,8 GB RAM waarvan ~0,5 GB in gebruik. Geheugen is
geen knelpunt. De schijf gaat volledig op aan beeldmateriaal:

- Grisburgh 2,3 GB (waarvan 2,2 GB `files/`, 56 MB thumbnails)
- Prewett 119 MB · Sandbox 52 KB

Richtlijn: ~5 GB vrijhouden voor systeem, logs en backups → ruimte voor acht à
tien campagnes van 2 GB. Aandachtspunt: portretten van 1,5–2 MB terwijl de
thumbnail 600px is. Verkleinen bij upload scheelt een factor honderd.

## Stappen

Elke stap eindigt met: Grisburgh doet nog exact wat het deed.

1. **Isolatie, DM-accounts en `/naam`-routing.** — **af (4 sep 2026)**. De
   vijftien isolatietests staan groen en zijn geen `todo` meer: routing per
   campagne, login mét campagne, bestanden achter de scope, één wachtwoordveld
   dat de rol bepaalt, en tabletmodus vanuit het DM-scherm.
   Campagne-id uit de URL, gebonden aan de sessie. DM-accounts met gehashte
   wachtwoorden (Alan wordt account nummer één). Eén inlogscherm per campagne
   waarin het ingetikte wachtwoord de rol bepaalt (groep → personage kiezen;
   DM → DM-modus; tabletmodus wordt daarna vanuit het DM-scherm aangezet).
   In dezelfde stap: **bestanden achter de campagne-scope**. Alleen de portretten
   van de personages die `/api/auth/players` toch al toont blijven publiek — dat
   is precies wat de landingspagina nodig heeft. Al het andere (documenten,
   kaarten, sfeerbeelden, andermans uploads) vraagt een sessie in díé campagne.
   *Harde voorwaarde vooraf:* een testsuite die als DM 2 inlogt en dan probéért
   bij Grisburgh te komen — lezen én schrijven, elk endpoint. Slaagt die aanval
   ergens, dan gaat er niemand op.
   **Staat er: `tests/campagne-isolatie.test.js`** — dertien tests, allemaal
   rood, met een `todo`-vlag zodat `npm test` groen blijft voor ander werk. Los
   te draaien met `npm run test:isolatie`. De aannames over de nieuwe API staan
   in drie helpers boven in dat bestand; kiest de implementatie een andere vorm,
   pas dan alleen die aan. Zodra de stap af is: todo-vlag weg, dan zijn het
   echte poortwachters.
   Elf tests dekken de losse gevallen (logins, personagekiezer, bestanden). De
   twaalfde is een **veegtest**: die haalt alle GET-routes uit de Express-router,
   vult de pad-parameters met echte ids uit campagne alfa, roept ze als DM van
   beta aan en faalt zodra er een kanarie-tekenreeks uit alfa in een antwoord
   opduikt. Zo groeit de dekking mee met elk endpoint dat erbij komt — nu 78 van
   de 78 GET-routes. De dertiende controleert de socketkamers: een live-update
   in alfa mag niet bij beta aankomen (`server.js:129` laat een verbinding
   zonder `campaignId` nu in de gedeelde room `'main'` landen).
   Beide zijn los bewezen op een gezaaide campagne: de veeg vindt de kanarie
   dan op `/entities/personages`, `/entities/personages/:id`, `/archief`,
   `/characters/:id/sheet` en `/monsters`, en het socket-event komt binnen. Na deze stap kan DM 2 er al op, met alles aan.
2. **Backups automatisch.** — **af (4 sep 2026)**. Cron op de server om 05:15
   (`/usr/local/bin/grisburgh-backup`) maakt een snapshot van alle JSON plus de
   thumbnails van élke campagne, dertig dagen terug, met `--link-dest` zodat de
   historie hardlinks deelt (twee dagen van 58 MB = 59 MB op schijf). Een
   launchd-agent op de laptop haalt om 19:00 de huidige stand mét thumbnails op
   en houdt daarnaast dertig dagen JSON-historie; een gemiste dag wordt bij het
   volgende opstarten ingehaald. Gecontroleerd: de 27 JSON-bestanden in de
   snapshot parsen en zijn identiek aan live, en het ophalen draait vanuit
   launchd (exit 0). Wat er bewust níét in zit: `files/` (2,2 GB originelen) en
   het PM2-configuratiebestand met de wachtwoorden in de omgeving — na een
   totale ramp moet die met de hand terug. Zie CLAUDE.md voor het terugzetten.
3. **Namen, munten en kaart generiek.** — **af (4 sep 2026)**. De munten staan
   nu in `meta.json` van elke campagne (Grisburgh's Florinde/Knaker/Centeling
   expliciet weggeschreven), met gold/silver/copper als standaard en een
   hernoemveld bij Instellingen. De ingebouwde kaart-fallback is weg: geen
   kaarten geeft een lege staat, niet Grisburghs stadskaart. Titel en
   PWA-manifest komen per campagne van de server, de shell bevat geen naam meer.
   Verder opgeruimd: "Jonkers prikbord" → "Prikbord", "De Swarte Cat" als
   herbergnaam-vangnet, "Grisburgh-diensten" als tabtitel, en de teksten in het
   wereldpaneel, het spelersdashboard, de locatie-help en het einde-van-het-
   gevecht-scherm gebruiken nu de campagnenaam. Zes tests in
   `tests/campagne-generiek.test.js`.
   Blijft staan: de app-iconen en het logo-embleem zijn van Grisburgh, en de
   `[[ ]]`-teksten van facties/tempel noemen de stad — die modules zitten niet
   in de startset.
4. **Modules per campagne.** — **af (4 sep 2026)**. `lib/modules.js` houdt de
   catalogus (twintig modules) én de koppeling naar de UI; `GET /meta` levert de
   stand plus de lijstjes met wat verborgen moet worden, zodat de client niets
   naloopt. Gefilterd in de zijbalk, het Logboek- en Dienstenmenu, de
   Meesterkamer-tabs, de diensten-subtabs en de spelerssubtabs; een menuknop
   waarvan alles uit staat verdwijnt zelf ook. Grisburgh staat expliciet op
   alles `true` — de smoke test is dat er niets veranderde.
   In dezelfde stap een gat gedicht: `/campaigns` (lijst, aanmaken, actieve
   campagne wisselen) stond op `requireDM`, dus kon de DM van campagne B de
   standaardcampagne verzetten. Dat is nu `requireBeheerder`
   (`config.beheerCampagne`). Zes tests in `tests/modules.test.js`.
5. **Kale progressie en spreuken.** — **af (4 sep 2026)**. De bronbestanden zijn
   uit `public/data/` gehaald (ze waren zonder inloggen op te halen) en gaan via
   `GET /api/bron/:naam`. Buiten de beheercampagne komt er structuur zonder
   tekst: naam, niveau, school, casting time, range, components, duration en
   klassen wél, `desc` niet — hetzelfde voor class features en backgrounds. De
   DM schrijft zijn eigen beschrijving in het spreukdetail; die staat in
   `spells.json` van zijn campagne en is van hem. Negen tests in
   `tests/bronnen.test.js`.
6. **Wizard.** — **af (2 okt 2026)**, `public/js/wizard.js`. Zes stappen:
   naam en ondertitel → munten → de namen van je diensten → je eerste party met
   wachtwoord → je eerste personage → een samenvatting met de weg verder.

   **Twee dingen zijn anders gelopen dan hier stond.**

   *Modules zitten er niet in.* Het plan zei "campagnenaam → munten → modules →
   diensten", maar `PUT /campaigns/:id/modules` staat op `requireBeheerder` —
   een nieuwe DM mág ze helemaal niet zetten, en dat is een vaste keuze
   hierboven ("Modules aanzetten: alleen Alan, stapsgewijs"). Die stap hoort
   dus bij wie de campagne aanmaakt, niet bij wie hem gaat spelen. Zie
   `docs/beheerder.md` voor de werkverdeling.

   *Hij draait in de campagne zelf.* Niet in het beheerpaneel, maar als de DM
   van die campagne, de eerste keer dat hij binnenkomt in een campagne zonder
   personages (`meta.wizardKlaar` onthoudt dat hij geweest is). Daardoor
   gebruikt hij **alleen endpoints die er al waren** en voegt hij niets toe aan
   de server behalve die ene vlag. Later opnieuw doorlopen kan bij
   Instellingen › Campagne.

   *De kaart is eruit.* Een kaart uploaden vraagt om beeld dat een nieuwe DM op
   dat moment zelden bij de hand heeft, en de kaartengalerij zegt zelf al wat
   er moet gebeuren als hij leeg is.

   **Uitgebreid op 2 okt 2026** met vier stappen die er niet in zaten en die de
   eerste avond bepalen: **welke onderdelen** je gebruikt (uitzetten mag de DM
   zelf; aanzetten blijft bij de beheerder — `meta.modulesUit` naast
   `meta.modules`), **hoe een gevecht eruitziet** voor je spelers (de drie
   HP-weergaven), **of je de spreukafbeeldingen overneemt** uit de
   beheercampagne (eigen beeld, dus delen mag — maar het is een keuze en het
   kost schijf), en **blanco of iets om mee te oefenen**: vijf kaartjes die samen
   één avond beschrijven, in één greep weer weg te gooien.
   Alle vier staan ook bij Instellingen → Campagne, want een wizard die je
   oversloeg mag geen doodlopende weg zijn.

   **De minicampagne is nog niet gemaakt.** Het *oefenmateriaal* uit de wizard
   is iets anders en kleiner: vijf kaartjes om de machinerie uit te proberen.
   Een minicampagne is een gespéélde campagne waar schermafbeeldingen uit
   kunnen komen zonder Grisburgh te verklappen; die hoort bij stap 7.
   **Namen van diensten horen in de wizard.** Elke dienst heeft zijn naam al in
   `meta.<dienst>.naam` (herberg, tweespalt, gock, ursula, tempel, magizoo) en is
   te hernoemen in zijn eigen paneel onder Diensten. De zijbalk gebruikt die naam
   sinds 4 sep; zonder eigen naam staat er wát het is (Herberg, Arena, Detective,
   Waarzegger, Tempel, Magizoöloog) in plaats van hoe het in Grisburgh heet.
   De wizard loopt ze langs, want een dienst die "De Swarte Cat" heet in een
   andere campagne is precies het soort scherf waar stap 3 over ging. Alle acht
   accepteren een `naam`; de markt kreeg zijn veld als laatste.

   **Waarschuwen bij het indelen van party's:** twee party's zijn later niet
   samen te voegen. Een personage verhuizen kan wel (`entity.data.groep`), maar
   alles wat de *groep* over hem onthoudt blijft achter: `itemOwners`
   (voorwerpbezit!), `secretReveals`, `visibility`, `docVisibility`,
   `companions`, `itemCharges`, `sharedPurse`, `factieZichtbaar`,
   `voorspellingen`, `dienstenToegang`, `bestiarium`, `deceased`. Alleen
   `playerItems` en `playerCurrency` hangen aan het personage zelf en reizen
   mee — dus je krijgt een halve verhuizing: losse boedelregels en geld gaan
   mee, voorwerpkaartjes en alles wat al onthuld was niet. Een nieuwe DM moet
   dus vooraf weten hoe hij zijn tafels indeelt; de wizard zegt dat met zoveel
   woorden. Als dit vaker gaat spelen is de echte oplossing een
   *samenvoegen*-actie die die twaalf velden per groep omzet, geen losse
   verhuisknop.
7. **Handleiding + visuele rondleiding.** Handleiding te downloaden na de wizard
   en terug te vinden bij Instellingen; functioneel, over spelen, niet over code.
   Rondleiding als doorklikbare pagina met afbeeldingen op een eigen link, met
   schermafbeeldingen uit de **minicampagne** — geen spoilers uit Grisburgh.
   Vereist dus dat stap 6 af is.
8. **Mediabudget.** Teller per campagne + verkleinen bij upload. Naar voren te
   halen als de schijf eerder knelt.
9. **Gefaseerd uitrollen.** Nieuwe features komen eerst bij Alan terecht, en pas
   daarna bij de rest. Drie afspraken, geen extra infrastructuur:
   - **Vlag per campagne.** Een nieuwe feature krijgt een module die alleen bij
     Alan aan staat (hergebruikt `meta.modules` uit stap 4). Een vlag leeft
     hooguit een paar sessies: daarna gaat hij eruit, aan- of uitgezet. Blijven
     ze hangen, dan onderhoud je twee paden door dezelfde code waarvan er één
     nooit meer gebruikt wordt.
   - **Deployvolgorde.** Altijd eerst JS en CSS, dán `index.html`. Andersom haalt
     een browser een halve versie op: het nieuwe `?v=`-nummer verwijst dan naar
     een bestand dat er nog niet is. Dat raakt iedereen tegelijk en is met geen
     enkele gefaseerde uitrol te ondervangen.
   - **Een teruggang die geoefend is.** — **af (2 okt 2026)**.
     `scripts/uitrollen.sh` zet vóór elke uitrol een momentopname van de code
     weg in `releases/` (±8,5 MB, de laatste tien blijven), kopieert in de goede
     volgorde, kijkt na en draait zichzelf terug als er iets niet klopt.
     `scripts/terugdraaien.sh` doet het met de hand; `--lijst` toont wat er is.
     **Geoefend door productie twee keer opzettelijk te slopen**, en dat leverde
     meteen twee bugs op die je nooit op papier vindt: `ssh` at de stdin van de
     bevestigingsvraag op (daardoor stopte het script zwijgend), en de standaard
     terugdraai koos een `-voor-terugdraai`-opname — die bevat juist de storing
     die je wilde ontvluchten.
     En een derde bevinding: **een HTTP 200 is geen bewijs**. De server serveert
     een kapot `app.js` net zo braaf; `scripts/modules-nakijken.sh` haalt daarom
     elk bestand terug op en parseert het als ES-module.
     Bijvangst: er stond een verdwaalde `index.html` in `public/js/` op de
     server, publiek bereikbaar op `/js/index.html`, met verouderde
     versienummers erin. Het script meldt nu wat er in die mappen staat en er
     niet hoort.

   Wat we bewust **niet** doen zolang het om twee DM's gaat: een tweede
   Node-proces als voorproefomgeving (`canary` op 3001 met alleen Grisburgh,
   `stable` op 3000 voor de rest, Caddy routeert op pad). Dat kan veilig — elk
   proces schrijft dan alleen in zijn eigen campagnemap — maar het kost twee
   deploys, twee herstarts en twee versies om uit elkaar te houden, en het geeft
   schijnzekerheid: wat écht stuk kan gaan zit meestal in gedeelde code die bij
   promotie alsnog in één klap bij iedereen landt. Vanaf ongeveer vijf DM's
   verandert die rekensom, want dan is "even afstemmen wanneer iedereen speelt"
   ook niet meer te doen.

   De voorproef in de tussentijd is de laptop: `npm run dev` op een verse kopie
   van de productiedata, met een scriptje dat die kopie ophaalt.

## Open vragen

Geen. Van stap 9 is de geoefende teruggang af; wat daar nog ligt is de
vlag-per-campagne (die bestaat al als module) en de afspraak over deployen
tijdens andermans sessie. Volgende aan de beurt: **het beheerdersoverzicht met
de mediateller** (stap 8 én de "hebben we een /admin nodig"-vraag), en daarna
**stap 7** (handleiding + rondleiding), die op de minicampagne wacht.
