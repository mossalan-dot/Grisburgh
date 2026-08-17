/* ============================================================================
   HP-GRIMOIRE — render-engine (vanilla ES-module, geen bundler; Grisburgh-stijl).
   Haalt /api/grimoire op en bouwt per spreuk een pagina in de stijl van de
   'scribe' die hem schreef. Diagrammen worden uit data getekend (SVG) en
   animeren zich in beeld ('draw-on').
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);

// Incantatie-koptekstfont per scribe: oude handen formeel-gegraveerd,
// jonge handen gekrabbeld. (De brood-hand staat in de data zelf.)
const TITLE_FONTS = {
  founder:      "'UnifrakturMaguntia', 'Cinzel Decorative', serif",
  calligrapher: "'Cinzel Decorative', serif",
  scholar:      "'MedievalSharp', serif",
  hasty:        "'Caveat', cursive",
  youngest:     "'Shadows Into Light', cursive",
};

let KLEURMAP = {};

// Klein hulpje: maak een SVG-element met attributen.
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// spellColour → accentkleur (voor gloed + drop cap + diagram-accent).
function accentFor(spell) {
  const c = spell.spellColour;
  if (!c || c === 'N/A') return 'var(--goud)';
  return KLEURMAP[c] || 'var(--goud)';
}

// ── Wand-movement diagram → SVG ──────────────────────────────────────────────
// Punten op een 0..100 grid; streken worden lijnen of quadratische bochten.
// De totale lengte per streek zetten we als dash zodat hij zich 'tekent'.
function bouwDiagram(mv) {
  const wrap = document.createElement('figure');
  wrap.className = 'figure';

  const svg = svgEl('svg', { viewBox: mv.viewBox || '0 0 100 100' });

  // Pijlpunt-markering (in de inktkleur van de scribe).
  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'arrow', viewBox: '0 0 10 10', refX: '8', refY: '5',
    markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse',
  });
  const arrowPath = svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--ink)' });
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const pt = Object.fromEntries((mv.points || []).map(p => [p.n, p]));
  const strokePaths = [];

  // Streken (met optionele bocht).
  for (const s of (mv.strokes || [])) {
    const a = pt[s.from], b = pt[s.to];
    if (!a || !b) continue;
    let d;
    if (s.curve) {
      // Controlepunt loodrecht op het midden van de lijn, offset ~ curve * lengte.
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;               // loodrechte richting
      const off = s.curve * len * 0.5;
      d = `M ${a.x} ${a.y} Q ${mx + nx * off} ${my + ny * off} ${b.x} ${b.y}`;
    } else {
      d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    }
    const path = svgEl('path', { d, class: 'fig-stroke', 'marker-end': 'url(#arrow)' });
    svg.appendChild(path);
    strokePaths.push(path);

    // Streek-label (push/pull/slow/fast…) bij het midden.
    if (s.label) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const t = svgEl('text', { x: mx + 2, y: my - 2, class: 'fig-strokelabel' });
      t.textContent = s.label;
      svg.appendChild(t);
    }
  }

  // Knooppunten + Romeinse cijfers.
  for (const p of (mv.points || [])) {
    svg.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 2.2, class: 'fig-node' }));
    const label = svgEl('text', { x: p.x - 1.5, y: p.y - 4, class: 'fig-numeral' });
    label.textContent = p.n;
    svg.appendChild(label);
  }

  wrap.appendChild(svg);

  if (mv.caption) {
    const cap = document.createElement('figcaption');
    cap.className = 'figure-caption';
    cap.textContent = mv.caption;
    wrap.appendChild(cap);
  }

  // Dash klaarzetten voor de draw-on (na plaatsing in DOM meet je de lengte).
  wrap._prep = () => {
    strokePaths.forEach((p, i) => {
      const L = p.getTotalLength();
      p.style.strokeDasharray = L;
      p.style.strokeDashoffset = L;
      p.style.transitionDelay = (i * 0.45) + 's';
    });
  };
  wrap._draw = () => strokePaths.forEach(p => { p.style.strokeDashoffset = '0'; });

  return wrap;
}

// ── Statblok (inkt-tabel) ────────────────────────────────────────────────────
function bouwStatblok(spell) {
  const rows = [
    ['Pronunciation', spell.pronunciation],
    ['Sort',          spell.sort],
    ['Difficulty',    spell.difficulty],
    ['Non-Verbal',    spell.nonVerbal],
    ['Spell Colour',  spell.spellColour],
    ['Dodge',         fmtScore(spell.dodge)],
    ['Block',         fmtScore(spell.block)],
  ];
  const box = document.createElement('div');
  box.className = 'statblock';
  for (const [label, val] of rows) {
    if (val == null || val === '') continue;
    const row = document.createElement('div');
    row.className = 'statblock-row';
    row.innerHTML =
      `<span class="statblock-label">${esc(label)}</span>` +
      `<span class="statblock-val">${val}</span>`;
    box.appendChild(row);
  }
  return box;
}
// n → "n/10", 'N/A' blijft 'N/A'.
function fmtScore(v) {
  if (v == null) return null;
  if (v === 'N/A') return 'N/A';
  return `${v}<span class="slash">/</span>10`;
}

// ── Eén spreukpagina ─────────────────────────────────────────────────────────
function bouwSpell(spell, scribes, index) {
  const scribe = scribes[spell.scribe] || {};
  const accent = accentFor(spell);

  const art = document.createElement('article');
  art.className = 'spell';
  art.id = spell.id;
  // Per-spreuk stijlvariabelen: dit stuurt de hele 'hand'.
  art.style.setProperty('--ink', scribe.ink || 'var(--inkt-default)');
  art.style.setProperty('--hand', scribe.font || "'Cardo', serif");
  art.style.setProperty('--hand-title', TITLE_FONTS[spell.scribe] || "'Cinzel Decorative', serif");
  art.style.setProperty('--slant', (scribe.slant || 0) + 'deg');
  art.style.setProperty('--scale', scribe.scale || 1);
  art.style.setProperty('--accent', accent);
  art.style.setProperty('--age', scribe.veroudering ?? 1);
  art.style.setProperty('--rot', (spell.rotatie || 0) + 'deg');
  art.style.setProperty('--cols', spell.columns || 1);

  // Scheidingslijn boven elke spreuk behalve de eerste.
  if (index > 0) {
    const div = document.createElement('div');
    div.className = 'spell-divider';
    div.innerHTML = ornamentRule();
    art.appendChild(div);
  }

  // Kop + badge.
  const head = document.createElement('div');
  head.className = 'spell-head';
  const ref = spell.refnr ? `<span class="refnr">${esc(spell.refnr)}</span>` : '';
  head.innerHTML =
    `<span class="spell-badge ${spell.canon ? 'is-canon' : 'is-fanon'}">${spell.canon ? 'canon' : 'fanon'}</span>` +
    `<h2 class="spell-name">${esc(spell.naam)}${ref}</h2>` +
    (spell.classificatie ? `<p class="spell-class">${esc(spell.classificatie)}</p>` : '');
  art.appendChild(head);

  // Statblok (zweeft links).
  art.appendChild(bouwStatblok(spell));

  // Diagram of sigil (zweeft rechts).
  let fig = null;
  if (spell.movement) { fig = bouwDiagram(spell.movement); art.appendChild(fig); }
  else if (spell.sigil) { art.appendChild(bouwSigil(spell.sigil)); }

  // Proza (kolommen + drop cap op de eerste paragraaf).
  const body = document.createElement('div');
  body.className = 'spell-body';
  (spell.beschrijving || []).forEach((para, i) => {
    const p = document.createElement('p');
    if (i === 0) p.classList.add('dropcap');
    p.textContent = para;
    body.appendChild(p);
  });
  art.appendChild(body);

  // Marginalia (latere handen).
  for (const m of (spell.marginalia || [])) {
    const mScribe = scribes[m.scribe] || scribe;
    const note = document.createElement('div');
    note.className = 'marginalia';
    note.style.setProperty('--m-hand', TITLE_FONTS[m.scribe] || mScribe.font || "'Shadows Into Light', cursive");
    note.style.setProperty('--m-ink', mScribe.ink || '#5a3a1e');
    note.style.setProperty('--m-rot', (m.hoek || -2) + 'deg');
    note.textContent = m.tekst;
    art.appendChild(note);
  }

  // Voetnoten.
  if (spell.footnotes && spell.footnotes.length) {
    const fn = document.createElement('div');
    fn.className = 'footnotes';
    for (const f of spell.footnotes) {
      const p = document.createElement('p');
      p.textContent = f.tekst || f;
      fn.appendChild(p);
    }
    art.appendChild(fn);
  }

  art._fig = fig;
  return art;
}

// Grote ritueel-cirkel — voorlopige, decoratieve placeholder (showpiece komt later).
function bouwSigil(sigil) {
  const wrap = document.createElement('div');
  wrap.className = 'sigil';
  const svg = svgEl('svg', { viewBox: '0 0 100 100' });
  svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 46, class: 'sigil-ring' }));
  svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 38, class: 'sigil-ring' }));
  // Pentagram.
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
    pts.push([50 + 36 * Math.cos(a), 50 + 36 * Math.sin(a)]);
  }
  const order = [0, 2, 4, 1, 3, 0];
  let d = '';
  order.forEach((p, i) => { d += (i ? 'L' : 'M') + pts[p][0] + ' ' + pts[p][1] + ' '; });
  svg.appendChild(svgEl('path', { d, class: 'sigil-star' }));

  // Runen-tekst langs de rand (textPath op een onzichtbare cirkel).
  const runes = (sigil.runenTekst || []).join('  ·  ');
  if (runes) {
    const pathId = 'rune-' + Math.random().toString(36).slice(2, 7);
    const defs = svgEl('defs');
    defs.appendChild(svgEl('path', { id: pathId, d: 'M 50,8 A 42,42 0 1 1 49.9,8', fill: 'none' }));
    svg.appendChild(defs);
    const text = svgEl('text', { class: 'sigil-runes' });
    const tp = svgEl('textPath', { href: '#' + pathId });
    tp.setAttribute('startOffset', '2%');
    tp.textContent = runes + '  ·  ';
    text.appendChild(tp);
    svg.appendChild(text);
  }
  wrap.appendChild(svg);
  return wrap;
}

// Klein goud ornament-liniaal (SVG), voor masthead + scheiding.
function ornamentRule() {
  return `<svg viewBox="0 0 400 20" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
    <g fill="none" stroke="currentColor" stroke-width="1.4">
      <line x1="20" y1="10" x2="175" y2="10"/>
      <line x1="225" y1="10" x2="380" y2="10"/>
      <path d="M175 10 q10 -7 25 0 q15 7 25 0" stroke-width="1.6"/>
      <circle cx="200" cy="10" r="3" fill="currentColor" stroke="none"/>
    </g>
  </svg>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ── Opstarten ────────────────────────────────────────────────────────────────
async function init() {
  const root = $('#grimoire');
  let data;
  try {
    const res = await fetch('/api/grimoire');
    data = await res.json();
  } catch (e) {
    root.innerHTML = `<div class="loading">Het boek wil niet openen… (${esc(e.message)})</div>`;
    return;
  }

  KLEURMAP = (data._schema && data._schema.kleurMap) || {};
  const scribes = data.scribes || {};
  root.innerHTML = '';

  // Masthead.
  const mast = document.createElement('header');
  mast.className = 'masthead';
  mast.innerHTML =
    `<h1 class="masthead-title">${esc(data.meta?.titel || 'Grimoire')}</h1>` +
    (data.meta?.ondertitel ? `<p class="masthead-sub">${esc(data.meta.ondertitel)}</p>` : '') +
    `<div class="masthead-rule">${ornamentRule()}</div>`;
  root.appendChild(mast);

  // Spreuken.
  const nodes = (data.spells || []).map((s, i) => {
    const el = bouwSpell(s, scribes, i);
    root.appendChild(el);
    return el;
  });

  // Theatrale reveal: fade de inkt in + teken het diagram zodra de spreuk in beeld komt.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      el.classList.add('in-view');
      if (el._fig && el._fig._prep) { el._fig._prep(); requestAnimationFrame(() => el._fig._draw()); }
      io.unobserve(el);
    }
  }, { threshold: 0.18 });
  nodes.forEach(n => io.observe(n));
}

init();
