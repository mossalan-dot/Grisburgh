const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Een DM uitnodigen. Het oude pad was: verzin een wachtwoord voor iemand
// anders, stuur het via een kanaal waar het blijft staan, en het blijft eeuwig
// geldig. Een uitnodiging is een link die een keer werkt en waarmee de
// genodigde zijn eigen wachtwoord kiest.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-uitn-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Een DM uitnodigen', () => {
  let server, io, beheerder;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    process.env.BEHEER_CAMPAGNE = 'grisburgh';
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../lib/uitnodigingen', '../routes/api', '../routes/auth', '../config'])
      delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    beheerder = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const nodigUit = (campagne, naam) =>
    req(server, 'POST', '/api/uitnodigingen?campagne=grisburgh', { campagne, naam }, beheerder);
  const tokenVan = (r) => String(r.body.pad || '').split('uitnodiging=')[1];

  it('legt de campagne meteen aan, zonder wachtwoord', async () => {
    const r = await nodigUit('alfa', 'De Bleke Kust');
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.ok(tokenVan(r), 'de link is er een keer');
    assert.ok(fs.existsSync(path.join(DATA_DIR, 'campaigns', 'alfa')), 'de campagne staat er');
    const dm = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'alfa', 'dm-state.json'), 'utf8'));
    assert.ok(!dm.dmPassword, 'nog geen wachtwoord - dat kiest de genodigde');
  });

  it('bewaart het token niet, alleen zijn afdruk', () => {
    const rauw = fs.readFileSync(path.join(DATA_DIR, 'uitnodigingen.json'), 'utf8');
    const lijst = JSON.parse(rauw).uitnodigingen;
    assert.ok(lijst[0].afdruk, 'er staat een afdruk in');
    assert.ok(!('token' in lijst[0]), 'en het token staat er niet in');
  });

  it('weigert een te kort wachtwoord', async () => {
    const r = await nodigUit('beta');
    const w = await req(server, 'POST', '/api/uitnodiging/inwisselen',
      { campagne: 'beta', token: tokenVan(r), wachtwoord: 'kort' });
    assert.equal(w.status, 400);
  });

  it('werkt een keer en zet de genodigde meteen binnen', async () => {
    const r = await nodigUit('gamma');
    const token = tokenVan(r);
    const eerste = await req(server, 'POST', '/api/uitnodiging/inwisselen',
      { campagne: 'gamma', token, wachtwoord: 'eenheelgoedwachtwoord' });
    assert.equal(eerste.status, 200);
    const rol = await req(server, 'GET', '/api/auth/role?campagne=gamma', null, eerste.cookie);
    assert.equal(rol.body.role, 'dm', 'hij zit meteen in zijn eigen campagne');

    const tweede = await req(server, 'POST', '/api/uitnodiging/inwisselen',
      { campagne: 'gamma', token, wachtwoord: 'nogeenwachtwoord' });
    assert.equal(tweede.status, 403);
    assert.equal(tweede.body.error, 'gebruikt', 'en de link is op');
  });

  it('neemt geen campagne over die al een DM heeft', async () => {
    const r = await nodigUit('gamma');
    assert.equal(r.status, 409, 'daarvoor is de noodingang, en die is zichtbaar');
  });

  it('laat een verzonnen token er niet in', async () => {
    await nodigUit('delta');
    const w = await req(server, 'POST', '/api/uitnodiging/inwisselen',
      { campagne: 'delta', token: 'a'.repeat(48), wachtwoord: 'eenheelgoedwachtwoord' });
    assert.equal(w.status, 403);
    assert.equal(w.body.error, 'onbekend');
  });

  // De kern van de vraag "wijkt het paneel van een tweede DM af": hij is baas
  // in zijn eigen campagne, maar nodigt niemand uit - dat kost schijf, een
  // backupregel en een plek in de URL, en dat is niet van hem.
  it('laat een gewone DM niet uitnodigen, maar wel zijn eigen party beheren', async () => {
    const r = await nodigUit('epsilon');
    const binnen = await req(server, 'POST', '/api/uitnodiging/inwisselen',
      { campagne: 'epsilon', token: tokenVan(r), wachtwoord: 'eenheelgoedwachtwoord' });
    const dm = binnen.cookie;

    const uitnodigen = await req(server, 'POST', '/api/uitnodigingen?campagne=epsilon', { campagne: 'zeta' }, dm);
    assert.equal(uitnodigen.status, 403, 'een campagne erbij is niet van hem');
    const lezen = await req(server, 'GET', '/api/uitnodigingen?campagne=epsilon', null, dm);
    assert.equal(lezen.status, 403, 'en meekijken ook niet');

    const party = await req(server, 'PUT', '/api/groups/groep1/password?campagne=epsilon', { password: 'zijnwachtwoord' }, dm);
    assert.equal(party.status, 200, 'zijn eigen party is wel van hem');
    const eigenWw = await req(server, 'PUT', '/api/dm-wachtwoord?campagne=epsilon',
      { wachtwoord: 'eenandergoedwachtwoord' }, dm);
    assert.ok(eigenWw.status < 400, 'en zijn eigen wachtwoord ook');
  });

  it('kan een uitnodiging intrekken', async () => {
    const r = await nodigUit('eta');
    const lijst = await req(server, 'GET', '/api/uitnodigingen?campagne=grisburgh', null, beheerder);
    const u = lijst.body.uitnodigingen.find(x => x.campagne === 'eta');
    await req(server, 'DELETE', `/api/uitnodigingen/${u.id}?campagne=grisburgh`, null, beheerder);
    const w = await req(server, 'POST', '/api/uitnodiging/inwisselen',
      { campagne: 'eta', token: tokenVan(r), wachtwoord: 'eenheelgoedwachtwoord' });
    assert.equal(w.status, 403, 'een ingetrokken link doet niets meer');
  });
});
