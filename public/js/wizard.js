// ════════════════════════════════════════════════════════════════════════════
//  DE OPSTARTWIZARD
// ════════════════════════════════════════════════════════════════════════════
// Stap 6 uit `docs/multi-dm-plan.md`. Een nieuwe DM krijgt een lege campagne en
// moet zelf bedenken wélke van de dertig instellingen ertoe doen voordat hij
// kan spelen. Die staan verspreid over drie tabjes van Instellingen en zes
// dienstpanelen, en de belangrijkste ervan — hoe je je tafels indeelt — is
// achteraf niet meer recht te zetten.
//
// **Waar hij draait, en waarom dáár.** Het plan zei "campagnenaam → munten →
// modules → diensten", maar modules zijn `requireBeheerder`: een nieuwe DM mág
// ze helemaal niet zetten. Die stap hoort dus bij wie de campagne aanmaakt, en
// de rest bij wie hem gaat spelen. Daarom draait deze wizard **in de campagne
// zelf**, als de DM van die campagne — en gebruikt hij alleen endpoints die er
// al waren. Hij voegt niets toe aan de server behalve één vlag: dat hij
// geweest is.
//
// Hij blokkeert nooit. Overslaan mag bij elke stap; wat je overslaat vind je
// terug bij Instellingen, en dat staat er ook bij.

import { api } from './api.js?v=304';

const esc = s => window.app?.esc?.(s) ?? String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ico = (n, o) => window.icon?.(n, o) ?? '';

const W = {
  stap: 0,
  groepen: [],
  data: { appTitle: '', appSubtitle: '', currency: null, diensten: {}, groep: null, pc: null },
  bezig: false,
};

// Welke diensten een naam kunnen krijgen, en hoe ze heten als je niets kiest.
// De sleutel is die van `meta.<dienst>`; het label is wat het ís, niet hoe het
// in Grisburgh heet — precies het onderscheid waar stap 3 van het plan over
// ging. De module-id erbij, want een dienst die uit staat vraag je niet.
const DIENSTEN = [
  { sleutel: 'herberg',   module: 'herberg',    label: 'De herberg',     hint: 'Waar de party slaapt en eet' },
  { sleutel: 'tweespalt', module: 'arena',      label: 'Het gokhuis',    hint: 'Wedden, en het strijdperk' },
  { sleutel: 'gock',      module: 'detective',  label: 'De detective',   hint: 'Vragen uitbesteden' },
  { sleutel: 'markt',     module: 'markt',      label: 'De markt',       hint: 'Alle winkels op één plek' },
  { sleutel: 'tempel',    module: 'tempel',     label: 'De tempel',      hint: 'Zegeningen, eden en vloeken' },
  { sleutel: 'ursula',    module: 'waarzegger', label: 'De waarzegger',  hint: 'Een blik vooruit' },
  { sleutel: 'magizoo',   module: 'magizoo',    label: 'De magizoöloog', hint: 'Metgezellen adopteren' },
  { sleutel: 'woekeraar', module: 'woekeraar',  label: 'De woekeraar',   hint: 'Lenen tegen rente' },
];

// ── De stappen ──────────────────────────────────────────────────────────────
// Elke stap levert zijn eigen HTML en zijn eigen "bewaar dit"-functie. Zo staat
// per stap op één plek wat hij vraagt en wat hij ermee doet.
const STAPPEN = [
  {
    id: 'welkom',
    titel: 'Je campagne',
    lead: 'Twee dingen om mee te beginnen. Alles hierna mag je overslaan.',
    html() {
      const m = window.app?.state?.meta || {};
      return `
        <div class="wz-veld">
          <label class="dm-form-label" for="wz-titel">Hoe heet je campagne?</label>
          <input id="wz-titel" class="dm-input" maxlength="60" value="${esc(m.appTitle || '')}"
            placeholder="De naam die bovenaan staat">
        </div>
        <div class="wz-veld">
          <label class="dm-form-label" for="wz-sub">Een ondertitel (mag leeg)</label>
          <input id="wz-sub" class="dm-input" maxlength="90" value="${esc(m.appSubtitle || '')}"
            placeholder="Een halve zin die de toon zet">
        </div>`;
    },
    async bewaar() {
      const appTitle = document.getElementById('wz-titel')?.value.trim() || '';
      const appSubtitle = document.getElementById('wz-sub')?.value.trim() || '';
      if (!appTitle) return;
      await api.saveAppMeta({ appTitle, appSubtitle });
      if (window.app?.state?.meta) Object.assign(window.app.state.meta, { appTitle, appSubtitle });
    },
  },
  {
    id: 'munten',
    titel: 'Je munten',
    lead: 'De verhouding blijft die van het boek — 1 goud = 10 zilver = 100 koper. Alleen hoe ze heten is aan jou.',
    html() {
      const c = window._muntNamen();
      return `
        <div class="wz-munten">
          ${[['fl', 'Goud', c.fl], ['kn', 'Zilver', c.kn], ['cl', 'Koper', c.cl]].map(([k, rol, v]) => `
            <div class="wz-veld">
              <label class="dm-form-label" for="wz-munt-${k}">${rol}</label>
              <input id="wz-munt-${k}" class="dm-input" maxlength="24" value="${esc(v)}">
            </div>`).join('')}
        </div>`;
    },
    async bewaar() {
      const currency = {
        fl: document.getElementById('wz-munt-fl')?.value.trim() || 'Gold',
        kn: document.getElementById('wz-munt-kn')?.value.trim() || 'Silver',
        cl: document.getElementById('wz-munt-cl')?.value.trim() || 'Copper',
      };
      await api.saveAppMeta({ currency });
      window._currency = currency;
      if (window.app?.state?.meta) window.app.state.meta.currency = currency;
    },
  },
  {
    id: 'diensten',
    titel: 'Hoe je plekken heten',
    lead: 'Alleen de diensten die voor jou aanstaan. Laat je iets leeg, dan staat er wát het is.',
    // Een dienst die uit staat vraag je niet: dan is dit een lijst met dingen
    // die je nergens terugvindt.
    beschikbaar() { return DIENSTEN.some(d => window._moduleAan?.(d.module)); },
    html() {
      const m = window.app?.state?.meta || {};
      const rijen = DIENSTEN.filter(d => window._moduleAan?.(d.module)).map(d => `
        <div class="wz-veld">
          <label class="dm-form-label" for="wz-d-${d.sleutel}">${esc(d.label)}
            <span class="wz-hint">${esc(d.hint)}</span></label>
          <input id="wz-d-${d.sleutel}" class="dm-input" maxlength="80"
            value="${esc(m[d.sleutel]?.naam || '')}" placeholder="${esc(d.label)}">
        </div>`).join('');
      return `<div class="wz-diensten">${rijen}</div>`;
    },
    async bewaar() {
      for (const d of DIENSTEN) {
        if (!window._moduleAan?.(d.module)) continue;
        const naam = document.getElementById(`wz-d-${d.sleutel}`)?.value.trim() || '';
        if (!naam) continue;
        try { await api.saveDienstNaam(d.sleutel, naam); }
        catch { /* een dienst die geen naamveld blijkt te hebben slaan we over */ }
      }
    },
  },
  {
    id: 'party',
    titel: 'Je eerste tafel',
    // Dit is de enige stap met een echte waarschuwing, en die hoort hier en
    // nergens anders: twee party's zijn later niet samen te voegen.
    lead: 'Een party is een tafel: wie samen spelen, delen wat ze gezien hebben.',
    async voor() { W.groepen = (await api.listGroups())?.groups || []; },
    html() {
      const g = W.groepen.find(x => x.id === window._activeGroupId) || W.groepen[0] || {};
      return `
        <div class="wz-veld">
          <label class="dm-form-label" for="wz-groep">Hoe heet deze party?</label>
          <input id="wz-groep" class="dm-input" maxlength="60" value="${esc(g.name || '')}"
            placeholder="Donderdagavond, De Ravenbende, …">
        </div>
        <div class="wz-veld">
          <label class="dm-form-label" for="wz-groep-pw">Wachtwoord voor je spelers</label>
          <input id="wz-groep-pw" class="dm-input" maxlength="60" autocomplete="off"
            placeholder="Dit deel je per appje">
        </div>
        <div class="wz-waarschuwing">
          ${ico('shield')}
          <div>
            <strong>Deel je tafels nu in zoals je ze gaat spelen.</strong>
            Een personage verhuizen naar een andere party kan later wel, maar alles wat
            de párty over hem onthoudt blijft achter: welke voorwerpkaartjes van hem zijn,
            welke geheimen hij al kent, welke kaartjes zichtbaar waren, zijn metgezel en de
            gedeelde beurs. Alleen losse boedelregels en geld reizen mee. Twee party's
            samenvoegen kan helemaal niet.
          </div>
        </div>`;
    },
    async bewaar() {
      const naam = document.getElementById('wz-groep')?.value.trim() || '';
      const pw   = document.getElementById('wz-groep-pw')?.value.trim() || '';
      // Niet blind op `W.groepen` vertrouwen: wie halverwege terugbladert of
      // een trage verbinding heeft, zou hier stilletjes niets opslaan — en dat
      // is precies de stap waarvan je later niet meer kunt zien dat hij miste.
      if (!W.groepen.length) { try { W.groepen = (await api.listGroups())?.groups || []; } catch { /* leeg */ } }
      const gid  = window._activeGroupId || W.groepen[0]?.id;
      if (!gid) { window._showToast?.('Geen party gevonden om te benoemen.'); return; }
      if (naam) await api.updateGroup(gid, naam);
      if (pw)   await api.setGroupPassword(gid, pw);
      W.data.groep = { id: gid, naam, pw };
    },
  },
  {
    id: 'speler',
    titel: 'Je eerste personage',
    lead: 'Eén om mee te proeven. De rest maak je in het archief, of je spelers doen het aan tafel met je mee.',
    html() {
      return `
        <div class="wz-veld">
          <label class="dm-form-label" for="wz-pc">Naam van het personage</label>
          <input id="wz-pc" class="dm-input" maxlength="60" placeholder="Zoals je hem aan tafel noemt">
        </div>
        <div class="wz-rij">
          <div class="wz-veld">
            <label class="dm-form-label" for="wz-pc-klasse">Class</label>
            <input id="wz-pc-klasse" class="dm-input" maxlength="40" placeholder="Fighter, Wizard, …">
          </div>
          <div class="wz-veld wz-veld--smal">
            <label class="dm-form-label" for="wz-pc-level">Level</label>
            <input id="wz-pc-level" class="dm-input" type="number" min="1" max="20" value="1">
          </div>
        </div>`;
    },
    async bewaar() {
      const name = document.getElementById('wz-pc')?.value.trim() || '';
      if (!name) return;
      const klasse = document.getElementById('wz-pc-klasse')?.value.trim() || '';
      const level  = Math.min(20, Math.max(1, parseInt(document.getElementById('wz-pc-level')?.value) || 1));
      if (!W.groepen.length) { try { W.groepen = (await api.listGroups())?.groups || []; } catch { /* leeg */ } }
      const gid    = W.data.groep?.id || window._activeGroupId || W.groepen[0]?.id || '';
      // Een speler is een personage-kaartje met `subtype: 'speler'` en een
      // groep; het profiel eromheen (class, level) hangt aan hetzelfde id.
      const e = await api.createEntity('personages', {
        name, subtype: 'speler', data: { groep: gid },
      });
      const id = e?.id || e?.entity?.id;
      if (id && (klasse || level)) {
        try { await api.patchPlayerProfile(id, { klasse, level }); }
        catch { /* het kaartje staat er; het profiel vul je op zijn blad */ }
      }
      W.data.pc = { id, name };
    },
  },
  {
    id: 'klaar',
    titel: 'Klaar om te spelen',
    lead: '',
    html() {
      const m = window.app?.state?.meta || {};
      const c = window._muntNamen();
      const regel = (aan, tekst) => `<li class="${aan ? 'wz-ja' : 'wz-nee'}">${ico(aan ? 'check' : 'minus')} ${tekst}</li>`;
      return `
        <ul class="wz-samenvatting">
          ${regel(!!m.appTitle, `Je campagne heet <strong>${esc(m.appTitle || '—')}</strong>`)}
          ${regel(true, `Je rekent in <strong>${esc(c.fl)}</strong>, ${esc(c.kn)} en ${esc(c.cl)}`)}
          ${regel(!!W.data.groep?.naam, W.data.groep?.naam
            ? `Je eerste party heet <strong>${esc(W.data.groep.naam)}</strong>${W.data.groep.pw ? ' en heeft een wachtwoord' : ' — nog zonder wachtwoord'}`
            : 'Je party heeft nog geen naam')}
          ${regel(!!W.data.pc?.name, W.data.pc?.name
            ? `<strong>${esc(W.data.pc.name)}</strong> staat erin`
            : 'Nog geen personage')}
        </ul>
        <div class="wz-verder">
          <strong>Waar je verder gaat</strong>
          <p>Alles hierboven staat bij <em>Instellingen</em>, en de namen van je plekken bij
          <em>Diensten</em>. Wil je meer onderdelen aan of uit? Dat doet de beheerder — vraag erom.</p>
          <p>Wat ik zou doen voor je eerste sessie: een <em>locatie</em> aanmaken waar je begint,
          er een <em>personage</em> bij zetten dat ze ontmoeten, en dat kaartje zichtbaar maken voor je party.</p>
        </div>`;
    },
    async bewaar() { await api.saveAppMeta({ wizardKlaar: true }); },
  },
];

function _actief() { return STAPPEN.filter(s => !s.beschikbaar || s.beschikbaar()); }

// Een stap mag iets ophalen voordat hij zich tekent (de party-stap heeft de
// groepen nodig). Dat moet vóór `html()`, dus `_teken` is async — en elke
// aanroeper moet hem awaiten, anders tekent hij in de lucht.
async function _teken() {
  const lijst = _actief();
  const stap  = lijst[W.stap];
  const host  = document.getElementById('wz-body');
  if (!host || !stap) return;
  if (stap.voor) {
    host.innerHTML = '<p class="wz-lead">Even ophalen…</p>';
    try { await stap.voor(); } catch { /* dan tekent hij met wat hij heeft */ }
  }
  const laatste = W.stap === lijst.length - 1;
  host.innerHTML = `
    <div class="wz-kop">
      <div class="wz-stappen">${lijst.map((s, i) => `
        <span class="wz-bol${i === W.stap ? ' is-nu' : ''}${i < W.stap ? ' is-gehad' : ''}" title="${esc(s.titel)}"></span>`).join('')}</div>
      <h2 class="wz-titel">${esc(stap.titel)}${window._helpBtn?.('wizard') ?? ''}</h2>
      ${stap.lead ? `<p class="wz-lead">${esc(stap.lead)}</p>` : ''}
    </div>
    <div class="wz-inhoud">${stap.html()}</div>
    <div class="wz-voet">
      ${W.stap > 0 ? `<button class="dm-btn dm-btn-ghost" onclick="window.wizard.terug()">${ico('chevron-left')} Terug</button>` : '<span></span>'}
      <div class="wz-voet-rechts">
        ${laatste ? '' : `<button class="dm-btn dm-btn-ghost" onclick="window.wizard.sla()">Sla over</button>`}
        <button class="dm-btn dm-btn-primary" onclick="window.wizard.verder()">
          ${laatste ? `${ico('check')} Aan de slag` : `Volgende ${ico('chevron-right')}`}
        </button>
      </div>
    </div>`;
  host.querySelector('input')?.focus();
}

async function _verder(bewaren = true) {
  if (W.bezig) return;
  const lijst = _actief();
  const stap  = lijst[W.stap];
  W.bezig = true;
  try {
    if (bewaren && stap?.bewaar) await stap.bewaar();
  } catch (err) {
    window._showToast?.('Opslaan lukte niet: ' + (err.message || err));
    W.bezig = false; return;
  }
  W.bezig = false;
  if (W.stap >= lijst.length - 1) { _sluit(); return; }
  W.stap++; await _teken();
}

function _sluit() {
  document.getElementById('wz-overlay')?.remove();
  document.body.classList.remove('wizard-open');
  // De naam bovenaan, de munten, de dienstnamen en de zijbalk komen allemaal
  // uit `state.meta`, dat op twintig plekken al gelezen is. Eén verse ronde is
  // eerlijker dan proberen te raden wat er opnieuw getekend moet worden.
  location.reload();
}

function _open(opnieuw = false) {
  if (document.getElementById('wz-overlay')) return;
  W.stap = 0;
  if (opnieuw) W.data = { appTitle: '', appSubtitle: '', currency: null, diensten: {}, groep: null, pc: null };
  const ov = document.createElement('div');
  ov.id = 'wz-overlay';
  ov.className = 'wz-overlay';
  ov.innerHTML = `<div class="wz-kaart"><div id="wz-body"></div></div>`;
  document.body.appendChild(ov);
  document.body.classList.add('wizard-open');
  _teken();
}

// Draait hij vanzelf? Alleen voor de DM, alleen als hij er nog nooit geweest
// is, en alleen in een campagne die nog leeg is — een bestaande campagne die
// de vlag mist (iedereen, want hij is nieuw) hoort geen wizard te krijgen.
async function _misschienOpenen() {
  try {
    if (window.app?.state?.role !== 'dm') return;
    const m = window.app?.state?.meta || {};
    if (m.wizardKlaar) return;
    const pcs = await api.listEntities('personages');
    const leeg = !(Array.isArray(pcs) ? pcs : pcs?.personages || []).length;
    if (!leeg) { await api.saveAppMeta({ wizardKlaar: true }); return; }
    _open();
  } catch { /* geen wizard is beter dan een wizard die over een fout heen valt */ }
}

window.wizard = {
  open: () => _open(true),
  verder: () => _verder(true),
  sla: () => _verder(false),
  terug: () => { if (W.stap > 0) { W.stap--; _teken(); } },
  misschienOpenen: _misschienOpenen,
};
