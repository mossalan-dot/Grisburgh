#!/usr/bin/env node
/**
 * test-pcs-vullen.js — vult een campagne met één speler per klasse.
 *
 *   node scripts/test-pcs-vullen.js Test            # alleen rekenen
 *   node scripts/test-pcs-vullen.js Test --schrijf  # echt aanmaken
 *
 * Waarom: het personageblad, de progressie en het spreukenboek gedragen zich per
 * klasse anders — een Warlock heeft pact-slots, een Cleric bereidt voor, een
 * Fighter heeft helemaal geen spreuken, en een Artificer heeft in onze seed geen
 * subklassen. Zonder een speler van elke soort test je altijd dezelfde Wizard.
 *
 * De drie bestaande spelers van de testomgeving (Wizard, Rogue, Druid) blijven
 * staan; dit vult de tien die ontbreken aan.
 *
 * Elk kaartje krijgt een id `t_pc_<klasse>`, dus in één greep terug te vinden en
 * weg te gooien. Draai je het twee keer, dan slaat hij bestaande over.
 *
 * Bewust gevarieerd, want dat is juist wat je wil kunnen zien:
 *  - **Levels 1 t/m 11**, zodat de tijdlijn in Progressie vergrendelde niveaus toont.
 *  - **Twee zonder subklasse**: de Warlock is level 2 (kiest pas op 3) en de
 *    Artificer heeft er in de seed geen — dat is een echt randgeval.
 *  - **Dertien verschillende volken**, waaronder één uit `volkenOverig` (Tabaxi),
 *    want die lijst wordt elders in de app anders behandeld.
 *  - Spreukenlijsten voor wie ze heeft, een leeg spreukenboek voor wie niet.
 */
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/test-pcs-vullen.js <campagne> [--schrijf]');
  process.exit(1);
}
const dir = path.join(__dirname, '..', 'data', 'campaigns', campagne);
if (!fs.existsSync(dir)) { console.error('Geen campagne in ' + dir); process.exit(1); }

const lees  = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const mod   = (v) => Math.floor((v - 10) / 2);
const teken = (n) => (n >= 0 ? '+' : '') + n;
const prof  = (lvl) => 2 + Math.floor((lvl - 1) / 4);

// Hit die per klasse — hetzelfde rijtje als CLASS_HIT_DIE op de server.
const HD = { Artificer: 8, Barbarian: 12, Bard: 8, Cleric: 8, Druid: 8, Fighter: 10,
             Monk: 8, Paladin: 10, Ranger: 10, Rogue: 8, Sorcerer: 6, Warlock: 8, Wizard: 6 };

const PCS = [
  { klasse: 'Barbarian', sub: 'Path of the Berserker',   ras: 'Goliath',   lvl: 6,  bg: 'Soldier',
    naam: 'Bruna Bergveld',   rol: 'Slaat eerst, telt later',
    scores: { str: 18, dex: 14, con: 16, int: 8,  wis: 12, cha: 10 }, saves: 'str,con',
    skills: ['athletics','intimidation','perception','survival'], ac: 15, speed: '35 ft',
    wapens: [{ name: 'Greataxe', atk: '+7', dmg: '1d12+4 Slashing', props: ['Heavy','Two-Handed'] },
             { name: 'Handaxe',  atk: '+7', dmg: '1d6+4 Slashing',  props: ['Light','Thrown (20/60)'] }] },

  { klasse: 'Bard', sub: 'College of Lore', ras: 'Half-Elf', lvl: 4, bg: 'Entertainer',
    naam: 'Fidelio Kwartel', rol: 'Kent van iedereen een liedje',
    scores: { str: 8, dex: 16, con: 12, int: 13, wis: 10, cha: 17 }, saves: 'dex,cha',
    skills: ['performance','persuasion','deception','history','insight'], ac: 14, speed: '30 ft',
    wapens: [{ name: 'Rapier', atk: '+5', dmg: '1d8+3 Piercing', props: ['Finesse'] }],
    dc: 14, atkBonus: 6,
    spreuken: { cantrips: ['Vicious Mockery','Minor Illusion'], 1: ['Healing Word','Faerie Fire','Dissonant Whispers'], 2: ['Shatter','Invisibility'] } },

  { klasse: 'Cleric', sub: 'Life Domain', ras: 'Aasimar', lvl: 8, bg: 'Acolyte',
    naam: 'Zuster Marelle', rol: 'Geneest met tegenzin',
    scores: { str: 14, dex: 10, con: 15, int: 10, wis: 18, cha: 13 }, saves: 'wis,cha',
    skills: ['medicine','religion','insight','persuasion'], ac: 18, speed: '30 ft',
    wapens: [{ name: 'Mace', atk: '+6', dmg: '1d6+2 Bludgeoning' }],
    dc: 17, atkBonus: 9,
    spreuken: { cantrips: ['Sacred Flame','Guidance','Spare the Dying'], 1: ['Cure Wounds','Bless','Shield of Faith'], 2: ['Spiritual Weapon','Lesser Restoration'], 3: ['Revivify','Spirit Guardians'], 4: ['Death Ward'] } },

  { klasse: 'Fighter', sub: 'Battle Master', ras: 'Dragonborn', lvl: 11, bg: 'Soldier',
    naam: 'Kadrik Vuurmond', rol: 'Vecht met een plan',
    scores: { str: 18, dex: 14, con: 16, int: 13, wis: 12, cha: 10 }, saves: 'str,con',
    skills: ['athletics','intimidation','perception','history'], ac: 18, speed: '30 ft',
    wapens: [{ name: 'Longsword', atk: '+9', dmg: '1d8+4 Slashing', props: ['Versatile (1d10)'] },
             { name: 'Longbow',   atk: '+7', dmg: '1d8+2 Piercing', props: ['Heavy','Two-Handed','Ammunition'] }] },

  { klasse: 'Monk', sub: 'Warrior of the Open Hand', ras: 'Tabaxi', lvl: 5, bg: 'Hermit',
    naam: 'Stille Mira', rol: 'Praat weinig, beweegt veel',
    scores: { str: 12, dex: 18, con: 14, int: 10, wis: 16, cha: 8 }, saves: 'str,dex',
    skills: ['acrobatics','stealth','insight','athletics'], ac: 17, speed: '40 ft',
    wapens: [{ name: 'Unarmed Strike', atk: '+7', dmg: '1d6+4 Bludgeoning' },
             { name: 'Shortsword',     atk: '+7', dmg: '1d6+4 Piercing', props: ['Finesse','Light'] }] },

  { klasse: 'Paladin', sub: 'Oath of Devotion', ras: 'Orc', lvl: 7, bg: 'Noble',
    naam: 'Heer Orbec', rol: 'Neemt zijn eed veel te serieus',
    scores: { str: 17, dex: 10, con: 15, int: 8, wis: 12, cha: 16 }, saves: 'wis,cha',
    skills: ['athletics','persuasion','religion','intimidation'], ac: 19, speed: '30 ft',
    wapens: [{ name: 'Warhammer', atk: '+7', dmg: '1d8+3 Bludgeoning', props: ['Versatile (1d10)'] }],
    dc: 14, atkBonus: 6,
    spreuken: { 1: ['Divine Favor','Shield of Faith','Cure Wounds'], 2: ['Aid','Magic Weapon'] } },

  { klasse: 'Ranger', sub: 'Gloom Stalker', ras: 'Elf', lvl: 3, bg: 'Guide',
    naam: 'Thalia Nachtvaren', rol: 'Ziet je aankomen',
    scores: { str: 12, dex: 17, con: 14, int: 10, wis: 15, cha: 8 }, saves: 'str,dex',
    skills: ['stealth','survival','perception','nature'], ac: 15, speed: '30 ft',
    wapens: [{ name: 'Shortbow',   atk: '+5', dmg: '1d6+3 Piercing', props: ['Ammunition','Two-Handed'] },
             { name: 'Shortsword', atk: '+5', dmg: '1d6+3 Piercing', props: ['Finesse','Light'] }],
    dc: 12, atkBonus: 4,
    spreuken: { 1: ['Hunter’s Mark','Cure Wounds'] } },

  { klasse: 'Sorcerer', sub: 'Draconic Sorcery', ras: 'Tiefling', lvl: 9, bg: 'Charlatan',
    naam: 'Vespera Asdoorn', rol: 'Magie zit in de familie, helaas',
    scores: { str: 8, dex: 14, con: 15, int: 12, wis: 10, cha: 18 }, saves: 'con,cha',
    skills: ['deception','persuasion','arcana','intimidation'], ac: 15, speed: '30 ft',
    wapens: [{ name: 'Dagger', atk: '+6', dmg: '1d4+2 Piercing', props: ['Finesse','Light','Thrown (20/60)'] }],
    dc: 16, atkBonus: 8,
    spreuken: { cantrips: ['Fire Bolt','Prestidigitation','Mage Hand','Shocking Grasp'], 1: ['Shield','Magic Missile'], 2: ['Misty Step','Scorching Ray'], 3: ['Fireball','Counterspell'], 4: ['Greater Invisibility'], 5: ['Hold Monster'] } },

  // Level 2: kiest zijn patroon pas op 3 — zo zie je de stand "nog geen subklasse".
  { klasse: 'Warlock', sub: '', ras: 'Gnome', lvl: 2, bg: 'Sage',
    naam: 'Pim Grondel', rol: 'Heeft iets beloofd dat hij niet begreep',
    scores: { str: 8, dex: 14, con: 14, int: 13, wis: 10, cha: 16 }, saves: 'wis,cha',
    skills: ['arcana','investigation','deception'], ac: 13, speed: '30 ft',
    wapens: [{ name: 'Quarterstaff', atk: '+2', dmg: '1d6 Bludgeoning', props: ['Versatile (1d8)'] }],
    dc: 13, atkBonus: 5,
    spreuken: { cantrips: ['Eldritch Blast','Minor Illusion'], 1: ['Hex','Armor of Agathys'] } },

  // De Artificer heeft in onze seed géén subklassen — ook dat wil je een keer zien.
  { klasse: 'Artificer', sub: '', ras: 'Half-Orc', lvl: 1, bg: 'Artisan',
    naam: 'Nout Raderkamp', rol: 'Repareert dingen die niet stuk waren',
    scores: { str: 12, dex: 14, con: 14, int: 17, wis: 10, cha: 8 }, saves: 'con,int',
    skills: ['arcana','investigation','sleight of hand'], ac: 14, speed: '30 ft',
    wapens: [{ name: 'Light Crossbow', atk: '+4', dmg: '1d8+2 Piercing', props: ['Ammunition','Two-Handed'] }],
    dc: 13, atkBonus: 5,
    spreuken: { cantrips: ['Mending','Fire Bolt'], 1: ['Cure Wounds','Faerie Fire'] } },
];

const entities = lees('entities.json');
const dmState  = lees('dm-state.json');
if (!entities.personages) entities.personages = [];
if (!dmState.playerProfiles) dmState.playerProfiles = {};
if (!dmState.playerHp) dmState.playerHp = {};

const groepen = Object.keys(dmState.groups || {});
if (!groepen.length) { console.error('Geen groepen in deze campagne.'); process.exit(1); }

let nieuw = 0, over = 0;
PCS.forEach((pc, i) => {
  const id = 't_pc_' + pc.klasse.toLowerCase();
  if (entities.personages.some(e => e.id === id)) { over++; return; }

  // Om en om over de party's, zodat allebei speelbaar blijven.
  const groep = groepen[i % groepen.length];
  const conMod = mod(pc.scores.con);
  const maxHp  = HD[pc.klasse] + conMod + (pc.lvl - 1) * (Math.floor(HD[pc.klasse] / 2) + 1 + conMod);

  entities.personages.push({
    id, name: pc.naam, subtype: 'speler',
    data: {
      groep, ras: pc.ras, klasse: pc.klasse, rol: pc.rol,
      kant: 'neutraal', tags: '[]', imgFocus: '50% 50%',
      alignment: 'Neutral Good',
      desc: `${pc.ras} ${pc.klasse}, level ${pc.lvl}. Aangemaakt om de app per klasse te kunnen nakijken.`,
    },
  });

  const skillProfs = {};
  for (const s of pc.skills) skillProfs[s.replace(/ /g, '')] = 'prof';

  dmState.playerProfiles[id] = {
    klasse: pc.klasse, subclass: pc.sub, level: String(pc.lvl),
    origin: pc.ras, background: pc.bg,
    ac: String(pc.ac), speed: pc.speed,
    initiative: teken(mod(pc.scores.dex)),
    profBonus: teken(prof(pc.lvl)),
    ...pc.scores,
    saveProfs: pc.saves,
    ...(pc.dc ? { spellSaveDC: String(pc.dc), spellAttackBonus: String(pc.atkBonus) } : {}),
    skillProfs: JSON.stringify(skillProfs),
    skillAdj: '{}',
    bookmarks: [],
    languages: 'Common',
    senses: '',
    weapons: JSON.stringify(pc.wapens),
    featChoices: '{}',
  };
  dmState.playerHp[id] = { current: maxHp, max: maxHp };

  // Spreuken in het boek van de speler, in de vorm die playerSpells verwacht.
  if (pc.spreuken) {
    if (!dmState.playerSpells) dmState.playerSpells = {};
    const lijst = [];
    for (const [niv, namen] of Object.entries(pc.spreuken)) {
      for (const naam of namen) {
        lijst.push({
          index: naam.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          name: naam, level: niv === 'cantrips' ? 0 : parseInt(niv), prepared: true,
        });
      }
    }
    dmState.playerSpells[id] = lijst;
  }
  nieuw++;
  console.log(`  + ${pc.naam.padEnd(20)} ${pc.ras.padEnd(11)} ${pc.klasse.padEnd(10)} lvl ${String(pc.lvl).padStart(2)}  ${pc.sub || '(geen subklasse)'}  → ${dmState.groups[groep].name}`);
});

console.log(`\n${campagne}: ${nieuw} aangemaakt, ${over} bestonden al.`);
if (!schrijf) { console.log('Proefronde — er is niets geschreven. Draai opnieuw met --schrijf.'); process.exit(0); }

for (const [f, data] of [['entities.json', entities], ['dm-state.json', dmState]]) {
  const kopie = path.join(dir, f.replace('.json', `.voor-testpcs.${new Date().toISOString().slice(0,10)}.json`));
  if (!fs.existsSync(kopie)) fs.copyFileSync(path.join(dir, f), kopie);
  fs.writeFileSync(path.join(dir, f), JSON.stringify(data, null, 2));
}
console.log('Geschreven; kopieën staan ernaast als *.voor-testpcs.<datum>.json');
