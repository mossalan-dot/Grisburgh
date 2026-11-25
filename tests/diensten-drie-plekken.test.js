const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

// **Een nieuwe dienst moet op drie plekken landen.** Dat staat al jaren in
// CLAUDE.md, en toch gaat het mis — want vergeet je er een, dan merkt niemand
// het: de sfeerloop speelt gewoon niet.
//
//   1. `_DIENST_SVC_KEYS` in `routes/api.js` — de server laat de sleutel toe
//      in `serviceAmbiance` (zonder deze weigert hij de opslag);
//   2. `_DIENST_AMB_LABELS` in `public/js/app.js` — de client vráágt de loop
//      zodra je die sectie opent;
//   3. `_DIENSTEN` in `public/js/dm-panel.js` — de rij waar de DM hem instelt.
//
// Gemeten op 25 nov 2026: de **woekeraar** stond alleen in de tweede. Hij is
// een volwaardige dienst (eigen sectie, module en DM-tab), de client vroeg dus
// om zijn loop — maar de DM had geen rij om er een te kiezen en de server zou
// de sleutel geweigerd hebben. Niet te zien, want een loop die niet speelt
// klinkt als een dienst zonder muziek.
const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');

// Uit de bron knippen in plaats van importeren: twee van de drie zijn
// browser-modules zonder export, en de derde zit midden in een 20k-regelbestand.
// **Elk lijstje heeft een eigen vorm**, dus een eigen lezer — en het commentaar
// gaat er eerst uit, anders telt een dienst die in een toelichting genoemd
// wordt (`'facties' heeft géén sectie-loop`) mee als vermelding. Zelfde val als
// bij de bewakers op `req.session?.campaignId` en op de knop-opmaak.
const zonderCommentaar = (t) => t.replace(/\/\/[^\n]*/g, '');

function blok(tekst, naam, re) {
  const m = re.exec(tekst);
  assert.ok(m, `${naam} niet gevonden — is hij hernoemd?`);
  return zonderCommentaar(m[1]);
}
const uitStrings = (t) => new Set([...t.matchAll(/'([a-z-]+)'/g)].map(x => x[1]));
const uitSleutels = (t) => new Set([...t.matchAll(/(?:^|[{,])\s*([a-z][a-z-]*)\s*:/g)].map(x => x[1]));
const uitKeys = (t) => new Set([...t.matchAll(/key:\s*'([a-z-]+)'/g)].map(x => x[1]));

describe('Een dienst staat op alle drie de plekken', () => {
  it('server, client en de Geluiden-tab kennen dezelfde diensten', () => {
    const server = uitStrings(blok(lees('routes/api.js'), '_DIENST_SVC_KEYS',
      /const _DIENST_SVC_KEYS = \[([^\]]*)\]/));
    const client = uitSleutels(blok(lees('public/js/app.js'), '_DIENST_AMB_LABELS',
      /const _DIENST_AMB_LABELS = \{([\s\S]*?)\n\};/));
    const tab = uitKeys(blok(lees('public/js/dm-panel.js'), '_DIENSTEN',
      /const _DIENSTEN = \[([\s\S]*?)\n  \];/));

    const alles = new Set([...server, ...client, ...tab]);
    const mist = [];
    for (const dienst of [...alles].sort()) {
      const waar = [];
      if (!server.has(dienst)) waar.push('de server (_DIENST_SVC_KEYS)');
      if (!client.has(dienst)) waar.push('de client (_DIENST_AMB_LABELS)');
      if (!tab.has(dienst))    waar.push('de Geluiden-tab (_DIENSTEN)');
      if (waar.length) mist.push(`${dienst} ontbreekt in ${waar.join(' en ')}`);
    }
    assert.deepStrictEqual(mist, [],
      'deze diensten staan niet op alle drie de plekken:\n  ' + mist.join('\n  '));
    assert.ok(alles.size >= 6, 'de lijst is niet leeg geraakt');
  });

  // En wat de drie lijsten noemen, moet ook echt een dienst zijn: een sectie
  // met een module, zodat hij uit kan.
  it('en elke dienst kan uit als module', () => {
    const modules = require(path.join(WORTEL, 'lib', 'modules.js'));
    const cat = modules.MODULES || modules.modules || modules;
    const lijst = Array.isArray(cat) ? cat : Object.values(cat);
    const secties = new Set();
    for (const m of lijst) for (const s of (m.secties || [])) secties.add(s);

    const client = uitSleutels(blok(lees('public/js/app.js'), '_DIENST_AMB_LABELS',
      /const _DIENST_AMB_LABELS = \{([\s\S]*?)\n\};/));
    const zonder = [...client].filter(d => !secties.has(d));
    assert.deepStrictEqual(zonder, [],
      'deze diensten hebben geen module en kunnen dus niet uit: ' + zonder.join(', '));
  });
});
