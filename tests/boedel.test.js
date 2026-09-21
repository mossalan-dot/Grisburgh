const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De boedel rekent aan twee dingen die een speler zelf niet hoort uit te
// rekenen: hoeveel HP een drankje geeft, en hoeveel er van iets over is. Een
// drankje verdwijnt na één slok, een staf raakt een charge kwijt — en alles
// staat per party, dus het moet ook bij de júíste party vandaan komen.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-boedel-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('De boedel: genezen, charges en wat er verdwijnt', () => {
  let server, io, dm, gid, speler, spelerC, vreemde, drankje, staf;

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
      { name: 'Gewonde', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    vreemde = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Omstander', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;

    // Een drankje dat verdwijnt na gebruik, en een staf met charges.
    drankje = (await req(server, 'POST', '/api/entities/voorwerpen', {
      name: 'Potion of Healing',
      data: { itemType: 'Potion', gebruik: 'stapelbaar', healing: '2d4+2', verbruikt: true },
    }, dm)).body.id;
    staf = (await req(server, 'POST', '/api/entities/voorwerpen', {
      name: 'Staff of Healing',
      data: { itemType: 'Staff', gebruik: 'uniek', healing: '1d8+1', maxCharges: 3 },
    }, dm)).body.id;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const hpVan = async (id = speler) => (await req(server, 'GET', `/api/player-hp/${id}`, null, dm)).body;
  const zetHp = (current, max) => req(server, 'PATCH', `/api/player-hp/${speler}`, { current, max }, dm);
  // De DM-route wil ook de naam erbij: die staat op de eigendomsregel, zodat de
  // boedel leesbaar blijft als een kaartje ooit verdwijnt.
  const naamVan = (id) => (id === speler ? 'Gewonde' : 'Omstander');
  const geef  = (itemId, charId = speler, qty = 1) =>
    req(server, 'PUT', `/api/items/${itemId}/owner`,
      { characterId: charId, playerName: naamVan(charId), qty }, dm);
  const bezit = async (itemId) => {
    const b = (await req(server, 'GET', `/api/items/${itemId}/bezit`, null, dm)).body;
    return (b.groepen || []).flatMap(x => x.rijen || []);
  };

  it('geneest met een worp, en telt niet boven het maximum', async () => {
    await geef(drankje, speler, 2);
    await zetHp(5, 20);

    const r = await req(server, 'POST', `/api/items/${drankje}/gebruik`, {}, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    // 2d4+2 ligt tussen 4 en 10.
    assert.ok(r.body.hp.current >= 9 && r.body.hp.current <= 15,
      '5 HP plus 2d4+2 ligt tussen 9 en 15, kreeg ' + r.body.hp.current);
    assert.strictEqual((await hpVan()).current, r.body.hp.current, 'en het staat op zijn kaartje');

    await zetHp(19, 20);
    const bijna = await req(server, 'POST', `/api/items/${drankje}/gebruik`, {}, spelerC);
    assert.strictEqual(bijna.body.hp.current, 20, 'nooit boven het maximum');
  });

  it('haalt er één van de stapel af bij een drankje', async () => {
    await geef(drankje, speler, 3);
    const voor = (await bezit(drankje)).find(r => r.characterId === speler)?.aantal;
    await zetHp(5, 20);
    const r = await req(server, 'POST', `/api/items/${drankje}/gebruik`, {}, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const na = (await bezit(drankje)).find(r => r.characterId === speler)?.aantal;
    assert.strictEqual(na, voor - 1, `van ${voor} naar ${voor - 1}`);
  });

  it('schrijft bij een staf een charge af en niet het voorwerp', async () => {
    await geef(staf);
    await zetHp(1, 20);

    const r = await req(server, 'POST', `/api/items/${staf}/gebruik`, {}, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.maxCharges, 3);
    assert.strictEqual(r.body.charges, 2, 'er gaat er één af');
    assert.ok(!r.body.weg, 'de staf blijft — alleen een charge gaat eraf');
    assert.ok((await bezit(staf)).some(x => x.characterId === speler), 'en hij heeft hem nog');
  });

  it('weigert zodra de charges op zijn', async () => {
    await zetHp(1, 20);
    await req(server, 'POST', `/api/items/${staf}/gebruik`, {}, spelerC);
    await req(server, 'POST', `/api/items/${staf}/gebruik`, {}, spelerC);
    const leeg = await req(server, 'POST', `/api/items/${staf}/gebruik`, {}, spelerC);
    assert.strictEqual(leeg.status, 409, JSON.stringify(leeg.body));
    assert.match(String(leeg.body?.error || ''), /charges zijn op/i);
  });

  it('laat een speler niets gebruiken wat hij niet heeft', async () => {
    const eigen = (await req(server, 'POST', '/api/entities/voorwerpen', {
      name: 'Elixer van een ander', data: { itemType: 'Potion', healing: '1d4', verbruikt: true },
    }, dm)).body.id;
    await geef(eigen, vreemde, 1);

    const r = await req(server, 'POST', `/api/items/${eigen}/gebruik`, {}, spelerC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
    assert.match(String(r.body?.error || ''), /heb je niet/i);
  });

  it('geneest niets met een voorwerp dat niet geneest', async () => {
    const steen = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Gladde steen', data: { itemType: 'Wondrous Item' } }, dm)).body.id;
    await geef(steen);
    const r = await req(server, 'POST', `/api/items/${steen}/gebruik`, {}, spelerC);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
    assert.match(String(r.body?.error || ''), /geneest niets/i);
  });

  it('laat de DM het namens een speler doen', async () => {
    await geef(drankje, vreemde, 1);
    await req(server, 'PATCH', `/api/player-hp/${vreemde}`, { current: 2, max: 20 }, dm);
    const r = await req(server, 'POST', `/api/items/${drankje}/gebruik`,
      { characterId: vreemde }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok((await hpVan(vreemde)).current > 2, 'de ander is genezen');
  });

  it('geeft een voorwerp door binnen de party', async () => {
    await geef(staf, speler);
    const r = await req(server, 'POST', `/api/items/${staf}/geef`, { targetId: vreemde }, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const rijen = await bezit(staf);
    assert.ok(rijen.some(x => x.characterId === vreemde), 'de ander heeft hem nu');
    assert.ok(!rijen.some(x => x.characterId === speler), 'en de gever niet meer');
  });

  it('geeft niets aan zichzelf en niets wat je niet hebt', async () => {
    const aanZichzelf = await req(server, 'POST', `/api/items/${staf}/geef`,
      { targetId: speler }, spelerC);
    assert.notStrictEqual(aanZichzelf.status, 200, 'aan jezelf geven slaat nergens op');

    const nietVanMij = await req(server, 'POST', `/api/items/${staf}/geef`,
      { targetId: vreemde }, spelerC);
    assert.strictEqual(nietVanMij.status, 403, 'je geeft niet weg wat je niet hebt');
  });

  it('stopt met geven als de DM ruilen uitzet', async () => {
    await geef(drankje, speler, 2);
    const uit = await req(server, 'PUT', '/api/items/trade-allowed',
      { groupId: gid, allowed: false }, dm);
    assert.strictEqual(uit.status, 200, JSON.stringify(uit.body));

    const r = await req(server, 'POST', `/api/items/${drankje}/geef`, { targetId: vreemde }, spelerC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));

    await req(server, 'PUT', '/api/items/trade-allowed', { groupId: gid, allowed: true }, dm);
  });
});
