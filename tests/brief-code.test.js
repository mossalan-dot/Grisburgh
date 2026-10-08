const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const code = require('../lib/brief-code');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-code-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

const BRIEF = `Mijn heer,

Bij de derde klok gaan de lantaarns op de oostkade uit. Betaal Wimmerdinck 42 kronen.

Verbrand deze brief.`;

describe('Gecodeerde brief: het husselen', () => {
  it('geeft bij dezelfde tekst altijd dezelfde husseling', () => {
    // Zonder dit kun je er aan tafel niet over praten, en klopt het
    // tafelscherm niet met wat iemand op zijn telefoon zag.
    assert.equal(code.husselTekst(BRIEF), code.husselTekst(BRIEF));
  });

  it('houdt de witruimte op zijn plek', () => {
    // De spaties en regelovergangen dragen de vorm van de brief. Husselen die
    // mee, dan is het een andere brief geworden.
    const uit = [...code.husselTekst(BRIEF)];
    [...BRIEF].forEach((ch, i) => {
      if (/\s/u.test(ch)) assert.equal(uit[i], ch, `teken ${i} is witruimte en hoort te blijven`);
    });
  });

  it('laat cijfers en leestekens meedoen', () => {
    // Deden ze niet, en toen bleef "42 kronen" gewoon leesbaar in een brief
    // die geheim heette.
    const uit = code.husselTekst(BRIEF);
    assert.ok(!uit.includes('42'), 'het bedrag staat er niet meer');
    assert.ok(!uit.includes('Wimmerdinck'), 'en de naam ook niet');
  });

  it('gebruikt precies dezelfde tekens', () => {
    const sorteer = s => [...s].filter(ch => !/\s/u.test(ch)).sort().join('');
    assert.equal(sorteer(code.husselTekst(BRIEF)), sorteer(BRIEF));
  });

  it('is terug te rekenen met de volgorde die erbij hoort', () => {
    // Dit is wat de client doet bij het onthullen: elke letter weet waar hij
    // stond en vliegt van daar naar zijn eigen plek.
    const { tekst, volgorde } = code.hussel(BRIEF);
    const mee = s => [...s].map((ch, i) => ({ ch, i })).filter(x => !/\s/u.test(x.ch));
    const E = mee(BRIEF), C = mee(tekst);
    const terug = [...tekst];
    volgorde.forEach((rang, k) => { terug[E[k].i] = C[rang].ch; });
    assert.equal(terug.join(''), BRIEF);
  });

  it('valt niet over een lege of piepkleine tekst', () => {
    assert.equal(code.husselTekst(''), '');
    assert.equal(code.husselTekst('a'), 'a');
    assert.equal(code.husselTekst('   '), '   ');
  });
});

describe('Gecodeerde brief: wat de deur uitgaat', () => {
  let server, io, dm, gid, gid2, speler, spelerC, buur, buurC, docId;

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
    const tweede = (await req(server, 'POST', '/api/groups', { name: 'Tweede party' }, dm)).body;
    gid2 = tweede?.id || tweede?.group?.id;
    await req(server, 'PUT', `/api/groups/${gid2}/password`, { password: 'proef1234' }, dm);

    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Lezer', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;
    buur = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Buurman', subtype: 'speler', data: { groep: gid2 } }, dm)).body.id;
    buurC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: buur, password: 'proef1234' })).cookie;

    docId = (await req(server, 'POST', '/api/entities/documenten',
      { name: 'Onderschepte brief', data: { docType: 'Brief', tekst: BRIEF, gecodeerd: true } }, dm)).body.id;
    // Zichtbaarheid gaat per party en de route werkt op de **actieve** groep,
    // dus allebei de partys langs: ze moeten de brief kunnen zien om hem
    // onleesbaar te kunnen krijgen.
    for (const groep of [gid, gid2]) {
      await req(server, 'PUT', '/api/groups/active', { groupId: groep }, dm);
      await req(server, 'PUT', `/api/entities/documenten/${docId}/visibility`, { target: 'visible' }, dm);
    }
    await req(server, 'PUT', '/api/groups/active', { groupId: gid }, dm);
  });

  after(async () => {
    await new Promise(r => { io?.close(); server.close(r); });
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    delete process.env.GRISBURGH_DATA_DIR;
  });

  const alsSpeler = async (c = spelerC) =>
    (await req(server, 'GET', `/api/entities/documenten/${docId}`, null, c)).body;

  it('stuurt de klare tekst niet naar een party die hem niet gekraakt heeft', () => {
    // Dit is de hele feature. Zou de tekst meegaan met een vlaggetje erbij,
    // dan stond hij in de netwerktab.
    return alsSpeler().then(d => {
      assert.ok(d.data.tekst, 'er staat wél iets');
      assert.notEqual(d.data.tekst, BRIEF, 'maar niet de brief');
      assert.equal(d._gecodeerd, true);
      assert.ok(!d.data.tekst.includes('Wimmerdinck'));
      assert.ok(!d.data.tekst.includes('42'));
    });
  });

  it('stuurt de volgorde evenmin — die is samen met de husseling de brief', async () => {
    const d = await alsSpeler();
    const alles = JSON.stringify(d);
    assert.ok(!alles.includes('volgorde'), 'geen volgorde in het antwoord');
  });

  it('laat de DM de brief gewoon lezen', async () => {
    const d = (await req(server, 'GET', `/api/entities/documenten/${docId}`, null, dm)).body;
    assert.equal(d.data.tekst, BRIEF);
  });

  it('geeft na het ontcijferen de tekst én de volgorde', async () => {
    const r = await req(server, 'POST', `/api/entities/documenten/${docId}/ontcijfer`, { groupId: gid }, dm);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.tekst, BRIEF);
    assert.ok(Array.isArray(r.body.volgorde) && r.body.volgorde.length > 10);

    const d = await alsSpeler();
    assert.equal(d.data.tekst, BRIEF, 'en de speler leest hem nu');
    assert.equal(d._ontcijferd, true);
  });

  it('laat de andere party in het ongewisse', async () => {
    // Per party, zoals bij geheimen. Twee groepen door dezelfde brief laten
    // lopen is anders stuk.
    const d = await alsSpeler(buurC);
    assert.notEqual(d.data.tekst, BRIEF);
    assert.equal(d._gecodeerd, true);
  });

  it('laat een speler niet zelf ontcijferen', async () => {
    const r = await req(server, 'POST', `/api/entities/documenten/${docId}/ontcijfer`, { groupId: gid2 }, spelerC);
    assert.ok(r.status === 401 || r.status === 403, `kreeg ${r.status}`);
  });

  it('weigert een document dat niet gecodeerd is', async () => {
    const los = (await req(server, 'POST', '/api/entities/documenten',
      { name: 'Gewone brief', data: { tekst: 'Hallo.' } }, dm)).body.id;
    const r = await req(server, 'POST', `/api/entities/documenten/${los}/ontcijfer`, { groupId: gid }, dm);
    assert.equal(r.status, 400);
  });

  // ── Het tafelscherm ───────────────────────────────────────────────────────
  it('legt een document op het tafelscherm, gecodeerd als het dat is', async () => {
    // Een tweede document, want het eerste is hierboven al ontcijferd.
    const id = (await req(server, 'POST', '/api/entities/documenten',
      { name: 'Tweede brief', data: { docType: 'Brief', tekst: BRIEF, gecodeerd: true } }, dm)).body.id;
    const r = await req(server, 'POST', `/api/entities/documenten/${id}/tafelscherm`, {}, dm);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.gecodeerd, true, 'hij gaat onleesbaar het scherm op');
  });

  it('legt hem leesbaar op tafel zodra de party hem gekraakt heeft', async () => {
    const r = await req(server, 'POST', `/api/entities/documenten/${docId}/tafelscherm`, { groupId: gid }, dm);
    assert.equal(r.body.gecodeerd, false);
  });

  it('weigert een document zonder tekst', async () => {
    const leeg = (await req(server, 'POST', '/api/entities/documenten',
      { name: 'Leeg', data: {} }, dm)).body.id;
    const r = await req(server, 'POST', `/api/entities/documenten/${leeg}/tafelscherm`, {}, dm);
    assert.equal(r.status, 400);
  });

  it('laat een speler niets op het tafelscherm leggen', async () => {
    const r = await req(server, 'POST', `/api/entities/documenten/${docId}/tafelscherm`, {}, spelerC);
    assert.ok(r.status === 401 || r.status === 403, `kreeg ${r.status}`);
  });
});
