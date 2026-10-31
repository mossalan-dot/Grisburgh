# Personage scheppen — het herontwerp van de maker

Werkdocument, 31 oktober 2026. De **functionele** maker bestaat al en werkt
(`public/js/personage-maken.js`; zie `docs/voorstel-personage-maken.md`). Dit
document gaat over de **beleving**: de maker moet aanvoelen als een ritueel waar
je zin in krijgt, niet als een rekentool — ook al is het dat eronder.

> **Nog niet geporteerd.** Dit is bewaard materiaal om later mee te bouwen. Het
> klikbare prototype staat in `docs/prototypes/personage-scheppen.html` (open het
> in een browser) en leefde als Artifact op
> <https://claude.ai/artifact/XJf9uAngjMSqvhdGiGNxiW>. Het prototype is vanilla
> JS in dezelfde stijl als de echte frontend, zodat het meteen als referentie
> voor de port dient.

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
