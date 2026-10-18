#!/usr/bin/env node
// **De nieuwste druk wint** — nu ook voor de boeken van 2025 en 2026.
//
// `subclasses-2024.js` haalde de levels van dnd2024.wikidot.com. Die wiki
// stopt bij de Player's Handbook; Arcana Unleashed, Heroes of Faerûn, Forge of
// the Artificer en The Horrors Within staan er niet in. En juist dáár is
// opnieuw uitgegeven wat wij nog onder de druk van 2014 hadden staan: School
// of Conjuration is in Arcana Unleashed **Conjurer** geworden, Bladesinging is
// **Bladesinger**, Arcana Domain heet nu **Arcana**.
//
// De koppeling hoeven we niet te raden: de spiegel van 5etools zet op elke
// oude subclass een `reprintedAs` die naar de nieuwe wijst. Dit script volgt
// die keten tot het eind, en schrijft dan twee dingen:
//
//   · `bronnen/subclasses-elders.json`  — de naam en het boek van wat elders
//     bestaat. Een hernoemde subclass hoort onder zijn nieuwe naam te staan,
//     anders zoekt de DM een naam op die in het boek niet meer voorkomt.
//   · `bronnen/features-elders.json`    — de námen van zijn features, met het
//     level erbij. Dat staat in de spiegel als een eigen veld, dus hier hoeft
//     niets uit een kop gevist te worden zoals bij de wiki.
//
// Hetzelfde geldt een laag hoger, voor de **classes** in die voorraadlijst. De
// Artificer stond er met zijn features uit Tasha's (2020), terwijl Eberron:
// Forge of the Artificer hem opnieuw heeft uitgegeven: Magical Tinkering,
// Infuse Item en Tool Expertise bestaan daar niet meer, en er kwamen Tinker's
// Magic, Replicate Magic Item en Advanced Artifice voor terug. In een campagne
// die al op die nieuwe druk draait kwamen de vijf oude namen er sinds kort als
// losse wegwijzers bíj te staan — de voorraadlijst vult nu immers per naam aan
// in plaats van per houder.
//
// Wat de app zelf meebrengt blijft met rust: dat is SRD-tekst en die hoort bij
// de druk waar hij uit komt.
//
//   node scripts/srd-2024/subclasses-nieuwste.js            (proefronde)
//   node scripts/srd-2024/subclasses-nieuwste.js --schrijf
const fs   = require('fs');
const path = require('path');

const MIRROR = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/class/';
const ELDERS   = path.join(__dirname, '..', '..', 'bronnen', 'subclasses-elders.json');
const FEATURES = path.join(__dirname, '..', '..', 'bronnen', 'features-elders.json');
const SEED     = path.join(__dirname, '..', '..', 'bronnen', 'class-progression.json');

// Onze boekcodes naast die van de spiegel. Een boek dat we nog niet kenden
// voegen we toe aan de lijst in subclasses-elders.json — zonder titel is een
// code een raadsel.
const BOEK = {
  PHB: ['phb14', "Player's Handbook (2014)"],
  DMG: ['dmg', "Dungeon Master's Guide"],
  SCAG: ['scag', "Sword Coast Adventurer's Guide"],
  XGE: ['xge', "Xanathar's Guide to Everything"],
  MTF: ['mtf', "Mordenkainen's Tome of Foes"],
  GGR: ['ggr', "Guildmasters' Guide to Ravnica"],
  AI: ['ai', 'Acquisitions Incorporated'],
  ERLW: ['erlw', 'Eberron: Rising from the Last War'],
  EGW: ['egw', "Explorer's Guide to Wildemount"],
  MOT: ['mot', 'Mythic Odysseys of Theros'],
  TCE: ['tce', "Tasha's Cauldron of Everything"],
  VRGR: ['vrgr', "Van Richten's Guide to Ravenloft"],
  FTD: ['ftd', "Fizban's Treasury of Dragons"],
  SCC: ['scc', 'Strixhaven: A Curriculum of Chaos'],
  BMT: ['bmt', 'The Book of Many Things'],
  XPHB: ['phb', "Player's Handbook (2024)"],
  FRHoF: ['hof', 'Forgotten Realms: Heroes of Faerûn'],
  EFA: ['eberron', 'Eberron: Forge of the Artificer'],
  RHW: ['rhw', 'Ravenloft: The Horrors Within'],
  AU: ['au', 'Arcana Unleashed'],
};

// Voor de classes: welke druk is de nieuwste. Bij de subclasses hoeft dit niet
// — daar wijst `reprintedAs` de weg.
const JAAR = { PHB: 2014, DMG: 2014, SCAG: 2015, VGM: 2016, XGE: 2017, MTF: 2018, GGR: 2018,
  AI: 2019, ERLW: 2019, EGW: 2020, MOT: 2020, TCE: 2021, VRGR: 2021, FTD: 2021, SCC: 2021,
  MPMM: 2022, AAG: 2022, SatO: 2023, BMT: 2024, XPHB: 2024, XDMG: 2024, XMM: 2025,
  FRHoF: 2025, EFA: 2025, RHW: 2026, AU: 2026 };

const sleutel = (naam, bron) => `${String(naam).toLowerCase()}|${bron}`;
const schoon = (n) => String(n || '').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const elders   = JSON.parse(fs.readFileSync(ELDERS, 'utf8'));
  const features = JSON.parse(fs.readFileSync(FEATURES, 'utf8'));
  const seed     = JSON.parse(fs.readFileSync(SEED, 'utf8'));

  const index = await (await fetch(MIRROR + 'index.json')).json();
  const alle = new Map();          // "naam|bron" → subclass-record
  const featuresVan = new Map();   // "naam|bron" → [{naam, level}]
  const klassen = new Map();       // "naam|bron" → class-record
  const klasFeatures = new Map();  // "naam|bron" → [{naam, level}]
  for (const bestand of Object.values(index)) {
    const d = await (await fetch(MIRROR + bestand)).json();
    for (const c of (d.class || [])) klassen.set(sleutel(c.name, c.source), c);
    for (const f of (d.classFeature || [])) {
      const k = sleutel(f.className, f.source);
      if (!klasFeatures.has(k)) klasFeatures.set(k, []);
      klasFeatures.get(k).push({ naam: schoon(f.name), level: Number(f.level) || 0 });
    }
    for (const sc of (d.subclass || [])) alle.set(sleutel(sc.name, sc.source), sc);
    for (const f of (d.subclassFeature || [])) {
      const sc = (d.subclass || []).find(x => x.shortName === f.subclassShortName && x.source === f.subclassSource);
      if (!sc) continue;
      const k = sleutel(sc.name, sc.source);
      // De spiegel zet boven elke subclass een regel die net zo heet als de
      // subclass zelf — dat is zijn inleiding, geen feature. Onze seed heeft
      // hem ook nergens staan.
      if (schoon(f.name) === schoon(sc.name)) continue;
      if (!featuresVan.has(k)) featuresVan.set(k, []);
      featuresVan.get(k).push({ naam: schoon(f.name), level: Number(f.level) || 0 });
    }
  }

  // Volg `reprintedAs` tot het eind: PHB → XPHB → AU is één keten.
  const nieuwste = (naam, bron, gezien = new Set()) => {
    const k = sleutel(naam, bron);
    if (gezien.has(k)) return alle.get(k);
    gezien.add(k);
    const sc = alle.get(k);
    const her = sc?.reprintedAs?.[0];
    if (!her) return sc;
    // "Conjurer|Wizard|XPHB|AU" — naam, class, classbron, eigen bron.
    const d = String(her).split('|');
    const volgende = nieuwste(d[0], d[3] || d[2], gezien);
    return volgende || sc;
  };

  // Alles wat de app zelf al met tekst meebrengt blijft zoals het is.
  const metTekst = new Set();
  for (const klasse of Object.values(seed.classes || {})) {
    for (const [sub, d] of Object.entries(klasse.subclasses || {})) {
      if (Object.values(d.levels || {}).reduce((t, a) => t + (a || []).length, 0)) metTekst.add(sub.toLowerCase());
    }
  }

  const hernoemd = [], nieuweLevels = [], boekBij = {}, overgeslagen = [];
  for (const [klasse, lijst] of Object.entries(elders.klassen || {})) {
    for (const rij of lijst) {
      // Welk record is dit bij ons? We kennen de naam en de boekcode.
      const code = String(rij.boek || '').toLowerCase();
      const bron = Object.entries(BOEK).find(([, [c]]) => c === code)?.[0];
      // Onze boekcode kan achterlopen op die van de spiegel — wij hadden
      // Bladesinging onder Sword Coast staan, de spiegel heeft hem onder
      // Tasha's. De naam binnen één class is uniek genoeg om op terug te
      // vallen; het boek is dan hooguit de vorige druk, en `reprintedAs`
      // brengt ons alsnog bij de laatste.
      const opNaam = () => [...alle.values()].find(x => x.className === klasse
        && schoon(x.name).toLowerCase() === schoon(rij.naam).toLowerCase());
      const eigen = (bron && alle.get(sleutel(rij.naam, bron))) || opNaam();
      const beste = eigen ? nieuwste(eigen.name, eigen.source) : null;
      if (!beste || sleutel(beste.name, beste.source) === sleutel(rij.naam, bron)) {
        if (!eigen) overgeslagen.push(`${klasse} › ${rij.naam} (${rij.boek}) — niet in de spiegel`);
        continue;
      }
      const [nieuweCode, titel] = BOEK[beste.source] || [];
      if (!nieuweCode) { overgeslagen.push(`${klasse} › ${rij.naam} → ${beste.name} (${beste.source}: boek onbekend)`); continue; }
      if (metTekst.has(String(beste.name).toLowerCase())) {
        overgeslagen.push(`${klasse} › ${rij.naam} → ${beste.name} — die brengt de app zelf al mee`);
        continue;
      }
      hernoemd.push({ klasse, van: `${rij.naam} (${rij.boek})`, naar: `${beste.name} (${nieuweCode})` });
      if (!elders.boeken[nieuweCode]) boekBij[nieuweCode] = titel;
      // **De oude naam blijft staan.** De lijst "bestaat elders" wijst alleen
      // nog naar de nieuwste druk, maar een campagne die School of Conjuration
      // al had overgenomen heeft een houder met díé naam — en die zou zonder
      // zijn regel in deze lijst terugvallen op "geen tekst". De features van
      // die druk horen bij die naam, dus we laten ze met rust.
      rij.naam = schoon(beste.name);
      rij.boek = nieuweCode;
      const fs_ = featuresVan.get(sleutel(beste.name, beste.source)) || [];
      if (fs_.length) { features.subclasses[rij.naam] = fs_; nieuweLevels.push(`${rij.naam}: ${fs_.length}`); }
    }
  }
  Object.assign(elders.boeken, boekBij);

  // ── De classes in de voorraadlijst, op hun nieuwste druk ───────────────
  // Wat elke class krijgt staat elders in de app (de tijdlijn deelt ze uit) of
  // is geen feature om op te zoeken: een Ability Score Improvement, een Epic
  // Boon en de plaatshouder "Subclass feature" horen hier niet in de lijst.
  const GEEN = /^(ability score improvement|epic boon)$/i;
  const PLAATSHOUDER = /\bsubclass feature\b|\bspecialist feature$/i;
  const klasBij = [];
  for (const naam of Object.keys(features.classes || {})) {
    // De nieuwste druk van déze class, als de spiegel hem kent.
    const kandidaten = [...klassen.values()].filter(c => schoon(c.name).toLowerCase() === naam.toLowerCase());
    const beste = kandidaten.sort((a, b) => (JAAR[a.source] || 0) - (JAAR[b.source] || 0)).pop();
    if (!beste) continue;
    const lijst = (klasFeatures.get(sleutel(beste.name, beste.source)) || [])
      .filter(f => !GEEN.test(f.naam) && !PLAATSHOUDER.test(f.naam));
    if (!lijst.length) continue;
    const oudeNamen = (features.classes[naam] || []).map(x => (x && typeof x === 'object') ? x.naam : x);
    const nieuweNamen = lijst.map(f => f.naam);
    const weg = oudeNamen.filter(n => !nieuweNamen.includes(n));
    const bij = nieuweNamen.filter(n => !oudeNamen.includes(n));
    if (!weg.length && !bij.length) continue;
    features.classes[naam] = lijst;
    klasBij.push({ naam, boek: beste.source, weg, bij });
  }

  for (const h of hernoemd) console.log(`  ${h.klasse.padEnd(10)} ${h.van.padEnd(34)} → ${h.naar}`);
  console.log(`\n${hernoemd.length} hernoemd, ${nieuweLevels.length} met hun featurenamen erbij.`);
  if (Object.keys(boekBij).length) console.log(`Boeken erbij: ${Object.entries(boekBij).map(([c, t]) => `${c} (${t})`).join(', ')}`);
  for (const k of klasBij) {
    console.log(`  ${k.naam} → ${k.boek}`);
    if (k.weg.length) console.log(`      weg:   ${k.weg.join(', ')}`);
    if (k.bij.length) console.log(`      erbij: ${k.bij.join(', ')}`);
  }
  if (klasBij.length) console.log(`${klasBij.length} class${klasBij.length === 1 ? '' : 'es'} bijgewerkt.`);
  if (overgeslagen.length) console.log(`\nOvergeslagen (${overgeslagen.length}):\n  ${overgeslagen.join('\n  ')}`);

  if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(ELDERS, JSON.stringify(elders, null, 2) + '\n');
  fs.writeFileSync(FEATURES, JSON.stringify(features, null, 2) + '\n');
  console.log(`\nGeschreven: ${path.relative(process.cwd(), ELDERS)} + ${path.relative(process.cwd(), FEATURES)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
