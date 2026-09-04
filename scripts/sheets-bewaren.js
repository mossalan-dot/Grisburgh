#!/usr/bin/env node
// Schrijft de character sheets van elke party weg als HTML, per campagne.
// Draait mee in de nachtelijke backup: de JSON is de echte kopie, dit is de
// leesbare — een blad dat je kunt printen zonder dat de app draait.
//
// Gebruik: node scripts/sheets-bewaren.js <doelmap>
const fs   = require('fs');
const path = require('path');
const storage = require('../lib/storage');
const { sheetHtml } = require('../lib/character-sheet');
const { sheetPersonage, sheetProgressie } = require('../routes/api');

const doel = process.argv[2];
if (!doel) { console.error('Gebruik: node scripts/sheets-bewaren.js <doelmap>'); process.exit(1); }

let geschreven = 0;
for (const { id } of storage.listCampaigns()) {
  storage.runInCampaign(id, () => {
    const dmState    = storage.readJSON('dm-state.json');
    const meta       = storage.readJSON('meta.json') || {};
    const personages = storage.readJSON('entities.json').personages || [];
    const prog       = sheetProgressie();
    const groepen    = Object.entries(dmState.groups || {});
    if (!groepen.length) return;

    const map = path.join(doel, id, 'sheets');
    fs.mkdirSync(map, { recursive: true });

    for (const [groepId, groep] of groepen) {
      const spelers = personages
        .filter(e => e.subtype === 'speler' && e.data?.groep === groepId)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (!spelers.length) continue;
      const naam = groep.name || meta.appTitle || 'party';
      const html = sheetHtml(
        spelers.map(e => sheetPersonage(e, dmState, prog, meta, personages)),
        { titel: naam }
      );
      const bestand = path.join(map, `${naam.replace(/[^\w\- ]+/g, '_')}.html`);
      fs.writeFileSync(bestand, html);
      geschreven++;
    }
  });
}
console.log(`${geschreven} sheet-bestand(en) weggeschreven naar ${doel}`);
