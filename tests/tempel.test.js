const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De Tempel had geen enkele test, terwijl hij het meest onomkeerbare gevolg van
// alle diensten draagt: een eed sluit de andere goden af tot de DM hem heft of
// de speler hem verzaakt — en dan zit er een vloek op die alleen met een boete
// weggaat. Precies het soort ding waarvan je pas aan tafel merkt dat het stuk is.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-tempel-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('De Tempel: zegen, eed, vloek en boete', () => {
  let server, io, dm, gid, speler, spelerC;

  const alsCl = (c) => (c?.fl || 0) * 100 + (c?.kn || 0) * 10 + (c?.cl || 0);

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);

    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Pelgrim', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;

    // Twee goden, zodat we kunnen zien dat een eed de ándere afsluit.
    await req(server, 'PUT', '/api/meta/tempel', {
      naam: 'De Proeftempel',
      prijs:      { fl: 25 },
      eedPrijs:   { fl: 50 },
      boetePrijs: { fl: 100 },
      voorwerpNaam: 'Votiefmunt van {god}',
      goden: [
        { id: 'god_morra', naam: 'Morra', domein: 'Tij', zegen: 'Je ademt onder water.',
          vloek: 'Zout water brandt op je huid.',
          eenmaligeZegens: ['Herrol één gemiste aanvalsworp.'] },
        { id: 'god_vask',  naam: 'Vask',  domein: 'Smidse', zegen: 'Je wapens roesten niet.',
          vloek: 'IJzer weigert je dienst.',
          eenmaligeZegens: ['Tel +2 bij één schadeworp.'] },
      ],
    }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const beurs  = async () => (await req(server, 'GET', `/api/player-currency/${speler}`, null, dm)).body;
  const vulBeurs = (fl) => req(server, 'PATCH', `/api/player-currency/${speler}`, { fl, kn: 0, cl: 0 }, dm);
  const boedel = async () => {
    const b = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
    return Array.isArray(b) ? b : (b?.items || []);
  };

  it('verkoopt een zegen, en schrijft de prijs van de god af', async () => {
    await vulBeurs(100);
    const voor = alsCl(await beurs());
    const r = await req(server, 'POST', '/api/tempel/zegen', { godId: 'god_morra' }, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    assert.strictEqual(voor - alsCl(await beurs()), 2500, '25 fl van de beurs');
    const zegen = (await boedel()).find(i => i.zegen);
    assert.ok(zegen, 'de zegen hoort als voorwerp in de boedel te staan');
    assert.strictEqual(zegen.godNaam, 'Morra');
    assert.strictEqual(zegen.name, 'Votiefmunt van Morra', 'de naam volgt het sjabloon van de DM');
    assert.ok(zegen.uses >= 1 && zegen.uses <= 4, 'het aantal keer komt van een d4: ' + zegen.uses);
    assert.strictEqual(zegen.usesMax, zegen.uses);
  });

  it('houdt er één tegelijk — een tweede vervangt de eerste', async () => {
    await req(server, 'POST', '/api/tempel/zegen', { godId: 'god_vask' }, spelerC);
    const zegens = (await boedel()).filter(i => i.zegen);
    assert.strictEqual(zegens.length, 1, 'niet twee votiefmunten tegelijk');
    assert.strictEqual(zegens[0].godNaam, 'Vask', 'de nieuwe vervangt de oude');
  });

  it('vinkt af tot hij op is en verdwijnt dan', async () => {
    let zegen = (await boedel()).find(i => i.zegen);
    const keer = zegen.uses;
    for (let i = 1; i <= keer; i++) {
      const r = await req(server, 'POST', '/api/tempel/verbruik', {}, spelerC);
      assert.strictEqual(r.status, 200, JSON.stringify(r.body));
      if (i < keer) assert.strictEqual(r.body.uses, keer - i, 'er hoort er één af te gaan');
      else assert.strictEqual(r.body.removed, true, 'de laatste haalt hem weg');
    }
    assert.ok(!(await boedel()).some(i => i.zegen), 'op is op');

    const nogEens = await req(server, 'POST', '/api/tempel/verbruik', {}, spelerC);
    assert.strictEqual(nogEens.status, 404, 'afvinken zonder zegen hoort niet te kunnen');
  });

  it('weigert een zegen zonder geld', async () => {
    await vulBeurs(0);
    const r = await req(server, 'POST', '/api/tempel/zegen', { godId: 'god_morra' }, spelerC);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
    assert.match(String(r.body?.error || ''), /saldo/i);
    assert.ok(!(await boedel()).some(i => i.zegen), 'en er komt niets in de boedel');
  });

  it('bindt met een eed, en sluit daarmee de andere goden af', async () => {
    await vulBeurs(100);
    const voor = alsCl(await beurs());
    const r = await req(server, 'POST', '/api/tempel/eed', { godId: 'god_morra' }, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(voor - alsCl(await beurs()), 5000, 'de eedprijs, niet de zegenprijs');

    const eed = (await boedel()).find(i => i.eed);
    assert.ok(eed, 'de eed hoort als voorwerp in de boedel te staan');
    assert.strictEqual(eed.status, 'nagekomen');
    assert.strictEqual(eed.zegenEffect, 'Je ademt onder water.');

    // De tweede god is nu dicht — ook een ándere god.
    const tweede = await req(server, 'POST', '/api/tempel/eed', { godId: 'god_vask' }, spelerC);
    assert.strictEqual(tweede.status, 400, JSON.stringify(tweede.body));
    assert.match(String(tweede.body?.error || ''), /al door een eed gebonden/i);
  });

  it('maakt van een verzaakte eed een vloek, en die koop je af met een boete', async () => {
    const verbreek = await req(server, 'POST', '/api/tempel/eed/verbreek', { characterId: speler }, dm);
    assert.strictEqual(verbreek.status, 200, JSON.stringify(verbreek.body));

    const vloek = (await boedel()).find(i => i.eed);
    assert.strictEqual(vloek.status, 'vloek');
    assert.match(String(vloek.note || ''), /Zout water brandt/, 'de vloek van díé god');

    // Twee keer verzaken kan niet.
    const nogEens = await req(server, 'POST', '/api/tempel/eed/verbreek', { characterId: speler }, dm);
    assert.strictEqual(nogEens.status, 400);

    // Boete doen kost de boeteprijs en haalt de vloek weg.
    await vulBeurs(150);
    const voor = alsCl(await beurs());
    const boete = await req(server, 'POST', '/api/tempel/boete', {}, spelerC);
    assert.strictEqual(boete.status, 200, JSON.stringify(boete.body));
    assert.strictEqual(voor - alsCl(await beurs()), 10000, 'de boeteprijs');
    assert.ok(!(await boedel()).some(i => i.eed), 'vrij van de vloek');

    // En daarna mag je weer aan een god verbinden.
    const opnieuw = await req(server, 'POST', '/api/tempel/eed', { godId: 'god_vask' }, spelerC);
    assert.strictEqual(opnieuw.status, 200, JSON.stringify(opnieuw.body));
  });

  it('laat de DM een eed heffen — zonder boete, want dat is zijn beslissing', async () => {
    const r = await req(server, 'POST', '/api/tempel/eed/hef', { characterId: speler }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(!(await boedel()).some(i => i.eed), 'de eed is weg');

    const leeg = await req(server, 'POST', '/api/tempel/eed/hef', { characterId: speler }, dm);
    assert.strictEqual(leeg.status, 404, 'heffen zonder eed hoort een 404 te geven');
  });

  it('is voor een speler dicht zodra de dienst dichtstaat', async () => {
    await vulBeurs(100);
    await req(server, 'PUT', '/api/diensten/toegang',
      { groepId: gid, dienst: 'tempel', staat: 'verborgen' }, dm);
    const r = await req(server, 'POST', '/api/tempel/zegen', { godId: 'god_morra' }, spelerC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
    await req(server, 'PUT', '/api/diensten/toegang',
      { groepId: gid, dienst: 'tempel', staat: 'beschikbaar' }, dm);
  });

  it('kent geen onbekende god', async () => {
    const r = await req(server, 'POST', '/api/tempel/zegen', { godId: 'god_bestaat-niet' }, spelerC);
    assert.strictEqual(r.status, 404, JSON.stringify(r.body));
    const zonder = await req(server, 'POST', '/api/tempel/eed', {}, spelerC);
    assert.strictEqual(zonder.status, 400, 'zonder godId hoort een 400');
  });
});
