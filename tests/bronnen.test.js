const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Spreuken en class features gaan als structuur de deur uit, niet als tekst:
// namen, niveaus, scholen en tijden wel, de PHB-beschrijving niet. Wat de DM
// zelf schrijft is van hem en gaat altijd mee.
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-bron-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

const vind = (lijst, naam) => lijst.find(s => s.name === naam);

describe('Bronteksten blijven binnen de campagne die ze mag zien', () => {
  let server, io, storage, beheerder, andereDm;

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    storage = require('../lib/storage');
    await new Promise(r => server.listen(0, r));
    storage.createCampaign('vestingveen', { appTitle: 'Vestingveen' });
    fs.writeFileSync(path.join(DATA_DIR, 'campaigns', 'vestingveen', 'dm-state.json'),
      JSON.stringify({ dmPassword: 'vestingveen-dm', groups: {} }, null, 2));
    beheerder = (await req(server, 'POST', '/api/auth/login', { campagne: 'grisburgh', password: 'grisburgh-dm' })).cookie;
    andereDm  = (await req(server, 'POST', '/api/auth/login', { campagne: 'vestingveen', password: 'vestingveen-dm' })).cookie;
  });

  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });
  it('levert de magische voorwerpen als bron, niet als kaartjes', async () => {
    const r = await req(server, 'GET', '/api/bron/srd-magic-items', null, beheerder);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    const items = r.body?.items || [];
    assert.ok(items.length > 700, 'ruim zevenhonderd, kreeg ' + items.length);

    const tas = items.find(i => i.name === 'Bag of Holding');
    assert.ok(tas, 'de Bag of Holding hoort erin te staan');
    assert.strictEqual(tas.itemType, 'Wondrous item');
    assert.strictEqual(tas.rariteit, 'Uncommon');
    assert.strictEqual(tas.magisch, true, 'zo houdt de kiezer ze uit elkaar');

    // Attunement komt als vinkje mee, en de eis zonder de aanhef.
    const mantel = items.find(i => i.name === 'Cloak of Elvenkind');
    assert.strictEqual(mantel.attunement, true);
    const metEis = items.find(i => i.attunementEis);
    assert.ok(metEis, 'er hoort er minstens één met een eis te zijn');
    assert.ok(!/^requires attunement/i.test(metEis.attunementEis),
      'de aanhef hoort eraf: ' + metEis.attunementEis);

    // Alleen SRD 5.2 — het filter van Open5e doet op dit endpoint niets, dus
    // dat zeven we zelf. Glipt er een ander document mee, dan staat er tekst
    // in die we niet mogen meeleveren.
    assert.ok(items.every(i => String(i.key || '').startsWith('srd-2024')),
      'alles hoort uit srd-2024 te komen');
  });

  it('levert de standaard-uitrusting compleet aan elke campagne', async () => {
    // Zelfde afweging als bij de statblokken: SRD 5.2 staat onder CC BY 4.0,
    // dus die gaat volledig mee — ook naar een campagne zonder bronteksten.
    const r = await req(server, 'GET', '/api/bron/srd-items', null, beheerder);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    const items = r.body?.items || [];
    assert.ok(items.length > 300, 'ruim driehonderd voorwerpen, kreeg ' + items.length);
    assert.match(String(r.body.bron || ''), /CC BY 4\.0/, 'de bronvermelding hoort mee');

    const bijl = items.find(i => i.name === 'Battleaxe');
    assert.ok(bijl, 'de Battleaxe hoort erin te staan');
    assert.strictEqual(bijl.itemType, 'Weapon');
    assert.strictEqual(bijl.damage, '1d8 slashing');
    assert.ok(/fl/.test(bijl.prijs), 'de prijs staat in onze muntsleutels: ' + bijl.prijs);

    // Een schild is geen zwaar harnas — dat zet het script recht.
    const schild = items.find(i => i.name === 'Shield');
    assert.strictEqual(schild.itemType, 'Shield');
    assert.strictEqual(schild.armorType, 'shield');
    assert.strictEqual(schild.armorBaseAC, 2);

    const plate = items.find(i => i.name === 'Plate Armor');
    assert.strictEqual(plate.armorBaseAC, 18);
    assert.strictEqual(plate.stealthDisadvantage, true);
    assert.strictEqual(plate.strengthRequirement, 15);

    // Geen dubbele namen: Open5e levert er 107 dubbel.
    const namen = items.map(i => i.name.toLowerCase());
    assert.strictEqual(new Set(namen).size, namen.length, 'namen horen uniek te zijn');
  });


  it('serveert de bronbestanden niet meer als statisch bestand', async () => {
    // Het pad valt nu in de SPA-fallback, dus je krijgt de shell — geen spreuken.
    const r = await req(server, 'GET', '/data/spells-2024.json');
    assert.equal(typeof r.body, 'string', 'geen JSON meer op dat pad');
    assert.ok(!r.body.includes('Fireball'), 'en zeker geen spreukteksten');
  });

  it('vraagt een sessie voor de bron', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024');
    assert.equal(r.status, 401);
  });

  it('geeft de beheerder de volledige tekst', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024', null, beheerder);
    const fireball = vind(r.body.results, 'Fireball');
    assert.ok(fireball.desc.join(' ').length > 100, 'de beschrijving staat erin');
  });

  // De SRD 5.2 staat onder CC BY 4.0 en dekt tweederde van de lijst; die teksten
  // mogen we wél doorgeven, mits de app de bron vermeldt. Wat er niet in staat
  // blijft leeg — daar wijst de app naar buiten.
  it('geeft een andere campagne de SRD-tekst waar die bestaat', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024', null, andereDm);
    const fireball = vind(r.body.results, 'Fireball');
    assert.equal(fireball.name, 'Fireball',   'de naam blijft');
    assert.equal(fireball.level, 3,           'het niveau blijft');
    assert.equal(fireball.school.name, 'Evocation', 'de school blijft');
    assert.equal(fireball.casting_time, 'Action',   'de casting time blijft');
    assert.ok(fireball.desc.join(' ').length > 100, 'Fireball staat in de SRD, dus met tekst');
    assert.equal(fireball._srd, true, 'gemarkeerd, zodat de app de bron kan noemen');
  });

  it('houdt een spreuk buiten de SRD wél leeg', async () => {
    const r = await req(server, 'GET', '/api/bron/spells-2024', null, andereDm);
    const bb = vind(r.body.results, 'Booming Blade');
    assert.equal(bb.name, 'Booming Blade', 'de naam blijft');
    assert.deepEqual(bb.desc, [],          'maar niet de tekst');
    assert.deepEqual(bb.higher_level, []);
    assert.equal(bb._geenTekst, true, 'gemarkeerd, zodat de app kan verwijzen');
    assert.ok(!bb._srd);
  });

  it('laat de DM zijn eigen beschrijving schrijven, en die blijft van hem', async () => {
    const bewaard = await req(server, 'PUT', '/api/bron/spreuk/fireball',
      { desc: 'Een bol vuur zo groot als een kar.\n\nDe hitte blijft nog even hangen.' }, andereDm);
    assert.equal(bewaard.status, 200);
    assert.equal(bewaard.body.desc.length, 2, 'lege regels splitsen de alineas');

    const r = await req(server, 'GET', '/api/bron/spells-2024', null, andereDm);
    const fireball = vind(r.body.results, 'Fireball');
    assert.match(fireball.desc[0], /bol vuur/);

    // En de buurcampagne merkt er niets van.
    const bij = await req(server, 'GET', '/api/bron/spells-2024', null, beheerder);
    assert.ok(!vind(bij.body.results, 'Fireball').desc[0].includes('bol vuur'));
  });

  it('wist de eigen beschrijving als het veld leeg is', async () => {
    await req(server, 'PUT', '/api/bron/spreuk/fireball', { desc: '   ' }, andereDm);
    const r = await req(server, 'GET', '/api/bron/spells-2024', null, andereDm);
    const fireball = vind(r.body.results, 'Fireball');
    assert.ok(!fireball._eigen, 'de eigen tekst is weg');
    assert.equal(fireball._srd, true, 'en daarmee valt hij terug op de SRD-tekst');
  });

  // Class features volgen dezelfde regel als de spreuken: staat de feature in de
  // SRD 5.2 (CC BY 4.0), dan mag de tekst mee; anders blijft hij leeg.
  it('geeft SRD-features hun tekst, andere niet', async () => {
    const kaal = await req(server, 'GET', '/api/progression', null, andereDm);
    const rage = kaal.body.classes.Barbarian.levels['1'].find(f => f.name === 'Rage');
    assert.equal(rage.name, 'Rage', 'de feature staat er, op het juiste niveau');
    assert.ok(rage.desc.length > 50, 'Rage staat in de SRD, dus met tekst');
    assert.equal(rage._srd, true);

    // Een subklasse die niet in de SRD staat houdt zijn tekst wél voor zich.
    const alles = Object.values(kaal.body.classes).flatMap(c => Object.values(c.levels || {}).flat());
    const zonder = alles.filter(f => f._geenTekst);
    assert.ok(zonder.length > 0, 'niet alles zit in de SRD');
    assert.ok(zonder.every(f => f.desc === ''), 'en die hebben geen tekst');

    const vol = await req(server, 'GET', '/api/progression', null, beheerder);
    assert.ok(vol.body.classes.Barbarian.levels['1'].find(f => f.name === 'Rage').desc.length > 50);
  });

  it('geeft van de features-bibliotheek alleen het SRD-deel', async () => {
    const feats = await req(server, 'GET', '/api/bron/feature-descriptions', null, andereDm);
    assert.ok(Object.keys(feats.body).length > 100, 'de SRD-teksten mogen mee');
    assert.ok(feats.body['Barbarian|Rage'], 'op dezelfde sleutel als de volledige lijst');

    // De volledige lijst heeft teksten die niet in de SRD staan (niet-SRD
    // subklassen en soorten); die horen in de kale versie te ontbreken.
    const vol = await req(server, 'GET', '/api/bron/feature-descriptions', null, beheerder);
    const alleenVolledig = Object.keys(vol.body).filter(k => !feats.body[k]);
    assert.ok(alleenVolledig.length > 0, 'niet alles uit de volledige lijst mag mee');

    // Backgrounds staan niet in de SRD (alleen hun structuur), dus die blijven kaal.
    const bg = await req(server, 'GET', '/api/bron/backgrounds-2024', null, andereDm);
    const acoliet = Object.values(bg.body)[0];
    assert.equal(Object.values(acoliet.levels)[0][0].desc, '');
  });

  // De SRD 5.2 staat onder CC BY 4.0 en mag dus wél compleet naar buiten — ook
  // naar een campagne die de PHB-teksten niet krijgt.
  it('geeft de standaard-statblokken compleet aan elke campagne', async () => {
    const kaal = await req(server, 'GET', '/api/bron/srd-monsters', null, andereDm);
    const vol  = await req(server, 'GET', '/api/bron/srd-monsters', null, beheerder);
    assert.ok(Array.isArray(kaal.body) && kaal.body.length > 300, 'lijst met wezens verwacht');
    assert.deepStrictEqual(kaal.body, vol.body, 'kaal en volledig horen hetzelfde te zijn');
    const guard = kaal.body.find(m => m.name === 'Guard');
    assert.ok(guard, 'Guard hoort erin te staan');
    assert.ok(guard.npc, 'Guard is een generieke NPC');
    assert.ok(guard.statblock.actions.includes('Spear'), 'met zijn acties erbij');
    // De SRD schrijft "Small or Medium"; een preset vult het blad van één
    // personage, en daar is die keuze al gemaakt.
    assert.equal(guard.statblock.size, 'Medium');
    assert.ok(!/natural armor/.test(guard.statblock.ac), 'geen verzonnen armor_detail');
    assert.equal(guard.statblock.speed, '30 ft.', 'geen afgeleide klim-/zwemsnelheden');
  });

  it('levert een bruikbare roddel mee bij de wezens die er een verdienen', async () => {
    // De Magizoöloog onthult bij *deels* een gerucht. Voor de meegeleverde
    // wezens reikt de bron er een aan, afgeleid uit het statblok
    // (scripts/srd-2024/srd-roddels.js). Dit bewaakt twee dingen: dat het
    // meekomt, en dat de samengestelde zinnen heel zijn — ze worden uit
    // losse regels aan elkaar geplakt, dus een lege of stukke regel valt
    // nergens anders op.
    const lijst = (await req(server, 'GET', '/api/bron/srd-monsters', null, andereDm)).body;
    const met = lijst.filter(m => (m.roddel || '').trim());
    assert.ok(met.length > 150, `verwacht ruim 150 roddels, kreeg er ${met.length}`);

    for (const m of met) {
      assert.ok(!/undefined|null|NaN|\[object/.test(m.roddel), `${m.name}: kapotte samenstelling — ${m.roddel}`);
      assert.ok(/[.!?]$/.test(m.roddel.trim()), `${m.name}: geen afgesloten zin — ${m.roddel}`);
      assert.ok(m.roddel.trim().length > 20, `${m.name}: te kort om iets te zeggen`);
    }

    // Een wolf hoort zijn roedeltactiek te verklappen; een das heeft niets te
    // verbergen en krijgt er dus geen.
    const wolf = lijst.find(m => m.name === 'Wolf');
    assert.ok(/tweede|roedel|alleen/i.test(wolf.roddel || ''), 'de wolf verklapt hoe hij jaagt');
    // En het omgekeerde: er wordt niets verzonnen voor wie niets te verbergen
    // heeft. Een kat is een kat. (Een das krijgt er wél een — die graaft, en
    // dat staat gewoon in zijn snelheid.)
    const zonder = lijst.filter(m => !(m.roddel || '').trim());
    assert.ok(zonder.length > 80, `verwacht dat een flink deel er geen krijgt, kreeg ${zonder.length}`);
    for (const naam of ['Cat', 'Commoner', 'Ape']) {
      const dier = lijst.find(m => m.name === naam);
      assert.ok(!(dier?.roddel || '').trim(), `${naam} heeft niets te onthullen`);
    }
  });

  it('kent geen andere bestanden dan de bronnenlijst', async () => {
    const r = await req(server, 'GET', '/api/bron/..%2F..%2Fconfig', null, beheerder);
    assert.equal(r.status, 404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  SUBCLASSES DIE ELDERS STAAN
// ════════════════════════════════════════════════════════════════════════════
// Het Heldenboek liet alleen de twaalf-maal-vier uit de 2024-PHB zien, en
// daarmee leek de rest niet te bestaan. `bronnen/subclasses-elders.json` noemt
// ze bij naam en zegt in welk boek ze staan — en verder niets. Die grens is
// precies waar deze test over gaat: een naam is geen beschermd werk, een
// beschrijving wél. Komt er ooit tekst in dat bestand, dan valt dit om.
describe('Subclasses die elders staan', () => {
  const data = require('../bronnen/subclasses-elders.json');

  it('noemt alleen een naam en een boek, nooit tekst', () => {
    const verboden = ['desc', 'beschrijving', 'tekst', 'features', 'levels', 'entries'];
    for (const [klasse, lijst] of Object.entries(data.klassen)) {
      for (const sub of lijst) {
        const sleutels = Object.keys(sub);
        for (const v of verboden) {
          assert.ok(!sleutels.includes(v),
            `${klasse} › ${sub.naam} draagt "${v}" — hier hoort geen tekst in te staan`);
        }
        assert.deepEqual(sleutels.sort(), ['boek', 'naam'],
          `${klasse} › ${sub.naam}: alleen naam en boek`);
        assert.ok(sub.naam && sub.naam.length < 60);
      }
    }
  });

  it('verwijst elke subclass naar een boek dat we kennen', () => {
    for (const [klasse, lijst] of Object.entries(data.klassen)) {
      for (const sub of lijst) {
        assert.ok(data.boeken[sub.boek],
          `${klasse} › ${sub.naam} verwijst naar onbekende boekcode "${sub.boek}"`);
      }
    }
  });

  it('gaat compleet de deur uit, ook bij een kale campagne', () => {
    const bronnen = require('../lib/bronnen');
    const kaal = bronnen.bronVoor('subclasses-elders', { volledig: false });
    assert.ok(kaal?.klassen, 'ook zonder bronteksten beschikbaar');
    // Tegen het bestand zelf, niet tegen een getal: "compleet" is wat hier
    // staat, en dat groeit mee zodra er een class met een voorraadlijst bij
    // komt (Artificer kreeg er een toen Reanimator verscheen).
    const opSchijf = require('../bronnen/subclasses-elders.json');
    assert.equal(Object.keys(kaal.klassen).length, Object.keys(opSchijf.klassen).length,
      'alle classes uit het bestand');
  });

  it('dubbelt niet met wat de app zelf meebrengt', () => {
    // Staat een subclass hier én in de seed mét features, dan brengt de app hem
    // zelf mee en hoort hij niet in de voorraadlijst.
    //
    // Een naam die in de seed staat zónder features is iets anders: dat is
    // precies wat deze lijst óók is — een naam en een vindplaats, verder niets.
    // Knowledge, Nature en Tempest stonden zo in de seed, en vielen daardoor
    // tussen wal en schip: een campagne die ze niet had kon er niet bij, want
    // ze werden hier geweerd. De client ontdubbelt tegen wat de campagne zelf
    // heeft, dus twee keer in de kolom kan niet gebeuren.
    const seed = require('../bronnen/class-progression.json');
    const telt = (sc) => Object.values(sc?.levels || {}).reduce((t, a) => t + (a || []).length, 0);
    const dubbel = [];
    for (const [klasse, lijst] of Object.entries(data.klassen)) {
      const eigen = seed.classes?.[klasse]?.subclasses || {};
      for (const sub of lijst) {
        const seedSub = Object.entries(eigen).find(([n]) => n.toLowerCase() === sub.naam.toLowerCase())?.[1];
        if (seedSub && telt(seedSub)) dubbel.push(`${klasse} › ${sub.naam}`);
      }
    }
    assert.deepEqual(dubbel, [], 'deze brengt de app zelf al mee: ' + dubbel.join(', '));
  });
});

// ── Zegeningen en gunsten blijven voorwerpen ────────────────────────────────
// Ze staan sinds 8 okt 2026 in het Heldenboek in plaats van tussen de
// voorwerpen. Dat is een verhuizing van het uitzicht, niet van de gegevens: de
// tempel leidt zijn pantheon nog steeds uit Blessing-kaartjes af, een factie
// geeft ze als rangbeloning, ze staan in de boedel en ze blijven onverkoopbaar.
// Zou de soort zelf veranderen, dan brak dat allemaal — en pas aan tafel.
describe('Zegeningen en gunsten', () => {
  const api = require('fs').readFileSync(require('path').join(__dirname, '..', 'routes', 'api.js'), 'utf8');

  it('leidt de goden nog steeds uit Blessing-kaartjes af', () => {
    assert.ok(api.includes("(e.data?.itemType) === 'Blessing'"),
      'de tempel leest de voorwerpen; verandert die soort, dan verdwijnt het pantheon');
  });

  it('houdt ze onverkoopbaar', () => {
    assert.ok(api.includes("['Blessing', 'Boon', 'Feature'].includes(d.itemType)"),
      'een zegen of een gunst hoort niet in een winkel te liggen');
  });

  it('zoekt de zegen op bij een eed of een vloek', () => {
    assert.ok(api.includes("e.data?.itemType === 'Blessing' &&"),
      '_koppelGoddelijkEntity koppelt het kaartje aan wat de speler krijgt');
  });
});

// ── Geen spreuk twee keer ───────────────────────────────────────────────────
// `extra-spells.json` is voor spreuken die niet in de SRD staan. Stond er een
// in die daar wél staat, dan kreeg je hem twee keer in je spreukenboek — en
// negen van de tien stonden er dubbel in, allemaal in het Nederlands, nog uit
// de tijd vóór de Engelse import. Het samenvoegen zeefde op index, en twee van
// die negen waren net anders gespeld (`tasha-` tegen `tashas-`).
describe('Extra spreuken', () => {
  const srd = require('../bronnen/spells-2024.json');
  const srdLijst = Array.isArray(srd) ? srd : (srd.spells || srd.results || []);
  const extra = require('../bronnen/extra-spells.json').results || [];

  it('bevat geen spreuk die al in de SRD staat', () => {
    const namen = new Set(srdLijst.map(s => String(s.name || '').toLowerCase()));
    const dubbel = extra.filter(s => namen.has(String(s.name || '').toLowerCase())).map(s => s.name);
    assert.deepEqual(dubbel, [], 'deze staan al in spells-2024.json');
  });

  it('bevat geen index die al in de SRD staat', () => {
    const idx = new Set(srdLijst.map(s => s.index));
    assert.deepEqual(extra.filter(s => idx.has(s.index)).map(s => s.index), []);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  DE FEATURES VAN WAT ELDERS STAAT
// ════════════════════════════════════════════════════════════════════════════
// Dezelfde grens, een laag dieper. `bronnen/features-elders.json` noemt de
// features van die subclasses (en van de classes en species die niet in de app
// staan) **alleen bij naam**, zodat een leeg kaartje toch zegt wát je krijgt en
// waar je het opzoekt. Een naam is geen beschermd werk, een beschrijving wél —
// en een beschrijving herken je aan zijn lengte. Komt er ooit tekst in dat
// bestand, dan valt dit om.
describe('De features van wat elders staat', () => {
  const data = require('../bronnen/features-elders.json');
  const groepen = ['classes', 'subclasses', 'species', 'varianten'];

  it('noemt alleen namen, nooit tekst', () => {
    for (const groep of groepen) {
      for (const [houder, lijst] of Object.entries(data[groep] || {})) {
        assert.ok(Array.isArray(lijst), `${groep} › ${houder} hoort een lijst te zijn`);
        for (const rij of lijst) {
          // Een naam mag een level dragen, en verder niets. Dat is geen tekst
          // maar een getal uit dezelfde tabel waar de naam uit komt; wie het
          // level nagekeken heeft zet het erbij, de rest blijft een kale naam.
          if (rij && typeof rij === 'object') {
            assert.deepEqual(Object.keys(rij).sort(), ['level', 'naam'],
              `${groep} › ${houder}: alleen naam en level, verder niets`);
            assert.ok(Number.isInteger(rij.level) && rij.level >= 1 && rij.level <= 20,
              `${groep} › ${houder} › ${rij.naam}: level ${rij.level} bestaat niet`);
          }
          const naam = (rij && typeof rij === 'object') ? rij.naam : rij;
          assert.equal(typeof naam, 'string', `${groep} › ${houder}: alleen namen, geen objecten`);
          assert.ok(naam.trim().length > 0, `${groep} › ${houder}: lege naam`);
          // Een featurenaam is kort. Alles wat op een zin lijkt is een
          // beschrijving, en die hoort in het boek.
          assert.ok(naam.length < 60,
            `${groep} › ${houder}: "${naam.slice(0, 40)}…" is te lang voor een naam`);
          assert.ok(!/[.!?]\s/.test(naam),
            `${groep} › ${houder}: "${naam}" leest als een zin`);
        }
      }
    }
  });

  it('dubbelt niet met wat de app zelf meebrengt', () => {
    // Een subclass die in de seed features draagt heeft zijn eigen tekst; die
    // namen horen hier niet nog eens. Een naam die er leeg in staat is precies
    // wat dit bestand óók is — zie dezelfde afweging bij subclasses-elders.
    const seed = require('../bronnen/class-progression.json');
    const telt = (sc) => Object.values(sc?.levels || {}).reduce((t, a) => t + (a || []).length, 0);
    const gevuld = new Set();
    for (const klasse of Object.values(seed.classes || {})) {
      for (const [sub, data] of Object.entries(klasse.subclasses || {})) {
        if (telt(data)) gevuld.add(sub.toLowerCase());
      }
    }
    const dubbel = Object.keys(data.subclasses || {}).filter(n => gevuld.has(n.toLowerCase()));
    assert.deepEqual(dubbel, [], 'deze brengt de app zelf al mee: ' + dubbel.join(', '));
  });

  it('noemt een variant bij species én variant', () => {
    // De sleutel is `"Species|Variant"`, want twee species kunnen allebei een
    // variant "Air" hebben. En de helft vóór de streep hoort een species te
    // zijn dat we ook echt hebben — anders staan er namen bij een volk dat
    // niemand kan kiezen (de spiegel draagt de hele Plane Shift-reeks mee).
    const seed = require('../bronnen/class-progression.json');
    const volken = require('../bronnen/volken-klassen.json');
    const onze = new Set([...Object.keys(seed.species || {}), ...(volken.volkenOverig || [])]
      .map(n => n.toLowerCase()));
    for (const sleutel of Object.keys(data.varianten || {})) {
      const delen = sleutel.split('|');
      assert.equal(delen.length, 2, `"${sleutel}" hoort "Species|Variant" te zijn`);
      assert.ok(onze.has(delen[0].toLowerCase()),
        `"${sleutel}" hoort bij een species dat we niet hebben`);
    }
  });

  it('gaat compleet de deur uit, ook bij een kale campagne', () => {
    const bronnen = require('../lib/bronnen');
    const kaal = bronnen.bronVoor('features-elders', { volledig: false });
    assert.ok(kaal?.subclasses, 'ook zonder bronteksten beschikbaar');
  });
});
