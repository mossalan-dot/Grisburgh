const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Bereikbaarheid volgt de akte: wat in de stad staat is bereikbaar tijdens een
// stads-akte, wat elders staat tijdens een andere. Per akte bewaren we wat er
// NIET bereikbaar is; de handmatige knop "Grisburgh verlaten" blijft als
// overschrijving bestaan.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-ber-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url  = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: {} };
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

describe('Bereikbaarheid per akte', () => {
  let server, io, dm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { password: 'grisburgh-dm' })).cookie;
    await req(server, 'PUT', '/api/meta/hoofdstuk/h1', { num: 1, title: 'In de stad' }, dm);
    await req(server, 'PUT', '/api/meta/hoofdstuk/h2', { num: 2, title: 'Het Amberwoud' }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const meta = async () => (await req(server, 'GET', '/api/meta', null, dm)).body;

  it('heeft standaard alles open', async () => {
    const b = (await meta()).bereikbaarheid;
    assert.deepEqual(b.dienstenDicht, []);
    assert.equal(b.allesDicht, false);
  });

  it('sluit alleen wat in de lopende akte is uitgevinkt', async () => {
    await req(server, 'PUT', '/api/meta/akte/h2/bereikbaarheid',
      { diensten: ['tempel', 'magizoo'], entiteiten: ['e_winkel_1'] }, dm);
    // Zolang die akte niet gespeeld wordt, verandert er niets.
    let b = (await meta()).bereikbaarheid;
    assert.deepEqual(b.dienstenDicht, []);
    // Akte h2 starten voor de actieve groep.
    await req(server, 'POST', '/api/akte/actief', { key: 'h2', num: 2, title: 'Het Amberwoud' }, dm);
    b = (await meta()).bereikbaarheid;
    assert.deepEqual(b.dienstenDicht.sort(), ['magizoo', 'tempel']);
    assert.deepEqual(b.entiteitenDicht, ['e_winkel_1']);
  });

  it('negeert een dienst die niet bestaat', async () => {
    await req(server, 'PUT', '/api/meta/akte/h2/bereikbaarheid', { diensten: ['tempel', 'zwembad'] }, dm);
    const b = (await meta()).bereikbaarheid;
    assert.deepEqual(b.dienstenDicht, ['tempel']);
  });

  it('laat de handmatige knop alles overrulen', async () => {
    await req(server, 'PUT', '/api/locatie', { buitenGrisburgh: true }, dm);
    const b = (await meta()).bereikbaarheid;
    assert.equal(b.allesDicht, true, 'buiten de stad is alles dicht, ongeacht de akte');
    await req(server, 'PUT', '/api/locatie', { buitenGrisburgh: false }, dm);
  });

  it('bewaart een verdieping op een dungeonkaart en negeert onzin', async () => {
    const map = (await req(server, 'POST', '/api/dungeons', { name: 'Kelder' }, dm)).body;
    await req(server, 'PUT', `/api/dungeons/${map.id}`, { verdieping: -1 }, dm);
    let na = (await req(server, 'GET', '/api/dungeons', null, dm)).body.find(m => m.id === map.id);
    assert.equal(na.verdieping, -1);
    // Leeggemaakt betekent: deze kaart hoort niet bij een gebouw met verdiepingen.
    await req(server, 'PUT', `/api/dungeons/${map.id}`, { verdieping: null }, dm);
    na = (await req(server, 'GET', '/api/dungeons', null, dm)).body.find(m => m.id === map.id);
    assert.equal(na.verdieping, undefined);
  });

  it('houdt de instelling van de laatste akte aan', async () => {
    // activeAkte wordt nooit leeggemaakt: er verandert pas iets bij de volgende akte.
    const b = (await meta()).bereikbaarheid;
    assert.equal(b.akte, 'h2', 'de laatst gespeelde akte blijft gelden');
    await req(server, 'POST', '/api/akte/actief', { key: 'h1', num: 1, title: 'In de stad' }, dm);
    const na = (await meta()).bereikbaarheid;
    assert.deepEqual(na.dienstenDicht, [], 'de stads-akte heeft niets dichtstaan');
  });
});
