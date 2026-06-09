// Merge SRD 5.2 (2024) feature-beschrijvingen in een progressie-bestand.
// Gebruik: node merge-srd.js <progressie.json> [--write]
const fs = require('fs');

const srd    = require('/tmp/features-2024.json');
const traits = require('/tmp/traits-2024.json');
const NL = /\b(je|jouw|jezelf|een|naar keuze|wapens?|voet|wezen|schade|gebruik|krijg|geef|voordeel|beurt|snelheid|harnas|klauwen|spreuk|gratis|verdubbel|keer per|eens per|zolang|tijdens|elke|gooi|herrol|vliegsnelheid|klimsnelheid|aanval|bondgenoten|duisternis|schemer|reactie|worp)\b/i;

const normName  = s => String(s||'').toLowerCase().replace(/\(.*?\)/g,'').replace(/[^a-z0-9]/g,'');
const normClass = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const normSub   = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

// Index SRD op naam → kandidaten
const byName = new Map();
for (const f of srd) {
  const k = normName(f.name);
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push({
    cls: normClass(f.class?.name),
    sub: f.subclass ? normSub(f.subclass.name) : null,
    desc: f.description,
  });
}

// Supplement (niet-SRD subklassen uit 5etools) → key normClass|normSub|normName
let supplement = {};
try { supplement = require('/tmp/supplement-2024.json'); } catch {}
const normSubLabel = s => normSub(String(s||'').replace(/\(.*?\)/g, ''));
const supIdx = new Map();
for (const [k, v] of Object.entries(supplement)) {
  const [cls, sub, name] = k.split('|');
  supIdx.set(`${normClass(cls)}|${normSubLabel(sub)}|${normName(name)}`, v);
}
function findSupplement(name, className, subName) {
  if (!subName) return null;
  return supIdx.get(`${normClass(className)}|${normSubLabel(subName)}|${normName(name)}`) || null;
}
const supSpeciesIdx = new Map();
for (const [k, v] of Object.entries(supplement)) {
  if (!k.startsWith('SPECIES|')) continue;
  const [, sp, name] = k.split('|');
  supSpeciesIdx.set(`${normClass(sp)}|${normName(name)}`, v);
}
function findSpeciesSupplement(name, speciesName) {
  return supSpeciesIdx.get(`${normClass(speciesName)}|${normName(name)}`) || null;
}

// Index species-traits op naam → kandidaten
const traitByName = new Map();
for (const t of traits) {
  const k = normName(t.name);
  if (!traitByName.has(k)) traitByName.set(k, []);
  traitByName.get(k).push({
    species: (t.species || []).map(s => normClass(s.name)),
    desc: t.description,
  });
}

function findTraitDesc(name, speciesName) {
  const cand = traitByName.get(normName(name));
  if (!cand || !cand.length) return null;
  const s = normClass(speciesName);
  const m = cand.find(x => x.species.includes(s));
  if (m) return m.desc;
  if (cand.length === 1) return cand[0].desc;
  return null;
}

function findDesc(name, className, subName) {
  const cand = byName.get(normName(name));
  if (!cand || !cand.length) return null;
  const c = normClass(className), s = subName ? normSub(subName) : null;
  // 1: exact klasse + subklasse
  if (s) { const m = cand.find(x => x.cls === c && x.sub === s); if (m) return m.desc; }
  // 2: klasse + base-feature (geen subklasse)
  let m = cand.find(x => x.cls === c && !x.sub); if (m) return m.desc;
  // 3: zelfde klasse, ongeacht subklasse
  m = cand.find(x => x.cls === c); if (m) return m.desc;
  // 4: uniek over alle klassen
  if (cand.length === 1) return cand[0].desc;
  return null;
}

// Generieke Engelse placeholders voor structurele (niet-SRD) rijen.
const PLACEHOLDERS = {
  'Divine Smite': 'You always have the Divine Smite spell prepared. When you hit a creature with a melee weapon, you can expend a spell slot to deal extra Radiant damage to the target.',
  'Oath-capstone': 'The ultimate manifestation of your Sacred Oath.',
  'Subclass feature': 'A feature granted by your Ranger subclass.',
  'Lineage-spreuk (1e)': 'A spell granted by your Elven Lineage at this level.',
  'Lineage-spreuk (2e)': 'A second spell granted by your Elven Lineage at this level.',
  'Legacy-spreuk (1e)': 'A spell granted by your Fiendish Legacy at this level.',
  'Legacy-spreuk (2e)': 'A second spell granted by your Fiendish Legacy at this level.',
  'Circle of the Land Spells': 'Whenever you finish a Long Rest, choose one type of land: arid, polar, temperate, or tropical. You have the spells listed for that land of your Druid level and lower prepared.',
};

const file = process.argv[2];
const write = process.argv.includes('--write');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

let replaced = 0, dutchLeft = [];
function handle(feat, className, subName, lvl, scope) {
  if (!feat.name) return;
  const isDutch = feat.desc && NL.test(feat.desc);
  const srdDesc = findDesc(feat.name, className, subName) || findSupplement(feat.name, className, subName) || PLACEHOLDERS[feat.name];
  if (srdDesc) {
    if (feat.desc !== srdDesc) { feat.desc = srdDesc; replaced++; }
  } else if (isDutch) {
    dutchLeft.push(`${scope} L${lvl}: ${feat.name}`);
  }
}

for (const [cn, cd] of Object.entries(data.classes || {})) {
  for (const [lvl, arr] of Object.entries(cd.levels || {}))
    for (const f of arr) handle(f, cn, null, lvl, cn);
  for (const [sn, sd] of Object.entries(cd.subclasses || {}))
    for (const [lvl, arr] of Object.entries(sd.levels || {}))
      for (const f of arr) handle(f, cn, sn, lvl, `${cn}/${sn}`);
}
// species: match via Traits-dataset
for (const [sp, spd] of Object.entries(data.species || {}))
  for (const [lvl, arr] of Object.entries(spd.levels || {}))
    for (const f of arr) {
      if (!f.name) continue;
      const isDutch = f.desc && NL.test(f.desc);
      const td = findTraitDesc(f.name, sp) || findSpeciesSupplement(f.name, sp) || PLACEHOLDERS[f.name];
      if (td) { if (f.desc !== td) { f.desc = td; replaced++; } }
      else if (isDutch) dutchLeft.push(`species/${sp} L${lvl}: ${f.name}`);
    }

console.log(`\n=== ${file} ===`);
console.log(`Beschrijvingen vervangen door SRD-tekst: ${replaced}`);
console.log(`Nederlands zonder SRD-match: ${dutchLeft.length}`);
dutchLeft.forEach(d => console.log('  · ' + d));

if (write) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n✓ Weggeschreven naar ${file}`);
}
