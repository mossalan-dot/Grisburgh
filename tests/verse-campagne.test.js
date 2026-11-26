// **Wat een verse campagne meekrijgt.**
//
// In `lib/storage.js` staan twee lijsten met standaardwaarden naast elkaar, en
// ze doen net iets anders: `createCampaign` **schrijft** de bestanden van een
// nieuwe campagne, `DEFAULTS` is wat `readJSON` teruggeeft als een bestand er
// niet is of leeg is. Twee lijsten van hetzelfde lopen uit elkaar — dat is in
// dit project de regel, niet de uitzondering — en hier was dat ook gebeurd:
//
//  - `monsters.json` werd aangemaakt als platte lijst `[]` terwijl elke lezer
//    `readJSON('monsters.json').monsters || []` doet. Onschuldig zolang hij
//    leeg blijft, maar wie er met een script een monster in duwt zet een
//    eigenschap op een array, en die gooit `JSON.stringify` stilzwijgend weg.
//  - `DEFAULTS['meta.json'].appTitle` stond op `'Grisburgh'`: een campagne
//    zonder `meta.json` heette daarmee Grisburgh, op de landingspagina, in de
//    paginatitel en in het PWA-manifest. `createCampaign` deed het wél goed.
//
// Allebei stil, allebei pas te zien als je ernaar zoekt. Vandaar deze toets op
// de vórm, niet op de inhoud.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-vers-${Date.now()}-${Math.random().toString(36).slice(2)}`);

describe('Een verse campagne', () => {
  let storage;

  before(() => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    delete require.cache[require.resolve('../lib/storage')];
    storage = require('../lib/storage');
    fs.mkdirSync(path.join(DATA_DIR, 'campaigns'), { recursive: true });
    storage.createCampaign('veerhuis');
  });

  after(() => { fs.rmSync(DATA_DIR, { recursive: true, force: true }); });

  const lees = (f) => JSON.parse(fs.readFileSync(
    path.join(DATA_DIR, 'campaigns', 'veerhuis', f), 'utf8'));

  it('schrijft elk bestand in de vorm die zijn lezers verwachten', () => {
    // Per bestand: welke sleutel haalt de code eruit, en wat hoort daar te
    // staan. Dit is de lijst die in de praktijk uit elkaar loopt.
    const verwacht = {
      'entities.json':   { personages: 'array', locaties: 'array', organisaties: 'array',
                           voorwerpen: 'array', documenten: 'array' },
      'archief.json':    { logEntries: 'array', sessieLog: 'array' },
      'combat.json':     { combatants: 'array' },
      'map.json':        { pins: 'array' },
      'monsters.json':   { monsters: 'array' },   // **niet** een platte lijst
      'encounters.json': { encounters: 'array' },
      'sounds.json':     { library: 'array', emotes: 'object' },
      'tables.json':     { tables: 'array' },
    };
    for (const [bestand, velden] of Object.entries(verwacht)) {
      const d = lees(bestand);
      assert.ok(d && typeof d === 'object' && !Array.isArray(d),
        `${bestand} hoort een object te zijn, geen array — anders leest niemand hem`);
      for (const [k, soort] of Object.entries(velden)) {
        const w = d[k];
        if (soort === 'array') assert.ok(Array.isArray(w), `${bestand} mist ${k} als lijst`);
        else assert.ok(w && typeof w === 'object' && !Array.isArray(w), `${bestand} mist ${k} als object`);
      }
    }
  });

  it('noemt de campagne bij zijn eigen naam, niet bij die van Grisburgh', () => {
    assert.strictEqual(lees('meta.json').appTitle, 'Veerhuis');
  });

  it('geeft diezelfde naam terug als meta.json er helemaal niet is', () => {
    // Dit is de andere kant: de terugval bij het **lezen**. Hij stond op
    // 'Grisburgh' en gold dus voor élke campagne zonder meta.json.
    fs.mkdirSync(path.join(DATA_DIR, 'campaigns', 'stilzwijgen'), { recursive: true });
    const uit = storage.runInCampaign('stilzwijgen', () => storage.readJSON('meta.json'));
    assert.strictEqual(uit.appTitle, 'Stilzwijgen',
      "de leesterugval hoort de campagne in het pad te noemen, niet 'Grisburgh'");
    assert.strictEqual(
      storage.runInCampaign('veerhuis', () => storage.readJSON('meta.json')).appTitle,
      'Veerhuis', 'en hij hoort per verzoek mee te lopen — vandaar een getter');
  });

  it('houdt de twee lijsten in storage.js het eens over de vorm', () => {
    // `createCampaign` schrijft, `DEFAULTS` valt terug. Waar een bestand in
    // allebei staat, horen de sleutels gelijk te zijn — anders hangt de vorm af
    // van de vraag of het bestand toevallig bestaat.
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'storage.js'), 'utf8');
    const blok = (re) => {
      const m = re.exec(src);
      assert.ok(m, 'het blok staat niet meer waar het stond');
      const uit = {};
      for (const r of m[0].split('\n')) {
        const b = /^\s*'([^']+\.json)':\s*(.*)$/.exec(r);
        if (!b) continue;
        // Alleen sleutels (`naam:`), geen functieaanroepen — anders telt
        // `naamUitId(` als veld en verschillen de lijsten om niets.
        uit[b[1]] = [...b[2].matchAll(/(?:get\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?::|\(\)\s*\{)/g)]
          .map(x => x[1]);
      }
      return uit;
    };
    const maakt = blok(/const defaults = \{[\s\S]*?\n  \};/);
    const valt  = blok(/const DEFAULTS = \{[\s\S]*?\n\};/);
    assert.ok(Object.keys(maakt).length >= 10 && Object.keys(valt).length >= 10,
      'leest de toets de twee lijsten nog wel?');

    const scheef = [];
    for (const bestand of Object.keys(maakt)) {
      if (!valt[bestand]) continue;   // alleen aanmaken mag; dan is er niets te vergelijken
      // `dm-state.json` is met opzet verschillend: de terugval is er voor een
      // lees-actie op een campagne die er nog geen heeft, en die hoeft geen
      // party aan te maken. Dat staat hier bij naam, zodat het een keuze blijft.
      if (bestand === 'dm-state.json') continue;
      const a = [...maakt[bestand]].sort().join(',');
      const b = [...valt[bestand]].sort().join(',');
      if (a !== b) scheef.push(`${bestand}\n    aanmaken: ${a}\n    terugval: ${b}`);
    }
    assert.deepStrictEqual(scheef, [],
      'deze bestanden krijgen een andere vorm al naar gelang ze bestaan:\n  ' + scheef.join('\n  '));
  });
});
