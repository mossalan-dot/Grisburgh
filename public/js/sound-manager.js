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

// ── Ambiance (feature #2) ──────────────────────────────────────────────────────
// Eén blijvende loop-Audio. Speelt standaard op de tabletmodus (de tafelspeaker);
// andere clients (DM-laptop, telefoons) kunnen 'm zelf aanzetten. Niet achter de
// DM-guard. Per-campagne: de server stuurt de actieve scène naar de hele room.
let _ambAudio  = null;
let _ambFileId = null;   // fileId van de huidige scène (of null)
let _ambLabel  = null;
let _ambVolume = 0.5;    // mastervolume (door DM gezet)
let _ambFadeIv = null;
let _ambGestureArmed = false;

function _ambEnabledDefault() {
  const v = (typeof localStorage !== 'undefined') ? localStorage.getItem('ambianceEnabled') : null;
  if (v === '1') return true;
  if (v === '0') return false;
  return !!window._isDisplayMode;   // standaard: alleen de tablet speelt af
}
let _ambEnabled = _ambEnabledDefault();

function _ambEnsureAudio() {
  if (!_ambAudio) { _ambAudio = new Audio(); _ambAudio.loop = true; _ambAudio.preload = 'auto'; }
  return _ambAudio;
}

function _ambFadeTo(target, done) {
  if (_ambFadeIv) { clearInterval(_ambFadeIv); _ambFadeIv = null; }
  const a = _ambAudio; if (!a) { done?.(); return; }
  const clamp = v => Math.max(0, Math.min(1, v));
  const step = (target - a.volume) / 12 || (target > a.volume ? 0.08 : -0.08);
  _ambFadeIv = setInterval(() => {
    let v = a.volume + step;
    const reached = step >= 0 ? v >= target : v <= target;
    if (reached) { a.volume = clamp(target); clearInterval(_ambFadeIv); _ambFadeIv = null; done?.(); }
    else a.volume = clamp(v);
  }, 40);
}

function _ambArmGesture() {
  if (_ambGestureArmed) return;
  _ambGestureArmed = true;
  const h = () => { _ambGestureArmed = false; if (_ambFileId && _ambEnabled) _ambApply(); };
  document.addEventListener('pointerdown', h, { once: true });
}

// Start/stop op basis van huidige scène + enable-vlag.
function _ambApply() {
  const a = _ambEnsureAudio();
  if (_ambFileId && _ambEnabled) {
    const src = `/api/files/${_ambFileId}`;
    if (!a.src.endsWith(src)) { a.src = src; a.volume = 0; }
    a.play().then(() => _ambFadeTo(_ambVolume)).catch(() => _ambArmGesture());
  } else {
    _ambFadeTo(0, () => { try { a.pause(); } catch { /* ok */ } });
  }
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
  playEmote({ entityId, index, emoteId }) {
    if (!window.app?.isDM?.()) return;
    const data = _sounds.emotes?.[entityId];
    if (data?.library) {
      // Zoek op emoteId (nieuw) of via selected[index] (gevechtsoverlay)
      const item = emoteId
        ? data.library.find(e => e.id === emoteId)
        : data.library.find(e => e.id === data.selected?.[index]);
      if (item?.fileId) _play(item.fileId);
    } else if (Array.isArray(data)) {
      // Legacy flat-array fallback
      const slot = data[index];
      if (slot?.fileId) _play(slot.fileId);
    }
  },
  onCombatUpdated: _onCombatUpdated,
  reloadSounds:    _loadSounds,

  // ── Ambiance (feature #2) ──
  setAmbiance({ actief, fileId, label, volume } = {}) {
    if (typeof volume === 'number') _ambVolume = volume;
    _ambFileId = actief ? (fileId || null) : null;
    _ambLabel  = actief ? (label || _ambLabel) : null;
    _ambApply();
    window._onAmbianceChange?.({ active: !!_ambFileId, label: _ambLabel, enabled: _ambEnabled });
  },
  toggleAmbiance() {
    _ambEnabled = !_ambEnabled;
    try { localStorage.setItem('ambianceEnabled', _ambEnabled ? '1' : '0'); } catch { /* ok */ }
    _ambApply();
    window._onAmbianceChange?.({ active: !!_ambFileId, label: _ambLabel, enabled: _ambEnabled });
    return _ambEnabled;
  },
  ambianceState() { return { active: !!_ambFileId, label: _ambLabel, enabled: _ambEnabled }; },
};

async function _initAmbianceFromLoaded() {
  const amb = _sounds.ambiance;
  if (!amb?.actief) return;
  const scene = (amb.scenes || []).find(s => s.id === amb.actief);
  if (scene) window.soundManager.setAmbiance({ actief: amb.actief, fileId: scene.fileId, label: scene.label, volume: amb.volume });
}

_loadSounds().then(_initAmbianceFromLoaded);
