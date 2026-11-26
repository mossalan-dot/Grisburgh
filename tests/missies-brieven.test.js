const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Missies zijn de quest givers van een factie, en het afronden ervan raakt drie
// dingen tegelijk: de status, het aanzien van de party (met alles wat een
// rangstijging ontgrendelt) en de beurs. Brieven raken maar één ding, maar wel
// het gevoeligste: wie hem te lezen krijgt.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-missies-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Missies: status, aanzien en beloning', () => {
  let server, io, dm, gid, speler, spelerC, maat, zwaard;

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
      { name: 'Loopjongen', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    maat = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Maat', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;

    zwaard = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Gildezwaard', data: { itemType: 'Weapon', gebruik: 'uniek' } }, dm)).body.id;

    // Eén factie met een rang die zowel tekst als een kaartje ontgrendelt.
    await req(server, 'PUT', '/api/meta/facties', {
      facties: [{
        id: 'gilde', naam: 'Het Gilde', renownDrempels: [0, 2],
        rangen: [
          { naam: 'Buitenstaander' },
          { naam: 'Gezel', unlocks: [
            { type: 'tekst',    naam: 'Onderdak', tekst: 'Een bed in de kelder.' },
            { type: 'voorwerp', entityId: zwaard },
          ] },
        ],
      }],
    }, dm);
    await req(server, 'POST', '/api/facties/gilde/reveal', null, dm);   // toggle: aan
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const missiesVanSpeler = async () =>
    ((await req(server, 'GET', '/api/missies', null, spelerC)).body.missies || []);
  const maakMissie = async (velden) => {
    const r = await req(server, 'POST', '/api/missies', {
      factieId: 'gilde', titel: 'Haal het pakket', tekst: 'Bij de brug.', ...velden,
    }, dm);
    assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
    return r.body.id || r.body.missie?.id;
  };

  it('toont een missie pas als de party genoeg aanzien heeft', async () => {
    await maakMissie({ vereistRenown: 5, titel: 'Voor gevorderden' });
    assert.ok(!(await missiesVanSpeler()).some(m => m.titel === 'Voor gevorderden'),
      'een missie boven je stand zie je niet');

    await maakMissie({ vereistRenown: 0, titel: 'Voor beginners' });
    assert.ok((await missiesVanSpeler()).some(m => m.titel === 'Voor beginners'));
  });

  it('laat een speler een missie aanvragen, en de DM hem gunnen', async () => {
    const id = await maakMissie({ titel: 'Het pakket', renownBeloning: 2, valuta: { fl: 10 } });

    const vraag = await req(server, 'POST', `/api/missies/${id}/accepteer`, {}, spelerC);
    assert.strictEqual(vraag.status, 200, JSON.stringify(vraag.body));
    let mijn = (await missiesVanSpeler()).find(m => m.id === id);
    assert.strictEqual(mijn.status, 'aangevraagd');

    const ok = await req(server, 'POST', `/api/missies/${id}/goedkeuren`, {}, dm);
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
    mijn = (await missiesVanSpeler()).find(m => m.id === id);
    assert.strictEqual(mijn.status, 'actief');
  });

  it('geeft bij het voltooien aanzien, geld én wat de rang ontgrendelt', async () => {
    const id = await maakMissie({ titel: 'De lange rit', renownBeloning: 2, valuta: { fl: 10 } });
    await req(server, 'POST', `/api/missies/${id}/accepteer`, {}, spelerC);
    await req(server, 'POST', `/api/missies/${id}/goedkeuren`, {}, dm);

    const voor = alsCl((await req(server, 'GET', `/api/player-currency/${speler}`, null, dm)).body);
    const r = await req(server, 'POST', `/api/missies/${id}/voltooien`, {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.nieuweRang, 'Gezel', 'twee renown tilt de party naar Gezel');

    // Het geld wordt eerlijk gedeeld over de party.
    const na = alsCl((await req(server, 'GET', `/api/player-currency/${speler}`, null, dm)).body);
    assert.strictEqual(na - voor, 500, '10 fl over twee spelers');

    // En de ontgrendelingen lopen langs dezelfde weg als een handmatige
    // renown-wijziging: de tekst als regel in de boedel, het kaartje in bezit.
    // Dit was een tweede kopie die alleen voorwerp-boons kende en ze als losse
    // regel uitdeelde.
    const items = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
    const lijst = Array.isArray(items) ? items : (items?.items || []);
    assert.ok(lijst.some(i => /Onderdak/.test(i.name || '')),
      'de tekst-unlock hoort in de boedel te komen: ' + JSON.stringify(lijst.map(i => i.name)));

    const bezit = (await req(server, 'GET', `/api/items/${zwaard}/bezit`, null, dm)).body;
    const rijen = (bezit.groepen || []).flatMap(x => x.rijen || []);
    assert.ok(rijen.length, 'het kaartje hoort écht in bezit te komen, niet als regeltje');
  });

  it('deelt dezelfde ontgrendeling geen tweede keer uit', async () => {
    const items = async () => {
      const b = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
      const l = Array.isArray(b) ? b : (b?.items || []);
      return l.filter(i => /Onderdak/.test(i.name || '')).length;
    };
    const voor = await items();
    await req(server, 'POST', '/api/facties/gilde/renown', { delta: 3 }, dm);
    assert.strictEqual(await items(), voor,
      'de rang was al bereikt, dus er komt niets bij — ook niet via de andere route');
  });

  it('verbergt een voltooide missie voor de speler', async () => {
    const open = await missiesVanSpeler();
    assert.ok(!open.some(m => m.titel === 'De lange rit'), 'wat af is verdwijnt van het bord');
  });

  // **Staat de gedeelde beurs aan, dan komt het bedrag er compleet in.**
  //
  // Let op waar de winst van die aparte tak in zit, want dat is niet wat je
  // zou denken: `_deductCurrency` stuurt een bijschrijving **zelf** al naar de
  // gedeelde beurs als die aanstaat, dus de bestemming klopt ook zonder die
  // tak. Het verschil is de **afronding**. Per speler uitbetalen doet
  // `Math.floor(bedrag / aantal)`, en wat er niet gelijk op deelt verdwijnt:
  // bij drie spelers en 10 fl is dat 333 per persoon en 999 in de beurs.
  // Daarom staat de toets op drie spelers en een bedrag dat niet opdeelt —
  // met twee spelers en een rond bedrag slaagt hij ook op de kapotte versie,
  // en dan toetst hij niets. (Dat was de eerste versie van deze toets.)
  it('stort de beloning compleet in de gedeelde beurs, zonder centelingen te verliezen', async () => {
    const derde = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Derde wiel', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    assert.ok(derde, 'de derde speler hoort er te zijn');

    await req(server, 'PUT', '/api/party-currency/toggle', { enabled: true, groupId: gid }, dm);
    const voor = alsCl((await req(server, 'GET', '/api/party-currency', null, dm)).body);

    const id = await maakMissie({ titel: 'De gedeelde buit', valuta: { fl: 10 } });
    await req(server, 'POST', `/api/missies/${id}/accepteer`, {}, spelerC);
    await req(server, 'POST', `/api/missies/${id}/goedkeuren`, {}, dm);
    const r = await req(server, 'POST', `/api/missies/${id}/voltooien`, {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const na = alsCl((await req(server, 'GET', '/api/party-currency', null, dm)).body);
    assert.strictEqual(na - voor, 1000,
      'het hele bedrag hoort erin te komen; per speler delen laat bij drie spelers 1 cl liggen');

    await req(server, 'PUT', '/api/party-currency/toggle', { enabled: false, groupId: gid }, dm);
    // De derde speler weer weg: hij zou de deling van de toets hierboven
    // veranderen als die na deze draait.
    await req(server, 'DELETE', `/api/entities/personages/${derde}`, null, dm);
  });

  it('laat een mislukte missie geen aanzien opleveren', async () => {
    const id = await maakMissie({ titel: 'De mislukking', renownBeloning: 5 });
    await req(server, 'POST', `/api/missies/${id}/accepteer`, {}, spelerC);
    await req(server, 'POST', `/api/missies/${id}/goedkeuren`, {}, dm);

    const factieVoor = ((await req(server, 'GET', '/api/facties', null, dm)).body.facties || [])
      .find(f => f.id === 'gilde').renown;
    const r = await req(server, 'POST', `/api/missies/${id}/falen`, {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const factieNa = ((await req(server, 'GET', '/api/facties', null, dm)).body.facties || [])
      .find(f => f.id === 'gilde').renown;
    assert.strictEqual(factieNa, factieVoor, 'falen levert niets op');
  });

  it('voltooit niets wat niet loopt', async () => {
    const id = await maakMissie({ titel: 'Nog niet begonnen' });
    const r = await req(server, 'POST', `/api/missies/${id}/voltooien`, {}, dm);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
  });

  it('laat een speler geen missie goedkeuren of voltooien', async () => {
    const id = await maakMissie({ titel: 'Eigen rechter' });
    for (const p of ['goedkeuren', 'voltooien', 'falen']) {
      const r = await req(server, 'POST', `/api/missies/${id}/${p}`, {}, spelerC);
      assert.strictEqual(r.status, 403, `${p} hoort DM-werk te zijn`);
    }
  });

  it('houdt het prikbord leeg als de factiedienst dichtstaat', async () => {
    await req(server, 'PUT', '/api/diensten/toegang',
      { groepId: gid, dienst: 'facties', staat: 'verborgen' }, dm);
    assert.deepStrictEqual(await missiesVanSpeler(), [],
      'een missie komt altijd van een factie');
    await req(server, 'PUT', '/api/diensten/toegang',
      { groepId: gid, dienst: 'facties', staat: 'beschikbaar' }, dm);
  });
});

describe('Brieven: wie hem krijgt, en wie niet', () => {
  let server, io, dm, gid, gid2, speler, spelerC, buur, buurC;

  before(async () => {
    const dir = path.join(os.tmpdir(), `grisburgh-test-brieven-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.GRISBURGH_DATA_DIR = dir;
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io; server._dir = dir;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    const tweede = (await req(server, 'POST', '/api/groups', { name: 'Tweede party' }, dm)).body;
    gid2 = tweede?.id || tweede?.group?.id;
    await req(server, 'PUT', `/api/groups/${gid2}/password`, { password: 'proef1234' }, dm);

    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Ontvanger', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    buur = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Buurman', subtype: 'speler', data: { groep: gid2 } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;
    buurC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: buur, password: 'proef1234' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(server._dir, { recursive: true, force: true });
  });

  const postVan = async (cookie) => (await req(server, 'GET', '/api/berichten', null, cookie)).body.berichten || [];

  it('bezorgt een brief bij één personage', async () => {
    const r = await req(server, 'POST', '/api/post', {
      titel: 'Een uitnodiging', tekst: 'Kom morgen naar de haven.',
      afzender: 'Een onbekende', characterId: speler, thema: 'ursula',
    }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const mijn = await postVan(spelerC);
    assert.strictEqual(mijn.length, 1);
    assert.strictEqual(mijn[0].titel, 'Een uitnodiging');
    assert.strictEqual(mijn[0].thema, 'ursula');
    assert.deepStrictEqual(await postVan(buurC), [], 'de buurman krijgt niets');
  });

  it('bezorgt een brief bij een hele party', async () => {
    const maat = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Kompaan', subtype: 'speler', data: { groep: gid } }, dm)).body.id;

    const r = await req(server, 'POST', '/api/post', {
      tekst: 'Aan het gezelschap.', groepId: gid, cinematic: true,
    }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const mijn = await postVan(spelerC);
    assert.ok(mijn.some(m => m.tekst === 'Aan het gezelschap.'), 'ik kreeg hem');
    assert.ok(mijn.find(m => m.tekst === 'Aan het gezelschap.').cinematic,
      'de verzegelde reveal staat op het bericht');

    const alle = (await req(server, 'GET', '/api/berichten', null, dm)).body.spelers || [];
    const bijMaat = (alle.find(s => s.characterId === maat)?.berichten || []);
    assert.ok(bijMaat.some(m => m.tekst === 'Aan het gezelschap.'), 'en mijn kompaan ook');
    assert.deepStrictEqual(await postVan(buurC), [], 'de andere party niet');
  });

  it('weigert een brief zonder tekst of zonder ontvanger', async () => {
    const leeg = await req(server, 'POST', '/api/post', { characterId: speler, tekst: '  ' }, dm);
    assert.strictEqual(leeg.status, 400, JSON.stringify(leeg.body));

    const nergens = await req(server, 'POST', '/api/post', { tekst: 'Aan niemand' }, dm);
    assert.strictEqual(nergens.status, 400, JSON.stringify(nergens.body));
  });

  it('markeert als gelezen en verwijdert alleen de eigen post', async () => {
    const mijn = await postVan(spelerC);
    const brief = mijn[0];

    const gelezen = await req(server, 'PUT',
      `/api/berichten/${speler}/${brief.id}/gelezen`, {}, spelerC);
    assert.strictEqual(gelezen.status, 200, JSON.stringify(gelezen.body));

    const vreemd = await req(server, 'DELETE',
      `/api/berichten/${speler}/${brief.id}`, null, buurC);
    assert.strictEqual(vreemd.status, 403, 'andermans post gooi je niet weg');

    const eigen = await req(server, 'DELETE',
      `/api/berichten/${speler}/${brief.id}`, null, spelerC);
    assert.strictEqual(eigen.status, 200, JSON.stringify(eigen.body));
    assert.ok(!(await postVan(spelerC)).some(m => m.id === brief.id), 'weg uit zijn postvak');
  });

  it('laat een speler zelf geen post versturen', async () => {
    const r = await req(server, 'POST', '/api/post',
      { tekst: 'Van mij aan de buurman', characterId: buur }, spelerC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
  });

  // **Een bezoeker zonder sessie leest niemands post.**
  // `attachRole` zet `req.role` standaard op `'player'` — dat is in dit project
  // al twee keer een gat geweest (`/api/files/:id`, de bron-route), want
  // `if (!req.role)` gaat dan nooit af. Hier hangt het aan `req.characterId`,
  // en de toets staat op wat er uit de deur komt: een lege lijst, en niet de
  // post van de eerste de beste speler.
  it('geeft een bezoeker zonder sessie geen enkele brief', async () => {
    await req(server, 'POST', '/api/post', {
      titel: 'Onder vier ogen', tekst: 'Kom alleen.', characterId: speler,
    }, dm);
    assert.ok((await postVan(spelerC)).some(m => m.titel === 'Onder vier ogen'), 'hij kreeg hem');

    // Geen cookie: precies wat een incognitovenster op de landingspagina doet.
    const kaal = await req(server, 'GET', '/api/berichten', null, null);
    assert.strictEqual(kaal.status, 200, JSON.stringify(kaal.body));
    assert.deepStrictEqual(kaal.body.berichten, [], 'zonder sessie is er niets te lezen');
    assert.strictEqual(kaal.body.spelers, undefined,
      'en zeker niet de DM-weergave met de post van iedereen');
    assert.ok(!JSON.stringify(kaal.body).includes('Kom alleen'),
      'nergens in het antwoord mag de inhoud van een brief staan');
  });
});
