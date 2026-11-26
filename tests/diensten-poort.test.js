// **Elke spelersroute van een dienst gaat door de poort.**
//
// De DM zet per party in welke diensten open zijn (Diensten → Toegang per
// groep). Dat werd ooit **alleen in de client** afgedwongen: een speler bij wie
// de herberg op *verborgen* stond kon gewoon `POST /herberg/bestel` doen — eten
// kopen, een zegen kopen, een eed zweren, geld lenen. Geen datalek, wél een
// gat: die schakelaar is precies de manier waarop de DM zegt "dit bestaat nog
// niet voor jullie".
//
// `vereistDienst('<naam>')` zit daarom als middleware op die routes. Maar een
// middleware die je per route moet onthouden, vergeet je bij de volgende —
// vandaar een **structurele** toets: elke schrijfroute onder een dienstpad die
// een speler mag aanroepen, hoort hem te dragen. Uitzonderingen staan hier bij
// naam, met de reden, zodat het een keuze blijft en geen omissie.
//
// (`tests/diensten-toegang.test.js` toetst dat de poort ook echt wérkt; dit is
// de telling. Samen dekken ze "zonder de poort valt er iets om" én "geen enkele
// route is hem vergeten".)
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

const API = path.join(__dirname, '..', 'routes', 'api.js');

// Commentaar eruit, maar behoedzaam: een gulzige `/*…*/` eet hier hele
// gebieden op (zie scripts/dode-ids.js). Alleen hele commentaarregels.
const kaal = (src) => src.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');

const DIENSTEN = ['herberg', 'tempel', 'gock', 'ursula', 'magizoo', 'tweespalt', 'woekeraar'];

// Routes die bewust **geen** poort dragen, met de reden erbij. Wie er een aan
// deze lijst toevoegt, schrijft daarmee op waaróm.
const UITZONDERINGEN = {
  'POST /tweespalt/aflossen':
    'een bestaande schuld moet je kunnen afbetalen ook als de DM het gokhuis uitzet — ' +
    'een module uitzetten hoort te verbergen wat die module brengt, niet wat er al was',
};

function routes() {
  const src = kaal(fs.readFileSync(API, 'utf8'));
  const uit = [];
  for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'\s*,\s*([^\n]*)/g)) {
    const [, methode, pad, staart] = m;
    const dienst = DIENSTEN.find(d => pad.startsWith('/' + d));
    if (!dienst) continue;
    uit.push({
      sleutel: `${methode.toUpperCase()} ${pad}`,
      dienst,
      schrijft: methode !== 'get',
      dmOnly:   /requireDM/.test(staart),
      poort:    /vereistDienst\(/.test(staart),
      noemt:    (/vereistDienst\('([^']+)'\)/.exec(staart) || [])[1] || null,
    });
  }
  return uit;
}

describe('De poort op de diensten', () => {
  const alle = routes();

  it('vindt de routes nog waar ze staan', () => {
    assert.ok(alle.length >= 25, `maar ${alle.length} dienstroutes gevonden — leest de scan nog wel?`);
    assert.ok(alle.some(r => r.poort), 'niet één route draagt een poort; dan klopt de scan niet');
  });

  it('zet een poort op elke schrijfroute die een speler mag aanroepen', () => {
    const vergeten = alle
      .filter(r => r.schrijft && !r.dmOnly && !r.poort)
      .map(r => r.sleutel)
      .filter(s => !(s in UITZONDERINGEN));
    assert.deepStrictEqual(vergeten, [],
      'deze routes kan een speler aanroepen bij een dienst die voor hem dicht staat:\n  '
      + vergeten.join('\n  '));
  });

  it('houdt de uitzonderingen bij naam, en alleen die', () => {
    // Andersom: een uitzondering die intussen wél een poort kreeg hoort hier
    // weg, anders staat er een reden bij iets dat allang anders werkt.
    const zonder = new Set(alle.filter(r => r.schrijft && !r.dmOnly && !r.poort).map(r => r.sleutel));
    const verlopen = Object.keys(UITZONDERINGEN).filter(s => !zonder.has(s));
    assert.deepStrictEqual(verlopen, [],
      'deze uitzonderingen zijn niet meer nodig: ' + verlopen.join(', '));
    for (const [s, reden] of Object.entries(UITZONDERINGEN)) {
      assert.ok(reden.length > 40, `${s} hoort een reden te dragen, geen etiket`);
    }
  });

  it('noemt bij elke poort de dienst waar de route bij hoort', () => {
    // `vereistDienst('tempel')` op een herbergroute zou precies de verkeerde
    // schakelaar lezen — en dat merk je pas als een DM er een omzet.
    const scheef = alle.filter(r => r.poort && r.noemt && r.noemt !== r.dienst)
      .map(r => `${r.sleutel} → vereistDienst('${r.noemt}')`);
    assert.deepStrictEqual(scheef, [], 'de poort wijst naar een andere dienst:\n  ' + scheef.join('\n  '));
  });

  it('dekt elke dienst die een spelersroute heeft', () => {
    // Een dienst waar een speler iets kan doen maar die nergens een poort
    // draagt, is een dienst waarvan de schakelaar niets doet.
    const metSchrijf = new Set(alle.filter(r => r.schrijft && !r.dmOnly).map(r => r.dienst));
    const metPoort   = new Set(alle.filter(r => r.poort).map(r => r.dienst));
    const kaal = [...metSchrijf].filter(d => !metPoort.has(d));
    assert.deepStrictEqual(kaal, [], 'geen enkele poort bij: ' + kaal.join(', '));
  });
});
