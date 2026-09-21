#!/usr/bin/env node
// Voorraadregels die naar een verdwenen voorwerpkaartje wijzen weer aan het
// juiste kaartje knopen.
//
// Waarom dit nodig was: een regel in `data.voorraad` draagt een `entityId`. Wijst
// dat nergens heen, dan weet de app niets van het voorwerp — geen beschrijving,
// geen rariteit, geen doorklik — en gold de regel tot 21 sep 2026 bovendien als
// *uniek*, waardoor hij na één verkoop op uitverkocht ging. In Grisburgh trof
// dat 12 van de 79 gekoppelde regels: de gewone wapens bij De Kromme Spijker,
// met ids uit een oudere reeks (`e_1774000000001_w0001`) die niet meer bestaat.
//
// De kaartjes zélf bestaan wel, onder exact dezelfde naam. Dit script koppelt op
// naam (genormaliseerd: kleine letters, dubbele spaties weg, diakriet eraf) en
// raakt alleen regels aan waarvan het huidige id nergens heen wijst. Een regel
// zonder `entityId` blijft zoals hij is — dat is een bewuste keuze van de DM.
//
//   node scripts/voorraad-herkoppelen.js <campagne>            # alleen tonen
//   node scripts/voorraad-herkoppelen.js <campagne> --schrijf  # doen
//
// Bij --schrijf komt er een kopie naast: entities.voor-herkoppelen.<datum>.json

const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/voorraad-herkoppelen.js <campagne> [--schrijf]');
  process.exit(1);
}

const dir  = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const pad  = path.join(dir, 'campaigns', campagne, 'entities.json');
if (!fs.existsSync(pad)) {
  console.error('Niet gevonden: ' + pad);
  process.exit(1);
}

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const ent = JSON.parse(fs.readFileSync(pad, 'utf8'));
const kaartjes = ent.voorwerpen || [];
const idBestaat = new Set(kaartjes.map(v => v.id));

// Op naam kan er meer dan één kaartje zijn; dan koppelen we niet blind.
const opNaam = new Map();
for (const v of kaartjes) {
  const k = norm(v.name);
  if (!opNaam.has(k)) opNaam.set(k, []);
  opNaam.get(k).push(v);
}

let regels = 0, dood = 0, hersteld = 0;
const dubbel = [], zonderKaartje = [];

for (const soort of ['locaties', 'personages']) {
  for (const e of (ent[soort] || [])) {
    let v;
    try { v = JSON.parse(e.data?.voorraad || '[]'); } catch { continue; }
    if (!Array.isArray(v) || !v.length) continue;

    let veranderd = false;
    for (const r of v) {
      regels++;
      if (!r.entityId || idBestaat.has(r.entityId)) continue;
      dood++;

      const treffers = opNaam.get(norm(r.naam)) || [];
      if (treffers.length === 1) {
        console.log(`  ${e.name} → ${r.naam}: ${r.entityId} wordt ${treffers[0].id}`);
        r.entityId = treffers[0].id;
        hersteld++; veranderd = true;
      } else if (treffers.length > 1) {
        dubbel.push(`${e.name} → ${r.naam} (${treffers.length} kaartjes met die naam)`);
      } else {
        zonderKaartje.push(`${e.name} → ${r.naam}`);
      }
    }
    if (veranderd) e.data.voorraad = JSON.stringify(v);
  }
}

console.log('');
console.log(`voorraadregels: ${regels} · id wijst nergens heen: ${dood} · te herstellen: ${hersteld}`);
if (dubbel.length) {
  console.log('\nNiet aangeraakt — meerdere kaartjes met dezelfde naam, kies zelf:');
  for (const d of dubbel) console.log('  ' + d);
}
if (zonderKaartje.length) {
  console.log('\nNiet aangeraakt — geen kaartje met die naam:');
  for (const z of zonderKaartje) console.log('  ' + z);
}

if (!schrijf) {
  console.log('\n(proefdraai — voeg --schrijf toe om het echt te doen)');
  process.exit(0);
}
if (!hersteld) {
  console.log('\nNiets te doen.');
  process.exit(0);
}

const datum  = new Date().toISOString().slice(0, 10);
const kopie  = pad.replace(/\.json$/, `.voor-herkoppelen.${datum}.json`);
fs.copyFileSync(pad, kopie);
fs.writeFileSync(pad, JSON.stringify(ent, null, 2));
console.log(`\nGeschreven. Kopie: ${path.basename(kopie)}`);
