// Vier gaten uit de code review van 6 nov 2026. Elk van deze tests faalde op
// de code van vóór die dag.
//
//  1. Een socket kon zich als elk personage melden en kreeg dan zijn
//     privéberichten (en de echte speler niet meer).
//  2. Het Spotify-token van de DM ging naar elke ingelogde speler.
//  3. `links` van een zichtbaar kaartje noemde verborgen kaartjes bij naam.
//  4. Charges en verzoeken van een speler landden in de party waar de DM naar
//     keek, terwijl de speler zijn eigen party las.
//  5. Wachtwoordvelden waren onbeperkt te proberen, en de sandbox maakte
//     zonder wachtwoord van elke bezoeker een DM.
//  6. Een ingelogde speler kon het bestand van elk verborgen kaartje ophalen.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-review-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    let json = null;
    if (body) {
      json = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(json);
    }
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        const sc = res.headers['set-cookie'];
        resolve({ status: res.statusCode, body: parsed, cookie: sc ? sc[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (json) r.write(json);
    r.end();
  });
}

function upload(server, id, cookie) {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
  const grens = '----grens';
  const lijf = Buffer.concat([
    Buffer.from(`--${grens}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
    png, Buffer.from(`\r\n--${grens}--\r\n`)]);
  return new Promise((resolve, reject) => {
    const r = http.request({ method: 'POST', hostname: 'localhost', port: server.address().port, path: `/api/files/${id}`,
      headers: { Cookie: cookie, 'Content-Type': `multipart/form-data; boundary=${grens}`, 'Content-Length': lijf.length } },
      res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    r.on('error', reject); r.end(lijf);
  });
}

describe('Review 6 nov: lekken en verkeerde party', () => {
  let server, io, ioc, dm, speler, pc;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    ({ server, io } = require('../server'));
    ioc = require('socket.io-client');
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    pc = (await req(server, 'POST', '/api/entities/personages', { name: 'Speler Een', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body;
    speler = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: pc.id })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  function verbind(cookie) {
    const s = ioc(`http://localhost:${server.address().port}`, {
      transports: ['websocket'], forceNew: true, extraHeaders: cookie ? { Cookie: cookie } : {},
    });
    return new Promise(r => s.on('connect', () => r(s)));
  }
  const wacht = (ms) => new Promise(r => setTimeout(r, ms));

  it('laat een socket zonder sessie zich niet als speler melden', async () => {
    const vreemde = await verbind(null);
    vreemde.emit('player:register', pc.id);
    let gekregen = null;
    vreemde.on('bericht:nieuw', m => { gekregen = m; });
    await wacht(150);
    await req(server, 'POST', '/api/berichten', { characterId: pc.id, tekst: 'Alleen voor jou' }, dm);
    await wacht(250);
    vreemde.close();
    assert.strictEqual(gekregen, null, 'een vreemde mag het privébericht niet ontvangen');
  });

  it('bezorgt het bericht wél bij de speler zelf', async () => {
    const eigen = await verbind(speler);
    eigen.emit('player:register', pc.id);
    let gekregen = null;
    eigen.on('bericht:nieuw', m => { gekregen = m; });
    await wacht(150);
    await req(server, 'POST', '/api/berichten', { characterId: pc.id, tekst: 'Voor de speler' }, dm);
    await wacht(250);
    eigen.close();
    assert.strictEqual(gekregen?.msg?.tekst, 'Voor de speler');
  });

  it('geeft het Spotify-token en het tafelapparaat niet aan een speler', async () => {
    assert.strictEqual((await req(server, 'GET', '/api/spotify/token', null, speler)).status, 403);
    assert.strictEqual((await req(server, 'POST', '/api/spotify/tafel-apparaat', { deviceId: 'x' }, speler)).status, 403);
    // De DM komt er wél langs (hier: niet gekoppeld, dus 400 en geen 403).
    assert.notStrictEqual((await req(server, 'GET', '/api/spotify/token', null, dm)).status, 403);
  });

  it('noemt in links geen kaartje dat de party niet kent', async () => {
    await req(server, 'POST', '/api/entities/personages', { name: 'De Verborgen Moordenaar', data: {} }, dm);
    const bekend = (await req(server, 'POST', '/api/entities/personages', { name: 'De Waard', data: {} }, dm)).body;
    await req(server, 'PUT', `/api/entities/personages/${bekend.id}/visibility`, null, dm);
    const herberg = (await req(server, 'POST', '/api/entities/locaties', {
      name: 'De Gouden Gans', data: {},
      links: { personages: ['De Verborgen Moordenaar', 'De Waard', 'Een losse naam'] },
    }, dm)).body;
    await req(server, 'PUT', `/api/entities/locaties/${herberg.id}/visibility`, null, dm);

    const lijst = (await req(server, 'GET', '/api/entities/locaties', null, speler)).body;
    const l1 = lijst.find(x => x.id === herberg.id).links.personages;
    const los = (await req(server, 'GET', `/api/entities/locaties/${herberg.id}`, null, speler)).body.links.personages;
    for (const namen of [l1, los]) {
      assert.ok(!namen.includes('De Verborgen Moordenaar'), 'verborgen kaartje lekt via links');
      assert.ok(namen.includes('De Waard'), 'een gekend kaartje blijft staan');
      assert.ok(namen.includes('Een losse naam'), 'een naam zonder kaartje blijft staan');
    }
    // De DM ziet ze alle drie.
    const dmLinks = (await req(server, 'GET', `/api/entities/locaties/${herberg.id}`, null, dm)).body.links.personages;
    assert.ok(dmLinks.includes('De Verborgen Moordenaar'));
  });

  it('bewaart charges in de party van de speler, ook als de DM naar een andere kijkt', async () => {
    const andere = (await req(server, 'POST', '/api/groups', { name: 'Andere tafel' }, dm)).body;
    await req(server, 'PUT', '/api/groups/active', { groupId: andere.id }, dm);
    try {
      const r = await req(server, 'PATCH', `/api/items/staf_1/owner/${pc.id}/charges`, { charges: 3 }, speler);
      assert.strictEqual(r.status, 200);
      const eigendom = (await req(server, 'GET', '/api/items/ownership', null, speler)).body;
      assert.strictEqual(eigendom.itemCharges.staf_1, 3, 'de speler leest zijn eigen party');
    } finally {
      await req(server, 'PUT', '/api/groups/active', { groupId: 'groep1' }, dm);
    }
  });

  it('maakt van een bezoeker geen sandbox-DM zonder SANDBOX_PASSWORD', async () => {
    const r = await req(server, 'POST', '/api/auth/sandbox-login', { password: '' });
    assert.strictEqual(r.status, 403);
  });

  it('remt na twintig mislukte pogingen, en alleen voor die campagne', async () => {
    for (let i = 0; i < 20; i++) {
      const r = await req(server, 'POST', '/api/auth/toegang', { campagne: 'grisburgh', wachtwoord: 'fout' + i });
      assert.strictEqual(r.status, 401);
    }
    const geremd = await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' });
    assert.strictEqual(geremd.status, 429, 'ook het goede wachtwoord wacht even');
    const elders = await req(server, 'POST', '/api/auth/login', { campagne: 'sandbox', password: 'x' });
    assert.notStrictEqual(elders.status, 429, 'een andere campagne telt apart');
  });

  it('geeft het bestand van een verborgen kaartje niet aan een speler', async () => {
    const geheim = (await req(server, 'POST', '/api/entities/documenten', { name: 'Het Testament', data: {} }, dm)).body;
    assert.strictEqual(await upload(server, geheim.id, dm), 200);
    assert.strictEqual((await req(server, 'GET', `/api/files/${geheim.id}`, null, speler)).status, 404);
    assert.strictEqual((await req(server, 'GET', `/api/thumb/${geheim.id}`, null, speler)).status, 404);
    assert.strictEqual((await req(server, 'GET', `/api/files/${geheim.id}`, null, dm)).status, 200, 'de DM wel');
    // Onthullen = bereikbaar.
    await req(server, 'PUT', `/api/entities/documenten/${geheim.id}/visibility`, null, dm);
    assert.strictEqual((await req(server, 'GET', `/api/files/${geheim.id}`, null, speler)).status, 200);
  });

  it('houdt een gedeeld beeld bereikbaar als een gekend kaartje het ook draagt', async () => {
    const beeld = 'img_gedeeld_1';
    assert.strictEqual(await upload(server, beeld, dm), 200);
    await req(server, 'POST', '/api/entities/personages', { name: 'Verborgen Tweeling', data: { imageId: beeld } }, dm);
    const zus = (await req(server, 'POST', '/api/entities/personages', { name: 'Gekende Tweeling', data: { imageId: beeld } }, dm)).body;
    assert.strictEqual((await req(server, 'GET', `/api/files/${beeld}`, null, speler)).status, 404, 'eerst alleen verborgen');
    await req(server, 'PUT', `/api/entities/personages/${zus.id}/visibility`, null, dm);
    assert.strictEqual((await req(server, 'GET', `/api/files/${beeld}`, null, speler)).status, 200);
  });
});
