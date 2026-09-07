# Voorstel: werking los van type (voorwerpen)

*Opgesteld 7 sep 2026. **Stap 1 is gebouwd** (7 sep). Stap 2 (spells koppelen)
is goedgekeurd en staat nog open; stap 3 (koppeling aan de stats) staat op de
todo-lijst.*

## Wat de 2024-regels doen

De negen categorieën (Armor, Potion, Ring, Rod, Scroll, Staff, Wand, Weapon,
Wondrous Item) beschrijven **wat een ding is**, niet wat het doet. Die twee
lopen structureel niet gelijk:

- **Staff of Striking** is een Staff *en* een wapen met schade *en* heeft charges.
- **Bracers of Defense** (+2 AC) en **Ring of Protection** (+1 AC en saves) zijn geen Armor.
- **Periapt of Wound Closure** geneest, maar is een Wondrous Item.
- **Necklace of Fireballs** is een sieraad dat je gooit voor schade.
- **Wand of Magic Missiles** en **Staff of Fire** casten spells, maar zijn geen Scroll.

Bronnen: [D&D Beyond — Magic Items (2024)](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items),
[Roll20 Compendium](https://roll20.net/compendium/dnd5e/Rules:Magic%20Items?expansion=33335),
[Arcane Eye — 20 nieuwe magische voorwerpen in de DMG 2024](https://arcaneeye.com/articles/20-new-magic-items-in-the-2024-dungeon-masters-guide/).

## Waarom het knelt — geteld op productie (249 voorwerpen, 7 sep 2026)

| | |
|---|---|
| Schade ingevuld | 42 — allemaal type Weapon |
| AC ingevuld | 14 — allemaal Armor of Shield |
| Wondrous item / Ring / Amulet | 31, waarvan **0** met schade of AC |
| Potions | 13, waarvan **0** met een genezingsformule |
| Scrolls | 33, waarvan **0** met een ingevuld spell-veld |

Die nullen zijn geen toeval: de app staat het niet toe. En de 33 scrolls laten
zien dat de spellkiezer nooit gebruikt is — de tekst staat gewoon in `desc`.

## Voorstel 1 — `data.werking` naast `data.itemType`

Zelfde splitsing als bij personages (`subtype` = wat is het, `data.tags` = welke
rol). `itemType` blijft de categorie (badge, icoon, winkelindeling);
`data.werking` wordt een set vinkjes die elk hun eigen veldgroep ontsluiten.

| Vinkje | Velden | Voorbeelden |
|---|---|---|
| Attack | schadeformule, wapeneigenschappen | +1 Longsword, Staff of Striking, Necklace of Fireballs |
| Defense | AC / bonus, harnastype, Dex cap, Stealth, Str-eis | +1 Leather, Bracers of Defense, Ring of Protection |
| Healing | genezingsformule | Potion of Healing, Periapt of Wound Closure |
| Spell | spellkoppeling (zie voorstel 2) | Scroll, Wand of Fireballs, Staff of Fire |
| Charges | bestaat al | Wand, Staff |

**Migratie is gratis**: de veldnamen blijven, alleen de poort verandert van
`showFor: [type]` naar "werking bevat X". Afleiden uit wat er staat: `damage` →
Attack, `armorType` → Defense, `itemType === 'Scroll'` → Spell. Het
`showWhen`-mechanisme doet dit al; het moet alleen ook op "zit in een lijst"
kunnen matchen.

Bijvangst: de `/heal/i`-sniffing op het schadeveld (waarmee de app raadt of een
pil rood of groen is) kan weg.

## Voorstel 2 — spells koppelen in plaats van kopiëren

`spellPick` plakt nu de spreuktekst in `data.desc`. Gevolg: een kopie die
veroudert, geen weg terug naar de spreuk, en een Wand kan het niet.

Het juiste mechanisme staat al in de app, op statblocks: `stats.spellIndexes`
met chips die `window.spreuken.open()` aanroepen en via `window.spreuken.info()`
naam en niveau ophalen. Datzelfde op een voorwerp (`data.spellIndexes`) geeft:

- Scroll of Fireball → één chip, klik en je leest de spreuk.
- Wand of Fireballs → dezelfde chip plus charges.
- Staff of Fire → drie chips, elk op eigen niveau.
- De speler kan het vanuit zijn Boedel openen.

## Wat we niet moeten doen

De mechaniek laten uitvoeren (AC automatisch bij de sheet optellen, charges
afboeken bij het casten). Dat is een veel grotere stap; aan tafel leest de DM
het getal en beslist. Beschrijvend houden, met als uitzondering wat de app al
rekent (de AC-formule bij harnas).

## Volgorde

1. `werking` + de vier veldgroepen, met afleiding uit bestaande data.
2. Spellkoppeling via chips.
3. Eventueel later een vrij bonus-vinkje (ability/skill/save + waarde) voor
   dingen als Gauntlets of Ogre Power — de vaagste categorie, dus als laatste.
