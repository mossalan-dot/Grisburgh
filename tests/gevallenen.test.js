const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Het partytabblad heeft een blok "Gevallenen": wie liep er met ons mee en is er
// niet meer. Het doodsvinkje staat echter op élk personage — zo houdt de DM bij
// wie er in zijn wereld gestorven is — en dat zijn vooral NPC's. Die stonden
// allemaal in dat blok, naast de levende spelers van de groep. Een gevallene is
// hier iemand die naast je stond.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-gev-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('De gevallenen van een party', () => {
  let server, io, dm, speler, npc;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    const maak = async (naam, subtype) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, subtype, data: { groep: 'groep1' } }, dm)).body.id;
    speler = await maak('Gevallen Held', 'speler');
    npc    = await maak('Dode Herbergier', 'NPC');
    for (const id of [speler, npc]) {
      await req(server, 'PUT', `/api/entities/personages/${id}/deceased`, {}, dm);
    }
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('noemt de gevallen speler', async () => {
    const r = await req(server, 'GET', '/api/party/gevallenen', null, dm);
    assert.equal(r.status, 200);
    assert.ok(r.body.some(x => x.id === speler), 'wie naast je stond hoort hier te staan');
  });

  it('laat een overleden NPC erbuiten', async () => {
    const r = await req(server, 'GET', '/api/party/gevallenen', null, dm);
    assert.ok(!r.body.some(x => x.id === npc),
      'het doodsvinkje van een NPC is de boekhouding van de DM, geen verlies van de party');
  });
});
