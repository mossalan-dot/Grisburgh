#!/usr/bin/env node
/**
 * import-spells-2024.js
 * Parses the ~/Downloads/Spells/ markdown collection (2024 PHB format)
 * and writes public/data/spells-2024.json
 *
 * Usage: node scripts/import-spells-2024.js [path/to/Spells]
 */

const fs   = require('fs');
const path = require('path');

const SPELLS_DIR = process.argv[2]
  || path.join(process.env.HOME, 'Downloads', 'Spells');
const OUT_FILE   = path.join(__dirname, '..', 'public', 'data', 'spells-2024.json');

const SCHOOLS = [
  'Abjuration','Conjuration','Divination','Enchantment',
  'Evocation','Illusion','Necromancy','Transmutation','Dunamancy',
];
const DAMAGE_TYPES = [
  'fire','cold','lightning','thunder','acid','force',
  'radiant','necrotic','psychic','poison','piercing','slashing','bludgeoning',
  'healing','heal',
];

// Slugify: "Find Familiar" → "find-familiar", "Rary's Telepathic Bond" → "rarys-telepathic-bond"
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '')          // strip apostrophes
    .replace(/[^a-z0-9]+/g, '-')    // non-alnum → hyphen
    .replace(/^-+|-+$/g, '');       // trim hyphens
}

// Strip markdown links: [text](url) → text
function stripLinks(text) {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

// Extract damage type from description paragraphs
function extractDamage(desc) {
  const full = desc.join(' ').toLowerCase();
  for (const dt of DAMAGE_TYPES) {
    const re = new RegExp(`\\b(\\d+d\\d+(?:\\s*[+\\-]\\s*\\d+)?)\\s+${dt}\\b`);
    const m = full.match(re);
    if (m) return `${m[1]} ${dt}`;
  }
  return null;
}

function parseSpellFile(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  const lines = raw.split('\n');

  // ── Name ── (supports both "# [Name](url)" and "# Name"; skip leading blank lines)
  const nameLine = lines.find(l => /^#\s+\S/.test(l)) || '';
  const nameMatch = nameLine.match(/^#\s+\[([^\]]+)\]/) || nameLine.match(/^#\s+(.+)/);
  if (!nameMatch) return null;
  const name = nameMatch[1].trim();

  // ── Tags line (level, school, classes) ──
  const tagsLine = lines.find(l => l.trim().startsWith('#') && (l.includes('#Level') || l.includes('#Cantrip'))) || '';

  let level = 0;
  const levelMatch = tagsLine.match(/#Level(\d+)/i);
  if (levelMatch) level = parseInt(levelMatch[1]);
  // Cantrip stays 0

  let school = '';
  for (const s of SCHOOLS) {
    if (tagsLine.includes(`#${s}`)) { school = s; break; }
  }

  const classesMatch = tagsLine.match(/\(([^)]+)\)/);
  const classes = classesMatch
    ? classesMatch[1].split(',').map(c => ({ name: c.trim().replace(/^#/, '') })).filter(c => c.name)
    : [];

  // ── Meta fields ──
  const getMeta = (key) => {
    const line = lines.find(l => l.startsWith(`**${key}:**`));
    if (!line) return '';
    return stripLinks(line.replace(`**${key}:**`, '').trim());
  };

  const castingTime = getMeta('Casting Time');
  const range       = getMeta('Range');
  const compRaw     = getMeta('Components');
  const duration    = getMeta('Duration');

  // Parse components
  const components = [];
  if (/\bV\b/.test(compRaw)) components.push('V');
  if (/\bS\b/.test(compRaw)) components.push('S');
  if (/\bM\b/.test(compRaw)) components.push('M');
  const materialMatch = compRaw.match(/\(([^)]+)\)/);
  const material = materialMatch ? materialMatch[1].trim() : '';

  // Detect concentration & ritual
  const concentration = /concentration/i.test(duration);
  const ritual = /ritual/i.test(castingTime);

  // Clean duration text
  const durationClean = duration.replace(/^Concentration,\s*/i, 'Concentration, ');

  // ── Description ──
  // Find where meta ends (last ** field line), then collect body
  let metaEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\*\*\w[^*]+:\*\*/.test(lines[i])) metaEnd = i;
  }

  const bodyLines = lines.slice(metaEnd + 1).join('\n').trim();

  // Split on higher-level / cantrip upgrade marker
  const higherRe = /\*\*_(?:Using a Higher-Level Spell Slot|Cantrip Upgrade)\._\*\*/i;
  const [mainBody, higherBody] = bodyLines.split(higherRe);

  // Convert body into paragraph array, strip links
  const desc = (mainBody || '')
    .split(/\n{2,}/)
    .map(p => stripLinks(p.trim()))
    .filter(Boolean);

  const higher_level = higherBody
    ? [stripLinks(higherBody.trim())]
    : [];

  // ── Damage type extraction ──
  const damage = extractDamage(desc);

  return {
    index: slugify(name),
    name,
    level,
    school: { name: school },
    classes,
    casting_time: castingTime,
    range,
    components,
    material,
    ritual,
    duration: durationClean,
    concentration,
    desc,
    higher_level,
    damage,
    source: 'phb2024',
  };
}

// #48: valideer een geparste spell vóór export. Retourneert een lijst problemen
// (leeg = geldig). Zo belandt een mismaakt PHB-bestand in de error-log i.p.v.
// stil in spells-2024.json (wat de spellbook voor iedereen kan breken).
const KNOWN_CLASSES = ['Bard','Cleric','Druid','Paladin','Ranger','Sorcerer','Warlock','Wizard','Artificer'];
function validateSpell(s) {
  const problems = [];
  if (!s.name || typeof s.name !== 'string') problems.push('lege naam');
  if (!Number.isInteger(s.level) || s.level < 0 || s.level > 9)
    problems.push(`ongeldig level "${s.level}" (verwacht 0-9)`);
  if (!s.school?.name || !SCHOOLS.includes(s.school.name))
    problems.push(`onbekende school "${s.school?.name || ''}"`);
  for (const c of (s.classes || []))
    if (!KNOWN_CLASSES.includes(c.name))
      problems.push(`onbekende klasse "${c.name}"`);
  return problems;
}

// ── Main ──
console.log(`Reading spells from: ${SPELLS_DIR}`);

const spells = [];
const errors = [];

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full);
    } else if (entry.name.endsWith('.md')) {
      try {
        const spell = parseSpellFile(full);
        if (!spell) { errors.push(`Skipped (no name): ${full}`); continue; }
        const problems = validateSpell(spell);
        if (problems.length) {
          errors.push(`Ongeldig (${path.basename(full)}): ${problems.join('; ')}`);
          continue;   // niet exporteren — fail loud
        }
        spells.push(spell);
      } catch (e) {
        errors.push(`Error parsing ${full}: ${e.message}`);
      }
    }
  }
}

walkDir(SPELLS_DIR);

// Sort by level then name
spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

// Deduplicate by index (keep first occurrence)
const seen = new Set();
const deduped = spells.filter(s => {
  if (seen.has(s.index)) return false;
  seen.add(s.index);
  return true;
});

const output = { count: deduped.length, results: deduped };

// Ensure output directory exists
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

console.log(`✓ Imported ${deduped.length} spells → ${OUT_FILE}`);
if (errors.length) {
  console.log(`⚠ ${errors.length} errors:`);
  errors.forEach(e => console.log('  ', e));
  process.exitCode = 1;   // #48: signaleer falen zodat het niet onopgemerkt blijft
}

// Quick stats
const byLevel = {};
for (const s of deduped) {
  const k = s.level === 0 ? 'Cantrip' : `Level ${s.level}`;
  byLevel[k] = (byLevel[k] || 0) + 1;
}
console.log('Breakdown:', byLevel);
