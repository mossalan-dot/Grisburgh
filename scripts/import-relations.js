#!/usr/bin/env node
/**
 * import-relations.js
 *
 * Parst relaties-invullen.md en schrijft de edges naar relations.json.
 * Bestaande edges worden VERVANGEN (posities blijven behouden).
 *
 * Gebruik: node scripts/import-relations.js [pad-naar-md]
 * Standaard: ./relaties-invullen.md
 */

const fs      = require('fs');
const path    = require('path');
const storage = require('../lib/storage');

const mdPath = process.argv[2]
  || path.join(__dirname, '..', 'relaties-invullen.md');

if (!fs.existsSync(mdPath)) {
  console.error('✗ Bestand niet gevonden:', mdPath);
  process.exit(1);
}

const md = fs.readFileSync(mdPath, 'utf8');

// ── Bouw naamnaar-id index ──────────────────────────────────────────────────

const entities  = storage.readJSON('entities.json');

const nameToId   = {};  // name → { id, type }
const nameToIdLC = {};  // lowercase name → { id, type }

['personages', 'locaties', 'organisaties'].forEach(type => {
  (entities[type] || []).forEach(e => {
    nameToId[e.name]              = { id: e.id, type };
    nameToIdLC[e.name.toLowerCase()] = { id: e.id, type };
  });
});

// (archief en voorwerpen zijn uitgesloten van de relatiemap)

function lookup(name) {
  return nameToId[name.trim()] || nameToIdLC[name.trim().toLowerCase()] || null;
}

// ── Parseer MD ──────────────────────────────────────────────────────────────

const edges = [];
let   skipped = 0;
let   noLabel = 0;

const lines = md.split('\n');
for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#') || line.startsWith('<!--')) continue;
  if (!line.startsWith('- ')) continue;

  // Formaat: - Naam A → Naam B | label | verborgen label
  const content = line.slice(2).trim();  // strip "- "
  const arrowIdx = content.indexOf('→');
  if (arrowIdx === -1) continue;

  const nameA = content.slice(0, arrowIdx).trim();
  const rest   = content.slice(arrowIdx + '→'.length).trim();

  // Split on | (maximaal 2 pipes)
  const parts = rest.split('|').map(s => s.trim());
  const nameB       = parts[0] || '';
  const label       = parts[1] || '';
  const hiddenLabel = parts[2] || '';

  if (!nameA || !nameB) continue;

  const entA = lookup(nameA);
  const entB = lookup(nameB);

  if (!entA) { console.warn(`⚠  Niet gevonden: "${nameA}"`); skipped++; continue; }
  if (!entB) { console.warn(`⚠  Niet gevonden: "${nameB}"`); skipped++; continue; }

  if (!label && !hiddenLabel) noLabel++;

  edges.push({
    id:            `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${edges.length}`,
    from:          entA.id,
    fromType:      entA.type,
    to:            entB.id,
    toType:        entB.type,
    label:         label,
    hiddenLabel:   hiddenLabel,
    labelRevealed: false,
  });
}

// ── Sla op (behoud posities) ────────────────────────────────────────────────

const existing = storage.readJSON('relations.json');
const result   = {
  edges,
  positions: existing.positions || {},
};

storage.writeJSON('relations.json', result);

console.log(`✓ ${edges.length} verbindingen geïmporteerd`);
if (noLabel)  console.log(`  ${noLabel} zonder label (ongetypeerd)`);
if (skipped)  console.log(`  ${skipped} overgeslagen (naam niet herkend)`);
console.log('  Posities bewaard:', Object.keys(result.positions).length);
