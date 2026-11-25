const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// **De verteller zegt hoe het ervoor staat, zonder één getal te noemen.** Bij
// elke nieuwe ronde dimt het tafelscherm en komt er een regel onder "RONDE N".
// Die regel wordt op het canvas getekend en staat dus in geen enkele DOM — je
// kunt hem alleen zien door op het juiste moment een foto te nemen, en hij
// staat er drie seconden. Daarom toetsen we hier de **regel**: de drempels
// bepalen wat er aan tafel gezegd wordt, en die kunnen stil verschuiven.
//
// Let op de volgorde in `_verteller`: wie er ligt wint van wie er wankelt, en
// "de vijand heeft de overhand" wint van "de party wankelt". Een omgekeerde
// volgorde geeft nog steeds een nette zin — en precies daarom valt het niet op.
const BRON = fs.readFileSync(path.join(__dirname, '..', 'public/js/combat-canvas.js'), 'utf8');

function verteller() {
  const knip = (start, eind) => {
    const a = BRON.indexOf(start);
    assert.ok(a > 0, `niet gevonden: ${start}`);
    const b = BRON.indexOf(eind, a);
    return BRON.slice(a, b);
  };
  const code = knip('function _hpFrac(c) {', 'function _drawHpBar')
             + knip('function _verteller(combat, ronde) {', '// ── De camera');
  const sandbox = {};
  vm.runInNewContext(code + '\nthis.uit = _verteller;', sandbox);
  return sandbox.uit;
}

const party  = (...fracties) => fracties.map((f, i) => ({ id: 'p' + i, name: 'Speler ' + i, type: 'player', hp: Math.round(f * 100), maxHp: 100 }));
const vijand = (...fracties) => fracties.map((f, i) => ({ id: 'm' + i, name: 'Monster ' + i, type: 'monster', hp: Math.round(f * 100), maxHp: 100 }));
const zeg = (p, m, ronde = 2) => verteller()({ combatants: [...p, ...m] }, ronde);

describe('De verteller op het tafelscherm', () => {
  it('zwijgt in de eerste ronde', () => {
    assert.equal(zeg(party(1), vijand(1), 1), '', 'in ronde 1 is er nog niets gebeurd');
  });

  it('zwijgt als er maar één kant staat', () => {
    assert.equal(zeg(party(1), [], 2), '', 'zonder vijand valt er niets te vertellen');
    assert.equal(zeg([], vijand(1), 2), '');
  });

  it('zegt dat de party wankelt onder 35%', () => {
    assert.equal(zeg(party(0.2, 0.2), vijand(0.5)), 'De party wankelt');
    assert.notEqual(zeg(party(0.5, 0.5), vijand(0.5)), 'De party wankelt', 'op de helft wankelt niemand');
  });

  it('noemt de overhand van de vijand als die zelf nog fris is', () => {
    // Zelfde party-stand, maar nu staat de vijand er goed voor: dan is dát het
    // nieuws, niet dat de party wankelt.
    assert.equal(zeg(party(0.2, 0.2), vijand(0.9)), 'De vijand heeft de overhand');
  });

  it('laat iemand die ligt alles overstemmen', () => {
    const p = party(1, 1);
    p[0].hp = 0;
    assert.equal(zeg(p, vijand(0.9)), 'Er ligt iemand op de grond');
    const laag = party(0.1, 0.1);
    laag[0].hp = 0;
    assert.equal(zeg(laag, vijand(0.9)), 'Er ligt iemand op de grond, en de rest staat er niet best voor',
      'wie ligt wint van wie wankelt');
  });

  it('ziet het ook als de vijand het begeeft', () => {
    assert.equal(zeg(party(0.9), vijand(0.2)), 'De vijand wankelt');
    assert.equal(zeg(party(0.9), vijand(0.45)), 'Het tij keert');
  });

  it('zegt na vijf ronden dat het zich voortsleept', () => {
    assert.equal(zeg(party(0.8), vijand(0.8), 6), 'Het gevecht sleept zich voort');
  });

  it('valt terug op een rustige zin, en niet elke ronde dezelfde', () => {
    const zinnen = [2, 3, 4].map(r => zeg(party(0.8), vijand(0.8), r));
    assert.equal(new Set(zinnen).size, 3, 'drie ronden achter elkaar hetzelfde leest als een kapot scherm');
    zinnen.forEach(z => assert.ok(z.length > 3));
  });

  // Het hele punt van dit scherm: de tafel hoort geen cijfers te zien.
  it('noemt nooit een getal', () => {
    const alles = [
      zeg(party(0.2), vijand(0.9)), zeg(party(0.9), vijand(0.2)),
      zeg(party(0.8), vijand(0.8), 6), zeg(party(0.1, 0.1), vijand(0.9)),
    ];
    for (const z of alles) assert.ok(!/\d/.test(z), `er staat een getal in: "${z}"`);
  });

  // Een vage deelnemer heeft geen `hp` maar een `hpPct` — dan moet de verteller
  // dáárop rekenen. Zonder die tak valt iedereen terug op 0 en zegt het scherm
  // dat de hele party ligt.
  it('rekent ook met een vage deelnemer', () => {
    // **Toets hier op een gezónde party, niet op een gewonde.** Valt de
    // `hpPct`-tak uit `_hpFrac` weg, dan wordt elke vage deelnemer 0 — en dan
    // zegt het scherm "De party wankelt". Een toets die dát verwacht is
    // vacuüm: hij slaagt juist op de kapotte versie. Een vage party op 90%
    // hoort een rustige zin te krijgen, en die is onmiskenbaar anders.
    const heel = [{ id: 'p0', type: 'player', hpPct: 90 }, { id: 'p1', type: 'player', hpPct: 90 }];
    const zin = zeg(heel, [{ id: 'm0', type: 'monster', hpPct: 90 }]);
    assert.notEqual(zin, 'De party wankelt', 'een vage party op 90% wankelt niet');
    assert.notEqual(zin, 'De vijand heeft de overhand');
    assert.ok(zin.length > 3, 'en er staat wél iets');

    // En andersom: op 20% hoort hij het wél te zeggen.
    const gewond = [{ id: 'p0', type: 'player', hpPct: 20 }, { id: 'p1', type: 'player', hpPct: 20 }];
    assert.equal(zeg(gewond, [{ id: 'm0', type: 'monster', hpPct: 50 }]), 'De party wankelt');
  });
});
