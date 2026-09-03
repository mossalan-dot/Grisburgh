const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// ── Campagne-isolatie ────────────────────────────────────────────────────────
// Deze suite beschrijft wat waar moet zijn zódra er een tweede DM op de server
// staat (stap 1 van docs/multi-dm-plan.md). Hij is nu bewust `todo`: de tests
// falen tot die stap gebouwd is, maar houden `npm test` groen zodat ze niet in
// de weg zitten bij ander werk. Draai ze los met `npm run test:isolatie` om de
// echte fouten te zien; haal de todo-vlag hieronder weg zodra stap 1 af is.
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

describe('Campagne-isolatie', { todo: 'wordt groen in stap 1 van docs/multi-dm-plan.md' }, () => {
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
});
