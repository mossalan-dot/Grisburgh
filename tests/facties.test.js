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
  it('levert geen facties uit een andere campagne mee', async () => {
    // Hier stonden De Coöperatie, De Eendragt en De Roodzwaarden, met
    // beschrijvingen die letterlijk "rond Grisburgh" zeggen. Elke campagne
    // zonder eigen facties kreeg die drie.
    const bron = fs.readFileSync(path.join(__dirname, '..', 'routes', 'api.js'), 'utf8');
    const m = bron.match(/const FACTIES_DEFAULT = (\[[^\]]*\])/);
    assert.ok(m, 'de constante hoort er nog te zijn');
    assert.strictEqual(m[1].replace(/\s/g, ''), '[]', 'en leeg te zijn');

    // De ladder is wél generiek en hoort in de Meesterkamer te staan: een
    // nieuwe factie begint met zes treden, niet met nul.
    const paneel = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'dm-panel.js'), 'utf8');
    assert.ok(/_FACTIE_LADDER/.test(paneel), 'een nieuwe factie krijgt de zes treden mee');
  });


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

  // De drempel hoort bij de rang, niet in een lijstje ernaast dat op index moet
  // matchen. De DM mag ze in elke volgorde intikken; de ladder sorteert zichzelf.
  it('leest de renown-drempel van de rang zelf en zet ze op volgorde', async () => {
    // `PUT /meta/facties` vervangt de hele lijst, dus de bestaande erbij houden.
    const bestaand = (await req(server, 'GET', '/api/meta', null, dm)).body.facties || [];
    await req(server, 'PUT', '/api/meta/facties', {
      facties: [...bestaand, {
        id: 'laddertest', naam: 'De Ladder',
        rangen: [
          { naam: 'Meester',        renown: 20 },
          { naam: 'Buitenstaander', renown: 0  },
          { naam: 'Gezel',          renown: 4  },
        ],
      }],
    }, dm);
    await req(server, 'POST', '/api/facties/laddertest/reveal', { zichtbaar: true }, dm);

    const f = () => req(server, 'GET', '/api/facties', null, dm)
      .then(r => (r.body.facties || []).find(x => x.id === 'laddertest'));

    const na = await f();
    assert.deepStrictEqual((na.ladder || []).map(r => r.naam),
      ['Buitenstaander', 'Gezel', 'Meester'], 'op volgorde van renown');
    assert.deepStrictEqual((na.ladder || []).map(r => r.drempel), [0, 4, 20]);
    assert.strictEqual(na.rang.naam, 'Buitenstaander', 'zonder renown sta je onderaan');
    assert.strictEqual(na.drempelVolgende, 4);

    await req(server, 'POST', '/api/facties/laddertest/renown', { delta: 5 }, dm);
    assert.strictEqual((await f()).rang.naam, 'Gezel', 'vijf renown haalt de trede van vier');
  });

  // Renown alleen is niet altijd genoeg: het boek laat een gilde vanaf de derde
  // trede ook karakterlevel en voltooide missies vragen. Voorrekenen en niet
  // blokkeren — en het mag niet verdwijnen als de DM op Opslaan drukt.
  it('rekent level en missies voor bij een rang, zonder te blokkeren', async () => {
    const bestaand = (await req(server, 'GET', '/api/meta', null, dm)).body.facties || [];
    await req(server, 'PUT', '/api/meta/facties', {
      facties: [...bestaand.filter(f => f.id !== 'eisentest'), {
        id: 'eisentest', naam: 'De Eisers',
        rangen: [
          { naam: 'Buitenstaander', renown: 0 },
          { naam: 'Meester', renown: 1, vereist: { level: 9, missies: 2 } },
        ],
      }],
    }, dm);
    await req(server, 'POST', '/api/facties/eisentest/reveal', { zichtbaar: true }, dm);
    await req(server, 'POST', '/api/facties/eisentest/renown', { delta: 1 }, dm);

    const f = ((await req(server, 'GET', '/api/facties', null, dm)).body.facties || [])
      .find(x => x.id === 'eisentest');
    const trede = (f.ladder || [])[1];
    assert.ok(trede.vereist, 'de eis staat op de trede');
    assert.strictEqual(trede.vereist.voldaan, false, 'level 9 halen we niet');
    assert.deepStrictEqual(trede.vereist.regels.map(r => r.ok), [false, false]);

    // Voorrekenen, niet blokkeren: de rang is wél bereikt op renown.
    assert.strictEqual(f.rang.naam, 'Meester', 'renown bepaalt de rang; de eis is een mededeling');

    // En de eis overleeft een ronde door het paneel (dezelfde vorm terugsturen).
    const nu = (await req(server, 'GET', '/api/meta', null, dm)).body.facties || [];
    await req(server, 'PUT', '/api/meta/facties', { facties: nu }, dm);
    const opnieuw = ((await req(server, 'GET', '/api/facties', null, dm)).body.facties || [])
      .find(x => x.id === 'eisentest');
    assert.ok((opnieuw.ladder || [])[1].vereist, 'opslaan wist de eis niet');
  });

  // De vijf soorten gunst die een rang kan geven. De editor kon er maar één
  // maken; de server deed er al vijf. Dit legt vast wat ze elk doen.
  it('kent vijf soorten gunst en deelt ze uit bij het halen van de rang', async () => {
    const bestaand = (await req(server, 'GET', '/api/meta', null, dm)).body.facties || [];
    await req(server, 'PUT', '/api/meta/facties', {
      facties: [...bestaand.filter(f => f.id !== 'vijfsoorten'), {
        id: 'vijfsoorten', naam: 'De Vijfvoud',
        rangen: [
          { naam: 'Buitenstaander', renown: 0 },
          { naam: 'Gezel', renown: 2, unlocks: [
            { type: 'tekst',    naam: 'Onderdak', tekst: 'Een bed in de kelder.' },
            { type: 'voorwerp', entityId: zwaard, aantal: 2 },
            { type: 'verkoper', entityId: winkel },
            { type: 'metgezel', entityId: bondgenoot, duur: 'langeRust', cooldown: 'akte' },
            { type: 'titel',    titel: 'Gezel van de Vijfvoud' },
          ] },
        ],
      }],
    }, dm);
    await req(server, 'POST', '/api/facties/vijfsoorten/reveal', { zichtbaar: true }, dm);

    // De winkel is nog dicht en het zwaard nog niet van hen.
    await req(server, 'PUT', `/api/entities/locaties/${winkel}/visibility`, { target: 'hidden' }, dm);

    const r = await req(server, 'POST', '/api/facties/vijfsoorten/renown', { delta: 2 }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    // verkoper → de winkel gaat open voor deze party
    const loc = (await req(server, 'GET', `/api/entities/locaties/${winkel}`, null, dm)).body;
    assert.strictEqual(loc._visibility, 'visible', 'de winkel is opengezet');

    // voorwerp → het kaartje is echt in bezit, met het aantal erbij
    const bezit = (await req(server, 'GET', '/api/items/ownership', null, dm)).body;
    const eigenaar = (bezit.owners || {})[zwaard];
    assert.ok(eigenaar, 'het zwaard is uitgedeeld: ' + JSON.stringify(bezit.owners));

    // Meerdere dingen aan één rang: het antwoord noemt ze alle drie apart, zodat
    // de melding kan zeggen wát er gebeurd is in plaats van alleen hoeveel.
    assert.deepStrictEqual(r.body.winkelsOpen?.length, 1, JSON.stringify(r.body));
    assert.deepStrictEqual(r.body.voorwerpen?.length, 1, JSON.stringify(r.body));
    assert.strictEqual(r.body.boons, 1, 'de afspraak telt apart');

    // titel en metgezel worden níét uitgedeeld: de titel staat op de ladder,
    // de metgezel roep je in (POST /hulp).
    const f = ((await req(server, 'GET', '/api/facties', null, dm)).body.facties || [])
      .find(x => x.id === 'vijfsoorten');
    assert.deepStrictEqual((f.ladder[1].unlocks || []).map(u => u.type),
      ['tekst', 'voorwerp', 'verkoper', 'metgezel', 'titel']);
    assert.ok(f.hulp?.beschikbaar, 'de metgezel is in te roepen in plaats van uitgedeeld');
  });

  // Een voorwerp dat een rang ontgrendelt hoort dat op zijn eigen kaartje te
  // zeggen. Dat was eenrichtingsverkeer: je koppelde het in het factiepaneel en
  // op het kaartje van het zwaard stond nergens waar het vandaan komt.
  it('toont op het voorwerp dat het de gunst van een rang is', async () => {
    const bestaand = (await req(server, 'GET', '/api/meta', null, dm)).body.facties || [];
    await req(server, 'PUT', '/api/meta/facties', {
      facties: [...bestaand.filter(f => f.id !== 'gunsttest'), {
        id: 'gunsttest', naam: 'De Gunstgevers',
        rangen: [
          { naam: 'Buitenstaander', renown: 0 },
          { naam: 'Gezel', renown: 3, unlocks: [{ type: 'voorwerp', entityId: zwaard }] },
        ],
      }],
    }, dm);
    await req(server, 'POST', '/api/facties/gunsttest/reveal', { zichtbaar: true }, dm);

    const kaartje = (cookie) => req(server, 'GET', `/api/entities/voorwerpen/${zwaard}`, null, cookie)
      .then(r => (r.body._hoortBij || []).find(x => x.gunst && x.factieId === 'gunsttest'));

    const rij = await kaartje(dm);
    assert.ok(rij, 'er staat een gunst-regel op het kaartje');
    assert.strictEqual(rij.name, 'De Gunstgevers');
    assert.match(rij.rol, /^Gunst/);
    assert.match(rij.rol, /Gezel/);

    // Een factie die de party niet kent verklapt zich niet via haar gunst.
    await req(server, 'POST', '/api/facties/gunsttest/reveal', null, dm);   // uit
    assert.ok(!(await kaartje(spelerC)), 'een onbekende factie verklapt zich niet via haar gunst');
  });

  // De koppeling van twee kanten: in het factiepaneel stond hij al, maar je
  // bedenkt het meestal terwijl je het personage zit te schrijven. Wat je legt
  // belandt in het **organogram** van het organisatiekaartje — de enige plek
  // waar staat wie erbij hoort.
  it('koppelt een persoon aan een factie vanaf zijn eigen kaartje', async () => {
    const gildehuis = (await req(server, 'POST', '/api/entities/organisaties',
      { name: 'Het Proefgilde' }, dm)).body.id;
    await req(server, 'PUT', `/api/entities/organisaties/${gildehuis}/koppelingen`,
      { factieId: 'proefgilde' }, dm);

    const zus = (await req(server, 'POST', '/api/entities/personages', { name: 'Zuster Vonk' }, dm)).body.id;
    await req(server, 'PUT', `/api/entities/personages/${zus}/visibility`, { target: 'visible' }, dm);

    const zet = (factieId, factieRang) => req(server, 'PUT',
      `/api/entities/personages/${zus}/koppelingen`, { factieId, factieRang }, dm);

    const r = await zet('proefgilde', 'Luitenant');
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    // Het staat op het organisatiekaartje, niet in een tweede lijst.
    const org = (await req(server, 'GET', `/api/entities/organisaties/${gildehuis}`, null, dm)).body;
    const betr = JSON.parse(org.data?.betrokkenen || '[]');
    assert.ok(betr.some(b => b.id === zus && b.rol === 'Luitenant'), JSON.stringify(betr));

    // En de factie leest dezelfde lijst.
    const f = ((await req(server, 'GET', '/api/facties', null, dm)).body.facties || [])
      .find(x => x.id === 'proefgilde');
    assert.ok((f.leden || []).some(l => l.entityId === zus && l.rol === 'Luitenant'),
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
