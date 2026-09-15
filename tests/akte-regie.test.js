const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Een akte draagt de verhaaltekst van de DM, het regie-script met alles wat er
// nog onthuld moet worden, en de monsters die erin voorkomen. Die gingen tot
// 15 sep 2026 integraal mee in `GET /meta` — naar iedereen met een sessie.
// Zolang `tekst` overal leeg was viel er niets te halen, maar de eerste akte
// die erin gaat zou compleet met geheimen in de browser van de spelers staan.
// Zelfde soort lek als destijds de kamernamen in een dungeon.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-akte-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Akteregie: tekst en script blijven bij de DM', () => {
  let server, io, dm, speler;
  const GEHEIM = 'De waard is de moordenaar.';

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    await req(server, 'PUT', '/api/meta/hoofdstuk/h1', { num: 1, title: 'Dauwdag', short: 'A1' }, dm);
    await req(server, 'PUT', '/api/meta/akte/h1/tekst', { tekst: `## Aankomst\n\n${GEHEIM}` }, dm);

    // Een speler met een eigen personage in de actieve groep.
    const ent = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Testspeler', subtype: 'speler' }, dm)).body;
    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    const gid = (Array.isArray(groepen) ? groepen[0] : Object.values(groepen)[0])?.id
             || Object.keys((await req(server, 'GET', '/api/dm-state', null, dm)).body?.groups || {})[0];
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    await req(server, 'PATCH', `/api/entities/personages/${ent.id}`, { data: { groep: gid } }, dm);
    const login = await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: ent.id, password: 'proef1234' });
    speler = login.cookie;
    assert.equal(login.status, 200, 'de speler moet kunnen inloggen voor deze test');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('geeft de DM de tekst gewoon mee', async () => {
    const meta = (await req(server, 'GET', '/api/meta', null, dm)).body;
    assert.ok(meta.hoofdstukken.h1.tekst.includes(GEHEIM));
  });

  it('stuurt geen tekst, script of monsters naar een speler', async () => {
    const meta = (await req(server, 'GET', '/api/meta', null, speler)).body;
    const akte = meta.hoofdstukken.h1;
    assert.equal(akte.tekst, undefined, 'de verhaaltekst hoort niet bij de speler');
    assert.equal(akte.script, undefined, 'het regie-script hoort niet bij de speler');
    assert.equal(akte.monsters, undefined, 'de monsterlijst hoort niet bij de speler');
    assert.ok(!JSON.stringify(meta).includes(GEHEIM), 'geen enkel spoor van de tekst in het antwoord');
  });

  it('laat de kop wél staan — daar groepeert het logboek op', async () => {
    const akte = (await req(server, 'GET', '/api/meta', null, speler)).body.hoofdstukken.h1;
    assert.equal(akte.num, 1);
    assert.equal(akte.title, 'Dauwdag');
    assert.equal(akte.short, 'A1');
  });

  it('levert de regie van één akte op een eigen DM-route', async () => {
    const r = await req(server, 'GET', '/api/meta/akte/h1/regie', null, dm);
    assert.equal(r.status, 200);
    assert.ok(r.body.tekst.includes(GEHEIM));
    assert.ok(Array.isArray(r.body.script));
  });

  it('weigert die route voor een speler', async () => {
    const r = await req(server, 'GET', '/api/meta/akte/h1/regie', null, speler);
    assert.equal(r.status, 403);
  });
});
