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

  it('genezen op volle HP vraagt eerst, en kost pas iets als je doorzet', async () => {
    await req(server, 'PATCH', `/api/player-hp/${id.fighter}`, { current: 40, max: 40 }, dm);
    const voor = bron(await stand('paladin'), 'paladin', 'handen').over;
    const r = await doe('paladin', { klasse: 'paladin', actie: 'handen', doel: id.fighter, bedrag: 2 });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.vol, true);
    assert.match(r.body.error, /Hendrik Staal heeft al volle HP/);
    assert.strictEqual(bron(await stand('paladin'), 'paladin', 'handen').over, voor, 'de vraag zelf kost niets');
    const sw = await doe('fighter', { klasse: 'fighter', actie: 'secondwind' }, cookie.fighter);
    assert.strictEqual(sw.status, 409);
    assert.match(sw.body.error, /^Je hebt al volle HP/);
    const toch = await doe('paladin', { klasse: 'paladin', actie: 'handen', doel: id.fighter, bedrag: 2, toch: true });
    assert.strictEqual(toch.status, 200);
    assert.strictEqual(bron(toch.body.kracht, 'paladin', 'handen').over, voor - 2);
    await req(server, 'PATCH', `/api/player-hp/${id.fighter}`, { current: 5, max: 40 }, dm);
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

describe('Klassekrachten: subclasses uit de PHB', () => {
  let server, io, dm;
  const id = {};
  const doe = (wie, body) => req(server, 'POST', `/api/characters/${id[wie]}/klassekracht`, body, dm);
  const stand = async (wie) => (await req(server, 'GET', `/api/characters/${id[wie]}/klassekracht`, null, dm)).body.kracht;
  const DIR = DATA_DIR + '-sub';

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DIR;
    if (fs.existsSync(DIR)) fs.rmSync(DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    const maak = async (k, profiel) => {
      id[k] = (await req(server, 'POST', '/api/entities/personages', { name: k, subtype: 'speler', data: { groep: 'groep1' } }, dm)).body.id;
      await req(server, 'PATCH', `/api/player-profile/${id[k]}`, profiel, dm);
    };
    await maak('bm',      { klasse: 'Fighter',   level: 3, subclass: 'Battle Master' });
    await maak('champ',   { klasse: 'Fighter',   level: 3, subclass: 'Champion' });
    await maak('diviner', { klasse: 'Wizard',    level: 2, subclass: 'Diviner' });
    await maak('abjurer', { klasse: 'Wizard',    level: 3, subclass: 'Abjurer', int: 16 });
    await maak('zealot',  { klasse: 'Barbarian', level: 3, subclass: 'Path of the Zealot' });
    await maak('kaal',    { klasse: 'Barbarian', level: 3 });
    await maak('fiend',   { klasse: 'Warlock',   level: 3, subclass: 'The Fiend Patron', cha: 16 });
  });
  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DIR, { recursive: true, force: true });
  });

  it('Battle Master: Superiority Dice en een maneuver naar keuze, alles terug na een korte rust', async () => {
    const k = (await stand('bm')).klassen[0];
    assert.strictEqual(k.sub, 'Battle Master');
    assert.strictEqual(k.bronnen.find(b => b.key === 'superiority').max, 4);
    assert.ok(k.acties.find(a => a.id === 'maneuver').opties.includes('Trip Attack'));
    assert.strictEqual((await doe('bm', { klasse: 'fighter', actie: 'maneuver', keuze: 'Vliegende Schop' })).status, 400);
    const r = await doe('bm', { klasse: 'fighter', actie: 'maneuver', keuze: 'Trip Attack' });
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.uitkomst.getal >= 1 && r.body.uitkomst.getal <= 8);
    assert.match(r.body.uitkomst.tekst, /^Trip Attack/);
    await doe('bm', { klasse: 'fighter', actie: 'maneuver', keuze: 'Parry' });
    await req(server, 'POST', '/api/party/short-rest', {}, dm);
    const na = (await stand('bm')).klassen[0].bronnen.find(b => b.key === 'superiority');
    assert.strictEqual(na.over, 4);
  });

  it('een subclass zonder iets om bij te houden voegt niets toe', async () => {
    const k = (await stand('champ')).klassen[0];
    assert.strictEqual(k.sub, null);
    assert.ok(!k.acties.some(a => a.sub));
    // Een Barbarian zonder passende subclass: zijn Rage staat elders, hier niets.
    const kaal = await stand('kaal');
    assert.ok(!kaal || kaal.klassen.length === 0);
  });

  it('Diviner: Portent één keer per lange rust, en elke worp maar één keer in te zetten', async () => {
    const r = await doe('diviner', { klasse: 'wizard', actie: 'portent' });
    assert.strictEqual(r.status, 200);
    const worpen = r.body.uitkomst.worpen;
    assert.strictEqual(worpen.length, 2);
    assert.ok(worpen.every(w => w >= 1 && w <= 20));
    assert.strictEqual((await doe('diviner', { klasse: 'wizard', actie: 'portent' })).status, 409);
    const inzet = await doe('diviner', { klasse: 'wizard', actie: 'voorteken', keuze: String(worpen[0]) });
    assert.strictEqual(inzet.body.uitkomst.getal, worpen[0]);
    const nog = (await stand('diviner')).klassen[0].acties.find(a => a.id === 'voorteken').opties;
    assert.strictEqual(nog.length, 1);
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    assert.strictEqual((await doe('diviner', { klasse: 'wizard', actie: 'portent' })).status, 200, 'na een lange rust weer');
  });

  it('Warrior of the Gods: kies hoeveel d12, binnen de pool', async () => {
    await req(server, 'PATCH', `/api/player-hp/${id.zealot}`, { current: 1, max: 60 }, dm);
    assert.strictEqual((await doe('zealot', { klasse: 'barbarian', actie: 'goden', bedrag: 5 })).status, 400);
    const r = await doe('zealot', { klasse: 'barbarian', actie: 'goden', bedrag: 2 });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.uitkomst.worpen.length, 2);
    assert.strictEqual(r.body.kracht.klassen[0].bronnen.find(b => b.key === 'goden').over, 2);
  });

  it('Arcane Ward: vangt op en laadt weer bij, nooit boven het maximum', async () => {
    const max = (await stand('abjurer')).klassen[0].bronnen.find(b => b.key === 'ward').max;
    assert.strictEqual(max, 2 * 3 + 3);
    await doe('abjurer', { klasse: 'wizard', actie: 'ward', bedrag: 5 });
    let ward = (await stand('abjurer')).klassen[0].bronnen.find(b => b.key === 'ward');
    assert.strictEqual(ward.over, max - 5);
    await doe('abjurer', { klasse: 'wizard', actie: 'laden', keuze: 'Niveau 3' });
    ward = (await stand('abjurer')).klassen[0].bronnen.find(b => b.key === 'ward');
    assert.strictEqual(ward.over, max, '+6 maar afgetopt');
  });

  it("Dark One's Blessing: Temporary HP op jezelf", async () => {
    const r = await doe('fiend', { klasse: 'warlock', actie: 'blessing' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.uitkomst.getal, 3 + 3);
  });
});
