#!/usr/bin/env node
// Waar leeft welk beest? — voor Wild Shape.
//
// De SRD 5.2 geeft de statblokken van de beesten maar niet waar ze voorkomen.
// Die indeling (Arctic, Coastal, Desert, Forest, Grassland, Hill, Mountain,
// Swamp, Underdark, Underwater, Urban) staat in de Monster Manual, en de
// 5etools-spiegel draagt hem per wezen als `environment`. Het is een lijstje
// labels bij een naam — geen tekst uit een boek — dus dezelfde soort gegeven
// als de namen en levels die we elders overnemen.
//
// Nieuwste druk wint: eerst het PHB 2024-aanhangsel, dan de Monster Manual van
// 2025, dan die van 2014. Alleen de beesten uit `bronnen/srd-monsters.json`;
// wat daar niet in staat kan een druid niet kiezen.
//
// Gebruik:
//   mkdir -p /tmp/5et && cd /tmp/5et
//   for f in bestiary-xphb bestiary-xmm bestiary-mm; do
//     curl -sSfLO https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/$f.json
//   done
//   node scripts/srd-2024/beest-omgevingen.js            # laat zien wat er zou komen
//   node scripts/srd-2024/beest-omgevingen.js --schrijf  # schrijft bronnen/beest-omgevingen.json
'use strict';
const fs = require('fs');
const path = require('path');

const MAP = '/tmp/5et';
const DOEL = path.join(__dirname, '..', '..', 'bronnen', 'beest-omgevingen.json');
const OMGEVINGEN = ['arctic', 'coastal', 'desert', 'forest', 'grassland', 'hill',
  'mountain', 'swamp', 'underdark', 'underwater', 'urban'];

const lees = (f) => {
  const p = path.join(MAP, f + '.json');
  if (!fs.existsSync(p)) { console.error(`Ontbreekt: ${p} — zie de kop van dit script.`); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, 'utf8')).monster || [];
};
const bronnen = ['bestiary-xphb', 'bestiary-xmm', 'bestiary-mm'].map(lees);
const srd = require('../../bronnen/srd-monsters.json').filter(m => /beast/i.test(m.statblock?.type || ''));

const uit = {};
const zonder = [];
for (const m of srd) {
  let env = null;
  for (const lijst of bronnen) {
    const x = lijst.find(y => y.name.toLowerCase() === m.name.toLowerCase());
    if (x?.environment?.length) { env = x.environment; break; }
  }
  const schoon = (env || []).map(e => String(e).toLowerCase()).filter(e => OMGEVINGEN.includes(e));
  if (schoon.length) uit[m.name] = [...new Set(schoon)];
  else zonder.push(m.name);
}

console.log(`${Object.keys(uit).length} beesten met een omgeving, ${zonder.length} zonder: ${zonder.join(', ') || '—'}`);
if (process.argv.includes('--schrijf')) {
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1) + '\n');
  console.log('Geschreven:', path.relative(process.cwd(), DOEL));
}
