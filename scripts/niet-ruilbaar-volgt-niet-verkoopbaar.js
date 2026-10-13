#!/usr/bin/env node
// Eenmalig: wat een winkel niet mag hebben, gaat ook niet onderling van hand
// tot hand. Het vinkje "Niet te ruilen met andere spelers" is nieuw, en bij de
// voorwerpen die al "Niet te verkopen aan winkels" dragen hoort hij meteen aan
// te staan — anders moet je ze allemaal nog een keer langs.
//
//   node scripts/niet-ruilbaar-volgt-niet-verkoopbaar.js [--echt]
//
// Zonder --echt vertelt hij alleen wat hij zou doen.
const fs   = require('fs');
const path = require('path');

const echt = process.argv.includes('--echt');
const basis = path.join(__dirname, '..', 'data', 'campaigns');
if (!fs.existsSync(basis)) { console.error('Geen data/campaigns gevonden'); process.exit(1); }

let totaal = 0;
for (const campagne of fs.readdirSync(basis)) {
  const bestand = path.join(basis, campagne, 'entities.json');
  if (!fs.existsSync(bestand)) continue;
  const data = JSON.parse(fs.readFileSync(bestand, 'utf8'));
  const geraakt = [];
  for (const vw of (data.voorwerpen || [])) {
    const d = vw.data || {};
    const nietVerkoopbaar = d.nietVerkoopbaar === true || d.nietVerkoopbaar === 'true';
    const alRuilvast      = d.nietRuilbaar === true || d.nietRuilbaar === 'true';
    if (!nietVerkoopbaar || alRuilvast) continue;
    d.nietRuilbaar = 'true';
    vw.data = d;
    geraakt.push(vw.name);
  }
  if (!geraakt.length) { console.log(`${campagne}: niets om om te zetten`); continue; }
  totaal += geraakt.length;
  console.log(`${campagne}: ${geraakt.length} voorwerp${geraakt.length === 1 ? '' : 'en'}`);
  for (const n of geraakt) console.log(`   · ${n}`);
  if (echt) {
    fs.copyFileSync(bestand, bestand.replace(/\.json$/, `.voor-ruilvast.${new Date().toISOString().slice(0, 10)}.json`));
    fs.writeFileSync(bestand, JSON.stringify(data, null, 2));
  }
}
console.log(echt ? `\nKlaar. ${totaal} omgezet.` : `\nProef. ${totaal} zouden omgezet worden — draai met --echt om het te doen.`);
