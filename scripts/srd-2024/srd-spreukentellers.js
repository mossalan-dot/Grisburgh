#!/usr/bin/env node
// Hoeveel cantrips ken je, en hoeveel spreuken mag je voorbereiden — per klasse
// per level. Die tabellen stonden nergens in de app: `progression.json` heeft
// alleen features, en hun tekst verwijst naar "the Cantrips column of the
// Wizard Features table" — een kolom die wij niet hadden. Het level-upvenster
// kon dus niet zeggen of je er spreuken bij kreeg.
//
// Bron: 5e-bits/5e-database, SRD 5.2 (CC BY 4.0) — dezelfde bron als
// srd-monsters.js en srd-featureteksten.js. Bewust ophalen en niet overtikken:
// een tabel van 12 klassen × 20 levels tik je niet foutloos over, en één
// verkeerde cel vertelt een speler dat hij 17 spreuken mag voorbereiden waar
// het er 18 zijn.
//
//   node scripts/srd-2024/srd-spreukentellers.js            (proefronde)
//   node scripts/srd-2024/srd-spreukentellers.js --schrijf
const fs   = require('fs');
const path = require('path');

const BRON = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Levels.json';
const UIT  = path.join(__dirname, '..', '..', 'bronnen', 'srd-spreukentellers.json');

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const rijen = await fetch(BRON).then(r => {
    if (!r.ok) throw new Error(`${BRON} gaf ${r.status}`);
    return r.json();
  });

  const uit = {};
  for (const rij of rijen) {
    // Subklasse-rijen dragen dezelfde level-informatie; die zouden de klasse
    // overschrijven met dezelfde getallen. Alleen de kale klasserijen dus.
    if (rij.subclass) continue;
    const klasse = rij.class?.name;
    const sc = rij.spellcasting;
    if (!klasse || !sc) continue;
    const c = sc.cantrips_known, p = sc.prepared_spells;
    if (c == null && p == null) continue;
    (uit[klasse] = uit[klasse] || {})[rij.level] = {
      ...(c != null ? { cantrips: c } : {}),
      ...(p != null ? { voorbereid: p } : {}),
    };
  }

  for (const [k, levels] of Object.entries(uit)) {
    const l = Object.keys(levels).map(Number).sort((a, b) => a - b);
    const eerste = levels[l[0]], laatste = levels[l[l.length - 1]];
    console.log(`  ${k.padEnd(10)} level ${l[0]}–${l[l.length - 1]}  ` +
      `cantrips ${eerste.cantrips ?? '—'}→${laatste.cantrips ?? '—'}  ` +
      `voorbereid ${eerste.voorbereid ?? '—'}→${laatste.voorbereid ?? '—'}`);
  }
  console.log(`\n${Object.keys(uit).length} klassen met spreukentellers.`);

  if (!schrijf) { console.log('Proefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(UIT, JSON.stringify(uit, null, 2) + '\n');
  console.log(`Geschreven: ${path.relative(process.cwd(), UIT)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
