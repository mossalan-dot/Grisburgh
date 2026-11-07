// Uit de ronde met een lopende sessie (7 nov 2026): het tafelscherm.
//
// Het tafelscherm is als DM ingelogd, maar ligt midden op tafel. Het kreeg het
// rauwe gevecht — de exacte HP en AC van elk monster op de tokens — terwijl de
// telefoons van de spelers die getallen juist níét krijgen. En een kist die
// openstond kwam alleen over de socket, dus na herladen was hij weg.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { io: ioClient } = require('socket.io-client');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-tafel-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    let json = null;
    if (body) { json = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; opts.headers['Content-Length'] = Buffer.byteLength(json); }
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { let b; try { b = JSON.parse(data); } catch { b = data; } const sc = res.headers['set-cookie']; resolve({ status: res.statusCode, body: b, cookie: sc ? sc[0].split(';')[0] : cookie }); });
    });
    r.on('error', reject); if (json) r.write(json); r.end();
  });
}

function verbind(port, cookie) {
  const s = ioClient(`http://localhost:${port}`, { transports: ['polling'], forceNew: true, extraHeaders: { Cookie: cookie } });
  return new Promise((resolve, reject) => { s.on('connect', () => resolve(s)); s.on('connect_error', reject); });
}
const wacht = (s, ev, ms = 1500) => new Promise(r => { const t = setTimeout(() => r(null), ms); s.once(ev, d => { clearTimeout(t); r(d); }); });

describe('Tafelscherm in een lopende sessie', () => {
  let server, io, dm, tafel, port;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    ({ server, io } = require('../server'));
    await new Promise(r => server.listen(0, r));
    port = server.address().port;
    dm    = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    tafel = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    await req(server, 'POST', '/api/combat/combatant', { name: 'Kwelderrat', type: 'monster', hp: 7, maxHp: 7, ac: '12', initiative: 12 }, dm);
    await req(server, 'POST', '/api/combat/start', {}, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('GET /combat?tafel=1 geeft een DM-login de versie zonder cijfers; zonder vlag blijft de DM alles zien', async () => {
    const t = (await req(server, 'GET', '/api/combat?tafel=1', null, tafel)).body;
    const rat = t.combatants.find(c => c.name === 'Kwelderrat');
    assert.ok(rat, 'monster staat erin');
    assert.strictEqual(rat.hp, undefined);
    assert.strictEqual(rat.maxHp, undefined);
    assert.strictEqual(rat.ac, undefined);
    assert.ok(rat.hpStaat, 'wel een staat in woorden');
    const d = (await req(server, 'GET', '/api/combat', null, dm)).body;
    assert.strictEqual(d.combatants.find(c => c.name === 'Kwelderrat').hp, 7);
  });

  it('een socket in de tafelroom krijgt combat:updated zonder cijfers, de DM-socket met', async () => {
    const sTafel = await verbind(port, tafel);
    const sDm    = await verbind(port, dm);
    sTafel.emit('display:register');
    await new Promise(r => setTimeout(r, 150));
    const opTafel = wacht(sTafel, 'combat:updated'), opDm = wacht(sDm, 'combat:updated');
    const rat = (await req(server, 'GET', '/api/combat', null, dm)).body.combatants.find(c => c.name === 'Kwelderrat');
    await req(server, 'PUT', `/api/combat/combatant/${rat.id}`, { hp: 3 }, dm);
    const [t, d] = await Promise.all([opTafel, opDm]);
    sTafel.close(); sDm.close();
    assert.ok(t && d, 'beide kregen het event');
    assert.strictEqual(t.combatants.find(c => c.name === 'Kwelderrat').hp, undefined);
    assert.strictEqual(d.combatants.find(c => c.name === 'Kwelderrat').hp, 3);
  });

  it('GET /combat/loot?tafel=1 geeft de kist terug zolang er buit openstaat', async () => {
    assert.strictEqual((await req(server, 'GET', '/api/combat/loot?tafel=1', null, tafel)).body, null);
    await req(server, 'POST', '/api/combat/loot/start', {}, dm);
    await req(server, 'PUT', '/api/combat/loot', { goud: { fl: 3, kn: 0, cl: 0 }, items: [{ naam: 'Natte kaart' }] }, dm);
    await req(server, 'POST', '/api/combat/loot/reveal', {}, dm);
    const k = (await req(server, 'GET', '/api/combat/loot?tafel=1', null, tafel)).body;
    assert.ok(k && Array.isArray(k.items), JSON.stringify(k));
    assert.strictEqual(k.items[0]?.naam, 'Natte kaart');
  });
});
