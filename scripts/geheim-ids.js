#!/usr/bin/env node
// Eenmalige migratie: geheimregels krijgen een eigen id.
//
// Een geheim stond als kale tekst in een lijst, en alles wat ernaar wees deed
// dat op regelnummer: de onthulstand per party (`secretReveals`) en een geheime
// verbinding (`betrokkenen[].geheim.i`). Haalde je er een regel tussenuit, dan
// schoof de verwijzing mee naar de buurman — een onthuld geheim werd een ander
// geheim, en een geheime verbinding hing ineens aan de verkeerde regel.
//
// Na deze migratie is een regel `{ id, tekst, antagonist? }` en wijst alles naar
// dat id. De code leest de oude vorm nog (per positie), dus dit is opschonen en
// geen voorwaarde — maar zolang een kaartje niet om is, kan het scheef schuiven.
//
//   node scripts/geheim-ids.js <campagne> [--schrijf]
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/geheim-ids.js <campagne> [--schrijf]'); process.exit(1); }

const map = path.join(__dirname, '..', 'data', 'campaigns', campagne);
const padEnt = path.join(map, 'entities.json');
const padDm  = path.join(map, 'dm-state.json');
const entities = JSON.parse(fs.readFileSync(padEnt, 'utf8'));
const dmState  = JSON.parse(fs.readFileSync(padDm, 'utf8'));

let teller = 0;
const nieuwId = () => 'g_' + (teller++).toString(36).padStart(3, '0')
  + '_' + Math.random().toString(36).slice(2, 8);

// Zelfde lezing als _geheimRegels op de server.
function regelsUit(data) {
  let arr = [];
  const rauw = data?.geheimen;
  if (Array.isArray(rauw)) arr = rauw;
  else if (typeof rauw === 'string' && rauw.trim()) {
    try { const j = JSON.parse(rauw); if (Array.isArray(j)) arr = j; } catch { arr = [rauw]; }
  }
  if (!arr.length && data?.geheim) arr = [data.geheim];
  let antagOud = [];
  try { const j = JSON.parse(data?.geheimenAntagonist || '[]'); if (Array.isArray(j)) antagOud = j.map(Boolean); } catch { /* ok */ }
  if (!antagOud.length && (data?.geheimeAntagonist === true || data?.geheimeAntagonist === 'true')) {
    antagOud = arr.map(() => true);
  }
  return arr.map((r, i) => (typeof r === 'string' || r == null)
    ? { id: '', tekst: String(r || ''), antagonist: !!antagOud[i] }
    : { id: r.id || '', tekst: String(r.tekst ?? ''), antagonist: !!(r.antagonist ?? antagOud[i]) });
}

const TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
const idsPerKaart = {};   // entityId -> [regel-id per positie]
let kaartjes = 0, regels = 0;

for (const t of TYPES) {
  for (const e of (entities[t] || [])) {
    const rijen = regelsUit(e.data);
    if (!rijen.length) continue;
    const alOm = rijen.every(r => r.id);
    rijen.forEach(r => { if (!r.id) r.id = nieuwId(); });
    idsPerKaart[e.id] = rijen.map(r => r.id);
    regels += rijen.length;
    if (alOm) continue;
    kaartjes++;
    e.data = { ...(e.data || {}) };
    e.data.geheimen = JSON.stringify(rijen.map(r => ({
      id: r.id, tekst: r.tekst, ...(r.antagonist ? { antagonist: true } : {}),
    })));
    e.data.geheim = rijen[0]?.tekst || '';
    e.data.geheimenAntagonist = '';   // opgegaan in de regels zelf
    e.data.geheimeAntagonist  = '';
  }
}

// Onthulstand per party: [true, false] -> { <id>: true }
let standen = 0;
for (const g of Object.values(dmState.groups || {})) {
  for (const [kaartId, stand] of Object.entries(g.secretReveals || {})) {
    const ids = idsPerKaart[kaartId];
    if (!ids || (stand && !Array.isArray(stand) && typeof stand === 'object')) continue;
    const aan = Array.isArray(stand) ? stand : (stand === true || stand === 'true' ? [true] : []);
    g.secretReveals[kaartId] = Object.fromEntries(
      ids.filter((_, i) => aan[i]).map(id => [id, true]));
    standen++;
  }
}

// Geheime verbindingen: { id, i } -> { id, gid }
let verbindingen = 0;
for (const t of ['locaties', 'organisaties']) {
  for (const doel of (entities[t] || [])) {
    let rijen = [];
    try { rijen = JSON.parse(doel.data?.betrokkenen || '[]'); } catch { rijen = []; }
    if (!Array.isArray(rijen) || !rijen.some(r => r?.geheim?.id && !r.geheim.gid)) continue;
    doel.data = { ...(doel.data || {}), betrokkenen: JSON.stringify(rijen.map(r => {
      if (!r?.geheim?.id || r.geheim.gid) return r;
      const gid = idsPerKaart[r.geheim.id]?.[Number(r.geheim.i) || 0];
      verbindingen++;
      // Wijst hij naar een regel die niet meer bestaat, dan is het geheim weg
      // en is de verbinding gewoon zichtbaar — zo staat het ook in de server.
      if (!gid) { const uit = { ...r }; delete uit.geheim; return uit; }
      return { ...r, geheim: { id: r.geheim.id, gid } };
    })) };
  }
}

console.log(`${campagne}: ${kaartjes} kaartjes omgezet (${regels} geheimregels), `
  + `${standen} onthulstanden, ${verbindingen} geheime verbindingen`);

if (schrijf) {
  const stempel = new Date().toISOString().slice(0, 10);
  for (const [pad, inhoud] of [[padEnt, entities], [padDm, dmState]]) {
    fs.copyFileSync(pad, pad.replace(/\.json$/, `.voor-geheimids.${stempel}.json`));
    fs.writeFileSync(pad, JSON.stringify(inhoud, null, 2));
  }
  console.log('Geschreven (kopie ernaast als .voor-geheimids.<datum>.json)');
} else {
  console.log('Proefdraai — geef --schrijf om het echt te doen.');
}
