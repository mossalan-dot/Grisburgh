// ── Combat Canvas ──
// Renders the battle scene on a <canvas> element.
// Call init(canvasEl, combat) to start, update(combat) on each state change, stop() to halt.

// ── Conditie-iconen ──────────────────────────────────────────────────────────
// Alle conditions komen uit de gedeelde sprite (/img/icons.svg), monochroom en
// per conditie ingekleurd — op ~20px leest een gekleurd lijnicoon beter dan een
// geschilderd miniatuur, en het is één set met de rest van de UI.
//
// TERUGVALOPTIE: zet USE_SPRITE_COND_ICONS op false en de oude, geschilderde
// PNG-set (/img/conditions/*.png) wordt weer gebruikt. Die bestanden blijven
// bewust staan; alleen het preloaden slaat over zolang de sprite aan staat.
const USE_SPRITE_COND_ICONS = true;

// conditie-id → [sprite-icoon, kleur]. Klassespecifieke toestanden krijgen
// allemaal goud, zodat ze als groep te onderscheiden zijn van echte conditions.
const _CLASS_GOLD = '#d4aa3c';
const _SIT_STEEL  = '#7fa8c8';   // situationeel/positioneel
const COND_ICON = {
  blinded:       ['eye-off',       '#8a8a8a'],
  charmed:       ['heart',         '#d06ac0'],
  deafened:      ['ear-off',       '#8a8a8a'],
  exhaustion:    ['battery-low',  '#b08040'],
  frightened:    ['ghost',         '#9a86d0'],
  grappled:      ['grab',         '#b0763a'],
  incapacitated: ['ban',          '#7a90b0'],
  invisible:     ['circle-dashed', '#9ec8e0'],
  paralyzed:     ['zap',           '#e0c040'],
  petrified:     ['brick-wall',   '#9a9a90'],
  poisoned:      ['potion',        '#5aa84a'],
  prone:         ['arrow-down',    '#a08050'],
  restrained:    ['link',         '#9a6a3a'],
  stunned:       ['star',          '#e0b030'],
  unconscious:   ['bed',          '#c0c0b8'],
  concentration: ['sparkles',      '#7ab0e0'],
  bleeding:      ['droplet',       '#c02828'],
  burning:       ['flame',         '#e07020'],
  'bardic-inspiration': ['music',      _CLASS_GOLD],
  'tides-of-chaos':     ['refresh-cw', _CLASS_GOLD],
  'twilight-sanctuary': ['moon',       _CLASS_GOLD],
  'patient-defense':    ['shield',     _CLASS_GOLD],
  'steady-aim':         ['target',     _CLASS_GOLD],
  'vigilant-blessing':  ['eye',        _CLASS_GOLD],
  blessed:              ['sparkle',    _CLASS_GOLD],
  raging:               ['angry',      _CLASS_GOLD],
  haste:                ['fast-forward', _CLASS_GOLD],
  // Situationeel/positioneel: geen PHB-condition en geen klassefeature, maar wel
  // iets dat de worp verandert. Eigen tint zodat je de drie groepen uit elkaar houdt.
  dodging:                ['wind',          _SIT_STEEL],
  hidden:                 ['venetian-mask', _SIT_STEEL],
  readied:                ['hourglass',     _SIT_STEEL],
  'cover-half':           ['shield-half',   _SIT_STEEL],
  'cover-three-quarters': ['shield-plus',   _SIT_STEEL],
  grappling:              ['hand',          _SIT_STEEL],
  mounted:                ['rabbit',        _SIT_STEEL],
  underwater:             ['waves',         _SIT_STEEL],
};

// ── Sprite → canvas ──────────────────────────────────────────────────────────
// Een <use href="sprite#id"> is niet naar canvas te tekenen, dus halen we het
// <symbol> op, vervangen currentColor door een echte kleur (een losstaande SVG
// erft niets van de pagina) en bakken het als data-URL tot een <img>.
let _spriteDoc     = null;
let _spriteBezig   = false;
const _spriteCache = {};   // "icoon|kleur" → Image, of null zolang hij laadt

function _ensureSprite() {
  if (_spriteDoc || _spriteBezig) return;
  _spriteBezig = true;
  fetch('/img/icons.svg?v=7')
    .then(r => r.text())
    .then(txt => { _spriteDoc = new DOMParser().parseFromString(txt, 'image/svg+xml'); })
    .catch(() => { _spriteBezig = false; });
}

function _spriteIcon(id, col) {
  const key = `${id}|${col}`;
  if (key in _spriteCache) return _spriteCache[key];
  _ensureSprite();
  if (!_spriteDoc) return null;
  const sym = _spriteDoc.getElementById(`icon-${id}`);
  if (!sym) { _spriteCache[key] = null; return null; }
  const attrs = [...sym.attributes]
    .filter(a => a.name !== 'id')
    .map(a => `${a.name}="${a.value.replace(/currentColor/g, col)}"`)
    .join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${sym.innerHTML.replace(/currentColor/g, col)}</svg>`;
  const img = new Image();
  _spriteCache[key] = null;                       // sleutel claimen: niet dubbel laden
  img.onload = () => { _spriteCache[key] = img; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return null;
}

_ensureSprite();   // alvast ophalen: anders mist het eerste frame zijn iconen

// Avatar-fallback (geen portret): zelfde sprite, zodat canvas en de strip op het
// tafelscherm hetzelfde beeld tonen.
const _AVATAR_ICON_IDS = { player: 'user', ally: 'shield', summon: 'sparkles', monster: 'skull' };
const _AVATAR_ICON_COL = '#f2e8d2';   // warm perkament — leest op de donkere placeholder

// ── Geschilderde PNG-set (terugvaloptie) ─────────────────────────────────────
const _condImgs = {};
const _COND_IDS = [
  'blinded','charmed','concentration','deafened','exhaustion','frightened',
  'grappled','incapacitated','invisible','paralyzed','petrified','poisoned',
  'prone','restrained','stunned','unconscious','bleeding','burning',
];
if (!USE_SPRITE_COND_ICONS) {
  _COND_IDS.forEach(id => {
    const img = new Image();
    img.onload = () => { _condImgs[id] = img; };
    img.src = `/img/conditions/${id}.png`;
  });
}

// Laatste vangnet: een compact labeltje i.p.v. een emoji of een '?'. Emoji horen
// niet in de UI, en een '?' zei de speler niets.
const _COND_KORT = {
  'bardic-inspiration': 'Bardic', 'tides-of-chaos': 'Chaos',
  'twilight-sanctuary': 'Twilight', 'patient-defense': 'Defense',
  'steady-aim': 'Aim', 'vigilant-blessing': 'Vigilant', blessed: 'Bless',
};
function _drawCondLabel(ctx, condId, dx, dy, dSize) {
  const tekst = _COND_KORT[condId] || (condId.charAt(0).toUpperCase() + condId.slice(1, 8));
  ctx.save();
  ctx.font         = `${Math.max(8, dSize * 0.42)}px 'Cinzel', serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  const bw = ctx.measureText(tekst).width + dSize * 0.34;
  ctx.fillStyle = 'rgba(42,26,8,0.78)';
  ctx.beginPath();
  ctx.roundRect(dx, dy + dSize * 0.18, bw, dSize * 0.64, dSize * 0.16);
  ctx.fill();
  ctx.fillStyle = '#f2e8d2';
  ctx.fillText(tekst, dx + dSize * 0.17, dy + dSize * 0.5);
  ctx.restore();
}

function _drawCondIcon(ctx, condId, dx, dy, dSize) {
  if (USE_SPRITE_COND_ICONS) {
    const m = COND_ICON[condId];
    if (m) {
      const img = _spriteIcon(m[0], m[1]);
      // Nog aan het laden → dit frame overslaan; volgend frame staat hij er.
      if (img) ctx.drawImage(img, dx, dy, dSize, dSize);
      return;
    }
    _drawCondLabel(ctx, condId, dx, dy, dSize);
    return;
  }
  const img = _condImgs[condId];
  if (img) ctx.drawImage(img, dx, dy, dSize, dSize);
  else     _drawCondLabel(ctx, condId, dx, dy, dSize);
}

// Volgorde van meest naar minst ingrijpend — bepaalt welk visueel effect getoond wordt
const CONDITION_PRIORITY = [
  'unconscious', 'petrified', 'paralyzed', 'stunned', 'incapacitated',
  'poisoned', 'charmed', 'frightened', 'concentration', 'invisible',
];

const CONDITION_DESC = {
  blinded:       'Can\'t see. Automatically fails any check requiring sight. Attack rolls against have advantage; attacks made have disadvantage.',
  charmed:       'Can\'t attack the charmer. The charmer has advantage on social ability checks against this creature.',
  concentration: 'Maintaining a spell. Damaged creatures must succeed on a Constitution save (DC 10 or half damage) or lose concentration.',
  deafened:      'Can\'t hear. Automatically fails any check requiring hearing.',
  exhaustion:    'Exhausted. Multiple levels possible, each imposing increasing penalties to ability checks, speed, attacks, saves, and max HP.',
  frightened:    'Disadvantage on ability checks and attack rolls while the source is in sight. Can\'t willingly move closer to it.',
  grappled:      'Speed becomes 0. Ends if the grappler is incapacitated or the creature escapes.',
  incapacitated: 'Can\'t take actions or reactions.',
  invisible:     'Can\'t be seen without magic. Attacks against have disadvantage; attacks made have advantage.',
  paralyzed:     'Incapacitated, can\'t move or speak. Automatically fails Strength and Dexterity saves. Attacks have advantage; melee hits within 5 ft. are automatic critical hits.',
  petrified:     'Transformed into stone. Incapacitated, immune to poison and disease, resistant to all damage. Fails Strength and Dexterity saves.',
  poisoned:      'Disadvantage on attack rolls and ability checks.',
  prone:         'On the ground. Disadvantage on attack rolls. Attacks have advantage if attacker is within 5 ft., otherwise disadvantage.',
  restrained:    'Speed becomes 0. Attack rolls have disadvantage. Dexterity saving throws have disadvantage.',
  stunned:       'Incapacitated, can\'t move, can only speak falteringly. Automatically fails Strength and Dexterity saves. Attacks have advantage.',
  unconscious:   'Incapacitated, can\'t move or speak. Drops held items, falls prone. Automatically fails Str and Dex saves. Attacks have advantage; melee hits within 5 ft. are critical.',
  bleeding:      'Losing blood. Takes 1d4 damage at the start of each turn. Ends when healed or a DC 10 Medicine check is made.',
  burning:       'On fire. Takes 1d6 fire damage at the start of each turn. Can use an action to extinguish (drop and roll).',
};

function _getTopCondition(conds) {
  if (!conds || conds.length === 0) return null;
  for (const c of CONDITION_PRIORITY) {
    if (conds.includes(c)) return c;
  }
  return null; // overige conditions (blinded, prone, etc.) hebben geen visueel effect
}

let _canvas    = null;
let _ctx       = null;
let _combat    = null;
let _images    = {};      // fileId -> HTMLImageElement | null (null = loading/failed)
let _lastTouch = null;     // #28: laatste touch-coords voor tap → selecteer
let _animFrame = null;
let _t0        = 0;
let _hitAreas  = [];      // [{x, y, w, h, condId}] — herbouwd elke frame
let _hoverCond = null;    // condition-id van icoon waarover de muis zweeft
let _hoverX    = 0;
let _hoverY    = 0;
let _hitEvents = [];      // [{id, delta, t0}] — floating damage/heal nummers
let _positions = {};      // id -> {cx, cy, r} — gevuld tijdens drawCombatant, gebruikt voor floating numbers
let _announcement = null; // { t0, type:'round'|'turn', title, subtitle, color }
let _prevTurn  = -1;
let _prevRound = -1;
// Canvas-kleurthema: [r,g,b] per kant — worden gelezen uit combat.canvasColors
let _pc = [50, 90, 180];   // spelers
let _mc = [160, 40, 30];   // monsters
// Omgevingsthema voor particles
let _preset    = null;     // 'forest' | 'fire' | 'snow' | ... | null
let _particles = [];       // actieve particles
let _prevDrawT = -1;       // vorige frame-tijd (voor delta-time)
let _turnPulse = null;     // { ids:[id,...], t0, color:[r,g,b] } — puls bij beurtwissel

// Particle-config per thema: gedrag, max aantal per kant, grootte [min,max], snelheid [min,max], wob(ble)
const _PCFG = {
  forest:  { beh: 'fall',  n: 18, sz: [2,4],   sp: [18,36], wob: 0.28 },
  sea:     { beh: 'rise',  n: 16, sz: [2,4],   sp: [18,36], wob: 0.20 },
  cave:    { beh: 'fall',  n: 10, sz: [1,2.5], sp: [8,20],  wob: 0.15 },
  desert:  { beh: 'blow',  n: 20, sz: [1,2],   sp: [50,90], wob: 0.15 },
  snow:    { beh: 'fall',  n: 22, sz: [2,4],   sp: [12,26], wob: 0.22 },
  fire:    { beh: 'rise',  n: 24, sz: [2,4],   sp: [32,68], wob: 0.30 },
  crypt:   { beh: 'drift', n: 10, sz: [1,2.5], sp: [4,12],  wob: 1.0  },
  city:    { beh: 'drift', n:  6, sz: [1,2],   sp: [3,8],   wob: 1.0  },
  default: { beh: 'drift', n:  8, sz: [1,2.5], sp: [4,12],  wob: 1.0  },
};

// Haal het kale getal uit een AC-waarde. Statblocks schrijven 'm meestal als
// "15 (studded leather)" — 44 van de 54 monsters in de bibliotheek doen dat.
// Rauw tonen maakt de badge onleesbaar breed; een <input type="number"> laat
// zo'n string zelfs helemaal leeg.
export function acGetal(v) {
  if (v == null || v === '') return '';
  const m = String(v).match(/-?\d+/);
  return m ? m[0] : '';
}

// ── Public API ──────────────────────────────────────────────────────────────

export function init(canvasEl, combat) {
  _stop();
  _canvas = canvasEl;
  _ctx    = canvasEl.getContext('2d');
  _t0     = performance.now();
  _canvas.addEventListener('mousemove',  _onMouseMove);
  _canvas.addEventListener('mouseleave', _onMouseLeave);
  _canvas.addEventListener('touchstart', _onTouch, { passive: true });
  _canvas.addEventListener('touchend',   _onTouchEnd);   // #28: tap → selecteer combatant
  _canvas.addEventListener('click',      _onClick);
  _updateState(combat);
  _loop();
}

export function update(combat) {
  _updateState(combat);
}

export function stop() {
  _stop();
}

// ── Internal ─────────────────────────────────────────────────────────────────

function _stop() {
  if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
  if (_canvas) {
    _canvas.removeEventListener('mousemove',  _onMouseMove);
    _canvas.removeEventListener('mouseleave', _onMouseLeave);
    _canvas.removeEventListener('touchstart', _onTouch);
    _canvas.removeEventListener('touchend',   _onTouchEnd);
    _canvas.removeEventListener('click',      _onClick);
  }
  _images = {};   // #26: gedecodeerde afbeeldingen vrijgeven (anders monotone groei)
  _lastTouch = null;
}

function _updateState(combat) {
  // Detecteer HP-wijzigingen en registreer als hit-event
  if (_combat && combat) {
    (combat.combatants || []).forEach(c => {
      const prev = (_combat.combatants || []).find(p => p.id === c.id);
      if (prev) {
        const delta = (c.hp || 0) - (prev.hp || 0);
        if (delta !== 0) _hitEvents.push({ id: c.id, delta, t0: performance.now() });
      }
    });
  }
  // ── Detecteer beurt- en ronde-overgangen ──
  if (combat?.active && _prevRound >= 0) {
    const newRound = combat.round || 1;
    const newTurn  = combat.currentTurn ?? 0;
    if (newRound > _prevRound) {
      const cs    = combat.combatants || [];
      const cur   = cs[newTurn];
      const group = (cur?.type === 'monster') ? _getTurnGroup(cs, newTurn) : [newTurn];
      const names = group.map(i => cs[i]?.name).filter(Boolean);
      const turnSub = names.length ? _beurtTitel(names) + ' is aan de beurt' : 'BEGINT';
      _announcement = { t0: performance.now(), type: 'round',
        title: `RONDE ${newRound}`, subtitle: turnSub, color: null };
    } else if (newTurn !== _prevTurn) {
      const cs  = combat.combatants || [];
      const cur = cs[newTurn];
      // Monsters met dezelfde initiative gaan samen; anderen individueel
      const group = (cur?.type === 'monster') ? _getTurnGroup(cs, newTurn) : [newTurn];
      const names = group.map(i => cs[i]?.name).filter(Boolean);
      const ctype = cs[newTurn]?.type;
      const color = ctype === 'player' ? '#90b8ff'
                  : ctype === 'ally'   ? '#70d890'
                  : ctype === 'summon' ? '#c090f8'
                  :                     '#f07858';
      _announcement = { t0: performance.now(), type: 'turn',
        title: _beurtTitel(names), subtitle: 'is aan de beurt', color };
      // Puls-ring in themakleur rondom actieve combatant(en)
      const pulseColor = ctype === 'monster' ? _mc : _pc;
      const pulseIds   = group.map(i => cs[i]?.id).filter(Boolean);
      _turnPulse = { ids: pulseIds, t0: performance.now(), color: pulseColor };
    }
  }
  _prevRound = combat?.active ? (combat.round || 1) : -1;
  _prevTurn  = combat?.active ? (combat.currentTurn ?? 0) : -1;

  _combat = combat;
  if (!combat) return;
  // Laad canvas-kleuren en preset uit combat-object (ingesteld via encounter-preset)
  _pc     = combat.canvasColors?.player  || [50, 90, 180];
  _mc     = combat.canvasColors?.monster || [160, 40, 30];
  _preset = combat.canvasPreset || null;
  // Pre-load backdrop (first monster's backdropId)
  const backdrop = combat.combatants?.find(c => c.type === 'monster' && c.backdropId)?.backdropId;
  if (backdrop) _loadImage(backdrop);
  // Pre-load avatars
  (combat.combatants || []).forEach(c => {
    const id = c.imageId || c.entityId;
    if (id) _loadImage(id);
  });
}

function _loadImage(id) {
  if (id in _images) return;   // already loading or loaded
  _images[id] = null;          // mark as pending
  const img = new Image();
  img.onload  = () => { _images[id] = img; };
  img.onerror = () => { /* keep null = failed */ };
  img.src = `/api/files/${id}`;
}

function _loop() {
  _animFrame = requestAnimationFrame(() => {
    _draw();
    _loop();
  });
}

function _getTurnGroup(cs, currentTurn) {
  const cur = cs[currentTurn];
  if (!cur) return [currentTurn];
  if (cur.type === 'player') return [currentTurn];
  const init = cur.initiative;
  return cs.reduce((acc, c, i) => {
    if (c.type === 'monster' && c.initiative === init) acc.push(i);
    return acc;
  }, []);
}

function _draw() {
  if (!_canvas || !_ctx || !_combat) return;
  const dpr = window.devicePixelRatio || 1;
  const W = _canvas.offsetWidth;
  const H = _canvas.offsetHeight;
  if (W < 4 || H < 4) return;                  // hidden / not laid out yet
  if (_canvas.width !== Math.round(W * dpr) || _canvas.height !== Math.round(H * dpr)) {
    _canvas.width  = Math.round(W * dpr);
    _canvas.height = Math.round(H * dpr);
  }
  _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const ctx = _ctx;
  const t   = (performance.now() - _t0) / 1000;
  const now = performance.now();
  _hitAreas  = [];
  _positions = {};

  // ── Backdrop ──
  const backdropId  = _combat.combatants?.find(c => c.type === 'monster' && c.backdropId)?.backdropId;
  const backdropImg = backdropId ? _images[backdropId] : null;

  if (backdropImg) {
    const scale = Math.max(W / backdropImg.width, H / backdropImg.height);
    const sw = backdropImg.width  * scale;
    const sh = backdropImg.height * scale;
    ctx.drawImage(backdropImg, (W - sw) / 2, (H - sh) / 2, sw, sh);
  } else {
    // Perkamentkleur als standaard achtergrond
    ctx.fillStyle = '#f0e8d4';
    ctx.fillRect(0, 0, W, H);
  }

  // Vignette — alleen bij een backdrop-afbeelding
  if (backdropImg) {
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Split combatants ──
  const cs       = _combat.combatants || [];
  const players  = cs.filter(c => c.type === 'player' || c.type === 'ally' || c.type === 'summon');
  const monsters = cs.filter(c => c.type === 'monster' && (c.hp || 0) > 0);
  const group    = _getTurnGroup(cs, _combat.currentTurn ?? 0);

  if (cs.length === 0) {
    _drawEmptyHint(ctx, W, H);
    return;
  }

  const isWide = W >= 480;
  const hasBoth = players.length > 0 && monsters.length > 0;

  if (isWide) {
    // Zij aan zij: spelers links, monsters rechts
    if (hasBoth) {
      _drawSide(ctx, players,  cs, group, 0,     0, W / 2, H, t, true);
      _drawSide(ctx, monsters, cs, group, W / 2, 0, W / 2, H, t, true);
      _drawDivider(ctx, W / 2, 0, W / 2, H, 'vertical', t);
    } else if (monsters.length) {
      _drawSide(ctx, monsters, cs, group, 0, 0, W, H, t, true);
    } else {
      _drawSide(ctx, players,  cs, group, 0, 0, W, H, t, true);
    }
  } else {
    // Gestapeld: monsters boven, spelers onder
    if (hasBoth) {
      _drawSide(ctx, monsters, cs, group, 0, 0,     W, H / 2, t, false);
      _drawSide(ctx, players,  cs, group, 0, H / 2, W, H / 2, t, false);
      _drawDivider(ctx, 0, H / 2, W, H / 2, 'horizontal', t);
    } else {
      _drawSide(ctx, cs, cs, group, 0, 0, W, H, t, false);
    }
  }

  // ── Floating damage / heal nummers (buiten slot-clip) ──
  _hitEvents = _hitEvents.filter(e => now - e.t0 < 1600);
  for (const evt of _hitEvents) {
    const pos = _positions[evt.id];
    if (pos) _drawHitNumber(ctx, evt, pos.cx, pos.cy, pos.r, now);
  }

  // ── Ambient particles + turn pulse ──
  const dt = _prevDrawT < 0 ? 0 : Math.min(t - _prevDrawT, 0.1);
  _prevDrawT = t;
  _updateAndDrawParticles(ctx, W, H, t, dt, hasBoth, isWide);
  _drawTurnPulse(ctx);

  // ── Win / lose overlay ──
  if (_combat.winner) {
    _drawWinScreen(ctx, W, H, _combat.winner, t);
  }

  // ── Beurt / ronde aankondiging ──
  if (_announcement) _drawAnnouncement(ctx, W, H, now);

  // ── Condition tooltip (bovenop alles) ──
  if (_hoverCond) _drawCondTooltip(ctx, W, H, _hoverCond, _hoverX, _hoverY);
}

// ── Ambient particle system ───────────────────────────────────────────────────

function _spawnParticle(side, cfg, zx, zw, H) {
  const isSnow = _preset === 'snow';
  const [r, g, b] = isSnow ? [230, 245, 255]   // sneeuw altijd wit-blauw
                  : side === 'player' ? _pc : _mc;
  const sz      = cfg.sz[0] + Math.random() * (cfg.sz[1] - cfg.sz[0]);
  const sp      = cfg.sp[0] + Math.random() * (cfg.sp[1] - cfg.sp[0]);
  const maxLife = 4 + Math.random() * 5;
  let x, y, vx = 0, vy = 0, wobAmp = sp * cfg.wob;

  if (cfg.beh === 'rise') {
    x = zx + Math.random() * zw;
    y = H + sz;
    vy = -sp;
  } else if (cfg.beh === 'fall') {
    x = zx + Math.random() * zw;
    y = -sz;
    vy = sp;
  } else if (cfg.beh === 'blow') {
    x = zx - sz;
    y = Math.random() * H;
    vx = sp;
  } else { // drift
    x = zx + Math.random() * zw;
    y = Math.random() * H;
    const ang = Math.random() * Math.PI * 2;
    vx = Math.cos(ang) * sp;
    vy = Math.sin(ang) * sp;
    wobAmp = 0;
  }

  return { x, y, vx, vy,
    wobPhase: Math.random() * Math.PI * 2,
    wobFreq:  0.7 + Math.random() * 1.5,
    wobAmp,
    size: sz,
    alpha: 0,
    maxAlpha: _preset === 'fire' ? 0.55 + Math.random() * 0.2
                                 : 0.30 + Math.random() * 0.20,
    life: maxLife, maxLife,
    side, r, g, b, zx, zw,
  };
}

function _updateAndDrawParticles(ctx, W, H, t, dt, hasBoth, isWide) {
  if (!_combat?.active || dt <= 0) { if (!_combat?.active) _particles = []; return; }

  const cfg   = _PCFG[_preset] || _PCFG.default;
  const zones = {
    player:  isWide ? { zx: 0,     zw: W / 2 } : { zx: 0, zw: W },
    monster: isWide ? { zx: W / 2, zw: W / 2 } : { zx: 0, zw: W },
  };
  const sides = hasBoth ? ['player', 'monster'] : ['player'];

  // Spawn nieuwe particles tot maximum bereikt
  for (const side of sides) {
    const { zx, zw } = zones[side];
    const count = _particles.filter(p => p.side === side).length;
    if (count < cfg.n) _particles.push(_spawnParticle(side, cfg, zx, zw, H));
  }

  const surviving = [];
  for (const p of _particles) {
    // Positie bijwerken
    const wob = Math.sin(t * p.wobFreq + p.wobPhase) * p.wobAmp;
    if (cfg.beh === 'rise' || cfg.beh === 'fall') {
      p.x += wob * dt;
      p.y += p.vy * dt;
    } else if (cfg.beh === 'blow') {
      p.x += p.vx * dt;
      p.y += wob * dt;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    p.life -= dt;

    // Fade in (eerste 15%) en fade out (laatste 20%)
    const ageR  = 1 - p.life / p.maxLife;
    const lifeR = p.life / p.maxLife;
    p.alpha = p.maxAlpha * (
      ageR  < 0.15 ? ageR / 0.15 :
      lifeR < 0.20 ? lifeR / 0.20 : 1
    );

    // Verwijder als dood of buiten zone
    const { zx, zw } = zones[p.side] || { zx: 0, zw: W };
    if (p.life <= 0
      || (cfg.beh !== 'drift' && (p.y < -60 || p.y > H + 60 || p.x < zx - 60 || p.x > zx + zw + 60))) {
      continue;
    }
    surviving.push(p);

    // Teken particle
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

    if (_preset === 'sea') {
      // Zeebel: transparant met outline
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},0.9)`;
      ctx.lineWidth   = 0.8;
      ctx.stroke();
      ctx.fillStyle   = `rgba(255,255,255,0.12)`;
      ctx.fill();
    } else if (_preset === 'fire') {
      // Vonk: gloed + kern
      ctx.shadowColor = `rgba(${p.r},${p.g},${p.b},0.7)`;
      ctx.shadowBlur  = p.size * 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
      ctx.fillStyle   = `rgba(255,${Math.round(p.g * 1.4)},${p.b},1)`;
      ctx.fill();
    } else {
      // Standaard gevulde cirkel
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      ctx.fill();
    }
    ctx.restore();
  }
  _particles = surviving;
}

// ── Puls-ring bij beurtwissel ─────────────────────────────────────────────────

function _drawTurnPulse(ctx) {
  if (!_turnPulse) return;
  const elapsed = (performance.now() - _turnPulse.t0) / 1000;
  const DUR = 1.1;
  if (elapsed >= DUR) { _turnPulse = null; return; }

  const prog  = elapsed / DUR;
  const ease  = 1 - Math.pow(1 - prog, 2);   // ease-out
  const alpha = 0.75 * (1 - prog);
  const [r, g, b] = _turnPulse.color;

  ctx.save();
  for (const id of _turnPulse.ids) {
    const pos = _positions[id];
    if (!pos) continue;

    // Buitenste ring — groeit snel weg
    const ringR = pos.r + pos.r * 2.8 * ease;
    ctx.beginPath();
    ctx.arc(pos.cx, pos.cy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth   = 2.5 - prog * 1.5;
    ctx.stroke();

    // Tweede ring — licht vertraagd
    if (prog < 0.75) {
      const prog2  = Math.max(0, prog - 0.12);
      const ease2  = 1 - Math.pow(1 - prog2 / 0.75, 2);
      const ringR2 = pos.r + pos.r * 2.8 * ease2;
      ctx.beginPath();
      ctx.arc(pos.cx, pos.cy, ringR2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.45})`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Beurt / ronde aankondiging ────────────────────────────────────────────────

// Titel voor de beurt-aankondiging. Monsters met gelijke initiative gaan samen
// aan de beurt — handig tijdens het spelen, maar "A & B & C & D" liep dwars uit
// beeld. Genummerde varianten worden samengevat: "3 × Wervelingpiraat".
function _beurtTitel(namen) {
  if (namen.length <= 2) return namen.join(' & ');
  const tel = new Map();
  for (const n of namen) {
    const basis = String(n).replace(/\s+\d+$/, '').trim() || String(n);
    tel.set(basis, (tel.get(basis) || 0) + 1);
  }
  const delen = [...tel].map(([basis, aantal]) => (aantal > 1 ? `${aantal} × ${basis}` : basis));
  if (delen.length <= 2) return delen.join(' & ');
  return `${delen.slice(0, 2).join(' & ')} +${delen.length - 2}`;
}

// Krimp de tekst tot hij binnen maxW past; pas als dat niet lukt, afkappen.
function _pasTekst(ctx, tekst, maxW, startSz, minSz, vet) {
  let sz = startSz;
  const zet = () => { ctx.font = `${vet ? 'bold ' : ''}${sz}px 'Cinzel', serif`; };
  zet();
  while (ctx.measureText(tekst).width > maxW && sz > minSz) { sz -= 1; zet(); }
  let t = tekst;
  while (ctx.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -1);
  if (t !== tekst) t = t.replace(/\s+$/, '') + '…';
  return t;
}

function _drawAnnouncement(ctx, W, H, nowMs) {
  if (!_announcement) return;
  const elapsed = (nowMs - _announcement.t0) / 1000;
  const TOTAL = 3.0, FADE_IN = 0.35, FADE_OUT_START = 2.4;

  if (elapsed >= TOTAL) { _announcement = null; return; }

  const alpha = elapsed < FADE_IN
    ? elapsed / FADE_IN
    : elapsed > FADE_OUT_START
      ? 1 - (elapsed - FADE_OUT_START) / (TOTAL - FADE_OUT_START)
      : 1;

  // Cubic ease-out voor slide-animatie
  const slideP = Math.min(1, elapsed / FADE_IN);
  const eased  = 1 - Math.pow(1 - slideP, 3);

  const { type, title, subtitle, color } = _announcement;
  const isRound = type === 'round';

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  if (isRound) {
    // ── Ronde-aankondiging: horizontale baan over het midden ──
    const bh = Math.min(H * 0.20, 100);
    const by = H / 2 - bh / 2;
    const offsetX = (1 - eased) * -W;
    ctx.translate(offsetX, 0);

    // Achtergrond — verloopt aan de zijkanten naar transparant
    const bg = ctx.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0,    'rgba(0,0,0,0)');
    bg.addColorStop(0.08, 'rgba(8,6,18,0.94)');
    bg.addColorStop(0.92, 'rgba(8,6,18,0.94)');
    bg.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, by, W, bh);

    // Gouden decoratielijnen boven en onder
    const lineInset = W * 0.06;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    [[by + 2, '#c8940a'], [by + bh - 2, '#c8940a']].forEach(([ly, col]) => {
      const lg = ctx.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0,    'rgba(0,0,0,0)');
      lg.addColorStop(0.08, col);
      lg.addColorStop(0.92, col);
      lg.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.strokeStyle = lg;
      ctx.shadowColor = col;
      ctx.beginPath();
      ctx.moveTo(lineInset, ly);
      ctx.lineTo(W - lineInset, ly);
      ctx.stroke();
    });

    // Diamant-ornament in het midden van de lijnen
    const drawDiamond = (dx, dy, size, col) => {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    };
    [by + 2, by + bh - 2].forEach(ly => {
      [-28, 0, 28].forEach((offset, i) => {
        drawDiamond(W / 2 + offset, ly, i === 1 ? 5 : 3.5, '#f0b800');
      });
    });

    // Hoofdtitel "RONDE X"
    const titleSz = Math.min(bh * 0.50, 46);
    ctx.font         = `bold ${titleSz}px 'Cinzel', serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = '#f0c030';
    ctx.shadowBlur   = 22;
    ctx.fillStyle    = '#f5cc40';
    ctx.fillText(title, W / 2, by + bh * 0.40);

    // Subtitel "BEGINT"
    if (subtitle) {
      const subSz = Math.min(bh * 0.24, 20);
      ctx.font         = `${subSz}px 'Cinzel', serif`;
      ctx.shadowBlur   = 8;
      ctx.shadowColor  = 'rgba(220,180,60,0.6)';
      ctx.fillStyle    = 'rgba(215,190,130,0.90)';
      // Letterspatiëring simuleren
      const letters = subtitle.split('');
      const spacing = subSz * 0.22;
      const total   = ctx.measureText(subtitle).width + spacing * (letters.length - 1);
      let lx = W / 2 - total / 2;
      for (const ch of letters) {
        ctx.fillText(ch, lx + ctx.measureText(ch).width / 2, by + bh * 0.73);
        lx += ctx.measureText(ch).width + spacing;
      }
    }

  } else {
    // ── Beurt-aankondiging: banner onderin ──
    const bh     = Math.min(H * 0.16, 78);
    const by     = H - bh - H * 0.04;
    const typeColor = color || '#f0c840';
    const offsetY   = (1 - eased) * (bh + H * 0.04);
    ctx.translate(0, offsetY);

    // Achtergrond
    const bg = ctx.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0,    'rgba(0,0,0,0)');
    bg.addColorStop(0.06, 'rgba(6,6,16,0.92)');
    bg.addColorStop(0.94, 'rgba(6,6,16,0.92)');
    bg.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, by, W, bh);

    // Gekleurde accentlijn bovenaan (kleur op type)
    const ag = ctx.createLinearGradient(0, 0, W, 0);
    ag.addColorStop(0,    'rgba(0,0,0,0)');
    ag.addColorStop(0.06, typeColor);
    ag.addColorStop(0.94, typeColor);
    ag.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.strokeStyle = ag;
    ctx.lineWidth   = 2;
    ctx.shadowColor = typeColor;
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.moveTo(W * 0.06, by + 1);
    ctx.lineTo(W * 0.94, by + 1);
    ctx.stroke();

    // Naam — krimpt mee zodat een gedeelde beurt niet uit beeld loopt.
    const titleSz = Math.min(bh * 0.46, 34);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const titelTekst = _pasTekst(ctx, title, W * 0.88, titleSz, 15, true);
    ctx.shadowColor  = typeColor;
    ctx.shadowBlur   = 18;
    ctx.fillStyle    = typeColor;
    ctx.fillText(titelTekst, W / 2, by + bh * 0.37);

    // "is aan de beurt"
    if (subtitle) {
      const subSz = Math.min(bh * 0.27, 17);
      const subTekst = _pasTekst(ctx, subtitle, W * 0.88, subSz, 11, false);
      ctx.shadowBlur = 6;
      ctx.fillStyle  = 'rgba(210,200,185,0.85)';
      ctx.fillText(subTekst, W / 2, by + bh * 0.72);
    }
  }

  ctx.restore();
}

// ── Floating damage / heal getal ─────────────────────────────────────────────

function _drawHitNumber(ctx, evt, cx, cy, r, now) {
  const elapsed = (now - evt.t0) / 1000;
  if (elapsed > 1.6) return;
  const isHeal  = evt.delta > 0;
  const alpha   = elapsed < 0.85 ? 1 : Math.max(0, (1.6 - elapsed) / 0.75);
  const rise    = elapsed * 48;
  const numY    = cy - r - 10 - rise;
  const sz      = Math.max(13, r * 0.42);
  const label   = (isHeal ? '+' : '') + evt.delta;

  ctx.save();
  ctx.globalAlpha    = alpha;
  ctx.font           = `bold ${sz}px 'Cinzel', serif`;
  ctx.textAlign      = 'center';
  ctx.textBaseline   = 'middle';
  // Schaduw voor leesbaarheid
  ctx.shadowColor    = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur     = 5;
  ctx.fillStyle      = isHeal ? '#70f070' : '#ff5030';
  ctx.fillText(label, cx, numY);
  // Subtiele witte kern
  ctx.shadowBlur     = 0;
  ctx.fillStyle      = isHeal ? 'rgba(200,255,200,0.55)' : 'rgba(255,200,180,0.45)';
  ctx.font           = `bold ${sz * 0.82}px 'Cinzel', serif`;
  ctx.fillText(label, cx, numY);
  ctx.restore();
}

// ── Scheidslijn tussen monsters en spelers ────────────────────────────────────

function _drawDivider(ctx, x, y, w, h, dir, t) {
  ctx.save();
  const pulse = 0.30 + Math.sin(t * 1.4) * 0.12;
  const [mr, mg, mb] = _mc;
  const [pr, pg, pb] = _pc;
  if (dir === 'horizontal') {
    // Monsters links (horizontale layout = smal scherm, monsters boven → divider horizontal)
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0,   `rgba(${mr}, ${mg}, ${mb}, ${pulse})`);
    grad.addColorStop(0.5, `rgba(220, 180,  80, ${pulse + 0.15})`);
    grad.addColorStop(1,   `rgba(${pr}, ${pg}, ${pb}, ${pulse})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -t * 18;
    ctx.beginPath();
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + w - 12, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth   = 3;
    ctx.strokeStyle = `rgba(220,180,80,${pulse * 0.25})`;
    ctx.beginPath();
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + w - 12, y);
    ctx.stroke();
  } else {
    // Verticale lijn (breed scherm): monsters rechts, spelers links
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0,   `rgba(${mr}, ${mg}, ${mb}, ${pulse})`);
    grad.addColorStop(0.5, `rgba(220, 180,  80, ${pulse + 0.15})`);
    grad.addColorStop(1,   `rgba(${pr}, ${pg}, ${pb}, ${pulse})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -t * 18;
    ctx.beginPath();
    ctx.moveTo(x, y + 12);
    ctx.lineTo(x, y + h - 12);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth   = 3;
    ctx.strokeStyle = `rgba(220,180,80,${pulse * 0.25})`;
    ctx.beginPath();
    ctx.moveTo(x, y + 12);
    ctx.lineTo(x, y + h - 12);
    ctx.stroke();
  }
  ctx.restore();
}

function _drawEmptyHint(ctx, W, H) {
  ctx.fillStyle = 'rgba(240,200,120,0.5)';
  ctx.font = '13px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Geen deelnemers', W / 2, H / 2);
}

function _drawSide(ctx, group, allCs, turnGroup, x, y, w, h, t, isWide) {
  // Gekleurde zijachtergrond — kleur via canvas-preset, opacities zijn vast
  // zodat tekst en HP-bars altijd leesbaar blijven.
  const isMonsterSide = group.every(c => c.type === 'monster');
  const [r, g, b] = isMonsterSide ? _mc : _pc;
  // Gradient van buitenrand (sterkste kleur) naar midden (nagenoeg transparant)
  const grad = isMonsterSide
    ? ctx.createLinearGradient(x + w, y, x, y)   // monster: rechts → links
    : ctx.createLinearGradient(x, y, x + w, y);  // speler:  links → rechts
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.50)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.10)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const n = group.length;
  // Vanaf vier op een zijde wordt één rij te smal: de figuren krimpen en de
  // badges vallen buiten hun slot. We verdelen ze dan over meerdere rijen en
  // gebruiken zo de hoogte die er toch al was.
  const MAX_PER_RIJ = 4;
  const rijen  = Math.max(1, Math.ceil(n / MAX_PER_RIJ));
  const perRij = Math.ceil(n / rijen);
  const rijH   = h / rijen;

  // Slotbreedte volgt de vólste rij, niet de rij zelf. Anders kreeg een
  // half-gevulde laatste rij bredere slots en dus grotere figuren — een
  // formaatverschil dat niets betekende. Grootte draait nu alleen op dreiging.
  const GAP   = perRij > 1 ? Math.min(8, w * 0.02) : 0;
  const slotW = (w - GAP * (perRij - 1)) / perRij;

  // Monsters worden op dreiging gerangschikt: meeste HP eerst, bij gelijke HP
  // de hoogste AC. De zwaarste wordt ook het grootst getekend, zodat je in één
  // oogopslag ziet waar het gevaar zit. Spelers houden bewust één maat — daar
  // is geen hiërarchie.
  const alleenMonsters = group.length > 0 && group.every(c => c.type === 'monster');
  const getoond = alleenMonsters
    ? [...group].sort((a, b) =>
        (b.maxHp || 0) - (a.maxHp || 0) ||
        (parseInt(b.ac) || 0) - (parseInt(a.ac) || 0))
    : group;
  // Schaal per dréigingsniveau, niet per positie: twee identieke piraten horen
  // even groot te zijn. Elk uniek (HP, AC)-paar is één niveau; van 1.0 voor het
  // zwaarste tot 0.82 voor het lichtste.
  const niveaus = alleenMonsters
    ? [...new Set(getoond.map(c => `${c.maxHp || 0}|${parseInt(c.ac) || 0}`))]
    : [];
  const rangVan = (c) => {
    if (!alleenMonsters || niveaus.length < 2) return null;      // geen hiërarchie
    const i = niveaus.indexOf(`${c.maxHp || 0}|${parseInt(c.ac) || 0}`);
    return 1 - i / (niveaus.length - 1);                          // 1 = zwaarste
  };
  const schaalVoor = (c) => {
    const d = rangVan(c);
    return d === null ? 1 : 0.82 + d * 0.18;
  };

  for (let r = 0; r < rijen; r++) {
    const rijGroep = getoond.slice(r * perRij, (r + 1) * perRij);
    if (!rijGroep.length) continue;
    const m = rijGroep.length;
    // Niet-volle rij centreren onder de rijen erboven.
    const rijBreedte = m * slotW + (m - 1) * GAP;
    const rijX = x + (w - rijBreedte) / 2;
    const rijY = y + r * rijH;

    rijGroep.forEach((c, i) => {
      const idx      = allCs.indexOf(c);
      const isActive = turnGroup.includes(idx);
      const slotX    = rijX + i * (slotW + GAP);
      const schaal   = schaalVoor(c);
      const dreiging = rangVan(c);
      // Clip per slot: alleen horizontaal (zodat effects niet in de buurman
      // bloeden), maar niet verticaal — iconen onder de HP-balk moeten
      // zichtbaar blijven.
      ctx.save();
      ctx.beginPath();
      ctx.rect(slotX, 0, slotW, ctx.canvas.height);
      ctx.clip();
      _drawCombatant(ctx, c, slotX, rijY, slotW, rijH, t, isActive, isWide, idx + 1, schaal, dreiging);
      ctx.restore();
    });
  }
}

// Avatar-pad: cirkel voor spelers/monsters, afgerond vierkant voor medestanders
function _avatarPath(ctx, c, cx, cy, r) {
  if (c.type === 'ally') {
    const rr = r * 0.18;
    ctx.roundRect(cx - r, cy - r, r * 2, r * 2, rr);
  } else {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

function _drawCombatant(ctx, c, x, y, w, h, t, isActive, isWide, turnIndex, schaal = 1, dreiging = null) {
  const isDead  = (c.hp || 0) <= 0;
  const conds   = isDead ? [] : (c.conditions || []);
  const hasCond = (name) => conds.includes(name);
  const topCond = _getTopCondition(conds);

  // Bounce: stil bij unconscious/petrified/incapacitated/stunned; langzaam bij exhaustion; beperkt bij restrained
  const isStill   = hasCond('unconscious') || hasCond('petrified') || hasCond('incapacitated') || hasCond('stunned');
  const isSlow    = hasCond('exhaustion');
  const isReduced = hasCond('restrained');
  const bounce    = isActive && !isStill
    ? Math.sin(t * (isSlow ? 0.9 : 3.5)) * (isReduced || isSlow ? 2 : 5)
    : 0;

  // Circle avatar sizing.
  // De figuren stonden altijd in één rij tegen de bovenkant geplakt (h * 0.12),
  // waardoor op een hoog canvas — zoals het tafelscherm — de onderste helft leeg
  // bleef. Nu groeit de avatar mee met de beschikbare hoogte én wordt het blok
  // (avatar + HP-balk + conditie-iconen + naam) verticaal gecentreerd.
  const AVTR_R = Math.min(w * 0.38, h * 0.30) * schaal;
  const cx     = x + w / 2;
  // Alles onder de cirkel hangt aan cyGround + AVTR_R; ~62px dekt balk, iconen en naam.
  const blockH = AVTR_R * 2 + 62;
  const topY   = y + Math.max(h * 0.06, (h - blockH) / 2);
  const cyGround = topY + AVTR_R + bounce;
  // Flying: alleen de avatar gaat omhoog, mét grondschaduw eronder. HP-balk,
  // iconen en naam blijven staan — die horen bij het slot, niet bij de hoogte.
  // De trage eigen dobber (los van de beurt-bounce) maakt het zweven leesbaar.
  const isFlying = !isDead && hasCond('flying');
  const lift     = isFlying ? AVTR_R * 0.55 + Math.sin(t * 1.2) * (AVTR_R * 0.06) : 0;
  const cy       = cyGround - lift;

  // ── Grondschaduw bij vliegen (vóór de avatar, dus erachter) ──
  if (isFlying) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle   = '#000000';
    ctx.beginPath();
    ctx.ellipse(cx, cyGround + AVTR_R * 0.72, AVTR_R * 0.60, AVTR_R * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Effects behind / around avatar ──
  if (topCond) _fxBehind(ctx, topCond, cx, cy, AVTR_R, t);

  // ── Avatar image ──
  const imgId       = c.imageId || c.entityId;
  const img         = imgId ? _images[imgId] : null;
  const isInvisible = topCond === 'invisible';
  const isProne     = hasCond('prone');
  const isGrappled  = hasCond('grappled');
  const isDeafened  = hasCond('deafened');
  const grappleSq   = isGrappled ? 0.72 + Math.sin(t * 2.5) * 0.14 : 1;

  ctx.save();
  if (isInvisible) ctx.globalAlpha = 0.25 + Math.abs(Math.sin(t * 1.4)) * 0.35;
  if (isDeafened)  ctx.filter = 'blur(2.5px)';
  // prone: roteer 90°; grappled: pers horizontaal samen (clip wordt ook ellips)
  ctx.translate(cx, cy);
  if (isProne)    ctx.rotate(Math.PI / 2);
  if (isGrappled) ctx.scale(grappleSq, 1);
  ctx.translate(-cx, -cy);
  ctx.beginPath();
  _avatarPath(ctx, c, cx, cy, AVTR_R);
  ctx.clip();

  if (img) {
    const diam  = AVTR_R * 2;
    const scale = Math.max(diam / img.width, diam / img.height);
    const sw = img.width  * scale;
    const sh = img.height * scale;
    ctx.drawImage(img, cx - sw / 2, cy - sh / 2, sw, sh);
  } else {
    // Coloured placeholder
    const g = ctx.createRadialGradient(cx, cy - AVTR_R * 0.2, 0, cx, cy, AVTR_R * 1.1);
    g.addColorStop(0, c.type === 'player' ? '#6080b8' : c.type === 'ally' ? '#5a9a6a' : c.type === 'summon' ? '#9060c8' : '#8a4830');
    g.addColorStop(1, c.type === 'player' ? '#2a3a60' : c.type === 'ally' ? '#1e4a30' : c.type === 'summon' ? '#4a1880' : '#4a2010');
    ctx.fillStyle = g;
    ctx.fillRect(cx - AVTR_R, cy - AVTR_R, AVTR_R * 2, AVTR_R * 2);
    const ic = _spriteIcon(_AVATAR_ICON_IDS[c.type] || _AVATAR_ICON_IDS.monster, _AVATAR_ICON_COL);
    if (ic) {
      const s = AVTR_R * 1.0;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(ic, cx - s / 2, cy - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  // ── Rand: cirkel voor spelers/monsters, vierkant voor medestanders ──
  if (!isDead) {
    ctx.save();
    ctx.beginPath();
    _avatarPath(ctx, c, cx, cy, AVTR_R);
    ctx.strokeStyle = c.type === 'player'  ? 'rgba(100,150,255,0.75)'
      : c.type === 'ally'   ? 'rgba(60,180,110,0.80)'
      : c.type === 'summon' ? 'rgba(180,110,255,0.80)'
      : 'rgba(210,70,45,0.75)';
    // Zwaardere dreiging = dikkere rand en een diepere slagschaduw, zodat de
    // figuur letterlijk zwaarder op het doek ligt. Geen gloed of aura: goud en
    // pulseren betekenen al "aan de beurt", en _fxBehind tekent achter de
    // figuur de conditie-effecten.
    ctx.lineWidth = 2.5 + (dreiging ?? 0) * 1.8;
    if (dreiging !== null && dreiging > 0) {
      ctx.shadowColor   = `rgba(20, 8, 4, ${0.30 + dreiging * 0.35})`;
      ctx.shadowBlur    = 6 + dreiging * 12;
      ctx.shadowOffsetY = 2 + dreiging * 5;
    }
    ctx.stroke();
    ctx.restore();
  }

  // ── Sla positie op voor floating numbers (getekend na alle slots) ──
  _positions[c.id] = { cx, cy, r: AVTR_R };

  // ── Hit/heal flash op de avatar ──
  const nowMs  = performance.now();
  const flash  = _hitEvents.find(e => e.id === c.id && nowMs - e.t0 < 380);
  if (flash) {
    const pct   = (nowMs - flash.t0) / 380;
    const alpha = (1 - pct) * 0.52;
    ctx.save();
    ctx.beginPath();
    _avatarPath(ctx, c, cx, cy, AVTR_R);
    ctx.fillStyle = flash.delta > 0
      ? `rgba(80,230,80,${alpha})`
      : `rgba(255,40,20,${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  // ── Petrified overlay (on top of avatar) ──
  if (topCond === 'petrified') _fxPetrified(ctx, cx, cy, AVTR_R);

  // ── Extra condition overlays ──
  if (hasCond('blinded'))    _fxBlinded(ctx, cx, cy, AVTR_R, t);
  if (hasCond('restrained')) _fxRestrained(ctx, cx, cy, AVTR_R, t);

  // ── Active ring ──
  if (isActive) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, AVTR_R + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth   = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  // ── Floating particle effects ──
  if (topCond) _fxParticles(ctx, topCond, cx, cy, AVTR_R, t);

  // ── Initiative badge (top-left of avatar) ──
  if (turnIndex !== undefined) {
    const badgeR  = Math.max(8, Math.min(12, AVTR_R * 0.38));
    const badgeX  = cx - AVTR_R * 0.72;
    const badgeY  = cy - AVTR_R * 0.72;
    ctx.save();
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? '#c4930a' : 'rgba(30,16,8,0.72)';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 4;
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.font         = `bold ${Math.round(badgeR * 1.1)}px 'Cinzel', serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ffffff';
    ctx.fillText(String(turnIndex), badgeX, badgeY + 0.5);
    ctx.restore();
  }

  // ── Bestudeerd-badge (top-right): zichtbaar voor spelers bij deels/volledig kennis ──
  if (c.type === 'monster' && c._niveau && c._niveau !== 'naam' && !window.app?.isDM?.()) {
    const bR = Math.max(7, Math.min(10, AVTR_R * 0.32));
    const bX = cx + AVTR_R * 0.72;
    const bY = cy - AVTR_R * 0.72;
    ctx.save();
    ctx.beginPath();
    ctx.arc(bX, bY, bR, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(80,160,220,0.88)';
    ctx.shadowColor = 'rgba(40,120,200,0.7)';
    ctx.shadowBlur  = 5;
    ctx.fill();
    ctx.shadowBlur  = 0;
    // Oog-symbool als kleine lijn
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.ellipse(bX, bY, bR * 0.55, bR * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bX, bY, bR * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  // ── Metriek van het onderblok (balk, iconen, naam) ────────────────────────
  // Vooraf berekend, want de leesplaat eronder moet weten hoe hoog en breed het
  // blok wordt voordat er iets getekend is.
  const barW = Math.min(w * 0.72, AVTR_R * 2.2);
  const barH = 5;
  const barX = cx - barW / 2;
  const barY = cyGround + AVTR_R + 8;

  const isDMView = window.app?.isDM?.();
  const isDying  = isDead && c.type === 'player';
  // Conditie-iconen mogen de leesplaat niet uitlopen. Eerst comprimeren: ze
  // krimpen mee tot ze passen. Pas als ze onder de leesbaarheidsgrens zouden
  // zakken, tonen we er minder en telt "+n" de rest. Volgorde op
  // CONDITION_PRIORITY, zodat de zwaarste toestanden overblijven.
  const _condsRuw = isDead ? [] : (c.conditions || []).filter(id => id !== 'flying');
  const _condsGesorteerd = [..._condsRuw].sort((a, b) => {
    const ia = CONDITION_PRIORITY.indexOf(a), ib = CONDITION_PRIORITY.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const COND_GAP = 3;
  const COND_MIN = 13;                       // kleiner wordt het onleesbaar
  const condBasis = isWide
    ? Math.max(18, Math.min(26, AVTR_R * 0.72))
    : Math.max(16, Math.min(22, h * 0.11));
  let condSz    = condBasis;
  let allConds  = _condsGesorteerd;
  let condsMeer = 0;
  if (isWide && _condsGesorteerd.length > 1) {
    const ruimte = Math.max(40, w - 14);     // slotbreedte minus wat marge
    const nAll   = _condsGesorteerd.length;
    const past   = (n, sz) => n * (sz + COND_GAP) - COND_GAP <= ruimte;
    if (!past(nAll, condSz)) {
      // Krimpen tot het past …
      condSz = Math.max(COND_MIN, (ruimte - COND_GAP * (nAll - 1)) / nAll);
      if (!past(nAll, condSz)) {
        // … en als zelfs de minimummaat niet past: afkappen met een teller.
        let n = nAll;
        while (n > 1 && !past(n + 1, COND_MIN)) n--;   // +1 = ruimte voor "+n"
        condSz    = COND_MIN;
        allConds  = _condsGesorteerd.slice(0, n);
        condsMeer = nAll - n;
      }
    }
  }

  const fontSize = Math.max(9, Math.min(13, w * 0.1));
  let nameY = barY + barH + (isDMView || isDying ? 14 : 7);
  if (isWide && allConds.length > 0) nameY = barY + barH + 14 + condSz + 4;

  ctx.save();
  ctx.font = `bold ${fontSize}px 'Cinzel', serif`;
  const fullName = c.type === 'player' ? c.name.split(' ')[0] : c.name;
  let label = fullName;
  while (ctx.measureText(label).width > w - 6 && label.length > 3) label = label.slice(0, -1);
  if (label !== fullName) label += '…';
  const nameW = ctx.measureText(label).width;
  ctx.restore();

  // ── Leesplaat ─────────────────────────────────────────────────────────────
  // Balk, iconen en naam vielen weg tegen een backdrop-afbeelding. Eén
  // halftransparante plaat eronder houdt ze leesbaar zonder de sfeer te slopen;
  // hij groeit mee met wat er daadwerkelijk onder de figuur staat.
  {
    const iconsW = (isWide && allConds.length)
      ? allConds.length * (condSz + 3) - 3 + (condsMeer ? condSz * 0.9 : 0)
      : 0;
    const plateW = Math.min(w - 4, Math.max(barW, nameW, iconsW) + 16);
    const plateY = barY - 7;
    const plateH = (nameY + fontSize + 6) - plateY;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - plateW / 2, plateY, plateW, plateH, 7);
    ctx.fillStyle = 'rgba(26, 16, 6, 0.46)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 230, 205, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  _drawHpBar(ctx, c, barX, barY, barW, barH);

  // ── Death saving throws (dying players) ──
  if (isDying) {
    const ds = c.deathSaves || { successes: 0, failures: 0 };
    _drawDeathSaveDots(ctx, cx, barY + barH + 2, ds);
  }

  // ── Condition icons ──
  if (allConds.length > 0) {
    ctx.save();
    if (isWide) {
      // Horizontaal onder de HP-balk, gecentreerd onder de figuur
      const gap    = COND_GAP;
      const rowW   = allConds.length * (condSz + gap) - gap + (condsMeer ? condSz * 0.9 : 0);
      let   iconX  = cx - rowW / 2;
      const iconY  = barY + barH + 14;
      allConds.forEach(id => {
        _drawCondIcon(ctx, id, iconX, iconY, condSz);
        _hitAreas.push({ x: iconX, y: iconY, w: condSz, h: condSz, condId: id });
        iconX += condSz + gap;
      });
      if (condsMeer) {
        ctx.save();
        ctx.font         = `bold ${Math.max(9, condSz * 0.5)}px 'Cinzel', serif`;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = 'rgba(242,232,210,0.75)';
        ctx.fillText(`+${condsMeer}`, iconX, iconY + condSz / 2);
        ctx.restore();
      }
    } else {
      // Verticaal aan de linkerzijde, gecentreerd in het slot
      const lineH  = condSz + 3;
      const stackH = allConds.length * lineH - 3;
      const iconX  = x + 3;
      let   iconY  = y + h / 2 - stackH / 2;
      allConds.forEach(id => {
        _drawCondIcon(ctx, id, iconX, iconY, condSz);
        _hitAreas.push({ x: iconX, y: iconY, w: condSz, h: condSz, condId: id });
        iconY += lineH;
      });
      if (condsMeer) {
        ctx.save();
        ctx.font         = `bold ${Math.max(9, condSz * 0.5)}px 'Cinzel', serif`;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle    = 'rgba(242,232,210,0.75)';
        ctx.fillText(`+${condsMeer}`, iconX, iconY);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ── Naam ──
  // Lichte letter op de plaat; goud als het deze combatant zijn beurt is.
  ctx.save();
  ctx.font         = `bold ${fontSize}px 'Cinzel', serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor  = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur   = 3;
  ctx.fillStyle    = isActive ? '#f0c040' : '#f2e8d2';
  ctx.fillText(label, cx, nameY);
  ctx.restore();

  // ── AC-badge (alleen DM) ──────────────────────────────────────────────────
  // AC stond al op de combatant maar werd nergens in het gevecht getoond, dus
  // zat de DM steeds te zoeken. Spelers krijgen 'm bewust niet te zien.
  if (isDMView) {
    const acVal = acGetal(c.ac);
    if (acVal) {
      const fs   = Math.max(9, Math.min(13, AVTR_R * 0.36));
      const icoS = fs * 1.05;
      ctx.save();
      ctx.font = `bold ${fs}px 'Cinzel', serif`;
      const tw  = ctx.measureText(acVal).width;
      const padX = 5, gap = 3;
      const bw  = padX * 2 + icoS + gap + tw;
      const bh  = fs + 8;
      // Binnen het slot houden: bij vier of meer figuren op een zijde stak de
      // badge eroverheen en knipte de slot-clip hem halverwege af.
      const bx  = Math.max(x + 2, Math.min(cx + AVTR_R * 0.62 - bw / 2 + bw * 0.30, x + w - bw - 2));
      const by  = cy - AVTR_R * 0.80 - bh / 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, bh / 2);
      ctx.fillStyle   = 'rgba(26, 16, 6, 0.88)';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur  = 5;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = 'rgba(212, 170, 60, 0.75)';
      ctx.lineWidth   = 1;
      ctx.stroke();
      const sh = _spriteIcon('shield', '#d4aa3c');
      if (sh) ctx.drawImage(sh, bx + padX, by + (bh - icoS) / 2, icoS, icoS);
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = '#f2e8d2';
      ctx.fillText(acVal, bx + padX + icoS + gap, by + bh / 2 + 0.5);
      ctx.restore();
    }
  }
}

// ── Condition effects — behind / around avatar ───────────────────────────────

function _fxBehind(ctx, cond, cx, cy, r, t) {
  if (cond === 'concentration') _fxConcentration(ctx, cx, cy, r, t);
  else if (cond === 'frightened')    _fxFrightened(ctx, cx, cy, r, t);
  else if (cond === 'paralyzed')     _fxParalyzed(ctx, cx, cy, r, t);
}

// Concentration — pulserende paarse ring
function _fxConcentration(ctx, cx, cy, r, t) {
  ctx.save();
  const alpha = 0.45 + Math.sin(t * 2.8) * 0.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(160,80,255,${alpha})`;
  ctx.lineWidth   = 2.5;
  ctx.shadowColor = 'rgba(160,80,255,0.7)';
  ctx.shadowBlur  = 14;
  ctx.stroke();
  ctx.restore();
}

// Frightened — schuddende donkerrode ring
function _fxFrightened(ctx, cx, cy, r, t) {
  ctx.save();
  const shake = Math.sin(t * 22) * 3;
  const alpha = 0.35 + Math.sin(t * 7) * 0.25;
  ctx.beginPath();
  ctx.arc(cx + shake, cy, r + 6, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(200,20,20,${alpha})`;
  ctx.lineWidth   = 3;
  ctx.shadowColor = 'rgba(180,0,0,0.5)';
  ctx.shadowBlur  = 12;
  ctx.stroke();
  ctx.restore();
}

// Paralyzed — flikkerende bliksembogen
function _fxParalyzed(ctx, cx, cy, r, t) {
  if (Math.sin(t * 14) < 0) return;   // flikkert ~50% van de tijd
  ctx.save();
  const brightness = 0.6 + Math.sin(t * 28) * 0.4;
  ctx.strokeStyle = `rgba(140,180,255,${brightness})`;
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = 'rgba(100,160,255,0.9)';
  ctx.shadowBlur  = 8;
  for (let b = 0; b < 2; b++) {
    const startX = cx + (b === 0 ? -r * 0.45 : r * 0.25);
    ctx.beginPath();
    ctx.moveTo(startX, cy - r * 0.9);
    for (let s = 1; s <= 5; s++) {
      ctx.lineTo(
        startX + Math.sin(t * 20 + b * 3.1 + s * 1.7) * r * 0.3,
        cy - r * 0.9 + (s / 5) * r * 1.8
      );
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Petrified — sterk grijze overlay + scheuren; geen beweging (bounce = 0)
function _fxPetrified(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(130,125,115,0.80)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,65,60,0.90)';
  ctx.lineWidth   = 1.2;
  const cracks = [
    [[-0.20, -0.65], [ 0.10, -0.10], [-0.15,  0.45]],
    [[ 0.30, -0.55], [ 0.05,  0.15], [ 0.38,  0.52]],
    [[-0.45,  0.10], [-0.10,  0.40]],
  ];
  cracks.forEach(pts => {
    ctx.beginPath();
    ctx.moveTo(cx + pts[0][0] * r, cy + pts[0][1] * r);
    pts.slice(1).forEach(p => ctx.lineTo(cx + p[0] * r, cy + p[1] * r));
    ctx.stroke();
  });
  ctx.restore();
}

// ── Condition effects — zwevende particles ───────────────────────────────────

function _fxParticles(ctx, cond, cx, cy, r, t) {
  if (cond === 'poisoned')         _fxPoisoned(ctx, cx, cy, r, t);
  else if (cond === 'unconscious') _fxUnconscious(ctx, cx, cy, r, t);  // incapacitated: geen Z's
  else if (cond === 'stunned')     _fxStunned(ctx, cx, cy, r, t);
  else if (cond === 'charmed')     _fxCharmed(ctx, cx, cy, r, t);
}

// Poisoned — groene bubbels drijven omhoog
function _fxPoisoned(ctx, cx, cy, r, t) {
  ctx.save();
  const count = 7;
  for (let i = 0; i < count; i++) {
    const phase = (t * 0.7 + i / count) % 1;
    const bx    = cx + Math.sin(i * 2.1 + t * 0.6) * r * 0.65;
    const by    = cy + r * 0.6 - phase * r * 2.4;
    const br    = Math.max(2, r * 0.07 * (1 - phase * 0.4));
    const alpha = phase < 0.20 ? phase / 0.20
                : phase > 0.75 ? (1 - phase) / 0.25 : 1;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(60,200,40,${alpha * 0.80})`;
    ctx.fill();
    // Glansje
    ctx.beginPath();
    ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,255,150,${alpha * 0.50})`;
    ctx.fill();
  }
  ctx.restore();
}

// Unconscious / incapacitated — drijvende Z's
function _fxUnconscious(ctx, cx, cy, r, t) {
  ctx.save();
  const count = 3;
  for (let i = 0; i < count; i++) {
    const phase = (t * 0.55 + i / count) % 1;
    const zx    = cx + r * 0.25 + phase * r * 0.6;
    const zy    = cy - r * 0.4  - phase * r * 1.6;
    const sz    = Math.max(8, r * 0.28) * (0.7 + i * 0.15);
    const alpha = phase < 0.15 ? phase / 0.15
                : phase > 0.70 ? (1 - phase) / 0.30 : 1;
    ctx.globalAlpha  = alpha * 0.9;
    ctx.font         = `bold ${sz}px sans-serif`;
    ctx.fillStyle    = '#aaddff';
    ctx.shadowColor  = 'rgba(0,100,200,0.5)';
    ctx.shadowBlur   = 4;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Z', zx, zy);
  }
  ctx.restore();
}

// Stunned — sterren cirkelen boven de avatar (niet erdoorheen)
function _fxStunned(ctx, cx, cy, r, t) {
  ctx.save();
  const count  = 5;
  const orbitR = r * 0.85;              // horizontale straal
  const baseY  = cy - r - 10;           // net boven de bovenkant van de cirkel
  const sz     = Math.max(10, r * 0.22);
  ctx.font         = `${sz}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < count; i++) {
    const angle = t * 3.0 + (i / count) * Math.PI * 2;
    const sx    = cx + Math.cos(angle) * orbitR;
    const sy    = baseY + Math.sin(angle) * 5;  // lichte verticale beweging
    ctx.globalAlpha = 0.65 + Math.sin(angle * 2) * 0.35;
    ctx.fillText('⭐', sx, sy);
  }
  ctx.restore();
}

// Charmed — roze hartjes zweven omhoog
function _fxCharmed(ctx, cx, cy, r, t) {
  ctx.save();
  const count = 4;
  const sz    = Math.max(10, r * 0.28);
  ctx.font         = `${sz}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < count; i++) {
    const phase = (t * 0.65 + i / count) % 1;
    const hx    = cx + Math.sin(i * 1.9 + t * 0.5) * r * 0.70;
    const hy    = cy - r * 0.2 - phase * r * 2.0;
    const alpha = phase < 0.15 ? phase / 0.15
                : phase > 0.65 ? (1 - phase) / 0.35 : 1;
    ctx.globalAlpha = alpha;
    ctx.fillText('💕', hx, hy);
  }
  ctx.restore();
}

// Blinded — donkere wolk over de bovenkant van de visual (bedekt de ogen)
function _fxBlinded(ctx, cx, cy, r, t) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const pulse = 0.82 + Math.sin(t * 1.6) * 0.10;
  const grad  = ctx.createLinearGradient(cx, cy - r, cx, cy + r * 0.25);
  grad.addColorStop(0,    `rgba(8,4,0,${0.92 * pulse})`);
  grad.addColorStop(0.50, `rgba(12,6,0,${0.72 * pulse})`);
  grad.addColorStop(1,    'rgba(8,4,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 1.25);
  ctx.restore();
}

// Restrained — kettingringen om de cirkel, verminderde bounce (al afgehandeld)
function _fxRestrained(ctx, cx, cy, r, t) {
  ctx.save();
  const chainR   = r + 7;
  const numLinks = 7;
  ctx.shadowColor = 'rgba(60,40,10,0.55)';
  ctx.shadowBlur  = 4;
  ctx.strokeStyle = 'rgba(110,88,44,0.85)';
  ctx.lineWidth   = 2;
  for (let i = 0; i < numLinks; i++) {
    const angle = (i / numLinks) * Math.PI * 2 + t * 0.25;
    const lx    = cx + Math.cos(angle) * chainR;
    const ly    = cy + Math.sin(angle) * chainR;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 4.5, 3, angle, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Verbindingsring
  ctx.shadowBlur  = 0;
  ctx.beginPath();
  ctx.arc(cx, cy, chainR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(90,68,28,0.45)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.restore();
}

// ── Muisinteractie — condition tooltip ───────────────────────────────────────

// #27: reken client-coords om naar canvas-pixelruimte (hitareas/posities staan in
// _canvas.offsetWidth-eenheden). Corrigeert voor CSS-scale/transform op een parent.
function _canvasCoords(clientX, clientY) {
  const rect = _canvas.getBoundingClientRect();
  const sx = rect.width  ? _canvas.offsetWidth  / rect.width  : 1;
  const sy = rect.height ? _canvas.offsetHeight / rect.height : 1;
  return { mx: (clientX - rect.left) * sx, my: (clientY - rect.top) * sy };
}

function _onMouseMove(e) {
  const { mx, my } = _canvasCoords(e.clientX, e.clientY);
  _hoverX = mx;
  _hoverY = my;
  _hoverCond = null;
  for (const area of _hitAreas) {
    if (mx >= area.x && mx <= area.x + area.w &&
        my >= area.y && my <= area.y + area.h) {
      _hoverCond = area.condId;
      break;
    }
  }
}

function _onMouseLeave() {
  _hoverCond = null;
}

function _onTouch(e) {
  const touch = e.touches[0];
  if (touch) {
    _lastTouch = { clientX: touch.clientX, clientY: touch.clientY };
    _onMouseMove(_lastTouch);
  }
}

// #28: tap-einde → behandel als klik (selecteer combatant) op de laatste touch-positie.
function _onTouchEnd() {
  if (_lastTouch) _onClick(_lastTouch);
  _hoverCond = null;
}

function _onClick(e) {
  const { mx, my } = _canvasCoords(e.clientX, e.clientY);
  for (const [id, pos] of Object.entries(_positions)) {
    const dx = mx - pos.cx;
    const dy = my - pos.cy;
    if (Math.sqrt(dx * dx + dy * dy) <= pos.r + 4) {
      if (window.app?.isDM?.()) {
        window.dmPanel?.combatSelectCombatant?.(id);
      } else {
        // Speler: open stat block panel als het monster bestudeerd is
        const c = _combat?.combatants?.find(c => c.id === id);
        if (c?.type === 'monster' && c._niveau) {
          window.app?.openCombatMonsterPanel?.(c);
        }
      }
      return;
    }
  }
  if (window.app?.isDM?.()) window.dmPanel?.combatSelectCombatant?.(null);
}

function _drawCondTooltip(ctx, W, H, condId, mx, my) {
  const name    = condId.charAt(0).toUpperCase() + condId.slice(1);
  const desc    = CONDITION_DESC[condId] || '';
  const pad     = 9;
  const titleSz = 12;
  const descSz  = 10;
  const lineH   = descSz + 3;
  const maxW    = Math.min(210, W * 0.55);

  ctx.save();
  ctx.font = `${descSz}px sans-serif`;

  // Tekst wrappen
  const words = desc.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW - pad * 2) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const boxW = maxW;
  const boxH = pad * 2 + titleSz + 5 + lines.length * lineH;

  // Positie naast cursor, binnen canvas houden
  let bx = mx + 14;
  let by = my - boxH / 2;
  if (bx + boxW > W - 4) bx = mx - boxW - 10;
  by = Math.max(4, Math.min(by, H - boxH - 4));

  // Achtergrond
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = 'rgba(18,12,8,0.94)';
  _roundRect(ctx, bx, by, boxW, boxH, 7);
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = 'rgba(200,165,90,0.45)';
  ctx.lineWidth   = 1;
  _roundRect(ctx, bx, by, boxW, boxH, 7);
  ctx.stroke();

  // Titel
  ctx.fillStyle    = '#f0c040';
  ctx.font         = `bold ${titleSz}px sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  // Icoon uit de sprite vóór de titel (voorheen een emoji uit CONDITION_ICONS).
  const tipMap = COND_ICON[condId];
  const tipImg = tipMap ? _spriteIcon(tipMap[0], tipMap[1]) : null;
  if (tipImg) ctx.drawImage(tipImg, bx + pad, by + pad, titleSz, titleSz);
  ctx.fillText(name, bx + pad + (tipImg ? titleSz + 6 : 0), by + pad);

  // Beschrijving
  ctx.fillStyle = 'rgba(225,215,195,0.9)';
  ctx.font      = `${descSz}px sans-serif`;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, bx + pad, by + pad + titleSz + 5 + i * lineH);
  });

  ctx.restore();
}

function _drawWinScreen(ctx, W, H, winner, t) {
  const isVictory = winner === 'players';

  // Darkening overlay — fades in over ~1.5 s
  const overlayAlpha = Math.min(1, t / 1.5) * (isVictory ? 0.55 : 0.70);
  ctx.fillStyle = isVictory
    ? `rgba(10,30,5,${overlayAlpha})`
    : `rgba(40,5,5,${overlayAlpha})`;
  ctx.fillRect(0, 0, W, H);

  // Pulsing scale on the main text
  const pulse  = 1 + Math.sin(t * 2.2) * 0.04;
  const fadeIn = Math.min(1, t / 1.0);           // fully in after 1 s

  const text      = isVictory ? 'Overwinning!' : 'Verslagen...';
  const textColor = isVictory ? '#f5d060'      : '#e04030';
  const glowColor = isVictory ? 'rgba(255,220,50,0.7)' : 'rgba(200,30,20,0.7)';
  const fontSize  = Math.min(W * 0.14, H * 0.20, 72);

  ctx.save();
  ctx.globalAlpha = fadeIn;
  ctx.translate(W / 2, H / 2);
  ctx.scale(pulse, pulse);

  // Outer glow
  ctx.shadowColor = glowColor;
  ctx.shadowBlur  = 28;
  ctx.fillStyle   = textColor;
  ctx.font        = `bold ${fontSize}px 'Cinzel', serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);

  // Crisp inner pass (no shadow)
  ctx.shadowBlur = 0;
  ctx.fillStyle  = isVictory ? '#fff8dc' : '#ffb0a0';
  ctx.font       = `bold ${fontSize * 0.96}px 'Cinzel', serif`;
  ctx.fillText(text, 0, 0);

  ctx.restore();

  // Sub-text
  const subText     = isVictory ? 'De helden zegevieren!' : 'De avonturiers zijn verslagen... Betekent dit het einde voor Grisburgh?';
  const subFontSize = Math.min(W * 0.045, H * 0.065, 18);
  const subFadeIn   = Math.max(0, Math.min(1, (t - 0.6) / 0.8));
  ctx.save();
  ctx.globalAlpha  = subFadeIn;
  ctx.shadowColor  = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur   = 8;
  ctx.fillStyle    = isVictory ? 'rgba(240,220,140,0.9)' : 'rgba(220,160,150,0.9)';
  ctx.font         = `${subFontSize}px 'Cinzel', serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  const subLines   = _wrapText(ctx, subText, W * 0.85);
  const subLineH   = subFontSize * 1.4;
  const subStartY  = H / 2 + fontSize * 0.65;
  subLines.forEach((ln, i) => ctx.fillText(ln, W / 2, subStartY + i * subLineH));
  ctx.restore();
}

function _drawHpBar(ctx, c, x, y, w, h) {
  const hp     = Math.max(0, c.hp    || 0);
  const maxHp  = Math.max(1, c.maxHp || 1);
  const tempHp = c.tempHp || 0;
  const pct    = hp / maxHp;
  const isDM   = window.app?.isDM?.();
  const niveau = c._niveau || null;  // null | 'naam' | 'deels' | 'volledig'

  // Voor monsters zonder kennisniveau altijd een ruwe 3-segmenten bar tonen
  // (gezond / gewond / kritiek), zonder exacte procenten.
  // Bij deels/volledig: vloeiende 5-kleurige bar + exacte getallen (zoals DM).
  const isMonster    = c.type === 'monster';
  const hasKennis    = niveau === 'deels' || niveau === 'volledig';
  const useCoarse    = isMonster && !isDM && !hasKennis;
  const showExact    = isDM || (isMonster && hasKennis);

  // Render-percentage: bij ruwe modus afkappen op 3 segmenten
  const renderPct = useCoarse
    ? (pct > 0.66 ? 1 : pct > 0.33 ? 0.60 : pct > 0 ? 0.25 : 0)
    : pct;

  // Background
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  _roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 3);
  ctx.fill();
  ctx.restore();

  // HP fill
  const color = pct >= 1    ? '#48e048'
              : pct >= 0.75 ? '#a0d020'
              : pct >= 0.50 ? '#f0b020'
              : pct >= 0.25 ? '#e85020'
              : pct >  0    ? '#d01818'
                            : '#505050';
  if (renderPct > 0) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = useCoarse ? 2 : 5;
    ctx.fillStyle   = color;
    _roundRect(ctx, x, y, w * renderPct, h, 2);
    ctx.fill();
    // Ruwe modus: verticale scheidingslijntjes tonen de 3 segmenten
    if (useCoarse) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth   = 1;
      [1/3, 2/3].forEach(frac => {
        ctx.beginPath();
        ctx.moveTo(x + w * frac, y);
        ctx.lineTo(x + w * frac, y + h);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  // Temp HP (blauw, boven de balk)
  if (tempHp > 0) {
    const tpct = Math.min(tempHp / maxHp, 1);
    ctx.save();
    ctx.fillStyle = '#3a7acc';
    _roundRect(ctx, x, y - h - 2, w * tpct, h - 1, 2);
    ctx.fill();
    ctx.restore();
  }

  // Exacte getallen onder de balk (DM altijd; speler bij deels/volledig kennis)
  if (showExact && hp > 0) {
    ctx.save();
    ctx.font         = `bold 8px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    const txt = tempHp > 0 ? `${hp}+${tempHp}/${maxHp}` : `${hp}/${maxHp}`;
    // Licht: deze getallen staan op de leesplaat, niet meer op de achtergrond.
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 3;
    ctx.fillStyle   = '#f2e8d2';
    ctx.fillText(txt, x + w / 2, y + h + 2);
    ctx.restore();
  }
}

// ── Death saving throws dots (dying player) ─────────────────────────────────

function _drawDeathSaveDots(ctx, cx, y, ds) {
  ctx.save();
  const dotR   = 3.5;
  const gap    = 3;
  const mid    = 7;  // gap between success and failure groups
  // Total width: 3*(dotR*2+gap) - gap  +  mid  +  3*(dotR*2+gap) - gap
  const groupW = 3 * (dotR * 2 + gap) - gap;
  const totalW = groupW * 2 + mid;
  let px = cx - totalW / 2;

  for (let i = 0; i < 3; i++) {
    const x = px + i * (dotR * 2 + gap) + dotR;
    ctx.beginPath();
    ctx.arc(x, y + dotR, dotR, 0, Math.PI * 2);
    if (i < (ds.successes || 0)) {
      ctx.fillStyle   = '#48e048';
      ctx.shadowColor = '#48e048';
      ctx.shadowBlur  = 6;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(90,200,90,0.40)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  px += groupW + mid;
  for (let i = 0; i < 3; i++) {
    const x = px + i * (dotR * 2 + gap) + dotR;
    ctx.beginPath();
    ctx.arc(x, y + dotR, dotR, 0, Math.PI * 2);
    if (i < (ds.failures || 0)) {
      ctx.fillStyle   = '#e04030';
      ctx.shadowColor = '#e04030';
      ctx.shadowBlur  = 6;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(200,80,60,0.40)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function _wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function _roundRect(ctx, x, y, w, h, r) {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
