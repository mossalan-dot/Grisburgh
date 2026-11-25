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
// Twee soorten bak, en ze vragen een andere zeef:
//  - bakken op een **personage-id** (beurs, HP, profiel, lening) — daarvoor is
//    de lijst personages genoeg;
//  - de **groepsvelden** (visibility, secretReveals, itemOwners, itemCharges,
//    flavourReveals, tierStand, deceased, gevangenen, huurlingen) — die staan
//    op het id van een kaartje van *elke* soort. Vroeger bleven die met rust,
//    "want daar zou dit script te grof zijn". Met de volledige kaartjeslijst
//    erbij valt er niets te raden: een sleutel die in géén van de vijf soorten
//    voorkomt, hoort bij een kaartje dat niet meer bestaat.
//
// Sinds 25 nov 2026 ruimt de verwijderroute dit zelf op (en de prullenbak zet
// het terug). Dit script is er voor wat er vóór die datum is blijven liggen.
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
// Alle kaartjes, van elke soort — de groepsvelden kennen dat onderscheid niet.
const alleKaartjes = new Set();
for (const t of Object.keys(ent)) for (const x of (ent[t] || [])) if (x?.id) alleKaartjes.add(x.id);

// De groepsvelden met een kaartje-id als sleutel. `afwezig` is een lijst en
// staat hieronder apart.
const GROEPSBAKKEN = [
  'visibility', 'secretReveals', 'flavourReveals', 'itemOwners', 'itemCharges',
  'itemMaxCharges', 'tierStand', 'deceased', 'gevangenen', 'huurlingen',
];

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

// ── En de groepsvelden ──
const groepWees = [];
for (const [gid, g] of Object.entries(state.groups || {})) {
  const naam = g?.name || gid;
  for (const bak of GROEPSBAKKEN) {
    for (const id of Object.keys(g?.[bak] || {})) {
      if (!alleKaartjes.has(id)) groepWees.push({ gid, naam, bak, id });
    }
  }
  const weg = (g?.afwezig || []).filter(id => !alleKaartjes.has(id));
  for (const id of weg) groepWees.push({ gid, naam, bak: 'afwezig', id });
}

// ── Party's die niet meer bestaan ───────────────────────────────────────────
// Niet alles van een party staat in `groups[id]`. De akte-zichtbaarheid heeft
// een eigen bestand en een dungeon houdt zijn mist, zijn toegang en zijn
// "uitgespeeld" per party bij — en `DELETE /groups/:id` ruimde dat tot
// 25 nov 2026 geen van beide op. De **prullenbak** blijft met rust: die is een
// bevroren verleden, en een undo die de party-stand niet meer kent is een halve.
const bestaandeParty = new Set(Object.keys(state.groups || {}));
const padCv  = path.join(map, 'chapter-visibility.json');
const padDng = path.join(map, 'dungeon-maps.json');
const lees = (pad) => { try { return JSON.parse(fs.readFileSync(pad, 'utf8')); } catch { return null; } };
const cv  = lees(padCv);
const dng = lees(padDng);
const partyWees = [];
for (const gid of Object.keys(cv || {})) {
  if (!bestaandeParty.has(gid)) partyWees.push({ bestand: 'chapter-visibility.json', gid,
    wat: `${Object.keys(cv[gid] || {}).length} akte-instelling(en)` });
}
for (const m of (dng?.maps || [])) {
  for (const gid of Object.keys(m.reveals || {})) {
    if (!bestaandeParty.has(gid)) partyWees.push({ bestand: 'dungeon-maps.json', gid, wat: `mist op "${m.name}"` });
  }
  for (const veld of ['partyAccess', 'partyCompleted']) {
    for (const gid of (m[veld] || [])) {
      if (!bestaandeParty.has(gid)) partyWees.push({ bestand: 'dungeon-maps.json', gid, wat: `${veld} op "${m.name}"` });
    }
  }
}
if (!perWees.size && !groepWees.length && !partyWees.length) {
  console.log('Niets verweesd — alles wijst naar een bestaand kaartje en een bestaande party.');
  process.exit(0);
}

if (partyWees.length) {
  console.log(`\n── party's die niet meer bestaan (${partyWees.length}) ──`);
  for (const w of partyWees) console.log(`  ${w.gid}  ${w.bestand.padEnd(24)} ${w.wat}`);
}


if (perWees.size) {
  console.log(`${perWees.size} verdwenen personage(s), ${totaal} achtergebleven vermelding(en):\n`);
  for (const [id, waar] of perWees) console.log(`  ${id}\n    ${waar.join(', ')}`);
}
if (groepWees.length) {
  console.log(`\n${groepWees.length} groepsveld(en) op een kaartje dat niet meer bestaat:\n`);
  const perParty = new Map();
  for (const w of groepWees) {
    if (!perParty.has(w.naam)) perParty.set(w.naam, []);
    perParty.get(w.naam).push(`${w.bak} → ${w.id}`);
  }
  for (const [naam, rijen] of perParty) console.log(`  ${naam}\n    ${rijen.join('\n    ')}`);
}

if (!schrijf) { console.log('\n(proefdraai — voeg --schrijf toe om het echt op te ruimen)'); process.exit(0); }

if (partyWees.length) {
  const weg = new Set(partyWees.map(w => w.gid));
  const vandaag = new Date().toISOString().slice(0, 10);
  // Alleen schrijven wat echt verandert. Een bestand herschrijven dat niets
  // verweesds bevat levert een kopie op die niemand nodig heeft, en het is
  // nodeloos risico op het enige moment dat dit script iets kapot kán maken.
  const bewaar = (pad, data, geraakt) => {
    if (!geraakt) return;
    fs.copyFileSync(pad, pad.replace(/\.json$/, `.voor-wezen.${vandaag}.json`));
    fs.writeFileSync(pad, JSON.stringify(data, null, 2));
  };
  let cvRaak = 0;
  for (const gid of weg) if (cv && cv[gid]) { delete cv[gid]; cvRaak++; }
  bewaar(padCv, cv, cvRaak);

  let dngRaak = 0;
  for (const m of (dng?.maps || [])) {
    for (const gid of weg) if (m.reveals && m.reveals[gid]) { delete m.reveals[gid]; dngRaak++; }
    for (const veld of ['partyAccess', 'partyCompleted']) {
      if (!Array.isArray(m[veld])) continue;
      const over = m[veld].filter(g => !weg.has(g));
      if (over.length !== m[veld].length) { m[veld] = over; dngRaak++; }
    }
  }
  bewaar(padDng, dng, dngRaak);
}

for (const w of groepWees) {
  const g = state.groups?.[w.gid];
  if (!g) continue;
  if (w.bak === 'afwezig') g.afwezig = (g.afwezig || []).filter(id => id !== w.id);
  else if (g[w.bak]) delete g[w.bak][w.id];
}

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
