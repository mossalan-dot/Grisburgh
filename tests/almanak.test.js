const { describe, it } = require('node:test');
const assert = require('node:assert');
const A = require('../lib/almanak');

const cfg = A.ensureAlmanak(); // standaardconfig

describe('almanak — basisrekenen', () => {
  it('jaarlengte = som van maanddagen', () => {
    const expected = cfg.maanden.reduce((s, m) => s + m.dagen, 0);
    assert.strictEqual(A.yearLength(cfg), expected);
    assert.strictEqual(A.yearLength(cfg), 365); // 31+28+31+30+31+30+31+31+30+31+30+31
  });

  it('dayOfYear telt voorgaande maanden mee', () => {
    assert.strictEqual(A.dayOfYear(cfg, 0, 1), 1);
    assert.strictEqual(A.dayOfYear(cfg, 1, 1), 32);   // na Louwmaand (31)
    assert.strictEqual(A.dayOfYear(cfg, 2, 1), 60);   // na 31+28
  });

  it('absoluteDay is doorlopend over jaargrenzen', () => {
    const yl = A.yearLength(cfg);
    const a = A.absoluteDay(cfg, { jaar: 5, maandIdx: 0, dag: 1 });
    const b = A.absoluteDay(cfg, { jaar: 6, maandIdx: 0, dag: 1 });
    assert.strictEqual(b - a, yl);
  });
});

describe('almanak — addDays roll-over', () => {
  it('binnen dezelfde maand', () => {
    assert.deepStrictEqual(A.addDays(cfg, { jaar: 1247, maandIdx: 0, dag: 1 }, 5),
      { jaar: 1247, maandIdx: 0, dag: 6 });
  });

  it('over een maandgrens', () => {
    // Louwmaand heeft 31 dagen → dag 30 + 5 = dag 4 van Sprokkelmaand
    assert.deepStrictEqual(A.addDays(cfg, { jaar: 1247, maandIdx: 0, dag: 30 }, 5),
      { jaar: 1247, maandIdx: 1, dag: 4 });
  });

  it('over een jaargrens', () => {
    // laatste dag van het jaar + 1 = eerste dag volgend jaar
    const last = { jaar: 1247, maandIdx: cfg.maanden.length - 1, dag: cfg.maanden[cfg.maanden.length - 1].dagen };
    assert.deepStrictEqual(A.addDays(cfg, last, 1), { jaar: 1248, maandIdx: 0, dag: 1 });
  });

  it('negatieve delta rolt terug', () => {
    assert.deepStrictEqual(A.addDays(cfg, { jaar: 1248, maandIdx: 0, dag: 1 }, -1),
      { jaar: 1247, maandIdx: cfg.maanden.length - 1, dag: cfg.maanden[cfg.maanden.length - 1].dagen });
  });

  it('addDays is omkeerbaar', () => {
    const start = { jaar: 1247, maandIdx: 3, dag: 12 };
    const fwd = A.addDays(cfg, start, 100);
    const back = A.addDays(cfg, fwd, -100);
    assert.deepStrictEqual(back, start);
  });
});

describe('almanak — weekdag', () => {
  it('opeenvolgende dagen lopen de week rond', () => {
    const len = cfg.weekdagen.length;
    const d0 = A.weekdayIndex(cfg, { jaar: 1247, maandIdx: 0, dag: 1 });
    const d1 = A.weekdayIndex(cfg, { jaar: 1247, maandIdx: 0, dag: 2 });
    assert.strictEqual(d1, (d0 + 1) % len);
  });

  it('weekdagOffset verschuift de weekdag', () => {
    const base = A.ensureAlmanak({ weekdagOffset: 0 });
    const shifted = A.ensureAlmanak({ weekdagOffset: 3 });
    const date = { jaar: 1247, maandIdx: 0, dag: 1 };
    const len = base.weekdagen.length;
    assert.strictEqual(A.weekdayIndex(shifted, date), (A.weekdayIndex(base, date) + 3) % len);
  });
});

describe('almanak — maanfase', () => {
  it('nieuwe maan bij pos 0', () => {
    const a = A.ensureAlmanak({ maanCyclus: 28, maanOffset: 0 });
    // kies een datum waarvan absoluteDay deelbaar is door 28
    let date = { jaar: 0, maandIdx: 0, dag: 1 }; // absDay 0
    assert.strictEqual(A.absoluteDay(a, date), 0);
    assert.ok(A.isNewMoon(a, 0));
    assert.strictEqual(A.moonFraction(a, 0), 0);
    assert.strictEqual(A.moonLabel(0).naam, 'Nieuwe maan');
  });

  it('volle maan halverwege de cyclus', () => {
    const a = A.ensureAlmanak({ maanCyclus: 28, maanOffset: 0 });
    assert.ok(A.isFullMoon(a, 14));
    assert.strictEqual(A.moonLabel(A.moonFraction(a, 14)).naam, 'Volle maan');
    assert.ok(Math.abs(A.moonIllumination(0.5) - 1) < 1e-9);
  });

  it('verlichting is 0 bij nieuwe maan', () => {
    assert.ok(Math.abs(A.moonIllumination(0) - 0) < 1e-9);
  });

  it('maanOffset verschuift de fase', () => {
    const a = A.ensureAlmanak({ maanCyclus: 28, maanOffset: 14 });
    // met offset 14 is absDay 0 nu volle maan
    assert.ok(A.isFullMoon(a, 0));
  });
});

describe('almanak — seizoen & ensureAlmanak', () => {
  it('seasonOf vindt het juiste seizoen', () => {
    assert.strictEqual(A.seasonOf(cfg, 0).id, 'winter');
    assert.strictEqual(A.seasonOf(cfg, 4).id, 'lente');
    assert.strictEqual(A.seasonOf(cfg, 6).id, 'zomer');
    assert.strictEqual(A.seasonOf(cfg, 9).id, 'herfst');
  });

  it('ensureAlmanak vult ontbrekende velden aan', () => {
    const a = A.ensureAlmanak({ jaar: 800 });
    assert.strictEqual(a.jaar, 800);
    assert.ok(Array.isArray(a.maanden) && a.maanden.length === 12);
    assert.ok(Array.isArray(a.gebeurtenissen));
    assert.strictEqual(a.maanCyclus, 28);
  });

  it('ensureAlmanak klemt een ongeldige datum', () => {
    const a = A.ensureAlmanak({ maandIdx: 99, dag: 999 });
    assert.strictEqual(a.maandIdx, 11);
    assert.strictEqual(a.dag, a.maanden[11].dagen);
  });

  it('describeDate levert een volledig object', () => {
    const d = A.describeDate(cfg, { jaar: 1247, maandIdx: 0, dag: 1 });
    assert.ok(d.weekdag);
    assert.ok(d.maandNaam);
    assert.ok(d.seizoen);
    assert.ok(d.maanFase && d.maanFase.naam);
    assert.strictEqual(typeof d.maanVerlicht, 'number');
  });

  it('buildYearView geeft elke maand een startweekdag', () => {
    const v = A.buildYearView(cfg, 1247);
    assert.strictEqual(v.maanden.length, 12);
    for (const m of v.maanden) {
      assert.strictEqual(typeof m.startWeekdag, 'number');
      assert.ok(m.startWeekdag >= 0 && m.startWeekdag < cfg.weekdagen.length);
    }
  });
});
