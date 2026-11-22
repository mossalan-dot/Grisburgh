// ── Je AC uit wat je draagt ─────────────────────────────────────────────────
// Het AC-veld op het spelersblad werd met de hand ingevuld terwijl alles wat
// ervoor nodig is op de kaartjes staat: 14 van de 15 harnassen in Grisburgh
// dragen hun Base AC en hun soort. Hoe de Dex meetelt volgt uit die soort —
// licht alles, medium hoogstens +2, zwaar niets — en zo staat het ook in de
// voorwerp-editor.
//
// **Wat de app niet weet is wat je áánhebt.** Er is geen uitrustingsvinkje:
// de boedel zegt wat je bezit, niet wat je draagt. Dat kiest de speler dus
// zelf, en deze module rekent alleen uit wat eruit komt.
//
// Eigen bestand omdat het pure rekenkunde is: in `app.js` zat het opgesloten
// in de closure van het spelerstabblad en viel er niets aan te toetsen, en
// juist hier zitten de regels die stil fout gaan (een cap die niet geldt, een
// waarschuwing die een aftrek wordt).

export const AC_SOORT = { light: 'Light', medium: 'Medium', heavy: 'Heavy', shield: 'Shield' };

const getal = (x) => { const n = parseInt(x, 10); return Number.isFinite(n) ? n : null; };
const plus  = (n) => (n >= 0 ? `+${n}` : String(n));

// Hoeveel van je Dex-modifier telt mee? Een eigen cap op het kaartje wint van
// de soort — een Armor of Gleaming kan afwijken — en staat er niets, dan zegt
// de soort het.
export function dexCap(data) {
  const eigen = getal(data?.armorDexCap);
  if (eigen !== null) return eigen;
  const soort = String(data?.armorType || '').toLowerCase();
  if (soort === 'light') return Infinity;
  if (soort === 'medium') return 2;
  if (soort === 'heavy') return 0;
  return Infinity;
}

/**
 * @param harnas  het voorwerpkaartje dat je draagt, of null
 * @param schild  het schildkaartje, of null
 * @param profiel { dex, str, armorProfs } van het spelersblad
 */
export function acVan(harnas, schild, profiel = {}) {
  const dex = Math.floor(((getal(profiel.dex) ?? 10) - 10) / 2);
  const d = harnas?.data || null;
  const soort = String(d?.armorType || '').toLowerCase();
  const basis = getal(d?.armorBaseAC);
  const regels = [];
  let ac;

  // **Geen harnas of een kaartje zonder Base AC is hetzelfde geval.** Een
  // harnas waarvan niemand de AC invulde kan de app niet optellen, en dan is
  // 10 + Dex het eerlijke antwoord in plaats van een stil verkeerd getal.
  if (!harnas || basis === null) {
    ac = 10 + dex;
    regels.push(`zonder harnas: 10${dex ? ` ${plus(dex)} DEX` : ''}`);
  } else {
    const cap = dexCap(d);
    const bij = cap === Infinity ? dex : Math.min(dex, cap);
    ac = basis + bij;
    regels.push(`${harnas.name}: ${basis}${bij ? ` ${plus(bij)} DEX` : ''}`
      + (cap !== Infinity && dex > cap ? ` (${AC_SOORT[soort] || soort} telt hoogstens ${plus(cap)})` : ''));
  }

  if (schild) {
    // Een schild zonder getal is een gewoon schild: +2.
    const b = getal(schild.data?.armorBaseAC) ?? 2;
    ac += b;
    regels.push(`${schild.name}: ${plus(b)}`);
  }

  // **Waarschuwingen, geen aftrek.** In 5e verlies je geen AC als je niet
  // proficient bent met je harnas — je krijgt Disadvantage op alles met STR of
  // DEX en je kunt geen spells casten. Dat is een zin op het scherm; een getal
  // dat stilletjes lager uitvalt zou de speler aan tafel laten rekenen met een
  // AC die nergens staat.
  const waarschuw = [];
  const profs = String(profiel.armorProfs || '').toLowerCase();
  const dekt = (wat) => /\ball\b|\balle\b/.test(profs) || profs.includes(wat);
  if (harnas && soort && soort !== 'shield' && !dekt(soort)) {
    waarschuw.push(`Je bent niet proficient met ${AC_SOORT[soort] || soort} armor — Disadvantage op aanvallen en op checks met STR of DEX, en je kunt geen spells casten.`);
  }
  if (schild && !dekt('shield')) waarschuw.push('Je bent niet proficient met een shield.');
  const eis = getal(d?.strengthRequirement);
  if (eis !== null && (getal(profiel.str) ?? 0) < eis) {
    waarschuw.push(`${harnas.name} vraagt Strength ${eis}; daaronder gaat je snelheid 10 voet omlaag.`);
  }
  if (d?.stealthDisadvantage === true || d?.stealthDisadvantage === 'true') {
    waarschuw.push(`${harnas.name} geeft Disadvantage op Stealth.`);
  }

  return { ac, regels, waarschuw };
}
