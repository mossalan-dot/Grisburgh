# Het personage-kaartje — wat er beter kan

Werkdocument, 5 sep 2026. Ontstaan bij het aanmaken van het eerste kaartje in
een verse campagne. **Wat hier staat is nog niet gebouwd**, op de kleine dingen
na die al gedaan zijn (labels, opmaakbalk, modifiers, Traits).

---

## 1. Ras en klasse worden keuzelijsten

Nu zijn het vrije tekstvelden. Dat leest prima, maar je kunt er niet op
filteren en iedereen typt het net anders ("half-elf", "Half Elf", "halfelf").
Voorstel: een **zoekbaar `<input list=…>`** — dezelfde vorm als de entiteit-
kiezers in de Meesterkamer, dus typen filtert en je mag ook iets invullen dat
er niet in staat. Geen `<select>`, want dan kan een campagne met eigen volken
niets meer.

**Klassen** (13): Artificer, Barbarian, Bard, Cleric, Druid, Fighter, Monk,
Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard. Multiklasse blijft
mogelijk als vrije tekst ("Wizard/Fighter").

**Volken** in twee groepen, want de lijst is lang:

*Gangbaar (PHB 2024 + klassiek):* Human, Elf, Dwarf, Halfling, Dragonborn,
Gnome, Half-Elf, Half-Orc, Tiefling, Orc, Aasimar, Goliath.

*Verder:* Aarakocra, Bugbear, Centaur, Changeling, Deep Gnome, Duergar,
Eladrin, Fairy, Firbolg, Genasi, Githyanki, Githzerai, Goblin, Harengon,
Hobgoblin, Kalashtar, Kenku, Kobold, Leonin, Lizardfolk, Loxodon, Minotaur,
Owlin, Satyr, Sea Elf, Shadar-kai, Shifter, Simic Hybrid, Tabaxi, Tortle,
Triton, Vedalken, Verdan, Warforged, Yuan-ti.

Bron: rpgbot.net/dnd5/characters/races. De lijst hoort in `bronnen/` (net als
spreuken en progressie) zodat een campagne hem kan aanvullen.

**Let op:** de progressie-tab matcht al op klasse- en soortnamen (fuzzy, met
aliassen). Een keuzelijst maakt die match betrouwbaarder — dat is meteen de
tweede winst.

## 2. Geheimen: van één veld naar een lijst

Nu is `geheim` één tekstveld met één schakelaar: onthuld of niet. Een NPC
heeft zelden één geheim. Voorstel: **een lijst** van `{ tekst, onthuld }`,
met per regel een oogje om hem vrij te geven — precies zoals de reveal-strook
bij aktes werkt.

- Bestaande data blijft werken: een string wordt één regel in die lijst.
- Het badge op het kaartje wordt "1 van 3 onthuld" in plaats van aan/uit.
- Onthullen blijft per party (`secretReveals` hangt al aan de groep), dus de
  ene tafel kan verder zijn dan de andere.

Hetzelfde zou voor **flavour** kunnen (meerdere roddels over dezelfde persoon),
maar dat is minder urgent: daar is er meestal één per persoon, en de herberg
pikt ze al één voor één op.

## 3. Subtypes: kind en rol door elkaar

> **Uitgewerkt voorstel, 5 sep.** Wat hieronder in dit hoofdstuk staat was de
> eerste schets; het voorstel dat we gaan bouwen staat in *3a*.

## 3a. Voorstel: vier subtypes, drie rollen, één kant

**Wat er nu staat** (Grisburgh, 168 personages): NPC 96 · god 23 · antagonist 20 ·
verkoper 10 · speler 10 · dier 6 · leeg 3.

### Subtype — wat voor kaartje is dit? (één waarde)

| Subtype | Wat het ontsluit in de app |
|---|---|
| **NPC** | de standaard. Iedereen die de party kan tegenkomen. 96 kaartjes. |
| **Speler** | party-tab, boedel, progressie, spreukenboek, character sheet, HP en Hit Dice, login via de personagekiezer, meedoen aan loot en rust. Dit is verreweg de zwaarste schakelaar in de app. |
| **Dier** | statblock dat meeschaalt met het level van het baasje (`statblockTiers`), adoptie via de Magizoöloog, en meelopen als medestander. **Summon, rijdier en familiar vallen hieronder** — dat is geen apart soort kaartje, dat is een dier met een rol. |
| **God** | de Tempel: eden, zegeningen, priesters. 23 kaartjes. |

Daarmee is de vraag "waar blijft de generieke NPC" beantwoord: **NPC blijft
gewoon het subtype**, en is meteen de standaardwaarde. Wat verdwijnt zijn
*verkoper* en *antagonist* — dat zijn geen soorten kaartjes maar rollen.

### Rollen — wat doet dit personage? (tags, meerdere tegelijk)

| Tag | Wat het doet |
|---|---|
| **Verkoper** | zet de voorraad-sectie aan: kopen, verkopen, uitverkocht per party. Nu een subtype, straks een tag — dan kan een verkoper ook antagonist zijn, en dat is het leukste soort verkoper. |
| **Missiegever** | filter: bij wie loopt een draad? *Missiegever* en niet *questgever*, want de app noemt ze Missies. |
| **Antagonist** | kleur en badge op de kaart. De bestaande "geheime antagonist"-schakelaar zet straks de tag in plaats van het subtype. |

**Niet opgenomen, en waarom:**
- *Huurling* — dat is een medestander die betaald wordt; het verschil zit in het
  verhaal, niet in wat de app moet doen.
- *Gevangene* — een toestand, geen rol. Hoort in de tekst of in een geheim.
- *Summon* en *rijdier* — een dier met een taak; het subtype dekt het al.
- *Medestander* — **bestaat al**, maar als toestand: `dmState.activeAllies` is de
  lijst met wie er nú meeloopt, en het gevecht vult ze automatisch aan. Een tag
  ernaast zou hetzelfde twee keer zeggen.

### Kant in gevecht — het stuk dat echt iets oplevert

Het gevecht kent al drie soorten deelnemers: `player`, `ally` en `monster`.
Spelers en monsters komen automatisch binnen; medestanders komen uit
`dmState.activeAllies`. Wat ontbreekt is een antwoord op de vraag *aan welke
kant hoort deze NPC als hij in een gevecht belandt* — nu wordt alles wat je met
de hand toevoegt een `monster`.

Voorstel: één veld op de kaart, `data.kant` — **bondgenoot · vijand · neutraal**
(leeg = onbepaald). Daarmee kan:

- het toevoegen van een NPC aan een gevecht meteen het juiste type kiezen
  (bondgenoot → `ally`, vijand → `monster`), inclusief de juiste kleur en plek
  in de initiatieflijst;
- de encounter-vuller voorstellen doen ("deze drie bondgenoten staan in deze
  akte naast de party");
- het tafelscherm bondgenoten en vijanden uit elkaar houden.

`activeAllies` blijft wat het is: wie er op dít moment meeloopt. De kaart zegt
wat iemand *is*, dm-state zegt wat er *nu* aan de hand is.

### Drie vragen die het voorstel scherper maakten

**Niet elk dier schaalt mee.** Klopt, en dat is geen bezwaar: `statblockTiers`
is optioneel. `_activeTier()` in `routes/api.js` valt zonder tiers netjes terug
op het vaste `statblock` van de entiteit — precies wat je wilt voor een rijdier
of een summon, die niet meegroeien met het level van hun baasje. Van de zes
dieren in Grisburgh heeft er nu nul tiers, en dat werkt gewoon. De tier-editor
moet dan wel ophouden te doen alsof je er minstens één *moet* maken: de tekst
wordt "zonder tiers gebruikt dit dier zijn vaste statblock — dat is wat je wilt
voor een rijdier of een opgeroepen wezen".

**Missiegever hangt nergens aan.** Ook waar, en dat is een reden om het
*géén* tag te maken. Een missie heeft nu `id, title, description, status,
chapter, notes` — geen gever. Beter dan een handmatig vinkje dat verjaart:

- **`missie.geverId`** erbij (een personage- of organisatie-kaartje).
- De **Missies-tab** toont "Gegeven door —" met een klik naar dat kaartje.
- Het **kaartje zelf** krijgt een blokje *Missies*: welke draden hangen aan deze
  persoon, met hun status. Dat is de winst — je opent een NPC en ziet meteen
  wat er met hem loopt.
- De **akte** koppelt al aan `chapter`, dus een regie-script kan tonen welke
  missies in deze akte spelen en wie ze gaf.
- De rol "missiegever" wordt daarmee **afgeleid**, niet ingevuld: wie een missie
  gaf, is missiegever. Niets om bij te houden.

**Gevangene: geen tag maar een toestand.** Net als een medestander is dit iets
wat *nu* het geval is, niet wat iemand ís. Zelfde vorm als `companions`:
`groups[gid].gevangenen[entityId] = { sinds, notitie }`.

- Zichtbaar in het **partytabblad** onder de medestanders: "In bewaring", met
  portret en sinds wanneer.
- De DM zet het aan vanaf het kaartje (knop naast overleden-markeren).
- Voor het **gevecht**: wie in bewaring is, doet niet vanzelf mee — en als je
  hem toevoegt, is hij geen bondgenoot maar een aanwezige die iets kan doen.
- Later kan de party hem vrijlaten, uitleveren of overtuigen; dat zijn dan
  gewoon knoppen bij die regel.

### Migratie

Automatisch, zonder handwerk: subtype `verkoper` → subtype NPC + tag verkoper
(10 kaartjes), subtype `antagonist` → subtype NPC + tag antagonist + kant vijand
(20 kaartjes). De drie kaartjes zonder subtype worden NPC. Filters, de
winkel-mechaniek en de geheime-antagonist-schakelaar gaan mee.

## 3b. De eerste schets (achterhaald)

Nu: NPC, speler, antagonist, god, dier, verkoper. Die zes zitten op drie
verschillende assen:

| As | Waarden | Wat het bepaalt |
|---|---|---|
| **Wat het is** | persoon, dier, god | statblok, portret, hoe het leest |
| **Wat het doet in het spel** | speler, verkoper | features: boedel, progressie, winkelvoorraad |
| **Wat het is in het verhaal** | antagonist | kleur, spanning, niets technisch |

Daardoor kan een verkoper geen antagonist zijn, terwijl dat het leukste soort
verkoper is. En "speler" is geen soort personage maar een **rol**: dat ene veld
zet er een boedel, progressie, spreukenboek, HP en een login achter.

**Voorstel:** `subtype` blijft wát het is (persoon, dier, god) en de rest wordt
een **tag-veld** (`data.tags`, meerdere tegelijk): verkoper, antagonist,
factielid, medestander… Filters werken dan op beide. Het spelerspersonage
verdient een eigen, zichtbaardere plek: **"Dit is een spelerspersonage"** als
schakelaar met de partykeuze eronder, in plaats van een waarde in een lijstje
waar je overheen leest.

Migratie is klein: bestaande subtypes `verkoper`/`antagonist` worden een tag,
`speler` wordt de schakelaar, en `NPC` wordt gewoon "persoon".

## 4. Spreuken koppelen in plaats van overtypen

Het statblok heeft vrije tekstvelden voor cantrips en spells. Dat is dubbel
werk en het levert niets op: geen kaartje, geen tooltip, geen klik. Voorstel:
naast het tekstveld een **spreukenkiezer** die schrijft naar
`stats.spellIndexes` (de `index` uit de spreukenbron). In het detailvenster
worden dat **chips** die het spreukdetail openen, met de juiste schoolkleur.

Het vrije veld blijft ernaast staan, want een eigen bedachte spreuk moet je
gewoon kunnen intypen. Zelfde patroon als bij loot: gekoppeld waar het kan,
los waar het moet.

## 5. Rollen: welke tags zijn het waard?

Als `subtype` alleen nog zegt wát iets is (persoon, dier, god), dan draagt de
tag wat het **doet**. Wat de moeite is:

| Tag | Waarvoor |
|---|---|
| **Verkoper** | heeft een voorraad; hangt aan de winkel-mechaniek |
| **Questgever** | staat aan de basis van een missie — handig om te filteren als je een draad zoekt |
| **Antagonist** | verhaalrol, geeft kleur op het kaartje |
| **Medestander** | reist met de party mee (`companions` bestaat al per groep) |
| **Summon** | tijdelijk opgeroepen; verdwijnt na het gevecht of de duur |
| **Rijdier** | eigen initiatief maar geen eigen wil |
| **Huurling** | vecht mee tegen betaling — economisch, niet emotioneel |
| **Gevangene** | zit ergens vast; verandert wat de party met hem kan |
| **Factielid** | hangt al aan `meta.facties`, maar als tag ook los bruikbaar |

**Voor de gevechtseconomie telt vooral iets anders dan de tag**: aan wélke kant
staat dit wezen als het in een gevecht komt. Dat is een eigen veldje —
*bondgenoot · vijand · neutraal* — en het is precies wat het encounter-vullen
nodig heeft om te weten of iets bij de party of tegenover de party in de
initiatieflijst hoort. Medestander, summon, rijdier en huurling zijn dan
allemaal "bondgenoot", maar om verschillende redenen; die reden hoort in de tag
en niet in de kant.

## 6. Wat de kaart nog mist

Wat je aan tafel nodig hebt in de seconde vóórdat je die NPC speelt, staat er
niet:

| Veld | Waarom |
|---|---|
| **Eerste indruk** (één zin) | wat de spelers zien als ze binnenkomen — nu moet je een lange beschrijving afstruinen |
| **Stem** | accent, tempo, een tic. Dit is het verschil tussen een naam en een personage |
| **Wat hij wil** | de enige regel waarmee je kunt improviseren als spelers iets onverwachts doen |
| **Wat hij vreest** | idem, en het geeft je meteen zijn zwakke plek |
| **Houding tegenover de party** | vriendelijk, afwachtend, vijandig — verandert in de loop van de campagne |
| **Gewoonlijk te vinden bij** | koppeling naar een locatie; nu alleen als `[[link]]` in de tekst |
| **Aanspreekvorm** | hij/zij/die, plus hoe mensen hem noemen ("meester", "ouwe") |
| **Banden** | niet alleen wíé, maar wát: broer van, schuldig aan, bang voor |

De eerste vier zou ik samen in één blok zetten (*Aan tafel*), boven het
statblok: dat is de volgorde waarin je ze nodig hebt.

## 7. Kleinere dingen

- **"Roddel uitgesproken door de waard"** staat als knopje in de editor, maar
  het is geen eigenschap van het personage — het is de stand van de herberg
  voor één party. Hoort dus niet bij het schrijven van een kaartje. Beter:
  weghalen uit de editor en tonen (en terugzetten) in het herberg-paneel, waar
  je ook ziet wat er al verteld is.
- **Statblok voor iedereen?** Een god of een winkelier heeft zelden AC en HP
  nodig. Het blok inklappen als het leeg is doen we al; het zou ook per subtype
  verborgen kunnen worden.

---

## Volgorde die ik zou aanhouden

1. **Ras en klasse als keuzelijst** — *gedaan 5 sep, samen met Alignment.*
   Lijsten staan in `bronnen/volken-klassen.json` en gaan via `/api/bron/`.
2. **Meerdere geheimen** — raakt hoe je speelt, en de reveal-strook bestaat al.
3. **Velden voor aan tafel** (eerste indruk, stem, wil, vreest) — puur
   toevoegen, niets breekt.
4. **Spreuken koppelen** — meer werk, maar het maakt van een statblok iets
   waar je doorheen kunt klikken.
5. **Subtypes opsplitsen** — het meest ingrijpend, want data en filters
   veranderen mee. Zou ik pas doen als de rest staat.
