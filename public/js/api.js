// Fetch wrapper for all API calls
const BASE = '/api';

async function request(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Auth
  login:             (password)     => request('/auth/login',         { method: 'POST', body: JSON.stringify({ password }) }),
  logout:            ()             => request('/auth/logout',        { method: 'POST' }),
  role:              ()             => request('/auth/role'),
  listPlayerChars:   ()             => request('/auth/players'),
  playerLogin:       (characterId)  => request('/auth/player-login',  { method: 'POST', body: JSON.stringify({ characterId }) }),
  playerLogout:      ()             => request('/auth/player-logout', { method: 'POST' }),

  // Entities
  listEntities: (type) => request(`/entities/${type}`),
  getEntity: (type, id) => request(`/entities/${type}/${id}`),
  createEntity: (type, data) => request(`/entities/${type}`, { method: 'POST', body: JSON.stringify(data) }),
  updateEntity: (type, id, data) => request(`/entities/${type}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEntity: (type, id) => request(`/entities/${type}/${id}`, { method: 'DELETE' }),
  toggleVisibility: (type, id, target) => request(`/entities/${type}/${id}/visibility`, { method: 'PUT', body: JSON.stringify(target ? { target } : {}) }),
  shopRevealItem:   (type, id)          => request(`/entities/${type}/${id}/shop-reveal`, { method: 'POST' }),
  toggleSecret: (type, id) => request(`/entities/${type}/${id}/secret`, { method: 'PUT' }),
  toggleDeceased: (type, id) => request(`/entities/${type}/${id}/deceased`, { method: 'PUT' }),

  // Groepen
  listGroups:   ()           => request('/groups'),
  createGroup:  (name)       => request('/groups',        { method: 'POST',   body: JSON.stringify({ name }) }),
  switchGroup:  (groupId)    => request('/groups/active', { method: 'PUT',    body: JSON.stringify({ groupId }) }),
  updateGroup:  (id, name)   => request(`/groups/${id}`,  { method: 'PUT',    body: JSON.stringify({ name }) }),
  deleteGroup:  (id)         => request(`/groups/${id}`,  { method: 'DELETE' }),

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
  saveHiddenLinks: (id, links) => request(`/archief/${id}/hidden-links`, { method: 'PUT', body: JSON.stringify(links) }),
  saveTekst: (id, tekst) => request(`/archief/${id}/tekst`, { method: 'PUT', body: JSON.stringify({ tekst }) }),

  // Files
  uploadFile: async (id, file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/files/${id}`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload mislukt');
    return res.json();
  },
  fileUrl:  (id) => `${BASE}/files/${id}`,
  thumbUrl: (id) => `${BASE}/thumb/${id}`,
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),

  // Sessie Log
  createSessieLog: (data) => request('/sessieLog', { method: 'POST', body: JSON.stringify(data) }),
  updateSessieLog: (id, data) => request(`/sessieLog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSessieLog: (id) => request(`/sessieLog/${id}`, { method: 'DELETE' }),

  // Meta
  meta: () => request('/meta'),
  saveHoofdstuk: (key, data) => request(`/meta/hoofdstuk/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
  saveAppMeta: (data) => request('/meta/app', { method: 'PUT', body: JSON.stringify(data) }),
  saveHerberg: (data) => request('/meta/herberg', { method: 'PUT', body: JSON.stringify(data) }),

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
  getShopLog:         (shopId)         => request(`/shops/${shopId}/log`),
  onderhandelShop:    (shopId, data)   => request(`/shops/${shopId}/onderhandel`, { method: 'POST', body: JSON.stringify(data) }),

  // Voorwerpen claimen & ruilen
  getItemOwnership:    ()              => request('/items/ownership'),
  requestItem:         (id, body)      => request(`/items/${id}/request`,              { method: 'POST',   body: JSON.stringify(body) }),
  approveItemRequest:  (reqId)         => request(`/items/request/${reqId}/approve`,   { method: 'POST' }),
  rejectItemRequest:   (reqId)         => request(`/items/request/${reqId}/reject`,    { method: 'POST' }),
  removeItemOwner:     (id)            => request(`/items/${id}/owner`,                { method: 'DELETE' }),
  removeStackOwner:    (id, charId)    => request(`/items/${id}/owner?characterId=${encodeURIComponent(charId)}`, { method: 'DELETE' }),
  patchItemOwnerQty:   (id, charId, delta) => request(`/items/${id}/owner/${charId}`, { method: 'PATCH', body: JSON.stringify({ delta }) }),
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

  // Vastgezette kenmerken
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
  createCampaign:    (id, meta)  => request('/campaigns',        { method: 'POST', body: JSON.stringify({ id, meta }) }),
  switchCampaign:    (id)        => request('/campaigns/active', { method: 'PUT',  body: JSON.stringify({ id }) }),
  getCampaignMeta:   ()          => request('/campaigns/meta'),

  // Gevecht
  getCombat:        ()        => request('/combat'),
  startCombat:      ()        => request('/combat/start',              { method: 'POST' }),
  endCombat:        ()        => request('/combat',                    { method: 'DELETE' }),
  updateCombat:     (data)    => request('/combat',                    { method: 'PUT',    body: JSON.stringify(data) }),
  addCombatant:     (data)    => request('/combat/combatant',          { method: 'POST',   body: JSON.stringify(data) }),
  updateCombatant:  (id, d)   => request(`/combat/combatant/${id}`,    { method: 'PUT',    body: JSON.stringify(d) }),
  removeCombatant:  (id)      => request(`/combat/combatant/${id}`,    { method: 'DELETE' }),
  setCombatWinner:  (winner)  => request('/combat/winner',             { method: 'PUT',    body: JSON.stringify({ winner }) }),

  // Berichten
  getBerichten:        ()                   => request('/berichten'),
  sendBericht:         (data)               => request('/berichten',                         { method: 'POST',  body: JSON.stringify(data) }),
  markBerichtGelezen:  (characterId, msgId) => request(`/berichten/${characterId}/${msgId}/gelezen`, { method: 'PUT' }),
  deleteBericht:       (characterId, msgId) => request(`/berichten/${characterId}/${msgId}`,         { method: 'DELETE' }),
  getSjablonen:        ()                   => request('/berichten/sjablonen'),
  saveSjablonen:       (sjablonen)          => request('/berichten/sjablonen',                { method: 'PUT',   body: JSON.stringify({ sjablonen }) }),

  // Madame Ursula
  getUrsula:       ()              => request('/ursula'),
  ursulaVraag:     (data)          => request('/ursula/vraag',  { method: 'POST', body: JSON.stringify(data) }),
  saveUrsulaConfig:  (data)          => request('/meta/ursula',                            { method: 'PUT',  body: JSON.stringify(data) }),
  setUrsulaGeheim:   (type, id, tekst) => request(`/entities/${type}/${id}/ursula-geheim`, { method: 'PUT',  body: JSON.stringify({ tekst }) }),
  setGockGeheim:     (type, id, tekst) => request(`/entities/${type}/${id}/gock-geheim`,   { method: 'PUT',  body: JSON.stringify({ tekst }) }),

  // De Gock
  getGock:         ()              => request('/gock'),
  gockOpdracht:    (data)          => request('/gock/opdracht',   { method: 'POST', body: JSON.stringify(data) }),
  gockOpgehaald:   ()              => request('/gock/opgehaald', { method: 'PUT' }),
  saveGockConfig:  (data)          => request('/meta/gock',      { method: 'PUT',  body: JSON.stringify(data) }),

  // Tweespalt / Gokkantoor
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
