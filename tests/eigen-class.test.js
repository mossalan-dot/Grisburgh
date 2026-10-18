const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// ════════════════════════════════════════════════════════════════════════════
//  EEN EIGEN CLASS BEGINNEN
// ════════════════════════════════════════════════════════════════════════════
// `POST /progression/feature` kon een **level** aanmaken maar geen class: was de
// class, het species of de background er niet, dan kwam er een 400. Je kon dus
// features hangen aan wat er al was, en nooit een eigen orde of een eigen volk
// beginnen — terwijl dat juist is wat een campagne met eigen materiaal wil.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-eigen-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        let parsed; try { parsed = JSON.parse(d); } catch { parsed = d; }
        resolve({ status: res.statusCode, body: parsed, cookie: sc ? sc[0].split(';')[0] : cookie });
      });
    });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}

describe('Eigen class, species of background', () => {
  let server, io, dm;
  const prog = () => JSON.parse(fs.readFileSync(
    path.join(DATA_DIR, 'campaigns', 'grisburgh', 'progression.json'), 'utf8'));

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    assert.ok(dm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const voeg = (body) => req(server, 'POST', '/api/progression/feature', body, dm);

  // Een verzonnen naam, en met opzet: dit ging over de Artificer zolang die
  // niet meegeleverd werd, maar sinds hij in de seed staat bewees die test niets
  // meer. Een class die écht nergens staat is de enige goede proef.
  it('legt een class aan die er nog niet was', async () => {
    const r = await voeg({ soort: 'class', bron: 'Lantaarnwachter', level: 1, naam: 'Vlam Aansteken', desc: '' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const cls = prog().classes.Lantaarnwachter;
    assert.ok(cls, 'de class staat er');
    assert.equal(cls.levels['1'][0].name, 'Vlam Aansteken');
    assert.deepEqual(cls.subclasses, {}, 'met een lege plek voor subclasses');
  });

  it('legt een subclass aan onder een bestaande class', async () => {
    const r = await voeg({ soort: 'subclass', bron: 'Artificer', sub: 'Armorer', level: 3, naam: 'Arcane Armor', desc: '' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(prog().classes.Artificer.subclasses.Armorer.levels['3'][0].name, 'Arcane Armor');
  });

  it('legt een species en een background aan', async () => {
    assert.equal((await voeg({ soort: 'species', bron: 'Leemlander', level: 1, naam: 'Kleivoet', desc: '' })).status, 200);
    assert.equal((await voeg({ soort: 'background', bron: 'Veerman', level: 1, naam: 'Vaarbewijs', desc: '' })).status, 200);
    assert.ok(prog().species.Leemlander);
    assert.ok(prog().backgrounds.Veerman);
  });

  it('maakt niets aan zonder naam voor de class', async () => {
    const voor = Object.keys(prog().classes).length;
    const r = await voeg({ soort: 'class', bron: '', level: 1, naam: 'Zwevend', desc: '' });
    assert.equal(r.status, 400, 'zonder bron valt er niets te maken');
    assert.equal(Object.keys(prog().classes).length, voor, 'en er is niets bijgekomen');
  });

  it('voegt niets toe bij het alleen lézen van een onbekende class', async () => {
    // `_vaardigLijst` zonder `maken` mag nooit stilletjes iets aanleggen: dat
    // zou een typefout in een filter tot een nieuwe class promoveren.
    const voor = Object.keys(prog().classes).length;
    await req(server, 'GET', '/api/progression', null, dm);
    assert.equal(Object.keys(prog().classes).length, voor);
  });

  // ── De uitleg van een houder ──────────────────────────────────────────────
  // Een subclass heeft een verhaal dat los staat van zijn features: "wat is een
  // Berserker" is iets anders dan wat Frenzy doet. Dat verhaal hangt aan de
  // houder zelf, en dat is ook de enige plek waar een subclass uit een ander
  // boek iets kwijt kan — alleen de naam van dat boek, nooit zijn tekst.
  it('legt een houder aan met zijn uitleg en het boek erbij', async () => {
    const r = await req(server, 'POST', '/api/progression/houder',
      { soort: 'subclass', bron: 'Barbarian', naam: 'Path of the Totem Warrior',
        boek: "Player's Handbook (2014)", herkomst: 'overgenomen' }, dm);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const sub = prog().classes.Barbarian.subclasses['Path of the Totem Warrior'];
    assert.ok(sub, 'de subclass staat erin');
    assert.deepEqual(sub.levels, {}, 'zonder features: die staan in het boek');
    assert.equal(sub.boek, "Player's Handbook (2014)");
    assert.equal(sub.desc, undefined, 'en zonder tekst — die mag er niet uit');
  });

  // Met een verzonnen subclass, niet met een bestaande: de app schrijft nooit
  // zelf wat een Berserker of een Beast is. Dat doet de DM, uit zijn eigen boek
  // of uit zijn eigen hoofd.
  it('werkt de uitleg van een bestaande houder bij', async () => {
    await req(server, 'POST', '/api/progression/houder',
      { soort: 'subclass', bron: 'Barbarian', naam: 'Pad van de Veenwachter' }, dm);
    const r = await req(server, 'PUT', '/api/progression/houder',
      { soort: 'subclass', bron: 'Barbarian', naam: 'Pad van de Veenwachter',
        desc: 'Wat de DM hier intikt.' }, dm);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const sub = prog().classes.Barbarian.subclasses['Pad van de Veenwachter'];
    assert.equal(sub.desc, 'Wat de DM hier intikt.');
    assert.deepEqual(sub.levels, {}, 'de features blijven met rust');
  });

  it('wist de uitleg als je het veld leegmaakt', async () => {
    await req(server, 'POST', '/api/progression/houder',
      { soort: 'class', naam: 'Blikslager', desc: 'Iets' }, dm);
    assert.equal(prog().classes.Blikslager.desc, 'Iets');
    await req(server, 'PUT', '/api/progression/houder', { soort: 'class', naam: 'Blikslager', desc: '  ' }, dm);
    assert.equal(prog().classes.Blikslager.desc, undefined, 'leeg is weg, niet een lege string');
  });

  it('weigert de uitleg van een houder die er niet is', async () => {
    const r = await req(server, 'PUT', '/api/progression/houder',
      { soort: 'class', naam: 'Bestaat Niet', desc: 'x' }, dm);
    assert.equal(r.status, 404);
  });

  // Een eigen class heeft geen icoon in de app — die kent alleen de namen die
  // ze meebrengt. Wat voor soort class het is, is wél in te vullen, en dáár
  // hangt het icoon aan.
  it('onthoudt of een class martial, half-caster of caster is', async () => {
    await req(server, 'POST', '/api/progression/houder', { soort: 'class', naam: 'Veenzanger' }, dm);
    const r = await req(server, 'PUT', '/api/progression/houder',
      { soort: 'class', naam: 'Veenzanger', basis: { aard: 'caster', hitDie: 'd6' } }, dm);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(prog().classes.Veenzanger.basis.aard, 'caster');

    await req(server, 'PUT', '/api/progression/houder',
      { soort: 'class', naam: 'Veenzanger', basis: { aard: 'onzin', hitDie: 'd6' } }, dm);
    // Niets geldigs ingevuld, dus er blijft geen afwijking over en `basis`
    // valt helemaal weg — net als bij een leeggemaakt tekstveld.
    assert.equal(prog().classes.Veenzanger.basis, undefined, 'alleen de drie die bestaan');
  });

  // De multiclass-eis hoort bij de Core Traits: op het kaartje stond hij al,
  // maar hij kwam uit een tabel van de app en was dus niet te zetten — en voor
  // een class die daar niet in staat stond er niets.
  it('onthoudt de multiclass-eis van een eigen class', async () => {
    await req(server, 'POST', '/api/progression/houder', { soort: 'class', naam: 'Veenwachter' }, dm);
    const r = await req(server, 'PUT', '/api/progression/houder',
      { soort: 'class', naam: 'Veenwachter',
        basis: { hitDie: 'd10', multiEis: 'Wisdom 13', multiTraining: 'Light Armor, Shields' } }, dm);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const basis = prog().classes.Veenwachter.basis;
    assert.equal(basis.multiEis, 'Wisdom 13');
    assert.equal(basis.multiTraining, 'Light Armor, Shields');
  });

  // ── En weer weg ───────────────────────────────────────────────────────────
  // Aanmaken kon, weghalen niet: een class die je per ongeluk begon bleef staan
  // tot je de hele progressie reset.
  it('haalt een eigen class weg, met zijn subclasses en features', async () => {
    await req(server, 'POST', '/api/progression/houder', { soort: 'class', naam: 'Veenloper' }, dm);
    await req(server, 'POST', '/api/progression/houder',
      { soort: 'subclass', bron: 'Veenloper', naam: 'Pad van het Riet' }, dm);
    await req(server, 'POST', '/api/progression/feature',
      { soort: 'class', bron: 'Veenloper', level: 1, naam: 'Moerasvoet', desc: 'x' }, dm);
    await req(server, 'POST', '/api/progression/feature',
      { soort: 'subclass', bron: 'Veenloper', sub: 'Pad van het Riet', level: 3, naam: 'Rietsnede', desc: 'x' }, dm);

    const r = await req(server, 'POST', '/api/progression/houder/verwijderen',
      { soort: 'class', naam: 'Veenloper' }, dm);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.subclasses, 1, 'het zegt hoeveel subclasses er meegingen');
    assert.equal(r.body.features, 2, 'en hoeveel features — die van de subclass ook');
    assert.equal(prog().classes.Veenloper, undefined);
  });

  it('weigert een houder weg te halen die in gebruik is, tenzij je doordrukt', async () => {
    await req(server, 'POST', '/api/progression/houder', { soort: 'class', naam: 'Kruidenlezer' }, dm);
    const pc = await req(server, 'POST', '/api/entities/personages',
      { name: 'Griet', data: { klasse: 'Kruidenlezer' } }, dm);
    assert.equal(pc.status, 201, JSON.stringify(pc.body));

    const weigering = await req(server, 'POST', '/api/progression/houder/verwijderen',
      { soort: 'class', naam: 'Kruidenlezer' }, dm);
    assert.equal(weigering.status, 409);
    assert.deepEqual(weigering.body.gebruik, ['Griet'], 'het zegt bij wie hij staat');
    assert.ok(prog().classes.Kruidenlezer, 'en hij staat er nog');

    const toch = await req(server, 'POST', '/api/progression/houder/verwijderen',
      { soort: 'class', naam: 'Kruidenlezer', toch: true }, dm);
    assert.equal(toch.status, 200, JSON.stringify(toch.body));
    assert.equal(prog().classes.Kruidenlezer, undefined);
  });

  it('weigert een houder weg te halen die er niet is', async () => {
    const r = await req(server, 'POST', '/api/progression/houder/verwijderen',
      { soort: 'class', naam: 'Bestaat Niet' }, dm);
    assert.equal(r.status, 404);
  });
});
