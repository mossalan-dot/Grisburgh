#!/usr/bin/env node
// Herstel verloren akte-verslagen (sessieLog) uit een backup, via merge-op-ID.
// - Vult lege velden (samenvatting/citaat/…) aan vanuit de backup zonder
//   bestaande, niet-lege tekst te overschrijven.
// - Voegt entries die alleen in de backup zitten opnieuw toe.
// - Laat entries die alleen in de huidige data zitten ongemoeid (nieuw werk).
// Dry-run standaard; schrijft pas met --apply.
//
// Gebruik: node restore-aktes.js <campagne-dir> <backup-bestand> [--apply]

const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];
const BAK = process.argv[3];
const APPLY = process.argv.includes('--apply');
if (!DIR || !BAK) { console.error('Gebruik: node restore-aktes.js <dir> <backupbestand> [--apply]'); process.exit(1); }

const curPath = path.join(DIR, 'archief.json');
const bakPath = path.join(DIR, BAK);
const cur = JSON.parse(fs.readFileSync(curPath, 'utf8'));
const bak = JSON.parse(fs.readFileSync(bakPath, 'utf8'));

const curSL = cur.sessieLog || (cur.sessieLog = []);
const bakSL = bak.sessieLog || [];
const byId = new Map(curSL.map(e => [e.id, e]));

const FILL = ['hoofdstuk','datum','korteSamenvatting','samenvatting','citaat','images',
  'nieuwPersonages','terugkerendPersonages','nieuwLocaties','terugkerendLocaties',
  'organisaties','voorwerpen','docs','nieuw','terugkerend'];
const isEmpty = v => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

let restoredSamenv = 0, filledFields = 0, readded = 0;
const readdedList = [];
for (const b of bakSL) {
  const c = byId.get(b.id);
  if (c) {
    for (const k of FILL) {
      if (isEmpty(c[k]) && !isEmpty(b[k])) { c[k] = b[k]; filledFields++; if (k === 'samenvatting') restoredSamenv++; }
    }
  } else {
    curSL.push(b); readded++;
    readdedList.push(`${b.hoofdstuk || '?'} · ${(b.korteSamenvatting || '').slice(0, 42)}`);
  }
}

console.log('— Rapport —');
console.log('entries voor:', byId.size, '| na:', curSL.length);
console.log('samenvattingen hersteld (op bestaande entries):', restoredSamenv);
console.log('losse velden aangevuld:', filledFields);
console.log('entries opnieuw toegevoegd (alleen in backup):', readded);
readdedList.forEach(l => console.log('   +', l));
console.log('met samenvatting na merge:', curSL.filter(e => (e.samenvatting || '').trim()).length);

if (APPLY) {
  fs.writeFileSync(curPath + '.tmp', JSON.stringify(cur, null, 2));
  fs.renameSync(curPath + '.tmp', curPath);
  console.log('\n✓ Geschreven naar', curPath);
} else {
  console.log('\n(DRY-RUN — niets geschreven. Voeg --apply toe om weg te schrijven.)');
}
