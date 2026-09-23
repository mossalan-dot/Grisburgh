const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Een tafel kan aan een voorwerp hangen: een Wand of Wonder rolt zijn eigen
// tabel. De tafelbibliotheek blijft DM-only — daar staat in wat de spelers nog
// moeten tegenkomen — maar de ene tafel die aan jóuw voorwerp hangt mag je
// zien. Deze tests bewaken precies die grens.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-tafels-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Tafels aan een voorwerp', () => {
  let server, io, dm, bezitter, vreemde, staf, kaalItem, tafelId, spelerCookie;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const maak = async (naam) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    bezitter = await maak('Zwaait De Staf');
    vreemde  = await maak('Kijkt Ernaar');

    tafelId = (await req(server, 'POST', '/api/tables', {
      name: 'Staf der Wonderen', type: 'weighted', dobbel: 'd6',
      entries: ['1-2: er gebeurt niets', '3-4: vonken', '5-6: een kat'],
    }, dm)).body.id;

    staf = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Staf der Wonderen', data: { tafelId } }, dm)).body.id;
    kaalItem = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Gewone stok', data: {} }, dm)).body.id;

    // PUT is de DM die uitdeelt; PATCH stelt alleen een bestaand aantal bij.
    await req(server, 'PUT', `/api/items/${staf}/owner`, { characterId: bezitter, playerName: 'Zwaait De Staf' }, dm);

    const groups = (await req(server, 'GET', '/api/groups', null, dm)).body.groups || [];
    const wachtwoord = groups.find(g => g.id === 'groep1')?.password;
    spelerCookie = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: bezitter, password: wachtwoord })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('bewaart de dobbelsteen van een gewogen tafel', async () => {
    const t = (await req(server, 'GET', '/api/tables', null, dm)).body.find(x => x.id === tafelId);
    assert.equal(t.dobbel, 'd6', 'een tabel uit een akte is net zo vaak d6 als d100');
  });

  it('geeft de DM de tafel die aan een voorwerp hangt', async () => {
    const r = await req(server, 'GET', `/api/items/${staf}/tafel`, null, dm);
    assert.equal(r.status, 200);
    assert.equal(r.body.id, tafelId);
    assert.equal(r.body.entries.length, 3);
  });

  it('geeft de tafel ook aan de speler die het voorwerp bezit', async () => {
    const r = await req(server, 'GET', `/api/items/${staf}/tafel`, null, spelerCookie);
    assert.equal(r.status, 200, 'een Wand of Wonder is van de speler; die mag hem zwaaien');
    assert.equal(r.body.id, tafelId);
  });

  it('houdt de tafelbibliotheek dicht voor een speler', async () => {
    const r = await req(server, 'GET', '/api/tables', null, spelerCookie);
    assert.ok(r.status === 403 || r.status === 401,
      'de bibliotheek staat vol met wat de spelers nog moeten tegenkomen');
  });

  it('weigert de tafel aan wie het voorwerp niet heeft', async () => {
    const groups = (await req(server, 'GET', '/api/groups', null, dm)).body.groups || [];
    const wachtwoord = groups.find(g => g.id === 'groep1')?.password;
    const ander = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: vreemde, password: wachtwoord })).cookie;
    const r = await req(server, 'GET', `/api/items/${staf}/tafel`, null, ander);
    assert.equal(r.status, 403, 'je rolt niet met andermans staf');
  });

  it('zegt netjes dat er geen tafel hangt', async () => {
    const r = await req(server, 'GET', `/api/items/${kaalItem}/tafel`, null, dm);
    assert.equal(r.status, 404);
  });
});
