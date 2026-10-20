#!/usr/bin/env node
// De voorraadlijst bijwerken aan de hand van een campagne die het **wél** goed
// heeft staan.
//
// `bronnen/features-elders.json` noemt per class en subclass de námen van hun
// features. Die lijst is laagje voor laagje gegroeid — met de hand, van een
// wiki die de druk van 2014 beschrijft — en dat zie je: een domein kreeg een
// Divine Strike die er in 2024 niet meer is, een college miste zijn Extra
// Attack. Wie een class helemaal heeft nagelopen in zijn eigen campagne heeft
// daarmee het betere antwoord, en dit script haalt dat op.
//
// **Alleen namen en levels.** De beschrijvingen blijven waar ze zijn: dat is
// tekst uit een boek en die hoort niet in meegeleverde bestanden. Precies
// daarom bestaat deze lijst.
//
// Met `--species` doet hij hetzelfde voor species en hun varianten. Daar zit
// één verschil: bij een class filteren we weg wat de tijdlijn zelf uitdeelt
// (Ability Score Improvement, Epic Boon), bij een species is er niets dat de
// app zelf uitdeelt — wat de DM erop zette is wat erop hoort.
//
//   node scripts/srd-2024/voorraad-uit-campagne.js <progressie.json> Druid Cleric …
//   node … --species <progressie.json> Bugbear Centaur …
//   node … --schrijf
const fs   = require('fs');
const path = require('path');

const UIT  = path.join(__dirname, '..', '..', 'bronnen', 'features-elders.json');
const SEED = path.join(__dirname, '..', '..', 'bronnen', 'class-progression.json');

// Wat de tijdlijn zelf uitdeelt is geen feature om op te zoeken.
const GEEN = /^(ability score improvement|epic boon)$/i;

const rijen = (houder, { alles = false } = {}) => Object.entries(houder?.levels || {})
  .flatMap(([lvl, fs_]) => (fs_ || []).map(f => ({ naam: String(f.name || '').trim(), level: Number(lvl) || 0 })))
  .filter(r => r.naam && (alles || !GEEN.test(r.naam)))
  .sort((a, b) => a.level - b.level || a.naam.localeCompare(b.naam));

const zelfde = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const vlag = (v) => process.argv.includes(v);
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const schrijf = vlag('--schrijf');
  const volken = vlag('--species');
  const [pad, ...klassen] = args;
  if (!pad || !klassen.length) {
    console.error('Geef het pad naar een progression.json en één of meer classes.');
    process.exit(1);
  }

  const campagne = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const features = JSON.parse(fs.readFileSync(UIT, 'utf8'));
  const seed     = JSON.parse(fs.readFileSync(SEED, 'utf8'));

  // Wat de app zélf met tekst meebrengt hoort hier niet: die namen staan al in
  // de seed, en de test bewaakt dat ze niet dubbelen.
  const metTekst = new Set();
  for (const [sp, d] of Object.entries(seed.species || {})) {
    if (Object.values(d.levels || {}).flat().length) metTekst.add('species:' + sp.toLowerCase());
  }
  for (const [kl, d] of Object.entries(seed.classes || {})) {
    if (Object.values(d.levels || {}).flat().length) metTekst.add('class:' + kl.toLowerCase());
    for (const [sub, sd] of Object.entries(d.subclasses || {})) {
      if (Object.values(sd.levels || {}).flat().length) metTekst.add('sub:' + sub.toLowerCase());
    }
  }

  const gewijzigd = [], nieuw = [], overgeslagen = [];
  const BAK = { class: 'classes', sub: 'subclasses', species: 'species', variant: 'varianten' };
  for (const klasse of klassen) {
    const c = volken ? campagne.species?.[klasse] : campagne.classes?.[klasse];
    if (!c) { overgeslagen.push(`${klasse} — staat niet in die campagne`); continue; }

    const zet = (soort, sleutel, houder, label) => {
      const lijst = rijen(houder, { alles: soort === 'species' || soort === 'variant' });
      if (!lijst.length) { overgeslagen.push(`${label} — niets ingevuld`); return; }
      if (metTekst.has(`${soort}:${sleutel.toLowerCase()}`)) {
        overgeslagen.push(`${label} — de app brengt hem zelf met tekst mee`);
        return;
      }
      const bak = features[BAK[soort]] = features[BAK[soort]] || {};
      const oud = bak[sleutel];
      if (!oud) { bak[sleutel] = lijst; nieuw.push(`${label}: ${lijst.length}`); return; }
      if (zelfde(oud, lijst)) return;
      const oudeNamen = oud.map(x => (x && typeof x === 'object') ? `${x.naam}@${x.level}` : String(x));
      const nieuweNamen = lijst.map(x => `${x.naam}@${x.level}`);
      bak[sleutel] = lijst;
      gewijzigd.push({ label,
        weg: oudeNamen.filter(n => !nieuweNamen.includes(n)),
        bij: nieuweNamen.filter(n => !oudeNamen.includes(n)) });
    };

    if (volken) {
      zet('species', klasse, c, klasse);
      // Een variant staat onder "Species|Variant", want twee species mogen
      // allebei een Lineage hebben die anders heet dan die van de ander.
      for (const [v, vd] of Object.entries(c.varianten || {})) zet('variant', `${klasse}|${v}`, vd, `${klasse} › ${v}`);
    } else {
      zet('class', klasse, c, klasse);
      for (const [sub, sd] of Object.entries(c.subclasses || {})) zet('sub', sub, sd, `${klasse} › ${sub}`);
    }
  }

  for (const g of gewijzigd) {
    console.log(`  ${g.label}`);
    if (g.weg.length) console.log(`      weg:   ${g.weg.join(', ')}`);
    if (g.bij.length) console.log(`      erbij: ${g.bij.join(', ')}`);
  }
  if (nieuw.length) console.log(`\nNieuw in de lijst:\n  ${nieuw.join('\n  ')}`);
  console.log(`\n${gewijzigd.length} bijgewerkt, ${nieuw.length} nieuw.`);
  if (overgeslagen.length) console.log(`\nOvergeslagen (${overgeslagen.length}):\n  ${overgeslagen.join('\n  ')}`);

  if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(UIT, JSON.stringify(features, null, 2) + '\n');
  console.log(`\nGeschreven: ${path.relative(process.cwd(), UIT)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
