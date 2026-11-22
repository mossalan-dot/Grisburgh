#!/usr/bin/env node
// **Simple of martial, op de wapenkaartjes die er al liggen.**
//
// Of een speler proficient is met een wapen leest de app van zijn blad
// ("Simple and martial weapons", "Daggers, darts, slings"). Dat matchen lukt
// alleen als het kaartje zegt wélke soort het is — en dat veld bestond niet.
// Sinds vandaag staat het in `bronnen/srd-items.json` (15 simple, 27 martial,
// uit de SRD 5.2) en in de voorwerp-editor; dit script zet het op de kaartjes
// die een campagne al heeft.
//
// Hij matcht **alleen op een exacte naam** uit de SRD-lijst. Een "Hengelrapier"
// of een "Schijtmes" blijft dus leeg: hoe die bij jouw tafel tellen weet de DM,
// en een gok zet een speler op een proficiency die hij niet heeft. Hetzelfde
// voor `mastery`, dat sinds dezelfde ronde los van de weaponProperties staat.
//
//   node scripts/wapensoort-vullen.js <campagne>
//   node scripts/wapensoort-vullen.js <campagne> --schrijf
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Geef een campagne op.'); process.exit(1); }

const WORTEL = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const PAD    = path.join(WORTEL, 'campaigns', campagne, 'entities.json');
if (!fs.existsSync(PAD)) { console.error(`Niet gevonden: ${PAD}`); process.exit(1); }

const srd = require('../bronnen/srd-items.json').items || [];
const bron = new Map();
for (const i of srd) if (i.itemType === 'Weapon') bron.set(i.name.toLowerCase(), i);

const ent = JSON.parse(fs.readFileSync(PAD, 'utf8'));
const wapens = (ent.voorwerpen || []).filter(i => i?.data?.itemType === 'Weapon');

const gedaan = [], over = [];
// Een magisch plusje in de naam verandert niets aan de soort: een "+1
// Battleaxe" is een Battleaxe. Dat is het enige wat het script zelf afpelt —
// "Rapier of Life Stealing" laat hij staan, want een naam die op een wapen
// lijkt is nog geen wapen van die soort.
const zoek = (naam) => {
  const n = String(naam || '').trim().toLowerCase();
  return bron.get(n) || bron.get(n.replace(/^\+\d\s*/, '').trim()) || null;
};

for (const w of wapens) {
  const b = zoek(w.name);
  if (!b) { over.push(w.name); continue; }
  // Alleen **lege** velden. Wat de DM zelf invulde is zijn tafel en blijft
  // staan — ook als het afwijkt van het boek, want dan is dat de bedoeling.
  const bij = [];
  const vul = (veld, waarde, label) => {
    if (!waarde || String(w.data[veld] ?? '').trim()) return;
    w.data[`_nieuw_${veld}`] = waarde;
    bij.push(label);
  };
  vul('wapenSoort', b.wapenSoort, b.wapenSoort);
  vul('mastery', b.mastery, `mastery ${b.mastery}`);
  vul('damage', b.damage, b.damage);
  // De eigenschappen staan op een kaartje als JSON-lijst, in de bron als
  // komma-regel. Dezelfde vorm aanhouden, anders leest de chip-picker hem niet.
  if (b.weaponProperties && !String(w.data.weaponProperties ?? '').trim()) {
    const lijst = b.weaponProperties.split(',').map(x => x.trim()).filter(Boolean);
    w.data._nieuw_weaponProperties = JSON.stringify(lijst);
    bij.push(lijst.join('/'));
  }
  if (bij.length) gedaan.push([w.name, bij.join(' · ')]);
}

console.log(`\n${campagne}: ${wapens.length} wapenkaartjes`);
console.log(`  ${gedaan.length} krijgen er iets bij, ${wapens.length - gedaan.length} niet\n`);
for (const [naam, wat] of gedaan) console.log(`  ${naam.padEnd(28)} ${wat}`);
if (over.length) console.log(`\nNiet in de SRD-lijst (blijven leeg, dat is aan de DM):\n  ${over.join(', ')}`);

if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); process.exit(0); }
if (!gedaan.length) { console.log('\nNiets te doen.'); process.exit(0); }

for (const w of wapens) {
  for (const sleutel of Object.keys(w.data)) {
    if (!sleutel.startsWith('_nieuw_')) continue;
    w.data[sleutel.slice(7)] = w.data[sleutel];
    delete w.data[sleutel];
  }
}
const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
fs.copyFileSync(PAD, PAD.replace(/\.json$/, `.voor-wapensoort.${stempel}.json`));
fs.writeFileSync(PAD, JSON.stringify(ent, null, 2));
console.log(`\nGeschreven: ${gedaan.length} kaartjes. Kopie ernaast gezet.`);
