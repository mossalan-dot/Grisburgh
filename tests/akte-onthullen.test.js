const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Tijdens het spelen onthult de DM beelden uit de akte één voor één. Dat loopt
// over de sessielog-entry van die akte en over `imageVis` per party — twee
// assen die allebei goed moeten staan. En het is terug te draaien, want een
// beeld te vroeg tonen kun je aan tafel niet meer afpakken.
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

describe('Akte spelen: beelden onthullen en het tafelscherm', () => {
  let server, io, dm, gid, gid2, speler, spelerC, buur, buurC, sessieId;

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
      { name: 'Toeschouwer', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;
    buur = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Buurman', subtype: 'speler', data: { groep: gid2 } }, dm)).body.id;
    buurC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: buur, password: 'proef1234' })).cookie;

    await req(server, 'PUT', '/api/meta/hoofdstuk/akte1', { num: 1, title: 'De proefakte' }, dm);
    const s = await req(server, 'POST', '/api/sessieLog', {
      hoofdstuk: 'akte1', korteSamenvatting: 'Scène-afbeeldingen',
      visible: false,
      images: [{ id: 'beeld_a', caption: '', visible: false },
               { id: 'beeld_b', caption: '', visible: false }],
    }, dm);
    assert.ok(s.status === 200 || s.status === 201, JSON.stringify(s.body));
    sessieId = s.body.id || s.body.entry?.id;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const archiefVan = async (cookie) => (await req(server, 'GET', '/api/archief', null, cookie)).body;
  const beeldenVanSpeler = async (cookie = spelerC) => {
    const a = await archiefVan(cookie);
    const entry = (a.sessieLog || []).find(e => e.id === sessieId);
    return entry ? (entry.images || []).map(i => (typeof i === 'string' ? i : i.id)) : null;
  };

  it('houdt een verborgen verslag bij de speler weg', async () => {
    assert.strictEqual(await beeldenVanSpeler(), null,
      'een sessielog op onzichtbaar hoort niet in het archief van een speler te staan');

    const dmKant = await archiefVan(dm);
    assert.ok((dmKant.sessieLog || []).some(e => e.id === sessieId), 'de DM ziet hem wel');
  });

  it('toont een beeld pas als het onthuld is — en alleen aan díé party', async () => {
    await req(server, 'PUT', `/api/sessieLog/${sessieId}`, { visible: true }, dm);
    assert.deepStrictEqual(await beeldenVanSpeler(), [],
      'het verslag is zichtbaar, de beelden nog niet');

    const r = await req(server, 'POST', `/api/sessieLog/${sessieId}/onthul`,
      { fileId: 'beeld_a', caption: 'De poort staat open', groupId: gid }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    assert.deepStrictEqual(await beeldenVanSpeler(), ['beeld_a'], 'de eerste is open');
    assert.deepStrictEqual(await beeldenVanSpeler(buurC), [],
      'de andere party heeft niets gezien');
  });

  it('bewaart het bijschrift van de regie-stap bij het beeld', async () => {
    const a = await archiefVan(dm);
    const entry = (a.sessieLog || []).find(e => e.id === sessieId);
    const beeld = (entry.images || []).find(i => (typeof i === 'string' ? i : i.id) === 'beeld_a');
    assert.strictEqual(beeld.caption, 'De poort staat open');
  });

  it('draait een onthulling terug', async () => {
    const r = await req(server, 'POST', `/api/sessieLog/${sessieId}/verberg`,
      { fileId: 'beeld_a', groupId: gid }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.deepStrictEqual(await beeldenVanSpeler(), [], 'weer weg bij de speler');

    // Het bijschrift blijft staan: dat hoort bij het beeld, niet bij het tonen.
    const entry = ((await archiefVan(dm)).sessieLog || []).find(e => e.id === sessieId);
    const beeld = (entry.images || []).find(i => (typeof i === 'string' ? i : i.id) === 'beeld_a');
    assert.strictEqual(beeld.caption, 'De poort staat open');
  });

  it('vraagt om een fileId', async () => {
    for (const p of ['onthul', 'verberg']) {
      const r = await req(server, 'POST', `/api/sessieLog/${sessieId}/${p}`, { groupId: gid }, dm);
      assert.strictEqual(r.status, 400, `${p} zonder fileId hoort geweigerd te worden`);
    }
  });

  it('kent geen onbekend verslag', async () => {
    const r = await req(server, 'POST', '/api/sessieLog/bestaat-niet/onthul',
      { fileId: 'beeld_a', groupId: gid }, dm);
    assert.strictEqual(r.status, 404, JSON.stringify(r.body));
  });

  it('zet alle beelden van een akte in één keer terug', async () => {
    await req(server, 'POST', `/api/sessieLog/${sessieId}/onthul`, { fileId: 'beeld_a', groupId: gid }, dm);
    await req(server, 'POST', `/api/sessieLog/${sessieId}/onthul`, { fileId: 'beeld_b', groupId: gid }, dm);
    assert.strictEqual((await beeldenVanSpeler()).length, 2, 'allebei open');

    const r = await req(server, 'PUT', '/api/sessieLog/chapter/akte1/reset-images',
      { groupId: gid }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.deepStrictEqual(await beeldenVanSpeler(), [], 'de akte begint weer schoon');
  });

  it('verbergt een hele akte voor één party', async () => {
    await req(server, 'POST', `/api/sessieLog/${sessieId}/onthul`, { fileId: 'beeld_a', groupId: gid }, dm);
    assert.strictEqual((await beeldenVanSpeler()).length, 1);

    const r = await req(server, 'PUT', `/api/chapter-visibility/${gid}/akte1`,
      { visible: false }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(await beeldenVanSpeler(), null, 'de hele akte is weg voor die party');

    await req(server, 'PUT', `/api/chapter-visibility/${gid}/akte1`, { visible: true }, dm);
    assert.strictEqual((await beeldenVanSpeler()).length, 1, 'en weer terug, met wat er open stond');
  });

  it('stuurt voorleestekst naar het tafelscherm, en zet het weer op sfeer', async () => {
    const r = await req(server, 'POST', '/api/display/tekst',
      { tekst: 'De poort kraakt open.', kop: 'Voor de muur' }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const leeg = await req(server, 'POST', '/api/display/tekst', { tekst: '   ' }, dm);
    assert.strictEqual(leeg.status, 400, 'een lege lap tekst hoort geweigerd te worden');

    const idle = await req(server, 'POST', '/api/display/idle', {}, dm);
    assert.strictEqual(idle.status, 200, JSON.stringify(idle.body));
  });

  it('laat een speler niets onthullen of op het tafelscherm zetten', async () => {
    const onthul = await req(server, 'POST', `/api/sessieLog/${sessieId}/onthul`,
      { fileId: 'beeld_b', groupId: gid }, spelerC);
    assert.strictEqual(onthul.status, 403, JSON.stringify(onthul.body));

    const tekst = await req(server, 'POST', '/api/display/tekst', { tekst: 'Ik regisseer' }, spelerC);
    assert.strictEqual(tekst.status, 403, JSON.stringify(tekst.body));
  });
});
