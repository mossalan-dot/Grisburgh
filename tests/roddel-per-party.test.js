// **Een roddel is van jóuw party.**
//
// "Al verteld" stond ooit op het kaartje zelf (`data.flavoursUitgesproken`) en
// gold dus voor de hele campagne: hoorde party 1 iets in de herberg, dan was
// diezelfde roddel voor party 2 verbruikt zonder dat die hem ooit gehoord had.
// Sindsdien staat de stand per party in `groups[gid].flavourReveals`, met het
// oude veld als terugval zodat niemand kwijtraakt wat hij al hoorde.
//
// Dat stond nergens in een toets. Erger: de toets die er wél over ging —
// *vertelt in de herberg alleen roddels over wie de party kent* in
// `winkel-en-rust.test.js` — controleert dat het **oude** veld leeg blijft, en
// dat is sinds de verhuizing altijd zo. Hij slaagt dus om de verkeerde reden.
// Vandaar deze: op de stand die er nu toe doet, aan twee tafels tegelijk.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-roddel-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Een roddel is van jouw party', () => {
  let server, io, dm, gidA, gidB, waard;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const maak = async (naam, ww) => {
      await req(server, 'POST', '/api/groups', { name: naam, password: ww }, dm);
      return (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === naam).id;
    };
    gidA = await maak('Tafel A', 'tafel-a');
    gidB = await maak('Tafel B', 'tafel-b');
    for (const [gid, naam] of [[gidA, 'Anne'], [gidB, 'Boris']]) {
      await req(server, 'POST', '/api/entities/personages',
        { name: naam, subtype: 'speler', data: { groep: gid } }, dm);
    }

    waard = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Brÿlwaen',
      data: { flavours: JSON.stringify([
        'Ze schenkt haar eigen bier nooit.',
        'Er staat een kist onder de tap.',
        'Haar broer kwam nooit terug van zee.',
      ]) },
    }, dm)).body.id;
    for (const gid of [gidA, gidB]) {
      await req(server, 'PUT', '/api/groups/active', { groupId: gid }, dm);
      await req(server, 'PUT', `/api/entities/personages/${waard}/visibility`, { target: 'visible' }, dm);
    }
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  // **Let op `gid`.** Bij `PUT .../secret` is dat de **regel**-id; bij
  // `PUT .../flavour` is het de **groep**-id, en wijst `index` de regel aan.
  // Twee routes die vlak naast elkaar leven en hetzelfde woord anders
  // gebruiken — de eerste versie van deze toets trapte erin en onthulde bij
  // een groep die niet bestond.
  const onthul = (gid, index) =>
    req(server, 'PUT', `/api/entities/personages/${waard}/flavour`, { gid, index }, dm);
  const stand = async (gid) => {
    await req(server, 'PUT', '/api/groups/active', { groupId: gid }, dm);
    const e = (await req(server, 'GET', `/api/entities/personages/${waard}`, null, dm)).body;
    return e;
  };

  // `_roddels` is een regel per roddel mét de stand erbij (`gehoord`), niet
  // een lijst van wat open staat — de DM ziet álle regels, en dit zegt alleen
  // in welke staat ze voor déze party verkeren.
  const open = (e) => (e._roddels || []).filter(r => r.gehoord).map(r => r.id);

  it('laat een roddel die tafel A hoorde nog nieuw zijn voor tafel B', async () => {
    const r = await onthul(gidA, 0);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.deepStrictEqual(r.body.uitgesproken, [true, false, false], 'de eerste staat open');

    assert.strictEqual(open(await stand(gidA)).length, 1, 'tafel A heeft er één gehoord');
    assert.deepStrictEqual(open(await stand(gidB)), [],
      'tafel B heeft niets gehoord — "al verteld" gold ooit voor de hele campagne');
  });

  it('schrijft hem niet in het oude campagnebrede veld', async () => {
    // Dit is de reden dat de oude toets leeg was: de server raakt dit veld
    // niet meer aan. Hier staat het als bewering, niet als bewijs.
    const a = await stand(gidA);
    assert.ok(!a.data.flavoursUitgesproken,
      'de stand hoort bij de party te staan, niet op het kaartje');
  });

  it('houdt de twee tafels uit elkaar als allebei iets horen', async () => {
    const r = await onthul(gidB, 1);
    assert.deepStrictEqual(r.body.uitgesproken, [false, true, false],
      'tafel B hoorde de tweede, en niet de eerste die tafel A hoorde');

    const a = open(await stand(gidA)), b = open(await stand(gidB));
    assert.strictEqual(a.length, 1);
    assert.strictEqual(b.length, 1);
    assert.notDeepStrictEqual(a, b, 'twee tafels, twee standen');
  });

  it('draait een onthulling terug zonder de andere tafel te raken', async () => {
    // De route is een wisselknop, net als bij een geheim.
    const r = await onthul(gidA, 0);
    assert.deepStrictEqual(r.body.uitgesproken, [false, false, false]);
    assert.deepStrictEqual(open(await stand(gidA)), []);
    assert.strictEqual(open(await stand(gidB)).length, 1, 'tafel B blijft waar hij was');
  });
});
