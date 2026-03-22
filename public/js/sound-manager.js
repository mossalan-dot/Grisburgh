// ── Sound Manager ─────────────────────────────────────────────────────────────
// Plays sounds ONLY on the DM's browser.
// Socket events are handled by socket-client.js, which calls window.soundManager.*

let _sounds     = { standard: { damage: null, healing: null, win: null, loss: null, nextRound: null, nextTurn: null }, emotes: {}, playerTurn: {} };
let _prevHp     = {};   // combatantId → hp
let _prevWinner = undefined;
let _prevTurn   = undefined;
let _prevRound  = undefined;

// ── Audio playback ────────────────────────────────────────────────────────────

function _play(fileId) {
  if (!fileId) return;
  try {
    const audio = new Audio(`/api/files/${fileId}`);
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

// ── Load config ───────────────────────────────────────────────────────────────

async function _loadSounds() {
  try {
    const r = await fetch('/api/sounds');
    if (r.ok) _sounds = await r.json();
  } catch { /* ok */ }
}

// ── Combat state tracking (HP changes + winner) ───────────────────────────────

function _onCombatUpdated(combat) {
  if (!window.app?.isDM?.()) return;

  _loadSounds();

  if (!combat?.active) {
    if (combat?.winner && combat.winner !== _prevWinner) {
      _prevWinner = combat.winner;
      if (combat.winner === 'players')  _play(_sounds.standard.win);
      if (combat.winner === 'monsters') _play(_sounds.standard.loss);
    }
    _prevHp = {};
    _prevTurn = undefined;
    _prevRound = undefined;
    return;
  }

  _prevWinner = combat.winner ?? null;

  // ── Turn / round change sounds ─────────────────────────────────────────────
  const turnKey  = combat.currentTurn;
  const roundKey = combat.round;

  if (_prevTurn !== undefined && (_prevTurn !== turnKey || _prevRound !== roundKey)) {
    if (_prevRound !== undefined && roundKey > _prevRound) {
      // New round — play nextRound sound (takes priority)
      _play(_sounds.standard.nextRound);
    } else {
      // Same round, new turn — play per-player or generic nextTurn sound
      const current = (combat.combatants || [])[turnKey];
      const isPlayer = current?.type === 'player';
      const playerSnd = isPlayer ? _sounds.playerTurn?.[current.entityId] : null;
      if (playerSnd) {
        _play(playerSnd);
      } else {
        _play(_sounds.standard.nextTurn);
      }
    }
  }

  _prevTurn  = turnKey;
  _prevRound = roundKey;

  // ── HP change sounds ───────────────────────────────────────────────────────
  let tookDamage = false;
  let gotHealing = false;

  (combat.combatants || []).forEach(c => {
    const prev = _prevHp[c.id];
    if (prev !== undefined && typeof c.hp === 'number') {
      if (c.hp < prev) tookDamage = true;
      if (c.hp > prev) gotHealing = true;
    }
    _prevHp[c.id] = c.hp;
  });

  if (tookDamage) _play(_sounds.standard.damage);
  else if (gotHealing) _play(_sounds.standard.healing);
}

// ── Public API (called by socket-client.js) ───────────────────────────────────

window.soundManager = {
  playEmote({ entityId, index }) {
    if (!window.app?.isDM?.()) return;
    const data = _sounds.emotes?.[entityId];
    // New model: { library, selected } — index is position in selected[]
    if (data?.selected) {
      const eid  = data.selected[index];
      const item = data.library?.find(e => e.id === eid);
      if (item?.fileId) _play(item.fileId);
    } else if (Array.isArray(data)) {
      // Legacy flat-array fallback
      const slot = data[index];
      if (slot?.fileId) _play(slot.fileId);
    }
  },
  onCombatUpdated: _onCombatUpdated,
  reloadSounds:    _loadSounds,
};

_loadSounds();
