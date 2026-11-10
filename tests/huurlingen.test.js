const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { io: ioClient } = require('socket.io-client');

// Huurlingen: een medestander met een dagloon. Het loon gaat bij een lange
// rust uit de beurs; wie niet betaald wordt telt dat, en wil na twee dagen weg —
// maar vertrekken doet hij pas als de DM het zegt.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-huurlingen-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Huurlingen', () => {
  const c = setup(['Betalende Speler']);
  let wacht;
  const api = (m, p, b) => req(c.server, m, p, b, c.dm);
  const rust = () => api('POST', '/api/party/long-rest', { locatie: 'veld' });

  before(async () => {
    wacht = (await api('POST', '/api/entities/personages', { name: 'Huurwacht Joost', subtype: 'NPC', data: {} })).body.id;
    await api('PATCH', `/api/player-currency/${c.spelers[0].id}`, { fl: 3, kn: 0, cl: 0 });
  });

  it('stelt een dagloon voor dat de DM mag overtypen', async () => {
    const r = (await api('GET', `/api/entities/personages/${wacht}/huurling`)).body;
    assert.equal(r.huurling, null);
    assert.equal(r.loonSuggestie, 200);
  });

  it('weigert een speler en een onzinnig loon', async () => {
    assert.equal((await api('PUT', `/api/entities/personages/${c.spelers[0].id}/huurling`, { loon: 100 })).status, 400);
    assert.equal((await api('PUT', `/api/entities/personages/${wacht}/huurling`, { loon: -5 })).status, 400);
  });

  it('inhuren maakt hem medestander', async () => {
    const r = await api('PUT', `/api/entities/personages/${wacht}/huurling`, { loon: 150, betaler: c.spelers[0].id });
    assert.equal(r.status, 200);
    assert.equal(r.body.nieuwMedestander, true);
    const lijst = (await req(c.server, 'GET', '/api/companions', null, c.spelers[0].cookie)).body;
    const j = lijst.find(x => x.id === wacht);
    assert.equal(j.huurling.loon, 150);
    assert.equal(j.huurling.betalerNaam, 'Betalende Speler');
  });

  it('betaalt het loon bij een lange rust', async () => {
    const r = (await rust()).body;
    assert.equal(r.huurlingen[0].betaald, true);
    const geld = (await api('GET', `/api/player-currency/${c.spelers[0].id}`)).body;
    assert.deepEqual([geld.fl, geld.kn, geld.cl], [1, 5, 0]);
  });

  it('telt een achterstand als de beurs te licht is, en gaat nooit onder nul', async () => {
    await rust();                                   // 1,50 → 0
    const r = (await rust()).body;                  // niets meer
    assert.equal(r.huurlingen[0].betaald, false);
    assert.equal(r.huurlingen[0].achterstand, 1);
    const geld = (await api('GET', `/api/player-currency/${c.spelers[0].id}`)).body;
    assert.deepEqual([geld.fl, geld.kn, geld.cl], [0, 0, 0]);
  });

  it('wil na twee dagen weg, maar blijft tot de DM beslist', async () => {
    const r = (await rust()).body;
    assert.equal(r.huurlingen[0].wilWeg, true);
    const st = (await api('GET', `/api/entities/personages/${wacht}/huurling`)).body;
    assert.equal(st.medestander, true, 'hij vertrekt niet vanzelf');
    assert.equal(st.huurling.achterstand, 2);
  });

  it('betaalt de achterstand in één keer, of niet', async () => {
    assert.equal((await api('POST', `/api/entities/personages/${wacht}/huurling/betaal`, {})).status, 400);
    await api('PATCH', `/api/player-currency/${c.spelers[0].id}`, { fl: 5, kn: 0, cl: 0 });
    const r = await api('POST', `/api/entities/personages/${wacht}/huurling/betaal`, {});
    assert.equal(r.body.betaald, 300);
    assert.equal(r.body.huurling.achterstand, 0);
  });

  it('laat hem gaan als de DM dat zegt', async () => {
    await api('POST', `/api/entities/personages/${wacht}/huurling/vertrek`, {});
    const st = (await api('GET', `/api/entities/personages/${wacht}/huurling`)).body;
    assert.equal(st.huurling, null);
    assert.equal(st.medestander, false);
  });

  it('is alleen voor de DM', async () => {
    const r = await req(c.server, 'PUT', `/api/entities/personages/${wacht}/huurling`, { loon: 1 }, c.spelers[0].cookie);
    assert.equal(r.status, 403);
  });
});

// De melding over het loon gaat naar de DM en de party die hem in dienst heeft,
// niet naar de hele campagne: een andere party heeft er niets mee te maken, en
// een filter in de client houdt de netwerktab niet leeg.
describe('Huurlingen: het loonbericht', () => {
  const c = setup(['Werkgever']);
  const api = (m, p, b) => req(c.server, m, p, b, c.dm);
  const luister = (cookie) => new Promise((resolve) => {
    const s = ioClient(`http://localhost:${c.server.address().port}`, { transports: ['polling'], forceNew: true, extraHeaders: { Cookie: cookie } });
    const kreeg = [];
    s.on('huurlingen:loon', d => kreeg.push(d));
    s.on('connect', () => resolve({ s, kreeg }));
  });

  it('komt bij de DM en de eigen party aan, niet bij een andere party', async () => {
    const wacht = (await api('POST', '/api/entities/personages', { name: 'Huurwacht <b>Joost</b>', subtype: 'NPC', data: {} })).body.id;
    await api('PUT', `/api/entities/personages/${wacht}/huurling`, { loon: 150, betaler: c.spelers[0].id });
    const ander = (await api('POST', '/api/groups', { name: 'Andere party' })).body.id;
    await api('PUT', `/api/groups/${ander}/password`, { password: 'ander-ww' });
    const vreemdeId = (await api('POST', '/api/entities/personages', { name: 'Buitenstaander', subtype: 'speler', data: { groep: ander } })).body.id;
    const vreemd = (await req(c.server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: vreemdeId, password: 'ander-ww' })).cookie;

    const [dm, eigen, anders] = await Promise.all([luister(c.dm), luister(c.spelers[0].cookie), luister(vreemd)]);
    try {
      const r = await api('POST', '/api/party/long-rest', { locatie: 'veld' });   // beurs is leeg: geen loon
      assert.equal(r.body.huurlingen[0].betaald, false);
      await new Promise(res => setTimeout(res, 300));
      assert.equal(dm.kreeg.length, 1, 'de DM hoort het');
      assert.equal(eigen.kreeg.length, 1, 'de werkgever hoort het');
      assert.equal(anders.kreeg.length, 0, 'een andere party niet');
    } finally {
      for (const x of [dm, eigen, anders]) x.s.close();
    }
  });
});
