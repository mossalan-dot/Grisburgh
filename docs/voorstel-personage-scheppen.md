# Personage scheppen — het herontwerp van de maker

Werkdocument, 31 oktober 2026. De **functionele** maker bestaat al en werkt
(`public/js/personage-maken.js`; zie `docs/voorstel-personage-maken.md`). Dit
document gaat over de **beleving**: de maker moet aanvoelen als een ritueel waar
je zin in krijgt, niet als een rekentool — ook al is het dat eronder.

> **Geporteerd op 2 november 2026** naar `public/js/personage-maken.js` (opmaak
> onderaan `theme.css`, alles onder `.ps-`). Het prototype staat nog in
> `docs/prototypes/personage-scheppen.html` als referentie. Wat er bij het
> porten anders ging dan hieronder staat, en welke randgevallen er boven
> kwamen, staat onderaan onder *Hoe het gebouwd is*.

---

## De vijf ingrepen (van rekentool naar ritueel)

1. **Een drempel, geen formulier.** Een openingsscherm bij kaarslicht —
   embleem, *"Schep een personage"*, een begin-knop — in plaats van een veld met
   het label "Naam".
2. **Eén grote keuze per scherm.** Species / class / background als grote,
   sfeervolle kaarten met een warme gloed en een lakzegel bij je keuze.
3. **Het blad vormt zichzelf.** Een perkament dat naast je meegroeit: portret,
   naam in Cinzel, de regels die invullen terwijl je kiest, de zes ability-pips
   onderaan. Het emotionele hart.
4. **Tastbare momenten.** De dobbelsteenworp tuimelt; point-buy geeft vonken uit;
   de stem wordt opgenomen met een waveform; de onthulling verzegelt met lak.
5. **De onthulling.** Het afgemaakte blad wordt cinematisch onthuld (zelfde taal
   als de brief- en level-up-cinematics van de app), met een lakzegel
   *"Verzegel en stuur naar je Spelleider"*.

---

## Stappenvolgorde

Drempel → **Naam & gezicht** (portret/filmpje, beginlevel) → **Afkomst**
(species) → **Roeping** (class + subclass vanaf het juiste level + multiclass)
→ **Herkomst** (background) → **De zes getallen** → **Vaardigheden** (skills) →
**Grimoire** (alleen casters) → **Groei** (alleen bij beginlevel ≥ 4: ASI/feat
per bereikt niveau) → **Knapzak** (uitrusting) → **Verhaal** (backstory +
geheimen) → **Stem** (beurt-geluid + emotes) → **Onthulling**.

Links het meegroeiende blad, boven elk scherm een **voortgangsbalk** (vullend
verguldsel, "Stap X van Y" + stapnaam). De voortgangsbalk past zich aan: een
caster krijgt de grimoire-stap, een hoog beginlevel de Groei-stap.

---

## Vastgelegde keuzes (uit de gesprekken)

| Onderwerp | Keuze |
|---|---|
| **Sfeer** | Donker toneel (kaarslicht), lichte perkamentpanelen eroverheen — zoals de dienstschermen. |
| **Kaartbeeld** | Toont het portret dat de DM in het Heldenboek hing; is er geen, dan een licht medaillon-kaartje met het icoon. |
| **Ability scores** | Respecteer de DM-instelling: toon de toegestane manieren (rollen / point-buy / standaardreeks / vrij). Rollen krijgt de dobbelsteen-animatie. |
| **Worpen koppelen** | Na het rollen koppelt de speler elke worp vrij aan een ability (met omwisselen). |
| **Rerolls** | DM-instelbaar aantal; een reroll werpt **de hele set** opnieuw. Apart ook een instelling voor rerolls bij **level-up** (hoort bij het bestaande level-up-scherm, niet in de maker). |
| **Portret + filmpje** | Beide uploadbaar in de eerste stap; filmpje max ~6s/8MB (zoals de app al hanteert). |
| **Verhaal + geheimen** | Eigen stap: backstory op gelinieerd perkament, plus geheimen met lakzegel die alleen de DM ziet en later (eventueel op teken van de speler) aan tafel onthult. Sluit aan op `data.geheimen`. |
| **Hogere levels** | ASI/feat-keuzes worden **in de maker** gemaakt (de Groei-stap), niet doorgeschoven naar level-up. |
| **Multiclass** | In de class-stap (uitklap vanaf level 2); "voorrekenen, niet blokkeren" — de DM ziet of je aan de eisen voldoet. |
| **Term** | "Scheppen", niet "smeden". |

---

## Wat er bij het porten moet gebeuren

De bestaande `personage-maken.js` is het vertrekpunt; dit herontwerp vervangt de
opmaak (de `wz-*`/`dm-*`-leen) en voegt stappen toe. Aandachtspunten:

- **Nieuwe CSS** onderaan `theme.css` (donker toneel, lichte panelen, kaarten,
  voortgangsbalk, grimoire, groei, verhaal/geheimen, stem). Versies bumpen.
- **Data uit de app** i.p.v. de zaaidata in het prototype: species/class/
  background/skills/spreuken uit het Heldenboek + `bronnen/*.json`, met de
  **DM-portretten** als kaartbeeld (`_tegelBeeld`).
- **Server-kant** (het concept-model in `routes/api.js`): velden erbij voor
  backstory → `data.desc`, geheimen → `data.geheimen`, de Groei/ASI/feat-keuzes,
  skills, en het portretfilmpje (`<entityId>_video`, bestaat al voor personages).
- **Stem**: opnemen met `MediaRecorder` → upload via `/api/files/:id` → wegschrijven
  in `sounds.json` (`emotes[entityId]` + `playerTurn`). Een **mic-icoon** staat
  nog niet in de sprite — toevoegen met `scripts/sprite-aanvullen.js mic`.
- **DM-instellingen**: toegestane ability-methodes, aantal rerolls (maken en
  level-up), max beginlevel — bij Instellingen en in de setup-wizard.
- **Rerolls bij level-up**: knop toevoegen aan het bestaande level-up-scherm.
- Testronde-regels toevoegen in `docs/testronde.md` per nieuwe stap.

Het prototype werkt met nagespeelde opname (sandbox kan geen microfoon) en met
sfeerkleuren in plaats van echte portretten; beide worden in de echte app het
echte werk.


---

## Hoe het gebouwd is (2 nov 2026)

**De server rekent, de maker toont.** Elke regel staat in
`lib/personage-concept.js`; de maker, de Vragen-kaart van de DM en het gunnen
lezen dezelfde functies. Wat bij het porten aan randgevallen boven kwam — en
nu door `tests/personage-maken.test.js` bewaakt wordt:

- **Backgrounds komen uit de campagne**, niet uit de meegeleverde lijst (een
  lege houder valt wél terug op de seed). En de bron schrijft ze in vier
  vormen: skills als `A, B`, als `A and B` en als `A, choose one: …`; het
  gereedschap onder *Tool Proficiency* óf *Tool Proficiencies*, soms als
  keuze; oudere backgrounds zonder Ability Scores en Feat maar met één eigen
  Feature, en met hun geld in een *Pouch containing 10 GP*. De oude maker
  splitste alleen op komma's en maakte van "History and Intimidation" één
  skill die niet bestaat.
- **Een oudere background zonder vaste abilities** mag zijn verhoging vrij
  verdelen; de nakijker zegt erbij dat dat een afspraak is en geen regel.
- **Groei volgt de tijdlijn**: een ASI waar de class er zelf een heeft óf waar
  `gedeeld.asiLevels` er een zet, een Epic Boon op `epicBoonLevel`, met
  dezelfde sleutel (`Klasse|level|Ability Score Improvement`). Na het gunnen
  staat de keuze in `featChoices` en in Kenmerken & Eigenschappen, met de
  `index` die de tijdlijn gebruikt, zodat die hem niet nog eens toevoegt.
  Let op: Grisburghs Fighter heeft geen ASI op level 6 en zijn Rogue wel op
  10 — de maker volgt wat de campagne zegt, niet `klasse-basis.json`.
- **Rollen op de server.** Een maximum aan herkansingen betekent niets als de
  browser gooit; herladen was dan een gratis reroll. Standaard nul ("wat je
  rolt, dat is het" stond al in de uitleg), instelbaar bij Instellingen.
- **Een andere keuze ruimt op** (`_conceptOpruimen` in routes/api.js): een
  andere class wist subclass, skills, spreuken en groei van die class; een
  ander level gooit groeivakjes en spreuken weg die niet meer bestaan; een
  background haalt zijn eigen skills uit de class-keuze.
- **Verborgen in het Heldenboek** staat niet tussen de kaarten, en een concept
  dat het nog draagt krijgt een fout bij het insturen.
- **Spreuken uit de bronnen van de campagne** (hoofdboek, aanvullingen, eigen
  spreuken) — het gunnen las alleen `spells-2024`. Per class op zijn eigen
  level, plus Magic Initiate uit de background of de groei.
- **Kaartplaten zonder login**: wie een personage maakt mag precies de
  Heldenboek-portretten zien (`_hbBeeldIds`), niet de rest van de bibliotheek.
- **Gunnen is eenmalig** en alleen als hij nog bij de DM ligt: doorwerken haalt
  hem terug, en twee keer klikken maakte twee kaartjes.
- **Opnemen**: `MediaRecorder` geeft `audio/webm;codecs=opus`, en dat staat niet
  letterlijk in de toegestane types — de maker stuurt het kale type mee.

**Bewust niet gedaan:**

- **Rerolls bij level-up.** De spec noemt ze; ze horen bij het level-up-scherm
  en zijn een eigen klus.
- **Een geluidenbibliotheek in de stem-stap.** Het prototype bood vaste klanken
  ("Strijdkreet"); de app heeft daar geen bestanden voor. Opnemen of een
  bestand kiezen.
- **Andere spellfeats** dan Magic Initiate (Fey Touched, Ritual Caster): hun
  keuzes zijn te verschillend; die gaan aan tafel.
