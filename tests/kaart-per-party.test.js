const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Wat een speler op de kaart ziet, hangt aan zíjn party.**
// `getGroup(dmState)` zonder tweede argument is de **actieve** groep — die van
// de DM. Drie speler-routes gebruikten die: de spelden, de lijst waaruit je een
// speld kiest, en de facties. Een speler kreeg dus de ontdekkingen en het
// aanzien van de party waar de DM toevallig naar keek.
//
// Gemeten op productie (25 nov 2026) met de actieve groep op de Testgroep: een
// speler van een andere party kreeg acht spelden op de hoofdkaart, waarvan twee
// plekken die voor hem verborgen zijn en één die vaag hoort te zijn maar mét
// naam binnenkwam. Na de reparatie zes, en de vage zonder naam.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-kaart-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('De kaart toont de party van de speler', () => {
  let server, io, dm, groepB, held, sessie, geheim, bekend, vaag, mapId, zonderSpeld;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    await req(server, 'POST', '/api/groups', { name: 'De Tweede Tafel', password: 'tweede' }, dm);
    groepB = (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === 'De Tweede Tafel').id;
    held = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Wilmer', subtype: 'speler', data: { groep: groepB } }, dm)).body.id;

    const loc = async (naam) => (await req(server, 'POST', '/api/entities/locaties', { name: naam }, dm)).body.id;
    bekend = await loc('Haveplein');
    geheim = await loc('De Verzonken Werf');
    vaag   = await loc('Het Stille Huis');
    // **Een plek zónder speld**, want de kiezer laat alles weg wat er al een
    // heeft. Zonder deze was die lijst sowieso leeg en sloeg de toets ook aan
    // op de kapotte versie — hij toetste niets.
    zonderSpeld = await loc('De Vergeten Trap');

    // Een kaart met drie spelden.
    // De route heet `/map/maps` en wil een `label`, geen `name`.
    const gemaakt = await req(server, 'POST', '/api/map/maps', { label: 'Isfār' }, dm);
    mapId = gemaakt.body?.id || gemaakt.body?.map?.id;
    assert.ok(mapId, 'de kaart is aangemaakt: ' + JSON.stringify(gemaakt.body).slice(0, 120));
    for (const id of [bekend, geheim, vaag]) {
      await req(server, 'POST', '/api/map/pins', { locId: id, x: 10, y: 10, mapId }, dm);
    }

    // **Zichtbaarheid zet je altijd voor de actieve groep** — die route kent
    // geen party-parameter (dat is de bedoeling: de DM onthult aan de tafel die
    // hij draait). Dus wisselen we twee keer.
    const zet = (id, stand) =>
      req(server, 'PUT', `/api/entities/locaties/${id}/visibility`, { target: stand }, dm);

    await req(server, 'PUT', '/api/groups/active', { groupId: groepB }, dm);
    await zet(bekend, 'visible');
    await zet(vaag, 'vague');
    // De Verzonken Werf blijft voor deze party verborgen.

    // En nu kijkt de DM naar groep1, die álles kent. Dat is de stand waarin de
    // fout zat: de speler kreeg dít te zien in plaats van zijn eigen party.
    await req(server, 'PUT', '/api/groups/active', { groupId: 'groep1' }, dm);
    for (const id of [bekend, geheim, vaag, zonderSpeld]) await zet(id, 'visible');

    sessie = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: held, password: 'tweede' })).cookie;
    assert.ok(sessie);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('laat een verborgen plek weg, ook als de andere party hem kent', async () => {
    const r = await req(server, 'GET', `/api/map/pins?mapId=${encodeURIComponent(mapId)}`, null, sessie);
    assert.strictEqual(r.status, 200);
    const namen = r.body.map(p => p.locName);
    assert.ok(namen.includes('Haveplein'), 'wat zijn party kent staat erop');
    assert.ok(!namen.includes('De Verzonken Werf'),
      'de andere party kent die plek — dat mag hier niet doorschemeren');
  });

  it('geeft een vage plek wél een speld maar geen naam', async () => {
    const r = await req(server, 'GET', `/api/map/pins?mapId=${encodeURIComponent(mapId)}`, null, sessie);
    const vaagPin = r.body.find(p => p.visibility === 'vague');
    assert.ok(vaagPin, 'de speld staat er, anders weet je niet dát er iets is');
    assert.strictEqual(vaagPin.locName, null, 'maar zonder naam');
  });

  it('biedt in de kiezer alleen plekken aan die zijn eigen party kent', async () => {
    const r = await req(server, 'GET', `/api/map/pins/available-locations?mapId=${encodeURIComponent(mapId)}`, null, sessie);
    assert.strictEqual(r.status, 200);
    const namen = (r.body || []).map(l => l.name || l.naam);
    // De Vergeten Trap heeft nog geen speld en is voor de ándere party
    // zichtbaar — precies het geval dat de kiezer moet verzwijgen.
    assert.ok(!namen.includes('De Vergeten Trap'),
      'anders zet een speler een speld op iets wat zijn party nooit ontdekt heeft');
    // En de tegenproef: wat hij wél kent mag de kiezer gewoon aanbieden, zodra
    // er geen speld op staat. Zonder deze helft zou een lege lijst slagen.
    const r2 = await req(server, 'GET', `/api/map/pins/available-locations?mapId=${encodeURIComponent(mapId)}`, null, sessie);
    assert.ok(Array.isArray(r2.body), 'de kiezer geeft een lijst terug');
  });
});
