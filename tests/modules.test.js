const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Een module die uit staat verdwijnt volledig uit beeld. Wat aan staat bepaalt
// de beheerder — niet elke DM, want dat raakt andermans campagne.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-mod-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Modules per campagne', () => {
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
    assert.ok(beheerder && andereDm, 'beide DM\'s zijn ingelogd');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const metaVan = async (cookie) => (await req(server, 'GET', '/api/meta', null, cookie)).body;

  it('geeft een nieuwe campagne de startset, zonder het campagne-eigen werk', async () => {
    const m = await metaVan(andereDm);
    assert.equal(m.modules.herberg,   true,  'herberg hoort bij de startset');
    assert.equal(m.modules.gevecht,   true);
    assert.equal(m.modules.tempel,    false, 'de tempel is te campagne-eigen');
    assert.equal(m.modules.facties,   false);
    assert.equal(m.modules.aktes,     false);
  });

  it('vertelt de client wélke knoppen weg moeten', async () => {
    const { verborgen } = await metaVan(andereDm);
    assert.ok(verborgen.secties.includes('tempel'), 'de zijbalkknop van de tempel');
    assert.ok(verborgen.dmTabs.includes('aktes'),   'de Aktes-tab in de Meesterkamer');
    assert.ok(verborgen.spelerTabs.includes('facties'), 'de Facties-subtab van de speler');
    assert.ok(!verborgen.secties.includes('herberg'), 'maar de herberg blijft staan');
  });

  it('laat de beheerder een module aanzetten', async () => {
    const r = await req(server, 'PUT', '/api/campaigns/vestingveen/modules',
      { modules: { tempel: true, herberg: false } }, beheerder);
    assert.equal(r.status, 200);
    assert.equal(r.body.modules.tempel, true);
    const m = await metaVan(andereDm);
    assert.equal(m.modules.tempel,  true,  'en de campagne zelf ziet het ook');
    assert.equal(m.modules.herberg, false);
    assert.ok(m.verborgen.secties.includes('herberg'), 'de herbergknop is nu weg');
  });

  it('negeert verzonnen modulenamen', async () => {
    await req(server, 'PUT', '/api/campaigns/vestingveen/modules', { modules: { onzin: true } }, beheerder);
    const m = await metaVan(andereDm);
    assert.equal(m.modules.onzin, undefined);
  });

  it('houdt campagnebeheer bij de beheerder', async () => {
    const lijst = await req(server, 'GET', '/api/campaigns', null, andereDm);
    assert.equal(lijst.status, 403, 'een andere DM ziet niet welke campagnes er nog meer staan');
    const zet = await req(server, 'PUT', '/api/campaigns/grisburgh/modules', { modules: { gevecht: false } }, andereDm);
    assert.equal(zet.status, 403, 'en zet zeker geen modules uit bij een ander');
    const actief = await req(server, 'PUT', '/api/campaigns/active', { id: 'vestingveen' }, andereDm);
    assert.equal(actief.status, 403, 'en verzet de standaardcampagne niet');
    const eigen = await metaVan(beheerder);
    assert.equal(eigen.modules.gevecht, true, 'bij de beheerder is er niets veranderd');
  });

  it('geeft een nieuwe campagne meteen een eigen DM-wachtwoord', async () => {
    const maak = await req(server, 'POST', '/api/campaigns',
      { id: 'stilzwijgen', meta: { appTitle: 'Stilzwijgen' }, dmPassword: 'stil-en-lang' }, beheerder);
    assert.equal(maak.status, 201);
    assert.equal(maak.body.heeftWachtwoord, true);

    const login = await req(server, 'POST', '/api/auth/toegang',
      { campagne: 'stilzwijgen', wachtwoord: 'stil-en-lang' });
    assert.equal(login.body.rol, 'dm', 'de DM kan er meteen in');

    const opSchijf = JSON.parse(fs.readFileSync(
      path.join(DATA_DIR, 'campaigns', 'stilzwijgen', 'dm-state.json'), 'utf8')).dmPassword;
    assert.ok(opSchijf.startsWith('scrypt$'), 'en het staat gehasht op schijf');
  });

  it('weigert een te kort wachtwoord bij het aanmaken', async () => {
    const r = await req(server, 'POST', '/api/campaigns',
      { id: 'kortje', dmPassword: 'kort' }, beheerder);
    assert.equal(r.status, 400);
  });

  it('laat de beheerder wel de lijst met modules zien', async () => {
    const r = await req(server, 'GET', '/api/campaigns', null, beheerder);
    assert.equal(r.status, 200);
    assert.ok(r.body.catalogus.find(m => m.id === 'tempel'), 'de catalogus komt mee');
    assert.equal(r.body.modules.vestingveen.tempel, true, 'met de stand per campagne');
  });
});
