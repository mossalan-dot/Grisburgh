#!/usr/bin/env node
// Welke spreukteksten mogen we wél weggeven?
//
// De teksten in `bronnen/spells-2024.json` komen deels uit de PHB 2024 en zijn
// auteursrechtelijk beschermd; daarom krijgt een campagne zonder
// `meta.bronTeksten` alleen structuur. Maar de **System Reference Document 5.2**
// staat onder CC BY 4.0, en die dekt tweederde van de lijst. Die teksten mogen
// we dus wél tonen, mits we de bron vermelden.
//
// Dit script haalt de SRD 5.2-spreuken op bij Open5e (document `srd-2024`) en
// legt ze naast onze lijst. Uitvoer: `bronnen/srd-spells.json` —
// { "<onze index>": { name, desc: [], higher_level: [] } }.
//
// Matchen gaat op naam, met twee correcties: de SRD laat de ontwerpersnaam vaak
// weg ("Tiny Hut" waar de PHB "Leomund's Tiny Hut" zegt), en drie spreuken zijn
// écht hernoemd — die staan in `SRD_HERNOEMD` (scripts/srd-2024/srd-namen.js).
//
//   node scripts/srd-2024/srd-spelteksten.js [--schrijf]
const fs   = require('fs');
const path = require('path');

const API = 'https://api.open5e.com/v2/spells/?document__key=srd-2024&limit=500';
const BRON = path.join(__dirname, '..', '..', 'bronnen', 'spells-2024.json');
const DOEL = path.join(__dirname, '..', '..', 'bronnen', 'srd-spells.json');

const { SRD_HERNOEMD } = require('./srd-namen');

const sleutel = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const zonderOntwerper = (n) => String(n || '').replace(/^[A-Za-z]+[’']s\s+/, '');

// De SRD-tekst is één blok met lege regels ertussen; onze vorm is een lijst
// alinea's. Tabellen en opsommingen blijven zoals ze zijn — mdBlok en
// renderSpellDesc kunnen daarmee overweg.
const alinea = (t) => String(t || '').split(/\n\s*\n/).map(r => r.trim()).filter(Boolean);

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const d = await fetch(API).then(r => r.json());
  const srd = d.results || [];
  const opNaam = new Map();
  for (const s of srd) {
    opNaam.set(sleutel(s.name), s);
    // Hernoemd: leg hem óók onder de naam die de PHB (en onze lijst) gebruikt.
    if (SRD_HERNOEMD[s.name]) opNaam.set(sleutel(SRD_HERNOEMD[s.name]), s);
  }

  const bron = JSON.parse(fs.readFileSync(BRON, 'utf8'));
  // Zelfde zeef als de app: regels zonder school zijn geen spreuk maar een
  // magisch voorwerp dat in deze lijst terecht is gekomen.
  const school = (s) => String(s?.school?.name || (typeof s?.school === 'string' ? s.school : '') || '').trim();
  const onze = (bron.results || []).filter(school);

  const uit = {};
  const zonder = [];
  for (const s of onze) {
    const t = opNaam.get(sleutel(s.name)) || opNaam.get(sleutel(zonderOntwerper(s.name)));
    if (!t) { zonder.push(s.name); continue; }
    uit[s.index] = {
      name: s.name,
      desc: alinea(t.desc),
      higher_level: alinea(t.higher_level),
    };
  }

  const onzeSleutels = new Set(onze.flatMap(s => [sleutel(s.name), sleutel(zonderOntwerper(s.name))]));
  // De hernoemde drie zitten er wél in, onder hun PHB-naam; die zijn geen gemis.
  const gemist = srd
    .filter(s => !onzeSleutels.has(sleutel(s.name)) && !onzeSleutels.has(sleutel(SRD_HERNOEMD[s.name] || '')))
    .map(s => s.name);

  console.log(`SRD 5.2: ${srd.length} spreuken · onze lijst: ${onze.length}`);
  console.log(`Met SRD-tekst: ${Object.keys(uit).length} (${Math.round(Object.keys(uit).length / onze.length * 100)}%)`);
  console.log(`Zonder: ${zonder.length}`);
  if (gemist.length) console.log(`In de SRD maar niet in onze lijst (${gemist.length}): ${gemist.join(', ')}`);

  if (schrijf) {
    fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1) + '\n');
    console.log(`Geschreven: ${path.relative(process.cwd(), DOEL)}`);
  } else {
    console.log('Proefdraai — geef --schrijf om het bestand te maken.');
  }
})();
