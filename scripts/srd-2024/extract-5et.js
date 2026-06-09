// Extraheer subklasse-feature-beschrijvingen uit 5etools class-data → platte tekst.
// Output: /tmp/supplement-2024.json  { "Class|SubclassShortName|FeatureName": "desc" }
const fs = require('fs');

// Welke (klasse-bestand, subklasse-shortname, doellabel) we willen.
// Bron-agnostisch: we verzamelen alle versies en prefereren XPHB (2024) > langste.
const WANT = [
  { file: 'cleric-5et.json',   short: 'Twilight',     label: 'Twilight Domain' },
  { file: 'rogue-5et.json',    short: 'Swashbuckler', label: 'Swashbuckler'    },
  { file: 'sorcerer-5et.json', short: 'Wild Magic',   label: 'Wild Magic'      },
  { file: 'sorcerer-5et.json', short: 'Wild',         label: 'Wild Magic'      }, // 2014 PHB (Spell Bombardment)
];

// Species-traits uit races.json → key "SPECIES|<Naam>|<Trait>"
const WANT_SPECIES = ['Aasimar', 'Aarakocra', 'Tabaxi', 'Half-Elf', 'Dragonborn'];

const DICE_TAGS = new Set(['dice','damage','hit','dc','scaledice','scaledamage','d20','chance']);
function stripTags(s) {
  // {@tag inner} → display tekst
  return s.replace(/\{@(\w+)\s*([^}]*)\}/g, (_, tag, inner) => {
    const parts = inner.split('|');
    if (DICE_TAGS.has(tag)) return parts[0];
    // link-tags: voorkeur voor expliciete display (laatste segment) anders eerste
    const last = parts[parts.length - 1];
    return (parts.length >= 3 && last) ? last : parts[0];
  }).replace(/\{@\w+\}/g, '');
}

function flatten(entries, out) {
  for (const e of entries) {
    if (typeof e === 'string') { out.push(stripTags(e)); continue; }
    if (!e || typeof e !== 'object') continue;
    if (e.type === 'table') { if (e.caption) out.push(`(see table: ${stripTags(e.caption)})`); continue; }
    if (e.type === 'list' && Array.isArray(e.items)) { e.items.forEach(it => typeof it === 'string' ? out.push('• ' + stripTags(it)) : flatten([it], out)); continue; }
    if (e.name && Array.isArray(e.entries)) { flatten(e.entries, out); continue; }
    if (Array.isArray(e.entries)) { flatten(e.entries, out); continue; }
  }
  return out;
}

const supplement = {};
const bestSrc = {}; // key → true als al een XPHB-versie gekozen
for (const { file, short, label } of WANT) {
  const d = JSON.parse(fs.readFileSync('/tmp/' + file, 'utf8'));
  const feats = (d.subclassFeature || []).filter(f => f.subclassShortName === short);
  for (const f of feats) {
    const desc = flatten(f.entries || [], []).join('\n\n').trim();
    if (!desc) continue;
    const key = `${f.className}|${label}|${f.name}`;
    const isX = f.source === 'XPHB' || f.subclassSource === 'XPHB';
    // Voorkeur: XPHB wint altijd; anders langste tekst
    if (!supplement[key] || (isX && !bestSrc[key]) || (!bestSrc[key] && supplement[key].length < desc.length)) {
      supplement[key] = desc;
      if (isX) bestSrc[key] = true;
    }
  }
}

// ── Species-traits ──
const PREF = ['XPHB', 'MPMM', 'VGM', 'PHB', 'DMG']; // voorkeursvolgorde
const races = JSON.parse(fs.readFileSync('/tmp/races-5et.json', 'utf8')).race || [];
for (const name of WANT_SPECIES) {
  const variants = races.filter(r => r.name === name)
    .sort((a, b) => (PREF.indexOf(a.source) + 99) % 99 - (PREF.indexOf(b.source) + 99) % 99);
  const chosen = variants[0];
  if (!chosen) continue;
  for (const e of (chosen.entries || [])) {
    if (!e || typeof e !== 'object' || !e.name || !Array.isArray(e.entries)) continue;
    const desc = flatten(e.entries, []).join('\n\n').trim();
    if (!desc) continue;
    supplement[`SPECIES|${name}|${e.name}`] = desc;
  }
}

fs.writeFileSync('/tmp/supplement-2024.json', JSON.stringify(supplement, null, 2));
console.log('Geëxtraheerde features:', Object.keys(supplement).length);
for (const [k, v] of Object.entries(supplement)) console.log('\n### ' + k + '\n' + v.slice(0, 200) + (v.length > 200 ? '…' : ''));
