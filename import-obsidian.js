#!/usr/bin/env node
/**
 * import-obsidian.js
 * Importeert Obsidian Markdown-notities naar Grisburgh (data/entities.json).
 *
 * Gebruik:
 *   node import-obsidian.js <map-met-notities> [opties]
 *
 * Opties:
 *   --dry-run      Laat zien wat er geïmporteerd wordt zonder op te slaan
 *   --replace      Overschrijf bestaande entiteiten met dezelfde naam
 *   --visible      Zet nieuwe entiteiten direct op 'visible' (standaard: hidden)
 *
 * Frontmatter-conventie in je Obsidian-notitie:
 * ─────────────────────────────────────────────
 *   ---
 *   grisburgh: personages        ← verplicht: personages / locaties / organisaties / voorwerpen
 *   subtype: npc                 ← optioneel subtype
 *   rol: Stadsschout
 *   ras: Mens
 *   klasse: Strijder
 *   desc: Beschrijving voor spelers
 *   persoonlijkheid: DM-notitie over gedrag
 *   flavour: Sfeervolle quote of beschrijving
 *   geheim: Geheime DM-informatie
 *   ---
 *
 * De bestandsnaam (zonder .md) wordt de naam van het kaartje,
 * tenzij je een 'name'-veld in de frontmatter zet.
 *
 * Veldnamen per type:
 *   personages  : rol, ras, klasse, desc, persoonlijkheid, flavour, geheim
 *   locaties    : locType, wijk, eigenaar, desc, flavour
 *   organisaties: orgType, motto, desc, flavour
 *   voorwerpen  : itemType, rariteit, prijs, desc, flavour
 */

const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const DATA_DIR      = path.join(__dirname, 'data');
const ENTITIES_FILE = path.join(DATA_DIR, 'entities.json');
const DM_STATE_FILE = path.join(DATA_DIR, 'dm-state.json');

const VALID_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

// Welke frontmatter-sleutels worden veldwaarden in data{}
const DATA_KEYS = {
  personages:   ['rol', 'ras', 'klasse', 'desc', 'persoonlijkheid', 'flavour', 'geheim'],
  locaties:     ['locType', 'wijk', 'eigenaar', 'desc', 'flavour'],
  organisaties: ['orgType', 'motto', 'desc', 'flavour'],
  voorwerpen:   ['itemType', 'rariteit', 'prijs', 'desc', 'flavour'],
};

// ── Argument-parsing ──────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const replace = args.includes('--replace');
const visible = args.includes('--visible');
const folder  = args.find(a => !a.startsWith('--'));

if (!folder) {
  console.error('Gebruik: node import-obsidian.js <map-met-notities> [--dry-run] [--replace] [--visible]');
  process.exit(1);
}

const absFolder = path.resolve(folder);
if (!fs.existsSync(absFolder)) {
  console.error(`Map niet gevonden: ${absFolder}`);
  process.exit(1);
}

// ── YAML frontmatter parser (geen externe dependencies) ───────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { fm: {}, body: content };

  const fm = {};
  const raw = match[1];

  // Verwerk multiline values (ingesprongen regels behoren bij vorig veld)
  const lines = raw.split(/\r?\n/);
  let currentKey = null;
  let currentLines = [];

  const flush = () => {
    if (!currentKey) return;
    const joined = currentLines.join('\n').trim();
    fm[currentKey] = joined;
    currentKey = null;
    currentLines = [];
  };

  for (const line of lines) {
    // Lege regel of ingesprongen → onderdeel van vorige waarde
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (currentKey) currentLines.push(line.trim());
      continue;
    }
    const kv = line.match(/^([^:]+):\s*(.*)/);
    if (kv) {
      flush();
      currentKey = kv[1].trim();
      const val = kv[2].trim();
      if (val) currentLines.push(val);
    } else if (currentKey && line.trim()) {
      currentLines.push(line.trim());
    }
  }
  flush();

  const body = content.slice(match[0].length).replace(/^\r?\n/, '');
  return { fm, body };
}

// ── Notitie → entiteit ────────────────────────────────────────────────────────

function noteToEntity(filePath) {
  const raw     = fs.readFileSync(filePath, 'utf8');
  const { fm, body } = parseFrontmatter(raw);

  const type = fm['grisburgh'];
  if (!type || !VALID_TYPES.includes(type)) return null; // geen Grisburgh-notitie

  const basename = path.basename(filePath, '.md');
  const name     = (fm['name'] || basename).trim();

  // data{} opbouwen
  const dataKeys = DATA_KEYS[type] || [];
  const data = {};
  for (const key of dataKeys) {
    const val = fm[key];
    if (val && val.trim()) data[key] = val.trim();
  }

  // Als er body-tekst is en nog geen desc, gebruik body als desc
  if (!data.desc && body.trim()) {
    // Verwijder Markdown-koppen (# Naam) en trim
    const cleaned = body.replace(/^#{1,6}\s+.+$/m, '').trim();
    if (cleaned) data.desc = cleaned;
  }

  return {
    type,
    entity: {
      id:      'e_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name,
      icon:    fm['icon'] || '',
      subtype: fm['subtype'] || '',
      data,
      links:   { personages: [], locaties: [], organisaties: [], voorwerpen: [], archief: [] },
      stats:   null,
    },
  };
}

// ── Bestanden doorlopen ───────────────────────────────────────────────────────

function collectMarkdownFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

// ── Hoofd-logica ──────────────────────────────────────────────────────────────

const files    = collectMarkdownFiles(absFolder);
const parsed   = files.map(f => noteToEntity(f)).filter(Boolean);

if (parsed.length === 0) {
  console.log('Geen Grisburgh-notities gevonden. Zorg dat je frontmatter "grisburgh: <type>" bevat.');
  process.exit(0);
}

console.log(`\n📚 ${parsed.length} notitie(s) gevonden:\n`);

const byType = {};
for (const { type, entity } of parsed) {
  if (!byType[type]) byType[type] = [];
  byType[type].push(entity);
  const dataPreview = Object.entries(entity.data)
    .map(([k, v]) => `  ${k}: ${v.slice(0, 60)}${v.length > 60 ? '…' : ''}`)
    .join('\n');
  console.log(`  [${type}] "${entity.name}"${entity.subtype ? ` (${entity.subtype})` : ''}`);
  if (dataPreview) console.log(dataPreview);
  console.log();
}

if (dryRun) {
  console.log('-- DRY RUN: niets opgeslagen. Verwijder --dry-run om te importeren. --');
  process.exit(0);
}

// ── Opslaan ───────────────────────────────────────────────────────────────────

if (!fs.existsSync(DATA_DIR)) {
  console.error(`Data-map niet gevonden: ${DATA_DIR}\nZorg dat je het script vanuit de Grisburgh-projectmap uitvoert.`);
  process.exit(1);
}

const entities = JSON.parse(fs.readFileSync(ENTITIES_FILE, 'utf8'));
const dmState  = JSON.parse(fs.readFileSync(DM_STATE_FILE, 'utf8'));

let added = 0, replaced = 0, skipped = 0;

for (const { type, entity } of parsed) {
  if (!entities[type]) entities[type] = [];

  const existingIdx = entities[type].findIndex(
    e => e.name.toLowerCase() === entity.name.toLowerCase()
  );

  if (existingIdx !== -1) {
    if (replace) {
      const oldId = entities[type][existingIdx].id;
      entity.id = oldId; // behoud het bestaande ID
      entities[type][existingIdx] = entity;
      replaced++;
    } else {
      console.log(`  ⚠️  Overgeslagen (bestaat al): "${entity.name}" — gebruik --replace om te overschrijven`);
      skipped++;
      continue;
    }
  } else {
    entities[type].push(entity);
    added++;
  }

  // DM-state: standaard verborgen, tenzij --visible
  dmState.visibility[entity.id]  = visible ? 'visible' : 'hidden';
  dmState.secretReveals[entity.id] = false;
}

// Atomisch opslaan
const tmpE = ENTITIES_FILE + '.tmp';
const tmpD = DM_STATE_FILE + '.tmp';
fs.writeFileSync(tmpE, JSON.stringify(entities, null, 2));
fs.writeFileSync(tmpD, JSON.stringify(dmState, null, 2));
fs.renameSync(tmpE, ENTITIES_FILE);
fs.renameSync(tmpD, DM_STATE_FILE);

console.log(`✅ Klaar: ${added} toegevoegd, ${replaced} bijgewerkt, ${skipped} overgeslagen.`);
if (!visible) console.log('   (Nieuwe kaartjes zijn verborgen voor spelers — zet ze aan via de DM-modus.)');
