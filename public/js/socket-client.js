const ENTITY_ICONS = { personages: '👤', locaties: '🏰', organisaties: '🏛️', voorwerpen: '⚔️' };

export function initSocket() {
  const socket = io();
  window._socket = socket;  // Exposed so players can emit sound:emote events

  const ENTITY_SECTIONS = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

  // #30: debounce volledige sectie-renders per sectie. Snel opeenvolgende
  // socket-events (combat-ticks, item-acties die meerdere emits geven) leiden
  // anders tot meerdere volledige refreshSection-calls — merkbaar op tablets.
  const _refreshTimers = new Map();
  function _refreshSectionDebounced(section, delay = 100) {
    if (!section) return;
    if (_refreshTimers.has(section)) clearTimeout(_refreshTimers.get(section));
    _refreshTimers.set(section, setTimeout(() => {
      _refreshTimers.delete(section);
      window.app?.refreshSection?.(section);
    }, delay));
  }

  // Helper: herlaad de actieve entiteitsectie via window.app (zelfde module-instantie als app.js,
  // zodat searchQueries/subtypeFilters behouden blijven)
  function _refreshEntitySection(section) {
    if (ENTITY_SECTIONS.includes(section)) {
      _refreshSectionDebounced(section);
    }
  }

  socket.on('entity:updated', () => {
    const section = window.app.state.activeSection;
    if (ENTITY_SECTIONS.includes(section)) {
      _refreshEntitySection(section);
    } else if (section === 'dashboard') {
      import('./render-dashboard.js').then(m => m.renderDashboard());
    }
  });

  socket.on('entity:visibility', ({ id, type, name, visibility } = {}) => {
    const section = window.app.state.activeSection;
    if (ENTITY_SECTIONS.includes(section)) {
      _refreshEntitySection(section);
    } else if (section === 'dashboard') {
      import('./render-dashboard.js').then(m => m.renderDashboard());
    }
    // Kaartoverlay voor spelers bij onthulling
    if (!window.app.isDM() && visibility && visibility !== 'hidden' && name) {
      const icon  = ENTITY_ICONS[type] || '📜';
      const label = visibility === 'vague' ? 'ontdekt' : 'onthuld';
      if (window._isDisplayMode) {
        // iPad: alleen een toast, geen kaartje
        _showToast(`${icon} <strong>${name.replace(/</g,'&lt;')}</strong> — ${label}`);
      } else {
        _showEntityReveal({ id, type, name, icon, label });
      }
    }
  });

  socket.on('entity:secret', ({ id, type, name, secretReveal } = {}) => {
    const section = window.app.state.activeSection;
    if (ENTITY_SECTIONS.includes(section)) {
      _refreshEntitySection(section);
    }
    // Melding voor spelers bij onthulling van een geheimenis
    if (!window.app?.isDM?.() && secretReveal && name) {
      _showToast(`🔓 Geheim van <strong>${name}</strong> onthuld`, () => {
        if (type && id) window._openDetail?.(type, id);
      });
    }
  });

  socket.on('party-board:updated', () => {
    const section = window.app.state.activeSection;
    if (section === 'logboek' && window._logboekActiveTab === 'prikbord') {
      // Herlaad alleen de relatiemap, niet het hele logboek
      import('./render-relatiemap.js?v=8').then(m => {
        const el = document.getElementById('pb-relatiemap-container');
        if (el) m.renderRelatiemap(el);
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

  socket.on('archief:stateChanged', ({ name, state, groupId } = {}) => {
    const section = window.app.state.activeSection;
    if (section === 'documenten') {
      import('./render-archief.js').then(m => m.renderDocumenten());
    } else if (section === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
    if (!window.app.isDM() && state === 'revealed' && name) {
      // Toon toast alleen aan spelers van de juiste groep
      const myGroup = window._myGroupId;
      if (!groupId || !myGroup || myGroup === groupId) {
        _showToast(`📜 <strong>${name}</strong> is onthuld`, () => {
          window.app.switchSection('documenten');
        });
      }
    }
  });

  socket.on('logboek:updated', () => {
    if (window.app.state.activeSection === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
  });

  socket.on('quests:updated', () => {
    if (window.app.state.activeSection === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
  });

  socket.on('heeren:updated', () => {
    if (window.app?.state?.activeSection === 'heeren') window.app?.refreshSection?.('heeren');
  });

  socket.on('facties:updated', () => {
    const section = window.app?.state?.activeSection;
    if (section === 'mijn-karakter') _refreshSectionDebounced('mijn-karakter');
    if (section === 'logboek' && window._logboekActiveTab === 'prikbord') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
  });

  socket.on('chapter-visibility:updated', () => {
    if (window.app.state.activeSection === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
  });

  socket.on('archief:dramaticReveal', (doc) => {
    if (!window.app.isDM()) {
      // Toon dramatische onthulling alleen aan spelers van de juiste groep
      const myGroup = window._myGroupId;
      if (!doc.groupId || !myGroup || myGroup === doc.groupId) {
        _showDramaticReveal(doc);
      }
    }
  });

  socket.on('logboek:imageRevealed', ({ imageId, caption, samenvatting } = {}) => {
    if (window.app.state.activeSection === 'logboek') {
      import('./render-archief.js').then(m => m.renderLogboek());
    }
    if (!window.app.isDM()) {
      if (window._isDisplayMode) {
        // iPad: afbeelding vol scherm tonen
        if (imageId) window._displayShowImage?.(`/api/files/${imageId}`, caption || samenvatting || '');
      } else {
        // Telefoon: alleen toast, geen lightbox
        const label = caption || samenvatting || 'Logboek';
        _showToast(`🖼️ <strong>${label}</strong> — nieuwe afbeelding onthuld`, () => {
          window.app.switchSection('logboek');
        });
      }
    }
  });

  socket.on('map:updated', () => {
    if (window.app.state.activeSection === 'kaart') {
      import('./render-kaart.js?v=2').then(m => m.renderKaart());
    }
  });

  // Dungeon: kamer onthuld → iPad toont kaart; spelers herladen als ze er al zijn
  socket.on('dungeon:revealed', () => {
    if (window._isDisplayMode) {
      window._displayShowDungeon?.();
      return;
    }
    if (window.app.state.activeSection !== 'kaart') return;
    if (window.app.state.role === 'dm') return; // DM al bijgewerkt via _renderSvg()
    import('./render-dungeon.js?v=15').then(m => {
      const content = document.getElementById('kaart-mode-content');
      if (content) m.renderDungeon(content);
    });
  });
  // Dungeon meta bijgewerkt (nieuwe map, party-access) → iedereen herlaadt
  socket.on('dungeon:updated', () => {
    if (window.app.state.activeSection !== 'kaart') return;
    import('./render-dungeon.js?v=15').then(m => {
      const content = document.getElementById('kaart-mode-content');
      if (content) m.renderDungeon(content);
    });
  });

  socket.on('map:pinRevealed', () => {
    // Herlaad kaart als de speler daar is (toast wordt al getoond via entity:visibility)
    if (window.app.state.activeSection === 'kaart') {
      import('./render-kaart.js?v=2').then(m => m.renderKaart());
    }
  });

  // ── Kaartpinnen spelers ──
  socket.on('pin:pending', ({ id, locName, placedByName } = {}) => {
    if (!window.app?.isDM?.()) return;
    _showToast(
      `📍 <strong>${placedByName || 'Speler'}</strong> stelt ${locName ? `<em>${locName}</em>` : 'een locatie'} voor op de kaart`,
      () => { window.app.switchSection('kaart'); },
      8000
    );
    if (window.app.state.activeSection === 'kaart') {
      import('./render-kaart.js?v=2').then(m => m.renderKaart());
    }
  });

  socket.on('pin:approved', ({ locName } = {}) => {
    _showToast(
      `✅ Je pin voor <strong>${locName || 'de locatie'}</strong> is goedgekeurd`,
      () => { window.app.switchSection('kaart'); },
      6000
    );
    if (window.app.state.activeSection === 'kaart') {
      import('./render-kaart.js?v=2').then(m => m.renderKaart());
    }
  });

  socket.on('pin:rejected', ({ locName } = {}) => {
    _showToast(
      `❌ Je pin voor <strong>${locName || 'de locatie'}</strong> is niet goedgekeurd`,
      null,
      5000
    );
    if (window.app.state.activeSection === 'kaart') {
      import('./render-kaart.js?v=2').then(m => m.renderKaart());
    }
  });

  socket.on('meta:updated', () => {
    import('./api.js').then(({ api }) => api.meta().then(m => {
      const prev = window.app?.state?.meta;
      const buitenChanged = prev?.buitenGrisburgh !== m.buitenGrisburgh;
      if (window.app?.state) window.app.state.meta = m;
      window.app?.applyAppMeta(m);
      // Re-render active dienst tab when locatie-flag changes
      if (buitenChanged) {
        const sec = window.app?.state?.activeSection;
        if (['herberg','tweespalt','ursula','gock','tempel'].includes(sec)) {
          window.app?.navigateTo?.(sec);
        }
      }
    }));
  });

  socket.on('ursula:updated', () => {
    if (window.app?.state?.activeSection === 'ursula') window.app?.refreshSection?.('ursula');
  });

  socket.on('diensten:toegang:updated', () => {
    window.app?._loadDienstenToegang?.();
  });

  socket.on('entity:deceased', ({ id, type, name } = {}) => {
    // Herlaad de huidige sectie zodat het kaartje meteen grijs wordt
    const section = window.app.state.activeSection;
    _refreshEntitySection(section);
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
    const activeSection = window.app.state.activeSection;
    _refreshEntitySection(activeSection);
    // Logboek/quests ook verversen (quest-statussen zijn per party)
    if (activeSection === 'logboek') {
      window.renderLogboek?.();
    }
    // Documenten ook verversen (zichtbaarheid is per groep)
    if (activeSection === 'documenten') {
      import('./render-archief.js').then(m => m.renderDocumenten());
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
      window.app?.refreshSection('mijn-karakter');
    }
    // iPad: zorg dat de overlay nooit geminimaliseerd is; bij einde gevecht terug naar idle
    if (window._isDisplayMode) {
      const overlay = document.getElementById('combat-overlay');
      if (overlay) {
        if (combat?.active) {
          overlay.classList.remove('minimized');
        } else {
          window._displayIdle?.();
        }
      }
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
      _refreshSectionDebounced('mijn-karakter');
    }
  });

  // ── Profiel gewijzigd (level, klasse, etc.) ──
  socket.on('player:profile-updated', ({ characterId, profile } = {}) => {
    const myId = window.app?.state?.characterId;
    if (myId !== characterId) return; // niet onze speler

    // Werk _lastProgCtx direct bij zodat de progressie-tab de juiste data heeft
    // zodra de speler ernaartoe navigeert — ook als de sectie nu niet actief is
    if (window._lastProgCtx && profile) {
      window._lastProgCtx = {
        ...window._lastProgCtx,
        klasse:           profile.klasse           ?? window._lastProgCtx.klasse,
        klasseLevel:      parseInt(profile.klasseLevel) || window._lastProgCtx.klasseLevel,
        level:            parseInt(profile.level)       || window._lastProgCtx.level,
        subclass:         profile.subclass         ?? window._lastProgCtx.subclass,
        multiclass:       profile.multiclass === 'true' || profile.multiclass === true,
        multiKlasse:      profile.multiKlasse      ?? window._lastProgCtx.multiKlasse,
        multiKlasseLevel: parseInt(profile.multiKlasseLevel) || window._lastProgCtx.multiKlasseLevel,
      };
    }

    // Herlaad de volledige sectie als die nu actief is
    if (window.app?.state?.activeSection === 'mijn-karakter') {
      _refreshSectionDebounced('mijn-karakter');
    } else {
      // Sectie niet actief: markeer dat herlaad nodig is bij volgende bezoek
      window._pendingKarakterRefresh = true;
    }
  });

  // ── Klasse-progressie (skill trees) door de DM aangepast ──
  socket.on('progression:updated', () => {
    window.dispatchEvent(new Event('progression:reload'));
    if (window.app?.state?.activeSection === 'mijn-karakter') {
      _refreshSectionDebounced('mijn-karakter');
    }
  });

  // ── Voorwerpen eigendom ──
  socket.on('items:ownership-updated', (data) => {
    if (data) window._setOwnership?.(data);
    if (window.app?.state?.activeSection === 'voorwerpen') {
      window.app.refreshSection('voorwerpen');
    }
    // Altijd de knapzak bijwerken (ook als de tab niet actief is)
    _refreshSectionDebounced('mijn-karakter');
    // Toast voor de speler wiens item is teruggenomen
    if (!window.app.isDM() && data?.takenBack) {
      const myCharId = window.app?.state?.characterId;
      if (myCharId && data.takenBack.characterId === myCharId) {
        _showToast(`📦 <strong>${data.takenBack.itemName}</strong> is teruggenomen door de DM`);
      }
    }
  });

  // ── Speler voorwerpen bijgewerkt (tekst-items, geen entityId) ──
  socket.on('player:items-updated', ({ characterId } = {}) => {
    const myCharId = window.app?.state?.characterId;
    if (!characterId || characterId === myCharId) {
      _refreshSectionDebounced('mijn-karakter');
    }
  });

  socket.on('player:vloek', ({ characterId, godNaam, vloekEffect } = {}) => {
    const myCharId = window.app?.state?.characterId;
    if (characterId && characterId !== myCharId) return;
    window._tempelVloekCinema?.(godNaam, vloekEffect);
  });

  socket.on('items:request', (data) => {
    if (data) window._setOwnership?.(data);
    // DM: toast met het verzoek
    if (window.app.isDM() && data.requesterName) {
      _showToast(
        `📬 <strong>${data.requesterName}</strong> wil <em>${data.itemName || 'een voorwerp'}</em> claimen`,
        () => { window.app.switchSection('voorwerpen'); },
        6000
      );
    }
    if (window.app?.state?.activeSection === 'voorwerpen') {
      window.app.refreshSection('voorwerpen');
    }
  });

  // ── Winkel uitverkocht ──
  socket.on('shop:uitverkocht-updated', ({ shopId } = {}) => {
    // Als het detail-venster van deze winkel open is, herlaad het
    if (shopId && window._currentDetailId === shopId) {
      window._openDetail(window._currentDetailTab, shopId);
    }
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
      _refreshSectionDebounced('mijn-karakter');
    }
  });

  socket.on('companion:unlink', ({ npcId, name, groupId } = {}) => {
    if (!window.app?.isDM?.() && name && groupId === window._myGroupId) {
      _showToast(`↩ <strong>${name}</strong> heeft de groep verlaten`);
    }
    if (window.app?.state?.activeSection === 'mijn-karakter') {
      _refreshSectionDebounced('mijn-karakter');
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
      _refreshSectionDebounced('mijn-karakter');
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

  // ── Geheime berichten ──
  socket.on('bericht:nieuw', ({ msg } = {}) => {
    if (!msg?.tekst) return;
    const isBrief = msg.type === 'brief';
    const toastLabel = isBrief
      ? `✉️ <strong>${msg.titel ? `Brief: ${msg.titel}` : 'Nieuwe brief ontvangen'}</strong>`
      : `💬 <strong>Geheim bericht van de DM</strong>`;
    _showToast(
      toastLabel,
      () => { window.app.switchSection('mijn-karakter'); window._setPlayerSubTab?.('berichten'); },
      8000
    );
    // Als de spelerspagina open is, herrender direct
    if (window.app?.state?.activeSection === 'mijn-karakter') {
      _refreshSectionDebounced('mijn-karakter');
    }
    // Unread badge bijwerken
    window._berichtenUnread = (window._berichtenUnread || 0) + 1;
    window._updateBerichtenBadge?.();
  });

  // ── Gedeelde beurs ──
  socket.on('party-currency:updated', ({ groupId, currency, actor } = {}) => {
    // Alleen relevant als dit mijn groep is
    const myGroupId = window._myGroupId;
    if (groupId && myGroupId && groupId !== myGroupId) return;
    if (window.app?.state?.activeSection === 'mijn-karakter') {
      _refreshSectionDebounced('mijn-karakter');
    }
    if (actor && actor !== 'DM' && currency) {
      _showToast(`💰 <strong>${actor}</strong> heeft de gedeelde beurs bijgewerkt`);
    }
  });

  // ── Gock rapport klaar ──
  socket.on('gock:rapport-klaar', ({ entityName } = {}) => {
    _showToast(
      `📁 <strong>De Gock</strong> heeft zijn rapport over <em>${entityName}</em> klaargelegd`,
      () => { window.app.switchSection('gock'); },
      8000
    );
    if (window.app?.state?.activeSection === 'gock') {
      window.app.refreshSection('gock');
    }
  });

  // ── Tweespalt ──
  socket.on('tweespalt:updated', () => {
    if (window.app?.state?.activeSection === 'tweespalt') {
      window.app.refreshSection('tweespalt');
    }
  });

  socket.on('tweespalt:uitslag', ({ eventNaam, winnaarNaam, uitbetalingen } = {}) => {
    const myCharId = window.app?.state?.characterId;
    const mijnUitbetaling = myCharId && uitbetalingen?.[myCharId];
    if (mijnUitbetaling) {
      if (mijnUitbetaling.gewonnen) {
        _showToast(
          `🏆 <strong>${eventNaam}</strong> — ${winnaarNaam} wint! Jij hebt gewonnen!`,
          () => { window.app.switchSection('tweespalt'); },
          7000
        );
      } else {
        _showToast(
          `🎲 <strong>${eventNaam}</strong> — ${winnaarNaam} wint. Jij had pech.`,
          () => { window.app.switchSection('tweespalt'); },
          6000
        );
      }
    } else if (myCharId) {
      _showToast(
        `🎲 <strong>${eventNaam}</strong> afgerond — winnaar: ${winnaarNaam}`,
        () => { window.app.switchSection('tweespalt'); },
        5000
      );
    }
    if (window.app?.state?.activeSection === 'tweespalt') {
      window.app.refreshSection('tweespalt');
    }
  });

  socket.on('relations:updated', () => {
    if (window.app.state.activeSection === 'relatiemap') {
      import('./render-relatiemap.js').then(m => m.renderRelatiemap());
    }
  });

  socket.on('relations:revealed', ({ id } = {}) => {
    if (window.app.state.activeSection === 'relatiemap') {
      import('./render-relatiemap.js').then(m => m.renderRelatiemap());
    }
    if (!window.app.isDM()) {
      _showToast(`🕸️ <strong>Nieuwe verbinding onthuld!</strong>`, () => {
        window.app.switchSection('relatiemap');
      }, 6000);
    }
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    // Herregistreer characterId na reconnect
    const cid = window.app?.state?.characterId;
    if (cid) socket.emit('player:register', cid);
  });
  socket.on('disconnect', () => console.log('Socket disconnected'));
}

function _showDramaticReveal(doc) {
  document.getElementById('dramatic-reveal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'dramatic-reveal-overlay';
  overlay.className = 'dramatic-reveal-overlay';
  overlay.innerHTML = `
    <div class="dramatic-reveal-backdrop" onclick="this.closest('.dramatic-reveal-overlay').remove()"></div>
    <div class="dramatic-reveal-card">
      <button class="dramatic-reveal-close" onclick="document.getElementById('dramatic-reveal-overlay').remove()" title="Sluiten">✕</button>
      <div class="dramatic-reveal-label">📜 Nieuw document onthuld</div>
      <div class="dramatic-reveal-title">${(doc.name || '').replace(/</g,'&lt;')}</div>
      ${doc.type ? `<div class="dramatic-reveal-type">${doc.type.replace(/</g,'&lt;')}</div>` : ''}
      ${doc.imageId ? `<img class="dramatic-reveal-img" src="/api/files/${doc.imageId}" alt="${(doc.name||'').replace(/"/g,'&quot;')}">` : ''}
      ${doc.flavour ? `<p class="dramatic-reveal-flavour">"${doc.flavour.replace(/</g,'&lt;')}"</p>` : ''}
      <button class="dramatic-reveal-btn" onclick="document.getElementById('dramatic-reveal-overlay').remove()">Bekijken</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('dramatic-reveal-overlay--in')));
  setTimeout(() => {
    if (document.getElementById('dramatic-reveal-overlay') === overlay) {
      overlay.classList.remove('dramatic-reveal-overlay--in');
      setTimeout(() => overlay.remove(), 600);
    }
  }, 300000);
}

function _showEntityReveal({ id, type, name, icon, label }) {
  document.getElementById('entity-reveal-overlay')?.remove();

  const eName = (name || '').replace(/</g, '&lt;');
  const eType = (type || '');
  const eId   = (id   || '');

  const overlay = document.createElement('div');
  overlay.id = 'entity-reveal-overlay';
  overlay.className = 'dramatic-reveal-overlay';
  overlay.innerHTML = `
    <div class="dramatic-reveal-backdrop" onclick="this.closest('#entity-reveal-overlay, .dramatic-reveal-overlay').remove()"></div>
    <div class="dramatic-reveal-card">
      <button class="dramatic-reveal-close" onclick="document.getElementById('entity-reveal-overlay').remove()" title="Sluiten">✕</button>
      <div class="dramatic-reveal-label">${icon} ${label.charAt(0).toUpperCase() + label.slice(1)}</div>
      <div class="dramatic-reveal-title">${eName}</div>
      <button class="dramatic-reveal-btn" onclick="document.getElementById('entity-reveal-overlay').remove(); window._openDetail?.('${eType}','${eId}')">Bekijken</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('dramatic-reveal-overlay--in')));
  setTimeout(() => {
    if (document.getElementById('entity-reveal-overlay') === overlay) {
      overlay.classList.remove('dramatic-reveal-overlay--in');
      setTimeout(() => overlay.remove(), 600);
    }
  }, 300000);
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
