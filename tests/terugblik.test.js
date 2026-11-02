const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { io: ioClient } = require('socket.io-client');

// Wat voorafging: de terugblik op het tafelscherm. De grens die hier bewaakt
// wordt is dezelfde als in het Logboek — de terugblik is een samenvatting van
// wat de party wéét, geen onthulling. Een verborgen verslag wordt niet
// gekozen, een niet-onthuld beeld komt er niet in, een personage dat de party
// niet kent krijgt geen portret, en de payload gaat alleen naar het
// tafelscherm.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-terugblik-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

function upload(server, p, cookie, content) {
  const boundary = '----tb' + Math.random().toString(36).slice(2);
  const pre  = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="b.png"\r\nContent-Type: image/png\r\n\r\n`);
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  const payload = Buffer.concat([pre, content, post]);
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const r = http.request({ method: 'POST', hostname: url.hostname, port: url.port, path: url.pathname,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': payload.length, Cookie: cookie } },
      (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    r.on('error', reject);
    r.write(payload); r.end();
  });
}

function connect(port, cookie) {
  const s = ioClient(`http://localhost:${port}`, { transports: ['polling'], forceNew: true, extraHeaders: { Cookie: cookie } });
  return new Promise((resolve, reject) => { s.on('connect', () => resolve(s)); s.on('connect_error', reject); });
}
function waitFor(socket, event, ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

describe('Wat voorafging (terugblik)', () => {
  let server, io, port, dm, speler, oudId, nieuwId, verborgenId;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    port = server.address().port;

    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const maak = async (type, name, extra = {}) =>
      (await req(server, 'POST', `/api/entities/${type}`, { name, ...extra }, dm)).body.id;
    const bekend   = await maak('personages', 'Vrouwe Kwartel');
    await maak('personages', 'De Gemaskerde');                       // blijft verborgen
    const held     = await maak('personages', 'Sir Testalot', { subtype: 'speler', data: { groep: 'groep1' } });
    const kroeg    = await maak('locaties', 'De Gouden Gans');
    await maak('locaties', 'Het Geheime Hol');
    await req(server, 'PUT', `/api/entities/personages/${bekend}/visibility`, { target: 'visible' }, dm);
    await req(server, 'PUT', `/api/entities/personages/${held}/visibility`,   { target: 'visible' }, dm);
    await req(server, 'PUT', `/api/entities/locaties/${kroeg}/visibility`,    { target: 'visible' }, dm);

    // Twee echte beelden: één onthuld, één niet.
    let png;
    try {
      png = await require('sharp')({ create: { width: 40, height: 30, channels: 3, background: { r: 90, g: 60, b: 30 } } }).png().toBuffer();
    } catch {
      png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    }
    await upload(server, '/api/files/tb-gezien', dm, png);
    await upload(server, '/api/files/tb-geheim', dm, png);

    const verslag = async (body, zichtbaar) => {
      const id = (await req(server, 'POST', '/api/sessieLog', body, dm)).body.id;
      // Het citaat schrijft de editor pas bij het bewaren (PUT), net als hier.
      await req(server, 'PUT', `/api/sessieLog/${id}`, { citaat: body.citaat || '', visible: !!zichtbaar }, dm);
      return id;
    };
    oudId = await verslag({ korteSamenvatting: 'De eerste avond', samenvatting: 'Het begon in de regen.' }, true);
    nieuwId = await verslag({
      korteSamenvatting: 'Een kelder vol vragen',
      samenvatting: 'In [[De Gouden Gans]] ontmoetten ze [[Vrouwe Kwartel]]. Iemand met een masker keek toe.',
      citaat: 'Niemand gaat de kelder in.',
      nieuwPersonages: ['Vrouwe Kwartel', 'De Gemaskerde', 'Sir Testalot'],
      nieuwLocaties: ['De Gouden Gans', 'Het Geheime Hol'],
      images: [{ id: 'tb-gezien', caption: 'De kelderdeur', visible: false }, { id: 'tb-geheim', visible: false }],
    }, true);
    await req(server, 'POST', `/api/sessieLog/${nieuwId}/onthul`, { fileId: 'tb-gezien' }, dm);
    // Het allerlaatste verslag staat nog op verborgen: dat is voorbereiding.
    verborgenId = await verslag({ korteSamenvatting: 'Wat er straks gebeurt', samenvatting: 'Spoiler.' }, false);

    const groups = (await req(server, 'GET', '/api/groups', null, dm)).body.groups || [];
    const wachtwoord = groups.find(g => g.id === 'groep1')?.password;
    speler = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: held, password: wachtwoord })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('kiest het laatste verslag dat de party kan zien, niet het verborgen', async () => {
    const lijst = await req(server, 'GET', '/api/display/terugblik', null, dm);
    assert.strictEqual(lijst.status, 200);
    const ids = lijst.body.verslagen.map(v => v.id);
    assert.deepStrictEqual(ids, [nieuwId, oudId], 'nieuwste eerst, en zonder het verborgen verslag');
    assert.ok(!ids.includes(verborgenId));

    const tb = await req(server, 'POST', '/api/display/terugblik', { voorbeeld: true }, dm);
    assert.strictEqual(tb.status, 200);
    assert.strictEqual(tb.body.sessieId, nieuwId);
    assert.strictEqual(tb.body.citaat, 'Niemand gaat de kelder in.');
  });

  it('weigert een verborgen verslag, ook als je het id kent', async () => {
    const r = await req(server, 'POST', '/api/display/terugblik', { sessieId: verborgenId, voorbeeld: true }, dm);
    assert.strictEqual(r.status, 404);
  });

  it('neemt alleen onthulde beelden en gekende gezichten en plekken mee', async () => {
    const tb = (await req(server, 'POST', '/api/display/terugblik', { voorbeeld: true }, dm)).body;
    assert.deepStrictEqual(tb.beelden.map(b => b.id), ['tb-gezien']);
    assert.strictEqual(tb.beelden[0].caption, 'De kelderdeur');
    const namen = tb.gezichten.map(g => g.naam);
    assert.deepStrictEqual(namen, ['Vrouwe Kwartel'],
      'een verborgen kaartje krijgt geen portret, en een spelerspersonage staat niet bij wie je ontmoette');
    assert.strictEqual(tb.gezichten[0].nieuw, true);
    assert.deepStrictEqual(tb.plekken, ['De Gouden Gans']);
    assert.deepStrictEqual(tb.helden.map(h => h.naam), ['Sir Testalot'], 'de party komt aan het eind langs');
    assert.ok(!JSON.stringify(tb).includes('Geheime Hol'));
    assert.ok(!JSON.stringify(tb).includes('Gemaskerde'));
  });

  it('is van de DM: een speler kan hem niet opvragen of afspelen', async () => {
    assert.strictEqual((await req(server, 'GET', '/api/display/terugblik', null, speler)).status, 403);
    assert.strictEqual((await req(server, 'POST', '/api/display/terugblik', {}, speler)).status, 403);
  });

  it('gaat naar het tafelscherm en niet naar de telefoon van een speler', async () => {
    const tel = await connect(port, speler);
    const tafel = await connect(port, dm);
    tafel.emit('display:register');
    await new Promise(r => setTimeout(r, 150));
    const bijSpeler = waitFor(tel, 'terugblik:display', 800);
    const bijTafel  = waitFor(tafel, 'terugblik:display', 900);
    const r = await req(server, 'POST', '/api/display/terugblik', {}, dm);
    assert.strictEqual(r.status, 200);
    const [s, t] = await Promise.all([bijSpeler, bijTafel]);
    tel.close(); tafel.close();
    assert.strictEqual(s, null, 'de speler hoort de terugblik niet in zijn browser te krijgen');
    assert.ok(t, 'het tafelscherm krijgt hem wél');
    assert.strictEqual(t.sessieId, nieuwId);
  });

  it('voorbeeld blijft op het scherm van de DM', async () => {
    const tafel = await connect(port, dm);
    tafel.emit('display:register');
    await new Promise(r => setTimeout(r, 150));
    const bijTafel = waitFor(tafel, 'terugblik:display', 600);
    await req(server, 'POST', '/api/display/terugblik', { voorbeeld: true }, dm);
    const t = await bijTafel;
    tafel.close();
    assert.strictEqual(t, null);
  });
});

// De tekstbewerking van de cinematic: van markdown naar ondertitels.
describe('Terugblik: tekst naar ondertitels', () => {
  let intern;
  before(async () => {
    // De module importeert api.js met een querystring; laad hem als tekst en
    // knip de import eruit, dan draait hij zonder browser.
    const vm = require('vm');
    const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'terugblik.js'), 'utf8')
      .replace(/^import .*$/m, 'const api = {};')
      .replace(/^export const _intern = /m, 'globalThis.__tb = ');
    const ctx = { window: {}, globalThis: {}, document: {}, setTimeout, clearTimeout };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(bron, ctx);
    intern = ctx.__tb;
  });

  it('haalt opmaak weg en markeert namen', () => {
    const t = intern._platteTekst('## Kop\n**Vet** en [[Bram Kruik|Bram]] in ![[plaatje]] de [stad](https://x).\n| a | b |');
    assert.ok(!t.includes('##') && !t.includes('**') && !t.includes('plaatje') && !t.includes('|'));
    assert.ok(t.includes('\u0001Bram\u0002'));
    assert.ok(t.includes('de stad.'));
  });

  it('markeert de langste naam en niet een stukje ervan', () => {
    const t = intern._markeerNamen('Bram Kruik groette Bram.', ['Bram', 'Bram Kruik']);
    assert.strictEqual(t, '\u0001Bram Kruik\u0002 groette \u0001Bram\u0002.');
  });

  it('breekt een lange tekst in brokken van leesbare lengte', () => {
    const zin = 'Ze liepen door de regen naar de haven, waar de schepen lagen te deinen. ';
    const brokken = intern._brokken(zin.repeat(8).trim());
    assert.ok(brokken.length >= 3);
    for (const b of brokken) assert.ok(b.length <= 175 * 1.4 + 2, `te lang: ${b.length}`);
  });

  it('kent Romeinse cijfers voor de akte', () => {
    assert.strictEqual(intern._romeins(4), 'IV');
    assert.strictEqual(intern._romeins(14), 'XIV');
    assert.strictEqual(intern._romeins(null), '');
  });
});
