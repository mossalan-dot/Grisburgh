const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Loot-events: de bibliotheek van vondsten die een lootfase vult. De DC is een
// aantekening (geen mechaniek), meerdere vondsten mogen samen één verdeling
// worden, en toeval wordt pas bij het onthullen gerold.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-loot-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url  = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: {} };
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

describe('Loot-events', () => {
  let server, io, dm, speler;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { password: 'grisburgh-dm' })).cookie;
    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Vinder', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    // Twee voorwerpkaartjes om willekeurig uit te kunnen kiezen.
    for (const naam of ['Roestige dolk', 'Gedeukte helm']) {
      await req(server, 'POST', '/api/entities/voorwerpen', { name: naam, data: { rariteit: 'Common' } }, dm);
    }
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const maak = (body) => req(server, 'POST', '/api/loot/events', body, dm);

  it('maakt een vondst met een DC als aantekening', async () => {
    const r = await maak({ naam: 'Geldzak in de haard', dc: 12, vaardigheid: 'Investigation', goud: { fl: 8 } });
    assert.equal(r.status, 201);
    assert.equal(r.body.dc, 12);
    assert.equal(r.body.onthuld, false);
  });

  it('bundelt meerdere vondsten tot één verdeling en houdt de herkomst vast', async () => {
    const a = (await maak({ naam: 'Haard', goud: { fl: 5 }, items: [{ naam: 'Zegelring' }] })).body;
    const b = (await maak({ naam: 'Plavuizen', goud: { fl: 3 }, items: [{ naam: 'Longsword' }] })).body;
    const r = await req(server, 'POST', '/api/loot/verdeling', { eventIds: [a.id, b.id] }, dm);
    assert.equal(r.status, 200);
    assert.equal(r.body.goud.fl, 8, 'de munten van beide vondsten worden opgeteld');
    const namen = r.body.items.map(i => `${i.bron}/${i.naam}`).sort();
    assert.deepEqual(namen, ['Haard/Zegelring', 'Plavuizen/Longsword'],
      'elk item houdt de naam van de vondst waar het uit komt');
    assert.equal(r.body.actief, false, 'de verdeling staat nog niet open: de DM stelt eerst bij');
  });

  it('rolt het toeval pas bij het onthullen', async () => {
    const ev = (await maak({ naam: 'Losse munten', goudRandom: { van: 5, tot: 5, munt: 'kn' } })).body;
    assert.equal(ev.goud.kn, 0, 'in de vondst zelf staat nog geen bedrag');
    const r = await req(server, 'POST', '/api/loot/verdeling', { eventIds: [ev.id] }, dm);
    assert.equal(r.body.goud.kn, 5, 'bij het onthullen wordt er gerold');
  });

  it('kiest een willekeurig voorwerp van de gevraagde rarity', async () => {
    const ev = (await maak({ naam: 'Onbekende buit', items: [{ willekeurig: true, rariteit: 'Common' }] })).body;
    const r  = await req(server, 'POST', '/api/loot/verdeling', { eventIds: [ev.id] }, dm);
    const it = r.body.items[0];
    assert.ok(['Roestige dolk', 'Gedeukte helm'].includes(it.naam), `kreeg ${it.naam}`);
    assert.ok(it.entityId, 'het gekozen voorwerp is gekoppeld aan zijn kaartje');
  });

  it('kopieert een sjabloon los van het origineel', async () => {
    const sj = (await maak({ naam: 'Standaardkist', sjabloon: true, items: [{ naam: 'Fakkel' }] })).body;
    const kp = (await req(server, 'POST', `/api/loot/events/${sj.id}/kopie`, { naam: 'Kist in K3' }, dm)).body;
    assert.notEqual(kp.id, sj.id);
    assert.equal(kp.sjabloon, false, 'een kopie is een gewone vondst');
    await req(server, 'PUT', `/api/loot/events/${sj.id}`, { items: [{ naam: 'Aangepast' }] }, dm);
    const na = (await req(server, 'GET', '/api/loot/events', null, dm)).body.events.find(e => e.id === kp.id);
    assert.equal(na.items[0].naam, 'Fakkel', 'het sjabloon aanpassen verandert niets aan wat al ergens ligt');
  });

  it('houdt de vondstenbibliotheek weg bij spelers', async () => {
    const spelerCookie = (await req(server, 'POST', '/api/auth/player-login', { characterId: speler })).cookie;
    const r = await req(server, 'GET', '/api/loot/events', null, spelerCookie);
    assert.equal(r.status, 403, 'een speler hoort niet te zien wat er nog te vinden valt');
  });
});
