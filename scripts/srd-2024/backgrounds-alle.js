#!/usr/bin/env node
// Alle backgrounds die Wizards of the Coast heeft uitgegeven, uit `data/
// backgrounds.json` van de 5etools-spiegel.
//
// Het bestand hield tot nu toe de zestien uit de Player's Handbook van 2024.
// Die zijn in 2024 opnieuw opgezet (Ability Scores, een Feat, skills, tools,
// uitrusting) en staan er compleet in. Wat erbij komt is ouder en is anders
// gebouwd: skills, tools, talen, uitrusting en één **Feature** met een naam.
//
// **Van die Feature nemen we alleen de naam over.** Zijn tekst staat in het
// boek — dat is precies de grens die deze bestanden aanhouden. De rest is
// structuur: welke skills, welke tools, hoeveel goud.
//
// De nieuwste druk wint, net als overal: de Acolyte van 2024 verdringt die van
// 2014, en de Haunted One uit Ravenloft: The Horrors Within die uit Van
// Richten's.
//
//   node scripts/srd-2024/backgrounds-alle.js            (proefronde)
//   node scripts/srd-2024/backgrounds-alle.js --schrijf
const fs   = require('fs');
const path = require('path');

const BRON = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/backgrounds.json';
const UIT  = path.join(__dirname, '..', '..', 'bronnen', 'backgrounds-2024.json');
const BOEKEN = path.join(__dirname, '..', '..', 'bronnen', 'boeken.json');
// Een background kan ook uit een avontuur komen (Baldur's Gate: Descent into
// Avernus) of uit een web-uitgave van Wizards zelf (de Plane Shift-artikelen,
// Project Lamordia). Die staan niet in onze boekenlijst, dus halen we hun
// titels bij de spiegel op — anders staat er "GoS" op het kaartje.
const AVONTUREN = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/adventures.json';
const WEB = { PSA: 'Plane Shift: Amonkhet', PSI: 'Plane Shift: Innistrad', PL: 'Project Lamordia' };

// Wat deze tafel niet meerekent. Lorwyn ging er bij de species ook al uit; de
// rest zijn uitgaven die geen boek zijn (de Plane Shift-artikelen en Project
// Lamordia staan niet voor niets in geen enkele boeken- of avonturenlijst) en
// Dragonlance, dat hier niet gespeeld wordt. Haal je er een weg, dan komt hij
// bij een volgende campagne ook niet meer terug.
const GEEN_BRON = new Set([
  'LFL',                    // Lorwyn: First Light
  'PL',                     // Project Lamordia
  'PSA', 'PSI',             // Plane Shift: Amonkhet, Innistrad
  'DSotDQ',                 // Dragonlance: Shadow of the Dragon Queen
]);

// Hoe jonger, hoe hoger. Wat hier niet staat telt als oudst, dus een onbekende
// druk verdringt nooit een bekende nieuwere.
const JAAR = {
  PHB: 2014, SCAG: 2015, VGM: 2016, XGE: 2017, ToA: 2017, PSA: 2017, PSI: 2016,
  MTF: 2018, GGR: 2018, GoS: 2019, AI: 2019, ERLW: 2019, BGDIA: 2019,
  MOT: 2020, EGW: 2020, TCE: 2021, VRGR: 2021, WBtW: 2021, SCC: 2021, FTD: 2021,
  MPMM: 2022, AAG: 2022, SatO: 2023, BGG: 2022, DSotDQ: 2022,
  BMT: 2024, XPHB: 2024, PL: 2024, RHW: 2025, ABH: 2025, AU: 2025, EFA: 2025, FRHoF: 2025,
};
const jaarVan = (s) => JAAR[s] || 0;

// Tags waarbij het eerste deel de tekst is en niet het laatste. Bij `@filter`
// is dat laatste deel een zoekopdracht: "{@filter Dark Gift feat of your
// choice|feats|category=DG}" werd zo "Survivor or a category=DG".
const DICE = new Set(['dice', 'damage', 'hit', 'dc', 'scaledice', 'scaledamage', 'd20', 'chance', 'filter']);
const kaal = (s) => String(s ?? '').replace(/\{@(\w+)\s*([^}]*)\}/g, (_, tag, inner) => {
  const d = inner.split('|');
  if (DICE.has(tag)) return d[0];
  const l = d[d.length - 1];
  return (d.length >= 3 && l) ? l : d[0];
}).replace(/\{@\w+\}/g, '').replace(/\s+/g, ' ').trim();

// Een itemnaam staat in de bron klein ("common clothes"); een `special` is al
// een geschreven regel ("Badge or emblem of your faction"). Alleen het eerste
// teken omhoog dus — elk woord een hoofdletter maakt van die tweede soort een
// krantenkop.
const beginHoofd = (s) => { const t = String(s ?? '').trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
// Een skill of tool is wél een naam: "animal handling" → "Animal Handling".
const naamHoofd = (s) => String(s).replace(/([A-Z])/g, ' $1').replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\s+/g, ' ').trim();
const lijstTekst = (arr) => arr.filter(Boolean).join(', ');
// De uitrustingssoorten die de bron als code noteert.
const SOORT = { toolArtisan: "Artisan's Tools", setGaming: 'Gaming Set', instrumentMusical: 'Musical Instrument' };

// ── De gestructureerde velden van een druk van vóór 2024 ────────────────────
function profTekst(blokken, woord) {
  if (!blokken?.length) return '';
  const uit = [];
  for (const b of blokken) {
    uit.push(...Object.entries(b).filter(([, v]) => v === true).map(([k]) => naamHoofd(k)));
    if (b.any) uit.push(`any ${b.any}`);
    if (b.anyStandard) uit.push(`any ${b.anyStandard} ${woord}`);
    if (b.anyArtisansTool) uit.push(`any ${b.anyArtisansTool} artisan's tools`);
    if (b.choose?.from) uit.push(`choose one: ${b.choose.from.map(naamHoofd).join(', ')}`);
  }
  return lijstTekst(uit);
}

function uitrusting(blokken) {
  if (!blokken?.length) return '';
  const stuk = [];
  for (const b of blokken) {
    for (const deel of Object.values(b)) {
      if (!Array.isArray(deel)) continue;
      for (const it of deel) {
        if (typeof it === 'string') { stuk.push(beginHoofd(it.split('|')[0])); continue; }
        if (it.special) stuk.push(beginHoofd(it.special) + (it.quantity > 1 ? ` (${it.quantity})` : ''));
        else if (it.displayName) stuk.push(beginHoofd(it.displayName));
        else if (it.item) stuk.push(beginHoofd(it.item.split('|')[0]) + (it.quantity > 1 ? ` (${it.quantity})` : ''));
        else if (it.equipmentType) stuk.push(SOORT[it.equipmentType] || naamHoofd(it.equipmentType));
        // `containsValue` staat in koperstukken.
        if (it.containsValue) stuk[stuk.length - 1] += ` containing ${Math.round(it.containsValue / 100)} GP`;
      }
    }
  }
  return lijstTekst(stuk);
}

function rijenOud(b) {
  const rij = (naam, tekst) => tekst ? { name: naam, desc: tekst } : null;
  // De Feature draagt alleen zijn naam; zijn tekst komt uit het boek. Die naam
  // wordt **de kop van de rij** en niet zijn waarde: dan is er een leeg veld
  // waar de DM de tekst zelf in kan zetten. Stond het andersom ("Feature:
  // Safe Haven"), dan was er geen plek voor wat die feature dóet.
  const feature = (b.entries || []).map(e => kaal(e?.name || ''))
    .find(n => /^feature:/i.test(n))?.replace(/^feature:\s*/i, '') || '';
  // `feats` is een lijst blokken; een blok noemt óf een feat bij naam, óf een
  // hele categorie ("anyFromCategory"). Die tweede vorm heeft geen naam om te
  // tonen, dus die slaan we over in plaats van er "category=DG" van te maken.
  const feats = (b.feats || []).flatMap(blok =>
    Object.entries(blok).filter(([, v]) => v === true).map(([k]) => naamHoofd(k.split('|')[0])));
  return [
    rij('Skill Proficiencies', profTekst(b.skillProficiencies, 'skills')),
    rij('Tool Proficiencies', profTekst(b.toolProficiencies, 'tools')),
    rij('Languages', profTekst(b.languageProficiencies, 'languages')),
    rij('Feat', lijstTekst(feats)),
    rij('Equipment', uitrusting(b.startingEquipment)),
    feature ? { name: feature, desc: '' } : null,
  ].filter(Boolean);
}

// ── De druk van 2024: die staat al als lijst in de tekst ────────────────────
function rijenNieuw(b) {
  const uit = [];
  for (const blok of (b.entries || [])) {
    if (blok?.type !== 'list' || !Array.isArray(blok.items)) continue;
    for (const it of blok.items) {
      if (it?.type !== 'item' || !it.name) continue;
      const naam = kaal(it.name).replace(/:\s*$/, '');
      const tekst = kaal(typeof it.entry === 'string' ? it.entry : (it.entries || []).join(' '));
      if (naam) uit.push({ name: naam, desc: tekst });
    }
  }
  return uit;
}

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const data = await fetch(BRON).then(r => {
    if (!r.ok) throw new Error(`${BRON} gaf ${r.status}`);
    return r.json();
  });

  const beste = new Map();                 // naam → record van de nieuwste druk
  const overgeslagen = [];
  for (const b of (data.background || [])) {
    // "Custom Background" is de regel dat je er zelf een mag samenstellen, geen
    // background om te kiezen.
    if (!b.name || b._copy || /^custom background$/i.test(b.name)) continue;
    if (GEEN_BRON.has(b.source)) { overgeslagen.push(`${b.name} (${b.source})`); continue; }
    const k = b.name.toLowerCase();
    if (!beste.has(k) || jaarVan(b.source) > jaarVan(beste.get(k).source)) beste.set(k, b);
  }

  const avonturen = await fetch(AVONTUREN).then(r => r.ok ? r.json() : { adventure: [] }).catch(() => ({ adventure: [] }));
  const titels = {
    ...WEB,
    ...Object.fromEntries((avonturen.adventure || []).map(a => [a.id, a.name])),
    ...Object.fromEntries((JSON.parse(fs.readFileSync(BOEKEN, 'utf8')).boeken || []).map(b => [b.code, b.naam])),
  };
  const oud = JSON.parse(fs.readFileSync(UIT, 'utf8'));
  const uit = {};
  const nieuw = [], leeg = [];
  for (const b of [...beste.values()].sort((x, y) => x.name.localeCompare(y.name))) {
    const rijen = b.source === 'XPHB' || jaarVan(b.source) >= 2024 ? rijenNieuw(b) : [];
    const regels = rijen.length ? rijen : rijenOud(b);
    if (!regels.length) { leeg.push(`${b.name} (${b.source})`); continue; }
    // De volledige titel, niet de code: zo staat het bij elk ander kaartje, en
    // het hoekje op de kaart maakt er zelf weer "SCAG" van.
    uit[b.name] = { levels: { 1: regels }, boek: titels[b.source] || b.source };
    if (!oud[b.name]) nieuw.push(`${b.name} (${b.source})`);
  }

  console.log(`${Object.keys(uit).length} backgrounds (${Object.keys(oud).filter(k => !k.startsWith('_')).length} stonden er).`);
  if (nieuw.length) console.log(`\nNieuw (${nieuw.length}):\n  ` + nieuw.join('\n  '));
  if (leeg.length) console.log(`\nNiets uit te halen (${leeg.length}): ${leeg.join(', ')}`);
  if (overgeslagen.length) console.log(`\nOvergeslagen: ${overgeslagen.join(', ')}`);

  if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(UIT, JSON.stringify(uit, null, 2) + '\n');
  console.log(`\nGeschreven: ${path.relative(process.cwd(), UIT)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
