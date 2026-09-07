const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Wisselend assortiment ────────────────────────────────────────────────────
// De verrassing van een roterende winkel is dat je niet weet wat er nog meer
// kán liggen. Drie dingen moeten daarvoor kloppen: de speler krijgt alleen de
// actieve regels, hij kan niet kopen wat er niet ligt, en de stand hangt aan
// zíjn party (deze route keek naar de party waar de DM toevallig naar keek).

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-schap-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Winkel met een wisselend assortiment', () => {
  let server, io, dm, aria, ariaC, andere, cato, catoC, winkel;
  const waren = Array.from({ length: 12 }, (_, i) => ({ naam: `Waar ${i + 1}`, prijs: '1 fl' }));

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
    ariaC = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: aria })).cookie;

    await req(server, 'POST', '/api/groups', { name: 'Tweede party' }, dm);
    andere = (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === 'Tweede party').id;
    cato = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Cato', subtype: 'speler', data: { groep: andere } }, dm)).body.id;
    catoC = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: cato })).cookie;

    winkel = (await req(server, 'POST', '/api/entities/locaties', {
      name: 'De Schapwinkel', data: {
        locType: 'Winkel', voorraad: JSON.stringify(waren),
        winkelConfig: JSON.stringify({ roterend: true, minItems: 3, maxItems: 3, verversBij: 'long' }),
      },
    }, dm)).body;
    for (const gid of ['groep1', andere]) {
      await req(server, 'PUT', '/api/groups/active', { groupId: gid }, dm);
      await req(server, 'PUT', `/api/entities/locaties/${winkel.id}/visibility`, { target: 'visible' }, dm);
    }
    await req(server, 'PUT', '/api/groups/active', { groupId: 'groep1' }, dm);
    await req(server, 'PATCH', `/api/player-currency/${aria}`, { fl: 50, kn: 0, cl: 0 }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const schap = async (cookie) => (await req(server, 'GET', `/api/shops/${winkel.id}/beschikbaar`, null, cookie)).body;

  it('toont de speler alleen wat er in de schappen ligt', async () => {
    const alsDm = await schap(dm);
    const alsSpeler = await schap(ariaC);
    assert.equal(alsDm.items.length, 12, 'de DM ziet de hele voorraad');
    assert.equal(alsDm.items.filter(i => i.actief).length, 3, 'waarvan drie actief');
    assert.equal(alsSpeler.items.length, 3, 'de speler ziet alleen die drie');
    assert.ok(alsSpeler.items.every(i => i.actief), 'en alles wat hij ziet ligt er ook');
  });

  it('laat niet kopen wat er niet ligt', async () => {
    const alsDm = await schap(dm);
    const nietInSchap = alsDm.items.find(i => !i.actief);
    const r = await req(server, 'POST', `/api/shops/${winkel.id}/koop`,
      { itemNaam: nietInSchap.naam, aantal: 1 }, ariaC);
    assert.equal(r.status, 409, 'wie de naam kent kan het toch niet kopen');
  });

  it('laat wél kopen wat er wel ligt', async () => {
    const wat = (await schap(ariaC)).items[0];
    const r = await req(server, 'POST', `/api/shops/${winkel.id}/koop`, { itemNaam: wat.naam, aantal: 1 }, ariaC);
    assert.equal(r.status, 200);
  });

  it('geeft elke party haar eigen schappen', async () => {
    // De DM kijkt naar party 1; Cato zit in party 2 en hoort zijn eigen
    // selectie te krijgen, niet die van de party waar de DM naar kijkt.
    const vanAria = (await schap(ariaC)).items.map(i => i.naam).sort().join('|');
    const vanCato = (await schap(catoC)).items.map(i => i.naam).sort().join('|');
    assert.equal(vanCato.split('|').length, 3);
    // Twee onafhankelijke trekkingen uit twaalf: gelijk mág, maar de stand moet
    // per party bewaard zijn — dat toetsen we door party 1 te laten rusten.
    await req(server, 'PUT', '/api/groups/active', { groupId: 'groep1' }, dm);
    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    const vanCatoNa = (await schap(catoC)).items.map(i => i.naam).sort().join('|');
    assert.equal(vanCatoNa, vanCato, 'de schappen van party 2 blijven staan');
    assert.ok(vanAria !== undefined);
  });

  it('ververst na een lange rust', async () => {
    const voor = (await schap(ariaC)).items.map(i => i.naam).sort().join('|');
    let anders = false;
    for (let i = 0; i < 8 && !anders; i++) {
      await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
      if ((await schap(ariaC)).items.map(i => i.naam).sort().join('|') !== voor) anders = true;
    }
    assert.ok(anders, 'na een paar rusten liggen er andere waren');
  });

  it('rekent het inkoopbedrag per stuk', async () => {
    const stapel = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Fles', data: { gebruik: 'stapelbaar', prijs: '5 fl' } }, dm)).body.id;
    await req(server, 'PUT', `/api/items/${stapel}/owner`,
      { characterId: aria, playerName: 'Aria', groupId: 'groep1', qty: 3 }, dm);
    await req(server, 'PATCH', `/api/player-currency/${aria}`, { fl: 0, kn: 0, cl: 0 }, dm);

    const boedel = (await req(server, 'GET', `/api/shops/${winkel.id}/party-boedel`, null, dm)).body;
    const rij = boedel.regels.find(r => r.entityId === stapel);
    assert.ok(rij, 'de stapel staat in de boedel');
    const r = await req(server, 'POST', `/api/shops/${winkel.id}/dm-inkoop`,
      { regels: [{ ...rij, aantal: 3, bedrag: '2,00' }] }, dm);
    assert.equal(r.status, 200);
    const beurs = (await req(server, 'GET', `/api/player-currency/${aria}`, null, dm)).body;
    assert.equal(beurs.fl, 6, 'drie stuks à 2 florinde is zes, niet twee');
  });
});
