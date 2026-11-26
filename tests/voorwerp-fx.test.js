// **Het vleugje beweging als een voorwerpkaartje opengaat.**
//
// Per soort voorwerp één klein gebaar: muzieknoten bij een luit, belletjes bij
// een drankje, een glans over een zwaard. Leuk om te maken en makkelijk om
// stil te laten verlopen — vandaar deze vier controles, die alle vier een
// manier afdekken waarop zo'n catalogus uit de pas gaat lopen:
//
//  1. een effect voor een itemType dat niet bestaat (typefout, of een type dat
//     hernoemd is) — dan gebeurt er niets en zoek je in de CSS;
//  2. een deeltje met een icoon dat niet in de sprite staat — dan tekent de
//     browser een leeg vakje, zonder foutmelding;
//  3. een effect zonder regels in `theme.css` — zelfde stilte;
//  4. een lus die blijft draaien, of beweging die aan blijft staan bij
//     *minder beweging*. Dat is versiering, en versiering hoort uit te kunnen.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const RC  = fs.readFileSync(path.join(WORTEL, 'public', 'js', 'render-campagne.js'), 'utf8');
const CSS = fs.readFileSync(path.join(WORTEL, 'public', 'css', 'theme.css'), 'utf8');
const SPRITE = fs.readFileSync(path.join(WORTEL, 'public', 'img', 'icons.svg'), 'utf8');

const blok = (naam, eind = '};') => {
  const i = RC.indexOf(`const ${naam} = `);
  assert.ok(i > 0, `${naam} staat niet meer waar het stond`);
  return RC.slice(i, RC.indexOf(`\n${eind}`, i));
};

describe('Beweging bij een voorwerpkaartje', () => {
  const fxBlok  = blok('ITEM_FX');
  const delBlok = blok('_FX_DEELTJE');
  const effecten = [...fxBlok.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(m => ({ type: m[1], fx: m[2] }));
  const deeltjes = Object.fromEntries([...delBlok.matchAll(/(\w+):\s*\['([^']+)',\s*(\d+)\]/g)]
    .map(m => [m[1], { icoon: m[2], aantal: +m[3] }]));

  it('hangt elk effect aan een itemType dat echt bestaat', () => {
    // De typelijst is `ITEM_TYPE_GROEPEN`; een effect voor een type dat daar
    // niet in staat speelt nooit, en dat zie je aan niets.
    const groepen = RC.slice(RC.indexOf('const ITEM_TYPE_GROEPEN'), RC.indexOf('\n];', RC.indexOf('const ITEM_TYPE_GROEPEN')));
    const types = new Set([...groepen.matchAll(/value: '([^']+)'/g)].map(m => m[1]));
    assert.ok(types.size >= 15, `${types.size} itemtypes — leest de toets de lijst nog wel?`);
    assert.ok(effecten.length >= 10, `${effecten.length} effecten`);
    const spoken = effecten.filter(e => !types.has(e.type)).map(e => e.type);
    assert.deepStrictEqual(spoken, [], 'deze types bestaan niet: ' + spoken.join(', '));
  });

  it('tekent elk deeltje met een icoon uit de sprite', () => {
    const mist = Object.entries(deeltjes)
      .filter(([, d]) => !SPRITE.includes(`id="icon-${d.icoon}"`))
      .map(([fx, d]) => `${fx} → ${d.icoon}`);
    assert.deepStrictEqual(mist, [], 'dit icoon staat niet in de sprite: ' + mist.join(', '));
    for (const [fx, d] of Object.entries(deeltjes)) {
      assert.ok(d.aantal >= 3 && d.aantal <= 8, `${fx} heeft ${d.aantal} deeltjes — dat is een kermis of niets`);
    }
  });

  it('geeft elk effect ook echt regels in theme.css', () => {
    const zonder = [...new Set(effecten.map(e => e.fx))]
      .filter(fx => !CSS.includes(`.tegel-fx--${fx}`));
    assert.deepStrictEqual(zonder, [], 'geen opmaak voor: ' + zonder.join(', '));
    // En andersom: een effect in de CSS waar geen type meer naar wijst is
    // dode opmaak die niemand opruimt.
    const inCss = [...new Set([...CSS.matchAll(/\.tegel-fx--([a-z]+)/g)].map(m => m[1]))];
    const wees = inCss.filter(fx => !effecten.some(e => e.fx === fx));
    assert.deepStrictEqual(wees, [], 'deze opmaak wordt nergens meer gebruikt: ' + wees.join(', '));
  });

  it('speelt één keer, ligt achter de tekst, en gaat uit bij minder beweging', () => {
    const laag = CSS.slice(CSS.indexOf('.tegel-fx {'), CSS.indexOf('.tegel-fx {') + 400);
    assert.match(laag, /pointer-events:\s*none/, 'het effect mag geen klikken vangen');
    assert.match(laag, /z-index:\s*0/, 'het hoort achter de tekst te liggen');
    assert.match(CSS, /animation-iteration-count:\s*1/,
      'een eeuwige lus in een kaartje waar je in leest, gaat irriteren');
    // **Zoek vanaf de regel zélf terug**, niet vanaf de eerste
    // `prefers-reduced-motion` in het bestand: `theme.css` heeft er meer dan
    // één, en de eerste staat tweehonderd regels eerder. Daar struikelde de
    // eerste versie van deze toets over — hij meldde een fout die er niet was.
    const uit = CSS.indexOf('.tegel-fx { display: none; }');
    assert.ok(uit > 0, 'met minder beweging hoort het effect helemaal uit te staan');
    const q = CSS.lastIndexOf('prefers-reduced-motion: reduce', uit);
    assert.ok(q > 0 && uit - q < 400,
      'die regel hoort in een prefers-reduced-motion-blok te staan, niet los');
  });
});
