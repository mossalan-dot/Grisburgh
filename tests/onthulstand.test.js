const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// ════════════════════════════════════════════════════════════════════════════
//  DE ONTHULSTAND VAN RODDELS EN GEHEIMEN
// ════════════════════════════════════════════════════════════════════════════
// Welke roddels een party gehoord heeft en welke geheimen open staan, is in de
// loop van de tijd in vier vormen weggeschreven. De roddelroute schreef een
// **lijst met ids** (`['i2']`), terwijl de lezer een array voor een lijst
// ja/nee op positie hield — dus "alleen de derde verteld" kwam terug als "de
// eerste is verteld". Dat is geen opmaakfoutje: de verkeerde regel stond open
// voor de spelers.
//
// Deze suite legt de vier vormen vast en loopt de hele heen-en-terugweg af.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-onthul-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        let parsed; try { parsed = JSON.parse(d); } catch { parsed = d; }
        resolve({ status: res.statusCode, body: parsed, cookie: sc ? sc[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}

describe('De onthulstand', () => {
  let server, io, storage, dm;
  const ID = 'proef_roddelaar';

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    const dir = path.join(DATA_DIR, 'campaigns', 'grisburgh');
    const ents = JSON.parse(fs.readFileSync(path.join(dir, 'entities.json'), 'utf8'));
    ents.personages = ents.personages || [];
    ents.personages.push({ id: ID, name: 'Proef Roddelaar', subtype: 'NPC', data: {
      flavours: JSON.stringify(['Eerste.', 'Tweede.', 'Derde.']),
      geheimen: JSON.stringify([{ id: 'g_a', tekst: 'Een.' }, { id: 'g_b', tekst: 'Twee.' }]),
    } });
    fs.writeFileSync(path.join(dir, 'entities.json'), JSON.stringify(ents, null, 2));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    assert.ok(dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const haal = async () => (await req(server, 'GET', `/api/entities/personages/${ID}`, null, dm)).body;
  const roddel = (index) => req(server, 'PUT', `/api/entities/personages/${ID}/flavour`, { index }, dm);
  const standIn = () => {
    const dmState = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'grisburgh', 'dm-state.json'), 'utf8'));
    const g = dmState.groups[dmState.activeGroup];
    return g.flavourReveals?.[ID];
  };

  it('vertelt precies de roddel die je aanwijst — ook als dat de derde is', async () => {
    // Dit is het geval dat misging: alleen de laatste vertellen.
    const r = await roddel(2);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.uitgesproken, [false, false, true]);
    const e = await haal();
    assert.deepEqual(e._roddels.map(x => x.gehoord), [false, false, true],
      'na een verse ophaal staat nog steeds alleen de derde open');
  });

  it('houdt ze uit elkaar als je er meer vertelt', async () => {
    await roddel(0);
    const e = await haal();
    assert.deepEqual(e._roddels.map(x => x.gehoord), [true, false, true]);
  });

  it('draait een vertelde roddel ook weer terug', async () => {
    await roddel(2);
    const e = await haal();
    assert.deepEqual(e._roddels.map(x => x.gehoord), [true, false, false]);
  });

  it('bewaart een lijst ja-nee zolang de regels noodids dragen', () => {
    // Deze roddels zijn kale teksten, dus i0/i1/i2 — dan blijft de stand een
    // lijst die met de regels meeschuift als je er een tussenuit haalt.
    const stand = standIn();
    assert.ok(Array.isArray(stand), `verwachtte een array, kreeg ${JSON.stringify(stand)}`);
    assert.ok(stand.every(x => typeof x === 'boolean'),
      `de lijst hoort ja/nee te bevatten, niet ids: ${JSON.stringify(stand)}`);
  });

  it('leest een oude lijst mét ids nog steeds goed', async () => {
    // Wat de route tot 6 okt 2026 wegschreef. Zonder de id-tak zou `['i2']`
    // gelezen worden als "de eerste is verteld".
    const fp = path.join(DATA_DIR, 'campaigns', 'grisburgh', 'dm-state.json');
    const dmState = JSON.parse(fs.readFileSync(fp, 'utf8'));
    dmState.groups[dmState.activeGroup].flavourReveals[ID] = ['i2'];
    fs.writeFileSync(fp, JSON.stringify(dmState, null, 2));
    const e = await haal();
    assert.deepEqual(e._roddels.map(x => x.gehoord), [false, false, true],
      "['i2'] betekent: de derde is verteld");
  });

  it('negeert een id dat niet meer bestaat', async () => {
    const fp = path.join(DATA_DIR, 'campaigns', 'grisburgh', 'dm-state.json');
    const dmState = JSON.parse(fs.readFileSync(fp, 'utf8'));
    dmState.groups[dmState.activeGroup].flavourReveals[ID] = ['i1', 'i9_bestaat_niet'];
    fs.writeFileSync(fp, JSON.stringify(dmState, null, 2));
    const e = await haal();
    assert.deepEqual(e._roddels.map(x => x.gehoord), [false, true, false]);
  });

  it('bewaart geheimen op id, want die dragen er echte', async () => {
    const r = await req(server, 'PUT', `/api/entities/personages/${ID}/secret`, { index: 1 }, dm);
    assert.equal(r.status, 200);
    const dmState = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'grisburgh', 'dm-state.json'), 'utf8'));
    const stand = dmState.groups[dmState.activeGroup].secretReveals[ID];
    assert.deepEqual(stand, { g_b: true }, 'op id, niet op positie');
  });
});
