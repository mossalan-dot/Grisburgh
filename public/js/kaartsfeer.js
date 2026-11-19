// ════════════════════════════════════════════════════════════════════════════
//  SFEER BIJ HET VERGROTEN — één catalogus, zes figuren
// ════════════════════════════════════════════════════════════════════════════
// Een kaartje vergroten is in deze app één gebaar: de tegel groeit uit tot een
// venster (`_tegelVensterUit` in render-campagne.js). Dat gebaar is overal
// hetzelfde en zegt dus overal hetzelfde — terwijl de ene kaart een Fireball is
// en de andere een god. Dit bestand geeft dat moment een korte klank in beeld:
// anderhalve seconde deeltjes over het venster, in de kleur en de vorm die bij
// de inhoud horen.
//
// **Het is sfeer, geen mededeling.** Er staat niets in dat je niet ook op de
// kaart zelf kunt lezen, hij is niet aan te klikken, en wie
// `prefers-reduced-motion` aan heeft krijgt hem niet. Een speler die hem mist,
// mist geen informatie.
//
// **Eén catalogus, geen vier.** Spreuken (op schadesoort), conditions (op wat
// de toestand met je doet), goden (op domein) en antagonisten vragen allemaal
// hetzelfde en zouden anders allemaal hun eigen deeltjes krijgen. Daarom:
// `SFEER` is een sleutel → kleuren + figuur, en de aanroeper zegt alleen welke
// sleutel. Een nieuwe plek is dus een regel in de tabel hieronder, geen nieuwe
// animatie.
//
// Aanroepen hoef je zelf niet: `_tegelVensterUit({ sfeer: 'fire' })` doet het.

// Zes figuren, en meer hoeven er niet te zijn — ze dekken de vier manieren
// waarop iets in dit spel gebeurt: het stijgt op, het valt, het haalt uit of
// het hangt om je heen.
//   vonken   — stijgt op en dooft (vuur, licht, een zegen)
//   scherven — valt en tolt (ijs, zuur, iets dat afbrokkelt)
//   halen    — strepen dwars over het vel (snijden, doorboren)
//   golven   — ringen vanuit het midden (donder, kracht, een klap)
//   flits    — één gekartelde lijn, twee keer (bliksem)
//   waas     — trage wolken (gif, necrotisch, psychisch, betoverd)
const DUUR = 1500;

export const SFEER = {
  // ── Schadesoorten (een spreuk) ──
  acid:        { figuur: 'scherven', c: ['#7ac043', '#3f7a12'] },
  bludgeoning: { figuur: 'golven',   c: ['#e0d4bc', '#6a5a44'] },
  cold:        { figuur: 'scherven', c: ['#bfe6ff', '#4a90c0'] },
  fire:        { figuur: 'vonken',   c: ['#ffcf6a', '#e0601a'] },
  force:       { figuur: 'golven',   c: ['#d9c0ff', '#7a4ac0'] },
  lightning:   { figuur: 'flits',    c: ['#fff6c0', '#5fa8e8'] },
  necrotic:    { figuur: 'waas',     c: ['#7a8a6a', '#24301c'] },
  piercing:    { figuur: 'halen',    c: ['#e8e2d0', '#8a8070'] },
  poison:      { figuur: 'waas',     c: ['#9fd14a', '#2f5a14'] },
  psychic:     { figuur: 'waas',     c: ['#f0a0e0', '#8a2a80'] },
  radiant:     { figuur: 'vonken',   c: ['#fff4cf', '#e0b040'] },
  slashing:    { figuur: 'halen',    c: ['#ffd9d0', '#a03a20'] },
  thunder:     { figuur: 'golven',   c: ['#cfe4f5', '#3a6a90'] },
  healing:     { figuur: 'vonken',   c: ['#d8f5c8', '#3a9a50'] },

  // ── Conditions ──
  // Wat de toestand met je doet, niet in welke groep hij staat: Restrained en
  // Grappled houden je vast (vallen), Blinded en Charmed hangen om je heen
  // (waas), Raging en Haste laaien op (vonken).
  'cond-vast':   { figuur: 'scherven', c: ['#c9b89a', '#5a4a30'] },
  'cond-waas':   { figuur: 'waas',     c: ['#c0a8d8', '#4a2a6a'] },
  'cond-op':     { figuur: 'vonken',   c: ['#ffd98a', '#c06a10'] },
  'cond-klap':   { figuur: 'golven',   c: ['#e0d0b0', '#7a5a2a'] },
  'cond-scherp': { figuur: 'halen',    c: ['#ffdcc8', '#8a3a1a'] },

  // ── Goden en antagonisten ──
  // Een god stijgt op, een antagonist hangt er. Het domein kleurt mee; staat er
  // geen domein, dan blijft het goud — dat is de kleur van de tempel zelf.
  god:         { figuur: 'vonken',   c: ['#fff0c0', '#c4a87a'] },
  antagonist:  { figuur: 'waas',     c: ['#a04040', '#1a0c08'] },
};

// Drie tabellen, in deze volgorde doorzocht. Een schadesoort is het meest
// specifiek ("12d8 necrotic"), een domein en een school zijn de terugval voor
// een kaart die niets kapotmaakt — een Shield, een god van de Dood.
//
// **Waarom niet gewoon de kleur van `_sbDiceColor`?** Die geeft één kleur en
// geen vorm, en juist de vorm doet hier het werk: vuur stijgt op en ijs valt,
// ook al zijn ze allebei "een kleur".
// De schadesoorten uit de PHB, als woorden om in een tekst te zoeken. Bewust
// een eigen lijst en niet "alle sleutels van SFEER": daar staan ook `god` en
// `antagonist` in, en die woorden kunnen gewoon in een beschrijving staan.
const SCHADE = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder', 'healing'];
const ALIAS = { heal: 'healing', ice: 'cold', frost: 'cold', bludgeon: 'bludgeoning', pierc: 'piercing', slash: 'slashing' };
const DOMEIN = {
  light: 'radiant', life: 'healing', tempest: 'lightning', war: 'slashing',
  death: 'necrotic', grave: 'necrotic', nature: 'poison', trickery: 'psychic',
  knowledge: 'psychic', forge: 'fire', twilight: 'psychic', order: 'force',
  peace: 'healing', arcana: 'force',
};
const SCHOOL = {
  abjuration: 'force', conjuration: 'radiant', divination: 'psychic',
  enchantment: 'psychic', evocation: 'fire', illusion: 'psychic',
  necromancy: 'necrotic', transmutation: 'force',
};

// Welke sfeer hoort bij wat er op de kaart staat? Eén plek, zodat de
// aanroepers geen eigen regexjes houden. Geef er gerust meer tekst aan dan
// nodig — de schadesoort wint van de school, en die van niets.
export function sfeerSleutel(tekst, terugval = '') {
  const t = String(tekst || '').toLowerCase();
  for (const k of SCHADE) if (t.includes(k)) return k;
  for (const [k, v] of Object.entries(ALIAS)) if (t.includes(k)) return v;
  for (const [k, v] of Object.entries(DOMEIN)) if (t.includes(k)) return v;
  for (const [k, v] of Object.entries(SCHOOL)) if (t.includes(k)) return v;
  return terugval;
}

// ── Conditions ──
// Niet op groep maar op wat de toestand met je doet: Restrained houdt je vast,
// Charmed hangt om je heen, Raging laait op. Wat er niet in staat valt terug op
// zijn groep (zie `conditions.js`), en dat is precies goed genoeg — de sfeer is
// sfeer, geen mededeling.
const COND_SFEER = {
  grappled: 'cond-vast', restrained: 'cond-vast', prone: 'cond-vast',
  paralyzed: 'cond-vast', petrified: 'cond-vast', unconscious: 'cond-vast',
  grappling: 'cond-vast', mounted: 'cond-vast', stunned: 'cond-klap',
  blinded: 'cond-waas', charmed: 'cond-waas', frightened: 'cond-waas',
  deafened: 'cond-waas', invisible: 'cond-waas', hidden: 'cond-waas',
  poisoned: 'poison', burning: 'fire', bleeding: 'slashing',
  raging: 'cond-op', haste: 'cond-op', blessed: 'radiant',
  'innate-sorcery': 'force', 'tides-of-chaos': 'psychic',
  'twilight-sanctuary': 'cond-waas', 'wild-shape': 'cond-scherp',
  "hunters-mark": 'cond-scherp', 'steady-aim': 'cond-scherp',
  'bardic-inspiration': 'radiant', 'vigilant-blessing': 'radiant',
  resistance: 'cond-klap', 'patient-defense': 'cond-klap',
  dodging: 'cond-klap', readied: 'cond-klap',
  'cover-half': 'cond-klap', 'cover-three-quarters': 'cond-klap',
  exhaustion: 'necrotic', incapacitated: 'cond-waas',
  concentration: 'psychic', flying: 'cond-op', underwater: 'cold',
};
const GROEP_SFEER = { conditie: 'cond-waas', situatie: 'cond-klap', klasse: 'cond-op' };

export function sfeerVanConditie(id, groep) {
  return COND_SFEER[id] || GROEP_SFEER[groep] || 'cond-waas';
}

// ── De deeltjes ─────────────────────────────────────────────────────────────
const rnd = (a, b) => a + Math.random() * (b - a);

// **Een verloop naar `transparent` geeft een vieze rand.** De browser rekent
// `transparent` als zwart-met-alpha-nul en mengt dáárnaartoe, dus loopt elk
// deeltje via grijs naar niets — op perkament zie je dat als een ring om elke
// vonk. Naar dezelfde kleur met alpha nul lopen doet dat niet.
const WEG = (hex) => {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
};

function _vullen(figuur, w, h) {
  const uit = [];
  if (figuur === 'vonken') {
    for (let i = 0; i < 46; i++) uit.push({
      x: rnd(0, w), y: rnd(h * 0.55, h * 1.05), r: rnd(1.2, 3.4),
      vy: rnd(-0.55, -0.16) * (h / 400), vx: rnd(-0.22, 0.22), traag: rnd(0, 0.35),
      zwaai: rnd(0.6, 2.2), fase: rnd(0, 6.283),
    });
  } else if (figuur === 'scherven') {
    for (let i = 0; i < 34; i++) uit.push({
      x: rnd(0, w), y: rnd(-h * 0.25, h * 0.35), len: rnd(6, 17),
      vy: rnd(0.3, 0.95) * (h / 400), vx: rnd(-0.18, 0.18),
      hoek: rnd(0, 6.283), draai: rnd(-0.07, 0.07), traag: rnd(0, 0.3),
    });
  } else if (figuur === 'halen') {
    for (let i = 0; i < 7; i++) uit.push({
      x: rnd(-w * 0.15, w * 0.6), y: rnd(0, h), len: rnd(w * 0.45, w * 0.95),
      hoek: rnd(-0.5, -0.15) + (i % 2 ? 0.75 : 0), dik: rnd(1.5, 4),
      traag: i * 0.08 + rnd(0, 0.05),
    });
  } else if (figuur === 'golven') {
    for (let i = 0; i < 5; i++) uit.push({
      x: w / 2, y: h / 2, traag: i * 0.11, dik: rnd(1.5, 3.5),
      eind: Math.hypot(w, h) * rnd(0.45, 0.62),
    });
  } else if (figuur === 'flits') {
    for (let i = 0; i < 2; i++) {
      const punten = [];
      let x = rnd(w * 0.2, w * 0.8);
      for (let y = -10; y < h + 10; y += h / 9) { punten.push([x, y]); x += rnd(-w * 0.14, w * 0.14); }
      uit.push({ punten, traag: i * 0.26 + 0.04, dik: rnd(1.8, 3.2) });
    }
  } else { // waas
    for (let i = 0; i < 16; i++) uit.push({
      x: rnd(-w * 0.1, w * 1.1), y: rnd(-h * 0.1, h * 1.1), r: rnd(h * 0.12, h * 0.3),
      vx: rnd(-0.2, 0.2), vy: rnd(-0.16, 0.08), traag: rnd(0, 0.4),
    });
  }
  return uit;
}

// Hoe helder iets is op moment `p` (0…1): op en weer af, met een eigen aanloop.
function _leven(p, traag) {
  const q = (p - traag) / (1 - traag);
  if (q <= 0 || q >= 1) return 0;
  return Math.sin(q * Math.PI);
}

function _teken(ctx, figuur, deeltjes, p, c, w, h, donkerder) {
  const [licht, diep] = c;
  if (figuur === 'vonken') {
    for (const d of deeltjes) {
      const a = _leven(p, d.traag); if (!a) continue;
      const y = d.y + d.vy * p * h * 1.1;
      const x = d.x + d.vx * p * w * 0.3 + Math.sin(p * 6 + d.fase) * d.zwaai * 4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, d.r * 4);
      g.addColorStop(0, licht); g.addColorStop(0.35, diep); g.addColorStop(1, WEG(diep));
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, d.r * 4, 0, 6.283); ctx.fill();
    }
  } else if (figuur === 'scherven') {
    ctx.lineCap = 'round';
    for (const d of deeltjes) {
      const a = _leven(p, d.traag); if (!a) continue;
      const y = d.y + d.vy * p * h * 1.2, x = d.x + d.vx * p * w * 0.3;
      const hoek = d.hoek + d.draai * p * 60;
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = p < 0.5 ? licht : diep;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(hoek) * d.len / 2, y - Math.sin(hoek) * d.len / 2);
      ctx.lineTo(x + Math.cos(hoek) * d.len / 2, y + Math.sin(hoek) * d.len / 2);
      ctx.stroke();
    }
  } else if (figuur === 'halen') {
    ctx.lineCap = 'round';
    for (const d of deeltjes) {
      const q = (p - d.traag) / 0.42;
      if (q <= 0 || q >= 1.6) continue;
      const uit = Math.min(1, q), vaag = q > 1 ? 1 - (q - 1) / 0.6 : 1;
      ctx.globalAlpha = Math.max(0, vaag) * 0.85;
      const g = ctx.createLinearGradient(d.x, d.y, d.x + Math.cos(d.hoek) * d.len, d.y + Math.sin(d.hoek) * d.len);
      g.addColorStop(0, WEG(licht)); g.addColorStop(0.45, licht);
      g.addColorStop(0.7, diep); g.addColorStop(1, WEG(diep));
      ctx.strokeStyle = g; ctx.lineWidth = d.dik;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + Math.cos(d.hoek) * d.len * uit, d.y + Math.sin(d.hoek) * d.len * uit);
      ctx.stroke();
    }
  } else if (figuur === 'golven') {
    for (const d of deeltjes) {
      const a = _leven(p, d.traag); if (!a) continue;
      const q = (p - d.traag) / (1 - d.traag);
      ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = q < 0.4 ? licht : diep;
      ctx.lineWidth = d.dik * (1 - q * 0.6);
      ctx.beginPath(); ctx.arc(d.x, d.y, d.eind * q, 0, 6.283); ctx.stroke();
    }
  } else if (figuur === 'flits') {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const d of deeltjes) {
      const q = (p - d.traag) / 0.2;
      if (q <= 0 || q >= 1) continue;
      // Een bliksem knippert: twee korte aanwezigheden in plaats van een
      // vloeiende op-en-neer. Vandaar de blokgolf en niet `_leven`.
      const aan = Math.sin(q * Math.PI * 3) > 0 ? 1 : 0.25;
      ctx.globalAlpha = aan * (1 - q) * 0.9;
      for (const [kleur, dik] of [[diep, d.dik * 3.5], [licht, d.dik]]) {
        ctx.strokeStyle = kleur; ctx.lineWidth = dik;
        ctx.beginPath();
        d.punten.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
  } else {
    for (const d of deeltjes) {
      const a = _leven(p, d.traag); if (!a) continue;
      const x = d.x + d.vx * p * w * 0.4, y = d.y + d.vy * p * h * 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, d.r);
      g.addColorStop(0, licht); g.addColorStop(0.5, diep); g.addColorStop(1, WEG(diep));
      // Zachter dan de rest: een waas ligt over de hele kaart, dus ook over de
      // tekst. Wat je niet meer kunt lezen is geen sfeer meer.
      ctx.globalAlpha = a * (donkerder ? 0.5 : 0.3);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, 6.283); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ── Afspelen ────────────────────────────────────────────────────────────────
// Het doek hangt **boven** het venster en niet erin: het venster scrollt, en
// een laag die meescrollt is geen sfeer maar een vlek. Daarom een vast doek op
// de maat van het venster, opgemeten nadat het is uitgegroeid.
let _bezig = null;

// **Welke kant op mengen hangt af van waar het doek ligt.** Over licht
// perkament moet hij kleuren (`multiply`), want optellend licht wordt daar wit;
// over het donkere paneel van een dienst moet hij juist oplichten (`screen`),
// want vermenigvuldigen met donker geeft zwart. Eén sfeer, twee ondergronden —
// dus lezen we de ondergrond in plaats van hem te gokken.
function _donker(el) {
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) continue;
    const [r, g, b, a = '1'] = m[1].split(',').map(x => parseFloat(x));
    if (a < 0.35) continue;          // te doorzichtig om iets over te zeggen
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
  }
  return false;
}

export function speelSfeer(venster, sleutel) {
  if (_bezig) { _bezig.remove(); _bezig = null; }
  const spec = SFEER[sleutel];
  if (!venster || !spec) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const r = venster.getBoundingClientRect();
  if (!r.width || !r.height) return;

  const donker = _donker(venster);
  const cv = document.createElement('canvas');
  cv.className = 'kaartsfeer';
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, {
    left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    mixBlendMode: donker ? 'screen' : 'multiply',
  });
  document.body.appendChild(cv);
  _bezig = cv;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  // Op een donkere ondergrond tellen de deeltjes bij elkaar op, zoals vonken
  // dat doen; op perkament schilderen ze over elkaar heen.
  if (donker) ctx.globalCompositeOperation = 'lighter';
  // **Niet `lighter`.** Het venster is licht perkament, en optellend licht op
  // iets dat al bijna wit is levert wit op: je ziet niets. Het doek ligt in
  // plaats daarvan op `multiply` (zie theme.css), dus de deeltjes **kleuren**
  // het perkament in plaats van het te verlichten — en dan moeten ze hier
  // gewoon over elkaar heen schilderen.

  const deeltjes = _vullen(spec.figuur, r.width, r.height);
  const t0 = performance.now();
  (function stap(nu) {
    if (_bezig !== cv) return;
    const p = (nu - t0) / DUUR;
    if (p >= 1 || !cv.isConnected) { cv.remove(); if (_bezig === cv) _bezig = null; return; }
    ctx.clearRect(0, 0, r.width, r.height);
    _teken(ctx, spec.figuur, deeltjes, p, spec.c, r.width, r.height, donker);
    requestAnimationFrame(stap);
  })(t0);
}

export function stopSfeer() {
  if (_bezig) { _bezig.remove(); _bezig = null; }
}

window._kaartSfeer = speelSfeer;
window._kaartSfeerStop = stopSfeer;
window._kaartSfeerSleutel = sfeerSleutel;
window._kaartSfeerConditie = sfeerVanConditie;
