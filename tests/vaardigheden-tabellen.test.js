// Elf vaardigheidsteksten dragen een tabel — de spreukentabel van een domein,
// de Draconic Spells van een Sorcerer, het omrekenen van spell slots naar
// Sorcery Points. Ze staan er **platgeslagen** in: geen streepjesrij, geen pijp
// aan de rand, de titel aan de eerste kolomkop geplakt, en soms twee rijen op
// één regel ("5 | Fear, Fly 7 | Arcane Eye").
//
// `_tabellenUit()` in render-vaardigheden.js haalt ze er weer uit. Die functie
// leeft in een browser-module zonder export, dus knippen we het blok eruit en
// draaien het in een `vm` — hetzelfde wat scripts/helpteksten.js met
// HELP_CONFIG doet. Dat is met opzet: de toets hoort op de échte code en op de
// échte bronteksten te staan, niet op een kopie ervan die meteen gaat afwijken.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SRC = path.join(__dirname, '..', 'public', 'js', 'render-vaardigheden.js');
const BRON = path.join(__dirname, '..', 'bronnen', 'srd-features.json');

function parser() {
  const src = fs.readFileSync(SRC, 'utf8');
  const van = src.indexOf('const _TAFELKOP');
  const tot = src.indexOf('function _tabelHtml');
  assert.ok(van > 0 && tot > van, 'het tabellenblok staat niet meer waar het stond');
  const blok = src.slice(van, tot).replace(/^let _tabelBak.*$/m, '');
  const sandbox = {};
  vm.runInNewContext(blok + '\nthis.uit = _tabellenUit;', sandbox);
  return sandbox.uit;
}

const tekstVan = (v) => String(v?.desc ?? v ?? '');

describe('Tabellen in een vaardigheidstekst', () => {
  const _tabellenUit = parser();
  const bron = JSON.parse(fs.readFileSync(BRON, 'utf8'));
  const metPijp = Object.entries(bron).filter(([, v]) => tekstVan(v).includes(' | '));

  it('vindt in elke tekst met een pijp ook echt een tabel', () => {
    assert.ok(metPijp.length >= 11, `${metPijp.length} teksten met een pijp — dat waren er elf`);
    const leeg = metPijp.filter(([, v]) => !_tabellenUit(tekstVan(v)).tabellen.length).map(([k]) => k);
    assert.deepEqual(leeg, [], 'hier staat een pijp maar vinden we geen tabel: ' + leeg.join(', '));
  });

  it('geeft elke rij evenveel cellen als de kop', () => {
    // Dit is de toets op het uit elkaar halen van een doorgelopen regel. Een
    // kale regex op "een getal met een pijp" knipt `1 | 2 | 2` middendoor, en
    // dan heeft die rij er twee waar de kop er drie telt.
    const scheef = [];
    for (const [k, v] of metPijp) {
      for (const t of _tabellenUit(tekstVan(v)).tabellen) {
        for (const r of t.rijen) if (r.length !== t.kop.length) scheef.push(`${k}: ${r.join(' | ')}`);
      }
    }
    assert.deepEqual(scheef, [], 'scheve rijen:\n  ' + scheef.join('\n  '));
  });

  it('haalt de titel uit de kolomkop en zet hem erboven', () => {
    const proef = (sleutel) => _tabellenUit(tekstVan(bron[sleutel])).tabellen[0];

    const draconic = proef('Draconic Spells');
    assert.equal(draconic.naam, 'Draconic Spells');
    assert.deepEqual(draconic.kop, ['Sorcerer Level', 'Spells']);
    // De doorgelopen regel "5 | Fear, Fly 7 | Arcane Eye, Charm Monster".
    assert.deepEqual(draconic.rijen[1], ['5', 'Fear, Fly']);
    assert.deepEqual(draconic.rijen[2], ['7', 'Arcane Eye, Charm Monster']);

    // Hier staat de titel op zijn eigen regel bóven de kop.
    assert.equal(proef('Life Domain Spells').naam, 'Life Domain Spells');

    // En hier staat hij nergens als "the X table": die zin noemt juist een
    // ándere tabel ("the Sorcerer Features table"), die hier niet staat.
    const font = proef('Font of Magic');
    assert.equal(font.naam, 'Creating Spell Slots');
    assert.equal(font.kop[0], 'Spell Slot Level');
  });

  it('leest ook een tabel zoals de knop hem neerzet', () => {
    // De tabelknop in de opmaakbalk zet een gewone markdown-tabel neer: pijpen
    // aan de buitenkant en een streepjesregel onder de kop. Die streepjesregel
    // hoort in de tabel niet voor te komen, en de titel erboven wordt de kop.
    const uit = _tabellenUit([
      'Wat je krijgt staat hieronder.',
      'Replicate Magic Item',
      '| Artificer Level | Magic Items |',
      '| --- | --- |',
      '| 2 | Common |',
      '| 10 | Uncommon |',
      '',
      'En verder niets.',
    ].join('\n'));
    assert.equal(uit.tabellen.length, 1);
    const t = uit.tabellen[0];
    assert.equal(t.naam, 'Replicate Magic Item');
    assert.deepEqual(t.kop, ['Artificer Level', 'Magic Items']);
    assert.deepEqual(t.rijen, [['2', 'Common'], ['10', 'Uncommon']]);
    // De titelregel is uit de lopende tekst gehaald; de zin ervoor blijft.
    assert.match(uit.tekst, /Wat je krijgt staat hieronder\./);
    assert.ok(!uit.tekst.includes('Replicate Magic Item'), 'de titel staat nu bóven de tabel');
    assert.match(uit.tekst, /En verder niets\./);
  });

  it('eet een zin boven de tabel niet op als titel', () => {
    // Een zin eindigt op een leesteken, een titel niet. Zonder dat verschil
    // verdwijnt de aanloopzin uit de tekst.
    const uit = _tabellenUit([
      'Rol op de tabel hieronder:',
      '| d6 | Wat er gebeurt |',
      '| 1 | Niets |',
      '| 2 | Iets |',
    ].join('\n'));
    assert.equal(uit.tabellen[0].naam, '');
    assert.match(uit.tekst, /Rol op de tabel hieronder:/);
  });

  it('telt de kolommen van de kop, niet twee', () => {
    const uit = _tabellenUit([
      'Creating Spell Slots',
      '| Spell Slot Level | Sorcery Point Cost | Min. Level | Opmerking |',
      '| --- | --- | --- | --- |',
      '| 1 | 2 | 2 | — |',
      '| 2 | 3 | 3 | — |',
    ].join('\n'));
    const t = uit.tabellen[0];
    assert.equal(t.naam, 'Creating Spell Slots');
    // En de eerste kolomnaam blijft heel. Toen de "titel zit vastgeplakt aan
    // de kolomkop"-regel vóór de titelregel-regel kwam, vond die in de titel
    // erboven het stuk "Spell Slot" terug en knipte dat van de kolomkop af.
    assert.deepEqual(t.kop, ['Spell Slot Level', 'Sorcery Point Cost', 'Min. Level', 'Opmerking']);
    assert.deepEqual(t.rijen, [['1', '2', '2', '—'], ['2', '3', '3', '—']]);
  });

  it('vult een te korte rij aan tot de breedte van de kop', () => {
    // Anders mist de tabel een hokje en schuift alles ernaast een plek op.
    const uit = _tabellenUit(['| A | B | C |', '| 1 | 2 |', '| 3 | 4 | 5 |'].join('\n'));
    assert.deepEqual(uit.tabellen[0].rijen, [['1', '2', ''], ['3', '4', '5']]);
  });

  it('leest ook een tabel met tabs', () => {
    // Zo plakt een tabel uit een boek-website, en zo kwamen de oudere
    // spreukenlijsten binnen. Zonder dit stonden ze als losse regels onder
    // elkaar terwijl de nieuwere er als tabel bij stonden.
    const uit = _tabellenUit([
      'You gain domain spells at the cleric levels listed in the Peace Domain Spells table.',
      '',
      'Peace Domain Spells',
      'Cleric Level\tSpells',
      '1st\theroism, sanctuary',
      '3rd\taid, warding bond',
    ].join('\n'));
    assert.equal(uit.tabellen.length, 1);
    assert.equal(uit.tabellen[0].naam, 'Peace Domain Spells');
    assert.deepEqual(uit.tabellen[0].kop, ['Cleric Level', 'Spells']);
    assert.deepEqual(uit.tabellen[0].rijen[0], ['1st', 'heroism, sanctuary']);
  });

  it('laat een tekst zonder tabel met rust', () => {
    const uit = _tabellenUit('Gewone tekst.\nNog een regel.');
    assert.deepEqual(uit.tabellen, []);
    assert.equal(uit.tekst, 'Gewone tekst.\nNog een regel.');
  });

  it('zet een merkteken neer waar de tabel stond', () => {
    // De tekst gaat daarna door `mdToHtml`, en die kent deze vorm niet. Het
    // merkteken moet dat ongeschonden overleven, anders komt de tabel nergens
    // meer terug.
    const uit = _tabellenUit(tekstVan(bron['Life Domain Spells']));
    assert.match(uit.tekst, /@@tafel0@@/);
    assert.ok(!uit.tekst.includes(' | '), 'de tabelregels horen uit de tekst te zijn');
  });
});
