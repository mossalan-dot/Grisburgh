const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De houding is de hele feature waard zolang hij niet verraadt wat hij moest
// verbergen. Een antagonist die zich als vriend voordoet, is alleen een
// verrassing als zijn 1 niet in de netwerktab staat voordat iemand hem
// doorheeft. Deze toets gaat daarover: wat gaat er écht de deur uit.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-houding-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Houding: wat de deur uitgaat', () => {
  let server, io, dm, gid, speler, spelerC, schurk, hond, god;

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
      { name: 'Toeschouwer', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;

    // Een schurk die zich voordoet als gewone NPC: geen rol, maar wél een
    // houding die de DM met de hand op vijandig zette. Precies het geval
    // waarin uitlekken het spel bederft.
    schurk = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Vriendelijke Buurman', subtype: 'NPC', data: { houding: 1, insightDC: 18 } }, dm)).body.id;
    hond = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Rakker', subtype: 'dier', data: {} }, dm)).body.id;
    god = (await req(server, 'POST', '/api/entities/personages',
      { name: 'De Verborgene', subtype: 'god', data: {} }, dm)).body.id;
    // Zichtbaar maken voor de party, anders ziet de speler sowieso niets.
    for (const id of [schurk, hond, god]) {
      await req(server, 'PUT', `/api/entities/personages/${id}/visibility`, { visibility: 'visible' }, dm);
    }
  });

  after(async () => {
    await new Promise(r => { io?.close(); server.close(r); });
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    delete process.env.GRISBURGH_DATA_DIR;
  });

  const vanDM = async () => (await req(server, 'GET', '/api/entities/personages', null, dm)).body;
  const vanSpeler = async () => (await req(server, 'GET', '/api/entities/personages', null, spelerC)).body;

  it('laat de DM de houding zien die hij zelf zette', async () => {
    const e = (await vanDM()).find(x => x.id === schurk);
    assert.equal(e._houding, 1);
  });

  it('rekent de houding uit voor wie er geen heeft', async () => {
    const lijst = await vanDM();
    assert.equal(lijst.find(x => x.id === hond)._houding, 4, 'een dier hoort bij je');
  });

  it('geeft een god geen houding', async () => {
    const e = (await vanDM()).find(x => x.id === god);
    assert.equal(e._houding, null);
  });

  it('stuurt niets naar een speler die de DC nog niet haalde', async () => {
    const e = (await vanSpeler()).find(x => x.id === schurk);
    assert.ok(e, 'het kaartje zelf komt wel door');
    assert.equal(e._houding, undefined, 'maar zonder houding');
  });

  it('stuurt ook geen 3 als dekmantel', async () => {
    // Een 3 zou een uitspraak zijn ("deze is onverschillig"). Niets is niets:
    // een stil kaartje kan alles betekenen, en dát is de dekmantel.
    const e = (await vanSpeler()).find(x => x.id === schurk);
    assert.ok(!('_houding' in e), 'het veld bestaat niet eens');
  });

  it('houdt de ingestelde houding en de DC uit de data van de speler', async () => {
    const e = (await vanSpeler()).find(x => x.id === schurk);
    assert.equal(e.data.houding, undefined, 'wat de DM instelde is administratie');
    assert.equal(e.data.insightDC, undefined, 'en de DC verraadt dat er iets te halen valt');
  });

  it('laat ook een onschuldig kaartje niets lekken', async () => {
    // Zou alleen de schurk zwijgen en de hond praten, dan was stilte juist
    // het signaal. Iedereen zwijgt, dus stilte zegt niets.
    const e = (await vanSpeler()).find(x => x.id === hond);
    assert.equal(e._houding, undefined);
  });

  it('geeft de schaal door aan wie ingelogd is, en niet aan de rest', async () => {
    const uit = await req(server, 'GET', '/api/houdingen', null, dm);
    assert.equal(uit.status, 200);
    assert.equal(uit.body.houdingen.length, 5);
    assert.equal(uit.body.dcStandaard, 12);
    const zonder = await req(server, 'GET', '/api/houdingen', null, null);
    assert.ok(zonder.status === 401 || zonder.status === 403, 'zonder sessie geen schaal');
  });

  it('bewaart een lege houding als leeg, niet als 3', async () => {
    // Anders wordt een berekende waarde bij de eerste keer opslaan vastgezet,
    // en schuift hij nooit meer mee met de renown van zijn factie.
    await req(server, 'PUT', `/api/entities/personages/${hond}`,
      { name: 'Rakker', subtype: 'dier', data: { houding: '' } }, dm);
    const ruw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'grisburgh', 'entities.json'), 'utf8'));
    const e = ruw.personages.find(x => x.id === hond);
    assert.ok(!e.data.houding, 'niets opgeslagen');
    assert.equal((await vanDM()).find(x => x.id === hond)._houding, 4, 'en nog steeds uitgerekend');
  });

  // ── Het balkje op het kaartje ─────────────────────────────────────────────
  // Het zet alléén de houding. Zou het de hele PUT gebruiken, dan schrijft een
  // tik op een balkje het kaartje in zijn geheel terug — inclusief wat er
  // ondertussen door iemand anders aan veranderd is.
  it('zet alleen de houding en laat de rest met rust', async () => {
    const voor = (await req(server, 'GET', `/api/entities/personages/${hond}`, null, dm)).body;
    const r = await req(server, 'PUT', `/api/entities/personages/${hond}/houding`, { houding: 2 }, dm);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const na = (await req(server, 'GET', `/api/entities/personages/${hond}`, null, dm)).body;
    assert.equal(na.data.houding, 2);
    assert.equal(na._houding, 2);
    assert.equal(na.name, voor.name, 'de naam blijft');
    assert.equal(na.subtype, voor.subtype, 'het subtype blijft');
  });

  it('zet hem met null terug op standaard, niet op 3', async () => {
    await req(server, 'PUT', `/api/entities/personages/${hond}/houding`, { houding: 2 }, dm);
    const r = await req(server, 'PUT', `/api/entities/personages/${hond}/houding`, { houding: null }, dm);
    assert.equal(r.status, 200);
    assert.equal(r.body.eigen, false);
    const na = (await req(server, 'GET', `/api/entities/personages/${hond}`, null, dm)).body;
    assert.equal(na.data.houding, undefined, 'het veld is weg');
    assert.equal(na._houding, 4, 'en de berekening is terug');
  });

  it('weigert een houding op een kaartje dat niet op de schaal staat', async () => {
    const r = await req(server, 'PUT', `/api/entities/personages/${god}/houding`, { houding: 5 }, dm);
    assert.equal(r.status, 400);
  });

  it('laat een speler de houding niet verzetten', async () => {
    const r = await req(server, 'PUT', `/api/entities/personages/${schurk}/houding`, { houding: 5 }, spelerC);
    assert.ok(r.status === 401 || r.status === 403, `kreeg ${r.status}`);
  });

  // ── De schakelaar ─────────────────────────────────────────────────────────
  // Niet elke tafel wil dit. Uitzetten moet alles doven — ook voor de DM,
  // want een half uitgezette functie is verwarrender dan een hele.
  it('dooft alles als de DM de module uitzet', async () => {
    await req(server, 'PUT', '/api/meta/modules-uit', { uit: ['houding'] }, dm);
    const lijst = (await req(server, 'GET', '/api/entities/personages', null, dm)).body;
    assert.ok(lijst.every(e => e._houding === null || e._houding === undefined),
      'geen enkel kaartje draagt nog een houding');
    const schaal = (await req(server, 'GET', '/api/houdingen', null, dm)).body;
    assert.equal(schaal.houdingen.length, 0, 'en er is geen schaal om mee te tekenen');
    assert.equal(schaal.uit, true);
  });

  it('weigert de houding te verzetten zolang de module uitstaat', async () => {
    const r = await req(server, 'PUT', `/api/entities/personages/${hond}/houding`, { houding: 5 }, dm);
    assert.equal(r.status, 403, 'de client verbergt het balkje al, maar de route moet het ook weigeren');
  });

  it('laat staan wat de DM al ingesteld had', async () => {
    // Niets weggooien wat iemand getypt heeft: zet hij de module later weer
    // aan, dan is zijn werk er nog.
    const ruw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'grisburgh', 'entities.json'), 'utf8'));
    assert.equal(ruw.personages.find(x => x.id === schurk).data.houding, 1);
    await req(server, 'PUT', '/api/meta/modules-uit', { uit: [] }, dm);
    const na = (await req(server, 'GET', `/api/entities/personages/${schurk}`, null, dm)).body;
    assert.equal(na._houding, 1, 'en hij geldt meteen weer');
  });
});
