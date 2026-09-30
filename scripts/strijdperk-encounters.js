#!/usr/bin/env node
// Het strijdperk van het gokhuis had zes partijen met een naam en een prijs,
// maar geen gevecht eronder: de DM moest de tegenstander ter plekke bij elkaar
// zoeken. Dit zet er per partij een encounter onder, met een statblock uit de
// SRD dat bij de beschreven tegenstander past, en koppelt hem aan de partij.
//
// De partijen zelf (namen, inleg, prijzengeld) blijven zoals ze zijn — dat is
// de fictie van deze campagne. Wat hier bijkomt is de mechaniek eronder.
//
//   node scripts/strijdperk-encounters.js <campagne> [--schrijf]
const fs   = require('fs');
const path = require('path');

const args     = process.argv.slice(2);
const campagne = args.find(a => !a.startsWith('--'));
const schrijf  = args.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/strijdperk-encounters.js <campagne> [--schrijf]');
  process.exit(1);
}

// Per partij: welk SRD-wezen is deze tegenstander, en hoeveel ervan.
// De ladder loopt van CR 2 naar CR 8; het laatste perk is de verborgen eindbaas.
const LADDER = {
  bout_berserker:  { srd: 'Berserker',            aantal: 1 },
  bout_minotaur:   { srd: 'Minotaur of Baphomet', aantal: 1 },
  bout_gladiator:  { srd: 'Gladiator',            aantal: 1 },
  bout_cyclops:    { srd: 'Hill Giant',           aantal: 1 },   // geen Cyclops in de SRD
  bout_frostgiant: { srd: 'Frost Giant',          aantal: 1 },
  // Eén tegenstander, want "De Naamloze" is een hij en geen zij. En een golem
  // verdient die naam ook echt: hij heeft er geen omdat er niemand in zit. Twee
  // trollen (CR 5 elk) stonden hier eerst, en dat was op twee manieren mis — het
  // meervoud, en een ladder die bovenaan terugzakte onder de Frost Giant (CR 8).
  bout_naamloze:   { srd: 'Stone Golem',          aantal: 1 },
};

const dir  = path.join(__dirname, '..', 'data', 'campaigns', campagne);
const paden = {
  meta:       path.join(dir, 'meta.json'),
  monsters:   path.join(dir, 'monsters.json'),
  encounters: path.join(dir, 'encounters.json'),
};
for (const [k, p] of Object.entries(paden)) {
  if (!fs.existsSync(p)) { console.error(`Niet gevonden: ${p} (${k})`); process.exit(1); }
}

const srd        = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bronnen', 'srd-monsters.json'), 'utf8'));
const meta       = JSON.parse(fs.readFileSync(paden.meta, 'utf8'));
const monsters   = JSON.parse(fs.readFileSync(paden.monsters, 'utf8'));
const encounters = JSON.parse(fs.readFileSync(paden.encounters, 'utf8'));
if (!Array.isArray(monsters.monsters))     monsters.monsters = [];
if (!Array.isArray(encounters.encounters)) encounters.encounters = [];

const arena = meta.tweespalt?.arena || [];
if (!arena.length) { console.error('Deze campagne heeft geen partijen in het strijdperk.'); process.exit(1); }

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let nieuweMonsters = 0, nieuweEncounters = 0, gekoppeld = 0;

for (const bout of arena) {
  const recept = LADDER[bout.id];
  if (!recept) { console.log(`  ${bout.naam}: geen recept — overgeslagen`); continue; }

  const bron = srd.find(m => m.name === recept.srd);
  if (!bron) { console.log(`  ${bout.naam}: "${recept.srd}" staat niet in de SRD — overgeslagen`); continue; }

  // 1) Het statblock in de monsterbibliotheek van deze campagne
  const monsterId = `m_arena_${slug(bron.name)}`;
  if (!monsters.monsters.some(m => m.id === monsterId)) {
    monsters.monsters.push({
      id: monsterId,
      name: bron.name,
      maxHp: bron.maxHp,
      initiative: bron.initiative ?? 10,
      imageId: null, backdropId: null,
      // Geen `chapter`: dit wezen hoort bij een dienst, niet bij een akte.
      statblock: { ...bron.statblock, cr: bron.cr, xp: bron.xp },
      // Het strijdperk is geen wildernis: deze wezens horen niet in het
      // bestiarium te verschijnen als "ontdekt" zodra de party ze ziet.
      inBestiarium: true,
    });
    nieuweMonsters++;
  }

  // 2) De encounter, met de naam van de partij ervoor
  const encId = `enc_arena_${bout.id.replace(/^bout_/, '')}`;
  if (!encounters.encounters.some(e => e.id === encId)) {
    encounters.encounters.push({
      id: encId,
      name: `${bout.naam} — ${bout.tegenstander || bron.name}`,
      akteId: null, backdropId: null,
      canvasPreset: 'plain', canvasColors: null,
      monsters: [{
        // De naam van de tegenstander staat vooraan: in het gevecht heet hij
        // Gorgo Hoornkop en niet "Minotaur of Baphomet".
        name: bout.tegenstander || bron.name,
        count: recept.aantal,
        initiative: bron.initiative ?? 10,
        hp: bron.maxHp,
        monsterId,
      }],
    });
    nieuweEncounters++;
    console.log(`  ${bout.naam}: ${bout.tegenstander || '—'} = ${recept.aantal}× ${bron.name} (CR ${bron.cr})`);
  }

  // 3) De partij wijst naar zijn gevecht
  if (bout.encounterId !== encId) { bout.encounterId = encId; gekoppeld++; }
}

console.log(`\n${nieuweMonsters} statblock(s), ${nieuweEncounters} encounter(s), ${gekoppeld} partij(en) gekoppeld.`);
if (!schrijf) { console.log('(proefdraai — voeg --schrijf toe om het door te voeren)'); process.exit(0); }

for (const [p, data] of [[paden.monsters, monsters], [paden.encounters, encounters], [paden.meta, meta]]) {
  const bak = p + '.voor-strijdperk.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(p, bak);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}
console.log('Geschreven, met backups ernaast (*.voor-strijdperk.bak).');
