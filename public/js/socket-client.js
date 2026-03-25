const ENTITY_ICONS = { personages: '👤', locaties: '🏰', organisaties: '🏛️', voorwerpen: '⚔️' };

export function initSocket() {
  const socket = io();
  window._socket = socket;  // Exposed so players can emit sound:emote events

  const ENTITY_SECTIONS = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

  socket.on('entity:updated', () => {
    const section = window.app.state.activeSection;
    if (ENTITY_SECTIONS.includes(section)) {
      import('./render-campagne.js').then(m => {
        if (section === 'personages') m.renderPersonages();
        else if (section === 'locaties') m.renderLocaties();
        else if (section === 'organisaties') m.renderOrganisaties();
        else if (section === 'voorwerpen') m.renderVoorwerpen();
      });
    } else if (section === 'dashboard') {
      import('./render-dashboard.js').then(m => m.renderDashboard());
    }
  });

  socket.on('entity:visibility', ({ id, type, name, visibility } = {}) => {
    const section = window.app.state.activeSection;
    if (ENTITY_SECTIONS.includes(section)) {
      import('./render-campagne.js').then(m => {
        if (section === 'personages') m.renderPersonages();
        else if (section === 'locaties') m.renderLocaties();
        else if (section === 'organisaties') m.renderOrganisaties();
        else if (section === 'voorwerpen') m.renderVoorwerpen();
      });
    } else if (section === 'dashboard') {
      import('./render-dashboard.js').then(m => m.renderDashboard());
    }
    // Toast voor spelers bij onthulling
    if (!window.app.isDM() && visibility && visibility !== 'hidden' && name) {
      const icon  = ENTITY_ICONS[type] || '📜';
      const label = visibility === 'vague' ? 'is ontdekt' : 'is onthuld';
      _showToast(`${icon} <strong>${name}</strong> ${label}`, () => {
        if (type && id) window._openDetail?.(type, id);
      });
    }
  });

  socket.on('entity:secret', ({ id, type, name, secretReveal } = {}) => {
    const section = window.app.state.activeSection;
    if (ENTITY_SECTIONS.includes(section)) {
      import('./render-campagne.js').then(m => {
        if (section === 'personages') m.renderPersonages();
        else if (section === 'locaties') m.renderLocaties();
        else if (section === 'organisaties') m.renderOrganisaties();
        else if (section === 'voorwerpen') m.renderVoorwerpen();
      });
    }
    // Melding voor spelers bij onthulling van een geheimenis
    if (!window.app?.isDM?.() && secretReveal && name) {
      _showToast(`🔓 Geheim van <strong>${name}</strong> onthuld`, () => {
        if (type && id) window._openDetail?.(type, id);
      });
    }
  });

  socket.on('archief:updated', () => {
    const section = window.app.state.activeSection;
    if (section === 'documenten') {
      import('./render-archief.js').then(m => m.renderDocumenten());
    } else if (section === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
  });

  socket.on('archief:stateChanged', ({ name, state } = {}) => {
    const section = window.app.state.activeSection;
    if (section === 'documenten') {
      import('./render-archief.js').then(m => m.renderDocumenten());
    } else if (section === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
    if (!window.app.isDM() && state === 'revealed' && name) {
      _showToast(`📜 <strong>${name}</strong> is onthuld`, () => {
        window.app.switchSection('documenten');
      });
    }
  });

  socket.on('logboek:updated', () => {
    if (window.app.state.activeSection === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
  });

  socket.on('logboek:imageRevealed', ({ imageId, caption, samenvatting } = {}) => {
    if (window.app.state.activeSection === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
    if (!window.app.isDM()) {
      if (imageId) {
        window.app.openLightbox(`/api/files/${imageId}`, caption || samenvatting || '');
      } else {
        const label = caption || samenvatting || 'Logboek';
        _showToast(`🖼️ <strong>${label}</strong> — nieuwe afbeelding onthuld`, () => {
          window.app.switchSection('logboek');
        });
      }
    }
  });

  socket.on('map:updated', () => {
    if (window.app.state.activeSection === 'kaart') {
      import('./render-kaart.js').then(m => m.renderKaart());
    }
  });

  socket.on('map:pinRevealed', () => {
    // Herlaad kaart als de speler daar is (toast wordt al getoond via entity:visibility)
    if (window.app.state.activeSection === 'kaart') {
      import('./render-kaart.js').then(m => m.renderKaart());
    }
  });

  socket.on('meta:updated', () => {
    import('./api.js').then(({ api }) => api.meta().then(m => {
      if (window.app?.state) window.app.state.meta = m;
      window.app?.applyAppMeta(m);
      // Refresh hoofdstuk-dropdown in reveal strip (chapters may have changed)
      window.dmPanel?.renderRevealStrip?.();
    }));
  });

  socket.on('entity:deceased', ({ id, type, name } = {}) => {
    // Herlaad de huidige sectie zodat het kaartje meteen grijs wordt
    const section = window.app.state.activeSection;
    if (ENTITY_SECTIONS.includes(section)) {
      import('./render-campagne.js').then(m => {
        if (section === 'personages') m.renderPersonages();
        else if (section === 'locaties') m.renderLocaties();
        else if (section === 'organisaties') m.renderOrganisaties();
        else if (section === 'voorwerpen') m.renderVoorwerpen();
      });
    }
    // Toast voor spelers
    if (!window.app.isDM() && name) {
      _showToast(`🕯️ <strong>${name}</strong> is overleden`, () => {
        if (type && id) window._openDetail?.(type, id);
      }, 8000);
    }
  });

  // ── Groepswisseling ──
  socket.on('groups:updated', ({ groups, activeGroup } = {}) => {
    // Update groepswisselaar UI (DM) en actieve groep state (iedereen)
    window.renderGroupSwitcher?.(groups, activeGroup);
    // Herlaad party bar zodat juiste spelers getoond worden
    window.renderParty?.();
    // Herlaad huidige sectie zodat zichtbaarheidsstatus klopt na groepswisseling
    const section = window.app.state.activeSection;
    if (['personages', 'locaties', 'organisaties', 'voorwerpen'].includes(section)) {
      import('./render-campagne.js').then(m => {
        if (section === 'personages') m.renderPersonages();
        else if (section === 'locaties') m.renderLocaties();
        else if (section === 'organisaties') m.renderOrganisaties();
        else if (section === 'voorwerpen') m.renderVoorwerpen();
      });
    }
  });

  // ── Tunnel ──
  socket.on('tunnel:url', ({ url } = {}) => {
    if (window.dmPanel) {
      window._dmPanelTunnelUrl = url;
      window._dmPanelTunnelActive = true;
      window.dmPanel.onTunnelUrl(url);
    }
  });

  socket.on('tunnel:stopped', () => {
    if (window.dmPanel) window.dmPanel.onTunnelStopped();
  });

  // ── Gevecht ──
  socket.on('combat:updated', (combat) => {
    if (window.dmPanel) window.dmPanel.onCombatUpdated(combat);
    window.soundManager?.onCombatUpdated(combat);
    // Herlaad spelersdashboard als dat actief is (HP-balk bijwerken)
    if (window.app?.state?.activeSection === 'mijn-karakter') {
      import('./app.js').catch(() => {});  // module is al geladen; alleen dashboard herrenderen
      window.app?.refreshSection('mijn-karakter');
    }
  });

  // ── Geluiden ──
  socket.on('sound:emote', (data) => {
    window.soundManager?.playEmote(data);
  });

  socket.on('player:hp-updated', ({ characterId } = {}) => {
    // Herlaad dashboard als dit de eigen speler is
    if (window.app?.state?.characterId === characterId &&
        window.app?.state?.activeSection === 'mijn-karakter') {
      window.app.refreshSection('mijn-karakter');
    }
  });

  // ── Voorwerpen eigendom ──
  socket.on('items:ownership-updated', (data) => {
    import('./render-campagne.js').then(m => {
      if (data) m.setOwnership?.(data);
      if (window.app?.state?.activeSection === 'voorwerpen') m.renderVoorwerpen();
    });
    // Ververs het spelerdashboard als dat actief is (geclaimde voorwerpen bijwerken)
    if (window.app?.state?.activeSection === 'mijn-karakter') {
      window.app.refreshSection('mijn-karakter');
    }
    // Toast voor de speler wiens item is teruggenomen
    if (!window.app.isDM() && data?.takenBack) {
      const myCharId = window.app?.state?.characterId;
      if (myCharId && data.takenBack.characterId === myCharId) {
        _showToast(`📦 <strong>${data.takenBack.itemName}</strong> is teruggenomen door de DM`);
      }
    }
  });

  socket.on('items:request', (data) => {
    import('./render-campagne.js').then(m => {
      if (data) m.setOwnership?.(data);
      // DM: toast met het verzoek
      if (window.app.isDM() && data.requesterName) {
        _showToast(
          `📬 <strong>${data.requesterName}</strong> wil <em>${data.itemName || 'een voorwerp'}</em> claimen`,
          () => { window.app.switchSection('voorwerpen'); },
          6000
        );
      }
      if (window.app?.state?.activeSection === 'voorwerpen') m.renderVoorwerpen();
    });
  });

  // ── Spelersaantekeningen ──
  socket.on('notes:created', ({ playerName, entityId, entityName } = {}) => {
    if (window.app.isDM() && playerName && entityName) {
      _showToast(
        `✏️ <strong>${playerName}</strong> heeft een opmerking gemaakt over <strong>${entityName}</strong>`,
        () => { /* optioneel: open kaartje */ },
        5000
      );
    }
  });

  // ── Speler-aanwezigheid ──
  socket.on('player:joined', ({ playerName } = {}) => {
    if (window.app.isDM() && playerName) {
      _showToast(`👤 <strong>${playerName}</strong> is verbonden`, null, 4000);
    }
  });

  socket.on('player:left', ({ playerName } = {}) => {
    if (window.app.isDM() && playerName) {
      _showToast(`👤 <strong>${playerName}</strong> heeft de sessie verlaten`, null, 3500);
    }
  });

  // ── Medestanders ──
  socket.on('companion:link', ({ npcId, name, groupId } = {}) => {
    if (!window.app?.isDM?.() && name && groupId === window._myGroupId) {
      _showToast(`⚔️ <strong>${name}</strong> vergezelt nu de groep`);
    }
    if (window.app?.state?.activeSection === 'mijn-karakter') {
      window.refreshSection?.('mijn-karakter');
    }
  });

  socket.on('companion:unlink', ({ npcId, name, groupId } = {}) => {
    if (!window.app?.isDM?.() && name && groupId === window._myGroupId) {
      _showToast(`↩ <strong>${name}</strong> heeft de groep verlaten`);
    }
    if (window.app?.state?.activeSection === 'mijn-karakter') {
      window.refreshSection?.('mijn-karakter');
    }
  });

  // ── Inspiratie ──
  socket.on('player:inspiration', ({ characterId, inspired, name } = {}) => {
    const isMe = characterId && characterId === window.app?.state?.characterId;
    if (inspired && isMe) {
      _showToast('✨ Je hebt inspiratie gekregen!', null, 6000);
    } else if (!inspired && isMe) {
      // geen toast bij verbruiken, dat doet de speler zelf
    }
    // DM: herrender party bar
    if (window.app?.isDM?.()) window.renderParty?.();
    // Speler: herrender dashboard als actief
    if (isMe && window.app?.state?.activeSection === 'mijn-karakter') {
      window.refreshSection?.('mijn-karakter');
    }
  });

  // ── Undo toast bij verwijderde entiteit ──
  socket.on('entity:trashed', ({ type, id, name } = {}) => {
    if (!window.app?.isDM?.()) return;
    _showToast(
      `🗑 <strong>${name}</strong> verwijderd — <u style="cursor:pointer">↩ Ongedaan</u>`,
      async () => {
        try {
          await window.api?.restoreEntity?.(id);
        } catch { /* ok */ }
      },
      8000
    );
  });

  // ── Campagnewisseling ──
  socket.on('campaign:switched', ({ id, meta } = {}) => {
    const isDM = window.app?.isDM?.();
    if (isDM) {
      // DM: korte melding en dan pagina herladen zodat alle data (header, spelers, kaarten) ververst
      _showToast(`🗂 Gewisseld naar <strong>${meta?.appTitle || id}</strong>. Pagina wordt herladen…`, null, 2500);
      setTimeout(() => location.reload(), 2500);
    } else {
      // Spelers: automatisch uitloggen en herladen
      _showToast(`🗂 De DM heeft de campagne gewisseld. Je wordt uitgelogd…`, null, 2500);
      setTimeout(async () => {
        try { await fetch('/api/auth/player-logout', { method: 'POST' }); } catch {}
        location.reload();
      }, 2500);
    }
  });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));
}

function _showToast(html, onClick, duration = 4500) {
  const toast = document.createElement('div');
  toast.className = 'map-toast' + (onClick ? ' map-toast--clickable' : '');
  toast.innerHTML = html;
  document.body.appendChild(toast);

  const dismiss = () => {
    toast.classList.remove('map-toast--show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  if (onClick) {
    toast.addEventListener('click', () => { dismiss(); onClick(); });
  }

  requestAnimationFrame(() => toast.classList.add('map-toast--show'));
  const timer = setTimeout(dismiss, duration);
  if (onClick) toast.addEventListener('click', () => clearTimeout(timer), { once: true });
}
