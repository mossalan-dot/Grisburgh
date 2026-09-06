const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Wie heeft dit voorwerp? ──────────────────────────────────────────────────
// `itemOwners` staat per party. De DM kijkt naar één party tegelijk, maar de
// vraag "wie heeft dit" gaat over alle party's — anders lijkt een voorwerp bij
// niemand te liggen terwijl de andere groep het al drie sessies draagt. Dat is
// ook waarom een aantal bijstellen mis ging: dat keek naar de actieve groep.

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-bezit-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Bezit van een voorwerp', () => {
  let server, io, dm, A, C, andere, fles;

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
    A = await speler('Eerste', 'groep1');
    await req(server, 'POST', '/api/groups', { name: 'Tweede party' }, dm);
    andere = (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === 'Tweede party').id;
    C = await speler('Tweede', andere);

    fles = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Fles Vuurwater', data: { gebruik: 'stapelbaar', maxCharges: '3' } }, dm)).body.id;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('toont eigenaren uit alle party\'s, niet alleen de actieve', async () => {
    await req(server, 'PUT', `/api/items/${fles}/owner`, { characterId: A, playerName: 'Eerste', groupId: 'groep1', qty: 2 }, dm);
    await req(server, 'PUT', `/api/items/${fles}/owner`, { characterId: C, playerName: 'Tweede', groupId: andere, qty: 1 }, dm);

    const r = await req(server, 'GET', `/api/items/${fles}/bezit`, null, dm);
    assert.equal(r.status, 200);
    assert.equal(r.body.gebruik, 'stapelbaar');
    const perGroep = Object.fromEntries(r.body.groepen.map(g => [g.id, g.rijen]));
    assert.equal(perGroep['groep1'][0].aantal, 2);
    assert.equal(perGroep[andere][0].aantal, 1, 'de andere party staat er ook bij');
    assert.deepEqual(perGroep['groep1'][0].charges, { nu: 3, max: 3 }, 'charges komen mee');
  });

  it('stelt een aantal bij in de party van de speler, niet in de actieve', async () => {
    // De DM kijkt naar groep 1; C zit in de tweede party.
    const r = await req(server, 'PATCH', `/api/items/${fles}/owner/${C}`, { delta: 2 }, dm);
    assert.equal(r.status, 200, 'geen 404 meer omdat er in de verkeerde groep gezocht werd');
    assert.equal(r.body.qty, 3);

    const bezit = (await req(server, 'GET', `/api/items/${fles}/bezit`, null, dm)).body;
    const tweede = bezit.groepen.find(g => g.id === andere);
    assert.equal(tweede.rijen[0].aantal, 3);
  });

  it('haalt een eigenaar weg uit de juiste party', async () => {
    await req(server, 'DELETE', `/api/items/${fles}/owner?characterId=${C}&groupId=${andere}`, null, dm);
    const bezit = (await req(server, 'GET', `/api/items/${fles}/bezit`, null, dm)).body;
    assert.ok(!bezit.groepen.some(g => g.id === andere), 'de tweede party heeft hem niet meer');
    assert.ok(bezit.groepen.some(g => g.id === 'groep1'), 'de eerste party wel nog');
  });

  it('is niet te bereiken zonder DM-sessie', async () => {
    const r = await req(server, 'GET', `/api/items/${fles}/bezit`);
    assert.ok(r.status === 401 || r.status === 403, `verwacht geweigerd, kreeg ${r.status}`);
  });

  it('leidt "Te koop" af uit de voorraad van de winkel', async () => {
    const winkel = (await req(server, 'POST', '/api/entities/locaties', {
      name: 'Het Vaatje', data: { locType: 'Winkel', voorraad: JSON.stringify([
        { naam: 'Fles Vuurwater', prijs: '4 fl', entityId: fles },
      ]) },
    }, dm)).body;

    const item = (await req(server, 'GET', `/api/entities/voorwerpen/${fles}`, null, dm)).body;
    const rij = (item._hoortBij || []).find(r => r.id === winkel.id);
    assert.ok(rij, 'de winkel staat bij het voorwerp');
    assert.equal(rij.rol, 'Te koop');
    assert.equal(rij.tab, 'voorraad', 'de doorklik gaat naar het voorraadtabblad');
  });
});
