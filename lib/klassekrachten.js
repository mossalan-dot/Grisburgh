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
//                   'actief'     — een toestand aan (met `conditie`, `tekst`, `tempHp`)
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
    info: (l) => [`Max CR ${drempel({ 2: '1/4', 4: '1/2', 8: '1' }, l) || '—'}`, `${l} Temporary HP`],
    acties: [
      { id: 'wildshape', label: 'Wild Shape', icoon: 'paw-print', bron: 'wildshape', kost: 1, vanaf: 2,
        soort: 'actief', conditie: 'wild-shape', tekst: 'In welke Beast?', woord: 'Wild Shape',
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

// Welke klassen dit profiel heeft, met level. Ook de tweede klasse telt.
function klassenVan(profiel) {
  const p = profiel || {};
  const uit = [];
  const voeg = (naam, lvl) => {
    const k = String(naam || '').trim().toLowerCase();
    const n = parseInt(lvl) || 0;
    if (KLASSEN[k] && n > 0) uit.push({ id: k, level: n });
  };
  voeg(p.klasse, p.klasseLevel ?? p.level);
  if (p.multiclass === true || p.multiclass === 'true') voeg(p.multiKlasse, p.multiKlasseLevel);
  return uit;
}

module.exports = { KLASSEN, klassenVan, drempel, mod, pb };
