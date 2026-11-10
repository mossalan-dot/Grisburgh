const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const MAT = require('../lib/materiaal');

// De M-component van een spreuk: wat het materiaal kost, of het opgaat, en wat
// er gebeurt als een speler een slot afvinkt. Twee grenzen die hier bewaakt
// worden: afrekenen uit de beurs bestaat alleen als de DM het aanzette (ook
// langs de knop heen), en er gaat nooit meer geld uit de beurs dan erin zit.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-materiaal-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Materiaal uit de tekst van een spreuk', () => {
  it('ziet geen M waar er geen staat', () => {
    assert.equal(MAT.materiaalUit('V, S'), null);
  });

  it('materiaal zonder prijs is altijd bij de hand', () => {
    const m = MAT.voorClient({ components: 'V, S, M (a tiny ball of bat guano and sulfur)' });
    assert.equal(m.waardeCl, 0);
    assert.equal(m.verbruikt, false);
    assert.equal(m.modus, 'altijd', 'een component pouch dekt alles zonder prijs');
  });

  it('verbruikt materiaal met een prijs begint als lege voorraad', () => {
    const m = MAT.voorClient({ components: 'V, S, M (a diamond worth 300+ GP, which the spell consumes)' });
    assert.equal(m.waardeCl, 30000);
    assert.equal(m.verbruikt, true);
    assert.deepEqual([m.modus, m.aantal], ['voorraad', 0]);
  });

  it('telt bij "all of which" alles samen, anders alleen wat opgaat', () => {
    const samen = MAT.materiaalUit('V, S, M (one jacinth worth 1,000+ GP and one silver bar worth 100+ GP, all of which the spell consumes)');
    assert.equal(samen.waardeCl, 110000);
    const kloon = MAT.materiaalUit('V, S, M (a diamond worth 1,000+ GP, which the spell consumes, and a sealable vessel worth 2,000+ GP)');
    assert.equal(kloon.waardeCl, 100000, 'het vat blijft, alleen de diamant gaat op');
  });

  it('rekent zilver en koper om', () => {
    assert.equal(MAT.materiaalUit('S, M (a melee weapon worth at least 1 sp)').waardeCl, 10);
  });
});

describe('Materiaal bij het casten', () => {
  let server, io, dm, speler, spelerCookie;
  const DIAMANT = 'revivify';

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Zuinige Priester', subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    await req(server, 'POST', `/api/player-spells/${speler}`, {
      index: DIAMANT, name: 'Revivify', level: 3,
      components: 'V, S, M (a diamond worth 300+ GP, which the spell consumes)',
    }, dm);
    await req(server, 'POST', `/api/player-spells/${speler}`, {
      index: 'fireball', name: 'Fireball', level: 3,
      components: 'V, S, M (a tiny ball of bat guano and sulfur)',
    }, dm);
    await req(server, 'PATCH', `/api/player-currency/${speler}`, { fl: 500, kn: 0, cl: 0 }, dm);

    const groups = (await req(server, 'GET', '/api/groups', null, dm)).body.groups || [];
    const wachtwoord = groups.find(g => g.id === 'groep1')?.password;
    spelerCookie = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: wachtwoord })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const gebruik = (idx, body) => req(server, 'POST', `/api/player-spells/${speler}/${idx}/materiaal`, body || {}, spelerCookie);

  it('stuurt de afgeleide stand mee met het spreukenboek', async () => {
    const r = await req(server, 'GET', `/api/player-spells/${speler}`, null, spelerCookie);
    const rev = r.body.find(s => s.index === DIAMANT);
    assert.equal(rev._materiaal.modus, 'voorraad');
    assert.equal(rev._materiaal.waardeCl, 30000);
  });

  it('laat materiaal dat altijd bij de hand is met rust', async () => {
    const r = await gebruik('fireball');
    assert.equal(r.status, 200);
    assert.equal(r.body.materiaal.modus, 'altijd');
  });

  it('zegt dat het op is bij een lege voorraad', async () => {
    const r = await gebruik(DIAMANT);
    assert.equal(r.status, 409);
    assert.equal(r.body.op, true);
  });

  it('telt een voorraad af die de speler zelf instelde', async () => {
    await req(server, 'PATCH', `/api/player-spells/${speler}/${DIAMANT}`, { materiaal: { modus: 'voorraad', aantal: 2 } }, spelerCookie);
    assert.equal((await gebruik(DIAMANT)).body.materiaal.aantal, 1);
    assert.equal((await gebruik(DIAMANT)).body.materiaal.aantal, 0);
    assert.equal((await gebruik(DIAMANT)).status, 409);
  });

  it('weigert afrekenen zolang de DM het niet toestaat', async () => {
    const r = await gebruik(DIAMANT, { betaalCl: 30000 });
    assert.equal(r.status, 409, 'een schakelaar die uitstaat bestaat ook niet langs de knop heen');
  });

  it('rekent af uit de beurs als de DM het toestaat', async () => {
    await req(server, 'PUT', '/api/meta/materiaal', { kasboek: true }, dm);
    const r = await gebruik(DIAMANT, { betaalCl: 30000 });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.currency, { fl: 200, kn: 0, cl: 0 });
  });

  it('gaat nooit onder nul', async () => {
    const r = await gebruik(DIAMANT, { betaalCl: 30000 });
    assert.equal(r.status, 400);
    const geld = (await req(server, 'GET', `/api/player-currency/${speler}`, null, dm)).body;
    assert.equal(geld.fl, 200, 'de beurs is onaangeroerd');
  });

  it('laat een andere speler niet aan dit boek komen', async () => {
    const r = await req(server, 'POST', `/api/player-spells/${speler}/${DIAMANT}/materiaal`, {}, null);
    assert.equal(r.status, 403);
  });
});
