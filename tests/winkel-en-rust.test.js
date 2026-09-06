const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Winkel en rust ───────────────────────────────────────────────────────────
// Drie dingen die uit een speelronde kwamen en alle drie hetzelfde patroon
// hebben: er stond ergens een tweede kopie van een regel die elders al goed was.
//  1. De winkel keek naar het losse vinkje `stapelbaar` en niet naar het veld
//     `gebruik`. Je betaalde er drie en kreeg er één, en het voorwerp ging
//     meteen op uitverkocht.
//  2. Kopen en verkopen gingen langs de gedeelde beurs heen.
//  3. Een lange rust gaf de helft van de Hit Dice terug, naar boven afgerond.

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-winkel-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Winkel en rust', () => {
  let server, io, dm, aria, ariaC, fles, winkel;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    aria = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Aria', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    await req(server, 'PATCH', `/api/player-profile/${aria}`, { klasse: 'Wizard', level: 5, klasseLevel: 5, con: 14 }, dm);
    ariaC = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: aria })).cookie;

    fles = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Fles Vuurwater', data: { itemType: 'Potion', gebruik: 'stapelbaar', prijs: '4 fl' } }, dm)).body.id;
    winkel = (await req(server, 'POST', '/api/entities/locaties', {
      name: 'Het Vaatje', data: { locType: 'Winkel', voorraad: JSON.stringify([
        { naam: 'Fles Vuurwater', prijs: '4 fl', entityId: fles },
      ]) },
    }, dm)).body;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const bezitVan = async () => {
    const b = (await req(server, 'GET', `/api/items/${fles}/bezit`, null, dm)).body;
    return b.groepen?.[0]?.rijen?.find(r => r.characterId === aria) || null;
  };

  it('koopt het aantal dat je betaalt bij een stapelbaar voorwerp', async () => {
    await req(server, 'PATCH', `/api/player-currency/${aria}`, { fl: 20, kn: 0, cl: 0 }, dm);
    const r = await req(server, 'POST', `/api/shops/${winkel.id}/koop`,
      { itemNaam: 'Fles Vuurwater', entityId: fles, aantal: 3 }, ariaC);
    assert.equal(r.status, 200);
    const beurs = (await req(server, 'GET', `/api/player-currency/${aria}`, null, dm)).body;
    assert.equal(beurs.fl, 8, 'drie flessen à 4 fl');
    const rij = await bezitVan();
    assert.equal(rij?.aantal, 3, 'en er staan er ook drie in de boedel');
  });

  it('zet een stapelbaar voorwerp niet op uitverkocht', async () => {
    const r = await req(server, 'POST', `/api/shops/${winkel.id}/koop`,
      { itemNaam: 'Fles Vuurwater', entityId: fles, aantal: 1 }, ariaC);
    assert.equal(r.status, 200, 'een tweede aankoop mag gewoon');
    assert.equal((await bezitVan())?.aantal, 4);
  });

  it('betaalt uit de gedeelde beurs als die aanstaat', async () => {
    await req(server, 'PUT', '/api/party-currency/toggle', { enabled: true, groupId: 'groep1' }, dm);
    await req(server, 'PATCH', '/api/party-currency', { fl: 30, kn: 0, cl: 0 }, dm);
    await req(server, 'PATCH', `/api/player-currency/${aria}`, { fl: 0, kn: 0, cl: 0 }, dm);

    const r = await req(server, 'POST', `/api/shops/${winkel.id}/koop`,
      { itemNaam: 'Fles Vuurwater', entityId: fles, aantal: 2 }, ariaC);
    assert.equal(r.status, 200, 'de eigen beurs is leeg, de partybeurs niet');
    const pc = (await req(server, 'GET', '/api/party-currency', null, ariaC)).body;
    assert.equal(pc.fl, 22, 'het geld gaat van de partybeurs af');
  });

  it('schrijft de opbrengst van een verkoop bij op de gedeelde beurs', async () => {
    await req(server, 'PUT', `/api/entities/locaties/${winkel.id}`, { data: {
      locType: 'Winkel',
      voorraad: JSON.stringify([{ naam: 'Fles Vuurwater', prijs: '4 fl', entityId: fles }]),
      winkelConfig: JSON.stringify({ koopt: true, ratio: 50, categorieen: [] }),
    } }, dm);
    const voor = (await req(server, 'GET', '/api/party-currency', null, ariaC)).body;
    const r = await req(server, 'POST', `/api/shops/${winkel.id}/verkoop`, { entityId: fles, aantal: 1 }, ariaC);
    assert.equal(r.status, 200);
    const na = (await req(server, 'GET', '/api/party-currency', null, ariaC)).body;
    const cl = x => x.fl * 100 + x.kn * 10 + x.cl;
    assert.ok(cl(na) > cl(voor), 'de partybeurs groeit, niet de eigen zak');
    await req(server, 'PUT', '/api/party-currency/toggle', { enabled: false, groupId: 'groep1' }, dm);
  });

  it('geeft na een lange rust de helft van de Hit Dice terug, naar beneden', async () => {
    // Wizard 5 → 5d6. Vier verbruikt, de helft van vijf is twee (niet drie).
    for (let i = 0; i < 4; i++) await req(server, 'POST', `/api/characters/${aria}/spend-hit-die`, { die: 'd6' }, ariaC);
    let hd = (await req(server, 'GET', `/api/characters/${aria}/hit-dice`, null, dm)).body;
    assert.equal(hd.spent['6'], 4);

    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    hd = (await req(server, 'GET', `/api/characters/${aria}/hit-dice`, null, dm)).body;
    assert.equal(hd.spent['6'], 2, 'twee terug, dus twee blijven verbruikt');
  });

  it('geeft altijd minstens één Hit Die terug', async () => {
    const solo = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Solo', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    await req(server, 'PATCH', `/api/player-profile/${solo}`, { klasse: 'Wizard', level: 1, klasseLevel: 1, con: 10 }, dm);
    await req(server, 'POST', `/api/characters/${solo}/spend-hit-die`, { die: 'd6' }, dm);
    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    const hd = (await req(server, 'GET', `/api/characters/${solo}/hit-dice`, null, dm)).body;
    assert.equal(hd.spent['6'] || 0, 0, 'met één die in totaal krijg je die ene terug');
  });
});
