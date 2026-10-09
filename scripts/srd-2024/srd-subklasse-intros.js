#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  SUBKLASSE-INTRO'S UIT DE SRD
// ════════════════════════════════════════════════════════════════════════════
// Een subklassekaartje toonde zijn features maar geen woord over wat de
// subklasse ís. Dat leek een auteursrechtgrens — de meeste subklassen staan
// alleen in het Player's Handbook — maar voor de twaalf uit de SRD is het dat
// niet: die staan in SRD 5.2 en die is CC BY 4.0, net als de featureteksten
// die er al in staan.
//
// Ze ontbraken dus niet omdát het niet mocht, maar omdat ons bronbestand ze
// nooit had: `class-progression.json` kende per subklasse alleen `levels`.
//
// Dit script haalt ze op bij de bron in plaats van ze over te typen. Wat hier
// landt is wat er in de SRD staat, en niets anders.
//
//   node scripts/srd-2024/srd-subklasse-intros.js [--schrijf]
//
// Zonder `--schrijf` draait hij proef en laat zien wat hij zou doen.

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BRON = 'https://raw.githubusercontent.com/downfallx/dnd-5e-srd-markdown/master/classes.md';
const DOEL = path.join(__dirname, '..', '..', 'bronnen', 'class-progression.json');

const haal = (url) => new Promise((klaar, fout) => {
  https.get(url, res => {
    if (res.statusCode !== 200) return fout(new Error('HTTP ' + res.statusCode));
    let d = ''; res.on('data', c => d += c); res.on('end', () => klaar(d));
  }).on('error', fout);
});

// ── Lezen ───────────────────────────────────────────────────────────────────
// De kop is `### <Class> Subclass: <Naam>`. Daarna komt eerst een cursieve
// ondertitel (`_Channel Rage into Violent Fury_`) en dan de alinea's tot de
// eerste feature (`#### Level 3: Frenzy`).
//
// De ondertitel nemen we mee als eerste regel: hij is kort, hij staat er in de
// bron, en hij zegt in vijf woorden wat de rest in vijftig zegt.
function lees(md) {
  const uit = {};
  const regels = md.split('\n');
  for (let i = 0; i < regels.length; i++) {
    const kop = regels[i].match(/^### (.+?) Subclass: (.+?)\s*$/);
    if (!kop) continue;
    const [, klasse, naam] = kop;
    const stukken = [];
    for (let j = i + 1; j < regels.length; j++) {
      const r = regels[j];
      if (/^#{1,4} /.test(r)) break;          // de eerste feature, of de volgende kop
      if (!r.trim()) continue;
      stukken.push(r.trim());
    }
    if (stukken.length) uit[naam] = { klasse, desc: stukken.join('\n\n') };
  }
  return uit;
}

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const md = await haal(BRON);
  const gevonden = lees(md);
  const prog = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
  const classes = prog.classes || prog;

  let gezet = 0, overgeslagen = [], onbekend = [];
  for (const [naam, { klasse, desc }] of Object.entries(gevonden)) {
    const sub = classes[klasse]?.subclasses?.[naam];
    if (!sub) { onbekend.push(`${klasse} › ${naam}`); continue; }
    if (sub.desc) { overgeslagen.push(naam); continue; }   // er staat al iets
    sub.desc = desc;
    gezet++;
  }

  console.log(`\nSubklasse-intro's uit de SRD (${Object.keys(gevonden).length} gevonden):`);
  console.log(`  gezet         ${gezet}`);
  console.log(`  stond er al   ${overgeslagen.length}${overgeslagen.length ? ' — ' + overgeslagen.join(', ') : ''}`);
  console.log(`  niet in onze bron  ${onbekend.length}${onbekend.length ? ' — ' + onbekend.join(', ') : ''}`);
  const voorbeeld = Object.entries(gevonden)[0];
  if (voorbeeld) console.log(`\n  voorbeeld — ${voorbeeld[0]}:\n    ${voorbeeld[1].desc.replace(/\n+/g, ' ').slice(0, 150)}…`);

  if (!schrijf) { console.log('\nProefdraai — niets geschreven. Voeg --schrijf toe.'); return; }
  fs.writeFileSync(DOEL, JSON.stringify(prog, null, 2));
  console.log(`\nGeschreven naar ${path.relative(process.cwd(), DOEL)}.`);
})().catch(e => { console.error('Mislukt:', e.message); process.exit(1); });
