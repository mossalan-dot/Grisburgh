// **Een eigen beest hoort gewoon mee te doen.**
//
// Achter de deur *Familiars* staan de SRD-beesten én wat de campagne zelf als
// Beast in haar bestiarium heeft; datzelfde lijstje voedt de gedaantes van
// Wild Shape. Alleen: de twee plekken die ze uitzochten lazen `m.type`, en zo
// bewaart `monsters.json` het niet — naam, id en beeld staan bovenaan, de rest
// onder `statblock`. Gemeten op 26 nov 2026 over alle campagnes: **nul**
// monsters met een plat `type`, tachtig met een geneste. Die filters matchten
// dus structureel niets.
//
// Wat dat kostte: Grisburghs eigen Wolf stond niet achter Familiars terwijl de
// SRD-Wolf er wél stond, je kon er geen Wild Shape in, en het kaartje kreeg
// geen `monsterId` — dus ook geen knop naar het bestiarium, de enige plek waar
// zijn statblok te bewerken is. Negen beesten in Grisburgh, drie in Test.
// Zo is het ook gemeld: "ik kan alleen de beschrijving en een afbeelding
// wijzigen, niet het statblok".
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-beest-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Een eigen beest in het bestiarium', () => {
  let server, io, dm, mijnId;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    // Precies zoals de monster-editor hem wegschrijft: het statblok genest.
    const r = await req(server, 'POST', '/api/monsters', {
      name: 'Veenwolf', maxHp: 26,
      statblock: { type: 'Beast', cr: '1/2', ac: '13', hp: '26 (4d8+8)', speed: '40 ft.',
                   actions: '***Bite.*** Melee Attack Roll: +4, reach 5 ft.' },
    }, dm);
    assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
    mijnId = r.body.id;

    // En één die géén beest is, om te zien dat er niet zomaar alles doorkomt.
    await req(server, 'POST', '/api/monsters', {
      name: 'Veenschim', maxHp: 40, statblock: { type: 'Undead', cr: '2', ac: '12' },
    }, dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const beesten = async () => (await req(server, 'GET', '/api/bron/beesten', null, dm)).body.beesten || [];

  it('zet een eigen beest in de lijst, naast die uit de SRD', async () => {
    const lijst = await beesten();
    assert.ok(lijst.length > 50, `${lijst.length} beesten — de SRD hoort er ook in te staan`);
    const mijn = lijst.find(b => b.naam === 'Veenwolf');
    assert.ok(mijn, 'een eigen Beast hoort achter de deur Familiars te staan');
    assert.ok(!lijst.some(b => b.naam === 'Veenschim'), 'een Undead hoort er niet bij');
  });

  it('draagt zijn cijfers, niet een leeg kaartje', async () => {
    // `kort()` leest cr/ac/hp/speed uit het statblok. Plat meegegeven kwam de
    // Veenwolf binnen zonder één getal — zichtbaar, maar nietszeggend.
    const mijn = (await beesten()).find(b => b.naam === 'Veenwolf');
    assert.strictEqual(mijn.cr, '1/2');
    assert.strictEqual(mijn.ac, '13');
    assert.match(mijn.hp, /26/);
    assert.match(mijn.speed, /40/);
    assert.ok((mijn.aanvallen || []).includes('Bite'), 'zijn aanval hoort erbij: ' + JSON.stringify(mijn.aanvallen));
  });

  it('wijst terug naar het bestiarium, want dáár bewerk je zijn statblok', async () => {
    const mijn = (await beesten()).find(b => b.naam === 'Veenwolf');
    assert.strictEqual(mijn.monsterId, mijnId,
      'zonder dit id heeft het kaartje geen knop naar de editor, en lijkt het statblok onbewerkbaar');
    assert.strictEqual(mijn.eigen, true, 'en hij weet dat hij van deze campagne is');
    // Een SRD-beest houdt géén id: daar valt niets aan te bewerken tot iemand
    // hem overneemt, en een knop die nergens heen gaat is erger dan geen knop.
    const srd = (await beesten()).find(b => b.naam === 'Wolf' && !b.eigen);
    if (srd) assert.ok(!srd.monsterId, 'een SRD-beest hoort geen monsterId te hebben');
  });

  it('laat een eigen beest een gedaante voor Wild Shape zijn', async () => {
    // Dezelfde lijst voedt Wild Shape; stond hij daar niet in, dan kon een
    // Druid nooit in het beest van zijn eigen campagne veranderen.
    const held = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Mira', subtype: 'speler' }, dm)).body.id;
    await req(server, 'PATCH', `/api/player-profile/${held}`,
      { klasse: 'Druid', level: '8', klasseLevel: '8' }, dm);
    const r = await req(server, 'GET', `/api/characters/${held}/klassekracht`, null, dm);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const aanbod = JSON.stringify(r.body);
    assert.match(aanbod, /Veenwolf/, 'een eigen beest hoort bij de gedaantes te staan');
  });

  it('leest ook de oude platte vorm nog', async () => {
    // Die komt uit oudere data; hij mag niet wegvallen door de reparatie.
    const r = await req(server, 'POST', '/api/monsters',
      { name: 'Platbeest', maxHp: 9, type: 'Beast', cr: '1/8', ac: '11' }, dm);
    assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
    assert.ok((await beesten()).some(b => b.naam === 'Platbeest'),
      'een monster met een plat `type` hoort ook mee te tellen');
  });
});
