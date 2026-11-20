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

import { api } from './api.js?v=325';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, o) => window.icon?.(n, o) || '';
// In een inline handler decodeert de browser eerst het attribuut en voert dan
// de JavaScript uit: `esc()` alleen laat een apostrof de string sluiten.
const escArg = (v) => esc(typeof v === 'string'
  ? v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') : v);
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

      <section class="bs-blok">
        <div class="bs-blok-kop">
          <h3>Verdediging</h3>
          ${dm ? `<button class="bs-knop" data-bs="aanval">${ic('swords')} Aanval rollen</button>` : ''}
        </div>
        <div class="bs-verdediging">
          <div class="bs-def-getal">
            ${dm ? `<button class="bs-mini" data-bs="def-min" title="Eentje minder">${ic('minus')}</button>` : ''}
            <span class="bs-def-aantal">${b.defenders}</span>
            ${dm ? `<button class="bs-mini" data-bs="def-plus" title="Eentje meer">${ic('plus')}</button>` : ''}
            <span class="bs-def-label">verdediger${b.defenders === 1 ? '' : 's'}</span>
          </div>
          ${dm ? `<label class="bs-vink">
            <input type="checkbox" data-bs-change="muren"${b.muren ? ' checked' : ''}>
            <span>Verdedigingsmuren — een aanval rolt dan ${_data.instellingen.aanvalStenenMuren} in plaats van ${_data.instellingen.aanvalStenen} stenen</span>
          </label>` : (b.muren ? `<p class="bs-stil">${ic('brick-wall')} Het bastion heeft verdedigingsmuren.</p>` : '')}
          ${b.defenderBronnen?.length ? `<p class="bs-stil">
            ${ic('users')} Verdedigers komen van: ${b.defenderBronnen.map(x => esc(x.naam)).join(', ')}.</p>` : ''}
        </div>
      </section>

      ${dm && !t.klaar ? `<div class="bs-turnrij">
        <button class="bs-knop bs-knop--goud" data-bs="turn">${ic('scroll-text')} Bastion Turn afronden${openOrders ? ` (${openOrders} order${openOrders === 1 ? '' : 's'})` : ''}</button>
      </div>` : ''}

      <section class="bs-blok">
        <div class="bs-blok-kop"><h3>Logboek</h3></div>
        ${b.log.length ? b.log.map(x => x.soort === 'aanval' ? _logAanval(x) : _logTurn(x)).join('')
          : `<p class="bs-stil">Nog geen turn gespeeld.</p>`}
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
    <article class="bs-fac${o ? ' bs-fac--order' : ''}${f.inAanbouw ? ' bs-fac--bouw' : ''}${f.beeldId ? ' bs-fac--beeld' : ''}"${
      f.beeldId ? ` style="--bs-fac-bg:url('${api.thumbUrl(f.beeldId)}')"` : ''}>
      ${f.inAanbouw ? `<div class="bs-fac-bouw">${ic('hammer')} In aanbouw — nog ${f.nachtenTeGaan} nacht${f.nachtenTeGaan === 1 ? '' : 'en'}</div>` : ''}
      <div class="bs-fac-kop">
        <span class="bs-fac-ico">${ic(d.icoon || 'hexagon')}</span>
        <div>
          <div class="bs-fac-naam">${esc(f.naam)}</div>
          <div class="bs-fac-type">${f.naam !== d.naam ? `${esc(d.naam)} · ` : ''}${esc(_grootte(f.grootte))} · level ${d.level || '—'}</div>
        </div>
        ${dm ? `<span class="bs-fac-beheer">
          <button class="bs-mini" onclick="window._bastionBeeldKies('${escArg(f.id)}')"
            title="${f.beeldId ? 'Ander beeld' : 'Beeld kiezen'}">${ic('image')}</button>
          ${f.beeldId ? `<button class="bs-mini" onclick="window._bastionBeeldWeg('${escArg(f.id)}')" title="Beeld weghalen">${ic('x')}</button>` : ''}
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

// Wat een order opleverde, als chips onder de regel. Geld staat er in de munt
// van de campagne; een bedrag met een minteken is wat hij kóstte (Recruit).
function _opbrengstHtml(r) {
  const chips = [];
  if (r.bedragCl) {
    const m = window._muntNamen?.() || { fl: 'Gold' };
    const fl = Math.abs(r.bedragCl) / 100;
    chips.push(`${ic('coins')} ${r.bedragCl < 0 ? '−' : '+'} ${fl.toLocaleString('nl-NL')} ${esc(m.fl)}`);
  }
  if (r.itemNaam) chips.push(`${ic('package')} ${esc(r.itemNaam)}`);
  if (r.defenders) chips.push(`${ic('users')} ${r.defenders > 0 ? '+' : ''}${r.defenders} verdediger${Math.abs(r.defenders) === 1 ? '' : 's'}`);
  if (!chips.length) return '';
  return `<div class="bs-opb-chips">${chips.map(c => `<span class="bs-opb-chip">${c}</span>`).join('')}</div>`;
}

function _logTurn(t) {
  const datum = new Date(t.op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <details class="bs-log">
      <summary><b>Bastion Turn ${t.nummer}</b> <span>${esc(datum)} · ${t.nachten} nachten · ${t.regels.length} order${t.regels.length === 1 ? '' : 's'}</span></summary>
      ${t.regels.length ? `<ul>${t.regels.map(r => `
        <li><b>${esc(r.naam)}</b> — ${esc(r.orderNaam)}${r.notitie ? `: ${esc(r.notitie)}` : ''}
          ${r.door ? `<span class="bs-log-door">(${esc(r.door)})</span>` : ''}
          ${r.resultaat ? `<div class="bs-log-uitslag">${esc(r.resultaat)}</div>` : ''}
          ${_opbrengstHtml(r)}</li>`).join('')}</ul>`
        : `<p class="bs-stil">Geen orders gegeven.</p>`}
      ${t.voorval ? `<div class="bs-voorval">${ic('sparkles')} <em>${esc(t.voorval.tekst)}</em>
        ${t.voorval.ofwel ? `
          <div class="bs-voorval-keuze">
            <span class="bs-stil">Empower gaf een tweede worp — welke werd het?</span>
            <button class="bs-knop bs-knop--klein" data-bs="voorval-kies" data-kies="eerste">Deze</button>
            <button class="bs-knop bs-knop--klein" data-bs="voorval-kies" data-kies="tweede">${esc(t.voorval.ofwel.tekst)}</button>
          </div>` : ''}</div>` : ''}
    </details>`;
}

// Een aanval in het logboek: de stenen zoals ze vielen, en wat het aan tafel
// werd. Wat een worp betekent staat in de Dungeon Master's Guide; de app
// bewaart alleen wat er gegooid is en wat de DM erover opschreef.
function _logAanval(a) {
  const datum = new Date(a.op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <details class="bs-log bs-log--aanval">
      <summary><b>${ic('swords')} Aanval</b> <span>${esc(datum)} · ${a.stenen.length} stenen${a.muren ? ' · met muren' : ''} · ${a.defenders} verdediger${a.defenders === 1 ? '' : 's'}</span></summary>
      <div class="bs-stenen">${a.stenen.map(n => `<span class="bs-steen">${n}</span>`).join('')}</div>
      ${a.uitslag ? `<div class="bs-log-uitslag">${esc(a.uitslag)}</div>`
        : `<p class="bs-stil">Nog niet opgeschreven wat het werd.</p>`}
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
  // **Bouwen mag geld en tijd kosten.** Allebei leeg betekent: hij staat er
  // gewoon, zoals altijd. Hoevéél een facility kost staat in de Dungeon
  // Master's Guide en leveren we niet mee; jij vult het in, de app rekent.
  const bouwrij = `
    <div class="bs-bouwrij">
      <label class="bs-opb-veld"><span>Kost</span>
        <input class="bs-veld" id="bs-bouw-kost" placeholder="bv. 500 fl" maxlength="20"></label>
      <label class="bs-opb-veld bs-opb-veld--smal"><span>Nachten</span>
        <input class="bs-veld" id="bs-bouw-nachten" type="number" min="0" max="365" placeholder="0"></label>
      <label class="bs-opb-veld"><span>Betaald door</span>
        <select class="bs-veld" id="bs-bouw-betaler">
          ${(_data.leden || []).map(l => `<option value="${esc(l.id)}">${esc(l.naam)}</option>`).join('')}
        </select></label>
    </div>`;
  _venster('Special facility', `${_data.bastion.aantalSpecial} van ${_data.bastion.slots.totaal} in gebruik`, bouwrij + Object.entries(per).map(([lvl, lijst]) => `
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

async function _defZet(stap) {
  const nu = Math.max(0, (_data?.bastion?.defenders || 0) + stap);
  await _doe(() => api.put(_pad(''), { defenders: nu }));
}

// De voorwerpkaartjes, voor de keuzelijst bij een Craft-opbrengst. Eén keer
// ophalen; de lijst verandert niet tijdens een turn.
let _items = null;
async function _itemsLaden() {
  if (_items) return _items;
  try { _items = (await api.listEntities('voorwerpen')) || []; } catch { _items = []; }
  return _items;
}

// De plaat bij een facility, uit de mediabibliotheek — dezelfde kiezer als
// overal elders in de app, zodat er niet een tweede manier bij komt.
window._bastionBeeldKies = (fid) => {
  window.mediaPicker?.open({
    type: 'afbeelding',
    suggestedName: `bastion-${fid}`,
    onSelect: (fileId) => _doe(() => api.put(_pad(`/facilities/${encodeURIComponent(fid)}`), { beeldId: fileId || null })),
  });
};
window._bastionBeeldWeg = (fid) =>
  _doe(() => api.put(_pad(`/facilities/${encodeURIComponent(fid)}`), { beeldId: null }));

function _turnVenster() {
  const met = _data.bastion.facilities.filter(f => f.special && f.order);
  _venster(`Bastion Turn ${_data.bastion.turnNummer + 1}`, `${met.length} order${met.length === 1 ? '' : 's'}`, `
    ${met.length ? met.map(f => `
      <div class="bs-turn-regel">
        <div><b>${esc(f.naam)}</b> — ${esc(_orderNaam(f.order.order))}${f.order.notitie ? `: ${esc(f.order.notitie)}` : ''}
          <span class="bs-log-door">(${f.order.vast ? 'vastgelegd' : 'voorgesteld'} door ${esc(f.order.doorNaam)})</span></div>
        <textarea class="bs-veld" data-uitslag="${esc(f.id)}" rows="2" maxlength="2000" placeholder="Wat het opleverde"></textarea>
        <!-- Fase 3. Hoevéél een Trade of Craft opbrengt staat in de Dungeon
             Master's Guide; dat vult de DM in en tekent hij af, zoals bij een
             bod van een winkel. Leeg laten betekent: alleen de tekst hierboven.
             (Geen backticks in commentaar hierbinnen: template literal.) -->
        <div class="bs-opbrengst">
          <label class="bs-opb-veld"><span>Geld</span>
            <input class="bs-veld" data-opb="bedrag" data-fac="${esc(f.id)}"
              placeholder="bv. 12 fl" maxlength="20"></label>
          <label class="bs-opb-veld"><span>Voorwerp</span>
            <input class="bs-veld" data-opb="item" data-fac="${esc(f.id)}" list="bs-items"
              placeholder="uit het archief" maxlength="80"></label>
          <label class="bs-opb-veld bs-opb-veld--smal"><span>Verdedigers</span>
            <input class="bs-veld" data-opb="defenders" data-fac="${esc(f.id)}"
              type="number" step="1" placeholder="0"></label>
          <label class="bs-opb-veld"><span>Naar</span>
            <select class="bs-veld" data-opb="naar" data-fac="${esc(f.id)}">
              ${(_data.leden || []).map(l => `<option value="${esc(l.id)}">${esc(l.naam)}</option>`).join('')}
            </select></label>
        </div>
      </div>`).join('') : `<p class="bs-stil">Er is geen enkele order gegeven. De turn gaat dan voorbij zonder dat er iets gebeurt.</p>`}
    <datalist id="bs-items">${(_items || []).map(v => `<option value="${esc(v.name)}"></option>`).join('')}</datalist>
    <button class="bs-knop bs-knop--goud" data-bs="turn-bevestig">${ic('check')} Turn afronden</button>`);
}

const ACTIES = {
  // ── Verdediging (fase 2) ──
  // Het aantal verdedigers houdt de DM bij: de getallen die facilities geven
  // staan in de Dungeon Master's Guide en die leveren we niet mee, dus de app
  // telt hier niets uit.
  'def-plus'() { return _defZet(+1); },
  'def-min'()  { return _defZet(-1); },
  async aanval() {
    const b = _data.bastion;
    if (!confirm(`Een aanval rollen met ${b.aanvalStenen} stenen${b.muren ? ' (met muren)' : ''}?`)) return;
    const r = await _doe(() => api.post(_pad('/aanval'), {}));
    if (!r) return;
    const uitslag = prompt(`De stenen vielen: ${(r.stenen || []).join(', ')}.\n\nWat werd het aan tafel?`, '');
    if (uitslag !== null && uitslag.trim()) await _doe(() => api.put(_pad('/aanval'), { uitslag: uitslag.trim() }));
  },

  async stichten() {
    const naam = document.getElementById('bs-nieuw-naam')?.value || '';
    await _doe(() => api.post(_pad(''), { naam }));
  },
  'nieuw-special': _nieuwSpecial,
  'nieuw-basic': _nieuwBasic,
  async 'kies-special'(k) {
    const r = await _doe(() => api.post(_pad('/facilities'), {
      soort: 'special', key: k.dataset.key,
      kost: document.getElementById('bs-bouw-kost')?.value || '',
      nachten: document.getElementById('bs-bouw-nachten')?.value || 0,
      betaler: document.getElementById('bs-bouw-betaler')?.value || '',
    }));
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
  // De voorwerplijst moet er zijn vóór het venster tekent, anders staat de
  // keuzelijst leeg bij de eerste turn van de avond.
  async turn() { await _itemsLaden(); _turnVenster(); },
  async 'voorval-kies'(k) {
    await _doe(() => api.put(_pad('/voorval'), { kies: k.dataset.kies }));
  },

  async 'turn-bevestig'() {
    const resultaten = {};
    document.querySelectorAll('[data-uitslag]').forEach(t => { if (t.value.trim()) resultaten[t.dataset.uitslag] = t.value.trim(); });
    // Wat een order opleverde: geld, een voorwerp, verdedigers. Een naam die
    // geen kaartje blijkt te zijn gaat niet mee — dan staat er straks een
    // voorwerp in de boedel dat nergens naar wijst.
    const opbrengst = {};
    const vak = (fid) => (opbrengst[fid] = opbrengst[fid] || {});
    document.querySelectorAll('[data-opb]').forEach(el => {
      const v = String(el.value || '').trim();
      if (!v) return;
      const o = vak(el.dataset.fac);
      if (el.dataset.opb === 'bedrag') o.bedrag = v;
      else if (el.dataset.opb === 'defenders') o.defenders = parseInt(v) || 0;
      else if (el.dataset.opb === 'naar') o.naar = v;
      else if (el.dataset.opb === 'item') {
        const ent = (_items || []).find(x => String(x.name || '').toLowerCase() === v.toLowerCase());
        if (ent) { o.itemId = ent.id; o.itemNaam = ent.name; }
        else toast(`Geen voorwerpkaartje met de naam "${v}" — die regel gaat zonder voorwerp mee.`);
      }
    });
    const r = await _doe(() => api.post(_pad('/turn'), { resultaten, opbrengst }));
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
  if (k.dataset.bsChange === 'muren') {
    await _doe(() => api.put(_pad(''), { muren: k.checked }));
    return;
  }
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
