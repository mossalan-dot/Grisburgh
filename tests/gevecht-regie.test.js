const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { io: ioClient } = require('socket.io-client');

// De gevechtsregie: een opening op het tafelscherm, Lair Actions op
// initiative 20, death saves als scène, "How do you want to do this?" na de
// laatste klap, en een afloop. Deze tests bewaken wat er naar welk scherm
// gaat — en vooral wat er níét naar een speler gaat (de Lair Actions).
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-regie-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
function connect(port, cookie) {
  const s = ioClient(`http://localhost:${port}`, { transports: ['polling'], forceNew: true, extraHeaders: { Cookie: cookie } });
  return new Promise((resolve, reject) => { s.on('connect', () => resolve(s)); s.on('connect_error', reject); });
}
function waitFor(socket, event, ms = 1500) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

describe('Gevechtsregie', () => {
  let server, io, port, dm, held, hCookie, ander, aCookie, tafel, spelerSock, anderSock;
  let goblinId, heldCid, encId;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    port = server.address().port;
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const maak = async (name) => (await req(server, 'POST', '/api/entities/personages',
      { name, subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
    held  = await maak('Wilmer Vlasbaard');
    ander = await maak('Rozemarijn Doorn');
    const groups = (await req(server, 'GET', '/api/groups', null, dm)).body.groups || [];
    const pw = groups.find(g => g.id === 'groep1')?.password;
    hCookie = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: held,  password: pw })).cookie;
    aCookie = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: ander, password: pw })).cookie;

    tafel = await connect(port, dm);
    tafel.emit('display:register');
    spelerSock = await connect(port, hCookie);
    anderSock  = await connect(port, aCookie);
    await new Promise(r => setTimeout(r, 150));

    const enc = await req(server, 'POST', '/api/encounters', {
      name: 'Hinderlaag bij de brug',
      monsters: [{ name: 'Goblin', count: 2, initiative: 12, hp: 7 }],
      lair: { regels: ['Het water stijgt tot de knieën', '', 'Stenen vallen van het plafond'] },
    }, dm);
    encId = enc.body.id;
  });

  after(async () => {
    for (const s of [tafel, spelerSock, anderSock]) s?.close();
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('bewaart Lair Actions als regels, zonder lege', async () => {
    const lijst = (await req(server, 'GET', '/api/encounters', null, dm)).body;
    assert.deepStrictEqual(lijst.find(e => e.id === encId).lair.regels,
      ['Het water stijgt tot de knieën', 'Stenen vallen van het plafond']);
  });

  it('de opening gaat naar het tafelscherm, met beide kanten en zonder de encounternaam', async () => {
    await req(server, 'POST', `/api/encounters/${encId}/start`, {}, dm);
    // initiative van de held op 22, zodat de lair ná hem komt (ronde 1, beurt 2)
    let combat = (await req(server, 'GET', '/api/combat', null, dm)).body;
    heldCid = combat.combatants.find(c => c.entityId === held).id;
    await req(server, 'PUT', `/api/combat/combatant/${heldCid}`, { initiative: 22 }, dm);
    const opWacht = waitFor(tafel, 'gevecht:opening');
    const bijSpeler = waitFor(spelerSock, 'gevecht:opening', 500);
    await req(server, 'POST', '/api/combat/start', {}, dm);
    const op = await opWacht;
    assert.ok(op, 'het tafelscherm krijgt de opening');
    assert.ok(op.party.some(p => p.naam === 'Wilmer Vlasbaard'));
    assert.deepStrictEqual(op.vijanden.map(v => [v.naam, v.aantal]), [['Goblin', 2]]);
    assert.strictEqual(op.lair, true);
    assert.ok(!JSON.stringify(op).includes('Hinderlaag'), 'de werktitel van de DM blijft weg');
    assert.strictEqual(await bijSpeler, null, 'de speler krijgt de opening niet op zijn telefoon');
  });

  it('de Lair Actions gaan niet naar een speler', async () => {
    const r = (await req(server, 'GET', '/api/combat', null, hCookie)).body;
    assert.strictEqual(r.lair, undefined);
    assert.strictEqual(r.regie, undefined);
    assert.strictEqual(r.lairAan, true);
    assert.ok(!JSON.stringify(r).includes('Het water stijgt'));
  });

  it('de lair is aan de beurt na wie 20 of hoger gooide, één keer per ronde', async () => {
    let combat = (await req(server, 'GET', '/api/combat', null, dm)).body;
    assert.strictEqual(combat.combatants[0].entityId, held);
    assert.ok(!combat.regie.lairNu, 'beurt 1 is de held, nog geen lair');
    await req(server, 'PUT', '/api/combat', { currentTurn: 1, round: 1 }, dm);
    combat = (await req(server, 'GET', '/api/combat', null, dm)).body;
    assert.strictEqual(combat.regie.lairNu?.ronde, 1);
    // kiezen → naar tafel
    const tafelWacht = waitFor(tafel, 'gevecht:lair');
    const r = await req(server, 'POST', '/api/combat/lair', { index: 1 }, dm);
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await tafelWacht)?.tekst, 'Stenen vallen van het plafond');
    // nog een beurtwissel in dezelfde ronde: geen tweede lair
    await req(server, 'PUT', '/api/combat', { currentTurn: 2, round: 1 }, dm);
    combat = (await req(server, 'GET', '/api/combat', null, dm)).body;
    assert.strictEqual(combat.regie.lairNu.gekozen, 1);
  });

  it('een speler kan geen Lair Action kiezen', async () => {
    assert.strictEqual((await req(server, 'POST', '/api/combat/lair', { index: 0 }, hCookie)).status, 403);
  });

  it('death saves worden een scène: neer, faal, nat 20 en weer op', async () => {
    let w = waitFor(tafel, 'gevecht:doodsstrijd');
    await req(server, 'PUT', `/api/combat/combatant/${heldCid}`, { hp: 0, deathSaves: { successes: 0, failures: 0 } }, dm);
    assert.strictEqual((await w)?.uitkomst, 'neer');
    w = waitFor(tafel, 'gevecht:doodsstrijd');
    await req(server, 'PUT', `/api/combat/combatant/${heldCid}`, { deathSaves: { successes: 0, failures: 1 } }, dm);
    const faal = await w;
    assert.strictEqual(faal.uitkomst, 'faal');
    assert.strictEqual(faal.failures, 1);
    w = waitFor(tafel, 'gevecht:doodsstrijd');
    await req(server, 'PUT', `/api/combat/combatant/${heldCid}`, { hp: 1, deathSaves: { successes: 0, failures: 0 }, nat20: true }, dm);
    const op = await w;
    assert.strictEqual(op.uitkomst, 'op');
    assert.strictEqual(op.nat20, true);
    const c = (await req(server, 'GET', '/api/combat', null, dm)).body.combatants.find(x => x.id === heldCid);
    assert.strictEqual(c.nat20, undefined, 'de vlag blijft niet op de deelnemer staan');
  });

  it('drie successen na Unconscious is stabiel', async () => {
    await req(server, 'PUT', `/api/combat/combatant/${heldCid}`, { hp: 0, deathSaves: { successes: 2, failures: 0 } }, dm);
    const w = waitFor(tafel, 'gevecht:doodsstrijd');
    await req(server, 'PUT', `/api/combat/combatant/${heldCid}`, { deathSaves: { successes: 0, failures: 0 }, conditions: ['unconscious'] }, dm);
    assert.strictEqual((await w)?.uitkomst, 'stabiel');
    await req(server, 'PUT', `/api/combat/combatant/${heldCid}`, { hp: 5, conditions: [] }, dm);
  });

  it('een vijand die valt tijdens de beurt van een speler levert een voorstel op', async () => {
    await req(server, 'PUT', '/api/combat', { currentTurn: 0, round: 2 }, dm);
    const combat = (await req(server, 'GET', '/api/combat', null, dm)).body;
    goblinId = combat.combatants.find(c => c.type === 'monster').id;
    await req(server, 'PUT', `/api/combat/combatant/${goblinId}`, { hp: 0 }, dm);
    const na = (await req(server, 'GET', '/api/combat', null, dm)).body;
    assert.strictEqual(na.regie.voorstel?.doelId, goblinId);
    assert.strictEqual(na.regie.voorstel?.characterId, held);
    assert.strictEqual(na.regie.voorstel?.laatste, false);
  });

  it('How do you want to do this? — de vraag gaat alleen naar die speler, het antwoord naar tafel', async () => {
    const bijHeld  = waitFor(spelerSock, 'gevecht:hwywtdt');
    const bijAnder = waitFor(anderSock, 'gevecht:hwywtdt', 500);
    const opTafel  = waitFor(tafel, 'gevecht:hwywtdt:display');
    const r = await req(server, 'POST', '/api/combat/hwywtdt', { doelId: goblinId, characterId: held }, dm);
    assert.strictEqual(r.status, 200);
    const vraag = await bijHeld;
    assert.ok(vraag?.id);
    assert.strictEqual(await bijAnder, null, 'een andere speler krijgt de vraag niet');
    assert.strictEqual((await opTafel)?.fase, 'vraag');

    assert.strictEqual((await req(server, 'POST', '/api/combat/hwywtdt/antwoord', { id: vraag.id, tekst: 'Nee' }, aCookie)).status, 403);

    const antwoord = waitFor(tafel, 'gevecht:hwywtdt:display');
    const klaar = waitFor(spelerSock, 'gevecht:hwywtdt:klaar');
    const a = await req(server, 'POST', '/api/combat/hwywtdt/antwoord',
      { id: vraag.id, tekst: 'Ik laat mijn schild op zijn helm neerkomen.' }, hCookie);
    assert.strictEqual(a.status, 200);
    const t = await antwoord;
    assert.strictEqual(t.fase, 'antwoord');
    assert.match(t.tekst, /schild/);
    assert.ok(await klaar, 'het venster bij de speler gaat dicht');
    assert.strictEqual((await req(server, 'POST', '/api/combat/hwywtdt/antwoord', { id: vraag.id, tekst: 'x' }, hCookie)).status, 409,
      'één antwoord per vraag');
  });

  it('overslaan mag: leeg antwoord, geen moment in het verslag', async () => {
    const tweede = (await req(server, 'GET', '/api/combat', null, dm)).body.combatants.filter(c => c.type === 'monster')[1].id;
    await req(server, 'POST', '/api/combat/hwywtdt', { doelId: tweede, characterId: held }, dm);
    const w = waitFor(tafel, 'gevecht:hwywtdt:display');
    await req(server, 'POST', '/api/combat/hwywtdt/antwoord', { tekst: '' }, hCookie);
    assert.strictEqual((await w)?.fase, 'stil');
    const c = (await req(server, 'GET', '/api/combat', null, dm)).body;
    assert.strictEqual(c.regie.momenten.filter(m => m.soort === 'hwywtdt').length, 1);
  });

  it('de afloop gaat naar tafel en het verslag krijgt de beschrijving mee', async () => {
    const tweede = (await req(server, 'GET', '/api/combat', null, dm)).body.combatants.filter(c => c.type === 'monster')[1].id;
    await req(server, 'PUT', `/api/combat/combatant/${tweede}`, { hp: 0 }, dm);
    const w = waitFor(tafel, 'gevecht:afloop');
    await req(server, 'DELETE', '/api/combat', null, dm);
    const a = await w;
    assert.ok(a);
    assert.strictEqual(a.uitkomst, 'overwinning');
    assert.strictEqual(a.ronden, 2);
    assert.strictEqual(a.momenten.length, 1);
    assert.match(a.momenten[0].tekst, /schild/);
    assert.ok(a.doodsstrijd.some(d => d.uitkomst === 'op' && d.nat20));
    assert.strictEqual(a.lair, 1);
  });
});
