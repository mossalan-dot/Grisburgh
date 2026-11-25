const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// **Twee dingen van een speler die van hém zijn.**
//
// 1. Zijn **aantekening** bij een kaartje. Die staat in `player-notes.json`
//    onder `"<entityId>::<spelersnaam>"`, en een medespeler hoort hem niet te
//    zien — de DM wel, want die leest ze gegroepeerd per speler.
// 2. Zijn **charges**. Die staan per party (`groups[gid].itemCharges`), en de
//    party volgt uit het **karakter**, niet uit welke groep de DM toevallig
//    actief heeft staan. Dat laatste ging eerder mis bij het bijstellen van een
//    aantal (zie `PATCH /items/:id/owner/:charId` in CLAUDE.md), dus het hoort
//    hier vast te liggen: een speler die een charge verbruikt terwijl de DM naar
//    een andere tafel kijkt, schrijft in zijn eigen party.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-prive-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

const lees = (naam) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'campaigns', 'grisburgh', naam), 'utf8'));

describe('Wat van een speler zelf is', () => {
  let server, io, dm, groepB, held, maat, kaartje, flesje, sessieHeld, sessieMaat;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    // Een tweede party, met daarin de held. De DM blijft naar groep1 kijken.
    await req(server, 'POST', '/api/groups', { name: 'De Tweede Tafel', password: 'tweede-tafel' }, dm);
    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body.groups;
    groepB = groepen.find(g => g.name === 'De Tweede Tafel').id;

    const maak = async (naam, groep) => (await req(server, 'POST', '/api/entities/personages',
      { name: naam, subtype: 'speler', data: { groep } }, dm)).body.id;
    held = await maak('Wilmer', groepB);
    maat = await maak('Rozemarijn', groepB);
    kaartje = (await req(server, 'POST', '/api/entities/locaties', { name: 'De Verzonken Werf' }, dm)).body.id;
    flesje  = (await req(server, 'POST', '/api/entities/voorwerpen',
      { name: 'Staf van Kleine Wonderen', data: { maxCharges: '5' } }, dm)).body.id;

    const inloggen = async (id) => (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: id, password: 'tweede-tafel' })).cookie;
    sessieHeld = await inloggen(held);
    sessieMaat = await inloggen(maat);
    assert.ok(sessieHeld && sessieMaat, 'beide spelers zijn ingelogd');
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('houdt een aantekening bij de speler die hem schreef', async () => {
    const zet = await req(server, 'PUT', `/api/player-notes/${kaartje}`,
      { note: 'De waard keek weg toen ik naar de kelder vroeg.' }, sessieHeld);
    assert.strictEqual(zet.status, 200);

    const eigen = await req(server, 'GET', `/api/player-notes/${kaartje}`, null, sessieHeld);
    assert.match(eigen.body.note, /kelder/, 'hij leest zijn eigen aantekening terug');

    const ander = await req(server, 'GET', `/api/player-notes/${kaartje}`, null, sessieMaat);
    assert.strictEqual(ander.body.note, '', 'een medespeler aan dezelfde tafel leest hem niet');
    assert.ok(!JSON.stringify(ander.body).includes('kelder'), 'en ziet de tekst nergens');
  });

  it('laat de DM ze wél zien, want hij leest mee met de tafel', async () => {
    await req(server, 'PUT', `/api/player-notes/${kaartje}`, { note: 'Ik vertrouw hem niet.' }, sessieMaat);
    const alles = await req(server, 'GET', `/api/player-notes/${kaartje}`, null, dm);
    const namen = Object.keys(alles.body.notes || {});
    assert.strictEqual(namen.length, 2, 'de DM ziet beide aantekeningen, per speler');
  });

  it('weigert te schrijven zonder spelerssessie', async () => {
    const r = await req(server, 'PUT', `/api/player-notes/${kaartje}`, { note: 'stiekem' }, dm);
    assert.strictEqual(r.status, 403, 'de DM schrijft geen aantekening namens een speler');
  });

  it('schrijft charges in de party van het karakter, niet in de actieve groep', async () => {
    // De DM kijkt naar groep1; de held zit in De Tweede Tafel.
    await req(server, 'PUT', '/api/active-group', { groupId: 'groep1' }, dm);
    await req(server, 'PUT', `/api/items/${flesje}/owner`,
      { characterId: held, playerName: 'Wilmer', groupId: groepB, qty: 1 }, dm);

    const r = await req(server, 'PATCH', `/api/items/${flesje}/owner/${held}/charges`, { charges: 3 }, sessieHeld);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const st = lees('dm-state.json');
    assert.strictEqual(st.groups[groepB]?.itemCharges?.[held]?.[flesje], 3,
      'de charge hoort in de party van de speler te landen');
    assert.strictEqual(st.groups.groep1?.itemCharges?.[held]?.[flesje], undefined,
      'en niet in de party waar de DM toevallig naar keek');
  });

  it('laat een speler niet aan de charges van een ander komen', async () => {
    const r = await req(server, 'PATCH', `/api/items/${flesje}/owner/${held}/charges`, { charges: 0 }, sessieMaat);
    assert.strictEqual(r.status, 403);
  });
});
