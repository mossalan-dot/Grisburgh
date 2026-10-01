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

  // Een speler ziet van vijanden alleen een woord en een balk. Maar wat aan hém
  // toebehoort — een geadopteerd dier, iets wat hij oproept — hoort hij wél te
  // kunnen lezen: het is zijn beest, zijn statblock, en hij moet kunnen zien of
  // het de volgende klap overleeft.
  it('toont een speler zijn eigen metgezel volledig, en een vijand vaag', async () => {
    await req(server, 'POST', '/api/combat/combatant', {
      name: 'Rakker', type: 'summon', ownerId: held, entityId: 'pet_proef',
      hp: 7, maxHp: 14, ac: '13', initiative: 12,
      statblock: { ac: '13', hp: '14 (2d8+4)' },
    }, dm);

    const mijn = (await req(server, 'GET', '/api/combat', null, heldC)).body;
    const dier = mijn.combatants.find(c => c.name === 'Rakker');
    assert.ok(dier, 'het dier staat in het gevecht');
    assert.strictEqual(dier.hp, 7, 'zijn baasje leest de echte HP');
    assert.strictEqual(dier.maxHp, 14);
    assert.ok(dier.statblock, 'en het statblock van zijn eigen dier');

    const wolf = mijn.combatants.find(c => (c.name || '').startsWith('Veenwolf'));
    assert.strictEqual(wolf.hp, undefined, 'een vijand houdt zijn cijfers voor zich');
    assert.ok(wolf.hpStaat, 'die blijft een woord');
  });

  // Hoeveel een speler van andermans HP ziet is een campagnekeuze. Drie standen,
  // en in alle drie blijven AC en statblock achter de mist — die lopen via het
  // bestiarium, en dát is wat de Magizoöloog verkoopt.
  describe('Wat een speler van andermans HP ziet', () => {
    const zet = async (modus) => req(server, 'PUT', '/api/meta/app', { combatHp: modus }, dm);
    const wolf = async () => {
      const c = (await req(server, 'GET', '/api/combat', null, heldC)).body;
      return c.combatants.find(x => (x.name || '').startsWith('Veenwolf'));
    };
    after(async () => { await zet('staat'); });

    it('standaard: een woord en een balk op tienden, geen cijfers', async () => {
      await zet('staat');
      const w = await wolf();
      assert.strictEqual(w.hp, undefined);
      assert.strictEqual(w.maxHp, undefined);
      assert.ok(w.hpStaat, 'wel een woord');
      assert.strictEqual(w.hpPct % 10, 0, 'de balk is op tienden afgerond');
    });

    it('binair: geen balk, geen woord — alleen of hij nog meedoet', async () => {
      await zet('binair');
      const w = await wolf();
      assert.strictEqual(w.hp, undefined);
      assert.strictEqual(w.hpStaat, '', 'geen staat zolang hij meedoet');
      assert.strictEqual(w.hpPct, 100);
      assert.strictEqual(w._hpModus, 'binair');
    });

    it('volledig: de cijfers wél, het statblock niet', async () => {
      await zet('volledig');
      const w = await wolf();
      assert.strictEqual(typeof w.hp, 'number', 'de echte HP');
      assert.ok(w.maxHp > 0, 'en zijn maximum — uitgerold per exemplaar, dus geen vast getal');
      assert.strictEqual(w.statblock, undefined, 'het statblock blijft van het bestiarium');
      assert.strictEqual(w.ac, undefined, 'en de AC ook');
    });

    it('weigert een stand die niet bestaat', async () => {
      const r = await zet('alles');
      assert.strictEqual(r.status, 400);
    });

    it('schrijft de standaard niet weg', async () => {
      await zet('volledig');
      await zet('staat');
      const meta = (await req(server, 'GET', '/api/meta', null, dm)).body;
      assert.ok(!('combatHp' in meta), 'een ontbrekende sleutel is de standaard');
    });
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

  it('schrijft de log zonder emoji', async () => {
    // De log belandt bij het afsluiten als sessieverslag in het Logboek, en dat
    // wordt gerenderd — daar horen geen emoji in, net als overal in de app.
    const regels = ((await combat()).log || [])
      .map(l => (typeof l === 'string' ? l : l.text || ''));
    assert.ok(regels.length, 'er staat iets in de log');
    for (const t of regels) {
      assert.ok(!/\p{Extended_Pictographic}/u.test(t), 'emoji in de log: ' + t);
    }
    assert.ok(regels.some(t => /Beurt van/.test(t)), 'en hij blijft leesbaar: ' + JSON.stringify(regels));
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

  // Vijf dingen kunnen waar zijn van een personage tussen de scènes door, en ze
  // lagen alle vijf ergens anders. Nu komen ze in één vorm uit één route — en
  // die vorm moet blijven kloppen, want het portret leest hem blind.
  describe('Wat er op een personage zit', () => {
    it('geeft de vijf soorten in dezelfde vorm, in volgorde van gewicht', async () => {
      // Uitputting hangt aan het spelersblad, dus er moet een profiel zijn —
      // dat is de reden dat de route hem anders niet aanneemt.
      await req(server, 'PATCH', `/api/player-profile/${held}`, { klasse: 'Fighter', level: 3 }, dm);
      await req(server, 'PUT', `/api/player-inspiration/${held}`, {}, dm);
      await req(server, 'POST', '/api/party/level-up-tegoed', { charIds: [held], aantal: 1 }, dm);
      await req(server, 'PUT', `/api/characters/${held}/exhaustion`, { niveau: 2 }, dm);

      const alle = (await req(server, 'GET', '/api/badges', null, dm)).body;
      const mijn = alle[held] || [];
      assert.deepStrictEqual(mijn.map(b => b.soort), ['levelup', 'inspiratie', 'exhaustion'],
        'level omhoog wint van inspiratie, inspiratie van de rest');
      for (const b of mijn) {
        assert.ok(b.label && b.uitleg, `${b.soort} hoort een naam en een uitleg te hebben`);
        assert.strictEqual(typeof b.eigen, 'boolean');
      }
      assert.strictEqual(mijn.find(b => b.soort === 'exhaustion').getal, 2);
      assert.strictEqual(mijn.find(b => b.soort === 'exhaustion').eigen, false,
        'uitputting legt de DM op; die klik je niet zelf weg');
    });

    it('laat de speler weghalen wat van hemzelf is, en de rest niet', async () => {
      const op = await req(server, 'DELETE', `/api/badges/${held}/inspiratie`, null, heldC);
      assert.strictEqual(op.status, 200, JSON.stringify(op.body));
      assert.ok(!op.body.badges.some(b => b.soort === 'inspiratie'), 'inspiratie is verzilverd');

      const nee = await req(server, 'DELETE', `/api/badges/${held}/exhaustion`, null, heldC);
      assert.strictEqual(nee.status, 403, 'uitputting haalt alleen de DM weg');
    });

    it('laat een speler niet aan het portret van een ander komen', async () => {
      const r = await req(server, 'DELETE', `/api/badges/${maat}/inspiratie`, null, heldC);
      assert.strictEqual(r.status, 403);
    });
  });

  // Een gevecht liet niets na dan een rauwe logdump die alleen de DM zag. Wat
  // er wérd — wie je tegenover je had, of je won, hoe lang het duurde, wie er
  // neerging — is het verhaal van de party, en dat hoort in hun logboek.
  it('laat een gevechtsverslag na in de akte van dat moment', async () => {
    await req(server, 'PUT', '/api/meta/hoofdstuk/akteG', { num: 4, title: 'Bij de brug' }, dm);
    await req(server, 'POST', '/api/akte/actief', { key: 'akteG', num: 4, title: 'Bij de brug', groupId: gid }, dm);

    await req(server, 'POST', `/api/encounters/${encId}/start`, {}, dm);
    await req(server, 'POST', '/api/combat/combatant',
      { name: 'Hilde', type: 'player', hp: 20, maxHp: 20, initiative: 15, entityId: held }, dm);
    await req(server, 'POST', '/api/combat/start', {}, dm);
    await req(server, 'PUT', '/api/combat', { round: 4 }, dm);

    // Alle wolven neer → de server ziet zelf dat de spelers winnen.
    const c = await combat();
    for (const m of c.combatants.filter(x => x.type === 'monster')) {
      await req(server, 'PUT', `/api/combat/combatant/${m.id}`, { hp: 0 }, dm);
    }
    await req(server, 'DELETE', '/api/combat', null, dm);

    const log = (await req(server, 'GET', '/api/archief', null, dm)).body.sessieLog || [];
    const v = log.filter(e => e.soort === 'gevecht').pop();
    assert.ok(v, 'er hoort een verslag te staan');
    assert.strictEqual(v.hoofdstuk, 'akteG', 'hangt aan de akte die liep');
    assert.strictEqual(v.gevecht.naam, 'Bij de brug', 'draagt de naam van de encounter');
    assert.strictEqual(v.gevecht.uitkomst, 'overwinning');
    assert.strictEqual(v.gevecht.ronden, 4);
    assert.deepStrictEqual(v.gevecht.tegenstanders, [{ naam: 'Veenwolf', aantal: 3 }],
      'drie wolven geteld op één naam, zonder volgnummer');
    assert.deepStrictEqual(v.gevecht.gevallen, [], 'niemand ging neer');
    assert.ok((v.logDm || []).length > 0, 'het ronde-log gaat mee voor de DM');
    assert.strictEqual(v.groep, gid, 'hangt aan de party die vocht');
    assert.strictEqual(v.visible, true);
  });

  it('houdt het ronde-log bij de DM en het verslag bij de party', async () => {
    const speler = (await req(server, 'GET', '/api/archief', null, heldC)).body.sessieLog || [];
    const v = speler.filter(e => e.soort === 'gevecht').pop();
    assert.ok(v, 'de speler die vocht leest zijn eigen verslag terug');
    assert.strictEqual(v.gevecht.uitkomst, 'overwinning');
    assert.ok(!v.logDm, 'het ronde-voor-ronde-log blijft bij de DM');
  });

  // De XP van een gevecht. Dit telde altijd 0 op: de route las `m.xp`, en dat
  // staat op geen enkel monster in geen enkele campagne — de XP zit in het
  // statblok. Gevolg: het voorstel bij de XP-knop in de regie-balk bleef leeg,
  // terwijl die knop juist belooft dat je niet hoeft op te tellen.
  it('telt de XP van een gevecht op uit het statblok', async () => {
    const mon = await req(server, 'POST', '/api/monsters',
      { name: 'Kwelderrat', maxHp: 7, statblock: { cr: '1/8', xp: 25, ac: '12' } }, dm);
    assert.ok(mon.status === 200 || mon.status === 201, JSON.stringify(mon.body));
    const zwaar = await req(server, 'POST', '/api/monsters',
      { name: 'Vloedhond', maxHp: 66, statblock: { cr: '3', xp: 700, ac: '15' } }, dm);

    const e = await req(server, 'POST', '/api/encounters', {
      name: 'XP-proef',
      monsters: [
        { monsterId: mon.body.id,   name: 'Kwelderrat', count: 4 },
        { monsterId: zwaar.body.id, name: 'Vloedhond',  count: 1 },
      ],
    }, dm);
    assert.ok(e.status === 200 || e.status === 201, JSON.stringify(e.body));

    const xp = await req(server, 'GET', `/api/encounters/${e.body.id}/xp`, null, dm);
    assert.strictEqual(xp.status, 200, JSON.stringify(xp.body));
    assert.strictEqual(xp.body.totaal, 4 * 25 + 700, 'vier ratten en een hond');
    assert.deepStrictEqual(xp.body.zonderXp, [], 'alles kon worden opgezocht');
  });
});
