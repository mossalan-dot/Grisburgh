const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// #47: geïsoleerde tmpdir; env-var in before() gezet (gedeeld proces).
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: {} };
    if (body) {
      const json = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(json);
    }
    if (cookie) opts.headers['Cookie'] = cookie;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, cookie: setCookie ? setCookie[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

describe('Server-side filtering', () => {
  let server, io, dmCookie;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    delete require.cache[require.resolve('../server')];
    delete require.cache[require.resolve('../lib/storage')];
    delete require.cache[require.resolve('../routes/api')];
    delete require.cache[require.resolve('../routes/auth')];
    const mod = require('../server');
    server = mod.server;
    io = mod.io;
    await new Promise(r => server.listen(0, r));
    const login = await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' });
    dmCookie = login.cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('hidden entity is omitted for players', async () => {
    await req(server, 'POST', '/api/entities/locaties', {
      name: 'Hidden Fort', data: { desc: 'Secret location' },
    }, dmCookie);
    const player = await req(server, 'GET', '/api/entities/locaties');
    assert.strictEqual(player.body.length, 0);
  });

  it('geheim field is stripped for players unless secretReveal', async () => {
    // Ingelogde speler in de actieve groep (groep1, zonder wachtwoord in een verse DB).
    const playerChar = await req(server, 'POST', '/api/entities/personages', {
      name: 'Speler Een', subtype: 'speler', data: { groep: 'groep1' },
    }, dmCookie);
    const login = await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: playerChar.body.id });
    const playerCookie = login.cookie;
    assert.ok(playerCookie, 'speler moet kunnen inloggen');

    const create = await req(server, 'POST', '/api/entities/personages', {
      name: 'Secret NPC', data: { desc: 'Visible', geheim: 'Top secret' },
    }, dmCookie);
    const id = create.body.id;
    // Zichtbaar maken voor de groep
    await req(server, 'PUT', `/api/entities/personages/${id}/visibility`, null, dmCookie);

    // Speler ziet desc maar niet geheim
    let player = await req(server, 'GET', '/api/entities/personages', null, playerCookie);
    const npc = player.body.find(e => e.id === id);
    assert.ok(npc, 'speler moet de zichtbare NPC zien');
    assert.strictEqual(npc.data.desc, 'Visible');
    assert.strictEqual(npc.data.geheim, undefined);

    // Na secret-reveal ziet de speler geheim wél
    await req(server, 'PUT', `/api/entities/personages/${id}/secret`, null, dmCookie);
    player = await req(server, 'GET', '/api/entities/personages', null, playerCookie);
    const npc2 = player.body.find(e => e.id === id);
    assert.strictEqual(npc2.data.geheim, 'Top secret');
  });

  it('hidden archief documents are invisible to players', async () => {
    await req(server, 'POST', '/api/archief', { name: 'Secret Map', cat: 'kaarten' }, dmCookie);
    const player = await req(server, 'GET', '/api/archief');
    const found = player.body.documents.find(d => d.name === 'Secret Map');
    assert.strictEqual(found, undefined);
  });

  it('blurred archief documents hide connections from players', async () => {
    const doc = await req(server, 'POST', '/api/archief', {
      name: 'Blurry Letter', cat: 'brieven', npcs: ['Someone'], locs: ['Somewhere'],
    }, dmCookie);
    await req(server, 'PUT', `/api/archief/${doc.body.id}/state`, { state: 'blurred' }, dmCookie);
    const player = await req(server, 'GET', '/api/archief');
    const found = player.body.documents.find(d => d.name === 'Blurry Letter');
    assert.ok(found);
    assert.deepStrictEqual(found.npcs, []);
    assert.deepStrictEqual(found.locs, []);
  });

  it('DM notes are never visible to players', async () => {
    const create = await req(server, 'POST', '/api/entities/organisaties', {
      name: 'Test Org', data: {},
    }, dmCookie);
    const id = create.body.id;
    await req(server, 'PUT', `/api/dm/notes/${id}`, { note: 'DM secret note' }, dmCookie);
    const playerRes = await req(server, 'GET', `/api/dm/notes/${id}`);
    assert.strictEqual(playerRes.status, 403);
  });

  it('koppelingen naar onontdekte kaartjes zijn niet aanklikbaar voor spelers', async () => {
    const speler = await req(server, 'POST', '/api/entities/personages', {
      name: 'Koppel Speler', subtype: 'speler', data: { groep: 'groep1' },
    }, dmCookie);
    const login = await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler.body.id });
    const spelerCookie = login.cookie;

    // Twee NPC's: één die de party kent, één die verborgen blijft.
    const bekend  = await req(server, 'POST', '/api/entities/personages', { name: 'Bekende Waard', data: {} }, dmCookie);
    const geheim  = await req(server, 'POST', '/api/entities/personages', { name: 'Geheime Baas',  data: {} }, dmCookie);
    const gebied  = await req(server, 'POST', '/api/entities/locaties',   { name: 'Verborgen Wijk', data: {} }, dmCookie);
    await req(server, 'PUT', `/api/entities/personages/${bekend.body.id}/visibility`, null, dmCookie);

    const kroeg = await req(server, 'POST', '/api/entities/locaties', {
      name: 'De Koppelkroeg',
      data: {
        locType: 'Herberg',
        wijk: 'Verborgen Wijk', wijkId: gebied.body.id,
        dungeonId: 'dng_geheim', roomId: 'kamer_1',
        betrokkenen: JSON.stringify([
          { naam: 'Bekende Waard', rol: 'Eigenaar', id: bekend.body.id },
          { naam: 'Geheime Baas',  rol: 'Beschermheer', id: geheim.body.id },
          { naam: 'Losse Naam',    rol: 'Stamgast', id: '' },
        ]),
      },
    }, dmCookie);
    await req(server, 'PUT', `/api/entities/locaties/${kroeg.body.id}/visibility`, null, dmCookie);

    const res = await req(server, 'GET', `/api/entities/locaties/${kroeg.body.id}`, null, spelerCookie);
    assert.strictEqual(res.status, 200, 'de kroeg zelf is zichtbaar');
    const rijen = JSON.parse(res.body.data.betrokkenen);

    // De naam blijft altijd staan: die heeft de DM op dit kaartje geschreven.
    assert.deepStrictEqual(rijen.map(r => r.naam), ['Bekende Waard', 'Geheime Baas', 'Losse Naam']);
    // Maar alleen een ontdekt kaartje houdt zijn koppeling.
    assert.strictEqual(rijen[0].id, bekend.body.id, 'ontdekte NPC blijft aanklikbaar');
    assert.strictEqual(rijen[1].id, '', 'onontdekte NPC verliest zijn koppeling');
    assert.strictEqual(rijen[2].id, '', 'losse naam had er nooit een');
    assert.strictEqual(res.body.data.wijkId, undefined, 'gebied naar een verborgen kaartje gaat eraf');
    assert.strictEqual(res.body.data.wijk, 'Verborgen Wijk', 'de gebiedsnaam blijft wel staan');
    assert.strictEqual(res.body.data.dungeonId, undefined, 'dungeonkoppeling is DM-gereedschap');
    assert.strictEqual(res.body.data.roomId, undefined);

    // En de omgekeerde kant: de verborgen kroeg mag niet opduiken bij de NPC.
    const npcRes = await req(server, 'GET', `/api/entities/personages/${bekend.body.id}`, null, spelerCookie);
    assert.ok(Array.isArray(npcRes.body._hoortBij));
    assert.ok(npcRes.body._hoortBij.every(x => x.id !== gebied.body.id),
      'een verborgen locatie komt niet in "hoort bij"');
  });

  it('dungeonkoppeling volgt de zichtbaarheid van de plattegrond', async () => {
    const speler = await req(server, 'POST', '/api/entities/personages', {
      name: 'Kelder Speler', subtype: 'speler', data: { groep: 'groep1' },
    }, dmCookie);
    const login = await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler.body.id });
    const spelerCookie = login.cookie;

    const dng = await req(server, 'POST', '/api/dungeons', { name: 'De Kelders' }, dmCookie);
    const dngId = dng.body.id;
    await req(server, 'PUT', `/api/dungeons/${dngId}/rooms`, {
      rooms: [{ id: 'r_luik', name: 'Het luik' }, { id: 'r_diep', name: 'Diepe gang' }],
    }, dmCookie);

    const kroeg = await req(server, 'POST', '/api/entities/locaties', {
      name: 'Kroeg met kelder', data: { dungeonId: dngId, roomId: 'r_diep' },
    }, dmCookie);
    await req(server, 'PUT', `/api/entities/locaties/${kroeg.body.id}/visibility`, null, dmCookie);
    const lees = async () => (await req(server, 'GET', `/api/entities/locaties/${kroeg.body.id}`, null, spelerCookie)).body.data;

    // Geen toegang tot de kaart: de koppeling bestaat niet voor deze speler.
    assert.strictEqual((await lees()).dungeonId, undefined, 'zonder toegang geen dungeon');

    // Toegang tot de kaart, maar de kamer is nog niet onthuld.
    await req(server, 'PUT', `/api/dungeons/${dngId}/party-access`, { partyAccess: ['groep1'] }, dmCookie);
    assert.strictEqual((await lees()).dungeonId, undefined, 'kamer nog niet onthuld');

    // Een ándere kamer onthullen helpt niet.
    await req(server, 'POST', `/api/dungeons/${dngId}/reveal`, { roomId: 'r_luik', groupId: 'groep1' }, dmCookie);
    assert.strictEqual((await lees()).dungeonId, undefined, 'andere kamer telt niet');

    // Pas als díé kamer onthuld is.
    await req(server, 'POST', `/api/dungeons/${dngId}/reveal`, { roomId: 'r_diep', groupId: 'groep1' }, dmCookie);
    const na = await lees();
    assert.strictEqual(na.dungeonId, dngId);
    assert.strictEqual(na.roomId, 'r_diep');

    // Zonder kamer: toegang tot de kaart is genoeg.
    const grot = await req(server, 'POST', '/api/entities/locaties', {
      name: 'Grot zonder kamer', data: { dungeonId: dngId, roomId: '' },
    }, dmCookie);
    await req(server, 'PUT', `/api/entities/locaties/${grot.body.id}/visibility`, null, dmCookie);
    const g = (await req(server, 'GET', `/api/entities/locaties/${grot.body.id}`, null, spelerCookie)).body.data;
    assert.strictEqual(g.dungeonId, dngId, 'hele kaart: toegang volstaat');
  });

  it('tekst content only visible for revealed docs to players', async () => {
    const doc = await req(server, 'POST', '/api/archief', { name: 'Tekst Doc', cat: 'codex' }, dmCookie);
    const id = doc.body.id;
    await req(server, 'PUT', `/api/archief/${id}/tekst`, { tekst: 'Secret text' }, dmCookie);
    // As hidden: player gets no tekst
    let player = await req(server, 'GET', '/api/archief');
    assert.strictEqual(player.body.tekstContent[id], undefined);
    // As revealed: player gets tekst
    await req(server, 'PUT', `/api/archief/${id}/state`, { state: 'revealed' }, dmCookie);
    player = await req(server, 'GET', '/api/archief');
    assert.strictEqual(player.body.tekstContent[id], 'Secret text');
  });
});
