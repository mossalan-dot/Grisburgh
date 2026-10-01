# Subklassen met een eigen veld

Werkdocument, 1 oktober 2026. Vier zijn er gebouwd; de rest staat hier
opgeschreven zodat de keuze later niet opnieuw gemaakt hoeft te worden.

## De maat

Een **signature-kaart** (`_SIGNATURE` in `app.js`) hangt aan een klasse: Rage
bij de Barbarian, Sorcery Points bij de Sorcerer. Sinds 1 okt 2026 kan een
**subklasse** er ook een hebben (`_SUBKLASSE_SIGNATURE`), en de vraag is welke
dat verdienen.

De maat die we aanhouden:

> Verandert er tijdens het spelen een **getal of een stand** die nergens anders
> al staat?

Twee dingen volgen daaruit, en die schelen de meeste kandidaten:

- **Wat op de voorraad van de klasse teert, krijgt niets eigens.** Bijna elke
  Cleric-subklasse geeft een extra Channel Divinity-optie, bijna elke
  Druid-subklasse put uit Wild Shape, en de Monk-subklassen betalen met Focus
  Points. Die tellers staan al op de kaart van de klasse; er een tweede naast
  zetten die hetzelfde getal toont is erger dan niets.
- **Een passieve verbetering is geen stand.** Improved Critical, Elemental
  Affinity, Potent Cantrip — die veranderen een worp, niet een voorraad. Ze
  horen op het Progressie-tabblad en in de Vaardighedentab, niet op een kaart
  die je tijdens een gevecht aantikt.

## Gebouwd

| Subklasse | Veld | Vorm | Rekening |
|---|---|---|---|
| **Battle Master** (Fighter) | Superiority Dice | `uses` | 4 / 5 (lv 7) / 6 (lv 15) · d8 → d10 (10) → d12 (18) · maneuvers 3/5/7/9 |
| **Psi Warrior** (Fighter) | Psionic Energy Dice | `uses` | 2 × proficiency bonus · d6 → d8 (5) → d10 (11) → d12 (17) |
| **Soulknife** (Rogue) | Psionic Energy Dice | `uses` | idem; de Psychic Blades zelf kosten niets |
| **Abjurer** (Wizard) | Arcane Ward | `pool`, eenheid HP | 2 × wizardlevel + INT-mod |

## Nog te bouwen — nieuwe vorm nodig

### Diviner (Wizard) — Portent
De sterkste kandidaat die er nog ligt, en de enige die een **nieuwe kaartvorm**
vraagt. Na een lange rust rol je twee d20's (drie vanaf level 14) en je
**schrijft die getallen op**; later vervang je er een worp mee en streep je hem
door. Dat is geen teller en geen voorraadbalk maar *bewaarde worpen*.

Vorm: `vorm: 'worpen'` — twee of drie vakjes waar een getal in staat, met een
knop "rol opnieuw" na een lange rust en een doorhaal bij gebruik. Het is de
enige subklasse waar de speler nu echt een papiertje naast de app houdt.

### Wild Magic (Sorcerer) — Tides of Chaos + Surge
Twee dingen, en ze horen op twee plekken:
- **Tides of Chaos** is een schakelaar (1 × per lange rust) — past in de
  bestaande `uses`-vorm met max 1. Klein werk.
- **Wild Magic Surge** is een **d100-tabel**. Die hoort in **Tafels**, niet in
  een kaartje: daar kan de DM hem aanpassen, en de app kan er al uit trekken.
  Dit is dus eerder een koppeling (kaartje → tafel) dan een veld.

## Nog te bouwen — bestaande machinerie, geen nieuw veld

### Beast Master (Ranger) — Primal Companion
### Circle of the Wildfire (Druid) — Wildfire Spirit
Allebei een wezen dat meevecht, groeit met je level en HP heeft. Dat is precies
wat **metgezellen** al doen: adoptie bij de Magizoöloog, statblocks per tier,
gevechtsintegratie, overlijden. Geen kaartje bouwen maar een koppeling leggen —
en dan meteen nadenken of een metgezel die uit een subklasse komt wel langs de
Magizoöloog hoort te lopen (nee: die krijg je bij je level-up, niet bij een
winkel).

## Geen eigen veld, en waarom niet

- **Alle Cleric-subklassen** (8) — hun Channel Divinity-opties putten uit de
  teller die de Cleric-kaart al toont.
- **Alle Druid-subklassen** behalve Wildfire — Starry Form, Moon-vormen en
  Sea-vormen gaan allemaal via Wild Shape-ladingen.
- **Alle Monk-subklassen** (4) — Focus Points staan op de Monk-kaart.
- **Alle Paladin-subklassen** (4) — Channel Divinity en Lay on Hands staan er al.
- **Alle Warlock-subklassen** (4) — wat ze geven loopt via Pact Magic-slots en
  Magical Cunning; Dark One's Own Luck is een PB-teller die eerder in de
  featurelijst thuishoort dan op een eigen kaart.
- **Barbarian-subklassen** (4) — alles teert op Rage.
- **Bard-subklassen** (4) — alles teert op Bardic Inspiration. College of Dance
  is grensgeval: Dazzling Footwork verandert je ongewapende schade, maar dat is
  een waarde, geen stand.
- **Champion, Eldritch Knight** (Fighter) — passief, resp. gewone spell slots.
- **Hunter, Fey Wanderer, Gloom Stalker** (Ranger) — passieve keuzes en
  PB-tellers zonder eigen voorraad.
- **Thief, Swashbuckler, Arcane Trickster, Assassin** (Rogue) — passief of via
  Sneak Attack, dat al op de Rogue-kaart staat als waarde.
- **Draconic, Aberrant Mind, Clockwork** (Sorcerer) — Sorcery Points.
- **Evoker, Illusionist, Transmuter** (Wizard) — passief of eenmalig per rust
  zonder voorraad. (Overchannel op 14 is 1×/lange rust; dat kán een `uses`-kaart
  worden als er vraag naar is.)

## De olifant: 39 van de 55 subklassen hebben geen tekst

Alleen de twaalf uit de SRD staan in `bronnen/class-progression.json` (één per
klasse), plus Twilight Domain, Psi Warrior, Swashbuckler en Wild Magic die er
met de hand bij zijn gezet. De andere 39 zijn een naam in een keuzelijst en
verder niets.

Dat is geen fout maar een grens: de rest staat in het Player's Handbook en mag
daar niet uit overgenomen worden. Sinds 1 okt 2026 **zegt** de app dat wel, op
het Progressie-tabblad, met de uitweg erbij — de DM kan ze zelf intikken met
*Bewerken*, en dan staan ze er voor iedereen die die subklasse speelt.

Wat hier nog ligt: een manier om die eigen invoer te **delen** tussen
campagnes. Nu typt elke DM ze opnieuw. Een exportknop bij de editor die een
`progression.json`-fragment oplevert zou genoeg zijn.
