const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// ════════════════════════════════════════════════════════════════════════════
//  EEN PERSONAGE MAKEN
// ════════════════════════════════════════════════════════════════════════════
// Een speler mocht zijn blad al bijwerken maar het kaartje niet aanmaken, dus
// stond een nieuwe speler niet in de inloglijst en kwam hij nergens binnen.
// Nu maakt hij een **concept** met het partywachtwoord, en de DM gunt het.
//
// Het concept is bewust géén kaartje: pas bij het gunnen ontstaan de entity,
// het profiel en de HP. Daar gaan de meeste asserts hieronder over.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-pers-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Een personage maken', () => {
  let server, io, dm, groepId;
  const dmState = () => JSON.parse(fs.readFileSync(
    path.join(DATA_DIR, 'campaigns', 'grisburgh', 'dm-state.json'), 'utf8'));
  const entities = () => JSON.parse(fs.readFileSync(
    path.join(DATA_DIR, 'campaigns', 'grisburgh', 'entities.json'), 'utf8'));

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    assert.ok(dm);
    const groepen = await req(server, 'GET', '/api/groups', null, dm);
    groepId = (groepen.body.groups || groepen.body)[0].id;
    await req(server, 'PUT', `/api/groups/${groepId}/password`, { password: 'rinkeldekink' }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('weigert een concept zonder het partywachtwoord', async () => {
    const r = await req(server, 'POST', '/api/personage-concept', { wachtwoord: 'raden-maar' });
    assert.equal(r.status, 401);
  });

  it('loopt van wachtwoord tot kaartje', async () => {
    // ── de speler ──────────────────────────────────────────────────────────
    const start = await req(server, 'POST', '/api/personage-concept',
      { wachtwoord: 'rinkeldekink', naam: 'Brigitta Veenstra' });
    assert.equal(start.status, 200, JSON.stringify(start.body));
    const speler = start.cookie;
    const id = start.body.concept.id;
    assert.equal(start.body.concept.groep, groepId, 'hij hoort bij de party van het wachtwoord');
    assert.ok(start.body.bronnen.klassen.length >= 12, 'de wizard krijgt de classes mee');
    assert.ok(start.body.bronnen.backgrounds.length >= 10, 'en de backgrounds');

    // Het is nog géén kaartje — dat is de hele opzet.
    assert.equal((entities().personages || []).some(e => e.name === 'Brigitta Veenstra'), false);

    const gevuld = await req(server, 'PATCH', `/api/personage-concept/${id}`, {
      species: 'Dwarf', klasse: 'Cleric', background: 'Acolyte', level: 1, methode: 'array',
      scores: { str: 13, dex: 12, con: 14, int: 10, wis: 15, cha: 8 },
      bgBonus: { wis: 2, con: 1 },
      skills: ['Medicine', 'History'],
    }, speler);
    assert.equal(gevuld.status, 200, JSON.stringify(gevuld.body));
    assert.equal(gevuld.body.profiel.wis, 17, 'de background legt er +2 bovenop');
    assert.equal(gevuld.body.profiel.saveProfs, 'wis,cha', 'de saves komen uit de class');
    assert.match(gevuld.body.profiel.skillProfs, /religion/, 'en de skills van de background');
    assert.equal(gevuld.body.nakijk.kanWeg, true);

    const ingediend = await req(server, 'POST', `/api/personage-concept/${id}/indienen`, null, speler);
    assert.equal(ingediend.status, 200, JSON.stringify(ingediend.body));
    assert.equal(ingediend.body.concept.status, 'wacht');

    // ── de DM ──────────────────────────────────────────────────────────────
    const open = await req(server, 'GET', '/api/personage-concepten', null, dm);
    assert.equal(open.body.concepten.length, 1);
    assert.equal(open.body.concepten[0].concept.naam, 'Brigitta Veenstra');

    const gegund = await req(server, 'POST', `/api/personage-concept/${id}/gunnen`, null, dm);
    assert.equal(gegund.status, 200, JSON.stringify(gegund.body));
    const eid = gegund.body.entityId;

    const kaartje = (entities().personages || []).find(e => e.id === eid);
    assert.ok(kaartje, 'nu pas is er een kaartje');
    assert.equal(kaartje.subtype, 'speler', 'anders staat hij niet in de inloglijst');
    assert.equal(kaartje.data.groep, groepId);
    assert.equal(kaartje.data.klasse, 'Cleric');

    const st = dmState();
    assert.equal(st.playerProfiles[eid].klasse, 'Cleric');
    assert.equal(st.playerProfiles[eid].hitDie, '1d8');
    // d8 + CON 15 (+2) = 10
    assert.deepEqual(st.playerHp[eid], { current: 10, max: 10 });
    assert.equal(st.conceptPersonages[id].status, 'gegund');
  });

  it('stuurt een concept terug met een reden, en dan mag je verder', async () => {
    const start = await req(server, 'POST', '/api/personage-concept',
      { wachtwoord: 'rinkeldekink', naam: 'Krelis' });
    const speler = start.cookie;
    const id = start.body.concept.id;
    await req(server, 'PATCH', `/api/personage-concept/${id}`,
      { species: 'Human', klasse: 'Fighter', background: 'Soldier',
        scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } }, speler);
    await req(server, 'POST', `/api/personage-concept/${id}/indienen`, null, speler);

    const terug = await req(server, 'POST', `/api/personage-concept/${id}/terug`,
      { reden: 'We spelen zonder Fighters deze keer.' }, dm);
    assert.equal(terug.status, 200);
    assert.equal(dmState().conceptPersonages[id].status, 'terug');
    assert.match(dmState().conceptPersonages[id].reden, /zonder Fighters/);
    assert.equal((entities().personages || []).some(e => e.name === 'Krelis'), false, 'geen half kaartje');

    // Eraan verder werken haalt hem uit de wachtkamer.
    const verder = await req(server, 'PATCH', `/api/personage-concept/${id}`, { klasse: 'Ranger' }, speler);
    assert.equal(verder.body.concept.status, 'bezig');
  });

  it('laat een ander niet aan jouw concept zitten', async () => {
    const mijn = await req(server, 'POST', '/api/personage-concept', { wachtwoord: 'rinkeldekink', naam: 'Pelle' });
    const ander = await req(server, 'POST', '/api/personage-concept', { wachtwoord: 'rinkeldekink', naam: 'Aafke' });
    const r = await req(server, 'PATCH', `/api/personage-concept/${mijn.body.concept.id}`,
      { naam: 'Gekaapt' }, ander.cookie);
    assert.equal(r.status, 403);
  });

  it('zegt wat er nog mist in plaats van het tegen te houden', async () => {
    const start = await req(server, 'POST', '/api/personage-concept', { wachtwoord: 'rinkeldekink' });
    const id = start.body.concept.id;
    const r = await req(server, 'POST', `/api/personage-concept/${id}/indienen`, null, start.cookie);
    assert.equal(r.status, 400);
    assert.match(r.body.error, /naam/i, 'zonder naam gaat hij niet weg');

    // Een class die te weinig skills heeft is een opmerking, geen blokkade.
    await req(server, 'PATCH', `/api/personage-concept/${id}`,
      { naam: 'Teun', species: 'Human', klasse: 'Rogue', skills: [],
        scores: { str: 10, dex: 15, con: 12, int: 13, wis: 10, cha: 14 } }, start.cookie);
    const tweede = await req(server, 'POST', `/api/personage-concept/${id}/indienen`, null, start.cookie);
    assert.equal(tweede.status, 200, 'hij mag weg');
    assert.ok(tweede.body.nakijk.opmerkingen.some(o => /skills/i.test(o)), 'maar de DM leest het');
  });

  it('kent de instellingen van de DM', async () => {
    const r = await req(server, 'PUT', '/api/meta/personage-maken',
      { aan: true, methodes: ['array', 'pointbuy'], maxLevel: 3, trinketTafel: 'Rommel' }, dm);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.methodes, ['array', 'pointbuy']);
    assert.equal(r.body.maxLevel, 3);

    const start = await req(server, 'POST', '/api/personage-concept', { wachtwoord: 'rinkeldekink', naam: 'Mees' });
    assert.deepEqual(start.body.instellingen.methodes, ['array', 'pointbuy']);

    // Uitgezet betekent uitgezet.
    await req(server, 'PUT', '/api/meta/personage-maken', { aan: false }, dm);
    const nee = await req(server, 'POST', '/api/personage-concept', { wachtwoord: 'rinkeldekink' });
    assert.equal(nee.status, 403);
    await req(server, 'PUT', '/api/meta/personage-maken', { aan: true, maxLevel: 1 }, dm);
  });
});
