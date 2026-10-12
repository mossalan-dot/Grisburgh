#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  DE SRD-TEKSTEN LEESBAAR MAKEN
// ════════════════════════════════════════════════════════════════════════════
// De featureteksten komen uit de SRD-markdown, en daar scheidt een alinea zich
// af met een **nieuwe regel plus twee spaties** — niet met een lege regel. De
// app leest markdown, en daarin is één nieuwe regel geen alinea: alles kwam als
// één blok op het scherm, met een harde afbreking per zin en geen lucht ertussen.
//
// Daarnaast kent de SRD **inspringende kopjes**: "Flurry of Blows. Je kunt …".
// Dat is een kop, geen zin — maar zonder sterretjes ziet niemand dat.
//
// Dit script zet die twee om. Het verzint niets: het verplaatst witruimte en
// zet sterretjes om een kop die er al staat.
//
//   node scripts/srd-tekst-opmaken.js            # proefdraai, toont wat er verandert
//   node scripts/srd-tekst-opmaken.js --schrijf

const fs   = require('fs');
const path = require('path');

const schrijf = process.argv.includes('--schrijf');
const wortel  = path.join(__dirname, '..');

// Een inspringend kopje: een korte titel in hoofdletters-stijl, met een punt,
// gevolgd door een gewone zin. "When you expend a Focus Point, it is …" valt
// erbuiten omdat `you`, `a` en `expend` geen hoofdletter hebben.
const KLEIN = new Set(['of', 'the', 'and', 'or', 'a', 'an', 'to', 'in', 'on', 'at', 'for', 'with', 'van', 'de', 'het', 'en']);
function isKopje(zin) {
  const woorden = zin.trim().split(/\s+/);
  if (woorden.length === 0 || woorden.length > 5) return false;
  if (/[,:;]/.test(zin)) return false;
  return woorden.every((w, i) => {
    const kaal = w.replace(/[^\p{L}\p{N}’'-]/gu, '');
    if (!kaal) return false;
    if (i > 0 && KLEIN.has(kaal.toLowerCase())) return true;
    return /^[\p{Lu}\p{N}]/u.test(kaal);
  });
}

// De tekst komt uit een PDF met twee kolommen, en daar is aan het eind van een
// regel afgebroken: "Mar- tial", "ex- pended". Dat zijn geen koppeltekens maar
// resten van de opmaak. Een hoofdletter erna laten we staan — dan is het een
// opsomming ("\n- Let op"), geen afbreking.
const plakAfbrekingen = (t) => t.replace(/([a-z])- ([a-z])/g, '$1$2');

function opmaken(tekst) {
  if (typeof tekst !== 'string' || !tekst) return tekst;
  // Al met de hand bewerkt? Dan blijft hij zoals hij is.
  if (/\n\s*\n/.test(tekst) || /\*\*/.test(tekst)) return plakAfbrekingen(tekst);
  if (!/\n[ \t]+/.test(tekst)) return plakAfbrekingen(tekst);

  const alineas = plakAfbrekingen(tekst).split(/\n[ \t]+/).map(a => a.trim()).filter(Boolean);
  return alineas.map(a => {
    const m = /^([^.]{1,44})\.\s+(\p{Lu})/u.exec(a);
    if (m && isKopje(m[1])) return `**${m[1]}.** ${a.slice(m[0].length - 1).trimStart()}`;
    return a;
  }).join('\n\n');
}

// Elke plek waar een featuretekst kan staan: de meegeleverde bron en de eigen
// bibliotheek van een campagne.
function loopDoor(data, telling) {
  const raak = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(raak); return; }
    for (const [k, v] of Object.entries(o)) {
      if (k === 'desc' && typeof v === 'string') {
        const n = opmaken(v);
        if (n !== v) { o[k] = n; telling.n++; if (telling.voorbeeld.length < 3) telling.voorbeeld.push(n.slice(0, 180)); }
      } else raak(v);
    }
  };
  raak(data);
}

const bestanden = [path.join(wortel, 'bronnen', 'class-progression.json')];
const campDir = path.join(wortel, 'data', 'campaigns');
if (fs.existsSync(campDir)) {
  for (const c of fs.readdirSync(campDir)) {
    const p = path.join(campDir, c, 'progression.json');
    if (fs.existsSync(p)) bestanden.push(p);
  }
}

let totaal = 0;
for (const p of bestanden) {
  let d; try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { console.error(`${p}: onleesbaar`); continue; }
  const telling = { n: 0, voorbeeld: [] };
  loopDoor(d, telling);
  const naam = path.relative(wortel, p);
  if (!telling.n) { console.log(`${naam}: niets te doen`); continue; }
  totaal += telling.n;
  console.log(`${naam}: ${telling.n} beschrijving${telling.n === 1 ? '' : 'en'}`);
  if (!schrijf) { console.log('   ' + telling.voorbeeld[0].replace(/\n/g, '\n   ') + '…\n'); continue; }
  const bak = p + '.voor-opmaak.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(p, bak);
  fs.writeFileSync(p, JSON.stringify(d, null, 2));
}

console.log(`\n${totaal} in totaal.`);
if (!schrijf && totaal) console.log('Proefdraai — niets geschreven. Voeg --schrijf toe om het echt te doen.');
