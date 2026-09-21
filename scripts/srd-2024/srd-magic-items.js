#!/usr/bin/env node
// De 757 magische voorwerpen uit de SRD 5.2 meeleveren — als **bron om uit te
// putten**, niet als kaartjes die er al staan.
//
// Dat verschil is met opzet. Spreuken en feats zijn een bibliotheek die je
// doorbladert: die horen er compleet te staan. Een magisch voorwerp is een
// kaartje in jóuw campagne — het heeft een eigenaar, een plek, een geschiedenis
// en vaak een eigen naam. Zevenhonderd voorgekookte kaartjes zouden het archief
// onbruikbaar maken. Dus werkt dit zoals het statblok-preset bij een personage:
// je maakt een kaartje aan, haalt er een bestaand voorwerp in, en schaaft bij.
//
//   node scripts/srd-2024/srd-magic-items.js [--schrijf]
//
// Let op: Open5e's `document__key`-filter doet op dit endpoint niets — je
// krijgt altijd alle 2319 terug. We filteren daarom zelf op `srd-2024`, want
// alleen díé staan onder CC BY 4.0. Zonder die zeef zouden er teksten uit
// andere documenten meeglippen.

const fs   = require('fs');
const path = require('path');

const API  = 'https://api.open5e.com/v2/magicitems/?limit=2500';
const DOEL = path.join(__dirname, '..', '..', 'bronnen', 'srd-magic-items.json');
const schrijf = process.argv.includes('--schrijf');

// Open5e-categorie → ons itemType.
const KATEGORIE = { 'Wondrous Item': 'Wondrous item' };

function wapenVelden(w) {
  if (!w) return {};
  const uit = {};
  if (w.damage_dice) {
    const soort = w.damage_type?.name ? ' ' + String(w.damage_type.name).toLowerCase() : '';
    uit.damage = w.damage_dice + soort;
  }
  const props = (w.properties || [])
    .map(p => (p?.property?.name ? (p.detail ? `${p.property.name} (${p.detail})` : p.property.name) : null))
    .filter(Boolean);
  if (props.length) uit.weaponProperties = props.join(', ');
  return uit;
}

function harnasVelden(a) {
  if (!a) return {};
  const uit = {};
  if (a.category) uit.armorType = String(a.category).toLowerCase();
  if (Number.isFinite(a.ac_base)) uit.armorBaseAC = a.ac_base;
  if (a.ac_cap_dexmod !== null && a.ac_cap_dexmod !== undefined) uit.armorDexCap = a.ac_cap_dexmod;
  if (a.grants_stealth_disadvantage) uit.stealthDisadvantage = true;
  if (a.strength_score_required) uit.strengthRequirement = a.strength_score_required;
  return uit;
}

// "Requires Attunement by a Paladin" → "een Paladin". Het vinkje zegt al dát
// het nodig is; dit veld heet bij ons *Attunement alleen door*, dus de aanhef
// eraf.
function attunementEis(detail) {
  if (!detail) return '';
  return String(detail).replace(/^requires attunement\s*(by\s*)?/i, '').trim();
}

(async () => {
  console.log('Ophalen bij Open5e…');
  const res = await fetch(API);
  if (!res.ok) { console.error('Open5e gaf ' + res.status); process.exit(1); }
  const data = await res.json();
  const alles = data.results || [];
  const rauw  = alles.filter(r => r.document?.key === 'srd-2024');
  console.log(`  ${alles.length} opgehaald, ${rauw.length} uit de SRD 5.2`);
  if (rauw.length < 700) { console.error('Dat zijn er verdacht weinig — niet wegschrijven.'); process.exit(1); }

  const items = rauw.map(r => {
    const cat  = r.category?.name || 'Wondrous item';
    const type = KATEGORIE[cat] || cat;
    const w = wapenVelden(r.weapon);
    const a = harnasVelden(r.armor);
    const werking = [];
    if (w.damage) werking.push('attack');
    if (a.armorBaseAC !== undefined) werking.push('defense');

    const eis = attunementEis(r.attunement_detail);
    return {
      key:  r.key,
      name: r.name,
      itemType: type,
      magisch: true,
      // De rariteit kleurt het kaartje; dat is bij een magisch voorwerp het
      // eerste wat je wil zien. 'Artifact' laten we staan zoals het er staat —
      // hij komt één keer voor, en er iets anders van maken zou liegen.
      ...(r.rarity?.name ? { rariteit: r.rarity.name } : {}),
      ...(r.requires_attunement ? { attunement: true } : {}),
      ...(eis ? { attunementEis: eis } : {}),
      ...(r.desc ? { desc: String(r.desc).trim() } : {}),
      ...w, ...a,
      ...(werking.length ? { werking } : {}),
    };
  });

  // Ontdubbelen op naam, zoals bij de uitrusting: bij twee regels houden we die
  // met de meeste ingevulde velden.
  const perNaam = new Map();
  for (const i of items) {
    const k = i.name.toLowerCase();
    const b = perNaam.get(k);
    if (!b || Object.keys(i).length > Object.keys(b).length) perNaam.set(k, i);
  }
  const uit = [...perNaam.values()].sort((x, y) => x.name.localeCompare(y.name, 'en'));
  if (uit.length !== items.length) console.log(`  ${items.length - uit.length} dubbele naam/namen samengevoegd`);

  const per = {};
  for (const i of uit) per[i.itemType] = (per[i.itemType] || 0) + 1;
  console.log('\nPer type:');
  for (const [t, n] of Object.entries(per).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${t}`);
  const rar = {};
  for (const i of uit) rar[i.rariteit || '—'] = (rar[i.rariteit || '—'] || 0) + 1;
  console.log('Per rariteit:', Object.entries(rar).map(([k, n]) => `${k}: ${n}`).join(' · '));
  console.log(`attunement: ${uit.filter(i => i.attunement).length} · met eis: ${uit.filter(i => i.attunementEis).length}`);
  console.log('\nVoorbeelden:');
  for (const n of ['Bag of Holding', 'Flame Tongue Longsword', 'Cloak of Elvenkind', 'Adamantine Armor (Plate)']) {
    const i = uit.find(x => x.name === n);
    if (i) console.log('  ' + JSON.stringify({ ...i, desc: (i.desc || '').slice(0, 40) + '…' }).slice(0, 210));
  }

  if (!schrijf) { console.log('\n(proefdraai — voeg --schrijf toe)'); return; }
  fs.writeFileSync(DOEL, JSON.stringify({
    bron: 'System Reference Document 5.2 (CC BY 4.0), via Open5e',
    opgehaald: new Date().toISOString().slice(0, 10),
    items: uit,
  }, null, 1));
  console.log(`\nGeschreven: bronnen/srd-magic-items.json (${uit.length} voorwerpen, ${Math.round(fs.statSync(DOEL).size / 1024)} kB)`);
})();
