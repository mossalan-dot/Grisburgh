const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Effecten op het tafelscherm. Twee dingen staan hier vast:
//  1. de catalogus is de enige bron — wat er niet in staat gaat er niet uit;
//  2. de automatische flits bij HP luistert naar één instelling en gaat alleen
//     af op de route waar een klap aan tafel wordt opgeschreven.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-fx-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Tafelscherm-effecten', () => {
  let server, io, storage, dm, uitgezonden;

  // De effecten gaan via socket.io naar de tafelschermkamer. In een test zit
  // daar niemand, dus luisteren we de uitzending zelf af.
  function vangUitzendingen() {
    uitgezonden = [];
    const echt = io.to.bind(io);
    io.to = (kamer) => {
      const doel = echt(kamer);
      const emit = doel.emit.bind(doel);
      doel.emit = (naam, data) => { uitgezonden.push({ kamer, naam, data }); return emit(naam, data); };
      return doel;
    };
  }
  const fxUit = () => uitgezonden.filter(u => u.naam === 'display:effect').map(u => u.data);

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    assert.ok(dm, 'de DM is ingelogd');
    vangUitzendingen();
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  // ── De catalogus ──

  it('geeft de catalogus uit, met soort en duur', async () => {
    const r = await req(server, 'GET', '/api/display/fx', null, dm);
    assert.equal(r.status, 200);
    const wond = r.body.fx.find(f => f.id === 'wond');
    assert.equal(wond.soort, 'flits');
    assert.equal(typeof wond.duur, 'number');
    const mist = r.body.fx.find(f => f.id === 'mist');
    assert.equal(mist.soort, 'toestand');
    assert.equal(mist.duur, null, 'een toestand heeft geen duur: hij blijft tot je hem uitzet');
  });

  it('weigert een effect dat niet in de catalogus staat', async () => {
    const r = await req(server, 'POST', '/api/display/effect', { effect: 'confetti' }, dm);
    assert.equal(r.status, 400);
  });

  it('stuurt soort, duur en kleur mee, zodat de tablet de catalogus niet hoeft te kennen', async () => {
    uitgezonden = [];
    const r = await req(server, 'POST', '/api/display/effect', { effect: 'gif' }, dm);
    assert.equal(r.status, 200);
    const [fx] = fxUit();
    assert.equal(fx.effect, 'gif');
    assert.equal(fx.soort, 'toestand');
    assert.ok(fx.kleur, 'met de kleur uit de catalogus');
  });

  it('kent `uit` om een lopende toestand weg te halen', async () => {
    uitgezonden = [];
    const r = await req(server, 'POST', '/api/display/effect', { effect: 'uit' }, dm);
    assert.equal(r.status, 200);
    assert.equal(fxUit()[0].soort, 'uit');
  });

  it('laat een eigen geluid uit de Geluiden-tab winnen van de synthese', async () => {
    const sounds = storage.readJSON('sounds.json') || {};
    sounds.momenten = { ...(sounds.momenten || {}), 'fx-bliksem': 'f_eigen_donder' };
    storage.writeJSON('sounds.json', sounds);
    uitgezonden = [];
    await req(server, 'POST', '/api/display/effect', { effect: 'bliksem' }, dm);
    const [fx] = fxUit();
    assert.equal(fx.fileId, 'f_eigen_donder');
    assert.equal(fx.klank, 'donder', 'het recept gaat mee als terugval');
  });

  // ── De automatische flits bij HP ──

  const ALICE = 'e_fxtest_alice';
  const BOB   = 'e_fxtest_bob';

  const zetHp = (id, waarden) => req(server, 'PATCH', `/api/player-hp/${id}`, waarden, dm);
  const autoFx = async (aan) => {
    await req(server, 'PUT', '/api/meta/app', { autoFx: aan }, dm);
  };

  it('doet niets zolang de instelling uit staat', async () => {
    await autoFx(false);
    await zetHp(ALICE, { current: 30, max: 30 });
    uitgezonden = [];
    await zetHp(ALICE, { current: 20 });
    assert.deepEqual(fxUit(), [], 'standaard praat het scherm niet mee');
  });

  it('flitst een wond bij schade, en kritiek bij een halve levensbalk', async () => {
    await autoFx(true);
    await zetHp(ALICE, { current: 30, max: 30 });
    uitgezonden = [];
    await zetHp(ALICE, { current: 24 });
    assert.equal(fxUit()[0].effect, 'wond');

    uitgezonden = [];
    await zetHp(ALICE, { current: 8 });   // 16 van de 30 in één klap
    assert.equal(fxUit()[0].effect, 'kritiek');
  });

  it('schakelt naar de toestand zodra iemand op 0 ligt', async () => {
    uitgezonden = [];
    await zetHp(ALICE, { current: 0 });
    const fx = fxUit()[0];
    assert.equal(fx.effect, 'stervend');
    assert.equal(fx.soort, 'toestand', 'die blijft staan tot hij weer bijkomt');
  });

  it('houdt de toestand zolang er nog iemand ligt', async () => {
    await zetHp(BOB, { current: 0, max: 24 });
    uitgezonden = [];
    await zetHp(ALICE, { current: 5 });   // Alice komt bij, Bob ligt nog
    const namen = fxUit().map(f => f.effect);
    assert.ok(namen.includes('genezing'), 'Alice krijgt haar gloed');
    assert.ok(!namen.includes('uit'), 'maar het scherm blijft donker: Bob ligt nog');

    uitgezonden = [];
    await zetHp(BOB, { current: 3 });
    const na = fxUit().map(f => f.effect);
    assert.ok(na.includes('uit'), 'nu pas gaat de toestand uit');
  });

  it('negeert tijdelijke HP en een nieuw maximum', async () => {
    await zetHp(ALICE, { current: 20, max: 30 });
    uitgezonden = [];
    await zetHp(ALICE, { temp: 8 });
    assert.deepEqual(fxUit(), [], 'tijdelijke HP is geen wond');
    uitgezonden = [];
    await zetHp(ALICE, { max: 38 });
    assert.deepEqual(fxUit(), [], 'een level-up ook niet');
  });

  it('laat kleine genezing met rust', async () => {
    await zetHp(ALICE, { current: 20, max: 30 });
    uitgezonden = [];
    await zetHp(ALICE, { current: 22 });   // 2 van de 30
    assert.deepEqual(fxUit(), [], 'anders pulseert het scherm bij elk punt dat je bijstelt');
    uitgezonden = [];
    await zetHp(ALICE, { current: 30 });   // 8 van de 30 — een kwart
    assert.equal(fxUit()[0].effect, 'genezing');
  });
});
