# Lootverdeler — Ontwerpdocument

> Bouwplan voor de post-combat lootfase: loot hangt aan encounters, spelers claimen items,
> dobbelrollen bij concurrentie, geld splitst automatisch, alles vloeit naar de boedel.
>
> **Nog niet gebouwd.** Werken op een feature-branch `claude/lootverdeler-<id>`.

---

## Gebruikersflow (het volledige scenario)

1. DM definieert loot in de encounter-editor (goud + itemlijst).
2. DM start een gevecht vanuit die encounter → `combat.encounterId` wordt meegegeven.
3. Alle monsters bereiken 0 HP → overwinningsanimatie speelt.
4. DM ziet knop **"Verdeel loot"** in het gevechtspaneel (verschijnt naast "End combat").
5. DM opent de loot-modal: overzicht van items + goud uit de encounter-definitie.
   DM kan nog aanpassen (item toevoegen, verwijderen, bedrag aanpassen) vóór het versturen.
6. DM klikt **"Stuur naar spelers"** → socket `loot:aangeboden` → spelers zien een nieuw
   paneel in hun **Boedel-subtab** (badge op de tab).
7. Spelers tikken op items om te **claimen**. Goud is niet claimbaar — dat splitst automatisch.
   Andere spelers zien live hoeveel claims een item al heeft (naam verborgen, teller zichtbaar).
8. DM sluit de claimfase: **"Verdeling afsluiten"**.
9. Server verwerkt:
   - **0 claims**: item staat open voor handmatige toewijzing of verdwijnt.
   - **1 claim**: direct toegewezen.
   - **2+ claims**: dobbelrol voor alle claimers, hoogste wint. Bij gelijkspel opnieuw.
   - **Goud**: evenredig verdeeld over de deelnemers. Rest-centjes naar de groepskas
     als `sharedPurse.enabled`, anders naar de eerste speler op alfabet.
     Bij `sharedPurse.enabled` gaat het **hele** goudbedrag naar de groepskas.
10. Socket `loot:verdeeld` → items verschijnen in elke speler z'n boedel-carousel,
    goud wordt bijgeschreven, toast: *"Je hebt [item] ontvangen"* / *"[X fl Y kn] bijgeschreven"*.
11. DM ziet de dobbelresultaten in de modal (voor om te vertellen aan tafel).

---

## Datamodel

### `encounters.json` — loot-veld per encounter

```json
{
  "id": "enc_...",
  "name": "Bosovervalling",
  "monsters": [...],
  "loot": {
    "goud": { "fl": 12, "kn": 5, "cl": 0 },
    "items": [
      {
        "id": "li_...",
        "naam": "Potion of Healing",
        "beschrijving": "Heelt 2d4+2 HP.",
        "rariteit": "common",
        "entityId": null
      },
      {
        "id": "li_...",
        "naam": "Cloak of Elvenkind",
        "beschrijving": "Voordeel op Stealth-checks.",
        "rariteit": "uncommon",
        "entityId": "e_1773523435078_abc"
      }
    ]
  }
}
```

`entityId` is optioneel — bij invullen wordt de item-naam/beschrijving/rariteit uit het entity
overgenomen op het moment van aanmaken van de lootfase (snapshot, geen live koppeling).

### `dm-state.json` — actieve lootfase

Nieuw blok `lootPhase` op het root-niveau van `dmState` (niet per groep —
er is maar één actief gevecht tegelijk):

```json
"lootPhase": {
  "actief": true,
  "encounterId": "enc_...",
  "deelnemers": ["char_a", "char_b", "char_c"],
  "goud": { "fl": 12, "kn": 5, "cl": 0 },
  "goudVerdeeld": false,
  "items": [
    {
      "id": "li_...",
      "naam": "Potion of Healing",
      "beschrijving": "Heelt 2d4+2 HP.",
      "rariteit": "common",
      "entityId": null,
      "claims": ["char_a", "char_c"],
      "winnaar": null,
      "dobbelrol": {},
      "status": "open"
    }
  ]
}
```

`status` van een item: `"open"` → `"toegewezen"` | `"overgeslagen"`.
`dobbelrol`: map `{ charId: rollResultaat }` — gevuld bij afsluiting als claims ≥ 2.
`deelnemers`: spelers die als combatant in het gevecht zaten op het moment van winnen
(afgeleid van `combat.combatants.filter(c => c.type === 'player').map(c => c.entityId)`).

### `combat.json` — encounterId meegeven bij start

Voeg `encounterId: string | null` toe aan het combat-object. Wordt meegegeven via
`POST /combat/start` (body: `{ encounterId }`, optioneel).

---

## Server (`routes/api.js`)

### Bestaande ankers

| Locatie | Wat |
|---|---|
| `POST /combat/start` (~3527) | Voeg `combat.encounterId = req.body.encounterId || null` toe |
| `PUT /combat/winner` (~4322) | Emit `loot:winner` als `winner === 'players'` zodat DM-panel de knop toont |
| `_combatLog` (~3503) | Hergebruiken voor loot-log |
| `playerItems[charId].push(...)` (~1791) | Hergebruiken voor item-toewijzing |
| `playerCurrency[charId]` + `toCl/fromCl` (~959) | Hergebruiken voor goud-bijschrijving |
| `sharedPurse` per groep (~1866) | Controleren bij goud-split |

### Nieuwe endpoints

```
POST   /combat/loot/start       requireDM   Maak lootfase aan (vanuit encounter of leeg)
GET    /combat/loot              attachRole  Huidige lootfase opvragen
PUT    /combat/loot              requireDM   Lootfase aanpassen (items/goud vóór reveal)
POST   /combat/loot/reveal       requireDM   Stuur loot naar spelers (zet actief=true, emit)
POST   /combat/loot/claim        attachRole  Speler claamt een item
POST   /combat/loot/verdeeld     requireDM   Sluit claimfase, voer verdeling uit
DELETE /combat/loot              requireDM   Annuleer / verwijder lootfase
```

#### `POST /combat/loot/start`

```
body: { encounterId? }
```

1. Lees de encounter op uit `encounters.json` → haal `loot` op (of gebruik lege loot).
2. Bepaal `deelnemers` uit de huidige `combat.combatants` (type `player` → `entityId`).
3. Sla op als `dmState.lootPhase = { actief: false, encounterId, deelnemers, goud, items, … }`.
   (`actief: false` = DM kan nog aanpassen, spelers zien nog niets.)
4. Emit `combat:updated` (DM-panel ververst).

#### `POST /combat/loot/reveal`

1. Zet `dmState.lootPhase.actief = true`.
2. Emit `loot:aangeboden` met `{ items: [...], goud, deelnemers }`.
3. Speler-clients tonen het loot-paneel.

#### `POST /combat/loot/claim`

```
body: { itemId }
```

1. Controleer: lootPhase actief, item bestaat, speler is deelnemer, nog niet gesloten.
2. Toggle: al geclaimd → verwijder claim, niet geclaimd → voeg toe.
3. Emit `loot:claim-update` met `{ itemId, claimCount }` (géén namen — spelers zien alleen het aantal).
4. DM-panel toont de volle claimlijst (namen wél zichtbaar voor de DM).

#### `POST /combat/loot/verdeeld`

1. Loop over alle items:
   - **0 claims** → `status: 'overgeslagen'` (DM kan later handmatig via `PUT /combat/loot`
     een winnaar aanwijzen en `status: 'toegewezen'`).
   - **1 claim** → `winnaar = claims[0]`, push item naar `playerItems[winnaar]`.
   - **2+ claims** → gooi `Math.random()` per claimer, sla op in `dobbelrol`,
     hoogste wint (bij gelijk: herhalen tot er een winnaar is — max 5 rondes, daarna
     willekeurig kiezen). Push item.
2. Goud verdelen:
   - Als `sharedPurse.enabled`: `sharedPurse += goud` in één keer → emit `party-currency:updated`.
   - Anders: `toCl(goud)` ÷ `deelnemers.length` = aandeel per speler (Math.floor).
     Rest-cl gaat naar de groepskas als `sharedPurse.enabled`, anders naar de eerste
     deelnemer (alfabet op characterId).
3. Emit `player:items-updated` + `player:currency-updated` per geraakt karakter.
4. Emit `loot:verdeeld` met de volledige verdelingsuitslag (items, dobbelrol-resultaten,
   goud-aandelen) → DM-modal toont uitslag, spelerpaneel sluit.
5. Zet `lootPhase.actief = false` (fase blijft beschikbaar voor eventuele overgeslagen items).

---

## Frontend

### DM-paneel (`dm-panel.js`)

**Gevecht-subtab — na victory:**

Luister op `combat:updated`. Als `combat.winner === 'players'` en er geen actieve lootfase is:
toon knop **"Verdeel loot"** (`icon('coins') + dm-btn dm-btn-primary`) naast "End combat".

**Loot-modal (nieuw `_renderLootModal()`):**

```
┌─────────────────────────────────────────────────────┐
│ Loot — Bosovervalling                    [Sluiten ✕] │
├─────────────────────────────────────────────────────┤
│ Goud:  [12] fl  [5] kn  [0] cl                      │
│                                                     │
│ Items                                    [+ Toevoegen]│
│  ┌─────────────────────────────────────────────────┐│
│  │ ◆ Potion of Healing  (common)   Claims: 2  [✕] ││
│  │   char_a · char_c                               ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │ ◆ Cloak of Elvenkind (uncommon) Claims: 0  [✕] ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│ Deelnemers: Mira, Tariel, Gond (3 spelers)          │
│                                                     │
│ [Opslaan]                [Stuur naar spelers →]     │
└─────────────────────────────────────────────────────┘
```

Na "Stuur naar spelers": knop verandert in **"Verdeling afsluiten"** (danger) +
live claim-tellers verversen via `loot:claim-update`.

Na afsluiting: dobbelresultaten tonen per contested item ("Mira gooit 14, Tariel 7 — Mira wint!"),
en een samenvatting per speler.

**Overgeslagen items:** na de verdeling toont de modal eventuele overgeslagen items met een
dropdown "Toewijzen aan…" per item + "Sla over"-knop.

### Spelerstabblad (`app.js`)

**Boedel-subtab:**

- Badge (oranje stip) op de "Boedel"-tab als `lootPhase.actief` en speler is deelnemer.
- Bovenaan de boedel-sectie: loot-paneel (verdwijnt als de fase gesloten is).

```
┌─────────────────────────────────────────────────────┐
│  Loot beschikbaar!                    [icon('coins')]│
│                                                     │
│  ◆ Potion of Healing (common)       [Claim] / [✓]  │
│    Heelt 2d4+2 HP.                                  │
│    Claims: 2 andere spelers willen dit ook          │
│                                                     │
│  ◆ Cloak of Elvenkind (uncommon)    [Claim]         │
│                                                     │
│  Goud: 4 fl 1 kn 6 cl (jouw aandeel)               │
│  (wordt bijgeschreven bij afsluiting)               │
└─────────────────────────────────────────────────────┘
```

Stijl: perkament-kaart (`.dm-feature-section`-achtig), rariteitskleur op de `◆`,
`icon('coins')` voor goud. Geen emoji.

**Toasts na verdeling:**
- Item gewonnen: *"Je ontvangt: Potion of Healing"* (perkament-toast, 4s).
- Item verloren bij dobbelrol: *"Tariel wint de Cloak of Elvenkind (jij: 7, Tariel: 14)"*.
- Goud: *"4 fl 1 kn bijgeschreven"*.

### Socket-events (client-side, `socket-client.js`)

```
loot:aangeboden    → window._lootFase = data; Boedel-badge tonen; her-render boedel-subtab
loot:claim-update  → update claim-tellers in loot-paneel (speler) + modal (DM)
loot:verdeeld      → sluit loot-paneel, toon toasts, ververs boedel + beurs
```

---

## Encounter-editor uitbreiding (`dm-panel.js` `_renderEncounterEditor()`)

Nieuwe sectie **"Loot"** onderaan de encounter-editor (na de monsters-lijst):

```
Loot
  Goud   [__] fl  [__] kn  [__] cl
  Items                          [+ Item toevoegen]
    [naam___________] [beschrijving________] [rariteit ▾] [✕]
    (of: zoek entity → naam/beschrijving/rariteit worden overgenomen)
```

Opgeslagen via bestaande `PUT /encounters/:id` (loot-veld wordt gewoon meegestuurd).

---

## Aandachtspunten

- **Deelnemers bepalen:** bij `POST /combat/loot/start` — gebruik de combatants van
  het *lopende* gevecht. Als het gevecht al beëindigd is (`endCombat` aangeroepen),
  zijn de combatants weg. Dus: DM moet loot starten **vóór** "End combat", óf we
  bewaren de deelnemerslijst al bij `PUT /combat/winner` in de lootPhase.
  **Oplossing:** bij `combat.winner = 'players'` in `PUT /combat/winner`
  automatisch een lege lootPhase aanmaken met de deelnemerslijst vastgelegd.
  DM kan dan ook na "End combat" nog loot starten.

- **Geen encounter gekoppeld:** combat gestart zonder `encounterId` → loot-modal opent leeg,
  DM vult handmatig. Knop heet dan gewoon "Verdeel loot" (geen encounter-naam in de kop).

- **Speler niet online tijdens claiming:** DM kan na afsluiting overgeslagen items
  handmatig toewijzen via de modal. Of: DM wijst ze vóór het starten direct toe
  via de dropdown.

- **Versienummers:** `dm-panel.js` en `app.js` worden beide geraakt → beide bumpen.
  `routes/api.js` → serverkant, geen versie nodig.

- **Backup spelersdata:** vóór `POST /combat/loot/verdeeld` uitvoeren →
  `dm-state.json` backup verplicht (playerItems + playerCurrency raken).
  In de servercode: maak een backup-snapshot (`_snapshotDmState()`) als helper.

- **Gemeenschappelijke beurs:** check `g.sharedPurse.enabled` bij goud-split.
  Als ingeschakeld: alles naar `sharedPurse`, emit `party-currency:updated` (bestaand event).

- **Rariteits-pill in loot-paneel:** hergebruik `_rarityKey()` uit `render-campagne.js`
  voor de kleurcodering op de claim-kaartjes — consistent met de boedel-carousel.

- **Dobbelanimatie:** optioneel (later te verfijnen) — bij `loot:verdeeld` kan de server
  de dobbelresultaten meesturen en de client een korte animatie tonen (bestaande
  `dice`-CSS hergebruiken). Niet blokkerend: de verdeling is al voltooid aan serverzijde.

---

## Prioriteit & inschatting

| Onderdeel | Inschatting | Volgorde |
|---|---|---|
| Encounter-editor: loot-sectie | S | 1 |
| `POST /combat/start` + `encounterId` koppeling | XS | 1 |
| Lootfase aanmaken bij winner (deelnemers vastzetten) | XS | 1 |
| Server-endpoints (start/reveal/claim/verdeeld) | M | 2 |
| DM loot-modal + claim-tracking | M | 3 |
| Speler loot-paneel + toasts | S | 3 |
| Socket-events client-side | S | 3 |
| Dobbelanimatie (optioneel) | S | 4 (later) |

Totaal: **M–L**. Realistisch in één werksessie te bouwen als de encounter-editor
en server-endpoints eerst staan.
