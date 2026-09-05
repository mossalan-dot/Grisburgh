#!/usr/bin/env node
/**
 * Haalt kant-waarden (bondgenoot/neutraal/vijand) uit `data.tags`.
 *
 * De kant-vinkjes staan in dezelfde rij als de rollen, en _rollenBij pakte
 * alles wat in die rij aanstond. Daardoor kon "vijand" als rol in de tags
 * belanden — met een Vijand-badge op het kaartje als gevolg. De handler is
 * gerepareerd; dit ruimt op wat er al ingeslopen was.
 *
 *   node scripts/schoon-rollen.js <campagne> [--schrijf]
 */
const fs = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/schoon-rollen.js <campagne> [--schrijf]'); process.exit(1); }

const bestand = path.join(__dirname, '..', 'data', 'campaigns', campagne, 'entities.json');
if (!fs.existsSync(bestand)) { console.error('Niet gevonden: ' + bestand); process.exit(1); }

const KANTEN = ['bondgenoot', 'neutraal', 'vijand'];
const data = JSON.parse(fs.readFileSync(bestand, 'utf8'));
let aantal = 0;

for (const type of Object.keys(data)) {
  for (const e of (data[type] || [])) {
    let tags; try { tags = JSON.parse(e.data?.tags || '[]'); } catch { continue; }
    if (!Array.isArray(tags)) continue;
    const schoon = tags.filter(t => !KANTEN.includes(t));
    if (schoon.length === tags.length) continue;
    // De kant die eruit komt is wél echt gekozen: bewaar hem waar hij hoort.
    const kant = tags.find(t => KANTEN.includes(t));
    if (kant && !e.data.kant) e.data.kant = kant;
    e.data.tags = JSON.stringify(schoon);
    console.log(`✓ ${e.name}: ${JSON.stringify(tags)} → ${JSON.stringify(schoon)}${kant ? ` (kant: ${kant})` : ''}`);
    aantal++;
  }
}

console.log(aantal ? `\n${aantal} kaartje(s)` : 'Niets te doen.');
if (!schrijf) { console.log('(proefdraai — draai met --schrijf)'); process.exit(0); }
if (aantal) {
  fs.copyFileSync(bestand, bestand.replace(/\.json$/, `.bak.${Date.now()}.json`));
  fs.writeFileSync(bestand, JSON.stringify(data, null, 2));
  console.log('Opgeslagen.');
}
