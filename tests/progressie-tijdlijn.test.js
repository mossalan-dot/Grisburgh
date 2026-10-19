// De tijdlijn prikt zelf twee dingen bij die **niet** in de seed staan:
// Ability Score Improvement op de levels uit `gedeeld.asiLevels`, en Epic Boon
// op `gedeeld.epicBoonLevel`. Dat is met opzet — ze gelden voor elke class en
// hoeven niet vijftien keer in de data.
//
// Maar een campagne die haar classes zelf nageloopt heeft kán ze wél hebben
// ingetikt, mét de tekst uit het boek erbij. Dan stonden ze er twee keer: één
// keer van de DM en één keer leeg. In Grisburgh gold dat op 19 okt 2026 voor
// dertien classes en vier levels per class.
//
// `_featuresForLevel` is een functie binnen een browser-module zonder export,
// dus knippen we hem eruit en draaien hem in een `vm` — zelfde aanpak als bij
// de tabellen in render-vaardigheden.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

function featuresVoorLevel() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'render-progressie.js'), 'utf8');
  const van = src.indexOf('function _featuresForLevel');
  assert.ok(van > 0, 'de functie staat niet meer waar hij stond');
  // Tot de eerstvolgende regel die op kolom 0 met `}` eindigt.
  const tot = src.indexOf('\n}\n', van) + 3;
  const sandbox = {};
  vm.runInNewContext(src.slice(van, tot) + '\nthis.f = _featuresForLevel;', sandbox);
  return sandbox.f;
}

describe('De tijdlijn prikt alleen bij wat er nog niet staat', () => {
  const _featuresForLevel = featuresVoorLevel();
  const prog = { gedeeld: { asiLevels: [4, 8, 12, 16], subclassLevel: 3, epicBoonLevel: 19 } };

  it('zet Ability Score Improvement erbij als de class hem niet heeft', () => {
    const uit = _featuresForLevel(prog, { levels: {} }, null, 4);
    assert.deepEqual(uit.map(f => f.name), ['Ability Score Improvement']);
    assert.equal(uit[0]._kind, 'shared');
  });

  it('zet hem er niet nóg eens bij als de class hem zelf heeft', () => {
    const eigen = { levels: { 4: [{ name: 'Ability Score Improvement', desc: 'Zoals de DM hem schreef.' }] } };
    const uit = _featuresForLevel(prog, eigen, null, 4);
    assert.deepEqual(uit.map(f => f.name), ['Ability Score Improvement'], 'precies één');
    assert.equal(uit[0].desc, 'Zoals de DM hem schreef.', 'en dat is die van de campagne');
  });

  it('doet hetzelfde met Epic Boon', () => {
    const leeg = _featuresForLevel(prog, { levels: {} }, null, 19);
    assert.deepEqual(leeg.map(f => f.name), ['Epic Boon']);
    const eigen = { levels: { 19: [{ name: 'Epic Boon', desc: 'Kies een Epic Boon feat.' }] } };
    const uit = _featuresForLevel(prog, eigen, null, 19);
    assert.deepEqual(uit.map(f => f.name), ['Epic Boon']);
    assert.equal(uit[0].desc, 'Kies een Epic Boon feat.');
  });

  it('kijkt niet naar hoofdletters', () => {
    const eigen = { levels: { 19: [{ name: 'epic boon', desc: 'klein geschreven' }] } };
    assert.equal(_featuresForLevel(prog, eigen, null, 19).length, 1);
  });

  it('laat de subclass-regel met rust', () => {
    const uit = _featuresForLevel(prog, { levels: {}, subclassLabel: 'Primal Path' }, null, 3);
    assert.deepEqual(uit.map(f => f.name), ['Primal Path']);
  });
});
