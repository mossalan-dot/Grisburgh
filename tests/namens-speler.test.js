const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De DM kon elke dienst bekíjken maar er niets in dóén: dertien van de veertien
// spelersacties beginnen met `req.session.characterId`, en die heeft hij niet.
// Een dienst end-to-end nakijken vroeg daardoor een tweede browser, want één
// browser deelt één sessiecookie. `_handelendKarakter()` is één helper in
// plaats van dertien uitzonderingen — mét de poorten van de speler namens wie
// je handelt, anders test je iets wat een speler nooit te zien krijgt.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-namens-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('De DM handelt namens een speler', () => {
  let server, io, dm, gid, speler, vreemde;

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

    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Joris', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    await req(server, 'PATCH', `/api/player-currency/${speler}`, { fl: 20, kn: 0, cl: 0 }, dm);

    // Iemand uit een ándere party: daar mag de DM niet namens handelen.
    const groep2 = (await req(server, 'POST', '/api/groups', { name: 'Elders' }, dm)).body;
    const gid2 = groep2?.id || groep2?.group?.id;
    vreemde = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Elders-Els', subtype: 'speler', data: { groep: gid2 } }, dm)).body.id;

    await req(server, 'PUT', '/api/meta/herberg', {
      naam: 'De Proefkroeg',
      menu: [{ id: 'menu_bier', naam: 'Kroes bier', prijs: '1 kn', tempHp: '3' }],
    }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const bestel = (extra = '') => req(server, 'POST', `/api/herberg/bestel${extra}`, { itemId: 'menu_bier' }, dm);
  const beurs  = async () => (await req(server, 'GET', `/api/player-currency/${speler}`, null, dm)).body;

  it('weigert de DM zonder speler — hij heeft zelf geen beurs', async () => {
    const r = await bestel();
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
    assert.match(String(r.body?.error || ''), /spelers/i);
  });

  it('schrijft af van de speler namens wie hij handelt', async () => {
    const voor = await beurs();
    const r = await bestel(`?alsSpeler=${speler}`);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const na = await beurs();
    const alsCl = (c) => (c.fl || 0) * 100 + (c.kn || 0) * 10 + (c.cl || 0);
    assert.strictEqual(alsCl(voor) - alsCl(na), 10, 'één knaker van zíjn beurs');

    // En het gevolg landt ook bij hem.
    const hp = (await req(server, 'GET', `/api/player-hp/${speler}`, null, dm)).body;
    assert.strictEqual(hp.temp, 3, 'de temp HP van de bestelling hoort bij hem');
  });

  it('accepteert alleen een speler uit de actieve party', async () => {
    const r = await bestel(`?alsSpeler=${vreemde}`);
    assert.strictEqual(r.status, 403, 'een speler uit een andere party mag niet: ' + JSON.stringify(r.body));
    const onzin = await bestel('?alsSpeler=bestaat-niet');
    assert.strictEqual(onzin.status, 403);
  });

  it('omzeilt de poorten niet — dat is het punt', async () => {
    await req(server, 'PUT', '/api/diensten/toegang',
      { groepId: gid, dienst: 'herberg', staat: 'verborgen' }, dm);

    // Als zichzelf komt de DM er nog steeds langs (hij test, en handelt namens
    // de tafel); namens een speler gelden diens poorten.
    const alsDm = await bestel();
    assert.ok(!/niet beschikbaar/i.test(String(alsDm.body?.error || '')),
      'de DM zelf hoort niet op de groepspoort te stuiten, kreeg: ' + JSON.stringify(alsDm.body));

    const namens = await bestel(`?alsSpeler=${speler}`);
    assert.strictEqual(namens.status, 403, JSON.stringify(namens.body));
    assert.match(String(namens.body?.error || ''), /niet beschikbaar/i);

    await req(server, 'PUT', '/api/diensten/toegang',
      { groepId: gid, dienst: 'herberg', staat: 'beschikbaar' }, dm);
  });

  it('laat een speler niet namens iemand anders handelen', async () => {
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    const tweede = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Maat', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    await req(server, 'PATCH', `/api/player-currency/${tweede}`, { fl: 5, kn: 0, cl: 0 }, dm);
    const spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;

    const voorMaat = (await req(server, 'GET', `/api/player-currency/${tweede}`, null, dm)).body;
    const r = await req(server, 'POST', `/api/herberg/bestel?alsSpeler=${tweede}`, { itemId: 'menu_bier' }, spelerC);
    assert.strictEqual(r.status, 200, 'hij bestelt gewoon — maar voor zichzelf');
    const naMaat = (await req(server, 'GET', `/api/player-currency/${tweede}`, null, dm)).body;
    assert.deepStrictEqual(naMaat, voorMaat, 'de beurs van de ander blijft onaangeroerd');
  });
});

describe('De Gock leest de geheimenlijst', () => {
  let server, io, dm, gid, speler, spelerC, doelwit;

  before(async () => {
    const DIR = path.join(os.tmpdir(), `grisburgh-test-gock-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.GRISBURGH_DATA_DIR = DIR;
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    server._dir = DIR;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Kees', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;
    await req(server, 'PATCH', `/api/player-currency/${speler}`, { fl: 500, kn: 0, cl: 0 }, dm);

    // Geheimen in de **nieuwe** vorm: een lijst met eigen ids.
    doelwit = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Ursûn de Stille',
      data: { geheimen: JSON.stringify([
        { id: 'g1', tekst: 'Hij betaalt de wacht om weg te kijken.' },
        { id: 'g2', tekst: 'Zijn broer leeft nog.' },
      ]) },
    }, dm)).body.id;
    await req(server, 'PUT', `/api/entities/personages/${doelwit}/visibility`, { target: 'visible' }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(server._dir, { recursive: true, force: true });
  });

  const onderzoek = async () => {
    const r = await req(server, 'POST', '/api/gock/opdracht',
      { entityId: doelwit, entityType: 'personages' }, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    // Het dossier is pas na een dag klaar; voor de proef zetten we 'm gereed.
    const st = JSON.parse(fs.readFileSync(path.join(server._dir, 'campaigns/grisburgh/dm-state.json'), 'utf8'));
    st.gockState[speler].gereed = true;
    st.gockState[speler].klaarOp = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(path.join(server._dir, 'campaigns/grisburgh/dm-state.json'), JSON.stringify(st, null, 2));
    return req(server, 'PUT', '/api/gock/opgehaald', {}, spelerC);
  };

  it('levert een geheim uit de lijst, niet een willekeurig tidbit', async () => {
    const r = await onderzoek();
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const items = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
    const lijst = Array.isArray(items) ? items : (items?.items || []);
    const rapport = lijst.find(i => String(i.id || '').startsWith('gock_'));
    assert.ok(rapport, 'er hoort een rapport in de boedel te staan');
    assert.match(rapport.note, /wacht om weg te kijken|broer leeft nog/,
      'de tekst hoort uit de geheimenlijst te komen, kreeg: ' + rapport.note);
  });

  it('zet dezelfde regel open op het kaartje', async () => {
    const kaartje = (await req(server, 'GET', `/api/entities/personages/${doelwit}`, null, spelerC)).body;
    const geheimen = kaartje._geheimen || kaartje.data?.geheimen;
    assert.ok(kaartje._geheimOnthuld >= 1,
      'de party wist het uit het rapport, dus het kaartje hoort het ook open te zetten: '
      + JSON.stringify({ onthuld: kaartje._geheimOnthuld, geheimen }));
  });

  it('geeft de tweede keer een ánder geheim', async () => {
    const r = await onderzoek();
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const items = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
    const lijst = Array.isArray(items) ? items : (items?.items || []);
    const rapporten = lijst.filter(i => String(i.id || '').startsWith('gock_'));
    assert.strictEqual(rapporten.length, 2);
    assert.notStrictEqual(rapporten[0].note, rapporten[1].note,
      'twee keer onderzoek naar dezelfde man hoort iets nieuws op te leveren');
  });
});
