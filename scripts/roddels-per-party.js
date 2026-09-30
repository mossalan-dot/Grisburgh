#!/usr/bin/env node
// Roddels stonden als "al verteld" op het kaartje zelf: campagnebreed. Hoorde
// party 1 er een in de herberg, dan zag party 2 hem meteen op dat kaartje staan
// zonder hem ooit gehoord te hebben — en kreeg hem daarna ook nooit meer te
// horen, want hij was uit de pot. Geheimen doen het al goed: per party, in
// `groups[gid].secretReveals`. Dit zet roddels op dezelfde voet.
//
// Wat dit script doet:
//   1. elke roddel krijgt een **id**, zoals een geheim er een heeft (anders
//      verschuift de stand zodra je een regel versleept of ertussenuit haalt);
//   2. de bestaande campagnebrede stand wordt naar **elke** party gekopieerd,
//      zodat niemand kwijtraakt wat hij al gehoord had;
//   3. het oude veld op het kaartje blijft staan als terugval.
//
//   node scripts/roddels-per-party.js <campagne> [--schrijf]
const fs   = require('fs');
const path = require('path');

const args     = process.argv.slice(2);
const campagne = args.find(a => !a.startsWith('--'));
const schrijf  = args.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/roddels-per-party.js <campagne> [--schrijf]'); process.exit(1); }

const dir = path.join(__dirname, '..', 'data', 'campaigns', campagne);
const entPad = path.join(dir, 'entities.json');
const dmPad  = path.join(dir, 'dm-state.json');
for (const p of [entPad, dmPad]) if (!fs.existsSync(p)) { console.error('Niet gevonden: ' + p); process.exit(1); }

const ents = JSON.parse(fs.readFileSync(entPad, 'utf8'));
const dm   = JSON.parse(fs.readFileSync(dmPad, 'utf8'));

const lees = (data) => {
  let arr = [];
  const rauw = data?.flavours;
  if (Array.isArray(rauw)) arr = rauw;
  else if (typeof rauw === 'string' && rauw.trim()) {
    try { const j = JSON.parse(rauw); if (Array.isArray(j)) arr = j; } catch { arr = [rauw]; }
  }
  if (!arr.length && data?.flavour) arr = [data.flavour];
  return arr;
};

const groepen = Object.keys(dm.groups || {});
if (!groepen.length) { console.error('Deze campagne heeft geen partys.'); process.exit(1); }

let metId = 0, regelsTotaal = 0, standen = 0;
for (const type of ['personages', 'locaties']) {
  for (const e of (ents[type] || [])) {
    const rauw = lees(e.data);
    if (!rauw.length) continue;

    // 1) ids erop
    const regels = rauw.map((r, i) => {
      if (r && typeof r === 'object') return { id: r.id || `f${i}_${Math.random().toString(36).slice(2, 6)}`, tekst: String(r.tekst ?? '') };
      return { id: `f${i}_${Math.random().toString(36).slice(2, 6)}`, tekst: String(r || '') };
    });
    regelsTotaal += regels.length;
    if (!rauw.every(r => r && typeof r === 'object' && r.id)) metId++;
    e.data.flavours = JSON.stringify(regels);

    // 2) de oude stand naar elke party
    const oud = e.data.flavoursUitgesproken;
    const alles = e.data.flavourUitgesproken === true || e.data.flavourUitgesproken === 'true';
    let gehoord = [];
    if (Array.isArray(oud)) gehoord = regels.filter((_, i) => oud[i]).map(r => r.id);
    else if (alles) gehoord = regels.map(r => r.id);
    if (!gehoord.length) continue;

    for (const gid of groepen) {
      const g = dm.groups[gid];
      if (!g.flavourReveals) g.flavourReveals = {};
      if (g.flavourReveals[e.id] === undefined) { g.flavourReveals[e.id] = gehoord; standen++; }
    }
  }
}

console.log(`${regelsTotaal} roddelregels, ${metId} kaartjes kregen ids, ${standen} standen gekopieerd naar ${groepen.length} party(s).`);
if (!schrijf) { console.log('(proefdraai — voeg --schrijf toe om het door te voeren)'); process.exit(0); }
for (const [p, data] of [[entPad, ents], [dmPad, dm]]) {
  const bak = p + '.voor-roddels.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(p, bak);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}
console.log('Geschreven, met backups ernaast (*.voor-roddels.bak).');
