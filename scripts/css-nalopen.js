#!/usr/bin/env node
// **Een klasse die nergens bestaat geeft geen foutmelding.**
//
// De frontend zet zijn opmaak met klassenamen in template literals. Typ je er
// een verkeerd, of verzin je een eigen structuur voor een scherm dat de
// gedeelde romp hoort te gebruiken, dan staat dat scherm als kale tekst op de
// pagina — geen rode regel in de console, niets. Zo stond de woekeraar er een
// tijd bij: hij had zelf een `herberg-hero` bedacht en die klassen kende
// `theme.css` niet.
//
// Dit script loopt het in twee richtingen na:
//
//   --gaten  (standaard) klassen die de code uitstuurt en die theme.css niet
//            kent — de kant die kapotte schermen vindt;
//   --dood   klassen die in theme.css staan en die geen renderer meer
//            uitstuurt — de kant die achterblijvers na een verbouwing vindt.
//
// **Tailwind doet niet mee.** De app laadt Tailwind van een CDN, dus `px-3` en
// `z-30` hoeven niet in theme.css te staan. Daarom kijkt de gatenkant alleen
// naar klassen wier **eerste lid** een voorvoegsel is dat theme.css zelf
// gebruikt (`herberg-`, `tegel-`, `dm-`, …): `herberg-hero` valt dan op en
// `px-3` niet. Dat is strenger dan nodig en daarmee bruikbaar — een lijst van
// duizend "misschien" leest niemand na.
//
//   node scripts/css-nalopen.js
//   node scripts/css-nalopen.js --dood
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const CSS = path.join(WORTEL, 'public/css/theme.css');
const dood = process.argv.includes('--dood');

const css = fs.readFileSync(CSS, 'utf8');
// Wat theme.css definieert. Een selector mag er samengesteld in staan
// (`.a.b--c`), dus alles wat op een punt volgt telt los mee.
const cssKlassen = new Set();
for (const m of css.matchAll(/\.(-?[a-zA-Z_][a-zA-Z0-9_-]*)/g)) cssKlassen.add(m[1]);

// De voorvoegsels die deze app zelf gebruikt: het eerste lid van elke
// klassenaam met een streepje erin die meer dan één keer voorkomt. Eén keer is
// te weinig — dan is het voorvoegsel zelf misschien de typefout.
const voorTel = new Map();
for (const k of cssKlassen) {
  const voor = k.split('-')[0];
  if (!voor || k === voor) continue;
  voorTel.set(voor, (voorTel.get(voor) || 0) + 1);
}
const VOORVOEGSELS = new Set([...voorTel].filter(([, n]) => n >= 3).map(([v]) => v));

// ── Wat de code uitstuurt ───────────────────────────────────────────────────
const bestanden = [];
(function loop(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|\.git|css|media|uploads|files)$/.test(e.name)) loop(p); }
    else if (/\.(js|html)$/.test(e.name) && !p.includes(`public${path.sep}css`)) bestanden.push(p);
  }
})(path.join(WORTEL, 'public'));

// Per klasse: waar hij staat. Drie vormen: een class-attribuut in markup,
// classList.add/remove/toggle, en een kale className-toewijzing.
const gebruikt = new Map();
const zet = (naam, waar) => {
  if (!gebruikt.has(naam)) gebruikt.set(naam, new Set());
  gebruikt.get(naam).add(waar);
};
const PATRONEN = [
  /class(?:Name)?\s*=\s*["'`]([^"'`]*)["'`]/g,
  /class\s*=\s*["']([^"']*)["']/g,
  /classList\.(?:add|remove|toggle|contains)\(([^)]*)\)/g,
];
for (const p of bestanden) {
  const tekst = fs.readFileSync(p, 'utf8');
  const kort = path.relative(WORTEL, p);
  const regelVan = (idx) => tekst.slice(0, idx).split('\n').length;
  for (const re of PATRONEN) {
    for (const m of tekst.matchAll(re)) {
      // Een `${…}` erin betekent dat de naam samengesteld wordt; dan is de
      // stam nog wel te lezen maar de staart niet, en die slaan we over.
      for (const stuk of m[1].split(/\s+|['",]/)) {
        const naam = stuk.trim();
        if (!naam || naam.includes('$') || naam.includes('{')) continue;
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(naam)) continue;
        zet(naam, `${kort}:${regelVan(m.index)}`);
      }
    }
  }
}

// Samengestelde namen (`best-card-niv--${k}`) zijn geen gat en geen wees: de
// stam ervoor telt als gebruikt, en de staarten zijn niet te kennen.
const stammen = new Set();
for (const p of bestanden) {
  const tekst = fs.readFileSync(p, 'utf8');
  for (const m of tekst.matchAll(/([a-zA-Z][a-zA-Z0-9_-]*-)\$\{/g)) stammen.add(m[1]);
}
const viaStam = (naam) => [...stammen].some(s => naam.startsWith(s));

if (!dood) {
  const gaten = [...gebruikt.keys()]
    .filter(k => !cssKlassen.has(k))
    .filter(k => k.includes('-') && VOORVOEGSELS.has(k.split('-')[0]))
    .filter(k => !viaStam(k))
    .sort();
  console.log(`\n${cssKlassen.size} klassen in theme.css · ${gebruikt.size} in de code · ${VOORVOEGSELS.size} eigen voorvoegsels\n`);
  console.log(`── de code stuurt ze uit, theme.css kent ze niet (${gaten.length}) ──\n`);
  for (const k of gaten) {
    const waar = [...gebruikt.get(k)];
    console.log(`  ${k}`);
    console.log(`     ${waar.slice(0, 4).join(', ')}${waar.length > 4 ? ` … +${waar.length - 4}` : ''}`);
  }
  if (!gaten.length) console.log('  (niets)');
  process.exit(0);
}

const wezen = [...cssKlassen]
  .filter(k => !gebruikt.has(k))
  .filter(k => !viaStam(k))
  .sort();
console.log(`\n── staan in theme.css, geen renderer stuurt ze uit (${wezen.length}) ──\n`);
console.log(wezen.join('\n'));
