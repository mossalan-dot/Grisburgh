const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ── Vaag is vaag, ook in het bestand ─────────────────────────────────────────
// Een vaag kaartje en een vaag document werden alleen met een CSS-waas verstopt:
// het originele portret stond gewoon op /api/thumb/<id>. De server maakt nu zelf
// een vervaagde variant, en wat niet te vervagen valt (pdf, geluid) gaat er niet
// uit. Deze tests kijken naar de bytes, niet naar de opmaak.

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-waas-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie, ruw = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    if (body) {
      const json = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(json);
    }
    if (cookie) opts.headers['Cookie'] = cookie;
    const r = http.request(opts, (res) => {
      const brokken = [];
      res.on('data', c => brokken.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(brokken);
        const setCookie = res.headers['set-cookie'];
        let parsed = buf;
        if (!ruw) { try { parsed = JSON.parse(buf.toString()); } catch { parsed = buf.toString(); } }
        resolve({
          status: res.statusCode, body: parsed, type: res.headers['content-type'] || '',
          cookie: setCookie ? setCookie[0].split(';')[0] : cookie,
        });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function upload(server, p, cookie, { filename, contentType, content }) {
  const boundary = '----grisburghtest' + Math.random().toString(36).slice(2);
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`);
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  const payload = Buffer.concat([pre, content, post]);
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const r = http.request({
      method: 'POST', hostname: url.hostname, port: url.port, path: url.pathname,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length, ...(cookie ? { Cookie: cookie } : {}),
      },
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    r.on('error', reject);
    r.write(payload); r.end();
  });
}

let sharp = null;
try { sharp = require('sharp'); } catch { /* dan slaan we over */ }

describe('Vervaagde bestanden', { skip: !sharp && 'sharp niet beschikbaar' }, () => {
  let server, io, dm, speler, png;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server'); server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const held = await req(server, 'POST', '/api/entities/personages',
      { name: 'Speler Een', subtype: 'speler', data: { groep: 'groep1' } }, dm);
    speler = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: held.body.id })).cookie;

    // Een herkenbaar plaatje: één egale kleur, dus de waas is meetbaar.
    png = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 200, g: 40, b: 40 } } })
      .png().toBuffer();
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('geeft een vaag kaartje niet zijn scherpe portret mee', async () => {
    const npc = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Man met Hoed', data: { desc: 'Iets' } }, dm)).body;
    await upload(server, `/api/files/${npc.id}`, dm, { filename: 'p.png', contentType: 'image/png', content: png });
    await req(server, 'PUT', `/api/entities/personages/${npc.id}/visibility`, { target: 'vague' }, dm);

    const scherp = await req(server, 'GET', `/api/files/${npc.id}`, null, dm, true);
    const vaag   = await req(server, 'GET', `/api/files/${npc.id}`, null, speler, true);
    assert.strictEqual(scherp.status, 200);
    assert.strictEqual(vaag.status, 200);
    assert.match(vaag.type, /webp/, 'de speler krijgt de vervaagde variant');
    assert.notDeepStrictEqual(vaag.body, scherp.body, 'en dus niet dezelfde bytes');

    // De waas is echt: het beeld is eerst klein gemaakt, dus de detaillering
    // is weg. Een 400px vlak levert nooit méér pixels op dan het origineel.
    const meta = await sharp(vaag.body).metadata();
    assert.ok(meta.width <= 600, 'niet groter dan de thumbnail-maat');

    const thumb = await req(server, 'GET', `/api/thumb/${npc.id}`, null, speler, true);
    assert.match(thumb.type, /webp/);
    assert.notDeepStrictEqual(thumb.body, (await req(server, 'GET', `/api/thumb/${npc.id}`, null, dm, true)).body,
      'ook de thumbnail is een andere');
  });

  it('geeft het portret weer scherp zodra het kaartje zichtbaar wordt', async () => {
    const npc = (await req(server, 'POST', '/api/entities/personages', { name: 'Vrouw met Sjaal' }, dm)).body;
    await upload(server, `/api/files/${npc.id}`, dm, { filename: 'p.png', contentType: 'image/png', content: png });
    await req(server, 'PUT', `/api/entities/personages/${npc.id}/visibility`, { target: 'vague' }, dm);
    const vaag = await req(server, 'GET', `/api/files/${npc.id}`, null, speler, true);
    await req(server, 'PUT', `/api/entities/personages/${npc.id}/visibility`, { target: 'visible' }, dm);
    const scherp = await req(server, 'GET', `/api/files/${npc.id}`, null, speler, true);
    assert.notDeepStrictEqual(scherp.body, vaag.body);
    assert.match(scherp.type, /png/);
  });

  it('vervaagt ook de afbeelding van een vaag document', async () => {
    const doc = (await req(server, 'POST', '/api/entities/documenten', { name: 'Wazige Kaart', data: { docType: 'Wereldkaart' } }, dm)).body;
    await upload(server, `/api/files/${doc.id}`, dm, { filename: 'p.png', contentType: 'image/png', content: png });
    await req(server, 'PUT', `/api/entities/documenten/${doc.id}/visibility`, { target: 'vague' }, dm);
    const vaag = await req(server, 'GET', `/api/files/${doc.id}`, null, speler, true);
    assert.match(vaag.type, /webp/, 'geen origineel');
  });

  it('geeft de pdf van een vaag document helemaal niet vrij', async () => {
    const doc = (await req(server, 'POST', '/api/entities/documenten', { name: 'Wazig Traktaat', data: { docType: 'Manuscript' } }, dm)).body;
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 0x20)]);
    await upload(server, `/api/files/${doc.id}`, dm, { filename: 'a.pdf', contentType: 'application/pdf', content: pdf });
    await req(server, 'PUT', `/api/entities/documenten/${doc.id}/visibility`, { target: 'vague' }, dm);

    const speler403 = await req(server, 'GET', `/api/files/${doc.id}`, null, speler);
    assert.strictEqual(speler403.status, 403, 'een pdf valt niet te vervagen — dan maar niet');
    const dmOk = await req(server, 'GET', `/api/files/${doc.id}`, null, dm, true);
    assert.strictEqual(dmOk.status, 200, 'de DM ziet hem gewoon');
  });
});
