#!/usr/bin/env node
/**
 * Kijkt lijst.js na tegen bronnen/ en schrijft docs/preset-personages.md.
 *   node scripts/preset-personages/tabel.js           # alleen nakijken
 *   node scripts/preset-personages/tabel.js --schrijf # ook het overzicht schrijven
 * Controles: elke subclass uit de seed precies één keer, elk species minstens
 * één keer, geen background dubbel, en elk background bestaat in
 * bronnen/backgrounds-2024.json (dat zijn er 124, allemaal uit WotC-boeken).
 */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', '..');
const lijst = require('./lijst');
const prog = require(path.join(R, 'bronnen/class-progression.json'));
const vk = require(path.join(R, 'bronnen/volken-klassen.json'));
const bgs = require(path.join(R, 'bronnen/backgrounds-2024.json'));

// Vervangen door de PHB 2024 (nieuwste druk wint), of een variant van een ander.
const BG_UIT = ['Folk Hero', 'Guild Artisan', 'Outlander', 'Urchin', 'Variant City Watch (Investigator)'];

const fout = [];
const tel = (f) => lijst.reduce((m, p) => (m[f(p)] = (m[f(p)] || 0) + 1, m), {});

// Subclasses
const subs = Object.entries(prog.classes).flatMap(([k, v]) => Object.keys(v.subclasses || {}).map(s => k + '|' + s));
const perSub = tel(p => p.klasse + '|' + p.sub);
for (const s of subs) if (perSub[s] !== 1) fout.push(`subclass ${s}: ${perSub[s] || 0}×`);
for (const s in perSub) if (!subs.includes(s)) fout.push(`onbekende subclass ${s}`);

// Species
const species = [...new Set([...vk.volkenGangbaar, ...vk.volkenOverig])];
const perSp = tel(p => p.species);
for (const s of species) if (!perSp[s]) fout.push(`species ontbreekt: ${s}`);
for (const s in perSp) if (!species.includes(s)) fout.push(`onbekend species ${s}`);
for (const [s, n] of Object.entries(perSp)) if (n > 1) {
  const lin = lijst.filter(p => p.species === s).map(p => p.lineage);
  if (new Set(lin).size !== n || lin.includes(undefined)) fout.push(`${s} ${n}× zonder verschillende lineage`);
}

// Backgrounds
const perBg = tel(p => p.bg);
for (const [b, n] of Object.entries(perBg)) {
  if (n > 1) fout.push(`background ${b}: ${n}×`);
  if (!bgs[b]) fout.push(`onbekende background ${b}`);
  if (BG_UIT.includes(b)) fout.push(`background ${b} is vervangen`);
}
const namen = tel(p => p.naam);
for (const [n, c] of Object.entries(namen)) if (c > 1) fout.push(`naam dubbel: ${n}`);
for (const p of lijst) if (p.lvl < 3) fout.push(`${p.naam}: level ${p.lvl} heeft nog geen subclass`);

const regel = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
const perBoek = tel(p => bgs[p.bg]?.boek || '?');
const lvlBand = tel(p => p.lvl <= 5 ? '3–5' : p.lvl <= 10 ? '6–10' : p.lvl <= 15 ? '11–15' : '16–20');
const sam = {
  'Personages': lijst.length,
  'Geslacht': regel(tel(p => ({ v: 'vrouw', m: 'man', x: 'non-binair/geen' })[p.g])),
  'Levensfase': regel(tel(p => p.fase)),
  'Level': regel(lvlBand) + ' — per level: ' + Object.entries(tel(p => p.lvl)).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '),
  'Alignment': regel(tel(p => p.al)),
  'Backgrounds per boek': regel(perBoek),
};
console.log(Object.entries(sam).map(([k, v]) => `${k}: ${v}`).join('\n'));
if (fout.length) { console.error('\nFOUTEN:\n  ' + fout.join('\n  ')); process.exit(1); }
console.log('\nAlles klopt.');

if (process.argv.includes('--schrijf')) {
  const ongebruikt = Object.keys(bgs).filter(b => !perBg[b] && !BG_UIT.includes(b));
  const g = { v: '♀', m: '♂', x: '–' };
  let md = `# Preset-personages\n\n62 speelbare personages: **één per subclass** die de app meelevert, samen alle **${species.length} species** en **62 verschillende backgrounds**.\n\n`;
  md += `Gegenereerd uit \`scripts/preset-personages/lijst.js\` met \`node scripts/preset-personages/tabel.js --schrijf\`. Pas de lijst aan, niet dit bestand.\n\n`;
  md += `## Verdeling\n\n` + Object.entries(sam).map(([k, v]) => `- **${k}:** ${v}`).join('\n') + '\n\n';
  md += `Levensfase is gemeten aan het species: een Elf van 120 is jong, een Halfling van 120 hoogbejaard.\n\n`;
  md += `Drie species staan er meer dan eens in, steeds met een andere lineage: Elf (Wood Elf, High Elf, Drow) en Tiefling (Infernal, Abyssal).\n\n`;
  md += `## De personages\n\n| # | Naam | Class | Subclass | Species | Background | | Fase | Lvl | Al. | Concept |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  lijst.forEach((p, i) => {
    md += `| ${i + 1} | ${p.naam} | ${p.klasse} | ${p.sub} | ${p.species}${p.lineage ? ` (${p.lineage})` : ''} | ${p.bg} <sub>${bgs[p.bg].boek}</sub> | ${g[p.g]} | ${p.fase} | ${p.lvl} | ${p.al} | ${p.rol} |\n`;
  });
  md += `\n## Backgrounds die niet gebruikt zijn (${ongebruikt.length})\n\nVoor wie wil wisselen. Met opzet weggelaten omdat de PHB 2024 ze verving, of omdat het een variant is: ${BG_UIT.join(', ')}.\n\n`;
  const perB = {};
  for (const b of ongebruikt) (perB[bgs[b].boek] = perB[bgs[b].boek] || []).push(b);
  for (const [boek, l] of Object.entries(perB)) md += `- **${boek}:** ${l.join(', ')}\n`;
  fs.writeFileSync(path.join(R, 'docs/preset-personages.md'), md);
  console.log('Geschreven: docs/preset-personages.md');
}
