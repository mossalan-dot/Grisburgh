const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De laatste twee diensten zonder enkele test. Allebei hebben ze een regel die
// je maar één keer per iets mag gebruiken — Ursula één voorspelling per akte
// per party, de Magizoöloog één onderzoek per cooldown — en dat is precies wat
// je niet met de hand blijft narekenen.
function maakReq(server) {
  return (method, p, body, cookie) => new Promise((resolve, reject) => {
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

async function startServer(naam) {
  const dir = path.join(os.tmpdir(), `grisburgh-test-${naam}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  process.env.GRISBURGH_DATA_DIR = dir;
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
  const mod = require('../server');
  await new Promise(r => mod.server.listen(0, r));
  return { ...mod, dir, req: maakReq(mod.server) };
}

describe('Madame Ursula: één voorspelling per akte', () => {
  let s, req, dm, gid, speler, spelerC;

  before(async () => {
    s = await startServer('ursula'); req = s.req;
    dm = (await req('POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const groepen = (await req('GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req('PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    speler = (await req('POST', '/api/entities/personages',
      { name: 'Vraagsteller', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req('POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;
    await req('PATCH', `/api/player-currency/${speler}`, { fl: 200, kn: 0, cl: 0 }, dm);

    await req('PUT', '/api/meta/ursula', { naam: 'Madame Proef', prijs: { fl: 20 } }, dm);
    // Twee aktes: ze voorspelt over de eerstvolgende, dus er moet er een ná de
    // lopende zijn.
    await req('PUT', '/api/meta/hoofdstuk/akte1', { num: 1, title: 'Nu' }, dm);
    await req('PUT', '/api/meta/hoofdstuk/akte2', { num: 2, title: 'Straks' }, dm);
    await req('POST', '/api/akte/actief', { key: 'akte1', num: 1, title: 'Nu', groupId: gid }, dm);
  });

  after(async () => {
    await s.io.close();
    await new Promise(r => s.server.close(r));
    fs.rmSync(s.dir, { recursive: true, force: true });
  });

  const vraag = () => req('POST', '/api/ursula/voorspel', {}, spelerC);

  it('toont niets zolang de DM niets geschreven heeft', async () => {
    const r = await vraag();
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
    assert.match(String(r.body?.error || ''), /nevelen tonen niets/i);
  });

  it('voorspelt over de vólgende akte, niet de lopende', async () => {
    const zet = await req('PUT', '/api/ursula/voorspelling/akte2', {
      zien: 'Een deur die niet dicht wil.',
      horen: 'Water onder de vloer.',
      ruiken: 'Natte wol.',
      proeven: 'IJzer.',
      voelen: 'Tocht uit een muur.',
      concreet: 'Iemand liegt over de sleutel.',
    }, dm);
    assert.strictEqual(zet.status, 200, JSON.stringify(zet.body));

    const r = await vraag();
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.roll >= 1 && r.body.roll <= 6, 'een d6: ' + r.body.roll);

    // Zoals de hulptekst het belooft: op 1–5 één zintuig, op een 6 alle vijf.
    // De code onthulde er eerst `roll`, waarmee een 5 bijna net zo goed was als
    // een 6 — dat is 21 sep 2026 rechtgezet.
    const aantal = (r.body.onthuld?.zintuigen || []).length;
    assert.strictEqual(aantal, r.body.roll === 6 ? 5 : 1,
      `bij worp ${r.body.roll} hoort/horen er ${r.body.roll === 6 ? 5 : 1} open te gaan`);
    assert.ok(r.body.onthuld.zintuigen.every(z => z.label && z.tekst),
      'elk onthuld zintuig heeft een label en de tekst van de DM');
    if (r.body.roll === 6) {
      assert.strictEqual(r.body.onthuld.concreet, 'Iemand liegt over de sleutel.',
        'alleen op een 6 komt de concrete regel erbij');
    }
  });

  it('geeft er maar één per akte, aan de hele party', async () => {
    const nogEens = await vraag();
    assert.strictEqual(nogEens.status, 400, JSON.stringify(nogEens.body));
    assert.match(String(nogEens.body?.error || ''), /al ontvangen/i);
  });

  it('kost geld — en die betaling gaat niet twee keer', async () => {
    const beurs = (await req('GET', `/api/player-currency/${speler}`, null, dm)).body;
    const alsCl = (c) => (c.fl || 0) * 100 + (c.kn || 0) * 10 + (c.cl || 0);
    assert.strictEqual(alsCl(beurs), 20000 - 2000, 'één keer 20 fl, ook na de tweede poging');
  });

  it('laat de DM hem opnieuw vrijgeven', async () => {
    const reset = await req('POST', '/api/ursula/reset', { akteKey: 'akte2' }, dm);
    assert.strictEqual(reset.status, 200, JSON.stringify(reset.body));
    const r = await vraag();
    assert.strictEqual(r.status, 200, 'na een reset mag het weer: ' + JSON.stringify(r.body));
  });

  it('heeft niets te voorzien als er geen volgende akte is', async () => {
    await req('POST', '/api/akte/actief', { key: 'akte2', num: 2, title: 'Straks', groupId: gid }, dm);
    const r = await vraag();
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
    assert.match(String(r.body?.error || ''), /geen komende akte/i);
  });
});

describe('De Magizoöloog: onderzoek en adoptie', () => {
  let s, req, dm, gid, speler, spelerC, monsterId, dier;

  const alsCl = (c) => (c?.fl || 0) * 100 + (c?.kn || 0) * 10 + (c?.cl || 0);

  before(async () => {
    s = await startServer('magizoo'); req = s.req;
    dm = (await req('POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const groepen = (await req('GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req('PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    speler = (await req('POST', '/api/entities/personages',
      { name: 'Onderzoeker', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req('POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;
    await req('PATCH', `/api/player-currency/${speler}`, { fl: 300, kn: 0, cl: 0 }, dm);

    // Cooldown op nul: die willen we hier niet testen maar wel kunnen doorlopen.
    await req('PUT', '/api/meta/magizoo', {
      naam: 'De Proefzoöloog', prijs: { fl: 25 }, prijsVolledig: { fl: 60 }, cooldownMinuten: 0,
    }, dm);

    monsterId = (await req('POST', '/api/monsters',
      { name: 'Veenhagedis', maxHp: 14, roddel: 'Hij schuwt vuur.' }, dm)).body.id;
    dier = (await req('POST', '/api/entities/personages', {
      name: 'Pluis', subtype: 'dier', data: { adopteerbaar: true, adoptiePrijsFl: 15 },
    }, dm)).body.id;
  });

  after(async () => {
    await s.io.close();
    await new Promise(r => s.server.close(r));
    fs.rmSync(s.dir, { recursive: true, force: true });
  });

  const onderzoek = (modus) => req('POST', '/api/magizoo/onderzoek', { monsterId, modus }, spelerC);
  const niveau = async () => {
    const b = (await req('GET', '/api/bestiarium', null, dm)).body;
    const lijst = Array.isArray(b) ? b : (b?.monsters || []);
    return (lijst.find(m => m.id === monsterId) || {})._niveau
        || (lijst.find(m => m.id === monsterId) || {}).niveau || null;
  };

  it('onderzoekt alleen wezens die de party al ontdekt heeft', async () => {
    const r = await onderzoek('stap');
    assert.strictEqual(r.status, 404, JSON.stringify(r.body));
    assert.match(String(r.body?.error || ''), /nog niet ontdekt/i);
  });

  it('tilt het kennisniveau één stap omhoog en onthult de roddel', async () => {
    await req('PUT', `/api/bestiarium/${monsterId}`, { niveau: 'naam' }, dm);
    const voor = alsCl((await req('GET', `/api/player-currency/${speler}`, null, dm)).body);

    const r = await onderzoek('stap');
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.niveau, 'deels', 'naam → deels');
    assert.strictEqual(r.body.roddel, 'Hij schuwt vuur.', 'bij deels komt de roddel vrij');

    const na = alsCl((await req('GET', `/api/player-currency/${speler}`, null, dm)).body);
    assert.strictEqual(voor - na, 2500, 'de stapprijs van 25 fl');
  });

  it('kost meer als je meteen alles wilt weten', async () => {
    const voor = alsCl((await req('GET', `/api/player-currency/${speler}`, null, dm)).body);
    const r = await onderzoek('volledig');
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.niveau, 'volledig');
    const na = alsCl((await req('GET', `/api/player-currency/${speler}`, null, dm)).body);
    assert.strictEqual(voor - na, 6000, 'de volledig-prijs van 60 fl');
  });

  it('doet niets meer aan een wezen dat al volledig bekend is', async () => {
    const r = await onderzoek('stap');
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
    assert.match(String(r.body?.error || ''), /al volledig/i);
  });

  it('adopteert een dier, maar één per party', async () => {
    const voor = alsCl((await req('GET', `/api/player-currency/${speler}`, null, dm)).body);
    const r = await req('POST', '/api/magizoo/adopteer', { petId: dier }, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const na = alsCl((await req('GET', `/api/player-currency/${speler}`, null, dm)).body);
    assert.strictEqual(voor - na, 1500, 'de adoptieprijs van 15 fl');

    const comps = (await req('GET', '/api/companions', null, spelerC)).body;
    assert.ok(comps.some(c => c.id === dier), 'het dier hoort bij de party te lopen');

    const tweede = (await req('POST', '/api/entities/personages', {
      name: 'Snor', subtype: 'dier', data: { adopteerbaar: true, adoptiePrijsFl: 5 },
    }, dm)).body.id;
    const nogEens = await req('POST', '/api/magizoo/adopteer', { petId: tweede }, spelerC);
    assert.strictEqual(nogEens.status, 400, 'één huisdier per party');
  });

  it('weigert een dier dat niet ter adoptie staat', async () => {
    const wild = (await req('POST', '/api/entities/personages',
      { name: 'Wilde wolf', subtype: 'dier' }, dm)).body.id;
    const r = await req('POST', '/api/magizoo/adopteer', { petId: wild }, spelerC);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
    assert.match(String(r.body?.error || ''), /niet ter adoptie/i);
  });
});
