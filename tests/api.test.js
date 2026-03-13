const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

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
  let server, io, dmCookie;

  before(async () => {
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true });
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
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true });
  });

  // Auth
  it('should reject wrong password', async () => {
    const res = await req(server, 'POST', '/api/auth/login', { password: 'wrong' });
    assert.strictEqual(res.status, 401);
  });

  it('should login with correct password', async () => {
    const res = await req(server, 'POST', '/api/auth/login', { password: 'grisburgh-dm' });
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

  it('should show visible entity to player without geheim', async () => {
    const list = await req(server, 'GET', '/api/entities/personages');
    assert.strictEqual(list.body.length, 1);
    assert.strictEqual(list.body[0].data.geheim, undefined);
    assert.strictEqual(list.body[0].data.desc, 'Een test personage');
  });

  it('should toggle secret reveal', async () => {
    const list = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    const id = list.body[0].id;
    const res = await req(server, 'PUT', `/api/entities/personages/${id}/secret`, null, dmCookie);
    assert.strictEqual(res.body.secretReveal, true);
    // Player should now see geheim
    const playerList = await req(server, 'GET', '/api/entities/personages');
    assert.strictEqual(playerList.body[0].data.geheim, 'Geheime info');
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

  // Archief
  it('should create archief document', async () => {
    const res = await req(server, 'POST', '/api/archief', {
      name: 'Test Brief', type: 'Brief', cat: 'brieven', desc: 'Een test document',
      icon: '\u2709\ufe0f', hoofdstuk: 'h1', npcs: ['Test NPC'], locs: ['Grisburgh'], docs: [],
    }, dmCookie);
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
  });

  it('should hide archief document from players by default', async () => {
    const res = await req(server, 'GET', '/api/archief');
    assert.strictEqual(res.body.documents.length, 0);
  });

  it('should change archief state to revealed', async () => {
    const dmList = await req(server, 'GET', '/api/archief', null, dmCookie);
    const id = dmList.body.documents[0].id;
    const res = await req(server, 'PUT', `/api/archief/${id}/state`, { state: 'revealed' }, dmCookie);
    assert.strictEqual(res.body.state, 'revealed');
    // Player should see it now
    const playerList = await req(server, 'GET', '/api/archief');
    assert.strictEqual(playerList.body.documents.length, 1);
  });

  it('should add log entry on reveal', async () => {
    const res = await req(server, 'GET', '/api/archief', null, dmCookie);
    assert.ok(res.body.logEntries.length > 0);
    assert.strictEqual(res.body.logEntries[0].event, 'Test Brief');
  });

  it('should set blurred state and hide connections from player', async () => {
    // Create second doc
    const doc = await req(server, 'POST', '/api/archief', {
      name: 'Blurred Doc', type: 'Kaart', cat: 'kaarten', npcs: ['Hidden NPC'],
    }, dmCookie);
    await req(server, 'PUT', `/api/archief/${doc.body.id}/state`, { state: 'blurred' }, dmCookie);
    const player = await req(server, 'GET', '/api/archief');
    const blurred = player.body.documents.find(d => d.name === 'Blurred Doc');
    assert.ok(blurred);
    assert.deepStrictEqual(blurred.npcs, []);
  });

  // Delete
  it('should delete entity', async () => {
    const list = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    const id = list.body[0].id;
    const res = await req(server, 'DELETE', `/api/entities/personages/${id}`, null, dmCookie);
    assert.strictEqual(res.body.ok, true);
    const after = await req(server, 'GET', '/api/entities/personages', null, dmCookie);
    assert.strictEqual(after.body.length, 0);
  });

  // Meta
  it('should return meta with hoofdstukken', async () => {
    const res = await req(server, 'GET', '/api/meta');
    assert.ok(res.body.hoofdstukken);
    assert.ok(res.body.hoofdstukken.h1);
    assert.strictEqual(res.body.hoofdstukken.h1.title, 'Dauwdag');
  });
});
