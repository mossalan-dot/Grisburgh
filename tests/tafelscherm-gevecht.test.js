const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

// **Een tafelscherm dat midden in een gevecht opstart moet de stand inhalen.**
// Over de socket voedt `combat:updated` twee consumenten: het gevechtsscherm
// (`dmPanel.onCombatUpdated`) én de regie (`_gevechtRegie.onCombat`, die de
// rode rand en de hartslag zet van wie op 0 ligt). Bij het **opstarten** ging
// alleen de eerste mee.
//
// Gemeten op 25 nov 2026 in een wegwerpkopie: een vers geladen tafelscherm met
// een speler op 0 HP en twee failures liet níéts zien — geen rand, geen
// hartslag — en bleef dat de hele scène doen tot er toevallig een volgende
// update langskwam. Juist bij dit signaal is dat erg: het zegt dat er iemand
// doodgaat.
//
// Dit is bedrading, en die valt niet te vangen met een unittoets op een regel
// (zie `tests/fouten-bedrading.test.js`, waar dezelfde les al stond). Een
// browser erbij halen voor élke opstartvolgorde is duurder dan het waard is,
// dus toetsen we de aanroepketen in de bron — met twee ingangen, want een
// scherm dat gewoon herlaadt komt niet langs `_displayModeAan`.
const APP = fs.readFileSync(path.join(__dirname, '..', 'public/js/app.js'), 'utf8');

const blok = (naam, eind) => {
  const a = APP.indexOf(naam);
  assert.ok(a > 0, `niet gevonden in app.js: ${naam}`);
  const b = APP.indexOf(eind, a);
  assert.ok(b > a, `einde niet gevonden na ${naam}`);
  return APP.slice(a, b);
};

describe('Het tafelscherm haalt bij het opstarten de stand in', () => {
  it('heeft één plek die de stand ophaalt', () => {
    const helper = blok('window._displayStandInhalen = () => {', '};');
    assert.match(helper, /api\.getCombat\(\)/, 'hij haalt het gevecht niet op');
    assert.match(helper, /dmPanel\?\.onCombatUpdated/, 'het gevechtsscherm krijgt het niet');
    assert.match(helper, /_gevechtRegie\?\.onCombat/,
      'de regie krijgt het niet — dan blijft de rode rand van iemand op 0 HP weg');
    // En de kist. Die stond onder `_displayModeAan`, mét een comment dat hij er
    // was "voor na een herlaadbeurt" — precies het geval dat daar niet langs
    // komt.
    assert.match(helper, /combat\/loot\?tafel=1/, 'een kist die openstaat wordt niet opgehaald');
    assert.match(helper, /_lootCinematic/, 'de kist wordt opgehaald maar niet getoond');
  });

  it('roept hem aan vanuit allebei de ingangen', () => {
    const aan = blok('function _displayModeAan() {', '\nfunction ');
    assert.match(aan, /_displayStandInhalen\(\)/, '?display=1 haalt de stand niet in');

    const init = blok('function _initDisplayMode() {', '\n}\n');
    assert.match(init, /_displayStandInhalen\(\)/,
      'een scherm dat herlaadt haalt de stand niet in — die komt niet langs _displayModeAan');
  });

  it('laat de socketweg allebei de consumenten voeden', () => {
    // De weg die het al goed deed; als die ooit versmalt, versmalt de hele
    // gevechtsregie mee.
    const sc = fs.readFileSync(path.join(__dirname, '..', 'public/js/socket-client.js'), 'utf8');
    const hand = sc.slice(sc.indexOf("socket.on('combat:updated'"), sc.indexOf("socket.on('combat:updated'") + 500);
    assert.match(hand, /dmPanel\.onCombatUpdated/);
    assert.match(hand, /_gevechtRegie\?\.onCombat/);
  });
});
