const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Spelers geven elkaar voorwerpen: direct, zonder tussenkomst van de DM. Alleen
// binnen de eigen party, alleen je eigen spullen, en alleen als de DM ruilen
// niet heeft uitgezet.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-geef-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Voorwerp aan een medespeler geven', () => {
  let server, io, dm, A, B, C, cookieA, zwaard;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const speler = async (naam, groep) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, subtype: 'speler', data: { groep } }, dm)).body.id;
    A = await speler('Gever', 'groep1');
    B = await speler('Ontvanger', 'groep1');
    // C zit in een andere party.
    await req(server, 'POST', '/api/groups', { name: 'Andere party' }, dm);
    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body.groups;
    const andere  = groepen.find(g => g.name === 'Andere party').id;
    C = await speler('Vreemde', andere);

    zwaard = (await req(server, 'POST', '/api/entities/voorwerpen', { name: 'Zwaard' }, dm)).body.id;
    await req(server, 'PUT', `/api/items/${zwaard}/owner`, { characterId: A, playerName: 'Gever', groupId: 'groep1' }, dm);
    cookieA = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: A })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const eigenaar = async () => {
    const r = await req(server, 'GET', '/api/items/ownership', null, dm);
    const o = (r.body.owners || {})[zwaard];
    return Array.isArray(o) ? o[0]?.characterId : o?.characterId;
  };

  it('verhuist een voorwerp naar een medespeler', async () => {
    const r = await req(server, 'POST', `/api/items/${zwaard}/geef`, { targetId: B }, cookieA);
    assert.equal(r.status, 200);
    assert.equal(await eigenaar(), B, 'het zwaard is nu van de ontvanger');
  });

  it('laat niet toe wat niet van jou is', async () => {
    // A heeft het zwaard net weggegeven.
    const r = await req(server, 'POST', `/api/items/${zwaard}/geef`, { targetId: B }, cookieA);
    assert.equal(r.status, 403);
  });

  it('geeft niets aan iemand buiten je party', async () => {
    await req(server, 'PUT', `/api/items/${zwaard}/owner`, { characterId: A, playerName: 'Gever', groupId: 'groep1' }, dm);
    const r = await req(server, 'POST', `/api/items/${zwaard}/geef`, { targetId: C }, cookieA);
    assert.equal(r.status, 403);
    assert.equal(await eigenaar(), A, 'het zwaard blijft waar het was');
  });

  it('weigert geven aan jezelf', async () => {
    const r = await req(server, 'POST', `/api/items/${zwaard}/geef`, { targetId: A }, cookieA);
    assert.equal(r.status, 400);
  });

  it('respecteert de ruil-schakelaar van de DM', async () => {
    await req(server, 'PUT', '/api/items/trade-allowed', { allowed: false, groupId: 'groep1' }, dm);
    const r = await req(server, 'POST', `/api/items/${zwaard}/geef`, { targetId: B }, cookieA);
    assert.equal(r.status, 403);
    await req(server, 'PUT', '/api/items/trade-allowed', { allowed: true, groupId: 'groep1' }, dm);
  });

  // Een tatoeage zit in je huid en een pact in je ziel: dat schuif je niet over
  // de tafel naar je buurman. Het vinkje staat op het voorwerp zelf; zegeningen,
  // gunsten en class-features zijn het altijd, want die zijn aan een persoon
  // gegeven en niet aan een rugzak.
  it('geeft niet weg wat bij zijn drager hoort', async () => {
    const tattoo = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Eldritch Claw Tattoo', data: { nietRuilbaar: 'true' } }, dm)).body.id;
    await req(server, 'PUT', `/api/items/${tattoo}/owner`, { characterId: A, playerName: 'Gever', groupId: 'groep1' }, dm);
    const r = await req(server, 'POST', `/api/items/${tattoo}/geef`, { targetId: B }, cookieA);
    assert.equal(r.status, 403, 'een tatoeage gaat niet van hand tot hand');
    const o = (await req(server, 'GET', '/api/items/ownership', null, dm)).body.owners[tattoo];
    assert.equal(Array.isArray(o) ? o[0]?.characterId : o?.characterId, A, 'hij blijft bij wie hem droeg');
  });

  it('houdt een zegening ook zonder vinkje bij zijn drager', async () => {
    const zegen = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Zegen van Matall', data: { itemType: 'Blessing' } }, dm)).body.id;
    await req(server, 'PUT', `/api/items/${zegen}/owner`, { characterId: A, playerName: 'Gever', groupId: 'groep1' }, dm);
    const r = await req(server, 'POST', `/api/items/${zegen}/geef`, { targetId: B }, cookieA);
    assert.equal(r.status, 403, 'een zegening is aan een persoon gegeven, niet aan een rugzak');
  });

  it('vraagt geen ruil aan voor zoiets', async () => {
    const tattoo = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Tweede Tatoeage', data: { nietRuilbaar: 'true' } }, dm)).body.id;
    await req(server, 'PUT', `/api/items/${tattoo}/owner`, { characterId: A, playerName: 'Gever', groupId: 'groep1' }, dm);
    const cookieB = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: B })).cookie;
    const r = await req(server, 'POST', `/api/items/${tattoo}/request`, { type: 'trade', targetId: A }, cookieB);
    assert.equal(r.status, 403);
  });

  it('verhuist ook een losse boedelregel', async () => {
    const gemaakt = (await req(server, 'POST', `/api/player-items/${A}`, { name: 'Touw (15 m)' }, dm)).body;
    const lijst = (await req(server, 'GET', `/api/player-items/${A}`, null, dm)).body;
    const regel = gemaakt?.id ? gemaakt : (Array.isArray(lijst) ? lijst : []).find(i => i.name === 'Touw (15 m)');
    const r = await req(server, 'POST', `/api/items/${regel.id}/geef`, { targetId: B }, cookieA);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const vanB = (await req(server, 'GET', `/api/player-items/${B}`, null, dm)).body;
    assert.ok((Array.isArray(vanB) ? vanB : vanB.items || []).some(i => i.name === 'Touw (15 m)'));
  });
});
