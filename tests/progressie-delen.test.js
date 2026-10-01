const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Van de 55 subklassen staan er 39 niet in de app; wie ze intikt doet dat voor
// zijn eigen campagne. Dit legt vast dat hij dat werk kan meenemen — met de
// afbeeldingen erbij, want die hangen aan een bestands-id dat elders niets
// betekent.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-delen-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Je eigen progressie-invoer delen', () => {
  let server, io, storage, dmA, dmB;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('tweede', { appTitle: 'De Tweede Tafel' });
    fs.writeFileSync(path.join(DATA_DIR, 'campaigns', 'tweede', 'dm-state.json'),
      JSON.stringify({ dmPassword: 'tweede-dm', groups: {} }, null, 2));
    dmA = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    dmB = (await req(server, 'POST', '/api/auth/login', { campagne: 'tweede',   password: 'tweede-dm'   })).cookie;
    assert.ok(dmA && dmB);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  let pakket = null;

  it('pakt alleen zelfbedacht materiaal in', async () => {
    await req(server, 'POST', '/api/progression/feature',
      { soort: 'class', bron: 'Fighter', level: 3, naam: 'Vlasbaards Greep',
        desc: 'Een worp die ze in het Leemland leren.', herkomst: 'zelfbedacht' }, dmA);
    await req(server, 'POST', '/api/progression/feature',
      { soort: 'class', bron: 'Fighter', level: 3, naam: 'Uit het boek',
        desc: 'Letterlijk overgetikt.', herkomst: 'overgenomen' }, dmA);

    const r = await req(server, 'GET', '/api/progression/export', null, dmA);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const namen = r.body.regels.map(x => x.naam);
    assert.ok(namen.includes('Vlasbaards Greep'), 'het eigen werk gaat mee');
    assert.ok(!namen.includes('Uit het boek'), 'overgenomen materiaal blijft standaard thuis');
  });

  it('neemt overgenomen materiaal mee als je erom vraagt', async () => {
    const r = await req(server, 'GET', '/api/progression/export?alles=1', null, dmA);
    const namen = r.body.regels.map(x => x.naam);
    assert.ok(namen.includes('Uit het boek'), 'met alles=1 gaat het wél mee');
    assert.match(r.body._nb, /niet om te publiceren/);
    pakket = r.body;
  });

  it('leest het in bij een andere campagne, met de afbeelding erbij', async () => {
    // Een piepklein PNG'je als afbeelding bij de feature.
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082', 'hex');
    storage.runWith?.('grisburgh', () => {});   // alleen voor de vorm; saveFile gaat via de route hieronder
    pakket.beelden = { 'f_proef': `data:image/png;base64,${png.toString('base64')}` };
    pakket.regels = pakket.regels.map(r => r.naam === 'Vlasbaards Greep' ? { ...r, img: 'f_proef' } : r);

    const r = await req(server, 'POST', '/api/progression/import', pakket, dmB);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.nieuw >= 2, 'beide regels zijn nieuw in deze campagne: ' + JSON.stringify(r.body));
    assert.strictEqual(r.body.beelden, 1, 'en de afbeelding is er een geworden');

    const alles = (await req(server, 'GET', '/api/progression', null, dmB)).body;
    const regels = alles.classes?.Fighter?.levels?.['3'] || [];
    const eigen = regels.find(f => f.name === 'Vlasbaards Greep');
    assert.ok(eigen, 'hij staat in de tweede campagne: ' + JSON.stringify(regels.map(f => f.name)));
    assert.match(eigen.desc, /Leemland/);
    assert.ok(eigen.img && eigen.img !== 'f_proef', 'met een eigen bestands-id, niet dat van de ander');
  });

  it('laat bestaand werk met rust, tenzij je het laat overschrijven', async () => {
    await req(server, 'POST', '/api/progression/feature',
      { soort: 'class', bron: 'Fighter', level: 3, naam: 'Vlasbaards Greep',
        desc: 'MIJN versie.', herkomst: 'zelfbedacht' }, dmB);

    const stil = await req(server, 'POST', '/api/progression/import', pakket, dmB);
    assert.ok(stil.body.overgeslagen >= 1, 'zonder overschrijven blijft het staan');
    let regels = (await req(server, 'GET', '/api/progression', null, dmB)).body.classes.Fighter.levels['3'];
    assert.match(regels.find(f => f.name === 'Vlasbaards Greep').desc, /MIJN versie/);

    const over = await req(server, 'POST', '/api/progression/import', { ...pakket, overschrijf: true }, dmB);
    assert.ok(over.body.bijgewerkt >= 1);
    regels = (await req(server, 'GET', '/api/progression', null, dmB)).body.classes.Fighter.levels['3'];
    assert.match(regels.find(f => f.name === 'Vlasbaards Greep').desc, /Leemland/);
  });

  it('weigert een bestand dat geen export is', async () => {
    const r = await req(server, 'POST', '/api/progression/import', { regels: [{ naam: 'x' }] }, dmB);
    assert.strictEqual(r.status, 400);
  });
});
