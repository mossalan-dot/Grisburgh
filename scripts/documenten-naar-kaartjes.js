#!/usr/bin/env node
// Documenten worden een vijfde soort kaartje.
//
// Een document wás al een kaartje, maar dan twee keer gebouwd: eigen opslag,
// eigen zichtbaarheid met eigen woorden, eigen kaart, eigen detailvenster, eigen
// editor en negen eigen routes. Deze migratie verhuist ze naar `entities.json`,
// zodat ze meeliften op alles wat de kaartjes al hebben — betrokkenen, geheimen,
// [[wikilinks]], de zoekindex, de mediabibliotheek, het campagneboek.
//
// Wat waar naartoe gaat:
//   documents[]              → entities.documenten[]   (het id blijft, dus het
//                              bestand onder dat id verhuist vanzelf mee)
//   tekstContent[id]         → data.tekst              (de perkamenttekst)
//   type                     → data.docType
//   cat                      → vervalt: de groepen van docType dekken het
//   icon (emoji)             → vervalt: de app tekent iconen zelf
//   npcs/locs/orgs/items/docs→ links.{personages,locaties,organisaties,voorwerpen,documenten}
//   hoofdstuk                → meta.hoofdstukken[key].documenten  (een kaartje
//                              noemt geen akte; de akte noemt kaartjes)
//   docStates + docVisibility→ groups[gid].visibility   (revealed→visible,
//                              blurred→vague) — per party de stand die hij nú ziet
//   hiddenLinks              → vervalt: koppelingen komen uit de tekst en links
//
//   node scripts/documenten-naar-kaartjes.js <campagne|pad> [--schrijf]
const fs   = require('fs');
const path = require('path');

const doel    = process.argv[2];
const schrijf = process.argv.includes('--schrijf');
if (!doel) { console.error('Gebruik: node scripts/documenten-naar-kaartjes.js <campagne|pad> [--schrijf]'); process.exit(1); }

const map = doel.includes('/') ? doel : path.join(__dirname, '..', 'data', 'campaigns', doel);
const lees = (n) => JSON.parse(fs.readFileSync(path.join(map, n), 'utf8'));

const entities = lees('entities.json');
const archief  = lees('archief.json');
const dmState  = lees('dm-state.json');
const meta     = lees('meta.json');

const docs = archief.documents || [];
if (!docs.length) { console.log(`${doel}: geen documenten — niets te doen.`); process.exit(0); }

// ── 1. De kaartjes ──
const STAND = { revealed: 'visible', blurred: 'vague', hidden: 'hidden' };
const LINKVELD = { npcs: 'personages', locs: 'locaties', orgs: 'organisaties', items: 'voorwerpen', docs: 'documenten' };

entities.documenten = entities.documenten || [];
const bestaand = new Set(entities.documenten.map(e => e.id));
let nieuw = 0, metTekst = 0;

for (const d of docs) {
  if (bestaand.has(d.id)) continue;
  const links = {};
  for (const [oud, nieuwVeld] of Object.entries(LINKVELD)) {
    const arr = (d[oud] || []).filter(Boolean);
    if (arr.length) links[nieuwVeld] = arr;
  }
  const tekst = archief.tekstContent?.[d.id] || '';
  if (tekst) metTekst++;
  entities.documenten.push({
    id:      d.id,
    name:    d.name,
    subtype: '',
    data: {
      docType: d.type || '',
      desc:    d.desc || '',
      ...(tekst ? { tekst } : {}),
    },
    links,
  });
  nieuw++;
}

// ── 2. Zichtbaarheid per party ──
// Tot nu toe was `docStates` campagnebreed en `docVisibility` de uitzondering
// per party. Bij kaartjes bestaat alleen het tweede, dus schrijven we voor elke
// party de stand weg die hij op dit moment ziet.
let standen = 0;
for (const g of Object.values(dmState.groups || {})) {
  g.visibility = g.visibility || {};
  for (const d of docs) {
    const oud = (g.docVisibility && d.id in g.docVisibility)
      ? g.docVisibility[d.id]
      : (dmState.docStates?.[d.id] || 'hidden');
    const stand = STAND[oud] || 'hidden';
    if (stand === 'hidden') continue;          // hidden is de standaard
    g.visibility[d.id] = stand;
    standen++;
  }
}

// ── 3. Welke documenten horen bij welke akte ──
let gekoppeld = 0;
meta.hoofdstukken = meta.hoofdstukken || {};
for (const d of docs) {
  const key = d.hoofdstuk;
  if (!key || !meta.hoofdstukken[key]) continue;
  const h = meta.hoofdstukken[key];
  h.documenten = h.documenten || [];
  if (!h.documenten.includes(d.id)) { h.documenten.push(d.id); gekoppeld++; }
}

// ── 4. Het oude spoor opruimen ──
delete archief.documents;
delete archief.tekstContent;
delete archief.hiddenLinks;
delete dmState.docStates;
for (const g of Object.values(dmState.groups || {})) delete g.docVisibility;

console.log(`${doel}: ${nieuw} documenten omgezet (${metTekst} met perkamenttekst), `
  + `${standen} zichtbaarheden, ${gekoppeld} aan een akte gekoppeld`);

if (schrijf) {
  const stempel = new Date().toISOString().slice(0, 10);
  for (const [naam, inhoud] of [['entities.json', entities], ['archief.json', archief],
                                ['dm-state.json', dmState], ['meta.json', meta]]) {
    const p = path.join(map, naam);
    fs.copyFileSync(p, p.replace(/\.json$/, `.voor-docmigratie.${stempel}.json`));
    fs.writeFileSync(p, JSON.stringify(inhoud, null, 2));
  }
  console.log('Geschreven (kopie ernaast als .voor-docmigratie.<datum>.json)');
} else {
  console.log('Proefdraai — geef --schrijf om het echt te doen.');
}
