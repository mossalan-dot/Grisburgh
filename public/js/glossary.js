/**
 * glossary.js — D&D-begrippen met hover-uitleg
 *
 * Laadt een statische begrippenlijst (public/data/glossary.json, SRD 5.2 /
 * CC BY 4.0) en biedt:
 *   • annotate(html) → omwikkelt bekende termen in de tekst met een subtiele
 *     markering, zonder de HTML te breken (alleen tekstknopen, nooit binnen
 *     links/code).
 *   • een tooltip die bij hover (desktop) of tik (touch) de definitie toont.
 *
 * Bewust beperkt tot voorwerp- en spreukbeschrijvingen (de aanroepers bepalen
 * waar het actief is). Ambigue alledaagse woorden worden niet gematcht.
 */

let _byKey   = {};     // canonieke sleutel → { term, def, cat }
let _regex   = null;   // gecombineerde matcher
let _lookup  = {};     // gematchte string (lowercase) → canonieke sleutel
let _ready   = false;
let _bron    = '';

const _escapeHTML = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _escRe     = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function initGlossary() {
  try {
    const res = await fetch('/data/glossary.json');
    const data = await res.json();
    _bron = data.bron || '';
    const matchables = [];
    for (const t of data.terms || []) {
      const key = t.term.toLowerCase();
      _byKey[key] = { term: t.term, def: t.def || '', cat: t.cat || '' };
      const strings = [t.term, ...(t.aliases || [])];
      for (const s of strings) {
        const low = s.toLowerCase();
        _lookup[low] = key;
        matchables.push(low);
      }
    }
    // Langste eerst, zodat meerwoordstermen vóór hun deeltermen matchen.
    matchables.sort((a, b) => b.length - a.length);
    _regex = new RegExp('\\b(' + matchables.map(_escRe).join('|') + ')\\b', 'gi');
    _ready = true;
    _ensureTip();
  } catch (err) {
    console.warn('Glossary kon niet laden:', err);
  }
}

// Zet markup voor één platte-tekststring (met escaping van de rest).
function _annotateText(text) {
  let out = '', last = 0, m;
  _regex.lastIndex = 0;
  let found = false;
  while ((m = _regex.exec(text)) !== null) {
    const matched = m[0];
    const key = _lookup[matched.toLowerCase()];
    if (!key) continue;
    found = true;
    out += _escapeHTML(text.slice(last, m.index));
    out += `<span class="gloss-term" tabindex="0" data-k="${_escapeHTML(key)}">${_escapeHTML(matched)}</span>`;
    last = m.index + matched.length;
  }
  if (!found) return null;
  out += _escapeHTML(text.slice(last));
  return out;
}

// Knopen waarin we niet willen matchen.
const _SKIP_TAGS = new Set(['A', 'CODE', 'SCRIPT', 'STYLE', 'BUTTON', 'TEXTAREA', 'INPUT']);
function _skip(node) {
  for (let el = node.parentNode; el && el.nodeType === 1; el = el.parentNode) {
    if (_SKIP_TAGS.has(el.tagName)) return true;
    if (el.classList && (el.classList.contains('gloss-term') || el.hasAttribute('data-no-gloss'))) return true;
  }
  return false;
}

/** Omwikkel bekende begrippen in een HTML-string. Geeft de HTML onveranderd
 *  terug als de lijst nog niet geladen is. */
export function annotate(html) {
  if (!_ready || !_regex || html == null) return html;
  const root = document.createElement('div');
  root.innerHTML = String(html);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const targets = [];
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeValue && n.nodeValue.trim() && !_skip(n)) targets.push(n);
  }
  for (const node of targets) {
    const annotated = _annotateText(node.nodeValue);
    if (annotated == null) continue;
    const frag = document.createElement('span');
    frag.innerHTML = annotated;
    node.replaceWith(...frag.childNodes);
  }
  return root.innerHTML;
}

// ── Tooltip ────────────────────────────────────────────────────────
let _tip = null;
function _ensureTip() {
  if (_tip || typeof document === 'undefined') return;
  _tip = document.createElement('div');
  _tip.id = 'gloss-tip';
  _tip.className = 'gloss-tip';
  document.body.appendChild(_tip);

  document.addEventListener('mouseover', e => {
    const t = e.target.closest?.('.gloss-term');
    if (t) _show(t);
  });
  document.addEventListener('mouseout', e => {
    const t = e.target.closest?.('.gloss-term');
    if (t && !t.contains(e.relatedTarget) && _tip && !_tip.contains(e.relatedTarget)) _hide();
  });
  document.addEventListener('focusin', e => {
    const t = e.target.closest?.('.gloss-term');
    if (t) _show(t);
  });
  document.addEventListener('focusout', e => {
    if (e.target.closest?.('.gloss-term')) _hide();
  });
  // Touch: tik toont/verbergt
  document.addEventListener('click', e => {
    const t = e.target.closest?.('.gloss-term');
    if (t) { e.stopPropagation(); if (_tip.classList.contains('gloss-tip--show') && _tip._for === t) _hide(); else _show(t); }
    else if (!e.target.closest?.('#gloss-tip')) _hide();
  });
  window.addEventListener('scroll', _hide, true);
  window.addEventListener('resize', _hide);
}

function _renderDef(def) {
  return _escapeHTML(def).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function _show(el) {
  if (!_tip) return;
  const entry = _byKey[el.dataset.k];
  if (!entry) return;
  _tip._for = el;
  _tip.innerHTML = `
    <div class="gloss-tip-head">
      <span class="gloss-tip-term">${_escapeHTML(entry.term)}</span>
      ${entry.cat ? `<span class="gloss-tip-cat">${_escapeHTML(entry.cat)}</span>` : ''}
    </div>
    <div class="gloss-tip-def">${_renderDef(entry.def)}</div>
    ${_bron ? `<div class="gloss-tip-bron">${_escapeHTML(_bron)}</div>` : ''}`;
  _tip.classList.add('gloss-tip--show');
  // Positioneren (position: fixed) — boven indien ruimte, anders onder.
  const r = el.getBoundingClientRect();
  const tw = _tip.offsetWidth, th = _tip.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), vw - tw - 8);
  let top = r.top - th - 10;
  if (top < 8) top = Math.min(r.bottom + 10, vh - th - 8);
  _tip.style.left = left + 'px';
  _tip.style.top = Math.max(8, top) + 'px';
}

function _hide() {
  if (_tip) { _tip.classList.remove('gloss-tip--show'); _tip._for = null; }
}

// Globale toegang voor de niet-module render-aanroepers.
if (typeof window !== 'undefined') {
  window.glossary = { annotate, init: initGlossary, get ready() { return _ready; } };
}
