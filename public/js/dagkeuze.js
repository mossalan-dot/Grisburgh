// ════════════════════════════════════════════════════════════════════════════
//  WAT JE ELKE DAG OPNIEUW KIEST
// ════════════════════════════════════════════════════════════════════════════
// Drie species geven je een skill "until the end of your next long rest":
// Githyanki (Astral Knowledge), Astral Elf (Astral Trance) en Kalashtar
// (Severed from Dreams). Dat is geen keuze die je bij het maken van je
// personage vastlegt — het is iets wat bij het ontwaken hoort, zoals het
// voorbereiden van je spreuken.
//
// Dus staat het hier, op je eigen tabblad, en maakt de lange rust het weer
// leeg. Wat je kiest gaat meteen op je blad: de skill staat daarna gewoon
// tussen je proficiencies, met het vinkje erbij.
//
// Dit blok tekent alleen wat `bijRust` draagt. De andere keuzes van je
// features zijn één keer gemaakt in de maker en horen niet elke sessie opnieuw
// in beeld te staan.
//
// **Het staat op twee plekken, en dat is met opzet.** De echte plek is de
// rustoverlay: daar word je wakker, en daar hoort "wat kies je vandaag" te
// staan — net als de Hit Dice bij een korte rust. Op je Personage-tab staat
// hetzelfde paneel als naslag, voor als je de overlay hebt weggeklikt of
// halverwege de avond wilt zien wat je ook alweer koos. Eén renderer voor
// allebei; twee die hetzelfde moeten tonen lopen uit elkaar.
import { api } from './api.js?v=328';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, o) => window.icon?.(n, o) ?? '';

let _slots = [];
let _bezig = false;
// Welke bakken dit paneel tonen. Na een keuze moeten ze allebei bij: wie in de
// rustoverlay kiest en hem daarna wegklikt, hoort op zijn tabblad hetzelfde te
// zien. Een Set, want een bak die uit de DOM verdwenen is valt er vanzelf uit.
const _bakken = new Set();

async function _laad(id) {
  try {
    const r = await api.get(`/characters/${id}/keuzes`);
    _slots = (r?.slots || []).filter(s => s.keuze?.bijRust);
  } catch { _slots = []; }
  return _slots;
}

function _teken(el, kop) {
  if (!el) return;
  if (!_slots.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="player-dash-section dagkeuze">
      <div class="player-dash-section-title player-dash-section-title--with-btn">${ic('sunset')} ${esc(kop)}<span class="pds-kop-hulp">${window._helpBtn?.('dagkeuze') || ''}</span></div>
      ${_slots.map((sl, i) => {
        const gekozen = sl.gekozen || [];
        const over = Math.max(0, sl.keuze.aantal - gekozen.length);
        return `
        <div class="dagkeuze-rij${over ? ' dagkeuze-rij--open' : ''}">
          <div class="dagkeuze-kop">
            <span class="dagkeuze-naam">${esc(sl.keuze.label || sl.naam)}</span>
            <span class="dagkeuze-bron">${esc(sl.bron)}${sl.sub ? ` · ${esc(sl.sub)}` : ''}</span>
          </div>
          ${sl.opties?.length ? `
            <div class="dagkeuze-opties">${sl.opties.map(o => `
              <button type="button" class="dagkeuze-optie${gekozen.includes(o) ? ' is-aan' : ''}"
                data-dagkeuze="${i}" data-naam="${esc(o)}">${esc(o)}</button>`).join('')}</div>`
            : `<input class="dagkeuze-vrij" value="${esc(gekozen[0] || '')}" data-dagkeuze="${i}"
                 placeholder="Schrijf op wat je koos">`}
        </div>`;
      }).join('')}
    </div>`;
}

// Vul een bak. `kop` verschilt per plek: in de rustoverlay is het een vraag
// (je moet nog kiezen), op je tabblad een mededeling (dit koos je).
export async function vul(el, { kop = 'Wat je vandaag koos' } = {}) {
  if (!el) return;
  const id = window._lastCharId;
  if (!id) { el.innerHTML = ''; return; }
  // De kop op de bak zelf, zodat `_allesBij` hem na een keuze terugvindt
  // zonder dat deze module moet onthouden welke bak welke is.
  el.dataset.dagkeuzeKop = kop;
  _bakken.add(el);
  await _laad(id);
  _teken(el, kop);
}

async function dagkeuzeBlok() {
  const el = document.getElementById('dagkeuze-blok');
  if (!el) return;
  await vul(el);
}

// Alles bijwerken wat nog op het scherm staat.
async function _allesBij() {
  const id = window._lastCharId;
  if (!id) return;
  await _laad(id);
  for (const el of [..._bakken]) {
    if (!el.isConnected) { _bakken.delete(el); continue; }
    _teken(el, el.dataset.dagkeuzeKop || 'Wat je vandaag koos');
  }
}

// Tikken op een optie: aan of uit. Zijn er meer te kiezen dan er mogen, dan
// valt de oudste eraf — dat is prettiger dan een knop die niets doet en je
// laat raden waarom.
async function _kies(i, naam) {
  if (_bezig) return;
  const sl = _slots[i];
  const id = window._lastCharId;
  if (!sl || !id) return;
  const nu = [...(sl.gekozen || [])];
  const idx = nu.indexOf(naam);
  if (idx >= 0) nu.splice(idx, 1);
  else { nu.push(naam); while (nu.length > sl.keuze.aantal) nu.shift(); }
  _bezig = true;
  try {
    await api.post(`/characters/${id}/keuzes`, { sleutel: sl.sleutel, namen: nu });
    await _allesBij();
    // Het blad bijwerken doet de server: hij stuurt `player:profile-updated`
    // mee, en daar hangt de spelerstab al aan.
  } catch (e) {
    window._showToast?.(e?.message || 'Dat lukte niet');
  } finally { _bezig = false; }
}

document.addEventListener('click', (ev) => {
  const knop = ev.target.closest('.dagkeuze-optie');
  if (!knop) return;
  _kies(Number(knop.dataset.dagkeuze), knop.dataset.naam);
});

document.addEventListener('change', (ev) => {
  const veld = ev.target.closest('.dagkeuze-vrij');
  if (!veld) return;
  const sl = _slots[Number(veld.dataset.dagkeuze)];
  const id = window._lastCharId;
  if (!sl || !id) return;
  api.post(`/characters/${id}/keuzes`, { sleutel: sl.sleutel, namen: [veld.value] })
    .then(() => _allesBij())
    .catch(e => window._showToast?.(e?.message || 'Dat lukte niet'));
});

window._dagkeuzeBlok = dagkeuzeBlok;
// Voor de rustoverlay, die zijn eigen bak meegeeft (zie `_rustCinematic`).
window._dagkeuzeVul = vul;
