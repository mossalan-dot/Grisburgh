const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Het campagneboek is een bestand dat je aan je spelers geeft. Alles wat de
// filter laat staan, staat daar dus in — en de export had ooit een eigen kopie
// van de spelersfilter die alleen het oude enkelvoudige `data.geheim` kende:
// alle regels uit `data.geheimen` gingen mee, onthuld of niet, plus de
// antagonist-vlaggen, de DM-aantekeningen en het complete regie-script.
// Hij leent nu `filterEntityForPlayer` uit `routes/api.js` — dezelfde filter
// als de app. Deze kanaries bewaken dat.
//
// De snapshot stond hier ook in (die plakte zijn datamodel als JSON in het
// bestand, wat het erger maakte). Die is weg sinds 14 okt 2026.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-export-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Export: wat niet onthuld is, komt er niet in', () => {
  let server, io, dm, boek;
  const OPEN    = 'Deze regel is onthuld en mag mee.';
  const DICHT   = 'KANARIE-GEHEIM: deze regel is nooit onthuld.';
  const NOTITIE = 'KANARIE-NOTITIE: aantekening voor de DM.';
  const VERHAAL = 'KANARIE-VERHAAL: de lopende tekst van een akte.';

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../lib/campagneboek', '../routes/api', '../routes/auth']) {
      delete require.cache[require.resolve(m)];
    }
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const ent = (await req(server, 'POST', '/api/entities/personages', {
      name: 'Proefpersoon',
      data: {
        desc:            'Een gewone beschrijving.',
        persoonlijkheid: NOTITIE,
        geheimen:        JSON.stringify([{ id: 'g1', tekst: OPEN }, { id: 'g2', tekst: DICHT, antagonist: true }]),
      },
      stats: { ac: 17, hp: '58 (9d8+18)' },
    }, dm)).body;

    const gid = Object.keys((await req(server, 'GET', '/api/dm-state', null, dm)).body?.groups || {})[0];
    await req(server, 'PUT', `/api/entities/personages/${ent.id}/visibility`, { visibility: 'visible', gid }, dm);
    await req(server, 'PUT', `/api/entities/personages/${ent.id}/secret`, { revealed: true, gid, index: 0 }, dm);

    await req(server, 'PUT', '/api/meta/hoofdstuk/h1', { num: 1, title: 'Proefakte', short: 'A1' }, dm);
    await req(server, 'PUT', '/api/meta/akte/h1/tekst', { tekst: VERHAAL }, dm);

    boek = (await req(server, 'GET', `/api/export/campagneboek?groupId=${gid}`, null, dm)).body;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('levert een campagneboek op', () => {
    assert.ok(typeof boek === 'string' && boek.length > 1000, 'campagneboek is HTML');
  });

  // Een negatieve test alleen is gevaarlijk: een boek dat per ongeluk leeg
  // blijft slaagt voor élke kanarie. Dus ook de andere kant op — wat de party
  // wél kent hoort erin te staan.
  //
  // Niet het onthulde geheim zelf: het boek is de verhalende vorm en drukt
  // geen geheimenlijst af, onthuld of niet. (De snapshot deed dat wel, want die
  // plakte het hele datamodel als JSON in het bestand — en dat was nu juist de
  // reden dat hij strenger gefilterd moest worden dan het boek.)
  it('neemt wél mee wat de party gewoon mag zien', () => {
    // Zijn naam, want het register noemt wie de party kent. Zijn beschrijving
    // staat er niet standaard in; het boek is een register en een verslag, geen
    // tweede archief.
    assert.ok(boek.includes('Proefpersoon'), 'het kaartje zelf hoort in het boek te staan');
  });

  for (const [wat, kanarie] of [
    ['een geheim dat deze party niet kent', 'KANARIE-GEHEIM'],
    ['de aantekeningen van de DM',          'KANARIE-NOTITIE'],
    ['de verhaaltekst van een akte',        'KANARIE-VERHAAL'],
  ]) {
    it(`laat ${wat} uit het campagneboek`, () => {
      assert.ok(!boek.includes(kanarie), `${kanarie} hoort niet in het campagneboek`);
    });
  }

  it('laat een statblok en het regie-script eruit', () => {
    assert.ok(!/"stats":\s*\{/.test(boek), 'een statblok gaat nooit mee naar een speler');
    assert.ok(!/"statblockTiers"/.test(boek), 'en de gedaantes die hij nog niet kent ook niet');
    assert.ok(!/"script":\s*\[\s*\{/.test(boek), 'het regie-script is wat er nog onthuld moet worden');
  });
});
