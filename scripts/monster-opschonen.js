#!/usr/bin/env node
// Rommel van de oude SRD-importer uit de monsterbibliotheek halen.
//
// Tot september 2026 haalde de monster-editor statblokken live op bij
// `dnd5eapi.co` (de SRD van 2014). Die importer liet sporen na die nergens
// anders in de app voorkomen:
//
//   speed: "walk 30 ft."   ← hij plakte de sleutel voor de waarde
//   ac:    "12 (armor)"    ← "(armor)" is een invulwoord, geen gegeven
//   cr:    "0.125"         ← een breuk hoort als 1/8 op een blad
//   hp:    "2d8+2"         ← het gemiddelde ontbreekt; dat staat los in maxHp
//
// Geen van die vier zegt iets over het wezen zelf, dus rechtzetten is veilig.
// Namen, beschrijvingen, traits, actions en HP-totalen blijven onaangeroerd —
// dat zijn keuzes van de DM.
//
// Wat het script **niet** doet: iets weggooien of samenvoegen. Twee monsters
// met hetzelfde statblok onder een andere naam (een Maenfortmatroos en een
// Wervelingpiraat) zijn geen fout maar twee facties; het meldt ze alleen.
//
//   node scripts/monster-opschonen.js <campagne> [--schrijf]
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/monster-opschonen.js <campagne> [--schrijf]'); process.exit(1); }

const DIR  = path.join(__dirname, '..', 'data', 'campaigns', campagne);
const PAD  = path.join(DIR, 'monsters.json');
if (!fs.existsSync(PAD)) { console.error(`Geen monsters.json in ${DIR}`); process.exit(1); }

const rauw = JSON.parse(fs.readFileSync(PAD, 'utf8'));
const lijst = Array.isArray(rauw) ? rauw : (rauw.monsters || []);

// Bekende afkortingen in het alignment-veld. Alleen deze; een waarde die er
// niet in staat blijft staan en wordt gemeld, want raden hoort hier niet.
const ALIGN = {
  le: 'Lawful Evil', ne: 'Neutral Evil', ce: 'Chaotic Evil',
  lg: 'Lawful Good', ng: 'Neutral Good', cg: 'Chaotic Good',
  ln: 'Lawful Neutral', cn: 'Chaotic Neutral', n: 'Neutral',
};

const CR_BREUK = { '0.125': '1/8', '0.25': '1/4', '0.5': '1/2' };

const wijzigingen = [];
const meldingen   = [];
const noteer = (m, veld, van, naar) => wijzigingen.push(`${m.name} · ${veld}: ${JSON.stringify(van)} → ${JSON.stringify(naar)}`);

for (const m of lijst) {
  const sb = m.statblock;
  if (!sb) continue;

  // 1. "walk 30 ft." → "30 ft.", en een ontbrekende punt achter ft erbij.
  if (sb.speed) {
    let s = String(sb.speed).replace(/^\s*walk\s+/i, '');
    s = s.replace(/(\d)\s*ft(?![.\w])/g, '$1 ft.');
    if (s !== sb.speed) { noteer(m, 'speed', sb.speed, s); sb.speed = s; }
  }

  // 2. Het invulwoord "(armor)" zegt niets; een echte omschrijving
  //    ("scale mail", "natural armor") blijft staan.
  if (sb.ac && /\(\s*armor\s*\)/i.test(sb.ac)) {
    const a = String(sb.ac).replace(/\s*\(\s*armor\s*\)/i, '').trim();
    noteer(m, 'ac', sb.ac, a); sb.ac = a;
  }

  // 3. CR als breuk.
  if (sb.cr != null && CR_BREUK[String(sb.cr)]) {
    noteer(m, 'cr', sb.cr, CR_BREUK[String(sb.cr)]); sb.cr = CR_BREUK[String(sb.cr)];
  }

  // 4. HP: het gemiddelde hoort vooraan, want dat is het getal waar je mee
  //    speelt. Het staat al in maxHp, dus we verzinnen niets.
  //
  //    Maar eerst: klópt die maxHp wel bij de worp? Zo niet, dan laten we het
  //    veld met rust en melden we het. Anders zetten we een getal vast waarvan
  //    we net hebben vastgesteld dat het waarschijnlijk fout is — en staat er
  //    voortaan "4 (4d10+4)" op het blad, wat het misverstand bevestigt in
  //    plaats van het zichtbaar te houden.
  const hpTekst = String(sb.hp ?? '').trim();
  const worp = hpTekst.match(/(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?/i);
  let hpVerdacht = false;
  if (worp && m.maxHp) {
    const [, n, zij, mod] = worp;
    const gem = Math.floor(Number(n) * (Number(zij) + 1) / 2) + (mod ? Number(mod.replace(/\s+/g, '')) : 0);
    if (gem > 0 && (m.maxHp > gem * 2 || m.maxHp < gem / 2)) {
      hpVerdacht = true;
      meldingen.push(`${m.name} · maxHp ${m.maxHp} tegen een worp die gemiddeld ${gem} geeft — hp-veld met rust gelaten`);
    }
  }
  if (m.maxHp && !hpVerdacht) {
    if (!hpTekst) { noteer(m, 'hp', sb.hp ?? '', String(m.maxHp)); sb.hp = String(m.maxHp); }
    else if (/^\d+\s*d\s*\d+/i.test(hpTekst)) {
      const nieuw = `${m.maxHp} (${hpTekst})`;
      noteer(m, 'hp', sb.hp, nieuw); sb.hp = nieuw;
    }
  }

  // 5. Alignment-afkortingen.
  const al = String(sb.alignment ?? '').trim();
  if (al && al.length <= 2) {
    const vol = ALIGN[al.toLowerCase()];
    if (vol) { noteer(m, 'alignment', sb.alignment, vol); sb.alignment = vol; }
    else meldingen.push(`${m.name} · alignment ${JSON.stringify(al)} — onbekende afkorting, laat staan`);
  }

}

// Dezelfde cijfers onder een andere naam: melden, niet samenvoegen.
const opStatblok = new Map();
for (const m of lijst) {
  if (!m.statblock) continue;
  const sleutel = JSON.stringify(m.statblock, Object.keys(m.statblock).sort());
  if (!opStatblok.has(sleutel)) opStatblok.set(sleutel, []);
  opStatblok.get(sleutel).push(m.name);
}
for (const namen of opStatblok.values()) {
  if (namen.length > 1) meldingen.push(`zelfde statblok: ${namen.join(' = ')} — twee namen voor dezelfde troep, of een kopie die nog bijgesteld moet worden`);
}

console.log(`${campagne}: ${lijst.length} monsters, ${wijzigingen.length} veld(en) rechtgezet`);
for (const w of wijzigingen) console.log(' ·', w);
if (meldingen.length) {
  console.log(`\nTer beoordeling (niets aan gedaan):`);
  for (const m of meldingen) console.log(' !', m);
}

if (!schrijf) { console.log('\n(niets geschreven — draai met --schrijf)'); process.exit(0); }
const datum = new Date().toISOString().slice(0, 10);
fs.copyFileSync(PAD, path.join(DIR, `monsters.voor-opschonen.${datum}.json`));
fs.writeFileSync(PAD, JSON.stringify(Array.isArray(rauw) ? lijst : { ...rauw, monsters: lijst }, null, 2));
console.log(`\nGeschreven (kopie ernaast als monsters.voor-opschonen.${datum}.json)`);
