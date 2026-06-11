const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Mediabibliotheek: registratie bij upload, backfill, hernoemen, en de guarded
// delete (409 zolang in gebruik, force=1 omzeilt, wees verdwijnt echt).
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-media-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function jsonReq(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; }
    if (cookie) opts.headers['Cookie'] = cookie;
    const r = http.request(opts, (res) => {
      let data = ''; res.on('data', c => data += c);
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

function uploadReq(server, p, cookie, { filename, contentType, content, fields = {} }) {
  const boundary = '----grismediatest' + Math.random().toString(36).slice(2);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`));
  parts.push(Buffer.isBuffer(content) ? content : Buffer.from(content));
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const payload = Buffer.concat(parts);
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = {
      method: 'POST', hostname: url.hostname, port: url.port, path: url.pathname,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { let b; try { b = JSON.parse(data); } catch { b = data; } resolve({ status: res.statusCode, body: b }); });
    });
    r.on('error', reject);
    r.write(payload); r.end();
  });
}

// Geldige 1x1 PNG.
const PNG_1PX = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753' +
  'de0000000c49444154789c63f80f00010101001b0a2db40000000049454e44ae426082',
  'hex');

describe('Mediabibliotheek', () => {
  let server, io, dmCookie;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../lib/media-usage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server'); server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dmCookie = (await jsonReq(server, 'POST', '/api/auth/login', { password: 'grisburgh-dm' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('registreert een upload in media.json met naam, type en afmetingen', async () => {
    const up = await uploadReq(server, '/api/files/m_one', dmCookie, {
      filename: 'knight.png', contentType: 'image/png', content: PNG_1PX, fields: { naam: 'gareth-personages' },
    });
    assert.strictEqual(up.status, 200);
    const list = await jsonReq(server, 'GET', '/api/media', null, dmCookie);
    const f = list.body.files.find(x => x.id === 'm_one');
    assert.ok(f, 'bestand staat in de bibliotheek');
    assert.strictEqual(f.naam, 'gareth-personages');
    assert.strictEqual(f.type, 'afbeelding');
    assert.strictEqual(f.breedte, 1);
    assert.strictEqual(f.origineleNaam, 'knight.png');
    assert.deepStrictEqual(f.gebruik, []);
  });

  it('hernoemt een bestand zonder verwijzingen te raken', async () => {
    const r = await jsonReq(server, 'PATCH', '/api/media/m_one', { naam: 'gareth-hernoemd' }, dmCookie);
    assert.strictEqual(r.status, 200);
    const list = await jsonReq(server, 'GET', '/api/media', null, dmCookie);
    assert.strictEqual(list.body.files.find(x => x.id === 'm_one').naam, 'gareth-hernoemd');
  });

  it('weigert verwijderen zolang het bestand in gebruik is (409 + gebruikslijst)', async () => {
    // Koppel het bestand aan een monster zodat de usage-scan het vindt.
    await jsonReq(server, 'POST', '/api/monsters', { name: 'Owlbear', imageId: 'm_one' }, dmCookie);
    const del = await jsonReq(server, 'DELETE', '/api/media/m_one', null, dmCookie);
    assert.strictEqual(del.status, 409);
    assert.ok(Array.isArray(del.body.gebruik) && del.body.gebruik.some(l => /Owlbear/.test(l)), 'gebruikslijst noemt het monster');
  });

  it('force=1 verwijdert ook een bestand dat nog in gebruik is', async () => {
    const del = await jsonReq(server, 'DELETE', '/api/media/m_one?force=1', null, dmCookie);
    assert.strictEqual(del.status, 200);
    const list = await jsonReq(server, 'GET', '/api/media', null, dmCookie);
    assert.ok(!list.body.files.find(x => x.id === 'm_one'), 'bestand is uit de bibliotheek');
  });

  it('verwijdert een wees-bestand direct (geen verwijzingen)', async () => {
    await uploadReq(server, '/api/files/m_wees', dmCookie, { filename: 'los.png', contentType: 'image/png', content: PNG_1PX });
    const del = await jsonReq(server, 'DELETE', '/api/media/m_wees', null, dmCookie);
    assert.strictEqual(del.status, 200);
  });

  it('blokkeert media-toegang zonder DM-sessie', async () => {
    const r = await jsonReq(server, 'GET', '/api/media', null, null);
    assert.strictEqual(r.status, 403);
  });
});
