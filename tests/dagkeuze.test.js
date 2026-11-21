const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Een keuze die maar één dag geldt.** Drie species geven een skill "until the
// end of your next long rest". Die moet dus bij de rust van het blad af — en
// daar zit het risico: een skill kan óók van je class of je background komen,
// en die mag er niet in diezelfde beweging afvallen. Daarom houdt de server bij
// wát hij zelf schreef, en die afspraak bewaakt deze toets.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-dag-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url  = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    if (body) {
      const json = JSON.stringify(body);
      opts.headers['Content-Type']   = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(json);
    }
    if (cookie) opts.headers['Cookie'] = cookie;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, cookie: sc ? sc[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

describe('Wat je elke dag opnieuw kiest', () => {
  let server, io, dm;
  const CHAR = 'e_dagkeuze_test';
  const lees = (f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'dagproef', f), 'utf8'));
  const schrijf = (f, d) => fs.writeFileSync(path.join(DATA_DIR, 'campaigns', 'dagproef', f), JSON.stringify(d, null, 2));
  const profiel = () => lees('dm-state.json').playerProfiles[CHAR];
  const skills = () => JSON.parse(profiel().skillProfs || '{}');

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    const storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('dagproef', { appTitle: 'Dagproef' });

    schrijf('progression.json', {
      classes: { Rogue: { levels: {
        1: [{ name: 'Thieves’ Cant' }],
        // Een keuze die je één keer maakt, naast de dagelijkse hieronder: die
        // twee horen op verschillende plekken te staan.
        3: [{ name: 'Straatkennis', keuze: { soort: 'skill', aantal: 1, geeft: 'proficiency' } }],
      } } },
      species: {
        Githyanki: {
          levels: {
            1: [{
              name: 'Astral Knowledge',
              keuze: { soort: 'skill', aantal: 1, geeft: 'proficiency', bijRust: true, label: 'Skill van vandaag' },
            }],
          },
        },
      },
      feats: { general: [], epic: [] },
    });

    const groep = 'g_dag';
    schrijf('dm-state.json', {
      dmPassword: 'dagproef-dm',
      activeGroup: groep,
      groups: { [groep]: { name: 'Proef', password: 'proef', rustTellers: { long: 0 } } },
      playerProfiles: {
        // Stealth komt van zijn class, niet van de feature. Die mag er dus
        // nooit afvallen — dat is precies het geval waar dit over gaat.
        [CHAR]: { klasse: 'Rogue', origin: 'Githyanki', level: 3, skillProfs: '{"stealth":"prof"}', languages: 'Common' },
      },
      playerHp: {},
    });
    const ent = lees('entities.json');
    ent.personages = [{ id: CHAR, name: 'Gith Proef', subtype: 'speler', data: { groep, ras: 'Githyanki', klasse: 'Rogue' } }];
    schrijf('entities.json', ent);

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'dagproef', password: 'dagproef-dm' })).cookie;
    assert.ok(dm, 'de DM is ingelogd');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('kent het slot, met de achttien skills erbij', async () => {
    const r = await req(server, 'GET', `/api/characters/${CHAR}/keuzes`, null, dm);
    assert.equal(r.status, 200);
    const slot = r.body.slots.find(s => s.naam === 'Astral Knowledge');
    assert.ok(slot, 'Astral Knowledge staat erbij');
    assert.equal(slot.keuze.bijRust, true);
    assert.equal(slot.opties.length, 18);
  });

  it('zet wat je kiest op je blad', async () => {
    const slot = (await req(server, 'GET', `/api/characters/${CHAR}/keuzes`, null, dm)).body.slots[0];
    const r = await req(server, 'POST', `/api/characters/${CHAR}/keuzes`, { sleutel: slot.sleutel, namen: ['Arcana'] }, dm);
    assert.equal(r.status, 200);
    assert.equal(skills().arcana, 'prof');
    assert.equal(skills().stealth, 'prof', 'en wat er al stond blijft staan');
  });

  it('weigert iets dat niet in de lijst staat', async () => {
    const slot = (await req(server, 'GET', `/api/characters/${CHAR}/keuzes`, null, dm)).body.slots[0];
    const r = await req(server, 'POST', `/api/characters/${CHAR}/keuzes`, { sleutel: slot.sleutel, namen: ['Vliegen'] }, dm);
    assert.equal(r.status, 409);
    assert.equal(skills().arcana, 'prof', 'en de oude keuze blijft staan');
  });

  it('wisselen haalt de vorige eraf en zet de nieuwe erop', async () => {
    const slot = (await req(server, 'GET', `/api/characters/${CHAR}/keuzes`, null, dm)).body.slots[0];
    await req(server, 'POST', `/api/characters/${CHAR}/keuzes`, { sleutel: slot.sleutel, namen: ['Medicine'] }, dm);
    assert.ok(!skills().arcana, 'Arcana is weg');
    assert.equal(skills().medicine, 'prof');
    assert.equal(skills().stealth, 'prof');
  });

  it('een lange rust maakt hem leeg — en raakt de rest niet aan', async () => {
    const r = await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    assert.equal(r.status, 200);
    assert.ok(!skills().medicine, 'de skill van gisteren is weg');
    assert.equal(skills().stealth, 'prof', 'maar wat van zijn class komt staat er nog');
    const slots = (await req(server, 'GET', `/api/characters/${CHAR}/keuzes`, null, dm)).body.slots;
    assert.deepEqual(slots[0].gekozen, [], 'en de keuze staat weer open');
  });

  it('kiest hij een skill die hij al had, dan raakt hij die bij de rust niet kwijt', async () => {
    const slot = (await req(server, 'GET', `/api/characters/${CHAR}/keuzes`, null, dm)).body.slots[0];
    await req(server, 'POST', `/api/characters/${CHAR}/keuzes`, { sleutel: slot.sleutel, namen: ['Stealth'] }, dm);
    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    assert.equal(skills().stealth, 'prof',
      'Stealth kwam van zijn class; de feature schreef hem niet en mag hem dus ook niet weghalen');
  });

  it('noemt een keuze die nog openstaat bij de level-up, maar niet de dagelijkse', async () => {
    // **Een keuze op een feature werd alleen in de personagemaker gemaakt.**
    // Wie later een level haalt krijgt er nieuwe bij en moest zelf bedenken
    // dat ze er waren; nu staat het op zijn blad tot hij het doet. De
    // dagelijkse hoort daar níét bij: die heeft zijn eigen plek in de
    // rustoverlay, en twee herinneringen voor hetzelfde is er één te veel.
    const r = await req(server, 'GET', `/api/characters/${CHAR}/level-up`, null, dm);
    assert.equal(r.status, 200);
    const namen = (r.body.openSlots || []).map(s => s.naam);
    assert.ok(namen.includes('Straatkennis'), `openSlots: ${JSON.stringify(r.body.openSlots)}`);
    assert.ok(!namen.includes('Astral Knowledge'), 'de dagelijkse staat in de rustoverlay, niet hier');

    // Gemaakt is gemaakt: dan verdwijnt de herinnering.
    const slot = (await req(server, 'GET', `/api/characters/${CHAR}/keuzes`, null, dm))
      .body.slots.find(s => s.naam === 'Straatkennis');
    await req(server, 'POST', `/api/characters/${CHAR}/keuzes`, { sleutel: slot.sleutel, namen: ['Acrobatics'] }, dm);
    const na = await req(server, 'GET', `/api/characters/${CHAR}/level-up`, null, dm);
    assert.ok(!(na.body.openSlots || []).some(s => s.naam === 'Straatkennis'));
    assert.equal(skills().acrobatics, 'prof', 'en wat hij koos staat op zijn blad');
  });

  it('laat een andere speler er niet bij', async () => {
    const speler = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'dagproef', characterId: 'iemand-anders', password: 'proef' })).cookie;
    const r = await req(server, 'GET', `/api/characters/${CHAR}/keuzes`, null, speler);
    assert.notEqual(r.status, 200);
  });
});
