#!/usr/bin/env node
/**
 * beelden-naar-webp.js — zet de opgeslagen beelden van een campagne om naar WebP.
 *
 *   node scripts/beelden-naar-webp.js <campagne>            # alleen rekenen
 *   node scripts/beelden-naar-webp.js <campagne> --schrijf  # echt omzetten
 *
 * Waarom: gemeten in Grisburgh op 15 sep 2026 namen 907 PNG's 1.869 MB van de
 * 2.053 MB in, gemiddeld 2.110 kB per stuk. Dat zit niet in de afmetingen —
 * 843 van de 1.135 beelden zijn maar 600–1199 px breed — maar in het formaat.
 * Dezelfde plaat in WebP is ongeveer een tiende, zonder zichtbaar verschil.
 *
 * Wat het script wél en niet doet:
 *  - **Niet** aan GIF (verliest zijn animatie), SVG (een tekening, geen foto),
 *    video, geluid of pdf.
 *  - **Niet** aan een bestand dat er niet kleiner van wordt. Een kleine,
 *    al geoptimaliseerde jpeg kan in WebP juist groeien; die blijft staan.
 *  - Boven 2560 px wordt er teruggeschaald — dat is een 1440p-scherm op ware
 *    grootte en een 4K-tafelscherm op tweederde.
 *  - De EXIF-draaiing wordt vastgelegd (`.rotate()`), anders staat een foto die
 *    de browser goed toonde na de conversie op zijn kant.
 *
 * Het **id blijft gelijk**, alleen de extensie verandert (`<id>.png` →
 * `<id>.webp`). De app zoekt een bestand op het id-deel (`storage.getFile`), dus
 * er hoeft nergens een verwijzing mee te veranderen. De thumbnails van dat id
 * worden weggegooid zodat ze opnieuw gemaakt worden van het nieuwe bestand.
 *
 * Met `--schrijf` gaan de originelen naar `files-origineel-<datum>/` naast de
 * campagnemap; ze worden dus niet weggegooid. Controleer de app en verwijder die
 * map daarna met de hand.
 */
const fs   = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); } catch { console.error('sharp ontbreekt.'); process.exit(1); }

const MAX_PX    = 2560;
const KWALITEIT = 82;
const OM        = /\.(png|jpe?g|tiff?|bmp)$/i;   // gif en svg bewust niet

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/beelden-naar-webp.js <campagne> [--schrijf]');
  process.exit(1);
}

const basis    = path.join(__dirname, '..', 'data', 'campaigns', campagne);
const filesDir = path.join(basis, 'files');
if (!fs.existsSync(filesDir)) { console.error('Geen files/ in ' + basis); process.exit(1); }

const datum   = new Date().toISOString().slice(0, 10);
const bewaar  = path.join(basis, `files-origineel-${datum}`);
const thumbs  = path.join(basis, 'thumbs');

(async () => {
  const alles = fs.readdirSync(filesDir).filter(f => OM.test(f));
  console.log(`${campagne}: ${alles.length} om te zetten beelden${schrijf ? '' : '  (proefronde — er wordt niets geschreven)'}`);
  if (schrijf) fs.mkdirSync(bewaar, { recursive: true });

  let voor = 0, na = 0, om = 0, over = 0, mis = 0, geschaald = 0;
  for (const naam of alles) {
    const bron = path.join(filesDir, naam);
    const oud  = fs.statSync(bron).size;
    voor += oud;
    let buf, meta;
    try {
      meta = await sharp(bron).metadata();
      buf  = await sharp(bron).rotate()
        .resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: KWALITEIT }).toBuffer();
    } catch (e) {
      mis++; console.log(`  ! ${naam}: ${e.message}`);
      na += oud; continue;
    }
    if (buf.length >= oud) { over++; na += oud; continue; }   // wordt er niet beter van
    if (Math.max(meta.width || 0, meta.height || 0) > MAX_PX) geschaald++;
    na += buf.length; om++;
    if (schrijf) {
      const id   = naam.slice(0, naam.lastIndexOf('.'));
      fs.renameSync(bron, path.join(bewaar, naam));
      fs.writeFileSync(path.join(filesDir, `${id}.webp`), buf);
      for (const t of [`${id}.webp`, `${id}.w1200.webp`, `${id}.waas.webp`]) {
        try { fs.unlinkSync(path.join(thumbs, t)); } catch {}
      }
    }
  }
  const mb = b => (b / 1048576).toFixed(0);
  console.log(`  omgezet: ${om}  ·  overgeslagen (werd niet kleiner): ${over}  ·  mislukt: ${mis}  ·  teruggeschaald: ${geschaald}`);
  console.log(`  ${mb(voor)} MB → ${mb(na)} MB   (${Math.round(100 - na / voor * 100)}% kleiner)`);
  if (schrijf) console.log(`  originelen staan in ${bewaar}`);
  else console.log('  Draai opnieuw met --schrijf om het echt te doen.');
})();
