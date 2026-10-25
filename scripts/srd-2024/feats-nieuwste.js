// De feats die er in de campagne nog niet zijn erbij zetten — de namen, niet
// de teksten.
//
// `import-structuur.js` haalt alleen de feats uit de PHB van 2024 (XPHB). Sindsdien
// zijn er boeken bijgekomen die er tientallen meer brengen: Heroes of Faerûn,
// Arcana Unleashed, Forge of the Artificer, Astarion's Book of Hungers. Wie
// in het Heldenboek een feat zocht uit een van die boeken vond hem niet, en
// kon dus ook niet zien dát hij bestaat.
//
// Wat erin komt: **naam, boek en vereiste.** De beschrijving blijft leeg, en de
// app zet er de naslagverwijzing bij (`_geenTekst` → `window.app.bronLink`) —
// dezelfde afweging als bij de spreuken en de subclasses: linken mag,
// overnemen niet. De vereiste is geen tekst maar een eigenschap ("Level 4",
// "Strength of Dexterity 13"), en die heb je nodig om te zien of je hem mag
// kiezen.
//
// **Alleen de nieuwste druk.** 5e.tools geeft een feat die opnieuw is
// uitgegeven een `reprintedAs`; die slaan we over, anders staat Alert er
// twee keer. Een naam die de campagne al heeft wordt nooit aangeraakt — ook niet
// als het boek of de vereiste anders is: daar heeft de DM misschien zelf iets
// van gemaakt.
//
// Epic Boons (categorie EB) gaan naar `feats.epic`, de rest naar
// `feats.general` — de app kent niet meer bakken dan die twee, en een Origin
// feat, een Fighting Style of een Dragonmark staat daar nu ook al tussen.
//
// Haal het bestand eerst binnen (in een eigen map, het is data van buiten):
//
//   mkdir -p /tmp/5et && curl -s -o /tmp/5et/feats.json \
//     "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/feats.json"
//
// Draaien:
//   node scripts/srd-2024/feats-nieuwste.js <campagne> <feats.json>            # alleen tonen
//   node scripts/srd-2024/feats-nieuwste.js <campagne> <feats.json> --schrijf  # wegschrijven
//
// `GRISBURGH_DATA_DIR` wijst net als bij de server naar een andere datamap. Er
// komt altijd een kopie naast te staan, met het tijdstip erin.

const fs   = require('fs');
const path = require('path');

const args      = process.argv.slice(2).filter(a => !a.startsWith('--'));
const schrijven = process.argv.includes('--schrijf');
const [campagne, featsPad] = args;
if (!campagne || !featsPad) {
  console.error('Gebruik: node scripts/srd-2024/feats-nieuwste.js <campagne> <feats.json> [--schrijf]');
  process.exit(1);
}

const DATA  = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const PROG  = path.join(DATA, 'campaigns', campagne, 'progression.json');
const BOEKEN = require('../../bronnen/boeken.json').boeken;

// Waar de boekenlijst geen titel voor heeft. Zelfde drie als `_BOEK_EIGEN` in
// render-vaardigheden.js, die ze weer tot een code terugvouwt.
const BOEK_EXTRA = {
  DSotDQ: 'Dragonlance: Shadow of the Dragon Queen',
  PSK:    'Plane Shift: Kaladesh',
  PSX:    'Plane Shift: Ixalan',
};
const boekVan = (code) => BOEKEN.find(b => b.code === code)?.naam || BOEK_EXTRA[code] || code;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// "initiate of high sorcery|dsotdq|initiate of high sorcery (nuitari)" →
// "Initiate of High Sorcery (Nuitari)". Het derde stuk is de weergave, als die er is.
const KLEIN = new Set(['of', 'the', 'and', 'a', 'an', 'to', 'in', 'on', 'or']);
function titel(s) {
  return String(s || '').split(' ')
    .map((w, i) => (i && KLEIN.has(w)) ? w : w.replace(/^[a-z(]+/, m => m.replace(/[a-z]/, c => c.toUpperCase())))
    .join(' ');
}
const verwijzing = (s) => titel(String(s).split('|')[2] || String(s).split('|')[0]);

const AB = { str: 'Strength', dex: 'Dexterity', con: 'Constitution',
             int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
// "X of Y" — zo staat het al in feat-koppelingen.json ("Strength of Dexterity 13").
const ofLijst = (l) => l.length <= 1 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} of ${l[l.length - 1]}`;

// Eén alternatief uit `prerequisite` als korte regel. Het level laten we weg
// waar het vanzelf spreekt — level 4 is de standaard voor een feat, een Epic
// Boon vraagt 19 en dat vult de app al zelf in — anders staat het 150 keer
// herhaald. De wereld (`campaign`) staat er per alternatief in; die halen we
// eruit en zetten we één keer achteraan, zie `vereistVan`.
function eisRegel(p) {
  const delen = [];
  if (p.level != null) {
    const lvl = typeof p.level === 'object' ? p.level.level : p.level;
    const klasse = typeof p.level === 'object' && p.level.class?.name;
    if (klasse) delen.push(`${titel(klasse)} ${lvl}`);
    else if (lvl !== 4 && lvl !== 19) delen.push(`Level ${lvl}`);
  }
  for (const a of (p.ability || [])) {
    const [[, waarde]] = Object.entries(a);
    delen.push(`${ofLijst(Object.keys(a).map(k => AB[k] || k))} ${waarde}`);
  }
  if (p.spellcasting || p.spellcasting2020 || p.spellcastingFeature) delen.push('Een spellcasting- of pact magic-feature');
  // De lijst met volken is een keuze, geen optelling: "Elf of Half-elf".
  if (p.race?.length) delen.push(ofLijst(p.race.map(r =>
    r.displayEntry || (titel(r.name) + (r.subrace ? ` (${titel(r.subrace)})` : '')))));
  for (const b of (p.background || [])) delen.push(titel(b.name) + ' background');
  for (const f of (p.feat || [])) delen.push(verwijzing(f) + ' feat');
  if (p.feature?.length) delen.push(`${ofLijst(p.feature)} feature`);
  for (const pr of (p.proficiency || [])) {
    if (pr.armor) delen.push(`${titel(pr.armor)} armor training`);
    if (pr.weapon) delen.push(`${titel(pr.weapon)} weapon proficiency`);
  }
  if (p.other) delen.push(p.other);
  if (p.otherSummary) delen.push(p.otherSummary.entrySummary || p.otherSummary.entry);
  return delen.join(', ');
}
function vereistVan(f) {
  const alt = f.prerequisite || [];
  // "Strength 13 of Dexterity 13" schrijft feat-koppelingen.json als
  // "Strength of Dexterity 13": samenvoegen als elk alternatief alleen één
  // ability met dezelfde waarde vraagt.
  const enkel = alt.every(p => Object.keys(p).every(k => k === 'ability' || k === 'level')
    && p.ability?.length === 1 && Object.keys(p.ability[0]).length === 1);
  const waarden = enkel ? [...new Set(alt.map(p => Object.values(p.ability[0])[0]))] : [];
  let regel = (enkel && waarden.length === 1 && alt.length > 1)
    ? eisRegel({ ...alt[0], ability: [Object.fromEntries(alt.map(p => Object.entries(p.ability[0])[0]))] })
    : [...new Set(alt.map(eisRegel).filter(Boolean))].join(' of ');
  const werelden = [...new Set(alt.flatMap(p => p.campaign || []))];
  if (werelden.length) regel = [regel, `Wereld: ${werelden.join(' of ')}`].filter(Boolean).join(', ');
  return regel;
}

// ── Inlezen ─────────────────────────────────────────────────────────────────
const bron = JSON.parse(fs.readFileSync(featsPad, 'utf8')).feat || [];
const prog = JSON.parse(fs.readFileSync(PROG, 'utf8'));
prog.feats = prog.feats || {};
prog.feats.general = prog.feats.general || [];
prog.feats.epic    = prog.feats.epic    || [];
if (!prog.feats.general.length) {
  // Zonder eigen lijst leest de app de meegeleverde 67 + 12; een lijst met
  // alléén de nieuwe zou die verdringen (zie de valkuil bij seedFeats).
  console.error('Deze campagne heeft nog geen eigen featlijst. Leg eerst de seed vast (één feat bewerken in het Heldenboek doet dat).');
  process.exit(1);
}
const bekend = new Set([...prog.feats.general, ...prog.feats.epic].map(f => norm(f.name)));

const erbij = { general: [], epic: [] };
for (const f of bron) {
  if (f.reprintedAs) continue;
  const sleutel = norm(f.name);
  if (bekend.has(sleutel)) continue;
  bekend.add(sleutel);                       // twee boeken met dezelfde naam: de eerste
  const regel = { name: f.name, desc: '', bron: boekVan(f.source) };
  const eis = vereistVan(f);
  if (eis) regel.vereist = eis;
  erbij[f.category === 'EB' ? 'epic' : 'general'].push(regel);
}

const perBoek = {};
for (const r of [...erbij.general, ...erbij.epic]) (perBoek[r.bron] = perBoek[r.bron] || []).push(r);
for (const [boek, l] of Object.entries(perBoek).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${boek} (${l.length})`);
  for (const r of l) console.log(`  ${r.name}${r.vereist ? `  — ${r.vereist}` : ''}`);
}
console.log(`\nErbij: ${erbij.general.length} feats en ${erbij.epic.length} Epic Boons.`);

if (!schrijven) { console.log('(alleen getoond — --schrijf om weg te schrijven)'); process.exit(0); }

const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const kopie = PROG.replace(/\.json$/, `.voor-feats.${stempel}.json`);
fs.copyFileSync(PROG, kopie);
prog.feats.general.push(...erbij.general);
prog.feats.epic.push(...erbij.epic);
fs.writeFileSync(PROG, JSON.stringify(prog, null, 2));
console.log(`Weggeschreven. Kopie: ${kopie}`);
