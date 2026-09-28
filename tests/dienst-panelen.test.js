// Bewaakt de afspraak uit .herberg-content: 460px is de maat van een
// dienstpaneel, en wie afwijkt zet de reden erbij. Zonder die markering komt
// er ongemerkt een vierde breedte bij en lopen de schermen uiteen.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Dienstpanelen houden één maat', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'theme.css'), 'utf8');

  it('houdt 460px als standaard', () => {
    const m = css.match(/\.herberg-content \{[^}]*max-width:\s*(\d+)px/);
    assert.ok(m, '.herberg-content hoort een max-width te hebben');
    assert.strictEqual(m[1], '460');
  });

  it('laat elke afwijkende breedte zijn reden noemen', () => {
    // Alle klassen die óók een dienstpaneel zijn (ze staan naast
    // .herberg-content in de markup) en een eigen max-width zetten.
    const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    const extra = new Set([...app.matchAll(/class="herberg-content ([a-z-]+)"/g)].map(x => x[1]));
    assert.ok(extra.size >= 2, 'er horen er een paar te zijn: ' + [...extra]);

    for (const klasse of extra) {
      // De reden mag binnen de regel staan of er als staartcommentaar achter,
      // dus lees een stukje voorbij de sluitende accolade mee.
      const re = new RegExp('\\.' + klasse + '\\s*\\{[^}]*max-width:\\s*\\d+px[^}]*\\}.{0,80}', 's');
      const regel = css.match(re);
      if (!regel) continue;                       // geen eigen breedte: prima
      assert.match(regel[0], /breder: zie \.herberg-content/,
        `.${klasse} wijkt af van 460px zonder de reden erbij te zetten`);
    }
  });
});

// Elke dienst opent met dezelfde vijf regels: naam, eigenaarskaartje,
// locatiekaartje, achtergrond, begroeting. Ze stonden ooit alle zes anders —
// eigen labels, eigen volgorde, de een met een locatie en de ander niet. Die
// kop komt nu uit één helper; deze toets bewaakt dat er geen dienst buiten om
// zijn eigen kop gaat bouwen.
describe('Dienstpanelen openen allemaal hetzelfde', () => {
  const dm = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'dm-panel.js'), 'utf8');
  const DIENSTEN = [
    ['_renderHerbergSettings', 'hb'],
    ['_renderTweespaltDM',     'ts'],
    ['_renderGockSettings',    'gock'],
    ['_renderUrsulaSettings',  'ursula'],
    ['_renderTempelSettings',  'tempel'],
    ['_renderMagizooSettings', 'magizoo'],
  ];

  // De body van een functie, van zijn naam tot de volgende `async function`.
  const romp = (naam) => {
    const start = dm.indexOf(`async function ${naam}(`);
    assert.ok(start >= 0, `${naam} bestaat niet meer`);
    const eind = dm.indexOf('\nasync function ', start + 10);
    return dm.slice(start, eind < 0 ? dm.length : eind);
  };

  for (const [fn, sleutel] of DIENSTEN) {
    it(`${sleutel} bouwt zijn kop met _dienstKopHtml`, () => {
      const body = romp(fn);
      assert.match(body, new RegExp(`_dienstKopHtml\\(\\{\\s*\\n?\\s*sleutel: '${sleutel}'`),
        `${fn} hoort zijn kop uit de gedeelde helper te halen`);
    });

    it(`${sleutel} heeft geen eigen keuzelijst voor portret of achtergrond meer`, () => {
      const body = romp(fn);
      assert.ok(!/-portret-select/.test(body), `${fn} heeft nog een portret-keuzelijst`);
      assert.ok(!/-backdrop-select/.test(body), `${fn} heeft nog een backdrop-keuzelijst`);
    });
  }

  it('leest de kopvelden overal met _dienstKopLees', () => {
    for (const fn of ['_hbSave', '_tsSettingsSave', '_gockSettingsSave',
                      '_ursulaSettingsSave', '_tempelSettingsSave', '_magizooSettingsSave']) {
      const start = dm.indexOf(`window.${fn} = async`);
      assert.ok(start >= 0, `${fn} bestaat niet meer`);
      const body = dm.slice(start, dm.indexOf('\n};', start));
      assert.match(body, /_dienstKopLees\(/, `${fn} leest de kopvelden niet uit de helper`);
    }
  });
});
