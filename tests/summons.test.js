const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Een opgeroepen wezen bestaat ook buiten het gevecht.** Een Familiar loopt
// met je mee door de stad; hij staat dus in `dmState.playerSummons` en niet in
// `combat.json`, dat bij het sluiten van een gevecht wordt leeggegooid. Loopt
// er wél een gevecht, dan hoort hij meteen op de kaart met het initiatief van
// zijn baasje — dat is de regel, en het is ook het makkelijkst te vergeten.
//
// Het tweede dat deze toets bewaakt is de grens: de app kent de cijfers van
// zeven van de 25 metgezellen, en van de rest niet, want die staan in boeken
// waaruit we niets overnemen. Daar moet hij erom vragen in plaats van iets te
// verzinnen — en wat de speler intikt moet hij onthouden, anders is het elke
// keer opnieuw een formulier.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-summon-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Wat je hebt opgeroepen', () => {
  let server, io, dm, speler, ander;
  const WIZ = 'e_summon_wiz';
  const BAR = 'e_summon_bar';
  const GROEP = 'g_summon';
  const pad = () => path.join(DATA_DIR, 'campaigns', 'summonproef');
  const lees = (f) => JSON.parse(fs.readFileSync(path.join(pad(), f), 'utf8'));
  const schrijf = (f, d) => fs.writeFileSync(path.join(pad(), f), JSON.stringify(d, null, 2));
  const summons = (id = WIZ) => lees('dm-state.json').playerSummons?.[id] || [];

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    const storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('summonproef', { appTitle: 'Summonproef' });

    schrijf('dm-state.json', {
      dmPassword: 'summonproef-dm',
      activeGroup: GROEP,
      groups: { [GROEP]: { name: 'Proef', password: 'proef', rustTellers: { long: 3 } } },
      playerProfiles: {
        [WIZ]: { klasse: 'Wizard', level: 5 },
        [BAR]: { klasse: 'Barbarian', level: 5 },
      },
      // Find Familiar staat in zijn boek; dat is wat hem het recht geeft.
      playerSpells: { [WIZ]: [{ index: 'find-familiar', name: 'Find Familiar' }] },
      playerHp: {},
    });
    const ent = lees('entities.json');
    ent.personages = [
      { id: WIZ, name: 'Proefmagiër', subtype: 'speler', data: { groep: GROEP, klasse: 'Wizard' } },
      { id: BAR, name: 'Proefbarbaar', subtype: 'speler', data: { groep: GROEP, klasse: 'Barbarian' } },
    ];
    schrijf('entities.json', ent);

    dm     = (await req(server, 'POST', '/api/auth/login', { campagne: 'summonproef', password: 'summonproef-dm' })).cookie;
    speler = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'summonproef', characterId: WIZ, password: 'proef' })).cookie;
    ander  = (await req(server, 'POST', '/api/auth/player-login', { campagne: 'summonproef', characterId: BAR, password: 'proef' })).cookie;
    assert.ok(dm && speler && ander);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('biedt alleen aan wat je werkelijk hebt', async () => {
    const r = await req(server, 'GET', `/api/characters/${WIZ}/summons`, null, speler);
    assert.equal(r.status, 200);
    const ids = r.body.aanbod.map(x => x.id);
    assert.ok(ids.includes('familiar'), 'Find Familiar staat in zijn boek');
    assert.ok(!ids.includes('steel-defender'), 'een Wizard krijgt geen Steel Defender');
    assert.ok(!ids.includes('summon-beast'), 'Summon Beast staat niet in zijn boek');

    const b = await req(server, 'GET', `/api/characters/${BAR}/summons`, null, ander);
    assert.deepEqual(b.body.aanbod, [], 'een Barbarian roept niets op');
  });

  it('kent de gedaantes die wij hebben, en zegt het van de rest', async () => {
    const r = await req(server, 'GET', `/api/characters/${WIZ}/summons`, null, speler);
    const fam = r.body.aanbod.find(x => x.id === 'familiar');
    assert.equal(fam.vormen.length, 14);
    assert.ok(fam.vormen.every(v => v.bekend), 'alle veertien zijn gewone SRD-beesten');
    assert.equal(fam.bekend, true);
  });

  it('roept er een op, met het statblok dat wij kennen', async () => {
    const r = await req(server, 'POST', `/api/characters/${WIZ}/summons`,
      { metgezelId: 'familiar', vorm: 'Owl', naam: 'Hermelien' }, speler);
    assert.equal(r.status, 201);
    assert.equal(summons().length, 1);
    const s = summons()[0];
    assert.equal(s.naam, 'Hermelien');
    assert.equal(s.vorm, 'Owl');
    assert.ok(s.statblock, 'een Owl staat in de SRD, dus zijn statblok gaat mee');
    // Een statblok schrijft zijn HP als "1 (1d4 - 1)". Wie de leestekens
    // wegstreept en dán parseert, geeft die uil 114 HP.
    assert.equal(s.maxHp, 1, 'het gemiddelde vooraan, niet de hele regel aan elkaar geplakt');
    assert.equal(s.ac, '11');
    assert.equal(r.body.opKaart, false, 'er loopt geen gevecht');
  });

  it('weigert een gedaante die niet in zijn lijst staat', async () => {
    const r = await req(server, 'POST', `/api/characters/${WIZ}/summons`,
      { metgezelId: 'familiar', vorm: 'Ancient Red Dragon' }, speler);
    assert.equal(r.status, 409);
    assert.equal(summons().length, 1);
  });

  it('weigert iets wat deze speler niet kan oproepen', async () => {
    const r = await req(server, 'POST', `/api/characters/${BAR}/summons`,
      { metgezelId: 'familiar', vorm: 'Owl' }, ander);
    assert.equal(r.status, 409);
  });

  it('laat een speler niet bij andermans summons', async () => {
    const r = await req(server, 'GET', `/api/characters/${WIZ}/summons`, null, ander);
    assert.equal(r.status, 403);
  });

  it('vraagt om cijfers als het statblok in een boek staat — en onthoudt ze', async () => {
    // Summon Beast erbij in zijn boek: zijn Bestial Spirit heeft geen statblok
    // dat wij mogen meeleveren, en zijn cijfers hangen bovendien af van het
    // slotniveau. Dus vraagt de app ze.
    const st = lees('dm-state.json');
    st.playerSpells[WIZ].push({ index: 'summon-beast', name: 'Summon Beast' });
    schrijf('dm-state.json', st);

    const kaal = await req(server, 'POST', `/api/characters/${WIZ}/summons`, { metgezelId: 'summon-beast' }, speler);
    assert.equal(kaal.status, 409);
    assert.equal(kaal.body.vraag, true, 'en hij zegt dát hij erom vraagt');

    const r = await req(server, 'POST', `/api/characters/${WIZ}/summons`,
      { metgezelId: 'summon-beast', naam: 'Beer', hp: '30', ac: '13' }, speler);
    assert.equal(r.status, 201);
    assert.equal(summons().length, 2);
    assert.equal(summons()[1].maxHp, 30);
    assert.equal(summons()[1].ac, '13');
    assert.equal(summons()[1].statblock, null, 'we verzinnen er geen');

    const na = await req(server, 'GET', `/api/characters/${WIZ}/summons`, null, speler);
    const def = na.body.aanbod.find(x => x.id === 'summon-beast');
    assert.deepEqual(def.onthouden, { naam: 'Beer', hp: 30, ac: '13', vorm: '' },
      'de tweede keer is dit één klik');
  });

  it('zet de staande summons op de kaart zodra een gevecht begint', async () => {
    await req(server, 'POST', '/api/combat/combatant',
      { name: 'Proefmagiër', entityId: WIZ, type: 'player', initiative: 17, hp: 30, maxHp: 30 }, dm);
    const r = await req(server, 'POST', '/api/combat/start', {}, dm);
    assert.equal(r.status, 200);
    const sum = r.body.combatants.filter(c => c.type === 'summon');
    assert.equal(sum.length, 2, 'allebei staan erop');
    assert.ok(sum.every(c => c.ownerId === WIZ));
    assert.ok(sum.every(c => c.initiative === 17), 'met het initiatief van hun baasje');
  });

  it('zet een nieuwe meteen op de kaart zolang het gevecht loopt', async () => {
    const r = await req(server, 'POST', `/api/characters/${WIZ}/summons`,
      { metgezelId: 'familiar', vorm: 'Cat', naam: 'Kat' }, speler);
    assert.equal(r.body.opKaart, true);
    const c = JSON.parse(fs.readFileSync(path.join(pad(), 'combat.json'), 'utf8'));
    assert.ok(c.combatants.some(x => x.name === 'Kat' && x.initiative === 17));
  });

  it('haalt hem van de kaart af als je hem wegstuurt', async () => {
    const lijst = summons();
    const kat = lijst.find(s => s.naam === 'Kat');
    const r = await req(server, 'DELETE', `/api/characters/${WIZ}/summons/${kat.id}`, null, speler);
    assert.equal(r.status, 200);
    assert.ok(!summons().some(s => s.naam === 'Kat'));
    const c = JSON.parse(fs.readFileSync(path.join(pad(), 'combat.json'), 'utf8'));
    assert.ok(!c.combatants.some(x => x.name === 'Kat'), 'wegsturen is wegsturen');
  });

  it('overleeft het sluiten van het gevecht — hij staat niet in combat.json', async () => {
    await req(server, 'DELETE', '/api/combat', null, dm);
    assert.equal(summons().length, 2, 'Hermelien en de Beer lopen gewoon door');
  });

  it('zegt het als er een nacht overheen ging', async () => {
    const voor = await req(server, 'GET', `/api/characters/${WIZ}/summons`, null, speler);
    assert.ok(voor.body.summons.every(s => !s.oud), 'ze zijn van ná de laatste rust');
    const st = lees('dm-state.json');
    st.groups[GROEP].rustTellers.long = 4;
    schrijf('dm-state.json', st);
    const na = await req(server, 'GET', `/api/characters/${WIZ}/summons`, null, speler);
    assert.ok(na.body.summons.every(s => s.oud),
      'de app wist niets — welke summon een nacht overleeft staat in teksten die we niet hebben — maar ze zégt het');
  });

  it('zet hem bij wie er met de party meeloopt', async () => {
    const r = await req(server, 'GET', '/api/companions', null, speler);
    assert.equal(r.status, 200);
    const mee = r.body.filter(c => c.soort === 'summon');
    assert.equal(mee.length, 2);
    assert.equal(mee[0].baasje, 'Proefmagiër');
    assert.ok(!mee[0].huurling);
  });
});
