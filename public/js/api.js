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
  login: (password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  role: () => request('/auth/role'),

  // Entities
  listEntities: (type) => request(`/entities/${type}`),
  getEntity: (type, id) => request(`/entities/${type}/${id}`),
  createEntity: (type, data) => request(`/entities/${type}`, { method: 'POST', body: JSON.stringify(data) }),
  updateEntity: (type, id, data) => request(`/entities/${type}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEntity: (type, id) => request(`/entities/${type}/${id}`, { method: 'DELETE' }),
  toggleVisibility: (type, id, target) => request(`/entities/${type}/${id}/visibility`, { method: 'PUT', body: JSON.stringify(target ? { target } : {}) }),
  toggleSecret: (type, id) => request(`/entities/${type}/${id}/secret`, { method: 'PUT' }),
  toggleDeceased: (type, id) => request(`/entities/${type}/${id}/deceased`, { method: 'PUT' }),

  // Groepen
  listGroups:   ()           => request('/groups'),
  createGroup:  (name)       => request('/groups',        { method: 'POST',   body: JSON.stringify({ name }) }),
  switchGroup:  (groupId)    => request('/groups/active', { method: 'PUT',    body: JSON.stringify({ groupId }) }),
  updateGroup:  (id, name)   => request(`/groups/${id}`,  { method: 'PUT',    body: JSON.stringify({ name }) }),
  deleteGroup:  (id)         => request(`/groups/${id}`,  { method: 'DELETE' }),

  // DM Notes
  getNote: (id) => request(`/dm/notes/${id}`),
  saveNote: (id, note) => request(`/dm/notes/${id}`, { method: 'PUT', body: JSON.stringify({ note }) }),

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
  fileUrl: (id) => `${BASE}/files/${id}`,
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),

  // Sessie Log
  createSessieLog: (data) => request('/sessieLog', { method: 'POST', body: JSON.stringify(data) }),
  updateSessieLog: (id, data) => request(`/sessieLog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSessieLog: (id) => request(`/sessieLog/${id}`, { method: 'DELETE' }),

  // Meta
  meta: () => request('/meta'),
  saveHoofdstuk: (key, data) => request(`/meta/hoofdstuk/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
  saveAppMeta: (data) => request('/meta/app', { method: 'PUT', body: JSON.stringify(data) }),

  // Kaart
  mapPins: (mapId) => request(`/map/pins?mapId=${encodeURIComponent(mapId || 'grisburgh')}`),
  createMapPin: (data) => request('/map/pins', { method: 'POST', body: JSON.stringify(data) }),
  updateMapPin: (id, data) => request(`/map/pins/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMapPin: (id) => request(`/map/pins/${id}`, { method: 'DELETE' }),

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

  // Gevecht
  getCombat:        ()        => request('/combat'),
  startCombat:      ()        => request('/combat/start',              { method: 'POST' }),
  endCombat:        ()        => request('/combat',                    { method: 'DELETE' }),
  updateCombat:     (data)    => request('/combat',                    { method: 'PUT',    body: JSON.stringify(data) }),
  addCombatant:     (data)    => request('/combat/combatant',          { method: 'POST',   body: JSON.stringify(data) }),
  updateCombatant:  (id, d)   => request(`/combat/combatant/${id}`,    { method: 'PUT',    body: JSON.stringify(d) }),
  removeCombatant:  (id)      => request(`/combat/combatant/${id}`,    { method: 'DELETE' }),
  setCombatWinner:  (winner)  => request('/combat/winner',             { method: 'PUT',    body: JSON.stringify({ winner }) }),

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
