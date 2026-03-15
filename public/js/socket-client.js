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

  socket.on('entity:visibility', () => {
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

  socket.on('archief:stateChanged', () => {
    const section = window.app.state.activeSection;
    if (section === 'documenten') {
      import('./render-archief.js').then(m => m.renderDocumenten());
    } else if (section === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
  });

  socket.on('logboek:updated', () => {
    if (window.app.state.activeSection === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
  });

  socket.on('meta:updated', () => {
    import('./api.js').then(({ api }) => api.meta().then(m => {
      if (window.app?.state) window.app.state.meta = m;
    }));
  });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));
}
