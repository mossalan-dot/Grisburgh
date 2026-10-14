#!/usr/bin/env node
// Wat er misging, leesbaar. Het boekje staat als JSON in `data/fouten.json`
// — prima om te schrijven, beroerd om te lezen. Dit zet het om naar iets wat
// je in een terminal kunt overzien.
//
//   node scripts/fouten.js                  # alles, nieuwste eerst
//   node scripts/fouten.js --meldingen      # alleen wat mensen meldden
//   node scripts/fouten.js --stack          # mét stacktraces
//   node scripts/fouten.js --campagne beta  # van één campagne
//   node scripts/fouten.js --json           # ruw, om door te pijpen
//
// Op de server: ssh root@… "cd /var/www/grisburgh && node scripts/fouten.js"
const fs   = require('fs');
const path = require('path');

const args     = process.argv.slice(2);
const alleen   = args.includes('--meldingen') ? 'melding' : null;
const metStack = args.includes('--stack');
const ruw      = args.includes('--json');
const campagne = args.includes('--campagne') ? args[args.indexOf('--campagne') + 1] : null;

const BASE = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const pad  = path.join(BASE, 'fouten.json');
if (!fs.existsSync(pad)) { console.log('Nog niets misgegaan — ' + pad + ' bestaat niet.'); process.exit(0); }

let fouten = [];
try { fouten = JSON.parse(fs.readFileSync(pad, 'utf8')).fouten || []; }
catch (e) { console.error('Kan ' + pad + ' niet lezen: ' + e.message); process.exit(1); }

if (alleen)   fouten = fouten.filter(f => f.soort === alleen);
if (campagne) fouten = fouten.filter(f => f.campagne === campagne);
// Zelfde volgorde als het scherm: meldingen van mensen bovenaan, want daar
// wacht iemand op antwoord.
fouten.sort((a, b) => (b.soort === 'melding') - (a.soort === 'melding')
  || String(b.laatst).localeCompare(String(a.laatst)));

if (ruw) { console.log(JSON.stringify(fouten, null, 2)); process.exit(0); }

const SOORT = { melding: 'GEMELD ', client: 'BROWSER', server: 'SERVER ' };
const wanneer = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Een telling vooraf, want "hoeveel en van welke soort" is meestal de vraag
// waarmee je komt kijken.
const tel = fouten.reduce((o, f) => { o[f.soort] = (o[f.soort] || 0) + (f.aantal || 1); return o; }, {});
console.log(`${fouten.length} regel${fouten.length === 1 ? '' : 's'} in ${pad}`);
console.log(Object.entries(tel).map(([k, v]) => `${v}× ${k}`).join(' · ') || '—');
console.log('─'.repeat(78));

for (const f of fouten) {
  const kop = `${SOORT[f.soort] || f.soort}  ${wanneer(f.laatst)}`
    + (f.aantal > 1 ? `  ${f.aantal}×` : '')
    + (f.campagne ? `  [${f.campagne}]` : '')
    + (f.rol ? `  ${f.rol}` : '');
  console.log(kop);
  console.log('  ' + (f.soort === 'melding' ? (f.toelichting || f.melding) : f.melding).replace(/\n/g, '\n  '));
  if (f.waar)   console.log('  waar:   ' + f.waar);
  if (f.versie) console.log('  versie: ' + f.versie);
  if (metStack && f.stack) console.log(f.stack.split('\n').map(r => '    ' + r).join('\n'));
  console.log('');
}
