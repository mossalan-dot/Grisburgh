const { describe, it } = require('node:test');
const assert = require('node:assert');
const W = require('../lib/weer');

describe('weer — ensureWeer', () => {
  it('levert geldige defaults bij lege invoer', () => {
    const w = W.ensureWeer();
    assert.strictEqual(w.conditie, 'helder');
    assert.strictEqual(w.dagdeel, 'middag');
    assert.ok(w.wind >= 0 && w.wind < W.WIND_LABELS.length);
    assert.ok(w.temp >= 0 && w.temp < W.TEMP_LABELS.length);
    assert.strictEqual(w.enabled, true);
  });

  it('saneert een onbekende conditie en dagdeel', () => {
    const w = W.ensureWeer({ conditie: 'tornado', dagdeel: 'middernacht' });
    assert.strictEqual(w.conditie, 'helder');
    assert.strictEqual(w.dagdeel, 'middag');
  });

  it('klemt wind- en temp-indices buiten bereik', () => {
    assert.strictEqual(W.ensureWeer({ wind: 99 }).wind, W.DEFAULT_WEER.wind);
    assert.strictEqual(W.ensureWeer({ temp: -5 }).temp, W.DEFAULT_WEER.temp);
    assert.strictEqual(W.ensureWeer({ wind: 0 }).wind, 0);
  });

  it('behoudt geldige waarden', () => {
    const w = W.ensureWeer({ conditie: 'storm', dagdeel: 'nacht', wind: 3, temp: 0, notitie: 'Grauw', enabled: false });
    assert.strictEqual(w.conditie, 'storm');
    assert.strictEqual(w.dagdeel, 'nacht');
    assert.strictEqual(w.wind, 3);
    assert.strictEqual(w.temp, 0);
    assert.strictEqual(w.notitie, 'Grauw');
    assert.strictEqual(w.enabled, false);
  });
});

describe('weer — rollConditie', () => {
  it('geeft altijd een geldige conditie-id', () => {
    for (let i = 0; i < 100; i++) {
      const id = W.rollConditie();
      assert.ok(W.CONDITIES.some(c => c.id === id), `ongeldige id: ${id}`);
    }
  });

  it('rnd→0 geeft de eerste conditie, rnd→bijna-1 de laatste', () => {
    assert.strictEqual(W.rollConditie(() => 0), W.CONDITIES[0].id);
    assert.strictEqual(W.rollConditie(() => 0.999999), W.CONDITIES[W.CONDITIES.length - 1].id);
  });

  it('respecteert de gewichten (helder komt vaker dan storm)', () => {
    let helder = 0, storm = 0;
    let seed = 1;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 5000; i++) {
      const id = W.rollConditie(rnd);
      if (id === 'helder') helder++;
      if (id === 'storm')  storm++;
    }
    assert.ok(helder > storm, `helder(${helder}) zou vaker moeten zijn dan storm(${storm})`);
  });
});
