// Klassekrachten — per klasse het ding waar hij aan tafel over gaat.
//
// Rage van de Barbarian heeft zijn eigen route (`/characters/:id/rage`); voor
// de andere klassen staat hier één catalogus, en daaruit volgt alles: de
// knoppen op het blad, de controle op de server, wat een rust teruggeeft en
// hoe het tafelscherm het brengt. Een nieuwe klasse is een blok hier, geen
// nieuwe route.
//
// De regels zijn die van de PHB 2024. Wat de app níét doet blijft hetzelfde
// als bij Rage: de tafel gooit aanvallen en saves, de app laat zien wat er
// geldt. Wat hier wél gerold wordt is wat het boek zelf laat rollen zonder
// doelwit om te raken: een genezing (Second Wind, Divine Spark), en de schade
// die al vaststaat zodra je hem aankondigt (Sneak Attack, Eldritch Blast).
//
// Vormen:
//   bron   — { label, max(lvl, p), kort(lvl) → 'alles' | 'een' | 'helft' | null, eenheid? }
//            Een lange rust zet élke bron terug. `kort` zegt wat een korte doet.
//   actie  — { id, label, icoon, bron?, kost?, soort, vanaf?, … }
//            soort: 'flits'      — verbruiken en tonen
//                   'genees'     — HP erbij, `formule(lvl,p)` of `bedrag: true` uit de bron
//                   'worp'       — schade rollen, `formule(lvl,p)` of `stralen(lvl)`
//                   'actief'     — een toestand aan (met `conditie`, `tekst`, `tempHp`);
//                                  `vormen` = kies uit je bekende Beast-gedaantes (Wild Shape)
//                   'inspiratie' — een die aan een bondgenoot geven
//                   'slots'      — verbruikte spell slots terug (`budget`, `pact`)
//                   'herstel'    — een bron weer vullen (eenmalig per lange rust)
//                   'slot-maken' / 'slot-smelten' — Font of Magic
//   doel: 'zelf' | 'bondgenoot' | 'vijand'  (bondgenoot = iemand uit je party, ook jijzelf)

const drempel = (tabel, lvl) => {
  let v = 0;
  for (const t of Object.keys(tabel).map(Number).sort((a, b) => a - b)) if (lvl >= t) v = tabel[t];
  return v;
};
const mod = (p, k) => { const v = parseInt(p?.[k]); return Number.isFinite(v) ? Math.floor((v - 10) / 2) : 0; };
const pb  = (lvl) => 2 + Math.floor((Math.max(1, lvl) - 1) / 4);
// Save DC: wat de speler zelf invulde wint, anders 8 + PB + mod.
const dc  = (lvl, p, k) => parseInt(p?.spellSaveDC) || (8 + pb(p?._totaalLevel || lvl) + mod(p, k));

const KLASSEN = {
  // De Barbarian heeft Rage op een eigen route; hier staat hij alleen zodat zijn
  // subclasses ergens bij horen. Zonder subclass levert hij niets op.
  barbarian: {
    naam: 'Barbarian', thema: 'barbarian', icoon: 'angry', bronnen: {}, acties: [],
  },

  bard: {
    naam: 'Bard', thema: 'bard', icoon: 'music',
    bronnen: {
      inspiratie: { label: 'Bardic Inspiration', max: (l, p) => Math.max(1, mod(p, 'cha')),
                    kort: (l) => (l >= 5 ? 'alles' : null) },
    },
    info: (l) => [`Inspiration die ${drempel({ 1: 'd6', 5: 'd8', 10: 'd10', 15: 'd12' }, l)}`],
    acties: [
      { id: 'inspireer', label: 'Inspireer', icoon: 'music', bron: 'inspiratie', kost: 1,
        soort: 'inspiratie', doel: 'bondgenoot', woord: 'Inspiratie',
        die: (l) => drempel({ 1: 'd6', 5: 'd8', 10: 'd10', 15: 'd12' }, l) },
    ],
  },

  cleric: {
    naam: 'Cleric', thema: 'cleric', icoon: 'church',
    bronnen: {
      channel: { label: 'Channel Divinity', max: (l) => drempel({ 2: 2, 6: 3, 18: 4 }, l), kort: () => 'een' },
    },
    info: (l, p) => [`Turn Undead DC ${dc(l, p, 'wis')}`],
    acties: [
      { id: 'spark-heal', label: 'Divine Spark — genezen', icoon: 'heart-pulse', bron: 'channel', kost: 1,
        soort: 'genees', doel: 'bondgenoot', woord: 'Divine Spark',
        formule: (l, p) => `${drempel({ 1: 1, 7: 2, 13: 3, 18: 4 }, l)}d8+${Math.max(0, mod(p, 'wis'))}` },
      { id: 'spark-dmg', label: 'Divine Spark — schade', icoon: 'sparkles', bron: 'channel', kost: 1,
        soort: 'worp', woord: 'Divine Spark', soortSchade: 'Radiant of Necrotic',
        formule: (l, p) => `${drempel({ 1: 1, 7: 2, 13: 3, 18: 4 }, l)}d8+${Math.max(0, mod(p, 'wis'))}`,
        regel: (l, p) => `Constitution save DC ${dc(l, p, 'wis')} voor de helft` },
      { id: 'turn-undead', label: 'Turn Undead', icoon: 'skull', bron: 'channel', kost: 1,
        soort: 'flits', woord: 'Turn Undead',
        regel: (l, p) => `Undead binnen 30 voet: Wisdom save DC ${dc(l, p, 'wis')} of ze vluchten` },
    ],
  },

  druid: {
    naam: 'Druid', thema: 'druid', icoon: 'tree-pine',
    bronnen: {
      wildshape: { label: 'Wild Shape', max: (l) => drempel({ 2: 2, 6: 3, 17: 4 }, l), kort: () => 'een' },
    },
    // Max CR en de bekende gedaantes staan in de eigen strook van Wild Shape.
    info: (l) => [`${l} Temporary HP`],
    acties: [
      { id: 'wildshape', label: 'Wild Shape', icoon: 'paw-print', bron: 'wildshape', kost: 1, vanaf: 2,
        soort: 'actief', conditie: 'wild-shape', tekst: 'Gedaante', vormen: true, woord: 'Wild Shape',
        tempHp: (l) => l,
        effecten: (l) => [`${l} Temporary HP`, 'Je game statistics worden die van de Beast; je houdt je eigen HP, Hit Dice en Intelligence, Wisdom en Charisma',
          'Geen spells casten, wél Concentration aanhouden'] },
    ],
  },

  fighter: {
    naam: 'Fighter', thema: 'fighter', icoon: 'swords',
    bronnen: {
      secondwind: { label: 'Second Wind', max: (l) => drempel({ 1: 2, 4: 3, 10: 4 }, l), kort: () => 'een' },
      surge:      { label: 'Action Surge', max: (l) => drempel({ 2: 1, 17: 2 }, l), kort: () => 'alles' },
      indomitable:{ label: 'Indomitable', max: (l) => drempel({ 9: 1, 13: 2, 17: 3 }, l), kort: () => null },
    },
    acties: [
      { id: 'secondwind', label: 'Second Wind', icoon: 'heart-pulse', bron: 'secondwind', kost: 1,
        soort: 'genees', doel: 'zelf', woord: 'Second Wind', formule: (l) => `1d10+${l}` },
      { id: 'surge', label: 'Action Surge', icoon: 'zap', bron: 'surge', kost: 1, vanaf: 2,
        soort: 'flits', woord: 'Action Surge', regel: () => 'Nog een Action deze beurt' },
      { id: 'indomitable', label: 'Indomitable', icoon: 'shield', bron: 'indomitable', kost: 1, vanaf: 9,
        soort: 'flits', woord: 'Indomitable', regel: (l) => `Gooi de save opnieuw, +${l}` },
    ],
  },

  monk: {
    naam: 'Monk', thema: 'monk', icoon: 'hand',
    bronnen: {
      focus: { label: 'Focus Points', max: (l) => (l >= 2 ? l : 0), kort: () => 'alles' },
    },
    info: (l, p) => [`Martial Arts ${drempel({ 1: 'd6', 5: 'd8', 11: 'd10', 17: 'd12' }, l)}`,
      ...(l >= 5 ? [`Stunning Strike DC ${dc(l, p, 'wis')}`] : [])],
    acties: [
      { id: 'flurry', label: 'Flurry of Blows', icoon: 'hand-fist', bron: 'focus', kost: 1, vanaf: 2,
        soort: 'flits', woord: 'Flurry of Blows', regel: (l) => `${l >= 10 ? 'Drie' : 'Twee'} Unarmed Strikes als Bonus Action` },
      { id: 'patient', label: 'Patient Defense', icoon: 'shield', bron: 'focus', kost: 1, vanaf: 2,
        soort: 'flits', woord: 'Patient Defense', regel: () => 'Disengage én Dodge als Bonus Action' },
      { id: 'step', label: 'Step of the Wind', icoon: 'wind', bron: 'focus', kost: 1, vanaf: 2,
        soort: 'flits', woord: 'Step of the Wind', regel: () => 'Disengage én Dash, en je sprong verdubbelt' },
      { id: 'stun', label: 'Stunning Strike', icoon: 'shell', bron: 'focus', kost: 1, vanaf: 5,
        soort: 'flits', woord: 'Stunning Strike', regel: (l, p) => `Constitution save DC ${dc(l, p, 'wis')} of Stunned` },
      { id: 'metabolism', label: 'Uncanny Metabolism', icoon: 'refresh-cw', vanaf: 2,
        soort: 'herstel', herstelt: 'focus', woord: 'Uncanny Metabolism',
        formule: (l) => `1${drempel({ 1: 'd6', 5: 'd8', 11: 'd10', 17: 'd12' }, l)}+${l}`,
        regel: () => 'Bij initiative: alle Focus terug en genezing' },
    ],
  },

  paladin: {
    naam: 'Paladin', thema: 'paladin', icoon: 'shield-plus',
    bronnen: {
      handen:  { label: 'Lay on Hands', max: (l) => l * 5, kort: () => null, eenheid: 'HP' },
      channel: { label: 'Channel Divinity', max: (l) => drempel({ 3: 2, 11: 3 }, l), kort: () => 'een' },
    },
    acties: [
      { id: 'handen', label: 'Lay on Hands', icoon: 'hand', bron: 'handen', bedrag: true,
        soort: 'genees', doel: 'bondgenoot', woord: 'Lay on Hands' },
      { id: 'smite', label: 'Divine Smite', icoon: 'zap', soort: 'worp', slot: true, woord: 'Divine Smite',
        soortSchade: 'Radiant', formule: (l, p, slot) => `${Math.min(5, 1 + (slot || 1))}d8`,
        regel: () => 'Extra tegen een Fiend of Undead: +1d8' },
      { id: 'sense', label: 'Divine Sense', icoon: 'eye', bron: 'channel', kost: 1, vanaf: 3,
        soort: 'flits', woord: 'Divine Sense', regel: () => 'Celestials, Fiends en Undead binnen 60 voet' },
    ],
  },

  ranger: {
    naam: 'Ranger', thema: 'ranger', icoon: 'bow-arrow',
    bronnen: {
      mark: { label: "Hunter's Mark", max: (l) => drempel({ 1: 2, 5: 3, 9: 4, 13: 5, 17: 6 }, l), kort: () => null },
    },
    info: (l) => [`Extra damage ${l >= 20 ? '1d10' : '1d6'}`],
    acties: [
      { id: 'mark', label: "Hunter's Mark", icoon: 'crosshair', bron: 'mark', kost: 1,
        soort: 'actief', doel: 'vijand', conditie: 'concentration', doelConditie: 'hunters-mark',
        woord: "Hunter's Mark",
        effecten: (l) => [`+${l >= 20 ? '1d10' : '1d6'} Force damage als je het doelwit raakt`,
          'Advantage op Wisdom (Perception/Survival) om het te vinden', 'Concentration'] },
    ],
  },

  rogue: {
    naam: 'Rogue', thema: 'rogue', icoon: 'stiletto',
    bronnen: {},
    info: (l) => [`Sneak Attack ${Math.ceil(l / 2)}d6`],
    acties: [
      { id: 'sneak', label: 'Sneak Attack', icoon: 'stiletto', soort: 'worp', woord: 'Sneak Attack',
        formule: (l) => `${Math.ceil(l / 2)}d6`, regel: () => 'Eén keer per beurt' },
    ],
  },

  sorcerer: {
    naam: 'Sorcerer', thema: 'sorcerer', icoon: 'flame',
    bronnen: {
      innate: { label: 'Innate Sorcery', max: () => 2, kort: () => null },
      punten: { label: 'Sorcery Points', max: (l) => (l >= 2 ? l : 0), kort: () => null },
    },
    acties: [
      { id: 'innate', label: 'Innate Sorcery', icoon: 'wand-sparkles', bron: 'innate', kost: 1,
        soort: 'actief', conditie: 'innate-sorcery', woord: 'Innate Sorcery', eindeBijGevecht: true,
        effecten: () => ['Spell save DC +1', 'Advantage op spell attack rolls met Sorcerer-spells', 'Eén minuut'] },
      { id: 'metamagic', label: 'Metamagic', icoon: 'sparkles', bron: 'punten', vanaf: 2,
        soort: 'flits', keuze: {
          'Careful Spell': 1, 'Distant Spell': 1, 'Empowered Spell': 1, 'Extended Spell': 1,
          'Heightened Spell': 2, 'Quickened Spell': 2, 'Seeking Spell': 1, 'Subtle Spell': 1,
          'Transmuted Spell': 1, 'Twinned Spell': 1 } },
      { id: 'slot-maken', label: 'Spell slot maken', icoon: 'plus', bron: 'punten', vanaf: 2,
        soort: 'slot-maken', woord: 'Font of Magic', kosten: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 } },
      { id: 'slot-smelten', label: 'Slot omsmelten', icoon: 'flame', bron: 'punten', vanaf: 2,
        soort: 'slot-smelten', woord: 'Font of Magic' },
    ],
  },

  warlock: {
    naam: 'Warlock', thema: 'warlock', icoon: 'eye',
    bronnen: {
      cunning: { label: 'Magical Cunning', max: (l) => (l >= 2 ? 1 : 0), kort: () => null },
    },
    info: (l) => [`Eldritch Blast: ${drempel({ 1: 1, 5: 2, 11: 3, 17: 4 }, l)} ${l >= 5 ? 'stralen' : 'straal'}`],
    acties: [
      { id: 'blast', label: 'Eldritch Blast', icoon: 'zap', soort: 'worp', woord: 'Eldritch Blast',
        soortSchade: 'Force', stralen: (l) => drempel({ 1: 1, 5: 2, 11: 3, 17: 4 }, l), formule: () => '1d10',
        regel: () => 'Per straal een eigen attack roll' },
      { id: 'cunning', label: 'Magical Cunning', icoon: 'refresh-cw', bron: 'cunning', kost: 1, vanaf: 2,
        soort: 'slots', pact: true, woord: 'Magical Cunning' },
    ],
  },

  wizard: {
    naam: 'Wizard', thema: 'wizard', icoon: 'book-open',
    bronnen: {
      recovery: { label: 'Arcane Recovery', max: () => 1, kort: () => null },
    },
    info: (l) => [`Tot ${Math.ceil(l / 2)} slotniveaus terug`],
    acties: [
      { id: 'recovery', label: 'Arcane Recovery', icoon: 'book-open', bron: 'recovery', kost: 1,
        soort: 'slots', budget: (l) => Math.ceil(l / 2), maxNiveau: 5, woord: 'Arcane Recovery' },
    ],
  },

  artificer: {
    naam: 'Artificer', thema: 'artificer', icoon: 'hammer',
    bronnen: {
      genius: { label: 'Flash of Genius', max: (l, p) => (l >= 7 ? Math.max(1, mod(p, 'int')) : 0), kort: () => null },
    },
    acties: [
      { id: 'genius', label: 'Flash of Genius', icoon: 'cog', bron: 'genius', kost: 1, vanaf: 7,
        soort: 'flits', doel: 'bondgenoot', woord: 'Flash of Genius',
        regel: (l, p) => `+${Math.max(1, mod(p, 'int'))} op die ability check of saving throw` },
    ],
  },
};

// ── Subclasses uit de PHB 2024 ───────────────────────────────────────────────
// Dezelfde maat als bij de subklassekaarten: alleen wat aan tafel een getal,
// een stand of een worp heeft. Een Champion die op 19 crit, een Thief met Fast
// Hands of een College of Dance die anders beweegt hebben geen knop nodig.
// Een subclass mag de bronnen van zijn class gebruiken (`bron: 'channel'`,
// `'wildshape'`, `'focus'`, `'inspiratie'`): die worden samengevoegd.
//
// Extra vormen die alleen hier voorkomen:
//   soort 'temp'      — Temporary HP geven (`formule`), aan jezelf of een bondgenoot
//   dobbels           — genezen uit een pool dobbelstenen; je kiest hoeveel
//   limiet            — genezen tot een maximum, voor een vaste prijs (Preserve Life)
//   opties            — een keuze zonder prijs (Bear/Eagle/Wolf, de maneuvers)
//   soort 'portent'   — d20's vooraf gooien; 'portent-gebruik' zet er een in
//   soort 'bijvullen' — een voorraad aanvullen (de Arcane Ward laden)
//   conditie bij 'flits' — zet die conditie op je token (Tides of Chaos)
//   thema             — de kleur op het tafelscherm, als die van de class niet past
const ma  = (l) => drempel({ 1: 'd6', 5: 'd8', 11: 'd10', 17: 'd12' }, l);
const psi = (l) => drempel({ 3: 'd6', 5: 'd8', 11: 'd10', 17: 'd12' }, l);
const rageSchade = (l) => drempel({ 1: 2, 9: 3, 16: 4 }, l);
const minEen = (n) => Math.max(1, n);
const BI = (l) => drempel({ 1: 'd6', 5: 'd8', 10: 'd10', 15: 'd12' }, l);

const MANEUVERS = ['Ambush', 'Bait and Switch', "Commander's Strike", 'Commanding Presence', 'Disarming Attack',
  'Distracting Strike', 'Evasive Footwork', 'Feinting Attack', 'Goading Attack', 'Lunging Attack',
  'Maneuvering Attack', 'Menacing Attack', 'Parry', 'Precision Attack', 'Pushing Attack', 'Rally',
  'Riposte', 'Sweeping Attack', 'Tactical Assessment', 'Trip Attack'];

const SUBKLASSEN = [
  // ── Barbarian ──
  { klasse: 'barbarian', naam: 'Path of the Berserker', match: /berserker/i, acties: [
    { id: 'frenzy', label: 'Frenzy', icoon: 'angry', soort: 'worp', woord: 'Frenzy',
      formule: (l) => `${rageSchade(l)}d6`, regel: () => 'Eerste treffer met Reckless Attack terwijl je raast' } ] },
  { klasse: 'barbarian', naam: 'Path of the Wild Heart', match: /wild ?heart|totem/i, acties: [
    { id: 'wilds', label: 'Rage of the Wilds', icoon: 'paw-print', soort: 'actief', woord: 'Rage of the Wilds',
      opties: ['Bear', 'Eagle', 'Wolf'], eindeBijGevecht: true, thema: 'druid',
      effecten: () => ['Bear: Resistance tegen alles behalve Force, Necrotic, Psychic en Radiant',
        'Eagle: Disengage en Dash als Bonus Action', 'Wolf: bondgenoten hebben Advantage tegen vijanden naast jou'] } ] },
  { klasse: 'barbarian', naam: 'Path of the World Tree', match: /world ?tree/i, acties: [
    { id: 'vitality', label: 'Vitality Surge', icoon: 'tree-pine', soort: 'temp', doel: 'zelf', woord: 'Vitality of the Tree',
      formule: (l) => String(l), regel: () => 'Als je in Rage gaat', thema: 'druid' },
    { id: 'lifegiving', label: 'Life-Giving Force', icoon: 'sprout', soort: 'temp', doel: 'bondgenoot', woord: 'Life-Giving Force',
      formule: (l) => `${rageSchade(l)}d6`, regel: () => 'Aan het begin van je beurt, terwijl je raast', thema: 'druid' } ] },
  { klasse: 'barbarian', naam: 'Path of the Zealot', match: /zealot/i,
    bronnen: { goden: { label: 'Warrior of the Gods', max: (l) => drempel({ 3: 4, 6: 5, 12: 6, 17: 7 }, l), kort: () => null, eenheid: 'd12' } },
    acties: [
      { id: 'fury', label: 'Divine Fury', icoon: 'sun', soort: 'worp', woord: 'Divine Fury', thema: 'paladin',
        formule: (l) => `1d6+${Math.floor(l / 2)}`, soortSchade: 'Necrotic of Radiant', regel: () => 'Eerste treffer per beurt terwijl je raast' },
      { id: 'goden', label: 'Warrior of the Gods', icoon: 'heart-pulse', bron: 'goden', soort: 'genees', doel: 'zelf',
        dobbels: { die: 'd12', max: (l) => drempel({ 3: 4, 6: 5, 12: 6, 17: 7 }, l) }, woord: 'Warrior of the Gods', thema: 'paladin' } ] },

  // ── Bard ──
  { klasse: 'bard', naam: 'College of Glamour', match: /glamour/i, acties: [
    { id: 'mantle', label: 'Mantle of Inspiration', icoon: 'sparkles', bron: 'inspiratie', kost: 1, soort: 'worp',
      woord: 'Mantle of Inspiration', formule: (l) => '1' + BI(l),
      regel: (l, p) => `Tot ${minEen(mod(p, 'cha'))} bondgenoten krijgen twee keer dat aan Temporary HP` } ] },
  { klasse: 'bard', naam: 'College of Lore', match: /lore/i, acties: [
    { id: 'cutting', label: 'Cutting Words', icoon: 'quote', bron: 'inspiratie', kost: 1, soort: 'worp',
      woord: 'Cutting Words', formule: (l) => '1' + BI(l), regel: () => 'Van de attack roll, damage roll of ability check af' } ] },

  // ── Cleric ──
  { klasse: 'cleric', naam: 'Life Domain', match: /\blife\b/i, acties: [
    { id: 'preserve', label: 'Preserve Life', icoon: 'heart-pulse', bron: 'channel', kost: 1, soort: 'genees',
      doel: 'bondgenoot', limiet: (l) => l * 5, woord: 'Preserve Life',
      regel: (l) => `Samen ${l * 5} HP, verdeeld; niemand boven de helft van zijn maximum` } ] },
  { klasse: 'cleric', naam: 'Light Domain', match: /\blight\b/i,
    bronnen: { flare: { label: 'Warding Flare', max: (l, p) => minEen(mod(p, 'wis')), kort: () => null } },
    acties: [
      { id: 'dawn', label: 'Radiance of the Dawn', icoon: 'sunset', bron: 'channel', kost: 1, soort: 'worp',
        woord: 'Radiance of the Dawn', formule: (l) => `2d10+${l}`, soortSchade: 'Radiant',
        regel: (l, p) => `Constitution save DC ${dc(l, p, 'wis')} voor de helft` },
      { id: 'flare', label: 'Warding Flare', icoon: 'sun', bron: 'flare', kost: 1, soort: 'flits', woord: 'Warding Flare',
        regel: () => 'Disadvantage op de aanval tegen jou of een bondgenoot' } ] },
  { klasse: 'cleric', naam: 'Trickery Domain', match: /trickery/i, acties: [
    { id: 'duplicity', label: 'Invoke Duplicity', icoon: 'venetian-mask', bron: 'channel', kost: 1, soort: 'actief',
      woord: 'Invoke Duplicity', eindeBijGevecht: true,
      effecten: () => ['Een illusie van jezelf binnen 30 voet', 'Je cast spells vanaf zijn plek', 'Advantage op aanvallen tegen wie naast hem staat'] } ] },
  { klasse: 'cleric', naam: 'War Domain', match: /\bwar\b/i,
    bronnen: { priest: { label: 'War Priest', max: (l, p) => minEen(mod(p, 'wis')), kort: () => 'alles' } },
    acties: [
      { id: 'priest', label: 'War Priest', icoon: 'swords', bron: 'priest', kost: 1, soort: 'flits', woord: 'War Priest',
        regel: () => 'Een aanval als Bonus Action' },
      { id: 'guided', label: 'Guided Strike', icoon: 'target', bron: 'channel', kost: 1, soort: 'flits', woord: 'Guided Strike',
        regel: () => '+10 op die attack roll' } ] },

  // ── Druid ──
  { klasse: 'druid', naam: 'Circle of the Land', match: /\bland\b/i, acties: [
    { id: 'landsaid', label: "Land's Aid", icoon: 'sprout', bron: 'wildshape', kost: 1, soort: 'worp', woord: "Land's Aid",
      formule: () => '2d6', soortSchade: 'Necrotic', regel: (l, p) => `Constitution save DC ${dc(l, p, 'wis')}; en één wezen geneest 2d6` } ] },
  { klasse: 'druid', naam: 'Circle of the Sea', match: /\bsea\b/i, acties: [
    { id: 'wrath', label: 'Wrath of the Sea', icoon: 'waves', bron: 'wildshape', kost: 1, soort: 'actief',
      woord: 'Wrath of the Sea', eindeBijGevecht: true,
      effecten: (l, p) => [`Emanation van 5 voet, tien minuten`, `${minEen(mod(p, 'wis'))}d6 Cold damage, Constitution save DC ${dc(l, p, 'wis')}`, 'Wie faalt, schuift 15 voet weg'] } ] },
  { klasse: 'druid', naam: 'Circle of the Stars', match: /\bstars?\b/i,
    bronnen: { starmap: { label: 'Star Map', max: (l, p) => minEen(mod(p, 'wis')), kort: () => null } },
    acties: [
      { id: 'starry', label: 'Starry Form', icoon: 'sparkle', bron: 'wildshape', kost: 1, soort: 'actief', woord: 'Starry Form',
        opties: ['Archer', 'Chalice', 'Dragon'], eindeBijGevecht: true, thema: 'wizard',
        effecten: (l, p) => ['Archer: Ranged spell attack als Bonus Action, 1d8 + WIS Radiant',
          'Chalice: wie je geneest met een slot, geneest iemand anders 1d8 + WIS',
          'Dragon: een 9 of lager op INT/WIS-checks en Concentration wordt een 10'] },
      { id: 'starmap', label: 'Guiding Bolt', icoon: 'star', bron: 'starmap', kost: 1, soort: 'flits', woord: 'Guiding Bolt',
        regel: () => 'Zonder spell slot, via je Star Map', thema: 'wizard' } ] },

  // ── Fighter ──
  { klasse: 'fighter', naam: 'Battle Master', match: /battle ?master/i,
    bronnen: { superiority: { label: 'Superiority Dice', max: (l) => drempel({ 3: 4, 7: 5, 15: 6 }, l), kort: () => 'alles',
      eenheid: '' } },
    info: (l) => [`Superiority Die ${drempel({ 3: 'd8', 10: 'd10', 18: 'd12' }, l)}`],
    acties: [
      { id: 'maneuver', label: 'Maneuver', icoon: 'swords', bron: 'superiority', kost: 1, soort: 'worp', woord: 'Maneuver',
        opties: MANEUVERS, formule: (l) => '1' + drempel({ 3: 'd8', 10: 'd10', 18: 'd12' }, l) } ] },
  { klasse: 'fighter', naam: 'Psi Warrior', match: /psi ?warrior/i,
    bronnen: { psi: { label: 'Psionic Energy Dice', max: (l) => 2 * pb(l), kort: () => 'een' } },
    info: (l) => [`Psionic Energy Die ${psi(l)}`],
    acties: [
      { id: 'field', label: 'Protective Field', icoon: 'shield', bron: 'psi', kost: 1, soort: 'worp', woord: 'Protective Field',
        formule: (l, p) => `1${psi(l)}+${Math.max(0, mod(p, 'int'))}`, regel: () => 'Zoveel minder damage voor jou of een bondgenoot', thema: 'wizard' },
      { id: 'strike', label: 'Psionic Strike', icoon: 'brain', bron: 'psi', kost: 1, soort: 'worp', woord: 'Psionic Strike',
        formule: (l, p) => `1${psi(l)}+${Math.max(0, mod(p, 'int'))}`, soortSchade: 'Force', thema: 'wizard' },
      { id: 'telekinetic', label: 'Telekinetic Movement', icoon: 'wind', bron: 'psi', kost: 1, soort: 'flits',
        woord: 'Telekinetic Movement', regel: () => 'Verplaats een wezen of voorwerp 30 voet', thema: 'wizard' } ] },

  // ── Monk ──
  { klasse: 'monk', naam: 'Warrior of Mercy', match: /mercy/i, acties: [
    { id: 'healing', label: 'Hand of Healing', icoon: 'hand', bron: 'focus', kost: 1, soort: 'genees', doel: 'bondgenoot',
      woord: 'Hand of Healing', formule: (l, p) => `1${ma(l)}+${Math.max(0, mod(p, 'wis'))}`, thema: 'cleric' },
    { id: 'harm', label: 'Hand of Harm', icoon: 'skull', bron: 'focus', kost: 1, soort: 'worp', woord: 'Hand of Harm',
      formule: (l, p) => `1${ma(l)}+${Math.max(0, mod(p, 'wis'))}`, soortSchade: 'Necrotic', regel: () => 'Eén keer per beurt' } ] },
  { klasse: 'monk', naam: 'Warrior of Shadow', match: /shadow/i, acties: [
    { id: 'darkness', label: 'Shadow Arts', icoon: 'moon', bron: 'focus', kost: 1, soort: 'flits', woord: 'Darkness',
      regel: () => 'Darkness zonder spell slot, en jij ziet erin' } ] },
  { klasse: 'monk', naam: 'Warrior of the Elements', match: /elements/i, acties: [
    { id: 'attune', label: 'Elemental Attunement', icoon: 'flame', bron: 'focus', kost: 1, soort: 'actief',
      woord: 'Elemental Attunement', eindeBijGevecht: true, thema: 'sorcerer',
      effecten: () => ['Tien minuten: je reikwijdte +10 voet', 'Unarmed Strikes doen Acid, Cold, Fire, Lightning of Thunder damage',
        'Een treffer mag het doelwit 10 voet duwen of trekken'] } ] },
  { klasse: 'monk', naam: 'Warrior of the Open Hand', match: /open ?hand/i,
    bronnen: { wholeness: { label: 'Wholeness of Body', max: (l, p) => (l >= 6 ? minEen(mod(p, 'wis')) : 0), kort: () => null } },
    acties: [
      { id: 'wholeness', label: 'Wholeness of Body', icoon: 'heart-pulse', bron: 'wholeness', kost: 1, vanaf: 6, soort: 'genees',
        doel: 'zelf', woord: 'Wholeness of Body', formule: (l, p) => `1${ma(l)}+${Math.max(0, mod(p, 'wis'))}` } ] },

  // ── Paladin ──
  { klasse: 'paladin', naam: 'Oath of Devotion', match: /devotion/i, acties: [
    { id: 'sacred', label: 'Sacred Weapon', icoon: 'sword', bron: 'channel', kost: 1, soort: 'actief', woord: 'Sacred Weapon',
      eindeBijGevecht: true, effecten: (l, p) => [`+${minEen(mod(p, 'cha'))} op attack rolls met dat wapen`, 'Het wapen geeft licht en doet Radiant damage', 'Tien minuten'] } ] },
  { klasse: 'paladin', naam: 'Oath of Glory', match: /glory/i, acties: [
    { id: 'athlete', label: 'Peerless Athlete', icoon: 'footprints', bron: 'channel', kost: 1, soort: 'actief', woord: 'Peerless Athlete',
      effecten: () => ['Advantage op Athletics en Acrobatics', 'Je springt 10 voet verder', 'Een uur'] },
    { id: 'smite', label: 'Inspiring Smite', icoon: 'sparkles', bron: 'channel', kost: 1, soort: 'temp', doel: 'bondgenoot',
      woord: 'Inspiring Smite', formule: (l) => `2d8+${l}`, regel: () => 'Na een Divine Smite; te verdelen over wie je wilt' } ] },
  { klasse: 'paladin', naam: 'Oath of the Ancients', match: /ancients/i, acties: [
    { id: 'wrath', label: "Nature's Wrath", icoon: 'trees', bron: 'channel', kost: 1, soort: 'flits', woord: "Nature's Wrath",
      thema: 'druid', regel: (l, p) => `Strength save DC ${dc(l, p, 'cha')} of Restrained` } ] },
  { klasse: 'paladin', naam: 'Oath of Vengeance', match: /vengeance/i, acties: [
    { id: 'vow', label: 'Vow of Enmity', icoon: 'crosshair', bron: 'channel', kost: 1, soort: 'actief', doel: 'vijand',
      woord: 'Vow of Enmity', eindeBijGevecht: true, effecten: () => ['Advantage op attack rolls tegen dit wezen', 'Eén minuut'] } ] },

  // ── Ranger ──
  { klasse: 'ranger', naam: 'Fey Wanderer', match: /fey ?wanderer/i, acties: [
    { id: 'dreadful', label: 'Dreadful Strikes', icoon: 'sparkle', soort: 'worp', woord: 'Dreadful Strikes', thema: 'bard',
      formule: (l) => (l >= 11 ? '1d6' : '1d4'), soortSchade: 'Psychic', regel: () => 'Eén keer per beurt per doelwit' } ] },
  { klasse: 'ranger', naam: 'Gloom Stalker', match: /gloom/i,
    bronnen: { dread: { label: 'Dreadful Strike', max: (l, p) => minEen(mod(p, 'wis')), kort: () => null } },
    acties: [
      { id: 'dread', label: 'Dreadful Strike', icoon: 'moon', bron: 'dread', kost: 1, soort: 'worp', woord: 'Dreadful Strike',
        formule: () => '2d6', soortSchade: 'Psychic', thema: 'rogue' } ] },
  { klasse: 'ranger', naam: 'Hunter', match: /\bhunter\b/i, acties: [
    { id: 'colossus', label: 'Colossus Slayer', icoon: 'target', soort: 'worp', woord: 'Colossus Slayer',
      formule: () => '1d8', regel: () => 'Eén keer per beurt, tegen een gewond doelwit' } ] },

  // ── Rogue ──
  { klasse: 'rogue', naam: 'Assassin', match: /assassin/i, acties: [
    { id: 'assassinate', label: 'Assassinate', icoon: 'skull', soort: 'flits', woord: 'Assassinate',
      regel: (l) => `Eerste ronde: Advantage, en een treffer doet +${l} damage` } ] },
  { klasse: 'rogue', naam: 'Soulknife', match: /soulknife/i,
    bronnen: { psi: { label: 'Psionic Energy Dice', max: (l) => 2 * pb(l), kort: () => 'een' } },
    info: (l) => [`Psionic Energy Die ${psi(l)}`],
    acties: [
      { id: 'blades', label: 'Psychic Blades', icoon: 'stiletto', soort: 'worp', woord: 'Psychic Blades', thema: 'wizard',
        formule: () => '1d6', soortSchade: 'Psychic', regel: () => 'Het tweede mes als Bonus Action doet 1d4' },
      { id: 'knack', label: 'Psi-Bolstered Knack', icoon: 'brain', bron: 'psi', kost: 1, soort: 'worp', woord: 'Psi-Bolstered Knack',
        thema: 'wizard', formule: (l) => '1' + psi(l), regel: () => 'Bij een gefaalde check met een proficient skill of tool' } ] },

  // ── Sorcerer ──
  { klasse: 'sorcerer', naam: 'Clockwork Sorcery', match: /clockwork/i,
    bronnen: { balance: { label: 'Restore Balance', max: (l) => pb(l), kort: () => null } },
    acties: [
      { id: 'balance', label: 'Restore Balance', icoon: 'cog', bron: 'balance', kost: 1, soort: 'flits', woord: 'Restore Balance',
        thema: 'artificer', regel: () => 'Haalt Advantage of Disadvantage weg van één worp' } ] },
  { klasse: 'sorcerer', naam: 'Draconic Sorcery', match: /draconic/i, acties: [
    { id: 'wings', label: 'Dragon Wings', icoon: 'wind', vanaf: 14, soort: 'actief', woord: 'Dragon Wings',
      effecten: () => ['Vliegsnelheid 60 voet', 'Een uur'] } ] },
  { klasse: 'sorcerer', naam: 'Wild Magic Sorcery', match: /wild ?magic/i,
    bronnen: { tides: { label: 'Tides of Chaos', max: () => 1, kort: () => null } },
    acties: [
      { id: 'tides', label: 'Tides of Chaos', icoon: 'dices', bron: 'tides', kost: 1, soort: 'flits', woord: 'Tides of Chaos',
        conditie: 'tides-of-chaos', regel: () => 'Advantage op één d20 Test' } ] },

  // ── Warlock ──
  { klasse: 'warlock', naam: 'Archfey Patron', match: /archfey/i,
    bronnen: { steps: { label: 'Steps of the Fey', max: (l, p) => minEen(mod(p, 'cha')), kort: () => null } },
    acties: [
      { id: 'steps', label: 'Steps of the Fey', icoon: 'sparkle', bron: 'steps', kost: 1, soort: 'flits', woord: 'Misty Step',
        thema: 'bard', regel: () => 'Misty Step zonder spell slot' } ] },
  { klasse: 'warlock', naam: 'Celestial Patron', match: /celestial/i,
    bronnen: { light: { label: 'Healing Light', max: (l) => 1 + l, kort: () => null, eenheid: 'd6' } },
    acties: [
      { id: 'light', label: 'Healing Light', icoon: 'sun', bron: 'light', soort: 'genees', doel: 'bondgenoot', woord: 'Healing Light',
        thema: 'cleric', dobbels: { die: 'd6', max: (l, p) => minEen(mod(p, 'cha')) } } ] },
  { klasse: 'warlock', naam: 'Fiend Patron', match: /fiend/i, acties: [
    { id: 'blessing', label: "Dark One's Blessing", icoon: 'flame', soort: 'temp', doel: 'zelf', woord: "Dark One's Blessing",
      thema: 'sorcerer', formule: (l, p) => String(minEen(mod(p, 'cha') + l)), regel: () => 'Als je een vijand op 0 HP brengt' } ] },
  { klasse: 'warlock', naam: 'Great Old One Patron', match: /old one/i,
    bronnen: { clairvoyant: { label: 'Clairvoyant Combatant', max: (l) => (l >= 6 ? 1 : 0), kort: () => 'alles' } },
    acties: [
      { id: 'clairvoyant', label: 'Clairvoyant Combatant', icoon: 'eye', bron: 'clairvoyant', kost: 1, vanaf: 6, soort: 'flits',
        woord: 'Clairvoyant Combatant', regel: (l, p) => `Wisdom save DC ${dc(l, p, 'cha')}; bij een mislukking Advantage voor jou, Disadvantage voor hem` } ] },

  // ── Wizard ──
  { klasse: 'wizard', naam: 'Abjurer', match: /abjur/i,
    bronnen: { ward: { label: 'Arcane Ward', max: (l, p) => Math.max(0, 2 * l + mod(p, 'int')), kort: () => null, eenheid: 'HP' } },
    acties: [
      { id: 'ward', label: 'Ward vangt op', icoon: 'shield', bron: 'ward', bedragVerbruik: true, soort: 'flits', woord: 'Arcane Ward' },
      { id: 'laden', label: 'Ward laden', icoon: 'plus', bron: 'ward', soort: 'bijvullen', woord: 'Arcane Ward',
        keuze: { 'Niveau 1': 2, 'Niveau 2': 4, 'Niveau 3': 6, 'Niveau 4': 8, 'Niveau 5': 10, 'Niveau 6': 12,
          'Niveau 7': 14, 'Niveau 8': 16, 'Niveau 9': 18 }, regel: () => 'Na een Abjuration-spell met een slot' } ] },
  { klasse: 'wizard', naam: 'Diviner', match: /divin/i, acties: [
    { id: 'portent', label: 'Portent rollen', icoon: 'eye', soort: 'portent', aantal: (l) => (l >= 14 ? 3 : 2),
      woord: 'Portent', regel: () => 'Na een Long Rest' },
    { id: 'voorteken', label: 'Portent inzetten', icoon: 'dices', soort: 'portent-gebruik', woord: 'Portent',
      regel: () => 'Vervangt één d20-worp die je ziet' } ] },
  { klasse: 'wizard', naam: 'Evoker', match: /evoc|evoker/i,
    bronnen: { overchannel: { label: 'Overchannel', max: (l) => (l >= 14 ? 1 : 0), kort: () => null } },
    acties: [
      { id: 'overchannel', label: 'Overchannel', icoon: 'zap', bron: 'overchannel', kost: 1, vanaf: 14, soort: 'flits',
        woord: 'Overchannel', thema: 'sorcerer', regel: () => 'Maximale damage — de volgende keer kost het je zelf' } ] },
  { klasse: 'wizard', naam: 'Illusionist', match: /illusion/i,
    bronnen: { illusory: { label: 'Illusory Self', max: (l) => (l >= 10 ? 1 : 0), kort: () => 'alles' } },
    acties: [
      { id: 'illusory', label: 'Illusory Self', icoon: 'venetian-mask', bron: 'illusory', kost: 1, vanaf: 10, soort: 'flits',
        woord: 'Illusory Self', regel: () => 'Een aanval mist je vanzelf' } ] },
];

// De subclass die bij dit profiel hoort: de eerste naam of, bij multiclass, de tweede.
function subklasseVoor(klasseId, profiel, alsTweede) {
  const naam = String((alsTweede ? profiel?.multiSubclass : profiel?.subclass) || '');
  if (!naam) return null;
  return SUBKLASSEN.find(s => s.klasse === klasseId && s.match.test(naam)) || null;
}

// Class en subclass samen, zoals de server ermee werkt: bronnen en acties bij
// elkaar, en elke actie van de subclass draagt zijn naam zodat het blad ze
// apart kan zetten.
function definitie(klasseId, profiel, alsTweede) {
  const basis = KLASSEN[klasseId];
  if (!basis) return null;
  const sub = subklasseVoor(klasseId, profiel, alsTweede);
  if (!sub) return { ...basis, sub: null };
  return {
    ...basis,
    sub: sub.naam,
    bronnen: { ...basis.bronnen, ...(sub.bronnen || {}) },
    info: (l, p) => [...(basis.info ? basis.info(l, p) : []), ...(sub.info ? sub.info(l, p) : [])],
    acties: [...basis.acties, ...sub.acties.map(a => ({ ...a, sub: sub.naam }))],
  };
}

// Een actie terugvinden zonder te weten welke subclass iemand had (bij het
// opruimen na een gevecht).
function actieOp(klasseId, actieId) {
  return KLASSEN[klasseId]?.acties.find(a => a.id === actieId)
    || SUBKLASSEN.filter(s => s.klasse === klasseId).flatMap(s => s.acties).find(a => a.id === actieId) || null;
}

// Welke klassen dit profiel heeft, met level. Ook de tweede klasse telt.
function klassenVan(profiel) {
  const p = profiel || {};
  const uit = [];
  const voeg = (naam, lvl) => {
    const k = String(naam || '').trim().toLowerCase();
    const n = parseInt(lvl) || 0;
    if (KLASSEN[k] && n > 0) uit.push({ id: k, level: n, tweede });
  };
  let tweede = false;
  voeg(p.klasse, p.klasseLevel ?? p.level);
  tweede = true;
  if (p.multiclass === true || p.multiclass === 'true') voeg(p.multiKlasse, p.multiKlasseLevel);
  return uit;
}

module.exports = { KLASSEN, SUBKLASSEN, klassenVan, definitie, actieOp, drempel, mod, pb };
