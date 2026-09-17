const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Een level-up was tot 17 sep 2026 "een getal overtypen": de speler rekende zijn
// eigen HP uit. Dat is de enige plek waar dat mocht — bij Hit Dice en genezende
// voorwerpen rekent de server. Deze tests leggen vast wat de route wél doet:
// de drie manieren van HP bepalen, de poort van de DM-instelling, het tegoed,
// en dat terugdraaien de HP écht weer weghaalt.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-levelup-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Level omhoog', () => {
  let server, io, dm, speler, charId, gid;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const ent = (await req(server, 'POST', '/api/entities/personages', { name: 'Proefheld', subtype: 'speler' }, dm)).body;
    charId = ent.id;
    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    await req(server, 'PATCH', `/api/entities/personages/${charId}`, { data: { groep: gid } }, dm);
    speler = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: charId, password: 'proef1234' })).cookie;

    // Fighter 4, CON 14 (+2), 30 HP. Hit die d10 → gemiddelde 6, +2 CON = 8.
    await req(server, 'PATCH', `/api/player-profile/${charId}`,
      { klasse: 'Fighter', level: '4', klasseLevel: '4', con: '14' }, dm);
    await req(server, 'PATCH', `/api/player-hp/${charId}`, { current: 30, max: 30 }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const stand = async () => (await req(server, 'GET', `/api/characters/${charId}/level-up`, null, dm)).body;
  const hp    = async () => (await req(server, 'GET', `/api/player-hp/${charId}`, null, dm)).body;

  it('rekent het gemiddelde voor: (d10/2)+1 plus CON', async () => {
    const s = await stand();
    assert.strictEqual(s.klassen[0].die, 10);
    assert.strictEqual(s.conMod, 2);
    assert.strictEqual(s.klassen[0].gemiddelde, 8, 'd10 → 6, +2 CON = 8');
  });

  it('telt de HP erbij en verhoogt level én klasselevel', async () => {
    const r = await req(server, 'POST', `/api/characters/${charId}/level-up`,
      { hpMethode: 'gemiddelde' }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.level, 5);
    assert.strictEqual(r.body.levelUp.hp, 8);
    const h = await hp();
    assert.strictEqual(h.max, 38, 'maximum omhoog');
    assert.strictEqual(h.current, 38, 'en de genezing loopt mee — je bent niet ineens gewond');
    const p = (await req(server, 'GET', `/api/player-profile/${charId}`, null, dm)).body;
    assert.strictEqual(String(p.klasseLevel), '5', 'het klasselevel loopt mee met het totaal');
  });

  it('draait terug: level, klasselevel én HP gaan weer weg', async () => {
    const r = await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const h = await hp();
    assert.strictEqual(h.max, 30, 'de HP van die level-up hoort er weer af');
    const p = (await req(server, 'GET', `/api/player-profile/${charId}`, null, dm)).body;
    assert.strictEqual(String(p.level), '4');
    assert.strictEqual(String(p.klasseLevel), '4');
    const s = await stand();
    assert.strictEqual(s.geschiedenis.length, 0, 'en de regel is uit de administratie');
  });

  it('weigert een zelfgegooide worp buiten 1..die', async () => {
    for (const worp of [0, 11, 'twaalf']) {
      const r = await req(server, 'POST', `/api/characters/${charId}/level-up`,
        { hpMethode: 'tafel', worp }, dm);
      assert.strictEqual(r.status, 400, `worp ${worp} hoort geweigerd te worden`);
    }
  });

  it('neemt een zelfgegooide worp over zoals hij is', async () => {
    const r = await req(server, 'POST', `/api/characters/${charId}/level-up`,
      { hpMethode: 'tafel', worp: 9 }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.levelUp.worp, 9);
    assert.strictEqual(r.body.levelUp.hp, 11, '9 + 2 CON');
    await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
  });

  it('houdt een uitgezette manier tegen', async () => {
    const z = await req(server, 'PUT', '/api/meta/levelup', { methodes: ['app'] }, dm);
    assert.strictEqual(z.status, 200, JSON.stringify(z.body));
    const r = await req(server, 'POST', `/api/characters/${charId}/level-up`,
      { hpMethode: 'gemiddelde' }, dm);
    assert.strictEqual(r.status, 400, 'het gemiddelde staat uit');
    assert.match(String(r.body?.error || ''), /staat uit/i);

    const ok = await req(server, 'POST', `/api/characters/${charId}/level-up`, { hpMethode: 'app' }, dm);
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
    assert.ok(ok.body.levelUp.worp >= 1 && ok.body.levelUp.worp <= 10, 'de server rolt binnen de die');
    await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
    await req(server, 'PUT', '/api/meta/levelup', { methodes: ['gemiddelde', 'app', 'tafel'] }, dm);
  });

  it('weigert een lege lijst manieren — anders kan niemand meer levelen', async () => {
    const r = await req(server, 'PUT', '/api/meta/levelup', { methodes: [] }, dm);
    assert.strictEqual(r.status, 400);
  });

  it('een speler heeft een tegoed nodig; de DM niet', async () => {
    const zonder = await req(server, 'POST', `/api/characters/${charId}/level-up`,
      { hpMethode: 'gemiddelde' }, speler);
    assert.strictEqual(zonder.status, 409, 'zonder tegoed hoort de speler een 409 te krijgen');

    const gun = await req(server, 'POST', '/api/party/level-up-tegoed', { charIds: [charId] }, dm);
    assert.strictEqual(gun.status, 200, JSON.stringify(gun.body));
    assert.strictEqual((await stand()).tegoed, 1);

    const met = await req(server, 'POST', `/api/characters/${charId}/level-up`,
      { hpMethode: 'gemiddelde' }, speler);
    assert.strictEqual(met.status, 200, JSON.stringify(met.body));
    assert.strictEqual((await stand()).tegoed, 0, 'het tegoed is opgemaakt');
    await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
  });

  it('laat een speler niet levelen namens een ander', async () => {
    const ander = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Iemand anders', subtype: 'speler' }, dm)).body;
    const r = await req(server, 'POST', `/api/characters/${ander.id}/level-up`,
      { hpMethode: 'gemiddelde' }, speler);
    assert.strictEqual(r.status, 403);
  });

  it('kent bij een multiclass twee klassen en verhoogt alleen de gekozene', async () => {
    await req(server, 'PATCH', `/api/player-profile/${charId}`,
      { multiclass: 'true', multiKlasse: 'Wizard', multiKlasseLevel: '2' }, dm);
    const s = await stand();
    assert.strictEqual(s.klassen.length, 2);
    assert.strictEqual(s.klassen[1].die, 6, 'Wizard heeft een d6');

    const r = await req(server, 'POST', `/api/characters/${charId}/level-up`,
      { klasse: 'Wizard', hpMethode: 'gemiddelde' }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.levelUp.hp, 6, 'd6 → 4, +2 CON');
    const p = (await req(server, 'GET', `/api/player-profile/${charId}`, null, dm)).body;
    assert.strictEqual(String(p.multiKlasseLevel), '3', 'de Wizard-helft groeide');
    assert.strictEqual(String(p.klasseLevel), '4', 'de Fighter-helft bleef staan');
    await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
    const na = (await req(server, 'GET', `/api/player-profile/${charId}`, null, dm)).body;
    assert.strictEqual(String(na.multiKlasseLevel), '2', 'en het terugdraaien pakt dezelfde helft');
  });

  it('zegt welke spreuken er te kiezen zijn — cantrip en een nieuw niveau', async () => {
    // Wizard 3 → 4 geeft in de SRD een cantrip erbij; Wizard 4 → 5 opent
    // spreukniveau 3. Twee verschillende soorten keuze, dus allebei gecheckt.
    await req(server, 'PATCH', `/api/player-profile/${charId}`,
      { klasse: 'Wizard', level: '3', klasseLevel: '3', multiclass: 'false', multiKlasse: '' }, dm);
    const a = await req(server, 'POST', `/api/characters/${charId}/level-up`, { hpMethode: 'gemiddelde' }, dm);
    assert.strictEqual(a.status, 200, JSON.stringify(a.body));
    const cantrip = (a.body.kiezen || []).find(k => k.soort === 'cantrip');
    assert.ok(cantrip, 'op Wizard 4 hoort er een cantrip bij te komen: ' + JSON.stringify(a.body.kiezen));
    assert.strictEqual(cantrip.klasse, 'Wizard');

    const b = await req(server, 'POST', `/api/characters/${charId}/level-up`, { hpMethode: 'gemiddelde' }, dm);
    const niveau = (b.body.kiezen || []).find(k => k.soort === 'niveau');
    assert.ok(niveau, 'op Wizard 5 gaat spreukniveau 3 open: ' + JSON.stringify(b.body.kiezen));
    assert.strictEqual(niveau.niveau, 3);

    await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
    await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
  });

  it('geeft een Barbarian niets te kiezen', async () => {
    await req(server, 'PATCH', `/api/player-profile/${charId}`,
      { klasse: 'Barbarian', level: '3', klasseLevel: '3' }, dm);
    const r = await req(server, 'POST', `/api/characters/${charId}/level-up`, { hpMethode: 'gemiddelde' }, dm);
    assert.deepStrictEqual(r.body.kiezen, [], 'een Barbarian casteert niet');
    await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
    await req(server, 'PATCH', `/api/player-profile/${charId}`,
      { klasse: 'Fighter', level: '4', klasseLevel: '4' }, dm);
  });

  it('onthoudt een openstaande spreukkeuze, en ruimt hem op als je kiest', async () => {
    // Zonder dit was de knop in de omslag eenmalig: klik je 'm weg, dan
    // herinnert niets je er ooit nog aan dat je een cantrip te goed hebt.
    await req(server, 'PATCH', `/api/player-profile/${charId}`,
      { klasse: 'Wizard', level: '3', klasseLevel: '3', multiclass: 'false', multiKlasse: '' }, dm);
    const r = await req(server, 'POST', `/api/characters/${charId}/level-up`, { hpMethode: 'gemiddelde' }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    let st = await stand();
    const keuze = (st.openKeuzes || []).find(k => k.soort === 'cantrip');
    assert.ok(keuze, 'de cantripkeuze hoort te blijven staan: ' + JSON.stringify(st.openKeuzes));
    assert.strictEqual(keuze.niveau, 0);

    // Hij blijft ook staan als je de pagina opnieuw opvraagt.
    st = await stand();
    assert.strictEqual((st.openKeuzes || []).length, 1, 'en verdwijnt niet bij het opnieuw ophalen');

    // Zodra de speler een cantrip aanvraagt, ruimt de herinnering zichzelf op —
    // ook al staat de spreuk nog niet in zijn boek (die wacht op de DM).
    const v = await req(server, 'POST', `/api/player-spells/${charId}`,
      { index: 'fire-bolt', name: 'Fire Bolt', level: 0, school: 'Evocation' }, speler);
    assert.strictEqual(v.status, 201, JSON.stringify(v.body));
    st = await stand();
    assert.strictEqual((st.openKeuzes || []).length, 0,
      'een openstaand verzoek telt mee — anders blijft de app zeuren terwijl de speler al gekozen heeft');

    await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
  });

  it('laat een herinnering ook wegklikken', async () => {
    await req(server, 'PATCH', `/api/player-profile/${charId}`,
      { klasse: 'Wizard', level: '3', klasseLevel: '3' }, dm);
    const r = await req(server, 'POST', `/api/characters/${charId}/level-up`, { hpMethode: 'gemiddelde' }, dm);
    const luId = r.body.levelUp.id;
    assert.ok(((await stand()).openKeuzes || []).length >= 1);

    const weg = await req(server, 'POST', `/api/characters/${charId}/level-up/keuze-klaar`,
      { levelUpId: luId, niveau: 0 }, speler);
    assert.strictEqual(weg.status, 200, JSON.stringify(weg.body));
    assert.strictEqual(((await stand()).openKeuzes || []).length, 0);

    // en een tweede keer wegklikken botst niet, maar meldt wel dat er niets staat
    const nog = await req(server, 'POST', `/api/characters/${charId}/level-up/keuze-klaar`,
      { levelUpId: luId, niveau: 7 }, speler);
    assert.strictEqual(nog.status, 404);
    await req(server, 'POST', `/api/characters/${charId}/level-up/undo`, {}, dm);
  });

  it('stopt bij het hoogste level', async () => {
    await req(server, 'PATCH', `/api/player-profile/${charId}`, { level: '20' }, dm);
    const r = await req(server, 'POST', `/api/characters/${charId}/level-up`,
      { hpMethode: 'gemiddelde' }, dm);
    assert.strictEqual(r.status, 409);
    await req(server, 'PATCH', `/api/player-profile/${charId}`, { level: '4' }, dm);
  });
});
