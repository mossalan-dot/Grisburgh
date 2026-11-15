const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { io: ioClient } = require('socket.io-client');

// ════════════════════════════════════════════════════════════════════════════
//  BASTION — fase 1: facilities en de Bastion Turn
// ════════════════════════════════════════════════════════════════════════════
// Eén bastion per party (niet per personage, zoals de DMG). De app rekent voor
// (slots, level, prerequisite) en blokkeert niets; een speler stelt orders
// voor, de DM legt vast en rondt de turn af. Zie `docs/voorstel-bastion.md`.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-bastion-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const DATA_DIR2 = path.join(os.tmpdir(), `grisburgh-test-bastion2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const regels = require('../lib/bastion');

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

describe('Bastion: de rekenregels', () => {
  it('geeft per personage 2/4/5/6 special facilities op 5/9/13/17', () => {
    assert.deepStrictEqual([4, 5, 8, 9, 12, 13, 17, 20].map(l => regels.slotsVoorLevel(l)), [0, 2, 2, 4, 4, 5, 6, 6]);
  });
  it('telt de party bij elkaar op, en een override van de DM wint', () => {
    const inst = regels.instellingen({});
    assert.deepStrictEqual(regels.slots([5, 9, 3], inst, null), { afgeleid: 6, totaal: 6, override: false });
    assert.deepStrictEqual(regels.slots([5, 9, 3], inst, 3), { afgeleid: 6, totaal: 3, override: true });
  });
  it('een campagne die eerder begint, geeft op dat level al de eerste trede', () => {
    const inst = regels.instellingen({ bastion: { vanafLevel: 3 } });
    assert.strictEqual(regels.slots([3, 4], inst).totaal, 4);
  });
  it('rekent voor bij een nieuwe facility, maar weigert niets', () => {
    const op = regels.opmerkingenBijNieuw('gaming-hall', { levels: [5, 6], aantalSpecial: 2, slotsTotaal: 2, bestaand: [] });
    assert.strictEqual(op.length, 2);
    assert.match(op[0], /level 9/);
    assert.match(op[1], /3/);
    assert.match(regels.opmerkingenBijNieuw('arcane-study', { levels: [5], slotsTotaal: 4 }).join(' '), /Prerequisite/);
  });
  it('Maintain kan altijd, een basic facility kent geen orders', () => {
    assert.deepStrictEqual(regels.ordersVan({ special: true, key: 'smithy' }), ['craft', 'maintain']);
    assert.deepStrictEqual(regels.ordersVan({ special: false, key: 'bedroom' }), []);
  });
  it('elk icoon in de catalogus bestaat in de sprite', () => {
    const sprite = fs.readFileSync(path.join(__dirname, '..', 'public', 'img', 'icons.svg'), 'utf8');
    const cat = regels.catalogus();
    for (const f of [...cat.special, ...cat.basic]) assert.ok(sprite.includes(`id="icon-${f.icoon}"`), `${f.key}: ${f.icoon}`);
    for (const f of cat.special) for (const o of f.orders) assert.ok(cat.orders.includes(o), `${f.key}: ${o}`);
  });
});

describe('Bastion: de routes', () => {
  let server, io, port, dm, speler, tweede, pw;
  const id = {};
  const b = (cookie, method, p, body) => req(server, method, '/api' + p, body, cookie);

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    port = server.address().port;
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    const maak = async (sleutel, naam, level) => {
      id[sleutel] = (await req(server, 'POST', '/api/entities/personages',
        { name: naam, subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
      await req(server, 'PATCH', `/api/player-profile/${id[sleutel]}`, { klasse: 'Fighter', level }, dm);
    };
    await maak('a', 'Hendrik Staal', 5);
    await maak('b', 'Lyra Snaarzang', 9);
    const groups = (await req(server, 'GET', '/api/groups', null, dm)).body.groups || [];
    pw = groups.find(g => g.id === 'groep1')?.password;
    speler = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: id.a, password: pw })).cookie;
    tweede = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: id.b, password: pw })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('staat uit tot de module aangaat, en dan weigert de route ook', async () => {
    assert.strictEqual((await b(dm, 'GET', '/bastion')).status, 409);
    assert.strictEqual((await b(speler, 'GET', '/bastion')).status, 409);
    const aan = await b(dm, 'PUT', '/campaigns/grisburgh/modules', { modules: { bastion: true } });
    assert.strictEqual(aan.status, 200, JSON.stringify(aan.body));
    assert.strictEqual(aan.body.modules.bastion, true);
  });

  it('stichten kan alleen de DM, met twee basic facilities en de slots van de party', async () => {
    assert.strictEqual((await b(speler, 'POST', '/bastion', { naam: 'Van mij' })).status, 403);
    const leeg = await b(speler, 'GET', '/bastion');
    assert.strictEqual(leeg.status, 200);
    assert.strictEqual(leeg.body.bastion, null);
    const r = await b(dm, 'POST', '/bastion', { naam: 'De Gebroken Toren' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.bastion.naam, 'De Gebroken Toren');
    assert.deepStrictEqual(r.body.bastion.facilities.map(f => f.grootte), ['cramped', 'roomy']);
    assert.strictEqual(r.body.bastion.slots.totaal, 6, 'level 5 geeft 2, level 9 geeft 4');
    assert.strictEqual((await b(dm, 'POST', '/bastion', { naam: 'Nog een' })).status, 409);
  });

  it('een special facility boven het level wordt voorgerekend, niet geweigerd', async () => {
    const r = await b(dm, 'POST', '/bastion/facilities', { soort: 'special', key: 'meditation-chamber' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.opmerkingen.join(' '), /level 13/);
    const smid = await b(dm, 'POST', '/bastion/facilities', { soort: 'special', key: 'smithy', naam: 'De Vuuresse' });
    assert.strictEqual(smid.body.opmerkingen.length, 0);
    const f = smid.body.bastion.facilities.find(x => x.key === 'smithy');
    assert.strictEqual(f.naam, 'De Vuuresse');
    assert.strictEqual(f.grootte, 'roomy', 'een special facility heeft de grootte uit de catalogus');
    assert.deepStrictEqual(f.orders, ['craft', 'maintain']);
    assert.strictEqual((await b(dm, 'POST', '/bastion/facilities', { soort: 'special', key: 'kasteel' })).status, 400);
    assert.strictEqual((await b(speler, 'POST', '/bastion/facilities', { soort: 'special', key: 'library' })).status, 403);
  });

  it('een speler stelt een order voor, en kan een vastgelegde order niet overschrijven', async () => {
    const stand = (await b(dm, 'GET', '/bastion')).body.bastion;
    const smid = stand.facilities.find(x => x.key === 'smithy');
    const kamer = stand.facilities.find(x => x.key === 'bedroom');
    assert.strictEqual((await b(speler, 'PUT', `/bastion/orders/${kamer.id}`, { order: 'craft' })).status, 400, 'een basic facility kent geen orders');
    assert.strictEqual((await b(speler, 'PUT', `/bastion/orders/${smid.id}`, { order: 'trade' })).status, 400, 'een Smithy handelt niet');
    const v = await b(speler, 'PUT', `/bastion/orders/${smid.id}`, { order: 'craft', notitie: 'Een longsword' });
    assert.strictEqual(v.status, 200, JSON.stringify(v.body));
    const o = v.body.bastion.facilities.find(x => x.id === smid.id).order;
    assert.strictEqual(o.vast, false);
    assert.strictEqual(o.doorNaam, 'Hendrik Staal');
    // Een tweede speler mag een voorstel vervangen…
    assert.strictEqual((await b(tweede, 'PUT', `/bastion/orders/${smid.id}`, { order: 'maintain' })).status, 200);
    // …maar niet wat de DM vastlegde.
    assert.strictEqual((await b(dm, 'PUT', `/bastion/orders/${smid.id}`, { order: 'craft', notitie: 'Twee daggers' })).status, 200);
    const geweigerd = await b(speler, 'PUT', `/bastion/orders/${smid.id}`, { order: 'maintain' });
    assert.strictEqual(geweigerd.status, 409);
  });

  it('mag de speler zelf vastleggen als de DM dat aanzet', async () => {
    await b(dm, 'PUT', '/meta/bastion', { spelersVastleggen: true });
    const stand = (await b(dm, 'GET', '/bastion')).body.bastion;
    const smid = stand.facilities.find(x => x.key === 'smithy');
    const r = await b(speler, 'PUT', `/bastion/orders/${smid.id}`, { order: 'craft', notitie: 'Twee daggers' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.bastion.facilities.find(x => x.id === smid.id).order.vast, true);
    await b(dm, 'PUT', '/meta/bastion', { spelersVastleggen: false });
    const meta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'grisburgh', 'meta.json'), 'utf8'));
    assert.strictEqual(meta.bastion, undefined, 'de standaard wordt niet weggeschreven');
  });

  it('na zeven lange rusten hoort de DM dat er een turn klaarstaat', async () => {
    const s = ioClient(`http://localhost:${port}`, { transports: ['polling'], forceNew: true, extraHeaders: { Cookie: dm } });
    await new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); });
    let melding = null;
    s.on('bastion:turn', d => { melding = d; });
    for (let i = 0; i < 7; i++) await b(dm, 'POST', '/party/long-rest', {});
    await new Promise(r => setTimeout(r, 150));
    s.close();
    assert.ok(melding, 'de DM krijgt een seintje');
    assert.strictEqual(melding.nachten, 7);
    const stand = (await b(speler, 'GET', '/bastion')).body.bastion;
    assert.strictEqual(stand.turn.klaar, true);
  });

  it('de turn afronden zet de orders in het logboek en begint de telling opnieuw', async () => {
    const stand = (await b(dm, 'GET', '/bastion')).body.bastion;
    const smid = stand.facilities.find(x => x.key === 'smithy');
    assert.strictEqual((await b(speler, 'POST', '/bastion/turn', {})).status, 403);
    const r = await b(dm, 'POST', '/bastion/turn', { resultaten: { [smid.id]: 'Twee daggers liggen klaar.' } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.bastion.turnNummer, 1);
    assert.strictEqual(r.body.bastion.turn.nachten, 0);
    assert.strictEqual(r.body.bastion.turn.klaar, false);
    const regel = r.body.bastion.log[0].regels[0];
    assert.strictEqual(regel.orderNaam, 'Craft');
    assert.strictEqual(regel.resultaat, 'Twee daggers liggen klaar.');
    assert.strictEqual(regel.door, 'Hendrik Staal');
    assert.strictEqual(r.body.bastion.facilities.find(x => x.id === smid.id).order, null);
    const speelt = (await b(speler, 'GET', '/bastion')).body.bastion;
    assert.strictEqual(speelt.log.length, 1, 'de spelers lezen het logboek mee');
  });

  it('een facility weghalen haalt zijn order mee; opheffen vraagt bevestiging', async () => {
    const stand = (await b(dm, 'GET', '/bastion')).body.bastion;
    const kamer = stand.facilities.find(x => x.key === 'meditation-chamber');
    await b(dm, 'PUT', `/bastion/orders/${kamer.id}`, { order: 'empower' });
    const weg = await b(dm, 'DELETE', `/bastion/facilities/${kamer.id}`);
    assert.strictEqual(weg.status, 200);
    const bestand = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'grisburgh', 'bastion.json'), 'utf8'));
    assert.strictEqual(bestand.groep1.orders[kamer.id], undefined);
    assert.strictEqual((await b(dm, 'DELETE', '/bastion')).status, 400);
    assert.strictEqual((await b(speler, 'DELETE', '/bastion?zeker=1')).status, 403);
    const op = await b(dm, 'DELETE', '/bastion?zeker=1');
    assert.strictEqual(op.status, 200);
    assert.strictEqual(op.body.bastion, null);
  });
});

// ── Fase 2: voorvallen en verdediging ──────────────────────────────────────
// De Bastion Events van de Dungeon Master's Guide leveren we niet mee: die
// tekst staat niet onder CC BY. De DM wijst een tafel van zijn eigen campagne
// aan, zoals bij de rust. En wat een aanvalsworp betekent staat ook in dat
// boek — de app gooit de stenen en bewaart wat de DM erover opschreef.
describe('Bastion: voorvallen en verdediging', () => {
  let server, io, dm, groep;
  const b = (cookie, method, p, body) => req(server, method, '/api' + p, body, cookie);

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR2;
    if (fs.existsSync(DATA_DIR2)) fs.rmSync(DATA_DIR2, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    await b(dm, 'PUT', '/campaigns/grisburgh/modules', { modules: { bastion: true } });
    const pc = (await b(dm, 'POST', '/entities/personages',
      { name: 'Wacht', subtype: 'speler', data: { groep: 'groep1' } })).body.id;
    await b(dm, 'PATCH', `/player-profile/${pc}`, { klasse: 'Fighter', level: 9 });
    await b(dm, 'POST', '/bastion', { naam: 'De Wachttoren' });
    groep = 'groep1';
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR2, { recursive: true, force: true });
  });

  it('houdt de verdedigers bij en zet de muren aan', async () => {
    const r = await b(dm, 'PUT', '/bastion', { defenders: 7, muren: true });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.bastion.defenders, 7);
    assert.strictEqual(r.body.bastion.muren, true);
    assert.strictEqual(r.body.bastion.aanvalStenen, 4, 'met muren rolt hij er vier');
    const uit = await b(dm, 'PUT', '/bastion', { muren: false });
    assert.strictEqual(uit.body.bastion.aanvalStenen, 6, 'en zonder muren zes');
    assert.strictEqual((await b(dm, 'PUT', '/bastion', { defenders: -3 })).body.bastion.defenders, 0,
      'nooit onder nul');
  });

  it('wijst de facilities aan die verdedigers geven, zonder een aantal te verzinnen', async () => {
    await b(dm, 'POST', '/bastion/facilities', { soort: 'special', key: 'barrack' });
    const r = await b(dm, 'GET', '/bastion');
    const bronnen = r.body.bastion.defenderBronnen;
    assert.ok(bronnen.some(x => /barrack/i.test(x.naam)), 'de Barrack staat erbij');
    assert.ok(!('aantal' in (bronnen[0] || {})), 'maar er staat geen getal bij');
  });

  it('rolt een aanval en bewaart de stenen; de uitslag schrijf je erbij', async () => {
    const r = await b(dm, 'POST', '/bastion/aanval', {});
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.stenen.length, 6);
    assert.ok(r.body.stenen.every(n => n >= 1 && n <= 6), 'zes stenen, elk 1 tot 6');
    const log = r.body.bastion.log[0];
    assert.strictEqual(log.soort, 'aanval');
    assert.strictEqual(log.uitslag, '');
    const na = await b(dm, 'PUT', '/bastion/aanval', { uitslag: 'Twee verdedigers gevallen.' });
    assert.strictEqual(na.body.bastion.log[0].uitslag, 'Twee verdedigers gevallen.');
  });

  it('rolt geen voorval zonder tafel, en wél zodra de DM er een aanwijst', async () => {
    const zonder = await b(dm, 'POST', '/bastion/turn', {});
    assert.ok(!zonder.body.voorval, 'geen tafel, geen voorval');

    const tafel = await b(dm, 'POST', '/tables', {
      name: 'Voorvallen op de toren',
      entries: ['Er klopt iemand aan', 'De put is droog', 'Een duif met een briefje'],
    });
    assert.strictEqual(tafel.status, 201, JSON.stringify(tafel.body));
    await b(dm, 'PUT', '/meta/bastion', { eventTableId: tafel.body.id });

    // Een facility zonder order telt als onbewaakt — dát is het moment waarop
    // er een voorval rolt.
    const met = await b(dm, 'POST', '/bastion/turn', {});
    assert.ok(met.body.voorval, 'nu wel een voorval');
    assert.ok(met.body.voorval.tekst, 'met tekst uit de tafel van de DM');
    assert.strictEqual(met.body.bastion.log[0].voorval.tekst, met.body.voorval.tekst,
      'en het staat in het logboek van die turn');
  });

  // ── Fase 3 ──
  // Hoevéél een Trade of een Craft opbrengt staat in de Dungeon Master's Guide
  // en dat leveren we niet mee: de DM vult het in. Wat de app wél doet is het
  // rekenwerk — geld langs `_deductCurrency` (dus de gedeelde beurs wint als
  // die aanstaat) en een voorwerp dat echt in de boedel belandt.
  it('een turn kan geld, een voorwerp en verdedigers opleveren', async () => {
    const pc = (await b(dm, 'GET', '/bastion')).body.leden[0];
    const item = (await b(dm, 'POST', '/entities/voorwerpen',
      { name: 'Gesmeed zwaard', data: { itemType: 'Weapon' } })).body;
    const stand = (await b(dm, 'GET', '/bastion')).body.bastion;
    const fac = stand.facilities.find(f => f.special);
    // Welke order een facility kent verschilt per facility; pak er een die hij
    // aanbiedt, anders weigert de route hem en blijft de turn leeg.
    await b(dm, 'PUT', `/bastion/orders/${fac.id}`, { order: fac.orders[0] });
    const voor = (await b(dm, 'GET', `/player-currency/${pc.id}`)).body;
    const defVoor = stand.defenders;

    const r = await b(dm, 'POST', '/bastion/turn', {
      resultaten: { [fac.id]: 'Een zwaard uit de smidse.' },
      opbrengst: { [fac.id]: { bedrag: '12 fl', itemId: item.id, itemNaam: item.name, defenders: 2, naar: pc.id } },
    });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const regel = r.body.bastion.log[0].regels[0];
    assert.strictEqual(regel.bedragCl, 1200, 'twaalf florinde is twaalfhonderd centeling');
    assert.strictEqual(regel.itemNaam, 'Gesmeed zwaard');
    assert.strictEqual(regel.defenders, 2);

    const na = (await b(dm, 'GET', `/player-currency/${pc.id}`)).body;
    assert.strictEqual((na.fl || 0) - (voor.fl || 0), 12, 'het geld is bijgeschreven, niet afgeschreven');
    assert.strictEqual(r.body.bastion.defenders, defVoor + 2, 'en de verdedigers erbij');

    const bezit = (await b(dm, 'GET', `/items/${item.id}/bezit`)).body;
    const alle = JSON.stringify(bezit);
    assert.ok(alle.includes(pc.id), 'het voorwerp staat op zijn naam');
  });

  it('een negatief bedrag schrijft juist af — Recruit kost geld', async () => {
    const pc = (await b(dm, 'GET', '/bastion')).body.leden[0];
    const fac = (await b(dm, 'GET', '/bastion')).body.bastion.facilities.find(f => f.special);
    await b(dm, 'PUT', `/bastion/orders/${fac.id}`, { order: fac.orders[0] });
    const voor = (await b(dm, 'GET', `/player-currency/${pc.id}`)).body;
    await b(dm, 'POST', '/bastion/turn', { opbrengst: { [fac.id]: { bedrag: '-5 fl', naar: pc.id } } });
    const na = (await b(dm, 'GET', `/player-currency/${pc.id}`)).body;
    assert.strictEqual((voor.fl || 0) - (na.fl || 0), 5, 'vijf florinde eraf');
  });
});
