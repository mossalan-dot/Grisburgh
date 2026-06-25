#!/usr/bin/env node
// Genereert de PWA-app-iconen uit public/img/app-icon-source.png (het Grisburgh-logo).
// Snijdt het embleem uit (tekst eronder weg) en centreert het met marge ("safe zone")
// op een crème vlak, zodat iOS/Android-maskers het niet afknippen.
//   node scripts/gen-app-icons.js
const sharp = require('sharp');
const SRC = 'public/img/app-icon-source.png';
// Eén vierkant rond het embleem (bron = 1024x1024, embleem-centrum ~537,448).
// Alle pixels komen uit het origineel → geen aparte marge die moet matchen, dus geen naad.
// De crop stopt boven de "Grisburgh"-tekst (~y720).
const crop = { left: 267, top: 178, width: 540, height: 540 };

async function make(size, out) {
  await sharp(SRC).extract(crop).resize(size, size).png().toFile(out);
  console.log('  ✓', out, size + 'x' + size);
}
(async () => {
  await make(512, 'public/img/app-icon-512.png');
  await make(192, 'public/img/app-icon-192.png');
  await make(180, 'public/img/app-icon-180.png');   // apple-touch-icon
  await make(32,  'public/img/favicon-32.png');
  console.log('klaar');
})();
