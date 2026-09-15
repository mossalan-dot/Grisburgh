const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// De snapshot-export (`/api/export`) plakt zijn hele datamodel als JSON in het
// HTML-bestand. Wat de filter laat staan, staat dus letterlijk in een bestand
// dat je aan je spelers geeft — ook wat nergens op het scherm getekend wordt.
// `lib/snapshot.js` had daarvoor een eigen kopie van de spelersfilter die alleen
// het oude enkelvoudige `data.geheim` kende: alle regels uit `data.geheimen`
// gingen mee, onthuld of niet, plus de antagonist-vlaggen, de DM-aantekeningen
// en het complete regie-script in `meta.hoofdstukken`.
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
  let server, io, dm, snapshot, boek;
  const OPEN    = 'Deze regel is onthuld en mag mee.';
  const DICHT   = 'KANARIE-GEHEIM: deze regel is nooit onthuld.';
  const NOTITIE = 'KANARIE-NOTITIE: aantekening voor de DM.';
  const VERHAAL = 'KANARIE-VERHAAL: de lopende tekst van een akte.';

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../lib/snapshot', '../routes/api', '../routes/auth']) {
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

    snapshot = (await req(server, 'GET', `/api/export?groupId=${gid}`, null, dm)).body;
    boek     = (await req(server, 'GET', `/api/export/campagneboek?groupId=${gid}`, null, dm)).body;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('levert allebei de exports op', () => {
    assert.ok(typeof snapshot === 'string' && snapshot.length > 1000, 'snapshot is HTML');
    assert.ok(typeof boek === 'string' && boek.length > 1000, 'campagneboek is HTML');
  });

  it('neemt het onthulde geheim wél mee', () => {
    assert.ok(snapshot.includes(OPEN), 'wat de party weet hoort in de snapshot te staan');
  });

  for (const [wat, kanarie] of [
    ['een geheim dat deze party niet kent', 'KANARIE-GEHEIM'],
    ['de aantekeningen van de DM',          'KANARIE-NOTITIE'],
    ['de verhaaltekst van een akte',        'KANARIE-VERHAAL'],
  ]) {
    it(`laat ${wat} uit de snapshot`, () => {
      assert.ok(!snapshot.includes(kanarie), `${kanarie} hoort niet in de snapshot`);
    });
    it(`laat ${wat} uit het campagneboek`, () => {
      assert.ok(!boek.includes(kanarie), `${kanarie} hoort niet in het campagneboek`);
    });
  }

  it('laat het statblok uit de snapshot', () => {
    assert.ok(!/"stats":\s*\{/.test(snapshot), 'een statblok gaat nooit mee naar een speler');
    assert.ok(!/"statblockTiers"/.test(snapshot), 'en de gedaantes die hij nog niet kent ook niet');
  });

  it('laat het regie-script uit de snapshot', () => {
    assert.ok(!/"script":\s*\[\s*\{/.test(snapshot), 'het regie-script is wat er nog onthuld moet worden');
  });
});
