# Grisburgh — Huisdieren / Metgezellen (bouwplan)

> Werkdocument. **Nog niet gebouwd.** Uitgewerkt bouwplan voor functionele huisdieren
> ("metgezellen") die je adopteert bij De Magizoöloog, een vol statblock hebben, **schalen met
> het level van hun baasje** en als familiar/summon in een gevecht kunnen meedoen.
>
> Volgt de afspraken uit `CLAUDE.md` en de stijl van `FEATURE-PLANNEN.md`.

---

## Beslissingen (vastgelegd met de DM)

| Vraag | Keuze |
|---|---|
| **Verwerving** | Adoptie via een dienst, **als extra functie van De Magizoöloog** (zelfde stramien, géén losse dienst). |
| **Mechaniek** | **Vol statblock** (hergebruik `render-statblock.js`). Huisdier ís een `personage`-entity met `subtype:'dier'` — die categorie bestaat al. |
| **Eigenaar** | Een huisdier hoort bij **één specifiek personage** (het baasje = de adopterende speler). Schaalt met diens level. Verschijnt nog steeds bij de hele party. |
| **Schaalmodel** | **Benoemde tiers** met eigen statblock + naam (zoals de Reddit-honden: Dog → Guard Dog → War Dog → Battle Hound). DM stelt per tier een minimum-level in. |
| **Gevecht** | **Auto-statblock + 1-klik toevoegen.** Bij toevoegen aan een gevecht wordt de geschaalde statblock + `ownerId` automatisch ingevuld; plus een knop "Voeg metgezellen van de party toe". |
| **Fasering** | Gefaseerd: **Fase 1** (adoptie + statblock + schalen) eerst, daarna **Fase 2** (gevecht-integratie + de rest van Leeuwenvelders assortiment als tier-data). |

**Algemene afspraken (uit `CLAUDE.md`, gelden voor élke stap):**
- UI-taal **Nederlands**, D&D-termen **Engels** (statblock-labels: Armor Class, Saving Throws, Multiattack…).
- Iconen via `icon()` — **nooit emoji** in gerenderde HTML (`paw-print`, `swords`, `heart`…).
- Perkament-thema bewaken (Cinzel/Crimson/IM Fell; okertinten).
- **Versienummers bumpen** bij elke deploy (index.html + app.js-imports).
- **Backup spelersdata** vóór server-side wijziging die het spelerstabblad raakt (`companions`, `playerCurrency`, `playerProfiles`).
- Socket altijd `io.to(campaignId).emit(...)`, nooit `io.emit(...)`.
- Destructieve/betaalde acties achter `confirm()` of een zichtbare knop (adoptie kost florinde → `confirm()`).

---

## Wat er al is (code-ankers)

**Companions (DM-gedreven, half af)**
- `routes/api.js:1925–1987` — `GET /companions`, `GET /companions/status/:npcId`, `POST/DELETE /companions/:npcId/:groupId`. Opslag: `groups[gid].companions: string[]` (NPC-entity-ids). Socket: `companion:link` / `companion:unlink`.
- `public/js/app.js:4673–4687` — companions als portretje in de Party-balk; klik → `_openDetail('personages', id)`.
- `public/js/socket-client.js:494–511` — toasts bij link/unlink.
- `public/js/api.js` — wrappers `getCompanions`, `linkCompanion`, `unlinkCompanion`.

**De Magizoöloog (dienst, het uit te breiden stramien)**
- `routes/api.js:4885` — `GET /magizoo` (config + monsters + currency + cooldown).
- `routes/api.js:4908` — `POST /magizoo/onderzoek` (betaling + cooldown + socket).
- `routes/api.js:4975` — `PUT /meta/magizoo` (config, `allowed`-whitelist).
- `public/js/app.js:8079` — `renderMagizoo()` (scene + lijst + resultaatblok).
- `public/js/dm-panel.js:4143` — `_renderMagizooSettings()` (portret/backdrop/groet/prijs/cooldown).

**Statblock (render + editor)**
- `public/js/render-statblock.js` — `renderStatblock(m, { niveau })`; werkt op elk object met `{ name, statblock, maxHp, description }`. Tiers `naam/deels/volledig` (voor huisdieren gebruiken we altijd `volledig`).
- `public/js/dm-panel.js:2069` — `_statblockHtml(m)`; `:2091` — `_statblockEditorHtml(sb)` (de bewerk-UI voor monster-statblocks). **Nog niet gedeeld** met `render-campagne.js`.

**Personage-entities & dier-categorie**
- `public/js/render-campagne.js:137` — subtypes: `['NPC','speler','antagonist','god','dier','verkoper']`.
- `public/js/render-campagne.js:232` — `'dier'` → `icon('paw-print')`.
- `public/js/render-campagne.js:2555–2563` — subtype-keuze in de entity-editor.
- `public/js/render-campagne.js:1325` — `window._openDetail(tab, id, …)` (detailvenster dat companions openen).

**Gevecht / summons**
- `routes/api.js:4130–4152` — `POST /combat/combatant` (velden: `name, entityId, presetId, imageId, backdropId, type, initiative, hp, maxHp, ac, conditions, statblock, deathSaves`). Geen `ownerId`.
- `routes/api.js:4154–4186` — `PUT /combat/combatant/:id`; `:4172–4176` — win-detectie (`type==='monster'` → vijand).
- `routes/api.js:~4062–4126` — combat-root (`active, round, currentTurn, combatants[], log, winner, concentratiePrompt`).
- `public/js/dm-panel.js:3156–3176` — `_getTurnGroup()`: `type==='player' || 'summon'` handelen samen op gelijk initiative.
- `public/js/dm-panel.js:3079–3112` (setup) en `:3228–3243` (mid-combat) — combatant toevoegen via `api.addCombatant(payload)`.
- `public/js/dm-panel.js:5512/5648/5734` — render summon-dot + statblock-knop.
- `public/js/combat-canvas.js:88–89` — kleuren `_pc` (spelers, blauw) / `_mc` (monsters, rood).

**Level (bron van waarheid)**
- `dm-state.json → playerProfiles[characterId].level` (en `klasseLevel`).
- `routes/api.js:2029–2066` — `GET/PATCH /player-profile/:characterId` (`allowed` bevat `level`, `klasseLevel`).
- `public/js/app.js:4285, 6030–6054` — client leest profiel; `triggerSync` bij level/klasse-wijziging.

---

## Datamodel

### Dier-entity (`entities.json → personages[]`, `subtype:'dier'`)
Bestaande velden hergebruikt: `name`, `image` (entity-id), `data.ras`, `data.klasse`, `description`.

Nieuwe velden:

| Veld | Vorm | Doel |
|---|---|---|
| `statblockTiers` | `[{ minLevel:number, label:string, statblock:{…}, maxHp:number }]` | Benoemde schaaltiers. Gesorteerd op `minLevel`. De *special action* (bv. Jip's vondst, Barry's gevloek) staat in `statblock.traits` of `statblock.actions` — wordt al gerenderd. |
| `statblock` | `{…}` (optioneel) | Fallback voor een huisdier **zonder** schaling (één vaste statblock). Genegeerd zodra `statblockTiers` bestaat. |
| `data.adopteerbaar` | `boolean` | `true` → aangeboden bij De Magizoöloog. |
| `data.adoptiePrijs` | `{ fl, kn?, cl? }` | Adoptiekosten. |
| `data.soortLabel` | `string` (optioneel) | Korte soort-aanduiding voor de adoptiekaart (bv. "Terriërpup", "Raafautomaton"). |

> **Statblock-vorm** = identiek aan `monsters.json` (zie `render-statblock.js`): `size, type, alignment, ac, hp, speed, str…cha, savingThrows, skills, damageResistances/Immunities, conditionImmunities, senses, languages, traits, actions, reactions, legendaryActions, cr, xp`. Plus top-level `maxHp` voor het HP-getal.

### Eigenaarschap (per baasje)
Companions blijven groep-breed zichtbaar, maar krijgen een **baasje**. Backward-compatibel naast het bestaande `companions: string[]`:

```jsonc
// dm-state.json → groups[gid]
"companions": ["e_pet_jip"],                 // ongewijzigd (party ziet ze)
"companionOwners": { "e_pet_jip": "e_1778689148089_pypw" }  // NIEUW: petId → characterId
```

`ownerId` ontbreekt → val terug op groep-breed (schaalt dan op hoogste party-level).

### Combatant (`combat.json → combatants[]`)
Eén nieuw veld:

| Veld | Doel |
|---|---|
| `ownerId` | `characterId` van het baasje. Maakt herberekening van de geschaalde statblock mogelijk bij level-wijziging, en markeert de pet visueel als "van speler X". |

`type` blijft `'summon'` (valt al aan de spelerskant, deelt initiative-blok). De `statblock` op de combatant wordt gevuld met de **bevroren, geschaalde** tier op het moment van toevoegen (zie hieronder).

---

## Schaallogica (gedeelde helper)

Eén pure functie, **identiek op server en client** (server: in `routes/api.js` of `lib/`; client: in `render-statblock.js` zodat detailvenster + DM-paneel dezelfde uitkomst tonen):

```
activeTier(entity, ownerLevel):
  tiers = entity.statblockTiers || []
  if tiers leeg: return { statblock: entity.statblock, maxHp: entity.maxHp, label: entity.name }
  gesorteerd op minLevel oplopend
  kies de hoogste tier met minLevel <= ownerLevel (fallback: laagste tier)
  return die tier
```

- **ownerLevel** = `playerProfiles[ownerId].level` (of `klasseLevel`), met fallback 1.
- Bij groep-eigenaarschap (geen `ownerId`): hoogste `level` binnen de groep.
- De **naam in het statblock** wordt de tier-`label` (bv. "Battle Hound"), met de eigennaam ("Jip") als ondertitel/aanhef — zo zie je zowel het beestje als zijn huidige slagkracht.

---

## Fase 1 — Adoptie + statblock-weergave + schalen

### Server (`routes/api.js`)
1. **`GET /magizoo`** uitbreiden → extra veld
   `adoptabel: [{ id, name, imageId, soortLabel, ras, prijs, samenvatting }]`
   = alle dier-entities met `data.adopteerbaar === true`, minus wat de groep al bezit. `samenvatting` = eerste regel van de laagste tier's `traits`/`actions` (de special action), kort.
2. **`POST /magizoo/adopteer`** (speler) — nieuw:
   - valideer `petId` (bestaat, `adopteerbaar`, nog niet in `companions`);
   - saldo-check + betaling (`toCl`/`fromCl`, zoals `magizoo/onderzoek`);
   - voeg toe aan `groups[gid].companions[]`; zet `groups[gid].companionOwners[petId] = characterId`;
   - emit `companion:link` + `player:currency-updated`;
   - bezorg een adoptiebewijs-brief via `_bezorgBrief` (perkament, `paw-print`-logo, géén emoji);
   - blokkeer dubbele adoptie.
3. Statblock-/tier-opslag loopt via het **bestaande entity-PUT-endpoint** voor personages — verifiëren dat vrije velden (`statblockTiers`, `statblock`) persistent zijn; zo niet, veld toevoegen aan de `allowed`-lijst.

### Frontend
4. **`render-statblock.js`** — `_statblockHtml` + `_statblockEditorHtml` hierheen verplaatsen/exporteren (gedeelde helper, conform de intentie in `FEATURE-PLANNEN.md` §3). Voeg `activeTier()` toe. `dm-panel.js` (monsters) en `render-campagne.js` (dieren) gebruiken voortaan dezelfde helpers. Render zelf ongewijzigd → regressie-veilig.
5. **`render-campagne.js`**
   - Entity-editor bij `subtype:'dier'`: een **tier-editor** (lijst van tiers; per tier `minLevel` + `label` + de bestaande statblock-editor) + toggle "Adopteerbaar via De Magizoöloog" + prijsveld + `soortLabel`. "Tier toevoegen"/"verwijderen" (verwijderen achter `confirm()`).
   - Entity-detailvenster bij `subtype:'dier'`: toon de **actieve tier** via `renderStatblock(activeTier(entity, ownerLevel), { niveau:'volledig' })`, met een kleine tier-indicator ("Tier 2/4 — Guard Dog, schaalt op level 5").
6. **`app.js → renderMagizoo()`** — tweede sectie "Adopteer een metgezel" onder Onderzoek: kaartjes (portret, `soortLabel`, special-action-samenvatting, prijs, "Adopteer"-knop) + `window._magizooAdopteer(petId)` met `confirm()`. Lege staat: "De Magizoöloog heeft vandaag geen dieren ter adoptie."
7. **`api.js`** — wrapper `adopteerPet(petId)` → `POST /magizoo/adopteer`.
8. Companion-detail werkt automatisch: companions openen al `_openDetail('personages', id)`, dat na stap 5 het (geschaalde) statblock toont.

### Schalen buiten gevecht
9. Detailvenster + Party-portret-ondertitel tonen de tier-`label` op basis van het level van het baasje. Bij `player:profile-updated` / level-sync (`app.js:6030–6054`) het detailvenster verversen zodat de tier meegroeit.

---

## Fase 2 — Gevecht-integratie + scaleable assortiment

### Server (`routes/api.js`)
1. **Combatant uitbreiden** — `POST /combat/combatant` en `PUT /combat/combatant/:id` accepteren `ownerId`.
2. **Auto-statblock** — als een combatant een dier-entity is (via `entityId`/`presetId` naar een `subtype:'dier'`-entity) of een `ownerId` heeft: vul `statblock` + `maxHp` + `hp` in met `activeTier(entity, ownerLevel)`. Tier wordt **bevroren** in de combatant (geen live herberekening midden in het gevecht).
3. **1-klik party-pets** — nieuw `POST /combat/voeg-metgezellen` (DM): pak alle `companions` van de huidige groep(en) die een dier-entity zijn, voeg ze toe als `type:'summon'` met `ownerId` + geschaalde statblock + redelijke default-initiative (bv. baasje-initiative of een eigen worp).
4. (Optioneel) bij level-up buiten gevecht: niets automatisch in een lopend gevecht; tier wordt pas bij de volgende toevoeging herberekend (bewust, voorspelbaar).

### Frontend
5. **`dm-panel.js`** — in de combat-setup en mid-combat-UI (`:3079`/`:3228`) een knop "Voeg metgezellen van de party toe" → `api.voegMetgezellen()`. Summon-render (`:5512` e.v.): toon eigenaar + tier-`label`; statblock-knop werkt al.
6. **`combat-canvas.js`** — summon-tokens met `ownerId` desgewenst een subtiel "pet"-randje/`paw-print`-marker; kleur blijft spelerskant (`_pc`).
7. **`api.js`** — wrapper `voegMetgezellen()`.

### Scaleable assortiment (tier-data invullen)
8. De **Dog-ladder** (Reddit, `IMG_9119`) als kant-en-klaar voorbeeld + seed voor honden-pets:

   | Tier | minLevel (voorstel) | Size | AC | HP | Kern |
   |---|---|---|---|---|---|
   | **Dog** | 1 | Small | 12 | 4 (1d6+1) | STR13 DEX14 CON12 INT7 WIS12 CHA7 · Bite +0 (1) · Keen Hearing and Smell · CR 0 |
   | **Guard Dog** | 5 | Small | 13 | 11 (2d6+4) | STR14 DEX14 CON14 WIS14 · Bite +4 (1d8+2) · CR 1/2 |
   | **War Dog** | 9 | Medium | 14 | 19 (3d8+6) | STR16 DEX15 CON14 · Bite +5 (1d8+3) · CR 1 |
   | **Battle Hound** | 14 | Medium | 15 | 37 (5d8+15) | STR18 CON16 WIS14 · **Multiattack** (2× Bite +6, 1d8+4) · CR 2 |

   (minLevel-banden zijn DM-instelbaar; bovenstaande is een redelijk startpunt.)

9. **Leeuwenvelders overige assortiment** (uit *Hoofdstuk 1: Dauwdag*) als scaleable dier-entities. Special action → `statblock.traits`/`actions`; hogere tiers verbeteren stats + special action:

   - **Jip** — terriërpup → "Speurhond" → "Trouwe Waakhond". *Special:* "Bij aankomst op een nieuwe plek, rol 1d4; bij 4 vindt Jip een voorwerp (rol 1d6 op de vondsttabel)." (Hond → leun op de Dog-ladder voor stats.)
   - **Mystique** — alerte zwarte kat → schaal richting alertheid/stealth. *Special:* "Wanneer een vijand probeert te overvallen, rol 1d6; bij 5–6 alarmeert Mystique de party." (hogere tier: bij 4–6.)
   - **Barry** — dwergpapegaai. *Special:* "Bij een Stealth/Persuasion-check, rol 1d6; bij 1 begint Barry te vloeken." (hogere tier: leert nuttige kreten — voordeel op Intimidation o.i.d.)
   - **Freddy** — zwevende snoekbaars (waterbubbel, blijft binnen 30 ft). *Special:* "Staartvin-klap" als minor harass; hogere tier: kleine flank-/afleidingsbonus.
   - **R4V3N** — raafautomaton. *Special:* "Een penveer dient als *lockpick*"; hogere tier: scout/`Perception`-boost, eventueel `Help`-actie op afstand.

   > Stats voor niet-honden: kies passende SRD-beesten als basis (Cat, Hawk/Raven, Quipper/“flying fish”) en bouw 2–4 tiers met oplopende AC/HP/attack + uitbreidende special action. Per pet in de dier-entity-editor invoeren.

---

## Aandachtspunten

- **Backward-compat:** ontbrekend `statblockTiers` → val terug op `statblock`; ontbrekend `ownerId`/`companionOwners` → groep-breed schalen. Bestaande companions blijven werken.
- **Bevriezen in gevecht:** de tier wordt bij toevoeging vastgelegd op de combatant; geen verspringende stats midden in een ronde.
- **Eén bron voor schaling:** `activeTier()` in `render-statblock.js` (client) en een spiegel in de backend — houd ze identiek (overweeg een gedeelde `lib/`-helper + import in `routes/api.js`, en een aparte client-export).
- **Geen dubbele dataset:** een huisdier is één dier-entity; tiers leven daarop. Géén apart `pets.json`.
- **Versies bumpen** bij deploy: `render-statblock.js`, `render-campagne.js`, `app.js`, `dm-panel.js`, `api.js` + `index.html` (zie tabel in `CLAUDE.md`).
- **Backup** vóór de eerste adoptie-/gevecht-test op de server (raakt `companions`, `companionOwners`, `playerCurrency`).
- **NL/EN:** knoppen/toasts NL ("Adopteer", "Voeg metgezellen toe"); statblock-termen EN (Multiattack, Bite, Keen Hearing and Smell).

---

## Testplan (Test McTestface, groep 3 — Wizard L7)

**Fase 1**
1. DM markeert/maakt dier-entity "Jip" met 2+ tiers (minLevel 1 / 5 / …), `adopteerbaar`, prijs.
2. Speler → Diensten → De Magizoöloog → "Adopteer een metgezel" → Jip → `confirm()` → saldo daalt, toast, Jip in Party-balk.
3. Klik Jip → detailvenster toont vol statblock van de **actieve tier** (L7 → tier "≥5"), met tier-indicator.
4. DM zet Test McTestface op L9 → detailvenster/portret tonen de volgende tier.
5. DM-paneel → companion ontkoppelen → Jip verdwijnt bij speler (`companion:unlink`).

**Fase 2**
6. DM start gevecht → "Voeg metgezellen van de party toe" → Jip verschijnt als summon aan spelerskant met geschaalde statblock + eigenaar-label.
7. Jip deelt het initiative-blok van Test McTestface; statblock-knop toont de juiste tier.
8. Hond-ladder: een L14-baasje levert "Battle Hound" met Multiattack.

---

## Open punten

- Exacte **minLevel-banden** per pet (voorstel hierboven; DM finetunet in de editor).
- **Stat-bases** voor niet-honden (Cat/Raven/“flying fish”) — vastleggen bij het invullen van het assortiment in Fase 2.
- Wil de DM ook **handmatig** een tier kunnen forceren (los van level)? Eventueel later een "vaste tier"-override op de companion.
