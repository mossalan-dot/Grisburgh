const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Aanwezigheid per sessie: de DM vinkt af wie er vanavond aan tafel zit. Wat er
// aan tafel gebeurt (rust, loot, gevecht) gaat alleen over de aanwezigen; wat de
// hele party betreft (sheets, berichten) blijft voor iedereen gelden.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-aanw-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Aanwezigheid per sessie', () => {
  let server, io, dm, aanwezig, afwezig;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dm = (await req(server, 'POST', '/api/auth/login', { password: 'grisburgh-dm' })).cookie;
    const maak = async (naam) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    aanwezig = await maak('Blijft Thuisloos');
    afwezig  = await maak('Mist De Sessie');
    // Allebei gewond, zodat een lange rust zichtbaar verschil maakt.
    for (const id of [aanwezig, afwezig]) {
      await req(server, 'PATCH', `/api/player-hp/${id}`, { current: 4, max: 20 }, dm);
    }
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('begint met iedereen aanwezig', async () => {
    const r = await req(server, 'GET', '/api/groups', null, dm);
    const g = (r.body.groups || []).find(x => x.id === 'groep1');
    assert.deepEqual(g.afwezig, [], 'een verse party heeft niemand als afwezig staan');
  });

  it('bewaart wie er niet is', async () => {
    const r = await req(server, 'PUT', '/api/groups/groep1/aanwezigheid', { afwezig: [afwezig] }, dm);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.afwezig, [afwezig]);
    const lijst = await req(server, 'GET', '/api/groups', null, dm);
    assert.deepEqual((lijst.body.groups || []).find(x => x.id === 'groep1').afwezig, [afwezig]);
  });

  it('negeert ids die niet in de party zitten', async () => {
    const r = await req(server, 'PUT', '/api/groups/groep1/aanwezigheid', { afwezig: [afwezig, 'e_bestaat_niet'] }, dm);
    assert.deepEqual(r.body.afwezig, [afwezig], 'een typefout hoort er niet stilzwijgend in te blijven staan');
  });

  it('laat een afwezige speler niet meerusten', async () => {
    await req(server, 'PUT', '/api/groups/groep1/aanwezigheid', { afwezig: [afwezig] }, dm);
    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    const hpA = await req(server, 'GET', `/api/player-hp/${aanwezig}`, null, dm);
    const hpB = await req(server, 'GET', `/api/player-hp/${afwezig}`, null, dm);
    assert.equal(hpA.body.current, 20, 'wie aan tafel zit, wordt van een lange rust weer heel');
    assert.equal(hpB.body.current, 4,  'wie er niet is, verandert niet — die rust in zijn eigen verhaal');
  });

  it('laat een afwezige speler niet meedelen in de loot', async () => {
    await req(server, 'PUT', '/api/groups/groep1/aanwezigheid', { afwezig: [afwezig] }, dm);
    const start = await req(server, 'POST', '/api/combat/loot/start', {}, dm);
    assert.ok(start.body.deelnemers.includes(aanwezig));
    assert.ok(!start.body.deelnemers.includes(afwezig), 'je kunt niet claimen uit een kist waar je niet bij stond');
  });

  it('laat iedereen weer meedoen zodra de lijst leeg is', async () => {
    await req(server, 'PUT', '/api/groups/groep1/aanwezigheid', { afwezig: [] }, dm);
    const start = await req(server, 'POST', '/api/combat/loot/start', {}, dm);
    assert.ok(start.body.deelnemers.includes(afwezig));
  });
});
