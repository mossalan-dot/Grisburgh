// ════════════════════════════════════════════════════════════════════════════
//  EEN PERSONAGE MAKEN
// ════════════════════════════════════════════════════════════════════════════
// Zie docs/voorstel-personage-maken.md. Een speler kon zijn blad al bijwerken
// maar het kaartje niet aanmaken, dus stond een nieuwe speler niet in de
// inloglijst en kwam hij nergens binnen — de DM moest eerst, midden in een
// sessie, een leeg kaartje maken terwijl de rest wachtte.
//
// Wat hier gebeurt is **niet** een tweede spelersblad. De wizard vult de
// velden die het bestaande profiel al heeft; na het gunnen bewerk je verder op
// het spelerstabblad dat er al is. En hij rekent voor, maar blokkeert niets:
// wat niet klopt staat als opmerking op het laatste scherm, en de DM leest het
// voordat hij gunt.
//
// Hij leent de opmaak van de opstartwizard (`wz-*`): twee wizards die er
// anders uitzien zijn twee wizards om te onderhouden.
import { api, huidigeCampagne } from './api.js?v=316';

const esc = s => window.app?.esc?.(s) ?? String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ico = (n, o) => window.icon?.(n, o) ?? '';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const AB_NAAM = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};
const STANDAARDREEKS = [15, 14, 13, 12, 10, 8];
const PUNTEN = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const PUNTEN_BUDGET = 27;
// De achttien skills en bij welke ability ze horen. Staat nergens anders in de
// app als lijst — het spelersblad kent ze wel, maar als opmaak.
const SKILLS = {
  Acrobatics: 'dex', 'Animal Handling': 'wis', Arcana: 'int', Athletics: 'str',
  Deception: 'cha', History: 'int', Insight: 'wis', Intimidation: 'cha',
  Investigation: 'int', Medicine: 'wis', Nature: 'int', Perception: 'wis',
  Performance: 'cha', Persuasion: 'cha', Religion: 'int', 'Sleight of Hand': 'dex',
  Stealth: 'dex', Survival: 'wis',
};

const P = {
  c: null, bronnen: null, inst: null, profiel: null, nakijk: null, slots: {},
  stap: 0, bezig: false,
};

// Hoeveel spreuken kent deze class op dit level? Staat er niets, dan is het
// geen caster en slaan we het hele scherm over.
function _tellerVan() {
  const t = P.bronnen?.tellers?.[P.c?.klasse];
  if (!t) return null;
  const lvl = String(Math.max(1, Math.min(20, parseInt(P.c.level) || 1)));
  return t[lvl] || null;
}

const abMod = (s) => Math.floor(((parseInt(s) || 10) - 10) / 2);
const teken = (n) => (n >= 0 ? `+${n}` : `${n}`);
const klasseVan = (naam) => (P.bronnen?.klassen || []).find(k => k.naam === naam) || null;
const _volkVan = (naam) => (P.bronnen?.species || []).find(s => s.naam === naam) || null;
const bgVan = (naam) => (P.bronnen?.backgrounds || []).find(b => b.naam === naam) || null;

// ── De stappen ───────────────────────────────────────────────────────────────
// Elke stap zegt zelf wat hij toont, wat hij opslaat en of hij er wel toe doet.
// Een subclass vraag je niet op level 1, en een background die er niet is heeft
// geen bonus om te verdelen.
const STAPPEN = [
  {
    id: 'naam',
    titel: 'Wie word je?',
    lead: 'Een naam is genoeg om te beginnen. De rest mag je onderweg nog omgooien.',
    html() {
      const maxLevel = P.inst?.maxLevel || 1;
      return `
        <div class="wz-veld">
          <label class="dm-form-label" for="pm-naam">Naam</label>
          <input id="pm-naam" class="dm-input" maxlength="60" value="${esc(P.c.naam || '')}"
            placeholder="Zoals hij aan tafel heet">
        </div>
        <div class="wz-veld">
          <label class="dm-form-label">Portret (mag later)</label>
          <div class="pm-portret-rij">
            <div class="pm-portret" id="pm-portret">
              ${P.c.portret ? `<img src="/api/files/${esc(P.c.id)}?t=${Date.now()}" alt="">` : ico('user')}
            </div>
            <label class="dm-btn dm-btn-ghost dm-btn-sm">
              ${ico('upload')} ${P.c.portret ? 'Andere kiezen' : 'Kiezen'}
              <input type="file" accept="image/*" style="display:none"
                onchange="window.personageMaken.portret(this.files[0], this)">
            </label>
          </div>
        </div>
        ${maxLevel > 1 ? `
        <div class="wz-veld">
          <label class="dm-form-label" for="pm-level">Op welk level begin je?</label>
          <input id="pm-level" class="dm-input" type="number" min="1" max="${maxLevel}"
            value="${esc(String(P.c.level || 1))}" style="max-width:120px">
          <p class="wz-lead" style="margin:6px 0 0">De DM staat hier tot level ${maxLevel} toe. Hij ziet je keuze voordat hij je personage gunt.</p>
        </div>` : ''}`;
    },
    waarden() {
      const uit = { naam: document.getElementById('pm-naam')?.value.trim() || '' };
      const lvl = document.getElementById('pm-level');
      if (lvl) uit.level = parseInt(lvl.value) || 1;
      return uit;
    },
  },

  {
    id: 'species',
    titel: 'Wat ben je?',
    lead: 'Je species bepaalt waar je vandaan komt en wat je van huis uit meekrijgt.',
    html() {
      const tegels = _tegels((P.bronnen.species || []).map(s => ({
        waarde: s.naam, titel: s.naam,
        onder: s.traits.length ? s.traits.slice(0, 4).join(' · ') : '',
      })), P.c.species, 'species');
      // Sommige species kiezen nog iets binnen zichzelf: een Tiefling zijn
      // Fiendish Legacy, een Elf zijn lineage. Dat verschijnt pas als je het
      // species hebt gekozen — anders staan er zesentwintig tegels onder een
      // keuze die je nog niet gemaakt hebt.
      const volk = _volkVan(P.keuze.species ?? P.c.species);
      return tegels + (volk?.varianten?.length ? `
        <div class="wz-veld" style="margin-top:14px">
          <label class="dm-form-label">${esc(volk.variantLabel || 'Variant')}</label>
          ${_tegels(volk.varianten.map(v => ({ waarde: v, titel: v })), P.c.speciesVariant, 'speciesVariant')}
        </div>` : '');
    },
    waarden() {
      const volk = P.keuze.species ?? P.c.species;
      // Een ander species betekent een andere lijst; wat er stond slaat dan
      // nergens meer op.
      const variant = (volk === P.c.species) ? (P.keuze.speciesVariant ?? P.c.speciesVariant) : (P.keuze.speciesVariant || '');
      return { species: volk, speciesVariant: variant || '' };
    },
  },

  {
    id: 'klasse',
    titel: 'Wat doe je?',
    lead: 'Je class bepaalt je hit die, je saving throws en waar je goed in bent.',
    html() {
      const tegels = _tegels((P.bronnen.klassen || []).map(k => ({
        waarde: k.naam, titel: k.naam,
        onder: [k.basis?.aard && _aardLabel(k.basis.aard), k.basis?.hitDie && `d${k.basis.hitDie}`,
                k.basis?.primary].filter(Boolean).join(' · '),
      })), P.c.klasse, 'klasse');
      const k = klasseVan(P.keuze.klasse ?? P.c.klasse);
      const level = parseInt(P.c.level) || 1;
      const subNu = level >= (k?.subclassLevel || 3) && k?.subclasses?.length;
      // Vanaf level 2 kan hij zijn levels over twee classes verdelen. Dat staat
      // onder een uitklapper: het is de uitzondering, en wie het niet zoekt
      // hoort er geen last van te hebben. De eisen rekent de nakijker voor.
      const multi = level > 1 ? `
        <details class="dm-uitklap" style="margin-top:14px"${P.c.multiKlasse ? ' open' : ''}>
          <summary>${ico('users')} Twee classes (multiclass)</summary>
          <div class="dm-uitklap-body">
            <div class="wz-rij">
              <div class="wz-veld">
                <label class="dm-form-label" for="pm-multi">Tweede class</label>
                <select class="dm-input" id="pm-multi" onchange="window.personageMaken.multi()">
                  <option value="">— geen —</option>
                  ${(P.bronnen.klassen || []).filter(x => x.naam !== (P.keuze.klasse ?? P.c.klasse)).map(x => `
                    <option value="${esc(x.naam)}"${x.naam === P.c.multiKlasse ? ' selected' : ''}>${esc(x.naam)}</option>`).join('')}
                </select>
              </div>
              <div class="wz-veld wz-veld--smal">
                <label class="dm-form-label" for="pm-multi-level">Levels daarin</label>
                <input class="dm-input" id="pm-multi-level" type="number" min="0" max="${level - 1}"
                  value="${esc(String(P.c.multiKlasseLevel || 0))}" onchange="window.personageMaken.multi()">
              </div>
            </div>
            <p class="wz-lead" style="margin:0" id="pm-multi-uit">${_multiTekst(level)}</p>
          </div>
        </details>` : '';
      return tegels + (subNu ? `
        <div class="wz-veld" style="margin-top:14px">
          <label class="dm-form-label">${esc(k.subclassLabel || 'Subclass')}</label>
          ${_tegels(k.subclasses.map(s => ({ waarde: s, titel: s })), P.c.subclass, 'subclass')}
        </div>` : '') + multi;
    },
    waarden() {
      const k = P.keuze.klasse ?? P.c.klasse;
      // Een andere class betekent een andere subclass-lijst; wat er stond slaat
      // dan nergens meer op.
      const sub = (k === P.c.klasse) ? (P.keuze.subclass ?? P.c.subclass) : (P.keuze.subclass || '');
      return {
        klasse: k, subclass: sub, skills: k === P.c.klasse ? P.c.skills : [],
        multiKlasse: document.getElementById('pm-multi')?.value ?? P.c.multiKlasse ?? '',
        multiKlasseLevel: parseInt(document.getElementById('pm-multi-level')?.value) || 0,
      };
    },
  },

  {
    id: 'background',
    titel: 'Waar kom je vandaan?',
    lead: 'Je background geeft twee skills, een gereedschap, een feat en een verhoging op drie abilities.',
    html() {
      return _tegels((P.bronnen.backgrounds || []).map(b => ({
        waarde: b.naam, titel: b.naam,
        onder: [b.skills.join(', '), b.feat].filter(Boolean).join(' · '),
      })), P.c.background, 'background');
    },
    waarden() { return { background: P.keuze.background ?? P.c.background, bgBonus: {} }; },
  },

  {
    id: 'scores',
    titel: 'Je ability scores',
    lead: 'Eerst de zes getallen, dan de verhoging van je background erbovenop.',
    html() {
      const methodes = P.inst.methodes || [];
      const nu = methodes.includes(P.c.methode) ? P.c.methode : methodes[0];
      P.c.methode = nu;
      // Zes keer een 10 is geen standaardreeks en geen point buy. Staat er iets
      // dat niet bij de manier past, dan leggen we eerst iets geldigs neer —
      // anders begin je met een scherm dat je zelf eerst moet rechtzetten.
      _scoresIjken(nu);
      const kiezer = methodes.length > 1 ? `
        <div class="pm-methodes">
          ${methodes.map(m => `
            <button class="pm-methode${m === nu ? ' is-aan' : ''}"
              onclick="window.personageMaken.methode('${m}')">${esc(_METHODE[m]?.label || m)}</button>`).join('')}
        </div>
        <p class="wz-lead">${esc(_METHODE[nu]?.hint || '')}</p>` : '';
      return kiezer + _scoresHtml(nu);
    },
    waarden() {
      const scores = {};
      for (const a of ABILITIES) scores[a] = parseInt(document.getElementById(`pm-sc-${a}`)?.value) || 10;
      const bonus = {};
      for (const a of ABILITIES) {
        const v = parseInt(document.querySelector(`[data-bgbonus="${a}"]`)?.value) || 0;
        if (v > 0) bonus[a] = v;
      }
      return { scores, bgBonus: bonus, methode: P.c.methode, worpen: P.c.worpen };
    },
  },

  {
    id: 'skills',
    titel: 'Waar ben je goed in?',
    lead: 'Je class kiest er een paar; wat je background al gaf staat er vast bij.',
    beschikbaar() { return !!klasseVan(P.c.klasse); },
    html() {
      const k = klasseVan(P.c.klasse);
      const bg = bgVan(P.c.background);
      const vast = new Set((bg?.skills || []));
      const aantal = parseInt(k?.basis?.skillAantal) || 0;
      const uit = (k?.basis?.skills?.length ? k.basis.skills : Object.keys(SKILLS));
      const gekozen = new Set(P.keuze.skills || P.c.skills || []);
      const over = aantal - [...gekozen].filter(s => !vast.has(s)).length;
      return `
        ${vast.size ? `<p class="wz-lead">Van <strong>${esc(bg.naam)}</strong> krijg je ${[...vast].map(esc).join(' en ')}.</p>` : ''}
        <p class="wz-lead" id="pm-skills-teller">Nog <strong>${over}</strong> te kiezen uit de lijst van je class.</p>
        <div class="pm-skills">
          ${uit.map(s => {
            const isVast = vast.has(s);
            const aan = isVast || gekozen.has(s);
            return `<button class="pm-skill${aan ? ' is-aan' : ''}${isVast ? ' is-vast' : ''}"
              ${isVast ? 'disabled title="Die heb je al van je background"' : ''}
              onclick="window.personageMaken.skill('${esc(s).replace(/'/g, "\\'")}')">
              ${ico('check')} ${esc(s)} <span class="pm-skill-ab">${esc((AB_NAAM[SKILLS[s]] || '').slice(0, 3))}</span></button>`;
          }).join('')}
        </div>`;
    },
    waarden() { return { skills: P.keuze.skills ?? P.c.skills ?? [] }; },
  },

  {
    id: 'spreuken',
    titel: 'Wat kun je oproepen?',
    lead: 'Zoveel als je class op dit level kent. Je kiest hier wát; wanneer je ze voorbereidt doe je aan tafel.',
    // Alleen voor wie spreuken krijgt. Een Fighter heeft hier niets te zoeken,
    // en een leeg scherm met "jij niet" is erger dan geen scherm.
    beschikbaar() { return !!_tellerVan(); },
    html() {
      const t = _tellerVan();
      const klasse = P.c.klasse;
      const niveaus = [0, ...Object.keys(P.slots || {}).map(Number)].sort((a, b) => a - b);
      const gekozen = new Set(P.keuze.spreuken || P.c.spreuken || []);
      const lijst = (P.bronnen.spreuken || []).filter(sp => sp.klassen.includes(klasse) && niveaus.includes(sp.niveau));
      const perNiveau = niveaus.map(n => ({
        niveau: n,
        max: n === 0 ? (t.cantrips || 0) : null,
        spreuken: lijst.filter(sp => sp.niveau === n).sort((a, b) => a.naam.localeCompare(b.naam)),
      })).filter(g => g.spreuken.length);
      const gekozenCantrips = [...gekozen].filter(i => lijst.find(sp => sp.index === i && sp.niveau === 0)).length;
      const gekozenRest = [...gekozen].length - gekozenCantrips;
      return `
        <p class="wz-lead">Nog <strong>${Math.max(0, (t.cantrips || 0) - gekozenCantrips)}</strong> cantrips
          en <strong>${Math.max(0, (t.voorbereid || 0) - gekozenRest)}</strong> spreuken te kiezen.</p>
        ${perNiveau.map(g => `
          <div class="wz-veld">
            <label class="dm-form-label">${g.niveau === 0 ? 'Cantrips' : `Niveau ${g.niveau}`}</label>
            <div class="pm-skills">
              ${g.spreuken.map(sp => `
                <button class="pm-skill${gekozen.has(sp.index) ? ' is-aan' : ''}"
                  onclick="window.personageMaken.spreuk('${esc(sp.index)}',${g.niveau})">
                  ${ico('check')} ${esc(sp.naam)} <span class="pm-skill-ab">${esc(sp.school.slice(0, 4))}</span></button>`).join('')}
            </div>
          </div>`).join('')}`;
    },
    waarden() { return { spreuken: P.keuze.spreuken ?? P.c.spreuken ?? [] }; },
  },

  {
    id: 'uitrusting',
    titel: 'Waar ga je mee op pad?',
    lead: 'Wat je background meegeeft, en wat je zelf uitzoekt uit de uitrusting die de app kent.',
    html() {
      const bg = bgVan(P.c.background);
      const k = klasseVan(P.c.klasse);
      const magHarnas = String(k?.basis?.armor || '').toLowerCase();
      const harnassen = (P.bronnen.harnassen || []).filter(h =>
        h.soort === 'Armor' && magHarnas.includes(String(h.harnasSoort || '').toLowerCase()));
      const magSchild = magHarnas.includes('shield');
      const opties = bg?.opties || [];
      const gekozenOptie = P.keuze.bgOptie ?? P.c.bgOptie ?? 'A';
      return `
        ${opties.length ? `
          <div class="wz-veld">
            <label class="dm-form-label">Van je background</label>
            ${opties.map(o => `
              <button class="pm-tegel pm-tegel--breed${o.sleutel === gekozenOptie ? ' is-aan' : ''}" data-veld="bgOptie"
                onclick="window.personageMaken.kies('bgOptie','${o.sleutel}')">
                <span class="pm-tegel-naam">${o.sleutel === 'A' ? 'Spullen' : 'Alleen geld'}${o.goud ? ` · ${o.goud} goud` : ''}</span>
                ${o.spullen.length ? `<span class="pm-tegel-onder">${esc(o.spullen.join(', '))}</span>` : ''}
              </button>`).join('')}
          </div>` : '<p class="wz-lead">Zonder background krijg je hier niets mee — dat kies je een stap terug.</p>'}

        <div class="wz-rij">
          <div class="wz-veld">
            <label class="dm-form-label" for="pm-wapen">Een wapen</label>
            <select class="dm-input" id="pm-wapen">
              <option value="">— geen —</option>
              ${(P.bronnen.wapens || []).map(w => `
                <option value="${esc(w.key)}"${w.key === P.c.wapen ? ' selected' : ''}>${esc(w.naam)}${w.schade ? ` (${esc(w.schade)})` : ''}</option>`).join('')}
            </select>
            <span class="wz-hint">Je class mag ${esc(k?.basis?.weapons || 'wat je DM goedvindt')}.</span>
          </div>
          <div class="wz-veld">
            <label class="dm-form-label" for="pm-harnas">Een harnas</label>
            <select class="dm-input" id="pm-harnas" onchange="window.personageMaken.uitrusting()">
              <option value="">— geen —</option>
              ${harnassen.map(h => `
                <option value="${esc(h.key)}"${h.key === P.c.harnas ? ' selected' : ''}>${esc(h.naam)} (AC ${esc(String(h.ac || ''))})</option>`).join('')}
            </select>
            ${magSchild ? `
              <label class="dm-form-checkbox" style="margin-top:6px">
                <input type="checkbox" id="pm-schild"${P.c.schild ? ' checked' : ''} onchange="window.personageMaken.uitrusting()">
                <span>En een schild (+2)</span>
              </label>` : ''}
          </div>
        </div>

        ${P.bronnen.trinketTafel ? `
          <div class="wz-veld">
            <label class="dm-form-label">Wat zit er nog in je zak?</label>
            ${P.c.trinket
              ? `<p class="wz-lead" style="margin:0">${ico('backpack')} <strong>${esc(P.c.trinket)}</strong></p>`
              : `<button class="dm-btn dm-btn-ghost" onclick="window.personageMaken.trinket()">
                   ${ico('dices')} Rol op ${esc(P.bronnen.trinketTafel)}</button>
                 <span class="wz-hint">Eén worp. Wat eruit komt, hou je.</span>`}
          </div>` : ''}`;
    },
    waarden() {
      return {
        bgOptie: P.keuze.bgOptie ?? P.c.bgOptie ?? 'A',
        wapen: document.getElementById('pm-wapen')?.value || '',
        harnas: document.getElementById('pm-harnas')?.value || '',
        schild: !!document.getElementById('pm-schild')?.checked,
      };
    },
  },

  {
    id: 'nakijken',
    titel: 'Zo komt hij eruit te zien',
    lead: 'Klopt het? Dan gaat hij naar je DM. Die zet hem klaar en dan kun je inloggen.',
    html() {
      const p = P.profiel || {};
      const bg = bgVan(P.c.background);
      const rij = (k, v) => v ? `<div class="pm-rij"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>` : '';
      const skills = (() => {
        try { return Object.keys(JSON.parse(p.skillProfs || '{}')); } catch { return []; }
      })();
      return `
        <div class="pm-blad">
          <div class="pm-blad-kop">
            <strong>${esc(P.c.naam || 'Naamloos')}</strong>
            <span>${esc([P.c.speciesVariant ? `${P.c.speciesVariant} ${P.c.species}` : P.c.species,
              p.multiKlasse ? `${P.c.klasse} ${p.klasseLevel} / ${p.multiKlasse} ${p.multiKlasseLevel}` : P.c.klasse,
              P.c.subclass].filter(Boolean).join(' · '))} · level ${esc(p.level || '1')}</span>
          </div>
          <div class="pm-scores">
            ${ABILITIES.map(a => `
              <div class="pm-score">
                <span class="pm-score-naam">${esc(AB_NAAM[a].slice(0, 3))}</span>
                <span class="pm-score-getal">${esc(String(p[a] ?? 10))}</span>
                <span class="pm-score-mod">${esc(teken(abMod(p[a])))}</span>
              </div>`).join('')}
          </div>
          <dl class="pm-rijen">
            ${rij('Hit Points', String(p._hp ?? ''))}
            ${rij('Hit Dice', p.hitDie)}
            ${rij('Armor Class', p.ac)}
            ${rij('Initiative', p.initiative)}
            ${rij('Proficiency', p.profBonus)}
            ${rij('Saving Throws', (p.saveProfs || '').split(',').filter(Boolean).map(a => AB_NAAM[a] || a).join(', '))}
            ${rij('Skills', skills.map(s => Object.keys(SKILLS).find(x => x.toLowerCase().replace(/[^a-z]/g, '') === s) || s).join(', '))}
            ${rij('Armor Training', p.armorProfs)}
            ${rij('Weapons', p.weaponProfs)}
            ${rij('Tools', p.toolProfs)}
            ${bg?.feat ? rij('Feat', bg.feat) : ''}
          </dl>
          ${(() => {
            const bgOptie = (bg?.opties || []).find(o => o.sleutel === (P.c.bgOptie || 'A'));
            const spullen = [
              ...(bgOptie?.spullen || []),
              ...[P.c.wapen, P.c.harnas].map(k => (P.bronnen.wapens || []).concat(P.bronnen.harnassen || [])
                .find(i => i.key === k)?.naam).filter(Boolean),
              ...(P.c.schild ? ['Shield'] : []),
              ...(P.c.trinket ? [P.c.trinket] : []),
            ];
            const spreuknamen = (P.c.spreuken || [])
              .map(i => (P.bronnen.spreuken || []).find(sp => sp.index === i)?.naam).filter(Boolean);
            return `
              ${spreuknamen.length ? `<p class="wz-lead" style="margin-top:10px">${ico('sparkles')} ${esc(spreuknamen.join(', '))}</p>` : ''}
              ${spullen.length ? `<p class="wz-lead" style="margin-top:6px">${ico('backpack')} ${esc(spullen.join(', '))}${bgOptie?.goud ? ` · ${bgOptie.goud} goud` : ''}</p>` : ''}`;
          })()}
        </div>
        ${(P.nakijk?.opmerkingen || []).length ? `
          <div class="pm-let-op">
            <strong>${ico('alert-triangle')} Je DM ziet dit erbij staan</strong>
            <ul>${P.nakijk.opmerkingen.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
          </div>` : ''}
        ${(P.nakijk?.fouten || []).length ? `
          <div class="pm-let-op pm-let-op--fout">
            <strong>${ico('x')} Dit moet nog</strong>
            <ul>${P.nakijk.fouten.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
          </div>` : ''}`;
    },
    waarden() { return {}; },
    laatste: true,
  },
];

const _METHODE = {
  array:    { label: 'Standaardreeks', hint: 'Verdeel 15, 14, 13, 12, 10 en 8 over je abilities.' },
  pointbuy: { label: 'Point buy',      hint: 'Alles begint op 8; je hebt 27 punten en boven de 13 wordt elke stap duurder.' },
  rollen:   { label: 'Rollen',         hint: 'Zes keer 4d6, de laagste valt af. Wat je rolt, dat is het.' },
  vrij:     { label: 'Vrij intikken',  hint: 'Zes vakjes, zelf invullen.' },
};
// Wat de verdeling betekent, in woorden. Een getal in een vakje zegt niet dat
// je er drie levels Fighter aan overhoudt.
function _multiTekst(level) {
  const tweede = P.c.multiKlasse;
  const n = Math.max(0, Math.min(level - 1, parseInt(P.c.multiKlasseLevel) || 0));
  if (!tweede || !n) return 'Laat dit leeg als je één class speelt.';
  return `${level - n} level${level - n === 1 ? '' : 's'} ${P.c.klasse} en ${n} ${tweede}. `
    + 'Je DM ziet of je aan de eisen voldoet voordat hij je personage gunt.';
}

const _aardLabel = (a) => ({ martial: 'Martial', half: 'Half-caster', caster: 'Full caster' }[a] || '');

// ── Tegels ───────────────────────────────────────────────────────────────────
// Eén vorm voor species, class, subclass en background: een vlak met de naam en
// een regel eronder. Je kiest hier wát je bent, en dat verdient meer dan een
// uitklaplijst.
function _tegels(rijen, gekozen, veld) {
  return `<div class="pm-tegels">
    ${rijen.map(r => `
      <button class="pm-tegel${r.waarde === gekozen ? ' is-aan' : ''}" data-veld="${esc(veld)}"
        onclick="window.personageMaken.kies('${esc(veld)}','${esc(r.waarde).replace(/'/g, "\\'")}')">
        <span class="pm-tegel-naam">${esc(r.titel)}</span>
        ${r.onder ? `<span class="pm-tegel-onder">${esc(r.onder)}</span>` : ''}
      </button>`).join('')}
  </div>`;
}

// ── De zes getallen ──────────────────────────────────────────────────────────
// Hoort wat er staat bij de gekozen manier? Zo niet: leg de beginstand neer.
function _scoresIjken(methode) {
  const nu = ABILITIES.map(a => parseInt(P.c.scores?.[a]) || 0);
  if (methode === 'array') {
    const klopt = [...nu].sort((x, y) => y - x).join() === [...STANDAARDREEKS].sort((x, y) => y - x).join();
    if (!klopt) ABILITIES.forEach((a, i) => { P.c.scores[a] = STANDAARDREEKS[i]; });
  }
  if (methode === 'pointbuy') {
    const binnen = nu.every(v => PUNTEN[v] !== undefined);
    const kosten = ABILITIES.reduce((t, a) => t + (PUNTEN[P.c.scores[a]] ?? 99), 0);
    if (!binnen || kosten > PUNTEN_BUDGET) ABILITIES.forEach(a => { P.c.scores[a] = 8; });
  }
}

function _scoresHtml(methode) {
  const bg = bgVan(P.c.background);
  const bonusKan = bg?.abilities?.length ? bg.abilities : [];
  const kosten = ABILITIES.reduce((t, a) => t + (PUNTEN[parseInt(P.c.scores?.[a])] ?? 0), 0);
  const rol = methode === 'rollen';
  return `
    ${rol ? `<div class="pm-rol-rij">
      <button class="dm-btn dm-btn-ghost" onclick="window.personageMaken.rol()">${ico('dices')} Rol zes keer 4d6</button>
      ${(P.c.worpen || []).length ? `<span class="pm-worpen">${P.c.worpen.map(w => `<span>${w}</span>`).join('')}</span>` : ''}
    </div>` : ''}
    ${methode === 'pointbuy' ? `<p class="wz-lead" id="pm-punten">Je gebruikt <strong>${kosten}</strong> van de ${PUNTEN_BUDGET} punten.</p>` : ''}
    <div class="pm-ability-raster">
      ${ABILITIES.map(a => {
        const eigen = parseInt(P.c.scores?.[a]) || 10;
        const bonus = parseInt(P.c.bgBonus?.[a]) || 0;
        const opties = methode === 'array' ? STANDAARDREEKS
          : methode === 'pointbuy' ? Object.keys(PUNTEN).map(Number)
          : null;
        return `
          <div class="pm-ability">
            <label class="dm-form-label" for="pm-sc-${a}">${esc(AB_NAAM[a])}</label>
            ${opties
              ? `<select class="dm-input" id="pm-sc-${a}" onchange="window.personageMaken.score('${a}')">
                   ${opties.map(o => `<option value="${o}"${o === eigen ? ' selected' : ''}>${o}</option>`).join('')}
                 </select>`
              : `<input class="dm-input" id="pm-sc-${a}" type="number" min="1" max="30" value="${eigen}"
                   oninput="window.personageMaken.score()">`}
            ${bonusKan.includes(a) ? `
              <select class="dm-input pm-bonus" data-bgbonus="${a}" onchange="window.personageMaken.score()">
                <option value="0"${bonus === 0 ? ' selected' : ''}>+0</option>
                <option value="1"${bonus === 1 ? ' selected' : ''}>+1</option>
                <option value="2"${bonus === 2 ? ' selected' : ''}>+2</option>
              </select>` : '<span class="pm-bonus-leeg"></span>'}
            <span class="pm-ability-uit" id="pm-uit-${a}">${eigen + bonus} <em>${teken(abMod(eigen + bonus))}</em></span>
          </div>`;
      }).join('')}
    </div>
    ${bonusKan.length ? `<p class="wz-lead">${esc(bg.naam)} verhoogt <strong>${bonusKan.map(a => AB_NAAM[a]).join(', ')}</strong>:
      geef er één +2 en één +1, of alle drie +1.</p>`
      : '<p class="wz-lead">Kies eerst een background als je zijn verhoging wilt verdelen.</p>'}`;
}

// ── Tekenen ──────────────────────────────────────────────────────────────────
function _actief() { return STAPPEN.filter(s => !s.beschikbaar || s.beschikbaar()); }

function _teken() {
  const host = document.getElementById('pm-body');
  const lijst = _actief();
  const stap = lijst[P.stap];
  if (!host || !stap) return;
  P.keuze = {};
  host.innerHTML = `
    <div class="wz-kop">
      <div class="wz-stappen">${lijst.map((s, i) => `
        <span class="wz-bol${i === P.stap ? ' is-nu' : ''}${i < P.stap ? ' is-gehad' : ''}" title="${esc(s.titel)}"></span>`).join('')}</div>
      <h2 class="wz-titel">${esc(stap.titel)}</h2>
      ${stap.lead ? `<p class="wz-lead">${esc(stap.lead)}</p>` : ''}
      ${P.c.status === 'terug' && P.c.reden ? `
        <div class="pm-let-op pm-let-op--fout">
          <strong>${ico('mail')} Je DM stuurde hem terug</strong>
          <p>${esc(P.c.reden)}</p>
        </div>` : ''}
    </div>
    <div class="wz-inhoud" id="pm-inhoud">${stap.html()}</div>
    <div class="wz-voet">
      ${P.stap > 0
        ? `<button class="dm-btn dm-btn-ghost" onclick="window.personageMaken.terug()">${ico('chevron-left')} Terug</button>`
        : `<button class="dm-btn dm-btn-ghost" onclick="window.personageMaken.sluit()">${ico('x')} Later verder</button>`}
      <div class="wz-voet-rechts">
        ${stap.laatste
          ? `<button class="dm-btn dm-btn-primary" onclick="window.personageMaken.indienen()">${ico('check')} Naar je DM sturen</button>`
          : `<button class="dm-btn dm-btn-primary" onclick="window.personageMaken.verder()">Volgende ${ico('chevron-right')}</button>`}
      </div>
    </div>`;
  host.querySelector('input')?.focus();
}

// Opslaan wat er op dit scherm staat. Altijd het hele veld, nooit een halve
// wijziging: de server is de waarheid en stuurt het nagerekende blad terug.
async function _bewaar(extra = {}) {
  const stap = _actief()[P.stap];
  const data = { ...(stap?.waarden?.() || {}), ...extra };
  const r = await api.conceptBewaar(P.c.id, data);
  P.c = r.concept; P.profiel = r.profiel; P.nakijk = r.nakijk; P.slots = r.slots || {};
  return r;
}

function _open() {
  let el = document.getElementById('pm-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pm-overlay';
    el.className = 'wz-overlay';
    // Breder dan de opstartwizard: hier staan tegels naast elkaar, geen velden
    // onder elkaar.
    el.innerHTML = '<div class="wz-kaart wz-kaart--breed" id="pm-body"></div>';
    document.body.appendChild(el);
  }
  document.body.classList.add('wizard-open');
  _teken();
}

// ── Naar buiten ──────────────────────────────────────────────────────────────
window.personageMaken = {
  // Beginnen vanaf de landingspagina. Het partywachtwoord is de drempel — wie
  // dat heeft zit aan tafel.
  async start(wachtwoord, naam = '') {
    try {
      const r = await api.conceptStart(wachtwoord, naam);
      P.c = r.concept; P.bronnen = r.bronnen; P.inst = r.instellingen;
      P.profiel = r.profiel; P.nakijk = r.nakijk; P.slots = r.slots || {}; P.stap = 0;
      _open();
    } catch (e) {
      window._showToast?.(e.message || 'Dat lukte niet');
      throw e;
    }
  },

  // Verder met wat er al lag. De sessie weet welk concept van jou is.
  async hervat() {
    const r = await api.conceptMijn();
    if (!r.concept) return false;
    P.c = r.concept; P.bronnen = r.bronnen; P.inst = r.instellingen;
    P.profiel = r.profiel; P.nakijk = r.nakijk; P.slots = r.slots || {}; P.stap = 0;
    _open();
    return true;
  },

  // Staat er iets klaar, en zo ja hoe heet het? De landingspagina vraagt dit
  // om "+ Nieuw personage" of "Verder met Brigitta" te kunnen zetten.
  async stand() {
    try { return await api.conceptMijn(); } catch { return { concept: null }; }
  },

  kies(veld, waarde) {
    P.keuze[veld] = waarde;
    // Meteen zichtbaar, zonder de hele stap opnieuw op te halen.
    const host = document.getElementById('pm-inhoud');
    host?.querySelectorAll(`.pm-tegel[data-veld="${veld}"]`).forEach(b => {
      b.classList.toggle('is-aan', b.textContent.trim().startsWith(waarde));
    });
    // Een andere class betekent een andere subclass-lijst eronder.
    if (veld === 'klasse') { P.c.klasse = waarde; P.c.subclass = ''; host.innerHTML = _actief()[P.stap].html(); }
    if (veld === 'species') { P.c.species = waarde; P.c.speciesVariant = ''; host.innerHTML = _actief()[P.stap].html(); }
    if (veld === 'background') { P.c.background = waarde; P.c.bgBonus = {}; }
  },

  skill(naam) {
    const k = klasseVan(P.c.klasse);
    const aantal = parseInt(k?.basis?.skillAantal) || 0;
    const nu = new Set(P.keuze.skills || P.c.skills || []);
    if (nu.has(naam)) nu.delete(naam);
    else if (nu.size < aantal) nu.add(naam);
    else { window._showToast?.(`Je class kiest er ${aantal}.`); return; }
    P.keuze.skills = [...nu];
    P.c.skills = [...nu];
    document.getElementById('pm-inhoud').innerHTML = _actief()[P.stap].html();
  },

  // Een spreuk aan- of uitzetten, met de tellers van je class als plafond:
  // cantrips tellen apart van de rest, want dat zijn twee verschillende
  // getallen op het blad.
  spreuk(index, niveau) {
    const t = _tellerVan() || {};
    const nu = new Set(P.keuze.spreuken || P.c.spreuken || []);
    const lijst = P.bronnen.spreuken || [];
    const isCantrip = (i) => lijst.find(sp => sp.index === i)?.niveau === 0;
    if (nu.has(index)) nu.delete(index);
    else {
      const aantal = [...nu].filter(i => isCantrip(i) === (niveau === 0)).length;
      const max = niveau === 0 ? (t.cantrips || 0) : (t.voorbereid || 0);
      if (aantal >= max) { window._showToast?.(`Je kent er ${max} op dit level.`); return; }
      nu.add(index);
    }
    P.keuze.spreuken = [...nu];
    P.c.spreuken = [...nu];
    document.getElementById('pm-inhoud').innerHTML = _actief()[P.stap].html();
  },

  // Het harnas verandert je AC; dat hoort je meteen te zien en niet pas op het
  // laatste scherm.
  uitrusting() {
    P.c.harnas = document.getElementById('pm-harnas')?.value || '';
    P.c.schild = !!document.getElementById('pm-schild')?.checked;
  },

  async trinket() {
    try {
      const r = await api.conceptTrinket(P.c.id);
      P.c.trinket = r.trinket;
      document.getElementById('pm-inhoud').innerHTML = _actief()[P.stap].html();
    } catch (e) { window._showToast?.(e.message || 'Rollen lukte niet'); }
  },

  multi() {
    P.c.multiKlasse = document.getElementById('pm-multi')?.value || '';
    const level = parseInt(P.c.level) || 1;
    P.c.multiKlasseLevel = Math.max(0, Math.min(level - 1, parseInt(document.getElementById('pm-multi-level')?.value) || 0));
    const veld = document.getElementById('pm-multi-level');
    if (veld) veld.value = P.c.multiKlasseLevel;
    const uit = document.getElementById('pm-multi-uit');
    if (uit) uit.textContent = _multiTekst(level);
  },

  // Het portret gaat mee vóór het kaartje bestaat: het bestand krijgt het id
  // van het concept en verhuist bij het gunnen naar het kaartje.
  async portret(file, invoer) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      // Met de hand, want een bestand gaat niet als JSON: de campagne moet er
      // wel bij, anders landt het portret in de verkeerde wereld.
      const r = await fetch(`/api/personage-concept/${P.c.id}/portret?campagne=${encodeURIComponent(huidigeCampagne() || '')}`,
        { method: 'POST', body: fd, credentials: 'same-origin' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Uploaden mislukt');
      P.c.portret = true;
      const vak = document.getElementById('pm-portret');
      if (vak) vak.innerHTML = `<img src="/api/files/${esc(P.c.id)}?t=${Date.now()}" alt="">`;
    } catch (e) { window._showToast?.(e.message || 'Uploaden mislukt'); }
    finally { if (invoer) invoer.value = ''; }
  },

  methode(m) {
    P.c.methode = m;
    if (m === 'array') {
      // De reeks in de volgorde waarin hij staat, zodat er iets geldigs staat
      // voordat je gaat schuiven.
      ABILITIES.forEach((a, i) => { P.c.scores[a] = STANDAARDREEKS[i]; });
    }
    if (m === 'pointbuy') ABILITIES.forEach(a => { P.c.scores[a] = 8; });
    document.getElementById('pm-inhoud').innerHTML = _actief()[P.stap].html();
  },

  // Zes keer 4d6, de laagste eraf. Zichtbaar, want aan tafel kijkt iedereen mee.
  rol() {
    const worp = () => {
      const d = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
      return d[0] + d[1] + d[2];
    };
    P.c.worpen = [worp(), worp(), worp(), worp(), worp(), worp()].sort((a, b) => b - a);
    ABILITIES.forEach((a, i) => { P.c.scores[a] = P.c.worpen[i]; });
    document.getElementById('pm-inhoud').innerHTML = _actief()[P.stap].html();
  },

  // Wat je intikt telt meteen door naar de modifier eronder en de puntenteller.
  // Bij de standaardreeks heb je precies zes getallen: geef je er een weg die
  // al ergens stond, dan ruilen die twee. Zo blijft het altijd een geldige
  // verdeling zonder dat je ergens "die is al op" te lezen krijgt.
  score(ab) {
    if (ab && P.c.methode === 'array') {
      const nieuw = parseInt(document.getElementById(`pm-sc-${ab}`)?.value) || 10;
      const oud = parseInt(P.c.scores[ab]) || 10;
      const ander = ABILITIES.find(a => a !== ab && (parseInt(P.c.scores[a]) || 0) === nieuw);
      if (ander) {
        P.c.scores[ander] = oud;
        const el = document.getElementById(`pm-sc-${ander}`);
        if (el) el.value = oud;
      }
      P.c.scores[ab] = nieuw;
    }
    const scores = {};
    for (const a of ABILITIES) scores[a] = parseInt(document.getElementById(`pm-sc-${a}`)?.value) || 10;
    for (const a of ABILITIES) {
      const bonus = parseInt(document.querySelector(`[data-bgbonus="${a}"]`)?.value) || 0;
      const uit = document.getElementById(`pm-uit-${a}`);
      if (uit) uit.innerHTML = `${scores[a] + bonus} <em>${teken(abMod(scores[a] + bonus))}</em>`;
      P.c.scores[a] = scores[a];
      if (bonus) P.c.bgBonus[a] = bonus; else delete P.c.bgBonus[a];
    }
    const teller = document.getElementById('pm-punten');
    if (teller) {
      const kosten = ABILITIES.reduce((t, a) => t + (PUNTEN[scores[a]] ?? 0), 0);
      teller.innerHTML = `Je gebruikt <strong>${kosten}</strong> van de ${PUNTEN_BUDGET} punten.`;
      teller.classList.toggle('pm-tekort', kosten > PUNTEN_BUDGET);
    }
  },

  async verder() {
    if (P.bezig) return;
    P.bezig = true;
    try { await _bewaar(); P.stap = Math.min(_actief().length - 1, P.stap + 1); _teken(); }
    catch (e) { window._showToast?.('Opslaan lukte niet: ' + (e.message || e)); }
    finally { P.bezig = false; }
  },

  async terug() {
    if (P.bezig) return;
    P.bezig = true;
    try { await _bewaar(); } catch { /* terug mag altijd */ }
    P.bezig = false;
    P.stap = Math.max(0, P.stap - 1); _teken();
  },

  async indienen() {
    if (P.bezig) return;
    P.bezig = true;
    try {
      await _bewaar();
      await api.conceptIndienen(P.c.id);
      this.sluit();
      window.app?.openModal?.('Naar je DM gestuurd', '', `
        <div class="dm-feature-section" style="margin:0">
          <p>${esc(P.c.naam)} ligt bij je DM. Zodra hij hem goedkeurt staat hij tussen de portretten
          en kun je met het partywachtwoord inloggen.</p>
        </div>`);
    } catch (e) {
      window._showToast?.(e.message || 'Versturen lukte niet');
    } finally { P.bezig = false; }
  },

  sluit() {
    document.getElementById('pm-overlay')?.remove();
    document.body.classList.remove('wizard-open');
  },
};

export { STAPPEN };
