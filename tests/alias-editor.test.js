// **De editorkant van het pseudoniem.**
//
// De vlag `alias` op een geheimregel heeft twee lezers: `_geheimRegels` op de
// server (die beslist of de onthulling de alias opheft) en `_geheimRegelsUit`
// in de browser (die de editor vult). Loopt die tweede achter, dan gaat het
// **stil** mis: de editor leest de vlag niet, het vinkje staat uit, en de
// eerstvolgende opslagbeurt schrijft hem weg — precies wat er destijds met
// `antagonist` gebeurde. Vandaar één toets die ze náást elkaar legt.
//
// De clientfunctie leeft in een browser-module zonder export, dus knippen we
// hem eruit en draaien hem in een `vm` — zoals tests/vaardigheden-tabellen.js
// met `_tabellenUit` doet.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const WORTEL = path.join(__dirname, '..');
const CLIENT = path.join(WORTEL, 'public', 'js', 'render-campagne.js');
const SERVER = path.join(WORTEL, 'routes', 'api.js');
const CSS    = path.join(WORTEL, 'public', 'css', 'theme.css');

// Commentaar eerst eruit. Een toelichting noemt de klasse of het veld waar hij
// over gaat, en dan telt die naam als "aanwezig" terwijl de code weg is — die
// val is hier al drie keer dichtgelopen.
const kaal = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

function knip(bestand, van, tot, naam) {
  const src = fs.readFileSync(bestand, 'utf8');
  const a = src.indexOf(van);
  const b = src.indexOf(tot, a + 1);
  assert.ok(a > 0 && b > a, `${naam} staat niet meer waar hij stond`);
  const sandbox = {};
  vm.runInNewContext(src.slice(a, b) + `\nthis.uit = ${naam};`, sandbox);
  return sandbox.uit;
}

describe('De editorkant van een pseudoniem', () => {
  const clientLees = knip(CLIENT, 'function _geheimRegelsUit(', 'window._geheimRegelsUit', '_geheimRegelsUit');
  const serverLees = knip(SERVER, 'function _geheimRegels(', '\nfunction ', '_geheimRegels');

  const data = {
    geheimen: JSON.stringify([
      { id: 'a', tekst: 'Hij drinkt van de voorraad.' },
      { id: 'b', tekst: 'Hij is in werkelijkheid Hugo Grisburgh II.', alias: true },
    ]),
  };

  it('leest de alias-vlag aan beide kanten hetzelfde', () => {
    for (const [waar, lees] of [['browser', clientLees], ['server', serverLees]]) {
      // `Array.from` in plaats van `.map`: wat uit de `vm` komt heeft het
      // Array-prototype van die realm, en daar struikelt deepStrictEqual over.
      const r = Array.from(lees(data), x => !!x.alias);
      assert.deepStrictEqual(r, [false, true], `${waar} leest de vlag niet`);
    }
  });

  it('vindt niets te onthullen op een kaartje zonder vlag', () => {
    // De vlag is optioneel: zonder vlag telt elke onthulde regel (zo staat het
    // in `_aliasUitGeheim`). Hier mag dus nergens stilletjes `true` uitkomen.
    const zonder = { geheimen: JSON.stringify([{ id: 'a', tekst: 'Niks bijzonders.' }]) };
    assert.deepStrictEqual(Array.from(clientLees(zonder), x => !!x.alias), [false]);
    assert.deepStrictEqual(Array.from(serverLees(zonder), x => !!x.alias), [false]);
  });

  it('zet het veld op elk kaartje dat een schuilnaam kan dragen', () => {
    const src = kaal(fs.readFileSync(CLIENT, 'utf8'));
    // Een personage, een plek of een organisatie kan onder een andere naam
    // bekendstaan; een voorwerp niet (dat heeft geen naam om achter te
    // schuilen) en een document is zelf al de tekst.
    const typen = (/const ALIAS_TYPES = \[([^\]]+)\]/.exec(src)?.[1] || '')
      .split(',').map(x => x.trim().replace(/['"]/g, '')).filter(Boolean);
    assert.deepStrictEqual(typen, ['personages', 'locaties', 'organisaties']);

    // Per schema-blok tellen, want één treffer in het hele bestand zegt niets
    // over de vraag of alle drie de tabbladen het veld hebben. En zoeken
    // **binnen SCHEMA**: `organisaties:` staat ook in TYPE_META, dat eerder in
    // het bestand komt — anders keek deze toets naar het verkeerde blok en
    // bleef hij groen om de verkeerde reden.
    const schemaVan = src.indexOf('const SCHEMA = {');
    assert.ok(schemaVan > 0, 'SCHEMA staat niet meer waar het stond');
    for (const t of typen) {
      const van = src.indexOf(`\n  ${t}: {`, schemaVan);
      assert.ok(van > 0, `geen schema voor ${t}`);
      const blok = src.slice(van, src.indexOf('\n  },', van));
      assert.match(blok, /key: 'aliasVan'/,    `${t} mist het veld aliasVan`);
      assert.match(blok, /key: 'aliasMoment'/, `${t} mist het veld aliasMoment`);
    }
  });

  it('hangt het moment aan de kiezer, zodat het niet los te kiezen valt', () => {
    const src = kaal(fs.readFileSync(CLIENT, 'utf8'));
    assert.match(src, /key: 'aliasMoment'[\s\S]{0,220}?showWhen: \{ key: 'aliasVan'/,
      'het moment hoort pas te verschijnen als er een pseudoniem staat');
  });

  it('kent de twee momenten die de server ook kent', () => {
    const src = fs.readFileSync(CLIENT, 'utf8');
    const blok = src.slice(src.indexOf('const ALIAS_MOMENTEN'), src.indexOf('const DOC_STIJL_BIJ_TYPE'));
    const waarden = [...blok.matchAll(/value: '([^']*)'/g)].map(m => m[1]);
    // Leeg is de standaard en betekent op de server 'geheim'; een derde waarde
    // zou daar in de 'geheim'-tak vallen zonder dat iemand dat bedoelde.
    assert.deepStrictEqual(waarden, ['', 'zichtbaar']);
    const api = kaal(fs.readFileSync(SERVER, 'utf8'));
    assert.match(api, /aliasMoment\(a\) === 'zichtbaar'/, 'de server kent dat moment niet');
    assert.match(api, /aliasMoment\(entity\) === 'geheim'/, 'de server kent dat moment niet');
  });

  it('geeft het vinkje opmaak, en begint het verborgen', () => {
    // Een klasse die theme.css niet kent geeft geen foutmelding; het vinkje
    // zou dan als kale tekst onder het tekstvak staan.
    assert.match(kaal(fs.readFileSync(CSS, 'utf8')), /^\.lijst-regel-alias \{/m,
      '.lijst-regel-alias heeft geen opmaak');
    const src = kaal(fs.readFileSync(CLIENT, 'utf8'));
    // Hij wordt getekend met zijn eerste stand erin — anders staat er bij elk
    // kaartje zonder pseudoniem een vinkje dat niets kan doen.
    assert.match(src, /lijst-regel-alias"\$\{aliasAan \? '' : ' style="display:none"'\}/,
      'de rij krijgt zijn eerste stand niet mee bij het tekenen');
    assert.match(src, /querySelectorAll\('\.lijst-regel-alias'\)/,
      'niets zet de rij live aan of uit');
  });
});
