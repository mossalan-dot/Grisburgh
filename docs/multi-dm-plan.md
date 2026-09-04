# Grisburgh voor meerdere DM's — werkdocument

Status: **stap 1, 2 en 3 af.** Bijgewerkt 4 sep 2026.
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
de munten, "Jonkers prikbord" en de hardcoded titel in stap 3. Wat hieronder
staat is wat er nog ligt.

| Waar | Wat |
|---|---|
| `public/data/spells-2024.json` | 539 spreuken, allemaal `source: "phb2024"` — volledige PHB-teksten, geen SRD. Zelfde afweging als bij de progressiebeschrijvingen: naar buiten toe alleen namen + feitelijke velden. |
| `_DIENST_SVC_KEYS` / `_DIENST_AMB_LABELS` / `data-section` | Diensten zijn **vaste secties** met eigen HTML, CSS en endpoints; hun configuratie staat wél al in `meta.json` (naam, afbeeldingen, prijzen), dus hernoemen kan zonder verbouwing. |

## Serverbudget (gemeten 3 sep 2026)

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
4. **Modules per campagne.** `meta.modules`, gefilterd in zijbalk én
   Meesterkamer. Grisburgh alles op `true` — dat is meteen de smoke test.
5. **Kale progressie en spreuken**, per campagne opgeslagen, met invulvelden.
6. **Wizard + minicampagne.** Campagnenaam → munten → modules → diensten
   hernoemen → kaart uploaden (optioneel) → eerste groep met wachtwoord →
   eerste personage: zowel een kaartje in het archief als een speler-personage
   met profiel en groepskoppeling.
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
   - **Een teruggang die geoefend is.** Vóór elke deploy blijft een kopie van de
     vorige bestanden op de server staan, met één commando om ze terug te zetten.
     Nu is de terugweg "opnieuw scp'en vanuit git en hopen dat je de juiste
     commit pakt" — midden in andermans sessie is dat het verkeerde moment om
     daarachter te komen.

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

Geen. Stap 1 kan beginnen.
