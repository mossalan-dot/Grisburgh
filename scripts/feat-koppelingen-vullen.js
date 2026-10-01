#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  FEAT-KOPPELINGEN INVULLEN
// ════════════════════════════════════════════════════════════════════════════
// Het klassekaartje in de Vaardighedentab laat zien welke feats op een klasse
// aansluiten, langs drie wegen: aangewezen door de DM, via de eis (een armor
// training die die klasse geeft) en via een spreuk die op haar lijst staat.
// Die laatste twee rekenen zichzelf uit — maar alleen als de feat weet wat hij
// vraagt en wat hij geeft, en dat staat nergens.
//
// Dit vult die twee velden voor de feats waarvan het **vaststaat**. Niet voor
// alle 67: waar ik het niet zeker weet blijft het leeg, want een verkeerde eis
// is erger dan geen eis — dan staat een feat bij een klasse die hem niet kan
// nemen, en daar kom je pas achter aan tafel.
//
// Het gaat om korte feitelijke gegevens (een eis, een spreuknaam), niet om de
// beschrijvingen: die blijven leeg voor alles wat niet in de SRD staat.
//
//   node scripts/feat-koppelingen-vullen.js <campagne> [--basis <pad>] [--schrijf]

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const vrij = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--basis');
const campagne = vrij[0];
const schrijfMode = args.includes('--schrijf');
const basisArg = args.includes('--basis') ? args[args.indexOf('--basis') + 1] : null;
if (!campagne) {
  console.error('Gebruik: node scripts/feat-koppelingen-vullen.js <campagne> [--basis <pad>] [--schrijf]');
  process.exit(1);
}
const base = basisArg || path.join(__dirname, '..', 'data', 'campaigns', campagne);
if (!fs.existsSync(base)) { console.error('Campagne niet gevonden: ' + base); process.exit(1); }

// ── Wat we zeker weten ──────────────────────────────────────────────────────
// `vereist`  — de eis zoals hij in de speltabel staat. De app leest er de
//              armor training uit; de rest is leesvoer voor de speler.
// `geeft`    — welke spreuk de feat oplevert. De app zoekt zelf op welke
//              klassenlijsten die spreuk staat.
// `aan`      — klassen handmatig aanwijzen. Alleen waar het niet uit te rekenen
//              valt: een feat die een spellcasting feature vraagt sluit aan op
//              iedereen die cast, en dát weten we uit klasse-basis.json.
const KOPPELINGEN = {
  // De vier armorfeats. Deze zijn de reden dat de koppeling "via de eis"
  // bestaat, en ze rekenen zichzelf helemaal uit.
  'Moderately Armored':  { vereist: 'Light armor training' },
  'Heavily Armored':     { vereist: 'Medium armor training' },
  'Medium Armor Master': { vereist: 'Medium armor training' },
  'Heavy Armor Master':  { vereist: 'Heavy armor training' },
  'Shield Master':       { vereist: 'Strength 13, Shield training' },

  // Feats die een spreuk geven. De klassen volgen uit de spreukenlijst.
  'Fey Touched':    { vereist: 'Intelligence, Wisdom of Charisma 13', geeft: ['Misty Step'] },
  'Shadow Touched': { vereist: 'Intelligence, Wisdom of Charisma 13', geeft: ['Invisibility'] },
  // Dezelfde feat, maar in sommige bibliotheken met een koppelteken geschreven.
  'Shadow-Touched': { vereist: 'Intelligence, Wisdom of Charisma 13', geeft: ['Invisibility'] },
  'Telekinetic':    { vereist: 'Intelligence, Wisdom of Charisma 13', geeft: ['Mage Hand'] },
  'Telepathic':     { vereist: 'Intelligence, Wisdom of Charisma 13', geeft: ['Detect Thoughts'] },

  // Feats die een spellcasting feature vragen: die sluiten aan op iedere
  // klasse die cast. Welke dat zijn staat in klasse-basis.json, dus die vullen
  // we hieronder uit dat bestand in plaats van ze hier op te schrijven.
  'War Caster':      { vereist: 'Een spellcasting- of pact magic-feature', castersAan: true },
  'Spell Sniper':    { vereist: 'Een spellcasting- of pact magic-feature', castersAan: true },
  'Elemental Adept': { vereist: 'Een spellcasting- of pact magic-feature', castersAan: true },

  // Wapenfeats met een duidelijke eis. Geen klassenkoppeling: iedereen met de
  // juiste score mag ze nemen, en wie martial wapens draagt zie je al aan de
  // wapentraining op het klassekaartje.
  'Great Weapon Master': { vereist: 'Strength 13' },
  'Crossbow Expert':     { vereist: 'Dexterity 13' },
  'Sharpshooter':        { vereist: 'Dexterity 13' },
  'Defensive Duelist':   { vereist: 'Dexterity 13' },
  'Dual Wielder':        { vereist: 'Dexterity 13' },
  'Mobile':              { vereist: 'Dexterity 13' },
  'Polearm Master':      { vereist: 'Strength of Dexterity 13' },
  'Sentinel':            { vereist: 'Strength of Dexterity 13' },
  'Charger':             { vereist: 'Strength of Dexterity 13' },
  'Grappler':            { vereist: 'Strength of Dexterity 13' },
  'Crusher':             { vereist: 'Strength of Constitution 13' },
  'Piercer':             { vereist: 'Strength of Dexterity 13' },
  'Slasher':             { vereist: 'Strength of Dexterity 13' },
  'Mage Slayer':         { vereist: 'Strength of Dexterity 13' },
  'Athlete':             { vereist: 'Strength of Dexterity 13' },
  'Durable':             { vereist: 'Constitution 13' },
  'Actor':               { vereist: 'Charisma 13' },
  'Inspiring Leader':    { vereist: 'Wisdom of Charisma 13' },
  'Observant':           { vereist: 'Intelligence of Wisdom 13' },
  'Keen Mind':           { vereist: 'Intelligence 13' },
  'Speedy':              { vereist: 'Dexterity 13' },
  'Ritual Caster':       { vereist: 'Intelligence, Wisdom of Charisma 13' },

  // De Origin Feats: die neem je op level 1 bij je achtergrond, en ze hebben
  // geen eis. Dat is óók informatie — zonder deze regels bleef er bij elk van
  // hen een leeg veld staan waarvan je niet weet of het "geen eis" betekent of
  // "nog niet ingevuld". `geenEis` zet er dus met zoveel woorden neer dat er
  // niets gevraagd wordt.
  'Alert':                 { geenEis: true },
  'Crafter':               { geenEis: true },
  'Healer':                { geenEis: true },
  'Lucky':                 { geenEis: true },
  'Magic Initiate':        { geenEis: true },
  'Savage Attacker':       { geenEis: true },
  'Skilled':               { geenEis: true },
  'Tavern Brawler':        { geenEis: true },
  'Tough':                 { geenEis: true },

  // General feats zonder eis. Ook hier geldt: het stáát er, dus het is bekend.
  'Ability Score Improvement': { geenEis: true },
  'Dungeon Delver':        { geenEis: true },
  'Martial Weapon Training': { geenEis: true },
  'Poisoner':              { geenEis: true },
  'Resilient':             { geenEis: true },
  'Skill Expert':          { geenEis: true },
  'Lightly Armored':       { geenEis: true },
};

// Elke Epic Boon vraagt level 19. Dat hoeft niet twaalf keer opgeschreven: wat
// in de `epic`-lijst staat ís er een.
const EPIC_EIS = 'Level 19';

const lees = (f, val) => {
  const p = path.join(base, f);
  if (!fs.existsSync(p)) return val;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return val; }
};

const prog = lees('progression.json', null);
if (!prog || !prog.feats) {
  console.error('Deze campagne heeft nog geen eigen featbibliotheek (progression.json → feats).');
  console.error('Open één feat in de Vaardighedentab en sla hem op; dan legt de app de bibliotheek aan.');
  process.exit(1);
}

const basisBestand = path.join(__dirname, '..', 'bronnen', 'klasse-basis.json');
const klasseBasis = JSON.parse(fs.readFileSync(basisBestand, 'utf8')).klassen || {};
const casters = Object.entries(klasseBasis).filter(([, v]) => v.castAbility).map(([k]) => k);

let gezet = 0, overgeslagen = [];
for (const sleutel of ['general', 'epic']) {
  for (const f of (prog.feats[sleutel] || [])) {
    const k = KOPPELINGEN[f.name];
    if (!k) {
      if (sleutel === 'epic') { f.vereist = EPIC_EIS; gezet++; continue; }
      overgeslagen.push(f.name); continue;
    }
    if (k.vereist) f.vereist = k.vereist;
    else if (k.geenEis) f.vereist = 'Geen eis';
    if (k.geeft?.length) f.geeftSpreuk = [...k.geeft];
    if (k.castersAan) f.sluitAan = [...casters];
    gezet++;
  }
}

console.log(`\nFeat-koppelingen voor "${campagne}":`);
console.log(`  ingevuld      ${gezet}`);
console.log(`  overgeslagen  ${overgeslagen.length}${overgeslagen.length ? ' — ' + overgeslagen.slice(0, 12).join(', ') + (overgeslagen.length > 12 ? ' …' : '') : ''}`);
console.log('\nDe overgeslagen feats hebben geen eis die vaststaat, of ik weet hem niet zeker.');
console.log('Die vul je zelf in bij de feat in de Vaardighedentab — veld "Vereist" en de klassenvinkjes.');

if (!schrijfMode) {
  console.log('\nProefdraai — niets geschreven. Voeg --schrijf toe om het echt te doen.');
  process.exit(0);
}
const doel = path.join(base, 'progression.json');
const bak = doel + '.voor-koppelingen.bak';
if (!fs.existsSync(bak)) fs.copyFileSync(doel, bak);
fs.writeFileSync(doel, JSON.stringify(prog, null, 2));
console.log(`\nGeschreven, met een backup ernaast (${path.basename(bak)}).`);
