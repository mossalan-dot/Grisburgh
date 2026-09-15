// ════════════════════════════════════════════════════════════════════════════
//  CONDITIES — één lijst voor de hele app
// ════════════════════════════════════════════════════════════════════════════
// Er stonden er drie, en ze waren uit elkaar gelopen: de picker van de DM had
// er 38 in het Engels, het spelerstabblad 18 in het Nederlands (`PLAYER_COND_INFO`)
// en het dashboard nog eens 16 losse labels (`COND_LBL_MAP`). Dezelfde conditie
// heette dus "Restrained" bij de DM en "Vastgehouden" bij de speler — tegen de
// afspraak in dat een PHB-term Engels blijft, en een speler die op zijn token
// iets anders leest dan de DM zegt kan het niet opzoeken.
//
// De teksten zijn de PHB-formulering. De omringende app blijft Nederlands; dit
// is de inhoud van het spel, en die vertalen we niet.
//
// Let op: de **iconen** leven elders en op een eigen as — `COND_ICON` in
// `combat-canvas.js` (sprite + kleur voor op een token) en de PNG-set in
// `public/img/conditions/` (zie COND_MET_PLAATJE hieronder). Die hoeven niet
// alle condities te dekken.

export const CONDITIONS = [
  { id: 'blinded',       label: 'Blinded',        desc: 'Cannot see. Attack rolls against it have advantage; its attack rolls have disadvantage.' },
  { id: 'charmed',       label: 'Charmed',        desc: 'Cannot attack the charmer. The charmer has advantage on social ability checks against it.' },
  { id: 'deafened',      label: 'Deafened',       desc: 'Cannot hear. Automatically fails ability checks that require hearing.' },
  { id: 'exhaustion',    label: 'Exhaustion',     desc: 'Level 1: disadvantage on checks. 2: speed halved. 3: disadvantage on saves. 4: speed 0. 5: disadvantage on attacks. 6: death.' },
  { id: 'frightened',    label: 'Frightened',     desc: 'Disadvantage on checks and attacks while the source is in sight. Cannot willingly move closer to the source.' },
  { id: 'grappled',      label: 'Grappled',       desc: 'Speed becomes 0. Ends if the grappler is incapacitated or the creature is moved out of reach.' },
  { id: 'incapacitated', label: 'Incapacitated',  desc: 'Cannot take actions or reactions.' },
  { id: 'invisible',     label: 'Invisible',      desc: 'Cannot be seen. Attack rolls against it have disadvantage; its attack rolls have advantage.' },
  { id: 'paralyzed',     label: 'Paralyzed',      desc: 'Incapacitated, cannot move or speak. Fails STR/DEX saves. Attacks have advantage. Hits within 5 ft. are critical hits.' },
  { id: 'petrified',     label: 'Petrified',      desc: 'Transformed to stone. Incapacitated. Resistant to all damage. Immune to poison and disease.' },
  { id: 'poisoned',      label: 'Poisoned',       desc: 'Disadvantage on attack rolls and ability checks.' },
  { id: 'prone',         label: 'Prone',          desc: 'Disadvantage on attack rolls. Attacks within 5 ft. have advantage; from farther away have disadvantage. Standing up costs half speed.' },
  { id: 'flying',        label: 'Flying',         desc: 'Airborne. Out of reach of most melee attacks from the ground. Falls if its speed drops to 0 or it is knocked prone.' },
  { id: 'restrained',    label: 'Restrained',     desc: 'Speed becomes 0. Disadvantage on attack rolls and DEX saves. Attack rolls against it have advantage.' },
  { id: 'stunned',       label: 'Stunned',        desc: 'Incapacitated, cannot move, can speak only falteringly. Fails STR/DEX saves. Attack rolls against it have advantage.' },
  { id: 'unconscious',   label: 'Unconscious',    desc: 'Incapacitated, prone, unaware. Fails STR/DEX saves. Attacks have advantage. Hits within 5 ft. are critical hits.' },
  { id: 'concentration', label: 'Concentration',  desc: 'Concentrating on a spell. Ends if damaged (CON save, DC 10 or half damage taken) or incapacitated.' },
  { id: 'bleeding',      label: 'Bleeding',       desc: 'Losing blood. Takes 1d4 damage at the start of each turn. Ends when healed or a DC 10 Medicine check is made.' },
  { id: 'burning',       label: 'Burning',        desc: 'On fire. Takes 1d6 fire damage at the start of each turn. Can use an action to extinguish.' },
  // ── Klassespecifiek ──
  { id: 'bardic-inspiration', label: 'Bardic Inspiration', desc: '(Bard) Has a Bardic Inspiration die. Can add it to one attack roll, ability check, or saving throw. Expended on use.' },
  { id: 'tides-of-chaos',     label: 'Tides of Chaos',     desc: '(Sorcerer) Has advantage on the next attack roll, ability check, or saving throw. Expended on use — may trigger a Wild Magic Surge.' },
  { id: 'twilight-sanctuary', label: 'Twilight Sanctuary',  desc: '(Cleric) Within the Twilight Sanctuary aura. At end of each turn: gain temp HP (1d6 + cleric level) or end one charmed or frightened condition.' },
  { id: 'patient-defense',    label: 'Patient Defense',    desc: '(Monk) Taking the Dodge action via ki. Attack rolls against this creature have disadvantage; DEX saving throws have advantage. Until start of next turn.' },
  { id: 'steady-aim',         label: 'Steady Aim',         desc: '(Rogue) Used Steady Aim bonus action. Has advantage on the next attack roll this turn. Speed is 0 until end of turn.' },
  { id: 'vigilant-blessing',  label: 'Vigilant Blessing',  desc: '(Cleric) Has advantage on the next initiative roll. Expended when rolled.' },
  { id: 'blessed',            label: 'Blessed',            desc: '(Bless spell) Adds 1d4 to attack rolls and saving throws. Concentration, up to 1 minute.' },
  { id: 'haste',              label: 'Haste',              desc: '(Haste spell) +2 bonus to AC, advantage on Dexterity saving throws, doubled Speed and one extra action each turn (Attack, Dash, Disengage, Hide or Use an Object). When the spell ends the target cannot move or take actions until after its next turn.' },
  { id: 'raging',             label: 'Raging',             desc: '(Barbarian) Advantage on Strength checks and saves, bonus damage on Strength-based melee attacks, and resistance to bludgeoning, piercing and slashing damage.' },
  // ── Situationeel/positioneel ──
  // Geen PHB-condition en geen klassefeature, maar wel iets dat de worp verandert
  // en dat je halverwege een gevecht kwijtraakt. Eigen groep in de picker.
  { id: 'dodging',            label: 'Dodging',            desc: 'Took the Dodge action. Attack rolls against it have disadvantage and it has advantage on Dexterity saving throws, until the start of its next turn.' },
  { id: 'hidden',             label: 'Hidden',             desc: 'Unseen and unheard. Has advantage on its attack roll; the hidden state ends as soon as it attacks or makes noise.' },
  { id: 'readied',            label: 'Readied',            desc: 'Readied an action with a trigger. Spends its reaction when the trigger occurs; the action is lost at the start of its next turn.' },
  { id: 'cover-half',         label: 'Half Cover',         desc: 'Half Cover: +2 bonus to AC and Dexterity saving throws.' },
  { id: 'cover-three-quarters', label: 'Three-Quarters Cover', desc: 'Three-Quarters Cover: +5 bonus to AC and Dexterity saving throws.' },
  { id: 'grappling',          label: 'Grappling',          desc: 'Holding another creature in a grapple. Ends if the grappler is incapacitated or the target is moved out of reach.' },
  { id: 'mounted',            label: 'Mounted',            desc: 'Riding a mount. A controlled mount acts on the rider\'s initiative and shares its movement.' },
  { id: 'underwater',         label: 'Underwater',         desc: 'Underwater. Melee and ranged weapon attacks have disadvantage unless the weapon deals piercing damage or the creature has a Swim Speed. Resistance to fire damage.' },
];

// id → { label, desc }
export const COND_INFO = Object.fromEntries(CONDITIONS.map(c => [c.id, c]));

// Alleen de conditie-tekening, kort: `COND_LABEL[id]` valt terug op het id zelf,
// zodat een conditie die een DM zelf verzint leesbaar blijft.
export const COND_LABEL = new Proxy(COND_INFO, {
  get: (o, k) => o[k]?.label ?? String(k),
});

// Welke condities een geschilderd plaatje hebben in /img/conditions/. Bewust een
// eigen lijst: die set is kleiner dan de condities zelf, en hem afleiden uit
// COND_INFO leverde een <img> op naar een bestand dat niet bestaat.
export const COND_MET_PLAATJE = new Set([
  'bleeding', 'blinded', 'burning', 'charmed', 'concentration', 'deafened',
  'exhaustion', 'frightened', 'grappled', 'incapacitated', 'invisible',
  'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned',
  'unconscious',
]);
