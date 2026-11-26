// **Sleutelen aan een familiar, zonder de bron aan te raken.**
//
// De deur *Familiars* is het naslagwerk van wat je kunt oproepen, en de DM
// maakt er zijn eigen wereld van: een Greater Steed die in Grisburgh een
// Rijdier van de Veenwacht heet en ook een Veenkat kan zijn. Dat gaat zoals
// het bij spreuken al gaat (`spells.json → eigen[index]`): de meegeleverde
// lijst blijft zoals hij is, en wat de DM schrijft staat in de campagne en
// wint bij het tónen. Zo komen latere verbeteringen aan die lijst gewoon
// binnen zolang hij niets eigens zette.
//
// Twee dingen staan hier op scherp, want ze gingen bij het bouwen allebei mis:
//  - het veld heet **`eigenNaam`** en niet `naam`, want `naam` is in deze
//    route al de **sleutel** van het kaartje. Met `naam` schreef hij onder een
//    splinternieuwe sleutel en verdween de bewerking spoorloos — status 200,
//    geen foutmelding, niets opgeslagen;
//  - **leeg betekent terug naar de bron**, niet "sla het veld over". Anders
//    kun je een overschrijving nooit meer weghalen zodra je er een gezet hebt.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-fam-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Een familiar naar je eigen hand zetten', () => {
  let server, io, dm;
  const SLEUTEL = 'metgezel:Greater Steed';

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const zet = (velden) => req(server, 'PUT', '/api/meta/naslagkaart',
    { soort: 'metgezel', naam: 'Greater Steed', ...velden }, dm);
  const bak = async () => (await req(server, 'GET', '/api/meta', null, dm)).body.naslagkaarten?.[SLEUTEL] || null;

  it('bewaart een eigen naam en eigen gedaantes onder de bronnaam', async () => {
    const r = await zet({ eigenNaam: 'Rijdier van de Veenwacht', vormen: ['Dire Wolf', 'Warhorse', 'Veenkat'] });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const b = await bak();
    assert.strictEqual(b.eigenNaam, 'Rijdier van de Veenwacht');
    assert.deepStrictEqual(b.vormen, ['Dire Wolf', 'Warhorse', 'Veenkat']);
    // **De sleutel blijft de bronnaam.** Zou hij meeverhuizen, dan raakt het
    // kaartje bij het openen zijn eigen overschrijving kwijt — de editor zoekt
    // dan onder de nieuwe naam en vindt niets.
    const alles = (await req(server, 'GET', '/api/meta', null, dm)).body.naslagkaarten || {};
    assert.deepStrictEqual(Object.keys(alles), [SLEUTEL]);
  });

  it('laat de meegeleverde lijst onaangeraakt', async () => {
    const bron = (await req(server, 'GET', '/api/bron/metgezellen', null, dm)).body.metgezellen || [];
    const steed = bron.find(c => c.naam === 'Greater Steed');
    assert.ok(steed, 'Greater Steed hoort in de bron te staan');
    assert.strictEqual(steed.vormen.length, 5, 'de bron houdt zijn vijf gedaantes');
    assert.ok(steed.vormen.some(v => v.naam === 'Deinonychus'),
      'ook de gedaante die de DM eruit liet, staat er in de bron nog');
  });

  it('zet een leeg veld terug op de bron', async () => {
    await zet({ eigenNaam: '', vormen: [] });
    assert.strictEqual(await bak(), null,
      'niets eigens meer betekent: geen kaartje in de bak, dus de bron geldt weer');
  });

  it('neemt de bronnaam niet als eigen naam over', async () => {
    // Je eigen naam gelijk maken aan die uit het boek is geen overschrijving;
    // dan blijft er niets te onthouden.
    await zet({ eigenNaam: 'Greater Steed' });
    assert.strictEqual(await bak(), null);
  });

  it('houdt de overschrijving bij de metgezellen', async () => {
    // Een beest of een conditie heeft geen gedaantes en wordt niet opgeroepen;
    // daar zou dit veld een belofte zijn die nergens op slaat.
    await req(server, 'PUT', '/api/meta/naslagkaart',
      { soort: 'beest', naam: 'Wolf', eigenNaam: 'Veenwolf', vormen: ['Vos'] }, dm);
    const b = (await req(server, 'GET', '/api/meta', null, dm)).body.naslagkaarten?.['beest:Wolf'] || null;
    assert.strictEqual(b, null, 'bij een beest horen die twee velden niet');
  });

  it('knipt een onzinnige invoer af in plaats van hem te slikken', async () => {
    await zet({ eigenNaam: 'x'.repeat(200), vormen: Array.from({ length: 80 }, (_, i) => 'Vorm ' + i) });
    const b = await bak();
    assert.strictEqual(b.eigenNaam.length, 80, 'een naam heeft een bovengrens');
    assert.strictEqual(b.vormen.length, 40, 'en een gedaantelijst ook');
    await zet({ eigenNaam: '', vormen: [] });
  });
});
