// **Wat er per party op een kaartje staat.**
//
// Een kaartje is van de hele campagne, maar een hoop ervan is per party: wie
// het kent, welke geheimen open staan, en — minder voor de hand liggend — in
// **welke gedaante** de party hem kent. Dat laatste is `groups[gid].tierStand`,
// en het stond ongetoetst terwijl juist daar al eens iets misging: een eerste
// versie zette de tier van de eigen party terug ín `stats` ná de delete, en
// lekte daarmee het hele statblok (zie `tests/filter.test.js`).
//
// Hier staan de drie regels die in `docs/testronde.md` beloofd worden en die
// nog nergens vastlagen: de gedaante per party, de kant die geen rol mag
// worden, en wie een dier bezit — per party, want hetzelfde dierkaartje kan in
// twee party's meelopen met een andere baas.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-kpp-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Wat er per party op een kaartje staat', () => {
  let server, io, dm, gidA, gidB, waard;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const maak = async (naam, ww) => {
      await req(server, 'POST', '/api/groups', { name: naam, password: ww }, dm);
      return (await req(server, 'GET', '/api/groups', null, dm)).body.groups.find(g => g.name === naam).id;
    };
    gidA = await maak('Tafel A', 'tafel-a');
    gidB = await maak('Tafel B', 'tafel-b');

    // Eén NPC met twee gedaantes. `stats` is de basis; een tier zegt alleen
    // wát er anders is, en ligt daar bovenop.
    waard = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Harmen Jonker',
      stats: { ac: '12', hp: '22' },
      // **Let op waar dit staat.** `statblockTiers` is een veld van de
      // entiteit zelf, niet van `data` — `_tierRegels()` leest
      // `entity.statblockTiers`. In `data` gezet ziet de server er geen enkele
      // tier en geeft hij 400 op elke keuze. Dat was de eerste versie van deze
      // toets, en het is precies het soort misverstand waarvoor hij bestaat.
      statblockTiers: [
        { id: 't1', label: 'De waard',      stats: { ac: '12' } },
        { id: 't2', label: 'De moordenaar', stats: { ac: '17', hp: '90' } },
      ],
    }, dm)).body.id;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const kaartje = async (gid) => {
    await req(server, 'PUT', '/api/groups/active', { groupId: gid }, dm);
    return (await req(server, 'GET', `/api/entities/personages/${waard}`, null, dm)).body;
  };

  it('houdt de gedaante bij de party die hem zo kent', async () => {
    const r = await req(server, 'PUT', `/api/entities/personages/${waard}/tier`,
      { gid: gidA, tierId: 't2' }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.tierId, 't2');

    assert.strictEqual((await kaartje(gidA))._tierActief, 't2', 'tafel A kent de moordenaar');
    assert.strictEqual((await kaartje(gidB))._tierActief, null,
      'tafel B heeft hem alleen als waard ontmoet — die staat nog op Basis');
  });

  it('zet hem terug op basis, en alleen bij die party', async () => {
    await req(server, 'PUT', `/api/entities/personages/${waard}/tier`,
      { gid: gidB, tierId: 't1' }, dm);
    assert.strictEqual((await kaartje(gidB))._tierActief, 't1');
    assert.strictEqual((await kaartje(gidA))._tierActief, 't2', 'tafel A blijft waar hij stond');

    await req(server, 'PUT', `/api/entities/personages/${waard}/tier`,
      { gid: gidB, tierId: 'basis' }, dm);
    assert.strictEqual((await kaartje(gidB))._tierActief, null);
    assert.strictEqual((await kaartje(gidA))._tierActief, 't2');
  });

  it('kent geen gedaante die niet bestaat', async () => {
    const r = await req(server, 'PUT', `/api/entities/personages/${waard}/tier`,
      { gid: gidA, tierId: 'verzonnen' }, dm);
    assert.strictEqual(r.status, 400, 'een onbekende tier hoort geweigerd te worden');
    assert.strictEqual((await kaartje(gidA))._tierActief, 't2', 'en de stand blijft staan');
  });

  it('stuurt de gedaantes nooit naar een speler', async () => {
    // De reden dat dit hier óók staat: de stand en het lek horen bij elkaar.
    // Welke gedaantes er bestaan verklapt wie hij nog kan blijken te zijn.
    const held = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Anne', subtype: 'speler', data: { groep: gidA } }, dm)).body.id;
    await req(server, 'PUT', '/api/groups/active', { groupId: gidA }, dm);
    await req(server, 'PUT', `/api/entities/personages/${waard}/visibility`, { target: 'visible' }, dm);
    const sessie = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: held, password: 'tafel-a' })).cookie;

    const e = (await req(server, 'GET', `/api/entities/personages/${waard}`, null, sessie)).body;
    assert.strictEqual(e.statblockTiers, undefined, 'de gedaantes gaan er helemaal af');
    assert.strictEqual(e.stats, undefined, 'en het statblok ook');
    assert.ok(!JSON.stringify(e).includes('moordenaar'),
      'nergens in het antwoord mag staan wie hij nog kan blijken te zijn');
  });

  it('bewaart de gedaantes ook als het kaartje in één keer wordt aangemaakt', async () => {
    // **De asymmetrie die dit opleverde.** `PUT /entities/:type/:id` doet
    // `{ ...bestaand, ...body }` en neemt dus álles over; `POST
    // /entities/:type` bouwt het kaartje uit een vaste lijst van zeven velden
    // en liet `statblockTiers` vallen — zonder foutmelding. In de app viel dat
    // niet op (de editor maakt eerst een leeg kaartje en bewaart daarna), maar
    // een script of een import die een kaartje mét gedaantes aanmaakt raakte
    // ze stil kwijt. Vandaar een toets op het aanmaken zelf.
    const id = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Vrouwe Kwartel',
      statblockTiers: [{ label: 'De gesluierde' }, { label: 'De vorstin' }],
    }, dm)).body.id;

    const e = (await req(server, 'GET', `/api/entities/personages/${id}`, null, dm)).body;
    assert.strictEqual((e.statblockTiers || []).length, 2, 'allebei de gedaantes horen er te staan');
    // En elk met een eigen, blijvend id — anders schuift de stand van een party
    // mee met de volgorde zodra de DM er een tussenuit haalt.
    const ids = (e.statblockTiers || []).map(t => t.id);
    assert.ok(ids.every(Boolean), 'elke gedaante krijgt een id: ' + JSON.stringify(ids));
    assert.strictEqual(new Set(ids).size, 2, 'en ze zijn uniek');

    // Het bewijs dat het geen dood veld is: je kunt er meteen een kiezen.
    const r = await req(server, 'PUT', `/api/entities/personages/${id}/tier`,
      { gid: gidA, tierId: ids[1] }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  });

  it('maakt geen leeg gedaante-veld op een gewoon kaartje', async () => {
    // Een leeg `statblockTiers` op elk kaartje zou suggereren dat er gedaantes
    // zijn, en de editor zet er dan een lege strook voor neer.
    const id = (await req(server, 'POST', '/api/entities/personages', { name: 'Gewone Griet' }, dm)).body.id;
    const e = (await req(server, 'GET', `/api/entities/personages/${id}`, null, dm)).body;
    assert.strictEqual(e.statblockTiers, undefined);
  });

  it('laat een kant een kant blijven, en geen rol worden', async () => {
    // `subtype` zegt wát voor kaartje het is, `data.tags` welke **rol** hij
    // speelt (verkoper, antagonist) en `data.kant` aan welke kant hij in een
    // gevecht staat. Die drie zaten ooit in één veld; sindsdien is de regel dat
    // een kant nooit als rol mag terugkomen — anders staat er een "Vijand"-
    // badge naast "Verkoper" alsof het hetzelfde soort ding is.
    const id = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Brute Bram',
      data: { tags: JSON.stringify(['verkoper']), kant: 'vijand' },
    }, dm)).body.id;
    const e = (await req(server, 'GET', `/api/entities/personages/${id}`, null, dm)).body;
    const tags = JSON.parse(e.data.tags || '[]');
    assert.deepStrictEqual(tags, ['verkoper'], 'alleen de rol staat in tags');
    assert.strictEqual(e.data.kant, 'vijand', 'en de kant staat op zijn eigen veld');
    for (const woord of ['vijand', 'Vijand', 'bondgenoot', 'neutraal']) {
      assert.ok(!tags.includes(woord), `"${woord}" hoort geen rol te zijn`);
    }
  });
});
