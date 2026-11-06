const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Een gevangene is een toestand per party. Wat hier bewaakt wordt: hij staat
// bij de juiste party en nergens anders, een verborgen kaartje wordt vaag (de
// party heeft hem in handen) maar niet zichtbaar, een medestander gaat eraf,
// een speler kan niet gevangen worden, en wat de speler ziet volgt dezelfde
// zichtbaarheid als elders.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-gevangenen-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Gevangenen', () => {
  let server, io, dm, speler, spelerCookie, smokkelaar, kapitein, anderGroep;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Wilmer Vlasbaard', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    smokkelaar = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Gemaskerde Smokkelaar', subtype: 'NPC', data: { ras: 'Human', klasse: 'Rogue' } }, dm)).body.id;
    kapitein = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Kapitein Vos', subtype: 'NPC', data: {} }, dm)).body.id;
    anderGroep = (await req(server, 'POST', '/api/groups', { name: 'Andere tafel' }, dm)).body.id;

    const groups = (await req(server, 'GET', '/api/groups', null, dm)).body.groups || [];
    const wachtwoord = groups.find(g => g.id === 'groep1')?.password;
    spelerCookie = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: wachtwoord })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const zet = (id, body) => req(server, 'PUT', `/api/entities/personages/${id}/gevangen`, body, dm);

  it('wil een expliciete stand, geen wisselknop', async () => {
    assert.equal((await zet(smokkelaar, {})).status, 400);
  });

  it('weigert een speler als gevangene', async () => {
    assert.equal((await zet(speler, { gevangen: true, groep: 'groep1' })).status, 400);
  });

  it('maakt een verborgen kaartje vaag, niet zichtbaar', async () => {
    const r = await zet(smokkelaar, { gevangen: true, groep: 'groep1', waar: 'in de kelder van De Gouden Gans' });
    assert.equal(r.status, 200);
    assert.equal(r.body.zichtbaarGemaakt, true);
    const lijst = (await req(server, 'GET', '/api/party/gevangenen', null, spelerCookie)).body;
    assert.equal(lijst.length, 1);
    assert.equal(lijst[0].name, 'Gemaskerde Smokkelaar');
    assert.equal(lijst[0].vaag, true);
    assert.equal(lijst[0].rol, '', 'een vaag kaartje verklapt zijn volk en class niet');
    assert.equal(lijst[0].waar, 'in de kelder van De Gouden Gans');
  });

  it('staat alleen bij de party die hem vasthoudt', async () => {
    const st = (await req(server, 'GET', `/api/entities/personages/${smokkelaar}/gevangen`, null, dm)).body;
    assert.deepEqual(st.bij.map(b => b.groep), ['groep1']);
    await req(server, 'PUT', '/api/groups/active', { groupId: anderGroep }, dm);
    assert.equal((await req(server, 'GET', '/api/party/gevangenen', null, dm)).body.length, 0);
    await req(server, 'PUT', '/api/groups/active', { groupId: 'groep1' }, dm);
  });

  it('haalt een medestander van de party af', async () => {
    await req(server, 'POST', `/api/companions/${kapitein}/groep1`, null, dm);
    await req(server, 'PUT', `/api/entities/${'personages'}/${kapitein}/visibility`, { visibility: 'visible' }, dm);
    const r = await zet(kapitein, { gevangen: true, groep: 'groep1' });
    assert.equal(r.body.wasMedestander, true);
    const status = (await req(server, 'GET', `/api/companions/status/${kapitein}`, null, dm)).body;
    assert.deepEqual(status.linked, []);
  });

  it('draagt de vlag op het kaartje', async () => {
    const e = (await req(server, 'GET', `/api/entities/personages/${kapitein}`, null, dm)).body;
    assert.equal(e._gevangen, true);
  });

  it('laat een gevangene vrij zonder de rest aan te raken', async () => {
    await zet(kapitein, { gevangen: false, groep: 'groep1' });
    const lijst = (await req(server, 'GET', '/api/party/gevangenen', null, spelerCookie)).body;
    assert.deepEqual(lijst.map(g => g.name), ['Gemaskerde Smokkelaar']);
  });

  it('weigert een speler om iemand gevangen te nemen', async () => {
    const r = await req(server, 'PUT', `/api/entities/personages/${kapitein}/gevangen`, { gevangen: true }, spelerCookie);
    assert.equal(r.status, 403);
  });
});
