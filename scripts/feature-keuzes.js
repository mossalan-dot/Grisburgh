#!/usr/bin/env node
// **Welke features laten je iets kiezen?**
//
// Een feature zegt in zijn tekst wat hij je laat kiezen — "choose two of your
// skill proficiencies", "you gain proficiency in one of the following skills".
// Prachtig voor een lezer, onbruikbaar voor een formulier: de personagemaker
// kan er geen keuzelijst van maken en het blad weet niet dat er een skill bij
// komt. Daarom draagt een feature sinds 18 nov 2026 een `keuze`-blok als
// gegeven (zie `_keuzeUit` in routes/api.js).
//
// Dit script vult dat blok niet in op eigen gezag. Het **leest** de teksten,
// doet een voorstel, en zet alles waar het niet zeker van is apart — die
// regels horen bij de DM en niet bij een regex.
//
// Waarom dat onderscheid zo scherp moet: van de 167 features die "choose" in
// hun tekst hebben, gaan er 141 over een keuze die je **aan tafel** maakt
// ("choose a creature you can see", "choose the damage type each time"). Die
// mogen hier juist níét uit komen rollen; een invulveld dat vraagt welk wezen
// je kiest is erger dan geen invulveld.
//
//   node scripts/feature-keuzes.js <campagne>             (rapport)
//   node scripts/feature-keuzes.js <campagne> --schrijf   (alleen de zekere)
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Geef een campagne op.'); process.exit(1); }

const WORTEL = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const PAD    = path.join(WORTEL, 'campaigns', campagne, 'progression.json');
if (!fs.existsSync(PAD)) { console.error(`Niet gevonden: ${PAD}`); process.exit(1); }

const SKILLS = ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History',
  'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance',
  'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'];

const TELWOORD = { one: 1, two: 2, three: 3, four: 4, a: 1, an: 1 };
const aantalUit = (w) => TELWOORD[String(w || '').toLowerCase()] || parseInt(w) || 1;

// Welke skills staan er in deze zin opgesomd? Alleen een naam die er echt
// staat telt mee; wat we niet herkennen laten we aan de DM.
function skillsIn(zin) {
  return SKILLS.filter(s => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(zin));
}

// Eén feature lezen. Geeft `{keuze, zin}` bij een voorstel, `{twijfel, zin}`
// als er wel iets staat maar niet zeker genoeg, of null.
function lees(f) {
  const desc = String(f.desc || '');
  if (!desc) return null;
  const zinnen = desc.split(/(?<=[.!?])\s+/).map(z => z.replace(/\s+/g, ' ').trim());

  for (const zin of zinnen) {
    // ── Expertise: uit wat je zelf al hebt, niet uit alle skills ──
    if (/\bexpertise\b/i.test(zin) && /\b(choose|kies)\b/i.test(zin)) {
      const m = zin.match(/choose\s+(\w+)\s+of\s+your\s+skill\s+proficienc/i);
      if (m) return { keuze: { soort: 'skill', aantal: aantalUit(m[1]), uit: 'eigen', geeft: 'expertise' }, zin };
      return { twijfel: 'Expertise, maar niet duidelijk hoeveel of waaruit', zin };
    }

    // ── Proficiency in een paar met name genoemde skills ──
    const uitLijst = zin.match(/proficienc\w*\s+in\s+(\w+)\s+of\s+the\s+following\s+skills?/i)
                  || zin.match(/choose\s+(\w+)\s+of\s+the\s+following\s+skills?/i);
    if (uitLijst) {
      const namen = skillsIn(zin.slice(uitLijst.index));
      if (namen.length < 2) return { twijfel: 'Noemt een lijst skills die ik niet kon uitlezen', zin };
      // **"…in which you have proficiency" is geen nieuwe proficiency.** Dan
      // kies je uit wat je al hebt en krijg je er Expertise op — de Wizard
      // Scholar is precies dat geval. Mijn eerste regel maakte er een nieuwe
      // proficiency van, en dan krijgt hij er een skill bij die hij niet hoort
      // te krijgen.
      const alHad = /in which you (have|already have) proficiency/i.test(zin);
      return { keuze: {
        soort: 'skill', aantal: aantalUit(uitLijst[1]), uit: namen,
        geeft: alHad ? 'expertise' : 'proficiency',
      }, zin };
    }

    // ── Proficiency in een vrij te kiezen aantal skills ──
    const vrij = zin.match(/proficienc\w*\s+in\s+(\w+)\s+skills?\s+of\s+your\s+choice/i);
    if (vrij) return { keuze: { soort: 'skill', aantal: aantalUit(vrij[1]), geeft: 'proficiency' }, zin };

    // ── Eén skill met name, zonder keuze: dat is geen keuze ──
    if (/you gain proficiency in the \w[\w' ]* skill\b/i.test(zin)) continue;

    // ── Talen ──
    const taal = zin.match(/(\w+)\s+languages?\s+of\s+your\s+choice/i)
              || zin.match(/choose\s+(\w+)\s+languages?/i);
    if (taal) return { keuze: { soort: 'language', aantal: aantalUit(taal[1]) }, zin };

    // ── Gereedschap ──
    if (/proficienc\w*\s+with\s+(one|two|three|\w+)\s+(kind|type)s?\s+of\s+(artisan|musical|gaming)/i.test(zin)) {
      const m = zin.match(/proficienc\w*\s+with\s+(\w+)\s+(?:kind|type)s?\s+of\s+(artisan|musical|gaming)/i);
      return { keuze: { soort: 'tool', aantal: aantalUit(m[1]), geeft: 'proficiency' }, zin };
    }
    if (/proficienc\w*\s+with[^.]{0,60}(tools|instrument|supplies|gaming set)/i.test(zin)
        && /\bof your choice\b|\bchoose\b/i.test(zin)) {
      return { twijfel: 'Gereedschap, maar welk soort en hoeveel is niet eenduidig', zin };
    }

    // ── Fighting Style: een lijst die per class verschilt ──
    if (/fighting style/i.test(zin) && /\b(choose|option)\b/i.test(zin)) {
      return { twijfel: 'Fighting Style — de opties verschillen per class, dus die lijst zet jij', zin };
    }
  }
  return null;
}

const prog = JSON.parse(fs.readFileSync(PAD, 'utf8'));
const voorstellen = [], twijfels = [], alHeeft = [];

function loop(bron, sub, levels) {
  for (const [lv, arr] of Object.entries(levels || {})) {
    for (const f of (arr || [])) {
      if (!f?.name) continue;
      const waar = `${bron}${sub ? ` / ${sub}` : ''} ${lv} · ${f.name}`;
      if (f.keuze) { alHeeft.push(waar); continue; }
      const r = lees(f);
      if (!r) continue;
      // **Twee keuzes in één feature passen niet in één veld.** Student of War
      // geeft een gereedschap én een skill; het blok kan er maar één dragen,
      // dus zo'n feature hoort bij de DM en niet bij dit script. Herkenbaar
      // aan twee soorten keuze in dezelfde tekst.
      const d = String(f.desc || '');
      const soorten = ['skill', 'tool', 'language'].filter(soort =>
        soort === 'skill' ? /\bskills?\b.{0,30}\bof your choice\b|of the following skills/i.test(d)
        : soort === 'tool' ? /(tools|instrument|supplies|gaming set).{0,30}of your choice/i.test(d)
        : /languages?.{0,30}of your choice/i.test(d));
      if (r.keuze && soorten.length > 1) {
        twijfels.push({ waar, f, twijfel: `Twee keuzes in één feature (${soorten.join(' + ')}) — dat past niet in één blok`, zin: r.zin });
        continue;
      }
      (r.keuze ? voorstellen : twijfels).push({ waar, f, ...r });
    }
  }
}

for (const [cn, c] of Object.entries(prog.classes || {})) {
  loop(cn, '', c.levels);
  for (const [sn, sc] of Object.entries(c.subclasses || {})) loop(cn, sn, sc.levels);
}
for (const [vn, v] of Object.entries(prog.species || {})) {
  loop(vn, '', v.levels);
  for (const [va, vd] of Object.entries(v.varianten || {})) loop(vn, va, vd.levels);
}

const toon = (k) => `${k.soort}${k.aantal > 1 ? ` ×${k.aantal}` : ''}`
  + (k.uit === 'eigen' ? ' uit wat je al hebt' : Array.isArray(k.uit) ? ` uit ${k.uit.join(', ')}` : '')
  + (k.geeft ? ` → ${k.geeft}` : '');

console.log(`\n== Voorstellen (${voorstellen.length}) ==`);
for (const v of voorstellen) {
  console.log(`\n  ${v.waar}`);
  console.log(`    ${toon(v.keuze)}`);
  console.log(`    "${v.zin.slice(0, 120)}"`);
}

console.log(`\n== Hier twijfel ik — deze zet jij zelf (${twijfels.length}) ==`);
for (const t of twijfels) {
  console.log(`\n  ${t.waar}`);
  console.log(`    ${t.twijfel}`);
  console.log(`    "${t.zin.slice(0, 120)}"`);
}

if (alHeeft.length) console.log(`\n${alHeeft.length} features hebben al een keuze; die blijven zoals ze zijn.`);

if (!schrijf) {
  console.log(`\nRapport — draai opnieuw met --schrijf om de ${voorstellen.length} voorstellen vast te leggen.`);
  console.log('De twijfelgevallen worden nooit geschreven.');
  process.exit(0);
}

const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
fs.copyFileSync(PAD, PAD.replace(/\.json$/, `.voor-keuzes.${stempel}.json`));
for (const v of voorstellen) v.f.keuze = v.keuze;
fs.writeFileSync(PAD, JSON.stringify(prog, null, 2));
console.log(`\nGeschreven: ${voorstellen.length} keuzes vastgelegd. Kopie ernaast gezet.`);
