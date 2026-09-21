const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Hier gaat geld om. Vijf van de zeven schrijfroutes van de Tweespalt hadden
// geen enkele test: wedden, de uitslag, de arena-inschrijving en haar uitslag,
// en het beheer van een event. Juist de arena-uitslag is onomkeerbaar — de
// inschrijving verdwijnt, de speler krijgt een brief en zijn inzet is weg.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-tweespalt-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('De Tweespalt: wedden, arena en lenen', () => {
  let server, io, dm, gid, speler, spelerC;

  const alsCl = (c) => (c?.fl || 0) * 100 + (c?.kn || 0) * 10 + (c?.cl || 0);

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

    speler = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Gokker', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    spelerC = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: speler, password: 'proef1234' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const beurs    = async () => (await req(server, 'GET', `/api/player-currency/${speler}`, null, dm)).body;
  const vulBeurs = (fl) => req(server, 'PATCH', `/api/player-currency/${speler}`, { fl, kn: 0, cl: 0 }, dm);
  const boedel   = async () => {
    const b = (await req(server, 'GET', `/api/player-items/${speler}`, null, dm)).body;
    return Array.isArray(b) ? b : (b?.items || []);
  };
  // Een event waarvan de DM de uitslag bepaalt: dan is de proef niet van een
  // worp afhankelijk.
  const maakEvent = async (naam = 'Hanengevecht') => {
    const r = await req(server, 'POST', '/api/tweespalt/events', {
      type: 'wedden', naam, uitkomstModus: 'dm',
      opties: [
        { naam: 'De rode haan', kans: 50, payout: 2 },
        { naam: 'De grijze',    kans: 50, payout: 3 },
      ],
    }, dm);
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));   // aanmaken geeft 201
    const events = (await req(server, 'GET', '/api/tweespalt', null, dm)).body.events || [];
    return events.find(e => e.naam === naam);
  };

  it('neemt een inzet aan en schrijft die meteen af', async () => {
    await vulBeurs(50);
    const ev = await maakEvent();
    const voor = alsCl(await beurs());

    const r = await req(server, 'POST', `/api/tweespalt/events/${ev.id}/wedden`,
      { optieId: ev.opties[0].id, bedrag: { fl: 10, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(voor - alsCl(await beurs()), 1000, 'de inzet gaat er meteen af');

    // Twee keer inzetten op hetzelfde event kan niet.
    const nogEens = await req(server, 'POST', `/api/tweespalt/events/${ev.id}/wedden`,
      { optieId: ev.opties[1].id, bedrag: { fl: 1, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(nogEens.status, 400, JSON.stringify(nogEens.body));
  });

  it('betaalt de inzet plus de payout uit bij winst', async () => {
    await vulBeurs(50);
    const ev = await maakEvent('Tweede ronde');
    await req(server, 'POST', `/api/tweespalt/events/${ev.id}/wedden`,
      { optieId: ev.opties[0].id, bedrag: { fl: 10, kn: 0, cl: 0 } }, spelerC);
    const naInzet = alsCl(await beurs());

    const uit = await req(server, 'POST', `/api/tweespalt/events/${ev.id}/uitslag`,
      { uitkomst: ev.opties[0].id }, dm);
    assert.strictEqual(uit.status, 200, JSON.stringify(uit.body));

    // 1000 cl inzet × payout 2 = 2000 erbij, plus de inzet zelf terug = 3000.
    assert.strictEqual(alsCl(await beurs()) - naInzet, 3000,
      'inzet terug plus twee keer de inzet');
  });

  it('betaalt niets uit bij verlies', async () => {
    await vulBeurs(50);
    const ev = await maakEvent('Derde ronde');
    await req(server, 'POST', `/api/tweespalt/events/${ev.id}/wedden`,
      { optieId: ev.opties[0].id, bedrag: { fl: 10, kn: 0, cl: 0 } }, spelerC);
    const naInzet = alsCl(await beurs());

    await req(server, 'POST', `/api/tweespalt/events/${ev.id}/uitslag`,
      { uitkomst: ev.opties[1].id }, dm);
    assert.strictEqual(alsCl(await beurs()), naInzet, 'verloren is verloren');
  });

  it('geeft de inzet terug als de DM een open event weggooit', async () => {
    await vulBeurs(50);
    const ev = await maakEvent('Afgelast');
    await req(server, 'POST', `/api/tweespalt/events/${ev.id}/wedden`,
      { optieId: ev.opties[0].id, bedrag: { fl: 10, kn: 0, cl: 0 } }, spelerC);
    const naInzet = alsCl(await beurs());

    const weg = await req(server, 'DELETE', `/api/tweespalt/events/${ev.id}`, null, dm);
    assert.strictEqual(weg.status, 200, JSON.stringify(weg.body));
    assert.strictEqual(alsCl(await beurs()) - naInzet, 1000, 'de inzet komt terug');
  });

  it('weigert een inzet van nul of meer dan je hebt', async () => {
    await vulBeurs(5);
    const ev = await maakEvent('Grenzen');
    const nul = await req(server, 'POST', `/api/tweespalt/events/${ev.id}/wedden`,
      { optieId: ev.opties[0].id, bedrag: { fl: 0, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(nul.status, 400, JSON.stringify(nul.body));

    const teveel = await req(server, 'POST', `/api/tweespalt/events/${ev.id}/wedden`,
      { optieId: ev.opties[0].id, bedrag: { fl: 99, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(teveel.status, 400);
    assert.strictEqual(teveel.body?.code, 'te_weinig');
  });

  it('kan niet meer wedden op een afgerond event', async () => {
    const ev = await maakEvent('Al voorbij');
    await req(server, 'POST', `/api/tweespalt/events/${ev.id}/uitslag`,
      { uitkomst: ev.opties[0].id }, dm);
    await vulBeurs(50);
    const r = await req(server, 'POST', `/api/tweespalt/events/${ev.id}/wedden`,
      { optieId: ev.opties[0].id, bedrag: { fl: 1, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
  });

  // ── Arena ──────────────────────────────────────────────────────────────────
  it('schrijft in voor een partij en houdt de inzet vast', async () => {
    await req(server, 'PUT', '/api/meta/tweespalt', {
      arena: [
        { id: 'bout_proef',  naam: 'De Beer van Brakel', inzet: '5 fl', prijs: '20 fl' },
        { id: 'bout_tweede', naam: 'De Stille Zuster',   inzet: '5 fl', prijs: '20 fl' },
      ],
    }, dm);
    await vulBeurs(50);
    const voor = alsCl(await beurs());

    const r = await req(server, 'POST', '/api/tweespalt/arena/bout_proef/aanmeld', {}, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(voor - alsCl(await beurs()), 500, 'de inzet gaat er bij het inschrijven af');

    const nogEens = await req(server, 'POST', '/api/tweespalt/arena/bout_proef/aanmeld', {}, spelerC);
    assert.strictEqual(nogEens.status, 400, 'twee keer inschrijven kan niet');
  });

  it('betaalt het prijzengeld bij overwinning', async () => {
    const data = (await req(server, 'GET', '/api/tweespalt', null, dm)).body;
    const signup = (data.arenaSignups || data.signups || []).find(s => s.boutId === 'bout_proef');
    assert.ok(signup, 'de inschrijving hoort op te halen te zijn: ' + JSON.stringify(Object.keys(data)));

    const voor = alsCl(await beurs());
    const r = await req(server, 'POST', `/api/tweespalt/arena/signup/${signup.id}/uitslag`,
      { uitkomst: 'overwinning' }, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(alsCl(await beurs()) - voor, 2000, 'het prijzengeld van 20 fl');
  });

  it('sluit een partij zodra de tegenstander verslagen is', async () => {
    await vulBeurs(50);
    const r = await req(server, 'POST', '/api/tweespalt/arena/bout_proef/aanmeld', {}, spelerC);
    assert.strictEqual(r.status, 400, 'een verslagen tegenstander vecht niet nog eens');
    assert.match(String(r.body?.error || ''), /verslagen|gesloten/i);
  });

  it('accepteert geen derde uitkomst — dat telde stilletjes als verlies', async () => {
    await vulBeurs(50);
    await req(server, 'POST', '/api/tweespalt/arena/bout_tweede/aanmeld', {}, spelerC);
    const data = (await req(server, 'GET', '/api/tweespalt', null, dm)).body;
    const signup = (data.arenaSignups || data.signups || []).find(s => s.boutId === 'bout_tweede');
    assert.ok(signup, 'inschrijving niet gevonden in: ' + JSON.stringify(Object.keys(data)));

    for (const onzin of ['', 'gelijkspel', undefined]) {
      const r = await req(server, 'POST', `/api/tweespalt/arena/signup/${signup.id}/uitslag`,
        { uitkomst: onzin }, dm);
      assert.strictEqual(r.status, 400, `'${onzin}' hoort geweigerd te worden`);
    }
    // De inschrijving staat er dus nog: er is niets stilletjes afgehandeld.
    const na = (await req(server, 'GET', '/api/tweespalt', null, dm)).body;
    assert.ok((na.arenaSignups || na.signups || []).some(s => s.id === signup.id));
  });

  // ── Lenen ──────────────────────────────────────────────────────────────────
  it('leent geld uit, met een plafond en één lening tegelijk', async () => {
    await vulBeurs(0);
    const teveel = await req(server, 'POST', '/api/tweespalt/leen',
      { bedrag: { fl: 500, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(teveel.status, 400, 'boven het plafond: ' + JSON.stringify(teveel.body));

    const r = await req(server, 'POST', '/api/tweespalt/leen',
      { bedrag: { fl: 20, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(alsCl(await beurs()), 2000, 'het geld staat op zijn beurs');

    const bewijs = (await boedel()).find(i => String(i.id || '').startsWith('ts_leen_'));
    assert.ok(bewijs, 'er hoort een schuldbewijs in de boedel te komen');
    assert.ok(!/\p{Extended_Pictographic}/u.test(bewijs.name), 'geen emoji in de naam: ' + bewijs.name);

    const tweede = await req(server, 'POST', '/api/tweespalt/leen',
      { bedrag: { fl: 5, kn: 0, cl: 0 } }, spelerC);
    assert.strictEqual(tweede.status, 400, 'twee leningen tegelijk kan niet');
  });

  it('laat de speler zijn schuldbewijs niet zelf weggooien', async () => {
    const bewijs = (await boedel()).find(i => String(i.id || '').startsWith('ts_leen_'));
    const r = await req(server, 'DELETE', `/api/player-items/${speler}/${bewijs.id}`, null, spelerC);
    assert.strictEqual(r.status, 403, JSON.stringify(r.body));
  });
});
