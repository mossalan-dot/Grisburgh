// **Het moment: *X is eigenlijk Y!*** Twee kaartjes die samenvallen is een
// scène, en die hoort op het **tafelscherm** — niet in de browser van de
// spelers, zoals de verzegelde brief en de kist die opengaat. Zou hij naar de
// campagne-room gaan, dan leest een speler met de netwerktab open de echte
// naam voordat zijn DM hem uitspreekt, en dat is precies de onthulling.
//
// Twee dingen worden hier bewaakt: hij komt aan op het tafelscherm en níét bij
// de speler, en hij speelt **één keer** — een tweede opslagbeurt op hetzelfde
// kaartje mag de onthulling niet nog eens afspelen.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { io: ioClient } = require('socket.io-client');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-alias-tafel-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
function wacht(socket, event, ms = 900) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}

describe('X is eigenlijk Y, op het tafelscherm', () => {
  let server, io, port, dm, sessie, tafel, speler, gid, echt, alias, echtZicht, aliasZicht;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    port = server.address().port;
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    await req(server, 'POST', '/api/groups', { name: 'Tafel A', password: 'tafel-a' }, dm);
    gid = (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === 'Tafel A').id;
    const charId = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Anne', subtype: 'speler', data: { groep: gid } }, dm)).body.id;

    const kaart = async (naam, data = {}) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, data }, dm)).body.id;
    echt  = await kaart('Hugo Grisburgh II');
    alias = await kaart('Harmen Jonker', {
      aliasVan: echt, aliasMoment: 'geheim',
      geheimen: JSON.stringify([
        { id: 'g1', tekst: 'Hij is Hugo Grisburgh II.', alias: true },
        { id: 'g2', tekst: 'Hij drinkt van de voorraad.' },
      ]),
    });
    echtZicht  = await kaart('Vrouwe Kwartel');
    aliasZicht = await kaart('De Gesluierde', { aliasVan: echtZicht, aliasMoment: 'zichtbaar' });

    await req(server, 'PUT', '/api/groups/active', { groupId: gid }, dm);
    // De party kent de twee pseudoniemen gewoon — dat is het hele punt: ze
    // kennen de waard, ze weten alleen niet wie hij is. Zonder deze stap kan
    // de speler de kaartjes niet eens opvragen en toetsen de controles
    // hieronder niets. Zichtbaar maken van een *alias*kaartje zet geen
    // moment af; dat hangt aan het échte kaartje.
    for (const id of [alias, aliasZicht]) {
      await req(server, 'PUT', `/api/entities/personages/${id}/visibility`, { target: 'visible' }, dm);
    }
    sessie = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: charId, password: 'tafel-a' })).cookie;

    // Het tafelscherm is een **ingelogd** scherm dat zich meldt; zonder die
    // melding belandt zijn socket in de campagne-room en mist hij alles.
    tafel = await connect(port, dm);
    tafel.emit('display:register');
    speler = await connect(port, sessie);
    await new Promise(r => setTimeout(r, 200));
  });

  after(async () => {
    tafel?.close(); speler?.close();
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('speelt het moment op het tafelscherm als het geheim opengaat', async () => {
    const opTafel  = wacht(tafel, 'alias:display');
    const bijSpeler = wacht(speler, 'alias:display');
    await req(server, 'PUT', `/api/entities/personages/${alias}/secret`, { gid: 'g1' }, dm);
    const d = await opTafel;
    assert.ok(d, 'het tafelscherm kreeg niets');
    assert.strictEqual(d.alias.naam, 'Harmen Jonker');
    assert.strictEqual(d.echt.naam, 'Hugo Grisburgh II');
    assert.strictEqual(await bijSpeler, null,
      'de speler leest de echte naam dan al voordat zijn DM hem uitspreekt');
  });

  it('speelt hem niet nog eens bij een volgend geheim op datzelfde kaartje', async () => {
    // Het echte geval: de alias staat al open en de DM onthult er daarna nóg
    // een geheim bij. Dat is geen tweede onthulling van wie hij is.
    const nog = wacht(tafel, 'alias:display');
    const r = await req(server, 'PUT', `/api/entities/personages/${alias}/secret`, { gid: 'g2' }, dm);
    assert.strictEqual(r.status, 200);
    // Eerst vaststellen dat de alias ná deze beurt nog steeds open staat —
    // anders zegt de toets niets: dan is er per definitie niets af te spelen.
    const na = (await req(server, 'GET', `/api/entities/personages/${alias}`, null, sessie)).body;
    assert.ok(na._alias, 'de alias staat niet meer open — dan toetst dit niets');
    assert.match(JSON.stringify(na.data.geheimen || ''), /voorraad/, 'het tweede geheim ging wel open');
    assert.strictEqual(await nog, null, 'de onthulling speelde opnieuw');
  });

  it('speelt hem ook bij het tweede moment: het echte kaartje wordt zichtbaar', async () => {
    const opTafel = wacht(tafel, 'alias:display');
    const bijSpeler = wacht(speler, 'alias:display');
    await req(server, 'PUT', `/api/entities/personages/${echtZicht}/visibility`, { target: 'visible' }, dm);
    const d = await opTafel;
    assert.ok(d, 'het tafelscherm kreeg niets');
    assert.strictEqual(d.alias.naam, 'De Gesluierde');
    assert.strictEqual(d.echt.naam, 'Vrouwe Kwartel');
    assert.strictEqual(await bijSpeler, null, 'ook dit moment is niet voor de spelers');
  });

  it('speelt hem niet nog eens als het echte kaartje al zichtbaar stond', async () => {
    const nog = wacht(tafel, 'alias:display');
    const r = await req(server, 'PUT', `/api/entities/personages/${echtZicht}/visibility`,
      { target: 'visible' }, dm);
    assert.strictEqual(r.status, 200);
    assert.ok((await req(server, 'GET', `/api/entities/personages/${aliasZicht}`, null, sessie)).body._alias,
      'de alias staat niet meer open — dan toetst dit niets');
    assert.strictEqual(await nog, null, 'de onthulling speelde opnieuw');
  });

  it('speelt niets bij een kaartje zichtbaar maken dat geen pseudoniem heeft', async () => {
    const nog = wacht(tafel, 'alias:display');
    await req(server, 'PUT', `/api/entities/personages/${echt}/visibility`, { target: 'visible' }, dm);
    assert.strictEqual(await nog, null, 'hier valt niets samen');
  });

  it('speelt hem opnieuw als de DM het terugdraait en nog eens onthult', async () => {
    // Terugdraaien wist de stand, dus een tweede onthulling ís weer een
    // onthulling — bijvoorbeeld bij een andere party, of na een vergissing.
    await req(server, 'PUT', `/api/entities/personages/${echtZicht}/visibility`, { target: 'hidden' }, dm);
    const nog = wacht(tafel, 'alias:display');
    await req(server, 'PUT', `/api/entities/personages/${echtZicht}/visibility`, { target: 'visible' }, dm);
    assert.ok(await nog, 'na terugdraaien hoort hij weer te kunnen spelen');
  });
});
