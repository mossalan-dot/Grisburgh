const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Spreuken en class features gaan als structuur de deur uit, niet als tekst:
// namen, niveaus, scholen en tijden wel, de PHB-beschrijving niet. Wat de DM
// zelf schrijft is van hem en gaat altijd mee.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-bron-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

const vind = (lijst, naam) => lijst.find(s => s.name === naam);

describe('Bronteksten blijven binnen de campagne die ze mag zien', () => {
  let server, io, storage, beheerder, andereDm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('vestingveen', { appTitle: 'Vestingveen' });
    fs.writeFileSync(path.join(DATA_DIR, 'campaigns', 'vestingveen', 'dm-state.json'),
      JSON.stringify({ dmPassword: 'vestingveen-dm', groups: {} }, null, 2));
    beheerder = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    andereDm  = (await req(server, 'POST', '/api/auth/login', { campagne: 'vestingveen', password: 'vestingveen-dm' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('serveert de bronbestanden niet meer als statisch bestand', async () => {
    // Het pad valt nu in de SPA-fallback, dus je krijgt de shell — geen spreuken.
    const r = await req(server, 'GET', '/data/spells-2024.json');
    assert.equal(typeof r.body, 'string', 'geen JSON meer op dat pad');
    assert.ok(!r.body.includes('Fireball'), 'en zeker geen spreukteksten');
  });

  it('vraagt een sessie voor de bron', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024');
    assert.equal(r.status, 401);
  });

  it('geeft de beheerder de volledige tekst', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024', null, beheerder);
    const fireball = vind(r.body.results, 'Fireball');
    assert.ok(fireball.desc.join(' ').length > 100, 'de beschrijving staat erin');
  });

  it('geeft een andere campagne de structuur zonder de tekst', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024', null, andereDm);
    const fireball = vind(r.body.results, 'Fireball');
    assert.equal(fireball.name, 'Fireball',   'de naam blijft');
    assert.equal(fireball.level, 3,           'het niveau blijft');
    assert.equal(fireball.school.name, 'Evocation', 'de school blijft');
    assert.equal(fireball.casting_time, 'Action',   'de casting time blijft');
    assert.deepEqual(fireball.desc, [],       'de beschrijving niet');
    assert.deepEqual(fireball.higher_level, []);
  });

  it('laat de DM zijn eigen beschrijving schrijven, en die blijft van hem', async () => {
    const bewaard = await req(server, 'PUT', '/api/bron/spreuk/fireball',
      { desc: 'Een bol vuur zo groot als een kar.\n\nDe hitte blijft nog even hangen.' }, andereDm);
    assert.equal(bewaard.status, 200);
    assert.equal(bewaard.body.desc.length, 2, 'lege regels splitsen de alineas');

    const r = await req(server, 'GET', '/api/bron/spells-2024', null, andereDm);
    const fireball = vind(r.body.results, 'Fireball');
    assert.match(fireball.desc[0], /bol vuur/);

    // En de buurcampagne merkt er niets van.
    const bij = await req(server, 'GET', '/api/bron/spells-2024', null, beheerder);
    assert.ok(!vind(bij.body.results, 'Fireball').desc[0].includes('bol vuur'));
  });

  it('wist de eigen beschrijving als het veld leeg is', async () => {
    await req(server, 'PUT', '/api/bron/spreuk/fireball', { desc: '   ' }, andereDm);
    const r = await req(server, 'GET', '/api/bron/spells-2024', null, andereDm);
    assert.deepEqual(vind(r.body.results, 'Fireball').desc, []);
  });

  it('doet hetzelfde met class features', async () => {
    const kaal = await req(server, 'GET', '/api/progression', null, andereDm);
    const rage = kaal.body.classes.Barbarian.levels['1'].find(f => f.name === 'Rage');
    assert.equal(rage.name, 'Rage', 'de feature staat er, op het juiste niveau');
    assert.equal(rage.desc, '',     'zonder tekst');

    const vol = await req(server, 'GET', '/api/progression', null, beheerder);
    assert.ok(vol.body.classes.Barbarian.levels['1'].find(f => f.name === 'Rage').desc.length > 50);
  });

  it('houdt de features-bibliotheek en backgrounds net zo kaal', async () => {
    const feats = await req(server, 'GET', '/api/bron/feature-descriptions', null, andereDm);
    assert.deepEqual(feats.body, {}, 'geen losse SRD-teksten');
    const bg = await req(server, 'GET', '/api/bron/backgrounds-2024', null, andereDm);
    const acoliet = Object.values(bg.body)[0];
    assert.equal(Object.values(acoliet.levels)[0][0].desc, '');
  });

  it('kent geen andere bestanden dan de bronnenlijst', async () => {
    const r = await req(server, 'GET', '/api/bron/..%2F..%2Fconfig', null, beheerder);
    assert.equal(r.status, 404);
  });
});
