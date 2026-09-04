const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Elke DM heeft zijn eigen wachtwoord, per campagne, en het staat gehasht op
// schijf — die bestanden gaan mee in de dagelijkse backup.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-dmpw-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const CAMPAGNES = path.join(DATA_DIR, 'campaigns');

function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url  = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: {} };
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

const opSchijf = (campagne) =>
  JSON.parse(fs.readFileSync(path.join(CAMPAGNES, campagne, 'dm-state.json'), 'utf8')).dmPassword;

describe('DM-wachtwoord per campagne', () => {
  let server, io, storage, dm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('tweede', { appTitle: 'Tweede' });
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('slaat een nieuw wachtwoord versleuteld op', async () => {
    const r = await req(server, 'PUT', '/api/dm-wachtwoord', { wachtwoord: 'een-lang-wachtwoord' }, dm);
    assert.equal(r.status, 200);
    const bewaard = opSchijf('grisburgh');
    assert.ok(bewaard.startsWith('scrypt$'), 'het staat gehasht op schijf');
    assert.ok(!bewaard.includes('een-lang-wachtwoord'), 'het wachtwoord zelf staat er niet in');
  });

  it('laat inloggen met het nieuwe wachtwoord en niet met het oude', async () => {
    const goed = await req(server, 'POST', '/api/auth/toegang', { campagne: 'grisburgh', wachtwoord: 'een-lang-wachtwoord' });
    assert.equal(goed.body.rol, 'dm');
    const oud = await req(server, 'POST', '/api/auth/toegang', { campagne: 'grisburgh', wachtwoord: 'grisburgh-dm' });
    assert.equal(oud.status, 401, 'het serverwachtwoord telt niet meer zodra de campagne een eigen heeft');
  });

  it('weigert een te kort wachtwoord', async () => {
    const r = await req(server, 'PUT', '/api/dm-wachtwoord', { wachtwoord: 'kort' }, dm);
    assert.equal(r.status, 400);
  });

  it('zet een leesbaar wachtwoord om bij de eerste geslaagde login', async () => {
    // Zoals een met de hand ingevuld wachtwoord eruit zou zien.
    const pad = path.join(CAMPAGNES, 'tweede', 'dm-state.json');
    const dmState = JSON.parse(fs.readFileSync(pad, 'utf8'));
    dmState.dmPassword = 'leesbaar-gezet';
    fs.writeFileSync(pad, JSON.stringify(dmState, null, 2));

    const r = await req(server, 'POST', '/api/auth/toegang', { campagne: 'tweede', wachtwoord: 'leesbaar-gezet' });
    assert.equal(r.body.rol, 'dm', 'een leesbaar wachtwoord blijft gewoon werken');
    assert.ok(opSchijf('tweede').startsWith('scrypt$'), 'en is daarna versleuteld');

    const nogmaals = await req(server, 'POST', '/api/auth/toegang', { campagne: 'tweede', wachtwoord: 'leesbaar-gezet' });
    assert.equal(nogmaals.body.rol, 'dm', 'en werkt daarna nog steeds');
  });

  it('laat een tweede campagne niet zonder wachtwoord achter', async () => {
    const tweedeDm = (await req(server, 'POST', '/api/auth/login', { campagne: 'tweede', password: 'leesbaar-gezet' })).cookie;
    const r = await req(server, 'PUT', '/api/dm-wachtwoord', { wachtwoord: '' }, tweedeDm);
    assert.equal(r.status, 400, 'leegmaken zou betekenen dat er niemand meer in kan');
  });
});
