// Bastion — de thuisbasis van de party (DMG 2024), fase 1.
//
// Eén bastion per party. De server rekent alles uit (`GET /bastion`): hoeveel
// special facilities de party heeft, welke orders een facility kent, of er een
// Bastion Turn klaarstaat en wat er bij een nieuwe keuze opvalt. Deze module
// tekent dat, en vraagt alleen wat een keuze nodig heeft.
//
// Een speler stelt orders voor; de DM legt vast, kiest facilities en rondt de
// turn af. Alle knoppen dragen `data-bs` en lopen via één handler op `document`
// — ook in het venster, dat buiten de sectie hangt.
//
// Events, defenders en goud zijn fase 2 en 3 (`docs/voorstel-bastion.md`).

import { api } from './api.js?v=319';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, o) => window.icon?.(n, o) || '';
const toast = (t) => window._showToast?.(t);

let _data = null;
let _groep = '';          // de party waar de DM naar kijkt; leeg = de actieve

const _sectie = () => document.getElementById('section-bastion');
const _pad = (p) => '/bastion' + p + (_groep ? (p.includes('?') ? '&' : '?') + 'groep=' + encodeURIComponent(_groep) : '');

async function render() {
  const el = _sectie();
  if (!el) return;
  if (!_data) el.innerHTML = `<div class="bs-leeg">${ic('hourglass')} Laden…</div>`;
  try {
    _data = await api.get(_pad(''));
  } catch (e) {
    // Staat de module uit (409), dan is er hier niets — ook geen melding.
    el.innerHTML = e.status === 409 ? '' : `<div class="bs-leeg">${esc(e.message)}</div>`;
    return;
  }
  _teken();
}

function _grootte(k) { return _data?.catalogus?.groottes?.[k]?.naam || k; }
function _orderNaam(k) { return _data?.catalogus?.orderNamen?.[k] || k; }

function _teken() {
  const el = _sectie();
  if (!el || !_data) return;
  const b = _data.bastion;
  const dm = _data.isDM;
  const kiezer = dm && (_data.groepen || []).length > 1 ? `
    <select class="bs-groep" data-bs-change="groep" title="Welke party">
      ${(_data.groepen || []).map(g => `<option value="${esc(g.id)}"${g.id === _data.groep.id ? ' selected' : ''}>${esc(g.naam)}</option>`).join('')}
    </select>` : '';

  if (!b) {
    el.innerHTML = `
      <div class="bs-scene">
        <header class="bs-kop">
          <div class="bs-kop-tekst">
            <div class="bs-boven">${esc(_data.groep.naam)}</div>
            <h2 class="bs-titel">Nog geen bastion</h2>
          </div>
          <div class="bs-kop-acties">${kiezer}${window._helpBtn?.('bastion') ?? ''}</div>
        </header>
        ${dm ? `<div class="bs-stichten">
          <input class="bs-veld" id="bs-nieuw-naam" placeholder="Naam van het bastion" maxlength="80">
          <button class="bs-knop bs-knop--goud" data-bs="stichten">${ic('castle')} Bastion stichten</button>
        </div>` : `<p class="bs-stil">Jullie party heeft nog geen thuisbasis.</p>`}
      </div>`;
    return;
  }

  const special = b.facilities.filter(f => f.special);
  const basic = b.facilities.filter(f => !f.special);
  const t = b.turn;
  const openOrders = special.filter(f => f.order).length;
  el.innerHTML = `
    <div class="bs-scene${b.beeldId ? ' bs-scene--beeld' : ''}"${b.beeldId ? ` style="--bs-bg:url('${api.thumbUrlBreed(b.beeldId)}')"` : ''}>
      <header class="bs-kop">
        <div class="bs-kop-tekst">
          <div class="bs-boven">Bastion van ${esc(_data.groep.naam)}</div>
          <h2 class="bs-titel">${esc(b.naam)}</h2>
          <div class="bs-chips">
            <span class="bs-chip${b.aantalSpecial > b.slots.totaal ? ' bs-chip--over' : ''}" title="${b.slots.override ? `Ingesteld door de DM; de party zelf geeft er ${b.slots.afgeleid}` : 'Afgeleid uit de levels van de party'}">
              ${ic('hexagon')} Special facilities ${b.aantalSpecial}/${b.slots.totaal}</span>
            <span class="bs-chip">${ic('scroll-text')} Bastion Turn ${b.turnNummer}</span>
            ${_data.instellingen.aanbieden ? `<span class="bs-chip${t.klaar ? ' bs-chip--klaar' : ''}">${ic('moon')} ${t.nachten}/${t.cadans} nachten</span>` : ''}
          </div>
        </div>
        <div class="bs-kop-acties">
          ${kiezer}
          ${dm ? `<button class="bs-icoonknop" data-bs="bewerk" title="Naam, beeld en slots">${ic('pencil')}</button>` : ''}
          ${window._helpBtn?.('bastion') ?? ''}
        </div>
      </header>

      ${t.klaar ? `<div class="bs-banier">${ic('sparkles')}
        <span>${t.nachten} nachten sinds de vorige turn — tijd voor een Bastion Turn.</span>
        ${dm ? `<button class="bs-knop bs-knop--goud" data-bs="turn">Turn afronden</button>` : ''}</div>` : ''}

      <section class="bs-blok">
        <div class="bs-blok-kop">
          <h3>Special Facilities</h3>
          ${dm ? `<button class="bs-knop" data-bs="nieuw-special">${ic('plus')} Special facility</button>` : ''}
        </div>
        ${special.length ? `<div class="bs-raster">${special.map(_kaart).join('')}</div>`
          : `<p class="bs-stil">Nog geen special facilities.</p>`}
      </section>

      <section class="bs-blok">
        <div class="bs-blok-kop">
          <h3>Basic Facilities</h3>
          ${dm ? `<button class="bs-knop" data-bs="nieuw-basic">${ic('plus')} Basic facility</button>` : ''}
        </div>
        ${basic.length ? `<ul class="bs-basic">${basic.map(f => `
          <li>${ic(f.def?.icoon || 'house')} <b>${esc(f.naam)}</b> <span>${esc(_grootte(f.grootte))}</span>
            ${dm ? `<button class="bs-mini" data-bs="fac-bewerk" data-fac="${esc(f.id)}" title="Bewerken">${ic('pencil')}</button>
                    <button class="bs-mini" data-bs="fac-weg" data-fac="${esc(f.id)}" title="Weghalen">${ic('trash')}</button>` : ''}
          </li>`).join('')}</ul>` : `<p class="bs-stil">Geen basic facilities.</p>`}
      </section>

      ${dm && !t.klaar ? `<div class="bs-turnrij">
        <button class="bs-knop bs-knop--goud" data-bs="turn">${ic('scroll-text')} Bastion Turn afronden${openOrders ? ` (${openOrders} order${openOrders === 1 ? '' : 's'})` : ''}</button>
      </div>` : ''}

      <section class="bs-blok">
        <div class="bs-blok-kop"><h3>Logboek</h3></div>
        ${b.log.length ? b.log.map(_logTurn).join('') : `<p class="bs-stil">Nog geen turn gespeeld.</p>`}
      </section>
    </div>`;
}

function _kaart(f) {
  const d = f.def || {};
  const o = f.order;
  const dm = _data.isDM;
  // Een speler kan niet aan iets komen wat de DM vastlegde; dan staan de
  // knoppen stil in plaats van een 409 te krijgen.
  const dicht = o?.vast && !_data.magVastleggen;
  return `
    <article class="bs-fac${o ? ' bs-fac--order' : ''}">
      <div class="bs-fac-kop">
        <span class="bs-fac-ico">${ic(d.icoon || 'hexagon')}</span>
        <div>
          <div class="bs-fac-naam">${esc(f.naam)}</div>
          <div class="bs-fac-type">${f.naam !== d.naam ? `${esc(d.naam)} · ` : ''}${esc(_grootte(f.grootte))} · level ${d.level || '—'}</div>
        </div>
        ${dm ? `<span class="bs-fac-beheer">
          <button class="bs-mini" data-bs="fac-bewerk" data-fac="${esc(f.id)}" title="Bewerken">${ic('pencil')}</button>
          <button class="bs-mini" data-bs="fac-weg" data-fac="${esc(f.id)}" title="Weghalen">${ic('trash')}</button></span>` : ''}
      </div>
      ${d.werking ? `<p class="bs-fac-werking">${esc(d.werking)}</p>` : ''}
      ${f.notitie ? `<p class="bs-fac-notitie">${esc(f.notitie)}</p>` : ''}
      <div class="bs-orders">
        ${f.orders.map(k => `<button class="bs-order${o?.order === k ? ' bs-order--aan' : ''}" data-bs="order" data-fac="${esc(f.id)}" data-order="${k}"${dicht ? ' disabled' : ''}>${esc(_orderNaam(k))}</button>`).join('')}
      </div>
      ${o ? `
        <div class="bs-order-stand">
          ${ic(o.vast ? 'lock' : 'hourglass')}
          <span>${o.vast ? 'Vastgelegd' : 'Voorgesteld'} door ${esc(o.doorNaam)}</span>
          ${dicht ? '' : `<button class="bs-mini" data-bs="order-weg" data-fac="${esc(f.id)}" title="Order intrekken">${ic('x')}</button>`}
        </div>
        <input class="bs-veld bs-veld--klein" data-bs-change="notitie" data-fac="${esc(f.id)}" maxlength="500"
          value="${esc(o.notitie || '')}" placeholder="Wat precies?"${dicht ? ' disabled' : ''}>` : ''}
    </article>`;
}

function _logTurn(t) {
  const datum = new Date(t.op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <details class="bs-log">
      <summary><b>Bastion Turn ${t.nummer}</b> <span>${esc(datum)} · ${t.nachten} nachten · ${t.regels.length} order${t.regels.length === 1 ? '' : 's'}</span></summary>
      ${t.regels.length ? `<ul>${t.regels.map(r => `
        <li><b>${esc(r.naam)}</b> — ${esc(r.orderNaam)}${r.notitie ? `: ${esc(r.notitie)}` : ''}
          ${r.door ? `<span class="bs-log-door">(${esc(r.door)})</span>` : ''}
          ${r.resultaat ? `<div class="bs-log-uitslag">${esc(r.resultaat)}</div>` : ''}</li>`).join('')}</ul>`
        : `<p class="bs-stil">Geen orders gegeven.</p>`}
    </details>`;
}

// ── Acties ──────────────────────────────────────────────────────────────────

async function _doe(fn) {
  try {
    const r = await fn();
    if (r && 'bastion' in r) { _data = r; _teken(); }
    return r;
  } catch (e) { toast(e.message); return null; }
}

const _fac = (id) => _data?.bastion?.facilities.find(f => f.id === id);

function _venster(titel, sub, html) {
  window.app?.openModal?.(titel, sub, `<div class="bs-venster">${html}</div>`, 'bastion');
}

function _nieuwSpecial() {
  const cat = _data.catalogus.special;
  const per = {};
  for (const f of cat) (per[f.level] = per[f.level] || []).push(f);
  _venster('Special facility', `${_data.bastion.aantalSpecial} van ${_data.bastion.slots.totaal} in gebruik`, Object.entries(per).map(([lvl, lijst]) => `
    <h4 class="bs-venster-kop">Level ${lvl}</h4>
    <div class="bs-kiezer">${lijst.map(f => {
      const op = _data.kandidaten?.[f.key] || [];
      const zwaar = op.some(t => !t.startsWith('Prerequisite'));
      return `<button class="bs-kies${zwaar ? ' bs-kies--let' : ''}" data-bs="kies-special" data-key="${esc(f.key)}">
        <span class="bs-fac-ico">${ic(f.icoon)}</span>
        <span class="bs-kies-tekst"><b>${esc(f.naam)}</b>
          <small>${esc(_grootte(f.grootte))} · ${f.orders.map(_orderNaam).join(', ')}</small>
          ${op.map(t => `<small class="bs-let">${esc(t)}</small>`).join('')}</span>
      </button>`;
    }).join('')}</div>`).join(''));
}

function _nieuwBasic() {
  _venster('Basic facility', 'Puur sfeer: geen orders', `
    <div class="bs-formrij">
      <select class="bs-veld" id="bs-basic-key">${_data.catalogus.basic.map(f => `<option value="${esc(f.key)}">${esc(f.naam)}</option>`).join('')}</select>
      <select class="bs-veld" id="bs-basic-grootte">${Object.entries(_data.catalogus.groottes).map(([k, g]) => `<option value="${k}"${k === 'roomy' ? ' selected' : ''}>${esc(g.naam)}</option>`).join('')}</select>
    </div>
    <input class="bs-veld" id="bs-basic-naam" placeholder="Eigen naam (mag leeg)" maxlength="80">
    <button class="bs-knop bs-knop--goud" data-bs="kies-basic">Toevoegen</button>`);
}

function _bewerkFac(f) {
  _venster(f.naam, f.def?.naam || '', `
    <label class="bs-label">Naam</label>
    <input class="bs-veld" id="bs-fac-naam" value="${esc(f.naam)}" maxlength="80">
    ${f.special ? '' : `<label class="bs-label">Grootte</label>
      <select class="bs-veld" id="bs-fac-grootte">${Object.entries(_data.catalogus.groottes).map(([k, g]) => `<option value="${k}"${k === f.grootte ? ' selected' : ''}>${esc(g.naam)}</option>`).join('')}</select>`}
    <label class="bs-label">Aantekening</label>
    <textarea class="bs-veld" id="bs-fac-notitie" rows="3" maxlength="1000">${esc(f.notitie || '')}</textarea>
    <button class="bs-knop bs-knop--goud" data-bs="fac-bewaar" data-fac="${esc(f.id)}">Bewaren</button>`);
}

function _bewerkBastion() {
  const b = _data.bastion;
  _venster('Bastion', _data.groep.naam, `
    <label class="bs-label">Naam</label>
    <input class="bs-veld" id="bs-naam" value="${esc(b.naam)}" maxlength="80">
    <label class="bs-label">Beeld</label>
    <div class="bs-formrij">
      <button class="bs-knop" data-bs="beeld">${ic('image')} ${b.beeldId ? 'Ander beeld' : 'Beeld kiezen'}</button>
      ${b.beeldId ? `<button class="bs-knop" data-bs="beeld-weg">${ic('x')} Geen beeld</button>` : ''}
    </div>
    <label class="bs-label">Special facilities</label>
    <input class="bs-veld" id="bs-slots" type="number" min="0" max="60" value="${b.slots.override ? b.slots.totaal : ''}" placeholder="${b.slots.afgeleid}">
    <div class="bs-formrij">
      <button class="bs-knop bs-knop--goud" data-bs="bastion-bewaar">Bewaren</button>
      <button class="bs-knop bs-knop--rood" data-bs="opheffen">${ic('trash')} Bastion opheffen</button>
    </div>`);
}

function _turnVenster() {
  const met = _data.bastion.facilities.filter(f => f.special && f.order);
  _venster(`Bastion Turn ${_data.bastion.turnNummer + 1}`, `${met.length} order${met.length === 1 ? '' : 's'}`, `
    ${met.length ? met.map(f => `
      <div class="bs-turn-regel">
        <div><b>${esc(f.naam)}</b> — ${esc(_orderNaam(f.order.order))}${f.order.notitie ? `: ${esc(f.order.notitie)}` : ''}
          <span class="bs-log-door">(${f.order.vast ? 'vastgelegd' : 'voorgesteld'} door ${esc(f.order.doorNaam)})</span></div>
        <textarea class="bs-veld" data-uitslag="${esc(f.id)}" rows="2" maxlength="2000" placeholder="Wat het opleverde"></textarea>
      </div>`).join('') : `<p class="bs-stil">Er is geen enkele order gegeven. De turn gaat dan voorbij zonder dat er iets gebeurt.</p>`}
    <button class="bs-knop bs-knop--goud" data-bs="turn-bevestig">${ic('check')} Turn afronden</button>`);
}

const ACTIES = {
  async stichten() {
    const naam = document.getElementById('bs-nieuw-naam')?.value || '';
    await _doe(() => api.post(_pad(''), { naam }));
  },
  'nieuw-special': _nieuwSpecial,
  'nieuw-basic': _nieuwBasic,
  async 'kies-special'(k) {
    const r = await _doe(() => api.post(_pad('/facilities'), { soort: 'special', key: k.dataset.key }));
    if (!r) return;
    window.app?.closeModal?.();
    // Voorgerekend, niet geweigerd: wat opviel staat in de melding.
    const let_ = (r.opmerkingen || []).filter(t => !t.startsWith('Prerequisite'));
    if (let_.length) toast(let_.join(' '));
  },
  async 'kies-basic'() {
    const r = await _doe(() => api.post(_pad('/facilities'), {
      soort: 'basic',
      key: document.getElementById('bs-basic-key')?.value,
      grootte: document.getElementById('bs-basic-grootte')?.value,
      naam: document.getElementById('bs-basic-naam')?.value || '',
    }));
    if (r) window.app?.closeModal?.();
  },
  'fac-bewerk'(k) { const f = _fac(k.dataset.fac); if (f) _bewerkFac(f); },
  async 'fac-bewaar'(k) {
    const body = { naam: document.getElementById('bs-fac-naam')?.value, notitie: document.getElementById('bs-fac-notitie')?.value };
    const g = document.getElementById('bs-fac-grootte');
    if (g) body.grootte = g.value;
    if (await _doe(() => api.put(_pad(`/facilities/${encodeURIComponent(k.dataset.fac)}`), body))) window.app?.closeModal?.();
  },
  async 'fac-weg'(k) {
    const f = _fac(k.dataset.fac);
    if (!f || !confirm(`${f.naam} weghalen uit het bastion?${f.order ? ' De order die er ligt verdwijnt mee.' : ''}`)) return;
    await _doe(() => api.delete(_pad(`/facilities/${encodeURIComponent(f.id)}`)));
  },
  async order(k) {
    const f = _fac(k.dataset.fac);
    if (!f) return;
    // Dezelfde order nog eens: niets veranderen (intrekken heeft een eigen knop).
    if (f.order?.order === k.dataset.order) return;
    await _doe(() => api.put(_pad(`/orders/${encodeURIComponent(f.id)}`), { order: k.dataset.order, notitie: f.order?.notitie || '' }));
  },
  async 'order-weg'(k) {
    await _doe(() => api.put(_pad(`/orders/${encodeURIComponent(k.dataset.fac)}`), { order: null }));
  },
  bewerk: _bewerkBastion,
  beeld() {
    window.mediaPicker?.open({ type: 'afbeelding', suggestedName: _data.bastion.naam, onSelect: async (fileId) => {
      await _doe(() => api.put(_pad(''), { beeldId: fileId }));
      _bewerkBastion();
    } });
  },
  async 'beeld-weg'() { await _doe(() => api.put(_pad(''), { beeldId: null })); _bewerkBastion(); },
  async 'bastion-bewaar'() {
    const slots = document.getElementById('bs-slots')?.value ?? '';
    const r = await _doe(() => api.put(_pad(''), { naam: document.getElementById('bs-naam')?.value, slotsOverride: slots === '' ? null : slots }));
    if (r) window.app?.closeModal?.();
  },
  async opheffen() {
    const b = _data.bastion;
    if (!confirm(`${b.naam} opheffen? Alle facilities, orders en ${b.log.length} turn${b.log.length === 1 ? '' : 's'} in het logboek verdwijnen. Dit kan niet terug.`)) return;
    const r = await _doe(() => api.delete(_pad('?zeker=1')));
    if (r) window.app?.closeModal?.();
  },
  turn: _turnVenster,
  async 'turn-bevestig'() {
    const resultaten = {};
    document.querySelectorAll('[data-uitslag]').forEach(t => { if (t.value.trim()) resultaten[t.dataset.uitslag] = t.value.trim(); });
    const r = await _doe(() => api.post(_pad('/turn'), { resultaten }));
    if (r) { window.app?.closeModal?.(); toast(`Bastion Turn ${r.turn} staat in het logboek.`); }
  },
};

document.addEventListener('click', (e) => {
  const k = e.target.closest?.('[data-bs]');
  if (!k || k.disabled) return;
  const fn = ACTIES[k.dataset.bs];
  if (fn) { e.preventDefault(); fn(k); }
});

document.addEventListener('change', async (e) => {
  const k = e.target.closest?.('[data-bs-change]');
  if (!k) return;
  if (k.dataset.bsChange === 'groep') { _groep = k.value; await render(); return; }
  if (k.dataset.bsChange === 'notitie') {
    const f = _fac(k.dataset.fac);
    if (!f?.order || (f.order.notitie || '') === k.value) return;
    await _doe(() => api.put(_pad(`/orders/${encodeURIComponent(f.id)}`), { order: f.order.order, notitie: k.value }));
  }
});

// `bastion:updated` — de hele campagne; alleen hertekenen als je kijkt.
window._bastionOntvang = (d = {}) => {
  const zicht = document.getElementById('section-bastion')?.classList.contains('active');
  if (!zicht) { _data = null; return; }
  if (!d.groep || !_data || d.groep === _data.groep?.id) render();
};
// `bastion:turn` — alleen de DM, na een lange rust.
window._bastionTurnKlaar = (d = {}) => {
  toast(`${d.naam || 'Het bastion'}: ${d.nachten} nachten sinds de vorige Bastion Turn.`);
  window._bastionOntvang({ groep: d.groep });
};

window.bastion = { render };
