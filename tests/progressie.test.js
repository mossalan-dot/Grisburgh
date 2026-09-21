const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Twee dingen die de DM aan de progressie doet en die je niet vaak genoeg doet
// om ze te onthouden: een eigen vaardigheid toevoegen (met de valkuil dat de
// featbibliotheek niet in de seed zit, dus de eerste eigen feat kon de andere
// 63 wegvagen) en een multiclass-verzoek beoordelen.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-progressie-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Progressie: eigen vaardigheden en multiclassen', () => {
  let server, io, dm, gid, held, heldC, maat;

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

    held = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Wendel', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    maat = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Maat', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    heldC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: held, password: 'proef1234' })).cookie;
    await req(server, 'PATCH', `/api/player-profile/${held}`,
      { klasse: 'Wizard', level: '5', klasseLevel: '5', dex: '16', int: '17', wis: '10' }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const prog = async () => (await req(server, 'GET', '/api/progression', null, dm)).body || {};

  it('levert de meegeleverde klassen en feats', async () => {
    const p = await prog();
    assert.ok(Object.keys(p.classes || {}).length >= 12, 'twaalf klassen uit de seed');
    assert.ok((p.backgrounds && Object.keys(p.backgrounds).length) >= 16, 'zestien backgrounds');
  });

  it('voegt een eigen class feature toe', async () => {
    const r = await req(server, 'POST', '/api/progression/feature', {
      soort: 'class', bron: 'Wizard', level: 3,
      naam: 'Inktgeheugen', desc: 'Je leest een bladzijde terug uit je geheugen.',
      herkomst: 'zelfbedacht',
    }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const p = await prog();
    const lijst = p.classes?.Wizard?.levels?.['3'] || [];
    const mijne = lijst.find(f => f.name === 'Inktgeheugen');
    assert.ok(mijne, 'hij hoort op level 3 van de Wizard te staan: ' + JSON.stringify(lijst.map(f => f.name)));
    assert.strictEqual(mijne.herkomst, 'zelfbedacht');
  });

  // De featbibliotheek zit **niet** in de progressie-seed op de server maar in
  // `render-progressie.js`; daarom stuurt de client hem mee als `seedFeats` bij
  // de eerste eigen feat. Zonder die vangst stond er na één eigen feat nog maar
  // één feat in de campagne — en waren de andere uit de keuzelijst verdwenen.
  it('legt de meegestuurde featbibliotheek één keer vast', async () => {
    assert.strictEqual(((await prog()).feats?.general || []).length, 0,
      'de server levert de bibliotheek zelf niet; die komt van de client');

    const seed = { general: [{ name: 'Alert' }, { name: 'Sentinel' }, { name: 'Tough' }],
                   epic:    [{ name: 'Boon of Speed' }] };
    const r = await req(server, 'POST', '/api/progression/feature', {
      soort: 'feat', naam: 'Grisburghse Gok', desc: 'Eens per dag herrol je een d20.',
      seedFeats: seed,
    }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const na = await prog();
    const namen = (na.feats?.general || []).map(f => f.name || f);
    assert.ok(namen.includes('Grisburghse Gok'), 'de eigen feat staat erbij');
    for (const f of ['Alert', 'Sentinel', 'Tough']) {
      assert.ok(namen.includes(f), `${f} hoort bewaard te zijn: ` + JSON.stringify(namen));
    }
    assert.ok((na.feats?.epic || []).length, 'de Epic Boons ook');
  });

  it('vaagt de bibliotheek niet weg bij een tweede eigen feat', async () => {
    const voor = ((await prog()).feats?.general || []).length;
    // De client stuurt `seedFeats` alleen de eerste keer mee; daarna is het
    // campagnedata en mag een nieuwe feat er niets aan veranderen.
    const r = await req(server, 'POST', '/api/progression/feature',
      { soort: 'feat', naam: 'Tweede eigen feat' }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const namen = ((await prog()).feats?.general || []).map(f => f.name || f);
    assert.strictEqual(namen.length, voor + 1, `${voor} → ${namen.length}`);
    assert.ok(namen.includes('Alert') && namen.includes('Grisburghse Gok'),
      'alles wat er stond staat er nog: ' + JSON.stringify(namen));
  });

  it('haalt een eigen vaardigheid er weer uit', async () => {
    const r = await req(server, 'POST', '/api/progression/feature/verwijderen', {
      soort: 'class', bron: 'Wizard', level: 3, naam: 'Inktgeheugen',
    }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const lijst = (await prog()).classes?.Wizard?.levels?.['3'] || [];
    assert.ok(!lijst.some(f => f.name === 'Inktgeheugen'));
  });

  it('kent geen verzonnen soort', async () => {
    const r = await req(server, 'POST', '/api/progression/feature',
      { soort: 'toverdrank', naam: 'Iets' }, dm);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));

    const zonderNaam = await req(server, 'POST', '/api/progression/feature',
      { soort: 'feat', naam: '  ' }, dm);
    assert.strictEqual(zonderNaam.status, 400);
  });

  it('laat een speler niet aan de progressie komen', async () => {
    const r = await req(server, 'POST', '/api/progression/feature',
      { soort: 'feat', naam: 'Eigen regels' }, heldC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
  });

  // ── Multiclassen ───────────────────────────────────────────────────────────
  it('rekent voor wat een klasse vraagt, maar blokkeert niet', async () => {
    const st = (await req(server, 'GET', `/api/characters/${held}/level-up`, null, heldC)).body;
    const rogue = (st.multiclassOpties || []).find(o => o.klasse === 'Rogue');
    const cleric = (st.multiclassOpties || []).find(o => o.klasse === 'Cleric');
    assert.ok(rogue && cleric, 'alle klassen die hij nog niet heeft staan erbij');
    assert.strictEqual(rogue.voldoet, true, 'DEX 16 is genoeg voor een Rogue');
    assert.strictEqual(cleric.voldoet, false, 'WIS 10 is te weinig voor een Cleric');

    // En toch mag je het vragen: de eis is een aantekening, geen poort.
    const r = await req(server, 'POST', `/api/characters/${held}/multiclass-verzoek`,
      { klasse: 'Cleric' }, heldC);
    assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
  });

  it('staat maar één verzoek tegelijk toe', async () => {
    const r = await req(server, 'POST', `/api/characters/${held}/multiclass-verzoek`,
      { klasse: 'Rogue' }, heldC);
    assert.strictEqual(r.status, 409, JSON.stringify(r.body));
  });

  it('wijst een verzoek af zonder de klasse te zetten', async () => {
    const open = (await req(server, 'GET', '/api/multiclass-verzoeken', null, dm)).body;
    const lijst = Array.isArray(open) ? open : (open?.verzoeken || open?.requests || []);
    const verzoek = lijst.find(v => v.characterId === held);
    assert.ok(verzoek, JSON.stringify(open));

    const r = await req(server, 'POST', `/api/multiclass-verzoek/${verzoek.id}/reject`, {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const p = (await req(server, 'GET', `/api/player-profile/${held}`, null, dm)).body;
    assert.ok(!p.multiKlasse, 'een afgewezen klasse komt niet op het blad');
  });

  it('zet een goedgekeurde klasse op level 0 klaar', async () => {
    await req(server, 'POST', `/api/characters/${held}/multiclass-verzoek`, { klasse: 'Rogue' }, heldC);
    const open = (await req(server, 'GET', '/api/multiclass-verzoeken', null, dm)).body;
    const lijst = Array.isArray(open) ? open : (open?.verzoeken || open?.requests || []);
    const verzoek = lijst.find(v => v.characterId === held && v.status === 'pending');

    const r = await req(server, 'POST', `/api/multiclass-verzoek/${verzoek.id}/approve`, {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const p = (await req(server, 'GET', `/api/player-profile/${held}`, null, dm)).body;
    assert.strictEqual(p.multiKlasse, 'Rogue');
    assert.strictEqual(String(p.multiKlasseLevel), '0',
      'pas bij de volgende level-up krijgt hij zijn eerste level');
    assert.ok(!p.multiSubclass, 'en nog geen subklasse van een vorige poging');
  });

  it('weigert een klasse die hij al heeft, en een derde klasse', async () => {
    const zelfde = await req(server, 'POST', `/api/characters/${held}/multiclass-verzoek`,
      { klasse: 'Wizard' }, heldC);
    assert.strictEqual(zelfde.status, 409, JSON.stringify(zelfde.body));

    const derde = await req(server, 'POST', `/api/characters/${held}/multiclass-verzoek`,
      { klasse: 'Bard' }, heldC);
    assert.strictEqual(derde.status, 409, 'twee klassen is wat het datamodel draagt');
  });

  it('laat een speler niet namens een ander vragen of beslissen', async () => {
    const r = await req(server, 'POST', `/api/characters/${maat}/multiclass-verzoek`,
      { klasse: 'Rogue' }, heldC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));

    const besluit = await req(server, 'POST', '/api/multiclass-verzoek/wat-dan-ook/approve', {}, heldC);
    assert.strictEqual(besluit.status, 403, 'beslissen is DM-werk');
  });

  it('kent geen ander besluit dan goedkeuren of afwijzen', async () => {
    const r = await req(server, 'POST', '/api/multiclass-verzoek/wat-dan-ook/misschien', {}, dm);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
  });
});
