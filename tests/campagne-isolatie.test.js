const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { io: ioClient } = require('socket.io-client');

// ── Campagne-isolatie ────────────────────────────────────────────────────────
// Deze suite bewaakt de scheiding tussen campagnes: één verkeerd afgeleide
// campagne-id en de ene DM schrijft in de gegevens van de andere. Geschreven
// vóór stap 1 van docs/multi-dm-plan.md (toen dertien keer rood), sinds die stap
// een harde poortwachter. Los te draaien met `npm run test:isolatie`.
//
// Alles wat de suite aanneemt over de nog te bouwen API staat in de helpers
// `dmLogin`, `spelerLogin` en `spelerLijst` — kiest de implementatie een andere
// vorm, dan hoeven alleen die drie mee te veranderen.

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-iso-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const CAMPAGNES = path.join(DATA_DIR, 'campaigns');

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
      const brokken = [];
      res.on('data', c => brokken.push(c));
      res.on('end', () => {
        const ruw = Buffer.concat(brokken);
        let parsed; try { parsed = JSON.parse(ruw.toString('utf8')); } catch { parsed = ruw; }
        const setCookie = res.headers['set-cookie'];
        resolve({ status: res.statusCode, body: parsed, bytes: ruw.length,
                  cookie: setCookie ? setCookie[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

// ── Aannames over de nieuwe API ──
// De campagne komt uit de URL en wordt bij het inloggen aan de sessie gebonden.
const dmLogin     = (s, campagne, wachtwoord)   => req(s, 'POST', '/api/auth/login', { campagne, password: wachtwoord });
const spelerLogin = (s, campagne, id, wachtwoord) => req(s, 'POST', '/api/auth/player-login', { campagne, characterId: id, password: wachtwoord });
// De landingspagina is voor iedereen te bezoeken, dus deze mág zonder sessie.
const spelerLijst = (s, campagne)               => req(s, 'GET', `/api/auth/players?campagne=${encodeURIComponent(campagne)}`);

// Een onmiskenbare tekenreeks die alleen in campagne alfa voorkomt. Duikt hij
// op in een antwoord dat je als DM van beta krijgt, dan lekt er iets.
// Bewust NIET in meta.appTitle: campagnetitels zijn publiek, die heeft de
// landingspagina nodig.
const KANARIE = 'KANARIE-ALFA-8f3c1d';

// Alle GET-routes rechtstreeks uit de Express-router, met de pad-parameters
// ingevuld met échte ids uit alfa. Zo groeit de veegtest vanzelf mee met elk
// endpoint dat er later bij komt — bij driehonderd endpoints is een
// handgeschreven lijst binnen een maand achterhaald.
//
// Het invullen van parameters is geen bijzaak: bij de eerste opzet sloeg de
// veeg alle routes mét parameter over, en dat is nou net waar de inhoud zit
// (`/entities/:type`, `/files/:id`, `/player-profile/:characterId`). De kanarie
// werd toen op twee van de vijftig routes gevonden in plaats van overal.
function getRoutes(waarden) {
  const router = require('../routes/api');
  const paden = router.stack
    .filter(laag => laag.route && laag.route.methods.get)
    .map(laag => laag.route.path)
    .filter(pad => !pad.includes('*'));

  const gevuld = [], ongedekt = [];
  for (const pad of paden) {
    const params = pad.match(/:[a-zA-Z]+/g) || [];
    if (params.some(par => !(par in waarden))) { ongedekt.push(pad); continue; }
    gevuld.push(params.reduce((p, par) => p.replace(par, waarden[par]), pad));
  }
  return { gevuld, ongedekt };
}

// Wacht op een socket-event, of geef null terug als het binnen ms niet komt.
function wachtOp(socket, event, ms = 600) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

function verbind(port, cookie) {
  const opts = { transports: ['polling'], forceNew: true };
  if (cookie) opts.extraHeaders = { Cookie: cookie };
  const s = ioClient(`http://localhost:${port}`, opts);
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

// Een test die zegt "dit mag niet" bewijst niets zolang de gewone weg óók
// stukloopt — dan slaagt hij omdat er helemaal niets werkt. Elke kruislingse
// test begint daarom met de legitieme handeling; die moet éérst lukken.
function moetLukken(res, wat) {
  assert.ok(res.status >= 200 && res.status < 300, `${wat} hoort gewoon te werken (kreeg ${res.status})`);
  return res;
}

// Zet een campagne klaar met één speler-personage, een portret bij dat
// personage en een geheim document — precies de drie dingen waar de scheiding
// op stuk kan gaan.
function zetCampagneKlaar(storage, id, { dmWachtwoord, groepWachtwoord, spelerNaam }) {
  storage.createCampaign(id, { appTitle: id });
  const dir = path.join(CAMPAGNES, id);
  const spelerId  = `e_${id}_speler`;
  const geheimId  = `doc_${id}_geheim`;

  const entities = JSON.parse(fs.readFileSync(path.join(dir, 'entities.json'), 'utf8'));
  entities.personages.push({ id: spelerId, name: spelerNaam, subtype: 'speler', data: { groep: 'groep1' } });
  fs.writeFileSync(path.join(dir, 'entities.json'), JSON.stringify(entities, null, 2));

  const dmState = JSON.parse(fs.readFileSync(path.join(dir, 'dm-state.json'), 'utf8'));
  dmState.groups.groep1.password = groepWachtwoord;
  dmState.dmPassword = dmWachtwoord;          // per campagne, niet meer uit de env
  fs.writeFileSync(path.join(dir, 'dm-state.json'), JSON.stringify(dmState, null, 2));

  fs.writeFileSync(path.join(dir, 'files', `${spelerId}.png`), Buffer.from(`portret-${id}`));
  fs.writeFileSync(path.join(dir, 'files', `${geheimId}.png`), Buffer.from(`geheim-${id}`));
  return { spelerId, geheimId };
}

// Strooi de kanarie door de inhoudsbestanden van een campagne, zodat de
// veegtest hem via zo veel mogelijk endpoints kán tegenkomen.
function zaaiKanarie(id) {
  const dir = path.join(CAMPAGNES, id);
  const lees = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const schrijf = (f, v) => fs.writeFileSync(path.join(dir, f), JSON.stringify(v, null, 2));

  const entities = lees('entities.json');
  for (const soort of ['personages', 'locaties', 'organisaties', 'voorwerpen']) {
    entities[soort].push({ id: `e_${soort}_kanarie`, name: `${KANARIE} ${soort}`, data: { desc: KANARIE } });
  }
  schrijf('entities.json', entities);

  const archief = lees('archief.json');
  archief.documents.push({ id: 'doc_kanarie', title: KANARIE, content: KANARIE });
  archief.logEntries.push({ id: 'log_kanarie', text: KANARIE });
  schrijf('archief.json', archief);

  schrijf('monsters.json', [{ id: 'mon_kanarie', name: KANARIE, cr: '1' }]);
  schrijf('tables.json', { tables: [{ id: 'tbl_kanarie', name: KANARIE, rows: [KANARIE] }] });

  const dmState = lees('dm-state.json');
  dmState.dmNotes = { kanarie: KANARIE };
  schrijf('dm-state.json', dmState);
}

describe('Campagne-isolatie', () => {
  let server, io, storage, alfa, beta;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));

    alfa = zetCampagneKlaar(storage, 'alfa', { dmWachtwoord: 'alfa-dm', groepWachtwoord: 'alfa-groep', spelerNaam: 'Lyra' });
    // Bewust dezelfde personagenaam in beide campagnes.
    beta = zetCampagneKlaar(storage, 'beta', { dmWachtwoord: 'beta-dm', groepWachtwoord: 'beta-groep', spelerNaam: 'Lyra' });
    zaaiKanarie('alfa');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  // ── De personagekiezer op de landingspagina ──
  it('toont per campagne alleen de eigen personages', async () => {
    const lijst = await spelerLijst(server, 'beta');
    assert.equal(lijst.status, 200);
    const ids = (Array.isArray(lijst.body) ? lijst.body : lijst.body?.players || []).map(p => p.id);
    assert.ok(ids.includes(beta.spelerId), 'de speler van beta hoort in de lijst');
    assert.ok(!ids.includes(alfa.spelerId), 'de speler van alfa hoort er niet in — ook niet als hij dezelfde naam heeft');
  });

  // ── De DM ──
  it('weigert een DM-login zonder campagne', async () => {
    moetLukken(await dmLogin(server, 'alfa', 'alfa-dm'), 'inloggen mét campagne');
    const r = await req(server, 'POST', '/api/auth/login', { password: 'alfa-dm' });
    assert.ok(r.status >= 400, 'zonder campagne mag er niet stilletjes een standaardcampagne gekozen worden');
  });

  it('laat een DM alleen het wachtwoord van zijn eigen campagne gebruiken', async () => {
    moetLukken(await dmLogin(server, 'alfa', 'alfa-dm'), 'inloggen op de eigen campagne');
    const kruislings = await dmLogin(server, 'alfa', 'beta-dm');
    assert.ok(kruislings.status >= 400, 'het DM-wachtwoord van beta hoort niet te werken op alfa');
  });

  it('geeft een DM alleen de entiteiten van zijn eigen campagne', async () => {
    const { cookie } = moetLukken(await dmLogin(server, 'beta', 'beta-dm'), 'inloggen als DM van beta');
    const r = await req(server, 'GET', '/api/entities/personages', null, cookie);
    assert.equal(r.status, 200);
    const namen = (r.body || []).map(e => e.id);
    assert.ok(namen.includes(beta.spelerId));
    assert.ok(!namen.includes(alfa.spelerId), 'beta mag de personages van alfa niet zien');
  });

  it('laat een DM niet schrijven in een andere campagne', async () => {
    const { cookie } = moetLukken(await dmLogin(server, 'beta', 'beta-dm'), 'inloggen als DM van beta');
    moetLukken(await req(server, 'POST', '/api/entities/personages', { name: 'Indringer', subtype: 'personage' }, cookie),
      'een personage aanmaken in de eigen campagne');
    const alfaEntities = JSON.parse(fs.readFileSync(path.join(CAMPAGNES, 'alfa', 'entities.json'), 'utf8'));
    const namen = alfaEntities.personages.map(e => e.name);
    assert.ok(!namen.includes('Indringer'), 'wat beta aanmaakt hoort nooit in de map van alfa te landen');
  });

  it('laat één wachtwoordveld de rol bepalen, per campagne', async () => {
    const dm = await req(server, 'POST', '/api/auth/toegang', { campagne: 'alfa', wachtwoord: 'alfa-dm' });
    assert.equal(dm.status, 200);
    assert.equal(dm.body.rol, 'dm');

    const groep = await req(server, 'POST', '/api/auth/toegang', { campagne: 'alfa', wachtwoord: 'alfa-groep' });
    assert.equal(groep.body.rol, 'groep', 'een groepswachtwoord geeft de personages van die party');
    assert.ok(groep.body.personages.some(p => p.id === alfa.spelerId));

    // Het wachtwoord van de buurcampagne opent hier niets.
    const kruislings = await req(server, 'POST', '/api/auth/toegang', { campagne: 'alfa', wachtwoord: 'beta-groep' });
    assert.equal(kruislings.status, 401);
  });

  // ── De speler ──
  it('laat een speler geen personage uit een andere campagne kiezen', async () => {
    moetLukken(await spelerLogin(server, 'alfa', alfa.spelerId, 'alfa-groep'), 'inloggen op het eigen personage');
    const r = await spelerLogin(server, 'alfa', beta.spelerId, 'alfa-groep');
    assert.ok(r.status >= 400, 'een personage-id uit beta hoort op alfa niet te bestaan');
  });

  it('laat een groepswachtwoord niet werken in een andere campagne', async () => {
    moetLukken(await spelerLogin(server, 'alfa', alfa.spelerId, 'alfa-groep'), 'inloggen met het eigen groepswachtwoord');
    const r = await spelerLogin(server, 'alfa', alfa.spelerId, 'beta-groep');
    assert.ok(r.status >= 400, 'het groepswachtwoord van beta hoort op alfa niets te openen');
  });

  // ── Bestanden ──
  // De landingspagina toont portretten aan wie nog niet is ingelogd. Dat is de
  // énige reden dat er iets publiek mag zijn, dus precies die portretten — en
  // niets anders.
  it('geeft het portret van een personage uit de personagekiezer wél zonder sessie', async () => {
    const r = await req(server, 'GET', `/api/files/${alfa.spelerId}?campagne=alfa`);
    assert.equal(r.status, 200, 'anders is de landingspagina leeg voordat je inlogt');
  });

  it('geeft ieder ander bestand niet zonder sessie', async () => {
    const r = await req(server, 'GET', `/api/files/${alfa.geheimId}?campagne=alfa`);
    assert.equal(r.status, 401, 'een document is geen landingsportret');
  });

  it('geeft ook geen thumbnail van een ander bestand zonder sessie', async () => {
    const r = await req(server, 'GET', `/api/thumb/${alfa.geheimId}?campagne=alfa`);
    assert.equal(r.status, 401);
  });

  it('laat een ingelogde DM geen bestand uit een andere campagne ophalen', async () => {
    const { cookie } = moetLukken(await dmLogin(server, 'beta', 'beta-dm'), 'inloggen als DM van beta');
    moetLukken(await req(server, 'GET', `/api/files/${beta.geheimId}`, null, cookie), 'het eigen bestand ophalen');
    const r = await req(server, 'GET', `/api/files/${alfa.geheimId}`, null, cookie);
    assert.ok(r.status >= 400, 'beta mag niet bij de uploads van alfa');
    assert.ok(!String(r.body).includes('geheim-alfa'), 'en de inhoud mag al helemaal niet meekomen');
  });

  // ── De veegtest ──
  // Elf handgeschreven tests dekken zes van de ruim driehonderd endpoints. Deze
  // loopt ze allemaal af die zonder pad-parameter te bereiken zijn, en groeit
  // dus mee met elk endpoint dat er later bij komt.
  it('lekt via geen enkele GET-route inhoud van een andere campagne', async (t) => {
    // De parameters worden gevuld met echte ids uit alfa — dat ís de aanval:
    // de DM van beta die het id van iemand anders opvraagt.
    const { gevuld: paden, ongedekt } = getRoutes({
      ':type': 'personages',
      ':id': 'e_personages_kanarie',
      ':entityId': 'e_personages_kanarie',
      ':characterId': alfa.spelerId,
      ':shopId': 'e_personages_kanarie',
      ':npcId': 'e_personages_kanarie',
      ':petId': 'e_personages_kanarie',
      ':key': 'h1',
      ':index': 'goblin',
      ':dienst': 'herberg',
    });
    assert.ok(paden.length > 60, `de router hoort tientallen GET-routes te hebben, gevonden: ${paden.length} — klopt de enumeratie nog?`);
    if (ongedekt.length) t.diagnostic(`niet geveegd (onbekende parameter): ${ongedekt.join(', ')}`);

    // Positieve controle: de kanarie moet vanuit alfa wél te zien zijn, anders
    // zegt een schone veegbeurt alleen dat het zaaien mislukt is.
    const alfaSessie = moetLukken(await dmLogin(server, 'alfa', 'alfa-dm'), 'inloggen als DM van alfa');
    const eigen = await req(server, 'GET', '/api/monsters', null, alfaSessie.cookie);
    assert.ok(JSON.stringify(eigen.body).includes(KANARIE), 'de kanarie hoort in de eigen campagne gewoon zichtbaar te zijn');

    const { cookie } = moetLukken(await dmLogin(server, 'beta', 'beta-dm'), 'inloggen als DM van beta');
    const lekken = [];
    for (const pad of paden) {
      const r = await req(server, 'GET', `/api${pad}`, null, cookie);
      const tekst = Buffer.isBuffer(r.body) ? r.body.toString('utf8')
                  : typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? '');
      if (tekst.includes(KANARIE)) lekken.push(pad);
    }
    assert.deepEqual(lekken, [], `deze routes gaven de DM van beta inhoud uit alfa: ${lekken.join(', ')}`);
    // De veeg zoekt op tekst; een bestand komt binnen als bytes. Die apart.
    const bestand = await req(server, 'GET', `/api/files/${alfa.geheimId}`, null, cookie);
    assert.ok(!bestand.body?.toString?.().includes('geheim-alfa'), 'ook de inhoud van een bestand mag niet meekomen');
  });

  it('zet het tafelscherm in de campagne waar het bij hoort', async () => {
    // Zonder campagne-id landt de socket van de tablet in de algemene kamer en
    // mist hij alles wat de DM uitzendt.
    process.env.TABLET_PASSWORD = process.env.TABLET_PASSWORD || '';
    const r = await req(server, 'POST', '/api/auth/tablet-login', { campagne: 'beta', password: 'x' });
    // Zonder ingesteld tabletwachtwoord is de login uitgeschakeld (403) — dan is
    // er ook niets te scopen. Wél of niet: nooit een 200 zonder campagne-id.
    if (r.status === 200) assert.equal(r.body.campagne, 'beta');
    else assert.ok([401, 403].includes(r.status), `onverwachte status ${r.status}`);
  });

  // ── De socketkamer ──
  // server.js laat een verbinding zonder campaignId in de room 'main' landen.
  // Twee DM's die daar allebei in zitten, zien elkaars live-updates.
  it('stuurt live-updates alleen naar de eigen campagne', async () => {
    const port = server.address().port;
    const alfaSessie = moetLukken(await dmLogin(server, 'alfa', 'alfa-dm'), 'inloggen als DM van alfa');
    const betaSessie = moetLukken(await dmLogin(server, 'beta', 'beta-dm'), 'inloggen als DM van beta');

    const alfaSocket = await verbind(port, alfaSessie.cookie);
    const betaSocket = await verbind(port, betaSessie.cookie);
    try {
      const bijAlfa = wachtOp(alfaSocket, 'entity:updated');
      const bijBeta = wachtOp(betaSocket, 'entity:updated');
      await req(server, 'PUT', `/api/entities/personages/${alfa.spelerId}`, { name: 'Lyra de Herziene' }, alfaSessie.cookie);

      // Positieve controle eerst: hoort de eigen campagne het wél?
      assert.ok(await bijAlfa, 'de DM van alfa hoort zijn eigen wijziging te zien');
      assert.equal(await bijBeta, null, 'de DM van beta hoort er niets van te merken');
    } finally {
      alfaSocket.close();
      betaSocket.close();
    }
  });
});
