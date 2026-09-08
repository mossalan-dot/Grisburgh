const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Diensten en de gedeelde beurs ────────────────────────────────────────────
// Staat de gedeelde beurs aan, dan is dát de portemonnee van de party. De
// diensten (Ursula, De Gock, de Tweespalt, De Heeren) lazen en schreven
// rechtstreeks in dmState.playerCurrency, waardoor geld belandde in een zak die
// het scherm niet toont: betalen kon niet met partygeld, en een uitbetaling
// verdween in het niets.

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-beurs-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

const cl = (x) => (x?.fl || 0) * 100 + (x?.kn || 0) * 10 + (x?.cl || 0);

describe('Diensten betalen uit de beurs die telt', () => {
  let server, io, dm, speler, spelerC, doelwit;

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
    doelwit = (await req(server, 'POST', '/api/entities/personages', { name: 'Iemand', data: {} }, dm)).body;

    // Gedeelde beurs aan, eigen beurs leeg — precies de stand die misging.
    await req(server, 'PUT', '/api/party-currency/toggle', { enabled: true }, dm);
    await req(server, 'PATCH', '/api/party-currency', { fl: 300, kn: 0, cl: 0 }, dm);
    await req(server, 'PATCH', `/api/player-currency/${speler}`, { fl: 0, kn: 0, cl: 0 }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const party = async () => (await req(server, 'GET', '/api/party-currency', null, spelerC)).body;
  const eigen = async () => (await req(server, 'GET', `/api/player-currency/${speler}`, null, dm)).body;

  it('De Gock betaalt uit de partybeurs, niet uit een lege eigen zak', async () => {
    const voor = cl(await party());
    const r = await req(server, 'POST', '/api/gock/opdracht',
      { entityId: doelwit.id, entityType: 'personages' }, spelerC);
    assert.equal(r.status, 200, 'de opdracht lukt terwijl de eigen beurs leeg is');
    assert.equal(cl(await party()), voor - 5000, '50 florinde van de partybeurs');
    assert.equal(cl(await eigen()), 0, 'de eigen beurs blijft leeg');
  });

  it('meldt de beurs terug die de speler ook echt ziet', async () => {
    const r = await req(server, 'GET', '/api/party-currency', null, spelerC);
    assert.equal(r.body.enabled, true);
  });

  it('een lening van de Tweespalt komt in de partybeurs', async () => {
    const voor = cl(await party());
    const r = await req(server, 'POST', '/api/tweespalt/leen', { bedrag: { fl: 40 } }, spelerC);
    assert.equal(r.status, 200);
    assert.equal(cl(await party()), voor + 4000, 'het geleende bedrag staat in de partybeurs');
    assert.equal(cl(await eigen()), 0, 'en niet in een zak die niemand ziet');
  });

  it('valt terug op de eigen beurs zodra de gedeelde uitstaat', async () => {
    // Een tweede speler, want De Gock neemt maar één opdracht tegelijk aan.
    await req(server, 'PUT', '/api/party-currency/toggle', { enabled: false }, dm);
    const borin = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Borin', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    const borinC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: borin })).cookie;
    await req(server, 'PATCH', `/api/player-currency/${borin}`, { fl: 80, kn: 0, cl: 0 }, dm);
    const ander = (await req(server, 'POST', '/api/entities/personages', { name: 'Nog Iemand', data: {} }, dm)).body;

    const r = await req(server, 'POST', '/api/gock/opdracht',
      { entityId: ander.id, entityType: 'personages' }, borinC);
    assert.equal(r.status, 200);
    const na = (await req(server, 'GET', `/api/player-currency/${borin}`, null, dm)).body;
    assert.equal(cl(na), 3000, '50 florinde van zijn eigen beurs');
  });
});
