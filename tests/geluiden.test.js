const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De geluidsinstellingen van een campagne. Alles loopt via één PUT die per blok
// samenvoegt — en juist een campagne die er nog nooit iets had, heeft die
// blokken niet in `sounds.json` staan. Dat is precies de eerste keer dat je er
// een instelt, dus die stand hoort getoetst te zijn.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-geluiden-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Geluiden: instellen in een verse campagne', () => {
  let server, io, dm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('zet een standaardgeluid ook als dat blok nog niet bestond', async () => {
    const r = await req(server, 'PUT', '/api/sounds', { standard: { damage: 'snd_een' } }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const na = await req(server, 'GET', '/api/sounds', null, dm);
    assert.strictEqual(na.body.standard.damage, 'snd_een');
  });

  it('zet een conditie- en een momentgeluid, en laat de rest staan', async () => {
    await req(server, 'PUT', '/api/sounds', { conditions: { poisoned: 'snd_gif' } }, dm);
    await req(server, 'PUT', '/api/sounds', { momenten: { lootReveal: 'snd_kist' } }, dm);
    const na = await req(server, 'GET', '/api/sounds', null, dm);
    assert.strictEqual(na.body.conditions.poisoned, 'snd_gif');
    assert.strictEqual(na.body.momenten.lootReveal, 'snd_kist');
    assert.strictEqual(na.body.standard.damage, 'snd_een', 'het eerder gezette geluid blijft staan');
  });

  it('haalt een geluid er ook weer af', async () => {
    await req(server, 'PUT', '/api/sounds', { standard: { damage: null } }, dm);
    const na = await req(server, 'GET', '/api/sounds', null, dm);
    assert.strictEqual(na.body.standard.damage, null);
  });
});
