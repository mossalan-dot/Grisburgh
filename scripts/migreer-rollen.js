#!/usr/bin/env node
// Eenmalige opruiming: subtype 'verkoper' en 'antagonist' waren geen soorten
// kaartjes maar rollen. Ze verhuizen naar data.tags, het subtype wordt NPC, en
// een antagonist krijgt meteen 'vijand' als kant in gevecht.
//
// De code werkt ook zonder deze migratie (oude subtypes tellen mee als rol),
// dus dit is opschonen, geen voorwaarde. Draai per campagne:
//   node scripts/migreer-rollen.js <campagne> [--schrijf]
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/migreer-rollen.js <campagne> [--schrijf]'); process.exit(1); }

const bestand = path.join(__dirname, '..', 'data', 'campaigns', campagne, 'entities.json');
const entities = JSON.parse(fs.readFileSync(bestand, 'utf8'));
const ROLLEN = ['verkoper', 'antagonist'];

let veranderd = 0;
for (const p of entities.personages || []) {
  const sub = String(p.subtype || '').toLowerCase();
  if (!ROLLEN.includes(sub) && sub !== '') continue;

  if (!p.data) p.data = {};
  let tags = [];
  try { tags = JSON.parse(p.data.tags || '[]'); } catch { tags = []; }

  if (ROLLEN.includes(sub)) {
    if (!tags.includes(sub)) tags.push(sub);
    p.data.tags = JSON.stringify(tags);
    if (sub === 'antagonist' && !p.data.kant) p.data.kant = 'vijand';
  }
  p.subtype = 'NPC';        // ook de kaartjes zonder subtype
  veranderd++;
}

console.log(`${campagne}: ${veranderd} kaartjes omgezet`);
if (schrijf) {
  const kopie = bestand.replace(/\.json$/, `.voor-rollen.${new Date().toISOString().slice(0, 10)}.json`);
  if (!fs.existsSync(kopie)) fs.copyFileSync(bestand, kopie);
  fs.writeFileSync(bestand, JSON.stringify(entities, null, 2));
  console.log(`geschreven; kopie van de oude stand staat in ${path.basename(kopie)}`);
} else {
  console.log('(proefdraai — voeg --schrijf toe om het echt te doen)');
}
