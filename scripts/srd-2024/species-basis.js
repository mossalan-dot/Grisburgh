#!/usr/bin/env node
// De drie regels die boven élk species staan: **Creature Type, Size en Speed.**
//
// Ze stonden nergens. Een class heeft `bronnen/klasse-basis.json` met zijn hit
// die, saves en trainingen; een species had niets, terwijl het boek met precies
// deze drie regels begint. Dit bestand is hun tegenhanger — meegeleverd, en wat
// de campagne er zelf van maakt gaat eroverheen. Zo hoeft een DM ze niet
// negenenvijftig keer over te tikken, en profiteert hij wel van verbeteringen.
//
// Bron: `data/races.json` van de 5etools-spiegel, nieuwste druk wint — dezelfde
// als bij `species-namen.js`. Wat daar als veld staat (`size`, `speed`,
// `creatureTypes`) schrijven we uit zoals het boek het schrijft: "Small or
// Medium", "30 feet".
//
//   node scripts/srd-2024/species-basis.js            (proefronde)
//   node scripts/srd-2024/species-basis.js --schrijf
const fs   = require('fs');
const path = require('path');

const BRON   = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/races.json';
const UIT    = path.join(__dirname, '..', '..', 'bronnen', 'species-basis.json');
const SEED   = path.join(__dirname, '..', '..', 'bronnen', 'class-progression.json');
const VOLKEN = path.join(__dirname, '..', '..', 'bronnen', 'volken-klassen.json');

const JAAR = { PHB: 2014, DMG: 2014, SCAG: 2015, VGM: 2016, XGE: 2017, MTF: 2018, GGR: 2018,
  AI: 2019, ERLW: 2019, EGW: 2020, MOT: 2020, TCE: 2021, VRGR: 2021, FTD: 2021, SCC: 2021,
  MPMM: 2022, AAG: 2022, SatO: 2023, BMT: 2024, XPHB: 2024, FRHoF: 2025, EFA: 2025,
  RHW: 2026, AU: 2026 };

const MAAT = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan',
  V: 'Varies' };

// Het veld `creatureTypes` bestaat pas sinds de nieuwere drukken. Daarvóór
// staat hetzelfde als een gewone trait: "Creature Type — You are a Humanoid."
// Dat is de bron lezen, niet raden — en raden zou hier echt misgaan, want een
// Warforged is een Construct en een Satyr een Fey.
const typeUitTrait = (r) => {
  const t = (r.entries || []).find(e => /creature type/i.test(String(e?.name || '')));
  const tekst = JSON.stringify(t?.entries || '');
  const m = /You are an? ([A-Z][a-z]+)/.exec(tekst);
  return m ? m[1] : '';
};

// "Small or Medium" — zo staat het in het boek, en zo leest het op een kaartje.
const maatUit = (size) => (Array.isArray(size) ? size : [size]).filter(Boolean)
  .map(s => MAAT[s] || String(s)).join(' or ');

// Een getal is de loopsnelheid; een object noemt er meer (zwemmen, vliegen).
// Die horen erbij: een Giff die kan zwemmen is wat hem een Giff maakt.
const snelheidUit = (speed) => {
  if (speed == null) return '';
  if (typeof speed === 'number') return `${speed} feet`;
  const delen = [];
  const loop = typeof speed.walk === 'number' ? speed.walk : null;
  if (loop) delen.push(`${loop} feet`);
  for (const [soort, waarde] of Object.entries(speed)) {
    if (soort === 'walk') continue;
    if (waarde === true) delen.push(`${soort} ${loop || 30} feet`);
    else if (typeof waarde === 'number') delen.push(`${soort} ${waarde} feet`);
  }
  return delen.join(', ');
};

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const data   = await fetch(BRON).then(r => { if (!r.ok) throw new Error(`${BRON} gaf ${r.status}`); return r.json(); });
  const seed   = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  const volken = JSON.parse(fs.readFileSync(VOLKEN, 'utf8'));
  const alle = [...new Set([...Object.keys(seed.species || {}), ...(volken.volkenOverig || [])])].sort();

  const beste = new Map();
  for (const r of (data.race || [])) {
    const k = String(r.name).toLowerCase();
    if (!beste.has(k) || (JAAR[r.source] || 0) > (JAAR[beste.get(k).source] || 0)) beste.set(k, r);
  }

  const uit = {}, mist = [], zonderType = [];
  for (const naam of alle) {
    const r = beste.get(naam.toLowerCase());
    if (!r) { mist.push(naam); continue; }
    const rij = {};
    // Alleen wat er écht staat. Een species zonder creature type in zijn boek
    // krijgt er hier geen: "Humanoid" raden klopt voor de meeste, maar niet
    // voor een Warforged of een Satyr, en een verkeerd antwoord is erger dan
    // een leeg veld dat de DM zelf invult.
    if (Array.isArray(r.creatureTypes) && r.creatureTypes.length) {
      rij.creatureType = r.creatureTypes.map(t => String(t).replace(/^./, c => c.toUpperCase())).join(', ');
    } else {
      const uitTrait = typeUitTrait(r);
      if (uitTrait) rij.creatureType = uitTrait; else zonderType.push(naam);
    }
    const maat = maatUit(r.size);
    if (maat) rij.size = maat;
    const snel = snelheidUit(r.speed);
    if (snel) rij.speed = snel;
    if (Object.keys(rij).length) { rij._boek = r.source; uit[naam] = rij; }
  }

  for (const [naam, r] of Object.entries(uit)) {
    console.log(`  ${naam.padEnd(20)} ${(r.creatureType || '—').padEnd(12)} ${(r.size || '—').padEnd(18)} ${r.speed || '—'}   [${r._boek}]`);
  }
  console.log(`\n${Object.keys(uit).length} van de ${alle.length} species.`);
  if (zonderType.length) console.log(`Zonder creature type in hun boek (${zonderType.length}): ${zonderType.join(', ')}`);
  if (mist.length) console.log(`Niet in de spiegel (${mist.length}): ${mist.join(', ')}`);

  if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(UIT, JSON.stringify({
    _wat: 'Creature Type, Size en Speed per species — de drie regels waar het boek mee begint.',
    _bron: 'data/races.json van de 5etools-spiegel, nieuwste druk wint. Gemaakt met scripts/srd-2024/species-basis.js.',
    _let_op: 'Dit is de **bron**; wat een campagne zelf invult (species.<naam>.basis) gaat eroverheen. Zelfde afspraak als bij klasse-basis.json.',
    species: uit,
  }, null, 2) + '\n');
  console.log(`\nGeschreven: ${path.relative(process.cwd(), UIT)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
