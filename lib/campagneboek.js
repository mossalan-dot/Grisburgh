// ════════════════════════════════════════════════════════════════════════════
//  HET CAMPAGNEBOEK
// ════════════════════════════════════════════════════════════════════════════
// Eén HTML-bestand met de campagne in verhalende vorm: een inhoudsopgave, de
// sessieverslagen op volgorde, en de personages, locaties, organisaties en
// voorwerpen die je party kent. Alles zit erin — ook de afbeeldingen, als data
// in het bestand zelf — zodat het losstaat van de app en van het internet.
//
// Hij deelde tot 14 oktober 2026 een bestand met de **snapshot**: dezelfde
// export maar dan als een klikbare mini-app. Die is eruit (zie docs/todo.md);
// met een app die altijd draait was een bevroren kopie van het archief geen
// antwoord meer op een vraag die iemand had. Het boek bleef, want dat is iets
// anders: geen tweede app maar iets om te lezen, en desnoods te laten drukken.
//
// **Dezelfde filter als de app.** `_filterVoorExport` leent
// `filterEntityForPlayer` uit `routes/api.js`, zodat wat een speler in de app
// niet mag zien hier ook niet in staat — geheimen, antagonist-vlaggen,
// DM-aantekeningen, verborgen verbindingen. Bewaakt door
// `tests/export-geheimen.test.js`.

'use strict';
const fs      = require('fs');
const path    = require('path');
const storage = require('./storage');

let sharp = null;
try { sharp = require('sharp'); } catch { /* optional */ }

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

// Max width/height for embedded images in the snapshot
const IMG_MAX_PX  = 1200;
// Max width for static map assets (higher res is nice for the map)
const MAP_MAX_PX  = 2400;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fileToDataUri(filePath, maxPx) {
  if (!fs.existsSync(filePath)) return null;
  const ext  = path.extname(filePath).slice(1).toLowerCase();
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                 gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
                 pdf: 'application/pdf' }[ext] || 'application/octet-stream';
  let buf = fs.readFileSync(filePath);
  if (sharp && mime.startsWith('image/') && mime !== 'image/svg+xml') {
    try {
      buf = await sharp(buf)
        .resize(maxPx || IMG_MAX_PX, maxPx || IMG_MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch { /* fall through to raw embed */ }
  }
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Collect base64 for a storage file ID (image / PDF)
async function embedFile(id, collected) {
  if (!id || collected[id]) return;
  const info = storage.getFile(id);
  if (!info) return;
  // Skip audio files in snapshot (too large, not needed)
  if (info.mimetype.startsWith('audio/')) return;

  let buf = fs.readFileSync(info.path);

  if (sharp && info.mimetype.startsWith('image/') && info.mimetype !== 'image/svg+xml') {
    try {
      buf = await sharp(buf)
        .resize(IMG_MAX_PX, IMG_MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      collected[id] = `data:image/jpeg;base64,${buf.toString('base64')}`;
      return;
    } catch { /* fall through */ }
  }
  collected[id] = `data:${info.mimetype};base64,${buf.toString('base64')}`;
}

// ── Main export function ──────────────────────────────────────────────────────

// De spelersfilter staat in `routes/api.js` en wordt daar onderhouden: geheimen
// per regel, flavour per regel, betrokkenen die naar een onontdekt kaartje
// wijzen, statblokken, DM-aantekeningen. De export had een eigen kopie van acht
// regels die alleen het oude `data.geheim` kende — dus gingen álle regels uit
// `data.geheimen` mee de deur uit, onthuld of niet, plus de antagonist-vlaggen
// en de aktescripts in `meta`. Lazy require: api.js laadt dít bestand bovenin,
// dus een require bij het laden geeft een half geïnitialiseerde module terug.
function _apiFilters() {
  const api = require('../routes/api');
  return {
    filter: api.filterEntityForPlayer,
    aktes:  api.hoofdstukkenVoorSpeler,
  };
}

// Alles wat een speler niet mag zien, gaat er via diezelfde filter af. Wat de
// export er zelf bovenop doet is de doodsmarkering, want die staat bij de groep.
function _filterVoorExport(entities, types, dmState, groupId) {
  const { filter } = _apiFilters();
  const g = dmState.groups[groupId] || Object.values(dmState.groups)[0];
  const uit = {};
  for (const type of types) {
    uit[type] = (entities[type] || [])
      .map(e => {
        const out = filter(e, dmState, groupId);
        if (!out) return null;
        out._deceased = !!(g.deceased?.[e.id]);
        return out;
      })
      .filter(Boolean);
  }
  return uit;
}


// Small server-side esc helper for HTML generation
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Campagneboek generator ────────────────────────────────────────────────────

async function buildCampagneboek(dmState, groupId) {
  const gid = groupId || dmState.activeGroup;
  const g   = dmState.groups[gid] || Object.values(dmState.groups)[0];

  const entities = storage.readJSON('entities.json');
  const archief  = storage.readJSON('archief.json');
  const meta     = storage.readJSON('meta.json');

  const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  const LABELS = { personages: 'Personages', locaties: 'Locaties', organisaties: 'Organisaties', voorwerpen: 'Voorwerpen' };
  const ICONS  = { personages: '👤', locaties: '🏰', organisaties: '🏛️', voorwerpen: '⚔️' };

  // Dezelfde filter als de snapshot — en als de app.
  const filteredEntities = _filterVoorExport(entities, ENTITY_TYPES, dmState, gid);

  // Build a quick lookup map: id → entity
  const entityById = {};
  for (const type of ENTITY_TYPES) {
    for (const e of filteredEntities[type] || []) entityById[e.id] = { ...e, _type: type };
  }

  // Visible session log entries
  const sessieLog = (archief.sessieLog || [])
    .filter(e => e.visible)
    .map(e => ({
      ...e,
      images: (e.images || []).filter(img => typeof img === 'string' || img.visible !== false),
    }));

  // Embed images: portraits + session log images
  const files = {};
  for (const type of ENTITY_TYPES) {
    for (const e of filteredEntities[type] || []) {
      if (e._visibility === 'visible' && e.data?.imageId) await embedFile(e.data.imageId, files);
    }
  }
  for (const entry of sessieLog) {
    for (const img of entry.images || []) {
      const imgId = typeof img === 'string' ? img : img.id;
      if (imgId) await embedFile(imgId, files);
    }
  }

  return generateCampagneboekHtml({ meta, filteredEntities, entityById, sessieLog, files, LABELS, ICONS });
}

function generateCampagneboekHtml({ meta, filteredEntities, entityById, sessieLog, files, LABELS, ICONS }) {
  const title    = meta?.appTitle    || 'Campagne';
  const subtitle = meta?.appSubtitle || '';
  const hk       = meta?.hoofdstukken || {};
  const today    = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  // Group sessions by chapter
  const chapterKeys = [...new Set(sessieLog.map(e => e.hoofdstuk || '_'))];
  const sortedChapterKeys = chapterKeys.sort((a, b) => (hk[a]?.num || 99) - (hk[b]?.num || 99));
  const sessionsByChapter = {};
  for (const entry of sessieLog) {
    const ch = entry.hoofdstuk || '_';
    if (!sessionsByChapter[ch]) sessionsByChapter[ch] = [];
    sessionsByChapter[ch].push(entry);
  }

  // Parse simple markdown (bold/italic)
  function md(s) {
    if (!s) return '';
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  // Table of contents
  const tocRows = sortedChapterKeys.map(ch => {
    const info = hk[ch] || { num: '?', title: ch, dag: '' };
    const sessions = sessionsByChapter[ch] || [];
    return `
      <div class="toc-chapter">
        <a href="#ch-${esc(ch)}" class="toc-chapter-link">
          <span class="toc-num">Akte ${esc(String(info.num))}</span>
          <span class="toc-title">${esc(info.title)}</span>
          <span class="toc-dots"></span>
        </a>
        <ul class="toc-sessions">
          ${sessions.map(s => `<li><a href="#sess-${esc(s.id)}">${esc(s.korteSamenvatting || s.datum || 'Sessie')}</a></li>`).join('')}
        </ul>
      </div>`;
  }).join('');

  // Chapter sections
  const chapterSections = sortedChapterKeys.map(ch => {
    const info     = hk[ch] || { num: '?', title: ch, dag: '' };
    const sessions = sessionsByChapter[ch] || [];

    const sessionHtml = sessions.map(s => {
      const imgs = s.images || [];
      const imgHtml = imgs.map(img => {
        const imgId = typeof img === 'string' ? img : img.id;
        const uri = files[imgId];
        if (!uri) return '';
        return `<figure class="book-img-figure"><img src="${uri}" class="book-session-img" alt=""></figure>`;
      }).join('');

      // Related entities
      const entityChips = (s.entities || []).map(ref => {
        const eid = typeof ref === 'string' ? ref : ref.id;
        const e   = entityById[eid];
        if (!e) return '';
        const isNew = typeof ref !== 'string' && ref.nieuw;
        return `<span class="book-entity-chip${isNew ? ' book-entity-chip--new' : ''}">${esc(e.name)}</span>`;
      }).join('');

      return `
        <div class="book-session" id="sess-${esc(s.id)}">
          <div class="book-session-meta">
            ${s.datum ? `<span class="book-session-date">${esc(s.datum)}</span>` : ''}
          </div>
          <h3 class="book-session-title">${esc(s.korteSamenvatting || 'Sessie')}</h3>
          ${imgHtml ? `<div class="book-session-images">${imgHtml}</div>` : ''}
          ${s.samenvatting ? `<blockquote class="book-session-summary">${md(s.samenvatting)}</blockquote>` : ''}
          ${s.tekst ? `<div class="book-session-text">${md(s.tekst)}</div>` : ''}
          ${entityChips ? `<div class="book-entity-chips">${entityChips}</div>` : ''}
        </div>`;
    }).join('');

    return `
      <section class="book-chapter" id="ch-${esc(ch)}">
        <div class="book-chapter-banner">
          <div class="book-chapter-num">Akte ${esc(String(info.num))}</div>
          <h2 class="book-chapter-title">${esc(info.title)}</h2>
          ${info.dag ? `<div class="book-chapter-dag">${esc(info.dag)}</div>` : ''}
        </div>
        <div class="book-chapter-body">
          ${sessionHtml}
        </div>
      </section>`;
  }).join('');

  // Entity index
  const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  const indexSections = ENTITY_TYPES.map(type => {
    const ents = (filteredEntities[type] || []).filter(e => e._visibility === 'visible');
    if (!ents.length) return '';

    const cards = ents.map(e => {
      const portrait = e.data?.imageId && files[e.data.imageId]
        ? `<img src="${files[e.data.imageId]}" class="book-index-portrait" alt="${esc(e.name)}">`
        : `<div class="book-index-portrait-placeholder">${ICONS[type]}</div>`;
      const meta = [e.data?.ras, e.data?.klasse, e.data?.rol, e.subtype].filter(Boolean).join(' · ');
      const desc = e.data?.beschrijving || '';
      return `
        <div class="book-index-card${e._deceased ? ' book-index-card--deceased' : ''}">
          <div class="book-index-portrait-wrap">${portrait}</div>
          <div class="book-index-info">
            <div class="book-index-name">${esc(e.name)}${e._deceased ? ' <span class="book-deceased">†</span>' : ''}</div>
            ${meta ? `<div class="book-index-meta">${esc(meta)}</div>` : ''}
            ${desc ? `<div class="book-index-desc">${md(desc.slice(0, 200))}${desc.length > 200 ? '…' : ''}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <section class="book-index-section">
        <h2 class="book-index-heading">${ICONS[type]} ${LABELS[type]}</h2>
        <div class="book-index-grid">${cards}</div>
      </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Campagneboek</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --parchment:   #f5edd8;
  --parchment-dk:#efe3c5;
  --ink:         #2a1a08;
  --ink-med:     #5a4030;
  --ink-dim:     #8a7050;
  --gold:        #b8860b;
  --gold-light:  rgba(184,134,11,0.25);
  --seal:        #8b2a2a;
}

@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
}

html { font-size: 15px; }
body {
  background: var(--parchment);
  color: var(--ink);
  font-family: 'Crimson Text', Georgia, serif;
  line-height: 1.65;
  max-width: 820px;
  margin: 0 auto;
  padding: 0 24px 60px;
}

/* ── Title page ── */
.book-title-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 88vh;
  text-align: center;
  padding: 60px 0 40px;
  border-bottom: 3px double var(--gold);
  margin-bottom: 60px;
  page-break-after: always;
}
.book-title-eyebrow {
  font-family: 'Cinzel', serif;
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 16px;
}
.book-title-main {
  font-family: 'Cinzel', serif;
  font-size: 3.4rem;
  font-weight: 900;
  line-height: 1.1;
  color: var(--ink);
  letter-spacing: 0.04em;
}
.book-title-sub {
  font-family: 'IM Fell English', serif;
  font-style: italic;
  font-size: 1.2rem;
  color: var(--ink-med);
  margin-top: 12px;
}
.book-title-rule {
  width: 220px;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--gold), transparent);
  margin: 28px auto;
}
.book-title-date {
  font-size: 0.82rem;
  color: var(--ink-dim);
  font-style: italic;
}

/* ── TOC ── */
.book-toc {
  page-break-after: always;
  margin-bottom: 60px;
}
.book-toc-heading {
  font-family: 'Cinzel', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
  border-bottom: 2px solid var(--gold-light);
  padding-bottom: 8px;
  margin-bottom: 24px;
}
.toc-chapter { margin-bottom: 14px; }
.toc-chapter-link {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--ink);
  text-decoration: none;
  font-family: 'Cinzel', serif;
  font-size: 0.95rem;
}
.toc-chapter-link:hover { color: var(--gold); }
.toc-num { color: var(--gold); font-size: 0.78rem; min-width: 60px; flex-shrink: 0; }
.toc-title { font-weight: 600; }
.toc-dots { flex: 1; border-bottom: 1px dotted var(--ink-dim); opacity: 0.5; margin: 0 6px 3px; }
.toc-sessions { list-style: none; margin: 4px 0 0 68px; }
.toc-sessions li { font-size: 0.82rem; color: var(--ink-dim); line-height: 1.6; }
.toc-sessions a { color: var(--ink-dim); text-decoration: none; }
.toc-sessions a:hover { color: var(--gold); }

/* ── Chapters ── */
.book-chapter { margin-bottom: 64px; page-break-inside: avoid; }
.book-chapter-banner {
  background: linear-gradient(135deg, #3a2210 0%, #5a3820 60%, #7a4a28 100%);
  color: #f5edd8;
  padding: 28px 32px;
  border-radius: 4px;
  margin-bottom: 32px;
  position: relative;
  overflow: hidden;
}
.book-chapter-banner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
  opacity: 0.4;
}
.book-chapter-num {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(245,237,216,0.65);
  margin-bottom: 6px;
}
.book-chapter-title {
  font-family: 'Cinzel', serif;
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.2;
  color: #f5edd8;
}
.book-chapter-dag {
  font-family: 'IM Fell English', serif;
  font-style: italic;
  font-size: 0.88rem;
  color: rgba(245,237,216,0.6);
  margin-top: 8px;
}

/* ── Sessions ── */
.book-session {
  padding: 0 0 32px;
  border-bottom: 1px solid var(--gold-light);
  margin-bottom: 32px;
}
.book-session:last-child { border-bottom: none; }
.book-session-meta { font-size: 0.78rem; color: var(--ink-dim); margin-bottom: 6px; }
.book-session-title {
  font-family: 'Cinzel', serif;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 14px;
}
.book-session-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}
.book-img-figure { margin: 0; }
.book-session-img {
  max-width: min(320px, 100%);
  max-height: 240px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid rgba(184,134,11,0.3);
}
.book-session-summary {
  font-family: 'IM Fell English', serif;
  font-style: italic;
  font-size: 1.02rem;
  color: var(--ink-med);
  border-left: 3px solid var(--gold-light);
  padding-left: 14px;
  margin-bottom: 14px;
  line-height: 1.7;
}
.book-session-text {
  font-size: 0.95rem;
  color: var(--ink-med);
  line-height: 1.72;
  white-space: pre-wrap;
}
.book-entity-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 14px; }
.book-entity-chip {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(90,64,48,0.1);
  border: 1px solid rgba(184,134,11,0.3);
  color: var(--ink-med);
}
.book-entity-chip--new { background: rgba(184,134,11,0.12); border-color: var(--gold); color: var(--gold); }

/* ── Index ── */
.book-index-section { margin-top: 48px; page-break-inside: avoid; }
.book-index-heading {
  font-family: 'Cinzel', serif;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--ink);
  border-bottom: 2px solid var(--gold-light);
  padding-bottom: 8px;
  margin-bottom: 20px;
}
.book-index-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.book-index-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: rgba(239,227,197,0.55);
  border: 1px solid rgba(184,134,11,0.22);
  border-radius: 5px;
}
.book-index-card--deceased { opacity: 0.55; }
.book-index-portrait-wrap { flex-shrink: 0; }
.book-index-portrait {
  width: 52px;
  height: 68px;
  object-fit: cover;
  border-radius: 3px;
}
.book-index-portrait-placeholder {
  width: 52px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background: rgba(184,134,11,0.08);
  border-radius: 3px;
  border: 1px dashed rgba(184,134,11,0.25);
}
.book-index-name {
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.3;
  margin-bottom: 3px;
}
.book-deceased { color: var(--seal); }
.book-index-meta { font-size: 0.7rem; color: var(--ink-dim); margin-bottom: 4px; }
.book-index-desc { font-size: 0.75rem; color: var(--ink-med); line-height: 1.5; }

/* ── Index header page ── */
.book-index-page-header {
  margin: 64px 0 40px;
  padding-top: 32px;
  border-top: 3px double var(--gold);
  page-break-before: always;
}
.book-index-page-title {
  font-family: 'Cinzel', serif;
  font-size: 2rem;
  font-weight: 700;
  color: var(--ink);
}
.book-index-page-sub {
  font-family: 'IM Fell English', serif;
  font-style: italic;
  color: var(--ink-dim);
  margin-top: 6px;
}

/* ── Print overrides ── */
@media print {
  body { background: white; max-width: none; padding: 0; }
  .book-title-page { min-height: 0; }
  a { color: inherit; text-decoration: none; }
  .book-chapter-banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .book-session-img { max-width: 280px; max-height: 200px; }
  .no-print { display: none !important; }
}

@media screen {
  .book-title-page { padding-top: 80px; }
}
</style>
</head>
<body>

<!-- Print button (screen only) -->
<div class="no-print" style="position:fixed;top:16px;right:16px;z-index:100;display:flex;gap:8px;">
  <button onclick="window.print()" style="background:#3a2210;color:#f5edd8;border:none;padding:7px 16px;border-radius:4px;font-family:'Cinzel',serif;font-size:0.8rem;letter-spacing:0.05em;cursor:pointer;">🖨 Afdrukken / PDF</button>
</div>

<!-- Title page -->
<div class="book-title-page">
  <div class="book-title-eyebrow">Campagneboek</div>
  <div class="book-title-main">${esc(title)}</div>
  ${subtitle ? `<div class="book-title-sub">${esc(subtitle)}</div>` : ''}
  <div class="book-title-rule"></div>
  <div class="book-title-date">Gegenereerd op ${esc(today)}</div>
</div>

<!-- Table of contents -->
<nav class="book-toc">
  <h2 class="book-toc-heading">Inhoudsopgave</h2>
  ${tocRows || '<p style="color:var(--ink-dim);font-style:italic">Geen sessies gevonden.</p>'}
</nav>

<!-- Chapters -->
${chapterSections}

<!-- Entity index -->
${indexSections ? `
<div class="book-index-page-header">
  <div class="book-index-page-title">Register</div>
  <div class="book-index-page-sub">Personages, locaties, organisaties en voorwerpen</div>
</div>
${indexSections}` : ''}

</body>
</html>`;
}

module.exports = { buildCampagneboek };
