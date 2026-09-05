#!/usr/bin/env node
/**
 * Voegt de losse dmNote van een kaartje samen met `data.persoonlijkheid`.
 *
 * Er waren twee DM-notitievelden op één kaartje: het veld uit de bewerkmodus
 * ("Aantekeningen voor de DM") en een losse notitie die je alleen in het
 * detailvenster kon typen. Ze heetten door elkaar heen en niemand wist welke
 * hij voor zich had. Dit script plakt de losse notitie onder de bestaande tekst
 * en leegt `dmNotes`.
 *
 *   node scripts/notities-samenvoegen.js <campagne> [--schrijf]
 */
const fs = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/notities-samenvoegen.js <campagne> [--schrijf]'); process.exit(1); }

const dir = path.join(__dirname, '..', 'data', 'campaigns', campagne);
const entPad = path.join(dir, 'entities.json');
const dmPad  = path.join(dir, 'dm-state.json');
if (!fs.existsSync(entPad)) { console.error('Niet gevonden: ' + entPad); process.exit(1); }

const entities = JSON.parse(fs.readFileSync(entPad, 'utf8'));
const dmState  = JSON.parse(fs.readFileSync(dmPad, 'utf8'));
const notes    = dmState.dmNotes || {};

const alle = Object.values(entities).flatMap(v => Array.isArray(v) ? v : []);
let samengevoegd = 0, verweesd = 0;

for (const [id, note] of Object.entries(notes)) {
  const tekst = String(note || '').trim();
  if (!tekst) continue;
  const e = alle.find(x => x.id === id);
  if (!e) { verweesd++; continue; }
  if (!e.data) e.data = {};
  const bestaand = String(e.data.persoonlijkheid || '').trim();
  e.data.persoonlijkheid = bestaand ? `${bestaand}\n\n${tekst}` : tekst;
  console.log(`✓ ${e.name}: ${bestaand ? 'notitie eronder geplakt' : 'notitie overgenomen'}`);
  samengevoegd++;
}

console.log(`\n${samengevoegd} samengevoegd${verweesd ? `, ${verweesd} notitie(s) zonder kaartje overgeslagen` : ''}.`);
if (!schrijf) { console.log('(proefdraai — draai met --schrijf)'); process.exit(0); }
if (samengevoegd || Object.keys(notes).length) {
  for (const pad of [entPad, dmPad]) fs.copyFileSync(pad, pad.replace(/\.json$/, `.bak.${Date.now()}.json`));
  dmState.dmNotes = {};
  fs.writeFileSync(entPad, JSON.stringify(entities, null, 2));
  fs.writeFileSync(dmPad,  JSON.stringify(dmState,  null, 2));
  console.log('Opgeslagen.');
}
