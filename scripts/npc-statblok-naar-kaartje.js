#!/usr/bin/env node
// Eén plek per persoon.
//
// Genoemde NPC's stonden twee keer: als personagekaartje (met `stats`) én als
// los monster in de bibliotheek (met `statblock`, `inBestiarium: false`). Die
// twee liepen uit elkaar — Barthen had 36 HP op zijn kaartje en 11 in de
// bibliotheek. Dit script maakt het kaartje de waarheid en hangt het
// bibliotheekrecord eraan vast (`entityId`), zodat het voortaan meeschrijft
// zodra je het kaartje opslaat (`_syncMonsterVanKaartje`).
//
// Het **id van het monster blijft** staan: encounters verwijzen ernaar.
//
// Samenvoegen, niet overschrijven: de twee vormen bevatten elk iets dat de
// ander mist (het kaartje kent profBonus en spreuken, het monster kent size,
// alignment en XP). Lege velden op het kaartje worden aangevuld.
//
// Waar ze allebei gevuld zijn maar iets ánders zeggen, wint het kaartje — en
// wordt het verschil gemeld. Bij vijf NPC's gaat dat over inhoud en niet over
// opmaak (Ursûn Rogarr heeft op zijn kaartje AC 16 met Arcane Armor en INT 20,
// en in de bibliotheek AC 14 met hide armor en INT 15). Die bibliotheekversie
// wordt bewust **niet** automatisch een tier: een tier maak je zelf, in de
// tier-editor op het kaartje. De oude waarden staan in de kopie die dit script
// ernaast zet. Verschillen die alleen opmaak zijn ("16 (+3)" tegen "16",
// "25 ft." tegen "25 ft") worden niet eens gemeld.
//
// Troepen zonder kaartje (Maenfortmatroos, Wervelingbootsman…) blijven gewoon
// losse bibliotheekmonsters; die hoeven geen kaartje.
//
//   node scripts/npc-statblok-naar-kaartje.js <campagne> [--schrijf]
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/npc-statblok-naar-kaartje.js <campagne> [--schrijf]'); process.exit(1); }

const map = path.join(__dirname, '..', 'data', 'campaigns', campagne);
const lees = (n) => JSON.parse(fs.readFileSync(path.join(map, n), 'utf8'));

const entities = lees('entities.json');
const monsters = lees('monsters.json');
const lijst = monsters.monsters || [];

// monster-statblock → kaartje-stats. Wat niet in deze tabel staat heet aan
// beide kanten hetzelfde.
const VELD = {
  type: 'creatureType',
  damageVulnerabilities: 'vulnerabilities',
  damageResistances: 'resistances',
  damageImmunities: 'immunities',
};
const GELIJK = ['size', 'ac', 'hp', 'speed', 'str', 'dex', 'con', 'int', 'wis', 'cha',
                'savingThrows', 'skills', 'conditionImmunities', 'senses', 'languages',
                'traits', 'actions', 'reactions', 'legendaryActions', 'cr', 'xp'];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const gevuld = (v) => String(v ?? '').trim() !== '';

// Vergelijken zonder de ruis: hoofdletters, spaties, markdown, de losse
// modifier tussen haakjes ("16 (+3)" → 16) en de eenheid achter een getal.
const kern = (v) => String(v ?? '')
  .toLowerCase()
  .replace(/\(\s*[+-]?\d+\s*\)/g, ' ')
  .replace(/\bft\.?\b|\bvoet\b|\bm\b/g, ' ')
  .replace(/[*_`#]/g, ' ')
  .replace(/[^a-z0-9]/g, '');
const zelfde = (a, b) => kern(a) === kern(b) || (parseInt(a, 10) === parseInt(b, 10) && Number.isFinite(parseInt(a, 10)));
const opNaam = new Map((entities.personages || []).map(p => [norm(p.name), p]));

const gekoppeld = [];
const zonderKaartje = [];
const verschillen = [];

for (const m of lijst) {
  if (m.inBestiarium !== false || m.entityId) continue;
  const kaart = opNaam.get(norm(m.name));
  if (!kaart) { zonderKaartje.push(m.name); continue; }

  const sb = m.statblock || {};
  kaart.stats = { ...(kaart.stats || {}) };
  let gevuldMet = 0;

  for (const bron of [...GELIJK, ...Object.keys(VELD)]) {
    const doel = VELD[bron] || bron;
    if (!gevuld(sb[bron])) continue;
    if (!gevuld(kaart.stats[doel])) { kaart.stats[doel] = sb[bron]; gevuldMet++; }
    else if (!zelfde(kaart.stats[doel], sb[bron])) {
      verschillen.push(`${m.name} · ${doel}: kaartje "${String(kaart.stats[doel]).slice(0, 40)}" / bibliotheek "${String(sb[bron]).slice(0, 40)}"`);
    }
  }

  // Vanaf nu is het kaartje de bron: het bibliotheekrecord hangt eraan vast en
  // wordt hieronder in dezelfde vorm gezet als _syncMonsterVanKaartje doet.
  m.entityId = kaart.id;
  m.name = kaart.name;
  const getal = (v) => parseInt(String(v ?? '').match(/-?\d+/)?.[0] ?? '', 10) || 0;
  const nieuwSb = { ...kaart.stats };
  for (const [bron, doel] of Object.entries(VELD)) {
    if (gevuld(nieuwSb[doel])) { nieuwSb[bron] = nieuwSb[doel]; delete nieuwSb[doel]; }
  }
  if (gevuld(kaart.data?.alignment)) nieuwSb.alignment = kaart.data.alignment;
  m.statblock = nieuwSb;
  m.maxHp = getal(kaart.stats.hp) || m.maxHp;
  m.imageId = kaart.data?.imageId || m.imageId || null;
  m.description = kaart.data?.desc || m.description || '';

  gekoppeld.push(`${m.name} (${gevuldMet} veld${gevuldMet === 1 ? '' : 'en'} vanuit de bibliotheek aangevuld)`);
}

console.log(`${campagne}: ${gekoppeld.length} NPC's gekoppeld aan hun kaartje`);
for (const r of gekoppeld) console.log(` · ${r}`);
if (verschillen.length) {
  console.log(`\n${verschillen.length} veld(en) waar de twee iets anders zeggen; het kaartje blijft leidend:`);
  for (const r of verschillen) console.log(` ! ${r}`);
}
if (zonderKaartje.length) {
  console.log(`\nGeen kaartje, blijven losse bibliotheekmonsters (${zonderKaartje.length}): ${zonderKaartje.join(', ')}`);
}

if (schrijf) {
  const stempel = new Date().toISOString().slice(0, 10);
  for (const [naam, data] of [['entities.json', entities], ['monsters.json', monsters]]) {
    const p = path.join(map, naam);
    fs.copyFileSync(p, p.replace(/\.json$/, `.voor-npcstatblok.${stempel}.json`));
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  }
  console.log('\nGeschreven (kopie ernaast als .voor-npcstatblok.<datum>.json)');
} else {
  console.log('\nProefdraai — geef --schrijf om het door te voeren.');
}
