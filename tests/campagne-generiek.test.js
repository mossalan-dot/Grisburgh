const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Wat van Grisburgh is, hoort niet in een andere campagne op te duiken: niet
// zijn stadskaart, niet zijn munten, niet zijn naam in de tab.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-gen-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Een tweede campagne blijft van zichzelf', () => {
  let server, io, storage, dm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('vestingveen', { appTitle: 'Vestingveen' });
    // De eigen campagne van deze DM; hij logt daar in en blijft daar.
    fs.writeFileSync(path.join(DATA_DIR, 'campaigns', 'vestingveen', 'dm-state.json'),
      JSON.stringify({ dmPassword: 'vestingveen-dm', groups: {} }, null, 2));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'vestingveen', password: 'vestingveen-dm' })).cookie;
    assert.ok(dm, 'de DM van Vestingveen is ingelogd');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('krijgt D&D-munten, niet die van Grisburgh', async () => {
    const meta = (await req(server, 'GET', '/api/meta', null, dm)).body;
    assert.deepEqual(meta.currency, { fl: 'Gold', kn: 'Silver', cl: 'Copper' });
  });

  it('laat de DM zijn munten hernoemen, maar niet leegmaken', async () => {
    const r = await req(server, 'PUT', '/api/meta/app', { currency: { fl: 'Galjoen', kn: 'Sikkel', cl: '' } }, dm);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.currency, { fl: 'Galjoen', kn: 'Sikkel', cl: 'Copper' },
      'een leeggelaten naam valt terug op de standaard');
    const meta = (await req(server, 'GET', '/api/meta', null, dm)).body;
    assert.equal(meta.currency.fl, 'Galjoen', 'en het is bewaard');
  });

  it('begint zonder kaart in plaats van met de stadskaart van Grisburgh', async () => {
    const r = await req(server, 'GET', '/api/map/maps', null, dm);
    assert.deepEqual(r.body, [], 'geen ingebouwde kaarten als vangnet');
  });

  it('houdt een eigen kaart voor zichzelf', async () => {
    await req(server, 'POST', '/api/map/maps', { label: 'De Veenmarkt', imageId: 'x' }, dm);
    const maps = (await req(server, 'GET', '/api/map/maps', null, dm)).body;
    assert.equal(maps.length, 1, 'alleen de eigen kaart, er is er geen bijgeplakt');
    assert.equal(maps[0].label, 'De Veenmarkt');
  });

  it('installeert als PWA onder zijn eigen naam', async () => {
    const m = (await req(server, 'GET', '/manifest.webmanifest?campagne=vestingveen')).body;
    assert.equal(m.name, 'Vestingveen');
    assert.equal(m.start_url, '/vestingveen', 'en opent op zijn eigen pad');
  });

  it('zet zijn eigen naam in de titel van de pagina', async () => {
    const eigen  = await req(server, 'GET', '/vestingveen');
    const ander  = await req(server, 'GET', '/grisburgh');
    assert.match(String(eigen.body), /<title>Vestingveen<\/title>/);
    assert.match(String(ander.body), /<title>Grisburgh<\/title>/);
  });
});

describe('Openingspagina met alle campagnes', () => {
  let server, io, storage, dm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR + '-overzicht';
    if (fs.existsSync(DATA_DIR + '-overzicht')) fs.rmSync(DATA_DIR + '-overzicht', { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('vestingveen', { appTitle: 'Vestingveen', appSubtitle: 'Een veen vol geheimen' });
    storage.createCampaign('stilzwijgen', { appTitle: 'Stilzwijgen' });
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR + '-overzicht', { recursive: true, force: true });
  });

  it('noemt elke campagne bij naam, zonder inloggen', async () => {
    const r = await req(server, 'GET', '/api/campagnes');
    assert.equal(r.status, 200);
    const namen = r.body.map(c => c.titel);
    assert.ok(namen.includes('Vestingveen') && namen.includes('Stilzwijgen'), 'alle campagnes staan erin');
    assert.equal(r.body.find(c => c.id === 'vestingveen').ondertitel, 'Een veen vol geheimen');
    assert.ok(!JSON.stringify(r.body).includes('password'), 'en niets wat geheim hoort te blijven');
  });

  it('laat een DM zichzelf eruit halen', async () => {
    fs.writeFileSync(path.join(DATA_DIR + '-overzicht', 'campaigns', 'vestingveen', 'dm-state.json'),
      JSON.stringify({ dmPassword: 'vestingveen-dm', groups: {} }, null, 2));
    const eigen = (await req(server, 'POST', '/api/auth/login', { campagne: 'vestingveen', password: 'vestingveen-dm' })).cookie;
    assert.ok(eigen, 'de DM van Vestingveen is ingelogd');

    const uit = await req(server, 'PUT', '/api/meta/app', { inOverzicht: false }, eigen);
    assert.equal(uit.body.inOverzicht, false);

    const lijst = (await req(server, 'GET', '/api/campagnes')).body.map(c => c.id);
    assert.ok(!lijst.includes('vestingveen'), 'wie zich verbergt staat er niet meer in');
    assert.ok(lijst.includes('stilzwijgen'), 'de rest wel');

    // En hij blijft gewoon bereikbaar op zijn eigen pad.
    const eigenPad = await req(server, 'GET', '/vestingveen');
    assert.match(String(eigenPad.body), /<title>Vestingveen<\/title>/);
  });

  it('geeft een bezoeker zonder sessie de meta van de campagne in het pad', async () => {
    // De landingspagina van Prewett hoorde de titel van Grisburgh te tonen zolang
    // het API-verzoek zijn campagne niet meenoemde. De client hangt er nu
    // ?campagne= aan; de server hoort dat te volgen.
    const eigen  = await req(server, 'GET', '/api/meta?campagne=stilzwijgen');
    const ander  = await req(server, 'GET', '/api/meta');
    assert.equal(eigen.body.appTitle, 'Stilzwijgen');
    assert.equal(ander.body.appTitle, 'Grisburgh', 'zonder campagne blijft het de standaard');
  });

  it('serveert de keuzepagina op het kale domein', async () => {
    const r = await req(server, 'GET', '/');
    assert.equal(r.status, 200);
    assert.match(String(r.body), /<title>Campagnes<\/title>/);
  });

  it('stuurt het tafelscherm nog wel door', async () => {
    const r = await req(server, 'GET', '/?display=1');
    assert.equal(r.status, 302, 'een bladwijzer met ?display=1 hoort in de campagne te landen');
    assert.match(r.body, /grisburgh\?display=1/);
  });
});
