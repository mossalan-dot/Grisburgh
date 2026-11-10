#!/usr/bin/env node
// Hoogt het `?v=`-nummer op van de genoemde frontendbestanden — overal waar ze
// geïmporteerd worden — en daarna van elk bestand dat daardoor zelf veranderde.
//
// Die tweede stap is waar het met de hand misgaat (zie CLAUDE.md, 19 okt 2026):
// verander je alleen de import *binnenin* app.js, dan haalt een browser die
// `app.js?v=N` al heeft het nieuwe nummer nooit op. Dus schuift elke importeur
// mee, tot er niets meer verandert; index.html is het eind van de keten.
//
//   node scripts/versies-ophogen.js app.js dm-panel.js            # rekent voor
//   node scripts/versies-ophogen.js $(git diff --name-only public/js) --schrijf
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS = path.join(ROOT, 'public', 'js');
const BESTANDEN = [
  ...fs.readdirSync(JS).filter(f => f.endsWith('.js')).map(f => path.join(JS, f)),
  path.join(ROOT, 'public', 'index.html'),
];
const schrijf = process.argv.includes('--schrijf');
const namen = process.argv.slice(2).filter(a => !a.startsWith('--')).map(a => path.basename(a));

const inhoud = new Map(BESTANDEN.map(p => [p, fs.readFileSync(p, 'utf8')]));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rij = [...new Set(namen)];
const gedaan = new Map();          // naam → [oud, nieuw]
while (rij.length) {
  const naam = rij.shift();
  if (gedaan.has(naam) || naam === 'index.html') continue;
  const re = new RegExp(`/${esc(naam)}\\?v=(\\d+)`, 'g');
  const versies = new Set();
  for (const src of inhoud.values()) for (const m of src.matchAll(re)) versies.add(+m[1]);
  if (!versies.size) { console.log(`  —  ${naam}: wordt nergens met ?v= geïmporteerd`); gedaan.set(naam, null); continue; }
  if (versies.size > 1) console.log(`  !  ${naam} stond onder meer versies (${[...versies].join(', ')}); alles gaat naar één`);
  const nieuw = Math.max(...versies) + 1;
  gedaan.set(naam, [[...versies].join('/'), nieuw]);
  for (const [p, src] of inhoud) {
    const uit = src.replace(re, `/${naam}?v=${nieuw}`);
    if (uit === src) continue;
    inhoud.set(p, uit);
    rij.push(path.basename(p));   // de importeur veranderde, dus schuift hij zelf ook op
  }
}

for (const [naam, v] of gedaan) if (v) console.log(`  ${naam.padEnd(26)} ${v[0]} → ${v[1]}`);
if (schrijf) {
  for (const [p, src] of inhoud) if (src !== fs.readFileSync(p, 'utf8')) fs.writeFileSync(p, src);
  console.log('geschreven');
} else console.log('(droog — --schrijf voert door)');
