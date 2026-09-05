import { api } from './api.js?v=264';
import { renderStatblock } from './render-statblock.js?v=3';

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
  personages:   { icon: '\ud83d\udc64', get svgIcon() { return icon('user'); },                    label: 'Personages',   color: 'green-wax', chip: 'chip-npc' },
  locaties:     { icon: '\ud83c\udff0', get svgIcon() { return icon('castle', {cls:'icon-gi'}); }, label: 'Locaties',     color: 'blue-ink',  chip: 'chip-loc' },
  organisaties: { icon: '\ud83c\udfdb\ufe0f', get svgIcon() { return icon('landmark'); },         label: 'Organisaties', color: 'seal',      chip: 'chip-org' },
  voorwerpen:   { icon: '🎺',              get svgIcon() { return icon('package'); },                label: 'Voorwerpen',   color: 'orange',    chip: 'chip-item' },
};

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
      { key: 'rol', label: 'Korte omschrijving', type: 'text' },
      { key: 'ras', label: 'Ras', type: 'lijst', lijst: 'volken' },
      { key: 'klasse', label: 'Klasse', type: 'lijst', lijst: 'klassen' },
      { key: 'alignment', label: 'Alignment', type: 'lijst', lijst: 'alignments' },
      { key: 'tags', label: 'Rollen', type: 'rollen' },
      { key: 'kant', label: 'Kant in gevecht', type: 'select',
        options: [{ value: 'bondgenoot', label: 'Bondgenoot' }, { value: 'vijand', label: 'Vijand' }, { value: 'neutraal', label: 'Neutraal' }] },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'geheimen', label: 'Geheimen', type: 'lijst-tekst', enkelvoud: 'geheim' },
      { key: 'flavours', label: 'Flavour teksten', type: 'lijst-tekst', enkelvoud: 'flavour' },
      { key: 'persoonlijkheid', label: 'Aantekeningen voor de DM', type: 'textarea', dmOnly: true },
    ],
  },
  locaties: {
    fields: [
      { key: 'locType', label: 'Type', type: 'select', options: ['Stadswijk','Gebouw','Herberg','Taveerne','Tempel','Winkel','Fort','Schip','Dorp','Stad','Woud','Berg','Zee','Overig'] },
      { key: 'wijk', label: 'Wijk', type: 'text' },
      { key: 'eigenaar', label: 'Eigenaar', type: 'text' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'flavours', label: 'Flavour teksten', type: 'lijst-tekst', enkelvoud: 'flavour' },
      { key: 'geheimen', label: 'Geheimen', type: 'lijst-tekst', enkelvoud: 'geheim' },
    ],
  },
  organisaties: {
    fields: [
      { key: 'orgType', label: 'Type', type: 'select', options: ['Gilde','Factie','Religieus','Politiek','Crimineel','Militair','Overig'] },
      { key: 'motto', label: 'Motto', type: 'text' },
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
        'Zee':        icon('globe'),
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
window._csModUpdate = (k, waarde) => {
  const el = document.getElementById(`cs-mod-${k}`);
  if (el) el.textContent = _abilityMod(waarde);
};

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

// Eén regel in de editor: tekstvak met opmaakbalk en een prullenbak.
function _lijstRegelHtml(veld, tekst, i) {
  const id = `lt-${veld}-${i}`;
  return `<div class="lijst-regel" data-veld="${veld}">
    ${fmtToolbar(id)}
    <div class="lijst-regel-rij">
      <textarea id="${id}" rows="2" class="lijst-regel-tekst" onkeydown="window._fmtKey(event)"
        placeholder="Nog een regel\u2026">${esc(tekst)}</textarea>
      <button type="button" class="dm-btn dm-btn-sm dm-btn-ghost dm-btn-danger"
        title="Regel verwijderen" onclick="window._lijstRegelWeg(this)">${icon('trash')}</button>
    </div>
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
  host.insertAdjacentHTML('beforeend', _lijstRegelHtml(veld, '', i));
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
  for (const knop of knoppen) {
    const sp = info.find(x => x.index === knop.dataset.spell);
    if (!sp) continue;
    const niveau = Number(sp.level) === 0 ? 'C' : sp.level;
    knop.innerHTML = `<b>${niveau}</b>${esc(sp.name)}`;
    knop.title = `${sp.school || ''}`.trim();
  }
}

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
window._rollenBij = () => {
  const gekozen = [...document.querySelectorAll('.rollen-rij input:checked')].map(i => i.value);
  const veld = document.getElementById('rollen-veld');
  if (veld) veld.value = JSON.stringify(gekozen);
  const isVerkoper = gekozen.includes('verkoper');
  document.getElementById('voorraad-section')?.style.setProperty('display', isVerkoper ? '' : 'none');
  document.getElementById('winkelconfig-section')?.style.setProperty('display', isVerkoper ? '' : 'none');
};

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
    let best = 0;
    if (h.name === t) best = 1000;
    else if (h.name.startsWith(t)) best = 600;
    else if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h.name)) best = 400;
    else if (h.name.includes(t)) best = 250;
    else if (h.meta.includes(t)) best = 120;
    else if (h.rest.includes(t)) best = 60;
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
          <span class="results-count sbs-count">${list.length} resultaten</span>
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
    const countEl = c.querySelector('.results-count');
    if (countEl) countEl.textContent = `${filtered.length} resultaten`;
  };

  window._entitySubtypeFilter = (t, subtype) => {
    subtypeFilters[t] = subtype || null;
    const filtered = filterEntities(t, entities[t] || []);
    const c = $(`#section-${t}`);
    _refreshGrid(t, filtered, c);
    const countEl = c.querySelector('.results-count');
    if (countEl) countEl.textContent = `${filtered.length} resultaten`;
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
    _attachCardTilt(grid);
    grid.scrollTop = savedGridScroll; // als láátste, ná fittext (dat celhoogtes kan wijzigen)
  });
  const countEl = container.querySelector('.results-count');
  if (countEl) countEl.textContent = `${list.length} resultaten`;
}

// ── 3D kaart-tilt bij hover ──
function _onCardTiltMove(e) {
  const card = this;
  if (!card.classList.contains('card-tilting')) card.classList.add('card-tilting');
  const rect = card.getBoundingClientRect();
  const dx = (e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2); // -1..1
  const dy = (e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2); // -1..1
  const rx = (-dy * 7).toFixed(2);
  const ry = ( dx * 7).toFixed(2);
  card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-5px)`;
}
function _onCardTiltLeave() {
  this.classList.remove('card-tilting');
  this.style.transform = '';
}
function _attachCardTilt(container) {
  container.querySelectorAll('.entity-card:not(.card-vague)').forEach(card => {
    card.removeEventListener('mousemove',  _onCardTiltMove);
    card.removeEventListener('mouseleave', _onCardTiltLeave);
    card.addEventListener('mousemove',  _onCardTiltMove);
    card.addEventListener('mouseleave', _onCardTiltLeave);
  });
}
window._attachCardTilt = _attachCardTilt;

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
  if (q) {
    const tokens = _searchTokens(q);
    filtered = filtered.filter(e => _searchScore(e, tokens) >= 0);
  }
  if (sf === '__winkel__' && type === 'locaties') {
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
  const metaText = [e.data?.locType, e.data?.orgType, _itemMeta, e.data?.ras, e.data?.klasse].filter(Boolean).join(' \u00b7 ');
  const badge   = getSubtypeBadge(type, e);
  const desc = e.data?.desc || '';
  const flavour = e.data?.flavour || '';
  const flavourUitgesproken = e.data?.flavourUitgesproken === true || e.data?.flavourUitgesproken === 'true';

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
    <div class="entity-card${vis === 'hidden' && isDM() ? ' card-hidden' : ''}${vis === 'vague' && isDM() ? ' card-vague-dm' : ''}${e._deceased ? ' card-deceased' : ''}${_goddelijkType ? ` card-goddelijk card-goddelijk--${_goddelijkType}` : ''}${_isBoon ? ' card-boon' : ''}${_isProtagonist ? ' card-protagonist' : ''}"${_rarKey ? ` data-rarity="${_rarKey}"` : ''}${_isProtagonist ? ' data-protagonist="true"' : ''}
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
           hebben — en het leek bovendien op het zichtbaarheids-oog rechtsboven,
           dat iets heel anders doet. Onthullen gaat nu per geheim in het
           detailvenster. Voor spelers blijft het oog: dat zegt "hier is iets
           prijsgegeven", en zij zien het andere icoon niet. -->
      ${!isDM() && e._secretReveal
        ? `<span class="card-secret-badge card-secret-badge--revealed card-secret-badge--player" title="Geheim onthuld">${icon('eye')}</span>`
        : ''}
      <div class="card-accent bar-${type}"></div>
      <div class="card-img-wrap">
        <img class="card-img w-full object-cover" loading="lazy" src="${api.thumbForEntity(e)}"
          style="${e.data?.imgFocus ? `object-position:${e.data.imgFocus}` : ''}"
          onerror="this.style.display='none';this.closest('.entity-card').classList.add('no-img')">
        <div class="card-img-fade"></div>
        ${badge ? `<div class="card-subtype-badge ${badge.cls}">${esc(badge.label)}</div>` : ''}
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
      ${flavour && (isDM() || flavourUitgesproken) ? `
        <div class="flavour-preview${isDM() && !flavourUitgesproken ? ' flavour-preview--ongespoken' : ''}">
          ${e.data?.audioId ? `<button type="button" class="flavour-audio-btn" data-audio-btn data-audio-btn-id="${esc(e.data.audioId)}" onclick="event.stopPropagation();window._audioToggle('${esc(e.data.audioId)}')" title="Sfeer afspelen">▶</button>` : ''}
          <span class="flavour-preview-text">\u201e${esc(flavour.length > 300 ? flavour.slice(0, 300) + '\u2026' : flavour)}\u201c</span>
        </div>
      ` : ''}
      ${type === 'voorwerpen' ? _itemOwnershipBadge(e.id) : ''}
    </div>
  `;
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
  // Direct DOM update: verwijder of voeg toe in bladwijzerlijst (mijn-karakter)
  const wasRemoved = !bms.some(b => b.id === id);
  if (wasRemoved) {
    document.querySelector(`.player-bookmark-item[data-bid="${CSS.escape(id)}"]`)?.remove();
    // Verberg de sectieheader als de lijst leeg is
    const list = document.querySelector('.player-bookmarks-list');
    if (list && !list.querySelector('.player-bookmark-item')) {
      list.closest('.player-dash-section')?.remove();
    }
  }
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
  return `
    <div class="mb-4">
      <div class="relative">
        <div class="overflow-hidden rounded">
          <div id="ec-track-${key}" class="flex" style="transition:transform 0.3s ease">
            ${items.map(({id}) => {
              const url = api.fileUrl(id);
              return `<div class="flex-shrink-0 w-full relative overflow-hidden">
                <div class="detail-hero-bg" style="background-image:url('${url}')"></div>
                <img src="${url}" class="detail-portrait w-full max-h-80 object-contain cursor-pointer" style="position:relative;z-index:1"
                  onclick="window.app.openLightbox('${url}','')">
              </div>`;
            }).join('')}
          </div>
        </div>
        <button class="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/65 text-white rounded-full text-lg leading-none flex items-center justify-center transition"
          onclick="window._ecStep('${key}',-1,${items.length})">\u2039</button>
        <button class="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/65 text-white rounded-full text-lg leading-none flex items-center justify-center transition"
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
  const voorbeeld = document.getElementById('editor-img-preview');
  if (voorbeeld) { voorbeeld.src = api.fileUrl(gekozen.id); voorbeeld.parentElement?.classList.remove('hidden'); }
  document.getElementById('fp-hint')?.classList.remove('hidden');
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

  let e, playerNotesData, uitverkochtData, beschikbaarData, shopCurrencyData, shopVerkoopData;
  let shopLogData = null;
  let shopHumeurData = null;
  const _isShopTab = (tab === 'locaties' || tab === 'personages');
  try {
    [e, playerNotesData, uitverkochtData, beschikbaarData, shopCurrencyData, shopVerkoopData] = await Promise.all([
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
      (_isShopTab && !isDM())
        ? api.getShopVerkoopbaar(id).catch(() => null)
        : Promise.resolve(null),
    ]);
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
  const showSheet = isPersonage && isDM();
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
  const _heroBadge = getSubtypeBadge(tab, e);
  // Afbeelding — simpel gecentreerd met perkamentachtergrond
  const _d = e.data || {};
  // Armor AC pill — berekend voor hero-overlay en chips-sectie
  const _detailDexMod = (typeof window._playerDexMod === 'number') ? window._playerDexMod : null;
  const _detailAcResult = (tab === 'voorwerpen' && e.data?.armorType) ? _calcArmorAC(e.data, _detailDexMod) : null;
  const _rolVal = e.data?.rol;
  let _rolInHero = false;
  if (_extraImgs.length > 0) {
    const _allImgs = [{ id: e.id, caption: _primaryCaption }, ..._extraImgs];
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
        ${_heroBadge ? `<div class="detail-hero-badge badge ${_heroBadge.cls}">${esc(_heroBadge.label)}</div>` : ''}
        ${_rolVal ? `<div class="detail-hero-rol">${esc(_rolVal)}</div>` : ''}
      </div>
      ${_primaryCaption ? `<p class="text-center text-xs text-ink-dim font-crimson -mt-3 mb-3 italic">${esc(_primaryCaption)}</p>` : ''}
    `;
    if (_rolVal) _rolInHero = true;
  }

  // Upload en audio-beheer staan in de bewerkmodus (openEditor), niet in de detailview

  // Rol badge — alleen los tonen als 'ie niet al als overlay op het beeld staat
  const rolVal = e.data?.rol;
  if (rolVal && !_rolInHero) {
    infoHtml += `<div class="text-center mb-4"><span class="detail-role-badge">${esc(rolVal)}</span></div>`;
  }

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

  // Persoonlijkheid (DM only)
  const persVal = e.data?.persoonlijkheid;
  if (persVal && isDM()) {
    infoHtml += `
      <div class="dm-only mb-4">
        <div class="detail-field-label">Persoonlijkheid</div>
        <div class="detail-dm-block">${mdToHtml(persVal)}</div>
      </div>
    `;
  }

  // Flavour scroll (parchment scroll — zichtbaar voor spelers als uitgesproken, altijd voor DM)
  const flavourRegels = _tekstLijstUit(e.data, 'flavours', 'flavour');
  const _gezegd = (() => {
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
    // Elke roddel een eigen rol perkament; wat de waard nog niet verteld heeft
    // ziet de DM lichter.
    infoHtml += zichtbareFlavours.map(({ tekst, gezegd, i }, n) => `
        <div class="flavour-scroll${isDM() && !gezegd ? ' flavour-scroll--ongespoken' : ''}">
          <div class="flavour-scroll-rod"></div>
          <div class="flavour-scroll-content">
            ${isDM() ? `<button class="dm-btn dm-btn-icon dm-btn-sm flavour-oog${gezegd ? ' dm-btn--active' : ''}"
              title="${gezegd ? 'Toch niet verteld — terugdraaien' : 'Markeer als verteld; de spelers zien de roddel dan'}"
              onclick="window._toggleFlavour('${tab}','${e.id}',${i})">${gezegd ? icon('beer') : icon('lock')}</button>` : ''}
            <p class="flavour-text">\u201e${esc(tekst)}\u201c</p>
            ${(_audioId && n === 0) ? `
              <div class="flavour-audio-wrap">
                <button type="button" class="flavour-audio-play" data-audio-btn data-audio-btn-id="${esc(_audioId)}"
                  onclick="window._audioToggle('${esc(_audioId)}')" title="Sfeer afspelen / pauzeren">▶</button>
              </div>` : ''}
          </div>
          <div class="flavour-scroll-rod"></div>
        </div>`).join('');
  }

  // Geheimen: één blok per regel. De DM ziet ze allemaal met een oogje ernaast
  // om die ene vrij te geven; de speler ziet alleen wat onthuld is.
  const geheimRegels = _tekstLijstUit(e.data, 'geheimen', 'geheim');
  const _geheimOnthuld = Array.isArray(e._onthuld)
    ? geheimRegels.map((_, i) => !!e._onthuld[i])
    : geheimRegels.map((_, i) => !!e._secretReveal && i === 0);
  const zichtbareGeheimen = geheimRegels.map((tekst, i) => ({ tekst, i, onthuld: _geheimOnthuld[i] }))
    .filter(r => isDM() || r.onthuld);
  if (zichtbareGeheimen.length) {
    infoHtml += `
      <div class="mb-4">
        <div class="detail-field-label detail-field-label--secret">\ud83d\udd12 ${zichtbareGeheimen.length > 1 ? 'Geheimen' : 'Geheim'}${
          isDM() && geheimRegels.length > 1 ? ` <span class="geheim-teller">${_geheimOnthuld.filter(Boolean).length} van ${geheimRegels.length} onthuld</span>` : ''}</div>
        ${zichtbareGeheimen.map(({ tekst, i, onthuld }) => `
          <div class="geheim-regel${onthuld ? ' geheim-regel--onthuld' : ''}">
            ${isDM() ? `<button class="dm-btn dm-btn-icon dm-btn-sm geheim-oog${onthuld ? ' dm-btn--active' : ''}"
              title="${onthuld ? 'Weer verbergen voor spelers' : 'Aan de spelers onthullen'}"
              onclick="window._toggleSecret('${tab}','${e.id}',${i})">${onthuld ? icon('eye') : icon('lock')}</button>` : ''}
            <div class="detail-dm-block detail-dm-block--secret">${mdToHtml(tekst)}</div>
          </div>`).join('')}
      </div>
    `;
  }

  // Missies die aan dit kaartje hangen. Dat maakt "missiegever" een afgeleide:
  // wie een missie gaf, is missiegever — niets om apart bij te houden.
  if (['personages', 'organisaties'].includes(tab)) {
    infoHtml += `<div id="detail-missies-${e.id}"></div>`;
    _vulMissies(e.id, tab);
  }

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
        <div class="detail-dm-tools flex flex-wrap gap-2 mb-3">
          <button class="dm-btn dm-btn-icon${vis !== 'hidden' ? ' dm-btn--active' : ''}"
            title="${_mVisTitle}"
            onclick="window._toggleVis('${tab}','${e.id}',event)">
            ${_mVisIcon}
          </button>
          ${(isPersonage || tab === 'locaties') ? `
            <button class="dm-btn dm-btn-icon${e._secretReveal ? ' dm-btn--active' : ''}"
              title="${e._secretReveal ? 'Geheim verbergen voor spelers' : 'Geheim onthullen aan spelers'}"
              onclick="window._toggleSecret('${tab}','${e.id}')">
              ${e._secretReveal ? icon('eye') : icon('lock')}
            </button>
          ` : ''}
          <button class="dm-btn dm-btn-icon${e._deceased ? ' dm-btn--active' : ''}"
            title="${e._deceased ? 'Markering verwijderen' : 'Markeer als deceased'}"
            onclick="window._toggleDeceased('${tab}','${e.id}')">
            ${icon('skull', {cls:'icon-gi'})}
          </button>
          <button class="dm-btn dm-btn-icon"
            title="Bewerk dit kaartje (afbeelding, tekst, geluid)"
            onclick="window._openEditor('${tab}','${e.id}')">
            ${icon('pencil')}
          </button>
        </div>
        <div class="detail-label mb-1">DM Notities</div>
        <textarea id="dm-note-${e.id}" class="w-full min-h-[80px] px-3 py-2 bg-room-bg border border-room-border rounded text-sm text-ink-bright font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Notities...">${esc(e._dmNote || '')}</textarea>
        <div id="note-save-${e.id}" class="text-xs text-green-wax opacity-0 transition-opacity mt-1"></div>
      </div>
    `;

    // DM ziet de aantekeningen van alle spelers (read-only, gelabeld)
    if (playerNotesData?.notes && Object.keys(playerNotesData.notes).length > 0) {
      infoHtml += `
        <div class="dm-only mt-3 pt-3 border-t border-room-border/50">
          <div class="detail-label mb-2">Spelersaantekeningen</div>
          ${Object.entries(playerNotesData.notes).map(([name, text]) => `
            <div class="mb-2">
              <div class="text-xs text-gold font-cinzel font-semibold mb-0.5">${esc(name)}</div>
              <div class="text-sm text-ink-medium bg-room-bg border border-room-border/50 rounded px-3 py-2 font-crimson">${esc(text)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
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
    const s = e.stats || {};
    const hasStats = Object.values(s).some(v => v);
    if (hasStats) {
      const mod = (v) => {
        if (!v) return '\u2014';
        const m = Math.floor((parseInt(v) - 10) / 2);
        return m >= 0 ? `+${m}` : `${m}`;
      };
      // Combat header (AC, HP, Speed, CR, Prof Bonus)
      const _combatStats = ['ac','hp','speed'].filter(k => s[k]).map(k =>
        `<div class="text-center"><div class="text-xs text-ink-dim font-cinzel uppercase">${k.toUpperCase()}</div><div class="text-2xl font-bold text-ink-bright">${esc(s[k])}</div></div>`
      ).join('');
      const _crStat = s.cr ? `<div class="text-center"><div class="text-xs text-ink-dim font-cinzel uppercase">CR</div><div class="text-2xl font-bold text-ink-bright">${esc(s.cr)}</div></div>` : '';
      const _profStat = s.profBonus ? `<div class="text-center"><div class="text-xs text-ink-dim font-cinzel uppercase">Prof</div><div class="text-2xl font-bold text-ink-bright">${esc(s.profBonus)}</div></div>` : '';

      // Property rows
      const _propRows = [
        ['savingThrows','Saving Throws'],
        ['skills','Skills'],
        ['resistances','Damage Resistances'],
        ['immunities','Damage Immunities'],
        ['conditionImmunities','Condition Immunities'],
        ['senses','Senses'],
        ['languages','Languages'],
      ].filter(([k]) => s[k]).map(([k, label]) =>
        `<div class="flex gap-2"><span class="font-cinzel text-ink-dim text-[10px] uppercase flex-shrink-0 w-40">${label}</span><span class="text-ink-medium">${esc(s[k])}</span></div>`
      ).join('');
      const _propTable = _propRows ? `<div class="mt-3 border-t border-room-border pt-3 text-sm space-y-1">${_propRows}</div>` : '';

      // Narrative sections
      const _narrative = [
        ['traits','Traits'],
        ['actions','Actions'],
        ['bonusActions','Bonus Actions'],
        ['reactions','Reactions'],
        ['legendaryActions','Legendary Actions'],
      ].filter(([k]) => s[k]).map(([k, label]) =>
        `<div class="mt-3 border-t border-room-border pt-3"><div class="text-xs font-cinzel text-gold-dim font-bold tracking-wide mb-1">${label}</div><div class="text-sm text-ink-medium sheet-narrative">${mdToHtml(s[k])}</div></div>`
      ).join('');

      // Spells. Gekoppelde spreuken worden chips die het spreukdetail openen; de
      // losse tekstvelden blijven eronder staan voor wat niet in de bibliotheek zit.
      let _gekoppeld = [];
      try { _gekoppeld = JSON.parse(s.spellIndexes || '[]'); } catch { _gekoppeld = []; }
      const _spells = [
        _gekoppeld.length ? `<div class="mt-3 border-t border-room-border pt-3">
            <div class="text-xs font-cinzel text-gold-dim font-bold tracking-wide mb-1">Spells</div>
            <div class="cs-spell-chips" id="detail-spell-chips">${_gekoppeld.map(idx =>
              `<button type="button" class="cs-spell-chip cs-spell-chip--klik" data-spell="${esc(idx)}"
                 onclick="window.spreuken.open('${esc(idx)}')">${esc(idx.replace(/-/g, ' '))}</button>`).join('')}</div>
          </div>` : '',
        s.cantrips ? `<div class="mt-3 border-t border-room-border pt-3"><div class="text-xs font-cinzel text-gold-dim font-bold tracking-wide mb-1">Cantrips</div><div class="text-sm text-ink-medium sheet-narrative">${mdToHtml(s.cantrips)}</div></div>` : '',
        s.spells ? `<div class="mt-3 border-t border-room-border pt-3"><div class="text-xs font-cinzel text-gold-dim font-bold tracking-wide mb-1">Spells (los)</div><div class="text-sm text-ink-medium sheet-narrative">${mdToHtml(s.spells)}</div></div>` : '',
      ].join('');

      sheetHtml += `
        <div class="mb-4 p-4 bg-room-elevated rounded border border-room-border">
          <div class="flex flex-wrap gap-4 mb-4 text-sm">
            ${_combatStats}${_crStat}${_profStat}
          </div>
          <div class="stat-grid">
            ${['str','dex','con','int','wis','cha'].map(a => `
              <div class="stat-box">
                <div class="stat-label">${a.toUpperCase()}</div>
                <div class="stat-val">${s[a] || '\u2014'}</div>
                <div class="stat-mod">${mod(s[a])}</div>
              </div>
            `).join('')}
          </div>
          ${_propTable}
          ${_narrative}
          ${_spells}
          ${s.extra ? `<div class="mt-3 border-t border-room-border pt-3 text-sm text-ink-medium sheet-narrative">${mdToHtml(s.extra)}</div>` : ''}
        </div>
      `;
    } else {
      sheetHtml = `<div class="text-center py-10 text-ink-faint font-fell italic">Nog geen statistieken ingevuld</div>`;
    }
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

  // ── Tab: Voorraad (verkopers & winkels) ──
  const isVerkoper = window._heeftRol(e, 'verkoper');
  const isWinkel = tab === 'locaties' && e.data?.locType === 'Winkel';
  const heeftVoorraad = isVerkoper || isWinkel;
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

    // ── Inkoop: speler verkoopt voorwerpen aan de winkel ──
    const verkoopHtml = (!isDM() && shopVerkoopData?.koopt) ? (() => {
      const _cN = window._currency || { fl: 'fl', kn: 'kn', cl: 'cl' };
      const _fmt = (b) => b ? `${b.fl} ${esc(_cN.fl)} · ${b.kn} ${esc(_cN.kn)} · ${b.cl} ${esc(_cN.cl)}` : '—';
      const _items = shopVerkoopData.items || [];
      const _ratio = shopVerkoopData.ratio || 50;
      const _bonusPct = shopVerkoopData.bonusPct || 0;
      const rijen = _items.length ? _items.map((it, i) => `
        <tr class="${i % 2 === 1 ? 'bg-room-elevated/40' : ''} border-b border-room-border/40 last:border-0${it.verkoopbaar ? '' : ' shop-verkoop-rij--nope'}">
          <td class="px-4 py-2.5 font-crimson">
            <span class="cursor-pointer hover:text-gold transition underline decoration-dotted"
              onclick="window._openDetailFromShop('${esc(it.entityId)}')">${esc(it.naam)}</span>
            ${it.itemType ? `<span class="shop-verkoop-cat">${esc(it.itemType)}</span>` : ''}
            ${it.qty > 1 ? `<span class="shop-verkoop-qty">×${it.qty}</span>` : ''}
          </td>
          <td class="px-4 py-2.5 text-right font-crimson text-ink-medium">
            ${it.verkoopbaar ? _fmt(it.aanbod) : `<span class="shop-verkoop-reden">${esc(it.reden)}</span>`}
          </td>
          <td class="px-2 py-2.5 text-right">
            ${it.verkoopbaar ? `
              <div class="flex items-center gap-1 justify-end">
                ${it.stapelbaar && it.qty > 1 ? `<input type="number" min="1" max="${it.qty}" value="1"
                  class="shop-qty-input" id="shop-verkoop-qty-${i}"
                  onclick="event.stopPropagation()" oninput="this.value=Math.min(${it.qty},Math.max(1,parseInt(this.value)||1))">` : ''}
                <button class="shop-verkoop-btn"
                  onclick="window._verkoopItem('${esc(_shopId)}','${esc(it.entityId)}',this,${it.stapelbaar && it.qty > 1 ? `parseInt(document.getElementById('shop-verkoop-qty-${i}')?.value)||1` : '1'})">
                  Verkopen
                </button>
              </div>` : ''}
          </td>
        </tr>`).join('') : `<tr><td colspan="3" class="text-center py-6 text-ink-faint font-fell italic">Je hebt niets dat deze winkel inkoopt</td></tr>`;
      return `
        <div class="shop-verkoop-section">
          <div class="shop-verkoop-head">${icon('coins')} Verkopen aan deze winkel
            <span class="shop-verkoop-ratio">koopt voor ${_ratio}% van de waarde</span>
            ${_bonusPct > 0 ? `<span class="shop-korting-badge">+${_bonusPct}% onderhandeld</span>` : ''}
          </div>
          <div class="rounded border border-room-border overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-room-elevated border-b border-room-border">
                  <th class="px-4 py-2.5 text-left font-cinzel text-ink-dim text-[10px] tracking-wide">Jouw voorwerp</th>
                  <th class="px-4 py-2.5 text-right font-cinzel text-ink-dim text-[10px] tracking-wide">Bod</th>
                  <th class="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>${rijen}</tbody>
            </table>
          </div>
          <div id="shop-verkoop-feedback" class="shop-koop-feedback hidden"></div>
        </div>`;
    })() : '';

    if (voorraadItems.length > 0) {
      // Onderhandelen button (alleen voor spelers) — met winkelier-humeur
      const _oh = beschikbaarData?.onderhandel || null;
      const humeurHtml = _oh?.tekst
        ? `<div class="shop-humeur shop-humeur--${esc(_oh.tier)}">${icon('message-circle')} <span>${esc(_oh.tekst)}</span></div>`
        : '';
      const onderhandelHtml = !isDM() ? `
        <div id="shop-onderhandel-wrap" class="shop-onderhandel-wrap">
          ${humeurHtml}
          ${_oh && !_oh.kan ? `
          <button class="shop-onderhandel-btn" disabled title="${esc(_oh.reden)}">
            ${icon('dice')} Onderhandelen
          </button>
          <span class="shop-onderhandel-geblokkeerd">${esc(_oh.reden)}</span>` : `
          <button class="shop-onderhandel-btn" onclick="window._onderhandelOpen('${esc(_shopId)}')">
            ${icon('dice')} Onderhandelen
          </button>`}
          <div id="shop-onderhandel-panel-${esc(_shopId)}" class="shop-onderhandel-panel hidden">
            <div class="flex items-center gap-2">
              <label class="text-xs text-ink-dim">CHA-modifier:</label>
              <input type="number" id="shop-cha-mod-${esc(_shopId)}" value="0" min="-5" max="10"
                class="shop-cha-input" style="width:56px">
              <button class="shop-onderhandel-roll-btn"
                onclick="window._onderhandelRoll('${esc(_shopId)}')">Gooien</button>
              <button class="shop-onderhandel-annuleer"
                onclick="document.getElementById('shop-onderhandel-panel-${esc(_shopId)}').classList.add('hidden')">${icon('x')}</button>
            </div>
          </div>
          <div id="shop-onderhandel-result-${esc(_shopId)}" class="shop-onderhandel-result hidden"></div>
        </div>` : '';

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
        ${onderhandelHtml}
        <div id="shop-koop-feedback" class="shop-koop-feedback hidden"></div>
        ${verkoopHtml}`;
    } else {
      voorraadHtml = `${sfeerHtml}${kortingBannerHtml}${beursHtml}${roterendHtml}<div class="text-center py-10 text-ink-faint font-fell italic">Geen voorraad beschikbaar</div>${verkoopHtml}`;
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

  // Huisdier (subtype 'dier'): geschaalde statblock-sectie (gevuld na openModal)
  if (tab === 'personages' && e.subtype === 'dier') {
    infoHtml += `<div id="pet-statblock-slot" class="pet-statblock-slot"><p class="text-center text-ink-faint font-fell italic py-4">Statblock laden…</p></div>`;
  }

  // ── Build tabbed modal body ──
  const detailTabs = [
    { key: 'info', label: 'Info' },
    ...(showSheet ? [{ key: 'sheet', label: 'Character Sheet' }] : []),
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
    e.data?.ras,
    e.data?.klasse,
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
  if (_mSubEl) _mSubEl.innerHTML = _subtitleHtml;
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
          await api.saveNote(e.id, ta.value);
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

function _fpApply(ev) {
  const wrap = document.getElementById('fp-wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, Math.round((ev.clientX - rect.left) / rect.width  * 100)));
  const y = Math.max(0, Math.min(100, Math.round((ev.clientY - rect.top)  / rect.height * 100)));
  const val = `${x}% ${y}%`;
  const input = document.getElementById('fp-input');
  if (input) input.value = val;
  const img = document.getElementById('editor-img-preview');
  if (img) img.style.objectPosition = val;
  const card = document.getElementById('fp-card-preview');
  if (card) card.style.objectPosition = val;
  const ch = document.getElementById('fp-crosshair');
  if (ch) { ch.style.left = x + '%'; ch.style.top = y + '%'; }
}

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
        const wrap = document.getElementById('fp-wrap');
        const img  = document.getElementById('editor-img-preview');
        const hint = document.getElementById('fp-hint');
        if (img)  img.src = api.fileUrl(fileId);
        if (wrap) wrap.classList.remove('hidden');
        if (hint) hint.classList.remove('hidden');
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

function _petTierRowHtml(t, i) {
  const sb = t.statblock || {};
  const num = v => (v === 0 || v) ? esc(v) : '';
  return `<div class="pet-tier-row" data-idx="${i}">
    <div class="pet-tier-row-head">
      <span class="pet-tier-badge">Tier ${i + 1}</span>
      <button type="button" class="pet-tier-del" onclick="window._petTierRemove(${i})" title="Verwijder tier">${icon('trash')}</button>
    </div>
    <div class="pet-editor-row">
      <label class="pet-fld pet-fld--sm"><span>Min. level</span><input type="number" min="1" class="pt-minlevel" value="${num(t.minLevel)}"></label>
      <label class="pet-fld"><span>Label</span><input class="pt-label" value="${esc(t.label || '')}" placeholder="Guard Dog"></label>
      <label class="pet-fld pet-fld--sm"><span>Max HP</span><input type="number" min="1" class="pt-maxhp" value="${num(t.maxHp)}"></label>
    </div>
    <div class="pet-editor-row">
      <label class="pet-fld pet-fld--sm"><span>AC</span><input class="pt-ac" value="${esc(sb.ac || '')}"></label>
      <label class="pet-fld pet-fld--sm"><span>HP (dice)</span><input class="pt-hp" value="${esc(sb.hp || '')}" placeholder="3d8+6"></label>
      <label class="pet-fld"><span>Speed</span><input class="pt-speed" value="${esc(sb.speed || '')}" placeholder="40 ft."></label>
    </div>
    <div class="pet-editor-row">
      <label class="pet-fld"><span>Size</span><input class="pt-size" value="${esc(sb.size || '')}" placeholder="Medium"></label>
      <label class="pet-fld"><span>Type</span><input class="pt-type" value="${esc(sb.type || '')}" placeholder="Beast"></label>
      <label class="pet-fld pet-fld--sm"><span>CR</span><input class="pt-cr" value="${esc(sb.cr || '')}"></label>
    </div>
    <div class="pet-editor-row pet-abilities">
      ${['str','dex','con','int','wis','cha'].map(a => `<label class="pet-fld pet-fld--xs"><span>${a.toUpperCase()}</span><input type="number" class="pt-${a}" value="${num(sb[a])}"></label>`).join('')}
    </div>
    <div class="pet-editor-row">
      <label class="pet-fld pet-fld--wide"><span>Skills</span><input class="pt-skills" value="${esc(sb.skills || '')}" placeholder="Perception +4"></label>
      <label class="pet-fld pet-fld--wide"><span>Senses</span><input class="pt-senses" value="${esc(sb.senses || '')}" placeholder="Passive Perception 14"></label>
    </div>
    <label class="pet-fld pet-fld--full"><span>Traits</span><textarea class="pt-traits" rows="2" placeholder="***Keen Hearing and Smell.*** …">${esc(sb.traits || '')}</textarea></label>
    <label class="pet-fld pet-fld--full"><span>Actions</span><textarea class="pt-actions" rows="2" placeholder="***Bite.*** Melee Attack Roll: +5…">${esc(sb.actions || '')}</textarea></label>
  </div>`;
}

// Lees de tier-velden terug uit het DOM naar _petTiers (vóór add/remove en submit).
function _petTiersCollect() {
  const out = [];
  document.querySelectorAll('#pet-tiers-list .pet-tier-row').forEach(row => {
    const g = cls => (row.querySelector('.' + cls)?.value ?? '');
    const n = cls => { const v = parseInt(g(cls)); return isNaN(v) ? undefined : v; };
    const sb = {};
    [['size','pt-size'],['type','pt-type'],['ac','pt-ac'],['hp','pt-hp'],['speed','pt-speed'],['skills','pt-skills'],['senses','pt-senses'],['cr','pt-cr'],['traits','pt-traits'],['actions','pt-actions']]
      .forEach(([k, c]) => { const v = g(c).trim(); if (v) sb[k] = v; });
    ['str','dex','con','int','wis','cha'].forEach(a => { const v = n('pt-' + a); if (v !== undefined) sb[a] = v; });
    if (!sb.alignment) sb.alignment = 'Unaligned';
    out.push({ minLevel: n('pt-minlevel'), label: g('pt-label').trim(), maxHp: n('pt-maxhp'), statblock: sb });
  });
  _petTiers = out;
  return out;
}

window._renderPetTiers = () => {
  const list = document.getElementById('pet-tiers-list');
  if (!list) return;
  list.innerHTML = _petTiers.length
    ? _petTiers.map((t, i) => _petTierRowHtml(t, i)).join('')
    : `<p class="pet-tier-empty">Nog geen tiers — voeg er minstens één toe (Tier 1 = laagste level).</p>`;
};
window._petTierAdd = () => { _petTiersCollect(); _petTiers.push({ minLevel: _petTiers.length ? undefined : 1, label: '', maxHp: undefined, statblock: {} }); window._renderPetTiers(); };
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
  const _isAntagonist    = e?.data?.geheimeAntagonist === true || e?.data?.geheimeAntagonist === 'true';
  const _existingAudioId = e?.data?.audioId || '';
  const _isNpcEditor     = e?.subtype === 'NPC';

  // ── Twee-kolom layout ──
  body += `<div class="editor-layout">`;

  // ── Linker kolom: afbeelding ──
  body += `<div class="editor-col-left">`;
  {
    // Effectief portret-fileId: data.imageId (bibliotheek) of het entity-id zelf.
    const curImgId = e?.data?.imageId || (editId || '');
    const hasImg   = !!(e?.data?.imageId) || !!editId;
    const fileUrl  = hasImg ? api.fileUrl(curImgId) : '';
    const focusVal = e?.data?.imgFocus || '50% 50%';
    const [fx, fy] = (focusVal.match(/(\d+)%\s*(\d+)%/) || [null,'50','50']).slice(1).map(Number);
    body += `
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Afbeelding</label>
        <div class="mt-1">
          <div id="fp-wrap" class="relative rounded overflow-hidden mb-1 select-none${hasImg ? '' : ' hidden'}"
            style="height:140px;cursor:crosshair"
            onmousedown="window._fpDown(event)"
            onmousemove="window._fpMove(event)">
            <img id="editor-img-preview" src="${fileUrl}"
              class="w-full h-full object-cover pointer-events-none"
              style="object-position:${focusVal}"
              onerror="this.parentElement.classList.add('hidden')">
            <div id="fp-crosshair" class="absolute pointer-events-none"
              style="left:${fx}%;top:${fy}%;transform:translate(-50%,-50%)">
              <div style="width:22px;height:22px;border-radius:50%;
                border:2px solid #fff;
                box-shadow:0 0 0 1.5px rgba(0,0,0,0.55),inset 0 0 0 1.5px rgba(0,0,0,0.3)"></div>
            </div>
          </div>
          <p class="text-[10px] text-ink-dim mb-1${hasImg ? '' : ' hidden'}" id="fp-hint">Klik om focuspunt in te stellen</p>
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
          <label class="dm-btn dm-btn-ghost dm-btn-sm" style="cursor:pointer">
            ${icon('camera')} Filmpje kiezen
            <input type="file" accept="video/mp4,video/webm" class="hidden"
              onchange="window._kiesCharVideo('${esc(e?.id || '')}', this.files[0], this)">
          </label>
          <button type="button" id="editor-video-del" class="dm-btn dm-btn-ghost dm-btn-sm hidden"
            onclick="window._removeCharVideo('${esc(e?.id || '')}')" title="Filmpje verwijderen">${icon('trash')}</button>
        </div>
      </div>` : ''}
    `;
  }
  body += `</div>`; // end editor-col-left

  // ── Rechter kolom: naam, type-velden ──
  body += `<div class="editor-col-right">`;
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
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Subtype</label>
        <select name="subtype" id="subtype-select"
          onchange="window._onSubtypeChange(this.value)"
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          <option value="">—</option>
          ${schema.subtypes.map(s => `<option value="${s}" ${e?.subtype === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    `;
  }

  // Groep-selector (alleen voor personages met subtype speler)
  if (tab === 'personages' && _editorGroups.length > 1) {
    const isSpeler = e?.subtype === 'speler';
    const currentGroep = e?.data?.groep || '';
    body += `
      <div id="groep-section"${isSpeler ? '' : ' style="display:none"'}>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Spelersgroep</label>
        <select name="data_groep"
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          <option value="">Alle groepen</option>
          ${_editorGroups.map(g => `<option value="${esc(g.id)}"${currentGroep === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}
        </select>
      </div>
    `;
  }

  // ── Huisdier-editor (subtype 'dier'): adoptie-instellingen + tier-editor ──
  if (tab === 'personages') {
    const isDier   = e?.subtype === 'dier';
    const _adopt   = e?.data?.adopteerbaar === true || e?.data?.adopteerbaar === 'true';
    const _prijsFl = e?.data?.adoptiePrijs?.fl ?? e?.data?.adoptiePrijsFl ?? '';
    body += `
      <div id="pet-editor-section"${isDier ? '' : ' style="display:none"'} class="pet-editor">
        <div class="pet-editor-head">${icon('paw-print')} Huisdier — adoptie &amp; tiers</div>
        <div class="flex items-center gap-2">
          <input type="hidden" name="data_adopteerbaar" id="pet-adopt-hidden" value="${_adopt ? 'true' : ''}">
          <input type="checkbox" id="pet-adopt-cb" class="rounded" ${_adopt ? 'checked' : ''}
            onchange="document.getElementById('pet-adopt-hidden').value=this.checked?'true':''">
          <label for="pet-adopt-cb" class="text-xs font-cinzel text-ink-dim font-bold tracking-wide cursor-pointer">Adopteerbaar via De Magizoöloog</label>
        </div>
        <div class="pet-editor-row">
          <label class="pet-fld pet-fld--sm"><span>Prijs (${esc(window._muntNamen().fl.toLowerCase())})</span>
            <input type="number" min="0" name="data_adoptiePrijsFl" value="${esc(_prijsFl)}"></label>
          <label class="pet-fld"><span>Soort-label</span>
            <input name="data_soortLabel" value="${esc(e?.data?.soortLabel || '')}" placeholder="Hond"></label>
          <label class="pet-fld"><span>Naam-suggestie</span>
            <input name="data_naamSuggestie" value="${esc(e?.data?.naamSuggestie || '')}" placeholder="Jip"></label>
        </div>
        <div class="pet-editor-subhead">Tiers — schalen met het level van het baasje</div>
        <div id="pet-tiers-list"></div>
        <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._petTierAdd()">${icon('plus')} Tier toevoegen</button>
      </div>
    `;
  }

  // Korte velden (niet-textarea) in rechter kolom
  let _revealGroupOpen = null;
  const _curItemType = e?.data?.itemType || '';
  for (const field of schema.fields) {
    if ((field.key === 'geheim' || field.dmOnly) && !isDM()) continue;
    if (field.type === 'textarea') continue;
    // Close open reveal group when leaving it
    if (_revealGroupOpen && field.inReveal !== _revealGroupOpen) {
      body += `</div>`; // end reveal-group div
      _revealGroupOpen = null;
    }
    const val = e?.data?.[field.key] || '';
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
            ${field.options.map(o => typeof o === 'object' ? `<option value="${o.value}" ${val === o.value ? 'selected' : ''}>${o.label}</option>` : `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
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
            ${ROLLEN.map(r => `
              <label class="rol-keuze" title="${esc(r.uitleg)}">
                <input type="checkbox" value="${r.key}" ${_gekozen.includes(r.key) ? 'checked' : ''}
                  onchange="window._rollenBij()">
                <span>${esc(r.label)}</span>
              </label>`).join('')}
          </div>
        </div>
      `;
    } else if (field.type === 'lijst-tekst') {
      const regels = _tekstLijstUit(e?.data, field.key, field.enkelvoud);
      if (!regels.length) regels.push('');
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <div id="lijst-${field.key}" class="lijst-veld" data-veld="${field.key}">
            ${regels.map((t, i) => _lijstRegelHtml(field.key, t, i)).join('')}
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
          <input name="data_${field.key}" value="${esc(val)}"
            class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
        </div>
      `;
    }
    if (field.showFor) body += `</div>`; // close showFor wrapper
    if (field.hideFor) body += `</div>`; // close hideFor wrapper
  }
  if (_revealGroupOpen) { body += `</div>`; _revealGroupOpen = null; }

  // ── DM-toggles onder klasseveld (rechterkolom) ──
  if (tab === 'personages' && isDM()) {
    body += `
      <div class="editor-toggles-row">
        <!-- De knop "roddel uitgesproken door de waard" stond hier, maar dat is
             geen eigenschap van het personage: het is de stand van de herberg.
             Sinds flavour een lijst is houdt de server per regel bij of hij al
             verteld is, en dat regelt de herberg zelf. -->
        <div id="geheime-antagonist-section"${_isNpcEditor ? '' : ' style="display:none"'}>
          <button type="button" id="btn-geheimeAntagonist"
            class="dm-btn dm-btn-ghost editor-toggle-btn${_isAntagonist ? ' editor-toggle-btn--active' : ''}"
            title="Geheime antagonist — subtype wordt antagonist na onthulling"
            onclick="window._editorToggleBtn('inp-geheimeAntagonist','btn-geheimeAntagonist')">${icon('skull', {cls:'icon-gi'})}</button>
        </div>
        ${editId && _isNpcEditor ? `
          <button type="button" id="btn-medestander"
            class="dm-btn dm-btn-ghost editor-toggle-btn"
            title="Medestander koppelen / ontkoppelen"
            onclick="window._editorToggleCompanionBtn()">${icon('crossed-swords', {cls:'icon-gi'})}</button>
        ` : ''}
      </div>
    `;
  }

  body += `</div>`; // end editor-col-right
  body += `</div>`; // end editor-layout

  // ── Textarea velden (volledige breedte) ──
  let _hasFlavourField = false;

  for (const field of schema.fields) {
    const val = e?.data?.[field.key] || '';
    if ((field.key === 'geheim' || field.dmOnly) && !isDM()) continue;
    if (field.type !== 'textarea') continue;
    if (field.key === 'flavour') _hasFlavourField = true;
    const taId   = `ta_${field.key}`;
    const _rows  = field.key === 'desc' ? 6 : 4;
    const _taHtml = `${fmtToolbar(taId)}<textarea id="${taId}" name="data_${field.key}" rows="${_rows}"
            onkeydown="window._fmtKey(event)"
            class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(val)}</textarea>`;

    if (['persoonlijkheid', 'flavour', 'geheim'].includes(field.key)) {
      body += `
        <details class="cs-accordion"${val ? ' open' : ''}>
          <summary class="cs-accordion-head">
            <span>${esc(field.label)}</span>
            <span class="cs-accordion-chevron">▾</span>
          </summary>
          <div class="cs-accordion-body">${_taHtml}</div>
        </details>
      `;
    } else {
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">${esc(field.label)}</label>
          <div class="mt-1">${_taHtml}</div>
        </div>
      `;
    }
  }

  // ── Verborgen inputs + audio (code behouden) ──
  if (tab === 'personages' && isDM()) {
    body += `
      <input type="hidden" name="data_flavourUitgesproken" id="inp-flavourUitgesproken" value="${_valUitgesproken ? 'true' : ''}">
      <input type="hidden" id="inp-geheimeAntagonist" name="data_geheimeAntagonist" value="${_isAntagonist ? 'true' : ''}">
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

  // Voorraad (verkopers & winkels)
  if (tab === 'personages' || tab === 'locaties') {
    const _showVoorraad = tab === 'personages'
      ? window._heeftRol(e, 'verkoper')
      : e?.data?.locType === 'Winkel';
    let winkelConfigEditor = {};
    try { winkelConfigEditor = e?.data?.winkelConfig ? JSON.parse(e.data.winkelConfig) : {}; } catch {}
    body += `
      <div id="voorraad-section"${_showVoorraad ? '' : ' style="display:none"'}
        class="p-4 bg-room-elevated rounded border border-room-border">
        <div class="text-xs font-cinzel text-gold-dim font-bold tracking-wide mb-3">\ud83c\udfec Voorraad</div>
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
        <button type="button" onclick="window._addVoorraadItem()"
          class="px-3 py-1 bg-room-bg border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright transition">
          + Voorwerp toevoegen
        </button>
        <!-- Winkelconfig: rotatie-instellingen -->
        <div class="mt-4 pt-3 border-t border-room-border/60">
          <div class="text-xs font-cinzel text-gold-dim font-bold tracking-wide mb-2">${icon('refresh-cw')} Rotatie-instellingen</div>
          <input type="hidden" name="data_winkelConfig" id="winkelconfig-hidden" value="${esc(e?.data?.winkelConfig || '')}">
          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm text-ink-medium cursor-pointer">
              <input type="checkbox" id="wc-roterend" ${winkelConfigEditor.roterend ? 'checked' : ''} onchange="window._wcUpdate()">
              Roterend assortiment
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
                <label class="text-xs text-ink-dim w-32" title="Winkels met hetzelfde label delen één rotatie">Gedeeld met</label>
                <input type="text" id="wc-deelgroep" value="${esc(winkelConfigEditor.deelGroep || '')}"
                  oninput="window._wcUpdate()" placeholder="bijv. mystiek-magazijn"
                  class="flex-1 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              </div>
            </div>
          </div>
        </div>
        <!-- Sfeer & Onderhandelen instellingen -->
        <div class="mt-4 pt-3 border-t border-room-border/60">
          <div class="text-xs font-cinzel text-gold-dim font-bold tracking-wide mb-2">Sfeer & onderhandelen</div>
          <div class="space-y-2">
            <div>
              <label class="text-xs text-ink-dim block mb-1">Sfeertekst (bovenaan voorraad)</label>
              <textarea id="wc-sfeer" rows="2" oninput="window._wcUpdate()" placeholder="De schappen liggen vol met…"
                class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(winkelConfigEditor.sfeerTekst || '')}</textarea>
            </div>
            <div class="flex gap-2 items-center">
              <label class="text-xs text-ink-dim w-32">Onderhandel DC</label>
              <input type="number" id="wc-onderhandel-dc" min="1" max="30" value="${winkelConfigEditor.onderhandelDC ?? 15}"
                oninput="window._wcUpdate()"
                class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            </div>
            <div class="flex gap-2 items-center">
              <label class="text-xs text-ink-dim w-32">Korting bij succes (%)</label>
              <input type="number" id="wc-onderhandel-korting" min="0" max="90" value="${winkelConfigEditor.onderhandelKorting ?? 10}"
                oninput="window._wcUpdate()"
                class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            </div>
            <div class="flex gap-2 items-center">
              <label class="text-xs text-ink-dim w-32">Boete bij falen (%)</label>
              <input type="number" id="wc-onderhandel-boete" min="0" max="50" value="${winkelConfigEditor.onderhandelBoete ?? 0}"
                oninput="window._wcUpdate()"
                class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            </div>
          </div>
        </div>
        <!-- Inkoop: winkel koopt voorwerpen van spelers -->
        <div class="mt-4 pt-3 border-t border-room-border/60">
          <div class="text-xs font-cinzel text-gold-dim font-bold tracking-wide mb-2">${icon('coins')} Inkoop</div>
          <label class="flex items-center gap-2 text-sm text-ink-medium cursor-pointer mb-2">
            <input type="checkbox" id="wc-koopt" ${winkelConfigEditor.koopt ? 'checked' : ''} onchange="window._wcUpdate()">
            Koopt voorwerpen van spelers
          </label>
          <div id="wc-koop-extra" class="${winkelConfigEditor.koopt ? '' : 'hidden'} space-y-2 pl-4">
            <div class="flex gap-2 items-center">
              <label class="text-xs text-ink-dim w-40" title="Percentage van de voorwerpprijs dat de winkel uitbetaalt">Bod (% van waarde)</label>
              <input type="number" id="wc-koopratio" min="1" max="100" value="${winkelConfigEditor.koopRatio ?? 50}"
                oninput="window._wcUpdate()"
                class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            </div>
            <div>
              <div class="text-xs text-ink-dim mb-1">Koopt deze categorieën <span class="opacity-60">(geen aangevinkt = alles)</span></div>
              <div class="flex flex-wrap gap-x-3 gap-y-1">
                ${['Weapon','Armor','Shield','Potion','Scroll','Ring','Amulet','Magic Item','Wondrous item','Consumable','Musical instrument','Other'].map(cat => {
                  const _on = Array.isArray(winkelConfigEditor.koopCategorieen) && winkelConfigEditor.koopCategorieen.includes(cat);
                  return `<label class="flex items-center gap-1 text-xs text-ink-medium cursor-pointer">
                    <input type="checkbox" class="wc-koopcat" data-cat="${esc(cat)}" ${_on ? 'checked' : ''} onchange="window._wcUpdate()"> ${esc(cat)}
                  </label>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Stats (personages)
  if (tab === 'personages') {
    const s = e?.stats || {};
    const _si = (k, label, center = false) => `
      <div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>
        <input name="stat_${k}" value="${esc(s[k] || '')}"
          class="w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none${center ? ' text-center' : ''}">
      </div>`;
    const _ta = (k, label, rows = 3) => {
      const taId = `stat_ta_${k}`;
      return `<div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>
        <div class="mt-0.5">
          ${fmtToolbar(taId)}
          <textarea id="${taId}" name="stat_${k}" rows="${rows}"
            onkeydown="window._fmtKey(event)"
            class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(s[k] || '')}</textarea>
        </div>
      </div>`;
    };
    const _hasStats = Object.values(s).some(v => v);
    body += `
      <details class="cs-accordion"${_hasStats ? ' open' : ''}>
        <summary class="cs-accordion-head">
          <span>Character Sheet</span>
          <span class="cs-accordion-chevron">▾</span>
        </summary>
        <div class="cs-accordion-body">
          <div class="cs-tabs-bar">
            <button type="button" class="cs-tab-btn cs-tab-active" onclick="window._csTab('gevecht')">Combat</button>
            <button type="button" class="cs-tab-btn" onclick="window._csTab('acties')">Actions</button>
            <button type="button" class="cs-tab-btn" onclick="window._csTab('spreuken')">Spells</button>
          </div>

          <div id="cs-panel-gevecht" class="cs-sub-body space-y-2">
            <div class="grid grid-cols-3 gap-2">
              ${_si('ac','AC',true)}${_si('hp','HP',true)}${_si('speed','Speed',true)}
            </div>
            <div class="grid grid-cols-2 gap-2">
              ${_si('cr','Challenge Rating',true)}${_si('profBonus','Prof. Bonus',true)}
            </div>
            <div class="cs-divider"></div>
            <div class="text-[10px] font-cinzel text-ink-dim tracking-wide">Ability Scores</div>
            <div class="grid grid-cols-3 gap-2">
              ${['str','dex','con','int','wis','cha'].map(k => `
                <div>
                  <label class="text-[10px] font-cinzel text-ink-dim uppercase">${k.toUpperCase()}
                    <span class="cs-mod" id="cs-mod-${k}">${_abilityMod(s[k])}</span></label>
                  <input name="stat_${k}" value="${esc(s[k] || '')}" inputmode="numeric"
                    oninput="window._csModUpdate('${k}', this.value)"
                    class="w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm text-center focus:border-gold-dim focus:outline-none">
                </div>`).join('')}
            </div>
            <div class="cs-divider"></div>
            <div class="text-[10px] font-cinzel text-ink-dim tracking-wide">Proficiencies &amp; Defenses</div>
            <div class="space-y-2">
              ${_si('savingThrows','Saving Throws')}
              ${_si('skills','Skills')}
              ${_si('vulnerabilities','Damage Vulnerabilities')}
              ${_si('resistances','Damage Resistances')}
              ${_si('immunities','Damage Immunities')}
              ${_si('conditionImmunities','Condition Immunities')}
            </div>
            <div class="cs-divider"></div>
            <div class="text-[10px] font-cinzel text-ink-dim tracking-wide">Senses &amp; Languages</div>
            <div class="space-y-2">
              ${_si('senses','Senses')}
              ${_si('languages','Languages')}
            </div>
            <div class="cs-divider"></div>
            <!-- Traits horen bij het statblok en niet bij Actions: het zijn
                 passieve eigenschappen, geen dingen die je op je beurt doet. -->
            ${_ta('traits','Traits', 3)}
          </div>

          <div id="cs-panel-acties" class="cs-sub-body space-y-2" style="display:none">
            ${_ta('actions','Actions', 4)}
            ${_ta('bonusActions','Bonus Actions', 2)}
            ${_ta('reactions','Reactions', 2)}
            ${_ta('legendaryActions','Legendary Actions', 3)}
          </div>

          <div id="cs-panel-spreuken" class="cs-sub-body space-y-2" style="display:none">
            <div class="grid grid-cols-2 gap-2">
              ${_si('spellSaveDC','Spell Save DC',true)}${_si('spellAttackMod','Spell Attack Mod',true)}
            </div>
            <!-- Gekoppelde spreuken: overtypen levert een dood tekstveld op, een
                 koppeling levert een kaartje op waar je doorheen klikt. De
                 tekstvelden eronder blijven voor wat niet in de bibliotheek staat. -->
            <div>
              <label class="text-[10px] font-cinzel text-ink-dim uppercase">Spreuken uit de bibliotheek</label>
              <div id="cs-spell-chips" class="cs-spell-chips"></div>
              ${_keuzeVeldHtml('cs-spell-add', '', '', (_spreukLijst || []).map(sp => sp.name), 'Zoek een spreuk\u2026',
                (invoer) => window._csSpellAdd(invoer))}
              <input type="hidden" name="stat_spellIndexes" id="cs-spell-indexes" value="${esc(s.spellIndexes || '')}">
            </div>
            ${_si('cantrips','Cantrips (los)')}
            ${_ta('spells','Spells (los)', 3)}
            ${s.extra ? _ta('extra','Legacy', 2) : ''}
          </div>
        </div>
      </details>
    `;
  }

  // De Verbindingen-editor is vervallen: koppelingen leg je in de tekst zelf met
  // [[Naam]], en die worden overal als klikbare link gerenderd. Het veld
  // `links` blijft bestaan (kaartjes, dashboard, zoeken en de export lezen het
  // nog) maar wordt niet meer met de hand bijgehouden.

  // Buttons
  body += `
    <div class="flex gap-2 pt-2">
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

  openModal(editId ? 'Bewerken' : 'Nieuw', TYPE_META[tab].label, body);

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

  // ── Medestander toggle (enkelvoudig, aan/uit voor eerste groep) ──
  if (tab === 'personages' && editId && e?.subtype?.toLowerCase() === 'npc' && isDM() && _editorGroups.length > 0) {
    const _firstGroupId = _editorGroups[0].id;
    const _updateMedBtn = (linked) => {
      const btn = document.getElementById('btn-medestander');
      if (btn) btn.classList.toggle('editor-toggle-btn--active', linked.length > 0);
    };
    api.getCompanionStatus(editId)
      .then(({ linked }) => _updateMedBtn(linked))
      .catch(() => {});
    window._editorToggleCompanionBtn = async () => {
      const { linked } = await api.getCompanionStatus(editId).catch(() => ({ linked: [] }));
      if (linked.length > 0) {
        await Promise.all(linked.map(gid => api.unlinkCompanion(editId, gid)));
      } else {
        await api.linkCompanion(editId, _firstGroupId);
      }
      const { linked: nl } = await api.getCompanionStatus(editId).catch(() => ({ linked: [] }));
      _updateMedBtn(nl);
    };
  }

  // ── Toggle-knop helper ──
  window._editorToggleBtn = (inputId, btnId) => {
    const inp = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!inp || !btn) return;
    const active = inp.value === 'true';
    inp.value = active ? '' : 'true';
    btn.classList.toggle('editor-toggle-btn--active', !active);
  };

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
      rows.innerHTML = _voorraadItems.length === 0
        ? `<p class="text-xs text-ink-faint italic">Nog geen items toegevoegd</p>`
        : _voorraadItems.map((item, idx) => {
          const linked = !!item.entityId;
          const entityDisplayName = item.entityId
            ? (_voorraadEntityOptions.find(o => o.id === item.entityId)?.name || item.naam || '')
            : '';
          return `
          <div class="flex gap-2 items-center flex-wrap">
            <input placeholder="Naam voorwerp" value="${esc(item.naam || '')}"
              oninput="window._updateVoorraadItem(${idx},'naam',this.value)"
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
    window._addVoorraadItem = () => { _voorraadItems.push({ naam: '', prijs: '', entityId: '' }); window._refreshVoorraad(); };
    window._removeVoorraadItem = (idx) => { _voorraadItems.splice(idx, 1); window._refreshVoorraad(); };
    window._updateVoorraadItem = (idx, field, val) => { if (_voorraadItems[idx]) _voorraadItems[idx][field] = val; };
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
      const antagonistSec = document.getElementById('geheime-antagonist-section');
      if (antagonistSec) antagonistSec.style.display = val === 'NPC' ? '' : 'none';
      const rollenRij = document.querySelector('.rollen-rij')?.closest('div')?.parentElement;
      if (rollenRij) rollenRij.style.display = val === 'god' ? 'none' : '';
      const petSec = document.getElementById('pet-editor-section');
      if (petSec) petSec.style.display = val === 'dier' ? '' : 'none';
      const vidSec = document.getElementById('video-section');
      if (vidSec) vidSec.style.display = val === 'speler' ? '' : 'none';
    };

    // LocType-wissel (locaties)
    window._onLocTypeChange = (val) => {
      const sec = document.getElementById('voorraad-section');
      if (sec) sec.style.display = val === 'Winkel' ? '' : 'none';
      const wcSec = document.getElementById('winkelconfig-section');
      if (wcSec) wcSec.style.display = val === 'Winkel' ? '' : 'none';
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
          const [personages, locaties] = await Promise.all([
            api.listEntities('personages'),
            api.listEntities('locaties'),
          ]);
          const bronnen = [
            ...personages.filter(p => window._heeftRol(p, 'verkoper') && p.data?.voorraad && p.data.voorraad !== '[]'),
            ...locaties.filter(l => l.data?.locType === 'Winkel' && l.data?.voorraad && l.data.voorraad !== '[]'),
          ].filter(b => b.id !== (e?.id || null)); // eigen item niet aanbieden
          bronnen.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.dataset.type = window._heeftRol(b, 'verkoper') ? 'personages' : 'locaties';
            opt.textContent = b.name + (window._heeftRol(b, 'verkoper') ? ' (verkoper)' : ' (winkel)');
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
        _voorraadItems = bronItems.map(i => ({ naam: i.naam || '', prijs: i.prijs || '' }));
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
      const koopt = document.getElementById('wc-koopt')?.checked || false;
      document.getElementById('wc-koop-extra')?.classList.toggle('hidden', !koopt);
      const koopCategorieen = Array.from(document.querySelectorAll('.wc-koopcat:checked')).map(cb => cb.dataset.cat);
      const config = {
        roterend,
        aantalItems: parseInt(document.getElementById('wc-aantal')?.value) || 3,
        refreshUren: parseFloat(document.getElementById('wc-uren')?.value) || 24,
        deelGroep: (document.getElementById('wc-deelgroep')?.value || '').trim(),
        sfeerTekst: (document.getElementById('wc-sfeer')?.value || '').trim(),
        onderhandelDC: parseInt(document.getElementById('wc-onderhandel-dc')?.value) || 15,
        onderhandelKorting: parseInt(document.getElementById('wc-onderhandel-korting')?.value) || 10,
        onderhandelBoete: parseInt(document.getElementById('wc-onderhandel-boete')?.value) || 0,
        koopt,
        koopRatio: parseInt(document.getElementById('wc-koopratio')?.value) || 50,
        koopCategorieen,
      };
      const hidden = document.getElementById('winkelconfig-hidden');
      if (hidden) hidden.value = JSON.stringify(config);
    };

    window._refreshVoorraad();
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
    // Voorraad serialiseren voor verkopers & winkels
    if (tab === 'personages' || tab === 'locaties') {
      const validItems = _voorraadItems.filter(i => i.naam || i.prijs);
      data.voorraad = validItems.length > 0 ? JSON.stringify(validItems) : '';
    }
    // Lijstvelden (geheimen, flavours) serialiseren. Het oude enkelvoudige veld
    // houden we bij als eerste regel, want de Gock en oudere weergaven lezen dat.
    for (const veld of (SCHEMA[tab]?.fields || []).filter(f => f.type === 'lijst-tekst')) {
      const host = document.getElementById(`lijst-${veld.key}`);
      if (!host) continue;
      const regels = [...host.querySelectorAll('textarea')].map(t => t.value.trim()).filter(Boolean);
      data[veld.key] = regels.length ? JSON.stringify(regels) : '';
      data[veld.enkelvoud] = regels[0] || '';
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
