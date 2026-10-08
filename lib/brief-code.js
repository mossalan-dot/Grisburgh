// ════════════════════════════════════════════════════════════════════════════
//  GECODEERDE BRIEF — het husselen
// ════════════════════════════════════════════════════════════════════════════
// Een gecodeerd document toont dezelfde tekens in een andere volgorde. Niet
// een cijferschrift met een sleutel: een **anagram van de hele brief**. De
// spelers ontcijferen aan tafel — met een check of met een fysieke puzzel —
// en als dat gelukt is drukt de DM op de knop. Wat er op het scherm gebeurt
// is dus geen puzzel maar een onthulling.
//
// Daarom hoeft het husselen ook niets slims te zijn, en moet het vooral twee
// dingen wél zijn:
//
//   **Altijd hetzelfde.** Dezelfde brief ziet er bij elke keer laden
//   hetzelfde uit, op elk apparaat. Zonder dat kun je er aan tafel niet over
//   praten ("die regel met die dubbele k") en klopt het tafelscherm niet met
//   wat iemand op zijn telefoon zag. Vandaar een eigen generator met een seed
//   uit de tekst zelf, en niet `Math.random`.
//
//   **Hier, en niet in de browser.** De klare tekst mag het huis niet uit
//   zolang hij niet onthuld is. Zou de client husselen, dan stond de echte
//   brief in de netwerktab — precies de fout die bij de verzegelde brief op
//   het tafelscherm al een keer gemaakt is.
//
// ── Wat er meedoet ──
// Álles behalve witruimte. Eerst deden alleen letters mee (`\p{L}`), en toen
// bleven cijfers en leestekens staan: een datum, een bedrag en een naam met
// een hoofdletter waren gewoon te lezen in een brief die geheim heette.
//
// Witruimte blijft wél staan, en dat is geen uitzondering maar de drager: de
// spaties en regelovergangen bepalen waar de regels breken. Zouden die
// meedoen, dan valt de brief in een andere vorm en is het niet meer dezelfde
// brief maar een andere.

// FNV-1a. Klein, snel, en genoeg: we beveiligen hier niets, we willen alleen
// dat dezelfde tekst dezelfde husseling geeft.
function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: één getal in, een reeks uit. Dezelfde seed geeft dezelfde reeks,
// en dat is het hele punt.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// De tekens die meedoen, als posities in de tekst. Werkt op code points, niet
// op UTF-16-eenheden: anders knipt het een emoji of een é in tweeën.
function _posities(tekens) {
  const uit = [];
  for (let i = 0; i < tekens.length; i++) if (!/\s/u.test(tekens[i])) uit.push(i);
  return uit;
}

// ── Husselen ────────────────────────────────────────────────────────────────
// Geeft de gehusselde tekst terug plus de volgorde die erbij hoort. `volgorde`
// zegt per meedoend teken wáár het getoond wordt: staat er bij het derde
// meedoende teken een 7, dan is dat teken te zien op de plek van het achtste.
//
// **Die volgorde hoort nooit samen met de gehusselde tekst de deur uit**: die
// twee samen zijn de klare tekst. Hij gaat pas mee bij het onthullen, en dan
// is de klare tekst er toch al.
function hussel(tekst) {
  const tekens = [...String(tekst ?? '')];
  const idx = _posities(tekens);
  if (idx.length < 2) return { tekst: tekens.join(''), volgorde: idx.map((_, k) => k) };

  const rand = rng(hash(tekens.join('')));
  let perm = shuffle(idx, rand);
  // Een husseling die te veel op het origineel lijkt is geen husseling. Bij
  // een korte tekst kan dat zomaar; opnieuw proberen is goedkoop.
  for (let poging = 0; poging < 6; poging++) {
    const gelijk = perm.filter((p, k) => tekens[p] === tekens[idx[k]]).length;
    if (gelijk <= Math.max(1, Math.floor(idx.length * 0.3))) break;
    perm = shuffle(idx, rand);
  }

  // Het teken op plek `idx[k]` wordt getoond op plek `perm[k]`.
  const uit = tekens.slice();
  idx.forEach((van, k) => { uit[perm[k]] = tekens[van]; });

  // `volgorde` in **rangnummers** onder de meedoende tekens, niet in posities
  // in de tekst. De client telt zelf welke tekens meedoen (dezelfde regel:
  // alles behalve witruimte, en de witruimte staat in beide teksten op
  // dezelfde plek) en hoeft dan niets over posities te weten.
  const rang = new Map();
  idx.forEach((pos, k) => rang.set(pos, k));
  return {
    tekst: uit.join(''),
    volgorde: perm.map(pos => rang.get(pos)),
  };
}

// Alleen de gehusselde tekst — wat een speler krijgt zolang hij hem niet mag
// lezen. Dit is met opzet een eigen functie: wie `hussel()` aanroept en
// vergeet alleen `.tekst` te pakken, stuurt de volgorde mee en daarmee de
// hele brief.
function husselTekst(tekst) {
  return hussel(tekst).tekst;
}

module.exports = { hussel, husselTekst, hash };
