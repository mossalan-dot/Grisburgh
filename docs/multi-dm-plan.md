# Grisburgh voor meerdere DM's — werkdocument

Status: **plan, nog niets gebouwd.** Bijgewerkt 3 sep 2026.
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

| Waar | Wat |
|---|---|
| `render-kaart.js:43` | Valt terug op de **ingebouwde** kaart `/assets/map-grisburgh.jpg` zodra een campagne er zelf geen heeft. DM 2 ziet dan Grisburgh's stadskaart met zijn eigen campagnenaam eronder. |
| `routes/api.js`, `lib/character-sheet.js` | Munteenheid Florinde/Knaker/Centeling zit als **fallback in de code**; `meta.json` van Grisburgh heeft helemaal geen `currency`. Moet omgekeerd: expliciet in meta, gp/sp/cp als standaard. |
| `render-relatiemap.js:86`, `index.html:120` | "Jonkers prikbord" — eigennaam uit de campagne, moet "Prikbord". |
| `index.html:6`, `app.js:866` | Hardcoded "Grisburgh" (titel) en "Swarte Cat". |
| `public/data/spells-2024.json` | 539 spreuken, allemaal `source: "phb2024"` — volledige PHB-teksten, geen SRD. Zelfde afweging als bij de progressiebeschrijvingen: naar buiten toe alleen namen + feitelijke velden. |
| `routes/auth.js:168` (`attachRole`) | Zet `req.role = 'player'` als er géén sessie is. Daardoor vuurt de controle `if (!req.role)` in `/api/files/:id` en `/api/thumb/:id` **nooit**: elk bestand is zonder inloggen op te halen als je het id kent. Op productie geverifieerd — een portret van 1,7 MB komt er gewoon uit. De ids lekken bovendien via `/api/auth/players`, dat publiek moet zijn voor de landingspagina. Met één campagne onder vrienden was dit een schouderophalen; met een tweede DM erbij is het diens materiaal dat openligt. |
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

1. **Isolatie, DM-accounts en `/naam`-routing.**
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
2. **Backups automatisch.** Dagelijks alle JSON per campagne met rotatie (klein:
   kilobytes) plus een kopie bij Alan. Vóór stap 3, want daarna wordt er aan
   gedeelde code gezeten.
3. **Namen, munten en kaart generiek.** Zie "bekende scherven".
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

## Open vragen

Geen. Stap 1 kan beginnen.
