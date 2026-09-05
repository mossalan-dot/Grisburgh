// Fetch wrapper for all API calls
const BASE = '/api';

// ── Welke campagne kijken we? ───────────────────────────────────────────────
// Elke campagne heeft haar eigen pad (/grisburgh). Bij het inloggen moet de
// server weten wiens wachtwoord hij controleert, anders zou het wachtwoord van
// de ene DM toegang geven tot de campagne van de andere.
export const campagneUitUrl = () => location.pathname.split('/').filter(Boolean)[0] || '';
let _campagne = campagneUitUrl();
export function huidigeCampagne() { return _campagne; }
export function zetCampagne(naam) { if (naam) _campagne = naam; }

// Elk verzoek noemt zijn campagne. De server kiest sessie → ?campagne= →
// standaard, dus voor wie ingelogd is verandert dit niets; voor wie nog niet
// ingelogd is, is dit het enige dat verklapt dat hij op /prewett staat. Zonder
// deze regel kreeg de landing van Prewett de titel, ondertitel en portretten
// van Grisburgh: het pad staat in de adresbalk, niet in het API-verzoek.
export function metCampagne(pad) {
  if (!_campagne || pad.includes('campagne=')) return pad;
  return pad + (pad.includes('?') ? '&' : '?') + 'campagne=' + encodeURIComponent(_campagne);
}

async function request(path, opts = {}) {
  const res = await fetch(BASE + metCampagne(path), {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json().catch(() => {
    throw new Error(`Route ${path} bestaat niet op deze server (geen JSON antwoord)`);
  });
}

export const api = {
  // Auth
  login:             (password)     => request('/auth/login',          { method: 'POST', body: JSON.stringify({ campagne: _campagne, password }) }),
  // Publiek: welke campagne hoort bij dit pad (of bij mijn sessie)?
  campagneInfo:      ()             => request(`/campagne?pad=${encodeURIComponent(location.pathname)}`),
  // Eén wachtwoordveld: het antwoord vertelt of je DM bent of welke party het is.
  toegang:           (wachtwoord)   => request('/auth/toegang',        { method: 'POST', body: JSON.stringify({ campagne: _campagne, wachtwoord }) }),
  sandboxLogin:      (password)     => request('/auth/sandbox-login',  { method: 'POST', body: JSON.stringify({ password: password || '' }) }),
  tabletLogin:       (password)     => request('/auth/tablet-login',   { method: 'POST', body: JSON.stringify({ campagne: _campagne, password }) }),
  logout:            ()             => request('/auth/logout',         { method: 'POST' }),
  role:              ()             => request('/auth/role'),
  listPlayerChars:   ()             => request('/auth/players'),
  playerLogin:       (characterId, password) => request('/auth/player-login', { method: 'POST', body: JSON.stringify({ campagne: _campagne, characterId, password: password || '' }) }),
  playerLogout:      ()             => request('/auth/player-logout',  { method: 'POST' }),

  // Entities
  listEntities: (type) => request(`/entities/${type}`),
  getEntity: (type, id) => request(`/entities/${type}/${id}`),
  createEntity: (type, data) => request(`/entities/${type}`, { method: 'POST', body: JSON.stringify(data) }),
  updateEntity: (type, id, data) => request(`/entities/${type}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEntity: (type, id) => request(`/entities/${type}/${id}`, { method: 'DELETE' }),
  toggleVisibility: (type, id, target) => request(`/entities/${type}/${id}/visibility`, { method: 'PUT', body: JSON.stringify(target ? { target } : {}) }),
  shopRevealItem:   (type, id)          => request(`/entities/${type}/${id}/shop-reveal`, { method: 'POST' }),
  toggleFlavour: (type, id, index = 0) => request(`/entities/${type}/${id}/flavour`, { method: 'PUT', body: JSON.stringify({ index }) }),
  toggleSecret: (type, id, index = 0) => request(`/entities/${type}/${id}/secret`, { method: 'PUT', body: JSON.stringify({ index }) }),
  toggleDeceased: (type, id) => request(`/entities/${type}/${id}/deceased`, { method: 'PUT' }),

  // Groepen
  listGroups:        ()             => request('/groups'),
  createGroup:       (name)         => request('/groups',                 { method: 'POST',   body: JSON.stringify({ name }) }),
  switchGroup:       (groupId)      => request('/groups/active',          { method: 'PUT',    body: JSON.stringify({ groupId }) }),
  updateGroup:       (id, name)     => request(`/groups/${id}`,           { method: 'PUT',    body: JSON.stringify({ name }) }),
  setGroupPassword:  (id, password) => request(`/groups/${id}/password`,  { method: 'PUT',    body: JSON.stringify({ password }) }),
  // DM-wachtwoord van de eigen campagne (gehasht opgeslagen).
  dmWachtwoordStatus: ()            => request('/dm-wachtwoord'),
  dmWachtwoordZet:   (wachtwoord)   => request('/dm-wachtwoord',          { method: 'PUT',    body: JSON.stringify({ wachtwoord }) }),
  // Aanwezigheid voor deze sessie: we sturen wie er NIET is (zie server).
  setAanwezigheid:   (id, afwezig)  => request(`/groups/${id}/aanwezigheid`, { method: 'PUT',  body: JSON.stringify({ afwezig }) }),
  deleteGroup:       (id)           => request(`/groups/${id}`,           { method: 'DELETE' }),

  // DM Notes
  getNote:   (id)       => request(`/dm/notes/${id}`),
  saveNote:  (id, note) => request(`/dm/notes/${id}`, { method: 'PUT', body: JSON.stringify({ note }) }),

  // Spelersaantekeningen
  getPlayerNotes:  (entityId)       => request(`/player-notes/${entityId}`),
  savePlayerNote:  (entityId, note) => request(`/player-notes/${entityId}`, { method: 'PUT', body: JSON.stringify({ note }) }),

  // Archief
  listArchief: () => request('/archief'),
  getArchief: (id) => request(`/archief/${id}`),
  createArchief: (data) => request('/archief', { method: 'POST', body: JSON.stringify(data) }),
  updateArchief: (id, data) => request(`/archief/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArchief: (id) => request(`/archief/${id}`, { method: 'DELETE' }),
  setArchiefState: (id, state) => request(`/archief/${id}/state`, { method: 'PUT', body: JSON.stringify({ state }) }),
  setArchiefGroupVisibility: (id, state) => request(`/archief/${id}/group-visibility`, { method: 'PUT', body: JSON.stringify({ state }) }),
  saveHiddenLinks: (id, links) => request(`/archief/${id}/hidden-links`, { method: 'PUT', body: JSON.stringify(links) }),
  saveTekst: (id, tekst) => request(`/archief/${id}/tekst`, { method: 'PUT', body: JSON.stringify({ tekst }) }),

  // Files
  uploadFile: async (id, file, naam) => {
    const form = new FormData();
    form.append('file', file);
    if (naam) form.append('naam', naam);
    const res = await fetch(`${BASE}/files/${id}`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload mislukt');
    return res.json();
  },

  // Mediabibliotheek (DM-only)
  listMedia:   ()           => request('/media'),
  renameMedia: (id, naam)   => request(`/media/${id}`, { method: 'PATCH', body: JSON.stringify({ naam }) }),
  deleteMedia: async (id, force = false) => {
    const res = await fetch(`${BASE}/media/${id}${force ? '?force=1' : ''}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) { const e = new Error('in-gebruik'); e.gebruik = body.gebruik || []; e.inUse = true; throw e; }
    if (!res.ok) throw new Error(body.error || 'Verwijderen mislukt');
    return body;
  },
  // Akte-importer (Obsidian → regie-script)
  importAktePreview: (payload) => request('/import/akte/preview', { method: 'POST', body: JSON.stringify(payload) }),
  importAkteApply: async (formData) => {
    const r = await fetch(`${BASE}/import/akte/apply`, { method: 'POST', body: formData, credentials: 'include' });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Import mislukt'); }
    return r.json();
  },
  fileUrl:  (id) => metCampagne(`${BASE}/files/${id}`),
  thumbUrl: (id) => metCampagne(`${BASE}/thumb/${id}`),
  // Portret-/afbeelding-URL voor een record (entiteit óf document): gebruikt het
  // losse imageId als dat gezet is (mediabibliotheek-hergebruik) — entiteiten
  // dragen het in data.imageId, documenten top-level imageId — anders het
  // record-id zelf (oude bestanden staan op /files/{id}). Fallback = backward-compat.
  entityImgId:   (e) => (e?.data?.imageId || e?.imageId || e?.id),
  fileForEntity: (e) => `${BASE}/files/${e?.data?.imageId || e?.imageId || e?.id}`,
  thumbForEntity:(e) => `${BASE}/thumb/${e?.data?.imageId || e?.imageId || e?.id}`,
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),

  // Sessie Log
  createSessieLog: (data) => request('/sessieLog', { method: 'POST', body: JSON.stringify(data) }),
  updateSessieLog: (id, data) => request(`/sessieLog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSessieLog: (id) => request(`/sessieLog/${id}`, { method: 'DELETE' }),
  resetChapterImages: (key) => request(`/sessieLog/chapter/${encodeURIComponent(key)}/reset-images`, { method: 'PUT' }),

  // Klasse-progressie (skill trees)
  progression:        ()          => request('/progression'),
  saveProgression:    (data)      => request('/progression', { method: 'PUT', body: JSON.stringify(data) }),
  resetProgression:   ()          => request('/progression', { method: 'DELETE' }),
  // Help-teksten (DM-aanpasbaar)
  getHelpContent:  ()          => request('/help-content'),
  saveHelpContent: (key, data) => request(`/help-content/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHelpContent:(key)      => request(`/help-content/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  // Meta
  meta: () => request('/meta'),
  saveHoofdstuk:  (key, data)   => request(`/meta/hoofdstuk/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
  saveAkteScript: (key, script) => request(`/meta/akte/${encodeURIComponent(key)}/script`, { method: 'PUT', body: JSON.stringify({ script }) }),
  getSounds:      ()            => request('/sounds'),
  revealSound:    (data)        => request('/sounds/reveal', { method: 'POST', body: JSON.stringify(data) }),
  saveAppMeta: (data) => request('/meta/app', { method: 'PUT', body: JSON.stringify(data) }),
  verhuisInfo: (charId) => request(`/characters/${charId}/verhuis-info`),
  setSpreukTekst: (index, desc) => request(`/bron/spreuk/${encodeURIComponent(index)}`, { method: 'PUT', body: JSON.stringify({ desc }) }),
  saveHerberg: (data) => request('/meta/herberg', { method: 'PUT', body: JSON.stringify(data) }),
  saveRust:    (data) => request('/meta/rust',    { method: 'PUT', body: JSON.stringify(data) }),

  // Kaart
  listMaps:     ()         => request('/map/maps'),
  createMap:    (data)     => request('/map/maps',      { method: 'POST',   body: JSON.stringify(data) }),
  updateMap:    (id, data) => request(`/map/maps/${id}`,{ method: 'PUT',    body: JSON.stringify(data) }),
  deleteMap:    (id)       => request(`/map/maps/${id}`,{ method: 'DELETE' }),
  mapPins: (mapId) => request(`/map/pins?mapId=${encodeURIComponent(mapId || 'grisburgh')}`),
  availableLocations: (mapId) => request(`/map/pins/available-locations?mapId=${encodeURIComponent(mapId || 'grisburgh')}`),
  createMapPin: (data) => request('/map/pins', { method: 'POST', body: JSON.stringify(data) }),
  updateMapPin: (id, data) => request(`/map/pins/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMapPin: (id) => request(`/map/pins/${id}`, { method: 'DELETE' }),
  approveMapPin: (id) => request(`/map/pins/${id}/approve`, { method: 'PUT' }),

  // Dungeon maps
  listDungeons:         ()          => request('/dungeons'),
  createDungeon:        (data)      => request('/dungeons',                 { method: 'POST',   body: JSON.stringify(data) }),
  updateDungeon:        (id, data)  => request(`/dungeons/${id}`,           { method: 'PUT',    body: JSON.stringify(data) }),
  deleteDungeon:        (id)        => request(`/dungeons/${id}`,           { method: 'DELETE' }),
  saveDungeonRooms:     (id, rooms, connections=[]) => request(`/dungeons/${id}/rooms`, { method: 'PUT', body: JSON.stringify({ rooms, connections }) }),
  revealDungeonRoom:    (id, data)  => request(`/dungeons/${id}/reveal`,    { method: 'POST',   body: JSON.stringify(data) }),
  hideDungeonRoom:      (id, data)  => request(`/dungeons/${id}/reveal`,    { method: 'DELETE', body: JSON.stringify(data) }),
  setDungeonPartyAccess:(id, list, completed=[]) => request(`/dungeons/${id}/party-access`, { method: 'PUT', body: JSON.stringify({ partyAccess: list, partyCompleted: completed }) }),
  grantDungeonAccess:   (id, groupId) => request(`/dungeons/${id}/grant-access`, { method: 'POST', body: JSON.stringify({ groupId }) }),

  // Tunnel
  tunnelStart:  ()     => request('/tunnel/start',  { method: 'POST' }),
  tunnelStop:   ()     => request('/tunnel/stop',   { method: 'DELETE' }),
  tunnelStatus: ()     => request('/tunnel/status'),

  // Tafels
  listTables:    ()         => request('/tables'),
  createTable:   (data)     => request('/tables',        { method: 'POST',   body: JSON.stringify(data) }),
  updateTable:   (id, data) => request(`/tables/${id}`,  { method: 'PUT',    body: JSON.stringify(data) }),
  deleteTable:   (id)       => request(`/tables/${id}`,  { method: 'DELETE' }),

  // Monsters
  listMonsters:   ()         => request('/monsters'),
  createMonster:  (data)     => request('/monsters',        { method: 'POST',   body: JSON.stringify(data) }),
  updateMonster:  (id, data) => request(`/monsters/${id}`,  { method: 'PUT',    body: JSON.stringify(data) }),
  deleteMonster:  (id)       => request(`/monsters/${id}`,  { method: 'DELETE' }),

  // Encounters (voorbereide gevechten)
  listEncounters:    ()         => request('/encounters'),
  createEncounter:   (data)     => request('/encounters',        { method: 'POST',   body: JSON.stringify(data) }),
  updateEncounter:   (id, data) => request(`/encounters/${id}`,  { method: 'PUT',    body: JSON.stringify(data) }),
  deleteEncounter:   (id)       => request(`/encounters/${id}`,  { method: 'DELETE' }),
  startEncounter:    (id)       => request(`/encounters/${id}/start`, { method: 'POST' }),
  uploadEncounterBackdrop: async (encId, file) => {
    const fileId = 'enc-backdrop-' + encId;
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`/api/files/${fileId}`, { method: 'POST', body: fd, credentials: 'include' });
    if (!r.ok) throw new Error('Upload mislukt');
    return fileId;
  },

  // SRD Monster Import
  srdSearchMonsters: (q)     => request(`/srd/monsters?q=${encodeURIComponent(q)}`),
  srdGetMonster:     (index) => request(`/srd/monsters/${encodeURIComponent(index)}`),

  // Quests
  listQuests:   (groepId)    => request(`/quests${groepId ? `?groepId=${encodeURIComponent(groepId)}` : ''}`),
  createQuest:  (data)       => request('/quests',       { method: 'POST',   body: JSON.stringify(data) }),
  updateQuest:  (id, data)   => request(`/quests/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteQuest:  (id)         => request(`/quests/${id}`, { method: 'DELETE' }),

  // Groepen
  listGroups:   ()           => request('/groups'),

  // Akte-zichtbaarheid per party
  setChapterVisibility: (groepId, chapterId, visible) =>
    request(`/chapter-visibility/${encodeURIComponent(groepId)}/${encodeURIComponent(chapterId)}`,
      { method: 'PUT', body: JSON.stringify({ visible }) }),

  // Winkel uitverkocht
  getShopUitverkocht:    (shopId)           => request(`/shops/${shopId}/uitverkocht`),
  toggleShopUitverkocht: (shopId, itemNaam) => request(`/shops/${shopId}/uitverkocht`, { method: 'PUT', body: JSON.stringify({ itemNaam }) }),
  getShopBeschikbaar: (shopId)         => request(`/shops/${shopId}/beschikbaar`),
  koopShopItem:       (shopId, data)   => request(`/shops/${shopId}/koop`, { method: 'POST', body: JSON.stringify(data) }),
  getShopVerkoopbaar: (shopId)         => request(`/shops/${shopId}/verkoopbaar`),
  verkoopShopItem:    (shopId, data)   => request(`/shops/${shopId}/verkoop`, { method: 'POST', body: JSON.stringify(data) }),
  getShopLog:         (shopId)         => request(`/shops/${shopId}/log`),
  // DM rekent aan tafel af: verkopen met een zelf getypt bedrag, en inkopen
  // uit de boedel van de party.
  dmVerkoop:          (shopId, data)   => request(`/shops/${shopId}/dm-verkoop`, { method: 'POST', body: JSON.stringify(data) }),
  getPartyBoedel:     (shopId)         => request(`/shops/${shopId}/party-boedel`),
  dmInkoop:           (shopId, data)   => request(`/shops/${shopId}/dm-inkoop`, { method: 'POST', body: JSON.stringify(data) }),
  onderhandelShop:    (shopId, data)   => request(`/shops/${shopId}/onderhandel`, { method: 'POST', body: JSON.stringify(data) }),
  getShopHumeur:      (shopId)         => request(`/shops/${shopId}/humeur`),
  bumpShopHumeur:     (shopId, data)   => request(`/shops/${shopId}/humeur`, { method: 'POST', body: JSON.stringify(data) }),

  // Voorwerpen claimen & ruilen
  getItemOwnership:    ()              => request('/items/ownership'),
  requestItem:         (id, body)      => request(`/items/${id}/request`,              { method: 'POST',   body: JSON.stringify(body) }),
  // Direct aan een medespeler geven (geen goedkeuring van de DM nodig).
  geefItem:            (id, targetId)  => request(`/items/${id}/geef`,                 { method: 'POST',   body: JSON.stringify({ targetId }) }),
  approveItemRequest:  (reqId)         => request(`/items/request/${reqId}/approve`,   { method: 'POST' }),
  rejectItemRequest:   (reqId)         => request(`/items/request/${reqId}/reject`,    { method: 'POST' }),
  removeItemOwner:     (id)            => request(`/items/${id}/owner`,                { method: 'DELETE' }),
  removeStackOwner:    (id, charId)    => request(`/items/${id}/owner?characterId=${encodeURIComponent(charId)}`, { method: 'DELETE' }),
  patchItemOwnerQty:   (id, charId, delta) => request(`/items/${id}/owner/${charId}`, { method: 'PATCH', body: JSON.stringify({ delta }) }),
  patchItemCharges:    (itemId, charId, charges)    => request(`/items/${itemId}/owner/${charId}/charges`,    { method: 'PATCH', body: JSON.stringify({ charges }) }),
  patchItemMaxCharges: (itemId, charId, maxCharges) => request(`/items/${itemId}/owner/${charId}/maxCharges`, { method: 'PATCH', body: JSON.stringify({ maxCharges }) }),
  longRest:            (charId) => request(`/characters/${charId}/long-rest`, { method: 'POST' }),
  partyLongRest:       (data)   => request('/party/long-rest',  { method: 'POST', body: JSON.stringify(data || {}) }),
  partyShortRest:      (data)   => request('/party/short-rest', { method: 'POST', body: JSON.stringify(data || {}) }),
  spendHitDie:         (charId, die) => request(`/characters/${charId}/spend-hit-die`, { method: 'POST', body: JSON.stringify({ die }) }),
  getHitDice:          (charId) => request(`/characters/${charId}/hit-dice`),
  setTradeAllowed:     (allowed)       => request('/items/trade-allowed',              { method: 'PUT',    body: JSON.stringify({ allowed }) }),

  // Speler HP
  getPlayerHp:     (characterId)        => request(`/player-hp/${characterId}`),
  setPlayerHp:     (characterId, data)  => request(`/player-hp/${characterId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  combatPlayerHp:  (combatantId, hp)    => request(`/combat/player-hp/${combatantId}`, { method: 'PATCH', body: JSON.stringify({ hp }) }),

  // Speler losse voorwerpen
  getPlayerItems:   (characterId)          => request(`/player-items/${characterId}`),
  addPlayerItem:    (characterId, data)    => request(`/player-items/${characterId}`,          { method: 'POST',   body: JSON.stringify(data) }),
  removePlayerItem: (characterId, itemId)  => request(`/player-items/${characterId}/${itemId}`, { method: 'DELETE' }),

  // Speler valuta
  getPlayerCurrency:   (characterId)       => request(`/player-currency/${characterId}`),
  patchPlayerCurrency: (characterId, data) => request(`/player-currency/${characterId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Gedeelde beurs
  getPartyCurrency:    ()       => request('/party-currency'),
  patchPartyCurrency:  (data)   => request('/party-currency', { method: 'PATCH', body: JSON.stringify(data) }),
  togglePartyCurrency: ()       => request('/party-currency/toggle', { method: 'PUT' }),

  // Speler spreukenslots
  getPlayerSpellSlots: (characterId)       => request(`/player-spellslots/${characterId}`),
  setPlayerSpellSlots: (characterId, data) => request(`/player-spellslots/${characterId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Speler profiel
  getPlayerProfile:   (characterId)       => request(`/player-profile/${characterId}`),
  patchPlayerProfile: (characterId, data) => request(`/player-profile/${characterId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Party-leden
  getPartyMembers: () => request('/party'),

  // Medestanders
  getCompanions:       ()                   => request('/companions'),
  getCompanionStatus:  (npcId)              => request(`/companions/status/${npcId}`),
  linkCompanion:       (npcId, groupId)     => request(`/companions/${npcId}/${groupId}`, { method: 'POST' }),
  unlinkCompanion:     (npcId, groupId)     => request(`/companions/${npcId}/${groupId}`, { method: 'DELETE' }),

  // Inspiratie
  getAllInspiration:      ()             => request('/player-inspiration'),
  getInspiration:        (charId)       => request(`/player-inspiration/${charId}`),
  giveInspiration:       (charId)       => request(`/player-inspiration/${charId}`, { method: 'PUT' }),
  removeInspiration:     (charId)       => request(`/player-inspiration/${charId}`, { method: 'DELETE' }),

  // Trackers (klasse-/rasvaardig­heden)
  getPlayerTrackers:    (charId)            => request(`/player-trackers/${charId}`),
  addPlayerTracker:     (charId, data)      => request(`/player-trackers/${charId}`, { method: 'POST', body: JSON.stringify(data) }),
  patchPlayerTracker:   (charId, tid, data) => request(`/player-trackers/${charId}/${tid}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePlayerTracker:  (charId, tid)       => request(`/player-trackers/${charId}/${tid}`, { method: 'DELETE' }),

  // Vastgezette spreuken
  getPlayerSpells:    (charId)             => request(`/player-spells/${charId}`),
  addPlayerSpell:     (charId, data)       => request(`/player-spells/${charId}`, { method: 'POST', body: JSON.stringify(data) }),
  removePlayerSpell:  (charId, spellIdx)   => request(`/player-spells/${charId}/${spellIdx}`, { method: 'DELETE' }),
  updatePlayerSpell:  (charId, spellIdx, data) => request(`/player-spells/${charId}/${spellIdx}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Vastgezette kenmerken
  ontdekkingen:       ()                   => request('/ontdekkingen'),
  bestiarium:         ()                   => request('/bestiarium'),
  setBestiarium:      (monsterId, niveau, groep) => request(`/bestiarium/${monsterId}`, { method: 'PUT', body: JSON.stringify({ niveau, groep }) }),
  getPlayerTraits:    (charId)             => request(`/player-traits/${charId}`),
  addPlayerTrait:     (charId, data)       => request(`/player-traits/${charId}`, { method: 'POST', body: JSON.stringify(data) }),
  patchPlayerTrait:   (charId, traitId, data) => request(`/player-traits/${charId}/${traitId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePlayerTrait:  (charId, traitId)    => request(`/player-traits/${charId}/${traitId}`, { method: 'DELETE' }),

  // Undo: herstel verwijderde entiteit
  restoreEntity: (id) => request(`/entities/restore/${id}`, { method: 'POST' }),

  // DM geeft voorwerp aan speler
  assignItemOwner: (itemId, data) => request(`/items/${itemId}/owner`, { method: 'PUT', body: JSON.stringify(data) }),
  getGroups: () => request('/groups'),

  // Campagnes
  getCampaigns:      ()          => request('/campaigns'),
  createCampaign:    (id, meta, dmPassword) => request('/campaigns', { method: 'POST', body: JSON.stringify({ id, meta, dmPassword }) }),
  switchCampaign:    (id)        => request('/campaigns/active', { method: 'PUT',  body: JSON.stringify({ id }) }),
  setCampaignDmPw:   (id, wachtwoord) => request(`/campaigns/${id}/dm-wachtwoord`, { method: 'PUT', body: JSON.stringify({ wachtwoord }) }),
  setCampaignModules:(id, modules) => request(`/campaigns/${id}/modules`, { method: 'PUT', body: JSON.stringify({ modules }) }),
  getCampaignMeta:   ()          => request('/campaigns/meta'),

  // Gevecht
  getCombat:        ()        => request('/combat'),
  startCombat:      ()        => request('/combat/start',              { method: 'POST' }),
  endCombat:        ()        => request('/combat',                    { method: 'DELETE' }),
  // Sluit het rust-cinematic bij iedereen (DM-actie; de tablet kan zichzelf niet sluiten).
  closeRest:        ()        => request('/party/rest/close',          { method: 'POST', body: '{}' }),
  updateCombat:     (data)    => request('/combat',                    { method: 'PUT',    body: JSON.stringify(data) }),
  addCombatant:     (data)    => request('/combat/combatant',          { method: 'POST',   body: JSON.stringify(data) }),
  voegMetgezellen:  ()        => request('/combat/voeg-metgezellen',   { method: 'POST' }),
  updateCombatant:  (id, d)   => request(`/combat/combatant/${id}`,    { method: 'PUT',    body: JSON.stringify(d) }),
  removeCombatant:  (id)      => request(`/combat/combatant/${id}`,    { method: 'DELETE' }),
  setCombatWinner:  (winner)  => request('/combat/winner',             { method: 'PUT',    body: JSON.stringify({ winner }) }),
  lootStart:        (encounterId) => request('/combat/loot/start',      { method: 'POST',   body: JSON.stringify({ encounterId }) }),
  getLoot:          ()        => request('/combat/loot'),
  lootUpdate:       (data)    => request('/combat/loot',                { method: 'PUT',    body: JSON.stringify(data) }),
  lootReveal:       ()        => request('/combat/loot/reveal',         { method: 'POST' }),
  lootClaim:        (itemId)  => request('/combat/loot/claim',          { method: 'POST',   body: JSON.stringify({ itemId }) }),
  lootVerdeeld:     ()        => request('/combat/loot/verdeeld',       { method: 'POST' }),
  lootCancel:       ()        => request('/combat/loot',                { method: 'DELETE' }),
  // Loot-events: de bibliotheek van vondsten die een lootfase kan vullen.
  // Per akte: wat is er níét bereikbaar (diensten + winkels).
  // Verhaaltekst per akte + de namen die eruit volgen.
  saveAkteTekst:  (key, tekst) => request(`/meta/akte/${encodeURIComponent(key)}/tekst`, { method: 'PUT', body: JSON.stringify({ tekst }) }),
  akteNamen:      (key)        => request(`/meta/akte/${encodeURIComponent(key)}/namen`),
  saveAkteBereikbaarheid: (key, data) => request(`/meta/akte/${encodeURIComponent(key)}/bereikbaarheid`, { method: 'PUT', body: JSON.stringify(data) }),
  lootEvents:       ()        => request('/loot/events'),
  lootEventCreate:  (data)    => request('/loot/events',                { method: 'POST',   body: JSON.stringify(data) }),
  lootEventUpdate:  (id, d)   => request(`/loot/events/${id}`,          { method: 'PUT',    body: JSON.stringify(d) }),
  lootEventDelete:  (id)      => request(`/loot/events/${id}`,          { method: 'DELETE' }),
  lootEventKopie:   (id, d={})=> request(`/loot/events/${id}/kopie`,    { method: 'POST',   body: JSON.stringify(d) }),
  lootVerdeling:    (ids)     => request('/loot/verdeling',             { method: 'POST',   body: JSON.stringify({ eventIds: ids }) }),

  // Berichten
  getBerichten:        ()                   => request('/berichten'),
  sendBericht:         (data)               => request('/berichten',                         { method: 'POST',  body: JSON.stringify(data) }),
  markBerichtGelezen:  (characterId, msgId) => request(`/berichten/${characterId}/${msgId}/gelezen`, { method: 'PUT' }),
  deleteBericht:       (characterId, msgId) => request(`/berichten/${characterId}/${msgId}`,         { method: 'DELETE' }),
  getSjablonen:        ()                   => request('/berichten/sjablonen'),
  saveSjablonen:       (sjablonen)          => request('/berichten/sjablonen',                { method: 'PUT',   body: JSON.stringify({ sjablonen }) }),

  // Brieven (DM → speler/party, rijker format dan berichten)
  sendPost:   (data)               => request('/post',                              { method: 'POST',   body: JSON.stringify(data) }),
  deletePost: (characterId, postId) => request(`/post/${characterId}/${postId}`,   { method: 'DELETE' }),

  // Madame Ursula
  getUrsula:           ()             => request('/ursula'),
  ursulaVoorspel:      ()             => request('/ursula/voorspel', { method: 'POST' }),
  saveUrsulaConfig:    (data)         => request('/meta/ursula',     { method: 'PUT',  body: JSON.stringify(data) }),
  ursulaAktes:         ()             => request('/ursula/aktes'),
  saveUrsulaVoorspelling: (key, data) => request(`/ursula/voorspelling/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(data) }),
  ursulaReset:         (akteKey)      => request('/ursula/reset',    { method: 'POST', body: JSON.stringify({ akteKey }) }),
  setActiveAkte:       (key, num, title, groupId) => request('/akte/actief',  { method: 'POST', body: JSON.stringify({ key, num, title, groupId }) }),
  // Regie-voortgang: welke script-stappen van deze akte zijn al gedaan (per groep).
  getAkteVoortgang:    (key, groupId) => request(`/akte/${encodeURIComponent(key)}/voortgang${groupId ? `?groupId=${encodeURIComponent(groupId)}` : ''}`),
  saveAkteVoortgang:   (key, stappen, groupId) => request(`/akte/${encodeURIComponent(key)}/voortgang`, { method: 'PUT', body: JSON.stringify({ stappen, groupId }) }),
  // Akte pauzeren (legt het moment vast) en hervatten (past per personage toe).
  pauzeerAkte:         (key, groupId) => request(`/akte/${encodeURIComponent(key)}/pauze`,  { method: 'POST', body: JSON.stringify({ groupId }) }),
  hervatAkte:          (key, toepassen, groupId) => request(`/akte/${encodeURIComponent(key)}/hervat`, { method: 'POST', body: JSON.stringify({ toepassen, groupId }) }),
  // Onthul één sessieLog-afbeelding voor één groep (i.p.v. de oude globale vlag).
  // Sfeer van het tafelscherm (bewaard bij de akte) en eenmalige effecten.
  setAkteSfeer:        (key, sfeer) => request(`/akte/${encodeURIComponent(key)}/sfeer`, { method: 'PUT', body: JSON.stringify({ sfeer }) }),
  displayEffect:       (effect) => request('/display/effect', { method: 'POST', body: JSON.stringify({ effect }) }),
  onthulAfbeelding:    (sessieId, fileId, caption, groupId) =>
    request(`/sessieLog/${encodeURIComponent(sessieId)}/onthul`, { method: 'POST', body: JSON.stringify({ fileId, caption, groupId }) }),
  setGockGeheim:     (type, id, tekst) => request(`/entities/${type}/${id}/gock-geheim`,   { method: 'PUT',  body: JSON.stringify({ tekst }) }),

  // De Gock
  getGock:         ()              => request('/gock'),
  gockOpdracht:    (data)          => request('/gock/opdracht',   { method: 'POST', body: JSON.stringify(data) }),
  gockOpgehaald:   ()              => request('/gock/opgehaald', { method: 'PUT' }),
  saveGockConfig:  (data)          => request('/meta/gock',      { method: 'PUT',  body: JSON.stringify(data) }),
  getMagizoo:        ()            => request('/magizoo'),
  magizooOnderzoek:  (data)        => request('/magizoo/onderzoek', { method: 'POST', body: JSON.stringify(data) }),
  adopteerPet:       (petId, naam) => request('/magizoo/adopteer', { method: 'POST', body: JSON.stringify({ petId, naam }) }),
  getPetStatblock:   (petId)       => request(`/companions/pet/${petId}/statblock`),
  saveMagizooConfig: (data)        => request('/meta/magizoo',    { method: 'PUT',  body: JSON.stringify(data) }),

// De Tempel
  getTempel:        ()              => request('/tempel'),
  tempelZegen:      (data)          => request('/tempel/zegen',  { method: 'POST', body: JSON.stringify(data) }),
  tempelVerbruik:   ()              => request('/tempel/verbruik', { method: 'POST' }),
  tempelEed:        (data)          => request('/tempel/eed',    { method: 'POST', body: JSON.stringify(data) }),
  tempelBoete:      ()              => request('/tempel/boete',  { method: 'POST' }),
  tempelEden:       ()              => request('/tempel/eden'),
  tempelEedVerbreek:(characterId)   => request('/tempel/eed/verbreek', { method: 'POST', body: JSON.stringify({ characterId }) }),
  tempelEedHef:     (characterId)   => request('/tempel/eed/hef',      { method: 'POST', body: JSON.stringify({ characterId }) }),
  saveTempelConfig: (data)          => request('/meta/tempel',   { method: 'PUT',  body: JSON.stringify(data) }),
  // De Heeren van de Nacht (dievengilde)
  getHeeren:          ()           => request('/heeren'),
  heerenGenereer:     ()           => request('/heeren/genereer',            { method: 'POST' }),
  heerenAanneem:      (id)         => request(`/heeren/job/${id}/aanneem`,   { method: 'POST' }),
  heerenUitslag:      (id, uitkomst) => request(`/heeren/job/${id}/uitslag`, { method: 'POST', body: JSON.stringify({ uitkomst }) }),
  heerenSetRang:      (rang)       => request('/heeren/rang',                { method: 'POST', body: JSON.stringify({ rang }) }),
  heerenBetaalBoete:  (boeteId)    => request(`/heeren/boete/${boeteId}/betaal`,   { method: 'POST' }),
  heerenAdvocaat:     (boeteId)    => request(`/heeren/boete/${boeteId}/advocaat`, { method: 'POST' }),
  heerenKwijt:        (characterId, boeteId) => request('/heeren/kwijt',      { method: 'POST', body: JSON.stringify({ characterId, boeteId }) }),
  saveHeerenConfig:   (data)       => request('/meta/heeren',                { method: 'PUT',  body: JSON.stringify(data) }),

  // Facties & Aanzien (organisaties met rangspoor)
  getFacties:         ()              => request('/facties'),
  factieSetRang:      (id, rang)      => request(`/facties/${id}/rang`,   { method: 'POST', body: JSON.stringify({ rang }) }),
  factieReveal:       (id)            => request(`/facties/${id}/reveal`,  { method: 'POST' }),
  factieUitnodiging:  (id)            => request(`/facties/${id}/uitnodiging`, { method: 'POST' }),
  factieRenown:       (id, delta)     => request(`/facties/${id}/renown`,  { method: 'POST', body: JSON.stringify({ delta }) }),
  saveFactiesConfig:  (facties)       => request('/meta/facties',          { method: 'PUT',  body: JSON.stringify({ facties }) }),
  // Missies
  getMissies:           ()            => request('/missies'),
  createMissie:         (data)        => request('/missies',                 { method: 'POST',   body: JSON.stringify(data) }),
  updateMissie:         (id, data)    => request(`/missies/${id}`,           { method: 'PUT',    body: JSON.stringify(data) }),
  missieAccepteer:      (id)          => request(`/quests/${id}/accepteer`,  { method: 'POST' }),
  missieGoedkeuren:     (id)          => request(`/missies/${id}/goedkeuren`,{ method: 'POST' }),
  missieVoltooien:      (id)          => request(`/missies/${id}/voltooien`, { method: 'POST' }),
  missieFalen:          (id)          => request(`/missies/${id}/falen`,     { method: 'POST' }),

  // Locatie (Grisburgh verlaten)
  setLocatie:              (data)     => request('/locatie',          { method: 'PUT', body: JSON.stringify(data) }),
  toggleLocatieEntiteit:   (entityId) => request('/locatie/entiteit', { method: 'PUT', body: JSON.stringify({ entityId }) }),

  // Tweespalt / Gokkantoor
  saveTweespaltConfig:   (data)          => request('/meta/tweespalt',                        { method: 'PUT',    body: JSON.stringify(data) }),
  getDienstenToegang: ()                   => request('/diensten/toegang'),
  setDienstToegang:   (groepId, dienst, staat) => request('/diensten/toegang', { method: 'PUT', body: JSON.stringify({ groepId, dienst, staat }) }),
  dienstUitnodiging:  (dienst)        => request(`/diensten/${dienst}/uitnodiging`, { method: 'POST' }),
  getDienstUitnodiging:  (dienst)       => request(`/diensten/${dienst}/uitnodiging-tekst`),
  saveDienstUitnodiging: (dienst, data) => request(`/diensten/${dienst}/uitnodiging-tekst`, { method: 'PUT', body: JSON.stringify(data) }),
  getTweespalt:          ()              => request('/tweespalt'),
  createTweespaltEvent:  (data)          => request('/tweespalt/events',                    { method: 'POST',   body: JSON.stringify(data) }),
  updateTweespaltEvent:  (id, data)      => request(`/tweespalt/events/${id}`,              { method: 'PUT',    body: JSON.stringify(data) }),
  deleteTweespaltEvent:  (id)            => request(`/tweespalt/events/${id}`,              { method: 'DELETE' }),
  weddenTweespalt:       (id, data)      => request(`/tweespalt/events/${id}/wedden`,       { method: 'POST',   body: JSON.stringify(data) }),
  uitslagTweespalt:      (id, data)      => request(`/tweespalt/events/${id}/uitslag`,      { method: 'POST',   body: JSON.stringify(data || {}) }),
  leenTweespalt:         (bedrag)        => request('/tweespalt/leen',                      { method: 'POST',   body: JSON.stringify({ bedrag }) }),
  getTweespaltLog:       ()              => request('/tweespalt/log'),
  // Relations
  getRelations:          ()          => request('/relations'),
  addRelationEdge:       (data)      => request('/relations/edges',       { method: 'POST',   body: JSON.stringify(data) }),
  updateRelationEdge:    (id, data)  => request(`/relations/edges/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteRelationEdge:    (id)        => request(`/relations/edges/${id}`, { method: 'DELETE' }),
  saveRelationPositions: (positions) => request('/relations/positions',   { method: 'PUT',    body: JSON.stringify({ positions }) }),

  // Generieke helper-methoden
  get:    (path)        => request(path),
  post:   (path, body)  => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)  => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)        => request(path, { method: 'DELETE' }),

  // Get all entity names grouped by type (for link autocomplete)
  async allNames() {
    const types = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
    const result = {};
    await Promise.all(types.map(async t => {
      try {
        const list = await request(`/entities/${t}`);
        result[t] = list.map(e => e.name);
      } catch { result[t] = []; }
    }));
    try {
      const archief = await request('/archief');
      result.archief = (archief.documents || []).map(d => d.name);
    } catch { result.archief = []; }
    return result;
  },
};
