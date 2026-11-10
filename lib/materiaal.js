'use strict';
/**
 * lib/materiaal.js — de M-component van een spreuk.
 *
 * De PHB 2024 kent drie soorten materiaal, en daar volgt de standaard uit:
 *  - zonder prijs ("a bit of sponge"): een component pouch of spellcasting
 *    focus dekt het, dus je hebt het altijd bij de hand;
 *  - met een prijs maar niet verbruikt ("a diamond worth 50+ GP"): je moet het
 *    bezitten, en daarna heb je het;
 *  - met een prijs én verbruikt ("…, which the spell consumes"): elke keer weg.
 *
 * Wat de speler zelf instelt (`spell.materiaal`) wint altijd: het is zijn
 * administratie, net als de prepared-vlag. De app rekent alleen voor.
 */

// Hoeveel centelingen (de koperen plek in de beurs) een munt waard is. Gelijk
// aan _MUNT_CL en parsePrijs in routes/api.js: gp = de gouden plek, enz.
const MUNT_CL = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

// Een bedrag zoals de SRD het schrijft: "1,000+ GP", "at least 25gp", "1 sp".
const BEDRAG = /(\d[\d,]*)\s*\+?\s*(gp|sp|cp|ep|pp)\b/gi;

// Haal de materiaaltekst uit wat er in het spreukenboek staat. Dat is meestal
// één string ("V, S, M (a tiny ball of bat guano)"), soms een lijst plus een
// los `material`-veld (zo staat hij in de bron).
function materiaalTekst(components, material) {
  if (material) return String(material).trim();
  if (Array.isArray(components)) return '';
  const s = String(components || '');
  if (!/(^|[\s,])M(\s|\(|,|$)/.test(s)) return null;      // geen M-component
  const m = s.match(/\bM\s*\(([\s\S]*)\)\s*$/);
  return m ? m[1].trim() : '';
}

function heeftM(components) {
  if (Array.isArray(components)) return components.some(c => String(c).trim().toUpperCase() === 'M');
  return /(^|[\s,])M(\s|\(|,|$)/.test(String(components || ''));
}

/**
 * → null (geen M) of { tekst, waardeCl, verbruikt }.
 * `waardeCl` is wat er bij het casten verdwijnt als het verbruikt wordt — bij
 * "all of which the spell consumes" alles samen, anders het eerste bedrag
 * (Clone: de diamant gaat op, het vat van 2.000 GP blijft). Bij materiaal dat
 * níét verbruikt wordt is het wat je één keer moet kopen.
 */
function materiaalUit(components, material) {
  if (!heeftM(components) && !material) return null;
  const tekst = materiaalTekst(components, material) || '';
  const bedragen = [...tekst.matchAll(BEDRAG)]
    .map(m => parseInt(m[1].replace(/,/g, ''), 10) * MUNT_CL[m[2].toLowerCase()])
    .filter(n => n > 0);
  const verbruikt = /consume/i.test(tekst);
  const waardeCl = !bedragen.length ? 0
    : (verbruikt && /all of which/i.test(tekst)) ? bedragen.reduce((a, b) => a + b, 0)
    : bedragen[0];
  return { tekst, waardeCl, verbruikt };
}

// Zonder eigen instelling: verbruikt materiaal met een prijs telt af (en je
// begint met niets — je hebt het nog niet gekocht), al het andere is altijd
// bij de hand.
function standaardStand(info) {
  if (info?.verbruikt && info.waardeCl > 0) return { modus: 'voorraad', aantal: 0 };
  return { modus: 'altijd', aantal: 0 };
}

function standVan(spell, info = materiaalUit(spell?.components, spell?.material)) {
  if (!info) return null;
  const eigen = spell?.materiaal;
  if (eigen && (eigen.modus === 'altijd' || eigen.modus === 'voorraad')) {
    return { modus: eigen.modus, aantal: Math.max(0, parseInt(eigen.aantal, 10) || 0) };
  }
  return standaardStand(info);
}

// Wat de client krijgt: de afgeleide info plus de stand, in één veld.
function voorClient(spell) {
  const info = materiaalUit(spell?.components, spell?.material);
  if (!info) return null;
  return { ...info, ...standVan(spell, info), eigen: !!spell?.materiaal };
}

// Wat er van de speler binnenkomt, schoon: alleen deze twee standen en een
// aantal tussen 0 en 999.
function schoneStand(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.modus !== 'altijd' && body.modus !== 'voorraad') return null;
  return { modus: body.modus, aantal: Math.max(0, Math.min(999, parseInt(body.aantal, 10) || 0)) };
}

module.exports = { MUNT_CL, materiaalUit, standaardStand, standVan, voorClient, schoneStand };
