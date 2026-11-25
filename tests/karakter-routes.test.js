const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

// **Een route met een karakter-id in zijn pad moet weten van wie dat karakter
// is.** Anders kan speler A aan het blad, de beurs, de post of de Rage van
// speler B komen — binnen dezelfde campagne, dus de campagne-isolatie vangt het
// niet. Nagelopen op 25 nov 2026: alle 40-en-zoveel routes zijn afgeschermd.
// Deze toets houdt dat zo; hij vindt niets nieuws, hij voorkomt iets nieuws.
//
// De controle komt in de codebase in **vijf** gedaanten voor, en dat is geen
// slordigheid maar geschiedenis. Ze gelden alle vijf:
//   requireDM                       — alleen de DM mag hier sowieso
//   req.session.characterId !== …   — de klassieke
//   req.characterId !== …           — `attachRole` zet dat veld ook
//   _magRage(req, id)               — een eigen helper (Rage)
//   _magKarakter / _eigenKarakter   — idem, mocht die er komen
//   req.role !== 'dm' → 403        — hetzelfde DM-slot, maar in het lichaam
//                                     in plaats van als middleware
const API = fs.readFileSync(path.join(__dirname, '..', 'routes', 'api.js'), 'utf8').split('\n');

const SLOTEN = [
  /req\.session\??\.?\s*characterId\s*!==/,
  /req\.characterId\s*!==/,
  /_magRage\s*\(/,
  /_magKarakter\s*\(/,
  /_eigenKarakter\s*\(/,
  // Een route die zelf de groep van het karakter opzoekt en daar tegen toetst.
  /_playerGroupId\s*\([^)]*\)\s*!==/,
  // En het DM-slot in het lichaam: `if (req.role !== 'dm') return 403`.
  /req\.(?:session\.)?role\s*!==\s*'dm'[\s\S]{0,120}?403/,
];

function ongedekteRoutes(regels) {
  const uit = [];
  for (let i = 0; i < regels.length; i++) {
    const m = regels[i].match(/^router\.(get|post|put|patch|delete)\('([^']+)'\s*,\s*([A-Za-z]+)/);
    if (!m) continue;
    const [, methode, pad, middleware] = m;
    if (!/:(characterId|charId)\b/.test(pad)) continue;
    if (middleware === 'requireDM' || middleware === 'requireBeheerder') continue;
    let lijf = '';
    for (let j = i + 1; j < regels.length && !/^router\.(get|post|put|patch|delete)\(/.test(regels[j]); j++) {
      lijf += regels[j] + '\n';
    }
    if (!SLOTEN.some(re => re.test(lijf))) uit.push(`${methode.toUpperCase()} ${pad}`);
  }
  return uit;
}

describe('Een karakter is van één speler', () => {
  it('zet een slot op elke route met een karakter-id', () => {
    const fout = ongedekteRoutes(API);
    assert.deepStrictEqual(fout, [],
      'deze routes noemen een karakter in hun pad maar vragen niet van wie het is:\n  ' + fout.join('\n  '));
  });

  it('kijkt naar genoeg routes om iets te betekenen', () => {
    // Een toets die nul routes onderzoekt slaagt altijd. Dit is dezelfde val
    // als een controle op een veld dat niet bestaat.
    const n = API.filter(r => /^router\.\w+\('[^']*:(characterId|charId)\b/.test(r)).length;
    assert.ok(n > 25, `er zijn er maar ${n} gevonden — is het patroon van een route veranderd?`);
  });
});
