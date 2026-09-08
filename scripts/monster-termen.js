#!/usr/bin/env node
// De creature types en alignments in monsters.json staan door elkaar: "Beest"
// naast "beast" en "Beast", "ongebonden" naast "unaligned" en "Unaligned".
// Zestien schrijfwijzen voor tien types — daarmee valt niet te filteren, en
// D&D-termen horen bovendien in het Engels (zie CLAUDE.md).
//
// Dit script trekt ze recht. De namen van de wezens en hun traits blijven zoals
// ze zijn: dat is de tekst van de DM, niet de terminologie van de app.
//
//   node scripts/monster-termen.js <campagne> [--schrijf]
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/monster-termen.js <campagne> [--schrijf]'); process.exit(1); }

// De veertien types uit de PHB, met hun Nederlandse vertalingen.
const TYPE_NL = {
  gedrocht: 'Aberration', beest: 'Beast', hemels: 'Celestial', constructie: 'Construct',
  draak: 'Dragon', elementaal: 'Elemental', fee: 'Fey', duivels: 'Fiend', demon: 'Fiend',
  reus: 'Giant', humanoïde: 'Humanoid', humanoide: 'Humanoid', mens: 'Humanoid',
  monsterlijkheid: 'Monstrosity', gedrochtelijk: 'Monstrosity', slijm: 'Ooze',
  plant: 'Plant', ondode: 'Undead', ondood: 'Undead', zwerm: 'Swarm',
};
const TYPES = ['Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental',
               'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead'];

const hoofd = (w) => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;

// "small humanoid (goblinoid)" → "Humanoid (goblinoid)": het haakje is een
// verbijzondering van de DM en blijft zoals hij hem schreef.
function normType(ruw) {
  const heel = String(ruw || '').trim();
  if (!heel) return heel;
  // Alles na de eerste komma is een aantekening van de DM ("Humanoid (half-orc),
  // Circle of Spores Druid (4)") en blijft woordelijk staan.
  const komma = heel.indexOf(',');
  const staart = komma >= 0 ? heel.slice(komma) : '';
  const t = komma >= 0 ? heel.slice(0, komma).trim() : heel;
  const haakje = t.match(/\s*\(([^)]*)\)\s*$/);
  const kaal = haakje ? t.slice(0, haakje.index).trim() : t;
  const woorden = kaal.split(/\s+/);
  // Alleen aanraken als er een echt creature type in staat. Iemand heeft ooit
  // "Circle of Spores druid (4)" in dit veld gezet; dat is tekst van de DM en
  // die gaan we niet in de vorm van een officiële term duwen.
  const herkend = woorden.some(w => {
    const kaalWoord = w.toLowerCase().replace(/[^a-zà-ÿ]/gi, '');
    return TYPE_NL[kaalWoord] || TYPES.some(x => x.toLowerCase() === kaalWoord);
  });
  if (!herkend) return heel;
  const uit = woorden.map(w => {
    const nl = TYPE_NL[w.toLowerCase().replace(/[^a-zà-ÿ]/gi, '')];
    if (nl) return nl;
    const gevonden = TYPES.find(x => x.toLowerCase() === w.toLowerCase());
    return gevonden || (['of', 'the'].includes(w.toLowerCase()) ? w.toLowerCase() : hoofd(w));
  });
  return uit.join(' ') + (haakje ? ` (${haakje[1]})` : '') + staart;
}

const ALIGN_NL = { ongebonden: 'Unaligned', neutraal: 'Neutral', goed: 'Good', kwaad: 'Evil',
                   wettisch: 'Lawful', chaotisch: 'Chaotic', elk: 'Any', willekeurig: 'Any' };
function normAlign(ruw) {
  const a = String(ruw || '').trim();
  if (!a) return a;
  return a.split(/\s+/).map(w => ALIGN_NL[w.toLowerCase()] || hoofd(w)).join(' ')
    .replace(/\bNon-lawful\b/i, 'Non-Lawful');
}

const bestand = path.join(__dirname, '..', 'data', 'campaigns', campagne, 'monsters.json');
const data = JSON.parse(fs.readFileSync(bestand, 'utf8'));
const lijst = Array.isArray(data) ? data : (data.monsters || []);

let types = 0, aligns = 0;
const veranderd = [];
for (const m of lijst) {
  const sb = m.statblock;
  if (!sb) continue;
  const nt = normType(sb.type), na = normAlign(sb.alignment);
  if (sb.type && nt !== sb.type)      { veranderd.push(`${m.name}: type "${sb.type}" → "${nt}"`); sb.type = nt; types++; }
  if (sb.alignment && na !== sb.alignment) { veranderd.push(`${m.name}: alignment "${sb.alignment}" → "${na}"`); sb.alignment = na; aligns++; }
}

const namen = {};
for (const m of lijst) { const n = String(m.name || '').toLowerCase().trim(); (namen[n] = namen[n] || []).push(m.id); }
const dubbel = Object.entries(namen).filter(([, ids]) => ids.length > 1);

console.log(`${campagne}: ${lijst.length} monsters · ${types} types en ${aligns} alignments rechtgezet`);
for (const r of veranderd.slice(0, 40)) console.log(` · ${r}`);
if (veranderd.length > 40) console.log(` … en ${veranderd.length - 40} meer`);
console.log(`Types nu: ${[...new Set(lijst.map(m => m.statblock?.type).filter(Boolean))].sort().join(', ')}`);
if (dubbel.length) {
  console.log(`\nDubbele namen (niet aangeraakt — samenvoegen is een keuze van de DM):`);
  for (const [n, ids] of dubbel) console.log(` · ${n} (${ids.length}×): ${ids.join(', ')}`);
}

if (schrijf) {
  const kopie = bestand.replace(/\.json$/, `.voor-termen.${new Date().toISOString().slice(0, 10)}.json`);
  fs.copyFileSync(bestand, kopie);
  fs.writeFileSync(bestand, JSON.stringify(data, null, 2));
  console.log(`\nGeschreven (kopie ernaast als ${path.basename(kopie)})`);
} else {
  console.log('\nProefdraai — geef --schrijf om het door te voeren.');
}
