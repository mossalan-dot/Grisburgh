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
// Twee blijvende loop-Audio's:
//  • broadcast-scène — de DM zet 'm voor iedereen (per-campagne via socket).
//  • dienst-loop — lokaal: speelt als je een dienst opent (Herberg, Ursula…).
// De broadcast WINT altijd; de dienst-loop speelt alleen als er geen broadcast
// actief is, en hervat als die stopt. Speelt standaard op de tabletmodus; andere
// clients kunnen 't zelf aanzetten via de header-dempknop. Niet achter de DM-guard.
let _ambAudio  = null;   // broadcast
let _svcAudio  = null;   // dienst-loop
let _ambFileId = null, _ambLabel = null;
let _svcFileId = null, _svcLabel = null;
let _ambVolume = 0.5;    // mastervolume (door DM gezet)
let _ambGestureArmed = false;

// Tri-state dempvoorkeur: '1'→aan, '0'→uit, afwezig→null.
function _ambReadEnabled() {
  const v = (typeof localStorage !== 'undefined') ? localStorage.getItem('ambianceEnabled') : null;
  return v === '1' ? true : v === '0' ? false : null;
}
let _ambEnabled = _ambReadEnabled();

// Broadcast: opt-in (tablet standaard aan, rest uit tot expliciet aan).
function _ambBroadcastAllowed() { return _ambEnabled === true || (_ambEnabled === null && !!window._isDisplayMode); }
// Dienst-loop: opt-out (speelt tenzij expliciet gedempt).
function _ambServiceAllowed()   { return _ambEnabled !== false; }
// Hoort deze client nu iets (effectief)?
function _ambEffectivePlaying() {
  if (_ambFileId) return _ambBroadcastAllowed();
  if (_svcFileId) return _ambServiceAllowed();
  return false;
}

function _ambFade(a, target, done) {
  if (!a) { done?.(); return; }
  if (a._fadeIv) { clearInterval(a._fadeIv); a._fadeIv = null; }
  const clamp = v => Math.max(0, Math.min(1, v));
  const step = (target - a.volume) / 12 || (target > a.volume ? 0.08 : -0.08);
  a._fadeIv = setInterval(() => {
    let v = a.volume + step;
    const reached = step >= 0 ? v >= target : v <= target;
    if (reached) { a.volume = clamp(target); clearInterval(a._fadeIv); a._fadeIv = null; done?.(); }
    else a.volume = clamp(v);
  }, 40);
}

function _ambSet(a, fileId, shouldPlay) {
  if (!a) return;
  if (fileId && shouldPlay) {
    const src = `/api/files/${fileId}`;
    if (!a.src.endsWith(src)) { a.src = src; a.volume = 0; }
    a.play().then(() => _ambFade(a, _ambVolume)).catch(() => _ambArmGesture());
  } else {
    _ambFade(a, 0, () => { try { a.pause(); } catch { /* ok */ } });
  }
}

function _ambArmGesture() {
  if (_ambGestureArmed) return;
  _ambGestureArmed = true;
  document.addEventListener('pointerdown', () => { _ambGestureArmed = false; _ambApplyAll(); }, { once: true });
}

// Bepaal wat er speelt: broadcast wint, dienst-loop alleen als er geen broadcast is.
function _ambApplyAll() {
  if (!_ambAudio) { _ambAudio = new Audio(); _ambAudio.loop = true; _ambAudio.preload = 'auto'; }
  if (!_svcAudio) { _svcAudio = new Audio(); _svcAudio.loop = true; _svcAudio.preload = 'auto'; }
  _ambSet(_ambAudio, _ambFileId, !!_ambFileId && _ambBroadcastAllowed());
  _ambSet(_svcAudio, _svcFileId, !!_svcFileId && !_ambFileId && _ambServiceAllowed());
  window._onAmbianceChange?.({
    active:  !!(_ambFileId || _svcFileId),
    label:   _ambFileId ? _ambLabel : _svcLabel,
    enabled: _ambEffectivePlaying(),
  });
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
    _ambApplyAll();
  },
  // Dienst-loop voor het huidige scherm; section = dienst-id (of null bij verlaten).
  setServiceAmbiance(section, label) {
    const fid = section ? (_sounds.serviceAmbiance?.[section] || null) : null;
    _svcFileId = fid;
    _svcLabel  = fid ? (label || section) : null;
    _ambApplyAll();
  },
  toggleAmbiance() {
    _ambEnabled = !_ambEffectivePlaying(); // speelt iets → dempen; stil → aanzetten
    try { localStorage.setItem('ambianceEnabled', _ambEnabled ? '1' : '0'); } catch { /* ok */ }
    _ambApplyAll();
    return _ambEnabled;
  },
  ambianceState() {
    return { active: !!(_ambFileId || _svcFileId), label: _ambFileId ? _ambLabel : _svcLabel, enabled: _ambEffectivePlaying() };
  },
};

async function _initAmbianceFromLoaded() {
  const amb = _sounds.ambiance;
  if (!amb?.actief) return;
  const scene = (amb.scenes || []).find(s => s.id === amb.actief);
  if (scene) window.soundManager.setAmbiance({ actief: amb.actief, fileId: scene.fileId, label: scene.label, volume: amb.volume });
}

_loadSounds().then(_initAmbianceFromLoaded);
