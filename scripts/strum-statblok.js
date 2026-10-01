#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  STRUM — wie de woekeraar stuurt
// ════════════════════════════════════════════════════════════════════════════
// Trap 3 van de woekeraar is een gevecht, en dat gevecht moest bestaan. Strum
// staat al als personagekaartje in Grisburgh; hier krijgt hij een statblok, en
// hij neemt wat hulpjes mee.
//
// **Hoe hij geschaald is.** De party is zes spelers rond level 5-6. Het
// XP-budget van de 2024-DMG is per personage: op level 5 is 1.500 XP "hoog",
// dus zes spelers = 9.000 XP voor een zwaar gevecht, 6.000 voor een stevig.
// Deze opstelling komt op **5.700 XP** — stevig, niet dodelijk. Dat is met
// opzet: een schuldinner die de party afslacht beëindigt het verhaal, een die
// pijn doet begint het.
//
//   Strum               CR 8   3.900 XP
//   2× Schuldknecht     CR 3   1.400 XP
//   4× Knokker          CR 1/2   400 XP
//                              ─────────
//                               5.700 XP
//
// Alles is op de SRD 5.2 gebouwd (CC BY 4.0): Strum is een opgeschaalde
// Gladiator, de Schuldknecht een Veteran, de Knokker een Thug. Draai hem gerust
// zwaarder of lichter — het is jouw tafel.
//
//   node scripts/strum-statblok.js <campagne> [--schrijf]

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const campagne = args.find(a => !a.startsWith('--'));
const schrijfMode = args.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/strum-statblok.js <campagne> [--schrijf]'); process.exit(1); }
const base = path.join(__dirname, '..', 'data', 'campaigns', campagne);
if (!fs.existsSync(base)) { console.error('Campagne niet gevonden: ' + base); process.exit(1); }

const lees = (f, val) => {
  const p = path.join(base, f);
  if (!fs.existsSync(p)) return val;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return val; }
};

const MONSTERS = [
  {
    id: 'm_strum', name: 'Strum', maxHp: 130, initiative: 12, inBestiarium: true,
    description: 'De man die Woekeling stuurt als praten niet meer helpt. Hij komt nooit alleen, en hij begint altijd met voorlezen.',
    statblock: {
      size: 'Medium', type: 'Humanoid', alignment: 'any', ac: '16 (studded leather)',
      hp: '130 (17d8 + 54)', speed: '9 m',
      str: 18, dex: 15, con: 17, int: 10, wis: 12, cha: 15,
      savingThrows: 'Str +7, Dex +5, Con +6', skills: 'Athletics +7, Intimidation +5',
      senses: 'passieve Perception 11', languages: 'Common', cr: '8', xp: 3900,
      traits: 'Brave. Strum heeft advantage op saving throws tegen Frightened.\n\nBrute. Een melee-wapen doet één extra schadedobbelsteen als Strum ermee raakt (zit in de schade hieronder verwerkt).',
      actions: 'Multiattack. Strum doet drie aanvallen.\n\nKnuist. Melee Attack: +7, 1,5 m. Hit: 11 (2d6+4) bludgeoning.\n\nKetting. Melee Attack: +7, 3 m. Hit: 13 (2d8+4) bludgeoning, en het doelwit moet slagen voor een DC 15 Strength save of het is Grappled (ontsnappen DC 15).',
      bonusActions: 'Voorlezen. Strum leest een schuldbrief voor. Eén wezen dat hij kan zien en dat bij zijn meester in het krijt staat moet slagen voor een DC 13 Wisdom save of het is Frightened tot het einde van zijn volgende beurt.',
      reactions: 'Parry. Strum telt 3 bij zijn AC op tegen één melee-aanval die hem zou raken. Hij moet de aanvaller kunnen zien en een wapen vasthouden.',
    },
  },
  {
    id: 'm_schuldknecht', name: 'Schuldknecht', maxHp: 58, initiative: 11, inBestiarium: true,
    description: 'Een geoefende vechter in dienst van het huis. Hij telt mee en hij telt door.',
    statblock: {
      size: 'Medium', type: 'Humanoid', alignment: 'any', ac: '17 (splint)',
      hp: '58 (9d8 + 18)', speed: '9 m',
      str: 16, dex: 13, con: 14, int: 10, wis: 11, cha: 10,
      savingThrows: '', skills: 'Athletics +5, Perception +2',
      senses: 'passieve Perception 12', languages: 'Common', cr: '3', xp: 700,
      traits: '',
      actions: 'Multiattack. De schuldknecht doet twee aanvallen.\n\nKnuppel. Melee Attack: +5, 1,5 m. Hit: 9 (2d4+3) bludgeoning.\n\nKruisboog. Ranged Attack: +3, 30/120 m. Hit: 6 (1d10+1) piercing.',
      reactions: '',
    },
  },
  {
    id: 'm_knokker', name: 'Knokker', maxHp: 32, initiative: 10, inBestiarium: true,
    description: 'Ingehuurd per avond. Kent je naam niet en wil hem niet weten.',
    statblock: {
      size: 'Medium', type: 'Humanoid', alignment: 'any', ac: '11 (leather)',
      hp: '32 (5d8 + 10)', speed: '9 m',
      str: 15, dex: 11, con: 14, int: 10, wis: 10, cha: 11,
      savingThrows: '', skills: 'Intimidation +2',
      senses: 'passieve Perception 10', languages: 'Common', cr: '1/2', xp: 100,
      traits: 'Met z\'n tweeën. De knokker heeft advantage op een aanval als er een bondgenoot binnen 1,5 m van het doelwit staat die niet Incapacitated is.',
      actions: 'Multiattack. De knokker doet twee aanvallen.\n\nKnuppel. Melee Attack: +4, 1,5 m. Hit: 5 (1d6+2) bludgeoning.',
      reactions: '',
    },
  },
];

const ruw = lees('monsters.json', { monsters: [] });
const mon = Array.isArray(ruw) ? { monsters: ruw } : (ruw || { monsters: [] });
if (!Array.isArray(mon.monsters)) mon.monsters = [];

// Strum heeft al een personagekaartje; het statblok wijst daarnaar, zodat het
// kaartje en het gevecht dezelfde man zijn.
const ent = lees('entities.json', {});
const kaartje = (ent.personages || []).find(p => /^strum$/i.test(p.name || ''));
if (kaartje) MONSTERS[0].entityId = kaartje.id;

for (const m of MONSTERS) {
  const i = mon.monsters.findIndex(x => x.id === m.id);
  if (i >= 0) mon.monsters[i] = { ...mon.monsters[i], ...m }; else mon.monsters.push(m);
}

const enc = lees('encounters.json', { encounters: [] });
enc.encounters = enc.encounters || [];
const ENC_ID = 'enc_strum_komt_halen';
const gevecht = {
  id: ENC_ID, name: 'Strum komt het halen',
  akteId: null, backdropId: null, canvasPreset: null, canvasColors: null,
  monsters: [
    { monsterId: 'm_strum',        name: 'Strum',        count: 1, hp: 130, initiative: 12 },
    { monsterId: 'm_schuldknecht', name: 'Schuldknecht', count: 2, hp: 58,  initiative: 11 },
    { monsterId: 'm_knokker',      name: 'Knokker',      count: 4, hp: 32,  initiative: 10 },
  ],
  loot: { goud: { fl: 12, kn: 5, cl: 0 }, items: [] },
  dungeonId: null, roomId: null,
};
const ei = enc.encounters.findIndex(e => e.id === ENC_ID);
if (ei >= 0) enc.encounters[ei] = { ...enc.encounters[ei], ...gevecht }; else enc.encounters.push(gevecht);

console.log(`\nStrum voor "${campagne}":`);
console.log(`  statblokken   ${MONSTERS.length} (Strum CR 8, Schuldknecht CR 3, Knokker CR 1/2)`);
console.log(`  gevecht       "${gevecht.name}" — 1 + 2 + 4 = 7 tegenstanders, samen 5.700 XP`);
console.log(`  kaartje       ${kaartje ? 'gekoppeld aan ' + kaartje.name : 'geen Strum-kaartje gevonden'}`);

if (!schrijfMode) { console.log('\nProefdraai — niets geschreven. Voeg --schrijf toe.'); process.exit(0); }
for (const [naam, data] of [['monsters.json', mon], ['encounters.json', enc]]) {
  const p = path.join(base, naam);
  const bak = p + '.voor-strum.bak';
  if (fs.existsSync(p) && !fs.existsSync(bak)) fs.copyFileSync(p, bak);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}
console.log('\nGeschreven, met backups ernaast (*.voor-strum.bak).');
