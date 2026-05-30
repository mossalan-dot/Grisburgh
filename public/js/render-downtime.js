/**
 * render-downtime.js — Rustdagen (downtime tussen sessies)
 *
 * Een bord met downtime-activiteiten (geïnspireerd op de 2024 PHB), gefilterd
 * op de campagnefase:
 *   • De Heilige Twaalfdaagse — alleen avond-activiteiten
 *   • Na Lichtmis — alles ligt open
 * Spelers plannen activiteiten in hun eigen logboek; de DM ziet alle
 * inzendingen in real-time en handelt ze af.
 */

import { api } from './api.js?v=221';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => window.app?.isDM?.();

let _data    = null;
let _dmOpen  = false;

const STATUS = {
  gepland: { label: 'Gepland', cls: 'dt-status--gepland' },
  bezig:   { label: 'Bezig',   cls: 'dt-status--bezig' },
  klaar:   { label: 'Voltooid', cls: 'dt-status--klaar' },
};

export async function renderDowntime(containerEl) {
  const container = containerEl || document.getElementById('section-downtime');
  if (!container) return;
  window.downtime = _api;
  try {
    _data = await api.downtime();
  } catch (err) {
    container.innerHTML = `<div class="dt-error">Kon de rustdagen niet laden: ${esc(String(err.message))}</div>`;
    return;
  }
  if (!_data.enabled && !isDM()) {
    container.innerHTML = `<div class="dt-error">De rustdagen zijn nog niet beschikbaar.</div>`;
    return;
  }
  container.innerHTML = _buildHtml();
}

function _act(id) { return (_data.activiteiten || []).find(a => a.id === id) || null; }

function _buildHtml() {
  return `
    <div class="dt-wrap" data-fase="${esc(_data.fase)}">
      <div class="section-banner section-banner--entity section-banner--downtime">
        <div class="section-banner-head">
          <div class="section-banner-icon-wrap">${icon('refresh-cw')}</div>
          <div class="section-banner-info">
            <div class="section-banner-label">Rustdagen</div>
            <div class="section-banner-desc-line">Tussen de bedrijven door — wat doe je in je vrije tijd?</div>
          </div>
          ${!_data.enabled && isDM() ? `<div class="dt-disabled-badge">Verborgen voor spelers</div>` : ''}
        </div>
        <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
      </div>

      ${_faseBalk()}
      ${_activiteitenGrid()}
      ${_data.characterId && !isDM() ? _mijnLogboek() : ''}
      ${isDM() ? _dmInzendingen() : ''}
      ${isDM() ? _dmPaneel() : ''}
    </div>`;
}

// ── Fase-balk ──────────────────────────────────────────────────────
function _faseBalk() {
  const f = _data.faseInfo || {};
  return `
    <div class="dt-fase dt-fase--${esc(_data.fase)}">
      <div class="dt-fase-icon">${_data.fase === 'twaalfdaagse' ? '🕯️' : '🌅'}</div>
      <div class="dt-fase-info">
        <div class="dt-fase-label">${esc(f.label || '')}</div>
        <div class="dt-fase-omschrijving">${esc(f.omschrijving || '')}</div>
      </div>
      ${isDM() ? `
        <div class="dt-fase-switch">
          <button class="dt-fase-btn${_data.fase === 'twaalfdaagse' ? ' dt-fase-btn--active' : ''}" onclick="window.downtime.setFase('twaalfdaagse')">🕯️ Twaalfdaagse</button>
          <button class="dt-fase-btn${_data.fase === 'open' ? ' dt-fase-btn--active' : ''}" onclick="window.downtime.setFase('open')">🌅 Na Lichtmis</button>
        </div>` : ''}
    </div>`;
}

// ── Activiteiten-grid ──────────────────────────────────────────────
function _activiteitenGrid() {
  const cards = (_data.activiteiten || []).map(a => {
    const kanPlannen = a.beschikbaar && !!_data.characterId && !isDM();
    return `
      <div class="dt-card${a.beschikbaar ? '' : ' dt-card--vergrendeld'}">
        <div class="dt-card-head">
          <span class="dt-card-emoji">${esc(a.emoji)}</span>
          <div class="dt-card-titel-wrap">
            <span class="dt-card-naam">${esc(a.naam)}</span>
            ${a.categorie ? `<span class="dt-card-cat">${esc(a.categorie)}</span>` : ''}
          </div>
          ${a.avond ? `<span class="dt-card-avond" title="Past in een avond">🌙</span>` : ''}
        </div>
        <p class="dt-card-omschrijving">${esc(a.omschrijving)}</p>
        <div class="dt-card-meta">
          ${a.duur ? `<span class="dt-meta-pill">⏳ ${esc(a.duur)}</span>` : ''}
          ${a.kosten && a.kosten !== '—' ? `<span class="dt-meta-pill">💰 ${esc(a.kosten)}</span>` : ''}
        </div>
        ${a.opbrengst ? `<div class="dt-card-opbrengst"><span>Oplevert</span> ${esc(a.opbrengst)}</div>` : ''}
        <div class="dt-card-foot">
          ${a.beschikbaar
            ? (kanPlannen ? `<button class="dt-plan-btn" onclick="window.downtime.openPlan('${esc(a.id)}')">${icon('plus')} Plan dit</button>` : '')
            : `<span class="dt-vergrendeld-badge">🔒 Pas na Lichtmis</span>`}
        </div>
      </div>`;
  }).join('');
  return `<div class="dt-grid">${cards}</div>`;
}

// ── Persoonlijk logboek (speler) ───────────────────────────────────
function _mijnLogboek() {
  const entries = _data.mijnLog || [];
  const rows = entries.map(e => _logRow(e, false)).join('');
  return `
    <div class="dt-logboek">
      <h3 class="dt-section-title">${icon('book-open')} Mijn rustdagen</h3>
      ${rows || `<p class="dt-empty">Je hebt nog niets gepland. Kies hierboven een bezigheid.</p>`}
    </div>`;
}

function _logRow(e, dmView) {
  const a = _act(e.activiteitId);
  const st = STATUS[e.status] || STATUS.gepland;
  return `
    <div class="dt-log-row">
      <span class="dt-log-emoji">${esc(a?.emoji || '•')}</span>
      <div class="dt-log-body">
        <div class="dt-log-top">
          <span class="dt-log-naam">${esc(a?.naam || 'Activiteit')}</span>
          <span class="dt-status ${st.cls}">${st.label}</span>
        </div>
        ${e.notitie ? `<div class="dt-log-notitie">${esc(e.notitie)}</div>` : ''}
        ${e.uitkomst ? `<div class="dt-log-uitkomst"><span>Uitkomst</span> ${esc(e.uitkomst)}</div>` : ''}
      </div>
      ${!dmView && e.status !== 'klaar' ? `<button class="dt-icon-btn dt-icon-btn--danger" onclick="window.downtime.removeLog('${esc(e.id)}')" title="Verwijderen">${icon('x')}</button>` : ''}
    </div>`;
}

// ── DM: inzendingen ────────────────────────────────────────────────
function _dmInzendingen() {
  const groups = _data.allLogs || [];
  const blokken = groups.map(g => `
    <div class="dt-inzending-groep">
      <div class="dt-inzending-naam">${esc(g.naam)}</div>
      ${g.entries.map(e => _dmEntry(g.characterId, e)).join('')}
    </div>`).join('');
  return `
    <div class="dt-inzendingen">
      <h3 class="dt-section-title">${icon('clipboard-list')} Inzendingen van spelers</h3>
      ${blokken || `<p class="dt-empty">Nog geen inzendingen.</p>`}
    </div>`;
}

function _dmEntry(charId, e) {
  const a = _act(e.activiteitId);
  return `
    <div class="dt-dm-entry" data-id="${esc(e.id)}">
      <div class="dt-dm-entry-head">
        <span class="dt-log-emoji">${esc(a?.emoji || '•')}</span>
        <span class="dt-log-naam">${esc(a?.naam || 'Activiteit')}</span>
        <select class="dt-dm-status" onchange="window.downtime.setStatus('${esc(e.id)}', this.value)">
          ${['gepland','bezig','klaar'].map(s => `<option value="${s}"${e.status === s ? ' selected' : ''}>${STATUS[s].label}</option>`).join('')}
        </select>
        <button class="dt-icon-btn dt-icon-btn--danger" onclick="window.downtime.removeLog('${esc(e.id)}')" title="Verwijderen">${icon('x')}</button>
      </div>
      ${e.notitie ? `<div class="dt-log-notitie">${esc(e.notitie)}</div>` : ''}
      <div class="dt-dm-uitkomst-row">
        <input class="dt-dm-uitkomst-input" id="dt-uit-${esc(e.id)}" value="${esc(e.uitkomst || '')}" placeholder="Uitkomst / verteller-notitie…">
        <button class="dt-btn dt-btn--small" onclick="window.downtime.saveUitkomst('${esc(e.id)}')">${icon('save')}</button>
      </div>
    </div>`;
}

// ── DM-instelpaneel: catalogus ─────────────────────────────────────
function _dmPaneel() {
  if (!_dmOpen) {
    return `<div class="dt-dm-toggle"><button class="dt-btn" onclick="window.downtime.toggleDM()">${icon('settings')} Activiteiten instellen</button></div>`;
  }
  const rows = (_data.activiteiten || []).map((a, i) => `
    <div class="dt-cfg-act" data-idx="${i}">
      <div class="dt-cfg-act-head">
        <input class="dt-cfg-input dt-cf-emoji" value="${esc(a.emoji)}" maxlength="4" title="Emoji">
        <input class="dt-cfg-input dt-cf-naam" value="${esc(a.naam)}" placeholder="Naam">
        <input class="dt-cfg-input dt-cf-cat" value="${esc(a.categorie)}" placeholder="Categorie">
        <label class="dt-cf-avond" title="Past in een avond (beschikbaar tijdens de Twaalfdaagse)">
          <input type="checkbox" class="dt-cf-avond-cb" ${a.avond ? 'checked' : ''}> 🌙 avond
        </label>
        <button class="dt-icon-btn dt-icon-btn--danger" onclick="window.downtime.removeAct(${i})" title="Verwijderen">${icon('x')}</button>
      </div>
      <input class="dt-cfg-input dt-cf-oms" value="${esc(a.omschrijving)}" placeholder="Omschrijving">
      <div class="dt-cfg-act-meta">
        <input class="dt-cfg-input dt-cf-duur" value="${esc(a.duur)}" placeholder="Duur">
        <input class="dt-cfg-input dt-cf-kosten" value="${esc(a.kosten)}" placeholder="Kosten">
        <input class="dt-cfg-input dt-cf-opbrengst" value="${esc(a.opbrengst)}" placeholder="Oplevert">
      </div>
    </div>`).join('');
  return `
    <div class="dt-dm-panel">
      <div class="dt-dm-panel-head">
        <h3>${icon('settings')} Activiteiten instellen</h3>
        <button class="dt-icon-btn" onclick="window.downtime.toggleDM()" title="Sluiten">${icon('x')}</button>
      </div>
      <label class="dt-cfg-check">
        <input type="checkbox" id="dt-enabled" ${_data.enabled ? 'checked' : ''}>
        Rustdagen zichtbaar voor spelers
      </label>
      <div class="dt-cfg-deck-head">
        <span>Activiteiten (${(_data.activiteiten || []).length})</span>
        <button class="dt-btn dt-btn--small" onclick="window.downtime.addAct()">${icon('plus')} Activiteit</button>
      </div>
      <div class="dt-cfg-deck" id="dt-cfg-deck">${rows}</div>
      <div class="dt-dm-panel-foot">
        <button class="dt-btn dt-btn--save" onclick="window.downtime.saveConfig()">${icon('save')} Opslaan</button>
      </div>
    </div>`;
}

function _toast(msg) {
  const t = document.createElement('div');
  t.className = 'map-toast';
  t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('map-toast--show'));
  setTimeout(() => {
    t.classList.remove('map-toast--show');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 3200);
}

// ── Publieke acties (window.downtime.*) ────────────────────────────
const _api = {
  refresh: () => renderDowntime(),

  async setFase(fase) {
    try { await api.saveDowntimeConfig({ fase }); await renderDowntime(); }
    catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  openPlan(activiteitId) {
    const a = _act(activiteitId);
    if (!a) return;
    const body = `
      <form class="dt-form" onsubmit="return false">
        <p class="dt-plan-intro">${esc(a.emoji)} <strong>${esc(a.naam)}</strong> — ${esc(a.omschrijving)}</p>
        <label>Jouw plan / notitie (optioneel)
          <textarea class="dt-cfg-input" id="dt-plan-notitie" rows="3" placeholder="Wat wil je precies doen, en met welk doel?"></textarea>
        </label>
        <button class="dt-btn dt-btn--save" type="button" onclick="window.downtime.plan('${esc(activiteitId)}')">${icon('plus')} Inplannen</button>
      </form>`;
    window.app.openModal('Rustdag inplannen', a.naam, body);
  },

  async plan(activiteitId) {
    const notitie = document.getElementById('dt-plan-notitie')?.value || '';
    try {
      await api.addDowntimeLog({ activiteitId, notitie });
      window.app.closeModal();
      await renderDowntime();
      _toast('Ingepland in je logboek.');
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  async removeLog(id) {
    if (!confirm('Deze rustdag verwijderen?')) return;
    try { await api.deleteDowntimeLog(id); await renderDowntime(); }
    catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  async setStatus(id, status) {
    try { await api.updateDowntimeLog(id, { status }); await renderDowntime(); }
    catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  async saveUitkomst(id) {
    const uitkomst = document.getElementById('dt-uit-' + id)?.value || '';
    try { await api.updateDowntimeLog(id, { uitkomst, status: 'klaar' }); await renderDowntime(); _toast('Afgehandeld.'); }
    catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  toggleDM() { _dmOpen = !_dmOpen; renderDowntime(); },

  addAct() {
    _data.activiteiten.push({ id: 'a_' + Date.now().toString(36), naam: 'Nieuwe activiteit', emoji: '•', categorie: '', avond: true, omschrijving: '', duur: '', kosten: '', opbrengst: '' });
    renderDowntime();
  },

  removeAct(i) {
    if (_data.activiteiten.length <= 1) { _toast('Houd minstens één activiteit.'); return; }
    _data.activiteiten.splice(i, 1);
    renderDowntime();
  },

  async saveConfig() {
    const activiteiten = [...document.querySelectorAll('.dt-cfg-act')].map(el => ({
      id:           _data.activiteiten[+el.dataset.idx]?.id,
      emoji:        el.querySelector('.dt-cf-emoji').value.trim() || '•',
      naam:         el.querySelector('.dt-cf-naam').value.trim() || 'Activiteit',
      categorie:    el.querySelector('.dt-cf-cat').value.trim(),
      avond:        el.querySelector('.dt-cf-avond-cb').checked,
      omschrijving: el.querySelector('.dt-cf-oms').value.trim(),
      duur:         el.querySelector('.dt-cf-duur').value.trim(),
      kosten:       el.querySelector('.dt-cf-kosten').value.trim(),
      opbrengst:    el.querySelector('.dt-cf-opbrengst').value.trim(),
    }));
    try {
      await api.saveDowntimeConfig({ enabled: document.getElementById('dt-enabled').checked, activiteiten });
      _toast('Activiteiten opgeslagen.');
      await renderDowntime();
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },
};

window.downtime = _api;
