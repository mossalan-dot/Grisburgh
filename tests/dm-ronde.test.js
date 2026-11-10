// Uit de ronde als DM die met de hand een campagne opbouwt (7 nov 2026).
//
// 1. Een prijs in de eigen muntnaam van de campagne.
// `parsePrijs` kende fl/kn/cl en gp/sp/cp/ep/pp, maar niet de namen die de DM
// zelf koos. "2 stuiver" in een winkel leverde `null` op, en de koopregel schrijft
// alleen af als er een prijs uitkomt: het voorwerp was gratis.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-munt-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    let json = null;
    if (body) { json = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; opts.headers['Content-Length'] = Buffer.byteLength(json); }
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { let b; try { b = JSON.parse(data); } catch { b = data; } const sc = res.headers['set-cookie']; resolve({ status: res.statusCode, body: b, cookie: sc ? sc[0].split(';')[0] : cookie }); });
    });
    r.on('error', reject); if (json) r.write(json); r.end();
  });
}

describe('DM-ronde: een campagne met de hand opbouwen', () => {
  let server, io, dm, speler, pc, winkel;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    ({ server, io } = require('../server'));
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    await req(server, 'PUT', '/api/meta/app', { currency: { fl: 'Daalder', kn: 'Stuiver', cl: 'Duit' } }, dm);
    pc = (await req(server, 'POST', '/api/entities/personages', { name: 'Koper', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body;
    speler = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: pc.id })).cookie;
    await req(server, 'PATCH', `/api/player-currency/${pc.id}`, { fl: 10, kn: 0, cl: 0 }, dm);
    winkel = (await req(server, 'POST', '/api/entities/locaties', {
      name: 'De Natte Kraan', data: { locType: 'Winkel', voorraad: JSON.stringify([
        { naam: 'Pint zoutbier', prijs: '2 stuiver' },
        { naam: 'Kaart van de kelders', prijs: '3 daalders' },
        { naam: 'Zoute haring', prijs: '1 stuiver 4 duiten' },
      ]) },
    }, dm)).body;
    await req(server, 'PUT', `/api/entities/locaties/${winkel.id}/visibility`, null, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const beurs = async () => (await req(server, 'GET', `/api/player-currency/${pc.id}`, null, speler)).body;
  const inCl = b => (b.fl || 0) * 100 + (b.kn || 0) * 10 + (b.cl || 0);

  for (const [naam, kost] of [['Pint zoutbier', 20], ['Kaart van de kelders', 300], ['Zoute haring', 14]]) {
    it(`rekent "${naam}" af in de eigen munt (${kost} duit)`, async () => {
      const voor = inCl(await beurs());
      const r = await req(server, 'POST', `/api/shops/${winkel.id}/koop`, { itemNaam: naam }, speler);
      assert.strictEqual(r.status, 200, JSON.stringify(r.body));
      assert.strictEqual(voor - inCl(await beurs()), kost);
    });
  }

  it('geeft een locatie waar een verkoper naar wijst zijn verkopers mee (dan krijgt hij een voorraad)', async () => {
    const herberg = (await req(server, 'POST', '/api/entities/locaties', { name: 'De Gouden Gans', data: { locType: 'Herberg' } }, dm)).body;
    const waard = (await req(server, 'POST', '/api/entities/personages', { name: 'Bram Kruik', data: { tags: '["verkoper"]', winkelLocatieId: herberg.id } }, dm)).body;
    const los = (await req(server, 'GET', `/api/entities/locaties/${herberg.id}`, null, dm)).body;
    assert.deepStrictEqual(los._verkopers, [{ id: waard.id, name: 'Bram Kruik' }]);
    const lijst = (await req(server, 'GET', '/api/entities/locaties', null, dm)).body.find(l => l.id === herberg.id);
    assert.strictEqual(lijst._verkopers.length, 1);
    // Een speler krijgt die lijst niet: hij ziet een winkel aan zijn waren.
    await req(server, 'PUT', `/api/entities/locaties/${herberg.id}/visibility`, null, dm);
    const sp = (await req(server, 'GET', `/api/entities/locaties/${herberg.id}`, null, speler)).body;
    assert.strictEqual(sp._verkopers, undefined);
  });

  it('geeft de sessiecookie een vervaldatum, zodat browser dicht niet uitlogt', async () => {
    const r = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ campagne: 'grisburgh', password: 'grisburgh-dm' });
      const q = http.request({ method: 'POST', hostname: 'localhost', port: server.address().port, path: '/api/auth/login',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => { res.resume(); resolve(res.headers['set-cookie'] || []); });
      q.on('error', reject); q.end(body);
    });
    assert.ok(r.some(c => /Expires=/i.test(c)), 'sessiecookie zonder vervaldatum: ' + r.join(' | '));
  });
});
