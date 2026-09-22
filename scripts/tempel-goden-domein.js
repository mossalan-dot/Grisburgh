#!/usr/bin/env node
// Domein en symbool terugzetten op de goden van een campagne.
//
// Waarom dit bestaat: de twaalf goden van Grisburgh stonden als
// `TEMPEL_GODEN_DEFAULT` in `routes/api.js` — met naam, domein, symbool,
// eedtekst en zelfs `locatieEntityId`'s die alleen in deze campagne bestaan.
// Dat is gedeelde code, dus elke nieuwe campagne die de Tempel opende kreeg
// andermans pantheon in de schoot geworpen. De seed gaat eruit (zie de regel
// *Niets van Grisburgh in gedeelde code*), en dan is dit de verhuisdoos.
//
// Alleen **domein** en **symbool** gaan mee, en alleen waar het veld leeg is.
// De rest van wat een god is — eed, vloek, zegens, permanente zegen — staat al
// op de Blessing-kaartjes in het archief; die zijn leidend en blijven met rust.
//
// In Grisburgh waren die twee velden al onzichtbaar: zodra `meta.tempel.goden`
// gevuld werd (dertien goden, alleen naam + koppelingen) won die config van de
// seed, en sindsdien stond er bij elke god een lege domeinregel.
//
//   node scripts/tempel-goden-domein.js <campagne>            # alleen tonen
//   node scripts/tempel-goden-domein.js <campagne> --schrijf  # doen
//
// Bij --schrijf komt er een kopie naast: meta.voor-godendomein.<datum>.json

const fs   = require('fs');
const path = require('path');

// De twaalf uit de oude seed, op naam. Dit is de enige plek waar ze nog staan.
const SEED = {
  'Matall, de Maker':      { domein: 'Oppergod — de zon en de maan',                 symbool: 'Een witte hamer voor een rode zon' },
  'Seldari, Stormoog':     { domein: 'Gerechtigheid en bescherming',                 symbool: 'Een blauw, driehoekig schild met een oog en gesperde hand' },
  'Ghon, de Loper':        { domein: 'Kennis, uitvinding en wijsheid',               symbool: 'Een purperen waterrad' },
  'Tirimet, Elvenluit':    { domein: 'Beschaving en de vrije kunsten',               symbool: 'Een gele luit' },
  'Oronoë, de Zephir':     { domein: 'Zeeën, wind, scheepvaart en verkenning',       symbool: 'Drie blauwe kronkellijnen, gekruist door een zwarte bliksemschicht' },
  'Velurut, de Jager':     { domein: 'De natuur en de jacht',                        symbool: 'Een hoefijzer' },
  'Qirell, Vuurhand':      { domein: 'Landbouw en oogst',                            symbool: 'Een zwarte en groene boom, achter elkaar' },
  'Cylline, Nymfenblad':   { domein: 'Nacht, passie, dronkenschap en extase',        symbool: 'Drie paarse druiven' },
  'Sehan, de Weegschaal':  { domein: 'Handel en welvaart',                           symbool: 'Een metalen weegschaal' },
  'Yrdus, de Ringdrager':  { domein: 'Liefde, huwelijk en familie',                  symbool: 'Een rode ring' },
  'Corellin, Vlasbaard':   { domein: 'Dieven, zieken en buitenbeentjes',             symbool: 'Een gesloten oog' },
  'Denava':                { domein: 'Verandering',                                  symbool: 'Vier zandlopers' },
};

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/tempel-goden-domein.js <campagne> [--schrijf]');
  process.exit(1);
}

const dir = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const pad = path.join(dir, 'campaigns', campagne, 'meta.json');
if (!fs.existsSync(pad)) { console.error('Niet gevonden: ' + pad); process.exit(1); }

const meta  = JSON.parse(fs.readFileSync(pad, 'utf8'));
const goden = meta.tempel?.goden;
if (!Array.isArray(goden) || !goden.length) {
  console.log('Deze campagne heeft geen goden in meta.tempel.goden — niets te doen.');
  process.exit(0);
}

let gevuld = 0;
const onbekend = [];
for (const g of goden) {
  const seed = SEED[(g.naam || '').trim()];
  if (!seed) { onbekend.push(g.naam); continue; }
  const erbij = [];
  if (!g.domein  && seed.domein)  { g.domein  = seed.domein;  erbij.push('domein'); }
  if (!g.symbool && seed.symbool) { g.symbool = seed.symbool; erbij.push('symbool'); }
  if (erbij.length) { console.log(`  ${g.naam}: ${erbij.join(' + ')}`); gevuld++; }
}

console.log(`\ngoden: ${goden.length} · aangevuld: ${gevuld}`);
if (onbekend.length) console.log(`niet in de seed (blijven zoals ze zijn): ${onbekend.join(', ')}`);

if (!schrijf) { console.log('\n(proefdraai — voeg --schrijf toe om het echt te doen)'); process.exit(0); }
if (!gevuld)  { console.log('\nNiets te doen.'); process.exit(0); }

const datum = new Date().toISOString().slice(0, 10);
const kopie = pad.replace(/\.json$/, `.voor-godendomein.${datum}.json`);
fs.copyFileSync(pad, kopie);
fs.writeFileSync(pad, JSON.stringify(meta, null, 2));
console.log(`\nGeschreven. Kopie: ${path.basename(kopie)}`);
