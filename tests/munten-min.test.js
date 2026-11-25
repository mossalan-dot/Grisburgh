const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// **Een schuld is één minteken, geen drie.** `fromCl()` op de server slaat een
// negatief saldo ondertekend per onderdeel op: 368 centelingen schuld wordt
// `{fl:-3, kn:-6, cl:-8}`. Elke weergave die die drie velden los afdrukt zet er
// dus drie mintekens neer, en dat leest als een rekenfout in plaats van als een
// schuld. `formatCl` en `_muntKort` hielden daar al rekening mee; de beurs in de
// Boedel en die in een winkel plakten de velden zelf aan elkaar — precies de
// twee plekken waar een speler naar zijn geld kijkt.
const WORTEL = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(WORTEL, 'public/js/app.js'), 'utf8');

// De muntrekenkunde uit app.js, in een sandbox. Die module is een
// browser-module zonder export — zelfde truc als in vaardigheden-tabellen.
function muntHelpers() {
  const start = APP.indexOf('const MUNT_STANDAARD =');
  const eind  = APP.indexOf('window._campagneNaam =');
  assert.ok(start > 0 && eind > start, 'het muntblok staat niet meer waar de toets het zoekt');
  const sandbox = { window: {}, console };
  vm.runInNewContext(APP.slice(start, eind), sandbox);
  return sandbox.window;
}

function fromCl(total) {               // letterlijk de server-kant
  const t = Math.round(Number(total) || 0);
  const s = t < 0 ? -1 : 1, a = Math.abs(t);
  return { fl: s * Math.floor(a / 100), kn: s * Math.floor((a % 100) / 10), cl: s * (a % 10) };
}

describe('Een beurs in de min', () => {
  const w = muntHelpers();

  it('splitst een schuld in positieve onderdelen met één teken', () => {
    const d = w._muntDelen(fromCl(-368));
    assert.deepEqual(d, { negatief: true, fl: 3, kn: 6, cl: 8 });
    const p = w._muntDelen(fromCl(368));
    assert.deepEqual(p, { negatief: false, fl: 3, kn: 6, cl: 8 });
  });

  it('zegt het voluit en verkort met één minteken vooraan', () => {
    w._currency = { fl: 'Gold', kn: 'Silver', cl: 'Copper' };
    assert.equal(w.formatCl(-368), '−3 Gold · 6 Silver · 8 Copper');
    assert.equal(w._muntKort(fromCl(-368)), '−3 gp · 6 sp · 8 cp');
    // En tellen blijft tellen: nul is nul, geen "−0".
    assert.equal(w._muntKort(fromCl(0)), '0 cp');
  });

  it('laat een leeg onderdeel weg maar houdt het teken vooraan', () => {
    assert.equal(w._muntKort(fromCl(-60)), '−6 sp', 'alleen zilver, en toch negatief');
    assert.equal(w.formatCl(-5), '−5 Copper');
  });

  // De regel is niets waard als een weergave hem omzeilt. Deze twee drukten de
  // velden rechtstreeks af; daar hoort nu de helper te staan.
  it('wordt gebruikt door de beurs in de Boedel en die in een winkel', () => {
    const boedel = APP.slice(APP.indexOf("getElementById('inv-beurs')"), APP.indexOf('inv-beurs-shared'));
    assert.match(boedel, /_muntDelen/, 'de Boedel rekent zijn beurs weer zelf uit');
    assert.ok(!/\$\{cur\.(fl|kn|cl)/.test(boedel), 'de Boedel drukt de ondertekende velden weer los af');

    const camp = fs.readFileSync(path.join(WORTEL, 'public/js/render-campagne.js'), 'utf8');
    const winkel = camp.slice(camp.indexOf('shop-beurs-amount'), camp.indexOf('shop-beurs-amount') + 400);
    assert.match(winkel, /_muntDelen/, 'de winkelbeurs rekent weer zelf');
    assert.ok(!/\$\{cur\.(fl|kn|cl)\s*\?\?/.test(winkel), 'de winkelbeurs drukt de velden weer los af');
  });
});
