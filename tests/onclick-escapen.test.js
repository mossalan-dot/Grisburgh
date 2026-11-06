// Inline handlers en de apostrof (review 6 nov 2026).
//
// In `onclick="f('${esc(naam)}')"` decodeert de browser eerst het attribuut en
// voert daarna de JavaScript uit. `esc()` maakt iets veilig voor HTML, niet
// voor een JS-string: een apostrof in de naam sloot de string. "Bigby's Hand"
// gaf een knop die niets deed, en een zelfgekozen personagenaam werd code in
// het scherm van de DM. `escArg` doet eerst de JS-string, dan de HTML.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { bewerk } = require('../scripts/onclick-escapen');

const MAP = path.join(__dirname, '..', 'public', 'js');
const bestanden = fs.readdirSync(MAP).filter(f => f.endsWith('.js'));

// Haal een functiedeclaratie uit de broncode, accolades tellend.
function functieUit(src, naam) {
  const start = src.indexOf(`function ${naam}(`);
  assert.ok(start >= 0, `${naam} niet gevonden`);
  let d = 0;
  for (let k = src.indexOf('{', start); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(start, k + 1);
  }
  throw new Error('geen einde');
}

describe('Inline handlers escapen hun argumenten als JS-string', () => {
  it('heeft nergens meer esc() of escJS() als string-argument in een on…-attribuut', () => {
    const over = bestanden
      .map(f => [f, bewerk(fs.readFileSync(path.join(MAP, f), 'utf8')).aantal])
      .filter(([, n]) => n > 0);
    assert.deepStrictEqual(over, [], 'draai node scripts/onclick-escapen.js --schrijf');
  });

  it('definieert escArg in elk bestand dat hem gebruikt', () => {
    for (const f of bestanden) {
      const src = fs.readFileSync(path.join(MAP, f), 'utf8');
      if (!src.includes('escArg(')) continue;
      assert.ok(/^(const escArg\s*=|function escArg\()/m.test(src), `${f} gebruikt escArg zonder hem te definiëren`);
    }
  });

  it('komt na decoderen en uitvoeren woordelijk terug, ook met lastige tekens', () => {
    const src = fs.readFileSync(path.join(MAP, 'app.js'), 'utf8');
    const ctx = {};
    vm.runInNewContext(`${functieUit(src, 'esc')}\n${functieUit(src, 'escArg')}\nthis.escArg = escArg;`, ctx);
    const decodeer = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const namen = [
      "Bigby's Hand", "Lion d'or", 'Een "aanhaling"', 'back\\slash', "x');globalThis.gehackt=1;('",
      'twee\nregels', '<b>vet</b> & zo', '',
    ];
    for (const naam of namen) {
      const attribuut = `ontvang('${ctx.escArg(naam)}')`;
      assert.ok(!attribuut.includes('"'), 'een " zou het HTML-attribuut sluiten');
      let gekregen;
      const sandbox = { ontvang: v => { gekregen = v; }, globalThis: {} };
      vm.runInNewContext(decodeer(attribuut), sandbox);
      assert.strictEqual(gekregen, naam);
      assert.strictEqual(sandbox.globalThis.gehackt, undefined, 'de naam mag geen code worden');
    }
  });

  it('laat getallen en lege waarden gaan zoals esc() dat deed', () => {
    const src = fs.readFileSync(path.join(MAP, 'app.js'), 'utf8');
    const ctx = {};
    vm.runInNewContext(`${functieUit(src, 'esc')}\n${functieUit(src, 'escArg')}\nthis.esc = esc; this.escArg = escArg;`, ctx);
    for (const v of [0, 7, null, undefined, false]) assert.strictEqual(ctx.escArg(v), ctx.esc(v));
  });
});
