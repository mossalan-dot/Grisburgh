const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Een kaartje dat niet uit de progressie komt.** Een conditie staat in
// `conditions.js`, een beest en een metgezel in `bronnen/`, een maneuver in
// `lib/klassekrachten.js` — code en meegeleverde data die alle campagnes delen.
// De feature-editor kan daar dus niet bij, en toch wil een DM er een plaat aan
// hangen en zijn eigen woorden erbij schrijven. Dat gaat naar één bak,
// `meta.naslagkaarten['<soort>:<naam>']`, en die bak bewaakt deze toets: hij
// moet per veld bij te stellen zijn (een plaat kiezen mag de tekst niet wissen)
// en leeg weer verdwijnen, anders groeit `meta.json` vol met lege rijen.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-naslag-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Wat de DM aan een naslagkaartje hangt', () => {
  let server, io, dm, speler;
  const CHAR = 'e_naslag_test';
  const meta = () => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'naslagproef', 'meta.json'), 'utf8'));
  const zet = (velden) => req(server, 'PUT', '/api/meta/naslagkaart', velden, dm);

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    const storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('naslagproef', { appTitle: 'Naslagproef' });

    const groep = 'g_naslag';
    const pad = path.join(DATA_DIR, 'campaigns', 'naslagproef');
    fs.writeFileSync(path.join(pad, 'dm-state.json'), JSON.stringify({
      dmPassword: 'naslagproef-dm',
      activeGroup: groep,
      groups: { [groep]: { name: 'Proef', password: 'proef' } },
      playerProfiles: { [CHAR]: { klasse: 'Druid', level: 3 } },
    }, null, 2));
    const ent = JSON.parse(fs.readFileSync(path.join(pad, 'entities.json'), 'utf8'));
    ent.personages = [{ id: CHAR, name: 'Proefdruïde', subtype: 'speler', data: { groep } }];
    fs.writeFileSync(path.join(pad, 'entities.json'), JSON.stringify(ent, null, 2));

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'naslagproef', password: 'naslagproef-dm' })).cookie;
    speler = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'naslagproef', characterId: CHAR, password: 'proef' })).cookie;
    assert.ok(dm && speler, 'DM en speler zijn ingelogd');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('weigert een soort die niet bestaat', async () => {
    const r = await zet({ soort: 'klasse', naam: 'Druid', tekst: 'nee' });
    assert.equal(r.status, 400);
    assert.ok(!meta().naslagkaarten);
  });

  it('weigert een kaartje zonder naam', async () => {
    const r = await zet({ soort: 'conditie', naam: '   ', tekst: 'nee' });
    assert.equal(r.status, 400);
  });

  it('laat een speler er niet in schrijven', async () => {
    const r = await req(server, 'PUT', '/api/meta/naslagkaart',
      { soort: 'beest', naam: 'Wolf', tekst: 'van mij' }, speler);
    assert.notEqual(r.status, 200);
    assert.ok(!meta().naslagkaarten);
  });

  it('bewaart een plaat en een eigen tekst', async () => {
    const r = await zet({ soort: 'metgezel', naam: 'Steel Defender', tekst: 'Bij ons heet hij Blikkie.' });
    assert.equal(r.status, 200);
    assert.deepEqual(meta().naslagkaarten['metgezel:Steel Defender'], { tekst: 'Bij ons heet hij Blikkie.' });
    await zet({ soort: 'metgezel', naam: 'Steel Defender', beeld: 'f_blikkie' });
    assert.deepEqual(meta().naslagkaarten['metgezel:Steel Defender'],
      { tekst: 'Bij ons heet hij Blikkie.', beeld: 'f_blikkie' },
      'een plaat kiezen laat de tekst staan — dat zijn twee knoppen, geen formulier');
  });

  it('houdt twee kaartjes met dezelfde naam gescheiden', async () => {
    await zet({ soort: 'beest', naam: 'Steel Defender', tekst: 'een ander kaartje' });
    assert.equal(meta().naslagkaarten['metgezel:Steel Defender'].tekst, 'Bij ons heet hij Blikkie.');
    assert.equal(meta().naslagkaarten['beest:Steel Defender'].tekst, 'een ander kaartje');
  });

  it('haalt het focuspunt mee weg als de plaat weggaat', async () => {
    await zet({ soort: 'metgezel', naam: 'Steel Defender', focus: '30% 20%' });
    assert.equal(meta().naslagkaarten['metgezel:Steel Defender'].focus, '30% 20%');
    await zet({ soort: 'metgezel', naam: 'Steel Defender', beeld: '' });
    const rij = meta().naslagkaarten['metgezel:Steel Defender'];
    assert.ok(!rij.beeld && !rij.focus, 'een focuspunt zonder plaat wijst nergens naar');
    assert.equal(rij.tekst, 'Bij ons heet hij Blikkie.');
  });

  it('laat geen lege rijen achter', async () => {
    await zet({ soort: 'beest', naam: 'Steel Defender', tekst: '' });
    assert.ok(!meta().naslagkaarten['beest:Steel Defender'], 'de sleutel is weg, niet leeg');
    await zet({ soort: 'metgezel', naam: 'Steel Defender', tekst: '' });
    assert.ok(!meta().naslagkaarten, 'en is er niets meer, dan staat de bak er niet');
  });

  it('stuurt wat de DM schreef ook naar de speler', async () => {
    await zet({ soort: 'conditie', naam: 'Restrained', beeld: 'f_vastgebonden' });
    const r = await req(server, 'GET', '/api/meta', null, speler);
    assert.equal(r.status, 200);
    assert.equal(r.body.naslagkaarten?.['conditie:Restrained']?.beeld, 'f_vastgebonden',
      'de plaat is geen geheim — hij hoort op het kaartje te staan dat de speler opent');
  });
});
