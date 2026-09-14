// Ontbrekende subklassen en feats erbij halen — de namen, niet de teksten.
//
// Wat hier binnenkomt is **structuur**: welke subklassen een klasse heeft, hoe
// hun features heten en op welk level ze komen, en welke feats er bestaan.
// De beschrijvingen blijven leeg. Dat is dezelfde afweging als bij de spreuken:
// de bibliotheek kent 539 spreuken, maar alleen de SRD-tekst gaat mee; bij de
// rest staat een verwijzing naar een plek waar hij wél staat (`_geenTekst` →
// `window.app.bronLink`). Linken mag, overnemen niet.
//
// Zonder dit stonden er 15 van de 48 subklassen in de app. Een speler die op
// level 3 een subclass koos, kon dus niet eens opzoeken wat de andere drie
// deden — terwijl juist dát het moment is waarop je het wil weten.
//
// Bron: 5etools-mirror-3/5etools-src, alleen de XPHB-regels (2024 PHB).
// Haal de bestanden eerst binnen:
//
//   cd /tmp && for c in barbarian bard cleric druid fighter monk paladin \
//       ranger rogue sorcerer warlock wizard; do \
//     curl -sO "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/class/class-$c.json"; done
//   curl -s -o /tmp/feats.json "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/feats.json"
//
// Draaien:
//   node scripts/srd-2024/import-structuur.js                      # alleen tonen
//   node scripts/srd-2024/import-structuur.js --schrijf            # de seed bijwerken
//   node scripts/srd-2024/import-structuur.js grisburgh --schrijf  # én die campagne
//
// Een campagne met een eigen progression.json (zoals Grisburgh) krijgt de seed
// níét vanzelf: die leest zijn eigen bestand. Vandaar de campagnenaam als
// argument. Er komt altijd een kopie naast te staan.

const fs   = require('fs');
const path = require('path');

const TMP  = '/tmp';
const SEED = path.join(__dirname, '..', '..', 'bronnen', 'class-progression.json');
const FEAT_BRON = path.join(__dirname, '..', '..', 'bronnen', 'feats-2024.json');

const KLASSEN = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
                 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'];

const schrijven = process.argv.includes('--schrijf');
const campagne  = process.argv.slice(2).find(a => !a.startsWith('--')) || null;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Dezelfde subklasse heet niet overal hetzelfde: wij hebben "Wild Magic
// (Chaos)" en "Aberrant Mind Sorcery" waar de bron "Wild Magic Sorcery" en
// "Aberrant Sorcery" schrijft. Vergelijken op de kále naam levert dan een
// dubbele op. Vandaar: haal de vaste woorden eruit (path, circle, domain,
// patron, sorcery …) en kijk of er een kenmerkend woord overblijft dat in
// allebei zit — "wild" in het ene geval, "aberrant" in het andere. Binnen één
// klasse is dat genoeg; twee subklassen van dezelfde klasse delen zo'n woord
// niet.
const STOP = new Set(['of', 'the', 'path', 'circle', 'college', 'oath', 'warrior',
                      'domain', 'patron', 'sorcery', 'magic', 'order', 'way']);
const kern = (naam) => new Set(String(naam || '').toLowerCase()
  .replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)));

function zelfdeSubklasse(a, b) {
  if (norm(a) === norm(b)) return true;
  const ka = kern(a), kb = kern(b);
  for (const w of ka) if (kb.has(w)) return true;
  return false;
}

function lees(bestand) {
  try { return JSON.parse(fs.readFileSync(path.join(TMP, bestand), 'utf8')); }
  catch { return null; }
}

// ── Subklassen ───────────────────────────────────────────────────────────────
// Eén regel per feature: naam + level. 5etools zet de subklassenaam zelf ook
// als feature op level 3 (dat is de kop van het blok, geen feature) — die laten
// we weg, net als de "Subclass Feature"-plaatshouders.
function subklassenUitBestand(klasse) {
  const d = lees(`class-${klasse}.json`);
  if (!d) return null;
  const uit = {};
  for (const sub of (d.subclass || []).filter(s => s.source === 'XPHB')) {
    const features = (d.subclassFeature || [])
      .filter(f => f.source === 'XPHB'
                && f.subclassShortName === sub.shortName
                && norm(f.name) !== norm(sub.name)
                && norm(f.name) !== norm(sub.shortName))
      .sort((a, b) => (a.level || 0) - (b.level || 0));
    const levels = {};
    for (const f of features) {
      const lvl = String(f.level || 3);
      (levels[lvl] = levels[lvl] || []).push({ name: f.name, desc: '' });
    }
    if (Object.keys(levels).length) uit[sub.name] = { levels };
  }
  return uit;
}

// ── Feats ────────────────────────────────────────────────────────────────────
// `category`: O = Origin, G = General, FS = Fighting Style, EB = Epic Boon.
// De featlijst die de app nu gebruikt staat als array ín render-progressie.js
// (`_GENERAL_FEATS`, `_ORIGIN_FEATS`, `_EPIC_FEATS`). Die lezen we uit, zodat
// de nieuwe bron een **vereniging** wordt: wat er al in stond blijft staan, ook
// als het in de 2024-lijst niet voorkomt.
function huidigeFeats() {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'render-progressie.js'), 'utf8');
  const uit = (naam) => {
    const m = js.match(new RegExp(naam + "\\s*=\\s*\\[([\\s\\S]*?)\\];"));
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
  };
  return {
    general: [...uit('_GENERAL_FEATS'), ...uit('_ORIGIN_FEATS')],
    epic: uit('_EPIC_FEATS'),
  };
}

function featsUitBestand() {
  const d = lees('feats.json');
  if (!d) return null;
  const huidig = huidigeFeats();
  const general = new Set(huidig.general);
  const epic    = new Set(huidig.epic);
  const erbij   = [];
  // Namen die alleen in schrijfwijze verschillen ("Fey Touched" tegenover
  // "Fey-Touched") zijn dezelfde feat; de onze wint, anders staat hij dubbel.
  const bekend = new Set([...general, ...epic].map(norm));
  for (const f of (d.feat || []).filter(x => x.source === 'XPHB')) {
    if (bekend.has(norm(f.name))) continue;
    (f.category === 'EB' ? epic : general).add(f.name);   // O, G en FS in één lijst, zoals nu
    erbij.push(`${f.name} (${f.category})`);
  }
  return {
    general: [...general].sort(),
    epic: [...epic].sort(),
    _erbij: erbij,
  };
}

// ── Samenvoegen ──────────────────────────────────────────────────────────────
// Alleen aanvullen. Wat er al staat blijft staan — ook als de tekst er bij ons
// anders uitziet dan in de bron; dat kan de DM zelf geschreven hebben.
function vulAan(prog) {
  const erbij = [];
  for (const klasse of KLASSEN) {
    const nieuw = subklassenUitBestand(klasse);
    if (!nieuw) { console.error(`  ! /tmp/class-${klasse}.json niet gevonden — overgeslagen`); continue; }
    const naam = klasse[0].toUpperCase() + klasse.slice(1);
    const doel = prog.classes?.[naam];
    if (!doel) { console.error(`  ! klasse ${naam} staat niet in de progressie — overgeslagen`); continue; }
    doel.subclasses = doel.subclasses || {};
    const bestaand = Object.keys(doel.subclasses);
    for (const [subNaam, subData] of Object.entries(nieuw)) {
      if (bestaand.some(b => zelfdeSubklasse(b, subNaam))) continue;
      doel.subclasses[subNaam] = subData;
      const n = Object.values(subData.levels).flat().length;
      erbij.push(`${naam} → ${subNaam} (${n} features)`);
    }
  }
  return erbij;
}

// ── Draaien ──────────────────────────────────────────────────────────────────
console.log(schrijven ? 'Schrijfmodus.' : 'Proefdraai (gebruik --schrijf om op te slaan).');

// 1. De seed.
const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
const erbijSeed = vulAan(seed);
console.log(`\nSeed (bronnen/class-progression.json): ${erbijSeed.length} subklassen erbij`);
erbijSeed.forEach(r => console.log('  +', r));
if (schrijven && erbijSeed.length) {
  fs.copyFileSync(SEED, SEED.replace(/\.json$/, `.voor-import.${new Date().toISOString().slice(0, 10)}.json`));
  fs.writeFileSync(SEED, JSON.stringify(seed, null, 2));
}

// 2. De featlijst.
const feats = featsUitBestand();
if (feats) {
  const { _erbij, ...schoon } = feats;
  console.log(`\nFeats: ${schoon.general.length} general/origin/fighting style + ${schoon.epic.length} Epic Boons` +
              ` (${_erbij.length} erbij)`);
  _erbij.forEach(r => console.log('  +', r));
  if (schrijven) fs.writeFileSync(FEAT_BRON, JSON.stringify(schoon, null, 2));
} else {
  console.error('  ! /tmp/feats.json niet gevonden — featlijst overgeslagen');
}

// 3. Een campagne met een eigen progressie.
if (campagne) {
  const pad = path.join(__dirname, '..', '..', 'data', 'campaigns', campagne, 'progression.json');
  if (!fs.existsSync(pad)) {
    console.error(`\n! ${pad} bestaat niet`);
  } else {
    const eigen = JSON.parse(fs.readFileSync(pad, 'utf8'));
    if (!eigen.classes || !Object.keys(eigen.classes).length) {
      console.log(`\n${campagne} heeft geen eigen progressie — die leest de seed al.`);
    } else {
      const erbij = vulAan(eigen);
      console.log(`\nCampagne ${campagne}: ${erbij.length} subklassen erbij`);
      erbij.forEach(r => console.log('  +', r));
      if (schrijven && erbij.length) {
        fs.copyFileSync(pad, pad.replace(/\.json$/, `.voor-import.${new Date().toISOString().slice(0, 10)}.json`));
        fs.writeFileSync(pad, JSON.stringify(eigen, null, 2));
      }
    }
  }
}

console.log('\nKlaar.' + (schrijven ? '' : ' (niets weggeschreven)'));
