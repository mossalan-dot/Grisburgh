const { describe, it } = require('node:test');
const assert = require('node:assert');
const D = require('../lib/downtime');

describe('downtime — ensureDowntime', () => {
  it('levert geldige defaults bij lege invoer', () => {
    const d = D.ensureDowntime();
    assert.strictEqual(d.enabled, true);
    assert.strictEqual(d.fase, 'twaalfdaagse');
    assert.ok(Array.isArray(d.activiteiten) && d.activiteiten.length >= 6);
    assert.ok(d.activiteiten.every(a => a.id && a.naam && typeof a.avond === 'boolean'));
  });

  it('saneert een onbekende fase', () => {
    assert.strictEqual(D.ensureDowntime({ fase: 'zomerreces' }).fase, 'twaalfdaagse');
    assert.strictEqual(D.ensureDowntime({ fase: 'open' }).fase, 'open');
  });

  it('vult ontbrekende activiteitvelden aan', () => {
    const d = D.ensureDowntime({ activiteiten: [{ naam: 'Vissen' }] });
    assert.strictEqual(d.activiteiten.length, 1);
    assert.ok(d.activiteiten[0].id);
    assert.strictEqual(d.activiteiten[0].avond, false);
    assert.strictEqual(d.activiteiten[0].emoji, '•');
  });

  it('valt terug op de standaardcatalogus bij een lege lijst', () => {
    assert.ok(D.ensureDowntime({ activiteiten: [] }).activiteiten.length >= 6);
  });
});

describe('downtime — beschikbaar()', () => {
  it('tijdens de Twaalfdaagse zijn alleen avond-activiteiten beschikbaar', () => {
    const avondAct = { avond: true };
    const langeAct = { avond: false };
    assert.strictEqual(D.beschikbaar(avondAct, 'twaalfdaagse'), true);
    assert.strictEqual(D.beschikbaar(langeAct, 'twaalfdaagse'), false);
  });

  it('na Lichtmis (open) is alles beschikbaar', () => {
    assert.strictEqual(D.beschikbaar({ avond: true }, 'open'), true);
    assert.strictEqual(D.beschikbaar({ avond: false }, 'open'), true);
  });

  it('de standaardcatalogus bevat zowel avond- als lange activiteiten', () => {
    const acts = D.DEFAULT_ACTIVITEITEN;
    assert.ok(acts.some(a => a.avond === true));
    assert.ok(acts.some(a => a.avond === false));
  });
});

describe('downtime — faseInfo()', () => {
  it('geeft label en omschrijving per fase', () => {
    assert.match(D.faseInfo('twaalfdaagse').label, /Twaalfdaagse/);
    assert.match(D.faseInfo('open').label, /Lichtmis/);
    assert.ok(D.faseInfo('onzin').label); // fallback
  });
});
