#!/usr/bin/env node
// **Staat er een boek bij, dan is het overgenomen.**
//
// `herkomst` en `bron` zijn twee velden die hetzelfde moment beschrijven: het
// eerste zegt óf iets uit andermans materiaal komt, het tweede waaruit. In de
// praktijk is het tweede ingevuld en het eerste niet — de importscripts zetten
// de boektitel er wel bij, maar niet de herkomst, en met de hand is het een
// vinkje dat je vergeet.
//
// Dat is niet alleen slordig. `herkomst` is het enige veld waaraan je later
// kunt zien wat je **niet** mag meenemen naar een andere campagne; een lijst
// die driekwart van de gevallen mist, kun je daar niet op vertrouwen.
//
// Dit script vult alleen wat **leeg** is, en alleen waar een boektitel staat.
// Wat de DM zelf op `zelfbedacht` of `aangepast` zette blijft staan — ook als
// er een boek bij staat; dat is dan een aantekening waar het vandaan geleend
// is, en die beslissing is aan hem.
//
//   node scripts/herkomst-uit-boek.js <campagne>
//   node scripts/herkomst-uit-boek.js <campagne> --schrijf
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Geef een campagne op.'); process.exit(1); }

const WORTEL = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const PAD    = path.join(WORTEL, 'campaigns', campagne, 'progression.json');
const SPELLS = path.join(WORTEL, 'campaigns', campagne, 'spells.json');
if (!fs.existsSync(PAD)) { console.error(`Niet gevonden: ${PAD}`); process.exit(1); }

const prog = JSON.parse(fs.readFileSync(PAD, 'utf8'));

let gezet = 0, alGoed = 0, eigen = 0;
const perBoek = new Map();

// Een feature draagt de boektitel in `bron` (de class staat elders), een houder
// in `boek`. Twee namen voor hetzelfde ding, maar ze zitten op verschillende
// lagen en hernoemen kost een migratie die niets oplevert.
function kijk(obj, veld) {
  if (!obj) return;
  const boek = String(obj[veld] || '').trim();
  if (!boek) return;
  if (obj.herkomst === 'overgenomen') { alGoed++; return; }
  if (obj.herkomst) { eigen++; return; }   // zelfbedacht of aangepast: niet aankomen
  perBoek.set(boek, (perBoek.get(boek) || 0) + 1);
  gezet++;
  if (schrijf) obj.herkomst = 'overgenomen';
}

const regels = (arr) => { for (const f of (arr || [])) kijk(f, 'bron'); };
const houder = (h) => { kijk(h, 'boek'); for (const a of Object.values(h?.levels || {})) regels(a); };

for (const c of Object.values(prog.classes || {})) {
  houder(c);
  for (const sc of Object.values(c.subclasses || {})) houder(sc);
}
for (const v of Object.values(prog.species || {})) {
  houder(v);
  for (const vd of Object.values(v.varianten || {})) houder(vd);
}
for (const b of Object.values(prog.backgrounds || {})) houder(b);
regels(prog.feats?.general);
regels(prog.feats?.epic);

for (const [boek, n] of [...perBoek.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${boek}`);
}
console.log(`\n${gezet} krijgen "overgenomen" · ${alGoed} stond al goed · ${eigen} staat op zelfbedacht of aangepast en blijft zo`);

// De eigen spreuken van de campagne dragen hetzelfde paar velden (`source` en
// `herkomst`), dus die gaan in dezelfde ronde mee.
let spreuken = null, spreukGezet = 0;
if (fs.existsSync(SPELLS)) {
  spreuken = JSON.parse(fs.readFileSync(SPELLS, 'utf8'));
  for (const sp of (spreuken.eigenSpreuken || [])) {
    if (!String(sp.source || '').trim() || sp.herkomst) continue;
    spreukGezet++;
    if (schrijf) sp.herkomst = 'overgenomen';
  }
  if (spreukGezet) console.log(`${spreukGezet} eigen spreuken met een bron krijgen hem ook`);
}

if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); process.exit(0); }
if (!gezet && !spreukGezet) { console.log('Niets te doen.'); process.exit(0); }

const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
if (gezet) {
  fs.copyFileSync(PAD, PAD.replace(/\.json$/, `.voor-herkomst.${stempel}.json`));
  fs.writeFileSync(PAD, JSON.stringify(prog, null, 2));
}
if (spreukGezet) {
  fs.copyFileSync(SPELLS, SPELLS.replace(/\.json$/, `.voor-herkomst.${stempel}.json`));
  fs.writeFileSync(SPELLS, JSON.stringify(spreuken, null, 2));
}
console.log(`\nGeschreven. Kopie ernaast gezet.`);
