const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

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

describe('Server-side filtering', () => {
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
    const login = await req(server, 'POST', '/api/auth/login', { password: 'grisburgh-dm' });
    dmCookie = login.cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true });
  });

  it('hidden entity is omitted for players', async () => {
    await req(server, 'POST', '/api/entities/locaties', {
      name: 'Hidden Fort', data: { desc: 'Secret location' },
    }, dmCookie);
    const player = await req(server, 'GET', '/api/entities/locaties');
    assert.strictEqual(player.body.length, 0);
  });

  it('geheim field is stripped for players unless secretReveal', async () => {
    const create = await req(server, 'POST', '/api/entities/personages', {
      name: 'Secret NPC', data: { desc: 'Visible', geheim: 'Top secret' },
    }, dmCookie);
    const id = create.body.id;
    // Make visible
    await req(server, 'PUT', `/api/entities/personages/${id}/visibility`, null, dmCookie);
    // Player sees desc but not geheim
    let player = await req(server, 'GET', '/api/entities/personages');
    assert.strictEqual(player.body[0].data.desc, 'Visible');
    assert.strictEqual(player.body[0].data.geheim, undefined);
    // Toggle secret reveal
    await req(server, 'PUT', `/api/entities/personages/${id}/secret`, null, dmCookie);
    player = await req(server, 'GET', '/api/entities/personages');
    assert.strictEqual(player.body[0].data.geheim, 'Top secret');
  });

  it('hidden archief documents are invisible to players', async () => {
    await req(server, 'POST', '/api/archief', { name: 'Secret Map', cat: 'kaarten' }, dmCookie);
    const player = await req(server, 'GET', '/api/archief');
    const found = player.body.documents.find(d => d.name === 'Secret Map');
    assert.strictEqual(found, undefined);
  });

  it('blurred archief documents hide connections from players', async () => {
    const doc = await req(server, 'POST', '/api/archief', {
      name: 'Blurry Letter', cat: 'brieven', npcs: ['Someone'], locs: ['Somewhere'],
    }, dmCookie);
    await req(server, 'PUT', `/api/archief/${doc.body.id}/state`, { state: 'blurred' }, dmCookie);
    const player = await req(server, 'GET', '/api/archief');
    const found = player.body.documents.find(d => d.name === 'Blurry Letter');
    assert.ok(found);
    assert.deepStrictEqual(found.npcs, []);
    assert.deepStrictEqual(found.locs, []);
  });

  it('DM notes are never visible to players', async () => {
    const create = await req(server, 'POST', '/api/entities/organisaties', {
      name: 'Test Org', data: {},
    }, dmCookie);
    const id = create.body.id;
    await req(server, 'PUT', `/api/dm/notes/${id}`, { note: 'DM secret note' }, dmCookie);
    const playerRes = await req(server, 'GET', `/api/dm/notes/${id}`);
    assert.strictEqual(playerRes.status, 403);
  });

  it('tekst content only visible for revealed docs to players', async () => {
    const doc = await req(server, 'POST', '/api/archief', { name: 'Tekst Doc', cat: 'codex' }, dmCookie);
    const id = doc.body.id;
    await req(server, 'PUT', `/api/archief/${id}/tekst`, { tekst: 'Secret text' }, dmCookie);
    // As hidden: player gets no tekst
    let player = await req(server, 'GET', '/api/archief');
    assert.strictEqual(player.body.tekstContent[id], undefined);
    // As revealed: player gets tekst
    await req(server, 'PUT', `/api/archief/${id}/state`, { state: 'revealed' }, dmCookie);
    player = await req(server, 'GET', '/api/archief');
    assert.strictEqual(player.body.tekstContent[id], 'Secret text');
  });
});
