// Extraheer 2024 (XPHB) backgrounds uit 5etools → progressie-bibliotheek.
// Output: public/data/backgrounds-2024.json  → { "Acolyte": { levels: { "1": [{name,desc}] } }, ... }
const fs = require('fs');

const DICE_TAGS = new Set(['dice','damage','hit','dc','scaledice','scaledamage','d20','chance']);
function stripTags(s) {
  return String(s).replace(/\{@(\w+)\s*([^}]*)\}/g, (_, tag, inner) => {
    const parts = inner.split('|');
    if (DICE_TAGS.has(tag)) return parts[0];
    const last = parts[parts.length - 1];
    return (parts.length >= 3 && last) ? last : parts[0];
  }).replace(/\{@\w+\}/g, '');
}

const d = JSON.parse(fs.readFileSync('/tmp/bg-5et.json', 'utf8'));
const xphb = (d.background || []).filter(b => b.source === 'XPHB');

const out = {};
for (const b of xphb) {
  const features = [];
  for (const block of (b.entries || [])) {
    if (block?.type !== 'list' || !Array.isArray(block.items)) continue;
    for (const it of block.items) {
      if (it?.type !== 'item' || !it.name) continue;
      const name = stripTags(it.name).replace(/:\s*$/, '').trim();
      const desc = stripTags(typeof it.entry === 'string' ? it.entry : (it.entries || []).join(' ')).trim();
      if (name) features.push({ name, desc });
    }
  }
  if (features.length) out[b.name] = { levels: { '1': features } };
}

const path = '/Users/alan/Library/Mobile Documents/com~apple~CloudDocs/DnD app/Grisburgh-main/public/data/backgrounds-2024.json';
fs.writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
console.log('Backgrounds:', Object.keys(out).length);
console.log('Voorbeeld Acolyte:', JSON.stringify(out['Acolyte'], null, 1));
