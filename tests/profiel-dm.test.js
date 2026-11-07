// Level en class zet de DM (antwoord op de spelersronde van 7 nov 2026).
// Een speler kon op zijn Personage-tab zijn eigen level en class omzetten en
// zichzelf level 20 geven. Een subclass kiest hij wél zelf — één keer.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-profiel-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    let json = null;
    if (body) { json = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; opts.headers['Content-Length'] = Buffer.byteLength(json); }
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { let b; try { b = JSON.parse(data); } catch { b = data; } const sc = res.headers['set-cookie']; resolve({ status: res.statusCode, body: b, cookie: sc ? sc[0].split(';')[0] : cookie }); });
    });
    r.on('error', reject); if (json) r.write(json); r.end();
  });
}

describe('Profiel: wat een speler zelf mag zetten', () => {
  let server, io, dm, speler, pc;
  const zet = (body, wie) => req(server, 'PATCH', `/api/player-profile/${pc.id}`, body, wie);

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    ({ server, io } = require('../server'));
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    pc = (await req(server, 'POST', '/api/entities/personages', { name: 'Marelle', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body;
    speler = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: pc.id })).cookie;
    await zet({ level: '3', klasse: 'Cleric' }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('weigert een speler die zijn level of class omzet', async () => {
    assert.strictEqual((await zet({ level: '20' }, speler)).status, 403);
    assert.strictEqual((await zet({ klasse: 'Wizard' }, speler)).status, 403);
    assert.strictEqual((await zet({ multiclass: 'true' }, speler)).status, 403);
    const p = (await req(server, 'GET', `/api/player-profile/${pc.id}`, null, speler)).body;
    assert.strictEqual(String(p.level), '3');
    assert.strictEqual(p.klasse, 'Cleric');
  });

  it('laat een ongewijzigde waarde en andere velden gewoon door', async () => {
    assert.strictEqual((await zet({ level: '3' }, speler)).status, 200);
    assert.strictEqual((await zet({ background: 'Acolyte' }, speler)).status, 200);
  });

  it('een subclass kiest de speler één keer; daarna alleen de DM', async () => {
    assert.strictEqual((await zet({ subclass: 'Life Domain' }, speler)).status, 200);
    assert.strictEqual((await zet({ subclass: 'War Domain' }, speler)).status, 403);
    assert.strictEqual((await zet({ subclass: 'War Domain' }, dm)).status, 200);
  });

  it('de DM zet level en class', async () => {
    assert.strictEqual((await zet({ level: '4', klasse: 'Cleric' }, dm)).status, 200);
  });
});
