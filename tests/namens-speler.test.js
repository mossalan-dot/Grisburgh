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

  // De schrijfkant en de leeskant moeten dezelfde persoon aanhouden. Deden ze
  // dat niet, dan schreef de herberg de vragenteller weg onder de speler en las
  // het scherm hem terug onder 'dm': een lege teller, en pas bij de vierde klik
  // merkte je dat het op was.
  it('toont bij het lezen de stand van diezelfde speler', async () => {
    await req(server, 'PUT', '/api/meta/herberg', {
      naam: 'De Proefkroeg', maxVragen: 3,
      menu: [{ id: 'menu_bier', naam: 'Kroes bier', prijs: '1 kn', tempHp: '3' }],
    }, dm);
    await req(server, 'PATCH', `/api/player-currency/${speler}`, { fl: 20, kn: 0, cl: 0 }, dm);

    const doel = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Roddeldoelwit', data: { flavour: 'Hij hoest raar.' } }, dm)).body.id;

    const vraag = () => req(server, 'POST', `/api/herberg/vraag?alsSpeler=${speler}`, { entityId: doel }, dm);
    const lees  = () => req(server, 'GET',  `/api/herberg?alsSpeler=${speler}`, null, dm);

    assert.strictEqual((await lees()).body.state.vragen, 0, 'schoon aan het begin');
    await vraag();
    assert.strictEqual((await lees()).body.state.vragen, 1,
      'wat er namens hem geschreven is, hoort er namens hem ook uit te komen');

    // En als jezelf lees je je eigen (lege) stand.
    const alsDm = await req(server, 'GET', '/api/herberg', null, dm);
    assert.strictEqual(alsDm.body.state.vragen, 0, 'de DM heeft zijn eigen teller');
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

  // Eén ronde onderzoek, zoals aan tafel: bestellen, de DM laten kiezen als er
  // iets te kiezen valt, een nacht slapen, dossier ophalen.
  const onderzoek = async (kies = null) => {
    const r = await req(server, 'POST', '/api/gock/opdracht',
      { entityId: doelwit, entityType: 'personages' }, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    // Bij meer dan één onbekend geheim wacht het dossier op de DM.
    const open = (await req(server, 'GET', '/api/gock/verzoeken', null, dm)).body.verzoeken || [];
    const vraag = open.find(v => v.characterId === speler);
    if (vraag) {
      const ids = kies ? [kies] : [vraag.kandidaten[0].id];
      await req(server, 'POST', `/api/gock/verzoek/${speler}/kies`, { geheimIds: ids }, dm);
    }

    // Een dossier is klaar na de eerstvolgende lange rust van de party — niet
    // na 24 uur op de klok.
    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    await req(server, 'GET', '/api/gock', null, spelerC);   // zet 'gereed'
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

  // Het dossier gaat op twee momenten door de onthulstand heen: zodra het na de
  // wachttijd gereed is, en bij het ophalen. Die twee moeten dezelfde regel
  // pakken — en geen van beide mag wissen wat de party al wist.
  // Bij meer dan één onbekend geheim vult het onderzoek zichzelf niet in: dan
  // bestelt een speler één dossier, krijgt één regel en denkt dat hij alles
  // weet. De DM wijst aan wat de detective vindt.
  it('vraagt de DM welke geheimen de detective vindt', async () => {
    const doelwit3 = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Drie geheimen',
      data: { geheimen: JSON.stringify([
        { id: 'b1', tekst: 'Hij vervalst zegels.' },
        { id: 'b2', tekst: 'Hij heeft een tweede gezin.' },
        { id: 'b3', tekst: 'Hij is bang voor water.' },
      ]) },
    }, dm)).body.id;
    await req(server, 'PUT', `/api/entities/personages/${doelwit3}/visibility`, { target: 'visible' }, dm);

    await req(server, 'POST', '/api/gock/opdracht',
      { entityId: doelwit3, entityType: 'personages' }, spelerC);

    const open = (await req(server, 'GET', '/api/gock/verzoeken', null, dm)).body.verzoeken || [];
    const v = open.find(x => x.entityId === doelwit3);
    assert.ok(v, 'het dossier hoort op de DM te wachten: ' + JSON.stringify(open));
    assert.strictEqual(v.kandidaten.length, 3, 'alle drie de onbekende regels staan erbij');
    assert.ok(v.kandidaten.every(k => k.tekst), 'mét hun tekst, zodat je op inhoud kiest');

    // Zolang hij niet gekozen heeft, is het onderzoek niet af — ook niet na een rust.
    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    let stand = (await req(server, 'GET', '/api/gock', null, spelerC)).body;
    assert.strictEqual(stand.geval.gereed, false, 'wachten op de DM is geen wachttijd');

    // Twee van de drie.
    const kies = await req(server, 'POST', `/api/gock/verzoek/${speler}/kies`,
      { geheimIds: ['b1', 'b3'] }, dm);
    assert.strictEqual(kies.status, 200, JSON.stringify(kies.body));
    assert.match(kies.body.tekst, /vervalst zegels/);
    assert.match(kies.body.tekst, /bang voor water/);

    // Nu loopt hij af op de volgende rust.
    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    stand = (await req(server, 'GET', '/api/gock', null, spelerC)).body;
    assert.strictEqual(stand.geval.gereed, true, 'na de lange rust is het dossier klaar');

    await req(server, 'PUT', '/api/gock/opgehaald', {}, spelerC);
    const kaartje = (await req(server, 'GET', `/api/entities/personages/${doelwit3}`, null, dm)).body;
    assert.strictEqual(kaartje._geheimOnthuld, 2, 'precies de twee die de DM aanwees');
  });

  it('laat bestaande onthullingen met rust als het dossier gereed wordt', async () => {
    const doelwit2 = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Twee geheimen',
      data: { geheimen: JSON.stringify([
        { id: 'a1', tekst: 'Eerste geheim.' },
        { id: 'a2', tekst: 'Tweede geheim.' },
      ]) },
    }, dm)).body.id;
    await req(server, 'PUT', `/api/entities/personages/${doelwit2}/visibility`, { target: 'visible' }, dm);

    // De DM onthult zelf regel twee.
    await req(server, 'PUT', `/api/entities/personages/${doelwit2}/secret`, { gid: 'a2' }, dm);
    let kaartje = (await req(server, 'GET', `/api/entities/personages/${doelwit2}`, null, dm)).body;
    assert.strictEqual(kaartje._geheimOnthuld, 1);

    // En dan laat de party hem onderzoeken.
    await req(server, 'POST', '/api/gock/opdracht',
      { entityId: doelwit2, entityType: 'personages' }, spelerC);
    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);

    // Het ophalen van de stand zet het dossier op gereed en onthult.
    await req(server, 'GET', '/api/gock', null, spelerC);
    kaartje = (await req(server, 'GET', `/api/entities/personages/${doelwit2}`, null, dm)).body;
    assert.strictEqual(kaartje._geheimOnthuld, 2,
      'wat de DM al had onthuld hoort te blijven staan — dit overschreef de hele stand');

    await req(server, 'PUT', '/api/gock/opgehaald', {}, spelerC);
  });

  it('geeft de tweede keer een ánder geheim', async () => {
    const r = await onderzoek();
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const items = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
    const lijst = Array.isArray(items) ? items : (items?.items || []);
    // Alleen de rapporten over dít doelwit: andere proeven in dit bestand laten
    // ook dossiers achter bij dezelfde speler.
    const rapporten = lijst.filter(i => String(i.id || '').startsWith('gock_')
                                     && /Ursûn de Stille/.test(i.name || ''));
    assert.strictEqual(rapporten.length, 2);
    assert.notStrictEqual(rapporten[0].note, rapporten[1].note,
      'twee keer onderzoek naar dezelfde man hoort iets nieuws op te leveren');
  });
});
