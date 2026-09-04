const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

// #24: upload-validatie — fileFilter (whitelist op mimetype) + magic-byte sniff
// op de inhoud. Een verkeerd-getypeerd/hernoemd bestand wordt geweigerd.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function jsonReq(server, method, p, body, cookie) {
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

// Minimale multipart/form-data POST met één bestand.
function uploadReq(server, p, cookie, { filename, contentType, content }) {
  const boundary = '----grisburghtest' + Math.random().toString(36).slice(2);
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`);
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  const payload = Buffer.concat([pre, Buffer.isBuffer(content) ? content : Buffer.from(content), post]);
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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    r.on('error', reject);
    r.write(payload); r.end();
  });
}

describe('Upload-validatie', () => {
  let server, io, dmCookie;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server'); server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dmCookie = (await jsonReq(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('accepteert een geldige PNG', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    const res = await uploadReq(server, '/api/files/test-png', dmCookie, { filename: 'a.png', contentType: 'image/png', content: png });
    assert.strictEqual(res.status, 200);
  });

  it('weigert een nep-PNG (juiste mimetype, verkeerde inhoud) met 415', async () => {
    const res = await uploadReq(server, '/api/files/test-fake', dmCookie, { filename: 'a.png', contentType: 'image/png', content: 'dit is gewoon tekst' });
    assert.strictEqual(res.status, 415);
  });

  it('weigert een niet-toegestaan type (zip) — fileFilter dropt het bestand', async () => {
    const res = await uploadReq(server, '/api/files/test-zip', dmCookie, { filename: 'a.zip', contentType: 'application/zip', content: Buffer.from([0x50, 0x4b, 0x03, 0x04]) });
    assert.strictEqual(res.status, 400);
  });

  it('blokkeert upload zonder DM-sessie', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await uploadReq(server, '/api/files/test-anon', null, { filename: 'a.png', contentType: 'image/png', content: png });
    assert.strictEqual(res.status, 403);
  });
});
