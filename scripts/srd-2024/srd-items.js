#!/usr/bin/env node
// Standaard-uitrusting meeleveren, net als de statblokken en de spreuken.
//
// Van alles wat een DM nodig heeft leveren we het meegeleverde materiaal al:
// 331 monsters, 539 spreuken, class features, backgrounds, feats. Alleen
// **voorwerpen** niet — een nieuwe campagne begint op nul, en wie een smidse
// wil vullen tikt Club, Greatclub, Quarterstaff en zo nog tachtig regels met de
// hand over. In Grisburgh is dat ook precies wat er gebeurd is.
//
// De **SRD 5.2** staat onder CC BY 4.0 en mag dus mee, zoals `srd-monsters.js`
// en `srd-spelteksten.js` al doen. Dit script haalt de 440 voorwerpen op bij
// Open5e (document `srd-2024`) en schrijft ze in **onze** veldnamen weg, zodat
// de voorwerp-editor ze zonder vertaalslag kan invullen.
//
//   node scripts/srd-2024/srd-items.js [--schrijf]
//
// Wat het script bewust doet:
//  * **prijzen in onze munten.** Open5e geeft goudstukken als decimaal getal
//    ("0.10"); wij rekenen in centelingen (fl:kn:cl = 1:10:100), dus 0.10 gp
//    wordt "1 kn" en 25.00 gp wordt "25 fl". De muntnámen staan per campagne in
//    `meta.currency` — hier gebruiken we alleen de sleutels, zoals het hoort.
//  * **de categorie vertalen naar onze itemTypes.** Die vocabulaires lopen
//    bijna gelijk; de handvol dat afwijkt staat in KATEGORIE hieronder.
//  * **de werking meegeven.** Een wapen krijgt `attack`, een harnas `defense`.
//    Dat is precies wat `ITEM_TYPE_WERKING` in de editor ook zou voorstellen,
//    maar dan hoeft de DM niet te klikken.
//  * **niets verzinnen.** Een voorwerp zonder prijs krijgt geen prijs, en de
//    rariteit laten we leeg: de SRD-uitrusting is gewoon spul, en `rariteit`
//    kleurt het kaartje. Magische voorwerpen met een rariteit staan in een
//    andere Open5e-collectie en horen hier niet bij.

const fs   = require('fs');
const path = require('path');

const API  = 'https://api.open5e.com/v2/items/?document__key=srd-2024&limit=500';
const DOEL = path.join(__dirname, '..', '..', 'bronnen', 'srd-items.json');
const schrijf = process.argv.includes('--schrijf');

// Open5e-categorie → ons itemType (zie ITEM_TYPE_GROEPEN in render-campagne.js).
// Wat er niet in staat komt één-op-één over.
const KATEGORIE = {
  'Waterborne Vehicle': 'Vehicle',
  'Land Vehicle':       'Vehicle',
  'Mount':              'Vehicle',
  'Equipment Pack':     'Adventuring Gear',
  'Spellcasting Focus': 'Adventuring Gear',
  'Wondrous Item':      'Wondrous item',   // onze waarde heeft een kleine i
};

// Deze twee tellen als stapelbaar: je hebt er twintig van, niet één.
const STAPELBAAR = new Set(['Ammunition', 'Poison', 'Potion']);

function prijsUitGp(cost) {
  if (cost === null || cost === undefined || cost === '') return '';
  const gp = Number(cost);
  if (!Number.isFinite(gp) || gp <= 0) return '';
  const cl = Math.round(gp * 100);                 // 1 gp = 100 cl
  const fl = Math.floor(cl / 100);
  const kn = Math.floor((cl % 100) / 10);
  const rest = cl % 10;
  return [fl && `${fl} fl`, kn && `${kn} kn`, rest && `${rest} cl`].filter(Boolean).join(' ');
}

function wapenVelden(w) {
  if (!w) return {};
  const uit = {};
  if (w.damage_dice) {
    const soort = w.damage_type?.name ? ' ' + String(w.damage_type.name).toLowerCase() : '';
    uit.damage = w.damage_dice + soort;
  }
  const props = (w.properties || [])
    .map(p => {
      const naam = p?.property?.name;
      if (!naam) return null;
      // "Versatile (1d10)" — het detail staat los van de naam.
      return p.detail ? `${naam} (${p.detail})` : naam;
    })
    .filter(Boolean);
  if (props.length) uit.weaponProperties = props.join(', ');
  return uit;
}

// Een schild is geen zwaar harnas. Open5e zet de Shield onder categorie *Armor*
// met `category: "heavy"` en `ac_base: 2` — dat leest als een harnas dat je op
// AC 2 zet in plaats van een schild dat er +2 bij doet. Wij hebben er een eigen
// itemType en een eigen `armorType: 'shield'` voor, dus daar hoort hij.
// (Er staat bovendien een tweede, lege Shield onder categorie *Shield*; die
// valt hieronder weg bij het ontdubbelen.)
const isSchild = (r) => /(^|_)shield$/i.test(r.key || '') || /^shield$/i.test(r.name || '');

function harnasVelden(a, schild) {
  if (!a) return {};
  const uit = {};
  if (schild) uit.armorType = 'shield';
  else if (a.category) uit.armorType = String(a.category).toLowerCase();
  if (Number.isFinite(a.ac_base)) uit.armorBaseAC = a.ac_base;
  if (a.ac_cap_dexmod !== null && a.ac_cap_dexmod !== undefined) uit.armorDexCap = a.ac_cap_dexmod;
  if (a.grants_stealth_disadvantage) uit.stealthDisadvantage = true;
  if (a.strength_score_required) uit.strengthRequirement = a.strength_score_required;
  return uit;
}

(async () => {
  console.log('Ophalen bij Open5e…');
  const res = await fetch(API);
  if (!res.ok) { console.error('Open5e gaf ' + res.status); process.exit(1); }
  const data = await res.json();
  const rauw = data.results || [];
  console.log(`  ${rauw.length} voorwerpen (van ${data.count} gemeld)`);

  const items = rauw.map(r => {
    const cat    = r.category?.name || '';
    const schild = isSchild(r);
    const type   = schild ? 'Shield' : (KATEGORIE[cat] || cat);
    const w = wapenVelden(r.weapon);
    const a = harnasVelden(r.armor, schild);

    // De werking zegt wat een voorwerp dóét; het type zegt wat het ís.
    const werking = [];
    if (w.damage) werking.push('attack');
    if (a.armorBaseAC !== undefined || type === 'Shield') werking.push('defense');

    const uit = {
      key:  r.key,
      name: r.name,
      itemType: type,
      ...(prijsUitGp(r.cost) ? { prijs: prijsUitGp(r.cost) } : {}),
      ...(r.weight && Number(r.weight) > 0 ? { gewicht: `${Number(r.weight)} ${r.weight_unit || 'lb'}` } : {}),
      ...(r.desc ? { desc: String(r.desc).trim() } : {}),
      ...w, ...a,
      ...(werking.length ? { werking } : {}),
      ...(STAPELBAAR.has(type) ? { gebruik: 'stapelbaar' } : {}),
    };
    return uit;
  });

  // Ontdubbelen op naam: bij twee regels met dezelfde naam houden we die met de
  // meeste ingevulde velden. Dat treft in de SRD alleen de Shield, maar het is
  // een eerlijker regel dan "de eerste wint".
  const perNaam = new Map();
  for (const i of items) {
    const k = i.name.toLowerCase();
    const bestaand = perNaam.get(k);
    if (!bestaand || Object.keys(i).length > Object.keys(bestaand).length) perNaam.set(k, i);
  }
  const ontdubbeld = [...perNaam.values()].sort((x, y) => x.name.localeCompare(y.name, 'en'));
  if (ontdubbeld.length !== items.length) {
    console.log(`  ${items.length - ontdubbeld.length} dubbele naam/namen samengevoegd`);
  }
  items.length = 0; items.push(...ontdubbeld);

  // Even laten zien wat eruit komt, want dat is waar je het aan afmeet.
  const perType = {};
  for (const i of items) perType[i.itemType] = (perType[i.itemType] || 0) + 1;
  console.log('\nPer type:');
  for (const [t, n] of Object.entries(perType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${t}`);
  }
  const metPrijs  = items.filter(i => i.prijs).length;
  const metSchade = items.filter(i => i.damage).length;
  const metAc     = items.filter(i => i.armorBaseAC !== undefined).length;
  console.log(`\nmet prijs: ${metPrijs} · met schadeformule: ${metSchade} · met Base AC: ${metAc}`);
  console.log('\nVoorbeelden:');
  for (const n of ['Battleaxe', 'Breastplate', 'Shield', 'Rope, Hempen (50 feet)', 'Arrows (20)']) {
    const i = items.find(x => x.name === n);
    if (i) console.log('  ' + JSON.stringify(i).slice(0, 190));
  }

  if (!schrijf) { console.log('\n(proefdraai — voeg --schrijf toe)'); return; }
  fs.writeFileSync(DOEL, JSON.stringify({
    bron: 'System Reference Document 5.2 (CC BY 4.0), via Open5e',
    opgehaald: new Date().toISOString().slice(0, 10),
    items,
  }, null, 1));
  const kb = Math.round(fs.statSync(DOEL).size / 1024);
  console.log(`\nGeschreven: bronnen/srd-items.json (${items.length} voorwerpen, ${kb} kB)`);
})();
