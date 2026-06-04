const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { io: ioClient } = require('socket.io-client');

// #14/#45: een speler mag via sound:emote niet namens een ander emoten —
// de server overschrijft entityId met de session-authoritatieve characterId.
// Anonieme emotes worden genegeerd.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-socket-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function httpReq(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: {} };
    if (body) {
      const json = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(json);
    }
    if (cookie) opts.headers['Cookie'] = cookie;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, cookie: setCookie ? setCookie[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function connect(port, cookie) {
  const opts = { transports: ['polling'], forceNew: true };
  if (cookie) opts.extraHeaders = { Cookie: cookie };
  const s = ioClient(`http://localhost:${port}`, opts);
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

// Wacht op een event of resolve met null na een timeout.
function waitFor(socket, event, ms = 600) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

describe('Socket sound:emote authority', () => {
  let server, io, port, dmCookie, A, cookieA, listener;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    port = server.address().port;

    dmCookie = (await httpReq(server, 'POST', '/api/auth/login', { password: 'grisburgh-dm' })).cookie;
    const c = await httpReq(server, 'POST', '/api/entities/personages', { name: 'Emoter A', subtype: 'speler', data: { groep: 'groep1' } }, dmCookie);
    A = c.body.id;
    cookieA = (await httpReq(server, 'POST', '/api/auth/player-login', { characterId: A })).cookie;

    listener = await connect(port, dmCookie);   // ontvanger in dezelfde room
  });

  after(async () => {
    if (listener) listener.close();
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('overschrijft een gespooft entityId met de eigen characterId', async () => {
    const sender = await connect(port, cookieA);
    const recv = waitFor(listener, 'sound:emote');
    sender.emit('sound:emote', { entityId: 'IEMAND-ANDERS', emoteId: 'wave' });
    const data = await recv;
    sender.close();
    assert.ok(data, 'event moet doorkomen');
    assert.strictEqual(data.entityId, A, 'entityId moet overschreven zijn met de eigen characterId');
    assert.strictEqual(data.emoteId, 'wave', 'overige velden blijven behouden');
  });

  it('negeert sound:emote van een anonieme socket', async () => {
    const anon = await connect(port, null);
    const recv = waitFor(listener, 'sound:emote', 500);
    anon.emit('sound:emote', { entityId: 'SPOOF', emoteId: 'taunt' });
    const data = await recv;
    anon.close();
    assert.strictEqual(data, null, 'anonieme emote mag niet gerelayed worden');
  });
});
