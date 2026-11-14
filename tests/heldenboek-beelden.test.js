const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Beeld uit de beheercampagne meenemen naar een verse campagne. Bij de spreuken
// was dat makkelijk: die bestanden heten `spell-img-<index>`, dus kopiëren is
// genoeg. In het Heldenboek hangt een plaat aan een **verwijzing** — in
// `meta.heldenboek` bij een class of een species, en als `img` op een regel in
// `progression.json`. Alleen de bestanden kopiëren levert daar 375 platen op
// die nergens aan hangen; deze toets bewaakt dat de verwijzingen meegaan, dat
// er niets overschreven wordt, en dat een tweede keer drukken niets dubbelt.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-hb-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Heldenboek-beelden meenemen', () => {
  let server, io, storage, andereDm;
  const bronDir = () => path.join(DATA_DIR, 'campaigns', 'grisburgh', 'files');
  const doelDir = () => path.join(DATA_DIR, 'campaigns', 'vestingveen', 'files');
  const lees = (c, f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', c, f), 'utf8'));
  const schrijf = (c, f, d) => fs.writeFileSync(path.join(DATA_DIR, 'campaigns', c, f), JSON.stringify(d, null, 2));

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('vestingveen', { appTitle: 'Vestingveen' });
    schrijf('vestingveen', 'dm-state.json', { dmPassword: 'vestingveen-dm', groups: {} });

    // De bron: drie platen, elk op een andere manier aangehaakt.
    fs.mkdirSync(bronDir(), { recursive: true });
    for (const n of ['hb-klasse-1.webp', 'hb-species-1.webp', 'feat-img-abc.webp']) {
      fs.writeFileSync(path.join(bronDir(), n), 'x'.repeat(100));
    }
    const bronMeta = lees('grisburgh', 'meta.json');
    bronMeta.heldenboek = {
      klassen: { Barbarian: { id: 'hb-klasse-1', focus: '50% 20%' } },
      species: { Dwarf: 'hb-species-1' },          // de oude vorm: een kaal id
    };
    schrijf('grisburgh', 'meta.json', bronMeta);
    schrijf('grisburgh', 'progression.json', {
      classes: {
        Cleric: { subclasses: {
          'Life Domain':  { levels: { 3: [{ name: 'Bonus Proficiency', img: 'feat-img-abc', imgFocus: '10% 10%' }] } },
          'Death Domain': { levels: { 3: [{ name: 'Bonus Proficiency' }] } },
        } },
      },
      feats: { general: [], epic: [] },
    });

    // De ontvanger heeft al een eigen Barbarian-plaat en een eigen Cleric.
    const doelMeta = lees('vestingveen', 'meta.json');
    doelMeta.heldenboek = { klassen: { Barbarian: 'eigen-barbaar' } };
    schrijf('vestingveen', 'meta.json', doelMeta);
    schrijf('vestingveen', 'progression.json', {
      classes: {
        Cleric: { subclasses: {
          'Life Domain':  { levels: { 3: [{ name: 'Bonus Proficiency' }] } },
          'Death Domain': { levels: { 3: [{ name: 'Bonus Proficiency' }] } },
        } },
      },
      feats: { general: [], epic: [] },
    });

    andereDm = (await req(server, 'POST', '/api/auth/login', { campagne: 'vestingveen', password: 'vestingveen-dm' })).cookie;
    assert.ok(andereDm, 'de andere DM is ingelogd');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('telt wat er te halen valt, en niet wat er niet ligt', async () => {
    const r = await req(server, 'GET', '/api/bron/heldenboekbeelden', null, andereDm);
    assert.equal(r.status, 200);
    assert.equal(r.body.beschikbaar, 3, 'drie verwijzingen met een bestand erachter');
    assert.equal(r.body.eigen, false);
    assert.ok(r.body.bytes > 0, 'en hij zegt hoeveel het ongeveer is');
  });

  it('kopieert de bestanden én schrijft de verwijzingen mee', async () => {
    const r = await req(server, 'POST', '/api/bron/heldenboekbeelden', {}, andereDm);
    assert.equal(r.status, 200);
    assert.equal(r.body.gekopieerd, 3);

    for (const n of ['hb-klasse-1.webp', 'hb-species-1.webp', 'feat-img-abc.webp']) {
      assert.ok(fs.existsSync(path.join(doelDir(), n)), `${n} staat er`);
    }
    const meta = lees('vestingveen', 'meta.json');
    assert.equal(meta.heldenboek.species.Dwarf, 'hb-species-1', 'de verwijzing bij Dwarf');
  });

  it('overschrijft niet wat de campagne zelf al had', async () => {
    const meta = lees('vestingveen', 'meta.json');
    assert.equal(meta.heldenboek.klassen.Barbarian, 'eigen-barbaar',
      'de eigen Barbarian-plaat blijft staan');
  });

  it('zet een plaat op de juiste regel, niet op elke gelijknamige', async () => {
    const prog = lees('vestingveen', 'progression.json');
    const life  = prog.classes.Cleric.subclasses['Life Domain'].levels[3][0];
    const death = prog.classes.Cleric.subclasses['Death Domain'].levels[3][0];
    assert.equal(life.img, 'feat-img-abc', 'Life Domain krijgt hem');
    assert.equal(life.imgFocus, '10% 10%', 'met zijn uitsnede');
    assert.ok(!death.img, 'Death Domain heeft dezelfde featurenaam en krijgt hem niet');
  });

  it('twee keer drukken verandert niets meer', async () => {
    const r = await req(server, 'POST', '/api/bron/heldenboekbeelden', {}, andereDm);
    assert.equal(r.body.gekopieerd, 0);
    assert.equal(r.body.kaarten, 0);
    assert.equal(r.body.features, 0);
  });

  it('de bron zelf heeft hier niets te halen', async () => {
    const dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    const r  = await req(server, 'GET', '/api/bron/heldenboekbeelden', null, dm);
    assert.equal(r.body.eigen, true);
    const p = await req(server, 'POST', '/api/bron/heldenboekbeelden', {}, dm);
    assert.equal(p.status, 400, 'en kopiëren naar zichzelf is een fout');
  });
});
