#!/usr/bin/env node
// **Een `getElementById` naar een id dat nergens bestaat, faalt stil.**
//
// `document.getElementById` geeft `null`, de code erachter slaat zijn werk over
// met een `if (!el) return`, en er komt geen foutmelding. Zo liep op
// 26 nov 2026 het hele `_updateDienstenMenu` leeg: dat zocht negen menuknoppen
// op hun id uit `index.html`, terwijl het dienstenmenu inmiddels **getekend**
// werd en die knoppen geen id meer droegen. Gevolg: een dienst op *verborgen*
// stond gewoon in het menu en een dienst op *zichtbaar* kreeg zijn slotje niet.
//
// Dit script legt de twee kanten naast elkaar: welke ids de code opzoekt, en
// welke er érgens uitgestuurd worden.
//
//   node scripts/dode-ids.js            # de kandidaten
//   node scripts/dode-ids.js --alles    # ook de ids met een sjabloon erin
//
// **Lees de uitkomst als een lijst om na te lopen, niet als een foutmelding** —
// vandaar een script en geen toets. Een id kan ook gemaakt worden door een
// hulpfunctie (`_laag('gr-vignet', …)` in gevecht-regie.js), met plakwerk
// opgebouwd, of in een ander html-bestand staan; dat ziet een broncodescan
// niet. Bij de eerste draai waren 40 van de ~70 treffers zulk vals alarm.
// Zelfde afspraak als bij `css-nalopen.js --dood`.
const fs   = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const JS_DIR = path.join(WORTEL, 'public', 'js');
const alles  = process.argv.includes('--alles');

// **Behoedzaam strippen.** Een gulzige `/*…*/` eet 23% van `dm-panel.js` op:
// er staat een `/*` in een string die met een `*/` verderop paart, en dan
// verdwijnt een heel gebied inclusief de `id="…"` die erin stond — precies in
// de richting die ertoe doet (een id dat bestaat lijkt dan weg). Dus alleen een
// regel die *begint* met `//`, en blokcommentaar dat op één regel sluit.
const kaalJs = (src) => src.split('\n')
  .map(r => (/^\s*\/\//.test(r) ? '' : r.replace(/\/\*(?![\s\S]*?\n)[\s\S]*?\*\//g, '')))
  .join('\n');
const kaalHtml = (src) => src.replace(/<!--[\s\S]*?-->/g, '');

const bronnen = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'))
  .map(f => ({ naam: f, src: kaalJs(fs.readFileSync(path.join(JS_DIR, f), 'utf8')) }));
const htmls = fs.readdirSync(path.join(WORTEL, 'public')).filter(f => f.endsWith('.html'))
  .map(f => kaalHtml(fs.readFileSync(path.join(WORTEL, 'public', f), 'utf8')));

// Wat érgens een id kan krijgen: in de HTML, in een id-attribuut dat de JS
// uitstuurt, of via `el.id = '…'`. Een sjabloon (`id="rij-${i}"`) levert een
// familie op; die kunnen we niet uitrekenen, dus de vaste kop telt als
// voorvoegsel — anders staat elke regel van zo'n familie hier als "dood".
const vast = new Set();
const prefixen = [];
const pakId = (tekst) => {
  for (const m of tekst.matchAll(/\bid=["']([^"']*)["']/g)) {
    const v = m[1];
    if (!v) continue;
    if (v.includes('${')) { const p = v.split('${')[0]; if (p) prefixen.push(p); }
    else vast.add(v);
  }
  for (const m of tekst.matchAll(/\.id\s*=\s*['"]([^'"${]+)['"]/g)) vast.add(m[1]);
};
for (const h of htmls) pakId(h);
for (const b of bronnen) pakId(b.src);
// Ook de eerste tekenreeks van een hulpfunctie die een laag máákt telt mee.
for (const b of bronnen) {
  for (const m of b.src.matchAll(/_laag\(\s*['"]([^'"]+)['"]/g)) vast.add(m[1]);
}

const kent = (id) => vast.has(id) || prefixen.some(p => id.startsWith(p));

const gezocht = new Map();
for (const { naam, src } of bronnen) {
  for (const m of src.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (!gezocht.has(m[1])) gezocht.set(m[1], new Set());
    gezocht.get(m[1]).add(naam);
  }
  for (const m of src.matchAll(/querySelector(?:All)?\(\s*['"]#([A-Za-z0-9_-]+)['"]\s*\)/g)) {
    if (!gezocht.has(m[1])) gezocht.set(m[1], new Set());
    gezocht.get(m[1]).add(naam);
  }
}

const dood = [...gezocht].filter(([id]) => !kent(id) && (alles || !id.includes('${')));
console.log(`\n${gezocht.size} ids worden opgezocht; ${vast.size} vaste en ${prefixen.length} sjabloon-ids worden uitgestuurd.\n`);
if (!dood.length) { console.log('Geen kandidaten.'); process.exit(0); }
console.log('── opgezocht, nergens gevonden ──');
for (const [id, waar] of dood.sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${id.padEnd(34)} ${[...waar].join(', ')}`);
}
console.log(`\n${dood.length} kandidaten. Loop ze na: een id kan ook door een hulpfunctie`);
console.log('of met plakwerk gemaakt worden — dat ziet dit script niet.');
