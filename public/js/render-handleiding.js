// ════════════════════════════════════════════════════════════════════════════
//  DE HANDLEIDING
// ════════════════════════════════════════════════════════════════════════════
// Een nieuwe DM krijgt na de wizard een campagne die werkt, en daarna stilte.
// De uitleg ís er — bij elk scherm hangt een boekje — maar je moet weten dat je
// hem moet zoeken, en je kunt hem niet van voren naar achteren lezen.
//
// Dit is datzelfde materiaal, achter elkaar. **Niet een tweede tekst**: hij
// leest `_resolveHelp`, precies wat het boekje op het scherm ook leest, dus een
// campagne die haar eigen woorden heeft ingevoerd (`dmState.helpContent`) ziet
// die hier ook staan — en een verbetering aan een boekje staat meteen in de
// handleiding. Eén tekst, twee vormen: ter plekke een paar schermpjes om door
// te bladeren, hier een document om te lezen of af te drukken.
//
// De hoofdstukindeling volgt de sleutel, niet een lijst die we bijhouden: een
// lijst van honderdtien namen loopt achter zodra er één boekje bijkomt.

const esc = (s) => window.app?.esc?.(s) ?? String(s ?? '');
const md  = (s) => window.app?.mdToHtml?.(s) ?? esc(s);

// In leesvolgorde voor wie de app nog niet kent: eerst waar je zit, dan wat je
// samen ziet, dan het gereedschap, dan de knoppen die je één keer zet — en
// achteraan wat je spelers voor zich krijgen, zodat je weet wat zij lezen.
const HOOFDSTUKKEN = [
  { id: 'dm',      titel: 'De meesterkamer',
    lead: 'Jouw kant van het scherm: wat je klaarzet, wat je tijdens het spelen aanzet en wat je spelers daarvan merken.' },
  { id: 'kaartje', titel: 'Kaartjes bekijken en bewerken',
    lead: 'Personages, locaties, voorwerpen en documenten werken allemaal hetzelfde. Wie dit hoofdstuk één keer leest, kent ze alle vier.' },
  { id: 'inst',    titel: 'Instellingen',
    lead: 'Eén keer goed zetten en daarna vergeten. Hier staat wat een keuze betekent, niet waar de knop staat.' },
  { id: 'speler',  titel: 'Wat je spelers lezen',
    lead: 'Dezelfde boekjes als die zij aan tafel openen. Handig om te weten wat zij wél en niet te zien krijgen.' },
];

// Waar hoort een boekje? Af te leiden uit zijn naam, zodat er geen lijst van
// honderdveertig namen is die achterloopt zodra er één bijkomt.
//
// Een eigen hoofdstuk voor "schermen waar jullie samen op kijken" leek logisch,
// maar bleek er één te zijn: bijna geen boekje heeft stappen met een
// rolverdeling. Eén hoofdstuk met één stuk erin is geen hoofdstuk. Die stappen
// staan nu gewoon in het hoofdstuk waar hun scherm hoort, met "alleen jij" of
// "alleen je spelers" erbij — dat zegt hetzelfde en op de goede plek.
function hoofdstukVan(sleutel) {
  if (sleutel.startsWith('inst_')) return 'inst';
  if (sleutel.startsWith('hulp_kijk_') || sleutel.startsWith('hulp_bewerk_')) return 'kaartje';
  if (sleutel.startsWith('dm_')) return 'dm';
  return 'speler';
}

// Een stap is op het scherm een bladzijde om doorheen te klikken; hier is het
// een alinea. De kop van een stap die hetzelfde zegt als de titel van het
// boekje valt weg — dat las als een echo.
function stapHtml(stap, titel) {
  const kop = String(stap.titel || '').trim();
  const rol = stap.rol === 'dm' ? '<span class="hl-rol">alleen jij</span>'
    : stap.rol === 'speler' ? '<span class="hl-rol">alleen je spelers</span>' : '';
  return `
    ${kop && kop !== titel ? `<h4 class="hl-stap-kop">${esc(kop)}${rol}</h4>` : (rol ? `<p class="hl-rol-los">${rol}</p>` : '')}
    <div class="hl-stap-tekst">${md(stap.tekst || '')}</div>`;
}

function documentHtml() {
  const sleutels = window._helpSleutels?.() || [];
  const naam = window._campagneNaam?.() || 'je campagne';
  const perHoofdstuk = new Map(HOOFDSTUKKEN.map(h => [h.id, []]));
  for (const sleutel of sleutels) {
    const config = window._resolveHelp?.(sleutel);
    if (!config?.stappen?.length) continue;          // een boekje zonder tekst is geen hoofdstuk
    perHoofdstuk.get(hoofdstukVan(sleutel))?.push({ sleutel, config });
  }

  // Twee lagen, want één hoofdstuk telt er vierenzeventig: zonder de titels
  // erbij is de inhoudsopgave vijf regels die niets verraden.
  const inhoud = HOOFDSTUKKEN.filter(h => perHoofdstuk.get(h.id).length).map(h => `
    <li><a href="#hl-${h.id}">${esc(h.titel)}</a> <span class="hl-inh-aantal">${perHoofdstuk.get(h.id).length}</span>
      <ul class="hl-inhoud-sub">${perHoofdstuk.get(h.id)
        .map(({ sleutel, config }) => `<li><a href="#hl-${esc(sleutel)}">${esc(config.titel || sleutel)}</a></li>`).join('')}</ul>
    </li>`).join('');

  const hoofdstukken = HOOFDSTUKKEN.filter(h => perHoofdstuk.get(h.id).length).map(h => `
    <section class="hl-hoofdstuk" id="hl-${h.id}">
      <h2>${esc(h.titel)}</h2>
      <p class="hl-lead">${esc(h.lead)}</p>
      ${perHoofdstuk.get(h.id).map(({ sleutel, config }) => `
        <article class="hl-boekje" id="hl-${esc(sleutel)}">
          <h3>${esc(config.titel || sleutel)}</h3>
          ${(config.stappen || []).map(st => stapHtml(st, config.titel)).join('')}
        </article>`).join('')}
    </section>`).join('');

  return `
    <h1>Handleiding — ${esc(naam)}</h1>
    <p class="hl-intro">Alles wat de app kan, in de woorden die ook bij de schermen zelf staan. Pas je een boekje
    aan in je campagne, dan verandert deze tekst mee — het is dezelfde tekst.</p>
    <div class="hl-begin">
      <h3>Voor je eerste sessie</h3>
      <ol>
        <li>Maak een <strong>locatie</strong> waar het begint, en zet er een <strong>personage</strong> bij dat ze ontmoeten.</li>
        <li>Zet dat kaartje <strong>zichtbaar</strong> voor je party — zonder dat zien zij een leeg archief.</li>
        <li>Log op een tweede scherm in als <strong>tafelscherm</strong>, zodat je iets kunt laten zien.</li>
        <li>Open je <strong>akte</strong> en begin. De rest vind je terug met de boekjes bij elk scherm.</li>
      </ol>
    </div>
    <nav class="hl-inhoud"><h3>Inhoud</h3><ul>${inhoud}</ul></nav>
    ${hoofdstukken}`;
}

// Als platte tekst, voor wie hem buiten de app wil bewaren. Markdown, want dat
// leest ook ongeopend en het is wat `scripts/helpteksten.js` al spreekt.
function documentMarkdown() {
  const sleutels = window._helpSleutels?.() || [];
  const naam = window._campagneNaam?.() || 'je campagne';
  const regels = [`# Handleiding — ${naam}`, ''];
  for (const h of HOOFDSTUKKEN) {
    const inGroep = sleutels
      .map(sleutel => ({ sleutel, config: window._resolveHelp?.(sleutel) }))
      .filter(x => x.config?.stappen?.length && hoofdstukVan(x.sleutel) === h.id);
    if (!inGroep.length) continue;
    regels.push(`## ${h.titel}`, '', h.lead, '');
    for (const { config } of inGroep) {
      regels.push(`### ${config.titel || ''}`, '');
      for (const st of config.stappen || []) {
        const rol = st.rol === 'dm' ? ' _(alleen jij)_' : st.rol === 'speler' ? ' _(alleen je spelers)_' : '';
        if (st.titel && st.titel !== config.titel) regels.push(`**${st.titel}**${rol}`, '');
        else if (rol) regels.push(rol.trim(), '');
        regels.push(String(st.tekst || '').trim(), '');
      }
    }
  }
  return regels.join('\n');
}

window._handleidingOpen = function () {
  document.getElementById('handleiding-overlay')?.remove();
  const el = document.createElement('div');
  el.id = 'handleiding-overlay';
  el.className = 'hl-overlay';
  el.innerHTML = `
    <div class="hl-balk">
      <button class="hl-knop" onclick="window._handleidingOpslaan()">Opslaan als tekst</button>
      <button class="hl-knop" onclick="window.print()">Afdrukken</button>
      <button class="hl-knop hl-knop--sluit" onclick="document.getElementById('handleiding-overlay')?.remove()"
        aria-label="Sluiten">&times;</button>
    </div>
    <div class="hl-blad">${documentHtml()}</div>`;
  document.body.appendChild(el);
  el.querySelector('.hl-blad').scrollTop = 0;
};

window._handleidingOpslaan = function () {
  const naam = (window._campagneNaam?.() || 'campagne').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const blob = new Blob([documentMarkdown()], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `handleiding-${naam}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

export const handleiding = { open: () => window._handleidingOpen() };
