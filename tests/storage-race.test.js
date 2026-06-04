const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

// #45/#20: 50 gelijktijdige read-modify-write requests naar dm-state mogen
// geen updates verliezen. Dit houdt omdat de route-handlers synchroon zijn
// (readFileSync → muteer → writeFileSync zonder await ertussen): Node's
// event-loop verwerkt ze atomair. De test bewaakt tegen een regressie waarbij
// iemand een `await` tussen lezen en schrijven introduceert.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-race-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: {} };
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
        const setCookie = res.headers['set-cookie'];
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, cookie: setCookie ? setCookie[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

describe('Storage concurrency', () => {
  let server, io, dmCookie, charId, cookie;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dmCookie = (await req(server, 'POST', '/api/auth/login', { password: 'grisburgh-dm' })).cookie;
    const c = await req(server, 'POST', '/api/entities/personages', { name: 'Racer', subtype: 'speler', data: { groep: 'groep1' } }, dmCookie);
    charId = c.body.id;
    cookie = (await req(server, 'POST', '/api/auth/player-login', { characterId: charId })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('50 gelijktijdige trait-POSTs verliezen geen updates', async () => {
    const N = 50;
    const posts = Array.from({ length: N }, (_, i) =>
      req(server, 'POST', `/api/player-traits/${charId}`, {
        name: `Trait ${i}`, index: `race-${i}`, source: 'test',
      }, cookie)
    );
    const results = await Promise.all(posts);
    assert.strictEqual(results.filter(r => r.status === 200).length, N, 'alle POSTs moeten 200 geven');

    const list = await req(server, 'GET', `/api/player-traits/${charId}`, null, cookie);
    assert.strictEqual(list.body.length, N, `verwacht ${N} traits, kreeg ${list.body.length} (lost update!)`);

    const indices = new Set(list.body.map(t => t.index));
    assert.strictEqual(indices.size, N, 'alle indices moeten uniek bewaard zijn');
  });
});
