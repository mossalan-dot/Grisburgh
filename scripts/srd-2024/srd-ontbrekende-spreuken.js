#!/usr/bin/env node
// Acht spreuken uit de SRD 5.2 ontbraken in `bronnen/spells-2024.json`. Ze staan
// onder CC BY 4.0, dus we mogen ze compleet toevoegen — inhoud die er gratis bij
// kan, voor elke campagne.
//
// Let op: de SRD hernoemt drie spreuken waarvan de PHB de ontwerpersnaam voert
// ("Arcane Hand" is Bigby's Hand). Die staan dus al in onze lijst en zijn geen
// aanwinst maar een dubbeling — `SRD_HERNOEMD` (gedeeld met srd-spelteksten.js)
// houdt ze buiten de deur.
//
//   node scripts/srd-2024/srd-ontbrekende-spreuken.js [--schrijf]
const fs   = require('fs');
const path = require('path');

const API  = 'https://api.open5e.com/v2/spells/?document__key=srd-2024&limit=500';
const BRON = path.join(__dirname, '..', '..', 'bronnen', 'spells-2024.json');

const { SRD_HERNOEMD } = require('./srd-namen');

const sleutel  = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const zonderOntwerper = (n) => String(n || '').replace(/^[A-Za-z]+[’']s\s+/, '');
const slug     = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const alinea   = (t) => String(t || '').split(/\n\s*\n/).map(r => r.trim()).filter(Boolean);
// Open5e schrijft "action" en "bonus-action" klein en met een streepje; onze
// lijst schrijft "Action" en "Bonus Action". Een tijd als "1 minute" blijft.
const castTijd = (t) => String(t || '').replace(/-/g, ' ').replace(/\b[a-z]/g, c => c.toUpperCase());
// Alleen de eerste letter: "instantaneous" → "Instantaneous", "10 minutes" blijft.
const eersteHoofd = (t) => { const v = String(t || ''); return v ? v[0].toUpperCase() + v.slice(1) : v; };

function naarOnzeVorm(s) {
  const comps = [s.verbal && 'V', s.somatic && 'S', s.material && 'M'].filter(Boolean);
  const uit = {
    index: slug(s.name),
    name:  s.name,
    level: s.level,
    school: { name: s.school?.name || '' },
    classes: (s.classes || []).map(c => ({ name: c.name })),
    casting_time: /^\d/.test(s.casting_time || '') ? s.casting_time : castTijd(s.casting_time),
    range: s.range_text || '',
    components: comps,
    material: s.material_specified || '',
    ritual: !!s.ritual,
    duration: eersteHoofd(s.duration),
    concentration: !!s.concentration,
    desc: alinea(s.desc),
    higher_level: alinea(s.higher_level),
    source: 'srd-2024',
  };
  const schade = [s.damage_roll, (s.damage_types || [])[0]].filter(Boolean).join(' ');
  if (schade) uit.damage = schade;
  return uit;
}

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const srd  = (await fetch(API).then(r => r.json())).results || [];
  const bron = JSON.parse(fs.readFileSync(BRON, 'utf8'));

  const school = (s) => String(s?.school?.name || (typeof s?.school === 'string' ? s.school : '') || '').trim();
  const bestaand = new Set((bron.results || []).filter(school)
    .flatMap(s => [sleutel(s.name), sleutel(zonderOntwerper(s.name))]));

  const nieuw = srd
    .filter(s => !bestaand.has(sleutel(s.name)) && !bestaand.has(sleutel(SRD_HERNOEMD[s.name] || '')))
    .map(naarOnzeVorm);
  console.log(`Ontbrekend: ${nieuw.length}`);
  for (const s of nieuw) {
    console.log(` · ${s.name} — level ${s.level} ${s.school.name}, `
      + `${s.classes.map(c => c.name).join('/') || 'geen class'}, ${s.desc.join(' ').length} tekens`);
  }

  if (!schrijf) { console.log('Proefdraai — geef --schrijf om ze toe te voegen.'); return; }
  bron.results = [...(bron.results || []), ...nieuw]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'en'));
  fs.writeFileSync(BRON, JSON.stringify(bron, null, 1) + '\n');
  console.log(`Toegevoegd aan ${path.relative(process.cwd(), BRON)} (nu ${bron.results.length} regels).`);
  console.log('Draai daarna scripts/srd-2024/srd-spelteksten.js --schrijf opnieuw.');
})();
