const { describe, it } = require('node:test');
const assert = require('node:assert');
const O = require('../lib/orakel');

describe('orakel — ensureOrakel', () => {
  it('levert geldige defaults bij lege invoer', () => {
    const o = O.ensureOrakel();
    assert.strictEqual(o.enabled, true);
    assert.ok(Array.isArray(o.deck) && o.deck.length >= 10);
    assert.strictEqual(o.lastDraw, null);
    assert.ok(o.deck.every(c => c.id && c.titel && c.symbool));
  });

  it('vult ontbrekende kaartvelden aan', () => {
    const o = O.ensureOrakel({ deck: [{ titel: 'Test' }] });
    assert.strictEqual(o.deck.length, 1);
    assert.ok(o.deck[0].id);
    assert.strictEqual(o.deck[0].symbool, '✦');
    assert.strictEqual(o.deck[0].omen, '');
  });

  it('valt terug op het standaarddek bij een leeg dek', () => {
    const o = O.ensureOrakel({ deck: [] });
    assert.ok(o.deck.length >= 10);
  });

  it('wist een lastDraw die niet meer in het dek bestaat', () => {
    const o = O.ensureOrakel({ deck: [{ id: 'a', titel: 'A' }], lastDraw: { cardId: 'weg', at: 1, by: 'x' } });
    assert.strictEqual(o.lastDraw, null);
  });

  it('behoudt een geldige lastDraw', () => {
    const o = O.ensureOrakel({ deck: [{ id: 'a', titel: 'A' }], lastDraw: { cardId: 'a', at: 1, by: 'x' } });
    assert.ok(o.lastDraw && o.lastDraw.cardId === 'a');
  });
});

describe('orakel — drawCardId', () => {
  it('geeft altijd een id uit het dek', () => {
    const deck = O.DEFAULT_DECK;
    for (let i = 0; i < 100; i++) {
      const id = O.drawCardId(deck);
      assert.ok(deck.some(c => c.id === id));
    }
  });

  it('rnd→0 geeft de eerste kaart, rnd→bijna-1 de laatste', () => {
    const deck = O.DEFAULT_DECK;
    assert.strictEqual(O.drawCardId(deck, () => 0), deck[0].id);
    assert.strictEqual(O.drawCardId(deck, () => 0.999999), deck[deck.length - 1].id);
  });

  it('geeft null bij een leeg dek', () => {
    assert.strictEqual(O.drawCardId([], () => 0.5), null);
    assert.strictEqual(O.drawCardId(null, () => 0.5), null);
  });

  it('elke kaart is bereikbaar', () => {
    const deck = O.DEFAULT_DECK;
    const seen = new Set();
    for (let i = 0; i < deck.length; i++) {
      seen.add(O.drawCardId(deck, () => i / deck.length));
    }
    assert.strictEqual(seen.size, deck.length);
  });
});
