// Uit de ronde als speler op een telefoon (7 nov 2026).
//
// 1. De korte muntnaam. De beurs bovenin elke dienst gebruikte de interne
//    sleutels (fl/kn/cl) als afkorting; in een campagne met Gold/Silver stond
//    er dan "23 fl · 4 kn".
// 2. De ondertekening op één regel. `--De Havenmeester--` stond letterlijk
//    onder een brief, want alleen de markeerregel `--handtekening--` werd
//    herkend.
//
// Beide stukken worden uit de échte module geknipt en in een `vm` gedraaid —
// de toets hoort op de code te staan die de browser draait.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const lees = f => fs.readFileSync(path.join(__dirname, '..', 'public/js', f), 'utf8');

function muntSandbox(namen) {
  const app = lees('app.js');
  const begin = app.indexOf('const _MUNT_AFK_STD');
  const eind = app.indexOf('};', app.indexOf('window._muntKort')) + 2;
  assert.ok(begin > 0 && eind > begin, 'muntblok gevonden in app.js');
  const window = { _muntNamen: () => namen };
  vm.runInNewContext(app.slice(begin, eind), { window });
  return window;
}

describe('Korte muntnamen', () => {
  it('Gold/Silver/Copper worden gp/sp/cp', () => {
    const w = muntSandbox({ fl: 'Gold', kn: 'Silver', cl: 'Copper' });
    assert.strictEqual(w._muntKort({ fl: 23, kn: 4 }), '23 gp · 4 sp');
    assert.strictEqual(w._muntKort({}), '0 cp');
  });
  it('Grisburgh houdt fl/kn/cl', () => {
    const w = muntSandbox({ fl: 'Florinde', kn: 'Knaker', cl: 'Centeling' });
    assert.strictEqual(w._muntKort({ fl: 1, kn: 3, cl: 4 }, ' '), '1 fl 3 kn 4 cl');
  });
  it('eigen namen: de eerste twee letters', () => {
    const w = muntSandbox({ fl: 'Daalder', kn: 'Stuiver', cl: 'Duit' });
    assert.strictEqual(w._muntKort({ fl: 2, cl: 5 }), '2 da · 5 du');
    assert.strictEqual(w._muntKort({}, ' ', 'gratis'), 'gratis');
  });
});

describe('Perkament: ondertekening', () => {
  const rc = lees('render-campagne.js');
  const begin = rc.indexOf('function renderParchment(');
  const eind = rc.indexOf('\n}\n', begin) + 3;
  const ctx = { mdToHtml: t => String(t).replace(/</g, '&lt;') };
  vm.runInNewContext(rc.slice(begin, eind) + ';this.rp = renderParchment;', ctx);

  it('`--Naam--` op één regel is een ondertekening', () => {
    const html = ctx.rp('Beste reizigers,\n\n--De Havenmeester--');
    assert.match(html, /<div class="parch-sig">De Havenmeester<\/div>/);
    assert.doesNotMatch(html, /--De Havenmeester--/);
  });
  it('de markeerregels en een scheidingslijn blijven wat ze waren', () => {
    const html = ctx.rp('---titel---\nKop\ntekst\n---\n--handtekening--\nAnna');
    assert.match(html, /parch-title">Kop</);
    assert.match(html, /<hr class="parch-rule">/);
    assert.match(html, /parch-sig">Anna</);
  });
});
