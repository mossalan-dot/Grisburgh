#!/usr/bin/env node
// Trekt de schrijfwijze van `data.ras` gelijk: Nederlandse namen en
// spellingvarianten worden de Engelse PHB-naam, zodat filteren en de koppeling
// met de progressie-tab werken. Wat geen volk is (goden, dieren, wezens) laat
// het script met rust en rapporteert het alleen.
//
//   node scripts/normaliseer-ras.js <campagne> [--schrijf]
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/normaliseer-ras.js <campagne> [--schrijf]'); process.exit(1); }

// Nederlands en varianten → de naam zoals hij in bronnen/volken-klassen.json staat.
const KAART = {
  'mens': 'Human', 'humaan': 'Human', 'human': 'Human',
  'dwerg': 'Dwarf', 'dweg': 'Dwarf', 'dwarf': 'Dwarf',
  'elf': 'Elf',
  'halfling': 'Halfling',
  'half-elf': 'Half-Elf', 'halfelf': 'Half-Elf', 'half elf': 'Half-Elf',
  'half-ork': 'Half-Orc', 'halfork': 'Half-Orc', 'half-orc': 'Half-Orc', 'half orc': 'Half-Orc',
  'ork': 'Orc', 'orc': 'Orc',
  'gnoom': 'Gnome', 'gnome': 'Gnome',
  'tiefling': 'Tiefling', 'thiefling': 'Tiefling',
  'draconiër': 'Dragonborn', 'dragonborn': 'Dragonborn',
  'goliath': 'Goliath', 'tabaxi': 'Tabaxi', 'tortle': 'Tortle',
  'aarakocra': 'Aarakocra', 'duergar': 'Duergar', 'genasi': 'Genasi',
  'harengon': 'Harengon', 'centaur': 'Centaur', 'giff': 'Giff',
};

const bestand = path.join(__dirname, '..', 'data', 'campaigns', campagne, 'entities.json');
const entities = JSON.parse(fs.readFileSync(bestand, 'utf8'));

const gewijzigd = [];
const blijftStaan = {};
for (const p of entities.personages || []) {
  const oud = String(p.data?.ras || '').trim();
  if (!oud) continue;
  const nieuw = KAART[oud.toLowerCase()];
  if (!nieuw) { blijftStaan[oud] = (blijftStaan[oud] || 0) + 1; continue; }
  if (nieuw !== oud) { gewijzigd.push(`${p.name}: ${oud} → ${nieuw}`); p.data.ras = nieuw; }
}

console.log(`${gewijzigd.length} gelijkgetrokken:`);
for (const r of gewijzigd) console.log('  ' + r);
const rest = Object.entries(blijftStaan).sort((a, b) => b[1] - a[1]);
if (rest.length) {
  console.log(`\n${rest.length} waarden blijven staan (geen volk uit de lijst):`);
  for (const [naam, n] of rest) console.log(`  ${n}x ${naam}`);
}

if (schrijf && gewijzigd.length) {
  const kopie = bestand.replace(/\.json$/, `.voor-ras.${new Date().toISOString().slice(0, 10)}.json`);
  if (!fs.existsSync(kopie)) fs.copyFileSync(bestand, kopie);
  fs.writeFileSync(bestand, JSON.stringify(entities, null, 2));
  console.log(`\ngeschreven; kopie van de oude stand in ${path.basename(kopie)}`);
} else if (!schrijf) {
  console.log('\n(proefdraai — voeg --schrijf toe om het echt te doen)');
}
