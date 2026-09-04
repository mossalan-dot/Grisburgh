// ── Modules per campagne ─────────────────────────────────────────────────────
// Niet elke campagne heeft alles nodig, en niet alles is klaar om buiten
// Grisburgh gebruikt te worden. Wat uit staat verdwijnt volledig uit beeld —
// geen grijze "binnenkort"-knoppen, want die beloven iets.
//
// Per module staat hier waar hij in de UI zit: `secties` zijn de knoppen in de
// zijbalk (`data-section`), `logtabs` de items in het Logboek-menu, `dmTabs` de
// tabs van de Meesterkamer en `spelerTabs` de subtabs van het spelerstabblad.
// De client filtert daarop; dit bestand is de enige plek waar die koppeling
// staat.
//
// `startset: false` = wel gebouwd, maar te campagne-eigen of te weinig
// uitgekristalliseerd om een nieuwe DM mee op te zadelen. Alleen de beheerder
// zet die aan, stapsgewijs, met uitleg erbij.

const MODULES = [
  // — Wereld en verhaal —
  { id: 'kaarten',      label: 'Kaarten',            groep: 'wereld',  startset: true,  secties: ['kaart'] },
  { id: 'missies',      label: 'Missies',            groep: 'wereld',  startset: true,  logtabs: ['quests'] },
  { id: 'prikbord',     label: 'Prikbord',           groep: 'wereld',  startset: true,  logtabs: ['prikbord'] },
  { id: 'aktes',        label: 'Aktes & regie',      groep: 'wereld',  startset: false, dmTabs: ['aktes'] },

  // — Spel —
  { id: 'gevecht',      label: 'Gevecht & loot',     groep: 'spel',    startset: true,  dmTabs: ['gevecht', 'loot'] },
  { id: 'rust',         label: 'Rust',               groep: 'spel',    startset: true,  dmTabs: ['rust'] },
  { id: 'dobbelstenen', label: 'Dobbelstenen',       groep: 'spel',    startset: true },
  { id: 'progressie',   label: 'Progressie',         groep: 'spel',    startset: true,  spelerTabs: ['progressie'] },
  { id: 'spreuken',     label: 'Spreukenboek',       groep: 'spel',    startset: true,  secties: ['spreuken'], spelerTabs: ['spreukenboek'] },
  { id: 'bestiarium',   label: 'Bestiarium',         groep: 'spel',    startset: false, secties: ['bestiarium'] },

  // — Sfeer —
  { id: 'geluiden',     label: 'Geluiden',           groep: 'sfeer',   startset: true,  dmTabs: ['geluiden'] },
  { id: 'tafels',       label: 'Tafels',             groep: 'sfeer',   startset: true,  dmTabs: ['tafels'] },
  { id: 'berichten',    label: 'Berichten',          groep: 'sfeer',   startset: true,  dmTabs: ['berichten'], spelerTabs: ['berichten'] },

  // — Diensten —
  { id: 'herberg',      label: 'Herberg',            groep: 'dienst',  startset: true,  secties: ['herberg'] },
  { id: 'arena',        label: 'Arena',              groep: 'dienst',  startset: true,  secties: ['tweespalt'] },
  { id: 'detective',    label: 'Detective',          groep: 'dienst',  startset: true,  secties: ['gock'] },
  { id: 'tempel',       label: 'Tempel',             groep: 'dienst',  startset: false, secties: ['tempel'] },
  { id: 'waarzegger',   label: 'Waarzegger',         groep: 'dienst',  startset: false, secties: ['ursula'] },
  { id: 'magizoo',      label: 'Magizoöloog',        groep: 'dienst',  startset: false, secties: ['magizoo'] },
  { id: 'facties',      label: 'Facties & aanzien',  groep: 'dienst',  startset: false, secties: ['facties'], spelerTabs: ['facties'] },
];

// Wat een campagne aan heeft staan. Een module die niet in meta.modules
// voorkomt volgt de startset — zo krijgt een bestaande campagne een nieuwe
// module vanzelf, en hoeft een nieuwe DM niets aan te zetten om te beginnen.
function modulesVoor(meta) {
  const gekozen = (meta && typeof meta.modules === 'object' && meta.modules) || {};
  return Object.fromEntries(MODULES.map(m => [
    m.id,
    typeof gekozen[m.id] === 'boolean' ? gekozen[m.id] : m.startset,
  ]));
}

// Alleen echte module-ids en echte booleans; de rest gaat overboord.
function schoneModules(invoer) {
  const uit = {};
  for (const m of MODULES) {
    if (typeof invoer?.[m.id] === 'boolean') uit[m.id] = invoer[m.id];
  }
  return uit;
}

// Wat de client moet verbergen. Bewust hier uitgerekend en niet in de browser:
// dan staat de koppeling module → knop op één plek, en kan de client niet uit
// de pas lopen met dit bestand.
function verborgenUI(meta) {
  const aan = modulesVoor(meta);
  const uit = MODULES.filter(m => !aan[m.id]);
  const verzamel = (veld) => uit.flatMap(m => m[veld] || []);
  return {
    secties:    verzamel('secties'),
    logtabs:    verzamel('logtabs'),
    dmTabs:     verzamel('dmTabs'),
    spelerTabs: verzamel('spelerTabs'),
  };
}

module.exports = { MODULES, modulesVoor, schoneModules, verborgenUI };
