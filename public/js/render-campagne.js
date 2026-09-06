import { api } from './api.js?v=272';
import { renderStatblock } from './render-statblock.js?v=4';

const icon = (...a) => window.icon(...a);

const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

// ── Wapeneigenschappen (2024 PHB) ──
// Geëxporteerd zodat het spelerblad (app.js) dezelfde bron + tooltips hergebruikt.
export const WEAPON_PROPERTIES = {
  'Ammunition': 'You can make a ranged attack with this weapon only if you have ammunition to fire from it. Each attack expends one piece of ammunition. You can recover half your expended ammunition by taking a minute to search the battlefield.',
  'Cleave':     'If you hit a creature with a melee attack using this weapon, you can make one extra melee attack against a second creature within 5 feet of the first that is also within your reach. On this extra attack, use the same ability modifier as the primary attack but don\'t add your ability modifier to the damage roll unless that modifier is negative.',
  'Finesse':    'When making an attack with a Finesse weapon, you use your choice of your Strength or Dexterity modifier for the attack and damage rolls. You must use the same modifier for both rolls.',
  'Graze':      'If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used for the attack roll. This damage is the same type dealt by the weapon and can\'t be increased in any way.',
  'Heavy':      'You have Disadvantage on attack rolls with a Heavy weapon if it\'s a Small or Tiny creature.',
  'Light':      'When you take the Attack action and attack with a Light weapon, you can make one extra attack as a Bonus Action later on the same turn with a different Light weapon. You don\'t add your ability modifier to the extra attack\'s damage roll unless that modifier is negative.',
  'Loading':    'You can fire only one piece of ammunition from a Loading weapon when you use an action, a Bonus Action, or a Reaction to fire it, regardless of the number of attacks you can normally make.',
  'Nick':       'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.',
  'Push':       'If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.',
  'Range':      'A Range weapon can be used to make a ranged attack only if the target is within the weapon\'s normal range, or at Disadvantage if it is within the weapon\'s long range. Targets beyond long range can\'t be attacked.',
  'Reach':      'This weapon adds 5 feet to your reach when you attack with it, as well as when determining your reach for Opportunity Attacks.',
  'Sap':        'If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.',
  'Slow':       'If you hit a creature with this weapon and deal damage to it, you can reduce that creature\'s Speed by 10 feet until the start of your next turn.',
  'Special':    'A Special weapon has an unusual rule that is described in its entry in the weapons table.',
  'Thrown':     'If a weapon has the Thrown property, you can throw the weapon to make a ranged attack, and you can draw that weapon as part of the attack. If the weapon is a melee weapon, use the same ability modifier for the attack and damage rolls that you\'d use for a melee attack with it.',
  'Topple':     'If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.',
  'Two-Handed': 'This weapon requires two hands when you attack with it. This property is relevant only when you attack with the weapon, not when you simply hold it.',
  'Versatile':  'A Versatile weapon can be used with one or two hands. A damage value in parentheses appears with the property — the damage when the weapon is used with two hands to make a melee attack.',
  'Vex':        'If you hit a creature with this weapon and deal damage to it, you have Advantage on your next attack roll against that creature before the end of your next turn.',
};

// Eigenschappen die optioneel extra tekst tussen haakjes krijgen (bijv. "Range (30/120)")
export const PARAMETERIZABLE_PROPS = new Set(['Range', 'Versatile', 'Thrown', 'Ammunition']);

// ── Armor AC berekening ──
// dexMod = null → DM-formule weergave; getal → spelersweergave met echte modifier
function _calcArmorAC(d, dexMod) {
  const type = (d?.armorType || '').toLowerCase();
  const base = parseInt(d?.armorBaseAC);
  if (!type || isNaN(base)) return null;

  if (type === 'shield') {
    return {
      pill: '+' + base + ' AC',
      tooltip: 'Shield: adds +' + base + ' to your Armor Class. You must wield it in one hand to gain this benefit.'
    };
  }

  let cap; // null = unlimited, 0 = none, number = max
  if      (type === 'light')  cap = null;
  else if (type === 'medium') cap = 2;
  else if (type === 'heavy')  cap = 0;
  else { const c = parseInt(d?.armorDexCap); cap = isNaN(c) ? null : c; }

  if (dexMod !== null && dexMod !== undefined) {
    const contrib = (cap === null) ? dexMod : Math.min(dexMod, cap);
    const total   = base + contrib;
    const parts   = [base + ' base'];
    if (cap !== 0) {
      const sign = contrib >= 0 ? '+' + contrib : '' + contrib;
      parts.push(sign + ' Dex' + (cap !== null && dexMod > cap ? ' (max +' + cap + ')' : ''));
    }
    return { pill: 'AC ' + total, tooltip: 'Armor Class: ' + total + ' (' + parts.join(' ') + ').' };
  } else {
    if (cap === 0)    return { pill: 'AC ' + base,        tooltip: 'Armor Class: ' + base + '. Heavy armor — no Dexterity modifier applied.' };
    if (cap === null) return { pill: 'AC ' + base + '+Dex', tooltip: 'Armor Class: ' + base + ' + your full Dexterity modifier.' };
    return { pill: 'AC ' + base + '+Dex', tooltip: 'Armor Class: ' + base + ' + your Dexterity modifier (maximum +' + cap + ').' };
  }
}

// ── Eigendomsstatus voorwerpen (module-level, bijgewerkt via socket) ──
let _ownership = { owners: {}, requests: [], tradeAllowed: true, stapelbaar: new Set(), gedeeld: new Set() };

// ── Subtype-filter per sectie ──
const subtypeFilters = {};

// ── Shop item tooltip ──
let _tooltipEl = null;
function _ensureTooltip() {
  if (_tooltipEl) return _tooltipEl;
  _tooltipEl = document.createElement('div');
  _tooltipEl.id = 'shop-item-tooltip';
  _tooltipEl.className = 'shop-item-tooltip hidden';
  document.body.appendChild(_tooltipEl);
  return _tooltipEl;
}
document.addEventListener('mouseover', (e) => {
  const span = e.target.closest('.shop-item-with-desc');
  if (!span) return;
  const desc = span.dataset.desc;
  if (!desc) return;
  const tip = _ensureTooltip();
  tip.innerHTML = mdToHtml(desc);
  tip.classList.remove('hidden');
});
document.addEventListener('mousemove', (e) => {
  if (!_tooltipEl) return;
  // Verberg tooltip zodra cursor niet meer boven een shop-item hangt
  if (!e.target.closest('.shop-item-with-desc')) {
    _tooltipEl.classList.add('hidden');
    return;
  }
  if (_tooltipEl.classList.contains('hidden')) return;
  const x = Math.min(e.clientX + 12, window.innerWidth - _tooltipEl.offsetWidth - 16);
  const y = e.clientY + 20;
  _tooltipEl.style.left = x + 'px';
  _tooltipEl.style.top = y + 'px';
});

export async function refreshOwnership() {
  try {
    const data = await api.getItemOwnership();
    _ownership.owners      = data.owners      || {};
    _ownership.requests    = data.requests    || [];
    _ownership.tradeAllowed = data.tradeAllowed !== false;
    _ownership.stapelbaar  = new Set(data.stapelbaar || []);
    _ownership.gedeeld     = new Set(data.gedeeld    || []);
  } catch { /* ok */ }
}

export function setOwnership(data) {
  if (data.owners      !== undefined) _ownership.owners      = data.owners;
  if (data.requests    !== undefined) _ownership.requests    = data.requests;
  if (data.tradeAllowed !== undefined) _ownership.tradeAllowed = data.tradeAllowed;
  if (data.stapelbaar  !== undefined) _ownership.stapelbaar  = new Set(data.stapelbaar || []);
  if (data.gedeeld     !== undefined) _ownership.gedeeld     = new Set(data.gedeeld    || []);
}
// Expose op window zodat socket-client.js altijd de correcte module-instantie gebruikt
window._setOwnership = setOwnership;
const TYPE_META = {
  personages:   { icon: '\ud83d\udc64', get svgIcon() { return icon('user'); },                    label: 'Personages',   nieuw: 'Nieuw personage',    bewerk: 'Personage bewerken',   color: 'green-wax', chip: 'chip-npc' },
  locaties:     { icon: '\ud83c\udff0', get svgIcon() { return icon('castle', {cls:'icon-gi'}); }, label: 'Locaties',     nieuw: 'Nieuwe locatie',     bewerk: 'Locatie bewerken',     color: 'blue-ink',  chip: 'chip-loc' },
  organisaties: { icon: '\ud83c\udfdb\ufe0f', get svgIcon() { return icon('landmark'); },         label: 'Organisaties', nieuw: 'Nieuwe organisatie', bewerk: 'Organisatie bewerken', color: 'seal',      chip: 'chip-org' },
  voorwerpen:   { icon: '🎺',              get svgIcon() { return icon('package'); },                label: 'Voorwerpen',   nieuw: 'Nieuw voorwerp',     bewerk: 'Voorwerp bewerken',    color: 'orange',    chip: 'chip-item' },
};

// ── Locatietypes ────────────────────────────────────────────────────────────
// Gegroepeerd in plaats van alleen langer: een platte lijst van dertig regels
// zoekt niet. De waarden zijn de sleutels die in de data staan — die veranderen
// nooit, ook niet als het label anders komt te luiden ('Fort' → 'Fort of
// kasteel'). Wat hier ontbrak bleek uit de kaartjes die op 'Overig' stonden:
// een continent (Isfār), landstreken (Donderhei, Wrakland), een mijn
// (Evermijn), een park (Ter Velde) en een schuilplek (Dreghaven).
const LOC_TYPE_GROEPEN = [
  // Deze drie staan hier én bij Gebouw, met dezelfde waarde. Bewust dubbel: het
  // type zegt wat voor pand het is, niet dat het aan een dienst hangt. Een
  // campagne kan drie herbergen hebben waarvan er één de dienst is, en dan hoort
  // "Herberg" gewoon bij de gebouwen te staan.
  { groep: 'Kan aan een dienst hangen', opties: [
    { value: 'Winkel',  label: 'Winkel' },
    { value: 'Herberg', label: 'Herberg' },
    { value: 'Tempel',  label: 'Tempel' },
  ]},
  { groep: 'Gebied', opties: [
    { value: 'Rijk',      label: 'Rijk of continent' },
    { value: 'Streek',    label: 'Streek' },
    { value: 'Stad',      label: 'Stad' },
    { value: 'Dorp',      label: 'Dorp' },
    { value: 'Stadswijk', label: 'Stadswijk' },
  ]},
  { groep: 'Gebouw', opties: [
    { value: 'Gebouw',     label: 'Gebouw' },
    { value: 'Herberg',    label: 'Herberg' },
    { value: 'Taveerne',   label: 'Taveerne' },
    { value: 'Winkel',     label: 'Winkel' },
    { value: 'Tempel',     label: 'Tempel' },
    { value: 'Fort',       label: 'Fort of kasteel' },
    { value: 'Academie',   label: 'Academie' },
    { value: 'Ziekenhuis', label: 'Ziekenhuis' },
    { value: 'Werkplaats', label: 'Werkplaats' },
    { value: 'Gevangenis', label: 'Gevangenis' },
    { value: 'Kamer',      label: 'Kamer' },
  ]},
  { groep: 'Landschap', opties: [
    { value: 'Woud',    label: 'Woud' },
    { value: 'Berg',    label: 'Berg' },
    { value: 'Zee',     label: 'Zee' },
    { value: 'Rivier',  label: 'Rivier of meer' },
    { value: 'Moeras',  label: 'Moeras' },
    { value: 'Vlakte',  label: 'Vlakte' },
    { value: 'Eiland',  label: 'Eiland' },
    { value: 'Grot',    label: 'Grot of mijn' },
    { value: 'Ruine',   label: 'Ruïne' },
  ]},
  { groep: 'Overig', opties: [
    { value: 'Schip',        label: 'Schip' },
    { value: 'Schuilplaats', label: 'Schuilplaats' },
    { value: 'Plein',        label: 'Plein of park' },
    { value: 'Overig',       label: 'Overig' },
  ]},
];

const SCHEMA = {
  personages: {
    // Vier subtypes: wát voor kaartje is dit. Verkoper en antagonist zijn geen
    // soorten maar rollen — die staan in data.tags. Summon, rijdier en familiar
    // vallen onder 'dier'.
    subtypes: ['NPC', 'speler', 'dier', 'god'],
    fields: [
      // De sleutels blijven zoals ze zijn (daar hangt opgeslagen data aan); alleen
      // de labels zeggen nu wat het veld ís. 'rol' was zo vaag dat het van alles
      // werd, 'persoonlijkheid' gaat in de praktijk over hoe jíj hem speelt.
      { key: 'soortLabel', label: 'Ras', type: 'text', alleenBij: ['dier'], hint: 'Hond' },
      { key: 'rol', label: 'Korte omschrijving', type: 'text' },
      // Origin en Class zeggen niets over een god; domein en symbool wel.
      // Een god heeft geen volk of klasse, een dier evenmin — dat is bij hem het
      // ras, en dat staat bij de adoptie-instellingen.
      { key: 'ras', label: 'Origin', type: 'lijst', lijst: 'volken', nietBij: ['god', 'dier'] },
      { key: 'klasse', label: 'Class', type: 'lijst', lijst: 'klassen', nietBij: ['god', 'dier'] },
      // De grijze voorbeeldtekst zegt genoeg; een uitleg erboven is dubbelop.
      { key: 'domein', label: 'Domein', type: 'text', alleenBij: ['god'], hint: 'Kennis en uitvinding' },
      { key: 'symbool', label: 'Heilig symbool', type: 'text', alleenBij: ['god'], hint: 'Een purperen waterrad' },
      { key: 'alignment', label: 'Alignment', type: 'lijst', lijst: 'alignments' },
      { key: 'tags', label: 'Rollen', type: 'rollen' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'flavours', label: 'Flavour teksten', type: 'lijst-tekst', enkelvoud: 'flavour' },
      { key: 'geheimen', label: 'Geheimen', type: 'lijst-tekst', enkelvoud: 'geheim' },
      { key: 'persoonlijkheid', label: 'Aantekeningen voor de DM', type: 'textarea', dmOnly: true },
    ],
  },
  locaties: {
    fields: [
      // De opgeslagen waarden blijven staan; alleen de labels en de indeling
      // veranderen, zodat geen enkel bestaand kaartje zijn type kwijtraakt.
      // De eerste groep is meteen de markering uit vraag 2: dít zijn de types
      // die verderop een eigen tabblad of een dienstkoppeling krijgen.
      { key: 'locType', label: 'Type', type: 'select', optionGroups: LOC_TYPE_GROEPEN },
      // 'wijk' heet nu Gebied: het veld werd allang gebruikt voor een land, een
      // streek of een bovenliggend gebouw ("Hogwarts, tweede verdieping"). De
      // sleutel blijft `wijk` — daar hangt de sortering en de zoekindex aan.
      { key: 'wijk', label: 'Gebied', type: 'entiteit', doel: ['locaties'],
        hint: 'De stad, streek of het gebouw waar dit in ligt' },
      { key: 'betrokkenen', label: 'Wie hoort hier bij?', type: 'betrokkenen' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'flavours', label: 'Flavour teksten', type: 'lijst-tekst', enkelvoud: 'flavour' },
      { key: 'geheimen', label: 'Geheimen', type: 'lijst-tekst', enkelvoud: 'geheim' },
    ],
  },
  organisaties: {
    fields: [
      { key: 'orgType', label: 'Type', type: 'select', options: ['Gilde','Factie','Religieus','Politiek','Crimineel','Militair','Overig'] },
      { key: 'motto', label: 'Motto', type: 'text' },
      // Zelfde koppelingen als bij een locatie: waar ze zitten en wie erbij hoort.
      { key: 'wijk', label: 'Gebied', type: 'entiteit', doel: ['locaties'],
        hint: 'De stad, streek of het gebouw waar dit in zit' },
      { key: 'betrokkenen', label: 'Wie hoort hier bij?', type: 'betrokkenen' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'flavour', label: 'Flavour tekst', type: 'textarea' },
    ],
  },
  voorwerpen: {
    fields: [
      { key: 'itemType', label: 'Type', type: 'select', options: ['Weapon','Magic Item','Potion','Armor','Shield','Scroll','Ring','Amulet','Consumable','Wondrous item','Musical instrument','Feature','Blessing','Boon','Other'] },
      { key: 'rariteit', label: 'Rarity', type: 'select', options: ['Common','Uncommon','Rare','Very Rare','Legendary'] },
      { key: 'prijs', label: 'Prijs', type: 'text' },
      { key: 'nietVerkoopbaar', label: 'Niet verkoopbaar (winkels kopen dit niet in)', type: 'checkbox' },
      { key: 'attunement', label: 'Requires attunement', type: 'checkbox' },
      { key: 'gebruik', label: 'Gebruik', type: 'select', options: [
        { value: 'uniek',      label: 'Uniek — één speler heeft het voorwerp' },
        { value: 'gedeeld',    label: 'Gedeeld — meerdere spelers, elk 1 exemplaar' },
        { value: 'stapelbaar', label: 'Stapelbaar — meerdere spelers, meerdere exemplaren' },
      ]},
      { key: '_chargesToggle', label: 'Heeft charges', type: 'reveal-toggle' },
      { key: 'maxCharges', label: 'Max. charges', type: 'text', inReveal: '_chargesToggle' },
      { key: 'rechargeOn', label: 'Herlaadt bij', type: 'select', inReveal: '_chargesToggle', options: [
        { value: 'longRest',     label: 'Lange rust' },
        { value: 'shortRest',    label: 'Korte rust' },
        { value: 'dawn',         label: 'Dageraad' },
        { value: 'longRestRoll', label: 'Lange rust (dobbelrol)' },
      ]},
      { key: 'rechargeRoll', label: 'Dobbelformule (bijv. 1d3)', type: 'text', inReveal: '_chargesToggle' },
      { key: 'playerMaxAdjustable', label: 'Max. door spelers in te stellen', type: 'checkbox', inReveal: '_chargesToggle' },
      { key: 'godNaam', label: 'God', type: 'text', showFor: ['Blessing'] },
      { key: 'goddelijkType', label: 'Soort', type: 'select', showFor: ['Blessing'], options: [
        { value: 'zegen', label: 'Zegening' },
        { value: 'eed',   label: 'Eed' },
        { value: 'vloek', label: 'Vloek' },
      ]},
      { key: 'effect', label: 'Effect (eedtitel of vloek-mechaniek — niet voor zegen)', type: 'textarea', showFor: ['Blessing'] },
      { key: 'permanenteZegen', label: 'Permanente zegen (alleen op de eed-kaart)', type: 'text', showFor: ['Blessing'] },
      { key: 'eedTekst', label: 'Eedtekst (volledige belofte, op de eed-kaart)', type: 'textarea', showFor: ['Blessing'] },
      { key: 'damage', label: 'Schade / Genezing (bijv. 1d8+1 Slashing)', type: 'text', showFor: ['Weapon', 'Wapen'] },
      { key: 'weaponProperties', label: 'Wapeneigenschappen', type: 'weapon-tags', showFor: ['Weapon', 'Wapen'] },
      { key: 'armorType', label: 'Harnas type', type: 'select', showFor: ['Armor', 'Shield'], options: [
        { value: 'light',  label: 'Light — volledig Dex' },
        { value: 'medium', label: 'Medium — Dex max +2' },
        { value: 'heavy',  label: 'Heavy — geen Dex' },
        { value: 'shield', label: 'Shield — bonus op bestaande AC' },
        { value: 'other',  label: 'Other — zie Dex cap' },
      ]},
      { key: 'armorBaseAC', label: 'Base AC (of bonus voor Shield)', type: 'text', showFor: ['Armor', 'Shield'] },
      { key: 'armorDexCap', label: 'Dex cap (alleen bij Other)', type: 'text', showFor: ['Armor', 'Shield'] },
      { key: 'stealthDisadvantage', label: 'Stealth Disadvantage', type: 'checkbox', showFor: ['Armor', 'Shield'] },
      { key: 'strengthRequirement', label: 'Strength Requirement', type: 'text', showFor: ['Armor', 'Shield'] },
      { key: 'spellPick', label: 'Spell kiezen — vult de velden hieronder + de omschrijving', type: 'spell-picker', showFor: ['Scroll'] },
      { key: 'spellCastingTime', label: 'Casting Time', type: 'text', showFor: ['Scroll'] },
      { key: 'spellRange',       label: 'Range',         type: 'text', showFor: ['Scroll'] },
      { key: 'spellComponents',  label: 'Components',    type: 'text', showFor: ['Scroll'] },
      { key: 'spellDuration',    label: 'Duration',      type: 'text', showFor: ['Scroll'] },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'flavour', label: 'Flavour tekst', type: 'textarea' },
    ],
  },
};

const LINK_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen', 'archief'];
const LINK_LABELS = { personages: 'Personages', locaties: 'Locaties', organisaties: 'Organisaties', voorwerpen: 'Voorwerpen', archief: 'Documenten' };

// ── Auto-icons per subtype / type-field (lazy SVG, avoids module-init timing issue) ──
let _autoIconsCache = null;
function _getAutoIconMap(type) {
  if (!_autoIconsCache) {
    _autoIconsCache = {
      personages: {
        'NPC':        icon('users'),
        'speler':     icon('swords'),
        'antagonist': icon('skull'),
        'god':        icon('sparkles'),
        'dier':       icon('paw-print'),
        'verkoper':   icon('building'),
      },
      locaties: {
        'Stadswijk':  icon('map'),
        'Gebouw':     icon('landmark'),
        'Herberg':    icon('beer'),
        'Taveerne':   icon('beer'),
        'Tempel':     icon('church'),
        'Winkel':     icon('building'),
        'Fort':       icon('castle', { cls: 'icon-gi' }),
        'Schip':      icon('globe'),
        'Dorp':       icon('house'),
        'Stad':       icon('map'),
        'Woud':       icon('tree-pine'),
        'Berg':       icon('mountain'),
        'Zee':        icon('waves'),
        'Rijk':       icon('globe'),
        'Streek':     icon('map'),
        'Academie':   icon('book-open'),
        'Ziekenhuis': icon('heart'),
        'Werkplaats': icon('package'),
        'Gevangenis': icon('lock'),
        'Kamer':      icon('square'),
        'Rivier':     icon('droplet'),
        'Moeras':     icon('droplet'),
        'Vlakte':     icon('wind'),
        'Eiland':     icon('globe'),
        'Grot':       icon('mountain'),
        'Ruine':      icon('brick-wall'),
        'Schuilplaats': icon('eye-off'),
        'Plein':      icon('tree-pine'),
        'Overig':     icon('map-pin'),
      },
      organisaties: {
        'Gilde':      icon('swords'),
        'Factie':     icon('swords'),
        'Religieus':  icon('sparkles'),
        'Politiek':   icon('landmark'),
        'Crimineel':  icon('stiletto', { cls: 'icon-gi' }),
        'Militair':   icon('shield'),
        'Overig':     icon('landmark'),
      },
      voorwerpen: {
        'Weapon':     icon('sword'),    'Wapen':      icon('sword'),
        'Magic Item': icon('sparkles'), 'Toveritem':  icon('sparkles'),
        'Blessing': icon('sparkles'),
        'Potion':     icon('flask-conical'), 'Drank':  icon('flask-conical'),
        'Armor':      icon('shield'),   'Uitrusting': icon('shield'),
        'Shield':     icon('shield'),
        'Scroll':     icon('scroll-text'),
        'Ring':       icon('sparkles'),
        'Amulet':     icon('stiletto', { cls: 'icon-gi' }),
        'Other':      icon('package'),  'Overig':     icon('package'),
        'Feature':    icon('star'),
        'Consumable': icon('flask-conical'), 'Wondrous': icon('flask-conical'),
      },
    };
  }
  return _autoIconsCache[type] || {};
}

const _NL_ITEM_TYPE = {
  'Wapen': 'Weapon', 'Toveritem': 'Magic Item', 'Drank': 'Potion',
  'Uitrusting': 'Armor', 'Overig': 'Other',
};
function _normItemType(v) { return _NL_ITEM_TYPE[v] || v; }

function getAutoIconSvg(type, e) {
  if (e.data?.icon) return e.data.icon;
  const map = _getAutoIconMap(type);
  const key =
    e.subtype ||
    e.data?.locType ||
    e.data?.orgType ||
    e.data?.itemType ||
    '';
  return map[key] || TYPE_META[type].svgIcon;
}

// Alle badges van een kaartje. Rollen zijn sinds kort meervoudig — een verkoper
// kán ook antagonist zijn — dus geeft dit een lijst terug in plaats van de ene
// die toevallig wint. Zonder rol valt hij terug op het subtype.
function getCardBadges(type, e) {
  if (type !== 'personages') {
    const b = getSubtypeBadge(type, e);
    return b ? [b] : [];
  }
  const rollen = [];
  if (window._heeftRol?.(e, 'antagonist')) rollen.push({ label: 'Antagonist', cls: 'badge-antagonist' });
  if (window._heeftRol?.(e, 'verkoper'))   rollen.push({ label: 'Verkoper',   cls: 'badge-verkoper' });
  if (rollen.length) return rollen;
  const b = getSubtypeBadge(type, e);
  return b ? [b] : [];
}

function getSubtypeBadge(type, e) {
  if (type === 'personages') {
    // Een rol zegt meer dan het subtype: "Antagonist" is interessanter dan
    // "NPC", en een verkoper herken je liever meteen.
    if (window._heeftRol?.(e, 'antagonist')) return { label: 'Antagonist', cls: 'badge-antagonist' };
    if (window._heeftRol?.(e, 'verkoper'))   return { label: 'Verkoper',   cls: 'badge-verkoper' };
    const sub = e.subtype || '';
    if (!sub) return null;
    const labels = { NPC: 'NPC', speler: 'Speler', antagonist: 'Antagonist', god: 'God', godheid: 'God', dier: 'Dier', monster: 'Monster', verkoper: 'Verkoper' };
    const cls = sub === 'godheid' ? 'badge-god' : 'badge-' + sub.toLowerCase();
    return { label: labels[sub] || sub, cls };
  }
  if (type === 'locaties') {
    const w = e.data?.wijk;
    return w ? { label: w, cls: 'badge-loc' } : null;
  }
  if (type === 'organisaties') {
    const t = e.data?.orgType;
    return t ? { label: t, cls: 'badge-org' } : null;
  }
  if (type === 'voorwerpen') {
    const t = e.data?.itemType;
    if (!t) return null;
    // Zegeningen & Gunsten: duidelijk onderscheiden — blessing per soort, boon apart.
    if (t === 'Blessing') {
      const g = e.data?.goddelijkType || 'zegen';
      const gl = { zegen: 'Zegening', eed: 'Eed', vloek: 'Vloek' };
      return { label: gl[g] || 'Zegening', cls: 'badge-goddelijk badge-goddelijk--' + g };
    }
    if (t === 'Boon') return { label: 'Boon', cls: 'badge-boon' };
    const clsMap = {
      'Weapon':     'badge-item-weapon',
      'Armor':      'badge-item-armor',
      'Potion':     'badge-item-potion',
      'Magic Item': 'badge-item-magic',
      'Scroll':     'badge-item-scroll',
      'Ring':       'badge-item-ring',
      'Amulet':     'badge-item-amulet',
      'Other':      'badge-item-other',
    };
    return { label: t, cls: clsMap[t] || 'badge-item-other' };
  }
  return null;
}

const searchQueries = { personages: '', locaties: '', organisaties: '', voorwerpen: '' };
let entities = {};
let editorTags = {};
let pendingAudioFile = null;
let _editorOldAudioId = null;
let entityEditorImages = [];
let entityEditorImagesToDelete = [];

// ── Audio playback singleton ──
let _audioEl = null;
let _currentAudioId = null;

function _updateAudioBtns(activeId, playing) {
  document.querySelectorAll('[data-audio-btn]').forEach(btn => {
    const isActive = btn.dataset.audioBtnId === activeId;
    btn.textContent = isActive && playing ? '⏸' : '▶';
    btn.classList.toggle('audio-btn-playing', isActive && playing);
  });
}

window._audioToggle = (audioId) => {
  const url = api.fileUrl(audioId);
  if (_audioEl && _currentAudioId === audioId) {
    if (_audioEl.paused) { _audioEl.play(); _updateAudioBtns(audioId, true); }
    else                 { _audioEl.pause(); _updateAudioBtns(audioId, false); }
    return;
  }
  if (_audioEl) { _audioEl.pause(); _audioEl = null; }
  _currentAudioId = audioId;
  _audioEl = new Audio(url);
  _audioEl.play().catch(() => {});
  _audioEl.onended = () => { _currentAudioId = null; _updateAudioBtns(null, false); };
  _audioEl.onerror = () => { _currentAudioId = null; _updateAudioBtns(null, false); };
  _updateAudioBtns(audioId, true);
};

window._stopAudio = () => {
  if (_audioEl) { _audioEl.pause(); _audioEl = null; }
  _currentAudioId = null;
  _updateAudioBtns(null, false);
};

// ── Audio upload helpers ──
window._uploadAudio = async (tab, entityId, oldAudioId, file) => {
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) { alert('Max 30MB'); return; }
  const audioId = 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  await api.uploadFile(audioId, file);
  if (oldAudioId) await api.deleteFile(oldAudioId).catch(() => {});
  const entity = await api.getEntity(tab, entityId);
  await api.updateEntity(tab, entityId, { ...entity, data: { ...entity.data, audioId } });
  window._openDetail(tab, entityId);
};

window._deleteAudio = async (tab, entityId, audioId) => {
  if (!confirm('Geluidsfragment verwijderen?')) return;
  window._stopAudio();
  await api.deleteFile(audioId).catch(() => {});
  const entity = await api.getEntity(tab, entityId);
  await api.updateEntity(tab, entityId, { ...entity, data: { ...entity.data, audioId: '' } });
  window._openDetail(tab, entityId);
};

window._editorAudioSelected = (file) => {
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) { alert('Max 30MB'); return; }
  const idInput = document.getElementById('editor-audio-id');
  if (idInput && !idInput.value) {
    idInput.value = 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }
  pendingAudioFile = file;
  const label = document.getElementById('editor-audio-name');
  if (label) { label.textContent = file.name; label.classList.remove('hidden'); }
};

window._editorClearAudio = () => {
  pendingAudioFile = null;
  const idInput = document.getElementById('editor-audio-id');
  if (idInput) idInput.value = '';
  const label = document.getElementById('editor-audio-name');
  if (label) { label.textContent = 'Audio wordt verwijderd bij opslaan'; label.classList.remove('hidden'); }
  document.getElementById('editor-audio-preview')?.classList.add('hidden');
};

// Lazy proxies — window.app isn't set yet when ES modules evaluate
const $ = (...a) => window.app.$(...a);
const $$ = (...a) => window.app.$$(...a);
const isDM = () => window.app.isDM();
const esc = (...a) => window.app.esc(...a);
const escJS = (...a) => window.app.escJS(...a);
const mdToHtml = (...a) => window.app.mdToHtml(...a);
const openModal = (...a) => window.app.openModal(...a);
const closeModal = (...a) => window.app.closeModal(...a);
const openLightbox = (...a) => window.app.openLightbox(...a);

// ── Modal navigatie-history ──
const _modalHistory = window._modalHistory = [];   // stack van { tab, id } — ook toegankelijk vanuit render-archief.js

function _pushHistory(tab, id) {
  _modalHistory.push({ tab, id });
  _updateBackButton();
}

function _clearHistory() {
  _modalHistory.length = 0;
  _updateBackButton();
}

function _updateBackButton() {
  const btn = document.getElementById('m-back');
  if (btn) btn.classList.toggle('hidden', _modalHistory.length === 0);
}

window._modalGoBack = async () => {
  const prev = _modalHistory.pop();
  if (!prev) return;
  _updateBackButton();
  if (prev.type === 'archief') {
    window._openDoc?.(prev.id);
  } else if (prev.type === 'sessie') {
    window._openSessieDetail?.(prev.id);
  } else {
    await window._openDetail(prev.tab, prev.id, true /* isBack */);
  }
};

window._clearHistory = _clearHistory;

// Kleine B/I toolbar boven een textarea
// Dezelfde opmaakbalk als bij de aktes en de helpteksten: vet, cursief,
// onderstreept, doorhalen, markeren, kleur en een scheidingslijn. Hij stond hier
// op alleen vet en cursief, terwijl `mdToHtml` de rest allang aankan.
function fmtToolbar(id) {
  const hex = window._FMT_KLEUR_HEX || {};
  return `<div class="fmt-toolbar">
    <button type="button" class="fmt-btn fmt-btn-b" title="Vet (Ctrl+B)" onclick="window._fmt('${id}','**')">B</button>
    <button type="button" class="fmt-btn fmt-btn-i" title="Cursief (Ctrl+I)" onclick="window._fmt('${id}','*')">I</button>
    <button type="button" class="fmt-btn fmt-btn-u" title="Onderstreept" onclick="window._fmt('${id}','__')">U</button>
    <button type="button" class="fmt-btn fmt-btn-s" title="Doorhalen" onclick="window._fmt('${id}','~~')">S</button>
    <button type="button" class="fmt-btn fmt-btn-mark" title="Markeren" onclick="window._fmt('${id}','==')">A</button>
    <button type="button" class="fmt-btn fmt-btn-hr" title="Scheidingslijn" onclick="window._fmtHr('${id}')">—</button>
    <div class="fmt-toolbar-sep"></div>
    <div class="fmt-kleuren">
      ${Object.entries(hex).map(([naam, kleur]) =>
        `<button type="button" class="fmt-kleur-knop" style="--k:${kleur}" title="${naam}"
          onclick="window._fmtKleur('${id}','${naam}')"></button>`).join('')}
    </div>
  </div>`;
}

// Een ability score zegt weinig zonder zijn modifier; die rekent iedereen toch
// in zijn hoofd uit. 10 en 11 geven +0, elke twee punten daarboven of daaronder
// één stap.
function _abilityMod(waarde) {
  const n = parseInt(String(waarde ?? '').match(/-?\d+/)?.[0] ?? '', 10);
  if (Number.isNaN(n)) return '';
  const mod = Math.floor((n - 10) / 2);
  return mod >= 0 ? `+${mod}` : String(mod);
}
window._sbModUpdate = (spanId, waarde) => {
  const el = document.getElementById(spanId);
  if (el) el.textContent = _abilityMod(waarde);
};

// ── Statblokvelden: één bron voor het blad én voor elk tier ──────────────────
// Beide vroegen om dezelfde velden maar stonden in twee stukken HTML, en dus
// liepen ze uit elkaar: op een tier stond Hit Dice waar het blad Prof. Bonus
// heeft, de ability-modifiers werden niet uitgerekend en de Actions misten hun
// opmaakbalk. De volgorde en de labels staan nu hier; `h` levert alleen de
// bouwstenen — het blad schrijft `name="stat_…"`, een tier `class="pt-…"`.
const _SB_SIZES = ['Tiny','Small','Medium','Large','Huge','Gargantuan'];
const _SB_TYPES = ['Aberration','Beast','Celestial','Construct','Dragon','Elemental','Fey','Fiend',
                   'Giant','Humanoid','Monstrosity','Ooze','Plant','Undead'];
// De sleutels die een statblok kent, in de volgorde waarin ze hieronder staan.
// `_petTiersCollect` leest hiermee een tier terug uit het DOM.
const _SB_TEKSTVELDEN = ['size','creatureType','ac','hp','initiative','speed','cr','xp','profBonus',
  'savingThrows','skills','gear','vulnerabilities','resistances','immunities','conditionImmunities',
  'senses','languages','traits','actions','bonusActions','reactions','legendaryActions','lairActions'];
const _SB_ABILITIES = ['str','dex','con','int','wis','cha'];

function _sbCombatHtml(h) {
  return `
    <div class="grid grid-cols-2 gap-2">
      ${h.sel('size', 'Size', _SB_SIZES)}
      ${h.sel('creatureType', 'Creature Type', _SB_TYPES)}
    </div>
    <div class="grid grid-cols-4 gap-2">
      ${h.inp('ac', 'AC', { center: true })}
      ${h.inp('hp', 'HP', { center: true, ph: '32 (5d8+10)' })}
      ${h.inp('initiative', 'Initiative', { center: true })}
      ${h.inp('speed', 'Speed', { center: true, ph: '40 ft.' })}
    </div>
    <div class="grid grid-cols-3 gap-2">
      ${h.inp('cr', 'Challenge Rating', { center: true })}
      ${h.inp('xp', 'XP', { center: true })}
      ${h.inp('profBonus', 'Prof. Bonus', { center: true })}
    </div>
    <div class="cs-sectiekop">Ability Scores</div>
    <div class="grid grid-cols-3 gap-2">
      ${_SB_ABILITIES.map(k => h.abil(k)).join('')}
    </div>
    <div class="cs-sectiekop">Proficiencies &amp; Defenses</div>
    <div class="space-y-2">
      ${h.inp('savingThrows', 'Saving Throws')}
      ${h.inp('skills', 'Skills', { ph: 'Perception +4' })}
      ${h.ta('gear', 'Gear', 2)}
      ${h.inp('vulnerabilities', 'Damage Vulnerabilities')}
      ${h.inp('resistances', 'Damage Resistances')}
      ${h.inp('immunities', 'Damage Immunities')}
      ${h.inp('conditionImmunities', 'Condition Immunities')}
    </div>
    <div class="cs-sectiekop">Senses &amp; Languages</div>
    <div class="space-y-2">
      ${h.inp('senses', 'Senses', { ph: 'Passive Perception 14' })}
      ${h.inp('languages', 'Languages')}
    </div>
    <!-- Traits horen bij het statblok en niet bij Actions: het zijn passieve
         eigenschappen, geen dingen die je op je beurt doet. -->
    <div class="cs-sectiekop">Traits</div>
    ${h.ta('traits', '', 3)}`;
}

function _sbActiesHtml(h) {
  return `
    ${h.ta('actions', 'Actions', 4)}
    ${h.ta('bonusActions', 'Bonus Actions', 2)}
    ${h.ta('reactions', 'Reactions', 2)}
    ${h.ta('legendaryActions', 'Legendary/Mythic Actions', 3)}
    ${h.ta('lairActions', 'Lair Actions', 2)}`;
}

// Bouwstenen voor één tier: dezelfde velden, maar herkenbaar aan een class in
// plaats van een name (een tier zit niet in het <form> van het kaartje).
function _sbTierBouwstenen(sb, i) {
  const veldCls = 'w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none';
  const kop = (label) => label ? `<label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>` : '';
  return {
    inp: (k, label, o = {}) => `
      <div>${kop(label)}
        <input class="pt-${k} ${veldCls}${o.center ? ' text-center' : ''}" value="${esc(sb[k] ?? '')}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>
      </div>`,
    sel: (k, label, opties) => `
      <div>${kop(label)}
        <select class="pt-${k} ${veldCls}">
          <option value="">—</option>
          ${opties.map(o => `<option value="${esc(o)}"${(sb[k] || '') === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}
        </select>
      </div>`,
    ta: (k, label, rows) => {
      const id = `pt${i}-ta-${k}`;
      return `<div>${kop(label)}
        <div class="mt-0.5">
          ${fmtToolbar(id)}
          <textarea id="${id}" class="pt-${k} ${veldCls}" rows="${rows}" onkeydown="window._fmtKey(event)">${esc(sb[k] || '')}</textarea>
        </div>
      </div>`;
    },
    abil: (k) => {
      const modId = `pt${i}-mod-${k}`;
      return `<div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">${k.toUpperCase()}
          <span class="cs-mod" id="${modId}">${_abilityMod(sb[k])}</span></label>
        <input class="pt-${k} ${veldCls} text-center" value="${esc(sb[k] ?? '')}" inputmode="numeric"
          oninput="window._sbModUpdate('${modId}', this.value)">
      </div>`;
    },
  };
}

// Geheimen en flavour zijn lijsten geworden. Wat er al stond (één tekstveld)
// blijft de eerste regel; zo raakt niemand iets kwijt.
function _tekstLijstUit(data, meervoud, enkelvoud) {
  const rauw = data?.[meervoud];
  if (rauw) {
    try {
      const arr = typeof rauw === 'string' ? JSON.parse(rauw) : rauw;
      if (Array.isArray(arr)) return arr.map(v => String(v ?? '')).filter(v => v.trim());
    } catch { /* val terug */ }
  }
  const los = String(data?.[enkelvoud] ?? '').trim();
  return los ? [los] : [];
}
window._tekstLijstUit = _tekstLijstUit;

// Welke geheimen maken hem antagonist? Array van booleans naast `geheimen`.
// Het oude enkelvoudige `geheimeAntagonist` gold voor het hele kaartje; die
// vertalen we naar "elk geheim", zodat bestaande kaartjes zich niet anders
// gaan gedragen.
function _antagUit(data, aantal) {
  let arr = [];
  try { const j = JSON.parse(data?.geheimenAntagonist || '[]'); if (Array.isArray(j)) arr = j.map(Boolean); } catch {}
  if (!arr.length && (data?.geheimeAntagonist === true || data?.geheimeAntagonist === 'true')) {
    arr = Array(aantal).fill(true);
  }
  return Array.from({ length: aantal }, (_, i) => !!arr[i]);
}
window._antagUit = _antagUit;

// Eén regel in de editor: tekstvak met opmaakbalk en een prullenbak.
// Opties van een select: een platte lijst, of groepen (optionGroups). Een
// waarde die in geen enkele groep meer voorkomt krijgt zijn eigen regel, zodat
// opslaan hem niet stilletjes leegmaakt — daar zou een oud kaartje op stuklopen.
function _optieHtml(o, val, alGekozen) {
  const v = typeof o === 'object' ? o.value : o;
  const l = typeof o === 'object' ? o.label : o;
  // Een waarde mag in twee groepen staan (Herberg hoort bij de diensten én bij
  // de gebouwen). Alleen de eerste krijgt `selected`; met twee gemarkeerde
  // opties wint in HTML de laatste, en dan lijkt de keuze verschoven.
  const kies = val === v && !alGekozen.has(v);
  if (kies) alGekozen.add(v);
  return `<option value="${esc(v)}"${kies ? ' selected' : ''}>${esc(l)}</option>`;
}
function _optiesHtml(field, val) {
  const gekozen = new Set();
  if (!field.optionGroups) return (field.options || []).map(o => _optieHtml(o, val, gekozen)).join('');
  const bekend = field.optionGroups.some(g => g.opties.some(o => (typeof o === 'object' ? o.value : o) === val));
  return field.optionGroups.map(g =>
    `<optgroup label="${esc(g.groep)}">${g.opties.map(o => _optieHtml(o, val, gekozen)).join('')}</optgroup>`
  ).join('') + ((val && !bekend) ? `<optgroup label="Nog uit een oudere lijst">${_optieHtml(val, val, gekozen)}</optgroup>` : '');
}

// ── Koppelvelden: een kaartje aanwijzen in plaats van overtypen ─────────────
// Een eigenaar, een gebied of een stamgast is bijna altijd al een kaartje. De
// vrije tekst blijft staan (daar hangt de zoekindex en de export aan) en de
// koppeling komt er als extra veld naast: `<key>` houdt de naam, `<key>Id` het
// kaartje. Zo raakt een campagne die nooit koppelt niets kwijt, en wie wél
// koppelt kan doorklikken.
let _linkLijsten = { personages: [], locaties: [], organisaties: [] };
let _linkGeladen = null;

function _linkLaden() {
  // Eén keer per editor-sessie; de datalists worden daarna gevuld.
  _linkGeladen = Promise.all(['personages', 'locaties', 'organisaties'].map(t =>
    api.listEntities(t).then(r => [t, (r || []).map(x => ({ id: x.id, name: x.name }))]).catch(() => [t, []])
  )).then(paren => {
    paren.forEach(([t, lijst]) => { _linkLijsten[t] = lijst; });
    _linkDatalistsVullen();
    return _linkLijsten;
  });
  return _linkGeladen;
}

function _linkOpties(doel) {
  return (doel || []).flatMap(t => _linkLijsten[t].map(x => ({ ...x, type: t })));
}

function _linkDatalistsVullen() {
  document.querySelectorAll('datalist[data-link-doel]').forEach(dl => {
    const doel = dl.dataset.linkDoel.split(',');
    // Namen kunnen in twee tabbladen voorkomen; dubbele regels helpen niemand.
    const namen = [...new Set(_linkOpties(doel).map(o => o.name))];
    dl.innerHTML = namen.map(n => `<option value="${esc(n)}">`).join('');
  });
  document.querySelectorAll('[data-link-veld]').forEach(inp => _linkStatus(inp));
}

// Naam → kaartje. Hoofdletterongevoelig, want zo tikt niemand het over.
function _linkZoek(doel, naam) {
  const schoon = (naam || '').trim().toLowerCase();
  if (!schoon) return null;
  return _linkOpties(doel).find(o => o.name.toLowerCase() === schoon) || null;
}

// Het regeltje onder een koppelveld: doorklikken als het kaartje bestaat,
// aanmaken als het er nog niet is. Dat tweede is de vraag uit punt 5: een naam
// mag alvast genoemd worden zonder dat het kaartje er al is.
function _linkStatus(inp) {
  const host = document.getElementById(inp.dataset.linkStatus);
  if (!host) return;
  const doel = inp.dataset.linkDoel.split(',');
  const hidden = document.getElementById(inp.dataset.linkId);
  const naam = (inp.value || '').trim();
  const match = _linkZoek(doel, naam);
  if (hidden) hidden.value = match?.id || '';
  if (!naam) { host.innerHTML = ''; return; }
  if (match) {
    host.innerHTML = `<button type="button" class="link-chip" title="Kaartje openen"
      onclick="window._openDetail('${match.type}','${esc(match.id)}')">${getAutoIconSvg(match.type, {}) || ''}${esc(match.name)}</button>`;
    return;
  }
  host.innerHTML = doel.map(t => `<button type="button" class="dm-btn dm-btn-ghost dm-btn-sm"
      onclick="window._linkKaartjeMaken('${t}', '${esc(inp.id)}')"
      title="Maakt een leeg kaartje met deze naam; invullen kan later">
      ${icon('plus')} Kaartje aanmaken bij ${LINK_LABELS[t] || t}</button>`).join(' ');
}

window._linkVeldWijzig = (inp) => _linkStatus(inp);

// Een betrokkene weet zijn id maar niet zijn tabblad. De naam-index van app.js
// heeft allebei; daar zoeken we het type bij op. Lukt dat niet (index nog niet
// gevuld), dan proberen we personages en organisaties op volgorde.
window._openKaartjeOpId = async (id) => {
  await window._entityIndexReady?.catch(() => {});
  const treffer = Object.values(window._entityNameIndex || {}).find(x => x.id === id);
  if (treffer) return window._openDetail(treffer.type, id);
  for (const t of ['personages', 'organisaties', 'locaties']) {
    const lijst = await api.listEntities(t).catch(() => []);
    if ((lijst || []).some(x => x.id === id)) return window._openDetail(t, id);
  }
  window.app?._tsToast?.(`${icon('x')} Dat kaartje bestaat niet meer`);
};

// ── Betrokkenen: wie hoort er bij dit kaartje ───────────────────────────────
// Rollen zijn suggesties, geen keurslijf: een campagne verzint zijn eigen
// functies en die horen niet op een lijst van ons te wachten.
// Op volgorde van hoe vaak je ze nodig hebt: een organisatie heeft vooral leden,
// een pand vooral een eigenaar en personeel. Wat ontbrak: bewaker, verkoper,
// oprichter, rivaal en bondgenoot. Het is een datalist, dus wie iets anders
// bedenkt tikt het gewoon in.
const BETROKKEN_ROLLEN = ['Eigenaar', 'Lid', 'Personeel', 'Leider', 'Bewoner',
  'Stamgast', 'Bewaker', 'Verkoper', 'Waard', 'Priester', 'Oprichter',
  'Beschermheer', 'Bondgenoot', 'Rivaal', 'Gevangene'];

function _betrokkenenUit(data) {
  const rauw = data?.betrokkenen;
  let rijen = [];
  if (Array.isArray(rauw)) rijen = rauw;
  else if (typeof rauw === 'string' && rauw.trim()) {
    try { const arr = JSON.parse(rauw); if (Array.isArray(arr)) rijen = arr; } catch { /* stuk? dan leeg */ }
  }
  rijen = rijen.filter(r => r && (r.naam || r.id));
  // Wat er al stond als losse tekst wordt de eerste regel. Zo hoeft er niets
  // gemigreerd te worden: het kaartje leest gewoon allebei.
  if (!rijen.length && (data?.eigenaar || '').trim()) {
    rijen = [{ naam: data.eigenaar.trim(), id: data.eigenaarId || '', rol: 'Eigenaar' }];
  }
  return rijen;
}

function _betrokkenRijHtml(r, i) {
  const inId = `betr-naam-${i}`;
  return `<div class="betrokken-rij">
    <input id="${inId}" class="betr-naam" value="${esc(r.naam || '')}" list="betrokken-dl"
      data-link-veld="1" data-link-doel="personages,organisaties" data-link-id="betr-id-${i}"
      data-link-status="betr-st-${i}" oninput="window._linkVeldWijzig(this)"
      placeholder="Naam van een personage of organisatie">
    <input class="betr-rol" value="${esc(r.rol || '')}" list="betrokken-rol-dl" placeholder="Rol">
    <input type="hidden" class="betr-id" id="betr-id-${i}" value="${esc(r.id || '')}">
    <button type="button" class="dm-btn dm-btn-sm dm-btn-ghost dm-btn-danger"
      title="Regel verwijderen" onclick="window._betrokkenWeg(this)">${icon('trash')}</button>
    <div id="betr-st-${i}" class="link-status betrokken-status"></div>
  </div>`;
}

window._betrokkenErbij = () => {
  const host = document.getElementById('betrokkenen-lijst');
  if (!host) return;
  const i = host.querySelectorAll('.betrokken-rij').length + Date.now() % 1000;
  host.insertAdjacentHTML('beforeend', _betrokkenRijHtml({}, i));
  host.querySelector('.betrokken-rij:last-child .betr-naam')?.focus();
  _linkDatalistsVullen();
};

window._betrokkenWeg = (btn) => {
  const rij = btn.closest('.betrokken-rij');
  const host = rij?.parentElement;
  rij?.remove();
  if (host && !host.querySelector('.betrokken-rij')) window._betrokkenErbij();
};

function _betrokkenenLees() {
  return [...document.querySelectorAll('#betrokkenen-lijst .betrokken-rij')].map(rij => ({
    naam: rij.querySelector('.betr-naam')?.value.trim() || '',
    rol:  rij.querySelector('.betr-rol')?.value.trim()  || '',
    id:   rij.querySelector('.betr-id')?.value          || '',
  })).filter(r => r.naam);
}

// ── Koppelingen: herberg, tempel-god, factie, dungeon ───────────────────────
let _koppelCtx = { tab: '', id: '', dungeons: [] };

// De herberg- en tempelkoppeling horen alleen bij díé types; anders staat er een
// keuzelijst die nergens over gaat.
function _koppelLocTypeToon(val) {
  const type = val ?? document.querySelector('select[name="data_locType"]')?.value ?? '';
  const h = document.getElementById('koppel-herberg');
  const t = document.getElementById('koppel-tempel');
  if (h) h.style.display = type === 'Herberg' ? '' : 'none';
  if (t) t.style.display = type === 'Tempel'  ? '' : 'none';
}

function _koppelDungeonVullen() {
  const sel  = document.getElementById('koppel-dungeon');
  const hid  = document.getElementById('koppel-dungeon-id');
  if (!sel) return;
  sel.innerHTML = `<option value="">— geen dungeonkaart —</option>` +
    _koppelCtx.dungeons.map(d => `<option value="${esc(d.id)}"${hid.value === d.id ? ' selected' : ''}>${esc(d.name || d.id)}</option>`).join('');
  _koppelRoomsVullen();
}

function _koppelRoomsVullen() {
  const sel = document.getElementById('koppel-room');
  const dId = document.getElementById('koppel-dungeon-id')?.value || '';
  const rId = document.getElementById('koppel-room-id')?.value || '';
  if (!sel) return;
  const kaart = _koppelCtx.dungeons.find(d => d.id === dId);
  const kamers = kaart?.rooms || [];
  // Zonder kaart (of zonder kamers erop) valt er niets te kiezen; dan is de
  // lijst uitgeschakeld in plaats van misleidend leeg.
  sel.disabled = !kamers.length;
  sel.innerHTML = kamers.length
    ? `<option value="">— hele kaart —</option>` +
      kamers.map(r => `<option value="${esc(r.id)}"${rId === r.id ? ' selected' : ''}>${esc(r.name || r.id)}</option>`).join('')
    : `<option value="">${dId ? 'geen kamers op deze kaart' : '— eerst een kaart —'}</option>`;
}

window._koppelDungeonWissel = () => {
  const sel = document.getElementById('koppel-dungeon');
  document.getElementById('koppel-dungeon-id').value = sel.value;
  // Een kamer uit de vórige kaart slaat nergens op.
  document.getElementById('koppel-room-id').value = '';
  _koppelRoomsVullen();
};

window._koppelRoomWissel = () => {
  document.getElementById('koppel-room-id').value = document.getElementById('koppel-room').value;
};

// Herberg, god en factie liggen in meta.json, niet in het kaartje: die bewaren
// zichzelf meteen, net als het baasje van een huisdier. Wachten op Opslaan zou
// betekenen dat het formulier meta moet meesturen, en dan zijn er twee wegen
// naar dezelfde waarde.
window._koppelZet = async (body) => {
  try {
    const k = await api.zetKoppelingen(_koppelCtx.tab, _koppelCtx.id, body);
    const uitleg = document.getElementById('koppel-herberg-uitleg');
    if (uitleg && body.herberg !== undefined) {
      uitleg.textContent = k.herberg ? 'De herberg-dienst gebruikt dit kaartje.' : '';
    }
    window.app?._tsToast?.(`${icon('check')} Koppeling bewaard`);
  } catch (err) {
    alert('Koppelen mislukt: ' + (err.message || err));
  }
};

window._linkKaartjeMaken = async (type, inputId) => {
  const inp = document.getElementById(inputId);
  const naam = (inp?.value || '').trim();
  if (!naam) return;
  try {
    const nieuw = await api.createEntity(type, { name: naam, data: {} });
    _linkLijsten[type].push({ id: nieuw.id, name: nieuw.name || naam });
    _linkDatalistsVullen();
    window.app?._tsToast?.(`${icon('check')} Leeg kaartje ${naam} aangemaakt`);
  } catch (err) {
    alert('Aanmaken mislukt: ' + (err.message || err));
  }
};

function _lijstRegelHtml(veld, tekst, i, antag = false, metAntag = false) {
  const id = `lt-${veld}-${i}`;
  // Alleen bij geheimen op een personage: per regel aan te vinken of juist díé
  // onthulling hem antagonist maakt. Eerst was dat één schakelaar voor het hele
  // kaartje, maar niet elk geheim is een verraad — en welk geheim het is, doet
  // ertoe. Een locatie of organisatie heeft geen kant in een gevecht, dus daar
  // hoort het vinkje niet te staan.
  const antagRij = (veld === 'geheimen' && metAntag) ? `
    <label class="lijst-regel-antag" title="Dit geheim onthullen geeft het personage de rol antagonist en zet de kant op vijand">
      <input type="checkbox" class="lijst-antag-vink"${antag ? ' checked' : ''}>
      ${icon('skull')} <span>Onthullen maakt het personage een vijand</span>
    </label>` : '';
  return `<div class="lijst-regel" data-veld="${veld}">
    ${fmtToolbar(id)}
    <div class="lijst-regel-rij">
      <textarea id="${id}" rows="2" class="lijst-regel-tekst" onkeydown="window._fmtKey(event)"
        placeholder="Nog een regel\u2026">${esc(tekst)}</textarea>
      <button type="button" class="dm-btn dm-btn-sm dm-btn-ghost dm-btn-danger"
        title="Regel verwijderen" onclick="window._lijstRegelWeg(this)">${icon('trash')}</button>
    </div>${antagRij}
  </div>`;
}

window._lijstRegelWeg = (knop) => {
  const regel = knop.closest('.lijst-regel');
  const host  = regel?.parentElement;
  regel?.remove();
  // Nooit helemaal leeg: dan is er geen veld meer om in te typen.
  if (host && !host.querySelector('.lijst-regel')) window._lijstRegelErbij(host.dataset.veld);
};

window._lijstRegelErbij = (veld) => {
  const host = document.getElementById(`lijst-${veld}`);
  if (!host) return;
  const i = host.querySelectorAll('.lijst-regel').length + Date.now() % 1000;
  host.insertAdjacentHTML('beforeend', _lijstRegelHtml(veld, '', i, false, host.dataset.antag === '1'));
  host.querySelector('.lijst-regel:last-child textarea')?.focus();
};

// De chips staan eerst op hun index ("fire-bolt"); zodra de bibliotheek geladen
// is vervangen we dat door naam en niveau.
async function _vulSpellChips() {
  const host = document.getElementById('detail-spell-chips');
  if (!host || !window.spreuken?.info) return;
  const knoppen = [...host.querySelectorAll('[data-spell]')];
  if (!knoppen.length) return;
  const info = await window.spreuken.info(knoppen.map(k => k.dataset.spell));

  // Op een rij door elkaar heen zegt een spreukenlijst weinig; een caster denkt
  // in niveaus. Dus een rijtje per niveau, cantrips eerst.
  const perNiveau = new Map();
  for (const knop of knoppen) {
    const sp = info.find(x => x.index === knop.dataset.spell);
    const lv = sp ? Number(sp.level) || 0 : -1;   // onbekend achteraan
    if (sp) {
      knop.innerHTML = esc(sp.name);
      knop.title = `${sp.school || ''}`.trim();
    }
    if (!perNiveau.has(lv)) perNiveau.set(lv, []);
    perNiveau.get(lv).push(knop);
  }
  const niveaus = [...perNiveau.keys()].sort((a, b) => a - b);
  host.innerHTML = '';
  // De host is normaal een flexrij met chips; met rijtjes per niveau moeten die
  // rijen ónder elkaar staan, niet naast elkaar.
  host.classList.add('cs-spell-chips--per-niveau');
  for (const lv of niveaus) {
    const rij = document.createElement('div');
    rij.className = 'cs-spell-rij';
    const label = document.createElement('span');
    label.className = 'cs-spell-rij-lbl';
    label.textContent = lv === 0 ? 'Cantrips' : lv < 0 ? 'Overig' : `Level ${lv}`;
    rij.appendChild(label);
    const vak = document.createElement('span');
    vak.className = 'cs-spell-rij-chips';
    perNiveau.get(lv).forEach(k => vak.appendChild(k));
    rij.appendChild(vak);
    host.appendChild(rij);
  }
}

// ── Editor in tabbladen ──────────────────────────────────────────────────────
// De editor werd één lange rol waarin je moest scrollen langs dingen die je op
// dat moment niet nodig had. De blokken zetten een marker (`<!--P:naam-->`);
// hier knippen we daarop en maken er panelen van. Een paneel zonder inhoud
// krijgt geen tabblad.
const ED_TABS = [
  { key: 'info',   label: 'Informatie' },
  { key: 'beeld',  label: 'Beeld' },
  { key: 'sheet',  label: 'Character Sheet' },
  { key: 'winkel', label: 'Winkel' },
];

function _bouwEditorTabs(html, toonWinkel, sheetLabel) {
  // Het <form> staat om álles heen; zou hij in het eerste paneel blijven staan,
  // dan sluit de browser hem daar en vallen de velden van de andere tabbladen
  // buiten het formulier — die werden dan niet meegestuurd bij het opslaan.
  const start = html.indexOf('>') + 1;
  const formTag = html.slice(0, start);
  let romp = html.slice(start).replace(/<\/form>\s*$/, '');

  const delen = romp.split(/<!--P:(\w+)-->/);
  const panelen = { info: delen[0] || '' };
  for (let i = 1; i < delen.length; i += 2) {
    const naam = delen[i];
    panelen[naam] = (panelen[naam] || '') + (delen[i + 1] || '');
  }
  const knoppen = panelen.knoppen || '';
  delete panelen.knoppen;

  const heeftInhoud = (h) => /<(input|textarea|select|img|button|details)/.test(h || '');
  // Het winkel-paneel doet altijd mee; alleen zijn knop is verborgen zolang het
  // vinkje 'verkoper' (of locType 'Winkel') uit staat. Zat hij er helemaal niet
  // in, dan viel er bij het aanvinken ook niets te tonen — je zag het tabblad
  // pas na opnieuw openen.
  const gevuld = ED_TABS.filter(t => heeftInhoud(panelen[t.key]));
  if (gevuld.length <= 1) return formTag + romp.replace(/<!--P:\w+-->/g, '') + knoppen + '</form>';

  const eerste = gevuld[0].key;
  const rest = ED_TABS.filter(t => !gevuld.includes(t)).map(t => panelen[t.key] || '').join('');
  return `${formTag}
    <div class="ed-tabs">
      ${gevuld.map(t => `<button type="button" class="ed-tab${t.key === eerste ? ' is-actief' : ''}${t.key === 'winkel' && !toonWinkel ? ' hidden' : ''}"
        data-ed-tab="${t.key}" onclick="window._edTab('${t.key}')">${t.key === 'sheet' && sheetLabel ? sheetLabel : t.label}</button>`).join('')}
    </div>
    ${gevuld.map(t => `<div class="ed-paneel${t.key === eerste ? ' is-actief' : ''}" data-ed-paneel="${t.key}">${panelen[t.key]}</div>`).join('')}
    <div class="ed-paneel-verborgen">${rest}</div>
    ${knoppen}
  </form>`;
}

window._edTab = (naam) => {
  document.querySelectorAll('[data-ed-tab]').forEach(b => b.classList.toggle('is-actief', b.dataset.edTab === naam));
  document.querySelectorAll('[data-ed-paneel]').forEach(p => p.classList.toggle('is-actief', p.dataset.edPaneel === naam));
};

// ── Rollen op een kaartje ────────────────────────────────────────────────────
// `verkoper` en `antagonist` waren subtypes; nu zijn het rollen in `data.tags`,
// zodat een verkoper óók antagonist kan zijn. Oude kaartjes hebben die waarde
// nog als subtype staan, dus dat telt gewoon mee — geen migratie nodig om het
// werkend te houden.
const ROLLEN = [
  { key: 'verkoper',   label: 'Verkoper',   uitleg: 'Heeft een voorraad om uit te kopen en aan te verkopen' },
  { key: 'antagonist', label: 'Antagonist', uitleg: 'Staat de party in de weg — kleur en badge op de kaart' },
];

function _tagsUit(waarde) {
  if (Array.isArray(waarde)) return waarde.map(String);
  try {
    const arr = JSON.parse(waarde || '[]');
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch { return []; }
}
window._tagsUit = _tagsUit;

// Vinkjes → verborgen veld, en de voorraad hangt aan de rol verkoper.
// Kant is een keuze uit drie: aanvinken zet de andere twee uit, en nog eens
// klikken maakt hem weer leeg (onbepaald).
window._kantBij = (vak) => {
  const rij = vak.closest('.rollen-rij');
  rij?.querySelectorAll('.rol-keuze--kant input').forEach(i => { if (i !== vak) i.checked = false; });
  const veld = document.getElementById('kant-veld');
  if (veld) veld.value = vak.checked ? vak.value : '';
};

window._rollenBij = () => {
  // Alleen de rol-vinkjes: de kant-vinkjes staan in dezelfde rij en belandden
  // anders óók in data.tags ("vijand" als rol).
  const gekozen = [...document.querySelectorAll('.rollen-rij .rol-keuze:not(.rol-keuze--kant) input:checked')]
    .map(i => i.value);
  const veld = document.getElementById('rollen-veld');
  if (veld) veld.value = JSON.stringify(gekozen);
  const isVerkoper = gekozen.includes('verkoper');
  document.getElementById('voorraad-section')?.style.setProperty('display', isVerkoper ? '' : 'none');
  document.getElementById('winkelconfig-section')?.style.setProperty('display', isVerkoper ? '' : 'none');
  _winkelTabTonen(isVerkoper);
};

// Tabblad Winkel verschijnt zodra het vinkje aan gaat en verdwijnt weer; sta je
// er op het moment van uitzetten, dan schuif je terug naar Informatie.
function _winkelTabTonen(aan) {
  const knop = document.querySelector('[data-ed-tab="winkel"]');
  if (!knop) return;
  knop.classList.toggle('hidden', !aan);
  if (!aan && knop.classList.contains('is-actief')) window._edTab('info');
}

window._heeftRol = (e, rol) =>
  _tagsUit(e?.data?.tags).includes(rol) || String(e?.subtype || '').toLowerCase() === rol;

// ── Keuzelijst in perkament ─────────────────────────────────────────────────
// Een <datalist> tekent de browser zelf: donkergrijze bak, systeemletters, en
// er is geen CSS die daar iets aan verandert. Dus een eigen lijstje: een input
// met een gefilterde lijst eronder, in dezelfde stijl als de andere menu's.
const _keuzeLijsten = {};   // veldId → array met opties
const _keuzeNa = {};        // veldId → wat er ná een keuze moet gebeuren

function _keuzeVeldHtml(id, naam, waarde, opties, placeholder = '', naKeuze = null) {
  _keuzeLijsten[id] = opties || [];
  _keuzeNa[id] = naKeuze;
  return `<div class="keuzeveld">
    <input id="${id}" name="${naam}" value="${esc(waarde || '')}" autocomplete="off" placeholder="${esc(placeholder)}"
      class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none"
      oninput="window._keuzeFilter('${id}')" onfocus="window._keuzeFilter('${id}')"
      onkeydown="window._keuzeToets(event,'${id}')">
    <div class="keuzeveld-lijst hidden" id="${id}-lijst"></div>
  </div>`;
}

function _keuzeSluit(id) {
  document.getElementById(`${id}-lijst`)?.classList.add('hidden');
}

window._keuzeFilter = (id) => {
  const invoer = document.getElementById(id);
  const lijst  = document.getElementById(`${id}-lijst`);
  if (!invoer || !lijst) return;
  const zoek = invoer.value.trim().toLowerCase();
  const treffers = (_keuzeLijsten[id] || [])
    .filter(o => !zoek || String(o).toLowerCase().includes(zoek))
    .slice(0, 60);
  if (!treffers.length) { lijst.classList.add('hidden'); return; }
  lijst.innerHTML = treffers.map((o, i) =>
    `<button type="button" class="keuzeveld-optie${i === 0 ? ' is-actief' : ''}"
      onmousedown="event.preventDefault();window._keuzeKies('${id}', this.dataset.waarde)"
      data-waarde="${esc(o)}">${esc(o)}</button>`).join('');
  lijst.classList.remove('hidden');
};

window._keuzeKies = (id, waarde) => {
  const invoer = document.getElementById(id);
  if (invoer) { invoer.value = waarde; invoer.dispatchEvent(new Event('change', { bubbles: true })); }
  _keuzeSluit(id);
  if (typeof _keuzeNa[id] === 'function') _keuzeNa[id](invoer);
};

window._keuzeToets = (ev, id) => {
  const lijst = document.getElementById(`${id}-lijst`);
  if (!lijst || lijst.classList.contains('hidden')) return;
  const opties = [...lijst.querySelectorAll('.keuzeveld-optie')];
  const nu = opties.findIndex(o => o.classList.contains('is-actief'));
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    const volgende = ev.key === 'ArrowDown'
      ? Math.min(nu + 1, opties.length - 1)
      : Math.max(nu - 1, 0);
    opties.forEach((o, i) => o.classList.toggle('is-actief', i === volgende));
    opties[volgende]?.scrollIntoView({ block: 'nearest' });
  } else if (ev.key === 'Enter' && nu >= 0) {
    ev.preventDefault();
    window._keuzeKies(id, opties[nu].dataset.waarde);
  } else if (ev.key === 'Escape') {
    _keuzeSluit(id);
  }
};

// Buiten de lijst klikken sluit hem.
document.addEventListener('click', (ev) => {
  if (ev.target.closest('.keuzeveld')) return;
  document.querySelectorAll('.keuzeveld-lijst').forEach(l => l.classList.add('hidden'));
});

// Missies ophalen ná het tekenen: het detailvenster hoeft er niet op te wachten.
// Medestander aan/uit. Stond als icoontje onderin de editor, maar het is geen
// eigenschap van het kaartje — het is iets wat je nú doet, net als "markeer als
// deceased". Vandaar de DM-rij van het detailvenster.
async function _vulMedestander(entityId) {
  let linked = [];
  try { ({ linked } = await api.getCompanionStatus(entityId)); } catch { return; }
  const btn = document.getElementById(`detail-medestander-${entityId}`);
  if (!btn) return;
  btn.classList.toggle('dm-actie--aan', linked.length > 0);
  btn.title = linked.length > 0
    ? 'Loopt met de party mee — klik om los te koppelen'
    : 'Medestander: laat dit personage met de party meelopen';
}

window._toggleMedestander = async (entityId) => {
  // De actieve party, niet zomaar de eerste: je koppelt hem aan de groep waar
  // je op dat moment mee speelt.
  let groepId = window._activeGroupId;
  if (!groepId) {
    try { groepId = (await api.listGroups()).groups?.[0]?.id; } catch { /* ok */ }
  }
  if (!groepId) return;
  try {
    const { linked } = await api.getCompanionStatus(entityId);
    if (linked.length > 0) await Promise.all(linked.map(gid => api.unlinkCompanion(entityId, gid)));
    else                   await api.linkCompanion(entityId, groepId);
  } catch (err) {
    alert('Medestander koppelen mislukt: ' + err.message);
    return;
  }
  _vulMedestander(entityId);
};

async function _vulMissies(entityId, tab) {
  const host = () => document.getElementById(`detail-missies-${entityId}`);
  let missies = [];
  try { missies = await api.listQuests(); } catch { return; }
  const mijn = missies.filter(q => q.geverId === entityId);
  const el = host();
  if (!el || !mijn.length) return;
  const label = { verborgen: 'Verborgen', actief: 'Beschikbaar', aangevraagd: 'Aangevraagd',
                  'in-uitvoering': 'In uitvoering', voltooid: 'Voltooid', mislukt: 'Mislukt' };
  el.innerHTML = `
    <div class="mb-4">
      <div class="detail-field-label">${icon('map-pin')} ${mijn.length > 1 ? 'Missies' : 'Missie'}</div>
      <div class="detail-missies">
        ${mijn.map(q => `
          <div class="detail-missie detail-missie--${esc(q.status || 'verborgen')}">
            <span class="detail-missie-titel">${esc(q.title || '')}</span>
            <span class="detail-missie-status">${esc(label[q.status] || q.status || '')}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Gekoppelde spreuken op een kaartje ──
function _csSpellLees() {
  const veld = document.getElementById('cs-spell-indexes');
  try { return JSON.parse(veld?.value || '[]'); } catch { return []; }
}
function _csSpellSchrijf(lijst) {
  const veld = document.getElementById('cs-spell-indexes');
  if (veld) veld.value = lijst.length ? JSON.stringify(lijst) : '';
  _csSpellChips();
}
function _csSpellChips() {
  const host = document.getElementById('cs-spell-chips');
  if (!host) return;
  const lijst = _csSpellLees();
  host.innerHTML = lijst.map(idx => {
    const sp = (_spreukLijst || []).find(x => x.index === idx);
    const naam = sp?.name || idx;
    const niveau = sp ? (Number(sp.level) === 0 ? 'C' : sp.level) : '';
    return `<span class="cs-spell-chip">${niveau !== '' ? `<b>${esc(String(niveau))}</b>` : ''}${esc(naam)}
      <button type="button" title="Loskoppelen" onclick="window._csSpellWeg('${esc(idx)}')">×</button></span>`;
  }).join('');
}
window._csSpellAdd = (input) => {
  const naam = (input.value || '').trim().toLowerCase();
  if (!naam) return;
  const sp = (_spreukLijst || []).find(x => x.name.toLowerCase() === naam);
  if (!sp) { input.classList.add('dm-input--err'); setTimeout(() => input.classList.remove('dm-input--err'), 900); return; }
  const lijst = _csSpellLees();
  if (!lijst.includes(sp.index)) lijst.push(sp.index);
  input.value = '';
  _csSpellSchrijf(lijst);
};
window._csSpellWeg = (idx) => _csSpellSchrijf(_csSpellLees().filter(x => x !== idx));

export function initCampagne() {}

// Expose for global search
window._entityTypeMeta = TYPE_META;
// ── Genormaliseerd, gescoord zoeken (gedeeld door sectie- en globaal zoeken) ──
// Diakriet- en hoofdletter-ongevoelig; meerdere woorden moeten allemaal
// ergens matchen (AND); resultaten krijgen een relevantiescore.
function _normSearch(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function _searchTokens(q) {
  return _normSearch(q).split(/\s+/).filter(Boolean);
}
function _entityHaystacks(e) {
  const d = e.data || {};
  return {
    name: _normSearch(e.name),
    meta: _normSearch([e.subtype, d.rol, d.ras, d.klasse, d.locType, d.orgType, d.itemType, d.wijk, d.rariteit, d.motto].filter(Boolean).join(' ')),
    rest: _normSearch([...Object.values(d), ...Object.values(e.links || {}).flat()].join(' ')),
  };
}
// Score voor één entiteit tegen reeds-getokeniseerde query. -1 = geen match.
function _searchScore(e, tokens) {
  if (!tokens || !tokens.length) return 0;
  const h = _entityHaystacks(e);
  let score = 0;
  for (const t of tokens) {
    // Hoe korter het woord, hoe strenger. Bij één letter zoeken in álle teksten
    // levert bijna de hele campagne op — dat is geen zoekresultaat maar een
    // lijst. Eén letter kijkt dus alleen naar het begin van een naam, twee
    // letters naar de naam en de korte velden, en vanaf drie letters naar alles.
    const kort = t.length;
    let best = 0;
    if (h.name === t) best = 1000;
    else if (h.name.startsWith(t)) best = 600;
    else if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h.name)) best = 400;
    else if (kort >= 2 && h.name.includes(t)) best = 250;
    else if (kort >= 2 && h.meta.includes(t)) best = 120;
    else if (kort >= 3 && h.rest.includes(t)) best = 60;
    if (best === 0) return -1;   // dit woord komt nergens voor → geen match
    score += best;
  }
  return score;
}
window._normSearch  = _normSearch;
window._searchTokens = _searchTokens;
window._searchScore = _searchScore;

window._entityFilter = (type, list, q) => {
  const tokens = _searchTokens(q);
  if (!tokens.length) return list;
  return list
    .map(e => ({ e, s: _searchScore(e, tokens) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.e);
};

// Gedeelde skeleton-kaartjes voor laad-states (ook gebruikt door het Bestiarium).
window._skelCards = (n = 6) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `<div class="gb-skel-card">
      <div class="gb-skel gb-skel-img"></div>
      <div class="gb-skel-body">
        <div class="gb-skel gb-skel-line" style="width:68%"></div>
        <div class="gb-skel gb-skel-line" style="width:42%"></div>
        <div class="gb-skel gb-skel-line gb-skel-line--sm" style="width:88%"></div>
        <div class="gb-skel gb-skel-line gb-skel-line--sm" style="width:74%"></div>
      </div>
    </div>`;
  }
  return s;
};

async function renderEntitySection(type) {
  const container = $(`#section-${type}`);

  // Skeleton tijdens het laden (alleen eerste keer, vóór de fetch). Aparte klasse
  // (gb-skel-grid) zodat de bestaande '.cards-grid'-check verderop niet matcht.
  if (container && !container.querySelector('.cards-grid')) {
    container.innerHTML = `<div class="gb-skel-grid grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-6">${window._skelCards?.(8) || ''}</div>`;
  }

  try {
    entities[type] = await api.listEntities(type);
  } catch (e) {
    entities[type] = [];
  }
  window._entityCache = entities;
  // Naamindex bijwerken voor wikilink-resolving
  window._buildEntityIndex?.(type, entities[type]);

  const list = filterEntities(type, entities[type] || []);

  // Only build the full toolbar+grid on first render; on subsequent calls just refresh the grid.
  // Uitzondering: als de DM-status is gewisseld sinds de balk gebouwd werd (bv. inloggen ná
  // een eerste render als gast), moet de balk volledig herbouwd worden — anders blijven de
  // DM-only knoppen (+ en potlood) ontbreken op de default-tab. Zie dataset.dmBuilt hieronder.
  const existingGrid = container.querySelector('.cards-grid');
  if (existingGrid && container.dataset.dmBuilt === String(isDM())) {
    _refreshGrid(type, list, container);
    return;
  }

  const DESC = {
    personages: 'Helden, vrienden en vijanden',
    locaties: 'Plaatsen, wijken en gebouwen',
    organisaties: 'Gilden, facties en genootschappen',
    voorwerpen: 'Magische voorwerpen en uitrusting',
  };

  // Unieke subtype-waarden — case-insensitief dedupliceren
  const _sfSeen = new Map();
  (entities[type] || []).forEach(e => {
    const v = (_getEntitySubtypeVal(type, e) || '').trim();
    if (v && !_sfSeen.has(v.toLowerCase())) _sfSeen.set(v.toLowerCase(), v);
  });
  let sfVals = [..._sfSeen.values()].sort((a, b) => a.localeCompare(b, 'nl'));
  // Voorwerpen: Blessing/Boon niet als losse chips — die vallen onder "Zegeningen & Gunsten"
  if (type === 'voorwerpen') sfVals = sfVals.filter(v => !['Blessing', 'Boon'].includes(v));
  const sfActive = subtypeFilters[type] || '';
  // Speciale chips per type (los van de auto-verzamelde subtype-waarden)
  const _specialChips = type === 'locaties'   ? [{ val: '__winkel__', label: `${icon('building')} Winkel` }]
                      : type === 'voorwerpen' ? [{ val: '__gewijd__', label: `${icon('sparkles')} Zegeningen & Gunsten` }]
                      : [];
  // Alleen zinvol als je er zelf hebt: de speler filtert zijn tabblad terug tot
  // wat hij gemarkeerd heeft.
  const _mijnBm = (window.app?.state?.bookmarks || []).filter(b => b.type === type);
  if (_mijnBm.length) _specialChips.unshift({ val: '__bladwijzer__', label: `★ Bladwijzers` });
  // Filterbalk tonen als er een speciale chip is, of als er ≥2 gewone subtype-waarden zijn
  const _showSf = _specialChips.length > 0 || sfVals.length >= 2;

  container.innerHTML = `
    <!-- Section banner -->
    <div class="section-banner section-banner--entity section-banner--${type}">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${TYPE_META[type].svgIcon}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">${TYPE_META[type].label}</div>
          <div class="section-banner-desc-line">${DESC[type] || ''}</div>
        </div>
        <div class="section-banner-search">
          <div class="sbs-input-wrap">
            <span class="sbs-icon">\u2315</span>
            <input type="text" class="sbs-input search-input"
              placeholder="Zoek ${TYPE_META[type].label.toLowerCase()}..." value="${esc(searchQueries[type])}"
              oninput="window._entitySearch('${type}',this.value)">
          </div>
          ${_showSf ? `<button class="sf-toggle-btn${sfActive ? ' sf-toggle-btn--active' : ''}" onclick="window._toggleSubtypeBar('${type}')" title="Filter op subtype"><svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><polygon points="0,0 13,0 8,5.5 8,11 5,11 5,5.5"/></svg></button>` : ''}
          <!-- De resultatenteller stond hier; hij telde iets anders dan de
               ontdekkingsmeter in de kop (die laat zien hoeveel de party van de
               wereld kent, zónder de spelers zelf) en dat las als een fout. -->
          ${window._helpBtn?.(type) ?? ''}
          ${isDM() ? `<button class="sbs-add-btn" onclick="window.app.onFabClick()" title="Nieuw: ${TYPE_META[type].label.toLowerCase()}">${window.icon('plus')}</button>` : ''}
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>

    <!-- Subtype filter chips (standaard verborgen, toggle via knop) -->
    ${_showSf ? `
    <div class="subtype-filter-bar${sfActive ? '' : ' subtype-filter-bar--hidden'}">
      <button class="sf-chip${sfActive === '' ? ' sf-chip--active' : ''}" data-sf-val="" onclick="window._entitySubtypeFilter('${type}', null)">Alle</button>
      ${_specialChips.map(c => `<button class="sf-chip sf-chip--special${sfActive === c.val ? ' sf-chip--active' : ''}" data-sf-val="${esc(c.val)}" onclick="window._entitySubtypeFilter('${type}', this.classList.contains('sf-chip--active') ? null : this.dataset.sfVal)">${c.label}</button>`).join('')}
      ${sfVals.map(v => `<button class="sf-chip${sfActive === v ? ' sf-chip--active' : ''}" data-sf-val="${esc(v)}" onclick="window._entitySubtypeFilter('${type}', this.classList.contains('sf-chip--active') ? null : this.dataset.sfVal)">${esc(v)}</button>`).join('')}
    </div>` : ''}

    <!-- Card grid -->
    <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-6 overflow-y-auto flex-1">
    </div>
  `;
  // Onthoud met welke DM-status deze balk gebouwd is (zie de guard bovenaan): wisselt de
  // status (inloggen/uitloggen), dan forceert dat een volledige herbouw i.p.v. enkel grid.
  container.dataset.dmBuilt = String(isDM());

  _refreshGrid(type, list, container);

  // DM: openstaande claim-verzoeken tonen boven de grid
  if (type === 'voorwerpen') _renderClaimRequests(container);

  window._entitySearch = (t, q) => {
    searchQueries[t] = q;
    const filtered = filterEntities(t, entities[t] || []);
    const c = $(`#section-${t}`);
    _refreshGrid(t, filtered, c);
  };

  window._entitySubtypeFilter = (t, subtype) => {
    subtypeFilters[t] = subtype || null;
    const filtered = filterEntities(t, entities[t] || []);
    const c = $(`#section-${t}`);
    _refreshGrid(t, filtered, c);
    c.querySelectorAll('.sf-chip').forEach(btn => {
      btn.classList.toggle('sf-chip--active', btn.dataset.sfVal === (subtype || ''));
    });
    // Toon de filterbalk als een filter actief is; update knop
    const bar = c.querySelector('.subtype-filter-bar');
    if (bar && subtype) bar.classList.remove('subtype-filter-bar--hidden');
    const toggleBtn = c.querySelector('.sf-toggle-btn');
    if (toggleBtn) toggleBtn.classList.toggle('sf-toggle-btn--active', !!subtype);
  };

  window._toggleSubtypeBar = (type) => {
    const c = $(`#section-${type}`);
    c.querySelector('.subtype-filter-bar')?.classList.toggle('subtype-filter-bar--hidden');
  };
}

function _sortKey(name) {
  return (name || '').replace(/^(de|het|'t)\s+/i, '').trim();
}

function _fitText(el) {
  el.style.fontSize = '';
  if (el.scrollWidth <= el.clientWidth) return;
  for (let size = 13; size >= 9; size--) {
    el.style.fontSize = size + 'px';
    if (el.scrollWidth <= el.clientWidth) break;
  }
}

function _renderClaimRequests(container) {
  // Verwijder eventuele bestaande balk
  container.querySelector('.claim-requests-bar')?.remove();
  if (!isDM()) return;
  const pending = (_ownership.requests || []).filter(r => r.status === 'pending');
  if (pending.length === 0) return;

  const bar = document.createElement('div');
  bar.className = 'claim-requests-bar';
  bar.innerHTML = `
    <div class="claim-requests-title">${icon('mail')} Openstaande claimverzoeken (${pending.length})</div>
    ${pending.map(r => `
      <div class="claim-request-row">
        <span class="claim-request-info">
          <strong>${esc(r.requesterName)}</strong> wil
          <em>${esc(r.itemName)}</em> ${r.type === 'trade' ? `ruilen met ${esc(r.targetName || '?')}` : 'claimen'}
        </span>
        <div class="claim-request-actions">
          <button class="claim-btn-approve" onclick="window._itemApproveRequest('${esc(r.id)}')">${icon('check')} Goedkeuren</button>
          <button class="claim-btn-reject"  onclick="window._itemRejectRequest('${esc(r.id)}')">${icon('x')} Weigeren</button>
        </div>
      </div>
    `).join('')}
  `;
  // Voeg in vóór de cards-grid
  const grid = container.querySelector('.cards-grid');
  if (grid) container.insertBefore(bar, grid);
}

function _refreshGrid(type, list, container) {
  // Refresh ook de claim-balk bij grid-update
  if (type === 'voorwerpen') _renderClaimRequests(container);
  const grid = container.querySelector('.cards-grid');
  if (!grid) return;
  const savedScrollY = window.scrollY;
  const savedGridScroll = grid.scrollTop; // de grid scrollt intern (overflow-y-auto); anders
                                          // springt hij naar boven bij bv. een geheim togglen
  const totalCount = (entities[type] || []).length;
  const isSearch = !!(searchQueries[type]);
  grid.innerHTML = list.length === 0 ? `
    <div class="col-span-full text-center py-20 text-ink-faint">
      <div class="text-5xl mb-4 opacity-40">${TYPE_META[type].svgIcon}</div>
      <div class="font-cinzel text-sm font-semibold text-ink-dim mb-1">
        ${isSearch || totalCount > 0
          ? `Geen ${TYPE_META[type].label.toLowerCase()} gevonden`
          : 'Het archief is nog leeg...'}
      </div>
      ${!isSearch && totalCount === 0 && isDM()
        ? `<div class="text-xs font-fell italic mt-1">Gebruik de <span class="font-mono px-1 py-0.5 bg-room-elevated rounded">+</span> knop om iets toe te voegen</div>`
        : ''}
    </div>
  ` : list.map(e => renderCard(type, e)).join('');
  grid.scrollTop = savedGridScroll; // meteen herstellen (layout is al berekend)
  requestAnimationFrame(() => {
    window.scrollTo(0, savedScrollY);
    grid.querySelectorAll('[data-fittext]').forEach(_fitText);
    grid.scrollTop = savedGridScroll; // als láátste, ná fittext (dat celhoogtes kan wijzigen)
  });
}

// De kaartjes tilden vroeger met de muis mee (3D-rotatie op mousemove). Het
// optillen bij hover doet de CSS al (.entity-card:hover); het meekantelen gaf
// vooral onrust, dus dat is eruit.

export async function renderPersonages() { return renderEntitySection('personages'); }
export async function renderLocaties() { return renderEntitySection('locaties'); }
export async function renderOrganisaties() { return renderEntitySection('organisaties'); }
export async function renderVoorwerpen() {
  await refreshOwnership();
  return renderEntitySection('voorwerpen');
}

// Geeft de subtype-waarde terug die gebruikt wordt voor filteren per type
function _getEntitySubtypeVal(type, e) {
  if (type === 'locaties')     return e.data?.wijk     || '';
  if (type === 'organisaties') return e.data?.orgType  || '';
  if (type === 'voorwerpen')   return e.data?.itemType || '';
  return e.subtype || '';
}

function filterEntities(type, list) {
  const q  = searchQueries[type];
  const sf = subtypeFilters[type] || null;
  let filtered = list;
  // Score per kaartje bewaren: die bepaalt straks de volgorde. Zonder dit werd
  // er alleen gefilterd en bleef de alfabetische volgorde staan — dan stond een
  // kaartje dat de naam in zijn beschrijving noemt vóór het kaartje zelf.
  let scores = null;
  if (q) {
    const tokens = _searchTokens(q);
    scores = new Map();
    filtered = filtered.filter(e => {
      const sc = _searchScore(e, tokens);
      if (sc >= 0) scores.set(e.id, sc);
      return sc >= 0;
    });
  }
  if (sf === '__bladwijzer__') {
    const bmIds = new Set((window.app?.state?.bookmarks || []).map(b => b.id));
    filtered = filtered.filter(e => bmIds.has(e.id));
  } else if (sf === '__winkel__' && type === 'locaties') {
    filtered = filtered.filter(e => e.data?.locType === 'Winkel');
  } else if (sf === '__gewijd__' && type === 'voorwerpen') {
    filtered = filtered.filter(e => ['Blessing', 'Boon'].includes(e.data?.itemType));
  } else if (sf) {
    filtered = filtered.filter(e => _getEntitySubtypeVal(type, e) === sf);
  } else if (type === 'voorwerpen' && !q) {
    // Standaard-browse: zegeningen/gunsten (Blessing/Boon) uit de hoofdlijst houden.
    // (Tijdens zoeken niet uitsluiten, zodat alles vindbaar blijft.)
    filtered = filtered.filter(e => !['Blessing', 'Boon'].includes(e.data?.itemType));
  }
  return filtered.slice().sort((a, b) => {
    // Tijdens het zoeken wint de treffer: naam vóór beschrijving. Bij gelijke
    // score valt hij terug op de gewone volgorde hieronder.
    if (scores) {
      const verschil = (scores.get(b.id) || 0) - (scores.get(a.id) || 0);
      if (verschil) return verschil;
    }
    if (type === 'locaties') {
      const wa = a.data?.wijk || '';
      const wb = b.data?.wijk || '';
      // Locaties zonder wijk komen achteraan
      if (wa !== wb) {
        if (!wa) return 1;
        if (!wb) return -1;
        return wa.localeCompare(wb, 'nl', { sensitivity: 'base' });
      }
    }
    return _sortKey(a.name).localeCompare(_sortKey(b.name), 'nl', { sensitivity: 'base' });
  });
}

// Normaliseer een rariteit (NL/EN) naar een sleutel voor de visuele behandeling.
function _rarityKey(r) {
  if (!r) return '';
  const map = {
    'common': 'common', 'gewoon': 'common',
    'uncommon': 'uncommon', 'ongewoon': 'uncommon',
    'rare': 'rare', 'zeldzaam': 'rare',
    'very rare': 'very-rare', 'zeer zeldzaam': 'very-rare',
    'legendary': 'legendary', 'legendarisch': 'legendary',
    'artifact': 'legendary', 'artefact': 'legendary',
  };
  return map[String(r).trim().toLowerCase()] || '';
}

// Toon-label voor rariteit altijd in het Engels (PHB-term); valt terug op de
// opgeslagen waarde bij een onbekende/eigen rariteit.
const _RARITY_EN = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', 'very-rare': 'Very Rare', legendary: 'Legendary' };
function _rarityLabel(r) {
  if (!r) return '';
  return _RARITY_EN[_rarityKey(r)] || String(r);
}

function renderCard(type, e) {
  const vis = e._visibility || 'visible';

  // ── Player vague card: name visible, content hidden behind overlay ──
  if (!isDM() && vis === 'vague') {
    return `
      <div class="entity-card card-vague">
        <div class="card-accent bar-${type}" style="opacity:0.5"></div>
        <div class="card-img-wrap">
          <img class="card-img w-full object-cover" loading="lazy" src="${api.thumbForEntity(e)}"
            style="${e.data?.imgFocus ? `object-position:${e.data.imgFocus}` : ''}"
            onerror="this.closest('.entity-card').classList.add('no-img')">
          <div class="card-vague-overlay">?</div>
        </div>
        <div class="card-body px-4 py-3">
          <span class="card-name">${esc(e.name)}</span>
          <span class="card-name-sep"></span>
          <div class="text-[10px] text-ink-faint font-fell italic">— onbekend —</div>
        </div>
      </div>
    `;
  }

  const rol     = e.data?.rol || '';
  const _rarKey = type === 'voorwerpen' ? _rarityKey(e.data?.rariteit) : '';
  const _itemMeta = type === 'voorwerpen'
    ? [_rarityLabel(e.data?.rariteit), (e.data?.attunement === 'true' || e.data?.attunement === true) ? 'Attunement' : null].filter(Boolean).join(' · ')
    : null;
  const metaText = [e.data?.locType, e.data?.orgType, _itemMeta, e.data?.domein, e.data?.ras, e.data?.klasse].filter(Boolean).join(' \u00b7 ');
  const badges  = getCardBadges(type, e);
  const desc = e.data?.desc || '';
  // Flavour is een lijst geworden; het kaartje toonde nog alleen het oude
  // enkelvoudige veld. Nu alle regels die deze kijker mag zien, met pijltjes
  // erdoorheen (de DM ziet ook wat nog niet verteld is, lichter).
  const _flavRegels = _tekstLijstUit(e.data, 'flavours', 'flavour');
  const _flavGezegd = (() => {
    // Zie het detailvenster: een speler krijgt alleen de vertelde regels binnen.
    if (!isDM()) return _flavRegels.map(() => true);
    const rauw = e.data?.flavoursUitgesproken;
    if (Array.isArray(rauw)) return _flavRegels.map((_, i) => !!rauw[i]);
    const alles = e.data?.flavourUitgesproken === true || e.data?.flavourUitgesproken === 'true';
    return _flavRegels.map((_, i) => alles && i === 0);
  })();
  const _flavTonen = _flavRegels
    .map((tekst, i) => ({ tekst, gezegd: _flavGezegd[i] }))
    .filter(r => r.tekst && (isDM() || r.gezegd));

  const chips = [];
  if (e.links) {
    const npc = (e.links.personages || []).slice(0, 1);
    const loc = (e.links.locaties   || []).slice(0, 1);
    // Max 2 chips: eerst 1 personage + 1 locatie; ontbreekt één soort, pak 2 van de andere
    const npcShow = npc.length ? npc : (e.links.personages || []).slice(0, 2 - loc.length);
    const locShow = loc.length ? loc : (e.links.locaties   || []).slice(0, 2 - npcShow.length);
    const combined = [
      ...npcShow.map(n => `<span class="chip chip-npc" data-name="${esc(n)}" onclick="event.stopPropagation();window._navigateTo('personages',this.dataset.name)">\ud83d\udc64 ${esc(n)}</span>`),
      ...locShow.map(n => `<span class="chip chip-loc" data-name="${esc(n)}" onclick="event.stopPropagation();window._navigateTo('locaties',this.dataset.name)">\ud83c\udff0 ${esc(n)}</span>`),
    ];
    chips.push(...combined.slice(0, 2));
  }

  // ── Armor AC — vooraf berekend zodat overlay én chips het resultaat kunnen gebruiken ──
  const _cardAcr     = (type === 'voorwerpen') ? _calcArmorAC(e.data, null) : null;
  const _cardStealth = e.data?.stealthDisadvantage === true || e.data?.stealthDisadvantage === 'true';
  const _cardStrReq  = parseInt(e.data?.strengthRequirement) || 0;

  // ── DM toggle icon / title — 3-state for personages + locaties ──
  const _threeState = ['personages', 'locaties'].includes(type);
  const _visIcon  = vis === 'visible' ? icon('eye')
                  : vis === 'vague'   ? icon('eye-off')
                  :                    icon('lock');
  const _visTitle = vis === 'visible' ? 'Verbergen  ·  Shift: vaag tonen'
                  : vis === 'vague'   ? 'Volledig tonen  ·  Shift: vaag houden'
                  : _threeState       ? 'Zichtbaar maken  ·  Shift: vaag tonen'
                  :                    'Zichtbaar maken';

  const _goddelijkType = (type === 'voorwerpen' && e.data?.itemType === 'Blessing') ? (e.data?.goddelijkType || '') : '';
  const _isBoon = (type === 'voorwerpen' && e.data?.itemType === 'Boon');
  // Spelerskaarten (protagonisten) krijgen een vergulde, beschermde uitstraling — hun
  // portret/filmpje wordt overal hergebruikt, dus de kaart staat visueel boven NPC's.
  const _isProtagonist = type === 'personages' && (e.subtype === 'speler');
  return `
    <div class="entity-card${e._beeld === false ? ' no-img' : ''}${vis === 'hidden' && isDM() ? ' card-hidden' : ''}${vis === 'vague' && isDM() ? ' card-vague-dm' : ''}${e._deceased ? ' card-deceased' : ''}${_goddelijkType ? ` card-goddelijk card-goddelijk--${_goddelijkType}` : ''}${_isBoon ? ' card-boon' : ''}${_isProtagonist ? ' card-protagonist' : ''}"${_rarKey ? ` data-rarity="${_rarKey}"` : ''}${_isProtagonist ? ' data-protagonist="true"' : ''}
      onclick="window._openDetail('${type}','${e.id}')">
      ${isDM() ? `
        <div class="dm-only absolute top-7 right-2 z-30 flex flex-col gap-1">
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._toggleVis('${type}','${e.id}',event)"
            title="${_visTitle}">
            ${_visIcon}
          </button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._openEditor('${type}','${e.id}')"
            title="Bewerken">${icon('pencil')}</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-red-700/90 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._deleteEntity('${type}','${e.id}')"
            title="Verwijderen">${icon('x')}</button>
        </div>
      ` : ''}
      <!-- Voor de DM stond hier een slotje dat vertelde of het geheim uit was.
           Dat sloeg nergens meer op zodra een kaartje meerdere geheimen kan
           hebben; onthullen gaat nu per geheim in het detailvenster. Voor de
           speler is het gebleven, maar als pill bij de andere badges: linksboven
           lag hij precies op de bladwijzerknop. -->
      ${!isDM() && window.app?.state?.characterId ? (() => {
        const _bms = window.app?.state?.bookmarks || [];
        const _bmActive = _bms.some(b => b.id === e.id);
        return `<button class="card-bookmark-btn${_bmActive ? ' card-bookmark-btn--active' : ''}"
          onclick="event.stopPropagation();window._toggleBookmark(this.dataset.btype,this.dataset.bid,this.dataset.bname)"
          data-btype="${esc(type)}" data-bid="${esc(e.id)}" data-bname="${esc(e.name)}"
          title="${_bmActive ? 'Bladwijzer verwijderen' : 'Bladwijzer toevoegen'}">
          ${_bmActive ? '★' : '☆'}
        </button>`;
      })() : ''}
      <div class="card-accent bar-${type}"></div>
      <!-- Niet vooraf op 'geen afbeelding' zetten: een verborgen <img loading=lazy>
           laadt nooit, en dan blijft élk kaartje beeldloos. De lege strook tot de
           404 binnen is nemen we voor lief. -->
      <div class="card-img-wrap">
        <img class="card-img w-full object-cover" loading="lazy" src="${api.thumbForEntity(e)}"
          style="${e.data?.imgFocus ? `object-position:${e.data.imgFocus}` : ''}"
          onerror="this.style.display='none';this.closest('.entity-card').classList.add('no-img')">
        <div class="card-img-fade"></div>
        ${(badges.length || (!isDM() && e._secretReveal)) ? `<div class="card-badges card-badges--beeld">
          ${!isDM() && e._secretReveal ? `<span class="card-geheim-pill" title="Er is een geheim over dit kaartje onthuld">${icon('eye')} Geheim onthuld</span>` : ''}
          ${badges.length ? `<div class="card-badges-rij">${badges.map(b => `<span class="card-subtype-badge ${b.cls}">${esc(b.label)}</span>`).join('')}</div>` : ''}
        </div>` : ''}
        ${type === 'locaties' && window._pinnedLocIds?.has(e.id) ? `<button class="card-map-btn"
          onclick="event.stopPropagation();window._toonOpKaart('${esc(e.id)}')"
          title="Toon op kaart">${icon('map-pin')}</button>` : ''}
        ${type === 'voorwerpen' && e.data?.damage ? (() => {
          const _isHeal = /heal/i.test(e.data.damage);
          return `<button class="card-damage-pill${_isHeal ? ' card-damage-pill--heal' : ''}"
            onclick="event.stopPropagation();window.dice?.rollFormula('${escJS(e.data.damage)}')"
            title="Gooi ${escJS(e.data.damage)}">${icon('dice',{cls:'icon-gi'})} ${esc(e.data.damage)}</button>`;
        })() : ''}
        ${_cardAcr ? `<span class="card-armor-ac-pill" title="${escJS(_cardAcr.tooltip)}">${esc(_cardAcr.pill)}</span>` : ''}
        ${e._gockOnderzocht ? `<span class="card-gock-badge" title="Onderzocht door De Gock">${icon('search')}</span>` : ''}
      </div>
      <div class="card-body px-3 pt-2 pb-2">
        ${badges.length ? `<div class="card-badges card-badges--los">${badges.map(b => `<span class="card-subtype-badge ${b.cls}">${esc(b.label)}</span>`).join('')}</div>` : ''}
        <div class="mb-1.5">
          <span class="card-name block" data-fittext>${esc(e.name)}${e._deceased ? '<span class="card-name-dagger">†</span>' : ''}</span>
          ${(rol || metaText) ? `<span class="card-name-sep"></span>
          <div class="card-meta">
            ${rol      ? `<span class="card-meta-rol">${esc(rol)}</span>` : ''}
            ${rol && metaText ? `<span class="card-meta-dot"> · </span>` : ''}
            ${metaText ? `<span class="card-meta-sub">${esc(metaText)}</span>` : ''}
          </div>` : ''}
        </div>
        ${desc ? `<p class="text-xs text-ink-medium line-clamp-4 mb-1 font-crimson leading-relaxed">${mdToHtml(desc)}</p>` : ''}
        ${(() => {
          if (type !== 'voorwerpen') return '';
          const _props = (() => { try { return JSON.parse(e.data?.weaponProperties || '[]'); } catch { return []; } })();
          const _wpHtml = _props.length ? `<div class="card-weapon-props">${_props.map(p => { const _base = p.replace(/\s*\(.*\)$/, '').trim(); const _tip = WEAPON_PROPERTIES[p] || WEAPON_PROPERTIES[_base] || ''; return `<span class="card-weapon-tag"${_tip ? ` data-wptip="${escJS(_tip)}"` : ''}>${esc(p)}</span>`; }).join('')}</div>` : '';
          const _arHtml = (_cardStealth || _cardStrReq) ? `<div class="card-weapon-props">
            ${_cardStealth ? `<span class="card-armor-tag card-armor-tag--stealth" data-wptip="You have disadvantage on Dexterity (Stealth) checks while wearing this armor.">Stealth ↓</span>` : ''}
            ${_cardStrReq  ? `<span class="card-armor-tag card-armor-tag--str" data-wptip="Your speed is reduced by 10 feet unless you have a Strength score of ${_cardStrReq} or higher.">Str ${_cardStrReq}</span>` : ''}
          </div>` : '';
          return _wpHtml + _arHtml;
        })()}
        <!-- relatie-chips verborgen (code bewaard); vervangen door wikilinks in beschrijving -->
        <!-- ${chips.length ? `<div class="flex flex-wrap gap-1">${chips.join('')}</div>` : ''} -->
      </div>
      ${_flavTonen.length ? (() => {
        _flavCache[e.id] = _flavTonen;
        const eerste = _flavTonen[0];
        return `
        <div class="flavour-preview${isDM() && !eerste.gezegd ? ' flavour-preview--ongespoken' : ''}" id="flav-${esc(e.id)}">
          ${e.data?.audioId ? `<button type="button" class="flavour-audio-btn" data-audio-btn data-audio-btn-id="${esc(e.data.audioId)}" onclick="event.stopPropagation();window._audioToggle('${esc(e.data.audioId)}')" title="Sfeer afspelen">▶</button>` : ''}
          <span class="flavour-preview-text">\u201e${esc(_flavKort(eerste.tekst))}\u201c</span>
          ${_flavTonen.length > 1 ? `
            <button type="button" class="flavour-preview-nav"
              onclick="event.stopPropagation();window._flavStap('${esc(e.id)}')"
              title="Volgende roddel">1/${_flavTonen.length} \u203a</button>` : ''}
        </div>`;
      })() : ''}
      ${type === 'voorwerpen' ? _itemOwnershipBadge(e.id) : ''}
    </div>
  `;
}

// Roddels op een kaartje: welke regels er staan en waar we zijn. Module-state,
// net als bij de afbeelding-carousel — het kaartje is een string, dus de tekst
// van regel 2 moet ergens anders vandaan komen.
const _flavCache = {};
const _flavPos   = {};
const _flavCtx   = {};   // extra gegevens voor de rol in het detailvenster
const _flavKort  = (t) => (t.length > 300 ? t.slice(0, 300) + '\u2026' : t);

// Wat de spelers zelf bij dit kaartje noteren. Ze stonden allemaal onder elkaar
// onder de knoppenbalk; nu één tegelijk met pijltjes, boven de knoppen, zodat
// je ziet van wie je leest en het venster niet uitdijt bij vier spelers.
const _spnCache = {};
const _spnPos   = {};

function _spelersNotitiesHtml(entityId, data) {
  const regels = Object.entries(data?.notes || {}).filter(([, t]) => String(t || '').trim());
  if (!regels.length) return '';
  _spnCache[entityId] = regels;
  _spnPos[entityId]   = 0;
  return `
    <div class="dm-only mb-3" id="spn-${esc(entityId)}">
      <div class="detail-label mb-1">Aantekeningen van de spelers</div>
      <div class="spn-binnen">${_spelersNotitieInner(entityId)}</div>
    </div>`;
}

function _spelersNotitieInner(entityId) {
  const regels = _spnCache[entityId] || [];
  const idx    = _spnPos[entityId] || 0;
  const [naam, tekst] = regels[idx] || [];
  if (!naam) return '';
  return `
    <div class="spn-kop">
      <span class="spn-naam">${esc(naam)}</span>
      ${regels.length > 1 ? `
        <span class="flavour-nav">
          <button type="button" onclick="window._spnStap('${esc(entityId)}',-1)" title="Vorige speler">\u2039</button>
          <span>${idx + 1}/${regels.length}</span>
          <button type="button" onclick="window._spnStap('${esc(entityId)}',1)" title="Volgende speler">\u203a</button>
        </span>` : ''}
    </div>
    <div class="spn-tekst">${esc(tekst)}</div>`;
}

window._spnStap = (entityId, richting) => {
  const regels = _spnCache[entityId] || [];
  if (regels.length < 2) return;
  _spnPos[entityId] = ((_spnPos[entityId] || 0) + richting + regels.length) % regels.length;
  const vak = document.querySelector(`#spn-${CSS.escape(entityId)} .spn-binnen`);
  if (vak) vak.innerHTML = _spelersNotitieInner(entityId);
};

// Roddels en geheimen delen één blok: de tekst links, en rechts een kolom met
// de onthulknop bovenaan en de navigatie eronder. Eerder stonden geheimen
// allemaal onder elkaar en had elk zijn eigen knop; dat duwde de rest van het
// kaartje van het scherm en zag er anders uit dan de roddels.
const _ONTHUL_SOORT = {
  roddel: {
    klasse: 'roddel', aan: 'Onthuld', uit: 'Onthullen', iconAan: 'eye', iconUit: 'lock',
    titelAan: 'Toch niet verteld — terugdraaien',
    titelUit: 'Vertel deze roddel; de spelers zien hem dan',
    fn: '_toggleFlavour', vorige: 'Vorige roddel', volgende: 'Volgende roddel',
  },
  geheim: {
    klasse: 'roddel roddel--geheim', aan: 'Onthuld', uit: 'Onthullen', iconAan: 'eye', iconUit: 'lock',
    titelAan: 'Weer verbergen voor spelers',
    titelUit: 'Aan de spelers onthullen',
    fn: '_toggleSecret', vorige: 'Vorig geheim', volgende: 'Volgend geheim',
  },
};

function _onthulBlok(key) {
  const ctx = _flavCtx[key] || {};
  const cfg = _ONTHUL_SOORT[ctx.soort] || _ONTHUL_SOORT.roddel;
  const eerste = (_flavCache[key] || [])[0];
  return `
    <div class="${cfg.klasse}${isDM() && eerste && !eerste.gezegd ? ' roddel--ongespoken' : ''}" id="flav-${esc(key)}">
      <div class="roddel-binnen">${_detFlavInner(key)}</div>
    </div>`;
}

// De binnenkant: één regel met zijn eigen knop en, als er meer zijn, pijltjes.
// Wordt bij elke stap opnieuw gezet — eenvoudiger dan losse stukjes bijwerken.
function _detFlavInner(key) {
  const regels = _flavCache[key] || [];
  const ctx    = _flavCtx[key] || {};
  const cfg    = _ONTHUL_SOORT[ctx.soort] || _ONTHUL_SOORT.roddel;
  const idx    = _flavPos[key] || 0;
  const r      = regels[idx];
  if (!r) return '';
  return `
    <p class="roddel-tekst">${ctx.soort === 'geheim' ? mdToHtml(r.tekst) : esc(r.tekst)}</p>
    <div class="roddel-zij">
      ${isDM() && r.verraad ? `<span class="verraad-merk" title="Onthullen verandert dit kaartje: rol, kant en alignment">${icon('skull')} Maakt vijand</span>` : ''}
      ${isDM() ? `<button class="onthul-knop${r.gezegd ? ' onthul-knop--aan' : ''}${r.verraad ? ' onthul-knop--verraad' : ''}"
        title="${r.gezegd ? cfg.titelAan : cfg.titelUit}"
        onclick="window.${r.verraad ? '_toggleVerraadGeheim' : cfg.fn}('${esc(ctx.tab)}','${esc(ctx.id)}',${r.i}${r.verraad ? `,${r.gezegd},'${escJS(ctx.naam || '')}'` : ''})">${r.gezegd ? icon(cfg.iconAan) : icon(cfg.iconUit)}<span>${r.gezegd ? cfg.aan : cfg.uit}</span></button>` : ''}
      ${ctx.audioId ? `<button type="button" class="flavour-audio-play" data-audio-btn data-audio-btn-id="${esc(ctx.audioId)}"
        onclick="window._audioToggle('${esc(ctx.audioId)}')" title="Sfeer afspelen / pauzeren">▶</button>` : ''}
      ${regels.length > 1 ? `
        <span class="flavour-nav">
          <button type="button" onclick="window._detFlavStap('${esc(key)}',-1)" title="${cfg.vorige}">\u2039</button>
          <span>${idx + 1}/${regels.length}</span>
          <button type="button" onclick="window._detFlavStap('${esc(key)}',1)" title="${cfg.volgende}">\u203a</button>
        </span>` : ''}
    </div>`;
}

// Een geheim met het vinkje "maakt het personage een vijand" verandert méér dan
// de tekst: rol, kant en alignment schuiven mee. Zoiets hoort niet per ongeluk
// te gebeuren met één klik, dus eerst vragen — zie de afspraak over
// onomkeerbare DM-acties in CLAUDE.md.
window._toggleVerraadGeheim = (tab, id, index, wasOnthuld, naam) => {
  const wie = naam || 'dit personage';
  const vraag = wasOnthuld
    ? `Dit geheim terugdraaien?\n\n${wie} verliest de rol antagonist, en zijn kant en alignment gaan terug naar wat ze waren.`
    : `Dit geheim onthullen?\n\n${wie} wordt daarmee antagonist, komt in een gevecht aan de kant van de vijand te staan en zijn alignment schuift naar Evil.`;
  if (!confirm(vraag)) return;
  window._toggleSecret(tab, id, index);
};

window._detFlavStap = (key, richting) => {
  const regels = _flavCache[key] || [];
  if (regels.length < 2) return;
  _flavPos[key] = ((_flavPos[key] || 0) + richting + regels.length) % regels.length;
  const host = document.getElementById(`flav-${key}`);
  const vak  = host?.querySelector('.roddel-binnen');
  if (!vak) return;
  vak.innerHTML = _detFlavInner(key);
  host.classList.toggle('roddel--ongespoken', isDM() && !regels[_flavPos[key]].gezegd);
};

window._flavStap = (id) => {
  const regels = _flavCache[id] || [];
  if (regels.length < 2) return;
  const i = ((_flavPos[id] || 0) + 1) % regels.length;
  _flavPos[id] = i;
  const host = document.getElementById(`flav-${id}`);
  if (!host) return;
  host.querySelector('.flavour-preview-text').textContent = `\u201e${_flavKort(regels[i].tekst)}\u201c`;
  host.classList.toggle('flavour-preview--ongespoken', isDM() && !regels[i].gezegd);
  const nav = host.querySelector('.flavour-preview-nav');
  if (nav) nav.textContent = `${i + 1}/${regels.length} \u203a`;
};

// Statblock afdrukken. Geen tweede sjabloon op de server: we printen wat er al
// staat. Dat scheelt een renderer die uit de pas gaat lopen én het klopt vanzelf
// voor een huisdier, waar het statblok van het tier van het baasje afhangt.
window._printStatblock = (titel) => {
  const bron = document.getElementById('dtab-sheet');
  if (!bron) return;
  const kopie = bron.cloneNode(true);
  kopie.querySelectorAll('.geenprint').forEach(el => el.remove());
  const css = document.querySelector('link[href*="theme.css"]')?.getAttribute('href') || '/css/theme.css';
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) { alert('Sta pop-ups toe om af te drukken.'); return; }
  w.document.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8">
    <title>${esc(titel)}</title>
    <link rel="stylesheet" href="${esc(css)}">
    <style>
      body { background: #f8f0de; margin: 0; padding: 24px; }
      .print-kop { font-family: 'Cinzel', serif; font-size: 20px; color: #7a4a1a; margin: 0 0 12px; }
      .print-knop {
        font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: .04em;
        padding: 6px 14px; border-radius: 6px; cursor: pointer;
        border: 1px solid #c4a87a; background: #f5edd8; color: #7a4a1a;
        position: absolute; top: 20px; right: 24px;
      }
      .print-knop:hover { background: #efe3c4; }
      @media print { body { padding: 0; } .print-kop { margin-bottom: 8px; } .geenprint { display: none !important; } }
    </style>
  </head><body>
    <h1 class="print-kop">${esc(titel)}</h1>
    <button type="button" class="print-knop geenprint" onclick="window.print()">Printen</button>
    ${kopie.innerHTML}
  </body></html>`);
  w.document.close();
  w.addEventListener('load', () => w.focus());
};

// ── Character sheet in het detailvenster ────────────────────────────────────
// Nagebouwd naar het printbare blad (lib/character-sheet.js): links de abilities
// met saving throws en skills, rechts de kerngetallen, HP en proficiencies. Zo
// zie je op het scherm hetzelfde als op papier. Attacks, boedel en features
// staan er bewust niet op — die maken het blad lang terwijl je ze tijdens het
// spelen op de print of in de Boedel-tab hebt.
const _BL_ABILITIES = [['str','Strength'],['dex','Dexterity'],['con','Constitution'],
                       ['int','Intelligence'],['wis','Wisdom'],['cha','Charisma']];
const _BL_SKILLS = [
  ['str', [['athletics','Athletics']]],
  ['dex', [['acrobatics','Acrobatics'],['sleight of hand','Sleight of Hand'],['stealth','Stealth']]],
  ['int', [['arcana','Arcana'],['history','History'],['investigation','Investigation'],['nature','Nature'],['religion','Religion']]],
  ['wis', [['animal handling','Animal Handling'],['insight','Insight'],['medicine','Medicine'],['perception','Perception'],['survival','Survival']]],
  ['cha', [['deception','Deception'],['intimidation','Intimidation'],['performance','Performance'],['persuasion','Persuasion']]],
];
const _BL_PASSIEF = { perception: 'Passive Perception', insight: 'Passive Insight', investigation: 'Passive Investigation' };

const _blMod   = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
const _blTeken = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
const _blGetal = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? n : 0; };
const _blObject = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('{')) { try { return JSON.parse(v); } catch { return {}; } }
  return {};
};

function _bladHtml(profiel, hp, e) {
  const prof = _blGetal(profiel.profBonus) || 2;
  const saves = String(profiel.saveProfs || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const skillProfs = _blObject(profiel.skillProfs);
  const skillAdj   = _blObject(profiel.skillAdj);

  const pip = (niveau) => `<span class="bl-pip bl-pip--${niveau}"></span>`;
  const skillBonus = (sleutel, ability) => {
    const niveau = String(skillProfs[sleutel] || '').toLowerCase();
    const extra  = niveau === 'expert' || niveau === 'exp' ? prof * 2 : niveau === 'prof' ? prof : 0;
    return { niveau, extra, bonus: _blMod(profiel[ability]) + extra + _blGetal(skillAdj[sleutel]) };
  };

  const abilities = _BL_ABILITIES.map(([k, label]) => `
    <div class="bl-abil">
      <span class="bl-abil-lbl">${label}</span>
      <span class="bl-abil-score">${esc(profiel[k] ?? '—')}</span>
      <span class="bl-abil-mod">${_blTeken(_blMod(profiel[k]))}</span>
    </div>`).join('');

  const savesHtml = _BL_ABILITIES.map(([k, label]) => {
    const heeft = saves.includes(k);
    return `<li>${pip(heeft ? 'prof' : 'geen')}<span class="bl-naam">${label}</span>
      <span class="bl-waarde">${_blTeken(_blMod(profiel[k]) + (heeft ? prof : 0))}</span></li>`;
  }).join('');

  let skillsHtml = '';
  for (const [ability, lijst] of _BL_SKILLS) {
    for (const [sleutel, label] of lijst) {
      const { niveau, extra, bonus } = skillBonus(sleutel, ability);
      skillsHtml += `<li>${pip(niveau === 'expert' || niveau === 'exp' ? 'expert' : extra ? 'prof' : 'geen')}
        <span class="bl-naam">${label} <em>${ability}</em></span>
        <span class="bl-waarde">${_blTeken(bonus)}</span></li>`;
    }
  }

  const passief = Object.entries(_BL_PASSIEF).map(([sleutel, label]) => {
    const ability = _BL_SKILLS.find(([, l]) => l.some(([k]) => k === sleutel))[0];
    return `<div class="bl-stat"><span class="bl-stat-lbl">${label}</span><b>${10 + skillBonus(sleutel, ability).bonus}</b></div>`;
  }).join('');

  const paren = [
    ['Armor', profiel.armorProfs], ['Weapons', profiel.weaponProfs],
    ['Tools', profiel.toolProfs], ['Languages', profiel.languages], ['Senses', profiel.senses],
  ].filter(([, v]) => v && String(v).trim());

  return `
    <div class="bl-blad">
      <div class="bl-kolommen">
        <section class="bl-kol bl-kol--smal">
          <div class="bl-abils">${abilities}</div>
          <h3 class="bl-kop">Saving Throws</h3>
          <ul class="bl-rijen">${savesHtml}</ul>
          <h3 class="bl-kop">Skills</h3>
          <ul class="bl-rijen bl-rijen--skills">${skillsHtml}</ul>
        </section>
        <section class="bl-kol">
          <div class="bl-stats">
            <div class="bl-stat"><span class="bl-stat-lbl">Armor Class</span><b>${esc(profiel.ac || '—')}</b></div>
            <div class="bl-stat"><span class="bl-stat-lbl">Initiative</span><b>${esc(profiel.initiative || _blTeken(_blMod(profiel.dex)))}</b></div>
            <div class="bl-stat"><span class="bl-stat-lbl">Speed</span><b>${esc(profiel.speed || '—')}</b></div>
            <div class="bl-stat"><span class="bl-stat-lbl">Proficiency</span><b>${_blTeken(prof)}</b></div>
          </div>
          <div class="bl-stats bl-stats--passief">${passief}</div>
          <div class="bl-stats bl-stats--hp">
            <div class="bl-stat"><span class="bl-stat-lbl">Hit Points</span><b>${hp?.current ?? '—'} / ${hp?.max ?? '—'}</b></div>
            <div class="bl-stat"><span class="bl-stat-lbl">Spell Save DC</span><b>${esc(profiel.spellSaveDC || '—')}</b></div>
            <div class="bl-stat"><span class="bl-stat-lbl">Spell Attack</span><b>${profiel.spellAttackBonus ? _blTeken(_blGetal(profiel.spellAttackBonus)) : '—'}</b></div>
          </div>
          ${paren.length ? `
            <h3 class="bl-kop">Proficiencies &amp; Languages</h3>
            <dl class="bl-paren">${paren.map(([l, v]) => `<dt>${l}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
          ${(() => {
            // Gekoppelde spreuken: chips die het spreukdetail openen, gegroepeerd
            // per niveau zodra de bibliotheek geladen is (_vulSpellChips).
            let idx = [];
            try { idx = JSON.parse(e.stats?.spellIndexes || '[]'); } catch { idx = []; }
            if (!idx.length) return '';
            return `
              <h3 class="bl-kop">Spells</h3>
              <div class="cs-spell-chips" id="detail-spell-chips">${idx.map(i =>
                `<button type="button" class="cs-spell-chip cs-spell-chip--klik" data-spell="${esc(i)}"
                   onclick="window.spreuken.open('${esc(i)}')">${esc(String(i).replace(/-/g, ' '))}</button>`).join('')}</div>`;
          })()}
        </section>
      </div>
    </div>`;
}

// ── Bladwijzers ──
window._toggleBookmark = async function(type, id, name) {
  const charId = window.app?.state?.characterId;
  if (!charId) return;
  const profile = await api.getPlayerProfile(charId).catch(() => ({}));
  let bms = Array.isArray(profile.bookmarks) ? [...profile.bookmarks] : [];
  const idx = bms.findIndex(b => b.id === id);
  if (idx >= 0) {
    bms.splice(idx, 1);
  } else {
    bms.push({ id, type, name });
  }
  await api.patchPlayerProfile(charId, { bookmarks: bms });
  // Update state cache
  if (window.app?.state) window.app.state.bookmarks = bms;
  // Update knop direct in-place
  const active = bms.some(b => b.id === id);
  const btn = document.querySelector(`.card-bookmark-btn[data-bid="${CSS.escape(id)}"]`);
  if (btn) {
    btn.classList.toggle('card-bookmark-btn--active', active);
    btn.title = active ? 'Bladwijzer verwijderen' : 'Bladwijzer toevoegen';
    btn.textContent = active ? '★' : '☆';
  }
  // Toast-melding
  const toast = document.createElement('div');
  toast.className = 'bookmark-toast';
  toast.textContent = active ? '★ Bladwijzer toegevoegd' : '☆ Bladwijzer verwijderd';
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('bookmark-toast--visible'), 10);
  setTimeout(() => { toast.classList.remove('bookmark-toast--visible'); setTimeout(() => toast.remove(), 300); }, 2000);

  // Als mijn-karakter actief is: herrender zodat de sectie direct zichtbaar is
  if (window.app?.state?.activeSection === 'mijn-karakter') {
    await window.app.refreshSection('mijn-karakter');
  }
};

// Vaste kleurpalet per speler (op basis van characterId hash)
const _PLAYER_COLORS = [
  '#7b9e6b', // groen
  '#6b8bbf', // blauw
  '#b07a4e', // oranje-bruin
  '#9b6bb5', // paars
  '#b5836b', // terracotta
  '#5e9e9e', // teal
  '#b5a040', // goud
  '#7e6e9e', // lavendel
];
function _playerColor(characterId) {
  if (!characterId) return _PLAYER_COLORS[0];
  let h = 0;
  for (let i = 0; i < characterId.length; i++) h = (h * 31 + characterId.charCodeAt(i)) >>> 0;
  return _PLAYER_COLORS[h % _PLAYER_COLORS.length];
}

// Geeft 'stapelbaar' | 'gedeeld' | 'uniek' terug, ook voor items met legacy vinkjes
function _getGebruik(e) {
  const d = e?.data || {};
  if (d.gebruik) return d.gebruik;
  if (d.stapelbaar === 'true' || d.stapelbaar === true) return 'stapelbaar';
  if (d.gedeeld    === 'true' || d.gedeeld    === true) return 'gedeeld';
  return 'uniek';
}

function _itemOwnershipBadge(itemId) {
  const owner        = _ownership.owners[itemId];
  const isStapelbaar = _ownership.stapelbaar.has(itemId);
  const isGedeeld    = _ownership.gedeeld.has(itemId);
  const myId         = window.app?.state?.characterId;
  const myName       = window.app?.state?.playerName;
  const isDm         = window.app?.isDM?.();

  // ── Gedeeld: array-eigendom, elk precies 1 exemplaar ──
  if (isGedeeld) {
    const eigenaren = Array.isArray(owner) ? owner : [];
    if (isDm) {
      const label = eigenaren.length > 0
        ? `${icon('package')} ${eigenaren.length} speler${eigenaren.length !== 1 ? 's' : ''}`
        : `${icon('package')} Geef aan speler`;
      return `
        <div class="item-owner-badge item-owner-badge--stapelbaar item-owner-badge--give" onclick="event.stopPropagation();window._itemGiveToPlayer('${esc(itemId)}')">
          <span>${label}</span>
          <span class="item-give-btn">${icon('plus')}</span>
        </div>`;
    }
    const myEntry = myId ? eigenaren.find(o => o.characterId === myId) : null;
    if (myEntry) {
      return `<div class="item-owner-badge item-owner-badge--mine" onclick="event.stopPropagation()">${icon('package')} Jouw exemplaar</div>`;
    }
    return '';
  }

  // ── Stapelbaar: array-eigendom ──
  if (isStapelbaar) {
    const eigenaren = Array.isArray(owner) ? owner : [];
    if (isDm) {
      const total = eigenaren.reduce((s, o) => s + (o.qty || 1), 0);
      const label = eigenaren.length > 0
        ? `${icon('package')} ${eigenaren.length} speler${eigenaren.length !== 1 ? 's' : ''} · ${total}×`
        : `${icon('package')} Geef aan speler`;
      return `
        <div class="item-owner-badge item-owner-badge--stapelbaar item-owner-badge--give" onclick="event.stopPropagation();window._itemGiveToPlayer('${esc(itemId)}')">
          <span>${label}</span>
          <span class="item-give-btn">${icon('plus')}</span>
        </div>`;
    }
    const myEntry = myId ? eigenaren.find(o => o.characterId === myId) : null;
    if (myEntry && (myEntry.qty || 1) > 0) {
      return `<div class="item-owner-badge item-owner-badge--mine" onclick="event.stopPropagation()">${icon('package')} ×${myEntry.qty || 1}</div>`;
    }
    return '';
  }

  // ── Uniek eigendom (bestaande logica) ──
  if (owner && !Array.isArray(owner)) {
    const isMine = myId && owner.characterId === myId;
    const color  = isMine ? '' : `color:${_playerColor(owner.characterId)};border-color:${_playerColor(owner.characterId)}40`;
    return `
      <div class="item-owner-badge ${isMine ? 'item-owner-badge--mine' : 'item-owner-badge--other'}" style="${color}" onclick="event.stopPropagation()">
        ${isMine ? `${icon('package')} Jouw eigendom` : `${icon('package')} ${esc(owner.playerName)}`}
        ${isDm ? `<button class="item-owner-remove" onclick="event.stopPropagation();window._itemRemoveOwner('${esc(itemId)}')" title="Eigendom verwijderen">${icon('x')}</button>` : ''}
        ${isDm ? `<button class="item-give-btn" onclick="event.stopPropagation();window._itemGiveToPlayer('${esc(itemId)}')" title="Geef aan andere speler">${icon('package')}</button>` : ''}
      </div>`;
  }

  // Pending verzoek van deze speler
  const pending = myId && _ownership.requests.find(
    r => r.itemId === itemId && r.requesterId === myId && r.status === 'pending'
  );
  if (pending) {
    return `<div class="item-claim-pending" onclick="event.stopPropagation()">⏳ Wacht op DM…</div>`;
  }

  // Geef-knop voor DM (geen eigenaar, niet stapelbaar)
  if (isDm) {
    return `
      <button class="item-give-btn item-give-btn--standalone" onclick="event.stopPropagation();window._itemGiveToPlayer('${esc(itemId)}')" title="Geef aan speler">
        ${icon('package')} Geef aan speler
      </button>`;
  }

  // Claim-knop voor ingelogde speler (niet stapelbaar)
  if (myName && !isDm) {
    return `
      <button class="item-claim-btn" onclick="event.stopPropagation();window._itemClaim('${esc(itemId)}')">
        Claim
      </button>`;
  }

  return '';
}

// ── DM: voorwerp geven aan speler ──

// Bouw de picker-HTML op basis van huidige _ownership-staat
async function _buildItemGivePicker(itemId, spelers, groupNames) {
  const isStapelbaar = _ownership.stapelbaar.has(itemId);
  const isGedeeld    = _ownership.gedeeld.has(itemId);
  const owners       = _ownership.owners[itemId];

  // Huidige eigendom per characterId opzoeken
  function currentQty(charId) {
    if (Array.isArray(owners)) {
      const entry = owners.find(o => o.characterId === charId);
      return entry ? (entry.qty || 1) : 0;
    }
    // enkelvoudig eigendom
    return (owners?.characterId === charId) ? 1 : 0;
  }

  const byGroup = {};
  for (const s of spelers) {
    const gid = s.data?.groep || '_geen';
    if (!byGroup[gid]) byGroup[gid] = [];
    byGroup[gid].push(s);
  }

  const sections = Object.entries(byGroup).map(([gid, members]) => {
    const label = groupNames[gid] || (gid === '_geen' ? 'Zonder groep' : gid);
    return `
      <div class="item-give-group">
        <div class="item-give-group-label">${esc(label)}</div>
        ${members.map(s => {
          const qty = currentQty(s.id);
          const hasIt = qty > 0;
          const qtyBadge = hasIt
            ? `<span class="item-give-qty-badge">${isStapelbaar ? `×${qty}` : '✓'}</span>`
            : '';
          if (isStapelbaar) return `
            <div class="item-give-player-row">
              <div class="item-give-player-info">
                <img src="${api.fileForEntity(s)}" class="item-give-avatar" onerror="this.style.display='none'">
                <span>${esc(s.name)}</span>
                ${qtyBadge}
              </div>
              <input type="number" min="1" value="1" id="igq-${esc(s.id)}"
                class="item-give-qty-input" onclick="event.stopPropagation()">
              <button class="item-give-confirm-btn"
                onclick="window._itemAssignToPlayer('${esc(itemId)}','${esc(s.id)}','${escJS(s.name)}','${escJS(s.data?.groep || '')}',+(document.getElementById('igq-${esc(s.id)}').value)||1)">
                ${icon('package')}
              </button>
            </div>`;
          if (isGedeeld) return `
            <button class="item-give-player-btn${hasIt ? ' item-give-player-btn--has' : ''}"
              onclick="window._itemAssignToPlayer('${esc(itemId)}','${esc(s.id)}','${escJS(s.name)}','${escJS(s.data?.groep || '')}',1)">
              <img src="${api.fileForEntity(s)}" class="item-give-avatar" onerror="this.style.display='none'">
              <span>${esc(s.name)}</span>
              ${qtyBadge}
            </button>`;
          // Enkelvoudig eigendom
          return `
            <button class="item-give-player-btn${hasIt ? ' item-give-player-btn--has' : ''}"
              onclick="window._itemAssignToPlayer('${esc(itemId)}','${esc(s.id)}','${escJS(s.name)}','${escJS(s.data?.groep || '')}')">
              <img src="${api.fileForEntity(s)}" class="item-give-avatar" onerror="this.style.display='none'">
              <span>${esc(s.name)}</span>
              ${qtyBadge}
            </button>`;
        }).join('')}
      </div>`;
  }).join('');

  const subtitle = isStapelbaar ? 'Kies een ontvanger en aantal' : isGedeeld ? 'Kies spelers (meerdere mogelijk)' : 'Kies een ontvanger';
  return { html: `<div class="item-give-picker">${sections}</div>`, subtitle };
}

// Cache spelers/groepen zodat herrender na toewijzing snel is
let _givePickerCache = null;

window._itemGiveToPlayer = async function(itemId) {
  try {
    const [allPersonages, allGroups] = await Promise.all([
      api.listEntities('personages'),
      api.getGroups().catch(() => []),
    ]);
    const spelers = allPersonages.filter(e => e.subtype?.toLowerCase() === 'speler');
    if (!spelers.length) { alert('Geen spelerskarakters gevonden.'); return; }
    const groupNames = Object.fromEntries((allGroups?.groups || allGroups || []).map(g => [g.id, g.name]));
    _givePickerCache = { itemId, spelers, groupNames };

    const { html, subtitle } = await _buildItemGivePicker(itemId, spelers, groupNames);
    window.app.openModal(`${icon('package')} Geef voorwerp aan speler`, subtitle, html);
  } catch (e) {
    console.warn('_itemGiveToPlayer fout:', e);
  }
};

window._itemAssignToPlayer = async function(itemId, characterId, playerName, groupId, qty) {
  try {
    await api.assignItemOwner(itemId, { characterId, playerName, groupId: groupId || null, qty: qty || 1 });
    await refreshOwnership();
    renderEntitySection('voorwerpen');
    // Herrender de picker in de open modal (sluit NIET)
    if (_givePickerCache?.itemId === itemId) {
      const { itemId: id, spelers, groupNames } = _givePickerCache;
      const { html } = await _buildItemGivePicker(id, spelers, groupNames);
      const body = document.getElementById('m-body');
      if (body) body.innerHTML = html;
    }
  } catch (e) {
    console.warn('_itemAssignToPlayer fout:', e);
  }
};

// ── Entity carousel (multi-image with captions) ──
const _ecp = {};   // entity carousel position
const _ecc = {};   // entity carousel captions

function _parseExtraImages(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function _entityCarouselHtml(key, items) {
  if (!items.length) return '';
  if (items.length === 1) {
    const url = api.fileUrl(items[0].id);
    return `
      <div class="detail-hero mb-6" id="detail-img-wrap-${key}" onclick="window.app.openLightbox('${url}','')">
        <div class="detail-hero-bg" style="background-image:url('${url}')"></div>
        <img src="${url}" class="detail-hero-img"
          onerror="this.closest('#detail-img-wrap-${key}').style.display='none'">
        <div class="detail-hero-overlay"></div>
      </div>
      ${items[0].caption ? `<p class="text-center text-xs text-ink-dim font-crimson -mt-3 mb-3 italic">${esc(items[0].caption)}</p>` : ''}`;
  }
  _ecp[key] = 0;
  _ecc[key] = items.map(i => i.caption || '');
  // Vergroten moet dóór de reeks kunnen bladeren: de lightbox kent een variant
  // met een lijst en pijltjes, maar kreeg hier steeds één losse afbeelding mee.
  const lbKey = `_ecLb_${key.replace(/[^A-Za-z0-9_]/g, '')}`;
  window[lbKey] = items.map(i => ({ src: api.fileUrl(i.id), title: i.caption || '' }));
  return `
    <div class="mb-4">
      <div class="relative">
        <div class="overflow-hidden rounded">
          <div id="ec-track-${key}" class="flex" style="transition:transform 0.3s ease">
            ${items.map(({id}, i) => {
              const url = api.fileUrl(id);
              return `<div class="flex-shrink-0 w-full relative overflow-hidden">
                <div class="detail-hero-bg" style="background-image:url('${url}')"></div>
                <img src="${url}" class="detail-portrait w-full max-h-80 object-contain cursor-pointer" style="position:relative;z-index:1"
                  onclick="window.app.openLightboxAt(window['${lbKey}'],${i})">
              </div>`;
            }).join('')}
          </div>
        </div>
        <button class="ec-pijl ec-pijl--links" title="Vorige afbeelding"
          onclick="window._ecStep('${key}',-1,${items.length})">\u2039</button>
        <button class="ec-pijl ec-pijl--rechts" title="Volgende afbeelding"
          onclick="window._ecStep('${key}',1,${items.length})">\u203a</button>
      </div>
      <div class="flex justify-center gap-1.5 mt-2">
        ${items.map((_, i) => `<span id="ec-dot-${key}-${i}" onclick="window._ecGo('${key}',${i},${items.length})"
          class="block w-2 h-2 rounded-full cursor-pointer transition ${i === 0 ? 'bg-gold' : 'bg-room-border'}"></span>`).join('')}
      </div>
      <div id="ec-cap-${key}" class="text-center text-xs text-ink-dim font-crimson mt-1.5 italic min-h-[1.2em]">${esc(items[0].caption || '')}</div>
    </div>`;
}

window._ecStep = (key, dir, total) => {
  window._ecGo(key, ((_ecp[key] || 0) + dir + total) % total, total);
};
window._ecGo = (key, idx, total) => {
  _ecp[key] = idx;
  const track = document.getElementById(`ec-track-${key}`);
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  for (let i = 0; i < total; i++) {
    const dot = document.getElementById(`ec-dot-${key}-${i}`);
    if (dot) dot.className = `block w-2 h-2 rounded-full cursor-pointer transition ${i === idx ? 'bg-gold' : 'bg-room-border'}`;
  }
  const capEl = document.getElementById(`ec-cap-${key}`);
  if (capEl) capEl.textContent = (_ecc[key] || [])[idx] || '';
};

// ── Entity extra-image editor ──
function _refreshEntityImages() {
  const c = document.getElementById('entity-img-preview');
  if (!c) return;
  // Geen onderschriften meer, wel een ster: die maakt van deze afbeelding de
  // banner (het beeld op de kaart en bovenaan het detailvenster).
  c.innerHTML = entityEditorImages.map((img, i) => `
        <div>
          <div class="relative rounded overflow-hidden border border-room-border bg-room-elevated" style="height:56px">
            <img src="${img.url}" class="w-full h-full object-cover">
            <button type="button" onclick="window._maakBanner(${i})" title="Maak dit de banner"
              class="absolute top-0.5 left-0.5 w-5 h-5 bg-black/60 hover:bg-black/85 text-white rounded-full text-[11px] flex items-center justify-center transition">\u2606</button>
            <button type="button" onclick="window._removeEntityImage(${i})" title="Loskoppelen"
              class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full text-xs flex items-center justify-center transition">\u00d7</button>
          </div>
        </div>`).join('');
}

// De banner is `data.imageId`; wat je hier aanwijst wisselt van plek met wat er
// stond. Een nieuw kaartje zonder banner krijgt hem gewoon.
window._maakBanner = (idx) => {
  const gekozen = entityEditorImages[idx];
  if (!gekozen || gekozen.isNew) {
    if (gekozen?.isNew) alert('Sla eerst op; een net toegevoegde afbeelding kan daarna banner worden.');
    return;
  }
  const veld = document.getElementById('editor-image-id');
  const oudeBanner = veld?.value || '';
  if (veld) veld.value = gekozen.id;
  entityEditorImages.splice(idx, 1);
  if (oudeBanner) entityEditorImages.unshift({ id: oudeBanner, url: api.fileUrl(oudeBanner), isNew: false, caption: '' });
  window._fpZetBron(gekozen.id);
  _refreshEntityImages();
};

// ── Detail view ──
let _detailToken = 0;   // Annuleer concurrent _openDetail aanroepen

window._openDetail = async (tab, id, isBack = false, openTabKey = null) => {
  const myToken = ++_detailToken;   // Uniek token voor deze aanroep

  const prevTab = window._currentDetailTab;
  const prevId  = window._currentDetailId;

  if (!isBack) {
    if (prevId && prevId !== id) {
      _pushHistory(prevTab, prevId);
    } else if (!prevId) {
      _clearHistory();
    }
  }
  window._currentDetailTab = tab;
  window._currentDetailId  = id;

  let e, playerNotesData, uitverkochtData, beschikbaarData, shopCurrencyData;
  let _bladProfiel = null, _bladHp = null;
  let shopLogData = null;
  let shopHumeurData = null;
  const _isShopTab = (tab === 'locaties' || tab === 'personages');
  try {
    [e, playerNotesData, uitverkochtData, beschikbaarData, shopCurrencyData] = await Promise.all([
      api.getEntity(tab, id),
      api.getPlayerNotes(id).catch(() => null),
      _isShopTab
        ? api.getShopUitverkocht(id).catch(() => ({ uitverkocht: [] }))
        : Promise.resolve({ uitverkocht: [] }),
      _isShopTab
        ? api.getShopBeschikbaar(id).catch(() => null)
        : Promise.resolve(null),
      (_isShopTab && !isDM())
        ? Promise.all([
            api.getPlayerCurrency(window.app?.state?.characterId).catch(() => ({ fl: 0, kn: 0, cl: 0 })),
            api.getPartyCurrency().catch(() => ({ enabled: false, fl: 0, kn: 0, cl: 0 })),
          ]).then(([player, party]) => ({ player, party }))
        : Promise.resolve(null),
    ]);
    // Het blad van een speler komt uit hetzelfde profiel als de print, zodat
    // scherm en papier hetzelfde laten zien.
    if (tab === 'personages' && isDM() && e?.subtype === 'speler') {
      [_bladProfiel, _bladHp] = await Promise.all([
        api.getPlayerProfile(id).catch(() => null),
        api.getPlayerHp(id).catch(() => null),
      ]);
    }
  } catch { return; }
  if (_isShopTab && isDM()) {
    [shopLogData, shopHumeurData] = await Promise.all([
      api.getShopLog(id).catch(() => null),
      api.getShopHumeur(id).catch(() => null),
    ]);
  }
  // Zorg dat de wikilink-naamindex volledig geladen is voor we de beschrijving renderen
  await window._entityIndexReady?.catch(() => {});
  const uitverkochtSet = new Set((uitverkochtData?.uitverkocht || []).map(k => k.toLowerCase().trim()));
  if (myToken !== _detailToken) return;   // Nieuwere aanroep actief — stop
  const meta = TYPE_META[tab];
  const schema = SCHEMA[tab];
  const vis = e._visibility || 'visible';
  const isPersonage = tab === 'personages';
  // Dezelfde markering heet niet overal hetzelfde: een gebouw gaat niet dood.
  const _wegLabel = { locaties: 'Verwoest', organisaties: 'Opgeheven', voorwerpen: 'Verloren' }[tab] || 'Overleden';
  // Een leeg blad is een lege tab: alleen tonen als er iets in staat. `hp` en
  // `ac` tellen niet als "iets" wanneer de rest leeg is — dat is de minimale
  // invulling voor de monsterlijst, geen character sheet.
  const _sheetGevuld = Object.values(e.stats || {}).some(v => String(v ?? '').trim());
  // Een huisdier heeft zijn statblok in tiers staan, niet in `stats`; het blad
  // wordt gevuld met het tier dat bij het level van het baasje hoort.
  const _isDier   = isPersonage && String(e.subtype || '').toLowerCase() === 'dier';
  const _isSpeler = isPersonage && String(e.subtype || '').toLowerCase() === 'speler';
  const showSheet = isPersonage && isDM() && (_sheetGevuld || _isDier);
  const fileUrl = api.fileForEntity(e);

  // ── Tab: Info ──
  let infoHtml = '';

  // Image(s) — carousel when extra images exist, else single portrait
  const _extraImgs = _parseExtraImages(e.data?.extraImages);
  // Het onderschrift bij het portret staat tijdelijk uit: in de praktijk botste
  // het met de weergavenaam in de mediabibliotheek. Data en code blijven staan,
  // dus terugzetten is deze regel terugdraaien. (Onderschriften bij de extra
  // afbeeldingen in de carousel blijven wél gewoon werken.)
  const _primaryCaption = '';   // was: e.data?.imgCaption || ''
  const _heroBadges = getCardBadges(tab, e);
  // Afbeelding — simpel gecentreerd met perkamentachtergrond
  const _d = e.data || {};
  // Armor AC pill — berekend voor hero-overlay en chips-sectie
  const _detailDexMod = (typeof window._playerDexMod === 'number') ? window._playerDexMod : null;
  const _detailAcResult = (tab === 'voorwerpen' && e.data?.armorType) ? _calcArmorAC(e.data, _detailDexMod) : null;
  const _rolVal = e.data?.rol;
  if (_extraImgs.length > 0) {
    // De banner leeft sinds de mediabibliotheek in data.imageId; alleen oude
    // kaartjes hebben hun portret nog onder het entity-id staan. Stond hier
    // hard `e.id`, waardoor de eerste dia een gebroken plaatje was.
    const _allImgs = [{ id: e.data?.imageId || e.id, caption: _primaryCaption }, ..._extraImgs];
    infoHtml += _entityCarouselHtml(e.id, _allImgs);
  } else {
    infoHtml += `
      <div class="detail-hero detail-hero--portret mb-6" id="detail-img-wrap-${e.id}" onclick="window.app.openLightbox('${fileUrl}','${escJS(e.name)}')">
        <div class="detail-hero-bg" style="background-image:url('${fileUrl}')"></div>
        <img src="${fileUrl}" class="detail-hero-img"
          style="${_d.imgFocus ? `object-position:${_d.imgFocus}` : ''}"
          onerror="this.closest('#detail-img-wrap-${e.id}').style.display='none'">
        <div class="detail-hero-overlay"></div>
        ${_detailAcResult
          ? `<span class="detail-hero-ac-badge" data-wptip="${escJS(_detailAcResult.tooltip)}">${esc(_detailAcResult.pill)}</span>`
          : `<div class="detail-hero-icon">${getAutoIconSvg(tab, e)}</div>`}
        ${_heroBadges.length ? `<div class="detail-hero-badges">${_heroBadges.map(b => `<span class="detail-hero-badge badge ${b.cls}">${esc(b.label)}</span>`).join('')}</div>` : ''}
        ${_rolVal ? `<div class="detail-hero-rol">${esc(_rolVal)}</div>` : ''}
      </div>
      ${_primaryCaption ? `<p class="text-center text-xs text-ink-dim font-crimson -mt-3 mb-3 italic">${esc(_primaryCaption)}</p>` : ''}
    `;
  }

  // Upload en audio-beheer staan in de bewerkmodus (openEditor), niet in de detailview

  // De korte omschrijving stond hier nog eens als losse badge onder het beeld.
  // Sinds hij als eerste deel van de regel onder de naam staat (rol · origin ·
  // class · alignment) is dat een herhaling.

  // Voorwerpen: rariteit + attunement als compacte subtitelrij direct onder hero
  if (tab === 'voorwerpen') {
    const _rar = e.data?.rariteit;
    const _att = e.data?.attunement === true || e.data?.attunement === 'true';
    if (_rar || _att) {
      const _rarK = _rarityKey(_rar);
      infoHtml += `<div class="detail-item-subtitle">
        ${_rar ? `<span class="detail-item-rarity"${_rarK ? ` data-rarity="${_rarK}"` : ''}>${esc(_rarityLabel(_rar))}</span>` : ''}
        ${_att ? `<span class="detail-item-attunement">Requires Attunement</span>` : ''}
      </div>`;
    }
    // Schade / Genezing pill — klikbaar, resultaat direct inline in modal
    const _dmg = e.data?.damage;
    if (_dmg) {
      const _isHeal = /heal/i.test(_dmg);
      infoHtml += `<div class="detail-item-damage-wrap">
        <button class="item-damage-pill${_isHeal ? ' item-damage-pill--heal' : ''}"
          onclick="window.dice?.rollFormula('${escJS(_dmg)}','dmg-inline-result')"
          title="Klik om ${_isHeal ? 'genezing' : 'schade'} te gooien">
          ${icon('dice',{cls:'icon-gi'})} ${esc(_dmg)}
        </button>
        <span class="dmg-inline-result" id="dmg-inline-result"></span>
      </div>`;
    }
    // Wapeneigenschappen chips
    const _wprops = (() => { try { return JSON.parse(e.data?.weaponProperties || '[]'); } catch { return []; } })();
    if (_wprops.length) {
      infoHtml += `<div class="detail-weapon-props">
        ${_wprops.map(p => {
          const _base = p.replace(/\s*\(.*\)$/, '').trim();
          const desc = WEAPON_PROPERTIES[p] || WEAPON_PROPERTIES[_base] || '';
          return `<span class="detail-weapon-tag" data-wptip="${escJS(desc)}">${esc(p)}</span>`;
        }).join('')}
      </div>`;
    }
    // Pantsereigenschappen chips (AC zit als overlay in het hero-beeld; hier alleen Stealth en Str)
    if (_detailAcResult) {
      const _stealth = e.data?.stealthDisadvantage === true || e.data?.stealthDisadvantage === 'true';
      const _strReq  = parseInt(e.data?.strengthRequirement) || 0;
      // AC pill als fallback wanneer er een extra-images-carousel is (geen detail-hero)
      const _acFallback = _extraImgs.length > 0
        ? `<span class="detail-armor-tag detail-armor-tag--ac" data-wptip="${escJS(_detailAcResult.tooltip)}">${esc(_detailAcResult.pill)}</span>`
        : '';
      if (_stealth || _strReq || _acFallback) {
        infoHtml += `<div class="detail-armor-props">
          ${_acFallback}
          ${_stealth ? `<span class="detail-armor-tag detail-armor-tag--stealth" data-wptip="You have disadvantage on Dexterity (Stealth) checks while wearing this armor.">Stealth ↓</span>` : ''}
          ${_strReq ? `<span class="detail-armor-tag detail-armor-tag--str" data-wptip="Your speed is reduced by 10 feet unless you have a Strength score of ${_strReq} or higher.">Str ${_strReq}</span>` : ''}
        </div>`;
      }
    }
  }

  // Scroll spell stats block
  if (tab === 'voorwerpen' && e.data?.itemType === 'Scroll') {
    const _ct = e.data?.spellCastingTime;
    const _sr = e.data?.spellRange;
    const _sc = e.data?.spellComponents;
    const _sd = e.data?.spellDuration;
    if (_ct || _sr || _sc || _sd) {
      infoHtml += `<div class="detail-scroll-stats">
        ${_ct ? `<span class="detail-scroll-stat"><span class="scroll-stat-lbl">Casting Time</span>${esc(_ct)}</span>` : ''}
        ${_sr ? `<span class="detail-scroll-stat"><span class="scroll-stat-lbl">Range</span>${esc(_sr)}</span>` : ''}
        ${_sc ? `<span class="detail-scroll-stat"><span class="scroll-stat-lbl">Components</span>${esc(_sc)}</span>` : ''}
        ${_sd ? `<span class="detail-scroll-stat"><span class="scroll-stat-lbl">Duration</span>${esc(_sd)}</span>` : ''}
      </div>`;
    }
  }

  // Blessing block
  if (tab === 'voorwerpen' && e.data?.itemType === 'Blessing') {
    const _gType   = e.data?.goddelijkType || '';
    const _gGod    = e.data?.godNaam || '';
    const _gEffect = e.data?.effect || '';
    const _eedTekst = e.data?.eedTekst || '';
    const _permZegen = e.data?.permanenteZegen || '';
    const _typeLabel = _gType === 'zegen' ? 'Zegening' : _gType === 'eed' ? 'Eed' : _gType === 'vloek' ? 'Vloek' : 'Blessing';
    const _typeIcon  = _gType === 'vloek' ? icon('skull') : _gType === 'eed' ? icon('scroll-text') : icon('sparkles');
    infoHtml += `<div class="detail-divine-block">
      <div class="detail-divine-header">${_typeIcon} ${esc(_typeLabel)}${_gGod ? ` van ${esc(_gGod)}` : ''}</div>
      ${_gEffect ? `<div class="detail-divine-effect detail-divine-effect--titel">${esc(_gEffect)}</div>` : ''}
      ${(_gType === 'eed' && _permZegen) ? `<div class="detail-divine-effect" style="margin-top:8px"><strong>Permanente zegen:</strong> ${esc(_permZegen)}</div>` : ''}
      ${_eedTekst ? `<div class="detail-divine-effect" style="margin-top:10px;font-style:italic">${esc(_eedTekst)}</div>` : ''}
    </div>`;
  }

  // Short metadata → labeled pills; description → block
  const _metaPills = [];
  let _descVal = '';
  for (const field of (schema.fields || [])) {
    if (['geheim', 'flavour', 'rol', 'stapelbaar', 'gedeeld', 'gebruik', 'attunement', 'persoonlijkheid', 'nietVerkoopbaar'].includes(field.key)) continue;
    // Wat al onder de naam staat (rol · origin · class · alignment · type)
    // hoeft er niet nóg eens als pil onder: dat was de helft van de pillenrij.
    if (['ras', 'klasse', 'alignment', 'domein', 'locType', 'wijk', 'orgType', 'itemType', 'rariteit'].includes(field.key)) continue;
    // Geheimen, flavours en rollen hebben verderop hun eigen weergave (rollen
    // een badge, de lijsten een perkamentrol per regel). Als pil toonden ze
    // hun ruwe JSON: ["Groot hater van jam."].
    if (['lijst-tekst', 'rollen'].includes(field.type)) continue;
    // Betrokkenen heeft zijn eigen rij chips hieronder; als pil kwam zijn ruwe
    // JSON in beeld.
    if (field.type === 'betrokkenen') continue;
    if (tab === 'voorwerpen' && ['itemType', 'rariteit', 'damage', 'weaponProperties', 'armorType', 'armorBaseAC', 'armorDexCap', 'stealthDisadvantage', 'strengthRequirement', 'spellPick', 'spellCastingTime', 'spellRange', 'spellComponents', 'spellDuration', 'godNaam', 'goddelijkType', 'effect', 'permanenteZegen', 'eedTekst'].includes(field.key)) continue;
    const val = e.data?.[field.key];
    if (!val) continue;
    if (field.key === 'desc') {
      _descVal = val;
    } else {
      _metaPills.push(`<span class="detail-meta-pill"><span class="pill-lbl">${esc(field.label)}</span>${esc(val)}</span>`);
    }
  }
  if (_metaPills.length) {
    infoHtml += `<div class="detail-meta-pills">${_metaPills.join('')}</div>`;
  }
  // Wie hoort hier bij: gekoppelde namen zijn knoppen naar hun eigen kaartje,
  // losse namen blijven gewoon leesbaar staan.
  const _betrokkenen = ['locaties', 'organisaties'].includes(tab) ? _betrokkenenUit(e.data) : [];
  if (_betrokkenen.length) {
    infoHtml += `<div class="detail-betrokkenen">
      ${_betrokkenen.map(r => {
        const naam = r.id
          ? `<button type="button" class="link-chip link-chip--sm" onclick="window._openKaartjeOpId('${esc(r.id)}')">${esc(r.naam)}</button>`
          : `<span class="betrokken-naam">${esc(r.naam)}</span>`;
        return `<span class="betrokken-chip">${r.rol ? `<span class="pill-lbl">${esc(r.rol)}</span>` : ''}${naam}</span>`;
      }).join('')}
    </div>`;
  }
  // En de andere kant op: waar dít kaartje bij hoort. Afgeleid door de server
  // uit de betrokkenen-lijsten van locaties en organisaties, dus er staat nooit
  // iets anders dan daar ingevuld is.
  const _hoortBij = Array.isArray(e._hoortBij) ? e._hoortBij : [];
  if (_hoortBij.length) {
    infoHtml += `<div class="detail-betrokkenen detail-hoortbij">
      <span class="hoortbij-kop">${icon('link')} Hoort bij</span>
      ${_hoortBij.map(r => `<span class="betrokken-chip">${r.rol ? `<span class="pill-lbl">${esc(r.rol)}</span>` : ''}<button
        type="button" class="link-chip link-chip--sm"
        onclick="window._openDetail('${esc(r.type)}','${esc(r.id)}')">${esc(r.name)}</button></span>`).join('')}
    </div>`;
  }
  if (tab === 'locaties' && window._pinnedLocIds?.has(e.id)) {
    infoHtml += `<div class="detail-map-link-wrap">
      <button class="detail-map-link-btn" onclick="window._toonOpKaart('${esc(e.id)}')">
        ${icon('map-pin')} Toon op kaart
      </button>
    </div>`;
  }
  if (_descVal) {
    // Voorwerpbeschrijvingen krijgen hover-uitleg bij D&D-begrippen
    const _descHtml = mdToHtml(_descVal);
    infoHtml += `<div class="detail-desc mb-4">${tab === 'voorwerpen' ? (window.glossary?.annotate?.(_descHtml) ?? _descHtml) : _descHtml}</div>`;
  }

  // "Verkoopt bij <locatie>" in het infopaneel, met doorklik.
  const _winkelLocId = tab === 'personages' ? (e.data?.winkelLocatieId || '') : '';
  if (_winkelLocId) {
    const _locNaam = Object.entries(window._entityNameIndex || {})
      .find(([, v]) => v.id === _winkelLocId && v.type === 'locaties')?.[0];
    if (_locNaam) {
      infoHtml += `
        <div class="detail-winkel-link mb-4">
          ${icon('package')}
          <span>Verkoopt bij</span>
          <button type="button" onclick="window._openDetail('locaties','${esc(_winkelLocId)}',false,'voorraad')">${esc(_locNaam)}</button>
        </div>`;
    }
  }

  // Flavour scroll (parchment scroll — zichtbaar voor spelers als uitgesproken, altijd voor DM)
  const flavourRegels = _tekstLijstUit(e.data, 'flavours', 'flavour');
  const _gezegd = (() => {
    // Een speler krijgt van de server alléén de regels die al verteld zijn —
    // de bijbehorende ja/nee-lijst hoort bij de volledige tekst en past er dus
    // niet op. Voor hem is alles wat hij ziet per definitie verteld.
    if (!isDM()) return flavourRegels.map(() => true);
    const rauw = e.data?.flavoursUitgesproken;
    if (Array.isArray(rauw)) return flavourRegels.map((_, i) => !!rauw[i]);
    const alles = e.data?.flavourUitgesproken === true || e.data?.flavourUitgesproken === 'true';
    return flavourRegels.map((_, i) => alles && i === 0);
  })();
  const _audioId   = e.data?.audioId || '';
  const zichtbareFlavours = flavourRegels.map((tekst, i) => ({ tekst, i, gezegd: _gezegd[i] }))
    .filter(r => isDM() || r.gezegd);
  if (zichtbareFlavours.length || (isDM() && !flavourRegels.length && _audioId)) {
    infoHtml += `<div class="detail-divider">— ✦ —</div>`;
    // Eén rol perkament met pijltjes erdoorheen, net als op het kaartje: drie
    // roddels onder elkaar maakten van een terloopse opmerking een lijst.
    _flavCache[`det-${e.id}`] = zichtbareFlavours;
    _flavPos[`det-${e.id}`]   = 0;
    _flavCtx[`det-${e.id}`]   = { tab, id: e.id, audioId: _audioId, soort: 'roddel' };
    const _verteld = _gezegd.filter(Boolean).length;
    infoHtml += `
      <div class="mb-4">
        <div class="detail-field-label detail-field-label--roddel">
          <span class="dfl-titel">${icon('beer')} ${flavourRegels.length > 1 ? 'Roddels' : 'Roddel'}</span>${
          isDM() && flavourRegels.length ? `<span class="geheim-teller">${_verteld} van ${flavourRegels.length} onthuld</span>` : ''}</div>
        ${_onthulBlok(`det-${e.id}`)}
      </div>`;
  }

  // Geheimen: één blok per regel. De DM ziet ze allemaal met een oogje ernaast
  // om die ene vrij te geven; de speler ziet alleen wat onthuld is.
  const geheimRegels = _tekstLijstUit(e.data, 'geheimen', 'geheim');
  // Idem voor geheimen: de speler krijgt alleen de onthulde regels binnen. De
  // terugval "alleen de eerste telt" is er voor oude kaartjes bij de DM, maar
  // liet een speler van twee onthulde geheimen er één zien.
  const _geheimOnthuld = !isDM()
    ? geheimRegels.map(() => true)
    : Array.isArray(e._onthuld)
      ? geheimRegels.map((_, i) => !!e._onthuld[i])
      : geheimRegels.map((_, i) => !!e._secretReveal && i === 0);
  const zichtbareGeheimen = geheimRegels.map((tekst, i) => ({ tekst, i, onthuld: _geheimOnthuld[i] }))
    .filter(r => isDM() || r.onthuld);
  if (zichtbareGeheimen.length) {
    // Zelfde blok als de roddels: doorbladeren in plaats van alles uitklappen.
    // Drie geheimen onder elkaar duwden de rest van het kaartje van het scherm.
    const _antagVlag = isDM() ? _antagUit(e.data, geheimRegels.length) : [];
    _flavCache[`geh-${e.id}`] = zichtbareGeheimen.map(g => ({
      tekst: g.tekst, i: g.i, gezegd: g.onthuld, verraad: !!_antagVlag[g.i],
    }));
    _flavPos[`geh-${e.id}`]   = 0;
    _flavCtx[`geh-${e.id}`]   = { tab, id: e.id, soort: 'geheim', naam: e.name };
    infoHtml += `
      <div class="mb-4">
        <div class="detail-field-label detail-field-label--secret">
          <span class="dfl-titel">${icon('lock')} ${zichtbareGeheimen.length > 1 ? 'Geheimen' : 'Geheim'}</span>${
          isDM() && geheimRegels.length ? `<span class="geheim-teller">${_geheimOnthuld.filter(Boolean).length} van ${geheimRegels.length} onthuld</span>` : ''}</div>
        ${_onthulBlok(`geh-${e.id}`)}
      </div>`;
  }

  // Missies die aan dit kaartje hangen. Dat maakt "missiegever" een afgeleide:
  // wie een missie gaf, is missiegever — niets om apart bij te houden.
  if (['personages', 'organisaties'].includes(tab)) {
    infoHtml += `<div id="detail-missies-${e.id}"></div>`;
    _vulMissies(e.id, tab);
  }
  if (isPersonage && isDM() && String(e.subtype || '').toLowerCase() === 'npc') _vulMedestander(e.id);

  // DM controls
  if (isDM()) {
    const _ts = ['personages', 'locaties'].includes(tab);
    const _mVisIcon  = vis === 'visible' ? icon('eye')
                     : vis === 'vague'   ? icon('eye-off')
                     :                    icon('lock');
    const _mVisTitle = vis === 'visible' ? 'Verbergen  ·  Shift: vaag tonen'
                     : vis === 'vague'   ? 'Volledig tonen  ·  Shift: vaag houden'
                     : _ts              ? 'Zichtbaar maken  ·  Shift: vaag tonen'
                     :                    'Zichtbaar maken';
    infoHtml += `
      <div class="dm-only mt-4 pt-4 border-t border-room-border">
        <!-- Eén notitieveld: hetzelfde dat in de bewerkmodus "Aantekeningen voor
             de DM" heet. Er stonden er twee op één kaartje (dit veld en een
             losse dmNote), met verwarrend gelijke namen. Typen slaat direct op,
             dus je hoeft de editor niet te openen. -->
        <!-- Eerst je eigen aantekeningen, dan die van de spelers: dit is jouw
             venster, en wat je zelf typt hoort bovenaan. -->
        <div class="detail-label mb-1">Aantekeningen voor de DM</div>
        <textarea id="dm-note-${e.id}" class="notitie-vak"
          placeholder="Alleen jij ziet dit\u2026">${esc(e.data?.persoonlijkheid || '')}</textarea>
        <div id="note-save-${e.id}" class="text-xs text-green-wax opacity-0 transition-opacity mt-1 mb-3"></div>
        ${_spelersNotitiesHtml(e.id, playerNotesData)}
        <!-- Vijf gelijke vierkantjes met een pictogram zeiden niet wát ze doen.
             Nu icoon plus woord; de stand staat in het woord ("Zichtbaar" /
             "Verborgen"), niet alleen in de kleur. -->
        <div class="detail-dm-tools">
          <button class="dm-actie${vis !== 'hidden' ? ' dm-actie--aan' : ''}"
            title="${_mVisTitle}"
            onclick="window._toggleVis('${tab}','${e.id}',event)">
            ${_mVisIcon}<span>${vis === 'visible' ? 'Zichtbaar' : vis === 'vague' ? 'Vaag zichtbaar' : 'Verborgen'}</span>
          </button>
          <!-- Dezelfde markering (dagger + gedempte kaart), maar een gebouw gaat
               niet dood: per tabblad het woord dat er hoort te staan. -->
          <button class="dm-actie${e._deceased ? ' dm-actie--aan' : ''}"
            title="${e._deceased ? 'Markering verwijderen' : `Markeer als ${_wegLabel.toLowerCase()}`}"
            onclick="window._toggleDeceased('${tab}','${e.id}')">
            ${icon('skull', {cls:'icon-gi'})}<span>${_wegLabel}</span>
          </button>
          ${isPersonage && String(e.subtype || '').toLowerCase() === 'npc' ? `
            <button class="dm-actie" id="detail-medestander-${e.id}"
              title="Medestander: laat dit personage met de party meelopen"
              onclick="window._toggleMedestander('${e.id}')">
              ${icon('crossed-swords', {cls:'icon-gi'})}<span>Medestander</span>
            </button>
          ` : ''}
          <button class="dm-actie"
            title="Bewerk dit kaartje (afbeelding, tekst, geluid)"
            onclick="window._openEditor('${tab}','${e.id}')">
            ${icon('pencil')}<span>Bewerken</span>
          </button>
        </div>
      </div>
    `;

  }

  // Eigen spelersaantekening (zichtbaar voor ingelogde speler)
  const playerName = window.app?.state?.playerName;
  if (playerName && !isDM()) {
    const myNote = playerNotesData?.note || '';
    infoHtml += `
      <div class="mt-4 pt-4 border-t border-room-border">
        <div class="detail-label detail-label--gold mb-1">${icon('pencil')} Mijn aantekeningen</div>
        <textarea id="player-note-${e.id}"
          class="w-full min-h-[70px] px-3 py-2 bg-room-bg border border-room-border rounded text-sm text-ink-bright font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Notities voor jezelf...">${esc(myNote)}</textarea>
        <div id="player-note-save-${e.id}" class="text-xs text-green-wax opacity-0 transition-opacity mt-1"></div>
      </div>
    `;
  }

  // ── Tab: Character Sheet (DM + personages only) ──
  let sheetHtml = '';
  if (showSheet) {
    // Een speler heeft een echt blad (server-route, inclusief boedel, spreuken en
    // features); bij de rest is het statblok wat je naast je scherm legt.
    sheetHtml += `
      <div class="sheet-print-balk geenprint">
        ${_isSpeler
          ? `<a class="dm-actie" href="/api/characters/${esc(e.id)}/sheet" target="_blank" rel="noopener"
               title="Opent het blad in een nieuw tabblad; printen of bewaren als pdf doe je daar">
               ${icon('scroll-text')}<span>Blad afdrukken</span></a>`
          : `<button type="button" class="dm-actie" onclick="window._printStatblock('${escJS(e.name)}')"
               title="Opent een printvenster met alleen het statblock">
               ${icon('scroll-text')}<span>Statblock afdrukken</span></button>`}
      </div>`;
  }
  if (showSheet && _isDier) {
    // Het blad van een huisdier is zijn tier-statblok; dat halen we na het
    // openen op (zie _vulPetStatblock verderop).
    sheetHtml += `<div id="pet-statblock-slot" class="pet-statblock-slot"><p class="text-center text-ink-faint font-fell italic py-4">Statblock laden…</p></div>`;
  }
  if (showSheet && _isSpeler && _bladProfiel) {
    sheetHtml += _bladHtml(_bladProfiel, _bladHp, e);
  }
  // Een NPC of god is een wezen, geen personage met een sheet: dan het statblock
  // in dezelfde vorm als in het bestiarium.
  if (showSheet && !_isDier && !_isSpeler && Object.values(e.stats || {}).some(v => String(v ?? '').trim())) {
    const st = e.stats || {};
    sheetHtml += renderStatblock(
      { name: e.name, statblock: st, maxHp: parseInt(String(st.hp ?? '').match(/\d+/)?.[0] ?? '') || null, description: '' },
      { niveau: 'volledig' });
  }
  // Staat er niets? Dan zeggen we dat, in plaats van een leeg blad.
  if (showSheet && !sheetHtml.replace(/<div class="sheet-print-balk[\s\S]*?<\/div>/, '').trim()) {
    sheetHtml += `<div class="text-center py-10 text-ink-faint font-fell italic">Nog geen gegevens ingevuld</div>`;
  }

  // ── Tab: Eigenaren (stapelbare & gedeelde voorwerpen, DM only) ──
  const _gebruik = tab === 'voorwerpen' ? (_getGebruik(e) ) : 'uniek';
  const isStapelbaarVoorwerp = _gebruik === 'stapelbaar';
  const isGedeeldVoorwerp    = _gebruik === 'gedeeld';
  let eigenarenHtml = '';
  if ((isStapelbaarVoorwerp || isGedeeldVoorwerp) && isDM()) {
    const eigenaren = Array.isArray(_ownership.owners[e.id]) ? _ownership.owners[e.id] : [];
    if (eigenaren.length > 0) {
      eigenarenHtml = `
        <div class="rounded border border-room-border overflow-hidden mb-3">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-room-elevated border-b border-room-border">
                <th class="px-4 py-2.5 text-left font-cinzel text-ink-dim text-[10px] tracking-wide">Speler</th>
                ${isStapelbaarVoorwerp ? `<th class="px-4 py-2.5 text-center font-cinzel text-ink-dim text-[10px] tracking-wide">Aantal</th>` : ''}
                <th class="px-4 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              ${eigenaren.map((o, i) => `
                <tr class="${i % 2 === 1 ? 'bg-room-elevated/40' : ''} border-b border-room-border/40 last:border-0">
                  <td class="px-4 py-2.5 text-ink-bright font-crimson">${esc(o.playerName)}</td>
                  ${isStapelbaarVoorwerp ? `<td class="px-4 py-2.5 text-center">
                    <span class="inline-flex items-center gap-2">
                      <button onclick="window._eigenaarQtyAdj('${esc(e.id)}','${esc(o.characterId)}',-1)"
                        class="w-6 h-6 flex items-center justify-center rounded bg-room-bg border border-room-border text-ink-dim hover:text-ink-bright transition">−</button>
                      <span class="text-ink-bright font-cinzel w-6 text-center">${o.qty || 1}</span>
                      <button onclick="window._eigenaarQtyAdj('${esc(e.id)}','${esc(o.characterId)}',1)"
                        class="w-6 h-6 flex items-center justify-center rounded bg-room-bg border border-room-border text-ink-dim hover:text-ink-bright transition">+</button>
                    </span>
                  </td>` : ''}
                  <td class="px-4 py-2.5 text-right">
                    <button onclick="window._eigenaarVerwijder('${esc(e.id)}','${esc(o.characterId)}')"
                      class="text-seal hover:bg-seal/20 px-1.5 py-0.5 rounded transition text-xs" title="Verwijder eigendom">${icon('x')}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } else {
      eigenarenHtml = `<div class="text-center py-6 text-ink-faint font-fell italic">Geen eigenaren</div>`;
    }
    eigenarenHtml += `
      <button onclick="window._itemGiveToPlayer('${esc(e.id)}')"
        class="px-4 py-2 bg-room-elevated border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright transition">
        ${isGedeeldVoorwerp ? icon('package')+' Geef aan speler(s)' : icon('package')+' Geef exemplaren aan speler'}
      </button>`;
  }

  // ── Tab: Voorraad (winkels) ──
  // Een verkoper die naar een locatie wijst heeft zelf geen voorraadtab: daar
  // staat een doorklik naar de plek waar zijn waren liggen (zie hieronder).
  const isVerkoper   = window._heeftRol(e, 'verkoper');
  const isWinkel = tab === 'locaties'
    && (e.data?.locType === 'Winkel' || (e.data?.voorraad && e.data.voorraad !== '[]'));
  // Een verkoper heeft geen voorraadtab: de waren liggen bij de locatie. Alleen
  // een nog niet verhuisd kaartje met een eigen lijst houdt hem, anders zou die
  // voorraad onbereikbaar worden.
  const _eigenWaren = tab === 'personages' && e.data?.voorraad && e.data.voorraad !== '[]';
  const heeftVoorraad = _eigenWaren || isWinkel;

  let voorraadHtml = '';
  if (heeftVoorraad) {
    const _appMeta = window.app?.state?.meta || {};
    // Bereikbaarheid komt van de server (akte + de handmatige knop); hier alleen
    // nog opzoeken of dit kaartje er nu bij hoort.
    if (window._entiteitDicht?.(e.id)) {
      voorraadHtml = `<div style="text-align:center;padding:2rem 1rem">
        <div style="font-size:2rem;margin-bottom:.5rem">${icon('lock')}</div>
        <p style="color:var(--color-ink-dim,.7rem)">${esc(e.name)} is momenteel niet bereikbaar.</p>
        <p style="font-size:.8rem;opacity:.5">Niet bereikbaar vanaf waar de groep nu is.</p>
      </div>`;
    } else {
    // Gebruik beschikbaarData als die beschikbaar is, anders val terug op ruwe voorraad
    let voorraadItems;
    const roterend = beschikbaarData?.roterend || false;
    const geldigTot = beschikbaarData?.geldigTot || null;
    if (beschikbaarData?.items) {
      voorraadItems = beschikbaarData.items;
    } else {
      try { voorraadItems = e.data?.voorraad ? JSON.parse(e.data.voorraad) : []; } catch { voorraadItems = []; }
      voorraadItems = voorraadItems.map(item => ({
        ...item,
        uitverkocht: uitverkochtSet.has((item.naam || '').toLowerCase().trim()),
        actief: true,
      }));
    }

    // Beurs weergave (alleen voor spelers) — altijd persoonlijke beurs
    let beursHtml = '';
    if (!isDM() && shopCurrencyData) {
      const cur = shopCurrencyData.player;
      const _cN = window._currency || { fl: 'fl', kn: 'kn', cl: 'cl' };
      if (cur) {
        beursHtml = `<div class="shop-beurs">
          <span class="shop-beurs-label">${icon('coins')} Jouw beurs</span>
          <span class="shop-beurs-amount">${cur.fl ?? 0} ${esc(_cN.fl)} · ${cur.kn ?? 0} ${esc(_cN.kn)} · ${cur.cl ?? 0} ${esc(_cN.cl)}</span>
        </div>`;
      }
    }

    // Rotatie-timer
    let roterendHtml = '';
    if (roterend && geldigTot) {
      const diff = new Date(geldigTot) - Date.now();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      roterendHtml = `<div class="shop-rotatie-info">${icon('refresh-cw')} Assortiment ververst over ${h > 0 ? h + 'u ' : ''}${m}m</div>`;
    }

    const _shopId = e.id;
    const discountPct = beschikbaarData?.discountPct || 0;

    // Sfeer bovenaan
    const _sfeerTekst = beschikbaarData?.sfeerTekst || '';
    const _sfeerImageId = e.imageId || '';
    const sfeerHtml = (_sfeerTekst || _sfeerImageId) ? `
      <div class="shop-sfeer">
        ${_sfeerImageId ? `<img src="${api.fileUrl(_sfeerImageId)}" class="shop-sfeer-img" alt="">` : ''}
        ${_sfeerTekst ? `<p class="shop-sfeer-tekst">${esc(_sfeerTekst)}</p>` : ''}
      </div>` : '';

    const kortingBannerHtml = discountPct > 0
      ? `<div class="shop-korting-banner shop-korting-banner--ok">${icon('dice',{cls:'icon-gi'})} ${discountPct}% korting actief!</div>`
      : discountPct < 0
        ? `<div class="shop-korting-banner shop-korting-banner--malus">${icon('dice',{cls:'icon-gi'})} Prijs ${Math.abs(discountPct)}% hoger</div>`
        : '';

    // De speler verkocht hier zelf spullen aan de winkel; dat gaat nu via de
    // DM ("Inkopen van de party" onderaan dit venster), zodat er één plek is
    // waar prijs en eigendom tegelijk veranderen.

    if (voorraadItems.length > 0) {
      // De onderhandelknop met DC-worp is vervallen: afdingen gebeurt aan
      // tafel en de DM tikt het afgesproken bedrag in.

      voorraadHtml = `
        ${sfeerHtml}
        ${kortingBannerHtml}
        ${beursHtml}
        ${roterendHtml}
        <div class="rounded border border-room-border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-room-elevated border-b border-room-border">
                <th class="px-4 py-2.5 text-left font-cinzel text-ink-dim text-[10px] tracking-wide">Voorwerp</th>
                <th class="px-4 py-2.5 text-right font-cinzel text-ink-dim text-[10px] tracking-wide">Prijs</th>
                ${isDM() && roterend ? `<th class="px-3 py-2.5 text-center font-cinzel text-ink-dim text-[10px] uppercase" title="Actief voor spelers">✦</th>` : ''}
                ${isDM() ? `<th class="px-3 py-2.5 text-center font-cinzel text-ink-dim text-[10px] tracking-wide" title="Uitverkocht">UV</th>` : ''}
                ${isDM() ? `<th class="px-3 py-2.5 text-center font-cinzel text-ink-dim text-[10px] tracking-wide" title="Afrekenen aan tafel">\u2014</th>` : ''}
                ${!isDM() ? `<th class="px-2 py-2.5"></th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${voorraadItems.map((item, i) => {
                const uitverkocht = item.uitverkocht;
                const actief = item.actief;
                const thumbHtml = item.imageId
                  ? `<img src="${api.fileUrl(item.imageId)}" class="shop-item-thumb" alt="">`
                  : '';
                const naamHtml = item.entityId
                  ? `<span class="cursor-pointer hover:text-gold transition underline decoration-dotted${uitverkocht ? ' winkel-uitverkocht-naam' : ''} shop-item-with-desc"
                       onclick="window._openDetailFromShop('${esc(item.entityId)}')"
                       data-desc="${esc(item.desc || '')}">${esc(item.naam || '\u2014')}</span>`
                  : `<span class="${uitverkocht ? 'winkel-uitverkocht-naam' : ''}">${esc(item.naam || '\u2014')}</span>`;
                return `
                <tr class="${i % 2 === 1 ? 'bg-room-elevated/40' : ''} border-b border-room-border/40 last:border-0${uitverkocht ? ' winkel-uitverkocht-rij' : ''}">
                  <td class="px-4 py-2.5 font-crimson">
                    <div class="flex items-center gap-2">
                      ${thumbHtml}${naamHtml}
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-right font-crimson ${uitverkocht ? 'text-ink-faint' : 'text-ink-medium'}">
                    ${esc(item.prijs || '\u2014')}
                    ${!uitverkocht && discountPct > 0 ? `<span class="shop-korting-badge">-${discountPct}%</span>` : ''}
                    ${!uitverkocht && discountPct < 0 ? `<span class="shop-korting-badge shop-korting-badge--malus">+${Math.abs(discountPct)}%</span>` : ''}
                  </td>
                  ${isDM() && roterend ? `<td class="px-3 py-2.5 text-center">${actief ? '<span class="shop-actief-badge" title="Actief voor spelers">✦</span>' : ''}</td>` : ''}
                  ${isDM() ? `
                  <td class="px-3 py-2.5 text-center">
                    <input type="checkbox" class="winkel-uitverkocht-cb" title="Uitverkocht voor deze party"
                      ${uitverkocht ? 'checked' : ''}
                      onchange="window._toggleShopUitverkocht('${esc(_shopId)}','${esc(item.naam || '')}',this)">
                  </td>
                  <td class="px-3 py-2.5 text-center">
                    <button class="dm-btn dm-btn-sm dm-btn-icon" title="Afrekenen met een speler"
                      onclick="window._dmAfrekenen('${esc(_shopId)}','${escJS(item.naam || '')}','${esc(item.entityId || '')}','${escJS(item.prijs || '')}')">
                      ${icon('coins')}
                    </button>
                  </td>` : ''}
                  ${!isDM() ? `
                  <td class="px-2 py-2.5 text-right">
                    ${uitverkocht ? `<span class="text-xs text-ink-faint italic">Uitverkocht</span>` : `
                      <div class="flex items-center gap-1 justify-end">
                        ${item.stapelbaar ? `
                          <input type="number" min="1" max="99" value="1"
                            class="shop-qty-input" id="shop-qty-${i}"
                            onclick="event.stopPropagation()" oninput="this.value=Math.max(1,parseInt(this.value)||1)">
                        ` : ''}
                        <button class="shop-koop-btn"
                          onclick="window._koopItem('${esc(_shopId)}','${esc(item.naam || '')}','${esc(item.entityId || '')}',this,${item.stapelbaar ? `parseInt(document.getElementById('shop-qty-${i}')?.value)||1` : '1'})">
                          Kopen
                        </button>
                      </div>
                    `}
                  </td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <!-- Afdingen gaat aan tafel: de DM tikt het afgesproken bedrag in
             (muntknop per regel). Vandaar hier geen onderhandelknop meer. -->
        <div id="shop-koop-feedback" class="shop-koop-feedback hidden"></div>
        ${isDM() ? `
          <div id="dm-afreken-paneel" class="dm-winkel-paneel hidden"></div>
          <div class="dm-winkel-paneel">
            <div class="cs-sectiekop" style="border-top:0;margin-top:0;padding-top:0">Inkopen van de party</div>
            <p class="text-xs text-ink-dim mb-2">Vink aan wat de winkel overneemt, zet er een bedrag bij en reken af. Het voorwerp verdwijnt uit de boedel, het geld gaat naar die speler.</p>
            <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._dmInkoopOpen('${esc(_shopId)}')">${icon('package')} Boedel van de party bekijken</button>
            <div id="dm-inkoop-lijst" class="mt-2"></div>
          </div>` : ''}
        `;
    } else {
      voorraadHtml = `${sfeerHtml}${kortingBannerHtml}${beursHtml}${roterendHtml}<div class="text-center py-10 text-ink-faint font-fell italic">Geen voorraad beschikbaar</div>`;
    }
    } // end else (niet buitenGrisburgh)
  }

  // ── Build log HTML for DM ──
  let logHtml = '';
  if (heeftVoorraad && isDM()) {
    const entries = shopLogData?.entries || [];
    if (entries.length > 0) {
      logHtml = `
        <div class="rounded border border-room-border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-room-elevated border-b border-room-border">
                <th class="px-4 py-2 text-left font-cinzel text-ink-dim text-[10px] uppercase">Tijdstip</th>
                <th class="px-4 py-2 text-left font-cinzel text-ink-dim text-[10px] uppercase">Speler</th>
                <th class="px-4 py-2 text-left font-cinzel text-ink-dim text-[10px] uppercase">Voorwerp</th>
                <th class="px-4 py-2 text-right font-cinzel text-ink-dim text-[10px] uppercase">Prijs</th>
                <th class="px-3 py-2 text-center font-cinzel text-ink-dim text-[10px] uppercase">#</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map((entry, i) => `
                <tr class="${i % 2 === 1 ? 'bg-room-elevated/40' : ''} border-b border-room-border/40 last:border-0">
                  <td class="px-4 py-2 text-ink-dim text-xs">${esc(new Date(entry.ts).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }))}</td>
                  <td class="px-4 py-2 text-ink-bright font-crimson">${esc(entry.playerName || '?')}</td>
                  <td class="px-4 py-2 text-ink-medium font-crimson">${esc(entry.itemNaam || '?')}</td>
                  <td class="px-4 py-2 text-right text-ink-dim">${esc(entry.prijs || '\u2014')}</td>
                  <td class="px-3 py-2 text-center text-ink-dim">${entry.aantal > 1 ? entry.aantal : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } else {
      logHtml = `<div class="text-center py-10 text-ink-faint font-fell italic">Nog geen aankopen geregistreerd</div>`;
    }

    // Winkelier-humeur per character (DM kan bijstellen)
    if (shopHumeurData?.entries?.length) {
      const TIER_LABEL = { vijandig: 'Vijandig', stug: 'Stug', neutraal: 'Neutraal', vriendelijk: 'Vriendelijk', hartelijk: 'Hartelijk' };
      const humeurDmHtml = `
        <div class="shop-humeur-dm">
          <div class="shop-humeur-dm-head">${icon('message-circle')} Winkelier-humeur</div>
          ${shopHumeurData.entries.map(h => `
            <div class="shop-humeur-dm-rij">
              <span class="shop-humeur-dm-naam">${esc(h.playerName || h.characterId)}</span>
              <span class="shop-humeur-meter" title="${h.score > 0 ? '+' : ''}${h.score}">
                ${Array.from({ length: 7 }, (_, i) => {
                  const v = i - 3;
                  const kant = v < 0 ? 'min' : v > 0 ? 'plus' : 'nul';
                  const actief = v === 0 ? h.score === 0
                    : (h.score < 0 ? (v >= h.score && v < 0) : (v > 0 && v <= h.score));
                  return `<span class="shop-humeur-pip shop-humeur-pip--${kant}${actief ? ' shop-humeur-pip--actief' : ''}"></span>`;
                }).join('')}
              </span>
              <span class="shop-humeur shop-humeur--${esc(h.tier)}">${esc(TIER_LABEL[h.tier] || h.tier)}</span>
              <button class="dm-btn dm-btn-ghost dm-btn-sm" title="Humeur omlaag"
                onclick="window._dmHumeurBump('${esc(e.id)}','${esc(h.characterId)}',-1)">${icon('minus')}</button>
              <button class="dm-btn dm-btn-ghost dm-btn-sm" title="Humeur omhoog"
                onclick="window._dmHumeurBump('${esc(e.id)}','${esc(h.characterId)}',1)">${icon('plus')}</button>
            </div>`).join('')}
        </div>`;
      logHtml = humeurDmHtml + logHtml;
    }
  }


  // ── Build tabbed modal body ──
  const detailTabs = [
    { key: 'info', label: 'Informatie' },
    ...(showSheet ? [{ key: 'sheet', label: _isSpeler ? 'Character Sheet' : 'Statblock' }] : []),
    ...(isStapelbaarVoorwerp && isDM() ? [{ key: 'eigenaren', label: 'Eigenaren' }] : []),
    ...(heeftVoorraad ? [{ key: 'voorraad', label: 'Voorraad' }] : []),
    ...(heeftVoorraad && isDM() ? [{ key: 'log', label: 'Log' }] : []),
  ];

  const tabNav = detailTabs.map((t, i) => `
    <button class="detail-tab${i === 0 ? ' detail-tab--active' : ''}"
      data-dtab="${t.key}">${t.label}</button>
  `).join('');

  const body = `
    <div class="detail-tab-nav">${tabNav}</div>
    <div id="dtab-info">${infoHtml}</div>
    ${showSheet ? `<div id="dtab-sheet" class="hidden">${sheetHtml}</div>` : ''}
    ${isStapelbaarVoorwerp && isDM() ? `<div id="dtab-eigenaren" class="hidden">${eigenarenHtml}</div>` : ''}
    ${heeftVoorraad ? `<div id="dtab-voorraad" class="hidden">${voorraadHtml}</div>` : ''}
    ${heeftVoorraad && isDM() ? `<div id="dtab-log" class="hidden">${logHtml}</div>` : ''}
  `;

  const _subParts = [
    e.data?.rol,
    e.data?.domein,
    e.data?.ras,
    e.data?.klasse,
    e.data?.alignment,
    e.data?.locType,
    e.data?.wijk,
    e.data?.orgType,
    e.data?.itemType ? _normItemType(e.data.itemType) : null,
    e.data?.rariteit ? (({'Gewoon':'Common','Ongewoon':'Uncommon','Zeldzaam':'Rare','Zeer zeldzaam':'Very Rare','Legendarisch':'Legendary'})[e.data.rariteit] || e.data.rariteit) : null,
  ].filter(Boolean);
  const _subtitleHtml = _subParts.length
    ? `${getAutoIconSvg(tab, e)}  ${_subParts.map(p => esc(p)).join(' · ')}`
    : `${getAutoIconSvg(tab, e)}  ${esc(meta.label)}`;
  openModal(e.name, '', body);
  const _mSubEl = document.getElementById('m-sub');
  // openModal krijgt hier een lege ondertitel en verbergt het vakje daarom;
  // wij vullen het meteen daarna, dus moet het ook weer zichtbaar worden. Zonder
  // dit verdween de regel "rol · origin · class · alignment" onder de naam.
  if (_mSubEl) { _mSubEl.innerHTML = _subtitleHtml; _mSubEl.classList.remove('hidden'); }
  _updateBackButton();
  _vulSpellChips();   // van index naar nette naam, zodra de bibliotheek er is

  // Huisdier: geschaalde statblock ophalen + renderen (tier o.b.v. level van het baasje)
  if (tab === 'personages' && e.subtype === 'dier') {
    api.getPetStatblock(e.id).then(info => {
      const slot = document.getElementById('pet-statblock-slot');
      if (!slot) return;
      // Toon de door de speler gekozen naam (companion-naam) als titel
      if (info.petName) { const tEl = document.getElementById('m-title'); if (tEl) tEl.textContent = info.petName; }
      const tierBadge = info.tierCount > 1
        ? `<div class="pet-tier-indicator">${icon('paw-print')} Tier ${info.tierIndex + 1}/${info.tierCount} — <strong>${esc(info.label)}</strong>${info.ownerName ? ` · baasje ${esc(info.ownerName)} (level ${info.ownerLevel})` : ''}${info.nextMinLevel ? ` · volgende tier op level ${info.nextMinLevel}` : ''}</div>`
        : '';
      slot.innerHTML = tierBadge + renderStatblock(
        { name: info.label, statblock: info.statblock, maxHp: info.maxHp, description: info.description },
        { niveau: 'volledig' });
    }).catch(() => {
      const slot = document.getElementById('pet-statblock-slot');
      if (slot) slot.innerHTML = '';
    });
  }

  // Set type accent bar
  const _accentEl = document.getElementById('m-accent');
  if (_accentEl) _accentEl.className = `modal-accent bar-${tab}`;

  // Portrait in modal header
  const _mPortraitWrap = document.getElementById('m-portrait-wrap');
  const _mPortraitImg  = document.getElementById('m-portrait');
  if (_mPortraitWrap && _mPortraitImg) {
    _mPortraitWrap.classList.add('hidden');
    _mPortraitImg.src = '';
    _mPortraitImg.onerror = () => _mPortraitWrap.classList.add('hidden');
    _mPortraitImg.onload  = () => _mPortraitWrap.classList.remove('hidden');
    _mPortraitImg.src = fileUrl;
  }

  // Modal header type-color tint
  const _mHead = document.getElementById('modal-head');
  if (_mHead) _mHead.className = `modal-head modal-head--${tab}`;

  // Tab switching
  const allTabKeys = detailTabs.map(t => t.key);
  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.dtab;
      document.querySelectorAll('.detail-tab').forEach(b => {
        b.classList.toggle('detail-tab--active', b === btn);
      });
      allTabKeys.forEach(k => {
        const panel = document.getElementById(`dtab-${k}`);
        if (panel) panel.classList.toggle('hidden', k !== target);
      });
    });
  });

  // Activeer een specifieke tab als gevraagd (bijv. na aankoop terug naar voorraad)
  if (openTabKey) {
    const targetBtn = document.querySelector(`.detail-tab[data-dtab="${openTabKey}"]`);
    if (targetBtn) targetBtn.click();
  }

  // DM note auto-save
  if (isDM()) {
    let noteTimer;
    const ta = document.getElementById(`dm-note-${e.id}`);
    if (ta) {
      ta.addEventListener('input', () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(async () => {
          await api.saveAantekeningen(tab, e.id, ta.value);
          const ind = document.getElementById(`note-save-${e.id}`);
          if (ind) {
            ind.textContent = '\u2713 Opgeslagen';
            ind.style.opacity = '1';
            setTimeout(() => { ind.style.opacity = '0'; }, 1200);
          }
        }, 400);
      });
    }
  }

  // Spelersnotitie auto-save
  if (window.app?.state?.playerName && !isDM()) {
    let playerNoteTimer;
    const pta = document.getElementById(`player-note-${e.id}`);
    if (pta) {
      pta.addEventListener('input', () => {
        clearTimeout(playerNoteTimer);
        playerNoteTimer = setTimeout(async () => {
          await api.savePlayerNote(e.id, pta.value);
          const ind = document.getElementById(`player-note-save-${e.id}`);
          if (ind) {
            ind.textContent = '\u2713 Opgeslagen';
            ind.style.opacity = '1';
            setTimeout(() => { ind.style.opacity = '0'; }, 1200);
          }
        }, 600);
      });
    }
  }
};

// ── Voorwerpen: claimen & eigendom ──

window._itemClaim = async (itemId) => {
  try {
    await api.requestItem(itemId, { type: 'claim' });
    await refreshOwnership();
    renderEntitySection('voorwerpen');
  } catch (err) {
    if (err.message?.includes('Al een')) alert('Je hebt al een openstaand verzoek voor dit voorwerp.');
    else alert('Fout: ' + err.message);
  }
};

window._itemRemoveOwner = async (itemId) => {
  if (!confirm('Eigendom verwijderen van dit voorwerp?')) return;
  try {
    await api.removeItemOwner(itemId);
    await refreshOwnership();
    renderEntitySection('voorwerpen');
  } catch (err) { alert('Fout: ' + err.message); }
};

// ── Stapelbaar eigendom: qty aanpassen / verwijderen (DM vanuit Eigenaren-tab) ──
// ── Klik op gekoppeld voorwerp vanuit winkeldetail ──
// Onthult het kaartje stil als het nog hidden was, dan opent de detailview.
window._openDetailFromShop = async (entityId) => {
  try {
    await api.shopRevealItem('voorwerpen', entityId);
  } catch { /* stil falen — detail openen lukt altijd */ }
  window._openDetail('voorwerpen', entityId);
};

// ── Speler koopt voorwerp uit winkel ──
window._koopItem = async (shopId, itemNaam, entityId, btn, aantal = 1) => {
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const feedback = document.getElementById('shop-koop-feedback');
  try {
    await api.koopShopItem(shopId, { itemNaam, entityId: entityId || undefined, aantal });
    // Herlaad de modal maar blijf op de voorraadtab
    if (window._currentDetailTab && window._currentDetailId) {
      await window._openDetail(window._currentDetailTab, window._currentDetailId, false, 'voorraad');
    }
    // Succesbericht in de voorraadtab
    const fb = document.getElementById('shop-koop-feedback');
    if (fb) {
      fb.innerHTML = `✓ ${aantal > 1 ? `${aantal}× ` : ''}<strong>${itemNaam}</strong> gekocht!`;
      fb.className = 'shop-koop-feedback shop-koop-feedback--ok';
      fb.classList.remove('hidden');
      setTimeout(() => fb.classList.add('hidden'), 4000);
    }
    // Refresh knapzak zodat het nieuwe item meteen zichtbaar is
    window.app?.refreshSection?.('mijn-karakter');
  } catch (err) {
    const msg = err.message || 'Kon niet kopen';
    if (feedback) {
      feedback.textContent = '⚠ ' + msg;
      feedback.className = 'shop-koop-feedback shop-koop-feedback--fout';
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 5000);
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Kopen'; }
  }
};

// ── Winkel: voorwerp verkopen aan de winkel ──
window._verkoopItem = async (shopId, entityId, btn, aantal = 1) => {
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const feedback = document.getElementById('shop-verkoop-feedback');
  try {
    const res = await api.verkoopShopItem(shopId, { entityId, aantal });
    const _cN = window._currency || { fl: 'fl', kn: 'kn', cl: 'cl' };
    const b = res?.opbrengst || { fl: 0, kn: 0, cl: 0 };
    // Herlaad de modal maar blijf op de voorraadtab
    if (window._currentDetailTab && window._currentDetailId) {
      await window._openDetail(window._currentDetailTab, window._currentDetailId, false, 'voorraad');
    }
    const fb = document.getElementById('shop-verkoop-feedback');
    if (fb) {
      fb.innerHTML = `✓ Verkocht voor <strong>${b.fl} ${esc(_cN.fl)} · ${b.kn} ${esc(_cN.kn)} · ${b.cl} ${esc(_cN.cl)}</strong>`;
      fb.className = 'shop-koop-feedback shop-koop-feedback--ok';
      fb.classList.remove('hidden');
      setTimeout(() => fb.classList.add('hidden'), 4000);
    }
    // Refresh knapzak/kaarten zodat het verkochte item meteen verdwijnt
    window.app?.refreshSection?.('mijn-karakter');
  } catch (err) {
    const msg = err.message || 'Kon niet verkopen';
    if (feedback) {
      feedback.textContent = '⚠ ' + msg;
      feedback.className = 'shop-koop-feedback shop-koop-feedback--fout';
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 5000);
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Verkopen'; }
  }
};

// ── Winkel: onderhandelen ──
window._onderhandelOpen = (shopId) => {
  const panel = document.getElementById(`shop-onderhandel-panel-${shopId}`);
  if (panel) panel.classList.toggle('hidden');
};

window._onderhandelRoll = async (shopId) => {
  const modEl = document.getElementById(`shop-cha-mod-${shopId}`);
  const resultEl = document.getElementById(`shop-onderhandel-result-${shopId}`);
  const modifier = parseInt(modEl?.value) || 0;
  if (resultEl) { resultEl.classList.remove('hidden'); resultEl.innerHTML = `<span class="shop-onderhandel-loading">${icon('dice',{cls:'icon-gi'})} …</span>`; }
  try {
    const r = await api.onderhandelShop(shopId, { modifier });
    const modStr = r.modifier >= 0 ? `+${r.modifier}` : `${r.modifier}`;
    const kleur = r.geslaagd ? 'shop-onderhandel-result--ok' : 'shop-onderhandel-result--fout';
    const rolStr = `(${r.diceRoll}${modStr !== '+0' ? ` ${modStr}` : ''} = ${r.totaal} vs DC ${r.dc})`;
    let tekst;
    if (r.geslaagd) {
      tekst = `${r.nat20 ? '✦ Natuurlijke 20! ' : '✓ Geslaagd! '}${rolStr} — ${r.kortingPct}% voordeel bij kopen én verkopen, 1 uur geldig.`;
      if (r.humeurGestegen) tekst += ' De winkelier waardeert je lef.';
    } else {
      tekst = `${r.nat1 ? '✗ Natuurlijke 1! ' : '✗ Mislukt. '}${rolStr}`;
      tekst += r.nat1 ? ' De winkelier is beledigd…' : (r.humeurGedaald ? ' De winkelier kijkt je nors aan.' : '');
    }
    if (resultEl) {
      resultEl.className = `shop-onderhandel-result ${kleur}`;
      resultEl.textContent = tekst;
    }
    // Panel sluiten
    document.getElementById(`shop-onderhandel-panel-${shopId}`)?.classList.add('hidden');
    // Herlaad modal voor updated prijzen
    if (window._currentDetailTab && window._currentDetailId) {
      await window._openDetail(window._currentDetailTab, window._currentDetailId, false, 'voorraad');
    }
  } catch (err) {
    if (resultEl) { resultEl.className = 'shop-onderhandel-result shop-onderhandel-result--fout'; resultEl.textContent = err.message || 'Fout'; }
  }
};

// ── Winkel: humeur bijstellen (DM) ──
window._dmHumeurBump = async (shopId, characterId, delta) => {
  try {
    await api.bumpShopHumeur(shopId, { characterId, delta });
    await window._openDetail(window._currentDetailTab, shopId, false, 'log');
  } catch (err) {
    alert('Fout: ' + err.message);
  }
};

// ── Winkel uitverkocht toggle ──
// ── DM rekent af aan tafel ───────────────────────────────────────────────────
// Aan tafel wordt gepingeld en komt er een bedrag uit dat de DM noemt. Eén veld
// dus, voorgevuld met de vraagprijs: overtypen en afrekenen.
let _dmPartySpelers = [];   // {id, name} van de actieve party

// Bedragen kennen één notatie in de hele app: één getal met een komma, waarbij
// de tweede munt een tiende is en de derde een honderdste (12,34 = 12 florinde,
// 3 knakers, 4 centelingen). Wie in munten schrijft — "5 gp 2 sp", "2 pp" —
// wordt ook begrepen; de server (parsePrijs) kent beide vormen.
const _MUNT_CL_KAART = { fl: 100, gp: 100, kn: 10, sp: 10, cl: 1, cp: 1, ep: 50, pp: 1000 };
function _prijsNaarCl(tekst) {
  const t = String(tekst ?? '').trim().replace(/\s+/g, '');
  if (!t) return null;
  const komma = t.match(/^(\d+)[.,](\d{1,2})$/);
  if (komma) return parseInt(komma[1]) * 100 + parseInt(komma[2].padEnd(2, '0'));
  let cl = 0, iets = false;
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)(fl|kn|cl|gp|sp|cp|ep|pp)\.?/gi)) {
    cl += parseFloat(m[1].replace(',', '.')) * (_MUNT_CL_KAART[m[2].toLowerCase()] || 0);
    iets = true;
  }
  if (iets) return Math.round(cl);
  return /^\d+$/.test(t) ? parseInt(t) * 100 : null;   // kaal getal = hele munten
}
const _clNaarKomma = (cl) => `${Math.floor(cl / 100)},${String(cl % 100).padStart(2, '0')}`;

// {fl,kn,cl} → "1 Florinde 3 Knaker"; de muntnamen komen uit meta.
function _muntTekst(cur) {
  const n = window._muntNamen?.() || { fl: 'Gold', kn: 'Silver', cl: 'Copper' };
  return [['fl', n.fl], ['kn', n.kn], ['cl', n.cl]]
    .filter(([k]) => cur?.[k]).map(([k, naam]) => `${cur[k]} ${naam}`).join(' ') || '0';
}

async function _laadPartySpelers() {
  if (_dmPartySpelers.length) return _dmPartySpelers;
  try {
    const lijst = await api.listEntities('personages');
    const groep = window._activeGroupId;
    _dmPartySpelers = lijst
      .filter(p => p.subtype === 'speler' && (!groep || p.data?.groep === groep))
      .map(p => ({ id: p.id, name: p.name }));
  } catch { _dmPartySpelers = []; }
  return _dmPartySpelers;
}

window._dmAfrekenen = async (shopId, itemNaam, entityId, prijs) => {
  const host = document.getElementById('dm-afreken-paneel');
  if (!host) return;
  const spelers = await _laadPartySpelers();
  if (!spelers.length) { host.classList.remove('hidden'); host.innerHTML = `<p class="dm-hint">Geen spelers in deze party.</p>`; return; }
  host.classList.remove('hidden');
  host.innerHTML = `
    <div class="cs-sectiekop" style="border-top:0;margin-top:0;padding-top:0">Afrekenen \u2014 ${esc(itemNaam)}</div>
    <div class="dm-winkel-rij">
      <select id="dm-afreken-speler" class="dm-input dm-input-sm">
        ${spelers.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
      </select>
      <input id="dm-afreken-bedrag" class="dm-input dm-input-sm" style="max-width:120px" inputmode="decimal"
        value="${esc((() => { const cl = _prijsNaarCl(prijs); return cl === null ? '' : _clNaarKomma(cl); })())}"
        placeholder="12,34" title="Eén bedrag met een komma; munten mogen ook: 5 gp 2 sp, 2 pp">
      <button class="dm-btn dm-btn-sm dm-btn-primary"
        onclick="window._dmAfrekenenDoen('${esc(shopId)}','${escJS(itemNaam)}','${esc(entityId || '')}')">Afrekenen</button>
      <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="document.getElementById('dm-afreken-paneel').classList.add('hidden')">Annuleren</button>
    </div>
    <div id="dm-afreken-melding" class="dm-hint mt-1"></div>`;
  document.getElementById('dm-afreken-bedrag')?.select();
};

window._dmAfrekenenDoen = async (shopId, itemNaam, entityId) => {
  const characterId = document.getElementById('dm-afreken-speler')?.value;
  const bedrag      = document.getElementById('dm-afreken-bedrag')?.value || '';
  const melding     = document.getElementById('dm-afreken-melding');
  try {
    const r = await api.dmVerkoop(shopId, { characterId, itemNaam, entityId: entityId || undefined, bedrag });
    // Het venster wordt zo herbouwd, dus een melding ín het paneel zag je nooit;
    // een toast blijft staan.
    const wie = document.querySelector('#dm-afreken-speler')?.selectedOptions?.[0]?.textContent || 'de speler';
    window.app?._tsToast?.(`${icon('check')} ${esc(itemNaam)} afgerekend met ${esc(wie.trim())} voor ${esc(_muntTekst(r.betaald))}`);
    if (melding) melding.textContent = '';
    // Opnieuw openen zodat uitverkocht en voorraad kloppen; blijf op de tab.
    if (window._currentDetailTab && window._currentDetailId) {
      await window._openDetail(window._currentDetailTab, window._currentDetailId, false, 'voorraad');
    }
  } catch (err) {
    if (melding) melding.textContent = err.message || 'Afrekenen mislukt';
  }
};

// ── DM koopt spullen van de party ──
window._dmInkoopOpen = async (shopId) => {
  const host = document.getElementById('dm-inkoop-lijst');
  if (!host) return;
  host.innerHTML = `<p class="dm-hint">Laden\u2026</p>`;
  let regels = [];
  try { ({ regels } = await api.getPartyBoedel(shopId)); } catch (err) {
    host.innerHTML = `<p class="dm-hint">Kon de boedel niet ophalen: ${esc(err.message)}</p>`; return;
  }
  if (!regels.length) { host.innerHTML = `<p class="dm-hint">De party heeft niets in de boedel.</p>`; return; }
  window._dmInkoopRegels = regels;
  host.innerHTML = `
    <input id="dm-inkoop-zoek" class="dm-input dm-input-sm" placeholder="Zoeken\u2026"
      oninput="window._dmInkoopFilter(this.value)">
    <div id="dm-inkoop-rijen" class="dm-inkoop-rijen mt-2">
      ${regels.map((r, i) => `
        <label class="dm-inkoop-rij" data-zoek="${esc((r.naam + ' ' + r.speler).toLowerCase())}">
          <input type="checkbox" data-i="${i}">
          <span class="dm-inkoop-naam">${esc(r.naam)}</span>
          <span class="dm-inkoop-speler">${esc(r.speler)}</span>
          ${r.aantal > 1 ? `<input type="number" min="1" max="${r.aantal}" value="1" class="dm-input dm-input-sm dm-inkoop-aantal" title="Hoeveel van de ${r.aantal}?">` : `<span class="dm-inkoop-aantal-vast">1</span>`}
          <input class="dm-input dm-input-sm dm-inkoop-bedrag" inputmode="decimal"
            value="${esc((() => { const cl = _prijsNaarCl(r.prijs); return cl === null ? '' : _clNaarKomma(cl); })())}"
            placeholder="12,34" title="Eén bedrag met een komma; munten mogen ook">
        </label>`).join('')}
    </div>
    <div class="dm-winkel-rij mt-2">
      <button class="dm-btn dm-btn-sm dm-btn-primary" onclick="window._dmInkoopDoen('${esc(shopId)}')">Overnemen</button>
      <span id="dm-inkoop-melding" class="dm-hint"></span>
    </div>`;
};

window._dmInkoopFilter = (term) => {
  const t = (term || '').toLowerCase().trim();
  document.querySelectorAll('#dm-inkoop-rijen .dm-inkoop-rij').forEach(rij => {
    rij.classList.toggle('hidden', !!t && !rij.dataset.zoek.includes(t));
  });
};

window._dmInkoopDoen = async (shopId) => {
  const melding = document.getElementById('dm-inkoop-melding');
  const regels = [];
  document.querySelectorAll('#dm-inkoop-rijen .dm-inkoop-rij').forEach(rij => {
    const cb = rij.querySelector('input[type=checkbox]');
    if (!cb?.checked) return;
    const bron = window._dmInkoopRegels[parseInt(cb.dataset.i)];
    if (!bron) return;
    regels.push({
      ...bron,
      aantal: parseInt(rij.querySelector('.dm-inkoop-aantal')?.value) || 1,
      bedrag: rij.querySelector('.dm-inkoop-bedrag')?.value || '',
    });
  });
  if (!regels.length) { if (melding) melding.textContent = 'Niets aangevinkt.'; return; }
  try {
    const r = await api.dmInkoop(shopId, { regels });
    if (melding) melding.textContent = `${r.gedaan.length} overgenomen.`;
    await window._dmInkoopOpen(shopId);
  } catch (err) {
    if (melding) melding.textContent = err.message || 'Overnemen mislukt';
  }
};

window._toggleShopUitverkocht = async (shopId, itemNaam, cbEl) => {
  try {
    await api.toggleShopUitverkocht(shopId, itemNaam);
    // Her-open detail zodat de tabel opnieuw rendert met bijgewerkte state
    window._openDetail(window._currentDetailTab, shopId);
  } catch (err) {
    if (cbEl) cbEl.checked = !cbEl.checked; // terugdraaien bij fout
    alert('Fout: ' + err.message);
  }
};

window._eigenaarQtyAdj = async (itemId, characterId, delta) => {
  try {
    await api.patchItemOwnerQty(itemId, characterId, delta);
    await refreshOwnership();
    window._openDetail('voorwerpen', itemId);
  } catch (err) { alert('Fout: ' + err.message); }
};

window._eigenaarVerwijder = async (itemId, characterId) => {
  if (!confirm('Eigendom verwijderen voor deze speler?')) return;
  try {
    await api.removeStackOwner(itemId, characterId);
    await refreshOwnership();
    window._openDetail('voorwerpen', itemId);
  } catch (err) { alert('Fout: ' + err.message); }
};

window._itemApproveRequest = async (reqId) => {
  try {
    await api.approveItemRequest(reqId);
    await refreshOwnership();
    renderEntitySection('voorwerpen');
  } catch (err) { alert('Fout: ' + err.message); }
};

window._itemRejectRequest = async (reqId) => {
  try {
    await api.rejectItemRequest(reqId);
    await refreshOwnership();
    renderEntitySection('voorwerpen');
  } catch (err) { alert('Fout: ' + err.message); }
};

// ── Visibility / Secret / Deceased toggles ──
window._toggleVis = async (tab, id, event) => {
  const toVague = event?.shiftKey && ['personages', 'locaties'].includes(tab);
  await api.toggleVisibility(tab, id, toVague ? 'vague' : undefined);
  renderEntitySection(tab);
  // Staat het kaartje open, dan moet de knop zijn nieuwe stand tonen — anders
  // lijkt er niets te gebeuren.
  if (window._currentDetailId === id && document.getElementById('modal-overlay')?.classList.contains('active')) {
    window._openDetail(tab, id);
  }
};

function _secretToast(revealed) {
  const toast = document.createElement('div');
  toast.className = 'bookmark-toast';
  toast.innerHTML = revealed ? `${icon('eye')} Geheim onthuld voor spelers` : `${icon('lock')} Geheim verborgen voor spelers`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('bookmark-toast--visible'), 10);
  setTimeout(() => { toast.classList.remove('bookmark-toast--visible'); setTimeout(() => toast.remove(), 300); }, 2500);
}

// Een roddel met de hand vertellen (of terugnemen). De herberg doet dit vanzelf
// bij een lange rust; dit is voor als je hem gewoon aan tafel laat vallen.
window._toggleFlavour = async (tab, id, index = 0) => {
  try {
    await api.toggleFlavour(tab, id, index);
    window._openDetail(tab, id);
  } catch (err) { alert('Mislukt: ' + (err.message || err)); }
};

window._toggleSecret = async (tab, id, index = 0) => {
  const res = await api.toggleSecret(tab, id, index);
  _secretToast(res.secretReveal);
  window._openDetail(tab, id);
};

// Onthullen vanaf de kaart bestaat niet meer: sinds een kaartje meerdere
// geheimen kan hebben, kies je in het detailvenster wélk geheim eruit gaat.
// De functie blijft staan voor het geval er ergens nog een knop naar wijst.
window._toggleSecretCard = async (type, id, index = 0) => {
  const res = await api.toggleSecret(type, id, index);
  _secretToast(res.secretReveal);
};

window._toggleDeceased = async (tab, id) => {
  try {
    await api.toggleDeceased(tab, id);
    renderEntitySection(tab);
  } catch (err) {
    alert('Fout bij deceased toggle: ' + err.message);
  }
};

// ── Focal point picker ──
let _fpDragging = false;

window._fpDown = (ev) => {
  _fpDragging = true;
  _fpApply(ev);
};
window._fpMove = (ev) => {
  if (!_fpDragging) return;
  _fpApply(ev);
};
document.addEventListener('mouseup', () => { _fpDragging = false; });
// Op een telefoon zet je het punt met je vinger. preventDefault houdt de pagina
// stil terwijl je sleept, anders scrollt het venster onder je vinger weg.
window._fpTouch = (ev) => {
  const t = ev.touches?.[0];
  if (!t) return;
  ev.preventDefault();
  _fpApply(t);
};

// Eén plek waar de bron van picker én previews wordt gezet, anders raken ze
// uit elkaar zodra je een andere banner kiest.
window._fpZetBron = (fileId) => {
  const url = api.fileUrl(fileId);
  for (const id of ['editor-img-preview', 'fp-card-preview', 'fp-portret-preview']) {
    const el = document.getElementById(id);
    if (el) el.src = url;
  }
  document.getElementById('fp-rij')?.classList.remove('hidden');
  document.getElementById('fp-hint')?.classList.remove('hidden');
  window._fpTeken();
};

// Waar staat de afbeelding écht binnen het kader? Met object-fit:contain blijven
// er banden over; een klik in zo'n band hoort geen 0% of 100% op te leveren.
function _fpBeeldVak(img, wrap) {
  const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
  const schaal = Math.min(wrap.clientWidth / nw, wrap.clientHeight / nh) || 1;
  const w = nw * schaal, h = nh * schaal;
  return { x: (wrap.clientWidth - w) / 2, y: (wrap.clientHeight - h) / 2, w, h };
}

function _fpApply(ev) {
  const wrap = document.getElementById('fp-wrap');
  const img  = document.getElementById('editor-img-preview');
  if (!wrap || !img) return;
  const rect = wrap.getBoundingClientRect();
  const vak  = _fpBeeldVak(img, wrap);
  const x = Math.max(0, Math.min(100, Math.round((ev.clientX - rect.left - vak.x) / vak.w * 100)));
  const y = Math.max(0, Math.min(100, Math.round((ev.clientY - rect.top  - vak.y) / vak.h * 100)));
  const input = document.getElementById('fp-input');
  if (input) input.value = `${x}% ${y}%`;
  _fpTeken();
}

// Kruisje neerzetten en de previews bijwerken vanuit het opgeslagen percentage.
// Ook aangeroepen als de afbeelding klaar is met laden: pas dán weten we hoe
// groot hij in het kader staat.
window._fpTeken = () => {
  const wrap = document.getElementById('fp-wrap');
  const img  = document.getElementById('editor-img-preview');
  const val  = document.getElementById('fp-input')?.value || '50% 50%';
  const [x, y] = (val.match(/(\d+)%\s*(\d+)%/) || [null, '50', '50']).slice(1).map(Number);
  for (const id of ['fp-card-preview', 'fp-portret-preview']) {
    const el = document.getElementById(id);
    if (el) el.style.objectPosition = val;
  }
  if (!wrap || !img) return;
  const vak = _fpBeeldVak(img, wrap);
  const ch = document.getElementById('fp-crosshair');
  if (ch) {
    ch.style.left = (vak.x + vak.w * x / 100) + 'px';
    ch.style.top  = (vak.y + vak.h * y / 100) + 'px';
  }
};

// ── File upload ──
// ── Wapeneigenschappen tag-picker (editor) ──
window._toggleWeaponTag = (fieldKey, prop, btn) => {
  const input = document.getElementById('wt_' + fieldKey);
  if (!input) return;
  let sel = (() => { try { return JSON.parse(input.value || '[]'); } catch { return []; } })();
  // Parameterizable props may be stored as "Range (30/120)" — match on base name
  const idx = sel.findIndex(s => s === prop || s.startsWith(prop + ' ('));
  const paramInp = document.getElementById('wtp-' + fieldKey + '-' + prop.replace(/[^a-zA-Z0-9]/g, '_'));
  if (idx >= 0) {
    sel.splice(idx, 1);
    btn.classList.remove('weapon-tag-pick--on');
    if (paramInp) { paramInp.classList.add('hidden'); paramInp.value = ''; }
  } else {
    sel.push(prop);
    btn.classList.add('weapon-tag-pick--on');
    if (paramInp) { paramInp.classList.remove('hidden'); setTimeout(() => paramInp.focus(), 50); }
  }
  input.value = JSON.stringify(sel);
};

window._updateWeaponTagParam = (fieldKey, baseProp, paramVal) => {
  const input = document.getElementById('wt_' + fieldKey);
  if (!input) return;
  let sel = (() => { try { return JSON.parse(input.value || '[]'); } catch { return []; } })();
  const idx = sel.findIndex(s => s === baseProp || s.startsWith(baseProp + ' ('));
  if (idx >= 0) {
    sel[idx] = paramVal.trim() ? `${baseProp} (${paramVal.trim()})` : baseProp;
    input.value = JSON.stringify(sel);
  }
};

// ── Wapeneigenschap tooltip (hover) ──
let _wpTip = null;
document.addEventListener('mouseover', ev => {
  const el = ev.target.closest('[data-wptip]');
  if (!el) return;
  if (!_wpTip) {
    _wpTip = document.createElement('div');
    _wpTip.className = 'weapon-prop-tooltip';
    document.body.appendChild(_wpTip);
  }
  _wpTip.textContent = el.dataset.wptip;
  _wpTip.classList.add('weapon-prop-tooltip--visible');
  const r = el.getBoundingClientRect();
  _wpTip.style.left = r.left + 'px';
  _wpTip.style.top  = (r.bottom + 6) + 'px';
});
document.addEventListener('mouseout', ev => {
  if (ev.target.closest('[data-wptip]') && _wpTip) _wpTip.classList.remove('weapon-prop-tooltip--visible');
});

window._onItemTypeChange = (val) => {
  document.querySelectorAll('[data-show-for]').forEach(el => {
    const types = el.dataset.showFor.split(',');
    el.style.display = types.includes(val) ? '' : 'none';
  });
  document.querySelectorAll('[data-hide-for]').forEach(el => {
    const types = el.dataset.hideFor.split(',');
    el.style.display = types.includes(val) ? 'none' : '';
  });
};

window._onRevealToggle = (groupId, checked) => {
  const group = document.getElementById('reveal-group-' + groupId);
  if (!group) return;
  if (checked) {
    group.style.display = 'contents';
  } else {
    group.style.display = 'none';
    group.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => { el.value = ''; });
  }
};

// Portret kiezen/uploaden via de mediabibliotheek. Zet het verborgen
// data_imageId-veld (gaat mee in de payload) en werkt de preview bij.
// Eén knop voor alle afbeeldingen: is er nog geen banner, dan wordt dit 'm;
// anders komt de nieuwe erbij en blijft de banner staan. Wisselen doe je met de
// ster op een miniatuur.
window._editorPickImage = () => {
  const naamHint = (document.querySelector('[name="name"]')?.value || '').trim().toLowerCase().replace(/\s+/g, '-');
  window.mediaPicker.open({
    type: 'afbeelding',
    suggestedName: naamHint || '',
    onSelect: (fileId) => {
      if (!fileId) return;
      const hidden = document.getElementById('editor-image-id');
      const heeftBanner = !!hidden?.value;
      if (!heeftBanner) {
        if (hidden) hidden.value = fileId;
        window._fpZetBron(fileId);
        return;
      }
      if (entityEditorImages.some(i => i.id === fileId)) return;
      entityEditorImages.push({ id: fileId, url: api.fileUrl(fileId), isNew: false, caption: '' });
      _refreshEntityImages();
    },
  });
};

// ── Filmpje bij een personage ───────────────────────────────────────────────
// Het bestand heet <entityId>_video; daar kijkt de landingspagina rechtstreeks
// naar (routes/auth.js). Er is geen ffmpeg op de server, dus we kunnen niet
// knippen of hercoderen: te groot weigeren we, te lang laten we toe maar het
// afspelen stopt vanzelf na MAX_VIDEO_SEC.
const MAX_VIDEO_MB  = 8;
const MAX_VIDEO_SEC = 6;

// Duur uitlezen zonder te uploaden: de browser kan dat zelf.
function _videoDuur(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration || 0); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    v.src = url;
  });
}

window._charVideoStatus = async (entityId) => {
  const el = document.getElementById('editor-video-status');
  const del = document.getElementById('editor-video-del');
  if (!el) return;
  try {
    const r = await fetch(`/api/files/${encodeURIComponent(entityId)}_video`, { method: 'HEAD' });
    if (r.ok) {
      const mb = (+r.headers.get('content-length') || 0) / 1048576;
      el.textContent = `Er staat een filmpje klaar${mb ? ` (${mb.toFixed(1)} MB)` : ''}.`;
      del?.classList.remove('hidden');
    } else {
      el.textContent = 'Nog geen filmpje.';
      del?.classList.add('hidden');
    }
  } catch { el.textContent = 'Nog geen filmpje.'; }
};

// Bij een nieuw kaartje bestaat het id nog niet, en de upload heet
// `<id>_video`. Dus bewaren we het bestand en uploaden we het zodra het
// personage is aangemaakt.
let _pendingVideoFile = null;

// Filmpje kiezen gaat net als een afbeelding via de mediabibliotheek: daar
// staat wat je eerder hebt geüpload en kun je nieuw materiaal toevoegen. De app
// zoekt het filmpje op onder de vaste naam `<entityId>_video`, dus na het kiezen
// maken we daar een kopie van — het origineel blijft gewoon in de bibliotheek.
window._editorPickVideo = (entityId) => {
  const naamHint = (document.querySelector('[name="name"]')?.value || '').trim().toLowerCase().replace(/\s+/g, '-');
  window.mediaPicker.open({
    type: 'video',
    suggestedName: naamHint ? `${naamHint}-filmpje` : '',
    onSelect: async (fileId) => {
      if (!fileId) return;
      const el = document.getElementById('editor-video-status');
      if (!entityId) {
        // Nieuw kaartje: het id bestaat nog niet, dus onthouden tot het opslaan.
        _pendingVideoBron = fileId;
        if (el) el.textContent = 'Klaar om te bewaren; wordt gekoppeld zodra je opslaat.';
        return;
      }
      if (el) el.textContent = 'Koppelen\u2026';
      try {
        await api.copyFile(`${entityId}_video`, fileId);
        if (el) el.textContent = 'Klaar — filmpje gekoppeld.';
        document.getElementById('editor-video-del')?.classList.remove('hidden');
      } catch (err) {
        if (el) el.textContent = '';
        alert('Koppelen mislukt: ' + (err.message || err));
      }
    },
  });
};
let _pendingVideoBron = null;   // gekozen bibliotheek-id, nog te koppelen

window._kiesCharVideo = async (entityId, file, invoer) => {
  if (!file) return;
  if (entityId) return window._uploadCharVideo(entityId, file, invoer);
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    alert(`Dit filmpje is ${(file.size / 1048576).toFixed(1)} MB. Maximaal ${MAX_VIDEO_MB} MB — maak het korter of exporteer het kleiner.`);
    if (invoer) invoer.value = '';
    return;
  }
  _pendingVideoFile = file;
  const duur = await _videoDuur(file);
  const el = document.getElementById('editor-video-status');
  if (el) el.textContent = `Klaar om te bewaren${duur ? ` — ${duur.toFixed(1)} s` : ''}; wordt geüpload zodra je opslaat.`;
};

window._uploadCharVideo = async (entityId, file, invoer) => {
  if (!file) return;
  const el = document.getElementById('editor-video-status');
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    alert(`Dit filmpje is ${(file.size / 1048576).toFixed(1)} MB. Maximaal ${MAX_VIDEO_MB} MB — maak het korter of exporteer het kleiner.`);
    if (invoer) invoer.value = '';
    return;
  }
  const duur = await _videoDuur(file);
  if (el) el.textContent = 'Uploaden…';
  try {
    await api.uploadFile(`${entityId}_video`, file);
    if (el) {
      el.textContent = duur > MAX_VIDEO_SEC + 0.2
        ? `Klaar — het filmpje duurt ${duur.toFixed(1)} s en stopt vanzelf na ${MAX_VIDEO_SEC} s.`
        : `Klaar — ${duur ? `${duur.toFixed(1)} s` : 'geüpload'}.`;
    }
    document.getElementById('editor-video-del')?.classList.remove('hidden');
  } catch (err) {
    if (el) el.textContent = '';
    alert('Uploaden mislukt: ' + (err.message || err));
  }
  if (invoer) invoer.value = '';
};

window._removeCharVideo = async (entityId) => {
  if (!confirm('Het filmpje van dit personage verwijderen?')) return;
  try {
    await api.deleteFile(`${entityId}_video`);
    const el = document.getElementById('editor-video-status');
    if (el) el.textContent = 'Nog geen filmpje.';
    document.getElementById('editor-video-del')?.classList.add('hidden');
  } catch (err) { alert('Verwijderen mislukt: ' + (err.message || err)); }
};

window._uploadFile = async (tab, id, file) => {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return alert('Max 10MB');
  await api.uploadFile(id, file);
  window._openDetail(tab, id);
};

// ── Navigate to linked entity ──
window._navigateTo = async (tab, name) => {
  if (!ENTITY_TYPES.includes(tab)) return;
  try {
    const entities = await api.listEntities(tab);
    const entity = entities.find(e => e.name === name);
    if (entity) {
      // Navigeer binnen de modal — history wordt bijgehouden door _openDetail
      window._openDetail(tab, entity.id);
    } else {
      // Niet gevonden: sluit modal en zoek in grid
      closeModal();
      window.app.switchSection(tab);
      searchQueries[tab] = name;
      renderEntitySection(tab);
    }
  } catch {
    closeModal();
    window.app.switchSection(tab);
    searchQueries[tab] = name;
    renderEntitySection(tab);
  }
};

// ── Editor ──
export function openEditor(type) {
  window._openEditor(type);
}

let allNames = {};
let _scrollSpellList = null;  // volledige spell-lijst voor de Scroll-spell-picker (lazy)
let _naamLijsten = null;      // volken, klassen en alignments voor de keuzevelden
let _spreukLijst = null;      // spreukenbibliotheek voor de koppeling op een kaartje

// ── Huisdier-tier-editor (subtype 'dier') ──
// _petTiers wordt in openEditor gevuld uit e.statblockTiers en bij submit weer uitgelezen.
let _petTiers = [];

// Een tier ís een statblok, dus hij gebruikt dezelfde velden en dezelfde
// indeling als het blad zelf — eerder had de tier-editor een eigen, kleinere
// set en zag hij er anders uit. Wat erbij komt is het level vanaf wanneer hij
// geldt, en een label voor in het spel ("Guard Dog").
function _petTierRowHtml(t, i) {
  const sb = t.statblock || {};
  const h  = _sbTierBouwstenen(sb, i);
  const veldCls = 'w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none';

  // Alleen open wat de DM zelf openzette (of net toevoegde). Eerder stond het
  // eerste tier altijd open; dichtklappen hield dan geen stand.
  return `<details class="pet-tier-row" data-idx="${i}"${t._open ? ' open' : ''}>
    <summary class="pet-tier-row-head">
      <span class="pet-tier-badge">${t.label ? esc(t.label) : `Tier ${i + 1}`}${t.minLevel ? ` · vanaf level ${esc(t.minLevel)}` : ''}</span>
      <button type="button" class="pet-tier-del" onclick="event.preventDefault();window._petTierRemove(${i})" title="Verwijder tier">${icon('trash')}</button>
    </summary>

    <p class="pet-tier-hint">Vul alleen in wat er verandert; wat je leeg laat blijft zoals in het statblok hierboven.</p>
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">Vanaf level</label>
        <input class="pt-minlevel ${veldCls}" type="number" min="2" value="${(t.minLevel === 0 || t.minLevel) ? esc(t.minLevel) : ''}"
          onchange="window._petTierLevelCheck(this)">
      </div>
      <div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">Label</label>
        <input class="pt-label ${veldCls}" value="${esc(t.label ?? '')}" placeholder="Guard Dog">
      </div>
    </div>

    ${_sbCombatHtml(h)}

    <div class="cs-sectiekop">Actions</div>
    ${_sbActiesHtml(h)}
  </details>`;
}

// Lees de tier-velden terug uit het DOM naar _petTiers (vóór add/remove en submit).
// De sleutels komen uit _SB_TEKSTVELDEN, dezelfde lijst waar het formulier op
// gebouwd is: een veld erbij hoeft dus maar op één plek.
function _petTiersCollect() {
  const out = [];
  document.querySelectorAll('#pet-tiers-list .pet-tier-row').forEach(row => {
    const g = cls => (row.querySelector('.' + cls)?.value ?? '');
    const n = cls => { const v = parseInt(g(cls)); return isNaN(v) ? undefined : v; };
    const sb = {};
    _SB_TEKSTVELDEN.forEach(k => { const v = g('pt-' + k).trim(); if (v) sb[k] = v; });
    _SB_ABILITIES.forEach(a => { const v = n('pt-' + a); if (v !== undefined) sb[a] = v; });
    if (!sb.alignment) sb.alignment = 'Unaligned';
    // Geen apart maxHp-veld meer: de HP staat als tekst in het statblok
    // ("32 (5d8+10)"), net als op het blad, en de server leest daar het getal
    // uit. Zo is er één plek waar de HP van een tier staat.
    out.push({
      minLevel: n('pt-minlevel'), label: g('pt-label').trim(),
      statblock: sb, _open: row.hasAttribute('open'),
    });
  });
  _petTiers = out;
  return out;
}

// Twee tiers vanaf hetzelfde level kan niet: dan is niet te zeggen welke geldt.
window._petTierLevelCheck = (veld) => {
  const rij = veld.closest('.pet-tier-row');
  const mijn = parseInt(veld.value);
  if (isNaN(mijn)) return;
  const bezet = [...document.querySelectorAll('#pet-tiers-list .pet-tier-row')]
    .filter(r => r !== rij)
    .map(r => parseInt(r.querySelector('.pt-minlevel')?.value))
    .filter(v => !isNaN(v));
  if (!bezet.includes(mijn)) return;
  veld.classList.add('dm-input--err');
  setTimeout(() => veld.classList.remove('dm-input--err'), 900);
  const vrij = Math.max(0, ...bezet, mijn) + 1;
  veld.value = vrij;
  window.app?._tsToast?.(`${icon('x')} Er is al een tier vanaf level ${mijn}; deze staat nu op ${vrij}.`);
};

window._renderPetTiers = () => {
  const list = document.getElementById('pet-tiers-list');
  if (!list) return;
  // De basis staat als eerste trede in de ladder, zodat te zien is dat het
  // statblok hierboven meedoet — dat was de verwarring: een blok invullen en
  // daaronder tiers zien die het leken te vervangen.
  const basis = `<div class="pet-tier-basis">
      <span class="pet-tier-badge">Basis · vanaf level 1</span>
      <span class="pet-tier-basis-uitleg">het statblok hierboven</span>
    </div>`;
  list.innerHTML = basis + (_petTiers.length
    ? _petTiers.map((t, i) => _petTierRowHtml(t, i)).join('')
    : `<p class="pet-tier-empty">Geen tiers: het dier houdt het statblok hierboven, hoe hoog het baasje ook komt.</p>`);
};
window._petTierAdd = () => {
  _petTiersCollect();
  // Een nieuw tier begint boven het hoogste dat er al is; twee keer hetzelfde
  // level zou de vraag "welke geldt nu?" onbeantwoordbaar maken.
  const hoogste = Math.max(1, ..._petTiers.map(t => parseInt(t.minLevel)).filter(v => !isNaN(v)));
  _petTiers.forEach(t => { t._open = false; });
  _petTiers.push({ minLevel: hoogste + 1, label: '', statblock: {}, _open: true });
  window._renderPetTiers();
};
window._petTierRemove = (idx) => { _petTiersCollect(); _petTiers.splice(idx, 1); window._renderPetTiers(); };

// Scroll-spell-picker: vult bij keuze de scroll-statvelden + omschrijving (+ naam indien leeg).
window._scrollPickSpell = (naam) => {
  const sp = (_scrollSpellList || []).find(s => (s.name || '').toLowerCase() === String(naam || '').toLowerCase());
  if (!sp) return;
  const form = document.getElementById('entity-form');
  if (!form) return;
  const setVal = (n, v) => { const el = form.querySelector(`[name="${n}"]`); if (el) el.value = v; };
  const comp = (Array.isArray(sp.components) ? sp.components.join(', ') : (sp.components || '')) + (sp.material ? ` (${sp.material})` : '');
  setVal('data_spellCastingTime', sp.casting_time || '');
  setVal('data_spellRange',       sp.range || '');
  setVal('data_spellComponents',  comp);
  setVal('data_spellDuration',    sp.duration || '');
  setVal('data_desc',             (sp.desc || []).join('\n\n'));
  const nameEl = form.querySelector('[name="name"]');
  if (nameEl && !nameEl.value.trim()) nameEl.value = `Scroll of ${sp.name}`;
};

window._openEditor = async (tab, editId) => {
  const schema = SCHEMA[tab];
  let e = null;
  if (editId) {
    try { e = await api.getEntity(tab, editId); } catch { return; }
  }
  allNames = await api.allNames();
  // Namenlijsten voor ras, klasse en alignment — één keer ophalen en bewaren.
  if (tab === 'personages' && !_naamLijsten) {
    try { _naamLijsten = await fetch('/api/bron/volken-klassen').then(r => r.json()); }
    catch { _naamLijsten = { klassen: [], volkenGangbaar: [], volkenOverig: [], alignments: [] }; }
  }
  if (tab === 'personages' && !_spreukLijst) {
    try {
      const d = await fetch('/api/bron/spells-2024').then(r => r.json());
      _spreukLijst = (d.results || []).filter(sp => sp.school?.name);
    } catch { _spreukLijst = []; }
  }
  // Scroll-spell-picker: laad de spell-lijst één keer (voor de datalist + autofill).
  if (tab === 'voorwerpen' && !_scrollSpellList) {
    try { _scrollSpellList = (await fetch('/api/bron/spells-2024').then(r => r.json())).results || []; }
    catch { _scrollSpellList = []; }
  }
  let _editorGroups = [];
  try { const { groups } = await api.listGroups(); _editorGroups = groups; } catch { /* ok */ }

  editorTags = {};
  pendingAudioFile = null;
  _pendingVideoFile = null;
  _pendingVideoBron = null;
  _petTiers = Array.isArray(e?.statblockTiers) ? JSON.parse(JSON.stringify(e.statblockTiers)) : [];
  _editorOldAudioId = e?.data?.audioId || null;
  for (const lt of LINK_TYPES) {
    editorTags[lt] = e?.links?.[lt]?.slice() || [];
  }

  let body = `<form id="entity-form" class="space-y-4">`;

  // De datalists staan één keer bovenaan het formulier; de velden verwijzen
  // ernaar met `list=`. Gangbare volken eerst, daarna de rest — anders scrol je
  // door zevenenveertig namen voordat je bij Human bent.


  // ── DM-toggle vars (vroeg berekend, gebruikt in rechterkolom én textarea-sectie) ──
  const _valUitgesproken = e?.data?.flavourUitgesproken === true || e?.data?.flavourUitgesproken === 'true';
  const _existingAudioId = e?.data?.audioId || '';
  const _isNpcEditor     = e?.subtype === 'NPC';

  // ── Tabbladen ──
  // De editor is één lange kolom geworden; met markers knippen we hem daarna in
  // panelen (zie _bouwEditorTabs). Zo hoeft elk blok hieronder niets te weten
  // van waar het terechtkomt.

  // ── Linker kolom: afbeelding ──
  body += `<!--P:beeld-->`;
  {
    // Effectief portret-fileId: data.imageId (bibliotheek) of het entity-id zelf.
    const curImgId = e?.data?.imageId || (editId || '');
    const hasImg   = !!(e?.data?.imageId) || !!editId;
    const fileUrl  = hasImg ? api.fileUrl(curImgId) : '';
    const focusVal = e?.data?.imgFocus || '50% 50%';
    body += `
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Afbeelding</label>
        <div class="mt-1">
          <!-- De picker toont de héle afbeelding (object-contain): je zet het
               kruisje op het gezicht, ook als dat in een hoek zit. Daarnaast
               staan twee live previews met de echte uitsnedes — het kaartje
               (breed) en het ronde portret op de sheet — want daar wordt wél
               bijgesneden (object-cover) en dáár doet het focuspunt zijn werk. -->
          <div class="fp-rij${hasImg ? '' : ' hidden'}" id="fp-rij">
            <div id="fp-wrap" class="fp-wrap select-none"
              onmousedown="window._fpDown(event)"
              onmousemove="window._fpMove(event)"
              ontouchstart="window._fpTouch(event)"
              ontouchmove="window._fpTouch(event)">
              <img id="editor-img-preview" src="${fileUrl}"
                class="fp-wrap-img pointer-events-none"
                onload="window._fpTeken()"
                onerror="document.getElementById('fp-rij')?.classList.add('hidden')">
              <div id="fp-crosshair" class="fp-crosshair"></div>
            </div>
            <div class="fp-previews">
              <div>
                <div class="fp-prev fp-prev--kaart">
                  <img id="fp-card-preview" src="${fileUrl}" style="object-position:${focusVal}" alt="">
                </div>
                <span class="fp-prev-label">Kaartje</span>
              </div>
              <div>
                <div class="fp-prev fp-prev--rond">
                  <img id="fp-portret-preview" src="${fileUrl}" style="object-position:${focusVal}" alt="">
                </div>
                <span class="fp-prev-label">Portret</span>
              </div>
            </div>
          </div>
          <p class="text-[10px] text-ink-dim mb-1${hasImg ? '' : ' hidden'}" id="fp-hint">Sleep het kruisje naar wat in beeld moet blijven</p>
          <input type="hidden" name="data_imgFocus" id="fp-input" value="${focusVal}">
          <input type="hidden" name="data_imageId" id="editor-image-id" value="${esc(e?.data?.imageId || '')}">
          <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._editorPickImage()" title="Kies uit de bibliotheek of upload nieuw">
            ${icon('image')} ${hasImg ? 'Afbeelding toevoegen' : 'Afbeelding kiezen'}
          </button>
        </div>
      </div>
      <div>
        <!-- Onderschrift staat uit (zie _primaryCaption in _openDetail); het veld
             gaat verborgen mee zodat bestaande teksten niet verdwijnen. -->
        <input type="hidden" name="data_imgCaption" value="${esc(e?.data?.imgCaption || '')}">
        <!-- De overige afbeeldingen staan onder dezelfde kop: één knop, en de
             ster bepaalt welke de banner is. Twee aparte blokken met elk een
             eigen knop leidde alleen maar tot de vraag welke je moest hebben. -->
        <div id="entity-img-preview" class="editor-img-grid mt-2"></div>
      </div>
      ${tab === 'personages' ? `
      <!-- Alleen bij een spelerspersonage: het filmpje speelt op de
           landingspagina terwijl er op dát portret wordt ingezoomd. Bij een
           nieuw kaartje bewaren we het bestand tot het personage bestaat, want
           de upload heet naar zijn id. -->
      <div id="video-section"${e?.subtype === 'speler' ? '' : ' style="display:none"'}>
        <div class="text-xs font-cinzel text-ink-dim font-bold tracking-wide mb-1">Filmpje</div>
        <p class="text-[10px] text-ink-dim mb-1">Speelt op de landingspagina terwijl er op dit portret wordt ingezoomd. Maximaal 8 MB; langer dan 6 seconden mag, maar stopt dan vanzelf.</p>
        <div id="editor-video-status" class="text-xs text-ink-faint italic mb-1">${e?.id ? 'Controleren…' : ''}</div>
        <div class="flex items-center gap-2">
          <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm"
            onclick="window._editorPickVideo('${esc(e?.id || '')}')"
            title="Kies uit de mediabibliotheek of upload nieuw">
            ${icon('camera')} Filmpje kiezen
          </button>
          <button type="button" id="editor-video-del" class="dm-btn dm-btn-ghost dm-btn-sm hidden"
            onclick="window._removeCharVideo('${esc(e?.id || '')}')" title="Filmpje verwijderen">${icon('trash')}</button>
        </div>
      </div>` : ''}
    `;
  }


  // ── Rechter kolom: naam, type-velden ──
  body += `<!--P:info-->`;
  body += `
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Naam</label>
      <input name="name" value="${esc(e?.name || '')}" required
        class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
    </div>
  `;

  // Subtype
  if (schema.subtypes) {
    body += `
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Type</label>
        <select name="subtype" id="subtype-select"
          onchange="window._onSubtypeChange(this.value)"
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          <option value="">—</option>
          ${schema.subtypes.map(s => `<option value="${s}" ${e?.subtype === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    `;
  }

  // Groep-selector voor personages met subtype speler. Stond er alleen bij twee
  // of meer party's; met één party zag je dus niet aan welke hij hangt — en het
  // veld werd helemaal niet meegestuurd, wat het opslaan las als "verhuist naar
  // geen party". Nu altijd zichtbaar zodra er een party bestaat.
  if (tab === 'personages' && _editorGroups.length) {
    const isSpeler = e?.subtype === 'speler';
    const currentGroep = e?.data?.groep || (isSpeler && _editorGroups.length === 1 ? _editorGroups[0].id : '');
    body += `
      <div id="groep-section"${isSpeler ? '' : ' style="display:none"'}>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Party</label>
        <select name="data_groep"
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          <option value="">Geen party</option>
          ${_editorGroups.map(g => `<option value="${esc(g.id)}"${currentGroep === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}
        </select>
      </div>
    `;
  }

  // De huisdier-instellingen (adoptie + tiers) stonden hier bij Informatie, maar
  // het zijn statblok-zaken: ze horen bij Character Sheet. Zie daar.

  // Korte velden (niet-textarea) in rechter kolom
  let _revealGroupOpen = null;
  const _curItemType = e?.data?.itemType || '';
  // Eén doorloop, in schemavolgorde. Tekstvakken hadden een eigen ronde ná deze
  // lus, waardoor Beschrijving onder Flavour en Geheimen belandde — de volgorde
  // in SCHEMA klopte al, de rendering niet.
  for (const field of schema.fields) {
    if ((field.key === 'geheim' || field.dmOnly) && !isDM()) continue;
    // Close open reveal group when leaving it
    if (_revealGroupOpen && field.inReveal !== _revealGroupOpen) {
      body += `</div>`; // end reveal-group div
      _revealGroupOpen = null;
    }
    const val = e?.data?.[field.key] || '';
    // Velden die bij één subtype horen (of er juist niet): dezelfde aanpak als
    // showFor hieronder, maar dan op het type van het kaartje.
    const _sub = String(e?.subtype || '').toLowerCase();
    if (field.alleenBij || field.nietBij) {
      const zichtbaar = field.alleenBij ? field.alleenBij.includes(_sub) : !field.nietBij.includes(_sub);
      body += `<div data-voor-subtype="${(field.alleenBij || []).join(',')}" data-niet-subtype="${(field.nietBij || []).join(',')}"${zichtbaar ? '' : ' style="display:none"'}>`;
    }
    // showFor: wrap in a togglable div, initially hidden if itemType doesn't match
    if (field.showFor) {
      const _vis = field.showFor.includes(_curItemType);
      body += `<div data-show-for="${field.showFor.join(',')}" style="${_vis ? '' : 'display:none'}">`;
    }
    // hideFor: wrap in a togglable div, initially hidden if itemType matches
    if (field.hideFor) {
      const _hid = field.hideFor.includes(_curItemType);
      body += `<div data-hide-for="${field.hideFor.join(',')}" style="${_hid ? 'display:none' : ''}">`;
    }
    if (field.type === 'reveal-toggle') {
      const hasData = schema.fields
        .filter(f => f.inReveal === field.key)
        .some(f => e?.data?.[f.key] && e?.data?.[f.key] !== '');
      body += `
        <div class="flex items-center gap-2">
          <input type="checkbox" id="toggle-${field.key}" class="rounded"
            ${hasData ? 'checked' : ''}
            onchange="window._onRevealToggle('${field.key}', this.checked)">
          <label for="toggle-${field.key}" class="text-xs font-cinzel text-ink-dim font-bold tracking-wide cursor-pointer">${esc(field.label)}</label>
        </div>
        <div id="reveal-group-${field.key}" style="${hasData ? 'display:contents' : 'display:none'}">
      `;
      _revealGroupOpen = field.key;
      continue;
    }
    if (field.type === 'checkbox') {
      const checked = val === 'true' || val === true;
      body += `
        <div class="flex items-center gap-2">
          <input type="hidden" name="data_${field.key}" value="${checked ? 'true' : ''}">
          <input type="checkbox" id="cb_${field.key}" class="rounded"
            ${checked ? 'checked' : ''}
            onchange="this.previousElementSibling.value=this.checked?'true':''">
          <label for="cb_${field.key}" class="text-xs font-cinzel text-ink-dim font-bold tracking-wide cursor-pointer">${esc(field.label)}</label>
        </div>
      `;
    } else if (field.type === 'textarea') {
      const taId   = `ta_${field.key}`;
      const _rows  = field.key === 'desc' ? 6 : 4;
      const _taHtml = `${fmtToolbar(taId)}<textarea id="${taId}" name="data_${field.key}" rows="${_rows}"
            onkeydown="window._fmtKey(event)"
            class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(val)}</textarea>`;
      if (['persoonlijkheid', 'flavour', 'geheim'].includes(field.key)) {
        body += `
        <details class="cs-accordion${field.dmOnly ? ' veld-dmonly' : ''}"${val ? ' open' : ''}>
          <summary class="cs-accordion-head">
            <span>${esc(field.label)}</span>
            <span class="cs-accordion-chevron">▾</span>
          </summary>
          <div class="cs-accordion-body">${_taHtml}</div>
        </details>`;
      } else {
        body += `
        <div${field.dmOnly ? ' class="veld-dmonly"' : ''}>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <div class="mt-1">${_taHtml}</div>
        </div>`;
      }
    } else if (field.type === 'select') {
      const _selOnchange = (tab === 'locaties' && field.key === 'locType')
        ? ' onchange="window._onLocTypeChange(this.value)"'
        : (tab === 'voorwerpen' && field.key === 'itemType')
        ? ' onchange="window._onItemTypeChange(this.value)"'
        : '';
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <select name="data_${field.key}"${_selOnchange} class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
            <option value="">—</option>
            ${_optiesHtml(field, val)}
          </select>
        </div>
      `;
    } else if (field.type === 'rollen') {
      const _gekozen = _tagsUit(val);
      // Oud subtype telt mee, zodat een bestaand kaartje meteen goed staat.
      if (e?.subtype && ROLLEN.some(r => r.key === e.subtype) && !_gekozen.includes(e.subtype)) _gekozen.push(e.subtype);
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <input type="hidden" name="data_${field.key}" id="rollen-veld" value="${esc(JSON.stringify(_gekozen))}">
          <div class="rollen-rij mt-1">
            <span class="rollen-rollen"${String(e?.subtype || '').toLowerCase() === 'dier' ? ' style="display:none"' : ''}>
              ${ROLLEN.map(r => `
                <label class="rol-keuze" title="${esc(r.uitleg)}">
                  <input type="checkbox" value="${r.key}" ${_gekozen.includes(r.key) ? 'checked' : ''}
                    onchange="window._rollenBij()">
                  <span>${esc(r.label)}</span>
                </label>`).join('')}
              <span class="rollen-scheiding" aria-hidden="true"></span>
            </span>
            <!-- Kant in gevecht staat in dezelfde rij, achter een streepje: het
                 zijn ook vinkjes, maar er kan er maar één aan staan. Een
                 dropdown ernaast oogde als iets van een andere orde. -->
            ${(() => {
              // Zonder keuze staat hij neutraal: de meeste kaartjes vechten niet mee,
              // en een leeg vakje leest als "vergeten in te vullen".
              const kantNu = e?.data?.kant || 'neutraal';
              return [['bondgenoot', 'Bondgenoot'], ['neutraal', 'Neutraal'], ['vijand', 'Vijand']].map(([k, label]) => `
              <label class="rol-keuze rol-keuze--kant" title="Aan welke kant dit personage staat als er gevochten wordt">
                <input type="checkbox" value="${k}" ${kantNu === k ? 'checked' : ''}
                  onchange="window._kantBij(this)">
                <span>${label}</span>
              </label>`).join('') + `
            <input type="hidden" name="data_kant" id="kant-veld" value="${esc(kantNu)}">`;
            })()}
          </div>
        </div>
      `;
      // ── Adoptie (type 'dier') ──
      // Direct onder de rollen: het gaat over of en voor hoeveel de party dit
      // dier kan krijgen. Zijn statblok (de tiers) staat op het sheet.
      if (tab === 'personages' && isDM()) {
        const _isDierNu = e?.subtype === 'dier';
        const _adopt2   = e?.data?.adopteerbaar === true || e?.data?.adopteerbaar === 'true';
        const _prijsCl2 = (() => {
          const cl = parseInt(e?.data?.adoptiePrijsCl);
          if (!isNaN(cl)) return cl;
          const fl = parseInt(e?.data?.adoptiePrijs?.fl ?? e?.data?.adoptiePrijsFl);
          return isNaN(fl) ? null : fl * 100;
        })();
        const _mn2 = window._muntNamen();
        body += `
          <div id="pet-adopt-section"${_isDierNu ? '' : ' style="display:none"'}>
            <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Adoptie</label>
            <label class="rol-keuze mt-1" style="display:flex">
              <input type="checkbox" id="pet-adopt-cb" ${_adopt2 ? 'checked' : ''}
                onchange="document.getElementById('pet-adopt-hidden').value=this.checked?'true':''">
              <span>Te adopteren door een party</span>
            </label>
            <input type="hidden" name="data_adopteerbaar" id="pet-adopt-hidden" value="${_adopt2 ? 'true' : ''}">
            <div class="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label class="text-[10px] font-cinzel text-ink-dim uppercase">Adoptieprijs</label>
                <input name="data_adoptiePrijs_tekst" value="${_prijsCl2 === null ? '' : `${Math.floor(_prijsCl2 / 100)},${String(_prijsCl2 % 100).padStart(2, '0')}`}"
                  placeholder="12,34" inputmode="decimal"
                  title="Eén bedrag met een komma: 12,34 is 12 ${esc(_mn2.fl)}, 3 ${esc(_mn2.kn)} en 4 ${esc(_mn2.cl)}. Munten mogen ook: 5 gp 2 sp, 2 pp."
                  class="w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              </div>
            </div>
            <p class="text-[10px] text-ink-dim mt-1">Verschijnt bij de dienst die dieren aanbiedt.</p>
            <div class="mt-2">
              <label class="text-[10px] font-cinzel text-ink-dim uppercase">Baasje</label>
              <select id="pet-baasje" onchange="window._petBaasjeZet('${esc(editId || '')}', this.value)"
                class="w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
                <option value="">— nog niemand —</option>
              </select>
              <p class="text-[10px] text-ink-dim mt-0.5">Het dier loopt dan mee met de party van dit personage: het staat op het partytabblad, is te vullen in een gevecht, en het tier volgt zijn level. Adopteren via de dienst doet hetzelfde.</p>
            </div>
          </div>
        `;
      }

      // Waar iemand verkoopt hoort bij zijn rollen, niet in een eigen tabblad:
      // het is één keuzelijst. De waren zelf liggen bij de locatie.
      if (tab === 'personages' && isDM()) {
        body += `
          <div id="voorraad-section"${window._heeftRol(e, 'verkoper') ? '' : ' style="display:none"'}>
            <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Verkoopt bij</label>
            <input type="hidden" name="data_winkelLocatieId" id="winkel-loc-id" value="${esc(e?.data?.winkelLocatieId || '')}">
            <input list="winkel-loc-dl" id="winkel-loc-naam" placeholder="Zoek een locatie\u2026" value=""
              onchange="window._winkelLocKies(this.value)"
              class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
            <datalist id="winkel-loc-dl"></datalist>
            <div id="winkel-loc-link" class="mt-2"></div>
          </div>`;
      }
    } else if (field.type === 'lijst-tekst') {
      const regels = _tekstLijstUit(e?.data, field.key, field.enkelvoud);
      if (!regels.length) regels.push('');
      const _metAntag = field.key === 'geheimen' && tab === 'personages';
      const _antagVlaggen = _metAntag ? _antagUit(e?.data, regels.length) : [];
      const _verborgenVeld = field.key === 'geheimen';
      body += `
        <div${_verborgenVeld ? ' class="veld-dmonly"' : ''}>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <div id="lijst-${field.key}" class="lijst-veld" data-veld="${field.key}"${_metAntag ? ' data-antag="1"' : ''}>
            ${regels.map((t, i) => _lijstRegelHtml(field.key, t, i, _antagVlaggen[i], _metAntag)).join('')}
          </div>
          <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm mt-1"
            onclick="window._lijstRegelErbij('${field.key}')">${icon('plus')} Regel toevoegen</button>
        </div>
      `;
    } else if (field.type === 'lijst') {
      // Zoekbaar invoerveld met een datalist: typen filtert, en wat er niet in
      // staat mag je alsnog intikken — een campagne met eigen volken of klassen
      // wordt zo niet klemgezet. De lijsten komen uit bronnen/volken-klassen.json.
      const _opties = field.lijst === 'volken'
        ? [...(_naamLijsten?.volkenGangbaar || []), ...(_naamLijsten?.volkenOverig || [])]
        : (_naamLijsten?.[field.lijst] || []);
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          ${_keuzeVeldHtml(`kv-${field.key}`, `data_${field.key}`, val, _opties, 'Typ of kies\u2026')}
        </div>
      `;
    } else if (field.type === 'entiteit') {
      // Vrije tekst blijft het veld zelf (data_<key>); het kaartje komt er als
      // data_<key>Id naast. Wie niets koppelt houdt dus gewoon zijn tekst.
      const _dlId = `link-dl-${field.key}`;
      const _inId = `link-in-${field.key}`;
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide" for="${_inId}">${esc(field.label)}</label>
          <input id="${_inId}" name="data_${field.key}" value="${esc(val)}" list="${_dlId}"
            data-link-veld="1" data-link-doel="${field.doel.join(',')}" data-link-id="link-hid-${field.key}"
            data-link-status="link-st-${field.key}"
            oninput="window._linkVeldWijzig(this)" placeholder="${esc(field.hint || 'Typ of kies\u2026')}"
            class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
          <datalist id="${_dlId}" data-link-doel="${field.doel.join(',')}"></datalist>
          <input type="hidden" id="link-hid-${field.key}" name="data_${field.key}Id" value="${esc(e?.data?.[field.key + 'Id'] || '')}">
          <div id="link-st-${field.key}" class="link-status"></div>
        </div>
      `;
    } else if (field.type === 'betrokkenen') {
      // Eén lijst in plaats van losse velden voor eigenaar, personeel en
      // stamgasten: in de praktijk staan daar allebei personages én
      // organisaties in, en wie wát is verschilt per kaartje. Bestaande
      // eigenaar-tekst wordt de eerste regel, zodat niets verdwijnt.
      const rijen = _betrokkenenUit(e?.data);
      if (!rijen.length) rijen.push({ naam: '', rol: '' });
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <div id="betrokkenen-lijst">
            ${rijen.map((r, i) => _betrokkenRijHtml(r, i)).join('')}
          </div>
          <datalist id="betrokken-dl" data-link-doel="personages,organisaties"></datalist>
          <datalist id="betrokken-rol-dl">
            ${BETROKKEN_ROLLEN.map(r => `<option value="${esc(r)}">`).join('')}
          </datalist>
          <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm mt-1"
            onclick="window._betrokkenErbij()">${icon('plus')} Iemand toevoegen</button>
        </div>
      `;
    } else if (field.type === 'weapon-tags') {
      const _sel = (() => { try { return JSON.parse(val || '[]'); } catch { return []; } })();
      body += `
        <div class="weapon-tags-editor-wrap">
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <input type="hidden" name="data_${field.key}" id="wt_${field.key}" value="${esc(val)}">
          <div class="weapon-tags-picker">
            ${Object.keys(WEAPON_PROPERTIES).map(prop => {
              const _isParam = PARAMETERIZABLE_PROPS.has(prop);
              const _curVal  = _sel.find(s => s === prop || s.startsWith(prop + ' (')) || null;
              const _isOn    = !!_curVal;
              const _paramVal = (_curVal && _curVal !== prop)
                ? _curVal.slice(prop.length + 2, -1) : '';
              const _placeholder = prop === 'Versatile' ? '1d8' : '30/120';
              const _safeId = 'wtp-' + field.key + '-' + prop.replace(/[^a-zA-Z0-9]/g, '_');
              if (_isParam) {
                return `<span class="weapon-tag-pick-group">
                  <button type="button"
                    class="weapon-tag-pick${_isOn ? ' weapon-tag-pick--on' : ''}"
                    onclick="window._toggleWeaponTag('${escJS(field.key)}','${escJS(prop)}',this)">${esc(prop)}</button>
                  <input type="text" id="${_safeId}"
                    class="weapon-tag-param-inp${_isOn ? '' : ' hidden'}"
                    placeholder="${_placeholder}"
                    value="${esc(_paramVal)}"
                    oninput="window._updateWeaponTagParam('${escJS(field.key)}','${escJS(prop)}',this.value)"
                    onclick="event.stopPropagation()">
                </span>`;
              }
              return `<button type="button"
                class="weapon-tag-pick${_isOn ? ' weapon-tag-pick--on' : ''}"
                onclick="window._toggleWeaponTag('${escJS(field.key)}','${escJS(prop)}',this)">${esc(prop)}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    } else if (field.type === 'spell-picker') {
      const _spells = _scrollSpellList || [];
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <input list="scroll-spell-dl" id="scroll-spell-pick" placeholder="Zoek een spell…" autocomplete="off"
            onchange="window._scrollPickSpell(this.value)"
            class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          <datalist id="scroll-spell-dl">${_spells.map(s => `<option value="${esc(s.name)}"></option>`).join('')}</datalist>
        </div>
      `;
    } else {
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <input name="data_${field.key}" value="${esc(val)}"${field.hint ? ` placeholder="${esc(field.hint)}"` : ''}
            class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
        </div>
      `;
    }
    if (field.showFor) body += `</div>`; // close showFor wrapper
    if (field.hideFor) body += `</div>`; // close hideFor wrapper
    if (field.alleenBij || field.nietBij) body += `</div>`;
  }
  if (_revealGroupOpen) { body += `</div>`; _revealGroupOpen = null; }

  // De toggles-rij is leeg: "roddel uitgesproken" hoort bij de herberg (de server
  // houdt dat per flavourregel bij) en de medestander-knop staat nu in de DM-rij
  // van het detailvenster, bij "markeer als deceased" — beide zijn handelingen,
  // geen velden van het kaartje.

  // ── Koppelingen ──
  // Wat dit kaartje elders is: de herberg van de campagne, de tempel van een
  // god, het kaartje achter een factie, of een dungeonkaart. De eerste drie
  // liggen in meta.json (de dienst is de eigenaar van die koppeling) en worden
  // meteen bij het wisselen bewaard; de dungeon hoort bij het kaartje zelf en
  // gaat mee met Opslaan. Alleen bij een bestaand kaartje: zonder id valt er
  // niets te koppelen.
  if (['locaties', 'organisaties'].includes(tab) && isDM() && e?.id) {
    const _isLoc = tab === 'locaties';
    body += `
      <div class="koppel-sectie" id="koppel-sectie">
        <div class="cs-sectiekop">Koppelingen</div>
        <div id="koppel-laden" class="veld-uitleg">Laden\u2026</div>
        <div id="koppel-inhoud" class="hidden">
          ${_isLoc ? `
          <div class="koppel-rij" id="koppel-herberg" style="display:none">
            <label class="koppel-vink">
              <input type="checkbox" id="koppel-herberg-vink" onchange="window._koppelZet({ herberg: this.checked })">
              <span>Dit is de herberg van de campagne</span>
            </label>
            <div class="veld-uitleg" id="koppel-herberg-uitleg"></div>
          </div>
          <div class="koppel-rij" id="koppel-tempel" style="display:none">
            <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide" for="koppel-god">God van deze tempel</label>
            <select id="koppel-god" class="koppel-select" onchange="window._koppelZet({ godNaam: this.value })"></select>
            <div class="veld-uitleg">De Tempel-dienst gebruikt dit kaartje als achtergrond bij die god.</div>
          </div>` : `
          <div class="koppel-rij">
            <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide" for="koppel-factie">Factie</label>
            <select id="koppel-factie" class="koppel-select" onchange="window._koppelZet({ factieId: this.value })"></select>
            <div class="veld-uitleg">Koppelt dit kaartje aan een factie uit het Facties-paneel.</div>
          </div>`}
          ${_isLoc ? `
          <div class="koppel-rij">
            <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide" for="koppel-dungeon">Dungeonkaart</label>
            <div class="koppel-duo">
              <select id="koppel-dungeon" class="koppel-select" onchange="window._koppelDungeonWissel()"></select>
              <select id="koppel-room" class="koppel-select" onchange="window._koppelRoomWissel()"></select>
            </div>
            <input type="hidden" name="data_dungeonId" id="koppel-dungeon-id" value="${esc(e?.data?.dungeonId || '')}">
            <input type="hidden" name="data_roomId"    id="koppel-room-id"    value="${esc(e?.data?.roomId || '')}">
            <div class="veld-uitleg">Een kamer kiezen mag, maar hoeft niet — de hele kaart volstaat.</div>
          </div>
          <div class="koppel-rij" id="koppel-kaart"></div>` : ''}
        </div>
      </div>
    `;
  }



  // ── Verborgen inputs + audio ── hoort bij het beeld-tabblad
  body += `<!--P:beeld-->`;
  if (tab === 'personages' && isDM()) {
    body += `
      <input type="hidden" name="data_flavourUitgesproken" id="inp-flavourUitgesproken" value="${_valUitgesproken ? 'true' : ''}">
      <div style="display:none" aria-hidden="true">
        ${_existingAudioId ? `
          <button type="button" id="editor-audio-preview" class="flavour-audio-btn editor-audio-preview"
            data-audio-btn data-audio-btn-id="${esc(_existingAudioId)}"
            onclick="window._audioToggle('${esc(_existingAudioId)}')" title="Afspelen / pauzeren">▶</button>
          <button type="button" onclick="window._editorClearAudio()">${icon('x')} Verwijderen</button>
        ` : `<div id="editor-audio-preview" class="hidden"></div>`}
        <label>
          <input type="file" accept="audio/*" class="hidden" onchange="window._editorAudioSelected(this.files[0])">
        </label>
        <div id="editor-audio-name" class="hidden"></div>
      </div>
      <input type="hidden" name="data_audioId" id="editor-audio-id" value="${esc(_existingAudioId)}">
    `;
  }

  // ── Tabblad Winkel ──
  // Alleen voor locaties: daar liggen de waren. Een verkoper heeft er maar één
  // veld voor nodig ("Verkoopt bij"), en dat staat bij Informatie — een heel
  // tabblad voor één keuzelijst is er een te veel.
  body += `<!--P:winkel-->`;
  if (tab === 'locaties') {
    const _showVoorraad = true;
    let winkelConfigEditor = {};
    try { winkelConfigEditor = e?.data?.winkelConfig ? JSON.parse(e.data.winkelConfig) : {}; } catch {}
    body += `
      <div id="voorraad-section"${_showVoorraad ? '' : ' style="display:none"'}>
        <div class="cs-sectiekop" style="border-top:0;margin-top:0;padding-top:0">Voorraad</div>
        <div class="voorraad-inladen-wrap mb-3">
          <button type="button" onclick="window._voorraadInladenToggle()"
            class="text-xs text-ink-dim hover:text-gold transition flex items-center gap-1">
            <span id="voorraad-inladen-chevron">▸</span> Inladen van bestaande winkel…
          </button>
          <div id="voorraad-inladen-panel" class="hidden mt-2 flex gap-2 items-center">
            <select id="voorraad-inladen-select"
              class="flex-1 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              <option value="">— laden… —</option>
            </select>
            <button type="button" onclick="window._voorraadInladen()"
              class="px-3 py-1 bg-room-bg border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright transition">
              Inladen
            </button>
          </div>
        </div>
        <div id="voorraad-rows" class="space-y-2 mb-3"></div>
        <button type="button" id="voorraad-add-btn" onclick="window._addVoorraadItem()"
          class="px-3 py-1 bg-room-bg border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright transition">
          ${icon('plus')} Voorwerp toevoegen
        </button>
        <!-- Wisselend assortiment: niet alles ligt altijd in de schappen -->
        <div>
          <div class="cs-sectiekop">Wisselend assortiment</div>
          <input type="hidden" name="data_winkelConfig" id="winkelconfig-hidden" value="${esc(e?.data?.winkelConfig || '')}">
          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm text-ink-medium cursor-pointer">
              <input type="checkbox" id="wc-roterend" ${winkelConfigEditor.roterend ? 'checked' : ''} onchange="window._wcUpdate()">
              Toon steeds maar een deel van de voorraad
            </label>
            <div id="wc-extra" class="${winkelConfigEditor.roterend ? '' : 'hidden'} space-y-2 pl-4">
              <div class="flex gap-2 items-center">
                <label class="text-xs text-ink-dim w-32">Aantal tegelijk</label>
                <input type="number" id="wc-aantal" min="1" max="50" value="${winkelConfigEditor.aantalItems || 3}"
                  oninput="window._wcUpdate()"
                  class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              </div>
              <div class="flex gap-2 items-center">
                <label class="text-xs text-ink-dim w-32">Refresh na (uur)</label>
                <input type="number" id="wc-uren" min="1" value="${winkelConfigEditor.refreshUren || 24}"
                  oninput="window._wcUpdate()"
                  class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              </div>
              <div class="flex gap-2 items-center">
                <label class="text-xs text-ink-dim w-32" title="Winkels met hetzelfde woord hier tonen samen dezelfde selectie en verversen tegelijk">Zelfde selectie als</label>
                <input type="text" id="wc-deelgroep" value="${esc(winkelConfigEditor.deelGroep || '')}"
                  oninput="window._wcUpdate()" placeholder="bijv. mystiek-magazijn"
                  class="flex-1 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              </div>
            </div>
          </div>
        </div>
        <!-- Sfeer & Onderhandelen instellingen -->
        <div>
          <div class="cs-sectiekop">Sfeer</div>
          <div>
            <label class="text-xs text-ink-dim block mb-1">Sfeertekst (bovenaan de voorraad)</label>
            <textarea id="wc-sfeer" rows="2" oninput="window._wcUpdate()" placeholder="De schappen liggen vol met\u2026"
              class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(winkelConfigEditor.sfeerTekst || '')}</textarea>
          </div>
        </div>
        <div>
          <div class="cs-sectiekop">Inkoop</div>
          <p class="text-xs text-ink-dim">
            Wat de winkel van spelers overneemt bepaal je aan tafel: open het
            kaartje van de winkel en gebruik daar <em>Inkopen van de party</em>.
          </p>
        </div>
      </div>
    `;
  }

  // Stats (personages) — eigen tabblad
  body += `<!--P:sheet-->`;
  if (tab === 'personages') {
    const s = e?.stats || {};
    const _veldCls = 'w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none';
    const _si = (k, label, o = {}) => `
      <div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>
        <input name="stat_${k}" value="${esc(s[k] || '')}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}
          class="${_veldCls}${o.center ? ' text-center' : ''}">
      </div>`;
    // Vaste lijstjes (Size, Creature Type) horen in een dropdown: er zijn maar
    // een handvol geldige waarden en typefouten maken filteren onmogelijk.
    const _sel = (k, label, opties) => `
      <div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>
        <select name="stat_${k}" class="${_veldCls}">
          <option value="">\u2014</option>
          ${opties.map(o => `<option value="${esc(o)}"${(s[k] || '') === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}
        </select>
      </div>`;
    const _ta = (k, label, rows = 3, waarde = null) => {
      const taId = `stat_ta_${k}`;
      return `<div>
        ${label ? `<label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>` : ''}
        <div class="mt-0.5">
          ${fmtToolbar(taId)}
          <textarea id="${taId}" name="stat_${k}" rows="${rows}"
            onkeydown="window._fmtKey(event)"
            class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(waarde ?? s[k] ?? '')}</textarea>
        </div>
      </div>`;
    };
    // Dezelfde bouwstenen als een tier, maar met name="stat_…" zodat het
    // formulier van het kaartje ze meestuurt.
    const _hBlad = {
      inp: _si,
      sel: _sel,
      ta:  (k, label, rows) => _ta(k, label, rows),
      abil: (k) => `
        <div>
          <label class="text-[10px] font-cinzel text-ink-dim uppercase">${k.toUpperCase()}
            <span class="cs-mod" id="cs-mod-${k}">${_abilityMod(s[k])}</span></label>
          <input name="stat_${k}" value="${esc(s[k] || '')}" inputmode="numeric"
            oninput="window._sbModUpdate('cs-mod-${k}', this.value)"
            class="${_veldCls} text-center">
        </div>`,
    };

    const _hasStats = Object.values(s).some(v => v);
    const _isDier   = e?.subtype === 'dier';
    // Bij een dier is dit blok de basis waar de tiers onderaan op verder bouwen;
    // zonder die regel las het als "een statblok dat toch niets doet".
    body += `
      <div class="cs-blok">
        <div>
          ${_isDier ? '<p class="cs-basis-uitleg">Dit is het dier vanaf level 1. Onderaan dit blad laat je het meegroeien met het baasje.</p>' : ''}
          <!-- Een dier heeft geen spreukenlijst, en met alleen Combat + Actions
               is een tabbalk een zoekplaatje voor twee panelen. Hij krijgt
               daarom dezelfde platte vorm als een tier: alles onder elkaar met
               Actions onderaan. NPC's houden de tabs — die hebben wél spells. -->
          ${_isDier ? '' : `
          <div class="cs-tabs-bar">
            <button type="button" class="cs-tab-btn cs-tab-active" onclick="window._csTab('gevecht')">Combat</button>
            <button type="button" class="cs-tab-btn" onclick="window._csTab('acties')">Actions</button>
            <button type="button" class="cs-tab-btn" onclick="window._csTab('spreuken')">Spells</button>
          </div>`}

          <div id="cs-panel-gevecht" class="cs-sub-body space-y-2">
            ${_sbCombatHtml(_hBlad)}
            ${_isDier ? `<div class="cs-sectiekop">Actions</div>${_sbActiesHtml(_hBlad)}` : ''}
          </div>

          ${_isDier ? '' : `
          <div id="cs-panel-acties" class="cs-sub-body space-y-2" style="display:none">
            ${_sbActiesHtml(_hBlad)}
          </div>

          <div id="cs-panel-spreuken" class="cs-sub-body space-y-2" style="display:none">
            <div class="grid grid-cols-2 gap-2">
              ${_si('spellSaveDC','Spell Save DC',{center:true})}${_si('spellAttackMod','Spell Attack Mod',{center:true})}
            </div>
            <!-- Gekoppelde spreuken: overtypen levert een dood tekstveld op, een
                 koppeling levert een kaartje op waar je doorheen klikt. De
                 tekstvelden eronder blijven voor wat niet in de bibliotheek staat. -->
            <div>
              <label class="text-[10px] font-cinzel text-ink-dim uppercase">Spells</label>
              <div id="cs-spell-chips" class="cs-spell-chips"></div>
              ${_keuzeVeldHtml('cs-spell-add', '', '', (_spreukLijst || []).map(sp => sp.name), 'Zoek een spell\u2026',
                (invoer) => window._csSpellAdd(invoer))}
              <input type="hidden" name="stat_spellIndexes" id="cs-spell-indexes" value="${esc(s.spellIndexes || '')}">
            </div>
            <!-- Cantrips en spells die niet in de bibliotheek staan, in één vak.
                 Een <details> houdt het dicht tot je het nodig hebt; de inhoud
                 blijft in de DOM, dus hij wordt gewoon meegestuurd bij opslaan. -->
            <details class="cs-vrij-spells"${(s.cantrips || s.spells) ? ' open' : ''}>
              <summary>Niet in de bibliotheek</summary>
              <div class="mt-2">
                ${_ta('spells','Cantrips &amp; spells (vrij)', 3,
                  [s.cantrips, s.spells].filter(Boolean).join('\n'))}
                <input type="hidden" name="stat_cantrips" value="">
              </div>
            </details>
            ${s.extra ? _ta('extra','Legacy', 2) : ''}
          </div>`}
        </div>
      </div>
    `;

    // ── Huisdier: adoptie + tiers ──
    // Alleen zichtbaar bij type 'dier'. Zelfde koppen en velden als de rest van
    // het blad, want een tier ís een statblok dat met het baasje meeschaalt.
    const isDier   = _isDier;
    const _adopt   = e?.data?.adopteerbaar === true || e?.data?.adopteerbaar === 'true';
    const _prijsCl = (() => {
      const cl = parseInt(e?.data?.adoptiePrijsCl);
      if (!isNaN(cl)) return cl;
      const fl = parseInt(e?.data?.adoptiePrijs?.fl ?? e?.data?.adoptiePrijsFl);
      return isNaN(fl) ? null : fl * 100;
    })();
    const _mn = window._muntNamen();
    // Alleen de tiers horen op dit blad: dat zijn statblokken. De adoptie zelf
    // (te koop, prijs, wat voor dier) staat bij Informatie.
    body += `
      <div id="pet-tier-section"${isDier ? '' : ' style="display:none"'}>
        <div class="cs-sectiekop">Meegroeien met het baasje</div>
        <p class="text-[10px] text-ink-dim mb-2">Het statblok hierboven is het dier vanaf level&nbsp;1. Een tier neemt het over zodra het baasje dat level haalt, en zegt alleen wat er verandert.</p>
        <div id="pet-tiers-list"></div>
        <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm mt-1" onclick="window._petTierAdd()">${icon('plus')} Tier toevoegen</button>
      </div>
    `;
  }

  // De Verbindingen-editor is vervallen: koppelingen leg je in de tekst zelf met
  // [[Naam]], en die worden overal als klikbare link gerenderd. Het veld
  // `links` blijft bestaan (kaartjes, dashboard, zoeken en de export lezen het
  // nog) maar wordt niet meer met de hand bijgehouden.

  // Buttons — met een marker, zodat ze ná de panelen komen en op elk tabblad
  // zichtbaar zijn. Zonder dat stond de opslaanknop in het laatste paneel.
  body += `<!--P:knoppen-->`;
  body += `
    <div class="flex gap-2 pt-2 ed-knoppen">
      <button type="submit" class="px-4 py-2 bg-gold-dim text-room-bg font-cinzel font-semibold rounded hover:bg-gold transition">
        ${icon('save')}
      </button>
      ${editId ? `
        <button type="button" onclick="window._deleteEntity('${tab}','${editId}')"
          class="px-4 py-2 bg-seal/20 text-seal rounded hover:bg-seal/40 transition">
          ${icon('trash')}
        </button>
      ` : ''}
      <button type="button" onclick="window.app.closeModal()"
        class="px-4 py-2 bg-room-elevated text-ink-dim rounded hover:text-ink-bright transition" title="Annuleren">${icon('x')}</button>
    </div>
  </form>`;

  // De winkel krijgt alleen een tabblad als dit kaartje er een heeft.
  // Een tempel die drankjes verkoopt is geen 'Winkel', maar hoort het tabblad
  // wél te hebben zodra er waren liggen.
  const _heeftWaren = !!(e?.data?.voorraad && e.data.voorraad !== '[]');
  // Een blad heet naar wat erop staat: een speler heeft een character sheet, de
  // rest een statblock.
  const _sheetLabel = (tab === 'personages' && e?.subtype !== 'speler') ? 'Statblock' : null;
  body = _bouwEditorTabs(body, tab === 'locaties'
    ? (e?.data?.locType === 'Winkel' || _heeftWaren)
    : window._heeftRol(e, 'verkoper'), _sheetLabel);
  const _tm = TYPE_META[tab];
  openModal(editId ? (_tm.bewerk || 'Bewerken') : (_tm.nieuw || 'Nieuw'), '', body);

  // Huisdier-tier-editor vullen (no-op als de sectie er niet is)
  window._renderPetTiers();

  // Staat er al een filmpje bij dit personage? (no-op zonder die sectie)
  if (e?.id) window._charVideoStatus(e.id);

  // ── CS tab switcher ──
  window._csTab = (name) => {
    ['gevecht','acties','spreuken'].forEach(t => {
      const p = document.getElementById('cs-panel-' + t);
      if (p) p.style.display = t === name ? '' : 'none';
    });
    document.querySelectorAll('.cs-tab-btn').forEach(b => {
      b.classList.toggle('cs-tab-active', b.getAttribute('onclick').includes("'" + name + "'"));
    });
  };

  // ── Ctrl+S sneltoets (#34: gescoped op het formulier i.p.v. een globale
  // document-listener — sterft met de editor, geen collision tussen editors) ──
  _csSpellChips();   // chips tekenen zodra het formulier in de DOM staat
  const _editorForm = document.getElementById('entity-form');
  if (_editorForm) {
    _editorForm.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') {
        ev.preventDefault();
        _editorForm.requestSubmit();
      }
    });
  }

  // ── Extra images editor state ──
  entityEditorImagesToDelete = [];
  entityEditorImages = _parseExtraImages(e?.data?.extraImages).map(item => ({
    id: item.id,
    url: api.fileUrl(item.id),
    isNew: false,
    caption: item.caption || '',
  }));
  // Extra afbeeldingen liepen langs de mediabibliotheek heen: een kaal
  // bestandsveld dat rechtstreeks uploadde. Daardoor kreeg zo'n afbeelding geen
  // naam in de bibliotheek en kon je een bestaande niet hergebruiken.
  window._editorPickExtraImage = () => {   // zelfde als de knop hierboven; blijft voor oude aanroepen
    const naamHint = (document.querySelector('#entity-form [name="name"]')?.value || '')
      .trim().toLowerCase().replace(/\s+/g, '-');
    window.mediaPicker.open({
      type: 'afbeelding',
      suggestedName: naamHint ? `${naamHint}-beeld` : 'beeld',
      onSelect: (fileId) => {
        if (!fileId || entityEditorImages.some(i => i.id === fileId)) return;
        entityEditorImages.push({ id: fileId, url: api.fileUrl(fileId), isNew: false, caption: '' });
        _refreshEntityImages();
      },
    });
  };

  window._addEntityImages = (files) => {
    for (const file of files) {
      const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      entityEditorImages.push({ id, url: URL.createObjectURL(file), isNew: true, file, caption: '' });
    }
    _refreshEntityImages();
  };
  window._removeEntityImage = (idx) => {
    const img = entityEditorImages[idx];
    // Loskoppelen is niet hetzelfde als weggooien: sinds afbeeldingen uit de
    // mediabibliotheek komen, kan hetzelfde bestand ook elders in gebruik zijn.
    // Het bestand zelf verwijder je in de Media-tab, die laat zien waar het
    // gebruikt wordt.
    if (img?.isNew) URL.revokeObjectURL(img.url);
    entityEditorImages.splice(idx, 1);
    _refreshEntityImages();
  };
  window._updateEntityImageCaption = (idx, val) => {
    if (entityEditorImages[idx]) entityEditorImages[idx].caption = val;
  };
  setTimeout(() => _refreshEntityImages(), 0);

  // ── Voorraad editor state ──
  let _voorraadItems = [];
  if (tab === 'personages' || tab === 'locaties') {
    try { _voorraadItems = e?.data?.voorraad ? JSON.parse(e.data.voorraad) : []; } catch { _voorraadItems = []; }

    let _voorraadEntityOptions = []; // { id, name } — geladen uit voorwerpen
    // Async: laad voorwerpen voor koppeling + auto-link op naam
    if (isDM()) {
      api.listEntities('voorwerpen').then(items => {
        _voorraadEntityOptions = items.map(i => ({ id: i.id, name: i.name }));
        // Auto-link bestaande items op exacte naamovereenkomst
        let changed = false;
        _voorraadItems = _voorraadItems.map(item => {
          if (!item.entityId && item.naam) {
            const match = _voorraadEntityOptions.find(o => o.name.toLowerCase() === item.naam.toLowerCase());
            if (match) { changed = true; return { ...item, entityId: match.id }; }
          }
          return item;
        });
        const dl = document.getElementById('voorraad-entity-dl');
        if (dl) dl.innerHTML = _voorraadEntityOptions.map(o => `<option value="${esc(o.name)}">`).join('');
        if (changed) window._refreshVoorraad();
      }).catch(() => {});
    }

    window._refreshVoorraad = () => {
      const rows = document.getElementById('voorraad-rows');
      if (!rows) return;
      setTimeout(() => window._voorraadAddKnop?.(), 0);
      rows.innerHTML = _voorraadItems.length === 0
        ? `<p class="text-xs text-ink-faint italic">Nog geen items toegevoegd</p>`
        : _voorraadItems.map((item, idx) => {
          const linked = !!item.entityId;
          const entityDisplayName = item.entityId
            ? (_voorraadEntityOptions.find(o => o.id === item.entityId)?.name || item.naam || '')
            : '';
          return `
          <div class="flex gap-2 items-center flex-wrap voorraad-rij">
            <input placeholder="Naam voorwerp" value="${esc(item.naam || '')}"
              oninput="window._updateVoorraadItem(${idx},'naam',this.value);window._voorraadAddKnop()"
              class="flex-1 min-w-24 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            <input placeholder="Prijs (bijv. 15 gp)" value="${esc(item.prijs || '')}"
              oninput="window._updateVoorraadItem(${idx},'prijs',this.value)"
              class="w-28 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            <div class="relative flex items-center gap-1">
              <input list="voorraad-entity-dl" placeholder="Koppel aan kaartje…"
                value="${esc(entityDisplayName)}"
                onchange="window._updateVoorraadEntityLink(${idx}, this.value)"
                title="Koppel aan een bestaand voorwerpkaartje"
                class="w-36 px-2 py-1 bg-room-bg border rounded text-sm focus:border-gold-dim focus:outline-none ${linked ? 'border-green-wax/60 text-green-wax' : 'border-room-border text-ink-dim'}">
              ${linked ? '<span class="text-green-wax text-xs" title="Gekoppeld">✓</span>' : ''}
            </div>
            <button type="button" onclick="window._removeVoorraadItem(${idx})"
              class="w-7 h-7 flex items-center justify-center rounded text-seal hover:bg-seal/20 text-lg leading-none transition">&times;</button>
          </div>`;
        }).join('') + `<datalist id="voorraad-entity-dl">${_voorraadEntityOptions.map(o => `<option value="${esc(o.name)}">`).join('')}</datalist>`;
    };
    // Nog een lege regel erbij heeft geen zin: vul eerst de vorige.
    window._addVoorraadItem = () => {
      const laatste = _voorraadItems[_voorraadItems.length - 1];
      if (laatste && !laatste.naam && !laatste.prijs && !laatste.entityId) {
        document.querySelector('#voorraad-rows .voorraad-rij:last-child input')?.focus();
        return;
      }
      _voorraadItems.push({ naam: '', prijs: '', entityId: '' });
      window._refreshVoorraad();
    };
    window._removeVoorraadItem = (idx) => { _voorraadItems.splice(idx, 1); window._refreshVoorraad(); };
    window._updateVoorraadItem = (idx, field, val) => { if (_voorraadItems[idx]) _voorraadItems[idx][field] = val; };
    // Toevoegen staat uit zolang de onderste regel nog leeg is.
    window._voorraadAddKnop = () => {
      const knop = document.getElementById('voorraad-add-btn');
      if (!knop) return;
      const laatste = _voorraadItems[_voorraadItems.length - 1];
      const leeg = !!laatste && !laatste.naam && !laatste.prijs && !laatste.entityId;
      knop.disabled = leeg;
      knop.classList.toggle('opacity-40', leeg);
      knop.title = leeg ? 'Vul eerst de lege regel in' : '';
    };
    window._updateVoorraadEntityLink = (idx, naam) => {
      if (!_voorraadItems[idx]) return;
      const match = _voorraadEntityOptions.find(o => o.name.toLowerCase() === naam.toLowerCase());
      _voorraadItems[idx].entityId = match?.id || '';
      // Re-render om het ✓ icoon en stijl bij te werken
      window._refreshVoorraad();
    };

    // Subtype-wissel (personages)
    window._onSubtypeChange = (val) => {
      // De voorraad hangt sinds de rollen niet meer aan het subtype maar aan het
      // vinkje 'verkoper' (zie _rollenBij).
      const groepSec = document.getElementById('groep-section');
      if (groepSec) groepSec.style.display = val === 'speler' ? '' : 'none';
      const rollenRij = document.querySelector('.rollen-rij')?.closest('div')?.parentElement;
      if (rollenRij) rollenRij.style.display = val === 'god' ? 'none' : '';
      for (const id of ['pet-tier-section', 'pet-adopt-section']) {
        const sec = document.getElementById(id);
        if (sec) sec.style.display = val === 'dier' ? '' : 'none';
      }
      // Verkoper/antagonist zeggen niets over een dier; de kant blijft wel.
      const rolVak = document.querySelector('.rollen-rollen');
      if (rolVak) rolVak.style.display = val === 'dier' ? 'none' : '';
      // Velden die aan een subtype hangen (Domein bij een god, Origin/Class niet)
      const sub = String(val || '').toLowerCase();
      document.querySelectorAll('[data-voor-subtype], [data-niet-subtype]').forEach(el => {
        const alleen = (el.dataset.voorSubtype || '').split(',').filter(Boolean);
        const niet   = (el.dataset.nietSubtype || '').split(',').filter(Boolean);
        const zichtbaar = alleen.length ? alleen.includes(sub) : !niet.includes(sub);
        el.style.display = zichtbaar ? '' : 'none';
      });
      const vidSec = document.getElementById('video-section');
      if (vidSec) vidSec.style.display = val === 'speler' ? '' : 'none';
    };

    // LocType-wissel (locaties)
    window._onLocTypeChange = (val) => {
      const isWinkel = val === 'Winkel';
      const sec = document.getElementById('voorraad-section');
      if (sec) sec.style.display = isWinkel ? '' : 'none';
      const wcSec = document.getElementById('winkelconfig-section');
      if (wcSec) wcSec.style.display = isWinkel ? '' : 'none';
      _winkelTabTonen(isWinkel);
      _koppelLocTypeToon(val);
    };

    // Inladen-paneel toggle
    window._voorraadInladenToggle = async () => {
      const panel = document.getElementById('voorraad-inladen-panel');
      const chevron = document.getElementById('voorraad-inladen-chevron');
      if (!panel) return;
      const open = !panel.classList.contains('hidden');
      panel.classList.toggle('hidden', open);
      if (chevron) chevron.textContent = open ? '▸' : '▾';
      if (!open) {
        // Vul de select met winkels/verkopers die voorraad hebben
        const sel = document.getElementById('voorraad-inladen-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">— kies een winkel/verkoper —</option>';
        try {
          // Alleen locaties: sinds de voorraad daar leeft is een verkoper geen
          // bron meer om uit te kopiëren.
          const locaties = await api.listEntities('locaties');
          const bronnen = locaties
            .filter(l => l.data?.voorraad && l.data.voorraad !== '[]')
            .filter(b => b.id !== (e?.id || null)); // eigen kaartje niet aanbieden
          bronnen.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.dataset.type = 'locaties';
            opt.textContent = b.name;
            sel.appendChild(opt);
          });
          if (bronnen.length === 0) sel.innerHTML = '<option value="">— geen winkels gevonden —</option>';
        } catch { sel.innerHTML = '<option value="">— fout bij laden —</option>'; }
      }
    };

    // Inladen: kopieer voorraad van geselecteerde bron
    window._voorraadInladen = async () => {
      const sel = document.getElementById('voorraad-inladen-select');
      if (!sel || !sel.value) return;
      const bronType = sel.options[sel.selectedIndex]?.dataset.type || 'personages';
      try {
        const bron = await api.getEntity(bronType, sel.value);
        const bronItems = bron?.data?.voorraad ? JSON.parse(bron.data.voorraad) : [];
        if (bronItems.length === 0) return;
        // entityId meenemen: die koppeling is met de hand gelegd en levert het
        // klikbare voorwerpkaartje in de winkel op.
        _voorraadItems = bronItems.map(i => ({ naam: i.naam || '', prijs: i.prijs || '', entityId: i.entityId || '' }));
        window._refreshVoorraad();
        // Sluit paneel
        document.getElementById('voorraad-inladen-panel')?.classList.add('hidden');
        const chevron = document.getElementById('voorraad-inladen-chevron');
        if (chevron) chevron.textContent = '▸';
      } catch { /* stil falen */ }
    };

    window._wcUpdate = () => {
      const roterend = document.getElementById('wc-roterend')?.checked || false;
      document.getElementById('wc-extra')?.classList.toggle('hidden', !roterend);
      // Wat er niet meer in de editor staat (onderhandel-DC, inkooppercentage,
      // categorieën) bewaren we wél: bestaande winkels raken hun instelling niet
      // kwijt zolang we niet zeker weten dat niemand ze mist.
      let oud = {};
      try { oud = JSON.parse(document.getElementById('winkelconfig-hidden')?.value || '{}'); } catch {}
      const config = {
        ...oud,
        roterend,
        aantalItems: parseInt(document.getElementById('wc-aantal')?.value) || 3,
        refreshUren: parseFloat(document.getElementById('wc-uren')?.value) || 24,
        deelGroep: (document.getElementById('wc-deelgroep')?.value || '').trim(),
        sfeerTekst: (document.getElementById('wc-sfeer')?.value || '').trim(),
      };
      const hidden = document.getElementById('winkelconfig-hidden');
      if (hidden) hidden.value = JSON.stringify(config);
    };

    window._refreshVoorraad();
  }

  // ── Baasje van een huisdier ──
  // Vullen na het tekenen: de spelers komen uit de API en het huidige baasje uit
  // de metgezellen van de party.
  if (tab === 'personages' && isDM() && e?.subtype === 'dier' && editId) {
    (async () => {
      const sel = document.getElementById('pet-baasje');
      if (!sel) return;
      let spelers = [], huidige = '';
      try {
        const lijst = await api.listEntities('personages');
        spelers = lijst.filter(p => p.subtype === 'speler');
      } catch { /* dan een lege lijst */ }
      try {
        const st = await api.getPetBaasje(editId);
        huidige = st?.baasje || '';
      } catch { /* geen baasje */ }
      sel.innerHTML = `<option value="">— nog niemand —</option>` +
        spelers.map(p => `<option value="${esc(p.id)}"${p.id === huidige ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    })();
  }

  window._petBaasjeZet = async (petId, characterId) => {
    if (!petId) return;
    try {
      const r = await api.setPetBaasje(petId, characterId);
      window.app?._tsToast?.(r.baasje
        ? `${icon('check')} Loopt nu mee met ${esc(r.baasje.naam)}`
        : `${icon('check')} Losgekoppeld van zijn baasje`);
    } catch (err) {
      alert('Koppelen mislukt: ' + (err.message || err));
    }
  };

  // Kaartjeslijsten voor de koppelvelden (gebied, betrokkenen). Eén keer per
  // geopende editor; de datalists vullen zichzelf zodra ze binnen zijn.
  if (document.querySelector('[data-link-veld]')) _linkLaden();

  // ── Koppelingen vullen ──
  if (document.getElementById('koppel-sectie')) {
    _koppelCtx = { tab, id: e.id, dungeons: [] };
    api.getKoppelingen(tab, e.id).then(k => {
      _koppelCtx.dungeons = k.dungeons || [];
      const laden  = document.getElementById('koppel-laden');
      const inhoud = document.getElementById('koppel-inhoud');
      if (laden)  laden.classList.add('hidden');
      if (inhoud) inhoud.classList.remove('hidden');

      const vink = document.getElementById('koppel-herberg-vink');
      if (vink) {
        vink.checked = !!k.herberg;
        const uitleg = document.getElementById('koppel-herberg-uitleg');
        // De dienst heeft een eigen naam (meta.herberg.naam); die zegt nog niet
        // aan wélk kaartje hij hangt. Alleen dat laatste is hier interessant.
        if (uitleg) uitleg.textContent = k.herberg
          ? 'De herberg-dienst gebruikt dit kaartje.'
          : (k.herbergNaam
              ? `De herberg-dienst heet nu \u201c${k.herbergNaam}\u201d. Aanvinken hangt hem aan dit kaartje.`
              : 'Nog aan geen enkel kaartje gekoppeld.');
      }
      const god = document.getElementById('koppel-god');
      if (god) {
        god.innerHTML = `<option value="">\u2014 geen god \u2014</option>` + (k.goden || []).map(g => {
          // Een god die al aan een ánder kaartje hangt mag je kiezen, maar dan
          // hoort erbij te staan dat je hem daar weghaalt.
          const elders = g.locatieEntityId && g.locatieEntityId !== e.id;
          return `<option value="${esc(g.naam)}"${k.godNaam === g.naam ? ' selected' : ''}>${esc(g.naam)}${elders ? ' \u00b7 staat nu elders' : ''}</option>`;
        }).join('');
      }
      const factie = document.getElementById('koppel-factie');
      if (factie) {
        factie.innerHTML = `<option value="">\u2014 geen factie \u2014</option>` + (k.facties || []).map(f => {
          const elders = f.entityId && f.entityId !== e.id;
          return `<option value="${esc(f.id)}"${k.factieId === f.id ? ' selected' : ''}>${esc(f.naam)}${elders ? ' \u00b7 staat nu elders' : ''}</option>`;
        }).join('');
      }
      _koppelDungeonVullen();
      const kaart = document.getElementById('koppel-kaart');
      if (kaart) kaart.innerHTML = k.opKaart
        ? `<button type="button" class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._toonOpKaart('${esc(e.id)}')">${icon('map-pin')} Staat op de kaart \u2014 toon hem</button>`
        : `<p class="veld-uitleg">${icon('map-pin')} Nog geen speld op de kaart. Die zet je op de kaart zelf, want daar wijs je de plek aan.</p>`;
      _koppelLocTypeToon();
    }).catch(() => {
      const laden = document.getElementById('koppel-laden');
      if (laden) laden.textContent = 'Koppelingen konden niet geladen worden.';
    });
  }

  // ── Verkoper wijst naar zijn winkel ──
  if (tab === 'personages' && isDM()) {
    let _winkelLocs = [];
    const _vulWinkelLink = () => {
      const id = document.getElementById('winkel-loc-id')?.value || '';
      const host = document.getElementById('winkel-loc-link');
      if (!host) return;
      const loc = _winkelLocs.find(l => l.id === id);
      host.innerHTML = loc
        ? `<button type="button" class="dm-btn dm-btn-ghost dm-btn-sm"
             onclick="window._openDetail('locaties','${esc(loc.id)}')">
             ${icon('package')} Voorraad van ${esc(loc.name)} bekijken
           </button>`
        : '';
    };
    api.listEntities('locaties').then(locs => {
      _winkelLocs = locs.map(l => ({ id: l.id, name: l.name }));
      const dl = document.getElementById('winkel-loc-dl');
      if (dl) dl.innerHTML = _winkelLocs.map(l => `<option value="${esc(l.name)}">`).join('');
      const veld = document.getElementById('winkel-loc-naam');
      const id = document.getElementById('winkel-loc-id')?.value || '';
      if (veld && id) veld.value = _winkelLocs.find(l => l.id === id)?.name || '';
      _vulWinkelLink();
    }).catch(() => {});

    // Naam → id, met een korte rode flits als er niets matcht (zelfde patroon
    // als de andere zoekbare kiezers in de Meesterkamer).
    window._winkelLocKies = (naam) => {
      const veld = document.getElementById('winkel-loc-naam');
      const hidden = document.getElementById('winkel-loc-id');
      if (!hidden) return;
      const schoon = (naam || '').trim();
      if (!schoon) { hidden.value = ''; _vulWinkelLink(); return; }
      const match = _winkelLocs.find(l => l.name.toLowerCase() === schoon.toLowerCase());
      hidden.value = match?.id || '';
      if (!match && veld) {
        veld.classList.add('dm-input--err');
        setTimeout(() => veld.classList.remove('dm-input--err'), 900);
      }
      _vulWinkelLink();
    };
  }

  // Form submit handler
  document.getElementById('entity-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = new FormData(ev.target);
    const data = {};
    const stats = {};
    for (const [key, val] of form.entries()) {
      if (key.startsWith('data_')) data[key.slice(5)] = val;
      else if (key.startsWith('stat_')) stats[key.slice(5)] = val;
    }
    // Betrokkenen serialiseren. `eigenaar` blijft meelopen als losse tekst:
    // de campagneboek-export en de zoekindex lezen dat veld, en een kaartje dat
    // nooit gekoppeld wordt hoort er niet op achteruit te gaan.
    if (document.getElementById('betrokkenen-lijst')) {
      const rijen = _betrokkenenLees();
      data.betrokkenen = rijen.length ? JSON.stringify(rijen) : '';
      const baas = rijen.find(r => /eigenaar/i.test(r.rol));
      data.eigenaar   = baas ? baas.naam : (rijen.length ? '' : (data.eigenaar || ''));
      data.eigenaarId = baas ? (baas.id || '') : '';
    }
    // Voorraad serialiseren voor verkopers & winkels
    if (tab === 'personages' || tab === 'locaties') {
      const validItems = _voorraadItems.filter(i => i.naam || i.prijs);
      data.voorraad = validItems.length > 0 ? JSON.stringify(validItems) : '';
    }
    // Adoptieprijs: één bedrag met een komma (12,34) → centelingen, zoals bij
    // loot en de diensten. Leeg = geen prijs.
    if (tab === 'personages') {
      const ruw = (data.adoptiePrijs_tekst ?? '').toString().trim();
      delete data.adoptiePrijs_tekst;
      if (ruw) {
        // Zelfde lezer als de rest van de app: komma of munten (ook pp en ep).
        const cl = _prijsNaarCl(ruw);
        if (cl !== null) data.adoptiePrijsCl = String(cl);
      } else {
        data.adoptiePrijsCl = '';
      }
      data.adoptiePrijsFl = '';   // opgevolgd door het bedrag in centelingen
    }
    // Lijstvelden (geheimen, flavours) serialiseren. Het oude enkelvoudige veld
    // houden we bij als eerste regel, want de Gock en oudere weergaven lezen dat.
    for (const veld of (SCHEMA[tab]?.fields || []).filter(f => f.type === 'lijst-tekst')) {
      const host = document.getElementById(`lijst-${veld.key}`);
      if (!host) continue;
      // Per regel lopen, zodat het antagonist-vinkje bij zijn eigen tekst blijft
      // ook als er lege regels tussen staan.
      const rijen = [...host.querySelectorAll('.lijst-regel')]
        .map(r => ({
          tekst: r.querySelector('textarea')?.value.trim() || '',
          antag: !!r.querySelector('.lijst-antag-vink')?.checked,
        }))
        .filter(r => r.tekst);
      data[veld.key] = rijen.length ? JSON.stringify(rijen.map(r => r.tekst)) : '';
      data[veld.enkelvoud] = rijen[0]?.tekst || '';
      if (veld.key === 'geheimen') {
        data.geheimenAntagonist = rijen.some(r => r.antag) ? JSON.stringify(rijen.map(r => r.antag)) : '';
        data.geheimeAntagonist  = '';   // opgevolgd door de lijst hierboven
      }
    }
    // Extra afbeeldingen serialiseren
    data.extraImages = entityEditorImages.length > 0
      ? JSON.stringify(entityEditorImages.map(i => ({ id: i.id, caption: i.caption || '' })))
      : '';
    const payload = {
      name: form.get('name'),
      subtype: form.get('subtype') || '',
      data,
      // links wordt niet meer meegestuurd: de Verbindingen-editor is vervallen en
      // de server vult het veld bij het uitserveren aan met de [[ ]] uit de
      // tekst. Zou de client het terugsturen, dan zouden die afgeleide
      // verbindingen ongemerkt vastgelegd worden.
      stats: tab === 'personages' ? stats : null,
    };
    // Huisdier-tiers meesturen (alleen relevant bij subtype 'dier')
    if (tab === 'personages' && payload.subtype === 'dier') {
      payload.statblockTiers = _petTiersCollect().filter(t => t.label || t.minLevel != null || Object.keys(t.statblock || {}).some(k => k !== 'alignment'));
    }
    // Verhuist een speler naar een andere party? Dan blijft daar meer achter dan
    // het ene veld doet vermoeden: voorwerpkaartjes horen bij de party, niet bij
    // het personage. Zie de valkuil in CLAUDE.md.
    if (tab === 'personages' && editId && payload.subtype === 'speler') {
      const oudeGroep = e?.data?.groep || '';
      const nieuweGroep = data.groep || '';
      if (oudeGroep && nieuweGroep !== oudeGroep) {
        let info = { groepNaam: '', voorwerpen: 0 };
        try { info = await api.verhuisInfo(editId); } catch { /* dan maar zonder aantallen */ }
        const naar = _editorGroups.find(g => g.id === nieuweGroep)?.name || 'geen party';
        const van  = info.groepNaam || _editorGroups.find(g => g.id === oudeGroep)?.name || 'de oude party';
        const stuks = info.voorwerpen === 1 ? '1 voorwerpkaartje' : `${info.voorwerpen} voorwerpkaartjes`;
        const regels = [
          `${payload.name || 'Dit personage'} verhuist van ${van} naar ${naar}.`,
          '',
          info.voorwerpen
            ? `${stuks} blijft bij ${van} achter — voorwerpbezit hoort bij de party, niet bij het personage.`
            : `Voorwerpbezit hoort bij de party, niet bij het personage.`,
          `Ook wat ${van} al ontdekt had (geheimen, documenten, facties, bestiarium) telt niet mee naar ${naar}.`,
          '',
          'Losse boedelregels en geld gaan wél mee.',
          '',
          'Doorgaan?',
        ];
        if (!confirm(regels.join('\n'))) return;
      }
    }
    // Duplicaatdetectie voor voorwerpen (unieke naam vereist)
    if (tab === 'voorwerpen') {
      try {
        const allVw = await api.listEntities('voorwerpen');
        const dup = allVw.find(i => i.id !== editId && i.name.toLowerCase() === (payload.name || '').toLowerCase());
        if (dup && !confirm(`Er bestaat al een voorwerp met de naam "${dup.name}". Toch opslaan?`)) return;
      } catch { /* ok — niet blokkeren bij API-fout */ }
    }
    try {
      // Portret loopt nu via data.imageId (mediabibliotheek) — geen losse
      // upload-naar-entity-id meer; de picker heeft het bestand al opgeslagen.
      let _nieuwId = editId;
      if (editId) {
        await api.updateEntity(tab, editId, payload);
      } else {
        const gemaakt = await api.createEntity(tab, payload);
        _nieuwId = gemaakt?.id || null;
      }
      // Filmpje dat bij een nieuw kaartje gekozen is: nu pas uploaden, want nu
      // pas is er een id om het naar te vernoemen.
      if (_pendingVideoFile && _nieuwId) {
        await api.uploadFile(`${_nieuwId}_video`, _pendingVideoFile).catch(() => {});
        _pendingVideoFile = null;
      }
      // Idem voor een filmpje dat uit de bibliotheek gekozen is.
      if (_pendingVideoBron && _nieuwId) {
        await api.copyFile(`${_nieuwId}_video`, _pendingVideoBron).catch(() => {});
        _pendingVideoBron = null;
      }
      // Upload/verwijder audio
      if (pendingAudioFile && data.audioId) {
        await api.uploadFile(data.audioId, pendingAudioFile);
      }
      if (!data.audioId && _editorOldAudioId) {
        await api.deleteFile(_editorOldAudioId).catch(() => {});
      }
      // Upload nieuwe extra afbeeldingen
      for (const img of entityEditorImages) {
        if (img.isNew) await api.uploadFile(img.id, img.file);
      }
      // Verwijder verwijderde extra afbeeldingen
      // (entityEditorImagesToDelete blijft leeg sinds losgekoppelde afbeeldingen
      // niet meer verwijderd worden — zie _removeEntityImage.)
      for (const id of entityEditorImagesToDelete) {
        await api.deleteFile(id).catch(() => {});
      }
      closeModal();
      renderEntitySection(tab);
    } catch (err) {
      alert('Fout: ' + err.message);
    }
  });
};

window._addTag = (lt, name) => {
  const input = document.getElementById(`tag-input-${lt}`);
  const val = (name || input.value).trim();
  if (!val || editorTags[lt].includes(val)) return;
  editorTags[lt].push(val);
  input.value = '';
  window._hideSuggestions(lt);
  refreshTags(lt);
};

window._removeTag = (lt, name) => {
  editorTags[lt] = editorTags[lt].filter(n => n !== name);
  refreshTags(lt);
};

window._showSuggestions = (lt) => {
  const input = document.getElementById(`tag-input-${lt}`);
  const list = document.getElementById(`tag-suggestions-${lt}`);
  const q = input.value.trim().toLowerCase();
  const names = (allNames[lt] || []).filter(n =>
    !editorTags[lt].includes(n) && (!q || n.toLowerCase().includes(q))
  );
  if (names.length === 0) { list.classList.remove('open'); return; }
  list.innerHTML = names.map(n =>
    `<div class="autocomplete-item" data-name="${esc(n)}" onmousedown="window._addTag('${lt}',this.dataset.name)">${esc(n)}</div>`
  ).join('');
  list.classList.add('open');
};

window._hideSuggestions = (lt) => {
  const list = document.getElementById(`tag-suggestions-${lt}`);
  if (list) list.classList.remove('open');
};

window._handleTagKey = (ev, lt) => {
  if (ev.key === 'Enter') { ev.preventDefault(); window._addTag(lt); }
  if (ev.key === 'Escape') { window._hideSuggestions(lt); }
};

// Close suggestions on blur (slight delay so mousedown on item fires first)
document.addEventListener('focusout', (ev) => {
  if (ev.target.id?.startsWith('tag-input-')) {
    const lt = ev.target.id.replace('tag-input-', '');
    setTimeout(() => window._hideSuggestions(lt), 150);
  }
});

function refreshTags(lt) {
  const lm = TYPE_META[lt] || { get svgIcon() { return icon('scroll-text'); }, icon: '\ud83d\udcdc', chip: 'chip-doc' };
  const container = document.getElementById(`tags-${lt}`);
  if (!container) return;
  container.innerHTML = editorTags[lt].map(n =>
    `<span class="chip ${lm.chip}">${esc(n)} <span class="cursor-pointer ml-1" data-name="${esc(n)}" onclick="window._removeTag('${lt}',this.dataset.name)">\u00d7</span></span>`
  ).join('');
}

// ── Delete ──
// Spelerskaarten (protagonisten) krijgen extra verwijdercontrole: hun portret/filmpje
// wordt overal hergebruikt, dus we eisen het intypen van de naam i.p.v. een kale confirm().
// Elke verwijdering toont daarna een "Ongedaan maken"-toast (herstel uit de prullenbak).
window._deleteEntity = async (tab, id) => {
  let ent = null;
  try { ent = await api.getEntity(tab, id); } catch {}
  const isProtagonist = tab === 'personages' && ent?.subtype === 'speler';
  if (isProtagonist) { _openDeleteGuard(tab, id, ent); return; }
  if (!confirm('Weet je zeker dat je dit wilt verwijderen?')) return;
  await api.deleteEntity(tab, id);
  window.app.closeModal();
  renderEntitySection(tab);
  _showUndoToast(tab, id, ent?.name || '');
};

// Rijke bevestigingsmodal voor spelerskaarten — vereist het typen van de naam.
function _openDeleteGuard(tab, id, ent) {
  document.getElementById('delete-guard-overlay')?.remove();
  const naam = ent?.name || 'dit personage';
  const groep = ent?.data?.groep ? `<li>Lid van groep <strong>${esc(ent.data.groep)}</strong></li>` : '';
  const ov = document.createElement('div');
  ov.id = 'delete-guard-overlay';
  ov.className = 'delete-guard-overlay';
  ov.innerHTML = `
    <div class="delete-guard-modal" role="dialog" aria-modal="true">
      <div class="delete-guard-head">
        <img class="delete-guard-portret" src="${api.thumbUrl(id)}" alt="" onerror="this.style.display='none'">
        <div>
          <div class="delete-guard-title">${icon('skull')} Spelerskaart verwijderen</div>
          <div class="delete-guard-name">${esc(naam)}</div>
        </div>
      </div>
      <p class="delete-guard-warn">Het portret en filmpje van deze speler worden <strong>hergebruikt</strong> in de
        party-weergave, berichten en de tempel. Verwijderen haalt het personage uit alle groepen.</p>
      <ul class="delete-guard-list">
        ${groep}
        <li>De kaart belandt in de prullenbak — je kunt direct daarna <strong>Ongedaan maken</strong>.</li>
      </ul>
      <label class="delete-guard-label">Typ de naam <strong>${esc(naam)}</strong> om te bevestigen:</label>
      <input type="text" id="delete-guard-input" class="delete-guard-input" autocomplete="off" placeholder="${esc(naam)}">
      <div class="delete-guard-actions">
        <button class="dm-btn dm-btn-ghost" id="delete-guard-cancel">Annuleren</button>
        <button class="dm-btn dm-btn-danger" id="delete-guard-confirm" disabled>${icon('trash')} Verwijderen</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const input = ov.querySelector('#delete-guard-input');
  const confirmBtn = ov.querySelector('#delete-guard-confirm');
  const close = () => ov.remove();
  input.addEventListener('input', () => {
    confirmBtn.disabled = input.value.trim().toLowerCase() !== (naam || '').trim().toLowerCase();
  });
  input.focus();
  ov.querySelector('#delete-guard-cancel').addEventListener('click', close);
  ov.addEventListener('click', (ev) => { if (ev.target === ov) close(); });
  confirmBtn.addEventListener('click', async () => {
    if (confirmBtn.disabled) return;
    confirmBtn.disabled = true;
    try {
      await api.deleteEntity(tab, id);
      close();
      window.app.closeModal();
      renderEntitySection(tab);
      _showUndoToast(tab, id, naam);
    } catch (err) {
      confirmBtn.disabled = false;
      alert('Verwijderen mislukt: ' + (err.message || 'onbekende fout'));
    }
  });
}

// Toast met "Ongedaan maken" — ontsluit de bestaande prullenbak/restore-backend.
function _showUndoToast(tab, id, naam) {
  document.getElementById('undo-toast')?.remove();
  const t = document.createElement('div');
  t.id = 'undo-toast';
  t.className = 'undo-toast';
  t.innerHTML = `
    <span class="undo-toast-text">${icon('trash')} ${esc(naam || 'Item')} verwijderd</span>
    <button class="undo-toast-btn" id="undo-toast-btn">${icon('refresh-cw')} Ongedaan maken</button>`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('undo-toast--visible'), 10);
  const dismiss = () => { t.classList.remove('undo-toast--visible'); setTimeout(() => t.remove(), 300); };
  const timer = setTimeout(dismiss, 8000);
  t.querySelector('#undo-toast-btn').addEventListener('click', async () => {
    clearTimeout(timer);
    try {
      await api.restoreEntity(id);
      renderEntitySection(tab);
    } catch (err) {
      alert('Herstellen mislukt: ' + (err.message || 'onbekende fout'));
    }
    dismiss();
  });
}
