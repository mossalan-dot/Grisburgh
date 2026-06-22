#!/usr/bin/env node
// Verwijdert het generieke testdier Rakker (e_pet_hond_test) volledig:
// uit entities.json én alle companion-referenties in dm-state.json.
// Gebruik: node scripts/cleanup-pet-rakker.js <entities.json> <dm-state.json>
const fs = require('fs');

const [entFile, dmFile] = process.argv.slice(2);
if (!entFile || !dmFile) { console.error('Gebruik: node cleanup-pet-rakker.js <entities.json> <dm-state.json>'); process.exit(1); }
const ID = 'e_pet_hond_test';

const ent = JSON.parse(fs.readFileSync(entFile, 'utf8'));
const before = (ent.personages || []).length;
ent.personages = (ent.personages || []).filter(e => e.id !== ID);
const removed = before - ent.personages.length;
fs.writeFileSync(entFile, JSON.stringify(ent, null, 2));

const dm = JSON.parse(fs.readFileSync(dmFile, 'utf8'));
let refs = 0;
for (const g of Object.values(dm.groups || {})) {
  if (Array.isArray(g.companions) && g.companions.includes(ID)) { g.companions = g.companions.filter(x => x !== ID); refs++; }
  for (const m of ['companionOwners', 'companionNames', 'deceased', 'visibility']) {
    if (g[m] && ID in g[m]) { delete g[m][ID]; refs++; }
  }
}
fs.writeFileSync(dmFile, JSON.stringify(dm, null, 2));
console.log(`Rakker verwijderd: ${removed} entity, ${refs} dm-state-referentie(s) opgeschoond. Personages nu: ${ent.personages.length}`);
