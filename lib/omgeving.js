// ════════════════════════════════════════════════════════════════════════════
//  OMGEVINGSEFFECTEN — Lair Actions en wat de plek zelf doet
// ════════════════════════════════════════════════════════════════════════════
// Een Lair Action was tekst: de DM las hem voor en de tafel deed de rest. Dat
// blijft kunnen (`eigen`), maar de meeste zijn een van een handvol vormen — de
// grond beeft, het water stijgt, er hangt gif in de lucht, een lont brandt —
// en die hebben allemaal hetzelfde skelet: een Saving Throw, schade (heel of
// half bij een geslaagde worp), soms een conditie. Of juist iets gunstigs: een
// tempel die Temporary HP of Resistance geeft.
//
// Dit bestand is de enige plek waar staat welke vormen er zijn en wat ze
// standaard doen. Een regel in een encounter (of een regieblok in een akte)
// neemt een preset en mag elk veld overschrijven; de editor vult bij het
// kiezen de standaard in, zodat wat opgeslagen staat altijd volledig is.
//
// **De tafel gooit, de app rekent.** De spelers rollen hun Saving Throw aan
// tafel; de DM tikt per speler aan wie slaagde. De schade rolt de app één keer
// voor (zoals een monster dat zou doen) en staat in een veld dat de DM mag
// overtypen — een formule is een uitgangspunt, geen eindoordeel.

const ABILITIES = {
  STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
  INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};

const SCHADETYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

// Condities die een omgeving kan geven. Een whitelist, want de waarde komt op
// een token terecht en de picker kent alleen deze ids.
const CONDITIES_VIJANDIG = ['blinded', 'deafened', 'frightened', 'grappled', 'incapacitated',
  'poisoned', 'prone', 'restrained', 'stunned', 'burning', 'bleeding', 'charmed', 'paralyzed'];
const CONDITIES_GUNSTIG = ['blessed', 'resistance', 'haste', 'invisible', 'hidden', 'dodging'];

// `fx` is een effect uit lib/display-fx.js (het tafelscherm kent die al);
// `beeld` is wat gevecht-regie.js er zelf bij tekent als er geen fx past.
const PRESETS = [
  { id: 'aardbeving', label: 'Aardbeving', icoon: 'mountain', soort: 'vijandig', fx: 'aardbeving',
    tekst: 'De grond scheurt open en alles wankelt.',
    save: { ab: 'DEX', dc: 15 }, schade: { worp: '2d6', type: 'bludgeoning', half: false }, conditie: 'prone' },
  { id: 'storm', label: 'Woeste storm', icoon: 'cloud-lightning', soort: 'vijandig', fx: 'bliksem',
    tekst: 'Een bliksemschicht slaat in tussen hen in.',
    save: { ab: 'DEX', dc: 14 }, schade: { worp: '3d6', type: 'lightning', half: true }, conditie: null },
  { id: 'water', label: 'Stijgend water', icoon: 'waves', soort: 'vijandig', fx: null, beeld: 'water',
    tekst: 'Het water stijgt tot aan de borst en trekt aan alles wat erin staat.',
    save: { ab: 'STR', dc: 13 }, schade: null, conditie: 'restrained' },
  { id: 'aftellen', label: 'Aftellen tot een explosie', icoon: 'hourglass', soort: 'vijandig', fx: 'vuur', beeld: 'lont',
    tekst: 'Een lont sist. Nog even, en alles vliegt de lucht in.', rondes: 3,
    save: { ab: 'DEX', dc: 15 }, schade: { worp: '6d6', type: 'fire', half: true }, conditie: null },
  { id: 'vuur', label: 'Vlammen', icoon: 'flame', soort: 'vijandig', fx: 'vuur',
    tekst: 'Vlammen schieten op uit de spleten in de vloer.',
    save: { ab: 'DEX', dc: 13 }, schade: { worp: '3d6', type: 'fire', half: true }, conditie: null },
  { id: 'gifnevel', label: 'Giftige nevel', icoon: 'biohazard', soort: 'vijandig', fx: 'gif',
    tekst: 'Een groene nevel kruipt over de grond.',
    save: { ab: 'CON', dc: 13 }, schade: { worp: '2d6', type: 'poison', half: true }, conditie: 'poisoned' },
  { id: 'stenen', label: 'Vallende stenen', icoon: 'brick-wall', soort: 'vijandig', fx: 'aardbeving',
    tekst: 'Brokken steen vallen van het plafond.',
    save: { ab: 'DEX', dc: 12 }, schade: { worp: '2d10', type: 'bludgeoning', half: true }, conditie: null },
  { id: 'vrieskou', label: 'IJzige wind', icoon: 'snowflake', soort: 'vijandig', fx: 'vrieskou',
    tekst: 'Een ijzige wind snijdt door merg en been.',
    save: { ab: 'CON', dc: 13 }, schade: { worp: '2d6', type: 'cold', half: true }, conditie: null },
  { id: 'fluistering', label: 'Fluisterstemmen', icoon: 'ear', soort: 'vijandig', fx: 'fluistering',
    tekst: 'Stemmen fluisteren je naam vanuit de duisternis.',
    save: { ab: 'WIS', dc: 13 }, schade: { worp: '2d6', type: 'psychic', half: true }, conditie: 'frightened' },
  { id: 'duisternis', label: 'Duisternis', icoon: 'moon', soort: 'vijandig', fx: 'duister',
    tekst: 'Al het licht dooft in één klap.',
    save: null, schade: null, conditie: 'blinded' },

  { id: 'heilig-licht', label: 'Heilig licht', icoon: 'sparkles', soort: 'gunstig', fx: 'genezing',
    tekst: 'Licht valt door het glas-in-lood; wie erin staat voelt zich onaantastbaar.',
    gunst: { thp: '1d10', heal: '', conditie: null } },
  { id: 'bron', label: 'Helende bron', icoon: 'droplets', soort: 'gunstig', fx: 'glinstering',
    tekst: 'Het water van de bron glanst; wie ervan drinkt voelt zijn wonden sluiten.',
    gunst: { thp: '', heal: '2d4+2', conditie: null } },
  { id: 'altaar', label: 'Beschermend altaar', icoon: 'shield-check', soort: 'gunstig', fx: 'glinstering',
    tekst: 'Het altaar gloeit op; een schild van licht legt zich over de party.',
    gunst: { thp: '', heal: '', conditie: 'resistance', resistance: 'necrotic' } },
  { id: 'zegen', label: 'Zegen', icoon: 'sparkle', soort: 'gunstig', fx: 'genezing',
    tekst: 'Een warme gloed: de goden kijken mee.',
    gunst: { thp: '', heal: '', conditie: 'blessed' } },

  { id: 'eigen', label: 'Eigen', icoon: 'hexagon', soort: 'vijandig', fx: null,
    tekst: '', save: null, schade: null, conditie: null },
];
const PRESET_PER_ID = new Map(PRESETS.map(p => [p.id, p]));

const DOBBEL = /^\s*\d*\s*d\s*\d+\s*([+-]\s*\d+)?\s*$|^\s*\d+\s*$/i;
const worpOf = (v) => {
  const s = String(v ?? '').replace(/\s+/g, '').slice(0, 20);
  return s && DOBBEL.test(s) ? s : '';
};

/**
 * Een regel zoals hij opgeslagen staat, of zoals hij binnenkomt. Een kale tekst
 * (de vorm van vóór de presets) wordt `eigen` met die tekst. Velden die er niet
 * zijn, komen uit de preset; wat er wél is, wint.
 */
function regelUit(r) {
  if (r == null) return null;
  if (typeof r === 'string') {
    const t = r.trim().slice(0, 400);
    return t ? { preset: 'eigen', tekst: t, save: null, schade: null, conditie: null } : null;
  }
  if (typeof r !== 'object') return null;
  const p = PRESET_PER_ID.get(String(r.preset || 'eigen')) || PRESET_PER_ID.get('eigen');
  const heeft = (k) => Object.prototype.hasOwnProperty.call(r, k);
  const tekst = String(heeft('tekst') ? r.tekst : p.tekst || '').trim().slice(0, 400);
  const soort = (heeft('soort') ? r.soort : p.soort) === 'gunstig' ? 'gunstig' : 'vijandig';

  const saveIn = heeft('save') ? r.save : p.save;
  const save = saveIn && ABILITIES[String(saveIn.ab || '').toUpperCase()]
    ? { ab: String(saveIn.ab).toUpperCase(), dc: Math.max(1, Math.min(30, parseInt(saveIn.dc) || 10)) }
    : null;

  const schIn = heeft('schade') ? r.schade : p.schade;
  const schade = schIn && worpOf(schIn.worp)
    ? { worp: worpOf(schIn.worp), type: SCHADETYPES.includes(schIn.type) ? schIn.type : 'bludgeoning', half: !!schIn.half }
    : null;

  const condIn = heeft('conditie') ? r.conditie : p.conditie;
  const conditie = CONDITIES_VIJANDIG.includes(condIn) ? condIn : null;

  const gIn = heeft('gunst') ? r.gunst : p.gunst;
  const gunst = soort === 'gunstig' && gIn ? {
    thp: worpOf(gIn.thp), heal: worpOf(gIn.heal),
    conditie: CONDITIES_GUNSTIG.includes(gIn.conditie) ? gIn.conditie : null,
    resistance: SCHADETYPES.includes(gIn.resistance) ? gIn.resistance : null,
  } : null;

  const rondesIn = heeft('rondes') ? r.rondes : p.rondes;
  const rondes = p.id === 'aftellen' || rondesIn ? Math.max(1, Math.min(10, parseInt(rondesIn) || 3)) : null;

  if (!tekst && p.id === 'eigen') return null;
  return {
    preset: p.id, tekst, soort,
    ...(soort === 'vijandig' ? { save, schade, conditie } : { gunst }),
    ...(rondes ? { rondes } : {}),
  };
}

/** De preset met dit id (voor label, icoon, fx en beeld). */
function presetVoor(id) {
  return PRESET_PER_ID.get(String(id || '')) || PRESET_PER_ID.get('eigen');
}

/** Doet deze regel iets dat afgehandeld moet worden, of is het alleen tekst? */
function heeftMechaniek(r) {
  if (!r) return false;
  if (r.soort === 'gunstig') return !!(r.gunst && (r.gunst.thp || r.gunst.heal || r.gunst.conditie));
  return !!(r.save || r.schade || r.conditie);
}

/** Wat een speler op tafel leest onder de tekst: "DC 15 Dexterity Saving Throw · 2d6 bludgeoning". */
function regelSamenvatting(r) {
  if (!r) return '';
  const delen = [];
  if (r.soort === 'gunstig') {
    const g = r.gunst || {};
    if (g.thp) delen.push(`${g.thp} Temporary HP`);
    if (g.heal) delen.push(`${g.heal} HP`);
    if (g.conditie === 'resistance' && g.resistance) delen.push(`Resistance to ${g.resistance}`);
    else if (g.conditie) delen.push(g.conditie[0].toUpperCase() + g.conditie.slice(1));
    return delen.join(' · ');
  }
  if (r.save) delen.push(`DC ${r.save.dc} ${ABILITIES[r.save.ab]} Saving Throw`);
  if (r.schade) delen.push(`${r.schade.worp} ${r.schade.type}${r.schade.half ? ', half bij succes' : ''}`);
  if (r.conditie) delen.push(r.conditie[0].toUpperCase() + r.conditie.slice(1));
  return delen.join(' · ');
}

module.exports = {
  PRESETS, ABILITIES, SCHADETYPES, CONDITIES_VIJANDIG, CONDITIES_GUNSTIG,
  regelUit, presetVoor, heeftMechaniek, regelSamenvatting,
};
