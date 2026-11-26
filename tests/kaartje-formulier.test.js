// **De vorm van de kaartjes-editor.**
//
// Drie beloften uit `docs/testronde.md` die nergens vastlagen, en die alle
// drie stil kunnen verschuiven omdat niemand twee formulieren naast elkaar
// legt:
//
//  1. *Aantekeningen voor de DM* is op élk soort kaartje het **laatste** veld.
//     Een veld dat eronder glipt, zet de DM-aantekening middenin het formulier.
//  2. Een organisatie is net zo compleet als een personage: roddels, geheimen
//     en aantekeningen. Dat ontbrak er ooit, en je ziet het niet — een leeg
//     formulier leest als "dit kaartje heeft dat niet".
//  3. *Tier toevoegen* geeft **precies** dezelfde velden als het statblok zelf.
//     Allebei de formulieren hangen aan `_SB_TEKSTVELDEN` en `_SB_ABILITIES`;
//     een veld dat maar in één van de twee lijsten belandt, verdwijnt
//     stilzwijgend uit de tier-editor (en dus uit de opslag).
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

const RC = path.join(__dirname, '..', 'public', 'js', 'render-campagne.js');

// Behoedzaam strippen: een gulzige `/*…*/` eet hier hele gebieden op.
const kaal = (src) => src.split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');

function schemaVelden(src) {
  const i = src.indexOf('const SCHEMA = {');
  assert.ok(i > 0, 'SCHEMA staat niet meer waar het stond');
  const uit = {};
  for (const t of ['personages', 'locaties', 'organisaties', 'voorwerpen', 'documenten']) {
    const a = src.indexOf(`\n  ${t}: {`, i);
    assert.ok(a > 0, `geen schema voor ${t}`);
    const blok = src.slice(a, src.indexOf('\n  },', a));
    uit[t] = [...blok.matchAll(/\{ key: '([^']+)'/g)].map(m => m[1]);
  }
  return uit;
}

describe('De vorm van de kaartjes-editor', () => {
  const src = kaal(fs.readFileSync(RC, 'utf8'));
  const velden = schemaVelden(src);

  it('zet de DM-aantekening op elk kaartje als laatste veld', () => {
    const scheef = Object.entries(velden)
      .filter(([, k]) => k[k.length - 1] !== 'persoonlijkheid')
      .map(([t, k]) => `${t} eindigt op ${k[k.length - 1]}`);
    assert.deepStrictEqual(scheef, [],
      'hier staat de DM-aantekening niet onderaan:\n  ' + scheef.join('\n  '));
  });

  it('maakt een organisatie net zo compleet als een personage', () => {
    for (const v of ['flavours', 'geheimen', 'persoonlijkheid']) {
      assert.ok(velden.organisaties.includes(v), `een organisatie mist ${v}`);
      assert.ok(velden.personages.includes(v), `een personage mist ${v}`);
    }
    // Een locatie heeft geen roddels-veld in het schema maar wel geheimen;
    // dat is een keuze, en hij staat hier zodat hij er een blijft.
    assert.ok(velden.locaties.includes('geheimen'));
    assert.ok(velden.locaties.includes('persoonlijkheid'));
  });

  it('bouwt de tier-editor op dezelfde lijsten als het statblok', () => {
    const lijst = (naam) => {
      const m = new RegExp(`const ${naam} = \\[([\\s\\S]*?)\\];`).exec(src);
      assert.ok(m, `${naam} staat niet meer waar het stond`);
      return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
    };
    const tekst = lijst('_SB_TEKSTVELDEN');
    const abil  = lijst('_SB_ABILITIES');
    assert.ok(tekst.length >= 20, `${tekst.length} tekstvelden — leest de toets de lijst nog wel?`);
    assert.deepStrictEqual(abil, ['str', 'dex', 'con', 'int', 'wis', 'cha']);

    // De tier-editor leest zijn velden terug met `pt-<sleutel>`; staat daar een
    // naam die niet in de lijst zit, dan schrijft hij iets weg dat het statblok
    // niet kent — en andersom verdwijnt een veld uit de tier.
    const van = src.indexOf('function _petTiersCollect()');
    assert.ok(van > 0, '_petTiersCollect staat niet meer waar het stond');
    const blok = src.slice(van, src.indexOf('\n}', van));
    assert.match(blok, /_SB_TEKSTVELDEN\.forEach\(k => \{[^}]*'pt-' \+ k/,
      'de tier-editor hoort zijn tekstvelden uit _SB_TEKSTVELDEN te halen');
    assert.match(blok, /_SB_ABILITIES\.forEach\(a => \{[^}]*'pt-' \+ a/,
      'en zijn abilities uit _SB_ABILITIES');

    // Geen tweede lijst ernaast: `pt-`-klassen die niet uit die twee komen en
    // ook geen eigen veld van de tier zijn (label, vanaf-level, de vouwstand).
    const eigen = new Set(['pt-label', 'pt-minlevel', 'pt-cb', 'pt-hidden', 'pt-section']);
    const gebruikt = new Set([...src.matchAll(/pt-([a-zA-Z]+)/g)].map(m => 'pt-' + m[1]));
    const vreemd = [...gebruikt]
      .filter(c => !eigen.has(c) && !tekst.includes(c.slice(3)) && !abil.includes(c.slice(3)));
    assert.deepStrictEqual(vreemd, [],
      'deze tier-velden komen uit geen van beide lijsten: ' + vreemd.join(', '));
  });

  it('houdt het statblok en de tier op dezelfde volgorde', () => {
    // "Precies dezelfde velden, in dezelfde volgorde" — dus één lijst, niet
    // twee die toevallig hetzelfde bevatten. Deze toets valt om zodra iemand
    // de tier-editor zijn eigen volgorde geeft.
    const aantal = (src.match(/_SB_TEKSTVELDEN/g) || []).length;
    assert.ok(aantal >= 2, 'de lijst hoort door minstens twee formulieren gelezen te worden');
    assert.ok(!/const _PT_TEKSTVELDEN|const _TIER_VELDEN/.test(src),
      'er staat een tweede veldenlijst naast _SB_TEKSTVELDEN; die gaan uit elkaar lopen');
  });
});
