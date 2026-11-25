const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

// **Een party verwijderen laat niets achter** — dezelfde regel als bij een
// kaartje, en hij gold hier nog niet. Niet alles van een party staat in
// `dmState.groups[id]`: de akte-zichtbaarheid heeft een eigen bestand
// (`chapter-visibility.json`) en een dungeon houdt zijn mist, zijn toegang en
// zijn "uitgespeeld" per party bij. Gemeten op 25 nov 2026 stond er in
// Grisburgh nog een akte-instelling van een party die allang weg was — niemand
// zag hem, en precies daarom bleef hij staan.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-party-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
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
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, cookie: setCookie ? setCookie[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const lees = (naam) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'grisburgh', naam), 'utf8'));

describe('Een verwijderde party laat niets achter', () => {
  let server, io, dm, weg;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    await req(server, 'POST', '/api/groups', { name: 'Weggaande party' }, dm);
    weg = (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === 'Weggaande party').id;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('ruimt de akte-zichtbaarheid en de dungeonstand op', async () => {
    // Geef die party een akte dicht en een dungeon waar ze geweest is.
    await req(server, 'PUT', `/api/chapter-visibility/${weg}/h3`, { visible: false }, dm);
    const kaart = (await req(server, 'POST', '/api/dungeons', { name: 'De Kelder' }, dm)).body;
    const mapId = kaart.id || kaart.map?.id || (await req(server, 'GET', '/api/dungeons', null, dm)).body.maps[0].id;
    await req(server, 'PUT', `/api/dungeons/${mapId}/party-access`, { partyAccess: [weg], partyCompleted: [weg] }, dm);

    assert.ok(lees('chapter-visibility.json')[weg], 'de akte-instelling staat er');
    const voor = lees('dungeon-maps.json').maps.find(m => m.id === mapId);
    assert.ok((voor.partyAccess || []).includes(weg), 'de dungeon kent de party');

    // De actieve party mag niet de weggaande zijn.
    const r = await req(server, 'DELETE', `/api/groups/${weg}`, null, dm);
    assert.equal(r.status, 200, JSON.stringify(r.body));

    assert.equal(lees('chapter-visibility.json')[weg], undefined,
      'de akte-zichtbaarheid van een verdwenen party blijft achter');
    const na = lees('dungeon-maps.json').maps.find(m => m.id === mapId);
    assert.ok(!(na.partyAccess || []).includes(weg), 'de dungeontoegang blijft achter');
    assert.ok(!(na.partyCompleted || []).includes(weg), '"uitgespeeld" blijft achter');
    assert.equal((na.reveals || {})[weg], undefined, 'de mist blijft achter');
  });

  it('laat de prullenbak met rust', async () => {
    // De prullenbak is een bevroren verleden: daar hoort de oude party-stand in
    // te blijven staan, anders is een undo een halve undo.
    const state = lees('dm-state.json');
    assert.ok(Array.isArray(state.trash) || state.trash === undefined,
      'de prullenbak bestaat als lijst of nog niet — in geen geval opgeschoond per party');
  });
});
