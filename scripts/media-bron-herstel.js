#!/usr/bin/env node
// ── Herstel het spoor van afgeleide afbeeldingen naar hun bronbestand ───────
// `spell-img-<index>` is een kopie van een bibliotheekbestand. Die kopie werd
// gemaakt zonder vast te leggen wáár hij vandaan kwam, waardoor de
// mediabibliotheek het bronbestand als ongebruikt toonde. De koppeling is
// alsnog te vinden: de kopie is byte-identiek aan zijn bron.
//
//   node scripts/media-bron-herstel.js [campagne]   (zonder = alle campagnes)
//   node scripts/media-bron-herstel.js --droog      (alleen tonen)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', 'data', 'campaigns');
const args = process.argv.slice(2);
const droog = args.includes('--droog');
const alleen = args.find(a => !a.startsWith('--'));

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

for (const camp of fs.readdirSync(ROOT)) {
  if (alleen && camp !== alleen) continue;
  const dir = path.join(ROOT, camp);
  if (!fs.statSync(dir).isDirectory()) continue;
  const filesDir = path.join(dir, 'files');
  const metaPad = path.join(dir, 'meta.json');
  if (!fs.existsSync(filesDir) || !fs.existsSync(metaPad)) continue;

  const media = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, 'media.json'), 'utf8')).files || {}; }
    catch { return {}; }
  })();

  // Hashes van alles wat in de bibliotheek staat.
  const perHash = new Map();
  const bestanden = fs.readdirSync(filesDir);
  const padVan = (id) => {
    const m = bestanden.find(f => f.startsWith(id + '.'));
    return m ? path.join(filesDir, m) : null;
  };
  for (const id of Object.keys(media)) {
    const p = padVan(id);
    if (p) try { perHash.set(sha(p), id); } catch {}
  }

  const meta = JSON.parse(fs.readFileSync(metaPad, 'utf8'));
  const bron = meta.mediaBron || {};
  let nieuw = 0, wees = 0;
  for (const f of bestanden) {
    const id = f.slice(0, f.lastIndexOf('.'));
    if (!/^spell-img-/.test(id) || bron[id]) continue;
    const src = perHash.get(sha(path.join(filesDir, f)));
    if (src) { bron[id] = src; nieuw++; } else wees++;
  }

  console.log(`${camp}: ${nieuw} gekoppeld, ${wees} zonder bron in de bibliotheek`);
  if (nieuw && !droog) {
    meta.mediaBron = bron;
    fs.writeFileSync(metaPad, JSON.stringify(meta, null, 2));
  }
}
