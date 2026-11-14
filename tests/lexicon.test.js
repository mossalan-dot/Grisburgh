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

  // De achttien skills komen uit `_SKILLS`, zodat er één lijst is. Zou iemand
  // ze met de hand overtikken, dan raakt de uitleg los van de lijst zodra er
  // een skill bij komt.
  it('kent alle achttien skills, uit één lijst', () => {
    const lijst = APP.match(/const _SKILLS = \[([\s\S]*?)\n\];/);
    assert.ok(lijst, '_SKILLS niet gevonden');
    const keys = [...lijst[1].matchAll(/key: '([^']+)'/g)].map(m => m[1]);
    assert.equal(keys.length, 18, 'er horen achttien skills te zijn');

    const tips = APP.match(/const _SKILL_TIP = \{([\s\S]*?)\n\};/);
    assert.ok(tips, '_SKILL_TIP niet gevonden');
    for (const k of keys) {
      assert.match(tips[1], new RegExp(`\\b${k}:`), `${k} heeft geen uitleg`);
    }
    assert.match(APP, /_SB_GLOSSARY\.push\(\.\.\._SB_SKILL_GLOSSARY\)/,
      'de skills gaan niet mee in het lexicon');
  });

  // Een skill heet net als een gewoon woord: nature, history, medicine. Zonder
  // hoofdlettergevoeligheid krijgt "the nature of the beast" een stippellijn.
  it('herkent een skill alleen met een hoofdletter', () => {
    const m = APP.match(/const _SB_SKILL_GLOSSARY = _SKILLS\.map\([\s\S]*?\n\}\)\);/);
    assert.ok(m, '_SB_SKILL_GLOSSARY niet gevonden');
    const vlaggen = m[0].match(/'g[a-z]*'/g) || [];
    assert.ok(vlaggen.length, 'geen vlaggen gevonden op het patroon');
    for (const v of vlaggen) assert.ok(!v.includes('i'), `skills horen hoofdlettergevoelig: ${v}`);
  });

  it('kent zijn termen maar één keer per blok', () => {
    // `seen` zorgt dat dezelfde term niet in elke zin opnieuw wordt uitgelegd;
    // zonder dat staat een alinea vol stippellijnen.
    assert.match(APP, /_sbGlossWalk\(node, seen\)|_sbGlossWalk\(rootEl, new Set\(\)\)/,
      'de walker houdt niet bij wat hij al uitlegde');
  });
});
