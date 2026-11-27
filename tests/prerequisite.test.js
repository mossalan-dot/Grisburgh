// **"Geen eis" is geen eis, en een level hoort een getal te zijn.**
//
// Het prerequisite-veld van een feat is vrije tekst, en daar stonden twee
// dingen in die de app als inhoud las:
//
//  1. In `bronnen/feat-koppelingen.json` dragen **16 van de 51** feats
//     letterlijk de woorden *Geen eis*. Dat is een leeg veld dat is
//     uitgeschreven. Gevolg op de tegel: een plusje dat belooft dat er
//     verderop meer staat, met als tooltip *Prerequisite: Geen eis*. Het
//     raakt elke campagne zonder eigen feats, want die valt daarop terug;
//     Grisburgh zelf is schoon (0 van de 251 op productie).
//  2. Elke Epic Boon vraagt level 19. Daar is een eigen penning voor
//     (`vereistLevel`), maar schrijft een DM het als tekst, dan gaat die
//     eigen tekst voor op de koppeling en komt het getal nooit aan de beurt.
//     Gemeten op een datakopie waarin dat zo stond: **60 plusjes, nul
//     eispenningen**; erna 34 en 12.
//
// `_eisUit()` is sindsdien de enige lezer, voor alle vier de plekken die de
// eis gebruiken (de penningen, het venster, en de twee kanten van de
// aansluit-afleiding). Pure rekenkunde in een browser-module zonder export,
// dus in een `vm` — zelfde truc als bij de keuzelijsten.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SRC  = path.join(__dirname, '..', 'public', 'js', 'render-vaardigheden.js');
const KOP  = path.join(__dirname, '..', 'bronnen', 'feat-koppelingen.json');

function eisUit() {
  const src = fs.readFileSync(SRC, 'utf8');
  const van = src.indexOf('const _GEEN_EIS');
  const tot = src.indexOf('function _nivPenningenHtml');
  assert.ok(van > 0 && tot > van, 'het eisblok staat niet meer waar het stond');
  const sandbox = {};
  // `_koppelingVan` leeft verderop in het bestand en haalt bronbestanden op;
  // hier is de regel zelf aan de orde, dus geven we hem het item rechtstreeks.
  vm.runInNewContext(
    'const _koppelingVan = (it) => it;\n' + src.slice(van, tot) + '\nthis.uit = _eisUit;',
    sandbox);
  return sandbox.uit;
}

const feat = (vereist, vereistLevel) => ({ soort: 'feat', vereist, vereistLevel });

describe('Wat een feat vraagt', () => {
  const uit = eisUit();

  it('leest een lege eis als leeg, hoe die ook is opgeschreven', () => {
    for (const leeg of ['Geen eis', 'geen eis', '  Geen  ', 'Geen eisen', 'niets', 'n.v.t.', '—', '-', '']) {
      assert.deepEqual(uit(feat(leeg)), { level: 0, rest: '' }, `"${leeg}" wordt nog als eis gelezen`);
    }
  });

  it('haalt het level uit de tekst en zet het op de penning', () => {
    assert.deepEqual(uit(feat('Level 19')), { level: 19, rest: '' });
    assert.deepEqual(uit(feat('level 4')),  { level: 4,  rest: '' });
  });

  it('houdt over wat er naast het level staat', () => {
    assert.deepEqual(uit(feat('Level 4, Strength 13')), { level: 4, rest: 'Strength 13' });
    assert.deepEqual(uit(feat('Strength 13, Level 4')), { level: 4, rest: 'Strength 13' });
  });

  it('laat een echte eis onaangeroerd', () => {
    for (const eis of ['Strength of Dexterity 13', 'Medium armor training',
                       'Een spellcasting- of pact magic-feature', 'Strength 13, Shield training']) {
      assert.deepEqual(uit(feat(eis)), { level: 0, rest: eis }, eis);
    }
  });

  // Een getal in een eis is niet per se een level: "Strength 13" moet blijven
  // staan, anders verdwijnt de hele eis in de levelpenning.
  it('ziet een ability score niet als een level', () => {
    assert.equal(uit(feat('Strength 13')).level, 0);
    assert.equal(uit(feat('Level 19')).level, 19);
    // En "19th level" is geen vorm die we kennen; dan blijft het tekst.
    assert.equal(uit(feat('Strength 13')).rest, 'Strength 13');
  });

  it('valt terug op het getalveld als er geen tekst staat', () => {
    assert.deepEqual(uit(feat('', 19)), { level: 19, rest: '' });
    // Staat er tekst mét een level, dan wint de tekst — dat schreef de DM zelf.
    assert.equal(uit(feat('Level 12', 19)).level, 12);
  });

  it('raakt alleen feats en Epic Boons aan', () => {
    assert.deepEqual(uit({ soort: 'class', vereist: 'Level 19' }), { level: 0, rest: '' });
    assert.deepEqual(uit({ soort: 'boon', vereist: 'Level 19' }),  { level: 19, rest: '' });
  });

  // De meegeleverde koppeling draagt diezelfde "Geen eis"-tekst, dus de regel
  // moet hem daar óók wegfilteren — anders begint een verse campagne met
  // zestien plusjes die niets zeggen.
  it('filtert de lege eis ook uit het meegeleverde koppelbestand', () => {
    const kop = JSON.parse(fs.readFileSync(KOP, 'utf8')).feats || {};
    const namen = Object.keys(kop);
    assert.ok(namen.length >= 51, `${namen.length} feats in de koppeling — dat waren er 51`);
    const leeg = namen.filter(n => uit({ soort: 'feat', ...kop[n] }).rest === '');
    assert.ok(leeg.length >= 16, `${leeg.length} feats zonder eis — dat waren er zestien`);
    // En de rest houdt een eis die ergens op slaat: geen van de overgebleven
    // teksten mag nog "geen" zeggen.
    const resten = namen.map(n => uit({ soort: 'feat', ...kop[n] }).rest).filter(Boolean);
    assert.deepEqual(resten.filter(r => /^geen\b/i.test(r)), []);
  });

  // Alle vier de lezers van de eis horen dezelfde helper te gebruiken; een
  // tweede `String(kop.vereist)` ergens laat "Geen eis" stil terugkomen.
  it('is de enige lezer van het eisveld', () => {
    const src = fs.readFileSync(SRC, 'utf8');
    // Commentaar eerst weg (een toelichting noemt het veld waar hij over
    // gaat), en daarna `_eisUit` zelf: dat is de lezer, niet een tweede.
    const kaal = src.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
    const van = kaal.indexOf('function _eisUit');
    const tot = kaal.indexOf('\n}', van) + 2;
    assert.ok(van > 0 && tot > van, '_eisUit staat niet meer waar het stond');
    const buiten = kaal.slice(0, van) + kaal.slice(tot);
    const los = [...buiten.matchAll(/String\(\s*(?:it|f|kop|k)\.vereist/g)];
    assert.deepEqual(los.map(m => m[0]), [],
      'hier wordt het eisveld buiten _eisUit om gelezen');
    assert.ok(kaal.split('_eisUit(').length - 1 >= 4,
      'minder dan vier lezers — gebruikt iemand hem niet meer?');
  });
});
