const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { io: ioClient } = require('socket.io-client');

// Rage: de server telt, de tafel rekent. Deze tests bewaken de regels uit de
// PHB 2024 (uses per level, één terug na een Short Rest, alles na een Long
// Rest), de koppeling met het gevecht (Raging op de token, Concentration weg,
// einde gevecht is einde Rage) en wie wat mag.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-rage-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
function connect(port, cookie) {
  const s = ioClient(`http://localhost:${port}`, { transports: ['polling'], forceNew: true, extraHeaders: { Cookie: cookie } });
  return new Promise((resolve, reject) => { s.on('connect', () => resolve(s)); s.on('connect_error', reject); });
}
function waitFor(socket, event, ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

describe('Rage (Barbarian)', () => {
  let server, io, port, dm, grog, gCookie, wizard, wCookie, oud;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    port = server.address().port;
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const maak = async (name) => (await req(server, 'POST', '/api/entities/personages',
      { name, subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    grog   = await maak('Grog Bijlhand');
    wizard = await maak('Elara Inktvinger');
    oud    = await maak('Oude Ursk');
    await req(server, 'PATCH', `/api/player-profile/${grog}`,   { klasse: 'Barbarian', level: 3 }, dm);
    await req(server, 'PATCH', `/api/player-profile/${wizard}`, { klasse: 'Wizard', level: 5 }, dm);
    await req(server, 'PATCH', `/api/player-profile/${oud}`,    { klasse: 'Barbarian', level: 15 }, dm);

    const groups = (await req(server, 'GET', '/api/groups', null, dm)).body.groups || [];
    const pw = groups.find(g => g.id === 'groep1')?.password;
    gCookie = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: grog,   password: pw })).cookie;
    wCookie = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: wizard, password: pw })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('bestaat niet voor wie geen Barbarian is', async () => {
    const r = await req(server, 'GET', `/api/characters/${wizard}/rage`, null, wCookie);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.rage, null);
    assert.strictEqual((await req(server, 'POST', `/api/characters/${wizard}/rage`, {}, wCookie)).status, 409);
  });

  it('telt volgens de tabel: drie uses op level 3, Rage Damage +2', async () => {
    const r = (await req(server, 'GET', `/api/characters/${grog}/rage`, null, gCookie)).body.rage;
    assert.strictEqual(r.max, 3);
    assert.strictEqual(r.over, 3);
    assert.strictEqual(r.schade, 2);
    assert.strictEqual(r.relentless, null, 'Relentless Rage pas op 11');
  });

  it('een speler kan niet andermans Rage aansteken', async () => {
    assert.strictEqual((await req(server, 'POST', `/api/characters/${grog}/rage`, {}, wCookie)).status, 403);
  });

  it('aan, niet twee keer, en uit', async () => {
    const aan = await req(server, 'POST', `/api/characters/${grog}/rage`, {}, gCookie);
    assert.strictEqual(aan.status, 200);
    assert.strictEqual(aan.body.rage.actief, true);
    assert.strictEqual(aan.body.rage.over, 2);
    assert.strictEqual((await req(server, 'POST', `/api/characters/${grog}/rage`, {}, gCookie)).status, 409);
    const uit = await req(server, 'POST', `/api/characters/${grog}/rage/einde`, {}, gCookie);
    assert.strictEqual(uit.body.rage.actief, false);
    assert.strictEqual(uit.body.rage.over, 2, 'beëindigen geeft geen use terug');
  });

  it('weigert als er niets meer over is', async () => {
    for (let i = 0; i < 2; i++) {
      await req(server, 'POST', `/api/characters/${grog}/rage`, {}, gCookie);
      await req(server, 'POST', `/api/characters/${grog}/rage/einde`, {}, gCookie);
    }
    const r = await req(server, 'POST', `/api/characters/${grog}/rage`, {}, gCookie);
    assert.strictEqual(r.status, 409);
  });

  it('een Short Rest geeft er één terug, een Long Rest alles', async () => {
    await req(server, 'POST', '/api/party/short-rest', {}, dm);
    let r = (await req(server, 'GET', `/api/characters/${grog}/rage`, null, gCookie)).body.rage;
    assert.strictEqual(r.over, 1);
    await req(server, 'POST', `/api/characters/${grog}/rage`, {}, gCookie);   // raast de nacht in
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    r = (await req(server, 'GET', `/api/characters/${grog}/rage`, null, gCookie)).body.rage;
    assert.strictEqual(r.over, 3);
    assert.strictEqual(r.actief, false, 'na een Long Rest raast niemand meer');
  });

  it('zet Raging op de token, breekt Concentration, en het einde van het gevecht dooft hem', async () => {
    await req(server, 'POST', '/api/combat/combatant',
      { name: 'Grog Bijlhand', entityId: grog, type: 'player', hp: 30, maxHp: 30, conditions: ['concentration'] }, dm);
    await req(server, 'POST', '/api/combat/start', {}, dm);
    const r = await req(server, 'POST', `/api/characters/${grog}/rage`, {}, gCookie);
    assert.strictEqual(r.body.concentratieWeg, true);
    let combat = (await req(server, 'GET', '/api/combat', null, dm)).body;
    const token = combat.combatants.find(c => c.entityId === grog);
    assert.deepStrictEqual(token.conditions, ['raging']);

    await req(server, 'DELETE', '/api/combat', null, dm);
    const st = (await req(server, 'GET', `/api/characters/${grog}/rage`, null, gCookie)).body.rage;
    assert.strictEqual(st.actief, false);
  });

  it('meldt de Rage aan de tafel, en de brul alleen aan het tafelscherm', async () => {
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    const tel = await connect(port, wCookie);
    const tafel = await connect(port, dm);
    tafel.emit('display:register');
    await new Promise(r => setTimeout(r, 150));
    const telUpd   = waitFor(tel, 'rage:updated', 900);
    const telBrul  = waitFor(tel, 'rage:display', 700);
    const tafelBrul = waitFor(tafel, 'rage:display', 900);
    await req(server, 'POST', `/api/characters/${grog}/rage`, {}, gCookie);
    const [u, b, t] = await Promise.all([telUpd, telBrul, tafelBrul]);
    tel.close(); tafel.close();
    assert.ok(u && u.actief && u.naam === 'Grog Bijlhand', 'wie raast is geen geheim');
    assert.strictEqual(b, null, 'de brul hoort bij het tafelscherm');
    assert.ok(t, 'het tafelscherm krijgt hem wél');
    assert.strictEqual(t.schade, 2);
    await req(server, 'POST', `/api/characters/${grog}/rage/einde`, {}, gCookie);
  });

  it('Relentless Rage: op 0 HP een DC, gelukt is twee keer je level, en de DC loopt op', async () => {
    await req(server, 'POST', `/api/characters/${oud}/rage`, {}, dm);
    await req(server, 'PATCH', `/api/player-hp/${oud}`, { current: 0, max: 150 }, dm);
    let st = (await req(server, 'GET', `/api/characters/${oud}/rage`, null, dm)).body.rage;
    assert.deepStrictEqual(st.relentless, { dc: 10, nodig: true });
    const r = await req(server, 'POST', `/api/characters/${oud}/rage/relentless`, { gelukt: true }, dm);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.rage.relentless.dc, 15);
    assert.strictEqual(r.body.rage.relentless.nodig, false);
    assert.strictEqual(r.body.rage.actief, true);
    const sheet = (await req(server, 'GET', `/api/characters/${oud}/rage`, null, dm)).body.rage;
    assert.strictEqual(sheet.relentless.nodig, false);

    await req(server, 'PATCH', `/api/player-hp/${oud}`, { current: 0 }, dm);
    const mis = await req(server, 'POST', `/api/characters/${oud}/rage/relentless`, { gelukt: false }, dm);
    assert.strictEqual(mis.body.rage.actief, false, 'mislukt: hij gaat neer en de Rage dooft');
    assert.strictEqual(mis.body.rage.relentless.dc, 20);
  });

  it('Persistent Rage: alles terug, één keer per Long Rest', async () => {
    const st = (await req(server, 'GET', `/api/characters/${oud}/rage`, null, dm)).body.rage;
    assert.ok(st.verbruikt > 0);
    const r = await req(server, 'POST', `/api/characters/${oud}/rage/persistent`, {}, dm);
    assert.strictEqual(r.body.rage.verbruikt, 0);
    assert.strictEqual((await req(server, 'POST', `/api/characters/${oud}/rage/persistent`, {}, dm)).status, 409);
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    const na = (await req(server, 'GET', `/api/characters/${oud}/rage`, null, dm)).body.rage;
    assert.strictEqual(na.persistent.beschikbaar, true);
    assert.strictEqual(na.relentless.dc, 10);
  });
});
