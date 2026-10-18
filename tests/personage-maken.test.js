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

  // ── Fase 2: wat hij kent en wat hij draagt ────────────────────────────────
  it('schrijft spreuken, spullen en goud weg bij het gunnen', async () => {
    const start = await req(server, 'POST', '/api/personage-concept',
      { wachtwoord: 'rinkeldekink', naam: 'Zwaantje' });
    const speler = start.cookie;
    const id = start.body.concept.id;
    assert.ok(start.body.bronnen.spreuken.length > 300, 'de spreuken gaan kaal mee');
    assert.ok(start.body.bronnen.wapens.length > 20, 'en de wapens');
    assert.ok(start.body.bronnen.tellers.Cleric, 'en de tellers');
    const bgAcolyte = start.body.bronnen.backgrounds.find(b => b.naam === 'Acolyte');
    assert.equal(bgAcolyte.opties.length, 2, 'de A-of-B van zijn background staat uit elkaar');
    assert.equal(bgAcolyte.opties[1].goud, 50);

    const guidance = start.body.bronnen.spreuken.find(sp => sp.naam === 'Guidance');
    const r = await req(server, 'PATCH', `/api/personage-concept/${id}`, {
      species: 'Human', klasse: 'Cleric', background: 'Acolyte', level: 1, methode: 'array',
      scores: { str: 13, dex: 12, con: 14, int: 10, wis: 15, cha: 8 },
      skills: ['Medicine', 'History'],
      spreuken: [guidance.index],
      bgOptie: 'A', harnas: 'srd-2024_scale-mail', schild: true, wapen: 'srd-2024_mace',
    }, speler);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    // Scale mail 14 + Dex 1 (cap 2) + schild 2
    assert.equal(r.body.profiel.ac, '17', 'het harnas telt mee in de AC');
    assert.ok(r.body.slots['1'], 'een Cleric van level 1 heeft slots');

    await req(server, 'POST', `/api/personage-concept/${id}/indienen`, null, speler);
    const gegund = await req(server, 'POST', `/api/personage-concept/${id}/gunnen`, null, dm);
    const eid = gegund.body.entityId;
    const st = dmState();
    assert.ok((st.playerSpells[eid] || []).some(sp => sp.name === 'Guidance'), 'de spreuk staat in zijn boek');
    const spullen = (st.playerItems[eid] || []).map(i => i.name);
    assert.ok(spullen.includes('Holy Symbol'), 'wat zijn background gaf');
    assert.ok(spullen.includes('Scale Mail'), 'en wat hij koos');
    assert.ok(spullen.includes('Shield'));
    assert.equal(st.playerCurrency[eid].fl, 8, 'en het goud van optie A');
  });

  it('rolt één keer op de trinkettafel van de DM', async () => {
    const tafel = await req(server, 'POST', '/api/tables',
      { name: 'Rommel', type: 'list', entries: ['Een gedeukte vingerhoed'] }, dm);
    assert.equal(tafel.status, 201, JSON.stringify(tafel.body));
    await req(server, 'PUT', '/api/meta/personage-maken',
      { aan: true, maxLevel: 1, trinketTafel: tafel.body.id }, dm);

    const start = await req(server, 'POST', '/api/personage-concept',
      { wachtwoord: 'rinkeldekink', naam: 'Fiebe' });
    assert.equal(start.body.bronnen.trinketTafel, 'Rommel', 'de wizard weet hoe de tafel heet');
    const r = await req(server, 'POST', `/api/personage-concept/${start.body.concept.id}/trinket`, null, start.cookie);
    assert.equal(r.body.trinket, 'Een gedeukte vingerhoed');
    // Nog eens rollen tot je iets leuks hebt is geen worp meer.
    const nogmaals = await req(server, 'POST', `/api/personage-concept/${start.body.concept.id}/trinket`, null, start.cookie);
    assert.equal(nogmaals.body.alGerold, true);
    await req(server, 'PUT', '/api/meta/personage-maken', { aan: true, maxLevel: 1 }, dm);
  });

  it('zegt dat een ability score improvement er niet in zit', async () => {
    const start = await req(server, 'POST', '/api/personage-concept',
      { wachtwoord: 'rinkeldekink', naam: 'Boudewijn' });
    const r = await req(server, 'PATCH', `/api/personage-concept/${start.body.concept.id}`,
      { species: 'Human', klasse: 'Fighter', level: 5,
        scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } }, start.cookie);
    assert.ok(r.body.nakijk.opmerkingen.some(o => /improvement|feat/i.test(o)));
    assert.equal(r.body.profiel.profBonus, '+3', 'level 5 rekent mee');
    assert.equal(r.body.profiel.hitDie, '5d10');
  });

  // ── Fase 3: twee classes, een portret en papier ───────────────────────────
  it('verdeelt zijn levels over twee classes', async () => {
    await req(server, 'PUT', '/api/meta/personage-maken', { aan: true, maxLevel: 5 }, dm);
    const start = await req(server, 'POST', '/api/personage-concept',
      { wachtwoord: 'rinkeldekink', naam: 'Hidde' });
    const id = start.body.concept.id;
    const r = await req(server, 'PATCH', `/api/personage-concept/${id}`, {
      species: 'Human', klasse: 'Fighter', level: 5, multiKlasse: 'Rogue', multiKlasseLevel: 2,
      scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      skills: ['Athletics', 'Perception'],
    }, start.cookie);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.profiel.multiclass, 'true');
    assert.equal(r.body.profiel.klasseLevel, '3');
    assert.equal(r.body.profiel.multiKlasseLevel, '2');
    // Elk level telt met de hit die van zijn eigen class.
    assert.equal(r.body.profiel.hitDie, '3d10 + 2d8');

    // Meer levels in de tweede class dan je hebt kan niet.
    const teveel = await req(server, 'PATCH', `/api/personage-concept/${id}`, { multiKlasseLevel: 9 }, start.cookie);
    assert.equal(teveel.body.concept.multiKlasseLevel, 4, 'er blijft minstens één level over voor de eerste');
    await req(server, 'PUT', '/api/meta/personage-maken', { aan: true, maxLevel: 1 }, dm);
  });

  it('waarschuwt als hij de eisen voor multiclassen niet haalt', async () => {
    await req(server, 'PUT', '/api/meta/personage-maken', { aan: true, maxLevel: 5 }, dm);
    const start = await req(server, 'POST', '/api/personage-concept',
      { wachtwoord: 'rinkeldekink', naam: 'Wobbe' });
    const r = await req(server, 'PATCH', `/api/personage-concept/${start.body.concept.id}`, {
      species: 'Human', klasse: 'Wizard', level: 3, multiKlasse: 'Paladin', multiKlasseLevel: 1,
      scores: { str: 8, dex: 14, con: 13, int: 15, wis: 10, cha: 10 },
    }, start.cookie);
    assert.ok(r.body.nakijk.opmerkingen.some(o => /Paladin/.test(o) && /Strength 13/.test(o)),
      'de eis staat erbij, maar hij mag het wel vragen');
    assert.equal(r.body.nakijk.kanWeg, true, 'voorrekenen, niet blokkeren');
    await req(server, 'PUT', '/api/meta/personage-maken', { aan: true, maxLevel: 1 }, dm);
  });

  it('laat een speler zijn eigen blad afdrukken, en dat van een ander niet', async () => {
    // Iemand die alleen het partywachtwoord typte is nog geen personage.
    const bezoeker = await req(server, 'POST', '/api/personage-concept', { wachtwoord: 'rinkeldekink' });
    const zonder = await req(server, 'GET', '/api/mijn/sheet', null, bezoeker.cookie);
    assert.equal(zonder.status, 401);

    // De eerste test maakte Brigitta; die kan inloggen en zijn blad ophalen.
    const spelers = await req(server, 'GET', '/api/auth/players');
    const brigitta = spelers.body.find(p => p.name === 'Brigitta Veenstra');
    assert.ok(brigitta, 'ze staat in de inloglijst');
    const login = await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: brigitta.id, password: 'rinkeldekink' });
    assert.equal(login.status, 200, JSON.stringify(login.body));

    const blad = await req(server, 'GET', '/api/mijn/sheet', null, login.cookie);
    assert.equal(blad.status, 200);
    assert.match(String(blad.body), /Brigitta Veenstra/, 'haar naam staat op het blad');
    assert.match(String(blad.body), /Cleric/);
  });

  // ── Varianten: een species met een tweede laag ────────────────────────────
  it('kent een variant als houder onder een species', async () => {
    // Zoals een subclass onder een class: eigen houder, eigen features.
    const gemaakt = await req(server, 'POST', '/api/progression/houder',
      { soort: 'variant', bron: 'Tiefling', naam: 'Veenlegaat', boek: 'Eigen wereld',
        variantLabel: 'Fiendish Legacy' }, dm);
    assert.equal(gemaakt.status, 200, JSON.stringify(gemaakt.body));

    const feature = await req(server, 'POST', '/api/progression/feature',
      { soort: 'variant', bron: 'Tiefling', sub: 'Veenlegaat', level: 1,
        naam: 'Moerasgloed', desc: 'Hij gloeit.' }, dm);
    assert.equal(feature.status, 200, JSON.stringify(feature.body));

    const prog = JSON.parse(fs.readFileSync(
      path.join(DATA_DIR, 'campaigns', 'grisburgh', 'progression.json'), 'utf8'));
    const v = prog.species.Tiefling.varianten.Veenlegaat;
    assert.ok(v, 'de variant staat onder het species');
    assert.equal(v.levels['1'][0].name, 'Moerasgloed');
    assert.equal(prog.species.Tiefling.variantLabel, 'Fiendish Legacy');

    // En hij kan er ook weer uit, met zijn features mee.
    const weg = await req(server, 'POST', '/api/progression/houder/verwijderen',
      { soort: 'variant', bron: 'Tiefling', naam: 'Veenlegaat' }, dm);
    assert.equal(weg.status, 200, JSON.stringify(weg.body));
    const na = JSON.parse(fs.readFileSync(
      path.join(DATA_DIR, 'campaigns', 'grisburgh', 'progression.json'), 'utf8'));
    assert.equal(na.species.Tiefling.varianten.Veenlegaat, undefined);
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
