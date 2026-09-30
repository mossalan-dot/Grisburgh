#!/usr/bin/env node
// Het embleem van een factie woonde in `meta.facties[].embleem`, terwijl het
// organisatiekaartje waar ze aan hangt zijn eigen teken heeft. Twee pickers
// voor één symbool. Sinds 30 sep leest de factie het teken van dat kaartje.
//
// Dit script zet het gekozen embleem op het kaartje (`data.icoon`), zodat een
// campagne er niets door verandert — en het teken meteen ook in de kaartenlijst,
// in wikilinks en in het organogram te zien is.
//
//   node scripts/factie-embleem-naar-kaartje.js <campagne> [--schrijf]
const fs   = require('fs');
const path = require('path');

const args     = process.argv.slice(2);
const campagne = args.find(a => !a.startsWith('--'));
const schrijf  = args.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/factie-embleem-naar-kaartje.js <campagne> [--schrijf]');
  process.exit(1);
}

const dir      = path.join(__dirname, '..', 'data', 'campaigns', campagne);
const metaPad  = path.join(dir, 'meta.json');
const entPad   = path.join(dir, 'entities.json');
for (const p of [metaPad, entPad]) {
  if (!fs.existsSync(p)) { console.error('Niet gevonden: ' + p); process.exit(1); }
}

const meta = JSON.parse(fs.readFileSync(metaPad, 'utf8'));
const ents = JSON.parse(fs.readFileSync(entPad, 'utf8'));

let gezet = 0, overgeslagen = 0;
for (const f of (meta.facties || [])) {
  const teken = String(f.embleem || '').trim();
  if (!teken || teken === 'landmark') { overgeslagen++; continue; }
  const org = f.entityId ? (ents.organisaties || []).find(o => o.id === f.entityId) : null;
  if (!org) { console.log(`  ${f.naam}: geen organisatiekaartje — embleem "${teken}" blijft bij de factie staan`); overgeslagen++; continue; }
  if (String(org.data?.icoon || '').trim()) { console.log(`  ${f.naam}: ${org.name} heeft al een teken (${org.data.icoon})`); overgeslagen++; continue; }
  if (!org.data) org.data = {};
  org.data.icoon = teken;
  console.log(`  ${f.naam}: "${teken}" → kaartje ${org.name}`);
  gezet++;
}

console.log(`\n${gezet} teken(s) verhuisd, ${overgeslagen} ongemoeid.`);
if (!schrijf) { console.log('(proefdraai — voeg --schrijf toe om het door te voeren)'); process.exit(0); }
if (gezet) {
  const bak = entPad + '.voor-embleem.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(entPad, bak);
  fs.writeFileSync(entPad, JSON.stringify(ents, null, 2));
  console.log('Geschreven. Backup: ' + path.basename(bak));
}
