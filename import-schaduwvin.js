#!/usr/bin/env node
/**
 * import-schaduwvin.js
 * Importeert de Schaduwvin Obsidian-vault rechtstreeks naar Grisburgh.
 * Begrijpt de vault-structuur uit CLAUDE.md zonder frontmatter nodig te hebben.
 *
 * Gebruik:
 *   node import-schaduwvin.js [--dry-run] [--replace] [--visible]
 */

const fs   = require('fs');
const path = require('path');

// ── Paden ─────────────────────────────────────────────────────────────────────

const VAULT        = '/Users/alan/Library/Mobile Documents/iCloud~md~obsidian/Documents/Schaduwvin';
const DATA_DIR     = path.join(__dirname, 'data');
const ENTITIES_FILE= path.join(DATA_DIR, 'entities.json');
const DM_STATE_FILE= path.join(DATA_DIR, 'dm-state.json');
const FILES_DIR    = path.join(DATA_DIR, 'files');

// ── Opties ────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const replace = args.includes('--replace');
const visible = args.includes('--visible');

// ── Mappingregels: subpad (relatief aan VAULT) → type + subtype ───────────────

const FOLDER_RULES = [
  { match: "Personen/PC's",                      type: 'personages', subtype: 'speler' },
  { match: "Personen/NPC's in Grisburgh",        type: 'personages', subtype: 'npc'    },
  { match: "Personen/NPC's in Amberwoud",        type: 'personages', subtype: 'npc'    },
  { match: "Personen/Andere NPC's",              type: 'personages', subtype: 'npc'    },
  { match: "Personen/Dieren",                    type: 'personages', subtype: 'npc'    },
  { match: 'Locaties',                           type: 'locaties',   subtype: ''       },
  { match: 'Organisaties',                       type: 'organisaties', subtype: ''     },
  { match: 'Voorwerpen',                         type: 'voorwerpen', subtype: ''       },
];

// ── Media-index (case-insensitief bestandsnaam → volledig pad) ─────────────────

function buildMediaIndex(dir) {
  const idx = {};
  function scan(d) {
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) scan(full);
        else if (!idx[e.name.toLowerCase()]) idx[e.name.toLowerCase()] = full;
      }
    } catch {}
  }
  scan(dir);
  return idx;
}

// ── Tekst-hulpfuncties ────────────────────────────────────────────────────────

// Haal de korte rol-beschrijving uit <mark>...</mark> (Obsidian highlight)
function extractMark(text) {
  const m = text.match(/<mark[^>]*>([\s\S]*?)<\/mark>/);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

// Haal afbeeldingsnamen op uit ![[...]]
function extractImageNames(text) {
  const names = [];
  text.replace(/!\[\[([^\]]+)\]\]/g, (_, raw) => {
    const name = raw.split('|')[0].trim();
    if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(name)) names.push(name);
  });
  return names;
}

// Extraheer wiki-linknamen uit [[...]] en [[...|alias]] (geen mediabestanden)
function extractWikiLinks(text) {
  const names = new Set();
  text.replace(/\[\[([^\]]+)\]\]/g, (_, raw) => {
    const name = raw.split('|')[0].trim();
    if (!/\.(png|jpg|jpeg|webp|gif|svg|pdf)$/i.test(name)) {
      names.add(name);
    }
  });
  return [...names];
}

// Parseer de eerste markdown-tabel en geef kolomnaam → waarde terug
function parseFirstTable(text) {
  const lines = text.split('\n');
  let hdrIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|')) { hdrIdx = i; break; }
  }
  if (hdrIdx < 0) return {};

  // Zoek data-rij (sla scheidingsrij over)
  let dataIdx = hdrIdx + 1;
  if (dataIdx < lines.length && /^\|[\s\-|:]+\|/.test(lines[dataIdx].trim())) dataIdx++;
  if (dataIdx >= lines.length || !lines[dataIdx].trim().startsWith('|')) return {};

  const headers = lines[hdrIdx].split('|').slice(1, -1).map(h =>
    h.replace(/==\*\*|\*\*==/g, '').replace(/\*\*/g, '').trim()
  );
  const values = lines[dataIdx].split('|').slice(1, -1).map(v =>
    v.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
     .replace(/\[\[([^\]]+)\]\]/g, '$1').trim()
  );

  const row = {};
  headers.forEach((h, i) => { if (h && values[i]) row[h] = values[i]; });
  return row;
}

// Verwijder alle opeenvolgende tabelrijen aan het begin van de tekst
function stripLeadingTable(text) {
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim().startsWith('|')) i++;
  while (i < lines.length && lines[i].trim().startsWith('|')) i++;
  return lines.slice(i).join('\n').trimStart();
}

// Extraheer een sectie op basis van de koptekst (##### Persoonlijkheid etc.)
function extractNamedSection(text, headerRegex) {
  const lines = text.split('\n');
  let inSec = false;
  const sec = [], rest = [];
  for (const line of lines) {
    if (headerRegex.test(line.trim())) { inSec = true; continue; }
    if (inSec && /^#{1,6}\s/.test(line)) inSec = false;
    (inSec ? sec : rest).push(line);
  }
  return { section: sec.join('\n').trim(), rest: rest.join('\n').trim() };
}

// Maak tekst schoon voor gebruik als beschrijving
function cleanText(text) {
  return text
    .replace(/<mark[^>]*>[\s\S]*?<\/mark>/g, '')    // highlight-tags
    .replace(/!\[\[[^\]]+\]\]/g, '')                 // ![[embeds]]
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')  // [[link|alias]] → alias
    .replace(/\[\[([^\]]+)\]\]/g, '$1')              // [[link]] → link
    .replace(/^>.*$/gm, '')                          // blockquotes (stat blocks)
    .replace(/^\|.*\|$/gm, '')                       // tabelrijen
    .replace(/^#{1,6}\s+.+$/gm, '')                 // koppen
    .replace(/^#\S+(\s+#\S+)*\s*$/gm, '')           // #tag-regels
    .replace(/^---+$/gm, '')                         // horizontale lijnen
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Zet Obsidian-bulletpunten om naar leesbare tekst
function bulletToText(text) {
  return text
    .split('\n')
    .map(l => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
    .join('\n');
}

// ── D&D 5e stat block parser (blockquote-formaat) ────────────────────────────

// Parseer het eerste ">"-blockquote-blok in de tekst naar een stats-object.
// Herkent alle standaard D&D 5e velden: AC, HP, Speed, ability scores,
// Saving Throws, Skills, Resistances, Immunities, Senses, Languages, CR,
// Prof Bonus, Traits, Actions, Bonus Actions, Reactions, Legendary Actions,
// Cantrips, Spells.
function parseStatBlock(raw) {
  // Verzamel de eerste aaneengesloten reeks blockquote-regels
  const allLines = raw.split('\n');
  const bq = [];
  let started = false;

  for (const line of allLines) {
    if (/^>/.test(line)) {
      bq.push(line.replace(/^>\s?/, ''));
      started = true;
    } else if (started) {
      if (line.trim() === '') continue; // lege regel buiten blockquote is OK
      break;                            // echte inhoud buiten blockquote: stop
    }
  }

  if (bq.length < 3) return null;

  const stats = {};
  let phase = 'header'; // header → structured → extra
  let currentSection = 'traits';
  let expectAbilityRow = false; // voor tabel-formaat ability scores

  const sections = { traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [], spells: [] };

  // Verwijder markdown-opmaak uit een regel
  const stripMd = (s) => s
    .replace(/\*{3}([^*]+)\*{3}/g, '$1')
    .replace(/\*{2}([^*]+)\*{2}/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');

  for (const rawLine of bq) {
    const line = rawLine.trim();
    if (!line || line === '---') continue;

    // ── ALTIJD: single-line structured velden (ook vóór ability scores) ──

    const ac = line.match(/\*\*Armor\s+Class\*\*\s*(.+)/i);
    if (ac) { stats.ac = ac[1].trim(); phase = 'structured'; continue; }

    const hp = line.match(/\*\*Hit\s+Points\*\*\s*(.+)/i);
    if (hp) { stats.hp = hp[1].trim(); continue; }

    const sp = line.match(/\*\*Speed\*\*\s*(.+)/i);
    if (sp) { stats.speed = sp[1].trim(); continue; }

    // Ability scores: één-regel formaat  STR 10 (+0) | DEX 17 (+3) | ...
    const ab = line.match(
      /STR\s+(\d+)[^|]*\|\s*DEX\s+(\d+)[^|]*\|\s*CON\s+(\d+)[^|]*\|\s*INT\s+(\d+)[^|]*\|\s*WIS\s+(\d+)[^|]*\|\s*CHA\s+(\d+)/i
    );
    if (ab) {
      stats.str = ab[1]; stats.dex = ab[2]; stats.con = ab[3];
      stats.int = ab[4]; stats.wis = ab[5]; stats.cha = ab[6];
      phase = 'extra'; expectAbilityRow = false;
      continue;
    }

    // Ability scores: tabel-header  | STR | DEX | CON | INT | WIS | CHA |
    if (/\|\s*STR\s*\|/i.test(line) && /CHA/i.test(line)) {
      expectAbilityRow = true;
      continue;
    }
    // Tabel-separator overslaan
    if (expectAbilityRow && /^\|[-\s|]+\|$/.test(line)) continue;
    // Tabel-data: | 18 (+4) | 14 (+2) | ...
    if (expectAbilityRow) {
      const nums = [...line.matchAll(/\|\s*(\d+)\s*(?:\([^)]*\))?\s*/g)].map(m => m[1]);
      if (nums.length >= 6) {
        stats.str = nums[0]; stats.dex = nums[1]; stats.con = nums[2];
        stats.int = nums[3]; stats.wis = nums[4]; stats.cha = nums[5];
        phase = 'extra'; expectAbilityRow = false;
        continue;
      }
    }

    // Header- en structuurregels overslaan (naam, type, grootte, alignment)
    if (phase === 'header' || phase === 'structured') continue;

    // ── EXTRA PHASE: structured fields + secties ──

    // Saving Throws
    const st = line.match(/\*\*Saving\s+Throws\*\*\s*(.+)/i);
    if (st) { stats.savingThrows = st[1].trim(); continue; }

    // Skills
    const sk = line.match(/\*\*Skills\*\*\s*(.+)/i);
    if (sk) { stats.skills = sk[1].trim(); continue; }

    // Damage Resistances
    const dr = line.match(/\*\*Damage\s+Resistances?\*\*\s*(.+)/i);
    if (dr) { stats.resistances = dr[1].trim(); continue; }

    // Damage Immunities
    const di = line.match(/\*\*Damage\s+Immunities?\*\*\s*(.+)/i);
    if (di) { stats.immunities = di[1].trim(); continue; }

    // Condition Immunities
    const ci = line.match(/\*\*Condition\s+Immunities?\*\*\s*(.+)/i);
    if (ci) { stats.conditionImmunities = ci[1].trim(); continue; }

    // Senses
    const se = line.match(/\*\*Senses\*\*\s*(.+)/i);
    if (se) { stats.senses = se[1].trim(); continue; }

    // Languages
    const la = line.match(/\*\*Languages\*\*\s*(.+)/i);
    if (la) { stats.languages = la[1].trim(); continue; }

    // Challenge (CR) — kan ook Prof Bonus op dezelfde regel bevatten
    const ch = line.match(/\*\*Challenge\*\*\s*(.+)/i);
    if (ch) {
      const crLine = ch[1];
      const pbInline = crLine.match(/\*\*Proficiency\s+Bonus\*\*\s*(\S+)/i);
      if (pbInline) stats.profBonus = pbInline[1];
      stats.cr = crLine.replace(/\|?\s*\*\*Proficiency\s+Bonus\*\*.*$/i, '').trim();
      continue;
    }

    // Proficiency Bonus (apart)
    const pb = line.match(/\*\*Proficiency\s+Bonus\*\*\s*(.+)/i);
    if (pb) { stats.profBonus = pb[1].trim(); continue; }

    // Cantrips (apart veld)
    const ca = line.match(/\*\*Cantrips?\*\*\s*(.+)/i);
    if (ca) { stats.cantrips = ca[1].trim(); continue; }

    // Sectiekoppen (## Actions, ## Bonus Actions, etc.)
    const secMatch = line.match(/^#+\s*(.+)/);
    if (secMatch) {
      const sName = secMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
      if (sName === 'actions') currentSection = 'actions';
      else if (sName === 'bonus actions') currentSection = 'bonusActions';
      else if (sName === 'reactions') currentSection = 'reactions';
      else if (sName === 'legendary actions') currentSection = 'legendaryActions';
      else if (sName.includes('spell')) currentSection = 'spells';
      continue;
    }

    // Voeg toe aan huidige sectie (strip markdown)
    sections[currentSection].push(stripMd(line));
  }

  // Sla secties op als niet-lege strings
  if (sections.traits.length)          stats.traits          = sections.traits.join('\n').trim();
  if (sections.actions.length)         stats.actions         = sections.actions.join('\n').trim();
  if (sections.bonusActions.length)    stats.bonusActions    = sections.bonusActions.join('\n').trim();
  if (sections.reactions.length)       stats.reactions       = sections.reactions.join('\n').trim();
  if (sections.legendaryActions.length) stats.legendaryActions = sections.legendaryActions.join('\n').trim();
  if (sections.spells.length)          stats.spells          = sections.spells.join('\n').trim();

  // Retourneer alleen als er minimaal één herkenbaar veld is
  return (stats.ac || stats.hp || stats.str) ? stats : null;
}

// ── Bestand → entiteit ────────────────────────────────────────────────────────

function fileToEntity(filePath, type, subtype, mediaIndex) {
  const raw  = fs.readFileSync(filePath, 'utf8');
  const name = path.basename(filePath, '.md');
  const data = {};

  let text = raw;

  // Rol/label uit <mark>
  const mark = extractMark(text);
  if (mark) {
    data.rol = mark;
    text = text.replace(/<mark[^>]*>[\s\S]*?<\/mark>/, '');
  }

  // Tabel: metadata ophalen
  const tableRow = parseFirstTable(text);
  if (Object.keys(tableRow).length > 0) text = stripLeadingTable(text);

  // Type-specifieke veldmapping
  if (type === 'locaties') {
    if (tableRow['Type'])     data.locType  = tableRow['Type'];
    if (tableRow['Eigenaar']) data.eigenaar = tableRow['Eigenaar'];
  } else if (type === 'voorwerpen') {
    if (tableRow['Type'])     data.itemType  = tableRow['Type'];
    if (tableRow['Rarity'])   data.rariteit  = tableRow['Rarity'];
    if (tableRow['Rarity'] && !data.rariteit) data.rariteit = tableRow['Rarity'];
  } else if (type === 'personages') {
    if (tableRow['Race'])   data.ras    = tableRow['Race'];
    if (tableRow['Class'])  data.klasse = tableRow['Class'];
  }

  // Persoonlijkheid-sectie extraheren
  const { section: pers, rest: textWithoutPers } =
    extractNamedSection(text, /^#{1,6}\s*(persoonlijkheid|karakter)/i);
  if (pers) {
    data.persoonlijkheid = bulletToText(pers);
    text = textWithoutPers;
  }

  // Geruchten-sectie verwijderen (niet in de kaartjes)
  const { rest: textWithoutGeruchten } =
    extractNamedSection(text, /^#{1,6}\s*(geruchten|verhalen|gerucht)/i);
  text = textWithoutGeruchten;

  // Beschrijving opschonen
  const desc = cleanText(text);
  if (desc) data.desc = desc;

  // Afbeelding zoeken
  let imageSrc = null;
  const imageNames = extractImageNames(raw);
  for (const imgName of imageNames) {
    const found = mediaIndex[imgName.toLowerCase()];
    if (found) { imageSrc = found; break; }
  }

  // Fallback: afbeelding met zelfde naam als bestand
  if (!imageSrc) {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
      const k = `${name.toLowerCase()}.${ext}`;
      if (mediaIndex[k]) { imageSrc = mediaIndex[k]; break; }
    }
  }

  // Wiki-links verzamelen voor latere verbindingsresolutie (vóór cleanText)
  const wikiLinks = extractWikiLinks(raw);

  // Stat block: alleen voor personages, uit het ruwe bestand
  const stats = (type === 'personages') ? parseStatBlock(raw) : null;

  const id = 'e_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

  return {
    type,
    entity: {
      id,
      name,
      icon: '',
      subtype,
      data,
      links: { personages: [], locaties: [], organisaties: [], voorwerpen: [], archief: [] },
      stats,
    },
    imageSrc,
    wikiLinks,
  };
}

// ── Bestanden ophalen ─────────────────────────────────────────────────────────

function collectFiles(vaultPath) {
  const results = [];
  function scan(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { scan(full); continue; }
      if (!e.name.endsWith('.md')) continue;

      const rel = path.relative(vaultPath, full);
      for (const rule of FOLDER_RULES) {
        if (rel.startsWith(rule.match + path.sep) || rel.startsWith(rule.match + '/')) {
          results.push({ filePath: full, type: rule.type, subtype: rule.subtype });
          break;
        }
      }
    }
  }
  scan(vaultPath);
  return results;
}

// ── Afbeelding kopiëren naar data/files ──────────────────────────────────────

function copyImage(src, entityId) {
  if (!src || !fs.existsSync(src)) return;
  const ext = path.extname(src).slice(1).toLowerCase() || 'png';
  const dest = path.join(FILES_DIR, `${entityId}.${ext}`);
  // Verwijder eventueel bestaand bestand met ander formaat
  for (const e2 of ['png','jpg','jpeg','webp','gif']) {
    const old = path.join(FILES_DIR, `${entityId}.${e2}`);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  fs.copyFileSync(src, dest);
}

// ── Hoofd-logica ──────────────────────────────────────────────────────────────

console.log(`\n📖 Schaduwvin importer\n   Vault: ${VAULT}\n`);

if (!fs.existsSync(VAULT)) {
  console.error('Vault niet gevonden. Pas het VAULT-pad bovenin het script aan.');
  process.exit(1);
}

const mediaIndex = buildMediaIndex(VAULT);
console.log(`🖼  ${Object.keys(mediaIndex).length} mediabestanden geïndexeerd`);

const files = collectFiles(VAULT);
console.log(`📄 ${files.length} notities gevonden\n`);

if (files.length === 0) {
  console.log('Geen bestanden gevonden. Controleer het VAULT-pad.');
  process.exit(0);
}

// Verwerk alle bestanden
const parsed = [];
for (const { filePath, type, subtype } of files) {
  try {
    const result = fileToEntity(filePath, type, subtype, mediaIndex);
    parsed.push(result);
  } catch (err) {
    console.warn(`⚠️  Overgeslagen (fout): ${path.basename(filePath)} — ${err.message}`);
  }
}

// ── Wiki-links omzetten naar verbindingen ─────────────────────────────────────

// Bouw naam → {type, name} opzoektabel van alle geparseerde entiteiten
const nameToType = {};
for (const { type, entity } of parsed) {
  nameToType[entity.name.toLowerCase()] = { type, name: entity.name };
}

// Wijs wiki-links toe aan de verbindingsbuckets van elke entiteit
let linksAdded = 0;
for (const item of parsed) {
  for (const linkName of item.wikiLinks) {
    const resolved = nameToType[linkName.toLowerCase()];
    if (!resolved) continue;
    const bucket = resolved.type;
    if (!item.entity.links[bucket]) continue;
    if (!item.entity.links[bucket].includes(resolved.name)) {
      item.entity.links[bucket].push(resolved.name);
      linksAdded++;
    }
  }
}
console.log(`🔗 ${linksAdded} verbindingen opgelost\n`);

// Groepeer per type en toon preview
const byType = {};
for (const { type, entity, imageSrc } of parsed) {
  if (!byType[type]) byType[type] = [];
  byType[type].push({ entity, imageSrc });
}

for (const [type, items] of Object.entries(byType)) {
  console.log(`\n[${type}] — ${items.length} items`);
  for (const { entity, imageSrc } of items.slice(0, 5)) {
    const img = imageSrc ? '🖼' : '·';
    const desc = entity.data.desc ? entity.data.desc.slice(0, 60).replace(/\n/g, ' ') + '…' : '(geen beschrijving)';
    console.log(`  ${img} ${entity.name}${entity.subtype ? ` (${entity.subtype})` : ''}`);
    console.log(`     ${desc}`);
  }
  if (items.length > 5) console.log(`  … en ${items.length - 5} meer`);
}

if (dryRun) {
  console.log('\n── DRY RUN: niets opgeslagen. Verwijder --dry-run om te importeren. ──\n');
  process.exit(0);
}

// ── Opslaan ───────────────────────────────────────────────────────────────────

if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

const entities = JSON.parse(fs.readFileSync(ENTITIES_FILE, 'utf8'));
const dmState  = JSON.parse(fs.readFileSync(DM_STATE_FILE, 'utf8'));

let added = 0, replaced = 0, skipped = 0, images = 0;

for (const { type, entity, imageSrc } of parsed) {
  if (!entities[type]) entities[type] = [];

  const existingIdx = entities[type].findIndex(
    e => e.name.toLowerCase() === entity.name.toLowerCase()
  );

  if (existingIdx !== -1) {
    if (replace) {
      entity.id = entities[type][existingIdx].id; // behoud ID zodat afbeelding klopt
      entities[type][existingIdx] = entity;
      if (imageSrc) { copyImage(imageSrc, entity.id); images++; }
      replaced++;
    } else {
      skipped++;
      continue;
    }
  } else {
    entities[type].push(entity);
    if (imageSrc) { copyImage(imageSrc, entity.id); images++; }
    added++;
  }

  dmState.visibility[entity.id]    = visible ? 'visible' : 'hidden';
  dmState.secretReveals[entity.id] = false;
}

// Atomisch opslaan
const tmpE = ENTITIES_FILE + '.tmp';
const tmpD = DM_STATE_FILE + '.tmp';
fs.writeFileSync(tmpE, JSON.stringify(entities, null, 2));
fs.writeFileSync(tmpD, JSON.stringify(dmState, null, 2));
fs.renameSync(tmpE, ENTITIES_FILE);
fs.renameSync(tmpD, DM_STATE_FILE);

console.log(`\n✅ Klaar:`);
console.log(`   ${added} toegevoegd, ${replaced} bijgewerkt, ${skipped} overgeslagen`);
console.log(`   ${images} afbeeldingen gekopieerd`);
if (!visible) console.log('   (Nieuwe kaartjes zijn verborgen — zet ze aan als DM)');
console.log();
