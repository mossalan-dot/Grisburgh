const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Geheime verbindingen ─────────────────────────────────────────────────────
// De vriendelijke waard is stiekem de leider van de bende. Beide kaartjes mogen
// bekend zijn; dát ze samenhangen is de plot. De verbinding hangt daarom aan een
// geheimregel: zolang die dicht is bestaat de verbinding voor die party niet —
// niet op het bendekaartje, en ook niet op de afgeleide andere kant.

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-gv-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Geheime verbindingen', () => {
  let server, io, dm, speler, spelerC, bram, knecht, bende;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Aria', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: speler })).cookie;

    bram = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Bram Kruik',
      data: { geheimen: JSON.stringify(['Hij schenkt aangelengd bier.', 'Hij leidt De Roodzwaarden.']) },
    }, dm)).body;
    knecht = (await req(server, 'POST', '/api/entities/personages', { name: 'Kleine Joris', data: {} }, dm)).body;

    bende = (await req(server, 'POST', '/api/entities/organisaties', {
      name: 'De Roodzwaarden',
      data: { betrokkenen: JSON.stringify([
        // Openlijk lid
        { naam: 'Kleine Joris', rol: 'Loopjongen', id: knecht.id, chef: 'Bram Kruik' },
        // Geheim: hangt aan regel 1 (de tweede) van Brams geheimen
        { naam: 'Bram Kruik', rol: 'Leider', id: bram.id, geheim: { id: bram.id, i: 1 } },
      ]) },
    }, dm)).body;

    // Alles zichtbaar voor de party: het gaat hier alleen om het geheim.
    for (const id of [bram.id, knecht.id, bende.id]) {
      await req(server, 'PUT', `/api/entities/${id === bende.id ? 'organisaties' : 'personages'}/${id}/visibility`, { target: 'visible' }, dm);
    }
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const rijenVoorSpeler = async () =>
    JSON.parse((await req(server, 'GET', `/api/entities/organisaties/${bende.id}`, null, spelerC)).body.data.betrokkenen || '[]');

  it('verbergt de verbinding zolang het geheim dicht staat', async () => {
    const rijen = await rijenVoorSpeler();
    assert.equal(rijen.length, 1, 'alleen de loopjongen');
    assert.ok(!rijen.some(r => r.rol === 'Leider'), 'geen leider-regel');
    assert.ok(!JSON.stringify(rijen).includes('Bram'), 'ook de naam niet');
  });

  it('verklapt niet dát er een verbinding is', async () => {
    const rijen = await rijenVoorSpeler();
    // Anders dan bij een onbekende betrokkene komt er géén "onbekend"-regel:
    // dat er een leider is, is hier juist de clou.
    assert.ok(!rijen.some(r => r.onbekend), 'geen schuilnaam-regel');
  });

  it('laat wie eronder hing niet aan een dode naam hangen', async () => {
    const joris = (await rijenVoorSpeler()).find(r => r.rol === 'Loopjongen');
    assert.ok(!joris.chef || joris.chef !== 'Bram Kruik',
      'de loopjongen wijst niet meer naar een naam die er niet is');
  });

  it('houdt de verbinding ook van de andere kant weg', async () => {
    const bramVoorSpeler = (await req(server, 'GET', `/api/entities/personages/${bram.id}`, null, spelerC)).body;
    const hoortBij = bramVoorSpeler._hoortBij || [];
    assert.ok(!hoortBij.some(x => x.id === bende.id), 'De Roodzwaarden staat niet op Brams kaartje');
  });

  it('toont hem zodra de DM dat geheim onthult', async () => {
    await req(server, 'PUT', `/api/entities/personages/${bram.id}/secret`, { index: 1 }, dm);
    const rijen = await rijenVoorSpeler();
    const leider = rijen.find(r => r.rol === 'Leider');
    assert.ok(leider, 'de leider-regel staat er nu');
    assert.equal(leider.naam, 'Bram Kruik');
    const bramNu = (await req(server, 'GET', `/api/entities/personages/${bram.id}`, null, spelerC)).body;
    assert.ok((bramNu._hoortBij || []).some(x => x.id === bende.id), 'en op Brams kaartje ook');
  });

  it('laat het andere geheim met rust', async () => {
    const bramNu = (await req(server, 'GET', `/api/entities/personages/${bram.id}`, null, spelerC)).body;
    const geheimen = JSON.parse(bramNu.data.geheimen || '[]');
    assert.equal(geheimen.length, 1, 'alleen het onthulde geheim');
    assert.ok(geheimen[0].includes('Roodzwaarden'));
  });

  it('verbergt hem weer als de DM het terugdraait', async () => {
    await req(server, 'PUT', `/api/entities/personages/${bram.id}/secret`, { index: 1 }, dm);
    assert.ok(!(await rijenVoorSpeler()).some(r => r.rol === 'Leider'));
  });

  it('geeft de verwijzing niet mee aan de speler', async () => {
    await req(server, 'PUT', `/api/entities/personages/${bram.id}/secret`, { index: 1 }, dm);
    const rijen = await rijenVoorSpeler();
    assert.ok(!rijen.some(r => r.geheim), 'de administratie blijft bij de DM');
  });

  // ── Geheimregels worden op positie geadresseerd ──
  // De onthulstand per party én een geheime verbinding wijzen naar regel N.
  // Haalt de DM regel 0 weg, dan schuift alles op; zonder correctie gaat de
  // administratie daarna over een ánder geheim.

  it('houdt de onthulstand bij de juiste regel als er een regel weggaat', async () => {
    const k = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Drieluik', data: { geheimen: JSON.stringify(['Eerste.', 'Tweede.', 'Derde.']) } }, dm)).body;
    await req(server, 'PUT', `/api/entities/personages/${k.id}/visibility`, { target: 'visible' }, dm);
    await req(server, 'PUT', `/api/entities/personages/${k.id}/secret`, { index: 2 }, dm);

    const zichtbaar = async () => JSON.parse(
      (await req(server, 'GET', `/api/entities/personages/${k.id}`, null, spelerC)).body.data.geheimen || '[]');
    assert.deepEqual(await zichtbaar(), ['Derde.']);

    await req(server, 'PUT', `/api/entities/personages/${k.id}`,
      { data: { geheimen: JSON.stringify(['Tweede.', 'Derde.']) } }, dm);
    assert.deepEqual(await zichtbaar(), ['Derde.'], 'nog steeds de derde, niet de tweede');

    await req(server, 'PUT', `/api/entities/personages/${k.id}`,
      { data: { geheimen: JSON.stringify(['Derde.', 'Tweede.']) } }, dm);
    assert.deepEqual(await zichtbaar(), ['Derde.'], 'ook na omdraaien');
  });

  it('houdt een geheime verbinding aan het juiste geheim als er een regel weggaat', async () => {
    const baas = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Baas', data: { geheimen: JSON.stringify(['Onbelangrijk.', 'Hij leidt de club.']) } }, dm)).body;
    const club = (await req(server, 'POST', '/api/entities/organisaties', {
      name: 'De Club',
      data: { betrokkenen: JSON.stringify([{ naam: 'Baas', rol: 'Leider', id: baas.id, geheim: { id: baas.id, i: 1 } }]) },
    }, dm)).body;
    for (const [t, id] of [['personages', baas.id], ['organisaties', club.id]]) {
      await req(server, 'PUT', `/api/entities/${t}/${id}/visibility`, { target: 'visible' }, dm);
    }
    const rollen = async () => JSON.parse(
      (await req(server, 'GET', `/api/entities/organisaties/${club.id}`, null, spelerC)).body.data.betrokkenen || '[]')
      .map(r => r.rol);
    assert.deepEqual(await rollen(), [], 'nog verborgen');

    // Het onbelangrijke geheim gaat weg; het echte schuift naar plek 0.
    await req(server, 'PUT', `/api/entities/personages/${baas.id}`,
      { data: { geheimen: JSON.stringify(['Hij leidt de club.']) } }, dm);
    await req(server, 'PUT', `/api/entities/personages/${baas.id}/secret`, { index: 0 }, dm);
    assert.deepEqual(await rollen(), ['Leider'], 'de verbinding volgt het geheim');
  });

  it('maakt de verbinding gewoon zichtbaar als het geheim-kaartje verdwijnt', async () => {
    const los = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Tijdelijk Geheim', data: { geheimen: JSON.stringify(['Iets.']) } }, dm)).body;
    const club = (await req(server, 'POST', '/api/entities/organisaties', {
      name: 'De Losse Club',
      data: { betrokkenen: JSON.stringify([{ naam: 'Kleine Joris', rol: 'Lid', id: knecht.id, geheim: { id: los.id, i: 0 } }]) },
    }, dm)).body;
    await req(server, 'DELETE', `/api/entities/personages/${los.id}`, null, dm);
    const na = JSON.parse((await req(server, 'GET', `/api/entities/organisaties/${club.id}`, null, dm)).body.data.betrokkenen || '[]');
    assert.ok(!na[0].geheim, 'de dode verwijzing is opgeruimd');
  });
});
