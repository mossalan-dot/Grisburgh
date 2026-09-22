#!/usr/bin/env node
// Wat er achterbleef toen een personage-kaartje werd verwijderd.
//
// De app bewaart per personage van alles buiten het kaartje om: zijn beurs,
// zijn HP, zijn profiel, zijn boedel, een lopende lening, een dossier bij de
// detective. Verwijder je het kaartje, dan blijft dat allemaal staan onder een
// id dat nergens meer heen wijst. Het doet geen kwaad — niemand ziet het — maar
// het maakt `dm-state.json` op den duur onleesbaar, en een verweesde lening is
// niet af te lossen omdat er geen speler meer is die hem draagt.
//
//   node scripts/wezen-opruimen.js <campagne>            # alleen tonen
//   node scripts/wezen-opruimen.js <campagne> --schrijf  # opruimen
//
// Raakt alléén bakken aan die op een **personage-id** staan. De groepsvelden
// (visibility, secretReveals, itemOwners) blijven met rust: die gaan over
// kaartjes van elke soort, en daar zou dit script te grof zijn.
//
// Bij --schrijf komt er een kopie naast: dm-state.voor-wezen.<datum>.json

const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/wezen-opruimen.js <campagne> [--schrijf]');
  process.exit(1);
}

const dir = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const map = path.join(dir, 'campaigns', campagne);
const padState = path.join(map, 'dm-state.json');
const padEnt   = path.join(map, 'entities.json');
for (const p of [padState, padEnt]) {
  if (!fs.existsSync(p)) { console.error('Niet gevonden: ' + p); process.exit(1); }
}

const state = JSON.parse(fs.readFileSync(padState, 'utf8'));
const ent   = JSON.parse(fs.readFileSync(padEnt, 'utf8'));
const bestaat = new Set((ent.personages || []).map(e => e.id));

// Bakken met een personage-id als sleutel.
const BAKKEN = [
  'playerCurrency', 'playerHp', 'playerProfiles', 'playerItems', 'playerSpells',
  'playerSpellSlots', 'playerTraits', 'playerTrackers', 'playerHitDice',
  'playerExhaustion', 'playerXp', 'levelUps', 'gockState', 'magizooState',
  'heerenBoetes',
];

let totaal = 0;
const perWees = new Map();
const meld = (wie, waar) => {
  if (!perWees.has(wie)) perWees.set(wie, []);
  perWees.get(wie).push(waar);
  totaal++;
};

for (const bak of BAKKEN) {
  for (const id of Object.keys(state[bak] || {})) {
    if (!bestaat.has(id)) meld(id, bak);
  }
}
// De lening zit een niveau dieper.
for (const id of Object.keys(state.tweespalt?.leningen || {})) {
  if (!bestaat.has(id)) meld(id, 'tweespalt.leningen');
}

if (!perWees.size) { console.log('Niets verweesd — alles wijst naar een bestaand kaartje.'); process.exit(0); }

console.log(`${perWees.size} verdwenen personage(s), ${totaal} achtergebleven vermelding(en):\n`);
for (const [id, waar] of perWees) console.log(`  ${id}\n    ${waar.join(', ')}`);

if (!schrijf) { console.log('\n(proefdraai — voeg --schrijf toe om het echt op te ruimen)'); process.exit(0); }

for (const bak of BAKKEN) {
  for (const id of Object.keys(state[bak] || {})) if (!bestaat.has(id)) delete state[bak][id];
}
for (const id of Object.keys(state.tweespalt?.leningen || {})) {
  if (!bestaat.has(id)) delete state.tweespalt.leningen[id];
}

const datum = new Date().toISOString().slice(0, 10);
const kopie = padState.replace(/\.json$/, `.voor-wezen.${datum}.json`);
fs.copyFileSync(padState, kopie);
fs.writeFileSync(padState, JSON.stringify(state, null, 2));
console.log(`\nOpgeruimd. Kopie: ${path.basename(kopie)}`);
