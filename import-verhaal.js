#!/usr/bin/env node
/**
 * import-verhaal.js
 * Importeert Obsidian-hoofdstukken (Verhaal/) als DM-notities in het sessielogboek.
 *
 * Gebruik:
 *   node import-verhaal.js <pad-naar-Verhaal-map> [opties]
 *
 * Opties:
 *   --dry-run    Toon wat er geïmporteerd wordt zonder op te slaan
 *   --replace    Overschrijf bestaande geïmporteerde DM-notities (op basis van bronbestand)
 */

const fs   = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────

const DATA_DIR     = path.join(__dirname, 'data');
const ARCHIEF_FILE = path.join(DATA_DIR, 'archief.json');
const META_FILE    = path.join(DATA_DIR, 'meta.json');

// ── Args ────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const replace = args.includes('--replace');
const folder  = args.find(a => !a.startsWith('--'));

if (!folder) {
  console.error('Gebruik: node import-verhaal.js <pad-naar-Verhaal-map> [--dry-run] [--replace]');
  process.exit(1);
}

const absFolder = path.resolve(folder);
if (!fs.existsSync(absFolder)) {
  console.error(`Map niet gevonden: ${absFolder}`);
  process.exit(1);
}

// ── Markdown opschonen ───────────────────────────────────────────────────────

function cleanMarkdown(text) {
  return text
    .replace(/!\[\[([^\]]+)\]\]/g, '')            // verwijder ![[afbeeldingen]]
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2') // [[link|label]] → label
    .replace(/\[\[([^\]]+)\]\]/g, '$1')            // [[link]] → link
    .replace(/\n{3,}/g, '\n\n')                   // max 2 opeenvolgende regels leeg
    .trim();
}

// ── Bestandsnaam → hoofdstuk-key ─────────────────────────────────────────────

function parseFilename(basename) {
  // "Hoofdstuk 7 - Draken, stormen en vreemd bezoek" → { key: 'h7', num: 7, title: '…', isOneShot: false }
  const hMatch = basename.match(/^Hoofdstuk\s+(\d+)\s*-\s*(.+)$/i);
  if (hMatch) {
    const num = parseInt(hMatch[1], 10);
    return { key: `h${num}`, num, title: hMatch[2].trim(), isOneShot: false };
  }
  // "One-shot - Terreur voor het Tribunaal"
  const osMatch = basename.match(/^One-shot\s*-\s*(.+)$/i);
  if (osMatch) {
    return { key: null, num: null, title: osMatch[1].trim(), isOneShot: true };
  }
  return null;
}

// ── Hoofdstukkey opzoeken in meta ────────────────────────────────────────────

function findMetaKey(meta, parsed) {
  const hk = meta.hoofdstukken || {};
  // Probeer exacte key (h1, h2 …)
  if (parsed.key && hk[parsed.key]) return parsed.key;
  // Zoek op title
  for (const [k, v] of Object.entries(hk)) {
    if (v.title?.toLowerCase() === parsed.title.toLowerCase()) return k;
  }
  // One-shots: zoek op title
  if (parsed.isOneShot) {
    for (const [k, v] of Object.entries(hk)) {
      if (v.title?.toLowerCase() === parsed.title.toLowerCase()) return k;
    }
  }
  return null;
}

// ── Bestanden inlezen ────────────────────────────────────────────────────────

const files = fs.readdirSync(absFolder)
  .filter(f => f.endsWith('.md'))
  .sort();

const meta    = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
const archief = JSON.parse(fs.readFileSync(ARCHIEF_FILE, 'utf8'));
if (!archief.sessieLog) archief.sessieLog = [];

const results = [];

for (const file of files) {
  const basename = path.basename(file, '.md');
  const parsed   = parseFilename(basename);

  if (!parsed) {
    console.log(`⏭  Overgeslagen (geen hoofdstuk): ${file}`);
    continue;
  }

  const hkKey = findMetaKey(meta, parsed);
  const raw   = fs.readFileSync(path.join(absFolder, file), 'utf8');
  const clean = cleanMarkdown(raw);

  // Eerste paragraaf als korte samenvatting
  const firstPara = clean.split('\n\n').find(p => p.trim() && !p.trim().startsWith('#'));
  const kort = (firstPara || parsed.title).replace(/\n/g, ' ').slice(0, 120).trim();

  const sourceTag = `obsidian:verhaal:${basename}`;

  results.push({ file, basename, parsed, hkKey, clean, kort, sourceTag });
}

if (results.length === 0) {
  console.log('Geen hoofdstuk-bestanden gevonden.');
  process.exit(0);
}

// ── Dry run output ────────────────────────────────────────────────────────────

console.log(`\n📖 ${results.length} hoofdstuk(ken) gevonden:\n`);
for (const r of results) {
  const keyLabel = r.hkKey
    ? `${r.hkKey} (${meta.hoofdstukken?.[r.hkKey]?.short || r.hkKey})`
    : '⚠ geen match in meta.json';
  console.log(`  "${r.basename}"`);
  console.log(`    → hoofdstuk: ${keyLabel}`);
  console.log(`    → ${r.clean.length} tekens inhoud`);
  console.log();
}

if (dryRun) {
  console.log('-- DRY RUN: niets opgeslagen. Verwijder --dry-run om te importeren. --');
  process.exit(0);
}

// ── Importeren ────────────────────────────────────────────────────────────────

let added = 0, replaced = 0, skipped = 0;

for (const r of results) {
  // Controleer of er al een entry bestaat met dezelfde sourceTag
  const existingIdx = archief.sessieLog.findIndex(
    e => e._source === r.sourceTag
  );

  const entry = {
    id:                existingIdx !== -1
                         ? archief.sessieLog[existingIdx].id
                         : 'sl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    hoofdstuk:         r.hkKey || '',
    datum:             '',
    korteSamenvatting: `📜 DM-aantekeningen: ${r.parsed.title}`,
    samenvatting:      r.clean,
    visible:           false,   // alleen zichtbaar voor DM
    docs:              [],
    images:            [],
    nieuwPersonages:   [],
    terugkerendPersonages: [],
    nieuwLocaties:     [],
    terugkerendLocaties: [],
    voorwerpen:        [],
    organisaties:      [],
    _source:           r.sourceTag,  // interne markering voor re-import
  };

  if (existingIdx !== -1) {
    if (replace) {
      archief.sessieLog[existingIdx] = entry;
      replaced++;
      console.log(`  🔄 Bijgewerkt:  "${r.basename}"`);
    } else {
      skipped++;
      console.log(`  ⚠️  Overgeslagen (bestaat al): "${r.basename}" — gebruik --replace om bij te werken`);
    }
  } else {
    // Voeg toe na de laatste entry van hetzelfde hoofdstuk (of aan het einde)
    const lastInChapter = archief.sessieLog.reduce((last, e, i) =>
      e.hoofdstuk === entry.hoofdstuk ? i : last, -1);
    if (lastInChapter !== -1) {
      archief.sessieLog.splice(lastInChapter + 1, 0, entry);
    } else {
      archief.sessieLog.push(entry);
    }
    added++;
    console.log(`  ✅ Toegevoegd:  "${r.basename}" → ${r.hkKey || '(geen hoofdstuk)'}`);
  }
}

// ── Opslaan ───────────────────────────────────────────────────────────────────

const tmp = ARCHIEF_FILE + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(archief, null, 2));
fs.renameSync(tmp, ARCHIEF_FILE);

console.log(`\n✅ Klaar: ${added} toegevoegd, ${replaced} bijgewerkt, ${skipped} overgeslagen.`);
console.log('   DM-aantekeningen zijn verborgen voor spelers (visible: false).');
console.log('   Gebruik --replace bij een volgende import om bij te werken.');
