const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Het mooiste moment van de avond: iedereen stemt, niet op zichzelf, en
// niemand ziet wie op wie stemde — ook de DM niet. De winnaar krijgt Heroic
// Inspiration; een gelijke stand beslist de DM.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-stemronde-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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


const setup = (namen) => {
  const ctx = {};
  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    ctx.server = mod.server; ctx.io = mod.io;
    await new Promise(r => ctx.server.listen(0, r));
    ctx.dm = (await req(ctx.server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    const groups = (await req(ctx.server, 'GET', '/api/groups', null, ctx.dm)).body.groups || [];
    const wachtwoord = groups.find(g => g.id === 'groep1')?.password;
    ctx.spelers = [];
    for (const name of namen) {
      const id = (await req(ctx.server, 'POST', '/api/entities/personages', { name, subtype: 'speler', data: { groep: 'groep1' } }, ctx.dm)).body.id;
      const cookie = (await req(ctx.server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: id, password: wachtwoord })).cookie;
      ctx.spelers.push({ id, cookie });
    }
  });
  after(async () => {
    await ctx.io.close();
    await new Promise(r => ctx.server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });
  return ctx;
};

describe('Stemronde', () => {
  const c = setup(['Anna', 'Bram', 'Cas']);
  const api = (m, p, b) => req(c.server, m, p, b, c.dm);
  const stem = (i, op, reden) => req(c.server, 'POST', '/api/stemronde/stem', { op, reden }, c.spelers[i].cookie);

  it('opent een ronde voor de spelers van vanavond', async () => {
    const r = await api('POST', '/api/stemronde', {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.kandidaten.length, 3);
    assert.equal((await api('POST', '/api/stemronde', {})).status, 409, 'niet twee tegelijk');
  });

  it('laat niet op jezelf stemmen', async () => {
    assert.equal((await stem(0, c.spelers[0].id)).status, 400);
  });

  it('de DM stemt niet mee', async () => {
    assert.equal((await api('POST', '/api/stemronde/stem', { op: c.spelers[0].id })).status, 403);
  });

  it('verraadt nergens wie op wie stemde', async () => {
    await stem(0, c.spelers[1].id, 'Die sprong van het dak');
    const dm = JSON.stringify((await api('GET', '/api/stemronde')).body);
    const ander = JSON.stringify((await req(c.server, 'GET', '/api/stemronde', null, c.spelers[2].cookie)).body);
    for (const tekst of [dm, ander]) {
      assert.ok(!tekst.includes('Die sprong'), 'een reden komt pas bij de uitslag');
      assert.ok(!tekst.includes('stemmen'), 'de stemmen zelf gaan niet de deur uit');
    }
    const eigen = (await req(c.server, 'GET', '/api/stemronde', null, c.spelers[0].cookie)).body;
    assert.equal(eigen.mijnStem.op, c.spelers[1].id, 'je eigen stem zie je wel');
  });

  it('een gelijke stand beslist de DM', async () => {
    await stem(1, c.spelers[0].id);
    const r = await api('POST', '/api/stemronde/sluit', {});
    assert.equal(r.status, 409);
    assert.equal(r.body.gelijk.length, 2);
  });

  it('de winnaar krijgt Heroic Inspiration', async () => {
    await stem(2, c.spelers[1].id, 'Dat lied voor de draak');
    const r = await api('POST', '/api/stemronde/sluit', {});
    assert.equal(r.status, 200);
    assert.equal(r.body.winnaar.naam, 'Bram');
    assert.equal(r.body.stemmen, 2);
    assert.deepEqual([...r.body.redenen].sort(), ['Dat lied voor de draak', 'Die sprong van het dak']);
    const insp = (await api('GET', `/api/player-inspiration/${c.spelers[1].id}`)).body;
    assert.equal(insp.inspired, true);
    assert.equal((await api('GET', '/api/stemronde')).body.open, false);
  });

  it('kan afgebroken worden zonder winnaar', async () => {
    await api('POST', '/api/stemronde', {});
    assert.equal((await api('POST', '/api/stemronde/sluit', {})).status, 409, 'zonder stemmen geen uitslag');
    assert.equal((await api('POST', '/api/stemronde/sluit', { annuleer: true })).body.geannuleerd, true);
  });
});
