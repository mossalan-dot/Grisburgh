const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De dungeonkaart heeft twee dingen die per party verschillen: of je de kaart
// überhaupt ziet, en welke kamers voor jóúw party open zijn. Dat laatste is een
// keer misgegaan — de naam van elke kamer stond in de payload, dus wie in de
// netwerktab keek las "Schatkelder" voordat zijn personage er geweest was. De
// vórm moet wel mee, want daar tekent de client de mist mee. Die twee assen
// staan hier vast.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-dungeon-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Dungeonkaarten: toegang, mist en kamers', () => {
  let server, io, dm, gid, gid2, speler, spelerC, mapId;

  const KAMERS = [
    { id: 'k1', name: 'Wachtkamer',  shape: 'rechthoek', points: [{ x: 10, y: 10 }, { x: 30, y: 30 }],
      dmNotes: 'Twee slapende wachters.', conditions: [{ icon: 'skull', visible: true }] },
    { id: 'k2', name: 'Schatkelder', shape: 'ovaal', points: [{ x: 50, y: 50 }, { x: 70, y: 70 }],
      dmNotes: 'Hier ligt de kroon.', conditions: [{ icon: 'coins', visible: false }] },
  ];

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    const tweede = (await req(server, 'POST', '/api/groups', { name: 'Andere party' }, dm)).body;
    gid2 = tweede?.id || tweede?.group?.id;

    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Verkenner', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;

    const maak = await req(server, 'POST', '/api/dungeons',
      { name: 'De Oude Kelders', description: 'Onder het weeshuis.' }, dm);
    assert.ok(maak.status === 200 || maak.status === 201, JSON.stringify(maak.body));
    mapId = maak.body.id || maak.body.map?.id;
    await req(server, 'PUT', `/api/dungeons/${mapId}/rooms`, { rooms: KAMERS, connections: [] }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const alsSpeler = async () => (await req(server, 'GET', '/api/dungeons', null, spelerC)).body;
  const alsDm     = async () => (await req(server, 'GET', '/api/dungeons', null, dm)).body;

  it('toont een kaart pas als de party er toegang toe heeft', async () => {
    assert.deepStrictEqual(await alsSpeler(), [], 'zonder toegang bestaat de kaart niet');

    const r = await req(server, 'POST', `/api/dungeons/${mapId}/grant-access`, { groupId: gid }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const zicht = await alsSpeler();
    assert.strictEqual(zicht.length, 1);
    assert.strictEqual(zicht[0].name, 'De Oude Kelders');
  });

  it('stuurt de vorm van een kamer mee, maar niet de naam', async () => {
    const kaart = (await alsSpeler())[0];
    assert.strictEqual(kaart.rooms.length, 2, 'alle kamers komen mee — daar tekent de mist op');
    for (const r of kaart.rooms) {
      assert.strictEqual(r.name, '', 'een onontdekte kamer geeft zijn naam niet prijs');
      assert.ok(Array.isArray(r.points) && r.points.length, 'de vorm moet wél mee');
      assert.deepStrictEqual(r.conditions, [], 'en zijn merktekens ook niet');
    }
  });

  it('geeft de aantekening van de DM nooit aan een speler', async () => {
    const kaart = (await alsSpeler())[0];
    const alles = JSON.stringify(kaart);
    assert.ok(!alles.includes('slapende wachters'), 'DM-notities horen niet in de payload');
    assert.ok(!alles.includes('kroon'));
  });

  it('onthult per kamer én per party', async () => {
    const r = await req(server, 'POST', `/api/dungeons/${mapId}/reveal`,
      { roomId: 'k1', groupId: gid }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const kamers = (await alsSpeler())[0].rooms;
    const k1 = kamers.find(x => x.id === 'k1');
    const k2 = kamers.find(x => x.id === 'k2');
    assert.strictEqual(k1.name, 'Wachtkamer', 'wat je gezien hebt, heet weer iets');
    assert.deepStrictEqual(k1.conditions, [{ icon: 'skull', visible: true }],
      'zichtbare merktekens komen mee zodra de kamer open is');
    assert.strictEqual(k2.name, '', 'de kelder blijft dicht');

    // De andere party weet van niets — ook niet van de kaart zelf.
    const kaartDm = (await alsDm()).find(m => m.id === mapId);
    assert.deepStrictEqual(kaartDm.reveals?.[gid2] || [], [], 'de tweede party heeft niets open');
  });

  it('toont een verborgen merkteken niet, ook niet in een onthulde kamer', async () => {
    await req(server, 'POST', `/api/dungeons/${mapId}/reveal`, { roomId: 'k2', groupId: gid }, dm);
    const k2 = (await alsSpeler())[0].rooms.find(x => x.id === 'k2');
    assert.strictEqual(k2.name, 'Schatkelder');
    assert.deepStrictEqual(k2.conditions, [], 'een merkteken dat de DM verborgen houdt blijft weg');
  });

  it('draait een onthulling terug', async () => {
    const r = await req(server, 'DELETE', `/api/dungeons/${mapId}/reveal`,
      { roomId: 'k2', groupId: gid }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const k2 = (await alsSpeler())[0].rooms.find(x => x.id === 'k2');
    assert.strictEqual(k2.name, '', 'weer dicht');
  });

  it('vraagt om roomId én groupId', async () => {
    for (const body of [{ roomId: 'k1' }, { groupId: gid }, {}]) {
      const r = await req(server, 'POST', `/api/dungeons/${mapId}/reveal`, body, dm);
      assert.strictEqual(r.status, 400, JSON.stringify(body) + ' hoort geweigerd te worden');
    }
  });

  it('zet toegang per party ineens, en onthoudt wie hem uitgespeeld heeft', async () => {
    const r = await req(server, 'PUT', `/api/dungeons/${mapId}/party-access`,
      { partyAccess: [gid, gid2], partyCompleted: [gid2] }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const kaart = (await alsDm()).find(m => m.id === mapId);
    assert.deepStrictEqual([...kaart.partyAccess].sort(), [gid, gid2].sort());
    assert.deepStrictEqual(kaart.partyCompleted, [gid2]);

    const fout = await req(server, 'PUT', `/api/dungeons/${mapId}/party-access`,
      { partyAccess: 'groep1' }, dm);
    assert.strictEqual(fout.status, 400, 'een string is geen lijst party-ids');
  });

  it('haalt de toegang weer weg', async () => {
    await req(server, 'PUT', `/api/dungeons/${mapId}/party-access`,
      { partyAccess: [], partyCompleted: [] }, dm);
    assert.deepStrictEqual(await alsSpeler(), [], 'zonder toegang is de kaart weer weg');
  });

  it('verwijdert de kaart met kamers en al', async () => {
    const r = await req(server, 'DELETE', `/api/dungeons/${mapId}`, null, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(!(await alsDm()).some(m => m.id === mapId), 'de kaart is weg');

    const nogEens = await req(server, 'POST', `/api/dungeons/${mapId}/reveal`,
      { roomId: 'k1', groupId: gid }, dm);
    assert.strictEqual(nogEens.status, 404, 'en er valt niets meer op te onthullen');
  });

  it('maakt geen kaart zonder naam', async () => {
    const r = await req(server, 'POST', '/api/dungeons', { description: 'naamloos' }, dm);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
  });
});
