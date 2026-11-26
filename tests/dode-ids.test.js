// **Een `getElementById` naar een id dat nergens bestaat, faalt stil.**
//
// `_updateDienstenMenu` zocht negen menuknoppen op hun id uit `index.html` en
// zette daar de toegangsstand van de party op: verborgen weg, zichtbaar grijs
// met een slotje. Sinds het dienstenmenu **getekend** wordt in plaats van
// bijgewerkt, dragen die knoppen geen id meer — en dus deed die hele functie
// niets. Gemeten op productie 26 nov 2026: nul elementen met zo'n id.
//
// Je ziet er niets van: `document.getElementById` geeft `null`, de `if (!btn)
// continue;` slaat de regel over, en er komt geen foutmelding.
//
// **Waarom hier geen brede scan staat.** Die is geprobeerd: alle opgezochte
// ids naast alle uitgestuurde ids leggen. Dat werkt niet als gate, want een id
// kan ook door een hulpfunctie gemaakt worden (`_laag('gr-vignet', …)` in
// gevecht-regie.js) of met plakwerk opgebouwd — veertig van de treffers waren
// zulk vals alarm, en een toets die je moet wegwuiven bewaak je niet meer. De
// scan leeft daarom als `node scripts/dode-ids.js`, net als `css-nalopen.js`:
// een lijst om na te lopen, geen poort. Wat hier staat is de regel die dit
// geval scherp vangt.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const JS_DIR = path.join(WORTEL, 'public', 'js');

// Commentaar eerst eruit: een toelichting noemt de id waar hij over gaat, en
// dan telt die naam als "bestaat nog" terwijl de code weg is. Die val is in dit
// project al vier keer dichtgelopen.
// **Behoedzaam strippen.** Een gulzige `/*…*/` eet hier 23% van `dm-panel.js`
// op: er staat een `/*` in een string die met een `*/` verderop paart, en dan
// verdwijnt een heel gebied inclusief de `id="…"` die erin stond. Gemeten bij
// het schrijven van deze toets — en het maakte de scan juist onbetrouwbaar in
// de richting die ertoe doet (een id dat wél bestaat leek weg).
// Dus: alleen een regel die *begint* met `//` (zo schrijft deze codebase zijn
// toelichtingen) en een blokcommentaar dat op één regel opent en sluit.
const kaalJs = (src) => src
  .split('\n')
  .map(r => (/^\s*\/\//.test(r) ? '' : r.replace(/\/\*(?![\s\S]*?\n)[\s\S]*?\*\//g, '')))
  .join('\n');
function bronnen() {
  return fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'))
    .map(f => ({ naam: f, src: kaalJs(fs.readFileSync(path.join(JS_DIR, f), 'utf8')) }));
}

describe('Ids die nergens bestaan', () => {
  const js = bronnen();

  it('laat het dienstenmenu door één functie tekenen', () => {
    // De vorige fout in één zin: twee functies die hetzelfde menu bijhielden,
    // waarvan de ene de knoppen van de andere niet meer herkende. Wie tekent,
    // hoort alles te tekenen — dus de toegangsstand hoort in de tekenfunctie.
    const app = js.find(b => b.naam === 'app.js').src;
    const van = app.indexOf('function _zetDienstLabels()');
    assert.ok(van > 0, '_zetDienstLabels staat niet meer waar hij stond');
    const blok = app.slice(van, app.indexOf('\n}', van));
    assert.match(blok, /_getDienstToegang\(k\) !== 'verborgen'/,
      'een dienst op verborgen hoort niet in het menu te staan');
    assert.match(blok, /dienst-vergrendeld/,
      'een dienst op zichtbaar hoort grijs met een slotje te staan');
    assert.ok(!/function _updateDienstenMenu\b/.test(app),
      'de tweede bijwerker hoort weg te zijn, niet naast de tekenfunctie te blijven staan');
  });
});
