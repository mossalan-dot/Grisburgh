const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Koppelingen tussen kaartjes ──────────────────────────────────────────────
// Een koppeling bewaart een id én de naam zoals hij toen was. Het id blijft
// kloppen als je hernoemt, de naam niet — die moet meelopen, anders staat
// dezelfde persoon onder twee namen in de app. En een verwijderd kaartje mag
// geen knop achterlaten die naar niets leidt.

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-koppel-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Koppelingen tussen kaartjes', () => {
  let server, io, dm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    const login = await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' });
    dm = login.cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const rijenVan = async (id) =>
    JSON.parse((await req(server, 'GET', `/api/entities/locaties/${id}`, null, dm)).body.data.betrokkenen || '[]');

  it('hernoemen laat de naam in koppelingen meelopen', async () => {
    const waard = (await req(server, 'POST', '/api/entities/personages', { name: 'Oude Naam', data: {} }, dm)).body;
    const knecht = (await req(server, 'POST', '/api/entities/personages', { name: 'De Knecht', data: {} }, dm)).body;
    const wijk = (await req(server, 'POST', '/api/entities/locaties', { name: 'Oude Wijk', data: {} }, dm)).body;
    const kroeg = (await req(server, 'POST', '/api/entities/locaties', {
      name: 'De Kroeg',
      data: {
        wijk: 'Oude Wijk', wijkId: wijk.id,
        eigenaar: 'Oude Naam', eigenaarId: waard.id,
        betrokkenen: JSON.stringify([
          { naam: 'Oude Naam', rol: 'Eigenaar', id: waard.id },
          { naam: 'De Knecht', rol: 'Personeel', id: knecht.id, chef: 'Oude Naam' },
        ]),
      },
    }, dm)).body;

    await req(server, 'PUT', `/api/entities/personages/${waard.id}`, { name: 'Nieuwe Naam' }, dm);
    const rijen = await rijenVan(kroeg.id);
    assert.strictEqual(rijen[0].naam, 'Nieuwe Naam', 'de naam in de lijst loopt mee');
    assert.strictEqual(rijen[0].id, waard.id, 'de koppeling blijft staan');
    assert.strictEqual(rijen[1].chef, 'Nieuwe Naam', '"valt onder" wijst naar een naam en loopt dus ook mee');

    const kroegNa = (await req(server, 'GET', `/api/entities/locaties/${kroeg.id}`, null, dm)).body;
    assert.strictEqual(kroegNa.data.eigenaar, 'Nieuwe Naam', 'het losse eigenaar-veld ook');

    // En een hernoemde locatie in het gebiedsveld.
    await req(server, 'PUT', `/api/entities/locaties/${wijk.id}`, { name: 'Nieuwe Wijk' }, dm);
    const kroegNa2 = (await req(server, 'GET', `/api/entities/locaties/${kroeg.id}`, null, dm)).body;
    assert.strictEqual(kroegNa2.data.wijk, 'Nieuwe Wijk');
    assert.strictEqual(kroegNa2.data.wijkId, wijk.id);
  });

  it('verwijderen laat de naam staan maar haalt de koppeling weg', async () => {
    const gast = (await req(server, 'POST', '/api/entities/personages', { name: 'Tijdelijke Gast', data: {} }, dm)).body;
    const herberg = (await req(server, 'POST', '/api/entities/locaties', {
      name: 'De Herberg', data: { betrokkenen: JSON.stringify([{ naam: 'Tijdelijke Gast', rol: 'Stamgast', id: gast.id }]) },
    }, dm)).body;

    await req(server, 'DELETE', `/api/entities/personages/${gast.id}`, null, dm);
    const rijen = await rijenVan(herberg.id);
    assert.strictEqual(rijen.length, 1, 'de regel blijft staan');
    assert.strictEqual(rijen[0].naam, 'Tijdelijke Gast', 'de naam blijft leesbaar');
    assert.strictEqual(rijen[0].id, '', 'maar de knop naar een weggegooid kaartje gaat eraf');
  });

  it('meerdere rollen op dezelfde plek blijven staan', async () => {
    const npc = (await req(server, 'POST', '/api/entities/personages', { name: 'De Waard-Verkoper', data: {} }, dm)).body;
    const kroeg = (await req(server, 'POST', '/api/entities/locaties', { name: 'De Dubbelrol', data: {} }, dm)).body;

    // Iemand kan eigenaar én verkoper zijn op dezelfde plek.
    await req(server, 'PUT', `/api/entities/personages/${npc.id}/hoortbij`, { rijen: [
      { id: kroeg.id, rol: 'Eigenaar' },
      { id: kroeg.id, rol: 'Verkoper' },
    ] }, dm);
    let rijen = await rijenVan(kroeg.id);
    assert.deepStrictEqual(rijen.map(r => r.rol).sort(), ['Eigenaar', 'Verkoper'],
      'beide rollen staan op het kaartje');

    // En terug te lezen vanaf de andere kant.
    const na = (await req(server, 'GET', `/api/entities/personages/${npc.id}`, null, dm)).body;
    assert.strictEqual((na._hoortBij || []).filter(x => x.id === kroeg.id).length, 2);

    // Twee keer exact dezelfde verbinding is geen tweede verbinding.
    await req(server, 'PUT', `/api/entities/personages/${npc.id}/hoortbij`, { rijen: [
      { id: kroeg.id, rol: 'Eigenaar' },
      { id: kroeg.id, rol: 'eigenaar' },
    ] }, dm);
    rijen = await rijenVan(kroeg.id);
    assert.strictEqual(rijen.length, 1, 'een exacte herhaling valt weg: ' + JSON.stringify(rijen.map(r => r.rol)));

    // Eén rol weghalen laat de andere staan.
    await req(server, 'PUT', `/api/entities/personages/${npc.id}/hoortbij`, { rijen: [
      { id: kroeg.id, rol: 'Eigenaar' },
      { id: kroeg.id, rol: 'Verkoper' },
    ] }, dm);
    await req(server, 'PUT', `/api/entities/personages/${npc.id}/hoortbij`, { rijen: [
      { id: kroeg.id, rol: 'Verkoper' },
    ] }, dm);
    rijen = await rijenVan(kroeg.id);
    assert.deepStrictEqual(rijen.map(r => r.rol), ['Verkoper']);
  });

  it('"hoort bij" schrijft in het doelkaartje en haalt het er ook weer uit', async () => {
    const npc = (await req(server, 'POST', '/api/entities/personages', { name: 'De Smid', data: {} }, dm)).body;
    const smidse = (await req(server, 'POST', '/api/entities/locaties', {
      name: 'De Smidse', data: { betrokkenen: JSON.stringify([{ naam: 'Iemand Anders', rol: 'Bewoner', id: '' }]) },
    }, dm)).body;

    await req(server, 'PUT', `/api/entities/personages/${npc.id}/hoortbij`,
      { rijen: [{ id: smidse.id, rol: 'Eigenaar' }] }, dm);
    let rijen = await rijenVan(smidse.id);
    assert.ok(rijen.some(r => r.id === npc.id && r.rol === 'Eigenaar'), 'de regel staat erbij');
    assert.ok(rijen.some(r => r.naam === 'Iemand Anders'), 'bestaande regels blijven staan');

    const na = (await req(server, 'GET', `/api/entities/personages/${npc.id}`, null, dm)).body;
    assert.ok((na._hoortBij || []).some(x => x.id === smidse.id), 'en is af te leiden vanaf de andere kant');

    await req(server, 'PUT', `/api/entities/personages/${npc.id}/hoortbij`, { rijen: [] }, dm);
    rijen = await rijenVan(smidse.id);
    assert.ok(!rijen.some(r => r.id === npc.id), 'weghalen werkt ook van de andere kant');
    assert.strictEqual(rijen.length, 1, 'en raakt de rest niet');
  });
});
