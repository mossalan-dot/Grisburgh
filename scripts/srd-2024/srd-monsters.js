#!/usr/bin/env node
// Standaard-statblokken meeleveren in plaats van live ophalen.
//
// De monster-editor had een SRD-import die tijdens het spelen naar
// `dnd5eapi.co` belde: een externe host in het pad van een DM die om zeven uur
// 's avonds een wachtpost nodig heeft. Bovendien is dat de SRD van 2014.
//
// De **SRD 5.2** staat onder CC BY 4.0 — die mogen we gewoon meeleveren, net
// als de spreukteksten (zie `srd-spelteksten.js`). Dit script haalt de 331
// wezens op bij Open5e (document `srd-2024`) en schrijft ze in ónze
// statblokvorm weg, zodat kaartje, monster-editor en tier-editor er zonder
// vertaalslag mee kunnen werken.
//
//   node scripts/srd-2024/srd-monsters.js [--schrijf]
const fs   = require('fs');
const path = require('path');

const API  = 'https://api.open5e.com/v2/creatures/?document__key=srd-2024&limit=500';
const DOEL = path.join(__dirname, '..', '..', 'bronnen', 'srd-monsters.json');

// De generieke NPC-statblokken uit de SRD: een wachtpost, een piraat, een
// burger. Dat is waar een DM een kaartje mee vult, en daarom krijgen ze een
// vlag zodat de kiezer ze bovenaan kan zetten. De rest (draken, beesten) blijft
// gewoon vindbaar, alleen niet als eerste voorstel — een herbergier is geen
// Aboleth.
const NPC_NAMEN = new Set([
  'Commoner', 'Guard', 'Guard Captain', 'Bandit', 'Bandit Captain',
  'Pirate', 'Pirate Captain', 'Priest', 'Priest Acolyte', 'Noble', 'Knight',
  'Scout', 'Spy', 'Assassin', 'Berserker', 'Cultist', 'Cultist Fanatic',
  'Warrior Infantry', 'Warrior Veteran', 'Mage', 'Archmage', 'Druid', 'Gladiator',
  'Tough', 'Tough Boss', 'Vampire Familiar',
]);

// ── Drie dingen die we bij Open5e rechtzetten ──────────────────────────────
// Ze zijn niet incidenteel maar systematisch, dus corrigeren is hier eerlijker
// dan overnemen.
//
// 1. `armor_detail` staat op **"natural armor" bij 330 van de 331** wezens.
//    Dat is een standaardwaarde die is blijven staan, geen gegeven: een Guard
//    draagt een chain shirt. We laten hem helemaal weg — en dat klopt ook met
//    de 2024-vorm, waar een statblok gewoon "AC 16" schrijft zonder toelichting.
//
// 2. `speed_all` vult de afgeleide snelheden in die in 2024 voor iedereen
//    gelden (kruipen, klimmen en zwemmen op de helft). Een Guard kreeg zo
//    "30 ft., crawl 15 ft., climb 15 ft., swim 15 ft.". Het kale veld `speed`
//    bevat wat er écht staat.
//
// 3. `size` is "Small" bij **alle 26 humanoids**, óók bij Knight en Archmage.
//    Dat klopt niet: de SRD schrijft daar "Small or Medium", omdat de statblok
//    voor elk volk kan gelden. Maar zo zetten we het er niet in. Een preset
//    vult het statblok van één personage, en op dat blad ís de keuze gemaakt —
//    deze wachtpost is een mens, geen gnoom. "Small or Medium" hoort bij een
//    sjabloon, niet bij een exemplaar; **Medium** is de maat waar het gros van
//    de NPC's op uitkomt en is met één klik te wijzigen.
//    Bij de rest (Goblin Warrior is écht Small) laten we het staan.
const NPC_MAAT = 'Medium';

const ABIL = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const KORT = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

const titel = (s) => String(s || '').replace(/_/g, ' ').replace(/\b[a-z]/g, c => c.toUpperCase());
const teken = (n) => (n >= 0 ? '+' : '') + n;

// "{walk:30, swim:40}" → "30 ft., swim 40 ft." — lopen zonder woord ervoor,
// precies zoals een statblok het schrijft.
function snelheid(sp) {
  if (!sp) return '';
  const eenheid = sp.unit === 'feet' ? 'ft.' : (sp.unit || '');
  const delen = [];
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'unit' || k === 'hover' || !v) continue;
    delen.push(k === 'walk' ? `${v} ${eenheid}` : `${k} ${v} ${eenheid}`);
  }
  if (sp.hover) delen.push('hover');
  return delen.join(', ');
}

// Alleen de saves waar het wezen écht beter in is. Een 2024-statblok geeft alle
// zes, maar wie er niet in geoefend is heeft daar gewoon zijn modifier staan —
// dat opschrijven maakt de regel lang zonder iets te zeggen.
function saves(sv, mods) {
  if (!sv || !mods) return '';
  return ABIL.filter(a => (sv[a] ?? 0) !== (mods[a] ?? 0))
    .map(a => `${KORT[a]} ${teken(sv[a])}`).join(', ');
}

function vaardigheden(sb) {
  if (!sb) return '';
  return Object.entries(sb).map(([k, v]) => `${titel(k)} ${teken(v)}`).join(', ');
}

function zintuigen(c) {
  const d = [];
  if (c.blindsight_range)    d.push(`blindsight ${c.blindsight_range} ft.`);
  if (c.darkvision_range)    d.push(`darkvision ${c.darkvision_range} ft.`);
  if (c.tremorsense_range)   d.push(`tremorsense ${c.tremorsense_range} ft.`);
  if (c.truesight_range)     d.push(`truesight ${c.truesight_range} ft.`);
  if (c.passive_perception != null) d.push(`passive Perception ${c.passive_perception}`);
  return d.join(', ');
}

// Onze traits en acties zijn markdown-tekst, één blok per regel: "***Naam.***
// beschrijving", gescheiden door een lege regel. Zo leest renderStatblock ze.
const blok = (lijst) => lijst.map(a => `***${a.name}.*** ${String(a.desc || '').trim()}`).join('\n\n');

// Proficiency bonus uit CR: +2 tot en met CR 4, daarna per vier CR eentje erbij.
const pb = (crWaarde) => Math.max(2, 2 + Math.floor((Math.max(1, Number(crWaarde) || 0) - 1) / 4));

// Een CR van 0.5 hoort als 1/2 op het blad.
function cr(waarde) {
  const n = Number(waarde);
  if (!isFinite(n)) return String(waarde ?? '');
  if (n === 0.125) return '1/8';
  if (n === 0.25)  return '1/4';
  if (n === 0.5)   return '1/2';
  return String(n);
}

function naarStatblok(c, isNpc) {
  const ab   = c.ability_scores || {};
  const ri   = c.resistances_and_immunities || {};
  const acts = (c.actions || []).slice().sort((a, b) => (a.order_in_statblock ?? 0) - (b.order_in_statblock ?? 0));
  const van  = (type) => acts.filter(a => a.action_type === type);

  return {
    size:                  isNpc ? NPC_MAAT : (c.size?.name || ''),
    type:                  c.type?.name || '',
    alignment:             c.alignment || '',
    ac:                    String(c.armor_class ?? ''),
    hp:                    `${c.hit_points ?? ''}${c.hit_dice ? ` (${c.hit_dice})` : ''}`.trim(),
    speed:                 snelheid(c.speed),
    str: ab.strength ?? 10, dex: ab.dexterity ?? 10, con: ab.constitution ?? 10,
    int: ab.intelligence ?? 10, wis: ab.wisdom ?? 10, cha: ab.charisma ?? 10,
    savingThrows:          saves(c.saving_throws, c.modifiers),
    skills:                vaardigheden(c.skill_bonuses),
    damageVulnerabilities: ri.damage_vulnerabilities_display || '',
    damageResistances:     ri.damage_resistances_display     || '',
    damageImmunities:      ri.damage_immunities_display      || '',
    conditionImmunities:   ri.condition_immunities_display   || '',
    senses:                zintuigen(c),
    languages:             c.languages?.as_string || '',
    cr:                    cr(c.challenge_rating),
    xp:                    c.experience_points ?? 0,
    // Ons blad heeft een eigen vakje voor de proficiency bonus. Open5e laat het
    // veld bij 330 van de 331 leeg, maar hij ligt vast in de regels: 2 tot en
    // met CR 4, en daarna elke vier CR eentje erbij. Zelf rekenen dus.
    profBonus:             teken(c.proficiency_bonus || pb(c.challenge_rating)),
    initiative:            String(10 + Math.floor((((c.ability_scores || {}).dexterity ?? 10) - 10) / 2)),
    traits:                blok(c.traits || []),
    actions:               blok(van('ACTION')),
    reactions:             blok(van('REACTION')),
    legendaryActions:      blok(van('LEGENDARY_ACTION')),
  };
}

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  let url = API, alles = [];
  while (url) {
    const d = await fetch(url).then(r => r.json());
    alles = alles.concat(d.results || []);
    url = d.next;
  }
  alles.sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const uit = alles.map(c => {
    const npc = NPC_NAMEN.has(c.name);
    return {
      key:        c.key,
      name:       c.name,
      npc,
      cr:         cr(c.challenge_rating),
      maxHp:      c.hit_points ?? 10,
      initiative: 10 + Math.floor((((c.ability_scores || {}).dexterity ?? 10) - 10) / 2),
      statblock:  naarStatblok(c, npc),
    };
  });

  const gevonden = uit.filter(m => m.npc).map(m => m.name);
  const gemist   = [...NPC_NAMEN].filter(n => !gevonden.includes(n));
  console.log(`${uit.length} wezens uit SRD 5.2`);
  console.log(`NPC-presets: ${gevonden.length} — ${gevonden.join(', ')}`);
  if (gemist.length) console.log(`! niet gevonden onder die naam: ${gemist.join(', ')}`);
  const leeg = uit.filter(m => !m.statblock.actions && !m.statblock.traits).map(m => m.name);
  if (leeg.length) console.log(`! zonder traits én actions (${leeg.length}): ${leeg.slice(0, 8).join(', ')}`);

  if (!schrijf) { console.log('\n(niets geschreven — draai met --schrijf)'); return; }
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1));
  console.log(`\nGeschreven: ${DOEL} (${(fs.statSync(DOEL).size / 1024).toFixed(0)} kB)`);
})();
