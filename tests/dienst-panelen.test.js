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
