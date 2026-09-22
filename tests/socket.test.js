const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { io: ioClient } = require('socket.io-client');

// #14/#45: een speler mag via sound:emote niet namens een ander emoten —
// de server overschrijft entityId met de session-authoritatieve characterId.
// Anonieme emotes worden genegeerd.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-socket-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function httpReq(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
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
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, cookie: setCookie ? setCookie[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function connect(port, cookie) {
  const opts = { transports: ['polling'], forceNew: true };
  if (cookie) opts.extraHeaders = { Cookie: cookie };
  const s = ioClient(`http://localhost:${port}`, opts);
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

// Wacht op een event of resolve met null na een timeout.
function waitFor(socket, event, ms = 600) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

describe('Socket sound:emote authority', () => {
  let server, io, port, dmCookie, A, cookieA, listener;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    port = server.address().port;

    dmCookie = (await httpReq(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    const c = await httpReq(server, 'POST', '/api/entities/personages', { name: 'Emoter A', subtype: 'speler', data: { groep: 'groep1' } }, dmCookie);
    A = c.body.id;
    cookieA = (await httpReq(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: A })).cookie;

    listener = await connect(port, dmCookie);   // ontvanger in dezelfde room
  });

  after(async () => {
    if (listener) listener.close();
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('overschrijft een gespooft entityId met de eigen characterId', async () => {
    const sender = await connect(port, cookieA);
    const recv = waitFor(listener, 'sound:emote');
    sender.emit('sound:emote', { entityId: 'IEMAND-ANDERS', emoteId: 'wave' });
    const data = await recv;
    sender.close();
    assert.ok(data, 'event moet doorkomen');
    assert.strictEqual(data.entityId, A, 'entityId moet overschreven zijn met de eigen characterId');
    assert.strictEqual(data.emoteId, 'wave', 'overige velden blijven behouden');
  });

  // ── Wat alleen het tafelscherm hoort te zien ──────────────────────────
  // `brief:display`, `display:tekst` en `loot:display` zijn er voor het scherm
  // op tafel: de spelers hóren de voorleestekst, ze lezen hem niet mee, en het
  // lakzegel van een brief hoort pas op het scherm te breken. De bewaking zat
  // alleen in de **client** (`if (window._isDisplayMode)`), terwijl de server
  // naar de hele campagne-room uitzond — een speler met de netwerktab open las
  // de brief dus voordat hij open was.
  it('stuurt voorleestekst niet naar een gewone speler', async () => {
    const speler = await connect(port, cookieA);
    speler.emit('player:register', A);
    await new Promise(r => setTimeout(r, 120));

    const bijSpeler = waitFor(speler, 'display:tekst', 700);
    await httpReq(server, 'POST', '/api/display/tekst',
      { tekst: 'De deur zwaait open en de stank slaat je tegemoet.', kop: 'De kelder' }, dmCookie);
    const gelekt = await bijSpeler;
    speler.close();
    assert.strictEqual(gelekt, null,
      'de speler hoort de voorleestekst niet in zijn browser te krijgen: ' + JSON.stringify(gelekt));
  });

  it('stuurt de voorleestekst wél naar een tafelscherm', async () => {
    const tafel = await connect(port, dmCookie);
    tafel.emit('display:register');
    await new Promise(r => setTimeout(r, 120));

    const bijTafel = waitFor(tafel, 'display:tekst', 900);
    await httpReq(server, 'POST', '/api/display/tekst',
      { tekst: 'Een gang zonder einde.', kop: 'Verder' }, dmCookie);
    const data = await bijTafel;
    tafel.close();
    assert.ok(data, 'het tafelscherm hoort hem wél te krijgen');
    assert.strictEqual(data.tekst, 'Een gang zonder einde.');
  });

  it('stuurt de inhoud van een verzegelde brief alleen naar het tafelscherm', async () => {
    // Het lakzegel hoort op het scherm te breken. `brief:display` draagt de
    // volledige tekst; die ging naar iedereen.
    const speler = await connect(port, cookieA);
    speler.emit('player:register', A);
    const tafel = await connect(port, dmCookie);
    tafel.emit('display:register');
    await new Promise(r => setTimeout(r, 150));

    const bijSpeler = waitFor(speler, 'brief:display', 900);
    const bijTafel  = waitFor(tafel,  'brief:display', 900);
    await httpReq(server, 'POST', '/api/post', {
      characterId: A, titel: 'Kom alleen', afzender: 'Een onbekende',
      tekst: 'Middernacht, bij de brug. Vertel het niemand.',
      cinematic: true,
    }, dmCookie);
    const [gelekt, ontvangen] = [await bijSpeler, await bijTafel];
    speler.close(); tafel.close();

    assert.strictEqual(gelekt, null, 'de brief hoort niet in de browser van de speler te belanden');
    assert.ok(ontvangen, 'het tafelscherm hoort hem wél te krijgen');
    assert.match(JSON.stringify(ontvangen), /middernacht/i, 'compleet met tekst');
  });

  it('stuurt een speler geen exacte monster-HP of AC', async () => {
    // Het scherm toont een speler alleen een vaag label ("Gewond"), en het
    // tafelscherm vaagt zelfs spelers-HP. Maar `combat:updated` droeg de
    // exacte hp/maxHp/ac van elk monster naar élke speler — hoeveel de ogre
    // nog over heeft en wat je moet gooien om hem te raken zijn dingen die je
    // aan tafel uitvindt.
    const mon = (await httpReq(server, 'POST', '/api/monsters',
      { name: 'Moeras-ogre', maxHp: 59, statblock: { ac: '11 (hide armor)', hp: '59 (7d10+21)' } }, dmCookie)).body.id;
    const enc = (await httpReq(server, 'POST', '/api/encounters',
      { name: 'Hinderlaag', monsters: [{ monsterId: mon, aantal: 1, name: 'Moeras-ogre' }] }, dmCookie)).body;
    const encId = enc?.id || enc?.encounter?.id;
    assert.ok(encId, 'encounter aangemaakt: ' + JSON.stringify(enc).slice(0, 120));

    const speler = await connect(port, cookieA);
    speler.emit('player:register', A);
    await new Promise(r => setTimeout(r, 120));

    const bijSpeler = waitFor(speler, 'combat:updated', 1200);
    await httpReq(server, 'POST', `/api/encounters/${encId}/start`, {}, dmCookie);
    const payload = await bijSpeler;
    speler.close();

    assert.ok(payload, 'de speler hoort het gevecht wél te zien beginnen');
    const ogre = (payload.combatants || []).find(c => /ogre/i.test(c.name || ''));
    assert.ok(ogre, 'de ogre staat in de lijst: ' + JSON.stringify(payload.combatants || []).slice(0, 200));
    assert.strictEqual(ogre.maxHp, undefined, 'geen exacte maxHp van een monster naar een speler');
    assert.ok(ogre.ac === undefined || ogre.ac === '', 'geen AC van een monster naar een speler');
    assert.ok(ogre.hpStaat, 'wel een vage staat, anders kan het scherm niets tekenen');
  });

  it('houdt de dreigingsrangorde zichtbaar zonder de cijfers te sturen', async () => {
    // De tokengrootte verraadt welk monster het zwaarst is, en dat is een
    // bewuste keuze: je ziet in één oogopslag waar het gevaar zit. Het canvas
    // groepeerde daarvoor zélf op `maxHp|ac`, en die velden gaan niet meer naar
    // een speler. De server stuurt daarom de plaats in de rangorde mee.
    const zwaar = (await httpReq(server, 'POST', '/api/monsters',
      { name: 'Bergtrol', maxHp: 84, statblock: { ac: '15' } }, dmCookie)).body.id;
    const licht = (await httpReq(server, 'POST', '/api/monsters',
      { name: 'Rifgrif', maxHp: 12, statblock: { ac: '12' } }, dmCookie)).body.id;
    const enc = (await httpReq(server, 'POST', '/api/encounters', {
      name: 'Rangorde',
      monsters: [{ monsterId: licht, aantal: 1, name: 'Rifgrif' }, { monsterId: zwaar, aantal: 1, name: 'Bergtrol' }],
    }, dmCookie)).body;
    const encId = enc?.id || enc?.encounter?.id;

    const speler = await connect(port, cookieA);
    speler.emit('player:register', A);
    await new Promise(r => setTimeout(r, 120));
    const bij = waitFor(speler, 'combat:updated', 1500);
    await httpReq(server, 'POST', `/api/encounters/${encId}/start`, {}, dmCookie);
    const payload = await bij;
    speler.close();

    const trol = (payload.combatants || []).find(c => /bergtrol/i.test(c.name || ''));
    const grif = (payload.combatants || []).find(c => /rifgrif/i.test(c.name || ''));
    assert.ok(trol && grif, 'beide monsters staan in het gevecht');
    assert.strictEqual(trol.maxHp, undefined, 'nog steeds geen cijfers');
    assert.ok(trol._dreigingIdx < grif._dreigingIdx,
      `de zwaarste hoort vooraan te staan (trol ${trol._dreigingIdx}, grif ${grif._dreigingIdx})`);
  });

  it('negeert sound:emote van een anonieme socket', async () => {
    const anon = await connect(port, null);
    const recv = waitFor(listener, 'sound:emote', 500);
    anon.emit('sound:emote', { entityId: 'SPOOF', emoteId: 'taunt' });
    const data = await recv;
    anon.close();
    assert.strictEqual(data, null, 'anonieme emote mag niet gerelayed worden');
  });
});

// ── Bewaking: wat voor het tafelscherm is, blijft voor het tafelscherm ──────
//
// Dit is geen gedragstest maar een broncontrole, en met opzet: de fout die we
// dichtten was één `io.to(campaignId)` in plaats van `io.to(_displayRoom(req))`
// — één woord, geen zichtbaar verschil, en de inhoud van een verzegelde brief
// in de browser van elke speler. Zo'n regel glijdt terug bij de eerstvolgende
// nieuwe display-event, en dan merkt niemand het.
describe('Display-events gaan alleen naar de tafelschermen', () => {
  const api = fs.readFileSync(path.join(__dirname, '..', 'routes', 'api.js'), 'utf8');

  it('richt elk display-event op _displayRoom(req)', () => {
    const regels = api.split('\n');
    const fout = [];
    regels.forEach((regel, i) => {
      const m = regel.match(/emit\('((?:brief|loot|levelup):display|display:[a-z]+)'/);
      if (!m) return;
      // De room staat soms op de regel ervoor (`io.to(...)\n  .emit(...)`).
      const context = (regels[i - 1] || '') + regel;
      if (!/_displayRoom\(/.test(context)) fout.push(`regel ${i + 1}: ${m[1]}`);
    });
    assert.deepStrictEqual(fout, [],
      'deze display-events gaan naar de hele campagne-room in plaats van naar de tafelschermen:\n  ' + fout.join('\n  '));
  });

  it('bouwt de roomnaam maar op twee afgesproken plekken', () => {
    const defs = api.match(/function _displayRoom\(/g) || [];
    assert.strictEqual(defs.length, 1, 'precies één _displayRoom-helper');
    // 'display:' + campagne mag alleen in _displayRoom zelf en in _zendCombat
    // (die stuurt naar de DM- én de tafelscherm-room tegelijk). Elke derde
    // plek is een ad-hoc room, en dat is precies hoe dit de vorige keer misging.
    const handmatig = api.match(/'display:' \+/g) || [];
    assert.strictEqual(handmatig.length, 1,
      "alleen _displayRoom mag 'display:' + campagne samenstellen");
    assert.ok(/function _zendCombat\(/.test(api), 'combat gaat via één verzendpunt');
  });
});
