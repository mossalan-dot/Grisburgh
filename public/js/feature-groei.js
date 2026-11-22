// ── Features die meegroeien met je level ────────────────────────────────────
// Sommige features staan één keer in de progressie en worden later sterker:
// "The die becomes a d8 at 5th level". Het Heldenboek kon daar al **pillen**
// van maken — de levels als getal — maar daarmee weet je nog steeds niet wát
// er verandert, en je eigen blad kan niet zeggen *jouw steen is een d8*.
//
// Hier komt de **zin** erbij. Niet verzonnen: de tekst die er al staat wordt
// op zinsgrens gesplitst, en elke zin die een level noemt hoort bij dat level.
// Daarmee is de groei data in plaats van een alinea, en kan de tijdlijn hem
// op de juiste trede zetten en het blad zeggen welke voor jou geldt.
//
// **Een afgeleide, geen opslag.** Zet de DM een echt `groei`-veld op de regel
// (`[{level, tekst}]`, zie `docs/voorstel-feature-groei.md`), dan wint dat —
// die vorm is het doel, dit is wat er vandaag uit de bestaande teksten te
// halen valt zonder dat iemand 84 features met de hand nakijkt.
//
// De regexes zijn dezelfde als die van de pillen in `render-vaardigheden.js`;
// die telt alleen de getallen, deze pakt ook de zin eromheen.

// "5th level", "5th, 10th, and 15th level"
const ORD = /\b(\d{1,2})(?:st|nd|rd|th)(?:\s*,\s*\d{1,2}(?:st|nd|rd|th))*(?:\s*,?\s*(?:and|or)\s+\d{1,2}(?:st|nd|rd|th))?[-\s]level\b/gi;
// "Barbarian levels 8, 12, and 16", "character level 4"
const REEKS = /\b(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)?|character)\s+levels?\s+(\d{1,2}(?:\s*,\s*\d{1,2})*(?:\s*,?\s*and\s+\d{1,2})?)\b/g;
// "at level 17"
const AT = /\bat\s+level\s+(\d{1,2})\b/gi;
// Wat erachter staat beslist of dit over spréúkniveaus gaat in plaats van over
// jouw level: "spells of level 1 and 2", "a level 6 Warlock Spell".
const SPREUK = /^\s*(?:or (?:higher|lower)|(?:[a-z]+\s+)?(?:spell|slot|cantrip))/i;

// Welke levels noemt dit stuk tekst? Alleen die boven je eigen level tellen:
// het level waarop je de feature krijgt is geen groei.
export function levelsIn(tekst, eigenLevel = 0) {
  const t = String(tekst || '');
  const uit = new Set();
  for (const [re, groep] of [[ORD, 0], [REEKS, 1], [AT, 1]]) {
    re.lastIndex = 0;
    for (const m of t.matchAll(re)) {
      if (SPREUK.test(t.slice(m.index + m[0].length))) continue;
      for (const n of String(groep ? m[groep] : m[0]).match(/\d{1,2}/g) || []) uit.add(Number(n));
    }
  }
  return [...uit].filter(n => n > Number(eigenLevel || 0) && n <= 20).sort((a, b) => a - b);
}

// De tekst in zinnen. Op een punt, uitroep- of vraagteken gevolgd door een
// spatie en een hoofdletter — en niet op de punt van "d8." of "3rd.", want
// een afkorting is geen zinseinde. Regeleindes tellen ook: in deze teksten
// staan tabellen en opsommingen die geen punt dragen.
export function zinnen(tekst) {
  return String(tekst || '')
    .split(/\n+/)
    .flatMap(regel => regel.split(/(?<=[.!?])\s+(?=[A-Z"'(*])/))
    .map(z => z.trim())
    .filter(Boolean);
}

// Eén feature → `[{ level, tekst }]`, oplopend. Een zin die drie levels noemt
// ("at 5th, 10th, and 15th level") hoort bij alle drie: hij zegt zelf welke,
// en op je blad wil je bij level 10 díé zin lezen en niet "zie hierboven".
export function groeiRegels(tekst, eigenLevel = 0) {
  const uit = new Map();
  for (const zin of zinnen(tekst)) {
    for (const lv of levelsIn(zin, eigenLevel)) {
      if (!uit.has(lv)) uit.set(lv, zin);
    }
  }
  return [...uit.entries()].sort((a, b) => a[0] - b[0]).map(([level, t]) => ({ level, tekst: t }));
}

// Wat de DM zelf vastlegde wint; anders leiden we het af. Eén plek die dat
// beslist, zodat de tijdlijn, het Heldenboek en het blad niet elk hun eigen
// voorrangsregel krijgen.
export function groeiVan(feature, eigenLevel = 0) {
  const eigen = (Array.isArray(feature?.groei) ? feature.groei : [])
    .map(g => ({ level: Number(g?.level) || 0, tekst: String(g?.tekst || '').trim() }))
    .filter(g => g.level > 0 && g.tekst)
    .sort((a, b) => a.level - b.level);
  // Een **lege** lijst telt als "niet gezet" en niet als "geen groei": overal
  // in deze app haalt een editor een leeg veld weg in plaats van er een lege
  // waarde neer te zetten, en een leeg `groei` dat de tekst doodslaat zou dus
  // een stille bijwerking van opslaan zijn.
  return eigen.length ? eigen : groeiRegels(feature?.desc, eigenLevel);
}

