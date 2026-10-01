#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BACKUPS OPRUIMEN
// ════════════════════════════════════════════════════════════════════════════
// `writeJSON` in lib/storage.js houdt zijn eigen roterende backups bij, netjes
// in `backups/` en met een maximum. Daar gaat dit script niet over.
//
// Het gaat over de losse kopieën die in de wortel van een campagne liggen.
// Elke migratie en elk eenmalig script maakt er een, elk met een eigen
// naamgeving, en niemand ruimt ze op — want niemand weet dat het een reeks is:
//
//   entities.bak.1788618172865.json        (script, epoch)
//   entities.bak.20260917_081023.json      (script, datumstempel)
//   entities.json.bak.20260911_130617      (ander script, andere volgorde)
//   entities.json.voor-demo.bak            (demo-vullen.js)
//   entities.voor-geheimids.2026-09-08.json (migratie met een label)
//   meta.json.corrupt.2026-09-08T...       (storage.js, bij corrupte JSON)
//
// In de testomgeving waren het er dertig, waarvan de oudste uit juni. Bij een
// campagne op volle grootte is elk daarvan een paar honderd kB.
//
// De regel: **per oorspronkelijk bestand de nieuwste vijf bewaren.** Wat
// wegvalt gaat eerst in één tar.gz in `backups/`, dus opruimen is omkeerbaar —
// een backup weggooien zonder vangnet is precies het soort opruimen dat je een
// keer spijt van krijgt.
//
//   node scripts/backups-opruimen.js <campagne|--alle> [--houd n] [--weg]
//
// Zonder `--weg` vertelt hij alleen wat er zou verdwijnen.

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const MET_WAARDE = new Set(['--houd', '--basis']);
const vrij = args.filter((a, i) => !a.startsWith('--') && !MET_WAARDE.has(args[i - 1]));
const alle   = args.includes('--alle');
const doeWeg = args.includes('--weg');
const HOUD   = Math.max(1, parseInt(args.includes('--houd') ? args[args.indexOf('--houd') + 1] : '5', 10) || 5);
const basisArg = args.includes('--basis') ? args[args.indexOf('--basis') + 1] : null;

const wortel = basisArg || path.join(__dirname, '..', 'data', 'campaigns');
if (!alle && !vrij[0]) {
  console.error('Gebruik: node scripts/backups-opruimen.js <campagne|--alle> [--houd n] [--weg]');
  process.exit(1);
}
if (!fs.existsSync(wortel)) { console.error('Niet gevonden: ' + wortel); process.exit(1); }

const campagnes = alle
  ? fs.readdirSync(wortel).filter(d => fs.statSync(path.join(wortel, d)).isDirectory())
  : [vrij[0]];

// ── Herkennen ───────────────────────────────────────────────────────────────
// Welk bestand hoorde hierbij? De patronen hierboven, van specifiek naar
// algemeen. Teruggeven: het oorspronkelijke bestand, of null als dit gewoon
// een werkbestand is dat moet blijven staan.
function hoortBij(naam) {
  // Nooit aan echte data komen: een bestand zonder herkenbaar backup-merk
  // blijft staan, hoe oud het ook is.
  const patronen = [
    /^(.+?\.json)\.bak\b.*$/,            // entities.json.bak.20260911_130617
    /^(.+?\.json)\.voor-[^.]+\.bak$/,    // entities.json.voor-demo.bak
    /^(.+?\.json)\.corrupt\..*$/,        // meta.json.corrupt.2026-…
    /^(.+?)\.bak\..*\.json$/,            // entities.bak.1788618172865.json
    /^(.+?)\.voor-[^.]+\.[-0-9T]+\.json$/, // entities.voor-geheimids.2026-09-08.json
  ];
  for (const p of patronen) {
    const m = naam.match(p);
    if (m) return m[1].endsWith('.json') ? m[1] : m[1] + '.json';
  }
  return null;
}

let totaalWeg = 0, totaalBytes = 0;
for (const c of campagnes) {
  const dir = path.join(wortel, c);
  let namen;
  try { namen = fs.readdirSync(dir); } catch { continue; }

  // Groeperen per oorspronkelijk bestand.
  const groepen = new Map();
  for (const n of namen) {
    const bij = hoortBij(n);
    if (!bij) continue;
    const vol = path.join(dir, n);
    let st; try { st = fs.statSync(vol); } catch { continue; }
    if (!st.isFile()) continue;
    if (!groepen.has(bij)) groepen.set(bij, []);
    groepen.get(bij).push({ naam: n, pad: vol, tijd: st.mtimeMs, bytes: st.size });
  }
  if (!groepen.size) continue;

  const weg = [];
  for (const [bron, lijst] of [...groepen].sort()) {
    // Nieuwste eerst; de eerste `HOUD` blijven.
    lijst.sort((a, b) => b.tijd - a.tijd);
    const blijft = lijst.slice(0, HOUD);
    const gaat   = lijst.slice(HOUD);
    if (gaat.length) weg.push(...gaat);
    console.log(`  ${bron.padEnd(22)} ${String(lijst.length).padStart(3)} kopieën → ${blijft.length} blijven, ${gaat.length} weg`);
  }
  if (!weg.length) { console.log(`\n${c}: niets op te ruimen.`); continue; }

  const bytes = weg.reduce((s, x) => s + x.bytes, 0);
  console.log(`\n${c}: ${weg.length} bestanden, ${(bytes / 1048576).toFixed(1)} MB`);
  totaalWeg += weg.length; totaalBytes += bytes;

  if (!doeWeg) continue;

  // Eerst inpakken, dan pas weggooien. Een backup weggooien zonder vangnet is
  // precies het soort opruimen waar je een keer spijt van krijgt.
  const bdir = path.join(dir, 'backups');
  fs.mkdirSync(bdir, { recursive: true });
  const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archief = path.join(bdir, `opgeruimd-${stempel}.tar.gz`);
  try {
    execFileSync('tar', ['-czf', archief, '-C', dir, ...weg.map(x => x.naam)], { stdio: 'pipe' });
  } catch (e) {
    console.error(`  ! inpakken mislukt, er wordt niets verwijderd: ${e.message}`);
    continue;
  }
  const ingepakt = fs.statSync(archief).size;
  let gewist = 0;
  for (const x of weg) { try { fs.unlinkSync(x.pad); gewist++; } catch { /* ok */ } }
  console.log(`  ${gewist} verwijderd; ingepakt in backups/${path.basename(archief)} (${(ingepakt / 1048576).toFixed(1)} MB)`);
}

console.log(`\nTotaal: ${totaalWeg} bestanden, ${(totaalBytes / 1048576).toFixed(1)} MB`);
if (!doeWeg) console.log('Proefdraai — er is niets verwijderd. Voeg --weg toe om het echt te doen.');
