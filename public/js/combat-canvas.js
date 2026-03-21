// ── Combat Canvas ──
// Renders the battle scene on a <canvas> element.
// Call init(canvasEl, combat) to start, update(combat) on each state change, stop() to halt.

const CONDITION_ICONS = {
  blinded: '🙈', charmed: '💕', deafened: '🔇', exhaustion: '😓',
  frightened: '😱', grappled: '✊', incapacitated: '💤', invisible: '👻',
  paralyzed: '⚡', petrified: '🪨', poisoned: '🤢', prone: '⬇️',
  restrained: '⛓️', stunned: '⭐', unconscious: '💀', concentration: '🔮',
  bleeding: '🩸', burning: '🔥',
};

// ── Condition icons (JinxShadow, transparante PNG's) ─────────────────────────
const _condImgs = {};
const _COND_IDS = [
  'blinded','charmed','concentration','deafened','exhaustion','frightened',
  'grappled','incapacitated','invisible','paralyzed','petrified','poisoned',
  'prone','restrained','stunned','unconscious','bleeding','burning',
];
_COND_IDS.forEach(id => {
  const img = new Image();
  img.onload = () => { _condImgs[id] = img; };
  img.src = `/img/conditions/${id}.png`;
});

function _drawCondIcon(ctx, condId, dx, dy, dSize) {
  const img = _condImgs[condId];
  if (img) {
    ctx.drawImage(img, dx, dy, dSize, dSize);
  } else {
    ctx.font = `${dSize}px serif`;
    ctx.fillText(CONDITION_ICONS[condId] || '?', dx, dy);
  }
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

// ── Public API ──────────────────────────────────────────────────────────────

export function init(canvasEl, combat) {
  _stop();
  _canvas = canvasEl;
  _ctx    = canvasEl.getContext('2d');
  _t0     = performance.now();
  _canvas.addEventListener('mousemove',  _onMouseMove);
  _canvas.addEventListener('mouseleave', _onMouseLeave);
  _canvas.addEventListener('touchstart', _onTouch, { passive: true });
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
    _canvas.removeEventListener('click',      _onClick);
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
  // ── Detecteer beurt- en ronde-overgangen ──
  if (combat?.active && _prevRound >= 0) {
    const newRound = combat.round || 1;
    const newTurn  = combat.currentTurn ?? 0;
    if (newRound > _prevRound) {
      _announcement = { t0: performance.now(), type: 'round',
        title: `RONDE ${newRound}`, subtitle: 'BEGINT', color: null };
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
        title: names.join(' & '), subtitle: 'is aan de beurt', color };
    }
  }
  _prevRound = combat?.active ? (combat.round || 1) : -1;
  _prevTurn  = combat?.active ? (combat.currentTurn ?? 0) : -1;

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

  // ── Win / lose overlay ──
  if (_combat.winner) {
    _drawWinScreen(ctx, W, H, _combat.winner, t);
  }

  // ── Beurt / ronde aankondiging ──
  if (_announcement) _drawAnnouncement(ctx, W, H, now);

  // ── Condition tooltip (bovenop alles) ──
  if (_hoverCond) _drawCondTooltip(ctx, W, H, _hoverCond, _hoverX, _hoverY);
}

// ── Beurt / ronde aankondiging ────────────────────────────────────────────────

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

    // Naam
    const titleSz = Math.min(bh * 0.46, 34);
    ctx.font         = `bold ${titleSz}px 'Cinzel', serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = typeColor;
    ctx.shadowBlur   = 18;
    ctx.fillStyle    = typeColor;
    ctx.fillText(title, W / 2, by + bh * 0.37);

    // "is aan de beurt"
    if (subtitle) {
      const subSz = Math.min(bh * 0.27, 17);
      ctx.font       = `${subSz}px 'Cinzel', serif`;
      ctx.shadowBlur = 6;
      ctx.fillStyle  = 'rgba(210,200,185,0.85)';
      ctx.fillText(subtitle, W / 2, by + bh * 0.72);
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

function _drawSide(ctx, group, allCs, turnGroup, x, y, w, h, t, isWide) {
  // Gekleurde zijachtergrond
  const isMonsterSide = group.every(c => c.type === 'monster');
  if (isMonsterSide) {
    const grad = ctx.createLinearGradient(x + w, y, x, y);
    grad.addColorStop(0, 'rgba(160, 40, 30, 0.16)');
    grad.addColorStop(1, 'rgba(160, 40, 30, 0.03)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  } else {
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, 'rgba(50, 90, 180, 0.13)');
    grad.addColorStop(1, 'rgba(50, 90, 180, 0.03)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }

  const n    = group.length;
  const GAP  = n > 1 ? Math.min(8, w * 0.02) : 0;
  const slotW = (w - GAP * (n - 1)) / n;
  group.forEach((c, i) => {
    const idx    = allCs.indexOf(c);
    const isActive = turnGroup.includes(idx);
    const slotX  = x + i * (slotW + GAP);
    // Clip per slot: alleen horizontaal (zodat effects niet in de buurman bloeden),
    // maar niet verticaal — iconen onder de HP-balk moeten zichtbaar blijven
    ctx.save();
    ctx.beginPath();
    ctx.rect(slotX, 0, slotW, ctx.canvas.height);
    ctx.clip();
    _drawCombatant(ctx, c, slotX, y, slotW, h, t, isActive, isWide, idx + 1);
    ctx.restore();
  });
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

function _drawCombatant(ctx, c, x, y, w, h, t, isActive, isWide, turnIndex) {
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

  // Circle avatar sizing
  const AVTR_R = Math.min(w * 0.30, h * 0.26);
  const cx     = x + w / 2;
  const cy     = y + h * 0.12 + AVTR_R + bounce;

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
    ctx.fillStyle    = 'rgba(255,255,255,0.25)';
    ctx.font         = `${AVTR_R * 0.85}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.type === 'player' ? '👤' : c.type === 'ally' ? '⚔️' : c.type === 'summon' ? '✨' : '👾', cx, cy);
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
    ctx.lineWidth = 2.5;
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

  // ── Condition icons ──
  const allConds = isDead ? [] : (c.conditions || []);
  if (allConds.length > 0) {
    ctx.save();
    ctx.font         = '12px serif';
    ctx.fillStyle    = '#111111';
    ctx.shadowColor  = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur   = 3;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';

    if (isWide) {
      // Horizontaal onder de HP-balk, begint bij barX
      const sz    = Math.max(18, Math.min(26, AVTR_R * 0.72));
      const gap   = 3;
      let   iconX = barX;
      const iconY = barY + barH + 14;
      allConds.forEach(id => {
        _drawCondIcon(ctx, id, iconX, iconY, sz);
        _hitAreas.push({ x: iconX, y: iconY, w: sz, h: sz, condId: id });
        iconX += sz + gap;
      });
    } else {
      // Verticaal aan de linkerzijde, gecentreerd in het slot
      const sz     = Math.max(16, Math.min(22, h * 0.11));
      const lineH  = sz + 3;
      const stackH = allConds.length * lineH - 3;
      const iconX  = x + 3;
      let   iconY  = y + h / 2 - stackH / 2;
      allConds.forEach(id => {
        _drawCondIcon(ctx, id, iconX, iconY, sz);
        _hitAreas.push({ x: iconX, y: iconY, w: sz, h: sz, condId: id });
        iconY += lineH;
      });
    }
    ctx.restore();
  }

  // ── Name ──
  const isDMView = window.app?.isDM?.();
  const fontSize = Math.max(9, Math.min(13, w * 0.1));
  // In wide-modus: naam onder de iconrij; anders: onder de HP-balk
  let nameY = barY + barH + (isDMView || isDying ? 14 : 7);
  if (isWide && allConds.length > 0) {
    const sz = Math.max(18, Math.min(26, AVTR_R * 0.72));
    nameY = barY + barH + 14 + sz + 4;
  }
  ctx.save();
  ctx.font         = `bold ${fontSize}px 'Cinzel', serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  const fullName = c.type === 'player' ? c.name.split(' ')[0] : c.name;
  let label = fullName;
  while (ctx.measureText(label).width > w - 6 && label.length > 3) label = label.slice(0, -1);
  if (label !== fullName) label += '…';
  // Witte outline — leesbaar op donkere achtergrond
  ctx.lineJoin     = 'round';
  ctx.lineWidth    = 3.5;
  ctx.strokeStyle  = 'rgba(255,255,255,0.92)';
  ctx.strokeText(label, cx, nameY);
  // Donkere vulling — leesbaar op lichte achtergrond
  ctx.fillStyle    = isActive ? '#7a4800' : '#1e1008';
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

function _onMouseMove(e) {
  const rect = _canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left);
  const my = (e.clientY - rect.top);
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

function _onClick(e) {
  const rect = _canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  for (const [id, pos] of Object.entries(_positions)) {
    const dx = mx - pos.cx;
    const dy = my - pos.cy;
    if (Math.sqrt(dx * dx + dy * dy) <= pos.r + 4) {
      window.dmPanel?.combatSelectCombatant?.(id);
      return;
    }
  }
  // Klik buiten elk portret → sluit detail-panel
  window.dmPanel?.combatSelectCombatant?.(null);
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
    ctx.font         = `bold 8px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    const txt = tempHp > 0 ? `${hp}+${tempHp}/${maxHp}` : `${hp}/${maxHp}`;
    ctx.lineJoin    = 'round';
    ctx.lineWidth   = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(txt, x + w / 2, y + h + 2);
    ctx.fillStyle   = '#1e1008';
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
