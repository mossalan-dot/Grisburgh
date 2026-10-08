const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// ════════════════════════════════════════════════════════════════════════════
//  DE OPSTARTWIZARD
// ════════════════════════════════════════════════════════════════════════════
// De wizard zelf is client-side orkestratie: hij voegt niets toe aan de server
// behalve de vlag `wizardKlaar`. Wat hier bewaakt wordt is dus niet het scherm
// maar de **afspraak eronder** — dat alle stappen die hij zet ook echt mogen en
// landen, en dat ze van de DM van díé campagne komen en niet van de beheerder.
//
// Dat laatste is de kern van het ontwerp: het plan zei "campagnenaam → munten →
// modules → diensten", maar modules staan op `requireBeheerder`. De wizard
// draait daarom in de campagne zelf. Valt die scheiding weg, dan valt deze
// test om.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-wiz-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

describe('De opstartwizard', () => {
  let server, io, storage, beheerder, nieuweDm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('bleke-kust', { appTitle: 'bleke-kust' });
    const ds = path.join(DATA_DIR, 'campaigns', 'bleke-kust', 'dm-state.json');
    const bestaand = JSON.parse(fs.readFileSync(ds, 'utf8'));
    bestaand.dmPassword = 'bleke-kust-dm';
    fs.writeFileSync(ds, JSON.stringify(bestaand, null, 2));
    beheerder = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    nieuweDm  = (await req(server, 'POST', '/api/auth/login', { campagne: 'bleke-kust', password: 'bleke-kust-dm' })).cookie;
    assert.ok(beheerder && nieuweDm);
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  const metaOp = (p, body, cookie) => req(server, 'PUT', p + '?campagne=bleke-kust', body, cookie);
  const lees   = async () => (await req(server, 'GET', '/api/meta?campagne=bleke-kust', null, nieuweDm)).body;

  it('begint zonder vlag, zodat een verse campagne hem krijgt', async () => {
    assert.ok(!(await lees()).wizardKlaar, 'een nieuwe campagne heeft hem nog niet gehad');
  });

  it('zet naam, ondertitel en munten in één keer', async () => {
    const r = await metaOp('/api/meta/app', {
      appTitle: 'De Bleke Kust', appSubtitle: 'Waar het tij de doden brengt',
      currency: { fl: 'Daalder', kn: 'Stuiver', cl: 'Duit' },
    }, nieuweDm);
    assert.equal(r.status, 200);
    const m = await lees();
    assert.equal(m.appTitle, 'De Bleke Kust');
    assert.equal(m.currency.fl, 'Daalder');
    assert.equal(m.currency.cl, 'Duit');
  });

  it('hernoemt elk van de acht diensten met alleen een naam', async () => {
    // De dienstroutes voegen per veld samen, dus alleen `naam` sturen mag niets
    // anders overschrijven. Zou er één gaan vervangen in plaats van samenvoegen,
    // dan wist de wizard stilletjes de configuratie van die dienst.
    const diensten = ['herberg', 'tweespalt', 'gock', 'markt', 'tempel', 'ursula', 'magizoo', 'woekeraar'];
    for (const d of diensten) {
      const r = await metaOp(`/api/meta/${d}`, { naam: `Proef ${d}` }, nieuweDm);
      assert.equal(r.status, 200, `${d} accepteert een naam`);
    }
    const m = await lees();
    for (const d of diensten) assert.equal(m[d]?.naam, `Proef ${d}`, `${d} onthield zijn naam`);
  });

  it('laat de dienstconfiguratie met rust als je alleen de naam zet', async () => {
    await metaOp('/api/meta/gock', { naam: 'De Gock', prijs: { fl: 12 } }, nieuweDm);
    await metaOp('/api/meta/gock', { naam: 'Andere naam' }, nieuweDm);
    const m = await lees();
    assert.equal(m.gock.naam, 'Andere naam');
    assert.deepEqual(m.gock.prijs, { fl: 12 }, 'de prijs stond er nog');
  });

  it('benoemt de eerste party en geeft hem een wachtwoord', async () => {
    const groepen = (await req(server, 'GET', '/api/groups?campagne=bleke-kust', null, nieuweDm)).body;
    const gid = groepen.groups[0].id;
    assert.ok(gid, 'een verse campagne heeft al één party');
    assert.equal((await metaOp(`/api/groups/${gid}`, { name: 'De Vloedlijn' }, nieuweDm)).status, 200);
    assert.equal((await metaOp(`/api/groups/${gid}/password`, { password: 'zoutenzeewier' }, nieuweDm)).status, 200);
    const na = (await req(server, 'GET', '/api/groups?campagne=bleke-kust', null, nieuweDm)).body;
    assert.equal(na.groups[0].name, 'De Vloedlijn');
    assert.equal(na.groups[0].hasPassword, true);
  });

  it('maakt een speler-personage dat aan die party hangt', async () => {
    const groepen = (await req(server, 'GET', '/api/groups?campagne=bleke-kust', null, nieuweDm)).body;
    const gid = groepen.groups[0].id;
    const r = await req(server, 'POST', '/api/entities/personages?campagne=bleke-kust',
      { name: 'Mirre Zoutvinger', subtype: 'speler', data: { groep: gid } }, nieuweDm);
    assert.ok(r.status === 200 || r.status === 201, `kreeg ${r.status}`);
    const id = r.body?.id || r.body?.entity?.id;
    assert.ok(id, 'het kaartje heeft een id');
    // Het profielveld heet `klasse`, niet `class` — daar ging de wizard eerst
    // de mist in, en dan sloeg hij het level wél op en de class niet.
    const p = await req(server, 'PATCH', `/api/player-profile/${id}?campagne=bleke-kust`,
      { klasse: 'Druid', level: 2 }, nieuweDm);
    assert.equal(p.status, 200);
    assert.equal(p.body.klasse, 'Druid');
    assert.equal(p.body.level, 2);
  });

  it('onthoudt dat hij geweest is', async () => {
    await metaOp('/api/meta/app', { wizardKlaar: true }, nieuweDm);
    assert.equal((await lees()).wizardKlaar, true);
  });

  it('laat de DM uitzetten wat hij niet gebruikt', async () => {
    // De scheiding waar het ontwerp op rust: de beheerder bepaalt wat een
    // campagne MAG hebben, de DM wat hij ervan GEBRUIKT.
    const r = await metaOp('/api/meta/modules-uit', { uit: ['markt', 'detective'] }, nieuweDm);
    assert.equal(r.status, 200);
    const m = await lees();
    assert.equal(m.modules.markt, false, 'markt staat uit');
    assert.equal(m.modules.detective, false);
    assert.equal(m.modules.herberg, true, 'de rest niet');
    // En hij ziet nog steeds dát hij het mag hebben, anders kan hij het nooit
    // terughalen.
    assert.equal(m.modulesVrij.markt, true, 'vrijgegeven blijft vrijgegeven');
  });

  it('haalt een uitgezet onderdeel ook weer terug', async () => {
    await metaOp('/api/meta/modules-uit', { uit: [] }, nieuweDm);
    assert.equal((await lees()).modules.markt, true);
  });

  it('laat de DM aanzetten waar de beheerder niets over zei', async () => {
    // **Niet beslist is niet verboden.** De tempel staat niet in de startset,
    // maar de beheerder heeft hem ook nooit dichtgezet — dan mag de DM zelf
    // kiezen. Dit stond andersom: alles buiten de startset was onbereikbaar,
    // en een DM moest voor acht van de dertig onderdelen aankloppen.
    let m = await lees();
    assert.equal(m.modules.tempel, false, 'standaard uit');
    assert.equal(m.modulesVrij.tempel, true, 'maar wel binnen bereik');

    await metaOp('/api/meta/modules-uit', { uit: [], aan: ['tempel'] }, nieuweDm);
    m = await lees();
    assert.equal(m.modules.tempel, true, 'en nu staat hij aan');
  });

  it('houdt dicht wat de beheerder uitdrukkelijk dichtzette', async () => {
    // Een beslissing van de beheerder blijft staan. Anders was zijn slot een
    // suggestie, en dat is geen slot.
    await req(server, 'PUT', '/api/campaigns/bleke-kust/modules',
      { modules: { woekeraar: false } }, beheerder);
    const m = await lees();
    assert.equal(m.modulesVrij.woekeraar, false, 'buiten bereik');
    await metaOp('/api/meta/modules-uit', { uit: [], aan: ['woekeraar'] }, nieuweDm);
    assert.equal((await lees()).modules.woekeraar, false, 'en aanzetten lukt niet');
  });

  it('geeft de DM de namen van de onderdelen mee', async () => {
    const m = await lees();
    assert.ok(Array.isArray(m.moduleCatalogus) && m.moduleCatalogus.length > 10,
      'de catalogus hoort bij GET /meta voor de DM; /campaigns is van de beheerder');
    assert.ok(m.moduleCatalogus.every(x => x.id && x.label), 'elk onderdeel heeft een naam');
  });

  it('bewaart hoe een gevecht eruitziet voor de spelers', async () => {
    assert.equal((await metaOp('/api/meta/app', { combatHp: 'binair' }, nieuweDm)).status, 200);
    assert.equal((await lees()).combatHp, 'binair');
    assert.equal((await metaOp('/api/meta/app', { combatHp: 'onzin' }, nieuweDm)).status, 400,
      'een onbekende weergave wordt geweigerd, niet stil genegeerd');
  });

  it('zegt wat er aan spreukbeelden te halen valt, en haalt ze op', async () => {
    const stand = (await req(server, 'GET', '/api/bron/spreukbeelden?campagne=bleke-kust', null, nieuweDm)).body;
    assert.equal(typeof stand.beschikbaar, 'number');
    assert.equal(stand.eigen, false, 'dit is niet de bron');
    const r = await req(server, 'POST', '/api/bron/spreukbeelden?campagne=bleke-kust', {}, nieuweDm);
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.gekopieerd, 'number');
    // Twee keer drukken mag niets kapotmaken: dit vult aan, het overschrijft niet.
    const nog = await req(server, 'POST', '/api/bron/spreukbeelden?campagne=bleke-kust', {}, nieuweDm);
    assert.equal(nog.body.gekopieerd, 0, 'de tweede keer valt er niets meer te halen');
  });

  it('kopieert niet uit zichzelf', async () => {
    const r = await req(server, 'POST', '/api/bron/spreukbeelden?campagne=grisburgh', {}, beheerder);
    assert.equal(r.status, 400, 'de beheercampagne ís de bron');
  });

  it('laat de nieuwe DM niet aan de modules komen — dat is de beheerder', async () => {
    // Dit is de reden dat de modulestap níét in de wizard zit.
    const r = await req(server, 'PUT', '/api/campaigns/bleke-kust/modules?campagne=bleke-kust',
      { modules: { tempel: true } }, nieuweDm);
    assert.equal(r.status, 403, 'een gewone DM mag zijn eigen modules niet zetten');
  });

  it('en de beheerder kan ze wél zetten, vanuit zijn eigen campagne', async () => {
    const r = await req(server, 'PUT', '/api/campaigns/bleke-kust/modules?campagne=grisburgh',
      { modules: { tempel: true } }, beheerder);
    assert.equal(r.status, 200, `kreeg ${r.status}`);
  });
});
