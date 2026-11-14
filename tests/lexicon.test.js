// Het lexicon zet een stippellijn onder een term die uitleg verdient, met een
// tooltip erbij. Waar het dat **niet** moet doen is net zo belangrijk: in een
// kop lees je wát je voor je hebt, niet wat een woord betekent.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

describe('Het lexicon', () => {
  it('slaat labels en koppen over', () => {
    const m = APP.match(/const _GLOSS_SKIP_TAGS = new Set\(\[([^\]]*)\]\)/);
    assert.ok(m, '_GLOSS_SKIP_TAGS niet gevonden');
    const tags = m[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    for (const t of ['H1', 'H2', 'H3', 'BUTTON', 'SUMMARY', 'LABEL']) {
      assert.ok(tags.includes(t), `${t} hoort overgeslagen te worden`);
    }
    // In een definitielijst is `dt` het label: "ABILITY SCORES" kreeg een
    // stippellijn omdat het toevallig ook een term is.
    assert.ok(tags.includes('DT'), 'een dt is een label, geen zin om uit te leggen');
  });

  it('kent zijn termen maar één keer per blok', () => {
    // `seen` zorgt dat dezelfde term niet in elke zin opnieuw wordt uitgelegd;
    // zonder dat staat een alinea vol stippellijnen.
    assert.match(APP, /_sbGlossWalk\(node, seen\)|_sbGlossWalk\(rootEl, new Set\(\)\)/,
      'de walker houdt niet bij wat hij al uitlegde');
  });
});
