const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Een akte importeren.** De DM schrijft in Obsidian en leest het bestand hier
// in: de `##`-koppen worden sectiekoppen in het regie-script, `[[Naam]]` wordt
// een kaartje-stap en `![[bestand]]` een beeld-stap.
//
// Twee dingen zijn bij het bouwen misgegaan en horen daarom vast te staan.
// De importer **gooide de tekst weg** — hij haalde de tokens eruit en liet de
// `.md` vallen, precies waarom Obsidian tijdens het spelen nog openstond. En
// bij **aanvullen** mag bestaande tekst niet overschreven worden: dan vul je
// een akte aan en zou je het werk van de vorige keer kwijtraken.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-imp-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function req(server, method, p, body, cookie) {
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
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        let b; try { b = JSON.parse(data); } catch { b = data; }
        resolve({ status: res.statusCode, body: b, cookie: sc ? sc[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

// `/import/akte/apply` draait achter de upload-middleware, dus hij leest
// multipart — ook als er geen enkel bestand meegaat.
function formReq(server, p, cookie, velden) {
  return new Promise((resolve, reject) => {
    const grens = '----grisburgh' + Math.random().toString(36).slice(2);
    const delen = [];
    for (const [k, v] of Object.entries(velden)) {
      delen.push(Buffer.from(`--${grens}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
    delen.push(Buffer.from(`--${grens}--\r\n`));
    const lijf = Buffer.concat(delen);
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const r = http.request({
      method: 'POST', hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      headers: { 'Content-Type': `multipart/form-data; boundary=${grens}`, 'Content-Length': lijf.length, Cookie: cookie },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { let b; try { b = JSON.parse(data); } catch { b = data; } resolve({ status: res.statusCode, body: b }); });
    });
    r.on('error', reject);
    r.write(lijf); r.end();
  });
}

const MD = [
  '# Akte 3 — De Verzonken Werf',
  '',
  '## De aankomst',
  'Aan de kade wacht [[Bram Kruik]], met een blik die niets belooft.',
  '![[werf-bij-nacht.png]]',
  '',
  '## In het pakhuis',
  'Achterin staat [[Bram Kruik]] weer, en naast hem [[Isidora Swering]].',
].join('\n');

describe('Een akte importeren', () => {
  let server, io, storage, dm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    await req(server, 'POST', '/api/entities/personages', { name: 'Bram Kruik' }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('maakt van elke ##-kop een sectiekop in het script', async () => {
    const r = await req(server, 'POST', '/api/import/akte/preview', { md: MD }, dm);
    assert.strictEqual(r.status, 200);
    const koppen = r.body.plan.filter(s => s.type === 'kop').map(s => s.titel);
    assert.deepStrictEqual(koppen, ['De aankomst', 'In het pakhuis'],
      'de koppen uit de tekst worden de secties van het script, in volgorde');
  });

  it('herkent een kaartje, een onbekende naam en een beeld', async () => {
    const r = await req(server, 'POST', '/api/import/akte/preview', { md: MD }, dm);
    const soorten = r.body.plan.map(s => s.type);
    assert.ok(soorten.includes('entity'), 'een [[naam]] wordt een kaartje-stap');
    assert.ok(soorten.includes('image'), 'een ![[bestand]] wordt een beeld-stap');
    // Een beeld is géén naam: `![[…]]` mag niet als kaartje meetellen.
    const namen = r.body.plan.filter(s => s.type === 'entity').map(s => s.naam || s.name || '');
    assert.ok(!namen.some(n => /werf-bij-nacht/.test(n)), 'het plaatje staat als naam in de lijst');
    assert.ok(r.body.reports, 'er is een rapport van wat niet matchte');
    assert.ok((r.body.reports.unmatchedEntities || []).some(n => /Isidora/.test(JSON.stringify(n))),
      'een naam zonder kaartje wordt gemeld in plaats van stil overgeslagen');
  });

  it('bewaart de markdown bij de akte, want anders blijft Obsidian openstaan', async () => {
    const r = await formReq(server, '/api/import/akte/apply', dm, {
      plan: '[]', chapterKey: 'h3', md: MD, mode: 'replace',
    });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const meta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'grisburgh', 'meta.json'), 'utf8'));
    assert.match(meta.hoofdstukken.h3.tekst, /Verzonken Werf/, 'de tekst staat bij de akte');
    assert.match(meta.hoofdstukken.h3.tekst, /Bram Kruik/);
  });

  it('laat bestaande tekst staan als je aanvult', async () => {
    const pad = path.join(DATA_DIR, 'campaigns', 'grisburgh', 'meta.json');
    const meta = JSON.parse(fs.readFileSync(pad, 'utf8'));
    meta.hoofdstukken.h4 = { num: 4, title: 'Vier', tekst: 'Wat ik vorige week schreef.' };
    fs.writeFileSync(pad, JSON.stringify(meta, null, 2));

    const r = await formReq(server, '/api/import/akte/apply', dm, {
      plan: '[]', chapterKey: 'h4', md: MD, mode: 'append',
    });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const na = JSON.parse(fs.readFileSync(pad, 'utf8'));
    assert.strictEqual(na.hoofdstukken.h4.tekst, 'Wat ik vorige week schreef.',
      'aanvullen mag het werk van de vorige keer niet overschrijven');
  });
});
