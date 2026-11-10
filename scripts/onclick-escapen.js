#!/usr/bin/env node
// Zet `'${esc(x)}'` binnen een inline event-handler (`onclick="…"`) om naar
// `'${escArg(x)}'`.
//
// Waarom: `esc()` maakt een waarde veilig voor HTML, niet voor een
// JavaScript-string. In `onclick="f('${esc(naam)}')"` decodeert de browser
// eerst het attribuut en voert daarna de JavaScript uit — een apostrof in de
// naam sluit dan de string. "Bigby's Hand" gaf een SyntaxError (de knop deed
// niets), en een personagenaam als `x');fetch(…);('` werd uitgevoerd in het
// scherm van de DM. `escArg` doet eerst de JS-string en dan de HTML.
//
// Het script raakt alleen aan wat binnen een dubbel-gequote on…-attribuut
// staat, telt `${ … }`-diepte zodat aanhalingstekens in een expressie niet als
// einde van het attribuut gelden, en laat alles anders woordelijk staan.
//
//   node scripts/onclick-escapen.js            # rekent voor
//   node scripts/onclick-escapen.js --schrijf  # voert door
const fs = require('fs');
const path = require('path');

const MAP = path.join(__dirname, '..', 'public', 'js');
const schrijf = process.argv.includes('--schrijf');
const NA_ESC = [`.replace(/'/g, "\\\\'")`, `.replace(/'/g,"\\\\'")`];

function matchendeHaak(s, i) {          // s[i] === '('
  let d = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '(') d++;
    else if (c === ')') { d--; if (d === 0) return k; }
    else if (c === '"' || c === "'" || c === '`') {   // string in het argument overslaan
      const q = c; k++;
      while (k < s.length && s[k] !== q) { if (s[k] === '\\') k++; k++; }
    }
  }
  return -1;
}

function bewerk(src) {
  let uit = '', i = 0, aantal = 0;
  const attr = /\bon[a-z]+="/g;
  while (true) {
    attr.lastIndex = i;
    const m = attr.exec(src);
    if (!m) { uit += src.slice(i); break; }
    const begin = m.index + m[0].length;
    uit += src.slice(i, begin);
    // Loop tot de afsluitende " op diepte 0.
    let k = begin, diepte = 0, stuk = '';
    while (k < src.length) {
      if (diepte === 0 && src[k] === '"') break;
      if (src[k] === '$' && src[k + 1] === '{') {
        // Kandidaat: '${esc( of '${escJS( direct na een apostrof.
        const kop = /^\$\{(esc|escJS)\(/.exec(src.slice(k, k + 10));
        if (diepte === 0 && kop && src[k - 1] === "'") {
          const open = k + kop[0].length - 1;
          const dicht = matchendeHaak(src, open);
          let na = dicht + 1, staart = '';
          for (const n of NA_ESC) if (src.startsWith(n, na)) { staart = n; na += n.length; }
          if (dicht > 0 && src.startsWith("}'", na)) {
            const arg = src.slice(open + 1, dicht);
            if (!/^\s*(esc|escJS|escArg)\(/.test(arg)) {
              stuk += '${escArg(' + arg + ')}';
              k = na + 1;               // na de }
              aantal++;
              continue;
            }
          }
        }
        diepte++; stuk += '${'; k += 2; continue;
      }
      if (diepte > 0 && src[k] === '{') diepte++;
      else if (diepte > 0 && src[k] === '}') diepte--;
      stuk += src[k]; k++;
    }
    uit += stuk;
    i = k;
  }
  return { uit, aantal };
}

module.exports = { bewerk };
if (require.main === module) {
  let totaal = 0;
  for (const f of fs.readdirSync(MAP).filter(f => f.endsWith('.js')).sort()) {
    const p = path.join(MAP, f);
    const src = fs.readFileSync(p, 'utf8');
    const { uit, aantal } = bewerk(src);
    if (!aantal) continue;
    totaal += aantal;
    console.log(`${String(aantal).padStart(4)}  ${f}`);
    if (schrijf) fs.writeFileSync(p, uit);
  }
  console.log(`${String(totaal).padStart(4)}  totaal${schrijf ? ' (geschreven)' : ' (droog — --schrijf voert door)'}`);
}
