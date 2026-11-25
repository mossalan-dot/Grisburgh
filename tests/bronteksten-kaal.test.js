const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Kaal buiten de beheercampagne.** De 539 spreuken en de class features
// dragen PHB-tekst; die gaat alleen mee in de campagne van de beheerder, of
// waar `meta.bronTeksten` het expliciet toestaat. Elders komt de **structuur**
// binnen (naam, niveau, school, componenten) en blijft `desc` leeg — behalve
// wat onder de SRD 5.2 valt, want dat staat onder CC BY 4.0.
//
// Die grens hing aan de **sessie** in plaats van aan het **pad**: er stond
// `req.session?.campaignId === config.beheerCampagne`. Daarmee hing het
// antwoord af van wíé er keek in plaats van wáár hij keek — de DM van de
// beheercampagne die een andere campagne opende kreeg daar de volledige tekst.
// Gemeten op productie (25 nov 2026): Fireball kwam in `prewett` binnen met
// 972 tekens beschrijving, terwijl die campagne de vlag niet heeft staan.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-bron-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

const spreuken = (b) => (Array.isArray(b) ? b : (b.results || b.spells || []));
const tekstVan = (sp) => (sp?.desc || []).join(' ');

describe('Bronteksten blijven in de beheercampagne', () => {
  let server, io, storage, beheerder;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('veerhuis', { appTitle: 'Het Veerhuis' });
    fs.writeFileSync(path.join(DATA_DIR, 'campaigns', 'veerhuis', 'dm-state.json'),
      JSON.stringify({ dmPassword: 'veerhuis-dm', groups: {} }, null, 2));
    beheerder = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    assert.ok(beheerder);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('geeft de beheercampagne de volledige tekst', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024?campagne=grisburgh', null, beheerder);
    assert.strictEqual(r.status, 200);
    const lijst = spreuken(r.body);
    assert.ok(lijst.length > 100, 'de bibliotheek komt binnen');
    const metTekst = lijst.filter(s => tekstVan(s).length > 50);
    assert.ok(metTekst.length > 50, 'en daar staat tekst bij');
  });

  // De kern. Zelfde sessie, andere campagne in het pad.
  it('geeft een andere campagne géén PHB-tekst, ook niet aan de beheerder', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024?campagne=veerhuis', null, beheerder);
    assert.strictEqual(r.status, 200);
    const lijst = spreuken(r.body);
    assert.ok(lijst.length > 100, 'de structuur komt wél mee');

    // Wat niet onder de SRD valt hoort leeg te zijn. `_srd: true` mag tekst
    // dragen — dat staat onder CC BY 4.0 en gaat bewust overal mee.
    const buitenSrd = lijst.filter(s => !s._srd && tekstVan(s).length > 50);
    assert.deepStrictEqual(buitenSrd.map(s => s.name).slice(0, 5), [],
      'niet-SRD-spreuken dragen hier tekst, en dat hoort niet');
  });

  it('houdt de structuur wél overeind, zodat je een spreuk kunt herkennen', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024?campagne=veerhuis', null, beheerder);
    const een = spreuken(r.body).find(s => s.name && s.level !== undefined);
    assert.ok(een.name, 'naam');
    assert.ok(een.school || een.level === 0 || een.level >= 0, 'school of niveau');
  });

  it('luistert naar meta.bronTeksten als de campagne die zelf zet', async () => {
    const pad = path.join(DATA_DIR, 'campaigns', 'veerhuis', 'meta.json');
    const meta = JSON.parse(fs.readFileSync(pad, 'utf8'));
    fs.writeFileSync(pad, JSON.stringify({ ...meta, bronTeksten: true }, null, 2));

    const r = await req(server, 'GET', '/api/bron/spells-2024?campagne=veerhuis', null, beheerder);
    const metTekst = spreuken(r.body).filter(s => tekstVan(s).length > 50);
    assert.ok(metTekst.length > 50, 'met de vlag aan komt de tekst wél mee');

    fs.writeFileSync(pad, JSON.stringify(meta, null, 2));
  });
});
