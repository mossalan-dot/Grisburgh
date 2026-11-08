// Toegankelijkheid (8 nov 2026). Een axe-core-ronde over twaalf schermen gaf
// 375 overtredingen; deze toets bewaakt de afspraken die daaruit kwamen, op de
// broncode — de echte axe-ronde staat in de testronde.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lees = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const app = lees('js/app.js'), campagne = lees('js/render-campagne.js'), html = lees('index.html');

describe('Toegankelijkheid', () => {
  it('het gedeelde venster is een dialoog met een naam en een benoemd kruisje', () => {
    assert.match(html, /class="modal animate-modal-in" role="dialog" aria-modal="true" aria-labelledby="m-title"/);
    assert.match(html, /onclick="window\.app\.closeModal\(\)" aria-label="Sluiten"/);
  });

  it('Escape in de algemene sneltoetsen sluit het venster niet (dat kon een editor met onbewaard werk zijn)', () => {
    const i = app.indexOf('// ── Keyboard shortcuts ──');
    const blok = app.slice(i, app.indexOf('\n});', i));
    assert.doesNotMatch(blok.replace(/\/\/.*$/gm, ''), /closeModal\(\)/);
  });

  it('een portret op de landingspagina is met het toetsenbord te kiezen', () => {
    assert.match(app, /class="landing-portrait"[\s\S]{0,400}role="button" tabindex="0" aria-label="Spelen als/);
  });

  it('beelden op kaartjes en portretten dragen een alt', () => {
    for (const m of campagne.matchAll(/<img class="card-img[^>]*>/g)) assert.match(m[0], /alt=""/);
    assert.match(app, /class="landing-portrait-img" alt=""/);
    assert.match(app, /class="player-dash-avatar" alt=""/);
  });

  it('bolletjes zonder tekst hebben een naam', () => {
    assert.match(app, /class="player-save-dot[^"]*"\s+aria-label=/);
    assert.match(app, /class="player-skill-prof-btn[^"]*"\s+aria-label=/);
  });

  it('een veld dat zichzelf bewaart is gemarkeerd, zodat Escape het venster mag sluiten', () => {
    assert.match(campagne, /id="dm-note-\$\{e\.id\}" class="notitie-vak" data-bewaart-zelf\s/);
    assert.match(campagne, /id="player-note-\$\{e\.id\}" data-bewaart-zelf\s/);
  });
});
