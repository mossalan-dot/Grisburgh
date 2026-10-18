#!/usr/bin/env node
// De boeken waar materiaal uit kan komen. Het veld "Uit welk boek?" was vrij
// tekst — en dat moet het blijven, want je eigen wereld staat in geen enkel
// boek. Maar wie overneemt uit een boek tikt nu de titel over, elke keer
// opnieuw, en dan staat er de ene keer "Xanathars", de andere keer "XGtE" en
// de derde keer "Xanathar's Guide to Everything".
//
// Dus: dezelfde vrije regel, met een lijst eronder om uit te kiezen.
//
// Bron: de boekenlijst van 5e.tools (dezelfde die books.html toont), via de
// opensource-spiegel — 5e.tools zelf weigert een kale fetch.
//
//   node scripts/srd-2024/boekenlijst.js            (proefronde)
//   node scripts/srd-2024/boekenlijst.js --schrijf
const fs   = require('fs');
const path = require('path');

const BRON = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/books.json';
const UIT  = path.join(__dirname, '..', '..', 'bronnen', 'boeken.json');

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const data = await fetch(BRON).then(r => {
    if (!r.ok) throw new Error(`${BRON} gaf ${r.status}`);
    return r.json();
  });

  // Alleen echte boeken: een scherm, een kaartendeck of een los avontuur in
  // één katern voegt niets toe aan een keuzelijst waarin je "waar komt dit
  // vandaan" opzoekt.
  const uit = (data.book || [])
    // Geen scherm, kaartendeck, kookboek of haakpatroon: die staan wel in de
    // lijst van 5e.tools, maar er komt geen feature uit.
    .filter(b => b.name && b.id
      && !/screen|deck|tarokka|crochet|cookbook|feast|puncheons|^project_/i.test(b.name))
    .map(b => ({ code: b.id, naam: b.name, jaar: String(b.published || '').slice(0, 4) }))
    .sort((a, b) => (a.jaar || '').localeCompare(b.jaar || '') || a.naam.localeCompare(b.naam));

  for (const b of uit) console.log(`  ${b.jaar || '    '}  ${b.code.padEnd(10)} ${b.naam}`);
  console.log(`\n${uit.length} boeken.`);

  if (!schrijf) { console.log('Proefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(UIT, JSON.stringify({
    _wat: 'De boeken waar materiaal uit kan komen, voor het veld "Uit welk boek?". Een keuzelijst naast een vrij veld — je eigen wereld staat in geen enkel boek.',
    _bron: 'De boekenlijst van 5e.tools (data/books.json), opgehaald met scripts/srd-2024/boekenlijst.js.',
    boeken: uit,
  }, null, 2) + '\n');
  console.log(`Geschreven: ${path.relative(process.cwd(), UIT)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
