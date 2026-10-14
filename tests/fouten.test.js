const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Een fout die niemand opvangt verdwijnt — en met een tweede DM verdwijnt hij
// bij iemand die hem niet eens kán melden. Dit boekje vangt ze op. Waar het om
// gaat: hij blijft klein (een ringbuffer), hij telt herhalingen in plaats van
// ze op te stapelen, en hij schrijft nooit de inhoud van een campagne op.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-fout-${Date.now()}-${Math.random().toString(36).slice(2)}`);

describe('Wat er misging', () => {
  let fouten;

  before(() => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    delete require.cache[require.resolve('../lib/fouten')];
    fouten = require('../lib/fouten');
  });

  after(() => { fs.rmSync(DATA_DIR, { recursive: true, force: true }); });

  it('telt dezelfde fout op in plaats van hem te herhalen', () => {
    const stack = 'TypeError: x\n    at kapot (/js/app.js:12:3)\n    at ander (/js/app.js:40:1)';
    for (let i = 0; i < 5; i++) fouten.meld({ soort: 'client', melding: 'x is undefined', stack });
    const lijst = fouten.alle().filter(f => f.melding === 'x is undefined');
    assert.equal(lijst.length, 1, 'vijf keer dezelfde fout is één regel');
    assert.equal(lijst[0].aantal, 5, 'met vijf erachter');
  });

  it('ziet twee plekken als twee fouten', () => {
    fouten.meld({ soort: 'client', melding: 'zelfde zin', stack: 'at hier (/js/a.js:1:1)' });
    fouten.meld({ soort: 'client', melding: 'zelfde zin', stack: 'at daar (/js/b.js:9:9)' });
    assert.equal(fouten.alle().filter(f => f.melding === 'zelfde zin').length, 2,
      'dezelfde melding op een andere regel is een andere fout');
  });

  it('ontdubbelt meldingen van mensen juist níét', () => {
    fouten.meld({ soort: 'melding', melding: 'knop doet niets', toelichting: 'eerste keer' });
    fouten.meld({ soort: 'melding', melding: 'knop doet niets', toelichting: 'tweede keer' });
    assert.equal(fouten.alle().filter(f => f.soort === 'melding').length, 2,
      'twee mensen die hetzelfde zeggen zijn twee meldingen');
  });

  it('zet meldingen bovenaan', () => {
    assert.equal(fouten.alle()[0].soort, 'melding', 'daar wacht iemand op antwoord');
  });

  it('blijft binnen zijn maat', () => {
    for (let i = 0; i < fouten.MAX + 50; i++) {
      fouten.meld({ soort: 'client', melding: 'fout nummer ' + i, stack: 'at r' + i + ' (/js/a.js:' + i + ':1)' });
    }
    assert.ok(fouten.alle().length <= fouten.MAX, 'een logboek dat eindeloos groeit leest niemand');
  });

  it('bewaart de plek maar niet de inhoud', () => {
    const f = fouten.meld({
      soort: 'melding', melding: 'iets', toelichting: 'ging mis',
      waar: 'meesterkamer › aktes', campagne: 'bleke-kust', rol: 'dm',
    });
    assert.equal(f.waar, 'meesterkamer › aktes');
    assert.equal(f.campagne, 'bleke-kust');
    // Alles wat een melder meestuurt wordt afgekapt; een roman hoort hier niet
    // in, en een veld dat ongelimiteerd groeit is een manier om de schijf te vullen.
    const lang = fouten.meld({ soort: 'melding', melding: 'a'.repeat(900), toelichting: 'b'.repeat(5000) });
    assert.ok(lang.melding.length <= 300);
    assert.ok(lang.toelichting.length <= 1000);
  });

  it('kent alleen de drie soorten die we bedacht hebben', () => {
    const f = fouten.meld({ soort: 'verzonnen', melding: 'hm' });
    assert.equal(f.soort, 'client', 'een onbekende soort valt terug, hij komt niet als zichzelf binnen');
  });
});
