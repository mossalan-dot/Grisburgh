const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Harmen Jonker ís in het geheim Hugo Grisburgh II.**
// De DM heeft dan twee kaartjes: het pseudoniem dat de party kent en het echte
// dat ze nog niet kennen. `data.aliasVan` op het pseudoniem wijst naar het
// echte; de andere kant is afgeleid.
//
// Samenvallen is een stand **per party**, want onthullen is per party en een
// kaartje is van de hele campagne — het aliaskaartje weggooien zou de waard ook
// wegnemen bij de tafel die hem nog gewoon kent. Zie `docs/voorstel-alias.md`.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-alias-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
        const sc = res.headers['set-cookie'];
        let b; try { b = JSON.parse(data); } catch { b = data; }
        resolve({ status: res.statusCode, body: b, cookie: sc ? sc[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

describe('Een kaartje dat iemand anders blijkt te zijn', () => {
  let server, io, dm, gidA, gidB, sessieA, sessieB, echt, alias, aliasZicht, echtZicht;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const maakGroep = async (naam, ww) => {
      await req(server, 'POST', '/api/groups', { name: naam, password: ww }, dm);
      return (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === naam).id;
    };
    gidA = await maakGroep('Tafel A', 'tafel-a');
    gidB = await maakGroep('Tafel B', 'tafel-b');
    const speler = async (naam, groep) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, subtype: 'speler', data: { groep } }, dm)).body.id;
    const aId = await speler('Anne', gidA);
    const bId = await speler('Boris', gidB);

    const kaart = async (naam, data = {}) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, data }, dm)).body.id;

    // Geval 1: het geheim onthult hem.
    echt  = await kaart('Hugo Grisburgh II');
    alias = await kaart('Harmen Jonker', {
      aliasVan: echt, aliasMoment: 'geheim',
      geheimen: JSON.stringify([
        { id: 'g1', tekst: 'Hij drinkt stiekem van de voorraad.' },
        { id: 'g2', tekst: 'Hij is in werkelijkheid Hugo Grisburgh II.', alias: true },
      ]),
    });
    // Geval 2: het zichtbaar worden van het echte kaartje onthult hem.
    echtZicht  = await kaart('Vrouwe Kwartel');
    aliasZicht = await kaart('De Gesluierde', {
      aliasVan: echtZicht, aliasMoment: 'zichtbaar',
      geheimen: JSON.stringify([
        { id: 'z1', tekst: 'Onder de sluier zit Vrouwe Kwartel.', alias: true },
      ]),
    });

    // Beide tafels kennen de twee pseudoniemen.
    for (const gid of [gidA, gidB]) {
      await req(server, 'PUT', '/api/groups/active', { groupId: gid }, dm);
      for (const id of [alias, aliasZicht]) {
        await req(server, 'PUT', `/api/entities/personages/${id}/visibility`, { target: 'visible' }, dm);
      }
    }

    const inloggen = async (id, ww) => (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: id, password: ww })).cookie;
    sessieA = await inloggen(aId, 'tafel-a');
    sessieB = await inloggen(bId, 'tafel-b');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const haal = async (id, sessie) => (await req(server, 'GET', `/api/entities/personages/${id}`, null, sessie)).body;

  it('verzwijgt dat het een pseudoniem is zolang niemand het weet', async () => {
    const e = await haal(alias, sessieA);
    assert.strictEqual(e._alias, undefined, 'geen verwijzing');
    assert.strictEqual(e.data.aliasVan, undefined,
      'en ook niet het veld zelf — dát het er staat verklapt al dat dit een pseudoniem is');
    assert.strictEqual(e.data.aliasMoment, undefined);
  });

  it('laat ze samenvallen zodra de gevlagde geheimregel opengaat', async () => {
    await req(server, 'PUT', '/api/groups/active', { groupId: gidA }, dm);
    await req(server, 'PUT', `/api/entities/personages/${alias}/secret`, { gid: 'g2' }, dm);

    const e = await haal(alias, sessieA);
    assert.ok(e._alias, 'tafel A weet het nu');
    assert.strictEqual(e._alias.naam, 'Hugo Grisburgh II');
    assert.strictEqual(e._alias.kent, false, 'het echte kaartje kennen ze nog niet, dus geen knop erheen');
  });

  it('houdt de andere tafel erbuiten', async () => {
    const e = await haal(alias, sessieB);
    assert.strictEqual(e._alias, undefined,
      'tafel B heeft niets onthuld — het aliaskaartje is voor hen gewoon de waard');
  });

  it('zet het andere geheim er niet voor aan', async () => {
    // Een niet-gevlagde regel onthullen mag de alias niet openzetten: niet elk
    // geheim is een pseudoniem.
    await req(server, 'PUT', '/api/groups/active', { groupId: gidB }, dm);
    await req(server, 'PUT', `/api/entities/personages/${alias}/secret`, { gid: 'g1' }, dm);
    const e = await haal(alias, sessieB);
    assert.match(JSON.stringify(e.data.geheimen || ''), /voorraad/, 'dat geheim leest hij wel');
    assert.strictEqual(e._alias, undefined, 'maar het pseudoniem blijft dicht');
  });

  it('zet het echte kaartje *ook bekend als* erbij, alleen voor wie het weet', async () => {
    // Tafel A kent het echte kaartje nu ook.
    await req(server, 'PUT', '/api/groups/active', { groupId: gidA }, dm);
    await req(server, 'PUT', `/api/entities/personages/${echt}/visibility`, { target: 'visible' }, dm);
    const voorA = await haal(echt, sessieA);
    assert.deepStrictEqual(voorA._ookBekendAls, ['Harmen Jonker']);

    await req(server, 'PUT', '/api/groups/active', { groupId: gidB }, dm);
    await req(server, 'PUT', `/api/entities/personages/${echt}/visibility`, { target: 'visible' }, dm);
    const voorB = await haal(echt, sessieB);
    assert.strictEqual(voorB._ookBekendAls, undefined,
      'tafel B ziet Hugo nu wel, maar weet niet dat hij de waard was');
  });

  it('houdt zich aan het moment dat de DM koos', async () => {
    // Dit kaartje staat op 'zichtbaar'. Zijn geheimregel draagt de aliasvlag
    // wel — anders is er niets om te negeren — maar het moment is een keuze
    // van de DM, en een geheim is dan niet het moment.
    await req(server, 'PUT', '/api/groups/active', { groupId: gidB }, dm);
    await req(server, 'PUT', `/api/entities/personages/${aliasZicht}/secret`, { gid: 'z1' }, dm);
    const e = await haal(aliasZicht, sessieB);
    assert.match(JSON.stringify(e.data.geheimen || ''), /sluier/, 'het geheim leest hij');
    assert.strictEqual(e._alias, undefined,
      'maar samenvallen gebeurt pas als het echte kaartje zichtbaar wordt');
  });

  it('kent ook het tweede moment: het echte kaartje wordt zichtbaar', async () => {
    const voor = await haal(aliasZicht, sessieA);
    assert.strictEqual(voor._alias, undefined, 'nog niets');

    await req(server, 'PUT', '/api/groups/active', { groupId: gidA }, dm);
    await req(server, 'PUT', `/api/entities/personages/${echtZicht}/visibility`, { target: 'visible' }, dm);

    const na = await haal(aliasZicht, sessieA);
    assert.ok(na._alias, 'nu valt hij samen');
    assert.strictEqual(na._alias.naam, 'Vrouwe Kwartel');
    assert.strictEqual(na._alias.kent, true, 'en het echte kaartje kennen ze, dus de knop leidt ergens heen');
  });

  it('draait het terug als het echte kaartje weer dichtgaat', async () => {
    await req(server, 'PUT', '/api/groups/active', { groupId: gidA }, dm);
    await req(server, 'PUT', `/api/entities/personages/${echtZicht}/visibility`, { target: 'hidden' }, dm);
    const e = await haal(aliasZicht, sessieA);
    assert.strictEqual(e._alias, undefined,
      'anders blijft er een verwijzing staan naar een kaartje dat ze niet meer mogen zien');
  });
});
