// **Wat je oproept, komt in de monsterbibliotheek.**
//
// Gevraagd door de DM: een familiar die aan een feature, spreuk of voorwerp
// hangt hoort vanzelf beschikbaar te zijn voor een gevecht. Bij het **krijgen**
// van die spreuk weet de app nog niet wélk wezen het wordt — van de 25 summons
// heeft er één een vast statblok, zeven hebben meerdere gedaantes (Find
// Familiar alleen al veertien) en zeventien helemaal geen. Bij het **oproepen**
// weet ze het precies: daar is de gedaante al opgelost naar één statblok.
// Zie `docs/voorstel-summons-automatisch.md`.
//
// Twee dingen staan hier op scherp:
//  - hij landt met **`inBestiarium: false`**. Dat is in deze app "wél
//    bruikbaar, geen encyclopedie-item": een uil die een speler oproept is zijn
//    eigen beest, geen ontdekking van de party. Als encyclopedie-item zou hij
//    als onontdekt kaartje in het bestiarium verschijnen, en dat is een
//    verkeerde belofte;
//  - in de bibliotheek staat het **wezen**, niet het koosnaampje: een Owl, geen
//    "Pluisje". Anders groeit de lijst met namen die niemand terugvindt.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-sumbib-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('Wat je oproept, komt in de bibliotheek', () => {
  let server, io, dm, held, sessie, gid;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;

    const groepen = (await req(server, 'GET', '/api/groups', null, dm)).body;
    gid = groepen?.activeGroup || (groepen?.groups || [])[0]?.id;
    await req(server, 'PUT', `/api/groups/${gid}/password`, { password: 'proef1234' }, dm);

    held = (await req(server, 'POST', '/api/entities/personages',
      { name: 'Mira', subtype: 'speler', data: { groep: gid } }, dm)).body.id;
    // Een Wizard die Find Familiar kan: dan staat Familiar in zijn aanbod.
    await req(server, 'PATCH', `/api/player-profile/${held}`,
      { klasse: 'Wizard', level: '5', klasseLevel: '5' }, dm);
    // **En de spreuk moet in zijn boek staan.** Zonder dat weigert het
    // oproepen met 409 — het aanbod van een speler is smaller dan dat van de
    // DM, die met `alles: true` alles ziet. De eerste versie van deze toets
    // las het aanbod als DM en liet de speler iets oproepen wat hij niet kende;
    // twee toetsen slaagden daardoor om niets (er werd nooit iets toegevoegd).
    await req(server, 'POST', `/api/player-spells/${held}`,
      { index: 'find-familiar', name: 'Find Familiar' }, dm);
    sessie = (await req(server, 'POST', '/api/auth/player-login',
      { campagne: 'grisburgh', characterId: held, password: 'proef1234' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const monsters = async () => {
    const b = (await req(server, 'GET', '/api/monsters', null, dm)).body;
    return b.monsters || (Array.isArray(b) ? b : []);
  };
  // Het aanbod van de **speler**: dat is wat hij echt kan oproepen. Als DM
  // krijg je `alles: true` en dus een lijst die niets bewijst.
  const aanbod = async () => (await req(server, 'GET', `/api/characters/${held}/summons`, null, sessie)).body.aanbod || [];

  it('zet het opgeroepen wezen erin, met zijn eigen statblok', async () => {
    const lijst = await aanbod();
    const fam = lijst.find(c => (c.vormen || []).some(v => v.naam === 'Owl'));
    assert.ok(fam, 'een Wizard 5 hoort een Familiar te kunnen oproepen: ' + JSON.stringify(lijst.map(c => c.naam)));

    const voor = (await monsters()).length;
    const r = await req(server, 'POST', `/api/characters/${held}/summons`,
      { metgezelId: fam.id, vorm: 'Owl', naam: 'Pluisje' }, sessie);
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));

    const na = await monsters();
    assert.strictEqual(na.length, voor + 1, 'er hoort er precies één bij te komen');
    const owl = na.find(m => m.name === 'Owl');
    assert.ok(owl, 'in de bibliotheek staat het wézen: ' + JSON.stringify(na.map(m => m.name)));
    assert.ok(!na.some(m => m.name === 'Pluisje'), 'en niet het koosnaampje van de speler');
    assert.match(String(owl.statblock?.type || ''), /beast/i, 'mét zijn statblok, dus ook zijn creature type');
    assert.ok(owl.maxHp >= 1, 'en met HP, anders staat hij op nul in een gevecht');
  });

  it('zet hem erin als "wel bruikbaar, geen encyclopedie-item"', async () => {
    const owl = (await monsters()).find(m => m.name === 'Owl');
    assert.strictEqual(owl.inBestiarium, false,
      'een uil die een speler oproept is zijn eigen beest, geen ontdekking van de party');
    // En dus staat hij niet in het bestiarium van de party — ook niet als
    // onontdekt kaartje, want dat zou verklappen dat er iets te ontdekken is.
    const best = (await req(server, 'GET', '/api/bestiarium', null, dm)).body;
    const rijen = best.monsters || best.wezens || (Array.isArray(best) ? best : []);
    assert.ok(!rijen.some(m => m.name === 'Owl'), 'hij hoort niet in het bestiarium te staan');
  });

  it('voegt hem geen tweede keer toe', async () => {
    const voor = (await monsters()).length;
    const fam = (await aanbod()).find(c => (c.vormen || []).some(v => v.naam === 'Owl'));
    await req(server, 'POST', `/api/characters/${held}/summons`,
      { metgezelId: fam.id, vorm: 'Owl', naam: 'Nog een uil' }, sessie);
    assert.strictEqual((await monsters()).length, voor, 'hij stond er al');
  });

  it('laat een wezen dat de DM zelf in het bestiarium zette met rust', async () => {
    // Staat hij er al als encyclopedie-item, dan is dát zijn statblok — en de
    // vlag mag niet omgezet worden door een speler die hem oproept.
    const eigen = await req(server, 'POST', '/api/monsters',
      { name: 'Raven', maxHp: 3, statblock: { type: 'Beast', ac: '12', cr: '0' } }, dm);
    assert.ok(eigen.status === 200 || eigen.status === 201, JSON.stringify(eigen.body));

    const fam = (await aanbod()).find(c => (c.vormen || []).some(v => v.naam === 'Raven'));
    await req(server, 'POST', `/api/characters/${held}/summons`,
      { metgezelId: fam.id, vorm: 'Raven' }, sessie);

    const raven = (await monsters()).filter(m => m.name === 'Raven');
    assert.strictEqual(raven.length, 1, 'geen tweede Raven ernaast');
    assert.notStrictEqual(raven[0].inBestiarium, false, 'en zijn plek in het bestiarium blijft');
  });

  it('schrijft niets in de onthul-geschiedenis van het archief', async () => {
    // `archief.logEntries` is de onthulgeschiedenis van documenten (vandaar
    // `docId` op elke regel). Een bibliotheek-mutatie daartussen zou die lijst
    // iets anders laten betekenen voor iedereen die hem leest.
    const arch = (await req(server, 'GET', '/api/archief', null, dm)).body;
    const regels = arch.logEntries || [];
    assert.ok(!regels.some(r => /Owl|bibliotheek/i.test(JSON.stringify(r))),
      'het logboek gaat over onthullingen, niet over administratie');
  });
});
