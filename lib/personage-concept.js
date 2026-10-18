// ── Een personage in wording ─────────────────────────────────────────────────
// Een speler kon zijn blad al bijwerken, maar het kaartje zelf aanmaken was
// `requireDM`. Een nieuwe speler stond dus niet in de inloglijst en kwam
// nergens binnen; de DM moest eerst, midden in een sessie, een leeg kaartje
// maken terwijl de rest wachtte.
//
// **Een concept is geen kaartje.** Dat is de kern van dit bestand. Een half
// personage dat als entity in de wereld staat moet je op twintig plekken
// wegfilteren — uit de partylijst, het gevecht, de lootverdeling, het
// tafelscherm, de sheets — en elke plek die je vergeet is een fout die pas aan
// tafel opvalt. Een concept staat daarom los in `dm-state.conceptPersonages`.
// Pas als de DM het gunt ontstaan het kaartje, het profiel, de beurs en de
// boedel, in één keer en compleet.
//
// Hier staat alleen wat er van het concept te berekenen valt. De routes en het
// schrijven staan in `routes/api.js`, bij de andere verzoeken.
const fs   = require('fs');
const path = require('path');

const BRONNEN = path.join(__dirname, '..', 'bronnen');
const _lees = (naam) => {
  try { return JSON.parse(fs.readFileSync(path.join(BRONNEN, `${naam}.json`), 'utf8')); }
  catch { return {}; }
};

// ── De vier manieren om abilities te bepalen ─────────────────────────────────
// De DM zet aan welke er aan zijn tafel mogen. Niet omdat de app een mening
// heeft, maar omdat "hoe doen we de scores" een afspraak is die je één keer
// maakt en niet elke keer opnieuw wilt uitleggen.
const METHODES = {
  array:    { label: 'Standaardreeks', hint: 'De zes vaste getallen 15, 14, 13, 12, 10, 8 over je abilities verdelen.' },
  pointbuy: { label: 'Point buy',      hint: '27 punten te besteden; alles begint op 8 en hoger kopen kost meer.' },
  rollen:   { label: 'Rollen',         hint: 'Zes keer 4d6, de laagste valt af. Wat je rolt, dat is het.' },
  vrij:     { label: 'Vrij intikken',  hint: 'Zes vakjes. Voor een personage dat elders is gemaakt.' },
};
const STANDAARDREEKS = [15, 14, 13, 12, 10, 8];
// De kosttabel van de PHB. 8 is gratis; boven de 13 wordt elke stap duurder.
const PUNTEN = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const PUNTEN_BUDGET = 27;
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const AB_NAAM = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

// De instellingen van deze campagne, met de standaarden erin. Ontbreekt het
// blok, dan staat alles aan behalve een beginlevel boven 1: dat is een
// beslissing van de DM en niet iets waar je stilzwijgend in rolt.
function instellingen(meta) {
  const i = meta?.personageMaken || {};
  const methodes = Array.isArray(i.methodes) && i.methodes.length
    ? i.methodes.filter(m => METHODES[m]) : Object.keys(METHODES);
  return {
    aan:          i.aan !== false,
    methodes,
    maxLevel:     Math.max(1, Math.min(20, parseInt(i.maxLevel) || 1)),
    trinketTafel: String(i.trinketTafel || ''),
  };
}

const abMod = (score) => Math.floor(((parseInt(score) || 10) - 10) / 2);
const teken = (n) => (n >= 0 ? `+${n}` : `${n}`);
const profBonusVoor = (level) => 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);

// ── Wat de background geeft ──────────────────────────────────────────────────
// `backgrounds-2024.json` zet het als vier regels tekst op level 1: welke drie
// abilities, welke feat, welke twee skills, welk gereedschap. Dat is precies
// wat 2024 vraagt, dus we lezen het uit in plaats van het ergens anders nog
// eens op te schrijven.
function backgroundDelen(naam) {
  const bg = _lees('backgrounds-2024')[naam];
  const regels = (bg?.levels?.['1'] || []);
  const vind = (n) => regels.find(r => (r.name || '').toLowerCase() === n)?.desc || '';
  const lijst = (s) => String(s || '').split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
  const abilities = lijst(vind('ability scores'))
    .map(n => ABILITIES.find(a => AB_NAAM[a].toLowerCase() === n.toLowerCase()))
    .filter(Boolean);
  return {
    abilities,
    feat:  vind('feat'),
    skills: lijst(vind('skill proficiencies')),
    tool:  vind('tool proficiency'),
    uitrusting: vind('equipment'),
  };
}

// ── Wat je meekrijgt ─────────────────────────────────────────────────────────
// De Equipment-regel van een background is er een van twee: een stapel spullen
// met wat geld, of alleen geld. Hij staat als zin in de bron ("Choose A or B:
// (A) …, 8 GP; or (B) 50 GP"), want zo staat hij in het boek. Hier wordt het
// twee keuzes met een lijst en een bedrag, zodat de wizard er knoppen van kan
// maken en het gunnen er spullen van kan maken.
function uitrustingOpties(backgroundNaam) {
  const zin = backgroundDelen(backgroundNaam).uitrusting;
  if (!zin) return [];
  const uit = [];
  for (const [sleutel, deel] of [['A', /\(A\)([^;]*)/], ['B', /\(B\)(.*)$/]]) {
    const m = zin.match(deel);
    if (!m) continue;
    const stukken = m[1].split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
    let goud = 0;
    const spullen = [];
    for (const stuk of stukken) {
      const geld = stuk.match(/^(\d+)\s*GP$/i);
      if (geld) { goud += parseInt(geld[1]); continue; }
      spullen.push(stuk.replace(/^or\s+/i, '').trim());
    }
    uit.push({ sleutel, spullen, goud });
  }
  return uit;
}

// De meegeleverde voorwerpen, voor de wapen- en harnaskeuze. Bewust uit
// dezelfde bron als de winkels: wat je hier kiest moet je later kunnen
// verkopen.
let _items = null;
function srdItems() {
  if (!_items) _items = _lees('srd-items').items || [];
  return _items;
}
function itemOp(sleutel) {
  return srdItems().find(i => i.key === sleutel) || null;
}

// Welke harnassen mag deze class dragen? `armor` is een zin ("Light, Medium,
// Shields"), want zo leest het op het kaartje; hier wordt het een filter.
// Wapens hebben in de bron geen simple/martial-veld, dus die filteren we niet
// — de class zegt wat hij mag en de DM ziet wat er gekozen is.
function harnassenVoor(klasse, prog) {
  const mag = String(klasseBasis(klasse, prog).armor || '').toLowerCase();
  return srdItems().filter(i => {
    if (i.itemType === 'Shield') return mag.includes('shield');
    if (i.itemType !== 'Armor') return false;
    return mag.includes(String(i.armorType || '').toLowerCase());
  });
}
function wapensVoor() {
  // Een wapen is iets waarmee je aanvalt; `werking: attack` scheidt de
  // zwaarden van de zuurflesjes die ook onder Weapon staan.
  return srdItems().filter(i => i.itemType === 'Weapon' && (i.werking || []).includes('attack'));
}

// ── Nakijken ─────────────────────────────────────────────────────────────────
// Voorrekenen, niet blokkeren — dezelfde afweging als bij de multiclass-eisen.
// Wat hier uitkomt is een lijst opmerkingen: de wizard toont ze, de DM ziet ze
// voordat hij gunt, en niemand wordt tegengehouden. De enige échte eis is een
// naam, want zonder naam is er geen kaartje.
function nakijken(concept, { meta, prog } = {}) {
  const c = concept || {};
  const inst = instellingen(meta);
  const fouten = [], opmerkingen = [];
  if (!String(c.naam || '').trim()) fouten.push('Hij heeft nog geen naam.');
  if (!c.klasse)     fouten.push('Er is nog geen class gekozen.');
  if (!c.species)    fouten.push('Er is nog geen species gekozen.');
  // Heeft zijn species een keuze en is die niet gemaakt, dan mist hij wat die
  // keuze geeft. Een opmerking, geen blokkade: misschien beslist hij aan tafel.
  const volk = prog?.species?.[c.species];
  if (volk?.varianten && Object.keys(volk.varianten).length && !c.speciesVariant) {
    opmerkingen.push(`${c.species} kiest nog een ${volk.variantLabel || 'variant'}.`);
  }
  if (!c.background) opmerkingen.push('Er is geen background gekozen — dan mis je zijn skills, zijn feat en zijn startgoud.');

  const level = Math.max(1, Math.min(20, parseInt(c.level) || 1));
  if (level > inst.maxLevel) {
    opmerkingen.push(`Hij vraagt om level ${level}; de tafel staat ${inst.maxLevel} toe.`);
  }
  if (c.methode && !inst.methodes.includes(c.methode)) {
    opmerkingen.push(`De scores zijn met "${METHODES[c.methode]?.label || c.methode}" bepaald, en dat staat hier niet aan.`);
  }

  const scores = c.scores || {};
  for (const a of ABILITIES) {
    const v = parseInt(scores[a]);
    if (!v) { fouten.push('Niet alle ability scores zijn ingevuld.'); break; }
  }
  if (c.methode === 'array') {
    const gekozen = ABILITIES.map(a => parseInt(scores[a]) || 0).sort((x, y) => y - x);
    if (gekozen.join() !== [...STANDAARDREEKS].sort((x, y) => y - x).join()) {
      opmerkingen.push('De scores zijn niet precies de standaardreeks.');
    }
  }
  if (c.methode === 'pointbuy') {
    const kosten = ABILITIES.reduce((t, a) => t + (PUNTEN[parseInt(scores[a])] ?? 99), 0);
    if (kosten > PUNTEN_BUDGET) opmerkingen.push(`De scores kosten ${kosten} punten; er zijn er ${PUNTEN_BUDGET}.`);
  }

  // Zoveel skills als de class geeft, plus wat de background vast meebrengt.
  const basis = klasseBasis(c.klasse, prog);
  const nodig = parseInt(basis.skillAantal) || 0;
  const gekozenSkills = Array.isArray(c.skills) ? c.skills : [];
  if (nodig && gekozenSkills.length !== nodig) {
    opmerkingen.push(`Zijn class kiest ${nodig} skills; er ${gekozenSkills.length === 1 ? 'is er 1' : `zijn er ${gekozenSkills.length}`} gekozen.`);
  }
  // Multiclassen vraagt om een minimum in allebei de classes. Zelfde regel als
  // bij het multiclassverzoek tijdens het spelen: voorrekenen, niet blokkeren.
  if (c.multiKlasse && parseInt(c.multiKlasseLevel) > 0) {
    const eisen = _lees('srd-multiclass-eisen');
    const vind = (k) => Object.entries(eisen).find(([n]) => n.toLowerCase() === String(k || '').toLowerCase())?.[1];
    for (const klasse of [c.klasse, c.multiKlasse]) {
      const eis = vind(klasse);
      if (!eis) continue;
      const tekort = [];
      for (const e of (eis.eisen || [])) {
        const heeft = (parseInt(c.scores?.[e.ability]) || 0) + (parseInt(c.bgBonus?.[e.ability]) || 0);
        if (heeft < e.minimum) tekort.push(`${AB_NAAM[e.ability]} ${e.minimum} (heeft ${heeft})`);
      }
      if ((eis.keuze || []).length) {
        const gehaald = eis.keuze.some(e =>
          ((parseInt(c.scores?.[e.ability]) || 0) + (parseInt(c.bgBonus?.[e.ability]) || 0)) >= e.minimum);
        if (!gehaald) tekort.push(eis.keuze.map(e => `${AB_NAAM[e.ability]} ${e.minimum}`).join(' of '));
      }
      if (tekort.length) opmerkingen.push(`Om ${klasse} te multiclassen is ${tekort.join(' en ')} nodig.`);
    }
  }

  // Vanaf level 4 krijg je verhogingen of feats, en die vraagt deze wizard
  // niet uit: dat zijn keuzes die je aan tafel maakt en die de level-up al
  // kent. Beter gezegd dan stilzwijgend overgeslagen.
  const basisVoor = klasseBasis(c.klasse, prog);
  const asi = (basisVoor.featLevels || [4, 8, 12, 16, 19]).filter(l => l <= level);
  if (asi.length) {
    opmerkingen.push(`Op level ${asi.join(', ')} hoort er een ability score improvement of een feat bij; die staan hier niet in.`);
  }
  return { fouten, opmerkingen, kanWeg: fouten.length === 0 };
}

// De kerngegevens van een class: wat de app meebrengt, met de afwijking van
// deze campagne eroverheen. Zelfde volgorde als in het Heldenboek, zodat een
// eigen class hier hetzelfde doet als daar.
function klasseBasis(klasse, prog) {
  const uitBron = _lees('klasse-basis').klassen?.[klasse] || {};
  const eigen   = prog?.classes?.[klasse]?.basis || null;
  return eigen ? { ...uitBron, ...eigen } : uitBron;
}

// ── Van concept naar blad ────────────────────────────────────────────────────
// Eén functie die zegt wat er in het profiel komt te staan. De wizard toont
// hem als voorbeeld, de DM ziet hetzelfde bij het gunnen, en bij het gunnen
// wordt hij letterlijk weggeschreven. Drie plekken, één berekening.
function profielVan(concept, { prog } = {}) {
  const c = concept || {};
  const level = Math.max(1, Math.min(20, parseInt(c.level) || 1));
  const basis = klasseBasis(c.klasse, prog);
  const bg    = c.background ? backgroundDelen(c.background) : null;

  // De bonus van de background komt bovenop de ruwe scores. Hij staat apart in
  // het concept, zodat je in de wizard kunt zien wat je zelf koos en wat je
  // ervan kreeg.
  const scores = {};
  for (const a of ABILITIES) {
    scores[a] = (parseInt(c.scores?.[a]) || 10) + (parseInt(c.bgBonus?.[a]) || 0);
  }

  const skills = {};
  for (const s of (Array.isArray(c.skills) ? c.skills : [])) skills[_skillSleutel(s)] = 'prof';
  for (const s of (bg?.skills || [])) skills[_skillSleutel(s)] = 'prof';

  // Begint hij als multiclass, dan is zijn level de som van twee classes. Het
  // profiel kent die velden al — dit is dezelfde vorm als na een goedgekeurd
  // multiclassverzoek, zodat de rest van de app er niets bijzonders aan ziet.
  const tweede = String(c.multiKlasse || '').trim();
  const tweedeLevel = tweede ? Math.max(0, Math.min(level - 1, parseInt(c.multiKlasseLevel) || 0)) : 0;
  const eersteLevel = level - tweedeLevel;

  const hitDie = parseInt(basis.hitDie) || 8;
  const conMod = abMod(scores.con);
  const dexMod = abMod(scores.dex);
  // Level 1 is het maximum van je hit die; elk level daarna het gemiddelde,
  // naar boven afgerond — de vaste regel, want laten rollen bij het maken van
  // een personage hoort aan tafel en niet in een formulier. Bij een multiclass
  // telt elk level met de hit die van zijn eigen class.
  const tweedeDie = tweedeLevel ? (parseInt(klasseBasis(tweede, prog).hitDie) || 8) : 0;
  const gem = (d) => Math.floor(d / 2) + 1 + conMod;
  const hp = Math.max(1, hitDie + conMod
    + (eersteLevel - 1) * gem(hitDie)
    + tweedeLevel * gem(tweedeDie));

  return {
    level: String(level),
    klasse: c.klasse || '',
    subclass: c.subclass || '',
    ...(tweedeLevel > 0 ? {
      multiclass: 'true', multiKlasse: tweede,
      multiKlasseLevel: String(tweedeLevel), klasseLevel: String(eersteLevel),
    } : {}),
    background: c.background || '',
    origin: c.species || '',
    // De keuze binnen zijn species, als hij er een heeft. Het blad kent dit
    // veld al; het staat daar onder Origin met zijn eigen naam ernaast.
    ...(c.speciesVariant ? { originVariant: c.speciesVariant } : {}),
    ...Object.fromEntries(ABILITIES.map(a => [a, scores[a]])),
    hitDie: tweedeLevel > 0 ? `${eersteLevel}d${hitDie} + ${tweedeLevel}d${tweedeDie}` : `${level}d${hitDie}`,
    profBonus: teken(profBonusVoor(level)),
    initiative: teken(dexMod),
    ac: String(_acVan(c, dexMod)),
    speed: '30 ft',
    saveProfs: (basis.saves || []).join(','),
    skillProfs: JSON.stringify(skills),
    skillAdj: '{}',
    armorProfs: basis.armor || '',
    weaponProfs: basis.weapons || '',
    toolProfs: [basis.tools, bg?.tool].filter(Boolean).join(', '),
    languages: 'Common',
    featuresTraits: '',
    _hp: hp,
  };
}

// Zonder harnas 10 + Dex; met een harnas zijn basis plus zoveel Dex als hij
// doorlaat. Een schild komt er bij op. Dat staat allemaal in de bron, dus het
// hoeft nergens overgetikt.
function _acVan(c, dexMod) {
  const harnas = c.harnas ? itemOp(c.harnas) : null;
  let ac = 10 + dexMod;
  if (harnas && harnas.itemType === 'Armor') {
    // Zwaar harnas laat geen Dex door; licht harnas juist alles. Alleen
    // middelzwaar heeft een plafond, en dat staat in de bron.
    const cap = String(harnas.armorType || '').toLowerCase() === 'heavy' ? 0
      : harnas.armorDexCap === undefined ? 99 : (parseInt(harnas.armorDexCap) || 0);
    ac = (parseInt(harnas.armorBaseAC) || 10) + Math.min(dexMod, cap);
  }
  if (c.schild) ac += 2;
  return ac;
}

// De sleutels waarmee het spelersblad zijn skills opslaat: kleine letters,
// zonder spaties. "Sleight of Hand" wordt `sleightofhand`.
function _skillSleutel(naam) {
  return String(naam || '').toLowerCase().replace(/[^a-z]/g, '');
}

module.exports = {
  METHODES, STANDAARDREEKS, PUNTEN, PUNTEN_BUDGET, ABILITIES, AB_NAAM,
  instellingen, backgroundDelen, klasseBasis, nakijken, profielVan,
  uitrustingOpties, srdItems, itemOp, harnassenVoor, wapensVoor,
  abMod, teken, profBonusVoor, skillSleutel: _skillSleutel,
};
