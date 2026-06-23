#!/usr/bin/env node
// Eenmalige migratie van de zegeningenkaartjes (data.itemType === 'Blessing').
//
// - zegen: mechaniek verhuist van `effect` → `desc` (titel-prefix "Naam: " weg,
//   "charge"-woordkeuze herschreven naar "exemplaar"); `effect` geleegd; oude
//   `desc` (gebed) + `flavour` gewist. Reeds-aangepaste kaarten (effect al leeg)
//   worden overgeslagen.
// - vloek: mechaniek `effect` → `desc` (reword); `effect` geleegd; `flavour` gewist.
// - eed:  `effect` blijft de eedtitel (server-nodig); alleen `desc` (gebed) + `flavour` gewist.
//
// Gebruik: node migrate-blessings-effect-to-desc.js <entities.json> [--write]
//   zonder --write = dry-run met before/after-overzicht.

const fs = require('fs');
const file = process.argv[2];
const WRITE = process.argv.includes('--write');
if (!file) { console.error('Geef het pad naar entities.json op.'); process.exit(1); }

// "charge"-woordkeuze → stapelbaar/afvinkbaar model.
function reword(t) {
  if (!t) return t;
  let s = t;
  // "Geef 1 charge uit" → "Gebruik 1 exemplaar"; "Geef 2 charges uit" → "Gebruik 2 exemplaren"
  s = s.replace(/\bGeef\s+(\d+)\s+charges\s+uit\b/gi, (_, n) => `Gebruik ${n} exemplaren`);
  s = s.replace(/\bGeef\s+(\d+)\s+charge\s+uit\b/gi,  (_, n) => `Gebruik ${n} exemplaar`);
  s = s.replace(/\bGeef\s+een\s+charge\s+uit\b/gi, 'Gebruik een exemplaar');
  // Overgebleven losse vermeldingen
  s = s.replace(/\bcharges\b/gi, 'exemplaren');
  s = s.replace(/\bcharge\b/gi, 'exemplaar');
  return s;
}

// Verwijder een leidend "Titel: "-prefix dat de kaartnaam herhaalt.
function stripTitlePrefix(effect, naam) {
  if (!effect) return effect;
  const idx = effect.indexOf(':');
  if (idx === -1) return effect.trim();
  const prefix = effect.slice(0, idx).trim().toLowerCase();
  const n = (naam || '').trim().toLowerCase();
  // Strip alleen als het prefix de kaartnaam is (of die bevat) — anders laten staan.
  if (prefix && (prefix === n || n.includes(prefix) || prefix.includes(n))) {
    return effect.slice(idx + 1).trim();
  }
  return effect.trim();
}

const ent = JSON.parse(fs.readFileSync(file, 'utf8'));
const items = ent.voorwerpen || [];
const bless = items.filter(i => i.data?.itemType === 'Blessing');

const report = { zegen: [], vloek: [], eed: [], skip: [] };

for (const e of bless) {
  const d = e.data || (e.data = {});
  const type = d.goddelijkType || '';
  const effect = (d.effect || '').trim();
  const before = { effect: d.effect || '', desc: d.desc || '', flavour: d.flavour || '' };

  // Alleen zegen-kaarten migreren; vloek + eed blijven ongemoeid (lore behouden).
  if (type === 'zegen') {
    if (!effect) { report.skip.push({ naam: e.name }); continue; }   // al aangepast
    const newDesc = reword(stripTitlePrefix(d.effect, e.name));
    d.desc = newDesc; d.effect = ''; d.flavour = '';
    report.zegen.push({ naam: e.name, before, after: { desc: newDesc } });
  } else {
    report.skip.push({ naam: e.name, reden: type || 'geen type' });
  }
}

// ── rapport ──
const dim = s => `\x1b[2m${s}\x1b[0m`;
function show(list, titel) {
  console.log(`\n=== ${titel} (${list.length}) ===`);
  for (const r of list.slice(0, 6)) {
    console.log(`• ${r.naam}`);
    if (r.before.effect) console.log(`   effect→ ${dim('"'+r.before.effect+'"')}`);
    if (r.after.desc !== undefined) console.log(`   desc=   "${r.after.desc}"`);
    if (r.before.desc)    console.log(`   ${dim('oude desc weg: "'+r.before.desc+'"')}`);
    if (r.before.flavour) console.log(`   ${dim('flavour weg:   "'+r.before.flavour+'"')}`);
  }
  if (list.length > 6) console.log(`   … en ${list.length - 6} meer`);
}
show(report.zegen, 'ZEGEN: effect→desc (prefix weg, reword), effect/flavour leeg');
console.log(`\nOvergeslagen (vloek/eed ongemoeid + al-aangepaste zegen): ${report.skip.length}`);
console.log(`Totaal blessings: ${bless.length}`);

if (WRITE) {
  fs.writeFileSync(file, JSON.stringify(ent, null, 2));
  console.log(`\n✔ Geschreven naar ${file}`);
} else {
  console.log('\n(DRY-RUN — niets geschreven. Voeg --write toe om door te voeren.)');
}
