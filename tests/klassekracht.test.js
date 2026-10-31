const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { io: ioClient } = require('socket.io-client');

// Klassekrachten: één route voor elf klassen. Deze tests lopen per soort één
// klasse langs — genezen, een worp, een toestand, inspiratie geven en
// gebruiken, slots terughalen, een bron per punt — plus de rusten, wie wat mag
// en dat het moment alleen naar het tafelscherm gaat.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-kk-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
function waitFor(socket, event, ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

describe('Klassekrachten', () => {
  let server, io, port, dm, pw;
  const id = {};
  const cookie = {};
  const doe = (wie, body, als = dm) => req(server, 'POST', `/api/characters/${id[wie]}/klassekracht`, body, als);
  const stand = async (wie) => (await req(server, 'GET', `/api/characters/${id[wie]}/klassekracht`, null, dm)).body.kracht;
  const bron = (k, klasse, key) => k.klassen.find(x => x.id === klasse).bronnen.find(b => b.key === key);

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    port = server.address().port;
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const maak = async (sleutel, naam, profiel) => {
      id[sleutel] = (await req(server, 'POST', '/api/entities/personages',
        { name: naam, subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
      await req(server, 'PATCH', `/api/player-profile/${id[sleutel]}`, profiel, dm);
    };
    await maak('bard',    'Lyra Snaarzang',   { klasse: 'Bard',    level: 5, cha: 16 });
    await maak('fighter', 'Hendrik Staal',    { klasse: 'Fighter', level: 3 });
    await maak('wizard',  'Elara Inktvinger', { klasse: 'Wizard',  level: 5, int: 18 });
    await maak('druid',   'Mos Eikenblad',    { klasse: 'Druid',   level: 2 });
    await maak('paladin', 'Ser Brandt',       { klasse: 'Paladin', level: 2 });
    await maak('monk',    'Broeder Stil',     { klasse: 'Monk',    level: 2, wis: 14 });
    await maak('rogue',   'Vlug Schaduw',     { klasse: 'Rogue',   level: 5 });
    await maak('warlock', 'Morra Pact',       { klasse: 'Warlock', level: 5 });
    await req(server, 'PATCH', `/api/player-hp/${id.fighter}`, { current: 5, max: 40 }, dm);

    const groups = (await req(server, 'GET', '/api/groups', null, dm)).body.groups || [];
    pw = groups.find(g => g.id === 'groep1')?.password;
    for (const k of ['bard', 'fighter']) {
      cookie[k] = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'grisburgh', characterId: id[k], password: pw })).cookie;
    }
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('kent elke klasse zijn eigen bronnen, volgens zijn level', async () => {
    assert.strictEqual(bron(await stand('bard'), 'bard', 'inspiratie').max, 3, 'CHA 16 → drie keer');
    assert.strictEqual(bron(await stand('fighter'), 'fighter', 'secondwind').max, 2);
    assert.strictEqual(bron(await stand('fighter'), 'fighter', 'surge').max, 1);
    assert.strictEqual(bron(await stand('monk'), 'monk', 'focus').max, 2);
    assert.strictEqual(bron(await stand('paladin'), 'paladin', 'handen').max, 10);
    const rogue = await stand('rogue');
    assert.deepStrictEqual(rogue.klassen[0].info, ['Sneak Attack 3d6']);
  });

  it('een speler kan niet andermans kracht gebruiken, en geen kracht van een andere klasse', async () => {
    assert.strictEqual((await doe('bard', { klasse: 'bard', actie: 'inspireer', doel: id.fighter }, cookie.fighter)).status, 403);
    assert.strictEqual((await doe('fighter', { klasse: 'wizard', actie: 'recovery', slots: [1] })).status, 409);
  });

  it('Second Wind geneest jezelf, en een korte rust geeft er één terug', async () => {
    const r = await doe('fighter', { klasse: 'fighter', actie: 'secondwind' }, cookie.fighter);
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.uitkomst.getal >= 4 && r.body.uitkomst.getal <= 13, 'tussen 1d10+3: ' + r.body.uitkomst.getal);
    assert.strictEqual(bron(r.body.kracht, 'fighter', 'secondwind').over, 1);
    await req(server, 'POST', '/api/party/short-rest', {}, dm);
    assert.strictEqual(bron(await stand('fighter'), 'fighter', 'secondwind').over, 2);
  });

  it('Bardic Inspiration: geven, één tegelijk, en de ontvanger gooit hem', async () => {
    const r = await doe('bard', { klasse: 'bard', actie: 'inspireer', doel: id.fighter }, cookie.bard);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.uitkomst.die, 'd8');
    assert.strictEqual((await doe('bard', { klasse: 'bard', actie: 'inspireer', doel: id.fighter }, cookie.bard)).status, 409);
    assert.strictEqual((await doe('bard', { klasse: 'bard', actie: 'inspireer', doel: id.bard }, cookie.bard)).status, 400,
      'jezelf inspireren kan niet');
    const f = (await req(server, 'GET', `/api/characters/${id.fighter}/klassekracht`, null, cookie.fighter)).body.kracht;
    assert.deepStrictEqual(f.ontvangen, { die: 'd8', vanNaam: 'Lyra Snaarzang' });
    const g = await req(server, 'POST', `/api/characters/${id.fighter}/inspiratie/gebruik`, {}, cookie.fighter);
    assert.ok(g.body.worp.totaal >= 1 && g.body.worp.totaal <= 8);
    assert.strictEqual((await stand('fighter')).ontvangen, null);
  });

  it('Arcane Recovery: zelf kiezen, binnen het budget, één keer per lange rust', async () => {
    await req(server, 'PUT', `/api/player-spellslots/${id.wizard}`, { 1: { max: 4, used: 2 }, 2: { max: 3, used: 2 }, 3: { max: 2, used: 1 } }, dm);
    assert.strictEqual((await doe('wizard', { klasse: 'wizard', actie: 'recovery', slots: [3, 2] })).status, 400, '5 niveaus > budget 3');
    const r = await doe('wizard', { klasse: 'wizard', actie: 'recovery', slots: [1, 2] });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.kracht.slots[1].used, 1);
    assert.strictEqual(r.body.kracht.slots[2].used, 1);
    assert.strictEqual((await doe('wizard', { klasse: 'wizard', actie: 'recovery', slots: [1] })).status, 409);
  });

  it('Lay on Hands: kies hoeveel, niet meer dan er in de voorraad zit', async () => {
    const r = await doe('paladin', { klasse: 'paladin', actie: 'handen', doel: id.fighter, bedrag: 4 });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(bron(r.body.kracht, 'paladin', 'handen').over, 6);
    assert.strictEqual((await doe('paladin', { klasse: 'paladin', actie: 'handen', doel: id.fighter, bedrag: 20 })).status, 409);
  });

  it('Wild Shape: bekende gedaantes volgens de PHB — aantal, CR en geen vliegers vóór 8', async () => {
    const put = (vormen) => req(server, 'PUT', `/api/characters/${id.druid}/klassekracht/vormen`, { vormen }, dm);
    assert.strictEqual((await put(['Wolf', 'Cat', 'Boar', 'Badger', 'Rat'])).status, 400, 'level 2 kent er vier');
    assert.strictEqual((await put(['Ape'])).status, 400, 'CR 1/2 is te sterk op level 2');
    assert.strictEqual((await put(['Eagle'])).status, 400, 'een vlieger pas vanaf level 8');
    assert.strictEqual((await put(['Geen Beest'])).status, 400);
    const r = await put(['Wolf', 'Cat', 'Polar Bear'].slice(0, 2));
    assert.strictEqual(r.status, 200);
    const w = r.body.kracht.klassen[0].wildshape;
    assert.deepStrictEqual(w.vormen.map(b => b.naam), ['Wolf', 'Cat']);
    assert.strictEqual(w.bekend, 4);
    assert.strictEqual(w.maxCrTekst, '1/4');
    assert.ok(w.aanbod.every(b => !b.vliegt && b.crGetal <= 0.25), 'het aanbod houdt zich aan de regels');
    assert.ok(w.vormen[0].omgevingen.includes('forest'), 'de Wolf leeft in het bos');
    assert.ok(w.omgevingen.includes('arctic') && w.omgevingen.length === 11);
  });

  it('Wild Shape: alleen een bekende gedaante, met een omgeving naar keuze, en een lange rust beëindigt hem', async () => {
    assert.strictEqual((await doe('druid', { klasse: 'druid', actie: 'wildshape', tekst: 'Polar Bear' })).status, 409);
    const tafel = await connect(port, dm);
    tafel.emit('display:register');
    await new Promise(r => setTimeout(r, 150));
    const opTafel = waitFor(tafel, 'klasse:display', 900);
    const r = await doe('druid', { klasse: 'druid', actie: 'wildshape', tekst: 'Wolf', omgeving: 'arctic' });
    const t = await opTafel;
    tafel.close();
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const actief = r.body.kracht.klassen[0].actief[0];
    assert.strictEqual(actief.tekst, 'Wolf');
    assert.strictEqual(actief.omgeving, 'arctic');
    assert.match(actief.effecten[0], /^AC 12 · 40 ft\./, 'de gedaante zegt wat hij kan');
    assert.strictEqual(t.omgeving, 'arctic');
    assert.strictEqual(t.vorm.naam, 'Wolf');
    assert.strictEqual((await doe('druid', { klasse: 'druid', actie: 'wildshape', tekst: 'Cat' })).status, 409, 'loopt al');
    // Geen omgeving opgegeven: dan de eerste waar het beest leeft.
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    const na = await stand('druid');
    assert.deepStrictEqual(na.klassen[0].actief, []);
    assert.strictEqual(bron(na, 'druid', 'wildshape').over, 2);
    const kat = await doe('druid', { klasse: 'druid', actie: 'wildshape', tekst: 'Cat' });
    assert.ok(kat.body.kracht.klassen[0].actief[0].omgeving, 'zonder keuze toch een omgeving');
  });

  it('Bardic Inspiration staat als badge op het portret van wie hem kreeg', async () => {
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    await doe('bard', { klasse: 'bard', actie: 'inspireer', doel: id.paladin }, cookie.bard);
    const badges = (await req(server, 'GET', '/api/badges', null, dm)).body;
    const b = (badges[id.paladin] || []).find(x => x.soort === 'bardic');
    assert.ok(b, JSON.stringify(badges));
    assert.strictEqual(b.label, 'Bardic Inspiration d8');
    assert.match(b.uitleg, /Lyra Snaarzang/);
    await req(server, 'POST', `/api/characters/${id.paladin}/inspiratie/gebruik`, {}, dm);
    const na = (await req(server, 'GET', '/api/badges', null, dm)).body;
    assert.ok(!(na[id.paladin] || []).some(x => x.soort === 'bardic'), 'gebruikt is weg');
  });

  it('een emote bij een kracht klinkt mee op het tafelscherm', async () => {
    const zet = (body, als = cookie.fighter) => req(server, 'PUT', `/api/characters/${id.fighter}/klassekracht/klank`, body, als);
    assert.strictEqual((await zet({ sleutel: 'fighter.surge', emoteId: 'em_bestaat_niet' })).status, 400);
    assert.strictEqual((await zet({ sleutel: 'fighter.vliegen', emoteId: null })).status, 400);
    await req(server, 'PUT', '/api/sounds', { emotes: { [id.fighter]: {
      library: [{ id: 'em_kreet', label: 'Strijdkreet', fileId: 'f_kreet' }], selected: ['em_kreet'] } } }, dm);
    assert.strictEqual((await zet({ sleutel: 'fighter.surge', emoteId: 'em_kreet' })).status, 200);
    assert.strictEqual((await zet({ sleutel: 'barbarian.rage', emoteId: 'em_kreet' })).status, 200, 'ook Rage heeft een klank');
    const k = await stand('fighter');
    assert.deepStrictEqual(k.emotes, [{ id: 'em_kreet', label: 'Strijdkreet' }]);
    assert.strictEqual(k.klank['fighter.surge'], 'em_kreet');

    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    const tafel = await connect(port, dm);
    tafel.emit('display:register');
    await new Promise(r => setTimeout(r, 150));
    const opTafel = waitFor(tafel, 'klasse:display', 900);
    await doe('fighter', { klasse: 'fighter', actie: 'surge' }, cookie.fighter);
    const t = await opTafel;
    tafel.close();
    assert.strictEqual(t.emote, 'f_kreet');
  });

  it('Sneak Attack en Eldritch Blast rollen, de Warlock per straal', async () => {
    const s = (await doe('rogue', { klasse: 'rogue', actie: 'sneak' })).body.uitkomst;
    assert.ok(s.getal >= 3 && s.getal <= 18);
    assert.strictEqual(s.worpen.length, 3);
    const b = (await doe('warlock', { klasse: 'warlock', actie: 'blast' })).body.uitkomst;
    assert.strictEqual(b.stralen.length, 2);
  });

  it('Focus Points: per punt, en een korte rust zet ze terug', async () => {
    await doe('monk', { klasse: 'monk', actie: 'flurry' });
    await doe('monk', { klasse: 'monk', actie: 'step' });
    assert.strictEqual((await doe('monk', { klasse: 'monk', actie: 'patient' })).status, 409);
    await req(server, 'POST', '/api/party/short-rest', {}, dm);
    assert.strictEqual(bron(await stand('monk'), 'monk', 'focus').over, 2);
  });

  it('het moment gaat naar het tafelscherm, de rest van de tafel krijgt alleen de melding', async () => {
    const tel = await connect(port, cookie.bard);
    const tafel = await connect(port, dm);
    tafel.emit('display:register');
    await new Promise(r => setTimeout(r, 150));
    const telUpd  = waitFor(tel, 'klasse:updated', 900);
    const telDisp = waitFor(tel, 'klasse:display', 700);
    const tafelDisp = waitFor(tafel, 'klasse:display', 900);
    await doe('fighter', { klasse: 'fighter', actie: 'surge' }, cookie.fighter);
    const [u, d, t] = await Promise.all([telUpd, telDisp, tafelDisp]);
    tel.close(); tafel.close();
    assert.ok(u && u.woord === 'Action Surge');
    assert.strictEqual(d, null);
    assert.ok(t && t.thema === 'fighter' && t.bron?.naam === 'Hendrik Staal');
  });
});
