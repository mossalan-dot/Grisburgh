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
// hij doet. Daarvoor staat onderin elk boekje een uitklapper. Waar je was vult
// hij zelf in — dat is precies het stukje dat een melder vergeet en dat je als
// beheerder nodig hebt.

const esc = (s) => window.app?.esc?.(s) ?? String(s ?? '');

// ── Waar is deze DM? ────────────────────────────────────────────────────────
// Zo fijn als het zelf kan zien: de sectie, het tabje van de meesterkamer, het
// spelerstabblad, en wat er eventueel bovenop openstaat.
function _waarBenIk() {
  const d = [];
  const sectie = window.app?.state?.activeSection;
  const tab = (sectie === 'meesterkamer' || document.getElementById('dm-panel')?.offsetParent)
    ? window.dmPanel?.huidigeTab?.() : null;
  // Het tabje zegt al in welke sectie je zit, dus niet allebei: "meesterkamer ·
  // meesterkamer › aktes" is één keer te veel.
  if (tab) d.push('meesterkamer › ' + tab);
  else if (sectie) d.push(sectie);
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
// In het boekje, niet onder een eigen knop in de hoek. Je slaat een boekje open
// omdat je iets niet snapt, en dat is precies het moment waarop blijkt dat het
// aan het scherm ligt en niet aan jou. Eén knop die twee dingen doet in plaats
// van twee knoppen die naast elkaar staan te wachten.
//
// En het antwoord op "waar" is er meteen beter van: de sleutel van het boekje
// (`dm_aktes`, `hulp_bewerk_locaties`) zegt exact welk scherm het is. Dat is
// harder dan wat we uit de DOM kunnen afleiden — al gaat dat er nog bij, want
// het venster dat eroverheen stond weet de sleutel niet.
window._meldBlokHtml = function (sleutel, titel) {
  return `
    <details class="meld-blok" id="meld-blok">
      <summary>${esc('Werkt dit scherm niet zoals het hoort?')}</summary>
      <div class="meld-blok-body">
        <input type="hidden" id="meld-sleutel" value="${esc(sleutel || '')}">
        <input type="hidden" id="meld-titel" value="${esc(titel || '')}">
        <label class="meld-label" for="meld-wat">Wat ging er mis?</label>
        <textarea id="meld-wat" class="meld-veld meld-veld--groot" rows="3"
          placeholder="Wat deed je, en wat gebeurde er in plaats van wat je verwachtte?"></textarea>
        <div class="meld-voet">
          <span class="meld-uit" id="meld-uit"></span>
          <button class="meld-knop" onclick="event.stopPropagation();window._meldVerstuur()">Versturen</button>
        </div>
      </div>
    </details>`;
};

window._meldVerstuur = async function () {
  const wat = document.getElementById('meld-wat');
  const uit = document.getElementById('meld-uit');
  const tekst = (wat?.value || '').trim();
  if (tekst.length < 5) { wat?.focus(); if (uit) uit.textContent = 'Schrijf even wat er misging.'; return; }
  if (uit) uit.textContent = 'Versturen…';
  const sleutel = document.getElementById('meld-sleutel')?.value || '';
  const titel   = document.getElementById('meld-titel')?.value || '';
  // Drie lagen in één regel: hoe het scherm heet, hoe het heet in de code, en
  // waar je stond. De eerste twee komen uit het boekje, de derde uit de DOM —
  // die voegt toe wat de sleutel niet weet, zoals het venster dat eroverheen
  // stond toen je het opendeed.
  const waar = [titel, sleutel ? `(${sleutel})` : '', '— ' + _waarBenIk()].filter(Boolean).join(' ');
  const ok = await _stuur({
    soort: 'melding',
    melding: tekst.split('\n')[0].slice(0, 120),
    toelichting: tekst,
    waar,
  });
  if (!ok) { if (uit) uit.textContent = 'Versturen lukte niet. Staat de verbinding nog?'; return; }
  if (wat) wat.value = '';
  if (uit) uit.textContent = 'Staat genoteerd. Dank je.';
  setTimeout(() => { document.getElementById('meld-blok')?.removeAttribute('open'); if (uit) uit.textContent = ''; }, 1800);
};
