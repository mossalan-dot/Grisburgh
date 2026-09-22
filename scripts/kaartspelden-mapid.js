#!/usr/bin/env node
// Spelden zonder `mapId` aan hun kaart knopen.
//
// Toen een campagne nog één kaart had, droeg een speld geen kaart-id: de code
// viel overal terug op `p.mapId || 'grisburgh'` — tien plekken in routes/api.js
// en public/js/api.js. Dat is geen standaardwaarde maar een verkapte migratie,
// en hij werkt alleen in Grisburgh: een campagne waar de kaarten anders heten
// (in Test zijn het `demo_stad` en `demo_wereld`) zou zo'n oude speld nergens
// meer tonen — hij hoort dan bij een kaart die niet bestaat.
//
// Dit script zet het id er expliciet bij, zodat de terugval weg kan. De speld
// gaat naar de **eerste kaart** in map.json: dat is de kaart die er was toen
// die spelden gemaakt werden.
//
//   node scripts/kaartspelden-mapid.js <campagne>            # alleen tonen
//   node scripts/kaartspelden-mapid.js <campagne> --schrijf  # doen
//
// Bij --schrijf komt er een kopie naast: map.voor-mapid.<datum>.json

const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/kaartspelden-mapid.js <campagne> [--schrijf]');
  process.exit(1);
}

const dir = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const pad = path.join(dir, 'campaigns', campagne, 'map.json');
if (!fs.existsSync(pad)) { console.error('Niet gevonden: ' + pad); process.exit(1); }

const data  = JSON.parse(fs.readFileSync(pad, 'utf8'));
const maps  = data.maps || [];
const pins  = data.pins || [];
const zonder = pins.filter(p => !p.mapId);

console.log(`kaarten: ${maps.length}${maps.length ? ' (' + maps.map(m => m.id).join(', ') + ')' : ''}`);
console.log(`spelden: ${pins.length} · zonder mapId: ${zonder.length}`);

if (!zonder.length) { console.log('\nNiets te doen.'); process.exit(0); }
if (!maps.length)   { console.error('\nGeen kaarten in deze campagne — kan niet bepalen waar ze bij horen.'); process.exit(1); }

const doel = maps[0].id;
console.log(`\nDeze gaan naar de eerste kaart (${doel}):`);
for (const p of zonder) console.log(`  ${p.id}  → locatie ${p.locId}`);

if (!schrijf) { console.log('\n(proefdraai — voeg --schrijf toe om het echt te doen)'); process.exit(0); }

for (const p of zonder) p.mapId = doel;
const datum = new Date().toISOString().slice(0, 10);
const kopie = pad.replace(/\.json$/, `.voor-mapid.${datum}.json`);
fs.copyFileSync(pad, kopie);
fs.writeFileSync(pad, JSON.stringify(data, null, 2));
console.log(`\nGeschreven. Kopie: ${path.basename(kopie)}`);
