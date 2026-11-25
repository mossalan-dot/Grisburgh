const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// **Wat een campagne van een conditie maakt.** `public/js/conditions.js` is de
// enige lijst die de app van condities heeft — het gevechtscanvas, het
// spelerstabblad, de picker van de DM en de deur Conditions in Naslag lezen
// hem alle vier. `meta.condities` schuift daar overheen, en dat gaat op twee
// manieren: een conditie die alléén in deze campagne bestaat komt erbij, en een
// meegeleverde wordt bijgeschaafd.
//
// Die tweede is de reden voor deze toets. Een aanpassing moet terug te draaien
// zijn, en dat kan alleen als de functie het origineel bewaart — in een
// langlopend tabblad wordt `zetEigenCondities` bij elke wijziging opnieuw
// aangeroepen, dus zonder die momentopname zou de tekst uit het boek na de
// eerste bewerking voorgoed verdwenen zijn. Een `grep` ziet dat niet: er komt
// gewoon een andere tekst uit.
describe('Condities van de campagne zelf', () => {
  let M;

  before(() => {
    // Het bestand is een ES-module in een CommonJS-pakket, dus `require` kan er
    // niet bij. Zelfde truc als bij de vaardigheden-tabellen: de export- en
    // importregels eraf en in een sandbox draaien, zodat de toets op de échte
    // code staat en niet op een kopie ervan.
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'conditions.js'), 'utf8')
      .replace(/^export (const|let|function) /gm, '$1 ')
      .replace(/^export \{[^}]*\};?$/gm, '');
    const ctx = { window: {}, console };
    vm.createContext(ctx);
    new vm.Script(`${src}
      globalThis._uit = { CONDITIONS, COND_INFO, COND_ICON, zetEigenCondities,
        isEigenConditie, isAangepasteConditie, condGroep };`).runInContext(ctx);
    M = ctx._uit;
  });

  it('brengt de condities uit het boek mee', () => {
    assert.ok(M.CONDITIONS.length >= 30, `${M.CONDITIONS.length} condities`);
    assert.match(M.COND_INFO.restrained.desc, /Speed becomes 0/);
  });

  it('zet een eigen conditie erbij', () => {
    M.zetEigenCondities([{ id: 'mistbann', label: 'Mistbann', desc: 'De mist houdt je vast.', icoon: 'wind' }]);
    assert.equal(M.COND_INFO.mistbann.label, 'Mistbann');
    assert.equal(M.COND_ICON.mistbann[0], 'wind');
    assert.ok(M.isEigenConditie('mistbann'));
    assert.ok(M.CONDITIONS.some(c => c.id === 'mistbann'));
  });

  it('haalt hem ook weer weg', () => {
    M.zetEigenCondities([]);
    assert.ok(!M.COND_INFO.mistbann);
    assert.ok(!M.CONDITIONS.some(c => c.id === 'mistbann'));
    assert.ok(!M.isEigenConditie('mistbann'));
  });

  it('schaaft een meegeleverde conditie bij, zonder hem te vervangen', () => {
    M.zetEigenCondities([{ id: 'restrained', desc: 'Je zit vast aan het wrakhout.', icoon: 'weight' }]);
    assert.equal(M.COND_INFO.restrained.desc, 'Je zit vast aan het wrakhout.');
    assert.equal(M.COND_ICON.restrained[0], 'weight');
    assert.equal(M.COND_INFO.restrained.label, 'Restrained', 'de naam liet hij leeg, dus die blijft');
    assert.ok(M.isAangepasteConditie('restrained'));
    assert.ok(!M.isEigenConditie('restrained'), 'hij is niet van deze campagne — hij is bijgeschaafd');
    assert.equal(M.CONDITIONS.filter(c => c.id === 'restrained').length, 1, 'en staat er één keer');
  });

  it('houdt de kleur van het icoon als de DM alleen de tekening verzet', () => {
    const kleur = M.COND_ICON.restrained[1];
    M.zetEigenCondities([{ id: 'restrained', icoon: 'grab' }]);
    assert.deepEqual(M.COND_ICON.restrained, ['grab', kleur]);
  });

  it('zet de tekst uit het boek terug zodra de aanpassing weggaat', () => {
    M.zetEigenCondities([]);
    assert.match(M.COND_INFO.restrained.desc, /Speed becomes 0/);
    assert.equal(M.COND_INFO.restrained.label, 'Restrained');
    assert.ok(!M.COND_INFO.restrained.aangepast);
    assert.ok(!M.isAangepasteConditie('restrained'));
  });

  it('overleeft tien rondes bijschaven — het origineel raakt niet zoek', () => {
    for (let i = 0; i < 10; i++) M.zetEigenCondities([{ id: 'prone', label: `Ronde ${i}`, desc: `tekst ${i}` }]);
    assert.equal(M.COND_INFO.prone.label, 'Ronde 9');
    M.zetEigenCondities([]);
    assert.equal(M.COND_INFO.prone.label, 'Prone');
    assert.match(M.COND_INFO.prone.desc, /Disadvantage/);
  });

  // **Opslaan zonder iets te kiezen mag niets weggooien.** De editor stuurt
  // de hele rij terug, ook als de DM alleen keek. Zolang `_conditieUit` op de
  // server een standaard-icoon invulde (`sparkle`), betekende dat: één keer
  // opslaan en het échte icoon is weg. In Grisburgh raakte Unconscious zo zijn
  // bed kwijt — op elk token bij een death save. De server stuurt dat veld nu
  // alleen mee als het gevuld is; hier staat de andere helft van die afspraak.
  it('houdt het icoon uit het boek als er geen eigen icoon meekomt', () => {
    const was = [...M.COND_ICON.unconscious];
    M.zetEigenCondities([{ id: 'unconscious', label: 'Unconscious', groep: 'conditie', desc: '' }]);
    assert.deepEqual(M.COND_ICON.unconscious, was,
      'een rij zonder icoon mag het icoon uit het boek niet vervangen');
    assert.match(M.COND_INFO.unconscious.desc, /Incapacitated/,
      'en een lege beschrijving mag de tekst uit het boek niet wissen');
    M.zetEigenCondities([]);
  });

  it('geeft een nieuwe conditie wél een icoon, ook zonder keuze', () => {
    M.zetEigenCondities([{ id: 'zeeziek', label: 'Zeeziek', groep: 'conditie' }]);
    assert.ok(M.COND_ICON.zeeziek, 'een eigen conditie hoort altijd iets te tonen');
    assert.equal(M.COND_ICON.zeeziek[0], 'sparkle');
    M.zetEigenCondities([]);
  });

  // De andere helft staat op de server: `_conditieUit` mag dat veld niet
  // invullen. Dit is de kanarie — hij wijst naar de regel die het fout deed.
  it('vult de server geen standaard-icoon in', () => {
    const api = fs.readFileSync(path.join(__dirname, '..', 'routes', 'api.js'), 'utf8');
    const fn = api.slice(api.indexOf('function _conditieUit'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    assert.ok(!/icoon:\s*String\(rauw\.icoon[^\n]*\|\|\s*'sparkle'/.test(body),
      "_conditieUit mag `icoon` niet op 'sparkle' zetten als de DM niets koos: dat veld "
      + 'schuift over het icoon uit het boek heen');
  });

  it('laat de groep van een bijgeschaafde conditie staan', () => {
    // De groep komt uit de kleur van het icoon (`condGroep`), en die bepaalt
    // achter welk filter hij in Naslag valt. Een tekst bijschaven mag hem niet
    // van de ene rij naar de andere verhuizen.
    const voor = M.condGroep('raging');
    M.zetEigenCondities([{ id: 'raging', desc: 'Je kookt.' }]);
    assert.equal(M.condGroep('raging'), voor);
    M.zetEigenCondities([]);
  });
});
