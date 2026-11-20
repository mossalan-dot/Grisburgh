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

import { api } from './api.js?v=326';

// Hoe de groepen uit `lib/modules.js` in beeld heten.
const _GROEPNAAM = { wereld: 'Je wereld', spel: 'Het spel', sfeer: 'Sfeer', dienst: 'Diensten', overig: 'Overig' };

const esc = s => window.app?.esc?.(s) ?? String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ico = (n, o) => window.icon?.(n, o) ?? '';

const W = {
  stap: 0,
  groepen: [],
  vrij: {}, uit: new Set(), beelden: null,
  data: { appTitle: '', appSubtitle: '', currency: null, diensten: {}, groep: null },
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
    titel: 'Valuta',
    lead: 'De verhouding blijft die van het boek — 1 gold = 10 silver = 100 copper. Alleen hoe ze heten is aan jou.',
    html() {
      const c = window._muntNamen();
      // Electrum en platinum hebben geen eigen plek in de beurs: de app rekent
      // ze om (1 EP = 5 SP, 1 PP = 10 GP). Maar een vondst noemt ze wél bij
      // naam — "waaronder 3 Lion d'or" — en die naam komt hiervandaan. Daarom
      // staan ze apart, onder een eigen kopje.
      const rij = (k, rol, v, ph) => `
        <div class="wz-veld">
          <label class="dm-form-label" for="wz-munt-${k}">${rol}</label>
          <input id="wz-munt-${k}" class="dm-input" maxlength="24" value="${esc(v || '')}"
            placeholder="${esc(ph)}">
        </div>`;
      return `
        <div class="wz-munten">
          ${rij('fl', 'Gold (GP)',   c.fl, 'Gold Piece')}
          ${rij('kn', 'Silver (SP)', c.kn, 'Silver Piece')}
          ${rij('cl', 'Copper (CP)', c.cl, 'Copper Piece')}
        </div>
        <div class="wz-ond-kop wz-munten-kop">Oud geld</div>
        <div class="wz-munten wz-munten--twee">
          ${rij('ep', 'Electrum (EP)', c.ep, 'Electrum Piece')}
          ${rij('pp', 'Platinum (PP)', c.pp, 'Platinum Piece')}
        </div>`;
    },
    async bewaar() {
      const lees = (k, terugval) => document.getElementById(`wz-munt-${k}`)?.value.trim() || terugval;
      const currency = {
        fl: lees('fl', 'Gold Piece'),
        kn: lees('kn', 'Silver Piece'),
        cl: lees('cl', 'Copper Piece'),
      };
      // Leeg laten betekent hier echt "geen naam": zonder naam zet een vondst
      // er niets bij, en dat is beter dan een verzonnen munt noemen.
      const ep = lees('ep', ''); if (ep) currency.ep = ep;
      const pp = lees('pp', ''); if (pp) currency.pp = pp;
      await api.saveAppMeta({ currency });
      window._currency = currency;
      if (window.app?.state?.meta) window.app.state.meta.currency = currency;
    },
  },
  {
    id: 'onderdelen',
    titel: 'Wat heeft jouw campagne nodig?',
    lead: 'Vink uit wat je niet gebruikt — dan verdwijnt het helemaal, ook bij je spelers. Wat nog uit staat kun je hier gewoon aanzetten, en later bijstellen kan altijd bij Instellingen → Campagne.',
    // Wat binnen bereik is. De beheerder die iets uitdrukkelijk dichtzette
    // houdt zijn slot; waar hij niets over gezegd heeft kies je zelf.
    async voor() {
      const m = await api.meta();
      W.vrij = m?.modulesVrij || m?.modules || {};
      // De stand zoals hij nu is, niet "alles aan behalve": een deel staat
      // standaard uit, en dat moet je hier zien staan.
      W.uit  = new Set(Object.keys(W.vrij).filter(k => W.vrij[k] && !(m.modules || {})[k]));
      W.catalogus = m?.moduleCatalogus || [];
    },
    beschikbaar() { return true; },
    html() {
      // De catalogus geeft de volgorde én de groepen; zo staat een deelfunctie
      // (Aan de tap) netjes onder zijn dienst in plaats van alfabetisch ergens.
      const vrij = (W.catalogus || []).filter(m => W.vrij[m.id]);
      if (!vrij.length) return `<p class="wz-lead">Er staat nog niets voor je klaar. Vraag de beheerder welke onderdelen je krijgt.</p>`;
      const groepen = [...new Set(vrij.map(m => m.groep || 'overig'))];
      const vink = (m) => `
            <label class="wz-vink${m.ouder ? ' wz-vink--deel' : ''}">
              <input type="checkbox" data-module="${esc(m.id)}" ${W.uit.has(m.id) ? '' : 'checked'}>
              <span>${esc(m.label || m.id)}</span>
            </label>`;
      return `<div class="wz-onderdelen">${groepen.map(g => {
        // Een deel hoort onder zijn eigen dienst, niet achteraan bij de laatste
        // die toevallig in de catalogus staat. Zelfde regel als bij
        // Instellingen.
        const inGroep = vrij.filter(m => (m.groep || 'overig') === g);
        const rijen = inGroep.filter(m => !m.ouder)
          .map(m => vink(m) + inGroep.filter(x => x.ouder === m.id).map(vink).join('')).join('');
        const wees = inGroep.filter(m => m.ouder && !inGroep.some(x => x.id === m.ouder));
        return `<div class="wz-ond-groep">
          <div class="wz-ond-kop">${esc(_GROEPNAAM[g] || g)}</div>${rijen}${wees.map(vink).join('')}
        </div>`;
      }).join('')}</div>`;
    },
    async bewaar() {
      const vinkjes = [...document.querySelectorAll('[data-module]')];
      const uit = vinkjes.filter(i => !i.checked).map(i => i.dataset.module);
      const aan = vinkjes.filter(i =>  i.checked).map(i => i.dataset.module);
      await api.saveModulesUit(uit, aan);
      // De volgende stap vraagt de namen van je diensten, en hoort te weten
      // wat je net hebt aangezet. Die stap stond eerst vóór deze, en dan kreeg
      // een dienst die je hier aanzette (een tempel, bijvoorbeeld) geen naam.
      try { const m = await api.meta(); window._modules = m?.modules || window._modules; } catch { /* dan de oude stand */ }
    },
  },
  {
    id: 'diensten',
    titel: 'Diensten',
    lead: 'Alleen de diensten die voor jou aanstaan. Laat je iets leeg, dan staat er wát het is.',
    // Een dienst die uit staat vraag je niet: dan is dit een lijst met dingen
    // die je nergens terugvindt.
    beschikbaar() { return DIENSTEN.some(d => window._moduleAan?.(d.module)); },
    html() {
      const m = window.app?.state?.meta || {};
      const rijen = DIENSTEN.filter(d => window._moduleAan?.(d.module)).map(d => `
        <div class="wz-veld">
          <!-- Zonder de regel eronder: acht diensten met elk een zinnetje
               leest als een folder, en de naam zegt het al. -->
          <label class="dm-form-label" for="wz-d-${d.sleutel}">${esc(d.label)}</label>
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
    id: 'gevecht',
    titel: 'Wat zien je spelers in een gevecht?',
    lead: '',
    html() {
      const nu = window.app?.state?.meta?.combatHp || 'staat';
      // Van weinig naar veel, want zo lees je een schaal. De namen zeggen nu
      // wát je krijgt in plaats van hóé het eruitziet: "De cijfers" en "In
      // woorden" beschrijven de vorm, en dan moet je de regel eronder lezen om
      // te weten welke van de drie de meeste informatie geeft.
      const opties = [
        ['binair',   'Minimale informatie', 'Je ziet of hij nog staat, verder niets. Het strakste, en het spannendst.'],
        ['staat',    'Omschrijvingen',      'Ongedeerd, geschramd, gehavend, zwaar gewond… Je spelers voelen het verloop zonder te rekenen. De standaard.'],
        ['volledig', 'Exacte getallen',     'Exacte HP op elk token. Handig als je open speelt of veel uitlegt.'],
      ];
      return `<div class="wz-keuzes">${opties.map(([k, titel, uitleg]) => `
        <label class="wz-keuze${nu === k ? ' is-aan' : ''}">
          <input type="radio" name="wz-hp" value="${k}" ${nu === k ? 'checked' : ''}>
          <span class="wz-keuze-titel">${esc(titel)}</span>
          <span class="wz-keuze-uitleg">${esc(uitleg)}</span>
        </label>`).join('')}</div>`;
    },
    async bewaar() {
      const k = document.querySelector('input[name="wz-hp"]:checked')?.value || 'staat';
      await api.saveAppMeta({ combatHp: k });
      if (window.app?.state?.meta) window.app.state.meta.combatHp = k;
    },
  },
  {
    id: 'beelden',
    titel: 'Beeld meenemen',
    lead: '',
    // Alleen tonen als er iets te halen valt: in de beheercampagne zelf, of als
    // er geen bronbeelden zijn, is deze stap een loze vraag.
    // **Let op:** `beschikbaar()` wordt gevraagd om de stappenlijst te bouwen,
    // dus vóórdat welke `voor()` dan ook gedraaid heeft. Data die hier nodig is
    // moet bij het openen al binnen zijn (zie `_open`) — anders staat de stap
    // op "niet beschikbaar" en komt hij nooit aan de beurt om zichzelf te laden.
    beschikbaar() {
      return !!((W.beelden?.beschikbaar > 0 && !W.beelden?.eigen)
             || (W.hbBeelden?.beschikbaar > 0 && !W.hbBeelden?.eigen));
    },
    html() {
      const mb = (b) => b?.bytes ? `${(b.bytes / 1048576).toFixed(0)} MB` : '';
      const vink = (id, b, wat) => (b?.beschikbaar > 0 && !b.eigen) ? `
        <label class="wz-vink wz-vink--groot">
          <input type="checkbox" id="${id}" checked>
          <span>${b.beschikbaar} ${wat}${mb(b) ? ` · ${mb(b)}` : ''}</span>
        </label>` : '';
      return `
        <p class="wz-lead">Er ligt beeld klaar dat je mag overnemen. Eigen werk, geen uitgeverijmateriaal.</p>
        ${vink('wz-beelden',   W.beelden,   'afbeeldingen bij spells')}
        ${vink('wz-hbbeelden', W.hbBeelden, 'afbeeldingen in het Heldenboek')}`;
    },
    async bewaar() {
      const stukken = [];
      if (document.getElementById('wz-beelden')?.checked) {
        const r = await api.spreukbeeldenHalen();
        if (r?.gekopieerd) stukken.push(`${r.gekopieerd} bij spells`);
      }
      if (document.getElementById('wz-hbbeelden')?.checked) {
        const r = await api.heldenboekbeeldenHalen();
        if (r?.gekopieerd) stukken.push(`${r.gekopieerd} in het Heldenboek`);
      }
      if (stukken.length) window._showToast?.(`Overgenomen: ${stukken.join(' en ')}.`);
    },
  },
  {
    id: 'party',
    titel: 'Naam van de groep',
    // De waarschuwing (twee party's zijn later niet samen te voegen) stond hier
    // als een eigen gekaderd blok, en dat was het enige blok in zijn soort in
    // de hele wizard — het las als een andere pagina. Hij staat nu in het
    // boekje, net als de rest van de uitleg.
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
`;
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
  // **De stap "Je eerste personage" is eruit.** Een personage maak je in het
  // archief of je speler maakt er zelf een met het partywachtwoord, en die
  // twee wegen doen het beter: daar staat het hele blad. Hier was het een
  // kaartje met drie velden dat je daarna alsnog moest openen.
  {
    id: 'oefenen',
    titel: 'Blanco, of iets om mee te oefenen?',
    lead: 'Een lege campagne is eerlijk, maar je kunt er nergens op klikken — en dan zie je niet wat de app doet.',
    html() {
      return `<div class="wz-keuzes">
        <label class="wz-keuze is-aan">
          <input type="radio" name="wz-start" value="oefen" checked>
          <span class="wz-keuze-titel">Zet er iets neer om mee te spelen</span>
          <span class="wz-keuze-uitleg">Een herberg met een waard die een geheim heeft, een smid die inkoopt, iemand die te lang bij de deur zit, en een sleutel zonder label. Genoeg om zichtbaarheid, geheimen, de winkel en de boedel uit te proberen.</span>
        </label>
        <label class="wz-keuze">
          <input type="radio" name="wz-start" value="blanco">
          <span class="wz-keuze-titel">Blanco beginnen</span>
          <span class="wz-keuze-uitleg">Niets erin. Je maakt zelf je eerste kaartje.</span>
        </label>
      </div>`;
    },
    async bewaar() {
      if (document.querySelector('input[name="wz-start"]:checked')?.value !== 'oefen') return;
      const r = await api.oefenmateriaal();
      W.data.oefen = r?.gezet || 0;
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
          ${regel(true, `Je rekent in <strong>${esc(c.fl)}, ${esc(c.kn)} en ${esc(c.cl)}</strong>`)}
          ${regel(!!W.data.groep?.naam, W.data.groep?.naam
            ? `Je eerste party heet <strong>${esc(W.data.groep.naam)}</strong>${W.data.groep.pw ? ' en heeft een wachtwoord' : ' — nog zonder wachtwoord'}`
            : 'Je party heeft nog geen naam')}
          ${W.data.oefen ? regel(true, `${W.data.oefen} kaartjes om mee te oefenen`) : ''}
        </ul>
        <div class="wz-verder">
          <!-- Wat je hierna doet en waar je het terugvindt staat in het boekje;
               hier alleen de weg ernaartoe. De handleiding hoort wél op dit
               scherm en niet pas bij Instellingen: dit is het moment waarop je
               niet weet wat er allemaal is. -->
          <p><button class="dm-btn dm-btn-ghost" onclick="window._handleidingOpen?.()">Handleiding lezen of afdrukken</button></p>
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
      <!-- Het boekje hoort bij de sluitknop, niet achter de titel: het is een
           knop van het venster en geen deel van de kop. Achter de titel
           schoof hij bovendien per stap op, omdat de titels verschillen. -->
      <div class="wz-kop-knoppen">
        ${window._helpBtn?.('wizard') ?? ''}
        <button class="wz-sluit" onclick="window.wizard.sluit()" title="Sluiten — je vindt de wizard terug bij Instellingen">${ico('x')}</button>
      </div>
      <h2 class="wz-titel">${esc(stap.titel)}</h2>
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

async function _open(opnieuw = false) {
  if (document.getElementById('wz-overlay')) return;
  W.stap = 0;
  if (opnieuw) W.data = { appTitle: '', appSubtitle: '', currency: null, diensten: {}, groep: null };
  // Wat `beschikbaar()` nodig heeft, moet er zijn vóór de stappenlijst gebouwd
  // wordt. Mislukt het, dan valt die stap gewoon weg — beter dan een wizard die
  // blijft hangen op een vraag die hij niet kan stellen.
  try { W.beelden = await api.spreukbeeldenStand(); } catch { W.beelden = null; }
  try { W.hbBeelden = await api.heldenboekbeeldenStand(); } catch { W.hbBeelden = null; }
  const ov = document.createElement('div');
  ov.id = 'wz-overlay';
  ov.className = 'wz-overlay';
  ov.innerHTML = `<div class="wz-kaart"><div id="wz-body"></div></div>`;
  document.body.appendChild(ov);
  document.body.classList.add('wizard-open');
  // Escape sluit hem, net als de knop. Er was geen weg eruit behalve negen
  // keer "Sla over".
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') _wegleggen(); });
  _teken();
}

// Wegleggen telt als klaar: hij draait één keer, en wie hem zelf dichtdoet
// hoeft hem niet bij elke inlog terug. Bij Instellingen staat hij nog.
async function _wegleggen() {
  try { await api.saveAppMeta({ wizardKlaar: true }); } catch { /* dan komt hij nog eens langs */ }
  _sluit();
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
  sluit: _wegleggen,
};
