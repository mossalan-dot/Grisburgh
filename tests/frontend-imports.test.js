const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

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
