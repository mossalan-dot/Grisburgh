#!/usr/bin/env node
// **Twee lege velden op de feats, en ze zijn niet even leeg.**
//
// `categorie` zegt wát voor feat het is (Origin, General, Fighting Style, Epic
// Boon). In Grisburgh stond hij bij 198 van de 251 leeg, en sinds elke soort
// zijn eigen kleur heeft is dat zichtbaar: een raster van blauwe kaartjes
// waarin je het verschil niet ziet. **General is de verstandige standaard** —
// het is verreweg de grootste groep — en de DM corrigeert wat eruit valt. Twee
// correcties doet dit script zelf, want die staan in de data en hoeven niet
// geraden te worden: wat in de `epic`-bak staat is een Epic Boon, en wat een
// Fighting Style als eis heeft is er een.
//
// `sluitAan` ("hoort bij") zegt bij welke classes een feat past. Dat is **geen
// feit maar een oordeel**, en daarom vult dit script het alleen in waar het
// uit de campagne zelf volgt:
//
//   1. de eis noemt een spellcasting- of pact magic-feature → elke class die
//      in déze campagne een Spellcasting- of Pact Magic-feature heeft;
//   2. de eis noemt een Fighting Style → elke class die in deze campagne een
//      Fighting Style-feature heeft;
//   3. de eis noemt een class bij naam ("Fighter 1 of Paladin 1") → die;
//   4. de feat geeft een spreuk → de classes op wiens lijst die spreuk staat.
//
// Wat daar niet onder valt blijft leeg. Een verkeerde koppeling zet een feat
// bij een class die hem niet kan nemen, en dat merk je pas aan tafel — zelfde
// afweging als in `bronnen/feat-koppelingen.json` zelf staat.
//
//   node scripts/feat-velden-vullen.js <campagne>
//   node scripts/feat-velden-vullen.js <campagne> --schrijf
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Geef een campagne op.'); process.exit(1); }

const WORTEL = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const PAD    = path.join(WORTEL, 'campaigns', campagne, 'progression.json');
if (!fs.existsSync(PAD)) { console.error(`Niet gevonden: ${PAD}`); process.exit(1); }

const prog = JSON.parse(fs.readFileSync(PAD, 'utf8'));
const classes = Object.keys(prog.classes || {});

// ── Welke classes hebben wát? Uit de campagne, niet uit het boek ────────────
// **Alleen de eigen levels van de class, niet die van zijn subclasses.** Een
// Eldritch Knight heeft een Spellcasting-feature en voldoet dus aan de eis —
// maar als je die meetelt casten er dertien van de veertien classes, en dan is
// "hoort bij" geen antwoord meer op de vraag bij welke class een feat past.
// Hetzelfde bij de Fighting Styles: het College of Swords heeft er een, de
// Bard als geheel niet.
const featuresVan = (naam) => Object.values(prog.classes?.[naam]?.levels || {}).flat().filter(Boolean);
const heeft = (naam, re) => featuresVan(naam).some(f => re.test(String(f.name || '')));

const CASTERS  = classes.filter(c => heeft(c, /^(spellcasting|pact magic)$/i));
const STYLERS  = classes.filter(c => heeft(c, /^fighting style$/i));

// Op wiens spreuklijst staat deze spreuk? Uit de meegeleverde bron; een
// spreuknaam is eenduidig, dus hier valt niets te raden.
let SPREUKEN = new Map();
try {
  const bron = require('../lib/bronnen').lees('spells-2024');
  const lijst = bron?.results || bron?.spells || (Array.isArray(bron) ? bron : []);
  for (const sp of lijst) {
    SPREUKEN.set(String(sp.name).toLowerCase(),
      (sp.classes || []).map(c => c?.name || c).filter(Boolean));
  }
} catch { /* geen spreukenbron: dan vervalt regel 4 */ }

// ── De twee velden ──────────────────────────────────────────────────────────
function categorieVoor(f, epic) {
  if (epic) return 'Epic Boon';
  if (/fighting style/i.test(String(f.vereist || ''))) return 'Fighting Style';
  return 'General';
}

function sluitAanVoor(f) {
  const eis = String(f.vereist || '');
  const uit = new Set();
  let waarom = [];

  if (/spellcasting|pact magic/i.test(eis) && CASTERS.length) {
    for (const c of CASTERS) uit.add(c);
    waarom.push('een castende class');
  }
  if (/fighting style/i.test(eis) && STYLERS.length) {
    for (const c of STYLERS) uit.add(c);
    waarom.push('een Fighting Style');
  }
  // Een class bij naam in de eis. Op woordgrens, anders vangt "Fighter" ook
  // "Fighter 1 of Paladin 1" half en "Monk" het woord "Monkey".
  for (const c of classes) {
    if (new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(eis)) {
      uit.add(c);
      waarom.push(`bij naam genoemd (${c})`);
    }
  }
  for (const naam of (f.geeftSpreuk || [])) {
    for (const c of (SPREUKEN.get(String(naam).toLowerCase()) || [])) {
      if (classes.includes(c)) { uit.add(c); waarom.push(`${naam} staat op zijn lijst`); }
    }
  }
  return { lijst: [...uit].sort(), waarom: [...new Set(waarom)] };
}

// ── Doorlopen ───────────────────────────────────────────────────────────────
const rapport = { categorie: {}, sluitAan: [], overgeslagen: 0 };
let gedaanCat = 0, gedaanSluit = 0;

for (const [bak, epic] of [['general', false], ['epic', true]]) {
  for (const f of (prog.feats?.[bak] || [])) {
    if (!f?.name) continue;
    if (!f.categorie) {
      const cat = categorieVoor(f, epic);
      f._nieuweCategorie = cat;
      rapport.categorie[cat] = (rapport.categorie[cat] || 0) + 1;
      gedaanCat++;
    }
    if (!(f.sluitAan || []).length) {
      const { lijst, waarom } = sluitAanVoor(f);
      if (lijst.length) {
        f._nieuweSluitAan = lijst;
        rapport.sluitAan.push([f.name, lijst.join(', '), waarom.join(' · ')]);
        gedaanSluit++;
      } else {
        rapport.overgeslagen++;
      }
    }
  }
}

console.log(`\n${campagne}: ${(prog.feats?.general || []).length} feats en ${(prog.feats?.epic || []).length} Epic Boons\n`);
console.log('Classes die in deze campagne casten:', CASTERS.join(', ') || '(geen)');
console.log('Classes met een Fighting Style:    ', STYLERS.join(', ') || '(geen)');

console.log(`\n── categorie ── ${gedaanCat} lege velden`);
for (const [cat, n] of Object.entries(rapport.categorie).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${cat}`);
}

console.log(`\n── hoort bij ── ${gedaanSluit} af te leiden, ${rapport.overgeslagen} blijven leeg`);
for (const [naam, lijst, waarom] of rapport.sluitAan.slice(0, 40)) {
  console.log(`  ${naam.padEnd(34)} ${lijst.length > 60 ? lijst.slice(0, 57) + '…' : lijst}`);
  console.log(`  ${' '.repeat(34)} ${waarom}`);
}
if (rapport.sluitAan.length > 40) console.log(`  … en nog ${rapport.sluitAan.length - 40}`);

if (!schrijf) {
  console.log('\nProefronde — draai opnieuw met --schrijf.');
  process.exit(0);
}

for (const bak of ['general', 'epic']) {
  for (const f of (prog.feats?.[bak] || [])) {
    if (f._nieuweCategorie) { f.categorie = f._nieuweCategorie; delete f._nieuweCategorie; }
    if (f._nieuweSluitAan)  { f.sluitAan  = f._nieuweSluitAan;  delete f._nieuweSluitAan; }
  }
}

const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
fs.copyFileSync(PAD, PAD.replace(/\.json$/, `.voor-featvelden.${stempel}.json`));
fs.writeFileSync(PAD, JSON.stringify(prog, null, 2));
console.log(`\nGeschreven: ${gedaanCat} categorieën en ${gedaanSluit} koppelingen. Kopie ernaast gezet.`);
