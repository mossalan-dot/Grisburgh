const ENTITY_ICONS = { personages: '👤', locaties: '🏰', organisaties: '🏛️', voorwerpen: '⚔️' };

export function initSocket() {
  const socket = io();

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

  socket.on('entity:secret', () => {
    const section = window.app.state.activeSection;
    if (ENTITY_SECTIONS.includes(section)) {
      import('./render-campagne.js').then(m => {
        if (section === 'personages') m.renderPersonages();
        else if (section === 'locaties') m.renderLocaties();
        else if (section === 'organisaties') m.renderOrganisaties();
        else if (section === 'voorwerpen') m.renderVoorwerpen();
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

  socket.on('logboek:imageRevealed', ({ caption, samenvatting } = {}) => {
    if (window.app.state.activeSection === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
    if (!window.app.isDM()) {
      const label = caption || samenvatting || 'Logboek';
      _showToast(`🖼️ <strong>${label}</strong> — nieuwe afbeelding onthuld`, () => {
        window.app.switchSection('logboek');
      });
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
