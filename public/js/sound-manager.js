// ── Sound Manager ─────────────────────────────────────────────────────────────
// Plays sounds ONLY on the DM's browser.
// Socket events are handled by socket-client.js, which calls window.soundManager.*

let _sounds     = { standard: { damage: null, healing: null, win: null, loss: null, nextRound: null, nextTurn: null }, emotes: {}, playerTurn: {}, conditions: {} };
let _prevHp     = {};   // combatantId → hp
let _prevWinner = undefined;
let _prevTurn   = undefined;
let _prevRound  = undefined;

// ── Audio playback ────────────────────────────────────────────────────────────

// ── Preview (DM) ──────────────────────────────────────────────────────────────
let _previewAudio = null;
let _previewId    = null;
let _previewEinde = null;

function _previewStop() {
  if (_previewAudio) { try { _previewAudio.pause(); _previewAudio.currentTime = 0; } catch { /* ok */ } }
  _previewAudio = null;
  _previewId    = null;
  const cb = _previewEinde; _previewEinde = null;
  cb?.();
}

function _play(fileId) {
  if (!fileId) return;
  try {
    const audio = new Audio(`/api/files/${fileId}`);
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

// ── Klanken bij een tafelscherm-effect ───────────────────────────────────────
// Gemaakt in de browser, niet uit een bestand. Een dreun is een lage sinus die
// in 200 ms wegzakt met een ruisflard eroverheen; een schittering een paar hoge
// tonen met lange uitloop. Dat kost nul bestanden, geen licentiegedoe, geen
// laadtijd, het werkt offline en bij een nieuwe DM meteen. Het klinkt gemaakt —
// voor een dreun of een tik is dat prima, en wie een echte donderslag wil hangt
// er in de Geluiden-tab een eigen bestand aan (dat wint, zie `playFx`).
let _ac = null;
function _audioCtx() {
  if (!_ac) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    _ac = new C();
  }
  // Browsers zetten de context in de wacht tot er één keer geklikt is. Het
  // tafelscherm wordt door de DM omgezet, dus dat gebaar is er — maar na een
  // herstart van de tablet niet meer; dan blijft het stil in plaats van te
  // klappen zodra iemand hem aanraakt.
  if (_ac.state === 'suspended') _ac.resume().catch(() => {});
  return _ac;
}

// Een ruisbuffer van een seconde; hergebruikt, want hem elke keer vullen kost
// meer dan de klank zelf.
let _ruisBuf = null;
function _ruis(ctx) {
  if (!_ruisBuf || _ruisBuf.sampleRate !== ctx.sampleRate) {
    _ruisBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = _ruisBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return _ruisBuf;
}

// Eén toon: golfvorm, toonhoogte (eventueel glijdend), volume en lengte.
function _toon(ctx, { type = 'sine', van, naar, vol = 0.3, start = 0, duur = 0.3 }) {
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(van, t);
  if (naar && naar !== van) osc.frequency.exponentialRampToValueAtTime(Math.max(1, naar), t + duur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.04, duur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t); osc.stop(t + duur + 0.05);
}

// Een vlaag ruis door een filter: regen, wind, de flard over een dreun heen.
function _ruisvlaag(ctx, { filter = 'lowpass', freq = 900, q = 1, vol = 0.25, start = 0, duur = 0.4, loop = false }) {
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = _ruis(ctx);
  src.loop = loop;
  const f = ctx.createBiquadFilter();
  f.type = filter; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, duur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t); src.stop(t + duur + 0.05);
  return src;
}

// De recepten. De sleutel is `klank` uit `lib/display-fx.js`.
const _FX_KLANKEN = {
  dreun:    (c) => { _toon(c, { type: 'sine', van: 150, naar: 42, vol: 0.34, duur: 0.26 });
                     _ruisvlaag(c, { freq: 420, vol: 0.14, duur: 0.18 }); },
  klap:     (c) => { _toon(c, { type: 'square', van: 220, naar: 38, vol: 0.30, duur: 0.18 });
                     _ruisvlaag(c, { filter: 'bandpass', freq: 1800, q: 0.7, vol: 0.26, duur: 0.3 }); },
  hartslag: (c) => { _toon(c, { type: 'sine', van: 72, naar: 44, vol: 0.30, duur: 0.22 });
                     _toon(c, { type: 'sine', van: 66, naar: 40, vol: 0.22, start: 0.34, duur: 0.26 }); },
  gloed:    (c) => { [523.25, 659.25, 783.99].forEach((f, i) =>
                       _toon(c, { type: 'sine', van: f, vol: 0.17, start: i * 0.07, duur: 0.9 })); },
  tinkel:   (c) => { [1046.5, 1396.9, 1760, 2093].forEach((f, i) =>
                       _toon(c, { type: 'triangle', van: f, vol: 0.12, start: i * 0.05, duur: 0.7 })); },
  zwiep:    (c) => { _toon(c, { type: 'sawtooth', van: 160, naar: 1400, vol: 0.14, duur: 0.42 });
                     _ruisvlaag(c, { filter: 'highpass', freq: 1400, vol: 0.12, duur: 0.5 }); },
  donder:   (c) => { _ruisvlaag(c, { freq: 260, vol: 0.30, duur: 1.6 });
                     _toon(c, { type: 'sine', van: 64, naar: 28, vol: 0.26, start: 0.05, duur: 1.4 }); },
  rommel:   (c) => { _ruisvlaag(c, { freq: 170, vol: 0.28, duur: 1.5 });
                     _toon(c, { type: 'sine', van: 46, naar: 30, vol: 0.24, duur: 1.5 }); },
  vlaag:    (c) => { _ruisvlaag(c, { filter: 'bandpass', freq: 700, q: 0.5, vol: 0.20, duur: 1.8 }); },
  ruis:     (c) => { _ruisvlaag(c, { filter: 'highpass', freq: 1100, vol: 0.14, duur: 2.4 }); },
};

// ── Klanken bij de terugblik ("Wat voorafging") ─────────────────────────────
// Een trailer heeft twee dingen: een dreun bij de titel en een toon eronder die
// de stilte vult. De dreun is twee licht ontstemde zaagtanden door een
// laagdoorlaatfilter dat dichtknijpt, met een sub-sinus eronder en een
// ruiszwelling ervoor — de "BRAAAM". De drone is een open kwint (A en E) die
// traag ademt. Allebei te vervangen door een eigen bestand in de Geluiden-tab.
function _tbDreun(ctx, zacht) {
  const t = ctx.currentTime + 0.05;
  const vol = zacht ? 0.16 : 0.30;
  const duur = zacht ? 2.6 : 3.6;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(zacht ? 900 : 2200, t);
  f.frequency.exponentialRampToValueAtTime(140, t + duur * 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
  g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  f.connect(g).connect(ctx.destination);
  for (const [hz, type] of [[55, 'sawtooth'], [55.6, 'sawtooth'], [110.3, 'square']]) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(hz, t);
    o.frequency.exponentialRampToValueAtTime(hz * 0.94, t + duur);
    o.connect(f); o.start(t); o.stop(t + duur + 0.1);
  }
  _toon(ctx, { type: 'sine', van: 46, naar: 33, vol: zacht ? 0.22 : 0.4, start: 0.05, duur: duur * 0.9 });
  if (!zacht) _ruisvlaag(ctx, { filter: 'bandpass', freq: 500, q: 0.6, vol: 0.12, duur: 1.4 });
}

function _tbDrone(ctx) {
  const t = ctx.currentTime;
  const uit = ctx.createGain();
  uit.gain.setValueAtTime(0.0001, t);
  uit.gain.exponentialRampToValueAtTime(0.09, t + 4);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 0.8;
  f.connect(uit).connect(ctx.destination);
  const bronnen = [];
  for (const [hz, v] of [[55, 0.5], [82.41, 0.35], [110, 0.3], [164.8, 0.12]]) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
    const og = ctx.createGain(); og.gain.value = v;
    // Elke toon ademt in zijn eigen tempo; daardoor golft het geheel.
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.08;
    const lg = ctx.createGain(); lg.gain.value = v * 0.45;
    lfo.connect(lg).connect(og.gain);
    o.connect(og).connect(f);
    o.start(t); lfo.start(t);
    bronnen.push(o, lfo);
  }
  // Wind erachter, heel zacht.
  const wind = _ruisvlaag(ctx, { filter: 'bandpass', freq: 380, q: 0.4, vol: 0.05, duur: 600, loop: true });
  bronnen.push(wind);
  let gestopt = false;
  return () => {
    if (gestopt) return; gestopt = true;
    const n = ctx.currentTime;
    uit.gain.cancelScheduledValues(n);
    uit.gain.setValueAtTime(Math.max(0.0001, uit.gain.value), n);
    uit.gain.exponentialRampToValueAtTime(0.0001, n + 2.5);
    bronnen.forEach(b => { try { b.stop(n + 2.6); } catch { /* al gestopt */ } });
  };
}

// ── De brul van een Barbarian ────────────────────────────────────────────────
// Een stem is ruis door een filter dat open- en dichtgaat (de klinker), met een
// lage zaagtand eronder voor de borstkas. Het grommen zit in de modulatie: een
// LFO van ~32 Hz op het volume, zo snel dat je hem niet als ritme hoort maar
// als ruwheid. Eronder een trommelslag als inzet en daarna een hartslag die
// nog even nadreunt.
function _rageBrul(ctx) {
  const t = ctx.currentTime + 0.02;
  _toon(ctx, { type: 'sine', van: 130, naar: 38, vol: 0.5, duur: 0.55 });          // inzet
  _ruisvlaag(ctx, { filter: 'lowpass', freq: 600, vol: 0.2, duur: 0.25 });

  const duur = 1.7;
  const uit = ctx.createGain();
  uit.gain.setValueAtTime(0.0001, t);
  uit.gain.exponentialRampToValueAtTime(0.34, t + 0.12);
  uit.gain.exponentialRampToValueAtTime(0.22, t + 1.0);
  uit.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  // de ruwheid
  const grom = ctx.createGain(); grom.gain.value = 0.6;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 32;
  const diepte = ctx.createGain(); diepte.gain.value = 0.4;
  lfo.connect(diepte).connect(grom.gain);
  grom.connect(uit).connect(ctx.destination);
  // de klinker: een bandfilter dat van "oo" naar "aa" en terug zwaait
  const klinker = ctx.createBiquadFilter();
  klinker.type = 'bandpass'; klinker.Q.value = 2.2;
  klinker.frequency.setValueAtTime(320, t);
  klinker.frequency.exponentialRampToValueAtTime(1050, t + 0.35);
  klinker.frequency.exponentialRampToValueAtTime(420, t + duur);
  klinker.connect(grom);
  const ruis = ctx.createBufferSource(); ruis.buffer = _ruis(ctx); ruis.loop = true;
  ruis.connect(klinker);
  // de borstkas
  const borst = ctx.createOscillator(); borst.type = 'sawtooth';
  borst.frequency.setValueAtTime(96, t);
  borst.frequency.exponentialRampToValueAtTime(64, t + duur);
  const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 650;
  const bg = ctx.createGain(); bg.gain.value = 0.5;
  borst.connect(bf).connect(bg).connect(grom);
  for (const n of [ruis, borst, lfo]) { n.start(t); n.stop(t + duur + 0.1); }
  // en dan het hart
  [1.9, 2.75, 3.6].forEach((s, i) => {
    _toon(ctx, { type: 'sine', van: 70, naar: 42, vol: 0.28 - i * 0.07, start: s, duur: 0.22 });
    _toon(ctx, { type: 'sine', van: 64, naar: 40, vol: 0.2 - i * 0.05, start: s + 0.3, duur: 0.24 });
  });
}

// ── Klanken bij de klassekrachten ────────────────────────────────────────────
// Eén korte klank per thema, gemaakt uit dezelfde twee bouwstenen als de rest:
// een toon en een vlaag ruis. Niet bedoeld als muziek — als een accent dat
// zegt wíé er iets deed, zodat je met je ogen dicht weet of het de Cleric of de
// Rogue was.
const _KLASSE_KLANKEN = {
  bard:      (c) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
                 _toon(c, { type: 'triangle', van: f, vol: 0.14, start: i * 0.09, duur: 1.1 })),
  cleric:    (c) => { [392, 493.88, 587.33, 783.99].forEach((f) => _toon(c, { type: 'sine', van: f, vol: 0.1, duur: 2.2 }));
                      _FX_KLANKEN.tinkel(c); },
  paladin:   (c) => { _toon(c, { type: 'sine', van: 110, naar: 60, vol: 0.32, duur: 0.5 });
                      [440, 554.37, 659.25].forEach((f, i) => _toon(c, { type: 'sine', van: f, vol: 0.11, start: 0.1 + i * 0.05, duur: 1.8 })); },
  druid:     (c) => { _ruisvlaag(c, { filter: 'bandpass', freq: 900, q: 0.8, vol: 0.14, duur: 1.6 });
                      _toon(c, { type: 'sine', van: 90, naar: 55, vol: 0.28, duur: 0.6 });
                      _toon(c, { type: 'triangle', van: 330, naar: 495, vol: 0.08, start: 0.3, duur: 1.2 }); },
  fighter:   (c) => { _FX_KLANKEN.klap(c); _FX_KLANKEN.zwiep(c); },
  monk:      (c) => [0, 0.11, 0.22].forEach((s) => {
                 _toon(c, { type: 'square', van: 180, naar: 70, vol: 0.18, start: s, duur: 0.1 });
                 _ruisvlaag(c, { filter: 'highpass', freq: 2200, vol: 0.1, start: s, duur: 0.12 }); }),
  ranger:    (c) => { _toon(c, { type: 'sawtooth', van: 1800, naar: 600, vol: 0.06, duur: 0.35 });
                      _toon(c, { type: 'sine', van: 140, naar: 70, vol: 0.3, start: 0.32, duur: 0.2 }); },
  rogue:     (c) => { _ruisvlaag(c, { filter: 'highpass', freq: 3000, vol: 0.16, duur: 0.18 });
                      _toon(c, { type: 'sine', van: 70, naar: 40, vol: 0.26, start: 0.15, duur: 0.35 }); },
  sorcerer:  (c) => { _toon(c, { type: 'sawtooth', van: 120, naar: 880, vol: 0.09, duur: 0.6 });
                      _FX_KLANKEN.dreun(c); _ruisvlaag(c, { filter: 'bandpass', freq: 1200, vol: 0.12, start: 0.3, duur: 1.0 }); },
  warlock:   (c) => { _toon(c, { type: 'sawtooth', van: 110, vol: 0.08, duur: 1.6 });
                      _toon(c, { type: 'sawtooth', van: 155.56, vol: 0.07, duur: 1.6 });        // een tritonus: het klinkt fout, en dat is de bedoeling
                      _ruisvlaag(c, { filter: 'bandpass', freq: 2400, q: 4, vol: 0.06, duur: 1.8 }); },
  wizard:    (c) => { _FX_KLANKEN.tinkel(c); _FX_KLANKEN.gloed(c); },
  artificer: (c) => [0, 0.14, 0.32].forEach((s, i) =>
                 _toon(c, { type: 'square', van: 600 - i * 120, naar: 300, vol: 0.08, start: s, duur: 0.12 })),
};

// ── Klanken bij de gevechtsregie ─────────────────────────────────────────────
// De opening is drie trommelslagen die naar elkaar toe lopen en een koperachtige
// kwint erboven; de lair een rommeling uit de grond; de death saves hebben een
// hartslag (die trager wordt naarmate het slechter gaat), een gong bij een
// mislukte worp, een klokje bij een geslaagde en een zwelling bij opstaan. De
// genadeslag zuigt eerst alle klank weg — slow motion begint met stilte — en
// slaat dan.
function _koper(ctx, hz, start, duur, vol) {
  const t = ctx.currentTime + start;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(1800, t + duur * 0.35);
  f.frequency.exponentialRampToValueAtTime(400, t + duur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  f.connect(g).connect(ctx.destination);
  for (const d of [0, 0.7]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.value = hz + d;
    o.connect(f); o.start(t); o.stop(t + duur + 0.05);
  }
}

const _REGIE_KLANKEN = {
  opening: (c) => {
    [0, 0.42, 0.72, 0.9].forEach((s, i) => {
      _toon(c, { type: 'sine', van: 150, naar: 40, vol: 0.42 - i * 0.03, start: s, duur: 0.5 });
      _ruisvlaag(c, { filter: 'lowpass', freq: 500, vol: 0.16, start: s, duur: 0.22 });
    });
    _koper(c, 110, 1.05, 2.6, 0.13);
    _koper(c, 164.81, 1.15, 2.5, 0.09);
    _ruisvlaag(c, { filter: 'highpass', freq: 3000, vol: 0.08, start: 1.05, duur: 1.6 });
  },
  vs:      (c) => { _toon(c, { type: 'square', van: 260, naar: 50, vol: 0.22, duur: 0.3 });
                    _ruisvlaag(c, { filter: 'bandpass', freq: 2400, q: 0.8, vol: 0.2, duur: 0.35 }); },
  lair:    (c) => { _ruisvlaag(c, { freq: 140, vol: 0.34, duur: 2.6 });
                    _toon(c, { type: 'sine', van: 42, naar: 26, vol: 0.34, duur: 2.4 });
                    _ruisvlaag(c, { filter: 'bandpass', freq: 900, q: 0.6, vol: 0.08, start: 0.6, duur: 1.6 }); },
  ronde:   (c) => { _toon(c, { type: 'sine', van: 120, naar: 46, vol: 0.3, duur: 0.6 });
                    _toon(c, { type: 'triangle', van: 220, vol: 0.05, start: 0.05, duur: 1.4 }); },
  hart:    (c) => { _toon(c, { type: 'sine', van: 64, naar: 40, vol: 0.32, duur: 0.2 });
                    _toon(c, { type: 'sine', van: 58, naar: 38, vol: 0.24, start: 0.26, duur: 0.22 }); },
  faal:    (c) => { _toon(c, { type: 'sine', van: 98, naar: 92, vol: 0.3, duur: 3.2 });
                    _toon(c, { type: 'sine', van: 147.3, naar: 140, vol: 0.12, duur: 2.6 });
                    _toon(c, { type: 'sine', van: 233.1, vol: 0.05, duur: 1.8 }); },
  succes:  (c) => [659.25, 987.77].forEach((f, i) => _toon(c, { type: 'triangle', van: f, vol: 0.1, start: i * 0.12, duur: 1.4 })),
  stabiel: (c) => [523.25, 659.25, 783.99].forEach((f, i) => _toon(c, { type: 'sine', van: f, vol: 0.08, start: i * 0.1, duur: 2 })),
  op:      (c) => { _toon(c, { type: 'sawtooth', van: 110, naar: 440, vol: 0.06, duur: 1.2 });
                    [440, 554.37, 659.25, 880].forEach((f, i) => _toon(c, { type: 'sine', van: f, vol: 0.12, start: 0.9 + i * 0.06, duur: 2.4 }));
                    _toon(c, { type: 'sine', van: 130, naar: 50, vol: 0.4, start: 0.9, duur: 0.5 }); },
  dood:    (c) => { _toon(c, { type: 'sine', van: 65.4, naar: 60, vol: 0.4, duur: 5 });
                    _toon(c, { type: 'sine', van: 130.8, vol: 0.1, duur: 4 });
                    _toon(c, { type: 'sine', van: 196.6, vol: 0.05, start: 0.02, duur: 3.4 }); },
  vraag:   (c) => { _toon(c, { type: 'sawtooth', van: 900, naar: 60, vol: 0.06, duur: 1.4 });
                    _ruisvlaag(c, { filter: 'lowpass', freq: 2400, vol: 0.12, duur: 1.2 });
                    _toon(c, { type: 'sine', van: 55, vol: 0.1, start: 1.2, duur: 6 }); },
  slag:    (c) => { _toon(c, { type: 'sine', van: 180, naar: 30, vol: 0.55, duur: 0.9 });
                    _ruisvlaag(c, { filter: 'lowpass', freq: 900, vol: 0.32, duur: 0.5 });
                    _ruisvlaag(c, { filter: 'highpass', freq: 2600, vol: 0.12, start: 0.05, duur: 1.6 }); },
  // De overgang: drie korte piepjes bij de flitsen, dan een zaagtand die
  // omhoog jaagt terwijl de tegels dichtgaan, en een dreun als het zwart is.
  overgang:(c) => { [0, 0.13, 0.26].forEach(s => _toon(c, { type: 'square', van: 1320, naar: 1180, vol: 0.07, start: s, duur: 0.08 }));
                    _toon(c, { type: 'sawtooth', van: 180, naar: 1600, vol: 0.07, start: 0.42, duur: 0.95 });
                    _ruisvlaag(c, { filter: 'highpass', freq: 1800, vol: 0.08, start: 0.42, duur: 0.9 });
                    _toon(c, { type: 'sine', van: 140, naar: 40, vol: 0.4, start: 1.35, duur: 0.5 }); },
  tik:     (c) => { _toon(c, { type: 'square', van: 1900, naar: 1700, vol: 0.06, duur: 0.05 });
                    _toon(c, { type: 'sine', van: 90, naar: 55, vol: 0.26, start: 0.02, duur: 0.35 }); },
  afloop:  (c) => [220, 277.18, 329.63, 440].forEach((f, i) => _toon(c, { type: 'triangle', van: f, vol: 0.08, start: i * 0.35, duur: 3.4 })),
};

// ── Ambiance (feature #2) ──────────────────────────────────────────────────────
// Twee blijvende loop-Audio's:
//  • broadcast-scène — de DM zet 'm voor iedereen (per-campagne via socket).
//  • dienst-loop — lokaal: speelt als je een dienst opent (Herberg, Ursula…).
// De broadcast WINT altijd; de dienst-loop speelt alleen als er geen broadcast
// actief is, en hervat als die stopt. Speelt standaard op de tabletmodus; andere
// clients kunnen 't zelf aanzetten via de header-dempknop. Niet achter de DM-guard.
let _ambAudio  = null;   // broadcast
let _svcAudio  = null;   // dienst-loop
let _restAudio = null;   // rust-overlay-loop (transient)
let _ambFileId = null, _ambLabel = null;
let _svcFileId = null, _svcLabel = null, _svcSection = null;
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
    if (r.ok) {
      const data = await r.json();
      // Garandeer de verwachte vorm: een campagne-sounds.json hoeft standard/emotes/
      // playerTurn niet te bevatten. Zonder deze defaults werd _sounds.standard undefined
      // en crashte _onCombatUpdated ("Cannot read properties of undefined (reading 'win')").
      _sounds = {
        ...data,
        standard:   data.standard   || {},
        emotes:     data.emotes     || {},
        playerTurn: data.playerTurn || {},
        conditions: data.conditions || {},
      };
    }
  } catch { /* ok */ }
}

// ── Conditie-geluiden ─────────────────────────────────────────────────────────
// Spelen bewust op het TAFELSCHERM en niet op de DM-laptop: het geluid hoort bij
// de spelers aan tafel te klinken. Daarom draait dit vóór de DM-guard in
// _onCombatUpdated, en alleen in display-modus — zo klinkt het ook niet dubbel
// wanneer de DM tegelijk een venster open heeft.
let _prevConds   = {};      // combatantId → Set van conditie-id's
let _condsPrimed = false;   // eerste update na laden: alleen vastleggen, niet spelen
let _condRound   = undefined;  // laatst gehoorde ronde (voor de concentration-reminder)

// Zwaarste eerst. Zet de DM er drie tegelijk aan, dan klinkt alleen de bovenste;
// anders krijg je een salvo. Zelfde gedachte als CONDITION_PRIORITY in combat-canvas.js.
const _COND_SEVERITY = [
  'unconscious', 'petrified', 'paralyzed', 'stunned', 'incapacitated',
  'burning', 'bleeding', 'poisoned', 'charmed', 'frightened', 'blinded',
  'restrained', 'grappled', 'exhaustion', 'deafened', 'invisible', 'prone',
  'concentration',
];
const _condRank = (id) => {
  const i = _COND_SEVERITY.indexOf(id);
  return i === -1 ? _COND_SEVERITY.length : i;   // onbekend → achteraan
};

function _onConditionsUpdated(combat) {
  if (!window._isDisplayMode) return;
  if (!combat?.active) { _prevConds = {}; _condsPrimed = false; _condRound = undefined; return; }

  const nieuwe = [];
  const ids    = new Set();
  for (const c of (combat.combatants || [])) {
    ids.add(c.id);
    const nu     = new Set((c.conditions || []).filter(x => typeof x === 'string'));
    const eerder = _prevConds[c.id];
    if (_condsPrimed && eerder) {
      // Concentration loopt niet via dit pad: dat is geen eenmalig signaal maar
      // een herinnering die elke ronde opnieuw klinkt (zie hieronder).
      for (const id of nu) if (!eerder.has(id) && id !== 'concentration') nieuwe.push(id);
    }
    _prevConds[c.id] = nu;
  }
  // Verdwenen combatants opruimen, anders groeit de map het hele gevecht door.
  for (const id of Object.keys(_prevConds)) if (!ids.has(id)) delete _prevConds[id];

  // Kom je midden in een gevecht binnen, dan zijn álle bestaande conditions
  // "nieuw" t.o.v. een lege map. Eerste ronde dus alleen vastleggen.
  if (!_condsPrimed) { _condsPrimed = true; _condRound = combat.round; return; }

  const map = _sounds.conditions || {};

  // Nieuwe conditie? Zwaarste met een ingesteld geluid wint.
  if (nieuwe.length) {
    nieuwe.sort((a, b) => _condRank(a) - _condRank(b));
    const zwaarste = nieuwe.find(id => map[id]);
    if (zwaarste) { _condRound = combat.round; _play(map[zwaarste]); return; }
  }

  // Concentration-reminder: zolang er iemand concentreert klinkt hij bij elke
  // nieuwe ronde opnieuw, als geheugensteun aan tafel. Alleen als er verder
  // niets te horen viel deze tick — anders overlappen twee geluiden.
  const nieuweRonde = _condRound !== undefined && combat.round > _condRound;
  _condRound = combat.round;
  if (!nieuweRonde || !map.concentration) return;
  const concentreert = (combat.combatants || [])
    .some(c => (c.hp ?? 1) > 0 && (c.conditions || []).includes('concentration'));
  if (concentreert) _play(map.concentration);
}

// ── Combat state tracking (HP changes + winner) ───────────────────────────────

function _onCombatUpdated(combat) {
  // Conditie-geluiden horen op het tafelscherm, dus vóór de DM-guard hieronder.
  // _loadSounds() is fire-and-forget: bij de allereerste update speelt er toch
  // niets (_condsPrimed), dus tegen de tweede update is de config binnen.
  if (window._isDisplayMode) { _loadSounds(); _onConditionsUpdated(combat); }

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
  // Wat er bij het laden van de module gebeurt, maar dan op aanvraag: voor wie
  // via de landingspagina binnenkomt is dat moment al voorbij.
  start: () => _loadSounds().then(_initAmbianceFromLoaded),
  // Herlaad de sound-config en pas de loop van het huidige scherm opnieuw toe
  // (zodat een net door de DM ingestelde dienst-loop direct begint te spelen).
  async refreshConfig() {
    await _loadSounds();
    this.setServiceAmbiance(_svcSection, _svcLabel);
  },

  // ── Ambiance (feature #2) ──
  setAmbiance({ actief, fileId, label, volume } = {}) {
    if (typeof volume === 'number') _ambVolume = volume;
    _ambFileId = actief ? (fileId || null) : null;
    _ambLabel  = actief ? (label || _ambLabel) : null;
    _ambApplyAll();
  },
  // Dienst-loop voor het huidige scherm; section = serviceAmbiance-key (of null bij verlaten).
  setServiceAmbiance(section, label) {
    _svcSection = section || null;
    const fid = section ? (_sounds.serviceAmbiance?.[section] || null) : null;
    _svcFileId = fid;
    _svcLabel  = fid ? (label || section) : null;
    _ambApplyAll();
  },
  // Geluid bij een reveal (regie-balk). loop → wordt de (loopende) ambiance op
  // de tablet; anders een eenmalige sting over de huidige ambiance heen.
  playReveal({ fileId, label, loop } = {}) {
    if (!fileId) return;
    if (loop) this.setAmbiance({ actief: 'reveal', fileId, label: label || 'Reveal', volume: _ambVolume });
    else _play(fileId);
  },
  // De klank bij een tafelscherm-effect. Een eigen bestand uit de Geluiden-tab
  // wint; staat er niets, dan synthetiseren we het recept uit de catalogus.
  // Niets ingesteld én geen recept → stilte, en dat is een geldige uitkomst.
  playFx({ fileId, klank } = {}) {
    if (fileId) { _play(fileId); return; }
    const maak = klank && _FX_KLANKEN[klank];
    if (!maak) return;
    const ctx = _audioCtx();
    if (!ctx) return;
    try { maak(ctx); } catch { /* een stil effect is beter dan een fout */ }
  },
  // Het accent bij een klassekracht op het tafelscherm.
  klasseKlank(thema) {
    const maak = _KLASSE_KLANKEN[thema];
    const ctx = maak && _audioCtx();
    if (!ctx) return;
    try { maak(ctx); } catch { /* stil is ook een uitkomst */ }
  },
  // Rage: 'brul' als hij erin gaat, 'doof' (een uitademing) als hij dooft.
  regieKlank(soort) {
    const ctx = _audioCtx();
    if (!ctx) return;
    try { _REGIE_KLANKEN[soort]?.(ctx); } catch { /* stil is ook een uitkomst */ }
  },
  rageKlank(soort) {
    const ctx = _audioCtx();
    if (!ctx) return;
    try {
      if (soort === 'brul') _rageBrul(ctx);
      else if (soort === 'doof') _ruisvlaag(ctx, { filter: 'lowpass', freq: 420, vol: 0.12, duur: 1.4 });
    } catch { /* stil is ook een uitkomst */ }
  },
  // De terugblik: 'dreun', 'dreunZacht', 'tik' klinken één keer; 'drone' blijft
  // klinken en geeft een stopfunctie terug (die hem in 2,5 s laat wegsterven).
  terugblikKlank(soort) {
    const ctx = _audioCtx();
    if (!ctx) return () => {};
    try {
      if (soort === 'drone') return _tbDrone(ctx);
      if (soort === 'dreun' || soort === 'dreunZacht') _tbDreun(ctx, soort === 'dreunZacht');
      else if (soort === 'tik') _toon(ctx, { type: 'triangle', van: 1318.5, naar: 1240, vol: 0.07, duur: 0.9 });
    } catch { /* stil is ook een uitkomst */ }
    return () => {};
  },
  // Rust-sfeerloop tijdens de rust-overlay (party-breed, transient). Eigen audio,
  // los van broadcast/dienst-loop; respecteert dezelfde dempvoorkeur als de dienst-loop.
  playRestLoop(fileId) {
    if (!_restAudio) { _restAudio = new Audio(); _restAudio.loop = true; _restAudio.preload = 'auto'; }
    if (!fileId || !_ambServiceAllowed()) { _ambSet(_restAudio, null, false); return; }
    _ambSet(_restAudio, fileId, true);
  },
  stopRestLoop() { if (_restAudio) _ambSet(_restAudio, null, false); },

  // Lokale preview (DM) van een geluidsbestand zonder broadcast.
  // Werkt als toggle: dezelfde knop nog eens indrukken stopt het. Voorheen maakte
  // _play() een losse Audio zonder referentie, dus je kon een fragment alleen
  // uitzitten. onStop wordt aangeroepen bij zowel handmatig stoppen als afgelopen,
  // zodat de knop zijn icoon kan terugzetten.
  preview(fileId, onStop) {
    const zelfde = _previewId === fileId;
    _previewStop();
    if (!fileId || zelfde) return false;
    const a = new Audio(`/api/files/${fileId}`);
    _previewAudio = a;
    _previewId    = fileId;
    _previewEinde = onStop || null;
    a.addEventListener('ended', () => { if (_previewId === fileId) _previewStop(); });
    a.play().catch(() => _previewStop());
    return true;
  },
  stopPreview() { _previewStop(); },
  previewingId() { return _previewId; },
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

// Bij het laden van de module, maar alleen voor wie binnen is: de route vraagt
// een sessie, en een bezoeker op de landingspagina kreeg hier een 401 in zijn
// console. Hij heeft ook niets aan de sfeerlus — die begint pas als er iemand
// kijkt. Wie daarna inlogt haalt hem alsnog op (`reloadSounds`, aangeroepen bij
// elke sounds:updated en bij het starten van de sfeer).
if (window.app?.state?.role === 'dm' || window.app?.state?.characterId || window._isDisplayMode) {
  _loadSounds().then(_initAmbianceFromLoaded);
}
