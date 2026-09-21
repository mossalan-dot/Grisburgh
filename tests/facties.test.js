const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Een rang moet iets **ontgrendelen**, niet alleen iets zeggen. Tot 21 sep 2026
// werd elke boon een losse regel in de boedel — ook een voorwerp dat een echt
// kaartje heeft, met een beschrijving, een rariteit en een plek in de Markt.
// En de uitdeling ging naar élke speler van de campagne, ook naar party's die
// de factie niet eens kennen.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-facties-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Facties: een rang ontgrendelt iets', () => {
  let server, io, dm, gid, speler, spelerC, buitenstaander, zwaard, winkel, bondgenoot;

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
      { name: 'Hidde', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;

    // Een speler in een ándere party: die hoort niets te krijgen.
    const groep2 = (await req(server, 'POST', '/api/groups', { name: 'Tweede party' }, dm)).body;
    const gid2 = groep2?.id || groep2?.group?.id;
    buitenstaander = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Vreemde', subtype: 'speler', data: { groep: gid2 } }, dm)).body.id;

    zwaard = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Eedzwaard', data: { itemType: 'Weapon', rariteit: 'Rare', gebruik: 'uniek' } }, dm)).body.id;
    winkel = (await req(server, 'POST', '/api/entities/locaties',
      { name: 'De Stille Toonbank', data: { locType: 'Winkel', voorraad: JSON.stringify([{ naam: 'Touw', prijs: '1 kn' }]) } }, dm)).body.id;
    bondgenoot = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Vrouwe Kwartel', data: { kant: 'bondgenoot' } }, dm)).body.id;

    await req(server, 'PUT', '/api/meta/facties', {
      facties: [{
        id: 'proefgilde', naam: 'Het Proefgilde', embleem: 'landmark',
        renownDrempels: [0, 1, 3],
        rangen: [
          { naam: 'Buitenstaander' },
          { naam: 'Gezel', unlocks: [
            { type: 'tekst',    naam: 'Onderdak',  tekst: 'Een bed in de kelder.' },
            { type: 'voorwerp', entityId: zwaard },
            { type: 'verkoper', entityId: winkel },
            { type: 'titel',    titel: 'Gezel van het Proefgilde' },
          ] },
          { naam: 'Meester', vereist: { level: 5, missies: 2 }, unlocks: [
            { type: 'metgezel', entityId: bondgenoot, duur: 'langeRust' },
          ] },
        ],
      }],
    }, dm);
    await req(server, 'POST', '/api/facties/proefgilde/reveal', { zichtbaar: true }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const factieVanSpeler = async () =>
    ((await req(server, 'GET', '/api/facties', null, spelerC)).body.facties || [])[0];

  it('bewaart de nieuwe unlock-vorm en leest de oude nog', async () => {
    const f = await factieVanSpeler();
    assert.ok(f, 'de factie hoort zichtbaar te zijn');
    const gezel = f.ladder[1];
    assert.strictEqual(gezel.unlocks.length, 4, JSON.stringify(gezel.unlocks));
    assert.deepStrictEqual(gezel.unlocks.map(u => u.type).sort(),
      ['tekst', 'titel', 'verkoper', 'voorwerp']);

    // Oude vorm: een boon mét entityId is een voorwerp, zonder is tekst.
    await req(server, 'PUT', '/api/meta/facties', {
      facties: [{ id: 'oudgilde', naam: 'Oud Gilde', renownDrempels: [0, 1],
        rangen: [{ naam: 'Buiten' }, { naam: 'Binnen', titel: 'Broeder',
          boons: [{ naam: 'Kruidruil', tekst: 'Tegen kostprijs.' }, { entityId: zwaard }] }] }],
    }, dm);
    const alle = (await req(server, 'GET', '/api/facties', null, dm)).body.facties;
    const oud = alle.find(x => x.id === 'oudgilde');
    assert.deepStrictEqual(oud.ladder[1].unlocks.map(u => u.type).sort(),
      ['tekst', 'titel', 'voorwerp'], 'de titel telt als eigen unlock mee');
  });

  it('geeft een voorwerp als kaartje, niet als los regeltje', async () => {
    // Zet de proeffactie terug en stijg naar Gezel.
    await req(server, 'PUT', '/api/meta/facties', {
      facties: [{
        id: 'proefgilde', naam: 'Het Proefgilde', renownDrempels: [0, 1, 3],
        rangen: [
          { naam: 'Buitenstaander' },
          { naam: 'Gezel', unlocks: [
            { type: 'tekst',    naam: 'Onderdak', tekst: 'Een bed in de kelder.' },
            { type: 'voorwerp', entityId: zwaard },
            { type: 'verkoper', entityId: winkel },
          ] },
          { naam: 'Meester', unlocks: [{ type: 'metgezel', entityId: bondgenoot }] },
        ],
      }],
    }, dm);

    const r = await req(server, 'POST', '/api/facties/proefgilde/renown', { delta: 1 }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.deepStrictEqual(r.body.voorwerpen, ['Eedzwaard']);
    assert.deepStrictEqual(r.body.winkelsOpen, ['De Stille Toonbank']);
    assert.strictEqual(r.body.boons, 1, 'alleen de tekst-unlock wordt een boedelregel');

    // Het kaartje staat echt op naam, en is zichtbaar.
    const bezit = (await req(server, 'GET', `/api/items/${zwaard}/bezit`, null, dm)).body;
    const rijen = (bezit.groepen || []).flatMap(x => x.rijen || []);
    assert.ok(rijen.some(x => x.characterId === speler), 'de speler hoort het zwaard te hebben');

    // En de winkel is opengezet voor deze party.
    const markt = (await req(server, 'GET', '/api/markt', null, spelerC)).body;
    assert.ok((markt.winkels || []).some(w => w.id === winkel), 'de winkel hoort nu op de Markt te staan');
  });

  it('geeft niets aan een party die de rang niet haalde', async () => {
    const items = (await req(server, 'GET', `/api/player-items/${buitenstaander}`, null, dm)).body;
    const lijst = Array.isArray(items) ? items : (items?.items || []);
    assert.ok(!lijst.some(i => i.factieId === 'proefgilde'),
      'een speler uit een andere party hoort geen boon te krijgen: ' + JSON.stringify(lijst));
  });

  it('rekent voor wat een rang nog meer vraagt', async () => {
    await req(server, 'PUT', '/api/meta/facties', {
      facties: [{
        id: 'proefgilde', naam: 'Het Proefgilde', renownDrempels: [0, 1, 3],
        rangen: [
          { naam: 'Buitenstaander' },
          { naam: 'Gezel' },
          { naam: 'Meester', vereist: { level: 5, missies: 2 },
            unlocks: [{ type: 'metgezel', entityId: bondgenoot }] },
        ],
      }],
    }, dm);
    const f = await factieVanSpeler();
    const meester = f.ladder[2];
    assert.ok(meester.vereist, 'de eis hoort mee te komen');
    assert.strictEqual(meester.vereist.voldaan, false);
    assert.strictEqual(meester.vereist.regels.length, 2);
    // Het blokkeert niets: de rang komt gewoon op renown.
    assert.strictEqual(f.ladder[1].vereist, null, 'zonder eis staat er niets');
  });

  it('roept hulp in tot de volgende lange rust', async () => {
    // Nog geen Meester: dan valt er niets te roepen.
    const teVroeg = await req(server, 'POST', '/api/facties/proefgilde/hulp', {}, spelerC);
    assert.strictEqual(teVroeg.status, 403, JSON.stringify(teVroeg.body));

    await req(server, 'POST', '/api/facties/proefgilde/renown', { delta: 5 }, dm);
    const r = await req(server, 'POST', '/api/facties/proefgilde/hulp', {}, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.hulp.naam, 'Vrouwe Kwartel');

    // Hij loopt mee op het partytabblad.
    const comps = (await req(server, 'GET', '/api/companions', null, spelerC)).body;
    assert.ok(comps.some(c => c.id === bondgenoot), 'de hulp hoort bij de metgezellen te staan');

    // Twee keer roepen kan niet.
    const nogEens = await req(server, 'POST', '/api/facties/proefgilde/hulp', {}, spelerC);
    assert.strictEqual(nogEens.status, 409);

    // Een lange rust stuurt hem naar huis.
    await req(server, 'POST', '/api/party/long-rest', { locatie: 'veld' }, dm);
    const na = (await req(server, 'GET', '/api/companions', null, spelerC)).body;
    assert.ok(!na.some(c => c.id === bondgenoot), 'na de rust loopt hij niet meer mee');

    // En dan mag je hem weer vragen — dat is de hele bedoeling van de drempel.
    const opnieuw = await req(server, 'POST', '/api/facties/proefgilde/hulp', {}, spelerC);
    assert.strictEqual(opnieuw.status, 200, JSON.stringify(opnieuw.body));

    // Zelf bedanken kan ook.
    const weg = await req(server, 'DELETE', '/api/facties/proefgilde/hulp', null, spelerC);
    assert.strictEqual(weg.status, 200);
  });

  // Twee assen die niet samenvallen: je kunt de verkoper als persoon kennen
  // terwijl zijn winkel nog niet voor je opengaat.
  it('leidt verkopers af uit de ledenlijst, met de winkel als eigen stand', async () => {
    const bram = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Bram Kruik' }, dm)).body.id;
    const kroeg = (await req(server, 'POST', '/api/entities/locaties', {
      name: 'De Gouden Gans',
      data: { locType: 'Winkel', voorraad: JSON.stringify([{ naam: 'Kroes bier', prijs: '1 kn' }]) },
    }, dm)).body.id;
    // Bram verkoopt vanuit de kroeg: zijn voorraad hangt aan díé kaart.
    // (PUT, niet PATCH — die route bestaat niet voor entiteiten en doet stil niets.)
    await req(server, 'PUT', `/api/entities/personages/${bram}`,
      { name: 'Bram Kruik', data: { winkelLocatieId: kroeg } }, dm);

    await req(server, 'PUT', '/api/meta/facties', {
      facties: [{ id: 'proefgilde', naam: 'Het Proefgilde', renownDrempels: [0, 1],
        leden: [{ entityId: bram, rang: 'Waard' }],
        rangen: [{ naam: 'Buitenstaander' }, { naam: 'Gezel' }] }],
    }, dm);
    // Let op: /reveal is een toggle en negeert de body — hij staat hier al aan.

    // De persoon kennen is niet genoeg: de winkel staat nog dicht.
    await req(server, 'PUT', `/api/entities/personages/${bram}/visibility`, { target: 'visible' }, dm);
    let f = await factieVanSpeler();
    assert.deepStrictEqual(f.verkopers, [], 'een dichte winkel wordt niet genoemd — ook niet dát hij bestaat');

    // De DM ziet hem wel, met de reden erbij.
    const dmF = ((await req(server, 'GET', '/api/facties', null, dm)).body.facties || [])
      .find(x => x.id === 'proefgilde');
    assert.strictEqual(dmF.verkopers.length, 1, JSON.stringify({ verkopers: dmF.verkopers, leden: dmF.leden }));
    assert.strictEqual(dmF.verkopers[0]._dicht, true);

    // Winkel open: nu staat hij er, met Bram erbij omdat de party hem kent.
    await req(server, 'PUT', `/api/entities/locaties/${kroeg}/visibility`, { target: 'visible' }, dm);
    f = await factieVanSpeler();
    assert.strictEqual(f.verkopers.length, 1, JSON.stringify(f.verkopers));
    assert.strictEqual(f.verkopers[0].winkelNaam, 'De Gouden Gans');
    assert.strictEqual(f.verkopers[0].verkoperNaam, 'Bram Kruik');
    assert.strictEqual(f.verkopers[0].winkelSoort, 'locaties');

    // En andersom: winkel open, verkoper onbekend → geen naam achter de toonbank.
    await req(server, 'PUT', `/api/entities/personages/${bram}/visibility`, { target: 'hidden' }, dm);
    f = await factieVanSpeler();
    assert.strictEqual(f.verkopers[0].verkoperNaam, '', 'wie er staat is een eigen ontdekking');

    // De Markt kent dezelfde koppeling, en filtert op facties die je kent.
    const markt = (await req(server, 'GET', '/api/markt', null, spelerC)).body;
    const w = (markt.winkels || []).find(x => x.id === kroeg);
    assert.ok(w, 'de winkel hoort op de Markt te staan');
    assert.deepStrictEqual((w.facties || []).map(x => x.id), ['proefgilde']);
    assert.ok((markt.factieFilters || []).some(x => x.id === 'proefgilde'));

    // Een factie die de party niet kent levert geen chip en geen koppeling op.
    await req(server, 'POST', '/api/facties/proefgilde/reveal', { zichtbaar: false }, dm);
    const markt2 = (await req(server, 'GET', '/api/markt', null, spelerC)).body;
    assert.deepStrictEqual(markt2.factieFilters, []);
    const w2 = (markt2.winkels || []).find(x => x.id === kroeg);
    assert.deepStrictEqual(w2.facties, [], 'de factienaam is zelf een onthulling');
    await req(server, 'POST', '/api/facties/proefgilde/reveal', null, dm);   // weer aan
  });

  // De koppeling van twee kanten: in het factiepaneel stond hij al, maar je
  // bedenkt het meestal terwijl je het personage zit te schrijven.
  it('koppelt een persoon aan een factie vanaf zijn eigen kaartje', async () => {
    const zus = (await req(server, 'POST', '/api/entities/personages', { name: 'Zuster Vonk' }, dm)).body.id;
    await req(server, 'PUT', `/api/entities/personages/${zus}/visibility`, { target: 'visible' }, dm);

    const zet = (factieId, factieRang) => req(server, 'PUT',
      `/api/entities/personages/${zus}/koppelingen`, { factieId, factieRang }, dm);

    const r = await zet('proefgilde', 'Luitenant');
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    // Eén plek waar het staat: de ledenlijst van de factie.
    const f = ((await req(server, 'GET', '/api/facties', null, dm)).body.facties || [])
      .find(x => x.id === 'proefgilde');
    assert.ok((f.leden || []).some(l => l.entityId === zus && l.rang === 'Luitenant'),
      JSON.stringify(f.leden));

    // En terug te lezen op het kaartje zelf.
    const k = (await req(server, 'GET', `/api/entities/personages/${zus}/koppelingen`, null, dm)).body;
    assert.strictEqual(k.lidVan, 'proefgilde');
    assert.strictEqual(k.lidVanRang, 'Luitenant');

    // Het staat als betrekking op het kaartje, met de rang als rol.
    const kaartje = (await req(server, 'GET', `/api/entities/personages/${zus}`, null, dm)).body;
    const rij = (kaartje._hoortBij || []).find(x => x.factieId === 'proefgilde');
    assert.ok(rij, JSON.stringify(kaartje._hoortBij));
    assert.strictEqual(rij.rol, 'Luitenant');

    // Een speler ziet hem alleen als zijn party de factie kent.
    await req(server, 'POST', '/api/facties/proefgilde/reveal', null, dm);   // uit
    const alsSpeler = (await req(server, 'GET', `/api/entities/personages/${zus}`, null, spelerC)).body;
    assert.ok(!(alsSpeler._hoortBij || []).some(x => x.factieId),
      'een onbekende factie verklapt zich niet via het kaartje van een lid');
    await req(server, 'POST', '/api/facties/proefgilde/reveal', null, dm);   // weer aan

    // Losmaken haalt hem uit de ledenlijst, en de rang gaat mee.
    await zet('', '');
    const k2 = (await req(server, 'GET', `/api/entities/personages/${zus}/koppelingen`, null, dm)).body;
    assert.strictEqual(k2.lidVan, '');
    const f2 = ((await req(server, 'GET', '/api/facties', null, dm)).body.facties || [])
      .find(x => x.id === 'proefgilde');
    assert.ok(!(f2.leden || []).some(l => l.entityId === zus));
  });

  it('laat een factie die je niet kent geen hulp sturen', async () => {
    await req(server, 'POST', '/api/facties/proefgilde/reveal', { zichtbaar: false }, dm);
    const r = await req(server, 'POST', '/api/facties/proefgilde/hulp', {}, spelerC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
    await req(server, 'POST', '/api/facties/proefgilde/reveal', { zichtbaar: true }, dm);
  });
});
