const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

// #47: isoleer in een unieke tmpdir zodat de test NOOIT de echte ./data raakt.
// De env-var wordt in before() gezet (vlak vóór de require) — het proces is
// gedeeld met andere testbestanden.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-api-${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Helper: HTTP request with cookie support
function req(server, method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${server.address().port}`);
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
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, cookie: setCookie ? setCookie[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

describe('API', () => {
  let server, io, dmCookie, spelerCookie;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    delete require.cache[require.resolve('../server')];
    delete require.cache[require.resolve('../lib/storage')];
    delete require.cache[require.resolve('../routes/api')];
    delete require.cache[require.resolve('../routes/auth')];
    const mod = require('../server');
    server = mod.server;
    io = mod.io;
    await new Promise(r => server.listen(0, r));
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  // Auth
  it('should reject wrong password', async () => {
    const res = await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'wrong' });
    assert.strictEqual(res.status, 401);
  });

  it('should login with correct password', async () => {
    const res = await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.role, 'dm');
    dmCookie = res.cookie;
  });

  it('should return role', async () => {
    const res = await req(server, 'GET', '/api/auth/role', null, dmCookie);
    assert.strictEqual(res.body.role, 'dm');
  });

  // Entity CRUD
  it('should create entity as DM', async () => {
    const res = await req(server, 'POST', '/api/entities/personages', {
      name: 'Test NPC',
      subtype: 'NPC',
      data: { rol: 'Barkeeper', desc: 'Een test personage', geheim: 'Geheime info' },
      links: { personages: [], locaties: ['Herberg'], organisaties: [], voorwerpen: [], archief: [] },
    }, dmCookie);
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.name, 'Test NPC');
  });

  it('should block create without DM session', async () => {
    const res = await req(server, 'POST', '/api/entities/personages', { name: 'Blocked' });
    assert.strictEqual(res.status, 403);
  });

  it('should list entities as DM with visibility info', async () => {
    const res = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    assert.ok('_visibility' in res.body[0]);
  });

  it('should filter hidden entities for players', async () => {
    const res = await req(server, 'GET', '/api/entities/personages');
    assert.strictEqual(res.status, 200);
    // New entities default to hidden, so player should see 0
    assert.strictEqual(res.body.length, 0);
  });

  it('should toggle visibility', async () => {
    // Get entity id
    const list = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    const id = list.body[0].id;
    const res = await req(server, 'PUT', `/api/entities/personages/${id}/visibility`, null, dmCookie);
    assert.strictEqual(res.body.visibility, 'visible');
  });

  it('hides all entities from a request without a session (no leak)', async () => {
    // Per-groep model: zonder ingelogde speler geen data. De positieve
    // speler-in-groep flow (geheim strippen) staat in filter.test.js.
    const list = await req(server, 'GET', '/api/entities/personages');
    assert.strictEqual(list.body.length, 0);
  });

  it('should toggle secret reveal (DM side)', async () => {
    const list = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    const id = list.body[0].id;
    const res = await req(server, 'PUT', `/api/entities/personages/${id}/secret`, null, dmCookie);
    assert.strictEqual(res.body.secretReveal, true);
  });

  it('should update entity', async () => {
    const list = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    const id = list.body[0].id;
    const res = await req(server, 'PUT', `/api/entities/personages/${id}`, { name: 'Updated NPC' }, dmCookie);
    assert.strictEqual(res.body.name, 'Updated NPC');
  });

  it('should save and retrieve DM notes', async () => {
    const list = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    const id = list.body[0].id;
    await req(server, 'PUT', `/api/dm/notes/${id}`, { note: 'Geheime notitie' }, dmCookie);
    const res = await req(server, 'GET', `/api/dm/notes/${id}`, null, dmCookie);
    assert.strictEqual(res.body.note, 'Geheime notitie');
  });

  it('should block DM notes for players', async () => {
    const list = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    const id = list.body[0].id;
    const res = await req(server, 'GET', `/api/dm/notes/${id}`);
    assert.strictEqual(res.status, 403);
  });

  // Archief — een document is sinds de samenvoeging een gewoon kaartje, dus het
  // loopt via de entity-routes. Wat hier overblijft is het logboek.
  // Een kaartje filteren vraagt om een échte spelerssessie: zonder characterId
  // weet de server niet naar welke party hij moet kijken en geeft hij niets.
  it('logt een speler in voor de kaartjes-filtering', async () => {
    const held = await req(server, 'POST', '/api/entities/personages',
      { name: 'Leesbare Speler', subtype: 'speler', data: { groep: 'groep1' } }, dmCookie);
    const login = await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: held.body.id });
    spelerCookie = login.cookie;
    assert.ok(spelerCookie);
  });

  it('maakt een document als kaartje aan en verbergt het voor spelers', async () => {
    const res = await req(server, 'POST', '/api/entities/documenten', {
      name: 'Test Brief', data: { docType: 'Brief', desc: 'Een test document', tekst: 'Beste lezer,' },
      links: { personages: ['Test NPC'], locaties: ['Grisburgh'] },
    }, dmCookie);
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
    const speler = await req(server, 'GET', '/api/entities/documenten', null, spelerCookie);
    assert.strictEqual(speler.body.length, 0);
  });

  it('onthult een document en schrijft er een logboekregel bij', async () => {
    const lijst = await req(server, 'GET', '/api/entities/documenten', null, dmCookie);
    const id = lijst.body[0].id;
    await req(server, 'PUT', `/api/entities/documenten/${id}/visibility`, { target: 'visible' }, dmCookie);

    const speler = await req(server, 'GET', '/api/entities/documenten', null, spelerCookie);
    assert.strictEqual(speler.body.length, 1);
    assert.strictEqual(speler.body[0].data.tekst, 'Beste lezer,');

    const archief = await req(server, 'GET', '/api/archief', null, dmCookie);
    assert.ok(archief.body.logEntries.length > 0);
    assert.strictEqual(archief.body.logEntries[0].event, 'Test Brief');
  });

  it('houdt de inhoud van een vaag document weg bij de speler', async () => {
    const doc = await req(server, 'POST', '/api/entities/documenten', {
      name: 'Wazig Document', data: { docType: 'Kaart', desc: 'Geheime aanwijzing', tekst: 'Onder de derde plavuis.' },
      links: { personages: ['Hidden NPC'] },
    }, dmCookie);
    await req(server, 'PUT', `/api/entities/documenten/${doc.body.id}/visibility`, { target: 'vague' }, dmCookie);
    const speler = await req(server, 'GET', '/api/entities/documenten', null, spelerCookie);
    const vaag = speler.body.find(d => d.name === 'Wazig Document');
    assert.ok(vaag, 'de speler ziet dát het bestaat');
    assert.strictEqual(vaag._visibility, 'vague');
    assert.deepStrictEqual(vaag.data, {}, 'maar niets van de inhoud');
  });

  // Delete
  it('should delete entity', async () => {
    const list = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    const doelwit = list.body[0];
    const res = await req(server, 'DELETE', `/api/entities/personages/${doelwit.id}`, null, dmCookie);
    assert.strictEqual(res.body.ok, true);
    const after = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    assert.strictEqual(after.body.length, list.body.length - 1);
    assert.ok(!after.body.some(e => e.id === doelwit.id));
  });

  // Meta
  it('should return meta with a hoofdstukken object', async () => {
    const res = await req(server, 'GET', '/api/meta');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body.hoofdstukken, 'object');
    assert.ok(res.body.appTitle);
  });
});
