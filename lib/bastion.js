// ── Bastion — de rekenregels ────────────────────────────────────────────────
// Een thuisbasis voor de party (DMG 2024, hoofdstuk Bastions), maar één per
// **party** in plaats van één per personage. Zie `docs/voorstel-bastion.md`.
//
// Dit bestand rekent alleen: hoeveel special facilities een party mag hebben,
// wat er aan een keuze opvalt, en welke orders een facility kent. Lezen en
// schrijven doet `routes/api.js`. Zelfde verdeling als bij
// `lib/personage-concept.js`: de server rekent, de client toont.
//
// **Voorrekenen, niet blokkeren.** Een facility boven het level van de party,
// een prerequisite die niemand haalt of een slot te veel levert een opmerking
// op, geen weigering — de DM tekent af.

const path = require('path');
const fs   = require('fs');

let _cat = null;
function catalogus() {
  if (!_cat) _cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bronnen', 'bastion-facilities.json'), 'utf8'));
  return _cat;
}

const STANDAARD = { vanafLevel: 5, cadans: 7, aanbieden: true, spelersVastleggen: false };

// Wat de DM instelde, aangevuld met de standaard. Een ontbrekende sleutel ís de
// standaard; er wordt niets weggeschreven.
function instellingen(meta) {
  const b = (meta && typeof meta.bastion === 'object' && meta.bastion) || {};
  const getal = (v, d, min, max) => {
    const n = parseInt(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
  };
  return {
    vanafLevel:        getal(b.vanafLevel, STANDAARD.vanafLevel, 1, 20),
    cadans:            getal(b.cadans, STANDAARD.cadans, 1, 60),
    aanbieden:         b.aanbieden !== false,
    spelersVastleggen: b.spelersVastleggen === true,
  };
}

// Hoeveel special facilities één personage van dit level krijgt: 2 op 5, 4 op
// 9, 5 op 13, 6 op 17. Onder de drempel van de campagne nul.
function slotsVoorLevel(level, vanafLevel = 5) {
  const lvl = parseInt(level) || 0;
  if (lvl < vanafLevel) return 0;
  let n = 0;
  for (const [drempel, aantal] of Object.entries(catalogus().slotsPerLevel)) {
    if (lvl >= Number(drempel)) n = aantal;
  }
  // Een campagne die vóór level 5 begint: dan geldt de eerste trede.
  return n || catalogus().slotsPerLevel['5'];
}

// De party-variant: de som van waar elk lid recht op heeft. Een override van
// de DM wint, want "de app rekent voor, de DM tekent af".
function slots(levels, inst, override) {
  const afgeleid = (levels || []).reduce((s, l) => s + slotsVoorLevel(l, inst.vanafLevel), 0);
  const o = parseInt(override);
  return { afgeleid, totaal: Number.isFinite(o) && o >= 0 ? o : afgeleid, override: Number.isFinite(o) && o >= 0 };
}

function specialOp(key) {
  return catalogus().special.find(f => f.key === key) || null;
}
function basicOp(key) {
  return catalogus().basic.find(f => f.key === key) || null;
}

// Welke orders een facility kent. Maintain kan altijd: dat is "laat het
// bastion zijn gang gaan", en daar rolt in fase 2 het Bastion Event op.
function ordersVan(fac) {
  if (!fac?.special) return [];
  const def = specialOp(fac.key);
  return [...new Set([...(def?.orders || []), 'maintain'])];
}

// Wat er opvalt aan een nieuwe special facility. Nooit een weigering.
function opmerkingenBijNieuw(key, { levels = [], aantalSpecial = 0, slotsTotaal = 0, bestaand = [] } = {}) {
  const def = specialOp(key);
  if (!def) return ['Deze facility staat niet in de catalogus.'];
  const uit = [];
  const hoogste = Math.max(0, ...levels.map(l => parseInt(l) || 0));
  if (hoogste < def.level) uit.push(`Vraagt level ${def.level}; het hoogste level in de party is ${hoogste || 'onbekend'}.`);
  if (aantalSpecial + 1 > slotsTotaal) uit.push(`Daarmee zijn het er ${aantalSpecial + 1}, terwijl de party er ${slotsTotaal} heeft.`);
  if (def.prerequisite) uit.push(`Prerequisite: ${def.prerequisite}.`);
  if (bestaand.some(f => f.special && f.key === key)) uit.push('Deze facility heeft het bastion al.');
  return uit;
}

// Is het tijd voor een Bastion Turn? Geteld in lange rusten van de party —
// dezelfde klok als de rente van de woekeraar en het verversen van een winkel.
// De party bepaalt het tempo, niet de kalender.
function turnStand(bastion, rustNu, inst) {
  const sinds = Math.max(0, (parseInt(rustNu) || 0) - (parseInt(bastion?.turnStand) || 0));
  return { nachten: sinds, cadans: inst.cadans, klaar: inst.aanbieden && sinds >= inst.cadans };
}

module.exports = {
  catalogus, instellingen, slotsVoorLevel, slots, specialOp, basicOp, ordersVan,
  opmerkingenBijNieuw, turnStand, STANDAARD,
};
