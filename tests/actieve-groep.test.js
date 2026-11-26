const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

// **`getGroup(dmState)` zonder tweede argument is de party van de DM.**
// In een route die een speler kan bereiken is dat bijna altijd fout: hij hoort
// zijn eigen tafel te zien. Op 25–26 nov 2026 zaten er elf zulke plekken, met
// gevolgen van "de kaart verklapt plekken die je party niet kent" tot "je
// gegunde level verdwijnt zodra de DM naar een andere tafel kijkt".
//
// Deze toets laat de bekende uitzonderingen staan en weigert nieuwe. Komt er
// een route bij waar de actieve groep écht de bedoeling is, zet hem dan in
// `MAG` mét de reden — dat dwingt het gesprek af in plaats van het te missen.
const API = fs.readFileSync(path.join(__dirname, '..', 'routes', 'api.js'), 'utf8').split('\n');

const MAG = {
  // Campagnebrede stand met een ambigue klok: de weddenschappen van de
  // Tweespalt horen bij geen enkele party. Met de klok van de kíjker zou een
  // weddenschap anders aflopen afhankelijk van wie de pagina opent.
  'GET /tweespalt': 'campagnebrede events, één klok',
  // Idem: de kas van een winkel ververst per lange rust en is gedeeld.
  'POST /herberg/bestel': 'gedeelde winkelkas, één klok',
  // Nagekeken op 26 nov 2026: in deze twee wordt `g` alléén in de DM-tak
  // gebruikt; de spelerstak rekent verderop met `playerGid` en
  // `filterEntityForPlayer`. De aanroep staat alleen vóór die vertakking, dus
  // de bewaker ziet hem niet in context.
  'GET /entities/:type': 'g is de DM-tak; de speler krijgt playerGid',
  'GET /entities/:type/:id': 'idem',
};

function kaleAanroepen() {
  const code = (r) => r.replace(/\/\/.*$/, '');
  const fout = [];
  for (let i = 0; i < API.length; i++) {
    const m = API[i].match(/^router\.(get|post|put|patch|delete)\('([^']+)'\s*,\s*attachRole/);
    if (!m) continue;
    const naam = `${m[1].toUpperCase()} ${m[2]}`;
    const regels = [];
    for (let j = i + 1; j < API.length && !/^router\.(get|post|put|patch|delete)\(/.test(API[j]); j++) regels.push(API[j]);
    const raak = regels.some((r, k) => {
      const c = code(r);
      if (!/getGroup\(\s*dmState\s*\)/.test(c)) return false;
      // De vangregel van een ternair telt niet:
      // `kijker ? getGroup(dmState, eigen) : getGroup(dmState)` — en die staat
      // soms over twee regels, met de `:` aan het begin van de tweede.
      if (/getGroup\(\s*dmState\s*,/.test(c)) return false;
      if (/^\s*:/.test(c) && /getGroup\(\s*dmState\s*,/.test(code(regels[k - 1] || ''))) return false;
      // En een aanroep in de DM-tak evenmin.
      const ctx = regels.slice(Math.max(0, k - 6), k).map(code).join(' ');
      return !/role === 'dm'|isDM\b|playerGroupId \?|_kijkerId \?/.test(ctx);
    });
    if (raak && !MAG[naam]) fout.push(naam);
  }
  return fout;
}

describe('De actieve groep is niet de party van de speler', () => {
  it('gebruikt in geen enkele speler-route de actieve groep', () => {
    assert.deepStrictEqual(kaleAanroepen(), [],
      'deze routes geven een speler de party waar de DM naar kijkt:\n  ' + kaleAanroepen().join('\n  '));
  });

  it('kijkt naar genoeg routes om iets te betekenen', () => {
    const n = API.filter(r => /^router\.\w+\('[^']+'\s*,\s*attachRole/.test(r)).length;
    assert.ok(n > 60, `maar ${n} speler-routes gevonden — is het patroon veranderd?`);
  });
});
