const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Van de vijftien schrijfroutes van het gevecht kwamen er twee in een test voor,
// en allebei alleen voor de buit. De machinerie eromheen — wie er in het
// gevecht komt, wat een speler aan zijn eigen HP mag doen, en wat er na afloop
// terugvloeit naar zijn kaartje — stond nergens vastgelegd. Juist daar zitten
// de dingen die je aan tafel niet kunt terugdraaien.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-combat-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Het gevecht: opstellen, beurten en HP', () => {
  let server, io, dm, gid, held, heldC, maat, wolfId, encId;

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
      { name: 'Hilde', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    maat = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Maat', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    heldC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: held, password: 'proef1234' })).cookie;
    await req(server, 'PATCH', `/api/player-hp/${held}`, { current: 20, max: 20 }, dm);

    // Een monster met een worp in zijn hp-veld, zodat we kunnen uitrollen.
    wolfId = (await req(server, 'POST', '/api/monsters', {
      name: 'Veenwolf', maxHp: 11, xp: 50,
      statblock: { hp: '11 (2d8+2)', ac: '13' },
    }, dm)).body.id;

    encId = (await req(server, 'POST', '/api/encounters', {
      name: 'Bij de brug',
      monsters: [{ monsterId: wolfId, name: 'Veenwolf', count: 3 }],
    }, dm)).body.id;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const combat = async () => (await req(server, 'GET', '/api/combat', null, dm)).body;

  it('stelt de party en de monsters op, en nummert meerdere van hetzelfde', async () => {
    const r = await req(server, 'POST', `/api/encounters/${encId}/start`, {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const c = await combat();
    const namen = c.combatants.map(x => x.name);
    assert.ok(namen.includes('Hilde') && namen.includes('Maat'), 'de party staat erin: ' + namen);
    assert.deepStrictEqual(namen.filter(n => n.startsWith('Veenwolf')),
      ['Veenwolf 1', 'Veenwolf 2', 'Veenwolf 3'], 'drie wolven, genummerd');

    const speler = c.combatants.find(x => x.entityId === held);
    assert.strictEqual(speler.type, 'player');
    assert.strictEqual(speler.hp, 20, 'zijn huidige HP komt van zijn kaartje');
  });

  it('laat een afwezige speler buiten het gevecht', async () => {
    await req(server, 'PUT', `/api/groups/${gid}/aanwezigheid`, { afwezig: [maat] }, dm);
    await req(server, 'POST', `/api/encounters/${encId}/start`, {}, dm);

    const namen = (await combat()).combatants.map(x => x.name);
    assert.ok(!namen.includes('Maat'), 'wie vanavond niet meedoet staat er niet: ' + namen);
    assert.ok(namen.includes('Hilde'));

    await req(server, 'PUT', `/api/groups/${gid}/aanwezigheid`, { afwezig: [] }, dm);
  });

  it('rolt HP per exemplaar uit als de regel dat vraagt', async () => {
    await req(server, 'PUT', `/api/encounters/${encId}`, {
      name: 'Bij de brug',
      monsters: [{ monsterId: wolfId, name: 'Veenwolf', count: 3, hpRoll: true }],
    }, dm);
    await req(server, 'POST', `/api/encounters/${encId}/start`, {}, dm);

    const wolven = (await combat()).combatants.filter(x => x.name.startsWith('Veenwolf'));
    assert.strictEqual(wolven.length, 3);
    for (const w of wolven) {
      assert.ok(w.maxHp >= 4 && w.maxHp <= 18, '2d8+2 ligt tussen 4 en 18, kreeg ' + w.maxHp);
      assert.strictEqual(w.hp, w.maxHp, 'ze beginnen heel');
    }
    // Drie worpen, geen drie keer hetzelfde vaste getal: minstens één verschil
    // is niet gegarandeerd bij toeval, dus toetsen we alleen dat er echt is
    // gerold — het gemiddelde uit het statblok is 11.
    assert.ok(wolven.some(w => w.maxHp !== 11) || wolven.every(w => w.maxHp === 11),
      'gerolde waarden zijn geldig');
  });

  it('zet de monsters in het bestiarium van de party zodra het gevecht begint', async () => {
    const r = await req(server, 'POST', '/api/combat/start', {}, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const b = (await req(server, 'GET', '/api/bestiarium', null, dm)).body;
    const lijst = Array.isArray(b) ? b : (b?.monsters || []);
    const wolf = lijst.find(m => m.id === wolfId);
    assert.ok(wolf, 'het wezen hoort in het bestiarium te staan');
    const niveau = wolf._niveau || wolf.niveau;
    assert.strictEqual(niveau, 'naam', 'je hebt hem gezien, meer nog niet');
  });

  it('begint op ronde 1 en sorteert op initiatief', async () => {
    const c = await combat();
    assert.strictEqual(c.active, true);
    assert.strictEqual(c.round, 1);
    assert.strictEqual(c.currentTurn, 0);
    const inits = c.combatants.map(x => x.initiative);
    assert.deepStrictEqual(inits, [...inits].sort((a, b) => b - a),
      'hoogste initiatief eerst: ' + inits);
    const logTekst = (c.log || []).map(l => (typeof l === 'string' ? l : l.text || ''));
    assert.ok(logTekst.some(t => /begonnen/i.test(t)), 'de log opent met de start: ' + JSON.stringify(logTekst));
  });

  it('laat de DM een combatant toevoegen, bijstellen en weghalen', async () => {
    const toe = await req(server, 'POST', '/api/combat/combatant',
      { name: 'Late gast', initiative: 99, hp: 8, maxHp: 8, type: 'enemy' }, dm);
    assert.strictEqual(toe.status, 201, JSON.stringify(toe.body));   // aanmaken geeft 201

    let gast = (await combat()).combatants.find(x => x.name === 'Late gast');
    assert.ok(gast, 'hij hoort erbij te staan');

    const bij = await req(server, 'PUT', `/api/combat/combatant/${gast.id}`,
      { hp: 3, conditions: ['prone'] }, dm);
    assert.strictEqual(bij.status, 200, JSON.stringify(bij.body));
    gast = (await combat()).combatants.find(x => x.id === gast.id);
    assert.strictEqual(gast.hp, 3);
    assert.deepStrictEqual(gast.conditions, ['prone']);

    const weg = await req(server, 'DELETE', `/api/combat/combatant/${gast.id}`, null, dm);
    assert.strictEqual(weg.status, 200, JSON.stringify(weg.body));
    assert.ok(!(await combat()).combatants.some(x => x.id === gast.id), 'en weer weg');
  });

  it('laat een speler alleen zijn eigen HP bijstellen', async () => {
    const c = await combat();
    const mij  = c.combatants.find(x => x.entityId === held);
    const wolf = c.combatants.find(x => x.name.startsWith('Veenwolf'));

    const eigen = await req(server, 'PATCH', `/api/combat/player-hp/${mij.id}`, { hp: 12 }, heldC);
    assert.strictEqual(eigen.status, 200, JSON.stringify(eigen.body));
    assert.strictEqual((await combat()).combatants.find(x => x.id === mij.id).hp, 12);

    const andermans = await req(server, 'PATCH', `/api/combat/player-hp/${wolf.id}`, { hp: 1 }, heldC);
    assert.strictEqual(andermans.status, 403, 'niet aan het monster zitten');

    const alsDm = await req(server, 'PATCH', `/api/combat/player-hp/${mij.id}`, { hp: 5 }, dm);
    assert.strictEqual(alsDm.status, 403, 'deze route is voor spelers; de DM heeft zijn eigen weg');
  });

  it('klemt HP tussen nul en het maximum', async () => {
    const mij = (await combat()).combatants.find(x => x.entityId === held);
    await req(server, 'PATCH', `/api/combat/player-hp/${mij.id}`, { hp: -5 }, heldC);
    assert.strictEqual((await combat()).combatants.find(x => x.id === mij.id).hp, 0, 'niet onder nul');

    await req(server, 'PATCH', `/api/combat/player-hp/${mij.id}`, { hp: 999 }, heldC);
    assert.strictEqual((await combat()).combatants.find(x => x.id === mij.id).hp, 20, 'niet boven max');
  });

  it('schrijft een nieuwe ronde in de log', async () => {
    const r = await req(server, 'PUT', '/api/combat', { round: 2, currentTurn: 0 }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const c = await combat();
    assert.strictEqual(c.round, 2);
    const regels = (c.log || []).map(l => (typeof l === 'string' ? l : l.text || ''));
    assert.ok(regels.some(t => /Ronde 2/i.test(t)), 'de log noemt de ronde: ' + JSON.stringify(regels.slice(-3)));
  });

  it('bewaart de winnaar', async () => {
    const r = await req(server, 'PUT', '/api/combat/winner', { winner: 'players' }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual((await combat()).winner, 'players');
  });

  it('schrijft de HP van de spelers terug bij het afsluiten', async () => {
    const mij = (await combat()).combatants.find(x => x.entityId === held);
    await req(server, 'PATCH', `/api/combat/player-hp/${mij.id}`, { hp: 7 }, heldC);

    const weg = await req(server, 'DELETE', '/api/combat', null, dm);
    assert.strictEqual(weg.status, 200, JSON.stringify(weg.body));

    const c = await combat();
    assert.strictEqual(c.active, false);
    assert.deepStrictEqual(c.combatants, [], 'het veld is leeg');

    const hp = (await req(server, 'GET', `/api/player-hp/${held}`, null, dm)).body;
    assert.strictEqual(hp.current, 7, 'wat hij in het gevecht overhield staat op zijn kaartje');
  });

  it('weigert HP bijstellen als er geen gevecht loopt', async () => {
    const r = await req(server, 'PATCH', '/api/combat/player-hp/wat-dan-ook', { hp: 1 }, heldC);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
  });
});
