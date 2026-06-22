#!/usr/bin/env node
// Eenmalige migratie: wapen-`notes` → wapen-`props` (eigenschappen).
// Het notitieveld op het spelersblad is verwijderd; deze migratie probeert de oude
// vrije-tekst-notities om te zetten naar echte WEAPON_PROPERTIES-chips en verwijdert
// daarna het `notes`-veld. Niet-herkenbare tekst wordt gerapporteerd en (per gebruikersakkoord)
// verwijderd.
//
// Gebruik:
//   node migrate-weapon-notes.js <pad-naar-dm-state.json> [--write]
//   (zonder --write = dry-run: toont alleen het conversieoverzicht)

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const WRITE = process.argv.includes('--write');
if (!file) { console.error('Geef het pad naar dm-state.json op.'); process.exit(1); }

// Basis-properties (EN + NL-aliassen). Volgorde = matchprioriteit binnen één token.
const BASE = [
  [/\b(finesse|fijnheid)\b/i,                 'Finesse'],
  [/\b(two[\s-]?handed|tweehandig)\b/i,       'Two-Handed'],
  [/\b(light|licht)\b/i,                      'Light'],
  [/\b(heavy|zwaar)\b/i,                      'Heavy'],
  [/\b(reach|reikwijdte)\b/i,                 'Reach'],
  [/\b(loading|herladen)\b/i,                 'Loading'],
  [/\b(thrown|geworpen|werp\w*)\b/i,          'Thrown'],
  [/\b(versatile|veelzijdig)\b/i,             'Versatile'],
  [/\b(ammunition|munitie)\b/i,               'Ammunition'],
  [/\b(range|bereik)\b/i,                     'Range'],
  [/\b(topple|omver\w*)\b/i,                  'Topple'],
  [/\b(cleave|klieven)\b/i,                   'Cleave'],
  [/\b(graze)\b/i,                            'Graze'],
  [/\b(nick)\b/i,                             'Nick'],
  [/\b(push|duw\w*)\b/i,                      'Push'],
  [/\b(slow|traag)\b/i,                       'Slow'],
  [/\b(sap)\b/i,                              'Sap'],
  [/\b(vex)\b/i,                              'Vex'],
  [/\b(special|speciaal)\b/i,                 'Special'],
];
const PARAM = new Set(['Range', 'Versatile', 'Thrown', 'Ammunition']);

// Eén komma-token → property-string ("Versatile (1d8)") of null als niet herkend.
function tokenToProp(tok) {
  const t = tok.trim();
  if (!t) return null;
  let base = null;
  for (const [re, name] of BASE) { if (re.test(t)) { base = name; break; } }
  if (!base) return null;
  if (!PARAM.has(base)) return base;
  // parameter bepalen: eerst expliciete (...) groep, anders patroon in vrije tekst
  let param = null;
  const paren = t.match(/\(([^)]+)\)/);
  if (paren) param = paren[1].trim();
  else if (base === 'Versatile') { const d = t.match(/\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?/i); if (d) param = d[0].replace(/\s+/g, ''); }
  else { const r = t.match(/\d+\s*\/\s*\d+/); if (r) param = r[0].replace(/\s+/g, ''); }
  // Range zonder geldige normaal/ver-waarde is geen wapen-eigenschap (bv. cantrip-spreukbereik) → niet overzetten
  if (base === 'Range' && !param) return null;
  return param ? `${base} (${param})` : base;
}

// Notitietekst → { props:[...], dropped:[...] }
function convert(notes) {
  const props = [];
  const dropped = [];
  for (const raw of String(notes).split(/[,;]+/)) {
    const tok = raw.trim();
    if (!tok) continue;
    const p = tokenToProp(tok);
    if (p) {
      // dedup op base-property (zodat "Range 80/320" niet naast "Range" belandt)
      const baseOf = s => s.replace(/\s*\(.*\)$/, '').trim();
      const exists = props.find(x => baseOf(x) === baseOf(p));
      if (exists) { if (p.length > exists.length) props[props.indexOf(exists)] = p; }
      else props.push(p);
    } else dropped.push(tok);
  }
  return { props, dropped };
}

const ds = JSON.parse(fs.readFileSync(file, 'utf8'));
const pp = ds.playerProfiles || {};

// optioneel: namen erbij voor leesbaar rapport
let names = {};
try {
  const ent = JSON.parse(fs.readFileSync(path.join(path.dirname(file), 'entities.json'), 'utf8'));
  (ent.personages || []).forEach(p => { names[p.id] = p.name; });
} catch {}

let weaponsChanged = 0, notesCleared = 0;
const report = [];

for (const id in pp) {
  let ws;
  try { ws = JSON.parse(pp[id].weapons || '[]'); } catch { continue; }
  if (!Array.isArray(ws) || !ws.length) continue;
  let dirty = false;
  for (const w of ws) {
    if (!w || !w.notes || !String(w.notes).trim()) {
      if (w && 'notes' in w) { delete w.notes; dirty = true; }   // lege notes ook opruimen
      continue;
    }
    const { props, dropped } = convert(w.notes);
    const before = Array.isArray(w.props) ? w.props.slice() : [];
    const merged = before.slice();
    const baseOf = s => s.replace(/\s*\(.*\)$/, '').trim();
    for (const p of props) {
      const ex = merged.find(x => baseOf(x) === baseOf(p));
      if (ex) { if (p.length > ex.length) merged[merged.indexOf(ex)] = p; }
      else merged.push(p);
    }
    report.push({ char: names[id] || id, weapon: w.name || '(naamloos)', notes: w.notes, props: merged, dropped });
    w.props = merged;
    delete w.notes;
    dirty = true;
    weaponsChanged++;
    if (props.length || dropped.length) notesCleared++;
  }
  if (dirty) pp[id].weapons = JSON.stringify(ws);
}

// rapport
console.log('\n=== Conversieoverzicht ===\n');
for (const r of report) {
  console.log(`• [${r.char}] ${r.weapon}`);
  console.log(`    notes : "${r.notes}"`);
  console.log(`    props : ${r.props.length ? r.props.map(p => `«${p}»`).join('  ') : '(geen herkend)'}`);
  if (r.dropped.length) console.log(`    \x1b[33mWEG   : ${r.dropped.map(d => `"${d}"`).join(', ')}\x1b[0m`);
  console.log('');
}
console.log(`Wapens met notes verwerkt: ${notesCleared}.  Totaal aangeraakte wapens (incl. lege notes opgeruimd): ${weaponsChanged}.`);

if (WRITE) {
  fs.writeFileSync(file, JSON.stringify(ds, null, 2));
  console.log(`\n✔ Geschreven naar ${file}`);
} else {
  console.log('\n(DRY-RUN — niets geschreven. Voeg --write toe om door te voeren.)');
}
