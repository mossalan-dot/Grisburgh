#!/usr/bin/env node
// Poetst de Blessing-voorwerpen op (idempotent):
//   - alle Blessings: niet-verkoopbaar + gebruik 'gedeeld' (meerdere spelers, elk 1 exemplaar)
//   - zegen → rarity Uncommon
//   - eed   → rarity Rare   + requires attunement
//   - vloek → rarity Rare   + requires attunement
// Gebruik: node scripts/update-blessings.js <pad-naar-entities.json>
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Geef het pad naar entities.json op.'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const items = (data.voorwerpen || []).filter(x => x.data && x.data.itemType === 'Blessing');

let changed = 0;
for (const x of items) {
  const d = x.data;
  d.nietVerkoopbaar = true;
  d.gebruik = 'gedeeld';
  if (d.goddelijkType === 'zegen') {
    d.rariteit = 'Uncommon';
  } else if (d.goddelijkType === 'eed') {
    d.rariteit = 'Rare';
    d.attunement = true;
  } else if (d.goddelijkType === 'vloek') {
    d.rariteit = 'Rare';
    d.attunement = true;
  }
  changed++;
}

fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Verificatie-overzicht
const summary = {};
for (const x of items) {
  const t = x.data.goddelijkType || '(geen)';
  summary[t] = summary[t] || { n: 0, rar: {}, att: 0, niet: 0, gedeeld: 0 };
  summary[t].n++;
  summary[t].rar[x.data.rariteit || '-'] = (summary[t].rar[x.data.rariteit || '-'] || 0) + 1;
  if (x.data.attunement === true) summary[t].att++;
  if (x.data.nietVerkoopbaar === true) summary[t].niet++;
  if (x.data.gebruik === 'gedeeld') summary[t].gedeeld++;
}
console.log(`Bijgewerkt: ${changed} Blessing-voorwerpen.`);
console.log(JSON.stringify(summary, null, 1));
