/**
 * import-srd-descriptions.js
 *
 * Haalt classes.md en character-origins.md op uit de dnd-5e-srd-markdown repo
 * en parseert ze naar feature-descriptions.json.
 *
 * Gebruik: node scripts/import-srd-descriptions.js
 *
 * Output: bronnen/feature-descriptions.json
 * Structuur: { "Feature Name": "description text", ... }
 *
 * Beschrijvingen zijn in het Engels (2024 PHB SRD).
 * DM-beschrijvingen in class-progression.json hebben altijd prioriteit.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BASE_URL = 'https://raw.githubusercontent.com/downfallx/dnd-5e-srd-markdown/master/';
const OUT_FILE = path.join(__dirname, '..', 'bronnen', 'feature-descriptions.json');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Classes.md parsen ──────────────────────────────────────────────
// Patroon: ## ClassName → #### Level N: Feature Name → beschrijving
// Slaat op als "ClassName|FeatureName" (en ook als "FeatureName" als het uniek is).
function parseClassFeatures(md) {
  const features  = {};    // "FeatureName" → desc (alleen als uniek)
  const byClass   = {};    // "ClassName|FeatureName" → desc
  const nameCount = {};    // telt hoe vaak een feature-naam voorkomt

  const lines = md.split('\n');
  let currentClass = null;
  let currentFeat  = null;
  let buf = [];

  const flush = () => {
    if (currentFeat && buf.length) {
      const desc = buf.join('\n').trim();
      const key  = currentClass ? `${currentClass}|${currentFeat}` : currentFeat;
      byClass[key] = byClass[key] || desc;
      nameCount[currentFeat] = (nameCount[currentFeat] || 0) + 1;
    }
    currentFeat = null; buf = [];
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h4f = line.match(/^####\s+Level\s+\d+:\s+(.+)$/);
    if (h2 && !line.startsWith('###')) {
      flush();
      currentClass = h2[1].trim();
    } else if (h4f) {
      flush();
      currentFeat = h4f[1].trim();
    } else if (line.startsWith('####') || line.startsWith('###')) {
      flush();
    } else if (currentFeat) {
      buf.push(line);
    }
  }
  flush();

  // Voeg unieke features toe zonder klasse-prefix; duplicaten alleen met prefix
  for (const [key, desc] of Object.entries(byClass)) {
    const featName = key.includes('|') ? key.split('|')[1] : key;
    if (nameCount[featName] === 1) {
      features[featName] = desc; // uniek → ook zonder prefix
    }
    features[key] = desc; // altijd met prefix opslaan
  }

  return features;
}

// ── Character-origins.md parsen ───────────────────────────────────
// Species-traits staan als italic bullets: _Trait Name._ Description
// Plus traits in de species-sectie als losse regels.
function parseSpeciesTraits(md) {
  const traits = {};
  // Format per regel: _Trait Name._ Description tekst
  for (const line of md.split('\n')) {
    const m = line.match(/^_([^_]+)\._\s+(.+)$/);
    if (!m) continue;
    const name = m[1].trim();
    const desc = m[2].trim();
    if (name && desc && name.length < 60) {
      traits[name] = traits[name] || desc;
    }
  }
  return traits;
}

// ── Tekst opschonen ────────────────────────────────────────────────
// Verwijder lege regels aan begin/eind, HTML-tables, en maak leesbaarder.
function cleanDesc(text) {
  if (!text) return '';
  return text
    .replace(/<table[\s\S]*?<\/table>/gi, '') // tabellen weghalen
    .replace(/\n{3,}/g, '\n\n')               // dubbele witregels samenvoegen
    .trim();
}

// ── Feats.md parsen ───────────────────────────────────────────────
// Patroon: #### Feat Name → beschrijving
function parseFeatDescriptions(md) {
  const feats = {};
  const lines = md.split('\n');
  let current = null;
  let buf = [];
  for (const line of lines) {
    const m = line.match(/^####\s+(.+)$/);
    if (m) {
      if (current && buf.length) feats[current] = feats[current] || buf.join('\n').trim();
      current = m[1].trim(); buf = [];
    } else if (line.startsWith('###') || line.startsWith('##')) {
      if (current && buf.length) feats[current] = feats[current] || buf.join('\n').trim();
      current = null; buf = [];
    } else if (current) {
      buf.push(line);
    }
  }
  if (current && buf.length) feats[current] = feats[current] || buf.join('\n').trim();
  return feats;
}

async function main() {
  console.log('Ophalen classes.md…');
  const classesMd  = await fetch(BASE_URL + 'classes.md');
  console.log('Ophalen character-origins.md…');
  const originsMd  = await fetch(BASE_URL + 'character-origins.md');
  console.log('Ophalen feats.md…');
  const featsMd    = await fetch(BASE_URL + 'feats.md');

  console.log('Parsen class features…');
  const classFeats = parseClassFeatures(classesMd);
  console.log(`  → ${Object.keys(classFeats).length} features gevonden`);

  console.log('Parsen species traits…');
  const speciesTraits = parseSpeciesTraits(originsMd);
  console.log(`  → ${Object.keys(speciesTraits).length} traits gevonden`);

  console.log('Parsen feats…');
  const featDescs = parseFeatDescriptions(featsMd);
  console.log(`  → ${Object.keys(featDescs).length} feats gevonden`);

  // Samenvoegen — feats hebben prefix "feat|" zodat ze niet botsen met class features
  const all = {};
  for (const [k, v] of Object.entries(classFeats))   all[k] = cleanDesc(v);
  for (const [k, v] of Object.entries(speciesTraits)) {
    if (!all[k]) all[k] = cleanDesc(v);
  }
  for (const [k, v] of Object.entries(featDescs)) {
    all[`feat|${k}`] = cleanDesc(v);
    if (!all[k]) all[k] = cleanDesc(v); // ook zonder prefix als er geen conflict is
  }

  const out = JSON.stringify(all, null, 2);
  fs.writeFileSync(OUT_FILE, out, 'utf8');
  console.log(`\nOpgeslagen: ${OUT_FILE}`);
  console.log(`Totaal: ${Object.keys(all).length} beschrijvingen`);

  // Preview
  const keys = Object.keys(all).slice(0, 8);
  console.log('\nVoorbeeld features:', keys.join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });
