const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// **Je AC uit wat je draagt.** Het veld werd met de hand ingevuld terwijl Base
// AC, soort en Strength-eis op het harnaskaartje staan. De optelling zelf is
// klein; de valkuilen zitten in de randen, en die staan hier:
//
//  * een **medium** harnas telt hoogstens +2 Dex, een **heavy** niets;
//  * een eigen cap op het kaartje wint van die soort;
//  * een harnas waarvan niemand de Base AC invulde mag geen stil verkeerd
//    getal geven;
//  * en niet-proficient is een **waarschuwing**, geen aftrek — in 5e verlies
//    je geen AC maar krijg je Disadvantage. Een getal dat lager uitvalt zou de
//    speler laten rekenen met een AC die nergens staat.
describe('AC uit je harnas', () => {
  let M;

  before(() => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'ac-rekenen.js'), 'utf8')
      .replace(/^export (const|function) /gm, '$1 ');
    const ctx = { console };
    vm.createContext(ctx);
    new vm.Script(`${src}\nglobalThis._uit = { acVan, dexCap, AC_SOORT };`).runInContext(ctx);
    M = ctx._uit;
  });

  const harnas = (naam, data) => ({ name: naam, data });
  const held = { dex: 16, str: 10, armorProfs: 'Light, Medium, Heavy, Shields' };

  it('zonder harnas is het 10 plus je Dex', () => {
    const r = M.acVan(null, null, held);
    assert.equal(r.ac, 13);
    assert.match(r.regels[0], /zonder harnas: 10 \+3 DEX/);
    assert.deepEqual(r.waarschuw, []);
  });

  it('licht harnas telt je hele Dex', () => {
    const r = M.acVan(harnas('Studded Leather', { armorType: 'light', armorBaseAC: 12 }), null, held);
    assert.equal(r.ac, 15);
  });

  it('medium harnas telt hoogstens +2, en zegt dat erbij', () => {
    const r = M.acVan(harnas('Chain Shirt', { armorType: 'medium', armorBaseAC: 13 }), null, held);
    assert.equal(r.ac, 15, '13 + 2, niet 13 + 3');
    assert.match(r.regels[0], /hoogstens \+2/);
  });

  it('zwaar harnas telt je Dex niet mee', () => {
    const r = M.acVan(harnas('Plate', { armorType: 'heavy', armorBaseAC: 18 }), null, held);
    assert.equal(r.ac, 18);
    assert.ok(!/DEX/.test(r.regels[0]));
  });

  it('een eigen cap op het kaartje wint van de soort', () => {
    const r = M.acVan(harnas('Armor of Gleaming', { armorType: 'light', armorBaseAC: 14, armorDexCap: 2 }), null, held);
    assert.equal(r.ac, 16, 'licht, maar het kaartje zegt hoogstens +2');
  });

  it('een schild telt erbij, en zonder getal is het +2', () => {
    const basis = harnas('Chain Shirt', { armorType: 'medium', armorBaseAC: 13 });
    assert.equal(M.acVan(basis, harnas('Shield', { itemType: 'Shield', armorBaseAC: 2 }), held).ac, 17);
    assert.equal(M.acVan(basis, harnas('Sentinel Shield', {}), held).ac, 17, 'geen getal op het kaartje → +2');
  });

  it('een harnas zonder Base AC geeft geen verzonnen getal', () => {
    const r = M.acVan(harnas('Zelfgemaakt Kuras', { armorType: 'medium' }), null, held);
    assert.equal(r.ac, 13, '10 + Dex, net als zonder harnas');
    assert.match(r.regels[0], /zonder harnas/);
  });

  it('niet proficient verlaagt je AC niet, maar waarschuwt wel', () => {
    const wizard = { dex: 16, str: 8, armorProfs: 'Light armor' };
    const r = M.acVan(harnas('Plate', { armorType: 'heavy', armorBaseAC: 18, strengthRequirement: 15 }), null, wizard);
    assert.equal(r.ac, 18, 'de AC blijft wat het harnas geeft');
    assert.equal(r.waarschuw.length, 2, 'niet proficient én te zwak: allebei melden');
    assert.match(r.waarschuw.join(' '), /niet proficient met Heavy armor/);
    assert.match(r.waarschuw.join(' '), /Strength 15/);
  });

  it('kent "All armor, shields" als dekkend', () => {
    const paladin = { dex: 10, str: 16, armorProfs: 'All armor, shields' };
    const r = M.acVan(harnas('Plate', { armorType: 'heavy', armorBaseAC: 18, strengthRequirement: 15 }),
      harnas('Shield', { armorBaseAC: 2 }), paladin);
    assert.equal(r.ac, 20);
    assert.deepEqual(r.waarschuw, [], 'proficient met alles en sterk genoeg');
  });

  it('meldt een Strength-eis en Stealth-nadeel', () => {
    const r = M.acVan(harnas('Splint', {
      armorType: 'heavy', armorBaseAC: 17, strengthRequirement: 15, stealthDisadvantage: 'true',
    }), null, { dex: 10, str: 12, armorProfs: 'All armor' });
    assert.equal(r.ac, 17);
    assert.match(r.waarschuw.join(' '), /Strength 15/);
    assert.match(r.waarschuw.join(' '), /Stealth/);
  });
});
