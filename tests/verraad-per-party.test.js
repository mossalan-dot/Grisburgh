const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Een verraad dat déze party nog niet ontdekt heeft, ziet ze ook niet.**
// Een geheimregel kan de vlag `antagonist` dragen: onthult een party die regel,
// dan wordt het kaartje een antagonist — rol, kant en alignment schuiven mee.
// Maar die velden staan in `entities.json`, en dat is van de hele campagne,
// terwijl onthullen per party gaat. Party A ontmaskerde hem dus en party B zag
// de rode badge staan zonder te weten waarom.
//
// De reparatie zit in `filterEntityForPlayer` en niet in de schrijfkant: de DM
// moet wél zien wie hij geworden is. Twee kaartjes in Grisburgh dragen die
// vlag, dus dit is geen theorie.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-verraad-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    if (body) {
      const json = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(json);
    }
    if (cookie) opts.headers['Cookie'] = cookie;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        let b; try { b = JSON.parse(data); } catch { b = data; }
        resolve({ status: res.statusCode, body: b, cookie: sc ? sc[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const rollen = (e) => { try { return JSON.parse(e?.data?.tags || '[]'); } catch { return []; } };

describe('Een verraad is per party', () => {
  let server, io, dm, gidA, gidB, speelA, speelB, sessieA, sessieB, waard;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const maakGroep = async (naam, ww) => {
      await req(server, 'POST', '/api/groups', { name: naam, password: ww }, dm);
      return (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === naam).id;
    };
    gidA = await maakGroep('Tafel A', 'tafel-a');
    gidB = await maakGroep('Tafel B', 'tafel-b');
    const maakSpeler = async (naam, groep) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, subtype: 'speler', data: { groep } }, dm)).body.id;
    speelA = await maakSpeler('Anne', gidA);
    speelB = await maakSpeler('Boris', gidB);

    // Een waard met één geheim dat hem ontmaskert.
    waard = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Bram Kruik',
      data: {
        kant: 'bondgenoot',
        geheimen: JSON.stringify([{ id: 'g1', tekst: 'Hij werkt voor de Heeren.', antagonist: true }]),
      },
    }, dm)).body.id;

    // Allebei de tafels kennen hem.
    for (const gid of [gidA, gidB]) {
      await req(server, 'PUT', '/api/groups/active', { groupId: gid }, dm);
      await req(server, 'PUT', `/api/entities/personages/${waard}/visibility`, { target: 'visible' }, dm);
    }
    // Alleen tafel A ontmaskert hem.
    await req(server, 'PUT', '/api/groups/active', { groupId: gidA }, dm);
    // Let op: `gid` in deze route is het id van de **geheimregel**, niet van de
    // groep — de party is de actieve groep, die hierboven op A staat. En het is
    // een schakelaar: één aanroep zet hem open.
    const ont = await req(server, 'PUT', `/api/entities/personages/${waard}/secret`,
      { gid: 'g1' }, dm);
    assert.strictEqual(ont.status, 200, JSON.stringify(ont.body));

    const inloggen = async (id, ww) => (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: id, password: ww })).cookie;
    sessieA = await inloggen(speelA, 'tafel-a');
    sessieB = await inloggen(speelB, 'tafel-b');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const haal = async (sessie) => (await req(server, 'GET', `/api/entities/personages/${waard}`, null, sessie)).body;

  it('toont de antagonist aan de tafel die hem ontmaskerde', async () => {
    const e = await haal(sessieA);
    assert.ok(rollen(e).includes('antagonist'), 'tafel A weet het, dus ziet het');
    assert.match(JSON.stringify(e.data.geheimen || ''), /Heeren/, 'en leest het geheim');
  });

  it('verzwijgt hem voor de tafel die van niets weet', async () => {
    const e = await haal(sessieB);
    assert.ok(!rollen(e).includes('antagonist'),
      'tafel B heeft niets onthuld en hoort dus geen rode badge te zien');
    assert.notStrictEqual(e.data.kant, 'vijand', 'en hij staat voor hen niet aan de andere kant');
    assert.ok(!JSON.stringify(e.data.geheimen || '').includes('Heeren'), 'het geheim zelf al helemaal niet');
  });

  it('laat de administratie van het verraad nooit zien', async () => {
    for (const s of [sessieA, sessieB]) {
      const e = await haal(s);
      assert.strictEqual(e.data.kantVoorVerraad, undefined,
        'dát dit veld bestaat verklapt al dat er iets te ontmaskeren valt');
      assert.strictEqual(e.data.alignmentVoorVerraad, undefined);
    }
  });

  it('laat de DM wél zien wie hij geworden is', async () => {
    const e = (await req(server, 'GET', `/api/entities/personages/${waard}`, null, dm)).body;
    assert.ok(rollen(e).includes('antagonist'), 'de DM kijkt niet door de spelersfilter');
  });

  it('laat een antagonist die de DM zelf aanzette met rust', async () => {
    const bandiet = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Messen Jochem', data: { tags: JSON.stringify(['antagonist']) } }, dm)).body.id;
    await req(server, 'PUT', '/api/groups/active', { groupId: gidB }, dm);
    await req(server, 'PUT', `/api/entities/personages/${bandiet}/visibility`, { target: 'visible' }, dm);
    const e = (await req(server, 'GET', `/api/entities/personages/${bandiet}`, null, sessieB)).body;
    assert.ok(rollen(e).includes('antagonist'),
      'zonder geheimvlag is de rol een keuze van de DM, geen gevolg — die blijft staan');
  });
});
