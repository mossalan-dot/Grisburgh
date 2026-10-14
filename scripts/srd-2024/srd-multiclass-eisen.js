#!/usr/bin/env node
// De ability-eisen om in een klasse bij te beginnen, en wat je er dan aan
// training bij krijgt. Bewust opgehaald en niet overgetikt: het zijn twaalf
// regeltjes, maar drie ervan hebben een "of" of een "en" (Fighter, Monk,
// Paladin, Ranger) en juist dáár zit de fout in.
//
// Bron: 5e-bits/5e-database, SRD 5.2 (CC BY 4.0) — `multi_classing`.
//
//   node scripts/srd-2024/srd-multiclass-eisen.js            (proefronde)
//   node scripts/srd-2024/srd-multiclass-eisen.js --schrijf
const fs   = require('fs');
const path = require('path');

const BRON = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Classes.json';
const UIT  = path.join(__dirname, '..', '..', 'bronnen', 'srd-multiclass-eisen.json');

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const klassen = await fetch(BRON).then(r => {
    if (!r.ok) throw new Error(`${BRON} gaf ${r.status}`);
    return r.json();
  });

  const uit = {};
  for (const c of klassen) {
    const mc = c.multi_classing;
    if (!mc) continue;
    // `eisen` moeten allemaal waar zijn; van `keuze` is er één genoeg.
    const eisen = (mc.prerequisites || []).map(p => ({
      ability: p.ability_score.index, minimum: p.minimum_score,
    }));
    const keuze = (mc.prerequisite_options?.from?.options || []).map(o => ({
      ability: o.ability_score.index, minimum: o.minimum_score,
    }));
    // Wat je er bij het bijbeginnen aan training bij krijgt. Dat is iets
    // anders dan wat de class zelf geeft: een Fighter-bijbeginner krijgt geen
    // Simple Weapons, want die had je al of je krijgt ze hier niet.
    const training = (mc.proficiencies || []).map(p => p.name);
    // En soms mag je er nog iets bij kiezen (een skill, een instrument).
    const keuzeTraining = (mc.proficiency_choices || []).map(k => ({
      aantal: k.choose || 1,
      waaruit: (k.from?.options || []).map(o => o.item?.name || '').filter(Boolean),
    })).filter(k => k.waaruit.length);
    if (!eisen.length && !keuze.length) continue;
    uit[c.name] = { eisen, keuze, training, keuzeTraining };
  }

  const toon = (v) => [
    ...v.eisen.map(e => `${e.ability.toUpperCase()} ${e.minimum}`),
    ...(v.keuze.length ? [`(${v.keuze.map(e => `${e.ability.toUpperCase()} ${e.minimum}`).join(' of ')})`] : []),
  ].join(' en ');
  const toonT = (v) => [
    ...(v.training || []),
    ...(v.keuzeTraining || []).map(k => `${k.aantal} uit ${k.waaruit.length}`),
  ].join(', ') || '—';
  for (const [k, v] of Object.entries(uit)) console.log(`  ${k.padEnd(11)} ${toon(v).padEnd(32)} → ${toonT(v)}`);
  console.log(`\n${Object.keys(uit).length} klassen met een multiclass-eis.`);

  if (!schrijf) { console.log('Proefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(UIT, JSON.stringify(uit, null, 2) + '\n');
  console.log(`Geschreven: ${path.relative(process.cwd(), UIT)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
