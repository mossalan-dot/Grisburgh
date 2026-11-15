#!/usr/bin/env node
// Een kaartje per gereedschap, uit de meegeleverde itemlijst.
//
// **Waarom dit bestaat.** De personagemaker laat je bij een background kiezen
// welk gereedschap je krijgt — "choose one kind of Artisan's Tools" — en die
// keuze komt uit `bronnen/srd-items.json`. Maar dat is een naam en verder
// niets: geen kaartje, geen afbeelding, geen prijs die de winkel kent. In de
// boedel van een speler staat dan een regel zonder gezicht, terwijl elk ander
// voorwerp er wel een heeft.
//
// Dit maakt die kaartjes aan: naam, type, prijs, gewicht en de tekst uit de
// SRD. **Een afbeelding niet** — die hangt de DM er zelf aan; dit script zet
// alleen de haak waar hij hem aan kan hangen.
//
// Wat er al staat blijft staan: een kaartje met dezelfde naam wordt
// overgeslagen, dus twee keer draaien kan geen kwaad.
//
//   node scripts/gereedschap-kaartjes.js <campagne>            (proefronde)
//   node scripts/gereedschap-kaartjes.js <campagne> --schrijf
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Geef een campagne op.'); process.exit(1); }

const WORTEL = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const PAD    = path.join(WORTEL, 'campaigns', campagne, 'entities.json');
const ITEMS  = path.join(__dirname, '..', 'bronnen', 'srd-items.json');
if (!fs.existsSync(PAD)) { console.error(`Niet gevonden: ${PAD}`); process.exit(1); }

// De bron noemt dezelfde tools twee keer: met en zonder prijs achter de naam,
// en soms met een kleine letter ("Smith's tools" naast "Smith's Tools"). We
// willen er één, en dan die zoals de Player's Handbook hem afdrukt — dus de
// variant waarvan het láátste woord met een hoofdletter begint.
const kaal = (n) => String(n || '').replace(/\s*\(\d+[^)]*\)\s*$/, '').trim();
const netjes = (n) => /(^|\s)[a-z]\w*$/.test(n) ? 0 : 1;

// Welk type hoort erbij? De app kent er drie, en de naam zegt welke.
function typeVan(naam) {
  if (/^gaming set/i.test(naam)) return 'Gaming Set';
  if (/^musical instrument/i.test(naam)) return 'Musical instrument';
  return 'Tools';
}

// "Gaming Set, Dice" leest als een rij in een tabel. Op een kaartje wil je de
// naam van het ding: "Dice Set", "Lute".
function toonNaam(naam) {
  const m = naam.match(/^(Gaming Set|Musical Instrument),\s*(.+)$/i);
  if (!m) return naam;
  return /^gaming set$/i.test(m[1]) ? `${m[2]} Set` : m[2];
}

const bron  = JSON.parse(fs.readFileSync(ITEMS, 'utf8'));
const opNaam = new Map();
for (const it of (bron.items || [])) {
  const n = kaal(it?.name);
  if (!/(tools|supplies|kit)$|^gaming set|^musical instrument/i.test(n)) continue;
  const sleutel = n.toLowerCase();
  const beter = !opNaam.has(sleutel) || netjes(n) > netjes(opNaam.get(sleutel).name);
  if (beter) opNaam.set(sleutel, { ...it, name: n });
}
const lijst = [...opNaam.values()].sort((a, b) => a.name.localeCompare(b.name));

const data = JSON.parse(fs.readFileSync(PAD, 'utf8'));
data.voorwerpen = data.voorwerpen || [];
const bestaat = new Set(data.voorwerpen.map(v => String(v.name || '').toLowerCase()));

const nieuw = [];
for (const it of lijst) {
  const naam = toonNaam(it.name);
  if (bestaat.has(naam.toLowerCase())) continue;
  nieuw.push({
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: naam,
    // Verborgen: een kaartje bestaat pas voor een party als de DM het toont.
    // Gereedschap hoort bij de wereld, maar wannéér ze het zien is aan hem.
    visibility: 'hidden',
    data: {
      itemType: typeVan(it.name),
      prijs: it.prijs || '',
      gewicht: it.gewicht || '',
      // De SRD-tekst staat onder CC BY 4.0 en mag mee; de rest van het
      // kaartje (sfeer, geheimen) is aan de DM.
      desc: String(it.desc || '').replace(/\\n/g, '\n').replace(/\r/g, '').trim(),
      gebruik: 'stapelbaar',
      imgFocus: '50% 50%',
    },
  });
  bestaat.add(naam.toLowerCase());
}

for (const n of nieuw) console.log(`  + ${n.name.padEnd(28)} ${n.data.itemType.padEnd(18)} ${n.data.prijs}`);
console.log(`\n${lijst.length} gereedschappen in de bron, ${nieuw.length} nieuw, ${lijst.length - nieuw.length} stond er al.`);

if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); process.exit(0); }
if (!nieuw.length) { console.log('Niets te doen.'); process.exit(0); }

const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
fs.copyFileSync(PAD, PAD.replace(/\.json$/, `.voor-gereedschap.${stempel}.json`));
data.voorwerpen.push(...nieuw);
fs.writeFileSync(PAD, JSON.stringify(data, null, 2));
console.log(`\nGeschreven: ${nieuw.length} kaartjes erbij. Kopie ernaast gezet.`);
