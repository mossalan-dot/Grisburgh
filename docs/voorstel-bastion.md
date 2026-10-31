# Een Bastion voor de party

Werkdocument, 31 oktober 2026. De Bastion is een optionele regel uit de
**Dungeon Master's Guide 2024**: een thuisbasis die een personage vanaf level 5
opbouwt en tussen avonturen door laat werken. Grisburgh gebruikt het nog niet —
dit is een feature om klaar te zetten, vooral voor een **nieuwe DM** die met een
verse campagne begint. De vier keuzes hieronder zijn besproken met de DM.

> **Bron van de regels.** De mechaniek komt uit de DMG 2024 (hoofdstuk
> *Bastions*). De regeltekst zelf staat onder copyright en valt **niet** onder
> de SRD/CC-BY — dus net als bij de PHB-spreuken en class features geldt hier:
> **namen en getallen mogen als data mee, de letterlijke beschrijvingen niet.**
> De facility-teksten en de event-tabel schrijven we zelf na of verwijzen naar
> buiten (`window.app.bronLink`), zoals de rest van de app dat al doet.

---

## Wat het is, in het kort

Een Bastion bestaat uit **facilities** (ruimtes), en draait op **Bastion Turns**
(ongeveer elke zeven in-world dagen).

- **Basic Facilities** — slaapkamer, keuken, tuin, binnenplaats. Puur sfeer, geen
  mechaniek. Je begint met twee (één *Cramped*, één *Roomy*); uitbreiden kost
  goud en tijd.
- **Special Facilities** — *Smithy*, *Arcane Study*, *Library*, *Barrack*,
  *Garden*, *Storehouse*… Elk heeft een grootte (*Cramped / Roomy / Vast*), soms
  een prerequisite, en één of meer **orders** die je er per turn aan geeft. Je
  begint op level 5 met er twee en groeit naar vier/vijf/zes op level 9/13/17.
- **Orders** (altijd de Engelse term): **Craft, Empower, Harvest, Maintain,
  Recruit, Research, Trade**. Per Bastion Turn geef je elke special facility één
  order. Geef je niets — of de **Maintain**-order — dan rolt de DM een **Bastion
  Event**.
- **Bastion Event** — een d100-tabel: meestal *All Is Well*, maar ook *Attack*,
  *Friendly Visitors*, *Treasure*, *Request for Aid*, *Refugees*… Bij een
  **Attack** verdedigen je **Defenders** (hirelings) het bastion (6d6, elke 1
  doodt een defender; met *Defensive Walls* 4d6).

---

## De vier keuzes

| | |
|---|---|
| **Van wie is het** | **Eén bastion per party** (groep), niet per personage. Simpeler te beheren en zoals groepen het in de praktijk spelen. We wijken bewust af van de per-character-regel; zie *Hoe de party-variant werkt*. |
| **Hoe diep** | **Gefaseerd.** Fase 1: facilities + de Bastion Turn met orders. Fase 2: events + defenders. Fase 3: resources en goud. |
| **Bastion Turn** | **Allebei.** Automatisch aangeboden zodra er zeven in-world dagen voorbij zijn (via het rust/tijd-systeem), én een DM-knop om 'm handmatig te starten. |
| **Werkwijze** | **Eerst dit voorstel**, daarna een klikbaar prototype, daarna porten. |

---

## Hoe de party-variant werkt

De DMG geeft elk **personage** een eigen bastion. Wij maken er één per **party**.
Dat vraagt twee beslissingen die de regels niet voor ons nemen:

- **Hoeveel special-facility-slots heeft een party-bastion?** Voorstel: afgeleid
  uit de party — de som van waar elk lid van level 5+ recht op heeft (2 vanaf
  level 5, +1 op 9, 13 en 17), met een **DM-override** als dat te veel of te
  weinig voelt. Zo groeit het bastion mee met de party zonder dat de DM rekent,
  en kan hij het alsnog bijstellen. (Zelfde houding als overal: *de app rekent
  voor, de DM tekent af.*)
- **Wie geeft de orders?** Het is één gedeeld bastion, dus voorstel: **spelers
  mogen orders vóórstellen, de DM bevestigt de turn.** Dat past bij hoe de app
  met verzoeken omgaat (spreuk-, item-, multiclass-verzoeken) en voorkomt dat
  twee spelers dezelfde facility tegenspreken. Instelbaar: een DM die het losser
  wil, zet "spelers mogen zelf orders vastleggen" aan.

De per-character-regel laten we bewust los — hem ernaast bouwen zou de hele
module verdubbelen. Als een campagne het ooit per personage wil, is dat een
latere uitbreiding (`bastion.json` is al per-groep; een per-character-laag kan
daar later bovenop).

---

## Waar het in de app haakt

Niets hiervan is nieuw gereedschap; het leunt op wat er al staat.

- **Modules.** Een nieuwe module `bastion` in `lib/modules.js` met een eigen
  `sectie` (speler/DM-zicht), een `dmTab` (beheer) en zijn UI-sleutels.
  **`startset: false`** — uit tenzij een campagne hem aanzet, want Grisburgh
  gebruikt het niet en een nieuwe DM kiest bewust. De catalogus en het
  aan/uit-zetten lopen via het bestaande beheerscherm.
- **Tijd & rust.** De Bastion Turn-cadans (7 dagen) haakt op het bestaande
  rust/tijd-systeem. `groups[gid].rustTellers` telt al nachten, en de lange-rust
  en de maanfase werken al met de in-world datum. We bewaren
  `bastion.laatsteTurnDatum`; zodra de datum zeven dagen verder is, biedt de app
  de turn aan (een belletje in de regie-balk / het bastion-scherm). De DM-knop
  start 'm altijd handmatig.
- **Tabellen.** De Bastion-event-tabel is een **weighted table** — precies wat
  `tables.json` + `public/js/tafels.js` al kunnen, inclusief de valuta-tokens
  (`{+50gp}`) voor *Treasure*. We leveren een standaard-eventtabel mee als
  `bronnen/bastion-events.json` (zelf geschreven, geen DMG-tekst) die de campagne
  naar `tables.json` kan kopiëren en bijstellen.
- **Geld.** Opbrengsten (Trade, Storehouse, Gaming Hall) en kosten (defenders
  rekruteren, uitbreiden) lopen via `_effectiveCurrency()` / `_deductCurrency()`
  en respecteren de gedeelde party-beurs — nooit rechtstreeks in
  `playerCurrency` schrijven. Een berekende opbrengst is een **voorgevuld veld
  dat de DM mag overtypen**, geen vaststaand bedrag.
- **Craft-resultaten.** Wat een Smithy/Workshop/Arcane Study maakt, belandt als
  voorwerp in de boedel van de party (`itemOwners` / `playerItems`) — hergebruikt
  `_eigendomErbij()`, zodat er geen tweede weg naar bezit ontstaat.
- **Cinematics.** De event-onthulling leent de taal die de app al heeft (de
  brief- en loot-cinematic, de rust-overlay): een Bastion Turn sluit af met een
  **onthulling op het tafelscherm** (`_isDisplayMode`) — *All Is Well* als een
  rustige morgen, *Attack* als alarm. Server emit → `socket-client.js` → een
  `bastion:display`-payload, zelfde patroon als `loot:display` en `brief:display`.
- **Stijl.** Dienstscherm-romp waar het past (`herberg-scene` → `herberg-content`),
  `icon()` nooit emoji, perkament-thema, Engelse D&D-termen. Nieuwe iconen (een
  burcht/aambeeld/haard e.d.) zet ik met `scripts/sprite-aanvullen.js` bij en bump
  ik de sprite-versie.

---

## Datamodel

Een eigen bestand, net als `loot.json` en `tables.json`, per groep gescoped:

`data/campaigns/<campagne>/bastion.json`
```jsonc
{
  "<groupId>": {
    "naam": "De Gebroken Toren",
    "facilities": [
      {
        "id": "fac_...", "type": "smithy", "naam": "De Vuuresse",
        "special": true, "grootte": "roomy",
        "order": "craft",              // de order voor de lopende turn
        "orderData": { "itemKey": "..." },
        "hirelings": 2, "defenders": 4,
        "staat": "actief"              // actief | gebouwd-wordt | uitgeschakeld
      }
    ],
    "turn": {
      "nummer": 7,
      "datum": "...",                  // in-world datum van deze turn
      "orders": { "<facId>": "craft" },
      "event": { "key": "attack", "worp": 73, "tekst": "...", "afgehandeld": false },
      "resultaten": [ { "facId": "...", "tekst": "...", "goud": 50 } ],
      "status": "open"                 // open | bevestigd
    },
    "resources": { "goud": 0 },        // fase 3
    "muur": { "aanwezig": false, "lengte": 0 },
    "laatsteTurnDatum": "...",
    "log": [ /* afgeronde turns, voor de geschiedenis */ ]
  }
}
```

De **facility-catalogus** (namen, level, prerequisite, grootte, welke orders)
staat in `bronnen/bastion-facilities.json` — meegeleverde data, zelf
samengevatte werking, geen DMG-prozatekst. Voorbeeldrij:
```jsonc
{ "key": "smithy", "naam": "Smithy", "level": 5, "grootte": "roomy",
  "prerequisite": null, "hirelings": 2, "orders": ["craft"],
  "werking": "Smeedt wapens en harnassen uit de Armaments-lijst.",
  "bronLink": true }
```

---

## De fasering

### Fase 1 — Het bastion en de Bastion Turn
- Module `bastion`, `bastion.json`, de facility-catalogus.
- **Facilities beheren**: special facilities kiezen (binnen de slots van de
  party), basic facilities toevoegen/vergroten, een facility vervangen bij een
  level-up. Grootte en prerequisite worden voorgerekend, niet geblokkeerd.
- **De Bastion Turn**: per special facility een order kiezen
  (Craft/Trade/Recruit/Research/Harvest/Empower/Maintain), de DM bevestigt, de
  resultaten komen in de log. Turn-trigger: handmatig (DM-knop) én aangeboden na
  7 dagen.
- **Nog geen** events, defenders of goudstromen — die staan als "nog dicht".

### Fase 2 — Events en verdediging
- **Bastion Events** via de weighted-table-machinerie; de Maintain-order en "geen
  order" rollen er een. Cinematische onthulling op het tafelscherm.
- **Defenders & Attack**: defender-telling per bastion, de 6d6/4d6-worp,
  *Defensive Walls*, een facility die tijdelijk uitvalt op 0 defenders. Reuse van
  de dobbelsteen.
- **Empower** (Meditation Chamber) die de volgende event-worp beïnvloedt.

### Fase 3 — Resources en goud
- **Trade / Storehouse / Gaming Hall**: opbrengst per turn, als voorgevuld bedrag
  dat de DM aftekent, via `_effectiveCurrency`/`_deductCurrency` op de party-beurs.
- **Craft-output** die echt in de boedel belandt; **Recruit** die defenders koopt
  (kost goud); uitbreiden/bouwen dat goud en tijd kost.

Elke fase gaat apart naar productie, zoals altijd, met een regel in
`docs/testronde.md` per feature.

---

## Wat de DM instelt

Onder Instellingen (of in de setup-wizard als stap voor een nieuwe DM):

- **Bastions aan?** (de module; standaard uit)
- **Vanaf welk level** een party een bastion mag beginnen (standaard 5)
- **Aantal special-facility-slots**: afgeleid uit de party, met override
- **Mogen spelers zelf orders vastleggen, of stelt de DM de turn vast?**
  (standaard: DM bevestigt)
- **Turn-cadans** in dagen (standaard 7) en of de automatische aanbieding aanstaat
- **Welke event-tabel** (de meegeleverde, of een eigen tabel uit `tables.json`)

Allemaal in `meta.bastion`, met verstandige standaarden zodat een ontbrekende
sleutel het huidige gedrag beschrijft — zoals de rest van de app.

---

## Wat het bewust níét wordt

- **Geen tweede bezitsadministratie.** Craft-resultaten en goud lopen door de
  bestaande boedel en beurs, niet door een eigen bastion-portemonnee die uit de
  pas gaat lopen (de `resources.goud` in fase 3 is een doorgeefluik, geen aparte
  schatkist).
- **Geen regelrechter.** Prerequisites (een Arcane Study vraagt een spellcasting
  focus; multiclass-achtige eisen) worden **voorgerekend, niet geblokkeerd** —
  dezelfde houding als bij de spreukverzoeken en de multiclass in de maker.
- **Geen DMG-tekst in de repo.** Facility- en event-beschrijvingen zijn eigen
  samenvattingen of een verwijzing naar buiten.
- **Geen per-character-bastions** in deze ronde (zie *Hoe de party-variant
  werkt*).
- **Geen volledige plattegrond-editor** zoals de dungeon-kaart. Facilities zijn
  in fase 1 kaartjes; een visuele plattegrond is een mogelijke latere traktatie,
  geen fase-1-eis.

---

## Open vragen (voor vóór het bouwen)

1. **Slot-aantal**: afgeleid-uit-de-party met override — goed, of wil je het
   gewoon een getal dat de DM zet?
2. **Welke facilities eerst?** Voorstel: de negen op level 5 compleet in fase 1,
   de rest (level 9/13/17) als data erbij maar pas echt nodig als de party zo ver
   is. Akkoord?
3. **Bastion-naam en -beeld**: één naam + één achtergrond per party-bastion
   (zoals een dienstscherm), of mag elke facility een eigen plaatje (zoals de
   Heldenboek-kaarten)?
4. **Tafelscherm-onthulling** bij elke turn, of alleen bij een "spannend" event
   (Attack, Treasure, Request for Aid)?

---

## Prototype daarna

Zodra dit voorstel klopt, bouw ik — net als bij de character-creator — een
klikbaar **Artifact-prototype**: het bastion met zijn facility-kaarten, de
Bastion Turn waarin je orders uitdeelt, en de cinematische event-onthulling, in
de Grisburgh-stijl. Dat beoordeel je, en pas daarna gaat het de echte code in op
`claude/dnd-app-updates-atij8n`.
