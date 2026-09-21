const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De DM zet per party in welke diensten er open zijn (Diensten → Toegang per
// groep): 'beschikbaar', 'zichtbaar' (je ziet hem, je kunt er niets) of
// 'verborgen'. Dat werd tot 15 sep 2026 **alleen in de client** afgedwongen —
// `switchSection` verbergt de sectie, maar de routes vroegen er niet naar. Een
// speler kon dus gewoon bestellen bij een herberg die voor zijn party niet
// bestond, en een tabblad dat al openstond toen de DM de schakelaar omzette
// bleef werken.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-dienst-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Diensten: de toegangsschakelaar geldt ook op de server', () => {
  let server, io, dm, speler, gid;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const ent = (await req(server, 'POST', '/api/entities/personages', { name: 'Klant', subtype: 'speler' }, dm)).body;
    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    assert.ok(gid, 'er moet een groep zijn om de toegang op te zetten');
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    await req(server, 'PATCH', `/api/entities/personages/${ent.id}`, { data: { groep: gid } }, dm);
    speler = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: ent.id, password: 'proef1234' })).cookie;

    // Een herberg met één ding op het menu, zodat er iets te bestellen valt —
    // en geld op zak, anders struikelt de proef over de prijs in plaats van
    // over de toegangspoort.
    await req(server, 'PUT', '/api/meta/herberg', {
      naam: 'De Proefkroeg',
      menu: [{ id: 'menu_proef', naam: 'Kroes bier', prijs: '1 kn' }],
    }, dm);
    await req(server, 'PATCH', `/api/player-currency/${ent.id}`, { fl: 10, kn: 0, cl: 0 }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const zet = (staat) => req(server, 'PUT', '/api/diensten/toegang',
    { groepId: gid, dienst: 'herberg', staat }, dm);
  const bestel = (cookie) => req(server, 'POST', '/api/herberg/bestel', { itemId: 'menu_proef' }, cookie);

  it('laat een speler bestellen als de dienst beschikbaar is', async () => {
    await zet('beschikbaar');
    const r = await bestel(speler);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  });

  for (const staat of ['zichtbaar', 'verborgen']) {
    it(`weigert een speler bij staat '${staat}'`, async () => {
      const z = await zet(staat);
      assert.strictEqual(z.status, 200, 'de toegang moet te zetten zijn: ' + JSON.stringify(z.body));
      const r = await bestel(speler);
      assert.strictEqual(r.status, 403, `bij '${staat}' hoort een 403, kreeg ${r.status}`);
      assert.match(String(r.body?.error || ''), /niet beschikbaar/i);
    });
  }

  // Tweede laag: de groep bepaalt wát een party kent, de akte bepaalt waar ze
  // zijn. Die tweede werd alleen in de client afgedwongen — het scherm zei
  // "niet bereikbaar", de route liet alles toe.
  it('weigert ook als de lopende akte de dienst onbereikbaar maakt', async () => {
    await zet('beschikbaar');
    assert.strictEqual((await bestel(speler)).status, 200, 'voorwaarde: open');

    // Een akte die loopt voor deze groep, met de herberg dichtgezet.
    await req(server, 'PUT', '/api/meta/hoofdstuk/proef', { num: 1, title: 'Proef' }, dm);
    const bb = await req(server, 'PUT', '/api/meta/akte/proef/bereikbaarheid',
      { diensten: ['herberg'], entiteiten: [] }, dm);
    assert.strictEqual(bb.status, 200, 'de akte moet bestaan: ' + JSON.stringify(bb.body));
    await req(server, 'POST', '/api/akte/actief', { key: 'proef', num: 1, title: 'Proef', groupId: gid }, dm);

    const r = await bestel(speler);
    assert.strictEqual(r.status, 403, `onbereikbaar hoort 403 te geven, kreeg ${r.status}`);
    assert.match(String(r.body?.error || ''), /niet heen/i);

    // En de DM komt nog steeds langs de poort. Hij struikelt daarna over iets
    // anders — hij heeft zelf geen personage om voor te bestellen — dus toetsen
    // we de reden, niet de code.
    const d = await req(server, 'POST', '/api/herberg/bestel', { itemId: 'menu_proef' }, dm);
    assert.doesNotMatch(String(d.body?.error || ''), /niet heen/i,
      'de DM hoort niet op de bereikbaarheidspoort te stuiten');

    await req(server, 'PUT', '/api/meta/akte/proef/bereikbaarheid', { diensten: [], entiteiten: [] }, dm);
  });

  it('laat de DM altijd door — hij test, en handelt namens de tafel', async () => {
    await zet('verborgen');
    const r = await req(server, 'POST', '/api/herberg/vraag', { entityId: 'bestaat-niet' }, dm);
    assert.notStrictEqual(r.status, 403, 'de DM hoort niet op de toegangspoort te stuiten');
  });
});
