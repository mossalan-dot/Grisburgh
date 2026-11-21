// ════════════════════════════════════════════════════════════════════════════
//  WAT JE HEBT OPGEROEPEN
// ════════════════════════════════════════════════════════════════════════════
// Een Familiar loopt met je mee door de stad, een Faithful Steed draag je door
// een reis heen, een Steel Defender staat naast je als er niet gevochten wordt.
// Een summon is dus geen gevechtsding maar een **toestand van je personage** —
// hij staat in `dmState.playerSummons` en niet in `combat.json`, dat bij het
// sluiten van een gevecht wordt leeggegooid. Loopt er wél een gevecht, dan
// belandt hij óók op de kaart, met het initiatief van zijn baasje.
//
// **Je roept hem zelf op.** Zoals je zelf in Rage gaat en zelf Wild Shape
// aanzet: het is jouw spreuk. De DM ziet hem meteen verschijnen in de rij
// medestanders en, in een gevecht, op het canvas.
//
// **De app kent zijn cijfers lang niet altijd.** Zeven van de 25 kunnen we
// compleet neerzetten — hun gedaantes zijn gewone SRD-wezens (een Owl, een
// Warhorse, een Skeleton). De andere achttien staan in een boek waaruit we
// niets mogen overnemen, en de twaalf *Spirits* hebben bovendien geen vást
// statblok: hun HP en AC hangen af van het slotniveau. Daar vraagt dit venster
// ze één keer en onthoudt de server ze, zodat de tweede keer weer één klik is.
import { api } from './api.js?v=326';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escA = (s) => esc(String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
const ic = (n, o) => window.icon?.(n, o) || '';

let _stand = { summons: [], aanbod: [] };
let _bezig = false;

async function _laad(id) {
  try { _stand = await api.get(`/characters/${id}/summons`) || { summons: [], aanbod: [] }; }
  catch { _stand = { summons: [], aanbod: [] }; }
  _stand.summons = _stand.summons || [];
  _stand.aanbod  = _stand.aanbod  || [];
  return _stand;
}

// **Een lange rust haalt niets weg.** Welke summons een nacht overleven
// verschilt per spreuk — een Familiar blijft tot je hem wegstuurt, een Bestial
// Spirit een uur — en dat staat in teksten die we niet hebben. Stilletjes
// wissen zou dus bij de helft fout zijn. Dus wist de app niets, maar zégt ze
// het wel: de server zet `oud` als er een rust overheen ging. Wegsturen is één
// klik.
const _oud = (s) => !!s.oud;

// Wanneer hij verdwijnt staat op zijn kaartje in Naslag (de DM zet het daar
// één keer); hier staat alleen wat eruit kwam.
const _VERDWIJNT = { rust: 'tot je lange rust', gevecht: 'tot het gevecht uit is' };

function _teken(el) {
  if (!el) return;
  const heeftAanbod = _stand.aanbod.length > 0;
  if (!_stand.summons.length && !heeftAanbod) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="player-dash-section summon-blok">
      <div class="player-dash-section-title">${ic('sparkles')} Opgeroepen</div>
      ${_stand.summons.length ? `<div class="summon-lijst">${_stand.summons.map(s => `
        <div class="summon-rij${_oud(s) ? ' summon-rij--oud' : ''}">
          <span class="summon-naam">${esc(s.naam)}</span>
          <span class="summon-cijfers">${s.maxHp ? `${ic('heart')} ${esc(String(s.hp ?? s.maxHp))}/${esc(String(s.maxHp))}` : ''}${
            s.ac ? ` · ${ic('shield')} ${esc(String(s.ac))}` : ''}</span>
          ${_oud(s) ? '<span class="summon-oud-hint" title="Hij stond er al voor je laatste lange rust">van voor je rust</span>' : ''}
          ${_VERDWIJNT[s.verdwijnt] ? `<span class="summon-duur" title="Ingesteld op zijn kaartje in Naslag">${esc(_VERDWIJNT[s.verdwijnt])}</span>` : ''}
          <button type="button" class="summon-weg" title="Wegsturen"
            onclick="window.summons.weg('${escA(s.id)}')">${ic('x')}</button>
        </div>`).join('')}</div>`
        : '<p class="dm-hint summon-leeg">Je hebt niemand opgeroepen.</p>'}
      ${heeftAanbod ? `<button type="button" class="dm-btn dm-btn-ghost dm-btn-sm summon-roep"
        onclick="window.summons.kies()">${ic('plus')} Roep op</button>` : ''}
    </div>`;
}

export async function summonBlok() {
  const el = document.getElementById('summon-blok');
  if (!el) return;
  const id = window._lastCharId;
  if (!id) { el.innerHTML = ''; return; }
  await _laad(id);
  _teken(el);
}

// ── Het kiesvenster ─────────────────────────────────────────────────────────
// Twee stappen in één scherm: wie, en in welke gedaante. Kennen we zijn
// cijfers niet, dan staan HP en AC erbij — voorgevuld met wat je de vorige keer
// intikte, want dan is dit de tweede keer één klik.
function _keuzeHtml(def) {
  const o = def.onthouden || {};
  const vormen = def.vormen || [];
  const bekend = def.bekend;
  return `
    <div class="summon-kies-kop">
      <strong>${esc(def.naam)}</strong>
      <span class="dm-hint">${esc(def.geeft)}${def.boek ? ` · ${esc(def.boek)}` : ''}</span>
    </div>
    ${vormen.length ? `
      <div class="dm-form-row">
        <label class="dm-form-label" for="summon-vorm">Gedaante</label>
        <select class="dm-input" id="summon-vorm" onchange="window.summons._vormGewisseld()">
          ${vormen.map(v => `<option value="${esc(v.naam)}"${o.vorm === v.naam ? ' selected' : ''}
            data-bekend="${v.bekend ? '1' : ''}">${esc(v.naam)}${v.bekend ? '' : ' — statblok onbekend'}</option>`).join('')}
        </select>
      </div>` : ''}
    <div class="dm-form-row">
      <label class="dm-form-label" for="summon-naam">Hoe noem je hem?</label>
      <input class="dm-input" id="summon-naam" maxlength="60" value="${esc(o.naam || '')}"
        placeholder="${esc(def.naam)}">
    </div>
    <div class="summon-cijfervelden" id="summon-cijfers"${bekend && !vormen.some(v => !v.bekend) ? ' hidden' : ''}>
      <p class="dm-hint">Zijn statblok staat in ${esc(def.boek || 'het boek')} en mag hier niet staan.
        Lees zijn HP en AC daar af — de app onthoudt ze, dus de volgende keer is dit één klik.</p>
      <div class="dm-form-row">
        <label class="dm-form-label" for="summon-hp">HP</label>
        <input class="dm-input" id="summon-hp" type="number" min="1" value="${esc(o.hp ?? '')}" placeholder="bv. 30">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label" for="summon-ac">AC</label>
        <input class="dm-input" id="summon-ac" maxlength="20" value="${esc(o.ac ?? '')}" placeholder="bv. 13">
      </div>
    </div>`;
}

function kies(metgezelId) {
  const lijst = _stand.aanbod;
  if (!lijst.length) { window._showToast?.('Je kunt nog niets oproepen'); return; }
  const def = lijst.find(x => x.id === metgezelId) || lijst[0];
  window.app.openModal('Roep iemand op', '', `
    ${lijst.length > 1 ? `
      <div class="dm-form-row">
        <label class="dm-form-label" for="summon-wie">Wie</label>
        <select class="dm-input" id="summon-wie" onchange="window.summons._wissel(this.value)">
          ${lijst.map(x => `<option value="${esc(x.id)}"${x.id === def.id ? ' selected' : ''}>${esc(x.naam)} — ${esc(x.geeft)}</option>`).join('')}
        </select>
      </div>` : ''}
    <div id="summon-keuze">${_keuzeHtml(def)}</div>
    <div class="dm-feature-row" style="justify-content:flex-end">
      <button class="dm-btn dm-btn-ghost" onclick="window.app.closeModal()">Annuleren</button>
      <button class="dm-btn dm-btn-primary" onclick="window.summons._roep('${escA(def.id)}')">${ic('sparkles')} Roep op</button>
    </div>`);
}

// Een andere kiezen hertekent alleen het onderste stuk. Het hele venster
// opnieuw openen zou de keuzelijst zijn focus kosten, en dan moet je er na elke
// wissel opnieuw heen.
function _wissel(metgezelId) {
  const vak = document.getElementById('summon-keuze');
  const def = _stand.aanbod.find(x => x.id === metgezelId);
  if (vak && def) vak.innerHTML = _keuzeHtml(def);
}

// Een gedaante die we kennen vult zichzelf; een die we niet kennen vraagt om
// cijfers. Dat kan per gedaante verschillen (vier van de vijf Greater Steeds
// staan in de SRD), dus de velden verschijnen bij het wisselen.
function _vormGewisseld() {
  const sel = document.getElementById('summon-vorm');
  const vak = document.getElementById('summon-cijfers');
  if (!sel || !vak) return;
  vak.hidden = sel.selectedOptions[0]?.dataset.bekend === '1';
}

async function _roep(metgezelId) {
  if (_bezig) return;
  const id = window._lastCharId;
  if (!id) return;
  const v = (x) => document.getElementById(x)?.value?.trim() || '';
  const gekozen = document.getElementById('summon-wie')?.value || metgezelId;
  _bezig = true;
  try {
    const r = await api.post(`/characters/${id}/summons`, {
      metgezelId: gekozen, vorm: v('summon-vorm'), naam: v('summon-naam'),
      hp: v('summon-hp'), ac: v('summon-ac'),
    });
    window.app.closeModal();
    await summonBlok();
    window._showToast?.(`${ic('sparkles')} ${esc(r?.summon?.naam || 'Opgeroepen')}${r?.opKaart ? ' staat op de kaart' : ''}`);
  } catch (e) {
    window._showToast?.(e?.message || 'Dat lukte niet');
  } finally { _bezig = false; }
}

async function weg(summonId) {
  const id = window._lastCharId;
  if (!id) return;
  const s = _stand.summons.find(x => x.id === summonId);
  if (!confirm(`${s?.naam || 'Hem'} wegsturen?`)) return;
  try {
    await api.delete(`/characters/${id}/summons/${summonId}`);
    await summonBlok();
  } catch (e) { window._showToast?.(e?.message || 'Dat lukte niet'); }
}

// Vanaf een kaartje in Naslag → Familiars, of vanuit een spreuk: roep déze op.
// De lijst laadt lui, net als in het blok zelf.
async function roepOp(metgezelId) {
  const id = window._lastCharId;
  if (!id) { window._showToast?.('Log in als speler om iemand op te roepen'); return; }
  await _laad(id);
  if (!_stand.aanbod.some(x => x.id === metgezelId)) {
    window._showToast?.('Die kun jij niet oproepen');
    return;
  }
  kies(metgezelId);
}

// Kan deze speler dit wezen oproepen? Voor de knop op een kaartje, die er niet
// hoort te staan als het antwoord nee is.
async function kan(metgezelId) {
  const id = window._lastCharId;
  if (!id) return false;
  if (!_stand.aanbod.length) await _laad(id);
  return _stand.aanbod.some(x => x.id === metgezelId);
}

window.summons = { blok: summonBlok, kies, weg, roepOp, kan, _roep, _wissel, _vormGewisseld };
window._summonBlok = summonBlok;
