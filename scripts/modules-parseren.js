#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  PARSEERT ELKE FRONTEND-MODULE NOG?
// ════════════════════════════════════════════════════════════════════════════
// De val die in dit project het vaakst toesloeg (elf keer inmiddels): je zet
// uitleg in een <!-- commentaar --> binnen een template literal en noemt daarin
// een veld tussen backticks. Die backtick sluit de literal. Wat erachter staat
// wordt code, de module parseert niet meer, en het scherm blijft leeg.
//
// Backticks tellen helpt niet — twee backticks in zo'n commentaar breken
// evengoed, en een uitgecommentarieerd stuk code mét backticks is juist prima.
// Alleen echt parseren wijst het aan, en als **module**, want dat is wat de
// browser doet. Vandaar een kopie met .mjs en `node --check`.
//
// Dit is dezelfde controle als in tests/frontend-imports.test.js. Hij staat hier
// apart omdat de testsuite pas aan het eind van een reeks wijzigingen draait,
// en deze na élke bewerking kan: `npm run check`, ruim een seconde.

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const map = path.join(__dirname, '..', 'public', 'js');
const bestanden = fs.readdirSync(map).filter(f => f.endsWith('.js'));

let stuk = 0;
for (const naam of bestanden) {
  const tmp = path.join(os.tmpdir(), `gris-check-${process.pid}-${naam}.mjs`);
  fs.copyFileSync(path.join(map, naam), tmp);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  } catch (e) {
    const melding = (e.stderr || '').toString().split('\n').slice(0, 4).join('\n');
    console.error(`\n  ${naam} parseert niet:\n${melding}`);
    stuk++;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* weg is weg */ }
  }
}

if (stuk) {
  console.error(`\n${stuk} module${stuk === 1 ? '' : 's'} stuk. Meestal een backtick in een HTML-commentaar binnen een template literal.`);
  process.exit(1);
}
console.log(`${bestanden.length} modules nagekeken — allemaal goed.`);
