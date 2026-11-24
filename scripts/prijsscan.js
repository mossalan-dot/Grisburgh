// **Welke prijsvelden leest de server als niets?**
//
// `parsePrijs()` in routes/api.js kent drie vormen: de kommanotatie (`1,50`),
// een bedrag met een munt erachter (`2 kn`, `5 gp`) en — sinds 24 nov 2026 —
// een kaal getal, dat florindes zijn. Al het andere geeft `null`, en dan
// schrijft de aanroeper niets af: het voorwerp is gratis, de overnachting
// kost niets, en er komt geen foutmelding. Zo stond in Grisburgh bij twee
// winkels een Dart op "5 kp." — een munt die niet bestaat.
//
//   node scripts/prijsscan.js [pad naar de campagnemap]
//   GRISBURGH_DATA_DIR=... node scripts/prijsscan.js data/campaigns/grisburgh/
const fs = require('fs');
const D = process.argv[2] || '/var/www/grisburgh/data/campaigns/grisburgh/';
const meta = JSON.parse(fs.readFileSync(D + 'meta.json', 'utf8'));
const cur = meta.currency || {};
const namen = [];
for (const k of ['fl','kn','cl','ep','pp']) {
  const n = String(cur[k] || '').trim().toLowerCase();
  if (n) namen.push(n, n+'s', n+'en', n+'n');
}
const re = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(' + (namen.length ? namen.join('|') + '|' : '') + 'fl|kn|cl|gp|sp|cp|ep|pp)\\.?(?![a-z])', 'i');
const komma = /^(\d+)[.,](\d{1,2})$/;
const faalt = (v) => {
  if (v === undefined || v === null || v === '') return false;
  const kaal = String(v).trim().replace(/\s+/g, '');
  if (komma.test(kaal)) return false;
  if (/^\d+$/.test(kaal)) return false;   // een kaal getal is florindes (sinds 24 nov 2026)
  return !re.test(String(v));
};
const meld = [];
if (faalt(meta.herberg?.overnachtingPrijs)) meld.push(['meta.herberg.overnachtingPrijs', meta.herberg.overnachtingPrijs]);
for (const r of (meta.herberg?.menu || [])) if (faalt(r.prijs)) meld.push(['herberg-menu: ' + r.naam, r.prijs]);
for (const g of (meta.tempel?.goden || [])) if (faalt(g.prijs)) meld.push(['tempel: ' + (g.naam||g.name), g.prijs]);
const e = JSON.parse(fs.readFileSync(D + 'entities.json', 'utf8'));
let prijsVeld = 0, voorraad = 0;
for (const t of Object.keys(e)) for (const x of (e[t] || [])) {
  if (faalt(x.data?.prijs)) { prijsVeld++; if (prijsVeld < 8) meld.push([t + ': ' + x.name + ' .data.prijs', x.data.prijs]); }
  let vr = x.data?.voorraad;
  if (typeof vr === 'string') { try { vr = JSON.parse(vr); } catch { vr = null; } }
  for (const rij of (Array.isArray(vr) ? vr : [])) {
    if (faalt(rij.prijs)) { voorraad++; if (voorraad < 8) meld.push(['voorraad bij ' + x.name + ': ' + (rij.naam || rij.name), rij.prijs]); }
  }
}
console.log('── velden die parsePrijs als null leest (bedrag zonder munt) ──');
for (const [w, v] of meld) console.log('  ' + w + ' = ' + JSON.stringify(v));
console.log(`totaal: ${prijsVeld} kaartjesprijzen, ${voorraad} voorraadregels, plus het bovenstaande`);
