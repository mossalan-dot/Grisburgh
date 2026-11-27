// **"Hoe kun je proficiency in een spell hebben?"**
//
// Zo meldde de DM het, en hij had gelijk: het veld *Wat laat deze feature
// kiezen?* zette bij élke soort dezelfde twee keuzelijsten neer. Naast *Spreuk
// of cantrip* stond dus **Proficiency**, naast *Taal* een **+1**, en als bron
// voor een cantrip kon je *De skills van deze class* aanwijzen. Alle drie
// bestaan niet in 5e, en een formulier dat onmogelijke dingen aanbiedt laat je
// twijfelen aan de velden die wél kloppen.
//
// `_KEUZE_PASSEND` zegt nu per soort wat er te kiezen valt. Dat is pure
// rekenkunde in een browser-module zonder export, dus knippen we het blok eruit
// en draaien het in een `vm` — zelfde truc als `vaardigheden-tabellen.test.js`,
// en met dezelfde reden: de toets hoort op de échte catalogus te staan.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SRC = path.join(__dirname, '..', 'public', 'js', 'render-vaardigheden.js');

function blok() {
  const src = fs.readFileSync(SRC, 'utf8');
  const van = src.indexOf('const _KEUZE_SOORTEN');
  const tot = src.indexOf('function _keuzeRijHtml');
  assert.ok(van > 0 && tot > van, 'het keuzeblok staat niet meer waar het stond');
  const sandbox = {};
  vm.runInNewContext(src.slice(van, tot) + `
    this.soorten = _KEUZE_SOORTEN; this.geeft = _KEUZE_GEEFT; this.uit = _KEUZE_UIT;
    this.passend = _keuzePassend; this.opties = _keuzeOpties; this.PASSEND = _KEUZE_PASSEND;
    this.opruimen = _keuzeOpruimen; this.stand = _keuzeUitStand;`, sandbox);
  return sandbox;
}

describe('Wat een keuze laat kiezen', () => {
  const k = blok();
  // Het kale "—" staat er altijd bij zolang de lijst getekend wordt; wat er te
  // *kiezen* valt is de rest. Blijft daar niets van over, dan verdwijnt de hele
  // lijst (`toontGeeft`/`toontUit` — dezelfde `length > 1` als de rij gebruikt).
  const geeftVan = (soort) => k.opties(k.geeft, k.passend(soort).geeft).map(o => o.v).filter(Boolean);
  const uitVan   = (soort) => k.opties(k.uit,   k.passend(soort).uit).map(o => o.v).filter(Boolean);
  const toontGeeft = (soort) => k.opties(k.geeft, k.passend(soort).geeft).length > 1;
  const toontUit   = (soort) => k.opties(k.uit,   k.passend(soort).uit).length > 1;

  // Een soort zonder eigen regel valt terug op "niets te kiezen". Dat is de
  // veilige kant op, maar wel stil: de nieuwe soort biedt dan nergens iets aan.
  it('geeft elke soort uit de keuzelijst een eigen regel', () => {
    const missend = k.soorten.map(s => s.v).filter(v => !Object.hasOwn(k.PASSEND, v));
    assert.deepEqual(missend, [], 'deze soorten hebben geen eigen regel: ' + missend.join(', '));
    const spoken = Object.keys(k.PASSEND).filter(v => !k.soorten.some(s => s.v === v));
    assert.deepEqual(spoken, [], 'deze regels horen bij geen enkele soort: ' + spoken.join(', '));
  });

  // Elke genoemde waarde moet ook echt in de keuzelijst staan, anders verdwijnt
  // hij stilzwijgend bij het filteren.
  it('noemt alleen waarden die de keuzelijsten kennen', () => {
    for (const [soort, regel] of Object.entries(k.PASSEND)) {
      for (const v of regel.geeft) assert.ok(k.geeft.some(o => o.v === v), `${soort}: geeft "${v}" bestaat niet`);
      for (const v of regel.uit)   assert.ok(k.uit.some(o => o.v === v),   `${soort}: uit "${v}" bestaat niet`);
    }
  });

  // Dit is de melding zelf. Een spreuk, een taal of een feat is iets dat je
  // kiest; er zit geen proficiency, expertise of bonus aan.
  it('biedt geen proficiency of bonus bij een spreuk, taal of feat', () => {
    for (const soort of ['spell', 'language', 'feat', 'vrij', 'variant']) {
      assert.deepEqual(geeftVan(soort), [], `${soort} biedt nog ${geeftVan(soort).join('/')}`);
      assert.equal(toontGeeft(soort), false, `de keuzelijst staat nog bij ${soort}`);
    }
  });

  it('biedt proficiency en expertise bij een skill en gereedschap, en geen bonus', () => {
    for (const soort of ['skill', 'tool']) {
      assert.deepEqual(geeftVan(soort), ['proficiency', 'expertise'], soort);
    }
  });

  // En de spiegel daarvan: bij een ability score is +1/+2 het hele punt en
  // bestaat proficiency niet.
  it('biedt bij een ability score alleen +1 en +2', () => {
    assert.deepEqual(geeftVan('ability'), ['+1', '+2']);
  });

  it('biedt de skills van een class alleen als bron voor een skill', () => {
    assert.deepEqual(uitVan('skill'), ['lijst', 'eigen', 'class']);
    const fout = k.soorten.map(s => s.v).filter(v => v !== 'skill' && uitVan(v).includes('class'));
    assert.deepEqual(fout, [], 'hier kun je nog "de skills van deze class" kiezen: ' + fout.join(', '));
    // "Uit wat je al hebt" is bij een taal of spreuk net zo min een bron.
    assert.deepEqual(uitVan('language'), ['lijst']);
  });

  // Een keuzelijst met alleen het kale "—" erin zegt niets en hoort niet te
  // staan; de rij tekent hem daarom alleen bij meer dan één optie.
  it('tekent een keuzelijst alleen als er iets te kiezen valt', () => {
    const src = fs.readFileSync(SRC, 'utf8');
    for (const [veld, lijst] of [['geeft', 'geeftOpties'], ['uitstand', 'uitOpties']]) {
      assert.match(src, new RegExp(`\\$\\{${lijst}\\.length > 1 \\? sel\\('${veld}'`),
        `${veld} hangt niet aan het aantal opties`);
    }
    assert.equal(toontGeeft('vrij'), false, 'een vrije keuze hoort geen geeft-lijst te hebben');
    assert.equal(toontUit('vrij'),   false, 'een vrije keuze hoort geen bron-lijst te hebben');
    assert.equal(toontUit('variant'), false, 'een variant hoort geen bron-lijst te hebben');
    // En de andere kant op: waar er wél iets te kiezen valt, staat hij er.
    assert.equal(toontGeeft('skill'), true);
    assert.equal(toontUit('spell'),   true);
  });

  // Wisselt de soort van skill naar spell, dan verdwijnt de keuzelijst waarin
  // `proficiency` stond — en zonder opruiming blijft die waarde stil in de data
  // staan, op een plek waar je hem niet meer weg kúnt halen.
  it('ruimt een waarde op die bij de nieuwe soort niet meer past', () => {
    // Een skill-keuze die een spreuk-keuze wordt: proficiency en de
    // class-skills slaan nergens meer op en horen weg te zijn.
    const [om] = k.opruimen([{ soort: 'spell', geeft: 'proficiency', uit: 'class' }]);
    assert.ok(!('geeft' in om), 'proficiency blijft op een spreuk staan');
    assert.ok(!('uit' in om),   'de class-skills blijven als bron van een spreuk staan');

    // En een +1 die een skill wordt.
    const [ab] = k.opruimen([{ soort: 'skill', geeft: '+2' }]);
    assert.ok(!('geeft' in ab), 'een bonus blijft op een skill staan');

    // Wat wél past blijft onaangeroerd — opruimen mag geen keuze opeten.
    const [heel] = k.opruimen([{ soort: 'skill', geeft: 'expertise', uit: 'class' }]);
    assert.equal(heel.geeft, 'expertise');
    assert.equal(heel.uit, 'class');
    // Een eigen lijst is een array; die telt als stand 'lijst' en blijft staan.
    const [lijst] = k.opruimen([{ soort: 'spell', uit: ['Fire Bolt'] }]);
    assert.deepEqual(lijst.uit, ['Fire Bolt']);
  });
});
