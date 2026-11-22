const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// **Features die meegroeien met je level.** Sommige staan één keer in de
// progressie en worden later sterker: "The die becomes a d8 at level 5". Het
// Heldenboek maakte daar al pillen van — de getallen — maar daarmee weet je
// nog niet wát er verandert, en je blad kan niet zeggen *jouw steen is een d8*.
//
// `feature-groei.js` haalt per trede de **zin** uit de tekst die er al staat.
// Niets verzinnen dus; de hele kunst zit in wat je níét meeneemt. Een
// spreukniveau is geen personagelevel ("spells of level 1 and 2"), het level
// waarop je de feature krijgt is geen groei, en een punt in "d8." is geen
// zinseinde. Dat zijn de drie manieren waarop dit stil fout gaat, en daarom
// staan ze hier.
describe('Wat er op een later level verandert', () => {
  let M;

  before(() => {
    // ES-module in een CommonJS-pakket: de exportregels eraf en in een sandbox
    // draaien, zodat de toets op de échte code staat en niet op een kopie.
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'feature-groei.js'), 'utf8')
      .replace(/^export function /gm, 'function ');
    const ctx = { console };
    vm.createContext(ctx);
    new vm.Script(`${src}\nglobalThis._uit = { groeiRegels, groeiVan, levelsIn, zinnen };`).runInContext(ctx);
    M = ctx._uit;
  });

  it('haalt de drie treden van Bardic Inspiration uit één zin', () => {
    const t = 'You can inspire others. The die becomes a d8 at level 5, a d10 at level 10, and a d12 at level 15.';
    const g = M.groeiRegels(t, 1);
    assert.deepEqual(g.map(x => x.level), [5, 10, 15]);
    // Elke trede draagt de hele zin: die zegt zelf wat er op 10 geldt, en
    // "zie hierboven" is geen antwoord op je eigen blad.
    assert.ok(g.every(x => /d8 at level 5/.test(x.tekst)));
  });

  it('telt het level waarop je hem krijgt niet mee', () => {
    const t = 'At 3rd level you gain this. At 9th level it improves.';
    assert.deepEqual(M.groeiRegels(t, 3).map(x => x.level), [9]);
  });

  it('kent "Barbarian levels 8, 12, and 16"', () => {
    const g = M.groeiRegels('You gain this feature again at Barbarian levels 8, 12, and 16.', 4);
    assert.deepEqual(g.map(x => x.level), [8, 12, 16]);
  });

  it('laat een spreukniveau met rust', () => {
    // Dit is de valkuil: "level 2" gaat hier over de spreuk, niet over jou.
    assert.deepEqual(M.groeiRegels('You can cast spells of level 1 and 2 with this.', 1), []);
    assert.deepEqual(M.groeiRegels('You learn a level 6 Warlock Spell.', 1), []);
    assert.deepEqual(M.groeiRegels('Choose a level 3 spell or lower.', 1), []);
  });

  it('knipt een zin niet op een punt die geen zinseinde is', () => {
    const g = M.groeiRegels('The die becomes a d8. at 5th level.', 1);
    // Wat er ook uitkomt: de trede hoort bij level 5 en de zin mag niet
    // halverwege afbreken in iets onleesbaars.
    assert.equal(g.length, 1);
    assert.equal(g[0].level, 5);
    assert.match(g[0].tekst, /5th level/);
  });

  it('geeft een zin zonder level niets', () => {
    assert.deepEqual(M.groeiRegels('Je slaat hard en je mist zelden.', 1), []);
    assert.deepEqual(M.groeiRegels('', 1), []);
    assert.deepEqual(M.groeiRegels(null, 1), []);
  });

  it('negeert een level boven 20', () => {
    assert.deepEqual(M.groeiRegels('This improves at 25th level.', 1), []);
  });

  it('laat de DM het overschrijven', () => {
    // De afgeleide is een noodoplossing; wat de DM zelf vastlegde wint, en
    // wordt op volgorde gezet zodat de tijdlijn hem niet hoeft te sorteren.
    const f = {
      desc: 'The die becomes a d8 at level 5.',
      groei: [{ level: 15, tekst: 'Bij ons een d12.' }, { level: 7, tekst: 'Bij ons een d10.' }],
    };
    assert.deepEqual(M.groeiVan(f, 1), [
      { level: 7, tekst: 'Bij ons een d10.' },
      { level: 15, tekst: 'Bij ons een d12.' },
    ]);
    // Een leeg veld is geen keuze: dan telt de tekst weer.
    assert.deepEqual(M.groeiVan({ desc: f.desc, groei: [] }, 1).map(x => x.level), [5]);
  });

  it('houdt elke trede één keer, ook als twee zinnen hetzelfde level noemen', () => {
    const t = 'At 5th level it improves. At 5th level you also gain reach.';
    const g = M.groeiRegels(t, 1);
    assert.equal(g.length, 1, 'één trede per level');
    assert.match(g[0].tekst, /improves/, 'en de eerste zin wint');
  });
});
