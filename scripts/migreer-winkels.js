#!/usr/bin/env node
/**
 * Verkopers wijzen naar hun winkel, in plaats van dezelfde voorraad twee keer.
 *
 * Tot nu toe kon zowel een personage (rol verkoper) als een locatie (type
 * Winkel) een eigen `data.voorraad` hebben. In Grisburgh stond bij zes van de
 * zeven paren exact dezelfde lijst — met de hand twee keer ingevoerd — en het
 * zevende paar was al gaan afwijken. Dit script verhuist de voorraad naar de
 * locatie en zet op het personage alleen nog `data.winkelLocatieId`.
 *
 * Welke locatie? De eerste gelinkte locatie die zelf al voorraad heeft; anders
 * de eerste gelinkte locatie die geen stadswijk is (een tempel of gebouw mag
 * best waren verkopen). Vindt hij niets, dan blijft het kaartje ongemoeid en
 * zegt het verslag dat je hem met de hand moet koppelen.
 *
 *   node scripts/migreer-winkels.js <campagne> [--schrijf]
 */
const fs = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/migreer-winkels.js <campagne> [--schrijf]');
  process.exit(1);
}

const bestand = path.join(__dirname, '..', 'data', 'campaigns', campagne, 'entities.json');
if (!fs.existsSync(bestand)) { console.error('Niet gevonden: ' + bestand); process.exit(1); }

const data = JSON.parse(fs.readFileSync(bestand, 'utf8'));
const locaties = data.locaties || [];
const opNaam = new Map(locaties.map(l => [l.name, l]));

const heeftVoorraad = (e) => !!(e?.data?.voorraad && e.data.voorraad !== '[]');
const rollen = (e) => {
  try { const t = JSON.parse(e?.data?.tags || '[]'); return Array.isArray(t) ? t : []; } catch { return []; }
};
const isVerkoper = (e) => rollen(e).includes('verkoper') || String(e.subtype || '').toLowerCase() === 'verkoper';
// Een lijst is "rijker" als er meer regels aan een voorwerpkaartje hangen: die
// koppeling is met de hand gelegd en wil je niet kwijt.
const rijkdom = (raw) => {
  try { return (JSON.parse(raw || '[]') || []).filter(i => i.entityId).length; } catch { return 0; }
};

const verslag = [];
for (const p of (data.personages || [])) {
  if (!heeftVoorraad(p) && !isVerkoper(p)) continue;
  if (p.data?.winkelLocatieId) { verslag.push(`= ${p.name}: wees al naar een winkel`); continue; }

  const gelinkt = (p.links?.locaties || []).map(n => opNaam.get(n)).filter(Boolean);
  const doel = gelinkt.find(heeftVoorraad)
            || gelinkt.find(l => l.data?.locType !== 'Stadswijk');
  if (!doel) {
    verslag.push(`! ${p.name}: geen locatie gevonden — voorraad blijft staan, koppel hem met de hand`);
    continue;
  }

  const persRijk = rijkdom(p.data?.voorraad);
  const locRijk  = rijkdom(doel.data?.voorraad);
  let wat = 'locatie had al de (gelijke of rijkere) lijst';
  if (heeftVoorraad(p) && (!heeftVoorraad(doel) || persRijk > locRijk)) {
    doel.data = doel.data || {};
    doel.data.voorraad = p.data.voorraad;
    if (p.data.winkelConfig && !doel.data.winkelConfig) doel.data.winkelConfig = p.data.winkelConfig;
    wat = heeftVoorraad(doel) ? 'lijst van het personage was rijker → overgenomen' : 'voorraad verhuisd naar de locatie';
  }
  delete p.data.voorraad;
  delete p.data.winkelConfig;
  p.data.winkelLocatieId = doel.id;
  verslag.push(`✓ ${p.name} → ${doel.name} (${wat})`);
}

console.log(verslag.join('\n') || 'Niets te doen.');
if (!schrijf) { console.log('\n(proefdraai — draai met --schrijf om het vast te leggen)'); process.exit(0); }

const kopie = bestand.replace(/\.json$/, `.bak.${new Date().toISOString().slice(0,19).replace(/[:T]/g,'')}.json`);
fs.copyFileSync(bestand, kopie);
fs.writeFileSync(bestand, JSON.stringify(data, null, 2));
console.log(`\nOpgeslagen. Kopie van de oude stand: ${path.basename(kopie)}`);
