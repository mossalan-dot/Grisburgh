const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

// #45: dekt de critical-categorie — een speler mag de data van een andere
// speler niet lezen/schrijven, anonieme requests worden geweigerd, en
// numerieke velden worden geclampd. Geïsoleerd in een tmpdir (#47).
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-pauth-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Player-scoped auth', () => {
  let server, io, dmCookie, A, B, cookieA, cookieB;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dmCookie = (await req(server, 'POST', '/api/auth/login', { password: 'grisburgh-dm' })).cookie;
    const mkPlayer = async (name) => {
      const c = await req(server, 'POST', '/api/entities/personages', { name, subtype: 'speler', data: { groep: 'groep1' } }, dmCookie);
      const login = await req(server, 'POST', '/api/auth/player-login', { characterId: c.body.id });
      return { id: c.body.id, cookie: login.cookie };
    };
    const pa = await mkPlayer('Speler A'); A = pa.id; cookieA = pa.cookie;
    const pb = await mkPlayer('Speler B'); B = pb.id; cookieB = pb.cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('logt beide spelers succesvol in', () => {
    assert.ok(cookieA && cookieB && cookieA !== cookieB);
  });

  // ── HP ──
  it('speler mag eigen HP lezen', async () => {
    const res = await req(server, 'GET', `/api/player-hp/${A}`, null, cookieA);
    assert.strictEqual(res.status, 200);
  });

  it('speler mag HP van een ander NIET lezen', async () => {
    const res = await req(server, 'GET', `/api/player-hp/${B}`, null, cookieA);
    assert.strictEqual(res.status, 403);
  });

  it('anonieme request mag HP NIET lezen', async () => {
    const res = await req(server, 'GET', `/api/player-hp/${A}`);
    assert.strictEqual(res.status, 403);
  });

  it('speler mag HP van een ander NIET patchen', async () => {
    const res = await req(server, 'PATCH', `/api/player-hp/${B}`, { current: 999 }, cookieA);
    assert.strictEqual(res.status, 403);
  });

  // ── Currency (PATCH is DM-only) ──
  it('speler mag currency NIET patchen (ook niet de eigen)', async () => {
    const res = await req(server, 'PATCH', `/api/player-currency/${A}`, { fl: 9999 }, cookieA);
    assert.strictEqual(res.status, 403);
  });

  it('DM mag currency patchen', async () => {
    const res = await req(server, 'PATCH', `/api/player-currency/${A}`, { fl: 10 }, dmCookie);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.fl, 10);
  });

  it('currency wordt geclampd op >= 0', async () => {
    const res = await req(server, 'PATCH', `/api/player-currency/${A}`, { fl: -50 }, dmCookie);
    assert.strictEqual(res.body.fl, 0);
  });

  // ── Spellslots (clamp max op 4) ──
  it('spellslot max wordt geclampd op 4', async () => {
    const res = await req(server, 'PUT', `/api/player-spellslots/${A}`, { 1: { max: 99, used: 0 } }, cookieA);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body['1'].max, 4);
  });

  it('speler mag spellslots van een ander NIET zetten', async () => {
    const res = await req(server, 'PUT', `/api/player-spellslots/${B}`, { 1: { max: 2, used: 0 } }, cookieA);
    assert.strictEqual(res.status, 403);
  });

  // ── Item-qty (#25 regressie) ──
  it('anonieme request mag item-qty NIET patchen', async () => {
    const res = await req(server, 'PATCH', `/api/items/FAKE/owner/${A}`, { delta: -1 });
    assert.strictEqual(res.status, 403);
  });

  it('speler mag item-qty van een ander NIET patchen', async () => {
    const res = await req(server, 'PATCH', `/api/items/FAKE/owner/${B}`, { delta: -1 }, cookieA);
    assert.strictEqual(res.status, 403);
  });
});
