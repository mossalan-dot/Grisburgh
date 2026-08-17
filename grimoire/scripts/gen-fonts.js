const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');                       // grimoire/
const SRC = path.join(ROOT, 'node_modules', '@fontsource');
const OUT = path.join(ROOT, 'public', 'fonts');
fs.mkdirSync(OUT, { recursive: true });

// pakketmap → CSS-family + welke gewichten we willen (rest wordt overgeslagen).
const FAM = {
  'cinzel-decorative':   { name: 'Cinzel Decorative', weights: ['400','700','900'] },
  'im-fell-english':     { name: 'IM Fell English',   weights: ['400'] },
  'im-fell-english-sc':  { name: 'IM Fell English SC',weights: ['400'] },
  'cardo':               { name: 'Cardo',             weights: ['400','700'] },
  'eb-garamond':         { name: 'EB Garamond',       weights: ['400'] },
  'petit-formal-script': { name: 'Petit Formal Script',weights: ['400'] },
  'pinyon-script':       { name: 'Pinyon Script',     weights: ['400'] },
  'caveat':              { name: 'Caveat',            weights: ['400','600','700'] },
  'shadows-into-light':  { name: 'Shadows Into Light',weights: ['400'] },
  'kalam':               { name: 'Kalam',             weights: ['300','400'] },
  'medievalsharp':       { name: 'MedievalSharp',     weights: ['400'] },
  'pirata-one':          { name: 'Pirata One',        weights: ['400'] },
  'unifrakturmaguntia':  { name: 'UnifrakturMaguntia',weights: ['400'] },
};

let css = `/* AUTO-GEGENEREERD door scripts/gen-fonts.js — self-hosted fonts (geen CDN).\n   Latin-subset woff2 uit @fontsource. Hergenereren: node scripts/gen-fonts.js */\n\n`;
let copied = 0;
for (const [dir, cfg] of Object.entries(FAM)) {
  const filesDir = path.join(SRC, dir, 'files');
  const all = fs.readdirSync(filesDir);
  for (const w of cfg.weights) {
    for (const style of ['normal', 'italic']) {
      const fn = `${dir}-latin-${w}-${style}.woff2`;
      if (!all.includes(fn)) continue;
      fs.copyFileSync(path.join(filesDir, fn), path.join(OUT, fn));
      copied++;
      css += `@font-face{font-family:'${cfg.name}';font-style:${style};font-weight:${w};font-display:swap;src:url('/fonts/${fn}') format('woff2');}\n`;
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'public', 'css', 'fonts.css'), css);
console.log(`✓ ${copied} woff2 gekopieerd → public/fonts/`);
console.log(`✓ public/css/fonts.css geschreven (${css.split('@font-face').length - 1} @font-face regels)`);
