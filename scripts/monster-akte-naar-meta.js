#!/usr/bin/env node
// `chapter` op een monster verhuist naar de aktekant.
//
// Zelfde beweging als bij de documenten (8 sep): een kaartje beschrijft wát
// iets is, niet wanneer het in het verhaal voorkomt. Bij documenten kon het
// veld zo weg omdat de akte ze al noemde; bij monsters bestond die lijst nog
// niet — en puur afleiden uit de encounters zou 11 van de 31 koppelingen
// weggooien (troepen die klaarstaan maar nog in geen gevecht zitten).
// Daarom eerst overzetten, dán weghalen.
//
//   node scripts/monster-akte-naar-meta.js <campagne> [--schrijf]
const fs = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/monster-akte-naar-meta.js <campagne> [--schrijf]'); process.exit(1); }

const DIR = path.join(__dirname, '..', 'data', 'campaigns', campagne);
const lees = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));

const meta = lees('meta.json');
const rauw = lees('monsters.json');
const lijst = Array.isArray(rauw) ? rauw : (rauw.monsters || []);
const encRauw = lees('encounters.json');
const encs = Array.isArray(encRauw) ? encRauw : (encRauw.encounters || []);

// Wat de encounters al zeggen hoeft niet in de lijst: die kant wordt afgeleid.
const viaEncounter = {};
for (const e of encs) for (const r of (e.monsters || [])) {
  if (e.akteId && r.monsterId) (viaEncounter[e.akteId] = viaEncounter[e.akteId] || new Set()).add(r.monsterId);
}

meta.hoofdstukken = meta.hoofdstukken || {};
let gezet = 0, alAfgeleid = 0, geenAkte = 0;
for (const m of lijst) {
  const key = String(m.chapter || '').trim();
  if (!key) continue;
  if (!meta.hoofdstukken[key]) { console.log(`  ! akte ${key} bestaat niet (${m.name}) — overgeslagen`); geenAkte++; continue; }
  if (viaEncounter[key]?.has(m.id)) { alAfgeleid++; continue; }   // komt er al uit de encounters
  const lijstje = meta.hoofdstukken[key].monsters = meta.hoofdstukken[key].monsters || [];
  if (!lijstje.includes(m.id)) { lijstje.push(m.id); gezet++; console.log(`  ${m.name} → akte ${key}`); }
}

for (const m of lijst) delete m.chapter;

console.log(`\n${gezet} koppeling(en) naar de aktekant gezet`);
console.log(`${alAfgeleid} stonden al in een encounter van die akte (die leiden we af)`);
if (geenAkte) console.log(`${geenAkte} verwezen naar een akte die niet bestaat`);
console.log(`chapter verwijderd van ${lijst.length} monsters`);

if (!schrijf) { console.log('\n(niets geschreven — draai met --schrijf)'); process.exit(0); }
const datum = new Date().toISOString().slice(0, 10);
for (const n of ['monsters.json', 'meta.json']) fs.copyFileSync(path.join(DIR, n), path.join(DIR, n.replace('.json', `.voor-akteveld.${datum}.json`)));
fs.writeFileSync(path.join(DIR, 'monsters.json'), JSON.stringify(Array.isArray(rauw) ? lijst : { ...rauw, monsters: lijst }, null, 2));
fs.writeFileSync(path.join(DIR, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(`\nGeschreven (kopieën ernaast als *.voor-akteveld.${datum}.json)`);
