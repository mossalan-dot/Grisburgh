const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Vangt de klasse "dangling import" die de hele app stil kan breken: een
// statische import naar een .js-bestand dat niet (meer) bestaat. De node-server
// serveert dan index.html (HTML) i.p.v. JS → module-graaf faalt zonder console-
// error. Zo ging glossary.js mis na een revert (juni 2026).

const JS_DIR  = path.join(__dirname, '..', 'public', 'js');
const PUB_DIR = path.join(__dirname, '..', 'public');

// Alle relatieve import-specifiers uit een bronbestand (statisch + dynamisch),
// querystring (?v=N) afgepeld.
function relativeImports(src) {
  const specs = [];
  const re = /(?:from|import)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) specs.push(m[1].replace(/\?.*$/, ''));
  return specs;
}

describe('Frontend module-imports', () => {
  const jsFiles = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));

  it('heeft .js-bestanden om te controleren', () => {
    assert.ok(jsFiles.length > 0);
  });

  for (const file of jsFiles) {
    it(`alle imports in ${file} verwijzen naar bestaande bestanden`, () => {
      const src = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
      for (const spec of relativeImports(src)) {
        const resolved = path.resolve(JS_DIR, spec);
        assert.ok(
          fs.existsSync(resolved),
          `${file} importeert "${spec}" maar ${path.relative(PUB_DIR, resolved)} bestaat niet`
        );
      }
    });
  }

  // Of een module überhaupt nog parseert. Klinkt overbodig, maar de fout die
  // hier het vaakst doorheen glipte is subtiel: een **backtick in een
  // HTML-commentaar binnen een template literal**. JS kent geen HTML-commentaar,
  // dus die backtick sluit de literal en alles erna wordt code. De browser stopt
  // dan stil met laden en je staart naar een leeg scherm. In dit project drie
  // keer gebeurd, telkens in een commentaar dat een veldnaam aanhaalde.
  //
  // Pariteit tellen helpt niet: `(x)` met twee backticks breekt evengoed.
  // Alleen echt parseren wijst het aan — als **module**, want dat is wat de
  // browser doet. Vandaar een kopie met .mjs en `node --check`.
  for (const file of jsFiles) {
    it(`${file} parseert als module`, () => {
      const tmp = path.join(os.tmpdir(), `gris-parse-${process.pid}-${file}.mjs`);
      fs.copyFileSync(path.join(JS_DIR, file), tmp);
      try {
        execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
      } catch (e) {
        assert.fail(`${file} parseert niet:\n${(e.stderr || '').toString().split('\n').slice(0, 4).join('\n')}`);
      } finally {
        try { fs.unlinkSync(tmp); } catch { /* weg is weg */ }
      }
    });
  }

  it('alle <script src> in index.html verwijzen naar bestaande bestanden', () => {
    const html = fs.readFileSync(path.join(PUB_DIR, 'index.html'), 'utf8');
    const re = /<script[^>]+src=['"](\/[^'"?]+)(?:\?[^'"]*)?['"]/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      // /socket.io/ wordt runtime door de Socket.io-middleware geserveerd, geen statisch bestand.
      if (m[1].startsWith('/socket.io/')) continue;
      const rel = m[1].replace(/^\//, '');
      // Alleen lokale bestanden controleren (geen CDN; src begint met /)
      const resolved = path.join(PUB_DIR, rel);
      assert.ok(
        fs.existsSync(resolved),
        `index.html laadt "${m[1]}" maar public/${rel} bestaat niet`
      );
    }
  });
});

// De andere helft van diezelfde valkuil: de server. Bovenstaande tests vangen
// een dangling import in de code, maar een bestand kan ook op de server
// ontbreken terwijl de code klopt (of andersom blijven staan, zoals
// glossary.js daar tot 24 sep 2026 deed). Dan hoort er een 404 te komen en
// geen 200 met HTML — dat laatste laat de module-graaf stil vallen.
describe('Een ontbrekend bestand geeft 404, geen HTML', () => {
  const http = require('http');
  const os   = require('os');
  const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-404-${Date.now()}`);
  let server, io;

  const haal = (p) => new Promise((resolve, reject) => {
    const r = http.request(
      { method: 'GET', hostname: 'localhost', port: server.address().port, path: p },
      (res) => { let d = ''; res.on('data', c => d += c);
                 res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: d })); });
    r.on('error', reject); r.end();
  });

  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    for (const m of ['../server', '../lib/storage', '../routes/api', '../routes/auth']) delete require.cache[require.resolve(m)];
    const mod = require('../server');
    server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
  });
  after(async () => {
    await io.close();
    await new Promise(r => server.close(r));
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it('geeft 404 voor een .js dat er niet is', async () => {
    const r = await haal('/js/bestaat-echt-niet.js');
    assert.equal(r.status, 404, 'een 200 met HTML breekt de module-graaf stil');
    assert.ok(!/text\/html/.test(r.type), `kreeg ${r.type}`);
  });

  it('geeft 404 voor een ontbrekende stylesheet en afbeelding', async () => {
    for (const p of ['/css/weg.css', '/img/weg.png']) {
      const r = await haal(p);
      assert.equal(r.status, 404, `${p} hoort 404 te geven`);
    }
  });

  it('serveert een campagnepad nog gewoon als de app', async () => {
    const r = await haal('/grisburgh');
    assert.equal(r.status, 200);
    assert.ok(/text\/html/.test(r.type), 'een campagnepad is juist wél de SPA');
    assert.ok(r.body.includes('<!DOCTYPE html>') || r.body.includes('<!doctype html>'));
  });

  // Het app-icoon en het manifest zijn per campagne. De campagne komt daar uit
  // de querystring, en die moet `campagne` heten: `_campagneVan` kent geen
  // andere naam en valt anders terug op de **actieve** campagne — dan krijgt
  // elke campagne hetzelfde icoon. Dat ging bij het bouwen precies zo mis.
  it('noemt de campagne in de icoon- en manifest-url bij name', async () => {
    const shell = await haal('/grisburgh');
    const urls = [...shell.body.matchAll(/href="(\/app-icon-[^"]+|\/manifest\.webmanifest[^"]*)"/g)].map(m => m[1]);
    assert.ok(urls.length >= 3, `verwachtte icoon- en manifest-links, kreeg ${urls.length}`);
    for (const u of urls) {
      assert.ok(/[?&]campagne=/.test(u), `${u} moet ?campagne= dragen, anders wint de actieve campagne`);
    }
  });

  it('serveert het app-icoon en valt terug op het meegeleverde wapen', async () => {
    const r = await haal('/app-icon-192.png?campagne=grisburgh');
    assert.equal(r.status, 200);
    assert.ok(/image\/png/.test(r.type), `kreeg ${r.type}`);
  });

  it('weigert een maat die geen PWA-maat is', async () => {
    assert.equal((await haal('/app-icon-64.png?campagne=grisburgh')).status, 404);
  });

  it('serveert een bestand dat er wél is', async () => {
    const r = await haal('/js/app.js');
    assert.equal(r.status, 200);
    assert.ok(/javascript/.test(r.type), `kreeg ${r.type}`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  WINDOW-HELPERS DIE NIET BESTAAN
// ════════════════════════════════════════════════════════════════════════════
// De frontend is opgedeeld in modules die elkaar niet importeren; wat ze delen
// gaat via `window`. Vergeet je de regel `window._x = _x`, dan is er geen
// foutmelding: met `window._x?.(…)` ervoor valt de aanroep stil terug op niets,
// en zonder die `?.` gooit hij in de console terwijl de knop gewoon niets doet.
//
// Zo bleef de enige knop van de waarzegger maanden dood (`_ursulaVoorspel`
// bestond nergens), vroeg de woekeraar om een bedrag "in de kleinste munt"
// omdat `_bedragVeldHtml` niet aankwam, en zei hij "10000 cl" omdat
// `formatCl` dat ook niet deed. Deze test vangt de hele soort in één keer.
describe('Gedeelde window-helpers', () => {
  // Wat de browser zelf levert. Alles daarbuiten moeten wij ergens zetten.
  const BROWSER = new Set([
    'app', 'dmPanel', 'location', 'open', 'close', 'alert', 'confirm', 'prompt',
    'matchMedia', 'getComputedStyle', 'scrollTo', 'requestAnimationFrame',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'fetch',
    'addEventListener', 'removeEventListener', 'dispatchEvent', 'focus', 'print',
    'io', 'L', 'cytoscape', 'Image', 'URL', 'FormData', 'Event', 'CustomEvent',
    'Audio', 'btoa', 'atob', 'parseInt', 'parseFloat', 'isNaN', 'structuredClone',
    'encodeURIComponent', 'decodeURIComponent', 'speechSynthesis', 'history',
    'SpeechSynthesisUtterance', 'AudioContext', 'webkitAudioContext', 'Spotify',
    'onSpotifyWebPlaybackSDKReady', 'MutationObserver', 'ResizeObserver',
    'IntersectionObserver', 'DOMParser', 'Blob', 'FileReader', 'Notification',
  ]);

  it('wordt elke window.x() die wordt aangeroepen ook ergens gezet', () => {
    const dir = path.join(__dirname, '..', 'public', 'js');
    let code = '';
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      code += '\n' + fs.readFileSync(path.join(dir, f), 'utf8');
    }
    const gezet = new Set();
    for (const m of code.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) gezet.add(m[1]);
    for (const m of code.matchAll(/window\[["']([^"']+)["']\]\s*=/g)) gezet.add(m[1]);

    const mis = new Set();
    for (const m of code.matchAll(/window\.([A-Za-z_$][\w$]*)\s*\??\.?\(/g)) {
      if (!gezet.has(m[1]) && !BROWSER.has(m[1])) mis.add(m[1]);
    }
    assert.deepEqual([...mis], [],
      `deze worden aangeroepen maar nergens op window gezet: ${[...mis].join(', ')}`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  ÉÉN BESTAND = ÉÉN VERSIE, OOK OP DE SERVER
// ════════════════════════════════════════════════════════════════════════════
// De regel staat al in CLAUDE.md, maar niets bewaakte hem. Op 2 okt 2026 vroegen
// dertien bestanden op productie `api.js?v=301`, één `v=302` en drie `v=303`:
// de browser laadde dezelfde module dan drie keer, elk met eigen state. Dat
// gebeurt vanzelf zodra je een versie bumpt en maar een deel van de importeurs
// meedeployt — en je ziet het nergens aan, want alle drie de verzoeken geven
// hetzelfde bestand terug.
describe('Versies van frontend-modules', () => {
  it('vraagt elk bestand onder precies één ?v=', () => {
    const dir = path.join(__dirname, '..', 'public', 'js');
    const perBestand = new Map();
    const noem = (vanuit, m) => {
      const [, naam, versie] = m;
      if (!perBestand.has(naam)) perBestand.set(naam, new Map());
      if (!perBestand.get(naam).has(versie)) perBestand.get(naam).set(versie, []);
      perBestand.get(naam).get(versie).push(vanuit);
    };
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of src.matchAll(/['"`]\.\/([a-z-]+\.js)\?v=(\d+)['"`]/g)) noem(f, m);
    }
    const scheef = [...perBestand].filter(([, versies]) => versies.size > 1)
      .map(([naam, versies]) => `${naam}: ` +
        [...versies].map(([v, wie]) => `v=${v} (${wie.join(', ')})`).join(' tegenover '));
    assert.deepEqual(scheef, [],
      'deze bestanden worden onder meer dan één versie geïmporteerd:\n  ' + scheef.join('\n  '));
  });

  it('importeert alleen bestanden die ook echt bestaan', () => {
    const dir = path.join(__dirname, '..', 'public', 'js');
    const aanwezig = new Set(fs.readdirSync(dir).filter(f => f.endsWith('.js')));
    const mis = [];
    for (const f of aanwezig) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of src.matchAll(/['"`]\.\/([a-z-]+\.js)(?:\?v=\d+)?['"`]/g)) {
        if (!aanwezig.has(m[1])) mis.push(`${f} → ${m[1]}`);
      }
    }
    assert.deepEqual(mis, [], 'import naar een bestand dat er niet is: ' + mis.join(', '));
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  ELK AANGEROEPEN ICOON BESTAAT OOK
// ════════════════════════════════════════════════════════════════════════════
// `icon('x')` zet een `<use href="…#icon-x">` neer. Bestaat dat symbool niet,
// dan tekent de browser **niets** — geen foutmelding, geen vraagteken, gewoon
// een leeg vlakje van 16 bij 16. Zo stond `alert-triangle` op vijf plekken
// (het beheerdersoverzicht en de hele escalatieladder van de woekeraar) zonder
// dat er ooit een driehoek verscheen.
describe('Iconen', () => {
  it('verwijst elke icon(...)-aanroep naar een symbool in de sprite', () => {
    const sprite = fs.readFileSync(path.join(__dirname, '..', 'public', 'img', 'icons.svg'), 'utf8');
    const bestaat = new Set([...sprite.matchAll(/id="icon-([a-z0-9-]+)"/g)].map(m => m[1]));
    const dir = path.join(__dirname, '..', 'public', 'js');
    const mis = new Map();
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      // Alleen letterlijke namen: `icon(soort.icon)` kan deze test niet nakijken.
      for (const m of src.matchAll(/\bicon\(\s*['"]([a-z0-9-]+)['"]/g)) {
        if (!bestaat.has(m[1])) {
          if (!mis.has(m[1])) mis.set(m[1], new Set());
          mis.get(m[1]).add(f);
        }
      }
    }
    const regels = [...mis].map(([naam, waar]) => `${naam} (${[...waar].join(', ')})`);
    assert.deepEqual(regels, [], 'deze iconen bestaan niet in de sprite:\n  ' + regels.join('\n  '));
  });

  it('verwijst ook vanuit index.html naar bestaande symbolen', () => {
    const sprite = fs.readFileSync(path.join(__dirname, '..', 'public', 'img', 'icons.svg'), 'utf8');
    const bestaat = new Set([...sprite.matchAll(/id="icon-([a-z0-9-]+)"/g)].map(m => m[1]));
    const shell = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    const mis = [...shell.matchAll(/#icon-([a-z0-9-]+)/g)].map(m => m[1]).filter(n => !bestaat.has(n));
    assert.deepEqual([...new Set(mis)], [], 'ontbrekende iconen in de shell');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  GEEN BACKTICK IN EEN HTML-COMMENTAAR
// ════════════════════════════════════════════════════════════════════════════
// Dit is zeven keer misgegaan, steeds op dezelfde manier: je schrijft in een
// template literal een `<!-- … -->` en noemt daarin een klasse of een variabele
// tussen backticks. Die backtick sluit de literal, en de rest van het bestand
// wordt onzin. `node --check` ziet het niet (als CommonJS-script parseert het
// vaak gewoon), en in de browser valt de hele module-graaf stil zónder
// foutmelding.
//
// De module-parse hierboven vangt het óók, maar pas als het al stuk is en met
// een foutmelding die nergens naar wijst ("Unexpected identifier 'herberg'").
// Deze test wijst het bestand, de regel en de tekst aan.
describe('Commentaar in template literals', () => {
  it('gebruikt nergens een backtick in een HTML-commentaar', () => {
    const dir = path.join(__dirname, '..', 'public', 'js');
    const fout = [];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const regels = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
      let inComment = false;
      regels.forEach((r, i) => {
        const opent = r.includes('<!--');
        const sluit = r.includes('-->');
        const binnen = inComment || opent;
        if (binnen && r.includes('`')) {
          // Een regel die het commentaar opent én sluit mag een backtick ná de
          // afsluiting hebben; alleen wat ertussen staat telt.
          let deel = opent && sluit ? r.slice(r.indexOf('<!--'), r.indexOf('-->'))
            : opent ? r.slice(r.indexOf('<!--'))
            : sluit ? r.slice(0, r.indexOf('-->'))
            : r;
          // Backticks bínnen een ${…} horen bij een geneste template literal en
          // zijn volkomen geldig — zo staat er in render-campagne.js een stuk
          // uitgecommentarieerde code dat prima parseert. Alleen een backtick in
          // de **tekst** van het commentaar sluit de literal eromheen.
          // Van binnen naar buiten strippen: een `${…}` kan er zelf weer een
          // bevatten, en één niet-gretige match stopt dan bij de binnenste `}`.
          let vorig;
          do { vorig = deel; deel = deel.replace(/\$\{[^{}]*\}/g, ''); } while (deel !== vorig);
          if (deel.includes('`')) fout.push(`${f}:${i + 1}  ${r.trim().slice(0, 70)}`);
        }
        if (opent && !sluit) inComment = true;
        if (sluit) inComment = false;
      });
    }
    assert.deepEqual(fout, [],
      'backtick in een HTML-commentaar — die sluit de template literal:\n  ' + fout.join('\n  '));
  });
});
