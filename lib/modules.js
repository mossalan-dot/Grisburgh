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
  // De sleutel blijft `vaardigheden` — hernoemen kost een migratie van elke
  // campagne die hem in `meta.modules` heeft staan, en levert niets zichtbaars.
  // Het lábel is wel veranderd: het tabblad gaat niet over vaardigheden maar
  // over waar een personage uit bestaat.
  { id: 'vaardigheden', label: 'Heldenboek',        groep: 'spel',    startset: true,  secties: ['vaardigheden'] },
  { id: 'bestiarium',   label: 'Bestiarium',         groep: 'spel',    startset: false, secties: ['bestiarium'] },

  // — Sfeer —
  { id: 'geluiden',     label: 'Geluiden',           groep: 'sfeer',   startset: true,  dmTabs: ['geluiden'] },
  { id: 'tafels',       label: 'Tafels',             groep: 'sfeer',   startset: true,  dmTabs: ['tafels'] },
  { id: 'berichten',    label: 'Berichten',          groep: 'sfeer',   startset: true,  dmTabs: ['berichten'], spelerTabs: ['berichten'] },

  // — Diensten —
  // Dezelfde volgorde als de tabbalk van de Meesterkamer en het dienstenmenu in
  // de kop (window.DIENST_VOLGORDE): van waar je elke sessie komt naar waar je
  // zelden komt.
  { id: 'markt',        label: 'Markt',              groep: 'dienst',  startset: true,  secties: ['markt'] },
  { id: 'herberg',      label: 'Herberg',            groep: 'dienst',  startset: true,  secties: ['herberg'] },
  { id: 'tempel',       label: 'Tempels',            groep: 'dienst',  startset: false, secties: ['tempel'] },
  { id: 'facties',      label: 'Facties',            groep: 'dienst',  startset: false, secties: ['facties'], spelerTabs: ['facties'] },
  { id: 'arena',        label: 'Gokhuis',            groep: 'dienst',  startset: true,  secties: ['tweespalt'] },
  { id: 'detective',    label: 'Detective',          groep: 'dienst',  startset: true,  secties: ['gock'] },
  { id: 'waarzegger',   label: 'Waarzegger',         groep: 'dienst',  startset: false, secties: ['ursula'] },
  { id: 'magizoo',      label: 'Magizoöloog',        groep: 'dienst',  startset: false, secties: ['magizoo'] },
  // De woekeraar is een hele dienst: zijn eigen deur voor de spelers (lenen,
  // zien wat er openstaat, aflossen) en het schuldenregister bij de DM. Hij
  // duikt ook op bij de Markt en in het gokhuis, maar alleen als deze module
  // aanstaat — anders leent iemand geld van een man die niet bestaat. Uit by
  // default: niet elke tafel wil een schuldeiser die aanklopt.
  // Zie `docs/voorstel-woekeraar.md`.
  { id: 'woekeraar',    label: 'Woekeraar',          groep: 'dienst',  startset: false, secties: ['woekeraar'], dmTabs: ['woekeraar'] },

  // — Deelfuncties van een dienst —
  // Een dienst doet soms twee dingen die los van elkaar staan: je kunt in een
  // herberg slapen én drinken, maar niet elke herberg schenkt. Zo'n deel had
  // geen eigen schakelaar — je kon alleen de hele herberg uitzetten.
  //
  // `ouder` zegt waar het bij hoort: staat de dienst uit, dan doet het deel er
  // niet toe (de lijst zet hem dan grijs). `delen` is wat er in het scherm
  // verdwijnt — de client filtert daarop, net als op `secties`.
  { id: 'herberg-tap',  label: 'Aan de tap',         groep: 'dienst',  startset: true,  ouder: 'herberg', delen: ['herberg-tap'] },
  // Een waard die niet roddelt: je kunt er slapen en drinken, maar hij vertelt
  // niets over wie je noemt — en een lange rust hier levert dan ook niets op.
  { id: 'herberg-roddels', label: 'Roddels',         groep: 'dienst',  startset: true,  ouder: 'herberg', delen: ['herberg-roddels'] },
  // Een tempel waar je een zegen koopt maar je niet voor het leven bindt. De
  // eed is het enige onomkeerbare van alle diensten, dus hem kunnen uitzetten
  // is meer dan smaak.
  { id: 'tempel-eden',  label: 'Eden en vloeken',    groep: 'dienst',  startset: true,  ouder: 'tempel',  delen: ['tempel-eden'] },
  { id: 'gokhuis-arena', label: 'Strijdperk',        groep: 'dienst',  startset: true,  ouder: 'arena',   delen: ['gokhuis-arena'] },
  { id: 'magizoo-adoptie', label: 'Adoptie',         groep: 'dienst',  startset: true,  ouder: 'magizoo', delen: ['magizoo-adoptie'] },
  // De andere kant van de detective: niet iets uitzoeken maar iets ronddoen.
  // Bewust **uit** in de startset — het is een chanteur-mechaniek, en een DM
  // hoort er zelf ja tegen te zeggen voor zijn spelers kunnen gaan liegen.
  { id: 'gock-geruchten', label: 'Geruchten',        groep: 'dienst',  startset: false, ouder: 'detective', delen: ['gock-geruchten'] },

  // — Losse functies, geen dienst —
  // De houding van een personage tegenover de groep: één waarde die als glans
  // of schaduw over het kaartje trekt, met het balkje waarmee de DM hem zet.
  // Geen `ouder`, want hij hangt niet onder een dienst; wel een `deel`, want
  // dat is precies het haakje dat de client en de routes al kennen.
  //
  // Staat hij uit, dan is er niets: geen balkje, geen glans, en de server
  // stuurt de waarde niet mee. Wat de DM al ingesteld had blijft wel staan —
  // zet hij hem later weer aan, dan is het er nog. Niets weggooien wat een DM
  // getypt heeft.
  //
  // `startset: true`, want hij doet in rust niets en valt dus niemand lastig.
  // Wie het te veel vindt zet hem bij Instellingen uit, of in de wizard.
  { id: 'houding',      label: 'Houding van personages', groep: 'wereld', startset: true, delen: ['houding'] },
];

// Wat een campagne aan heeft staan. Een module die niet in meta.modules
// voorkomt volgt de startset — zo krijgt een bestaande campagne een nieuwe
// module vanzelf, en hoeft een nieuwe DM niets aan te zetten om te beginnen.
function modulesVoor(meta) {
  const gekozen = (meta && typeof meta.modules === 'object' && meta.modules) || {};
  const uit = Object.fromEntries(MODULES.map(m => [
    m.id,
    typeof gekozen[m.id] === 'boolean' ? gekozen[m.id] : m.startset,
  ]));
  // **Wat de DM er zelf bij zette.** Alleen voor wat de beheerder niet
  // uitdrukkelijk heeft dichtgezet; zie `modulesVrijgegeven` voor waarom dat
  // onderscheid er is.
  const eigenAan = new Set(Array.isArray(meta?.modulesAan) ? meta.modulesAan : []);
  for (const m of MODULES) if (eigenAan.has(m.id) && gekozen[m.id] !== false) uit[m.id] = true;
  // **Twee sloten op één deur, en ze draaien maar één kant op.**
  // `meta.modules` is van de beheerder: die bepaalt wat een campagne *mag*
  // hebben, en geeft stapsgewijs vrij. `meta.modulesUit` is van de DM zelf:
  // daarmee zet hij uit wat hij niet gebruikt. Hij kan dus wél iets wegdoen en
  // nooit iets erbij nemen — precies de verdeling uit het multi-DM-plan, en
  // zonder die scheiding zou de wizard de beheerder kunnen overrulen.
  const eigenUit = new Set(Array.isArray(meta?.modulesUit) ? meta.modulesUit : []);
  for (const m of MODULES) if (eigenUit.has(m.id)) uit[m.id] = false;
  // Een deel kan niet aanstaan als zijn dienst uitstaat: dan is er niets om
  // een deel van te zijn.
  for (const m of MODULES) if (m.ouder && !uit[m.ouder]) uit[m.id] = false;
  return uit;
}

// Wat een DM mág hebben: waar de lijst in de wizard en bij Instellingen uit
// bestaat. Dat is iets anders dan wat er **aan** staat (`modulesVoor`).
//
// **Niet beslist is niet verboden.** Dit volgde eerst de startset: alles wat
// standaard uit stond was daarmee ook onbereikbaar, en een DM moest voor acht
// van de dertig onderdelen bij de beheerder aankloppen — aktes, bestiarium,
// tempels, facties, de waarzegger, de magizoöloog, de woekeraar, de geruchten.
// De reden daarvoor was dat die uitleg vragen die je er dan bij geeft; die
// uitleg staat inmiddels in de hulpknoppen.
//
// Dus: de beheerder die uitdrukkelijk `false` zet houdt zijn slot — dat is een
// beslissing en die blijft staan. Maar waar hij niets over gezegd heeft mag de
// DM zelf kiezen. De startset blijft bepalen wat er áán staat als je niets
// doet; hij bepaalt niet meer wat je mag.
function modulesVrijgegeven(meta) {
  const gekozen = (meta && typeof meta.modules === 'object' && meta.modules) || {};
  const uit = Object.fromEntries(MODULES.map(m => [m.id, gekozen[m.id] !== false]));
  for (const m of MODULES) if (m.ouder && !uit[m.ouder]) uit[m.id] = false;
  return uit;
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
    // Deelfuncties binnen een dienst: de tap in de herberg, het strijdperk in
    // het gokhuis, de adoptie bij de magizoöloog.
    //
    // Alleen delen van een dienst die zélf aanstaat. Staat de dienst uit, dan
    // is zijn deel niet "uitgezet" maar niet van toepassing — de hele dienst
    // zit al in `secties`, en een route die op deze lijst afgaat hoort dan niet
    // te weigeren om de verkeerde reden.
    delen:      uit.filter(m => !m.ouder || aan[m.ouder]).flatMap(m => m.delen || []),
  };
}

module.exports = {
  modulesVrijgegeven, MODULES, modulesVoor, schoneModules, verborgenUI };
