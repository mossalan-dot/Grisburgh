/**
 * render-dungeon.js — Dungeon map fog-of-war systeem
 *
 * Features:
 *   • Fog-of-war per kamer (onthullen per party)
 *   • Verbindingslijnen tussen kamers (vervangt ingangspijlen)
 *   • Conditie-iconen per kamer (skull, coins, lock, check) — DM beheert zichtbaarheid
 *   • Zijbalk: alfabetische kamerlijst, snel onthullen, klik → inzoomen
 *   • Onthul-teller in topbar
 *   • Party-toegang (3-state: Geen / Actief / Uitgespeeld)
 */

import { api } from './api.js?v=286';

const icon = (...a) => window.icon(...a);

const isDM  = () => window.app?.isDM?.();
const esc   = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const uid   = () => 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

// Eén icoonnaam per conditie. Er stond hier ook een emoji-veld, en dát werd op
// de kaart zelf getekend (als <text>) terwijl de zijbalk en de kiezer de sprite
// gebruikten: dezelfde conditie met twee gezichten, en emoji horen sowieso niet
// in de uitvoer.
const COND_TYPES = [
  { id: 'enemies',  svgName: 'skull', label: 'Vijanden'    },
  { id: 'loot',     svgName: 'coins', label: 'Buit'        },
  { id: 'locked',   svgName: 'lock',  label: 'Vergrendeld' },
  { id: 'cleared',  svgName: 'check', label: 'Uitgewist'   },
];
// De sprite in een inline-SVG: een genest <svg> met een <use>, zodat het icoon
// op kaartcoördinaten staat en met de kaart meeschaalt.
const _condSpriteSvg = (naam, x, y, size, cls, extra = '') => `<svg x="${x - size / 2}" y="${y - size / 2}"
  width="${size}" height="${size}" viewBox="0 0 24 24" class="${cls}" ${extra}>
  <use href="/img/icons.svg?v=14#icon-${naam}"/></svg>`;

// ── State ──
let _maps        = [];      // alle dungeon maps (gefilterd voor speler)
let _mapIdx      = 0;       // huidig gekozen map
let _tool        = 'select';// 'select' | 'rect' | 'poly' | 'conn'
let _drawing     = null;    // lopende tekenoperatie
let _selectedRoom= null;    // geselecteerde kamer-id (DM)
let _zoom        = 1.0;
let _panX        = 0;
let _panY        = 0;
let _panAbort    = null;
let _lootEvents  = [];      // vondsten van deze campagne (alleen DM)

// Vondsten horen bij een kamer, maar ze leven in loot.json — niet in de
// dungeonkaart. Zo kun je ze ook los onthullen of vanuit het Loot-tabblad
// beheren, en blijft de kaart puur over vorm en fog-of-war gaan.
async function _laadVondsten() {
  if (!isDM()) { _lootEvents = []; return; }
  try { _lootEvents = (await api.lootEvents()).events || []; } catch { _lootEvents = []; }
}
const _vondstenVanKamer = (mapId, roomId) =>
  _lootEvents.filter(e => e.dungeonId === mapId && e.roomId === roomId);

// Gevechten hangen op dezelfde manier aan een kamer: de koppeling staat op de
// encounter (`dungeonId`/`roomId`) in encounters.json, niet in de dungeonkaart.
// Zo kun je hetzelfde gevecht ook los starten en blijft de kaart over vorm en
// mist gaan.
let _encounters = [];
async function _laadEncounters() {
  if (!isDM()) { _encounters = []; return; }
  try { _encounters = await api.listEncounters(); } catch { _encounters = []; }
}
const _encountersVanKamer = (mapId, roomId) =>
  _encounters.filter(e => e.dungeonId === mapId && e.roomId === roomId);

// ── Verdiepingen ────────────────────────────────────────────────────────────
// Een gebouw is geen apart veld: welke kaarten bij elkaar horen leiden we af uit
// de trappen ertussen. Zet je een trap van de begane grond naar de kelder, dan
// vormen die twee samen een gebouw — meer hoeft de DM niet in te vullen dan het
// verdiepingsnummer.
const _isTrap = (room) => !!room?.trapNaar?.mapId;
const _verdiepingLabel = (v) => (v === 0 ? 'BG' : (v > 0 ? String(v) : String(v)));

function _verdiepingenVan(mapId, gezien = new Set()) {
  if (gezien.has(mapId)) return gezien;
  gezien.add(mapId);
  const m = _maps.find(x => x.id === mapId);
  // Samen geüpload? Dan horen ze bij elkaar, ook als er nog geen trap getekend
  // is. Trappen blijven werken voor gebouwen die zo gegroeid zijn.
  if (m?.gebouwId) {
    for (const ander of _maps) {
      if (ander.gebouwId === m.gebouwId && !gezien.has(ander.id)) _verdiepingenVan(ander.id, gezien);
    }
  }
  for (const r of (m?.rooms || [])) {
    if (_isTrap(r) && !gezien.has(r.trapNaar.mapId)) _verdiepingenVan(r.trapNaar.mapId, gezien);
  }
  // Ook kaarten die naar déze wijzen horen erbij (trappen zijn tweezijdig, maar
  // een half gelegde koppeling mag het gebouw niet uit elkaar trekken).
  for (const m2 of _maps) {
    if (gezien.has(m2.id)) continue;
    if ((m2.rooms || []).some(r => _isTrap(r) && gezien.has(r.trapNaar.mapId))) _verdiepingenVan(m2.id, gezien);
  }
  return gezien;
}

function _verdiepingStripHtml() {
  const huidig = _maps[_mapIdx];
  if (!huidig) return '';
  const ids = [..._verdiepingenVan(huidig.id)];
  if (ids.length < 2) return '';
  const verdiepingen = ids
    .map(id => _maps.find(m => m.id === id))
    .filter(m => m && Number.isFinite(m.verdieping))
    .sort((a, b) => a.verdieping - b.verdieping);   // kelder links, zolder rechts —
                                                   // zoals je een gebouw leest
  if (verdiepingen.length < 2) return '';
  return `<div class="dng-verdiepingen" title="Verdiepingen van dit gebouw">
    ${verdiepingen.map(m => `
      <button class="dng-verdieping${m.id === huidig.id ? ' dng-verdieping--actief' : ''}"
        onclick="window._dngNaarVerdieping('${esc(m.id)}')" title="${esc(m.name || '')}">
        ${esc(_verdiepingLabel(m.verdieping))}</button>`).join('')}
  </div>`;
}

window._dngNaarVerdieping = (mapId, roomId) => {
  const idx = _maps.findIndex(m => m.id === mapId);
  if (idx === -1) return;
  _mapIdx = idx;
  _selectedRoom = roomId || null;
  _renderMapView();
  if (roomId) {
    const r = (_maps[idx].rooms || []).find(x => x.id === roomId);
    if (r) { _zoomToRoom(r); _renderSidebar(r); }
  }
};

// ──────────────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────────────
export async function renderDungeon(container, openId) {
  _maps = await api.listDungeons();
  await _laadVondsten();
  await _laadEncounters();
  if (openId) {
    const i = _maps.findIndex(m => m.id === openId);
    if (i >= 0) _mapIdx = i;
  }
  if (_mapIdx >= _maps.length) _mapIdx = 0;

  container.innerHTML = _buildShell();
  _attachShellEvents();
  if (_maps.length) _renderMapView();
  else              _renderEmpty();
}

// ──────────────────────────────────────────────────────────────────
// Shell HTML
// ──────────────────────────────────────────────────────────────────
function _buildShell() {
  // Bij een gebouw met verdiepingen heten de kaarten hetzelfde; dan moet de
  // keuzelijst erbij zeggen wélke verdieping je voor je hebt.
  // Welke kaart je bekijkt staat als naam in de kop; wisselen tussen verdiepingen
  // doe je met de strook rechts. Aanmaken en verwijderen horen bij de galerij —
  // dáár staan de kaartjes, en een kaart weggooien vanuit de tekenmodus is een
  // handeling die je nooit halverwege het tekenen wilt doen.
  const huidig = _maps[_mapIdx];
  const kopNaam = huidig
    ? `${huidig.name}${Number.isFinite(huidig.verdieping) ? ` · ${_verdiepingLabel(huidig.verdieping)}` : ''}`
    : 'Geen dungeonkaarten';

  return `
    <div class="dng-shell">
      <div class="dng-topbar">
        <div class="dng-topbar-left">
          <span class="dng-kaart-naam">${esc(kopNaam)}</span>
        </div>
        ${isDM() && _maps.length ? `
        <div class="dng-tools" id="dng-tools">
          <button class="dng-tool-btn active" data-tool="select" title="Selecteren">${icon('mouse-pointer-2')}</button>
          <button class="dng-tool-btn" data-tool="rect"   title="Rechthoek tekenen">${icon('square')}</button>
          <button class="dng-tool-btn" data-tool="ovaal"  title="Ronde kamer tekenen">${icon('circle-dashed')}</button>
          <button class="dng-tool-btn" data-tool="poly"   title="Polygoon tekenen">${icon('hexagon')}</button>
          <span class="dng-tool-hint" id="dng-tool-hint"></span>
        </div>
        ` : ''}
        <span id="dng-verdiepingen-slot">${_verdiepingStripHtml()}</span>
        <span style="margin-left:auto;display:inline-flex;align-items:center;gap:8px">
          <!-- De teller staat rechts, naast de uitleg: hij zegt iets over de
               hele kaart, niet over het gereedschap waar je mee bezig bent. -->
          ${isDM() && _maps.length ? `<span class="dng-reveal-chip" id="dng-reveal-count"></span>` : ''}
          ${window._helpBtn?.('dungeon') ?? ''}
          ${document.body.classList.contains('kaart-fs-active') ? `
            <button class="dng-btn dng-btn-sm" title="Sluiten (Esc)"
              onclick="window._closeKaartFullscreen()">${icon('x')}</button>` : ''}
        </span>
      </div>
      <div class="dng-workspace" id="dng-workspace">
        <div class="dng-map-area" id="dng-map-area"></div>
        ${isDM() && _maps.length ? `
        <div class="dng-sidebar" id="dng-sidebar">
          <div class="dng-sidebar-detail" id="dng-sidebar-detail"></div>
          <div class="dng-sb-list-section">
            <div class="dng-sb-list-hdr">
              <span class="dng-sb-list-title">Kamers</span>
              <span class="dng-sb-list-count" id="dng-sb-count"></span>
            </div>
            <div class="dng-sb-list" id="dng-sb-list"></div>
          </div>
        </div>` : ''}
      </div>
    </div>`;
}

// ──────────────────────────────────────────────────────────────────
// Shell events (topbar)
// ──────────────────────────────────────────────────────────────────
function _attachShellEvents() {

  document.getElementById('dng-tools')?.querySelectorAll('.dng-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _tool = btn.dataset.tool;
      document.querySelectorAll('.dng-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _cancelDrawing();
      _updateCursor();
      _updateConnHint();
      _renderSvg();
    });
  });
}

// ──────────────────────────────────────────────────────────────────
// Map view
// ──────────────────────────────────────────────────────────────────
function _verversVerdiepingen() {
  const slot = document.getElementById('dng-verdiepingen-slot');
  if (slot) slot.innerHTML = _verdiepingStripHtml();
}

function _renderMapView() {
  _verversVerdiepingen();
  const area = document.getElementById('dng-map-area');
  if (!area) return;
  if (!_maps.length) { area.innerHTML = ''; _renderEmpty(); return; }

  const map = _maps[_mapIdx];
  area.innerHTML = `
    <div class="dng-img-wrap" id="dng-img-wrap">
      <img id="dng-img" src="${esc(api.fileUrl(map.fileId))}"
        draggable="false" class="dng-img" onerror="this.style.opacity='0.2'">
      <svg id="dng-svg" class="dng-svg" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>`;

  // De naam in de kop volgt de kaart die je nu bekijkt (trap, verdiepingsknop).
  const kop = document.querySelector('.dng-kaart-naam');
  const nu  = _maps[_mapIdx];
  if (kop && nu) {
    kop.textContent = `${nu.name}${Number.isFinite(nu.verdieping) ? ` · ${_verdiepingLabel(nu.verdieping)}` : ''}`;
  }

  const img = document.getElementById('dng-img');
  const onLoad = () => { _fitZoom(); _renderSvg(); _attachMapEvents(); _renderRoomList(); };
  if (img.complete && img.naturalWidth) onLoad();
  else {
    img.addEventListener('load', onLoad, { once: true });
    // Laadt de afbeelding niet (ontbrekend bestand), dan moet de rest tóch
    // opnieuw getekend worden — anders blijft de kamerlijst van de vórige kaart
    // staan.
    img.addEventListener('error', onLoad, { once: true });
  }
}

function _fitZoom() {
  const img  = document.getElementById('dng-img');
  const area = document.getElementById('dng-map-area');
  if (!img?.naturalWidth || !area) return;
  _zoom = Math.min(1, (area.clientWidth - 24) / img.naturalWidth,
                      (area.clientHeight - 24) / img.naturalHeight);
  _applyTransform();
}

// Passend, ×2, ×4, ×8 — dezelfde trap als op de wereldkaart, zodat dubbelklikken
// overal hetzelfde doet. Na de laatste stap weer passend.
function _zoomTrapDng() {
  const img  = document.getElementById('dng-img');
  const area = document.getElementById('dng-map-area');
  if (!img?.naturalWidth || !area) return [1];
  const passend = Math.min(1, (area.clientWidth - 24) / img.naturalWidth,
                              (area.clientHeight - 24) / img.naturalHeight);
  return [...new Set([passend, passend * 2, passend * 4, Math.min(5, passend * 8)])].filter(z => z <= 5);
}

function _applyTransform() {
  const wrap = document.getElementById('dng-img-wrap');
  if (wrap) wrap.style.transform =
    `translate(calc(-50% + ${_panX}px), calc(-50% + ${_panY}px)) scale(${_zoom})`;
}

// ──────────────────────────────────────────────────────────────────
// SVG overlay — kamers, mist, verbindingen, conditie-iconen
// ──────────────────────────────────────────────────────────────────
function _renderSvg() {
  const svg = document.getElementById('dng-svg');
  const img = document.getElementById('dng-img');
  if (!svg || !img?.naturalWidth) return;

  const W = img.naturalWidth;
  const H = img.naturalHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);

  const map         = _maps[_mapIdx];
  const rooms       = map.rooms       || [];
  const connections = map.connections || [];
  const groupId     = _activeGroupId();
  const revealed    = new Set(map.reveals?.[groupId] || []);

  // ── Fog-of-war mask ──
  // Alles buiten kamers is altijd zichtbaar (tuin, paden, etc.).
  // Kamers beginnen bedekt; onthullen maakt ze zichtbaar.
  // Masker: zwart = fog weg (kaart zichtbaar), wit = fog aanwezig (bedekt).
  //   • Base rect zwart  → kaart overal zichtbaar
  //   • Alle kamers wit  → fog op kamergebieden
  //   • Onthulde kamers zwart → fog weg in onthuld gebied
  const isCompleted = !isDM() && (map.partyCompleted || []).includes(groupId);
  const hasFog      = !isCompleted && (isDM() || rooms.length > 0);
  const fogAlpha    = isDM() ? 0.40 : 1.0;

  const allRoomsMaskSvg = rooms
    .map(r => _roomToSvgShape(r, W, H, '', '', false, 'white'))
    .join('');
  const revealedMaskSvg = rooms
    .filter(r => revealed.has(r.id))
    .map(r => _roomToSvgShape(r, W, H, '', '', false, 'black'))
    .join('');

  // ── DM: klik-omtreklijn op ALLE kamers ──
  const allRoomsSvg = isDM() ? rooms.map(r => {
    const isRevealed = revealed.has(r.id);
    const isSel      = r.id === _selectedRoom;
    const cls = [
      'dng-room',
      isRevealed ? 'dng-room-revealed' : '',
      isSel      ? 'dng-room-selected' : '',
    ].filter(Boolean).join(' ');
    return _roomToSvgShape(r, W, H, cls,
      `data-room-id="${r.id}" onclick="window._dngClickRoom('${r.id}')"`, true);
  }).join('') : '';

  // ── Speler: kameromtrek zichtbaar zodra onthuld (klikbaar voor naam-tooltip) ──
  const playerRoomsSvg = !isDM() ? rooms
    .filter(r => revealed.has(r.id))
    .map(r => _roomToSvgShape(r, W, H, 'dng-room dng-room-revealed', `onclick="window._dngPlayerClickRoom('${r.id}')"`, true))
    .join('') : '';

  // ── Verbindingslijnen: DM ziet alles; speler ziet als ≥1 kamer onthuld ──
  const connSvg = connections.filter(c => {
    if (isDM()) return true;
    return revealed.has(c.fromId) || revealed.has(c.toId);
  }).map(c => {
    const from = rooms.find(r => r.id === c.fromId);
    const to   = rooms.find(r => r.id === c.toId);
    if (!from || !to) return '';
    const [x1, y1] = _roomCentroid(from, W, H);
    const [x2, y2] = _roomCentroid(to, W, H);
    const sw = Math.max(W, H) * 0.004;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      class="dng-conn-line" stroke-width="${sw}"/>`;
  }).join('');

  // ── Handvatten op de geselecteerde kamer (DM, selecteergereedschap) ──
  // Elk opgeslagen punt krijgt er een: twee bij een rechthoek of ovaal (het
  // omhullende vak), één per hoek bij een polygoon. Slepen aan een handvat
  // verzet dat punt; slepen ín de vorm verschuift de hele kamer.
  const handlesSvg = (isDM() && _tool === 'select' && _selectedRoom) ? (() => {
    const r = rooms.find(x => x.id === _selectedRoom);
    if (!r?.points?.length) return '';
    const rad = Math.max(W, H) * 0.0055;
    return r.points.map(([px, py], i) =>
      `<circle class="dng-handle" data-hi="${i}" cx="${px / 100 * W}" cy="${py / 100 * H}" r="${rad}"/>`
    ).join('');
  })() : '';

  // ── Kamernamen (alleen DM; spelers zien naam via klik-tooltip) ──
  const namesSvg = isDM() ? rooms.filter(r => revealed.has(r.id)).map(r => {
    const [cx, cy] = _roomCentroid(r, W, H);
    const hasConds  = (r.conditions || []).some(c => isDM() || c.visible);
    const labelY    = hasConds ? cy - Math.max(W, H) * 0.014 : cy;
    return `<text class="dng-room-label" x="${cx}" y="${labelY}"
      text-anchor="middle" dominant-baseline="middle">${esc(r.name)}</text>`;
  }).join('') : '';

  // ── Doorgangen: pijl omhoog of omlaag, met een klik naar die verdieping ──
  const trapSvg = rooms.filter(r => _isTrap(r) && (isDM() || revealed.has(r.id))).map(r => {
    const [cx, cy] = _roomCentroid(r, W, H);
    const doel     = _maps.find(m => m.id === r.trapNaar.mapId);
    const omhoog   = Number.isFinite(doel?.verdieping) && Number.isFinite(_maps[_mapIdx]?.verdieping)
      ? doel.verdieping > _maps[_mapIdx].verdieping : false;
    const size     = Math.max(W, H) * 0.034;
    return `<text class="dng-trap-icon" x="${cx}" y="${cy}" font-size="${size}"
      text-anchor="middle" dominant-baseline="middle"
      transform="rotate(${omhoog ? 180 : 0} ${cx} ${cy})"
      onclick="window._dngNaarVerdieping('${esc(r.trapNaar.mapId)}','${esc(r.trapNaar.roomId || '')}')"
      style="cursor:pointer">&#8595;</text>`;
  }).join('');

  // ── Conditie-iconen: DM ziet alles (verborgen = half-transparant);
  //    spelers zien alleen zichtbare iconen van onthulde kamers ──
  const condSvg = rooms.filter(r => isDM() || revealed.has(r.id)).map(r => {
    const eigen = (r.conditions || []).filter(c => isDM() || c.visible);
    // Een kamer met een gekoppelde vondst krijgt vanzelf het muntje — alleen op
    // het scherm van de DM. Anders moest hij "hier ligt iets" twee keer
    // vastleggen: als vondst in loot.json én als handmatig icoontje, en dan
    // lopen die twee vroeg of laat uit elkaar. Voor de speler blijft het een
    // bewuste keuze: hij ziet alleen wat de DM zichtbaar heeft gezet.
    const afgeleid = isDM() && _vondstenVanKamer(map.id, r.id).length
      && !eigen.some(c => c.type === 'loot');
    // Hetzelfde voor een gekoppeld gevecht: de schedel volgt de koppeling, zodat
    // je op de kaart ziet waar iets wacht zonder het twee keer vast te leggen.
    const afgeleidEnc = isDM() && _encountersVanKamer(map.id, r.id).length
      && !eigen.some(c => c.type === 'enemies');
    const conds = [
      ...eigen,
      ...(afgeleid    ? [{ type: 'loot',    visible: false, afgeleid: true }] : []),
      ...(afgeleidEnc ? [{ type: 'enemies', visible: false, afgeleid: true }] : []),
    ];
    if (!conds.length) return '';
    const [cx, cy] = _roomCentroid(r, W, H);
    const size     = Math.max(W, H) * 0.030;
    const step     = size * 1.3;
    const startX   = cx - (conds.length - 1) * step / 2;
    const iconY    = cy + Math.max(W, H) * 0.020;
    return conds.map((c, i) => {
      const ct  = COND_TYPES.find(t => t.id === c.type);
      const cls = `dng-cond-icon dng-cond-icon--${esc(c.type)}`
        + ((!c.visible && isDM()) ? ' dng-cond-icon--hidden' : '')
        + (c.afgeleid ? ' dng-cond-icon--afgeleid' : '');
      // Het muntje dat uit een vondst volgt is meteen de knop: klikken opent de
      // verdeling. Anders zou je het icoon zien liggen en er niets mee kunnen —
      // en de vondst apart moeten opzoeken in de zijbalk.
      const klik = (c.afgeleid && c.type === 'loot')
        ? `onclick="window._dngVondstOnthul('${esc(r.id)}')" style="cursor:pointer"`
        : '';
      return _condSpriteSvg(ct?.svgName || 'square', startX + i * step, iconY, size, cls, klik);
    }).join('');
  }).join('');

  // ── Transparante kameroverlays in tekenmodus (DM) ──
  const drawOverlaySvg = (isDM() && _tool !== 'select') ? rooms.map(r =>
    _roomToSvgShape(r, W, H, 'dng-room-draw-overlay', '', false, null)
  ).join('') : '';

  svg.innerHTML = `
    <defs>
      <mask id="dng-fog-mask">
        <!-- Zwart = fog weg (zichtbaar); Wit = fog aanwezig (bedekt) -->
        <rect width="${W}" height="${H}" fill="black"/>
        ${allRoomsMaskSvg}
        ${revealedMaskSvg}
      </mask>
    </defs>

    <!-- Fog overlay -->
    ${hasFog ? `<rect width="${W}" height="${H}" fill="black" opacity="${fogAlpha}"
      mask="url(#dng-fog-mask)" pointer-events="none"/>` : ''}

    <!-- Verbindingslijnen (onder kamers) -->
    ${connSvg}

    <!-- Transparante overlays in tekenmodus -->
    ${drawOverlaySvg}

    <!-- Kameromtrekken -->
    ${allRoomsSvg}${playerRoomsSvg}

    <!-- Kamernamen -->
    ${namesSvg}

    <!-- Conditie-iconen -->
    ${condSvg}
    ${trapSvg}
    ${handlesSvg}

    <!-- Tekenlaag (bovenop) -->
    <g id="dng-draw-layer"></g>`;

  _updateRevealCount();
}

function _updateRevealCount() {
  const el = document.getElementById('dng-reveal-count');
  if (!el || !isDM() || !_maps.length) return;
  const map     = _maps[_mapIdx];
  // Een doorgang is geen kamer om te ontdekken — die telt niet mee.
  const rooms   = (map.rooms || []).filter(r => !_isTrap(r));
  const groupId = _activeGroupId();
  const revIds  = map.reveals?.[groupId] || [];
  const revCnt  = revIds.filter(id => rooms.some(r => r.id === id)).length;
  el.textContent = rooms.length ? `${revCnt} / ${rooms.length} onthuld` : '';
  el.style.display = rooms.length ? '' : 'none';
}

// De gereedschapshint hing aan het verbindingsgereedschap; dat is eruit. De
// haak blijft, want het volgende gereedschap dat uitleg nodig heeft kan hem zo
// weer gebruiken.
function _updateConnHint() {
  const hint = document.getElementById('dng-tool-hint');
  if (!hint) return;
  hint.textContent = '';
  hint.style.display = 'none';
}

function _roomToSvgShape(room, W, H, cls, extra='', strokeOnly=false, fillColor=null) {
  const fill  = strokeOnly ? 'transparent' : (fillColor ?? 'black');
  const attrs = `class="${cls}" fill="${fill}" ${extra}`;
  if ((room.shape === 'rect' || room.shape === 'ovaal') && room.points?.length === 2) {
    const [[x1p,y1p],[x2p,y2p]] = room.points;
    const x = Math.min(x1p,x2p)/100*W, y = Math.min(y1p,y2p)/100*H;
    const w = Math.abs(x2p-x1p)/100*W, h = Math.abs(y2p-y1p)/100*H;
    // Een ronde kamer bewaart hetzelfde omhullende vak als een rechthoek; alleen
    // de vorm die eruit getekend wordt verschilt. Zo verandert er niets aan de
    // opslag, de mist-maskers of het slepen.
    return room.shape === 'ovaal'
      ? `<ellipse cx="${x + w/2}" cy="${y + h/2}" rx="${w/2}" ry="${h/2}" ${attrs}/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;
  }
  if (room.points?.length >= 3) {
    const pts = room.points.map(([px,py]) => `${px/100*W},${py/100*H}`).join(' ');
    return `<polygon points="${pts}" ${attrs}/>`;
  }
  return '';
}

function _roomCentroid(room, W, H) {
  if (!room.points?.length) return [W/2, H/2];
  const xs = room.points.map(p => p[0]/100*W);
  const ys = room.points.map(p => p[1]/100*H);
  return [xs.reduce((a,b)=>a+b,0)/xs.length, ys.reduce((a,b)=>a+b,0)/ys.length];
}

function _activeGroupId() {
  // Terugval op de eerste échte groep, niet op de naam 'groep1': die bestaat
  // alleen nog in oude campagnes. Zonder dat viel een onthulling in een groep
  // die niemand heeft — je klikte op onthullen en de spelers zagen niets.
  if (isDM()) {
    return window.app?.state?.dmState?.activeGroup
      || Object.keys(window.app?.state?.dmState?.groups || {})[0]
      || 'groep1';
  }
  const char     = window.app?.state?.characterId;
  const entities = window.app?.state?.entities;
  const p        = (entities?.personages || []).find(e => e.id === char);
  return p?.data?.groep || 'groep1';
}

// ──────────────────────────────────────────────────────────────────
// Map events: pan, zoom, tekenen
// ──────────────────────────────────────────────────────────────────
function _attachMapEvents() {
  if (_panAbort) _panAbort.abort();
  _panAbort = new AbortController();
  const sig  = _panAbort.signal;
  const wrap = document.getElementById('dng-img-wrap');
  if (!wrap) return;

  wrap.addEventListener('wheel', ev => {
    ev.preventDefault();
    const delta = ev.deltaY < 0 ? 0.1 : -0.1;
    _zoom = Math.max(0.15, Math.min(5, _zoom + delta));
    _applyTransform();
  }, { passive: false, signal: sig });

  // Dubbelklikken zoomt in op dat punt — zelfde gebaar als op de wereldkaart en
  // in de kaartkiezer. Alleen met het selecteergereedschap: bij de polygoon
  // beëindigt een dubbelklik de vorm die je aan het tekenen bent.
  wrap.addEventListener('dblclick', ev => {
    if (_tool !== 'select') return;
    ev.preventDefault();
    const trap = _zoomTrapDng();
    const volgende = trap.find(z => z > _zoom + 0.001) ?? trap[0];
    const wr = wrap.getBoundingClientRect();
    // De aangewezen plek onder de muis houden: het doek staat gecentreerd, dus
    // reken vanaf het midden en schaal de afstand mee met de nieuwe zoom.
    const dx = ev.clientX - (wr.left + wr.width  / 2);
    const dy = ev.clientY - (wr.top  + wr.height / 2);
    const factor = volgende / _zoom;
    if (volgende === trap[0]) { _panX = 0; _panY = 0; }
    else { _panX = _panX * factor - dx * (factor - 1); _panY = _panY * factor - dy * (factor - 1); }
    _zoom = volgende;
    _applyTransform();
  }, { signal: sig });

  let panning=false, panMoved=false, startX=0, startY=0, startPanX=0, startPanY=0;

  wrap.addEventListener('mousedown', ev => {
    if (ev.button !== 0) return;
    if (_tool !== 'select') { _handleDrawStart(ev, wrap); return; }
    // Met het selecteergereedschap: op een handvat slepen verzet dat punt, op
    // een kamer slepen verschuift de kamer. Wat je aanwijst is wat je pakt — bij
    // kamers die elkaar overlappen (elke kamer tekent zijn eigen buitenmuur) is
    // dat de bovenste, precies zoals je hem ziet liggen.
    if (isDM()) {
      const handvat = ev.target?.closest?.('.dng-handle');
      if (handvat) { _startPuntSleep(ev, +handvat.dataset.hi); return; }
      const vorm = ev.target?.closest?.('.dng-room');
      if (vorm?.dataset.roomId) { _startKamerSleep(ev, vorm.dataset.roomId); return; }
    }
    panning=true; panMoved=false;
    startX=ev.clientX; startY=ev.clientY;
    startPanX=_panX; startPanY=_panY;
    wrap.style.cursor='grabbing';
    ev.preventDefault();
  }, { signal: sig });

  document.addEventListener('mousemove', ev => {
    if (!panning) return;
    const dx=ev.clientX-startX, dy=ev.clientY-startY;
    if (Math.abs(dx)>3||Math.abs(dy)>3) panMoved=true;
    _panX=startPanX+dx; _panY=startPanY+dy;
    _applyTransform();
  }, { signal: sig });

  document.addEventListener('mouseup', () => {
    if (!panning) return;
    panning=false;
    wrap.style.cursor = _toolCursor();
    // Naast een kamer klikken sluit de bewerkstand: selectie los, handvatten
    // weg, zijbalk leeg. Slepen telt niet — dan was je aan het schuiven.
    if (!panMoved && _tool === 'select' && _selectedRoom) {
      _selectedRoom = null;
      _renderSvg();
      _renderRoomList();
      _leegZijbalk();
    }
  }, { signal: sig });

  _updateCursor();
}

// Slepen met het selecteergereedschap: de hele kamer, of één punt ervan.
// Beide werken op `points` in procenten, dus ze delen bijna alles.
function _sleepPct(ev, img) {
  const [sx, sy] = _svgPoint(ev, img);
  return _svgToPercent(sx, sy, img);
}
const _klem = (v) => Math.max(0, Math.min(100, v));

function _startKamerSleep(ev, roomId) {
  const img  = document.getElementById('dng-img');
  const map  = _maps[_mapIdx];
  const room = (map.rooms || []).find(r => r.id === roomId);
  if (!img || !room?.points?.length) return;
  ev.preventDefault();
  const [sx, sy] = _sleepPct(ev, img);
  const origineel = room.points.map(p => [...p]);
  let verplaatst = false;

  const onMove = (e) => {
    const [nx, ny] = _sleepPct(e, img);
    const dx = nx - sx, dy = ny - sy;
    if (Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15) verplaatst = true;
    room.points = origineel.map(([x, y]) => [_klem(x + dx), _klem(y + dy)]);
    _renderSvg();
  };
  const onUp = async () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (!verplaatst) return;            // dit was een klik, niet een sleep
    _selectedRoom = roomId;
    await _saveRooms();
    _renderSidebar(room);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _startPuntSleep(ev, index) {
  const img  = document.getElementById('dng-img');
  const map  = _maps[_mapIdx];
  const room = (map.rooms || []).find(r => r.id === _selectedRoom);
  if (!img || !room?.points?.[index]) return;
  ev.preventDefault();
  ev.stopPropagation();
  let verplaatst = false;

  const onMove = (e) => {
    const [nx, ny] = _sleepPct(e, img);
    room.points[index] = [_klem(nx), _klem(ny)];
    verplaatst = true;
    _renderSvg();
  };
  const onUp = async () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (verplaatst) await _saveRooms();
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _toolCursor() {
  return { select:'default', rect:'crosshair', ovaal:'crosshair', poly:'crosshair' }[_tool] || 'default';
}
function _updateCursor() {
  const wrap = document.getElementById('dng-img-wrap');
  if (wrap) wrap.style.cursor = _toolCursor();
}

// ──────────────────────────────────────────────────────────────────
// Teken-logica
// ──────────────────────────────────────────────────────────────────
function _svgPoint(ev, img) {
  const rect = img.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width  * img.naturalWidth);
  const y = ((ev.clientY - rect.top)  / rect.height * img.naturalHeight);
  return [x, y];
}

function _svgToPercent(x, y, img) {
  return [x / img.naturalWidth * 100, y / img.naturalHeight * 100];
}

function _handleDrawStart(ev, wrap) {
  ev.preventDefault();
  const img = document.getElementById('dng-img');
  if (!img) return;
  const [svgX, svgY] = _svgPoint(ev, img);
  const [pctX, pctY] = _svgToPercent(svgX, svgY, img);

  // Een ronde kamer sleep je net als een rechthoek: het omhullende vak bepaalt
  // de ovaal. Eén sleepbeweging dus, geen middelpunt-plus-straal — en een ovaal
  // dekt ook de langwerpige zaal waar een strakke cirkel niet past.
  if (_tool === 'rect' || _tool === 'ovaal') {
    _drawing = { type: _tool, startPct:[pctX,pctY], endPct:[pctX,pctY] };
    _startRectDrag(img);
    return;
  }

  if (_tool === 'poly') {
    if (!_drawing) {
      _drawing = { type:'poly', points:[[pctX,pctY]] };
      _renderDrawPreview();
    } else {
      _drawing.points.push([pctX,pctY]);
      _renderDrawPreview();
    }
    return;
  }
}

function _startRectDrag(img) {
  const sig = _panAbort?.signal;
  const onMove = ev => {
    if (!_drawing) return;
    const [svgX,svgY] = _svgPoint(ev, img);
    _drawing.endPct = _svgToPercent(svgX, svgY, img);
    _renderDrawPreview();
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (_drawing?.type === 'rect' || _drawing?.type === 'ovaal') _finishRect();
  };
  document.addEventListener('mousemove', onMove, { signal: sig });
  document.addEventListener('mouseup', onUp);
}

function _renderDrawPreview() {
  const svg   = document.getElementById('dng-svg');
  const layer = document.getElementById('dng-draw-layer');
  const img   = document.getElementById('dng-img');
  if (!layer || !img) return;
  const W=img.naturalWidth, H=img.naturalHeight;

  if (_drawing?.type==='rect' || _drawing?.type==='ovaal') {
    const [[x1p,y1p],[x2p,y2p]] = [_drawing.startPct, _drawing.endPct];
    const x=Math.min(x1p,x2p)/100*W, y=Math.min(y1p,y2p)/100*H;
    const w=Math.abs(x2p-x1p)/100*W, h=Math.abs(y2p-y1p)/100*H;
    layer.innerHTML = _drawing.type==='ovaal'
      ? `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" class="dng-draw-preview"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="dng-draw-preview"/>`;
  } else if (_drawing?.type==='poly') {
    const pts = _drawing.points.map(([px,py])=>`${px/100*W},${py/100*H}`).join(' ');
    layer.innerHTML = `
      <polyline points="${pts}" class="dng-draw-preview" fill="none"/>
      ${_drawing.points.map(([px,py])=>`<circle cx="${px/100*W}" cy="${py/100*H}"
        r="${Math.max(W,H)*0.003}" class="dng-draw-vertex"/>`).join('')}
      <text x="${_drawing.points[0][0]/100*W}" y="${_drawing.points[0][1]/100*H - Math.max(W,H)*0.01}"
        class="dng-draw-hint">Dubbelklik om te sluiten</text>`;

    if (!svg._polyDblBound) {
      svg._polyDblBound = true;
      svg.addEventListener('dblclick', _finishPoly, { once:true });
    }
  }
}

function _finishRect() {
  if (!_drawing?.startPct || !_drawing?.endPct) { _cancelDrawing(); return; }
  const pts  = [_drawing.startPct, _drawing.endPct];
  const vorm = _drawing.type === 'ovaal' ? 'ovaal' : 'rect';
  _cancelDrawing();
  _openRoomNameDialog({ shape: vorm, points: pts });
}

function _finishPoly() {
  if (!_drawing?.points || _drawing.points.length < 3) { _cancelDrawing(); return; }
  const pts = [..._drawing.points];
  _cancelDrawing();
  _openRoomNameDialog({ shape:'poly', points: pts });
}

function _switchToSelect() {
  _tool = 'select';
  document.querySelectorAll('.dng-tool-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === 'select'));
  _updateCursor();
  _updateConnHint();
  _renderSvg();
}

function _cancelDrawing() {
  _drawing = null;
  const layer = document.getElementById('dng-draw-layer');
  if (layer) layer.innerHTML = '';
  const svg = document.getElementById('dng-svg');
  if (svg) { svg._polyDblBound = false; }
}

// ──────────────────────────────────────────────────────────────────
// Verbindingslijnen tussen kamers werden met een eigen gereedschap getekend: een
// stippellijn die spelers zagen zodra één van de twee kamers open was — een hint
// dat er verderop meer is. In de praktijk voegde dat niets toe naast de kamers
// zelf, dus het gereedschap is eruit. Wat er al getekend is blijft staan en
// blijft te verwijderen in de kamerzijbalk; alleen bijtekenen kan niet meer.
// ──────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────
// Kamer naam/notities dialog
// ──────────────────────────────────────────────────────────────────
function _openRoomNameDialog(shapeData, existingRoom=null) {
  const overlay = _makeOverlay();
  const isEdit  = !!existingRoom;
  overlay.innerHTML = `
    <div class="dng-dialog">
      <h3 class="dng-dialog-title">${isEdit ? 'Kamer bewerken' : 'Nieuwe kamer'}</h3>
      <label class="dng-label">Naam
        <input id="dng-room-name" class="dng-input" placeholder="Bijv. De Crypte"
          value="${esc(existingRoom?.name||'')}">
      </label>
      <label class="dng-label">DM-notities
        <textarea id="dng-room-notes" class="dng-textarea" rows="4"
          placeholder="Alleen zichtbaar voor de DM...">${esc(existingRoom?.dmNotes||'')}</textarea>
      </label>
      <div class="dng-dialog-btns">
        <button class="dng-btn" id="dng-room-ok">${isEdit ? 'Opslaan' : 'Kamer toevoegen'}</button>
        ${isEdit ? `<button class="dng-btn dng-btn-danger" id="dng-room-del">Verwijderen</button>` : ''}
        <button class="dng-btn dng-btn-ghost" id="dng-room-cancel">Annuleren</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  setTimeout(() => document.getElementById('dng-room-name')?.focus(), 50);

  document.getElementById('dng-room-ok').addEventListener('click', async () => {
    const name  = document.getElementById('dng-room-name').value.trim();
    if (!name) { document.getElementById('dng-room-name').focus(); return; }
    const notes = document.getElementById('dng-room-notes').value;
    const map   = _maps[_mapIdx];
    if (isEdit) {
      existingRoom.name    = name;
      existingRoom.dmNotes = notes;
    } else {
      map.rooms = map.rooms || [];
      map.rooms.push({
        id: uid(), name, dmNotes: notes,
        shape: shapeData.shape, points: shapeData.points,
        conditions: [],
      });
    }
    await _saveRooms();
    overlay.remove();
    if (!isEdit) _switchToSelect();
  });

  document.getElementById('dng-room-del')?.addEventListener('click', async () => {
    if (!confirm(`Kamer "${existingRoom.name}" verwijderen?`)) return;
    const map = _maps[_mapIdx];
    map.rooms = map.rooms.filter(r => r.id !== existingRoom.id);
    // Verwijder ook verbindingen met deze kamer
    map.connections = (map.connections || []).filter(c =>
      c.fromId !== existingRoom.id && c.toId !== existingRoom.id
    );
    await _saveRooms();
    _selectedRoom = null;
    overlay.remove();
  });

  document.getElementById('dng-room-cancel').addEventListener('click', () => overlay.remove());
}

// ──────────────────────────────────────────────────────────────────
// Kamer sidebar (DM)
// ──────────────────────────────────────────────────────────────────
window._dngClickRoom = (roomId) => {
  if (!isDM()) return;
  const map  = _maps[_mapIdx];
  const room = (map.rooms || []).find(r => r.id === roomId);
  if (!room) return;

  if (_tool === 'select') {
    _selectedRoom = roomId;
    _renderSvg();
    _renderSidebar(room);
    _renderRoomList();
    _scrollToSelected();
  }
};

// De vondst van deze kamer onthullen — dezelfde weg als het muntje in de
// zijbalk: de verdeling wordt gebouwd en het lootvenster gaat open.
window._dngVondstOnthul = async (roomId) => {
  const map = _maps[_mapIdx];
  const ids = _vondstenVanKamer(map.id, roomId).map(v => v.id);
  if (!ids.length) return;
  try {
    await window.dmPanel.lootVerdelingOpenen(ids);
    await _laadVondsten();
    _renderSvg();
  } catch (e) { alert('Kon de verdeling niet maken: ' + e.message); }
};

window._dngPlayerClickRoom = (roomId) => {
  if (isDM()) return;
  const map  = _maps[_mapIdx];
  const room = (map?.rooms || []).find(r => r.id === roomId);
  if (!room?.name) return;

  // Verwijder eventuele bestaande tooltip
  document.querySelector('.dng-room-tooltip')?.remove();

  const tooltip = document.createElement('div');
  tooltip.className = 'dng-room-tooltip';
  tooltip.textContent = room.name;
  document.body.appendChild(tooltip);

  // Fade-out na 3 seconden
  setTimeout(() => {
    tooltip.classList.add('dng-room-tooltip--out');
    tooltip.addEventListener('transitionend', () => tooltip.remove(), { once: true });
  }, 3000);
};

// Niets geselecteerd: het detailpaneel leeg, met een regel die zegt wat je kunt
// doen. Leeg laten voelt als iets wat stuk is.
function _leegZijbalk() {
  const sb = document.getElementById('dng-sidebar-detail');
  if (sb) sb.innerHTML = '';
}

function _renderSidebar(room) {
  const map       = _maps[_mapIdx];
  const groupId   = _activeGroupId();
  const revealed  = new Set(map.reveals?.[groupId] || []);
  const isRev     = revealed.has(room.id);
  const conns     = (map.connections || []).filter(c =>
    c.fromId === room.id || c.toId === room.id
  );
  const conditions = room.conditions || [];

  const sb = document.getElementById('dng-sidebar-detail');
  if (!sb) return;

  // ── Conditie-toggle knoppen ──
  const condToggleHtml = COND_TYPES.map(ct => {
    const has = conditions.some(c => c.type === ct.id);
    return `<button class="dng-cond-btn dng-cond-btn--${ct.id}${has?' dng-cond-btn--on':''}"
      data-ctype="${ct.id}" title="${ct.label}">${icon(ct.svgName)}</button>`;
  }).join('');

  // ── Actieve conditie-rijen ──
  const condRowsHtml = conditions.length ? `
    <div class="dng-cond-rows">
      ${conditions.map(c => {
        const ct = COND_TYPES.find(t => t.id === c.type);
        return `<div class="dng-cond-row">
          <span class="dng-cond-row-icon">${ct ? icon(ct.svgName) : '?'}</span>
          <button class="dng-cond-vis-btn${c.visible?' dng-cond-vis-btn--on':''}" data-cid="${esc(c.id)}"
            title="${c.visible ? 'Verbergen voor de spelers' : 'Zichtbaar maken voor de spelers'}">
            ${c.visible ? icon('moon') : icon('eye')}
          </button>
          <button class="dng-cond-del-btn" data-cid="${esc(c.id)}" title="Verwijderen">${icon('x')}</button>
        </div>`;
      }).join('')}
    </div>` : '';

  // ── Verbindingen ──
  const connsHtml = conns.length ? `
    <div class="dng-sb-section">
      <div class="dng-sb-section-hdr">Verbindingen</div>
      ${conns.map(c => {
        const otherId = c.fromId === room.id ? c.toId : c.fromId;
        const other   = (map.rooms || []).find(r => r.id === otherId);
        return `<div class="dng-conn-row">
          <span class="dng-conn-row-name">${icon('link')} ${esc(other?.name || '?')}</span>
          <button class="dng-btn dng-btn-sm dng-btn-danger dng-del-conn-btn"
            data-connid="${esc(c.id)}" title="Verbinding verwijderen">${icon('x')}</button>
        </div>`;
      }).join('')}
    </div>` : '';

  // ── Gevechten in deze kamer ──
  // Zelfde weg als bij de vondsten: hier maak je er een of koppel je een
  // bestaande, en met het zwaardje start je 'm. Het bouwen van het gevecht zelf
  // (monsters, backdrop, loot) blijft in de Meesterkamer — dit is de koppeling.
  const gevechten = isDM() ? _encountersVanKamer(map.id, room.id) : [];
  const losseEnc  = isDM() ? _encounters.filter(e => !e.roomId) : [];
  const encHtml = isDM() ? `
    <div class="dng-sb-section">
      <div class="dng-sb-section-hdr">${icon('crossed-swords', { cls: 'icon-gi' })} Tegenstand</div>
      ${gevechten.map(e => `
        <div class="dng-loot-row">
          <span class="dng-loot-naam">${esc(e.name)}${(e.monsters || []).length ? ` <span class="dng-loot-dc">${(e.monsters || []).length} wezens</span>` : ''}</span>
          <button class="dng-btn dng-btn-sm dng-enc-start" data-encid="${esc(e.id)}"
            title="Dit gevecht starten">${icon('play')}</button>
          <button class="dng-btn dng-btn-sm dng-btn-danger dng-enc-los" data-encid="${esc(e.id)}"
            title="Loskoppelen van deze kamer">${icon('x')}</button>
        </div>`).join('') }
      <div class="dng-loot-acties">
        <input class="dng-loot-nieuw-naam" id="dng-enc-nieuw-naam" placeholder="Wie wacht hier?">
        <button class="dng-btn dng-btn-sm" id="dng-enc-nieuw" title="Gevecht toevoegen">${icon('plus')}</button>
        ${losseEnc.length ? `
          <select class="dng-loot-koppel" id="dng-enc-koppel">
            <option value="">— koppel bestaand gevecht —</option>
            ${losseEnc.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}
          </select>` : ''}
      </div>
    </div>` : '';

  // ── Vondsten in deze kamer ──
  const vondsten = isDM() ? _vondstenVanKamer(map.id, room.id) : [];
  const losseVondsten = isDM() ? _lootEvents.filter(e => !e.roomId && !e.sjabloon) : [];
  const lootHtml = isDM() ? `
    <div class="dng-sb-section">
      <div class="dng-sb-section-hdr">${icon('coins')} Vondsten</div>
      ${vondsten.map(ev => `
        <div class="dng-loot-row">
          <span class="dng-loot-naam">${esc(ev.naam)}${ev.dc ? ` <span class="dng-loot-dc">DC ${ev.dc}</span>` : ''}</span>
          <button class="dng-btn dng-btn-sm dng-loot-onthul" data-lootid="${esc(ev.id)}"
            title="Maak hier een verdeling van">${icon('coins')}</button>
          <button class="dng-btn dng-btn-sm dng-btn-danger dng-loot-los" data-lootid="${esc(ev.id)}"
            title="Loskoppelen van deze kamer">${icon('x')}</button>
        </div>`).join('') }
      <div class="dng-loot-acties">
        <input class="dng-loot-nieuw-naam" id="dng-loot-nieuw-naam" placeholder="Wat is hier te vinden?">
        <button class="dng-btn dng-btn-sm" id="dng-loot-nieuw" title="Vondst toevoegen">${icon('plus')}</button>
        ${losseVondsten.length ? `
          <select class="dng-loot-koppel" id="dng-loot-koppel">
            <option value="">— koppel bestaande —</option>
            ${losseVondsten.map(e => `<option value="${esc(e.id)}">${esc(e.naam)}</option>`).join('')}
          </select>` : ''}
      </div>
    </div>` : '';

  // De kop: naam met de verdieping erachter (je kijkt vaak naar twee kamers met
  // dezelfde naam op twee lagen), en het onthullen als oogje ernaast in plaats
  // van een balk over de volle breedte. Daaronder de aantekening van de DM —
  // dát wil je zien als je een kamer aanklikt; de vorm van het vlak wist je al,
  // je hebt hem zelf getekend.
  const verdieping = Number.isFinite(map.verdieping) ? ` · ${_verdiepingLabel(map.verdieping)}` : '';
  sb.innerHTML = `
    <div class="dng-sb-detail-card">
      <div class="dng-sb-kop">
        <div class="dng-sb-name">${esc(room.name)}<span class="dng-sb-verdieping">${esc(verdieping)}</span></div>
        ${!isRev
          ? `<button class="dng-sb-oog" id="dng-reveal-btn" title="Onthullen voor ${esc(groupId)}">${icon('eye')}</button>`
          : `<button class="dng-sb-oog dng-sb-oog--aan" id="dng-hide-btn" title="Verbergen voor ${esc(groupId)}">${icon('moon')}</button>`}
      </div>
      ${room.dmNotes ? `<div class="dng-sb-notes">${esc(room.dmNotes).replace(/\n/g,'<br>')}</div>` : ''}
      <div class="dng-sb-actions dng-sb-actions--rij">
        <button class="dng-btn dng-btn-sm" id="dng-edit-room-btn">${icon('pencil')} Bewerken</button>
        <button class="dng-btn dng-btn-sm dng-btn-danger dng-btn-icoon" id="dng-delete-room-btn"
          title="Kamer verwijderen">${icon('trash')}</button>
      </div>
      <div class="dng-sb-section">
        <div class="dng-sb-section-hdr">Symbolen</div>
        <div class="dng-cond-toggle-row">${condToggleHtml}</div>
        ${condRowsHtml}
      </div>
      ${connsHtml}
      ${isDM() ? `
      <div class="dng-sb-section">
        <div class="dng-sb-section-hdr">Doorgang</div>
        ${_isTrap(room) ? `
          <div class="dng-trap-rij">
            <span>${icon('link')} naar ${esc(_maps.find(m => m.id === room.trapNaar.mapId)?.name || 'andere kaart')}</span>
            <button class="dng-btn dng-btn-sm dng-btn-danger" id="dng-trap-weg" title="Doorgang weghalen">${icon('x')}</button>
          </div>
        ` : `
          <select class="dng-loot-koppel" id="dng-trap-kaart">
            <option value="">— maak hier een doorgang naar… —</option>
            ${_maps.filter(m => m.id !== map.id).map(m => `<option value="${esc(m.id)}">${esc(m.name || 'Kaart')}${Number.isFinite(m.verdieping) ? ` (${esc(_verdiepingLabel(m.verdieping))})` : ''}</option>`).join('')}
          </select>
          <select class="dng-loot-koppel" id="dng-trap-kamer" style="margin-top:5px;display:none"></select>
        `}
      </div>` : ''}
      ${encHtml}
      ${lootHtml}
    </div>`;

  // ── Doorgang ──
  // Tweezijdig: leg je er een van hier naar daar, dan komt de tegenhanger er
  // vanzelf bij. Anders zou je op de andere verdieping vastzitten.
  // De sleutel in de data heet nog `trapNaar` — dat hernoemen kost een migratie
  // en levert niets op; in beeld heet het overal *doorgang*, want het is net zo
  // goed een lift of een teleportcirkel.
  const trapKaart = document.getElementById('dng-trap-kaart');
  const trapKamer = document.getElementById('dng-trap-kamer');
  trapKaart?.addEventListener('change', () => {
    const doel = _maps.find(m => m.id === trapKaart.value);
    if (!doel) { trapKamer.style.display = 'none'; return; }
    trapKamer.innerHTML = `<option value="">— welke kamer daar? —</option>` +
      (doel.rooms || []).map(r => `<option value="${esc(r.id)}">${esc(r.name || 'Kamer')}</option>`).join('');
    trapKamer.style.display = '';
  });
  trapKamer?.addEventListener('change', async () => {
    const doelMapId = trapKaart.value, doelRoomId = trapKamer.value;
    if (!doelMapId || !doelRoomId) return;
    const doelMap  = _maps.find(m => m.id === doelMapId);
    const doelRoom = (doelMap?.rooms || []).find(r => r.id === doelRoomId);
    if (!doelRoom) return;
    room.trapNaar     = { mapId: doelMapId, roomId: doelRoomId };
    doelRoom.trapNaar = { mapId: map.id,    roomId: room.id };
    await _saveRooms();
    await api.saveDungeonRooms(doelMap.id, doelMap.rooms, doelMap.connections || []);
    _renderMapView();
    _renderSidebar(room);
  });
  document.getElementById('dng-trap-weg')?.addEventListener('click', async () => {
    const doelMap  = _maps.find(m => m.id === room.trapNaar?.mapId);
    const doelRoom = (doelMap?.rooms || []).find(r => r.trapNaar?.roomId === room.id);
    delete room.trapNaar;
    if (doelRoom) delete doelRoom.trapNaar;
    await _saveRooms();
    if (doelMap) await api.saveDungeonRooms(doelMap.id, doelMap.rooms, doelMap.connections || []);
    _renderMapView();
    _renderSidebar(room);
  });

  // ── Gevechten ──
  const _voegGevechtToe = async () => {
    const veld = document.getElementById('dng-enc-nieuw-naam');
    const naam = veld?.value.trim();
    if (!naam) { veld?.focus(); return; }
    await api.createEncounter({ name: naam, dungeonId: map.id, roomId: room.id });
    await _laadEncounters();
    _renderSidebar(room);
    _renderSvg();
  };
  document.getElementById('dng-enc-nieuw')?.addEventListener('click', _voegGevechtToe);
  document.getElementById('dng-enc-nieuw-naam')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _voegGevechtToe();
  });
  document.getElementById('dng-enc-koppel')?.addEventListener('change', async (e) => {
    if (!e.target.value) return;
    await api.updateEncounter(e.target.value, { dungeonId: map.id, roomId: room.id });
    await _laadEncounters();
    _renderSidebar(room);
    _renderSvg();
  });
  sb.querySelectorAll('.dng-enc-los').forEach(b => b.addEventListener('click', async () => {
    // Loskoppelen, niet weggooien: het gevecht blijft in de bibliotheek staan.
    await api.updateEncounter(b.dataset.encid, { dungeonId: null, roomId: null });
    await _laadEncounters();
    _renderSidebar(room);
    _renderSvg();
  }));
  sb.querySelectorAll('.dng-enc-start').forEach(b => b.addEventListener('click', async () => {
    // Starten gaat via de Meesterkamer, want daar hoort het gevecht thuis: die
    // waarschuwt ook als er al een gevecht loopt en opent de overlay.
    try { await window.dmPanel?.encStart?.(b.dataset.encid); }
    catch (err) { alert('Kon het gevecht niet starten: ' + err.message); }
  }));

  // ── Vondsten ──
  const _voegVondstToe = async () => {
    const veld = document.getElementById('dng-loot-nieuw-naam');
    const naam = veld?.value.trim();
    if (!naam) { veld?.focus(); return; }
    await api.lootEventCreate({ naam, dungeonId: map.id, roomId: room.id });
    await _laadVondsten();
    _renderSidebar(room);
  };
  document.getElementById('dng-loot-nieuw')?.addEventListener('click', _voegVondstToe);
  document.getElementById('dng-loot-nieuw-naam')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _voegVondstToe();
  });
  document.getElementById('dng-loot-koppel')?.addEventListener('change', async (e) => {
    if (!e.target.value) return;
    await api.lootEventUpdate(e.target.value, { dungeonId: map.id, roomId: room.id });
    await _laadVondsten();
    _renderSidebar(room);
  });
  sb.querySelectorAll('.dng-loot-los').forEach(b => b.addEventListener('click', async () => {
    // Loskoppelen, niet weggooien: de vondst blijft in de bibliotheek staan.
    await api.lootEventUpdate(b.dataset.lootid, { dungeonId: null, roomId: null });
    await _laadVondsten();
    _renderSidebar(room);
  }));
  sb.querySelectorAll('.dng-loot-onthul').forEach(b => b.addEventListener('click', async () => {
    // De verdeling zelf gebeurt in het lootvenster van de Meesterkamer: daar
    // stel je 'm bij en druk je op onthullen. Vanaf de kaart is dit dus de
    // snelkoppeling ernaartoe, niet een tweede plek waar je loot uitdeelt.
    try {
      await window.dmPanel.lootVerdelingOpenen([b.dataset.lootid]);
      await _laadVondsten();
      _renderSidebar(room);
    } catch (err) { alert('Kon de verdeling niet maken: ' + err.message); }
  }));

  // ── Events ──
  document.getElementById('dng-reveal-btn')?.addEventListener('click', async () => {
    await api.revealDungeonRoom(map.id, { roomId: room.id, groupId });
    if (!map.reveals) map.reveals = {};
    if (!map.reveals[groupId]) map.reveals[groupId] = [];
    map.reveals[groupId].push(room.id);
    _renderSvg();
    _renderSidebar(room);
    _renderRoomList();
  });

  document.getElementById('dng-hide-btn')?.addEventListener('click', async () => {
    await api.hideDungeonRoom(map.id, { roomId: room.id, groupId });
    if (map.reveals?.[groupId]) {
      map.reveals[groupId] = map.reveals[groupId].filter(id => id !== room.id);
    }
    _renderSvg();
    _renderSidebar(room);
    _renderRoomList();
  });

  document.getElementById('dng-edit-room-btn')?.addEventListener('click', () => {
    _openRoomNameDialog(null, room);
  });

  document.getElementById('dng-delete-room-btn')?.addEventListener('click', async () => {
    if (!confirm(`Kamer "${room.name}" verwijderen?`)) return;
    map.rooms = map.rooms.filter(r => r.id !== room.id);
    map.connections = (map.connections || []).filter(c =>
      c.fromId !== room.id && c.toId !== room.id
    );
    _selectedRoom = null;
    await _saveRooms();
    sb.innerHTML = '';
  });

  // Conditie-toggle: klik om toe te voegen (als niet aanwezig) of te verwijderen
  sb.querySelectorAll('.dng-cond-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ctype = btn.dataset.ctype;
      const idx   = conditions.findIndex(c => c.type === ctype);
      if (idx === -1) {
        // Toevoegen
        conditions.push({ id: uid(), type: ctype, visible: false });
      } else {
        // Verwijderen
        conditions.splice(idx, 1);
      }
      room.conditions = conditions;
      await _saveRooms();
      _renderSidebar(room);
    });
  });

  // Zichtbaarheid-toggle
  sb.querySelectorAll('.dng-cond-vis-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cond = conditions.find(c => c.id === btn.dataset.cid);
      if (!cond) return;
      cond.visible = !cond.visible;
      await _saveRooms();
      _renderSidebar(room);
    });
  });

  // Conditie verwijderen (✕ knop)
  sb.querySelectorAll('.dng-cond-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      room.conditions = conditions.filter(c => c.id !== btn.dataset.cid);
      await _saveRooms();
      _renderSidebar(room);
    });
  });

  // Verbinding verwijderen
  sb.querySelectorAll('.dng-del-conn-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      map.connections = (map.connections || []).filter(c => c.id !== btn.dataset.connid);
      await _saveRooms();
      _renderSidebar(room);
    });
  });
}

// ──────────────────────────────────────────────────────────────────
// Alfabetische kamerlijst in de sidebar
// ──────────────────────────────────────────────────────────────────
function _renderRoomList() {
  const listEl  = document.getElementById('dng-sb-list');
  const countEl = document.getElementById('dng-sb-count');
  if (!listEl) return;

  const map     = _maps[_mapIdx];
  const rooms   = [...(map.rooms || [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));
  const groupId = _activeGroupId();
  const revealed= new Set(map.reveals?.[groupId] || []);
  const revCnt  = rooms.filter(r => revealed.has(r.id)).length;

  // Teller: "3/8" (onthuld/totaal)
  if (countEl) {
    countEl.textContent = rooms.length ? `${revCnt}/${rooms.length}` : '';
  }

  if (!rooms.length) {
    listEl.innerHTML = '<p class="dng-sidebar-hint">Nog geen kamers</p>';
    _updateRevealCount();
    return;
  }

  listEl.innerHTML = rooms.map(r => {
    const isRev = revealed.has(r.id);
    const isSel = r.id === _selectedRoom;
    const hasConds = (r.conditions || []).length > 0;
    const condIcons = hasConds
      ? (r.conditions || []).map(c => {
          const ct = COND_TYPES.find(t => t.id === c.type);
          return `<span class="dng-sb-cond-icon${!c.visible ? ' dng-sb-cond-icon--hidden' : ''}"
            title="${ct?.label || ''}">${ct ? icon(ct.svgName) : '?'}</span>`;
        }).join('')
      : '';
    return `<div class="dng-sb-li${isSel ? ' dng-sb-li--sel' : ''}" data-rid="${esc(r.id)}">
      <span class="dng-sb-li-dot${isRev ? ' dng-sb-li-dot--rev' : ''}">
        ${isRev ? icon('check-circle') : '<span class="dng-sb-dot-empty">○</span>'}
      </span>
      <span class="dng-sb-li-name">${esc(r.name)}</span>
      ${condIcons ? `<span class="dng-sb-li-conds">${condIcons}</span>` : ''}
      ${!isRev
        ? `<button class="dng-sb-quick-reveal" data-rid="${esc(r.id)}" title="Onthul kamer">${icon('eye')}</button>`
        : `<button class="dng-sb-quick-hide"   data-rid="${esc(r.id)}" title="Verberg kamer">${icon('moon')}</button>`}
    </div>`;
  }).join('');

  // Klik op rij → selecteer kamer + inzoomen (Feature 1 + 4)
  listEl.querySelectorAll('.dng-sb-li').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.dng-sb-quick-reveal') || e.target.closest('.dng-sb-quick-hide')) return;
      const room = map.rooms.find(r => r.id === row.dataset.rid);
      if (!room) return;
      _selectedRoom = room.id;
      _switchToSelect();
      _renderSidebar(room);
      _renderRoomList();
      _zoomToRoom(room); // Feature 1: inzoomen op kamer
    });
  });

  // Snelonthulknoppen
  listEl.querySelectorAll('.dng-sb-quick-reveal').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const roomId = btn.dataset.rid;
      const room   = map.rooms.find(r => r.id === roomId);
      if (!room) return;
      await api.revealDungeonRoom(map.id, { roomId, groupId });
      if (!map.reveals) map.reveals = {};
      if (!map.reveals[groupId]) map.reveals[groupId] = [];
      map.reveals[groupId].push(roomId);
      _renderSvg();
      _renderRoomList();
      if (_selectedRoom === roomId) _renderSidebar(room);
    });
  });

  // Snelverbergknoppen
  listEl.querySelectorAll('.dng-sb-quick-hide').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const roomId = btn.dataset.rid;
      const room   = map.rooms.find(r => r.id === roomId);
      if (!room) return;
      await api.hideDungeonRoom(map.id, { roomId, groupId });
      if (map.reveals?.[groupId]) {
        map.reveals[groupId] = map.reveals[groupId].filter(id => id !== roomId);
      }
      _renderSvg();
      _renderRoomList();
      if (_selectedRoom === roomId) _renderSidebar(room);
    });
  });

  // Feature 4: scroll geselecteerde kamer in beeld
  _scrollToSelected();
  _updateRevealCount();
}

// ──────────────────────────────────────────────────────────────────
// Feature 1: Inzoomen op geselecteerde kamer
// ──────────────────────────────────────────────────────────────────
function _zoomToRoom(room) {
  const img = document.getElementById('dng-img');
  if (!img?.naturalWidth) return;
  const W = img.naturalWidth, H = img.naturalHeight;
  const [cx, cy] = _roomCentroid(room, W, H);
  // Centreer het beeld zodat (cx, cy) in het midden van de viewport ligt
  // panX = -(cx - W/2) * zoom, panY = -(cy - H/2) * zoom
  _panX = -(cx - W / 2) * _zoom;
  _panY = -(cy - H / 2) * _zoom;
  _applyTransform();
}

// ──────────────────────────────────────────────────────────────────
// Feature 4: Scroll sidebar naar geselecteerde kamer
// ──────────────────────────────────────────────────────────────────
function _scrollToSelected() {
  requestAnimationFrame(() => {
    document.querySelector('.dng-sb-li--sel')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

// ──────────────────────────────────────────────────────────────────
// Hulpfuncties: punten en kamers
// ──────────────────────────────────────────────────────────────────
function _findRoomAtPoint(map, pctX, pctY) {
  return (map.rooms || []).find(r => _pointInRoom(r, pctX, pctY));
}

function _pointInRoom(room, pctX, pctY) {
  if (room.shape === 'ovaal' && room.points?.length === 2) {
    const [[ax,ay],[bx,by]] = room.points;
    const cx = (ax+bx)/2, cy = (ay+by)/2;
    const rx = Math.abs(bx-ax)/2, ry = Math.abs(by-ay)/2;
    if (!rx || !ry) return false;
    return ((pctX-cx)/rx)**2 + ((pctY-cy)/ry)**2 <= 1;
  }
  if (room.shape === 'rect' && room.points?.length === 2) {
    const [[x1,y1],[x2,y2]] = room.points;
    return pctX>=Math.min(x1,x2) && pctX<=Math.max(x1,x2)
        && pctY>=Math.min(y1,y2) && pctY<=Math.max(y1,y2);
  }
  if (room.points?.length >= 3) {
    return _pointInPolygon(pctX, pctY, room.points);
  }
  return false;
}

function _pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i=0, j=pts.length-1; i<pts.length; j=i++) {
    const [xi,yi]=[pts[i][0],pts[i][1]], [xj,yj]=[pts[j][0],pts[j][1]];
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}

// ──────────────────────────────────────────────────────────────────
// Nieuwe dungeon dialog
// ──────────────────────────────────────────────────────────────────
// Idem voor dungeons: de +-knop in de galerij opent dit venster rechtstreeks.
// De lijst met aktes komt uit `window.app.state.meta`, dus dit werkt ook zonder
// dat er al een dungeon in beeld staat.
export function nieuweDungeon() { _openNewDungeonDialog(); }

function _openNewDungeonDialog() {
  const meta = window.app?.state?.meta || {};
  const hfst = Object.entries(meta.hoofdstukken || {}).map(([k, v]) =>
    `<option value="${esc(k)}">${esc(v?.title || k)}</option>`).join('');

  // Zelfde bouwstenen als elk ander formulier in de app (dm-form-row /
  // dm-input / dm-btn) in plaats van de eigen dng-veldjes: die kwamen uit de
  // tijd dat dit venster op een donkere ondergrond stond, en op perkament
  // botsten de vette kapitalen met de rest. De afbeelding gaat via de
  // mediabibliotheek, net als bij een hoofdkaart — dan kun je er ook een
  // hergebruiken in plaats van alleen uploaden.
  // Zelfde venster als de andere kaartformulieren: het modal van de app.
  window.app.openModal('Nieuwe dungeonkaart', '', `
    <div class="dm-feature-section" style="margin:0">
      <div class="dm-form-row">
        <label class="dm-form-label" for="dng-new-name">Naam</label>
        <input id="dng-new-name" class="dm-input" placeholder="Bijv. De Crypte van Morthul">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label" for="dng-new-desc">Beschrijving</label>
        <textarea id="dng-new-desc" class="dm-input" rows="2" placeholder="Korte omschrijving voor op het kaartje…"></textarea>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label" for="dng-new-hfst">Akte</label>
        <select id="dng-new-hfst" class="dm-input">
          <option value="">— geen —</option>
          ${hfst}
        </select>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Omslagafbeelding</label>
        <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm" id="dng-new-thumb" style="justify-content:flex-start">
          ${icon('image')} <span id="dng-new-thumb-naam">Wat op het kaartje komt te staan…</span>
        </button>
      </div>
      <div class="dm-form-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <label class="dm-form-label">Plattegronden</label>
        <div id="dng-new-lagen"></div>
        <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm" id="dng-new-laag-erbij" style="align-self:flex-start">
          ${icon('plus')} Verdieping toevoegen
        </button>
      </div>
      <div class="dm-feature-row" style="margin-top:6px">
        <button class="dm-btn dm-btn-primary" id="dng-new-ok">${icon('plus')} Aanmaken</button>
        <button class="dm-btn dm-btn-ghost" id="dng-new-cancel">${icon('x')} Annuleren</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('dng-new-name')?.focus(), 50);

  // Eén gebouw kan meerdere plattegronden hebben: begane grond, zolder, kelder.
  // Je geeft ze hier in één keer op; de app maakt er één kaart per verdieping van
  // en houdt ze bij elkaar met een gedeeld `gebouwId`.
  let thumbId = '';
  const lagen = [{ verdieping: 0, fileId: '' }];

  const _naamHint = () => (document.getElementById('dng-new-name')?.value || '')
    .trim().toLowerCase().replace(/\s+/g, '-');

  function _tekenLagen() {
    const host = document.getElementById('dng-new-lagen');
    if (!host) return;
    host.innerHTML = lagen.map((l, i) => `
      <div class="dng-laag-rij">
        <input type="number" class="dm-input dm-input-sm dng-laag-nr" data-i="${i}" value="${l.verdieping}"
          title="0 = begane grond, −1 = kelder" style="width:64px">
        <span class="dng-laag-label">${esc(_verdiepingLabel(l.verdieping))}</span>
        <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm dng-laag-kies" data-i="${i}" style="flex:1;justify-content:flex-start">
          ${icon('image')} ${l.fileId ? 'Afbeelding gekozen' : 'Kies of upload een plattegrond…'}
        </button>
        ${lagen.length > 1 ? `<button type="button" class="dm-btn dm-btn-ghost dm-btn-sm dm-btn-danger dng-laag-weg" data-i="${i}" title="Deze verdieping weghalen">${icon('x')}</button>` : ''}
      </div>`).join('');
    // Het label ernaast zegt wat het getal betekent: 0 is de begane grond, en
    // "BG" leest nu eenmaal makkelijker dan een nul.
    host.querySelectorAll('.dng-laag-nr').forEach(inp => inp.addEventListener('input', () => {
      const v = parseInt(inp.value, 10) || 0;
      lagen[+inp.dataset.i].verdieping = v;
      const label = inp.parentElement.querySelector('.dng-laag-label');
      if (label) label.textContent = _verdiepingLabel(v);
    }));
    host.querySelectorAll('.dng-laag-kies').forEach(knop => knop.addEventListener('click', () => {
      const i = +knop.dataset.i;
      window.mediaPicker.open({
        type: 'afbeelding',
        suggestedName: _naamHint() ? `${_naamHint()}-verdieping-${lagen[i].verdieping}` : 'plattegrond',
        onSelect: (fileId) => { lagen[i].fileId = fileId; _tekenLagen(); },
      });
    }));
    host.querySelectorAll('.dng-laag-weg').forEach(knop => knop.addEventListener('click', () => {
      lagen.splice(+knop.dataset.i, 1); _tekenLagen();
    }));
  }
  _tekenLagen();

  document.getElementById('dng-new-laag-erbij').addEventListener('click', () => {
    const hoogste = Math.max(...lagen.map(l => l.verdieping));
    lagen.push({ verdieping: hoogste + 1, fileId: '' });
    _tekenLagen();
  });

  document.getElementById('dng-new-thumb').addEventListener('click', () => {
    window.mediaPicker.open({
      type: 'afbeelding',
      suggestedName: _naamHint() ? `${_naamHint()}-omslag` : 'dungeon-omslag',
      onSelect: (fileId) => {
        thumbId = fileId;
        const naam = document.getElementById('dng-new-thumb-naam');
        if (naam) naam.textContent = 'Afbeelding gekozen';
      },
    });
  });

  document.getElementById('dng-new-ok').addEventListener('click', async () => {
    const naamVeld = document.getElementById('dng-new-name');
    const name = naamVeld.value.trim();
    if (!name) { naamVeld.classList.add('dm-input--err'); setTimeout(() => naamVeld.classList.remove('dm-input--err'), 900); naamVeld.focus(); return; }
    try {
      const basis = {
        name,
        hoofdstukId: document.getElementById('dng-new-hfst').value,
        description: document.getElementById('dng-new-desc').value.trim(),
        thumbId,
      };
      const meerdere = lagen.length > 1;
      const gebouwId = meerdere ? 'geb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) : '';
      // Op volgorde aanmaken (laagste verdieping eerst), zodat de galerij en de
      // verdiepingenstrook dezelfde volgorde aanhouden als het gebouw zelf.
      for (const laag of [...lagen].sort((a, b) => a.verdieping - b.verdieping)) {
        await api.createDungeon({
          ...basis,
          fileId: laag.fileId,
          ...(meerdere ? { verdieping: laag.verdieping, gebouwId } : {}),
        });
      }
      window.app.closeModal();
      // Eindigen waar je begon: de galerij (of de open kaartweergave) bijwerken.
      // Dit riep `renderDungeon(#kaart-mode-content)` aan — een element dat sinds
      // de galerij niet meer bestaat, dus er gebeurde zichtbaar niets.
      await window._kaartVerversen?.();
    } catch (e) { alert('Aanmaken mislukt: ' + e.message); }
  });

  document.getElementById('dng-new-cancel').addEventListener('click', () => window.app.closeModal());
}

// ──────────────────────────────────────────────────────────────────
// Party-toegang stond hier als eigen venster, met een knop tussen de
// tekengereedschappen. Wie een dungeon mag zien is geen gereedschap maar een
// eigenschap van de kaart: het staat nu bij naam, beschrijving en verdieping in
// *Kaart bewerken* (de galerij). Eén formulier, niet twee die uit de pas lopen.
// ──────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────
// Verwijderen
// ──────────────────────────────────────────────────────────────────
// Verwijderen gebeurt in de galerij (*Kaart bewerken*), niet vanuit de
// tekenmodus: daar zit je te tekenen, niet op te ruimen.

// ──────────────────────────────────────────────────────────────────
// Opslaan
// ──────────────────────────────────────────────────────────────────
async function _saveRooms() {
  const map = _maps[_mapIdx];
  await api.saveDungeonRooms(map.id, map.rooms, map.connections || []);
  _renderSvg();
  _renderRoomList();
}

// ──────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────
function _renderEmpty() {
  const area = document.getElementById('dng-map-area');
  if (area) area.innerHTML = `
    <div class="dng-empty">
      <div class="dng-empty-icon">${icon('swords', { cls: 'icon-lg' })}</div>
      <div class="dng-empty-title">Geen dungeon maps</div>
      ${isDM() ? '<div class="dng-empty-sub">Klik op "+ Nieuw" om een dungeon map te uploaden.</div>' : ''}
    </div>`;
}

// ──────────────────────────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────────────────────────
function _makeOverlay() {
  const el = document.createElement('div');
  el.className = 'dng-overlay';
  el.addEventListener('click', e => { if (e.target===el) el.remove(); });
  return el;
}
