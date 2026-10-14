// ════════════════════════════════════════════════════════════════════════════
//  "ER GAAT IETS MIS" — OPVANGEN EN MELDEN
// ════════════════════════════════════════════════════════════════════════════
// Twee wegen naar hetzelfde boekje.
//
// **Vanzelf.** Een uitzondering in de browser eindigde in de console, en een
// console kijkt niemand aan tafel na: je ziet een knop die niets doet en je
// speelt verder. Die worden nu gemeld. Hooguit vijf per sessie en ontdubbeld —
// een fout die in een tekenlus zit gooit er anders tweehonderd.
//
// **Met de hand.** Niet alles wat misgaat gooit een fout: een knop op de
// verkeerde plek, een naam die niet klopt, een tekst die iets anders zegt dan
// hij doet. Daarvoor is het tabje onder de dobbelsteen. Waar je was vult hij
// zelf in — dat is precies het stukje dat een melder vergeet en dat je als
// beheerder nodig hebt.

const esc = (s) => window.app?.esc?.(s) ?? String(s ?? '');

// ── Waar is deze DM? ────────────────────────────────────────────────────────
// Zo fijn als het zelf kan zien: de sectie, het tabje van de meesterkamer, het
// spelerstabblad, en wat er eventueel bovenop openstaat.
function _waarBenIk() {
  const d = [];
  const sectie = window.app?.state?.activeSection;
  if (sectie) d.push(sectie);
  if (sectie === 'meesterkamer' || document.getElementById('dm-panel')?.offsetParent) {
    const t = window.dmPanel?.huidigeTab?.();
    if (t) d.push('meesterkamer › ' + t);
  }
  const subtab = document.querySelector('.player-subtab.active')?.dataset?.tab;
  if (subtab) d.push('speler › ' + subtab);
  const modal = document.querySelector('#modal-overlay.active .modal-title, #modal-overlay.active #m-title');
  if (modal?.textContent?.trim()) d.push('venster: ' + modal.textContent.trim().slice(0, 60));
  return d.join(' · ') || location.hash || 'onbekend';
}

function _versie() {
  const src = document.querySelector('script[src*="/js/app.js"]')?.getAttribute('src') || '';
  return (src.match(/v=(\d+)/) || [])[1] ? 'app v' + src.match(/v=(\d+)/)[1] : '';
}

// ── Vanzelf opvangen ────────────────────────────────────────────────────────
const _gemeld = new Set();
let _aantal = 0;

async function _stuur(data) {
  try {
    await fetch('/api/fout', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versie: _versie(), waar: _waarBenIk(), ...data }),
    });
    return true;
  } catch { return false; }
}

function _vang(melding, stack) {
  if (_aantal >= 5) return;                       // één kapotte lus vult anders het boekje
  const sleutel = String(melding) + '|' + String(stack || '').split('\n')[1];
  if (_gemeld.has(sleutel)) return;
  _gemeld.add(sleutel); _aantal++;
  _stuur({ soort: 'client', melding: String(melding || 'Onbekende fout'), stack: String(stack || '') });
}

window.addEventListener('error', (ev) => {
  // Een plaatje dat niet laadt is ook een 'error', maar geen uitzondering.
  if (!ev.message && ev.target !== window) return;
  _vang(ev.message, ev.error?.stack || `${ev.filename}:${ev.lineno}`);
}, true);
window.addEventListener('unhandledrejection', (ev) => {
  const r = ev.reason;
  _vang('Onafgehandelde belofte: ' + String(r?.message || r), r?.stack || '');
});

// ── Met de hand melden ──────────────────────────────────────────────────────
window._meldToggle = function () {
  const p = document.getElementById('meld-panel');
  if (!p) return;
  const open = p.classList.toggle('open');
  if (!open) return;
  const waar = document.getElementById('meld-waar');
  if (waar) waar.value = _waarBenIk();            // elke keer opnieuw: je bent verhuisd
  document.getElementById('meld-wat')?.focus();
};

window._meldVerstuur = async function () {
  const wat  = document.getElementById('meld-wat');
  const waar = document.getElementById('meld-waar');
  const uit  = document.getElementById('meld-uit');
  const tekst = (wat?.value || '').trim();
  if (tekst.length < 5) { wat?.focus(); if (uit) uit.textContent = 'Schrijf even wat er misging.'; return; }
  if (uit) uit.textContent = 'Versturen…';
  const ok = await _stuur({
    soort: 'melding',
    melding: tekst.split('\n')[0].slice(0, 120),
    toelichting: tekst,
    waar: (waar?.value || '').trim() || _waarBenIk(),
  });
  if (!ok) { if (uit) uit.textContent = 'Versturen lukte niet. Staat de verbinding nog?'; return; }
  if (wat) wat.value = '';
  if (uit) uit.textContent = 'Staat genoteerd. Dank je.';
  setTimeout(() => { document.getElementById('meld-panel')?.classList.remove('open'); if (uit) uit.textContent = ''; }, 1800);
};

// De knop en het paneel hangen naast de dobbelsteen en horen bij de DM: een
// speler meldt het aan zijn DM, niet aan de beheerder van de server.
function _bouw() {
  if (document.getElementById('meld-fab')) return;
  const knop = document.createElement('button');
  knop.id = 'meld-fab'; knop.className = 'meld-fab hidden';
  knop.title = 'Een fout melden';
  knop.setAttribute('aria-label', 'Een fout melden');
  knop.onclick = () => window._meldToggle();
  knop.innerHTML = `<svg class="icon" aria-hidden="true"><use href="/img/icons.svg?v=19#icon-message-circle"/></svg>`;
  const paneel = document.createElement('div');
  paneel.id = 'meld-panel'; paneel.className = 'meld-panel';
  paneel.innerHTML = `
    <div class="meld-kop">
      <span class="meld-titel">Een fout melden</span>
      <span class="meld-kop-knoppen">
        ${window._helpBtn ? window._helpBtn('dm_melden') : ''}
        <button class="meld-sluit" onclick="window._meldToggle()" title="Sluiten">&times;</button>
      </span>
    </div>
    <label class="meld-label" for="meld-waar">Waar</label>
    <input id="meld-waar" class="meld-veld" readonly>
    <label class="meld-label" for="meld-wat">Wat ging er mis?</label>
    <textarea id="meld-wat" class="meld-veld meld-veld--groot" rows="4"
      placeholder="Wat deed je, en wat gebeurde er in plaats van wat je verwachtte?"></textarea>
    <div class="meld-voet">
      <span class="meld-uit" id="meld-uit"></span>
      <button class="meld-knop" onclick="window._meldVerstuur()">Versturen</button>
    </div>`;
  document.body.append(knop, paneel);
}

// Alleen voor de DM in beeld. De knop bestaat voor iedereen in de DOM maar
// blijft verborgen; zo hoeft er bij het wisselen van rol niets herbouwd.
window._meldZichtbaar = (aan) => {
  _bouw();
  document.getElementById('meld-fab')?.classList.toggle('hidden', !aan);
  if (!aan) document.getElementById('meld-panel')?.classList.remove('open');
};

_bouw();
