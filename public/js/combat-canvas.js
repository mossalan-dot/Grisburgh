// ── Combat Canvas ──
// Renders the battle scene on a <canvas> element.
// Call init(canvasEl, combat) to start, update(combat) on each state change, stop() to halt.

// Emoji fallback voor conditions zonder sprite
const CONDITION_ICONS = {
  blinded: '🙈', charmed: '💕', deafened: '🔇', exhaustion: '😓',
  frightened: '😱', grappled: '✊', incapacitated: '💤', invisible: '👻',
  paralyzed: '⚡', petrified: '🪨', poisoned: '🤢', prone: '⬇️',
  restrained: '⛓️', stunned: '⭐', unconscious: '💀', concentration: '🔮',
};

// Roll20 sprite sheet — [sx, sy, sw, sh] in pixels (1050×1050 afbeelding)
// Grid: 5 kolommen × 4 rijen, elke cel ≈ 210×210px, iconrijen starten op y=185
const SPRITE_URL    = '/img/conditions-sprite.jpg';
const SPRITE_CROPS  = {
  stunned:       [210, 185, 210, 210],
  restrained:    [420, 185, 210, 210],
  prone:         [630, 185, 210, 210],
  poisoned:      [840, 185, 210, 210],
  petrified:     [  0, 395, 210, 210],
  paralyzed:     [210, 395, 210, 210],
  invisible:     [  0, 605, 210, 210],
  incapacitated: [210, 605, 210, 210],
  grappled:      [420, 605, 210, 210],
  exhaustion:    [840, 605, 210, 210],
  concentration: [210, 815, 210, 210],
  deafened:      [420, 815, 210, 210],
  blinded:       [630, 815, 210, 210],
};

let _sprite    = null;  // null = niet gestart, false = laden, HTMLImageElement = klaar
let _iconCache = {};    // condId → HTMLCanvasElement (grijs verwijderd)

function _loadSprite() {
  if (_sprite !== null) return;
  _sprite = false;
  const img = new Image();
  img.onload  = () => { _sprite = img; _iconCache = {}; };
  img.onerror = () => { _sprite = false; };
  img.src = SPRITE_URL;
}

// Geeft een kleine HTMLCanvasElement terug met grije achtergrond verwijderd,
// of null als de sprite nog niet geladen is / condition niet in sheet zit.
function _getIconCanvas(condId) {
  if (_iconCache[condId]) return _iconCache[condId];
  if (!_sprite)           return null;
  const crop = SPRITE_CROPS[condId];
  if (!crop)              return null;

  const [sx, sy, sw, sh] = crop;
  const oc  = document.createElement('canvas');
  oc.width  = sw;
  oc.height = sh;
  const oct  = oc.getContext('2d');
  oct.drawImage(_sprite, sx, sy, sw, sh, 0, 0, sw, sh);

  // Verwijder grijze achtergrond: pixels waarbij R≈G≈B en helderheid tussen 60-210
  const id   = oct.getImageData(0, 0, sw, sh);
  const data = id.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lo = Math.min(r, g, b), hi = Math.max(r, g, b);
    if (hi - lo < 24 && r > 60 && r < 215) data[i + 3] = 0;
  }
  oct.putImageData(id, 0, 0);
  _iconCache[condId] = oc;
  return oc;
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
let _animFrame = null;
let _t0        = 0;
let _hitAreas  = [];      // [{x, y, w, h, condId}] — herbouwd elke frame
let _hoverCond = null;    // condition-id van icoon waarover de muis zweeft
let _hoverX    = 0;
let _hoverY    = 0;
let _hitEvents = [];      // [{id, delta, t0}] — floating damage/heal nummers
let _positions = {};      // id -> {cx, cy, r} — gevuld tijdens drawCombatant, gebruikt voor floating numbers

// ── Public API ──────────────────────────────────────────────────────────────

export function init(canvasEl, combat) {
  _stop();
  _loadSprite();
  _canvas = canvasEl;
  _ctx    = canvasEl.getContext('2d');
  _t0     = performance.now();
  _canvas.addEventListener('mousemove',  _onMouseMove);
  _canvas.addEventListener('mouseleave', _onMouseLeave);
  _canvas.addEventListener('touchstart', _onTouch, { passive: true });
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
  }
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
  _combat = combat;
  if (!combat) return;
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
  const W = _canvas.offsetWidth;
  const H = _canvas.offsetHeight;
  if (W < 4 || H < 4) return;                  // hidden / not laid out yet
  if (_canvas.width !== W || _canvas.height !== H) {
    _canvas.width  = W;
    _canvas.height = H;
  }

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
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2c1a0a');
    grad.addColorStop(1, '#120802');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Vignette
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // ── Split combatants ──
  const cs       = _combat.combatants || [];
  const players  = cs.filter(c => c.type === 'player');
  const monsters = cs.filter(c => c.type === 'monster' && (c.hp || 0) > 0);
  const group    = _getTurnGroup(cs, _combat.currentTurn ?? 0);

  if (cs.length === 0) {
    _drawEmptyHint(ctx, W, H);
    return;
  }

  const isWide = W >= 480;
  const hasBoth = players.length > 0 && monsters.length > 0;

  if (isWide) {
    // Zij aan zij: monsters links, spelers rechts
    if (hasBoth) {
      _drawSide(ctx, monsters, cs, group, 0,     0, W / 2, H, t);
      _drawSide(ctx, players,  cs, group, W / 2, 0, W / 2, H, t);
      _drawDivider(ctx, W / 2, 0, W / 2, H, 'vertical', t);
    } else if (monsters.length) {
      _drawSide(ctx, monsters, cs, group, 0, 0, W, H, t);
    } else {
      _drawSide(ctx, players,  cs, group, 0, 0, W, H, t);
    }
  } else {
    // Gestapeld: monsters boven, spelers onder
    if (hasBoth) {
      _drawSide(ctx, monsters, cs, group, 0, 0,     W, H / 2, t);
      _drawSide(ctx, players,  cs, group, 0, H / 2, W, H / 2, t);
      _drawDivider(ctx, 0, H / 2, W, H / 2, 'horizontal', t);
    } else {
      _drawSide(ctx, cs, cs, group, 0, 0, W, H, t);
    }
  }

  // ── Floating damage / heal nummers (buiten slot-clip) ──
  _hitEvents = _hitEvents.filter(e => now - e.t0 < 1600);
  for (const evt of _hitEvents) {
    const pos = _positions[evt.id];
    if (pos) _drawHitNumber(ctx, evt, pos.cx, pos.cy, pos.r, now);
  }

  // ── Win / lose overlay ──
  if (_combat.winner) {
    _drawWinScreen(ctx, W, H, _combat.winner, t);
  }

  // ── Condition tooltip (bovenop alles) ──
  if (_hoverCond) _drawCondTooltip(ctx, W, H, _hoverCond, _hoverX, _hoverY);
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
  if (dir === 'horizontal') {
    // Horizontale lijn — kleur vervaagt van links (rood/monster) naar rechts (blauw/speler)
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0,   `rgba(160, 50,  30, ${pulse})`);
    grad.addColorStop(0.5, `rgba(220,180,  80, ${pulse + 0.15})`);
    grad.addColorStop(1,   `rgba( 50, 80, 160, ${pulse})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -t * 18;
    ctx.beginPath();
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + w - 12, y);
    ctx.stroke();
    // Subtiele gloed
    ctx.setLineDash([]);
    ctx.lineWidth   = 3;
    ctx.strokeStyle = `rgba(220,180,80,${pulse * 0.25})`;
    ctx.beginPath();
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + w - 12, y);
    ctx.stroke();
  } else {
    // Verticale lijn — kleur vervaagt van boven (rood/monster) naar onder (blauw/speler)
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0,   `rgba(160, 50,  30, ${pulse})`);
    grad.addColorStop(0.5, `rgba(220,180,  80, ${pulse + 0.15})`);
    grad.addColorStop(1,   `rgba( 50, 80, 160, ${pulse})`);
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

function _drawSide(ctx, group, allCs, turnGroup, x, y, w, h, t) {
  const n    = group.length;
  const GAP  = n > 1 ? Math.min(8, w * 0.02) : 0;
  const slotW = (w - GAP * (n - 1)) / n;
  group.forEach((c, i) => {
    const idx    = allCs.indexOf(c);
    const isActive = turnGroup.includes(idx);
    const slotX  = x + i * (slotW + GAP);
    // Clip per slot zodat effects niet in de buurman bloeden
    ctx.save();
    ctx.beginPath();
    ctx.rect(slotX, y, slotW, h);
    ctx.clip();
    _drawCombatant(ctx, c, slotX, y, slotW, h, t, isActive);
    ctx.restore();
  });
}

function _drawCombatant(ctx, c, x, y, w, h, t, isActive) {
  const bounce = isActive ? Math.sin(t * 3.5) * 5 : 0;

  // Circle avatar sizing
  const AVTR_R = Math.min(w * 0.30, h * 0.26);
  const cx     = x + w / 2;
  const cy     = y + h * 0.12 + AVTR_R + bounce;

  const isDead = (c.hp || 0) <= 0;
  const conds  = isDead ? [] : (c.conditions || []);
  const topCond = _getTopCondition(conds);

  // ── Effects behind / around avatar ──
  if (topCond) _fxBehind(ctx, topCond, cx, cy, AVTR_R, t);

  // ── Avatar image ──
  const imgId      = c.imageId || c.entityId;
  const img        = imgId ? _images[imgId] : null;
  const isInvisible = topCond === 'invisible';

  ctx.save();
  if (isInvisible) ctx.globalAlpha = 0.25 + Math.abs(Math.sin(t * 1.4)) * 0.35;
  ctx.beginPath();
  ctx.arc(cx, cy, AVTR_R, 0, Math.PI * 2);
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
    g.addColorStop(0, c.type === 'player' ? '#4a6a9a' : '#6a3a28');
    g.addColorStop(1, c.type === 'player' ? '#1a2a4a' : '#28100a');
    ctx.fillStyle = g;
    ctx.fillRect(cx - AVTR_R, cy - AVTR_R, AVTR_R * 2, AVTR_R * 2);
    ctx.fillStyle    = 'rgba(255,255,255,0.2)';
    ctx.font         = `${AVTR_R * 0.85}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.type === 'player' ? '👤' : '👾', cx, cy);
  }
  ctx.restore();

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
    ctx.arc(cx, cy, AVTR_R, 0, Math.PI * 2);
    ctx.fillStyle = flash.delta > 0
      ? `rgba(80,230,80,${alpha})`
      : `rgba(255,40,20,${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  // ── Petrified overlay (on top of avatar) ──
  if (topCond === 'petrified') _fxPetrified(ctx, cx, cy, AVTR_R);

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

  // ── Condition icons — links in het slot, verticaal gecentreerd ──
  const allConds = isDead ? [] : (c.conditions || []);
  if (allConds.length > 0) {
    const sz     = Math.max(14, Math.min(18, w * 0.11));
    const lineH  = sz + 5;
    const stackH = allConds.length * lineH - 5;
    const iconX  = x + 4;
    let   iconY  = y + h / 2 - stackH / 2;
    ctx.font         = `${sz}px serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    allConds.forEach(id => {
      const ic = _getIconCanvas(id);
      if (ic) {
        ctx.drawImage(ic, iconX, iconY, sz, sz);
      } else {
        ctx.fillText(CONDITION_ICONS[id] || '?', iconX, iconY);
      }
      _hitAreas.push({ x: iconX, y: iconY, w: sz, h: sz, condId: id });
      iconY += lineH;
    });
  }

  // ── HP bar (directly below circle) ──
  const barW = Math.min(w * 0.72, AVTR_R * 2.2);
  const barH = 5;
  const barX = cx - barW / 2;
  const barY = cy + AVTR_R + 8;
  _drawHpBar(ctx, c, barX, barY, barW, barH);

  // ── Death saving throws (dying players) ──
  const isDying = isDead && c.type === 'player';
  if (isDying) {
    const ds = c.deathSaves || { successes: 0, failures: 0 };
    _drawDeathSaveDots(ctx, cx, barY + barH + 2, ds);
  }

  // ── Name ──
  const isDMView = window.app?.isDM?.();
  const fontSize = Math.max(9, Math.min(13, w * 0.1));
  // Leave room for DM HP numbers or death save dots
  const nameY    = barY + barH + (isDMView || isDying ? 14 : 7);
  ctx.save();
  ctx.shadowColor  = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur   = 4;
  ctx.fillStyle    = isActive ? '#f5c842' : '#f0e6d0';
  ctx.font         = `bold ${fontSize}px 'Cinzel', serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  let label = c.name;
  while (ctx.measureText(label).width > w - 6 && label.length > 3) label = label.slice(0, -1);
  if (label !== c.name) label += '…';
  ctx.fillText(label, cx, nameY);
  ctx.restore();
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

// Petrified — grijze overlay + scheuren op de avatar
function _fxPetrified(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(155,150,140,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,85,80,0.75)';
  ctx.lineWidth   = 1;
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
  if (cond === 'poisoned')                                 _fxPoisoned(ctx, cx, cy, r, t);
  else if (cond === 'unconscious' || cond === 'incapacitated') _fxUnconscious(ctx, cx, cy, r, t);
  else if (cond === 'stunned')                             _fxStunned(ctx, cx, cy, r, t);
  else if (cond === 'charmed')                             _fxCharmed(ctx, cx, cy, r, t);
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

// Stunned — sterren cirkelen rond de avatar
function _fxStunned(ctx, cx, cy, r, t) {
  ctx.save();
  const count  = 5;
  const orbitR = r + 10;
  const sz     = Math.max(10, r * 0.22);
  ctx.font         = `${sz}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < count; i++) {
    const angle = t * 3.0 + (i / count) * Math.PI * 2;
    const sx    = cx + Math.cos(angle) * orbitR;
    const sy    = cy + Math.sin(angle) * orbitR * 0.38;  // elliptische baan
    ctx.globalAlpha = 0.70 + Math.sin(angle * 2) * 0.30;
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

// ── Muisinteractie — condition tooltip ───────────────────────────────────────

function _onMouseMove(e) {
  const rect  = _canvas.getBoundingClientRect();
  const scaleX = _canvas.width  / rect.width;
  const scaleY = _canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top)  * scaleY;
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
  if (touch) _onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
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
  ctx.fillText(`${CONDITION_ICONS[condId] || ''}  ${name}`, bx + pad, by + pad);

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
  ctx.fillText(subText, W / 2, H / 2 + fontSize * 0.65);
  ctx.restore();
}

function _drawHpBar(ctx, c, x, y, w, h) {
  const hp     = Math.max(0, c.hp    || 0);
  const maxHp  = Math.max(1, c.maxHp || 1);
  const tempHp = c.tempHp || 0;
  const pct    = hp / maxHp;
  const isDM   = window.app?.isDM?.();

  // Background
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  _roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 3);
  ctx.fill();
  ctx.restore();

  // HP fill (5 colour states) met glow voor zichtbaarheid
  const color = pct >= 1    ? '#48e048'
              : pct >= 0.75 ? '#a0d020'
              : pct >= 0.50 ? '#f0b020'
              : pct >= 0.25 ? '#e85020'
              : pct >  0    ? '#d01818'
                            : '#505050';
  if (pct > 0) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = 5;
    ctx.fillStyle   = color;
    _roundRect(ctx, x, y, w * pct, h, 2);
    ctx.fill();
    ctx.restore();
  }

  // Temp HP (blue, above the bar)
  if (tempHp > 0) {
    const tpct = Math.min(tempHp / maxHp, 1);
    ctx.save();
    ctx.fillStyle = '#3a7acc';
    _roundRect(ctx, x, y - h - 2, w * tpct, h - 1, 2);
    ctx.fill();
    ctx.restore();
  }

  // DM: exact numbers below the bar (only when alive — dying shows death save dots)
  if (isDM && hp > 0) {
    ctx.save();
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 3;
    ctx.fillStyle    = 'rgba(255,255,255,0.85)';
    ctx.font         = `bold 8px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    const txt = tempHp > 0 ? `${hp}+${tempHp}/${maxHp}` : `${hp}/${maxHp}`;
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
