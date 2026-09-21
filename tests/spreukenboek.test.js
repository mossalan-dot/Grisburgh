const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Het spreukenboek heeft één regel die je makkelijk vergeet: een spreuk erin
// schrijven gaat bij een **speler** langs de DM, bij de DM niet. En de slots
// zijn afgeleid uit klasse en level, behalve waar de DM met de hand iets heeft
// vastgezet — die twee mogen elkaar niet overschrijven.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-spreuken-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Spreukenboek: verzoeken, slots en voorbereiden', () => {
  let server, io, dm, gid, tovenaar, tovenaarC, vreemde;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);

    tovenaar = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Tovenaar', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    vreemde = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Andere', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    tovenaarC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: tovenaar, password: 'proef1234' })).cookie;
    await req(server, 'PATCH', `/api/player-profile/${tovenaar}`,
      { klasse: 'Wizard', level: '5', klasseLevel: '5' }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const boek = async (id = tovenaar, cookie = dm) =>
    (await req(server, 'GET', `/api/player-spells/${id}`, null, cookie)).body || [];
  const slots = async (id = tovenaar) =>
    (await req(server, 'GET', `/api/player-spellslots/${id}`, null, dm)).body || {};

  it('leidt de slots af uit klasse en level', async () => {
    const s = await slots();
    assert.strictEqual(s['1']?.max, 4, 'een Wizard 5 heeft 4 slots van niveau 1');
    assert.strictEqual(s['2']?.max, 3);
    assert.strictEqual(s['3']?.max, 2);
    assert.ok(!s['4']?.max, 'en nog geen niveau 4');
  });

  it('laat een verbruikt slot staan als het level verandert', async () => {
    await req(server, 'PUT', `/api/player-spellslots/${tovenaar}`,
      { 1: { used: 2 } }, tovenaarC);
    assert.strictEqual((await slots())['1'].used, 2);

    await req(server, 'PATCH', `/api/player-profile/${tovenaar}`,
      { klasse: 'Wizard', level: '6', klasseLevel: '6' }, dm);
    const s = await slots();
    assert.strictEqual(s['1'].used, 2, 'wat je verbruikt hebt blijft verbruikt');
    assert.strictEqual(s['3'].max, 3, 'en het maximum groeit mee met het level');
  });

  it('houdt een handmatig gezet maximum vast', async () => {
    await req(server, 'PUT', `/api/player-spellslots/${tovenaar}`,
      { 4: { max: 1, used: 0, handmatig: true } }, dm);
    assert.strictEqual((await slots())['4'].max, 1, 'de DM mag afwijken van de tabel');

    await req(server, 'PATCH', `/api/player-profile/${tovenaar}`,
      { klasse: 'Wizard', level: '7', klasseLevel: '7' }, dm);
    assert.strictEqual((await slots())['4'].max, 1,
      'een handmatig niveau blijft staan, ook als de tabel iets anders zegt');
  });

  it('laat een speler niet aan andermans slots komen', async () => {
    const r = await req(server, 'PUT', `/api/player-spellslots/${vreemde}`,
      { 1: { used: 9 } }, tovenaarC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
  });

  // ── Een spreuk in je boek ──────────────────────────────────────────────────
  it('maakt van een spelersverzoek geen boekregel maar een vraag', async () => {
    const r = await req(server, 'POST', `/api/player-spells/${tovenaar}`,
      { index: 'magic-missile', name: 'Magic Missile', level: 1 }, tovenaarC);
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));   // aanmaken geeft 201
    assert.strictEqual(r.body.verzoek, true, 'een speler vraagt het aan');
    assert.strictEqual((await boek()).length, 0, 'en het staat nog niet in zijn boek');

    const open = (await req(server, 'GET', '/api/spell-requests', null, tovenaarC)).body;
    const lijst = Array.isArray(open) ? open : (open?.verzoeken || open?.requests || []);
    assert.strictEqual(lijst.length, 1, 'hij ziet zijn eigen openstaande vraag');
  });

  it('schrijft hem bij goedkeuring alsnog in het boek', async () => {
    const open = (await req(server, 'GET', '/api/spell-requests', null, dm)).body;
    const lijst = Array.isArray(open) ? open : (open?.verzoeken || open?.requests || []);
    const verzoek = lijst[0];
    assert.ok(verzoek, 'de DM ziet de vraag: ' + JSON.stringify(open));

    const r = await req(server, 'POST', `/api/spells/request/${verzoek.id}/approve`, {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const b = await boek();
    assert.strictEqual(b.length, 1);
    assert.strictEqual(b[0].name, 'Magic Missile');
  });

  it('schrijft een afgewezen spreuk niet in het boek', async () => {
    await req(server, 'POST', `/api/player-spells/${tovenaar}`,
      { index: 'fireball', name: 'Fireball', level: 3 }, tovenaarC);
    const open = (await req(server, 'GET', '/api/spell-requests', null, dm)).body;
    const lijst = Array.isArray(open) ? open : (open?.verzoeken || open?.requests || []);
    const verzoek = lijst.find(v => /Fireball/.test(v.name || v.spellName || ''));
    assert.ok(verzoek, JSON.stringify(lijst));

    const r = await req(server, 'POST', `/api/spells/request/${verzoek.id}/reject`, {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(!(await boek()).some(s => s.name === 'Fireball'), 'afgewezen is afgewezen');
  });

  it('laat de DM er rechtstreeks een in schrijven', async () => {
    const r = await req(server, 'POST', `/api/player-spells/${tovenaar}`,
      { index: 'shield', name: 'Shield', level: 1 }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(!r.body.verzoek, 'de DM hoeft niets te vragen');
    assert.ok((await boek()).some(s => s.name === 'Shield'));
  });

  it('bereidt een spreuk voor en weer af', async () => {
    await req(server, 'PATCH', `/api/player-spells/${tovenaar}/magic-missile`,
      { prepared: true }, tovenaarC);
    assert.strictEqual((await boek()).find(s => s.index === 'magic-missile').prepared, true);

    await req(server, 'PATCH', `/api/player-spells/${tovenaar}/magic-missile`,
      { prepared: false }, tovenaarC);
    assert.strictEqual((await boek()).find(s => s.index === 'magic-missile').prepared, false);
  });

  it('concentreert op maar één spreuk tegelijk', async () => {
    await req(server, 'PATCH', `/api/player-spells/${tovenaar}/magic-missile`,
      { concentrationActive: true }, tovenaarC);
    await req(server, 'PATCH', `/api/player-spells/${tovenaar}/shield`,
      { concentrationActive: true }, tovenaarC);

    const b = await boek();
    const aan = b.filter(s => s.concentrationActive);
    assert.strictEqual(aan.length, 1, 'de vorige laat vanzelf los: ' + JSON.stringify(b.map(s => [s.index, s.concentrationActive])));
    assert.strictEqual(aan[0].index, 'shield');
  });

  it('haalt een spreuk weer uit het boek', async () => {
    const r = await req(server, 'DELETE', `/api/player-spells/${tovenaar}/shield`, null, tovenaarC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(!(await boek()).some(s => s.index === 'shield'));
  });

  it('laat een speler niet in andermans boek schrijven', async () => {
    const r = await req(server, 'POST', `/api/player-spells/${vreemde}`,
      { index: 'sleep', name: 'Sleep', level: 1 }, tovenaarC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));

    const weg = await req(server, 'DELETE', `/api/player-spells/${vreemde}/sleep`, null, tovenaarC);
    assert.strictEqual(weg.status, 403);
  });

  it('vraagt om een index en een naam', async () => {
    const r = await req(server, 'POST', `/api/player-spells/${tovenaar}`, { name: 'Naamloos' }, dm);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
  });
});
