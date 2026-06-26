#!/usr/bin/env node
// Genereert de PWA-app-iconen uit public/img/app-icon-source.png (het Grisburgh-logo).
// Detecteert automatisch de bounding box van het embleem (de donkere tekening boven de
// "Grisburgh"-tekst) en centreert daar een vierkante uitsnede omheen → embleem altijd
// netjes in het midden. De crop blijft boven de tekstregel zodat die wegvalt.
//   node scripts/gen-app-icons.js
const sharp = require('sharp');
const SRC = 'public/img/app-icon-source.png';
const TEXT_TOP = 716;   // tekst ("Grisburgh") begint ~723 → net erboven afsnijden
const DARK = 110;       // navy ≈ grijswaarde 36; achtergrond ≈ 240
const FILL = 0.82;      // embleem vult ~82% van het icoon (rest = veilige marge)

async function detectBox() {
  const { data, info } = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, ch = info.channels;
  const scanH = Math.min(TEXT_TOP, info.height);
  let minX = w, maxX = 0, minY = scanH, maxY = 0;
  for (let y = 0; y < scanH; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * ch] < DARK) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY, w, h: info.height };
}

(async () => {
  const b = await detectBox();
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const embDim = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  // Symmetrisch vierkant rond (cx,cy); begrens zodat het binnen het beeld én boven de tekst blijft.
  const half = Math.min(embDim / 2 / FILL, cx, b.w - cx, cy, TEXT_TOP - cy);
  const size = Math.round(half * 2);
  const crop = { left: Math.round(cx - half), top: Math.round(cy - half), width: size, height: size };
  console.log('embleem-bbox:', { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY }, '→ crop:', crop);

  for (const [px, out] of [[512, 'app-icon-512'], [192, 'app-icon-192'], [180, 'app-icon-180'], [32, 'favicon-32']]) {
    await sharp(SRC).extract(crop).resize(px, px).png().toFile('public/img/' + out + '.png');
    console.log('  ✓ public/img/' + out + '.png', px + 'x' + px);
  }
  console.log('klaar');
})();
