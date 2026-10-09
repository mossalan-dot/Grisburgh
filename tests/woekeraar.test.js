const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De woekeraar: zijn eigen deur. Je leent niet alleen omdat je verloren hebt,
// en het gaat langs de DM — een woekeraar die automatisch ja zegt is een
// geldautomaat.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-wk-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('De woekeraar', () => {
  let server, io, dm, spelerC, speler;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    const gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);
    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Schuldenaar', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;
    assert.ok(spelerC, 'de speler is ingelogd');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  let verzoekId = null;

  it('neemt een leenverzoek aan, met waarvoor erbij', async () => {
    const r = await req(server, 'POST', '/api/woekeraar/verzoek',
      { bedrag: { fl: 0, kn: 0, cl: 2000 }, waarvoor: 'Losgeld voor mijn broer' }, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.verzoek.waarvoor, 'Losgeld voor mijn broer');
    verzoekId = r.body.verzoek.id;

    const tweede = await req(server, 'POST', '/api/woekeraar/verzoek',
      { bedrag: { fl: 0, kn: 0, cl: 100 } }, spelerC);
    assert.strictEqual(tweede.status, 409, 'twee verzoeken tegelijk kan niet');
  });

  it('laat de DM afdingen bij het goedkeuren', async () => {
    // Hij vroeg 2000 cl; de DM maakt er 1500 van. Dat is het afdingen dat aan
    // tafel gebeurt, en het hoort hier te kunnen.
    const r = await req(server, 'POST', `/api/woekeraar/verzoek/${verzoekId}/approve`,
      { bedrag: { fl: 15, kn: 0, cl: 0 } }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.schuld.hoofdsomCl, 1500, 'wat de DM ervan maakte');
    assert.strictEqual(r.body.schuld.waarvoor, 'Losgeld voor mijn broer', 'en waarvoor blijft erbij staan');

    const reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    assert.ok(reg.some(x => x.bron === 'woekeraar' && x.hoofdsomCl === 1500), 'hij staat in het register');

    const items = (await req(server, 'GET', `/api/player-items/${speler}`, null, spelerC)).body;
    const lijst = Array.isArray(items) ? items : (items.items || []);
    assert.ok(lijst.some(i => /Schuldbewijs/.test(i.name || '')), 'met een schuldbewijs in de boedel');
  });

  it('houdt het bij één schuld tegelijk', async () => {
    const r = await req(server, 'POST', '/api/woekeraar/verzoek',
      { bedrag: { fl: 0, kn: 0, cl: 100 } }, spelerC);
    assert.strictEqual(r.status, 409, JSON.stringify(r.body));
    assert.match(r.body.error, /al een schuld/);
  });

  // Dit ging bijna mis: de aflosroute kende alleen de lening van het gokhuis,
  // dus een schuld bij de woekeraar was niet te betalen — precies het probleem
  // dat dezelfde dag was opgelost.
  it('laat een schuld uit het register ook aflossen', async () => {
    await req(server, 'PATCH', `/api/player-currency/${speler}`, { fl: 50, kn: 0, cl: 0 }, dm);

    const deel = await req(server, 'POST', '/api/tweespalt/aflossen', { bedrag: { fl: 5, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(deel.status, 200, JSON.stringify(deel.body));
    assert.strictEqual(deel.body.restCl, 1000);

    const reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    const nu = reg.find(x => x.bron === 'woekeraar');
    assert.strictEqual(nu.hoofdsomCl, 1000, 'de rest is de nieuwe hoofdsom');

    const rest = await req(server, 'POST', '/api/tweespalt/aflossen', {}, spelerC);
    assert.strictEqual(rest.body.restCl, 0);
    const leeg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    assert.ok(!leeg.some(x => x.bron === 'woekeraar'), 'en dan is hij weg uit het register');
  });

  it('wijst een weigering af met een reden, in zijn post', async () => {
    const v = await req(server, 'POST', '/api/woekeraar/verzoek',
      { bedrag: { fl: 0, kn: 0, cl: 500 }, waarvoor: 'Een paard' }, spelerC);
    const r = await req(server, 'POST', `/api/woekeraar/verzoek/${v.body.verzoek.id}/reject`,
      { reden: 'Niet aan jou. Niet na vorige keer.' }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const post = (await req(server, 'GET', '/api/berichten', null, spelerC)).body.berichten || [];
    const bericht = post.find(m => /lening/i.test(m.tekst || ''));
    assert.ok(bericht, 'het staat in zijn post: ' + JSON.stringify(post.slice(0, 2)));
    assert.match(bericht.tekst, /Niet na vorige keer/);
  });

  // De-escalatie: sta je hoog genoeg bij een factie met gezag, dan stopt de
  // rente. Geen kwijtschelding — een afspraak.
  it('zet de rente stil als een factie een woordje doet', async () => {
    // Een factie met een drempel, en de schuld die eronder valt.
    const facties = [{ id: 'f_wacht', naam: 'De Stadswacht', renownDrempels: [0, 1, 3, 10] }];
    await req(server, 'PUT', '/api/meta/facties', { facties }, dm);
    await req(server, 'PUT', '/api/meta/woekeraar', { ontspanBij: [{ factieId: 'f_wacht', renown: 3 }] }, dm);

    const v = await req(server, 'POST', '/api/woekeraar/verzoek', { bedrag: { fl: 10, kn: 0, cl: 0 } }, spelerC);
    await req(server, 'POST', `/api/woekeraar/verzoek/${v.body.verzoek.id}/approve`, {}, dm);

    // Zonder aanzien loopt de rente: één nacht erbij.
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    let reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    let mijn = reg.find(x => x.bron === 'woekeraar');
    assert.ok(mijn.stand.huidigVerschuldigdCl > 1000, 'zonder afspraak groeit hij: ' + mijn.stand.huidigVerschuldigdCl);
    assert.ok(!mijn.ontspannen, 'en er is nog geen afspraak');

    // Nu het aanzien omhoog, over de drempel.
    await req(server, 'POST', '/api/facties/f_wacht/renown', { delta: 5 }, dm);

    reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    mijn = reg.find(x => x.bron === 'woekeraar');
    assert.ok(mijn.ontspannen, 'de afspraak staat: ' + JSON.stringify(mijn.ontspannen));
    assert.strictEqual(mijn.ontspannen.naam, 'De Stadswacht');

    // En de rente valt terug: je betaalt wat je leende, en verder niets. Dat
    // gebeurt bij de eerstvolgende nacht, want daar tikt de klok.
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    mijn = reg.find(x => x.bron === 'woekeraar');
    assert.strictEqual(mijn.stand.huidigVerschuldigdCl, 1000, 'terug naar de hoofdsom');

    // En hij blijft daar: nog een nacht verandert niets.
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    mijn = reg.find(x => x.bron === 'woekeraar');
    assert.strictEqual(mijn.stand.huidigVerschuldigdCl, 1000, 'en hij blijft staan');

    // Opruimen: de volgende test wil een schone lei.
    await req(server, 'PATCH', `/api/player-currency/${speler}`, { fl: 50, kn: 0, cl: 0 }, dm);
    await req(server, 'POST', '/api/tweespalt/aflossen', {}, spelerC);
  });

  // De drie trappen. Elke trap is een voorstel: de app rekent, de DM handelt —
  // en bij elke trap hoort een brief.
  it('escaleert per nacht zodra de schuld opgeëist is, met een brief per trap', async () => {
    await req(server, 'PUT', '/api/meta/woekeraar', { escalatie: true, ontspanBij: [] }, dm);
    const v = await req(server, 'POST', '/api/woekeraar/verzoek',
      { bedrag: { fl: 10, kn: 0, cl: 0 }, waarvoor: 'Een paard' }, spelerC);
    const goed = await req(server, 'POST', `/api/woekeraar/verzoek/${v.body.verzoek.id}/approve`, {}, dm);
    const schuldId = goed.body.schuld.id;

    // Zonder opeisen gebeurt er niets: hij groeit alleen.
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    let reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    assert.ok(!reg.find(x => x.id === schuldId).trap, 'nog geen trap zonder opeisen');

    await req(server, 'POST', `/api/schulden/${schuldId}/opeisen`, {}, dm);

    // Nacht 1: de brief.
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    assert.strictEqual(reg.find(x => x.id === schuldId).trap, 1);
    let post = (await req(server, 'GET', '/api/berichten', null, spelerC)).body.berichten || [];
    assert.ok(post.some(m => /geduld gehad/.test(m.tekst || '')), 'de eerste brief is bezorgd');

    // Nacht 2: er wordt onderpand gevraagd — bij Verzoeken, niet automatisch.
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    assert.strictEqual(reg.find(x => x.id === schuldId).trap, 2);
    const ond = (await req(server, 'GET', '/api/onderpand/verzoeken', null, dm)).body.verzoeken;
    assert.strictEqual(ond.length, 1, 'het staat bij Verzoeken: ' + JSON.stringify(ond));

    // De DM wijst aan wat er verdwijnt.
    await req(server, 'POST', `/api/player-items/${speler}`, { name: 'Het zwaard van zijn vader' }, dm);
    const spullen = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
    const zwaard = spullen.find(i => /zwaard/.test(i.name));
    const genomen = await req(server, 'POST', `/api/onderpand/${ond[0].id}`,
      { soort: 'los', itemId: zwaard.id }, dm);
    assert.strictEqual(genomen.body.genomen.naam, 'Het zwaard van zijn vader');

    const na = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
    assert.ok(!na.some(i => i.id === zwaard.id), 'het zwaard is weg');
    assert.ok(na.some(i => /In onderpand/.test(i.name)), 'en er staat wat er weg is');
    post = (await req(server, 'GET', '/api/berichten', null, spelerC)).body.berichten || [];
    const brief = post.find(m => /uit boekhouding/.test(m.tekst || ''));
    assert.ok(brief, 'met een brief erover');
    // De brief noemt wie er geleend heeft: dat is het sociale conflict aan tafel.
    assert.match(brief.tekst, /Schuldenaar/, 'en hij noemt de naam van de schuldenaar');

    // Nacht 3: de dreiging.
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    assert.strictEqual(reg.find(x => x.id === schuldId).trap, 3);
    post = (await req(server, 'GET', '/api/berichten', null, spelerC)).body.berichten || [];
    // De handlanger heette hier Strum, en die naam stond hard in een route die
    // élke campagne draait. Zonder een naam in `meta.woekeraar.handlanger`
    // komt er iemand langs zonder naam — wat op zichzelf dreigender is.
    assert.ok(post.some(m => /Er komt iemand langs/.test(m.tekst || '')),
      'de laatste brief, zonder dat er een naam uit een andere campagne in staat');
    assert.ok(!post.some(m => /Strum/.test(m.tekst || '')),
      'en geen eigennaam die deze campagne niet kent');

    // En hij blijft op 3 staan: verder escaleert het niet vanzelf.
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
    reg = (await req(server, 'GET', '/api/schulden', null, dm)).body.schulden;
    assert.strictEqual(reg.find(x => x.id === schuldId).trap, 3);
  });

  it('noemt de handlanger bij naam zodra de DM er een heeft', async () => {
    await req(server, 'PUT', '/api/meta/woekeraar', { handlanger: 'Strum' }, dm);
    const cfg = (await req(server, 'GET', '/api/woekeraar', null, dm)).body.config;
    assert.strictEqual(cfg.handlanger, 'Strum', 'de naam staat in de config');
  });

  it('geeft het onderpand terug bij het aflossen', async () => {
    await req(server, 'PATCH', `/api/player-currency/${speler}`, { fl: 200, kn: 0, cl: 0 }, dm);
    const r = await req(server, 'POST', '/api/tweespalt/aflossen', {}, spelerC);
    assert.strictEqual(r.body.restCl, 0, JSON.stringify(r.body));
    const na = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
    assert.ok(na.some(i => i.name === 'Het zwaard van zijn vader'), 'hij heeft het terug: ' + JSON.stringify(na.map(i => i.name)));
    assert.ok(!na.some(i => /In onderpand/.test(i.name)), 'en het briefje is weg');
  });

  it('leent niet meer dan het plafond', async () => {
    const r = await req(server, 'POST', '/api/woekeraar/verzoek',
      { bedrag: { fl: 99999, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
    assert.match(r.body.error, /leent/);
  });

  // De drie brieven stonden als vaste tekst in de route, en daarmee was de toon
  // van elke campagne die van Grisburgh. Ze zijn nu in te stellen; wat de DM
  // niet kan weten (het bedrag van dat moment) gaat via een haakje.
  //
  // Eigen speler per test: de suite deelt één personage en één schuld tegelijk.
  const _nieuweSchuldenaar = async (naam) => {
    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    const gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    const id = (await req(server, 'POST', '/api/entities/personages',
      { name: naam, subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    const cookie = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: id, password: 'proef1234' })).cookie;
    return cookie;
  };

  const _totTrapEen = async (cookie) => {
    const v = await req(server, 'POST', '/api/woekeraar/verzoek',
      { bedrag: { fl: 10, kn: 0, cl: 0 }, waarvoor: 'Een paard' }, cookie);
    const goed = await req(server, 'POST', `/api/woekeraar/verzoek/${v.body.verzoek.id}/approve`, {}, dm);
    assert.ok(goed.body?.schuld?.id, 'de schuld staat er');
    await req(server, 'POST', `/api/schulden/${goed.body.schuld.id}/opeisen`, {}, dm);
    await req(server, 'POST', '/api/party/long-rest', {}, dm);
  };

  it('stuurt de brief die de DM zelf schreef, met het bedrag ingevuld', async () => {
    await req(server, 'PUT', '/api/meta/woekeraar', {
      escalatie: true, ontspanBij: [],
      brief1: 'Ik tel {bedrag}. Meer heb ik niet te zeggen.',
    }, dm);
    const c = await _nieuweSchuldenaar('Eigen brief');
    await _totTrapEen(c);

    const post = (await req(server, 'GET', '/api/berichten', null, c)).body.berichten || [];
    const brief = post.find(m => /Ik tel/.test(m.tekst || ''));
    assert.ok(brief, 'de eigen tekst van de DM');
    assert.ok(!/\{bedrag\}/.test(brief.tekst), 'het haakje is ingevuld');
    assert.match(brief.tekst, /\d/, 'en wel met een bedrag erin');
    assert.ok(!/geduld gehad/.test(brief.tekst), 'de meegeleverde tekst staat er niet meer');
  });

  it('valt terug op de meegeleverde tekst als het veld leeg blijft', async () => {
    await req(server, 'PUT', '/api/meta/woekeraar', { escalatie: true, ontspanBij: [], brief1: '' }, dm);
    const c = await _nieuweSchuldenaar('Standaardbrief');
    await _totTrapEen(c);

    const post = (await req(server, 'GET', '/api/berichten', null, c)).body.berichten || [];
    assert.ok(post.some(m => /Ik heb geduld gehad/.test(m.tekst || '')));
  });

});
