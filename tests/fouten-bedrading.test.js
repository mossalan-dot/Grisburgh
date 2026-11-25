const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **De regel klopte, de bedrading niet.** `fouten.isRuis()` krijgt te horen of
// de aanvrager ingelogd is, en de foutafhandelaar in `server.js` las dat uit
// `req.session`. Maar `express.json()` staat bóven de sessie-middleware: bij
// een kapot verzoeklichaam bestaat die sessie nog niet, dus stond er altijd
// "niet ingelogd" en viel élke kapotte JSON weg — ook die van onze eigen
// client, en dat is precies de fout die je wil zien.
//
// De unittoets op `isRuis` zag dat niet: die toetst de regel, niet wie hem
// aanroept. Daarom staat deze toets op de échte server, met een echt verzoek.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-bedrading-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function ruwVerzoek(server, { pad = '/api/auth/login', lichaam = '{kapot', headers = {} }) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      hostname: 'localhost', port: server.address().port, path: pad, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lichaam), ...headers },
    }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    r.on('error', reject);
    r.write(lichaam);
    r.end();
  });
}

describe('Wat er misging — de bedrading', () => {
  let server, io, fouten;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth', '../lib/fouten']) {
      delete require.cache[require.resolve(m)];
    }
    const mod = require('../server');
    server = mod.server; io = mod.io;
    fouten = require('../lib/fouten');
    await new Promise(r => server.listen(0, r));
  });

  after(async () => {
    try { await io.close(); } catch { /* ok */ }
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('schrijft een scanner met een kapot lichaam niet op', async () => {
    const voor = fouten.alle().length;
    assert.equal(await ruwVerzoek(server, { lichaam: '0x%5B%5D=DTAB' }), 400);
    assert.equal(await ruwVerzoek(server, { lichaam: 'rommel', headers: { 'Content-Encoding': 'br' } }), 415);
    assert.equal(fouten.alle().length, voor, 'een bot zonder cookie vult het logboek niet');
  });

  it('schrijft datzelfde van een browser mét sessiecookie wél op', async () => {
    const voor = fouten.alle().length;
    await ruwVerzoek(server, { lichaam: '{kapot', headers: { Cookie: 'connect.sid=s%3Aiets.watdanook' } });
    const na = fouten.alle();
    assert.equal(na.length, voor + 1, 'onze eigen client die onzin stuurt is een fout van ons');
    assert.match(na[0].melding + na.map(f => f.melding).join(' '), /JSON|token/i);
  });
});
