#!/usr/bin/env node
// De laatste lege plekken in de voorraadlijst van de species.
//
// `bronnen/features-elders.json` noemt per species de **namen** van zijn
// traits — geen tekst, want die komt uit een boek. Vijf species stonden er
// niet in (Genasi, Giff, Leonin, Verdan, Yuan-ti): met de hand samengesteld,
// en die vijf waren overgeslagen. In het Heldenboek zag je daardoor een tegel
// die "bestaat elders" zei en verder niets.
//
// En de **varianten**, in de bak `varianten` met de sleutel
// `"Species|Variant"` — twee species kunnen allebei een variant "Air" hebben.
// Daar geldt dezelfde regel, en die doet hier echt werk: wat in de spiegel als
// `subrace` staat is bij Elf en Tiefling de druk van 2014 (Drow met zijn Drow
// Weapon Training), terwijl ónze varianten de 2024-lineages zijn. Een subrace
// telt dus alleen mee als zijn boek óók de nieuwste druk van dat species is.
// Zo valt Drow af en blijft Genasi staan: daarvan is Monsters of the
// Multiverse wél het laatste woord, en een Genasi *is* zijn variant — de
// basisvorm heeft in zijn eentje alleen Darkvision.
//
// Bij Goliath en Aasimar is de variantnaam zélf al de feature ("Cloud's
// Jaunt", "Necrotic Shroud") en bij Elf en Tiefling geeft de lineage spreuken
// per level; daar valt dus niets toe te voegen, en dat hoort ook zo.
//
// Bron: `data/races.json` van de opensource-spiegel van 5etools, dezelfde die
// de niet-SRD species-teksten leverde (zie CLAUDE.md). **De nieuwste druk
// wint**: Yuan-ti staat er twee keer in (Volo's en Monsters of the
// Multiverse) en dan is MPMM de goede.
//
//   node scripts/srd-2024/species-namen.js            (proefronde)
//   node scripts/srd-2024/species-namen.js --schrijf
const fs   = require('fs');
const path = require('path');

const BRON   = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/races.json';
const UIT    = path.join(__dirname, '..', '..', 'bronnen', 'features-elders.json');
const SEED   = path.join(__dirname, '..', '..', 'bronnen', 'class-progression.json');
const VOLKEN = path.join(__dirname, '..', '..', 'bronnen', 'volken-klassen.json');

// Wat élk species heeft en wat de app elders al vertelt: dat is geen trait om
// op te zoeken. Dezelfde zeef die bij de veertig met de hand is aangehouden —
// Darkvision staat er wél in, dat is een echte eigenschap.
const GEEN = new Set(['age', 'alignment', 'size', 'speed', 'languages', 'language',
  'ability score increase', 'creature type', 'ability scores', 'creature size']);

// Hoe jonger het boek, hoe hoger. Alleen de drukken die hier langskomen; wat
// niet in de lijst staat telt als oudst (0), dus een onbekend boek verdringt
// nooit een bekende nieuwere.
const JAAR = { EEPC: 2015, VGM: 2016, XGE: 2017, MTF: 2018, AI: 2019, ERLW: 2019,
  MOT: 2020, EGW: 2020, TCE: 2021, VRGR: 2021, FTD: 2021, MPMM: 2022, AAG: 2022,
  SatO: 2023, BMT: 2024, XPHB: 2024 };
const jaarVan = (s) => JAAR[s] || 0;

const norm = (s) => String(s || '').trim().toLowerCase();

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const data   = await fetch(BRON).then(r => {
    if (!r.ok) throw new Error(`${BRON} gaf ${r.status}`);
    return r.json();
  });
  const uit    = JSON.parse(fs.readFileSync(UIT, 'utf8'));
  const seed   = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  const volken = JSON.parse(fs.readFileSync(VOLKEN, 'utf8'));

  // De nieuwste druk per naam.
  const besteSoort = new Map();     // naam → record
  for (const r of (data.race || [])) {
    const k = norm(r.name);
    if (!besteSoort.has(k) || jaarVan(r.source) > jaarVan(besteSoort.get(k).source)) besteSoort.set(k, r);
  }
  const besteVariant = new Map();   // "species|variant" → record
  for (const r of (data.subrace || [])) {
    if (!r.name) continue;          // een naamloze subrace is de basisvorm
    const k = `${norm(r.raceName)}|${norm(r.name)}`;
    if (!besteVariant.has(k) || jaarVan(r.source) > jaarVan(besteVariant.get(k).source)) besteVariant.set(k, r);
  }

  const namenUit = (r) => (r?.entries || [])
    .map(e => String(e?.name || '').replace(/\.$/, '').trim())
    .filter(n => n && !GEEN.has(norm(n)));

  // ── 1. De species die nergens traits hebben ────────────────────────────
  const alle = [...new Set([...Object.keys(seed.species || {}), ...(volken.volkenOverig || [])])];
  const bij = [], mist = [];
  for (const naam of alle) {
    const eigen = Object.values(seed.species?.[naam]?.levels || {}).flat().length;
    if (eigen || (uit.species?.[naam] || []).length) continue;
    const r = besteSoort.get(norm(naam));
    const namen = namenUit(r);
    if (!namen.length) { mist.push(naam); continue; }
    uit.species[naam] = namen;
    bij.push({ naam, boek: r.source, namen });
  }

  // ── 2. De varianten, maar alleen uit de nieuwste druk van dat species ──
  uit.varianten = uit.varianten || {};
  const varBij = [], varOud = [];
  const onze = new Set(alle.map(norm));
  for (const [sleutel, r] of besteVariant) {
    const [sp] = sleutel.split('|');
    const soortRec = besteSoort.get(sp);
    // Alleen species die wij ook hébben. De spiegel draagt de hele
    // Plane Shift-reeks (Aven, Merfolk, Human (Innistrad)) en die staat in
    // geen van onze twee lijsten; zonder deze zeef kreeg je er dertig
    // varianten bij van volken die niemand kan kiezen.
    if (!soortRec || !onze.has(norm(soortRec.name))) continue;
    // "Variant; Mark of Storm Half-Elf" is de boekhouding van de spiegel, geen
    // variant zoals wij die bedoelen.
    if (/^variant\b|;/i.test(r.name)) continue;
    // Hier valt Drow af: Elf heeft een druk uit 2024, deze subrace uit 2014.
    if (jaarVan(r.source) < jaarVan(soortRec.source)) { varOud.push(`${r.raceName} > ${r.name} (${r.source})`); continue; }
    const namen = namenUit(r);
    if (!namen.length) continue;
    const net = `${soortRec.name}|${r.name}${norm(r.name).endsWith(norm(soortRec.name)) ? '' : ' ' + soortRec.name}`;
    if ((uit.varianten[net] || []).length) continue;
    uit.varianten[net] = namen;
    varBij.push({ sleutel: net, boek: r.source, namen });
  }

  for (const b of bij) console.log(`  ${b.naam.padEnd(14)} ${String(b.boek).padEnd(6)} ${b.namen.join(', ')}`);
  console.log(`\n${bij.length} species erbij, ${Object.keys(uit.species).length} in totaal.`);
  if (mist.length) console.log(`Geen record gevonden voor: ${mist.join(', ')}`);
  for (const b of varBij) console.log(`  ${b.sleutel.padEnd(26)} ${String(b.boek).padEnd(6)} ${b.namen.join(', ')}`);
  console.log(`\n${varBij.length} varianten erbij, ${Object.keys(uit.varianten).length} in totaal.`);
  if (varOud.length) console.log(`Oudere druk dan het species zelf, dus overgeslagen (${varOud.length}):\n  ${varOud.join('\n  ')}`);

  if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(UIT, JSON.stringify(uit, null, 2) + '\n');
  console.log(`\nGeschreven: ${path.relative(process.cwd(), UIT)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
