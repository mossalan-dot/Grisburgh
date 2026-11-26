const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Een figurine ís een metgezel in de vorm van een beeldje.** Oproepen liep
// alleen via een spreuk of een class-feature; wie het beeldje had, had niets —
// de DM moest het wezen met de hand op de kaart zetten. Nu draagt het kaartje
// `data.metgezel` (de SRD-preset vult hem bij de tien figurines en Staff of the
// Woodlands) en mag wie het **bezit** hem oproepen.
//
// Bezit staat per party, dus de twee dingen die hier vastliggen: je krijgt hem
// alleen als je hem hebt, en de bezitslijst die telt is die van jouw tafel.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-figurine-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Een voorwerp dat iemand oproept', () => {
  let server, io, dm, held, maat, sessie, sessieMaat, beeldje;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    await req(server, 'POST', '/api/groups', { name: 'De Tafel', password: 'tafel' }, dm);
    const gid = (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === 'De Tafel').id;
    const maak = async (naam) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    held = await maak('Wilmer');
    maat = await maak('Rozemarijn');

    beeldje = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Onyx Dog', data: { itemType: 'Wondrous item', metgezel: 'Mastiff' } }, dm)).body.id;
    await req(server, 'PUT', `/api/items/${beeldje}/owner`,
      { characterId: held, playerName: 'Wilmer', groupId: gid, qty: 1 }, dm);

    const inloggen = async (id) => (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: id, password: 'tafel' })).cookie;
    sessie = await inloggen(held);
    sessieMaat = await inloggen(maat);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('biedt het wezen aan wie het beeldje heeft', async () => {
    const r = await req(server, 'GET', `/api/characters/${held}/summons`, null, sessie);
    assert.strictEqual(r.status, 200);
    const hond = (r.body.aanbod || []).find(a => a.id === `voorwerp:${beeldje}`);
    assert.ok(hond, 'het beeldje staat in zijn aanbod: ' + JSON.stringify(r.body.aanbod || []).slice(0, 200));
    assert.strictEqual(hond.naam, 'Mastiff');
    assert.strictEqual(hond.geeft, 'Onyx Dog', 'en zegt waar hij vandaan komt');
    assert.ok(hond.bekend, 'zijn statblok staat in de SRD-bron, dus één klik is genoeg');
  });

  it('biedt hem niet aan wie het niet heeft', async () => {
    const r = await req(server, 'GET', `/api/characters/${maat}/summons`, null, sessieMaat);
    assert.ok(!(r.body.aanbod || []).some(a => a.id === `voorwerp:${beeldje}`),
      'zij heeft het beeldje niet, dus staat het niet in haar aanbod');
  });

  it('roept hem ook echt op', async () => {
    const r = await req(server, 'POST', `/api/characters/${held}/summons`,
      { metgezelId: `voorwerp:${beeldje}`, vorm: 'Mastiff', naam: 'Brak' }, sessie);
    assert.strictEqual(r.status, 201, 'oproepen maakt iets nieuws, dus 201: ' + JSON.stringify(r.body).slice(0, 120));
    const na = await req(server, 'GET', `/api/characters/${held}/summons`, null, sessie);
    const brak = (na.body.summons || []).find(s => s.naam === 'Brak');
    assert.ok(brak, 'hij staat in het blok Opgeroepen — gekregen: ' + JSON.stringify(na.body.summons || []).slice(0, 200));
    assert.ok(brak.maxHp > 0, 'met de cijfers van de Mastiff uit de SRD-bron');
  });

  it('weigert iemand die het beeldje niet heeft', async () => {
    const r = await req(server, 'POST', `/api/characters/${maat}/summons`,
      { metgezelId: `voorwerp:${beeldje}`, vorm: 'Mastiff' }, sessieMaat);
    assert.strictEqual(r.status, 409, 'dat kun jij niet oproepen');
  });
});
