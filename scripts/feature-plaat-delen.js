#!/usr/bin/env node
// **Eén feature, elf plekken, één plaat.**
//
// Twintig featurenamen staan in Grisburgh bij meer dan één houder, en bij de
// grote vier is dat geen toeval maar de regel: Ability Score Improvement (58
// regels), Epic Boon (13), Extra Attack (11) en Spellcasting (11) zijn
// letterlijk dezelfde feature die elke class apart in zijn lijst heeft staan.
// Dat hóórt zo in de progressie — de tijdlijn van een Bard moet Spellcasting
// op level 1 tonen — maar een plaat die je voor zo'n feature kiest hoort dan
// overal te gelden. Nu hangt hij aan één regel: de Artificer kreeg er een, en
// de tien andere Spellcastings vallen terug op het portret van hun class.
//
// Dit script kopieert `img` en `imgFocus` naar de naamgenoten die er **geen**
// hebben. Het overschrijft nooit: heeft een regel zijn eigen plaat, dan is dat
// een keuze. Staan er twee verschillende platen onder één naam, dan meldt hij
// dat en doet hij niets — welke van de twee geldt is niet aan een script.
//
//   node scripts/feature-plaat-delen.js <campagne>
//   node scripts/feature-plaat-delen.js <campagne> --naam "Spellcasting"
//   node scripts/feature-plaat-delen.js <campagne> --schrijf
const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const campagne = args.find(a => !a.startsWith('--'));
const schrijf  = args.includes('--schrijf');
const alleen   = (() => { const i = args.indexOf('--naam'); return i >= 0 ? args[i + 1] : null; })();
if (!campagne) { console.error('Geef een campagne op.'); process.exit(1); }

const WORTEL = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const PAD    = path.join(WORTEL, 'campaigns', campagne, 'progression.json');
if (!fs.existsSync(PAD)) { console.error(`Niet gevonden: ${PAD}`); process.exit(1); }

const prog = JSON.parse(fs.readFileSync(PAD, 'utf8'));

// Elke featureregel met waar hij staat. Species en backgrounds doen mee: een
// trait kan net zo goed bij twee volken dezelfde naam dragen.
const regels = [];
const pak = (f, waar, houder) => { if (f?.name) regels.push({ f, waar, houder }); };
for (const [cn, d] of Object.entries(prog.classes || {})) {
  for (const [lv, fs2] of Object.entries(d.levels || {})) for (const f of fs2) pak(f, `${cn} lv${lv}`, cn);
  for (const [sn, sd] of Object.entries(d.subclasses || {})) {
    for (const [lv, fs2] of Object.entries(sd.levels || {})) for (const f of fs2) pak(f, `${cn}/${sn} lv${lv}`, `${cn}/${sn}`);
  }
}
for (const [n, d] of Object.entries(prog.species || {})) {
  for (const [lv, fs2] of Object.entries(d.levels || {})) for (const f of fs2) pak(f, `${n} lv${lv}`, n);
}

const perNaam = new Map();
for (const r of regels) {
  if (alleen && r.f.name !== alleen) continue;
  if (!perNaam.has(r.f.name)) perNaam.set(r.f.name, []);
  perNaam.get(r.f.name).push(r);
}

const gedeeld = [], botst = [], geenPlaat = [];
for (const [naam, lijst] of perNaam) {
  // Eén houder is geen gedeelde feature; dan is de plaat van die ene regel.
  if (new Set(lijst.map(r => r.houder)).size < 2) continue;
  const metPlaat = lijst.filter(r => String(r.f.img || '').trim());
  const platen = [...new Set(metPlaat.map(r => r.f.img))];
  if (!platen.length) { geenPlaat.push([naam, lijst.length]); continue; }
  if (platen.length > 1) {
    botst.push([naam, metPlaat.map(r => `${r.waar} → ${r.f.img}`)]);
    continue;
  }
  const bron = metPlaat[0];
  const krijgen = lijst.filter(r => !String(r.f.img || '').trim());
  if (!krijgen.length) continue;
  for (const r of krijgen) {
    r.f._nieuweImg = bron.f.img;
    if (bron.f.imgFocus) r.f._nieuweFocus = bron.f.imgFocus;
  }
  gedeeld.push([naam, bron.waar, krijgen.map(r => r.waar)]);
}

console.log(`\n${campagne}${alleen ? ` · alleen "${alleen}"` : ''}\n`);
if (gedeeld.length) {
  console.log('── de plaat gaat mee ──');
  for (const [naam, van, naar] of gedeeld) {
    console.log(`  ${naam} (van ${van}) → ${naar.length} plek${naar.length === 1 ? '' : 'ken'}`);
    console.log(`     ${naar.join(', ')}`);
  }
}
if (botst.length) {
  console.log('\n── twee verschillende platen onder één naam, dus niets gedaan ──');
  for (const [naam, waar] of botst) console.log(`  ${naam}: ${waar.join(' · ')}`);
}
if (geenPlaat.length && !alleen) {
  console.log(`\n── gedeelde features zónder plaat (${geenPlaat.length}) ──`);
  console.log('  ' + geenPlaat.sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${c}×)`).join(', '));
}

const totaal = gedeeld.reduce((t, g) => t + g[2].length, 0);
if (!schrijf) { console.log(`\n${totaal} regels zouden een plaat krijgen. Proefronde — draai opnieuw met --schrijf.`); process.exit(0); }
if (!totaal)  { console.log('\nNiets te doen.'); process.exit(0); }

for (const r of regels) {
  if (r.f._nieuweImg)   { r.f.img = r.f._nieuweImg; delete r.f._nieuweImg; }
  if (r.f._nieuweFocus) { r.f.imgFocus = r.f._nieuweFocus; delete r.f._nieuweFocus; }
}
const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
fs.copyFileSync(PAD, PAD.replace(/\.json$/, `.voor-plaatdelen.${stempel}.json`));
fs.writeFileSync(PAD, JSON.stringify(prog, null, 2));
console.log(`\nGeschreven: ${totaal} regels. Kopie ernaast gezet.`);
