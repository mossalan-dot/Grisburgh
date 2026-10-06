const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// ════════════════════════════════════════════════════════════════════════════
//  EEN EIGEN CLASS BEGINNEN
// ════════════════════════════════════════════════════════════════════════════
// `POST /progression/feature` kon een **level** aanmaken maar geen class: was de
// class, het species of de background er niet, dan kwam er een 400. Je kon dus
// features hangen aan wat er al was, en nooit een eigen orde of een eigen volk
// beginnen — terwijl dat juist is wat een campagne met eigen materiaal wil.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-eigen-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        let parsed; try { parsed = JSON.parse(d); } catch { parsed = d; }
        resolve({ status: res.statusCode, body: parsed, cookie: sc ? sc[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}

describe('Eigen class, species of background', () => {
  let server, io, dm;
  const prog = () => JSON.parse(fs.readFileSync(
    path.join(DATA_DIR, 'campaigns', 'grisburgh', 'progression.json'), 'utf8'));

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    assert.ok(dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const voeg = (body) => req(server, 'POST', '/api/progression/feature', body, dm);

  it('legt een class aan die er nog niet was', async () => {
    const r = await voeg({ soort: 'class', bron: 'Artificer', level: 1, naam: 'Magical Tinkering', desc: '' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const cls = prog().classes.Artificer;
    assert.ok(cls, 'de class staat er');
    assert.equal(cls.levels['1'][0].name, 'Magical Tinkering');
    assert.deepEqual(cls.subclasses, {}, 'met een lege plek voor subclasses');
  });

  it('legt een subclass aan onder een bestaande class', async () => {
    const r = await voeg({ soort: 'subclass', bron: 'Artificer', sub: 'Armorer', level: 3, naam: 'Arcane Armor', desc: '' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(prog().classes.Artificer.subclasses.Armorer.levels['3'][0].name, 'Arcane Armor');
  });

  it('legt een species en een background aan', async () => {
    assert.equal((await voeg({ soort: 'species', bron: 'Leemlander', level: 1, naam: 'Kleivoet', desc: '' })).status, 200);
    assert.equal((await voeg({ soort: 'background', bron: 'Veerman', level: 1, naam: 'Vaarbewijs', desc: '' })).status, 200);
    assert.ok(prog().species.Leemlander);
    assert.ok(prog().backgrounds.Veerman);
  });

  it('maakt niets aan zonder naam voor de class', async () => {
    const voor = Object.keys(prog().classes).length;
    const r = await voeg({ soort: 'class', bron: '', level: 1, naam: 'Zwevend', desc: '' });
    assert.equal(r.status, 400, 'zonder bron valt er niets te maken');
    assert.equal(Object.keys(prog().classes).length, voor, 'en er is niets bijgekomen');
  });

  it('voegt niets toe bij het alleen lézen van een onbekende class', async () => {
    // `_vaardigLijst` zonder `maken` mag nooit stilletjes iets aanleggen: dat
    // zou een typefout in een filter tot een nieuwe class promoveren.
    const voor = Object.keys(prog().classes).length;
    await req(server, 'GET', '/api/progression', null, dm);
    assert.equal(Object.keys(prog().classes).length, voor);
  });
});
