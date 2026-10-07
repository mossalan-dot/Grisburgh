const { describe, it } = require('node:test');
const assert = require('node:assert');
const H = require('../lib/houding.js');

describe('Houding van personages', () => {
  it('heeft vijf treden, op volgorde, zonder gaten', () => {
    assert.equal(H.HOUDINGEN.length, 5);
    H.HOUDINGEN.forEach((h, i) => assert.equal(h.waarde, i + 1, `trede ${i + 1} staat op zijn plek`));
  });

  it('geeft elke trede een naam, een DMG-houding en een toast', () => {
    for (const h of H.HOUDINGEN) {
      assert.ok(h.naam, `${h.waarde} heeft een naam`);
      assert.ok(h.dmg, `${h.waarde} verwijst naar de DMG`);
      assert.ok(/\{naam\}|\{Naam\}/.test(h.toast), `${h.waarde} noemt het personage in zijn toast`);
    }
  });

  it('laat alleen het midden zonder glans', () => {
    // Dat is geen vergeten regel maar de dekmantel: een kaartje zonder effect
    // kan alles betekenen, dus verraadt een stil kaartje niets.
    const zonder = H.HOUDINGEN.filter(h => !h.glans).map(h => h.waarde);
    assert.deepEqual(zonder, [3]);
  });

  it('maakt van vijandig schaduw en van vriendelijk licht', () => {
    assert.equal(H.houding(1).glans.blend, 'multiply');
    assert.equal(H.houding(2).glans.blend, 'multiply');
    assert.equal(H.houding(4).glans.blend, 'screen');
    assert.equal(H.houding(5).glans.blend, 'screen');
  });

  // ── Wat er geldt ──────────────────────────────────────────────────────────
  it('laat een eigen houding altijd winnen', () => {
    const r = H.gelden({ eigen: 1, renownHouding: 5, rollen: [], subtype: 'NPC' });
    assert.equal(r.waarde, 1);
    assert.equal(r.waarom, 'eigen');
  });

  it('valt zonder eigen houding terug op de factie', () => {
    const r = H.gelden({ eigen: null, renownHouding: 5, rollen: ['antagonist'], subtype: 'NPC' });
    assert.equal(r.waarde, 5);
    assert.equal(r.waarom, 'factie');
  });

  it('valt daarna terug op de standaard van de rol', () => {
    const r = H.gelden({ eigen: null, renownHouding: null, rollen: ['antagonist'], subtype: 'NPC' });
    assert.equal(r.waarde, 1);
    assert.equal(r.waarom, 'standaard');
  });

  it('zet een antagonist vóór een verkoper', () => {
    // Een antagonist die ook koopman is, is eerst antagonist.
    assert.equal(H.standaardVoor(['verkoper', 'antagonist'], 'NPC'), 1);
  });

  it('geeft een huisdier het voordeel van de twijfel', () => {
    assert.equal(H.standaardVoor([], 'dier'), 4);
  });

  it('geeft een god en een speler geen houding', () => {
    // Een god staat niet op deze schaal (daar is het pantheon voor) en een
    // speler ís de party.
    assert.equal(H.heeftHouding('god'), false);
    assert.equal(H.heeftHouding('speler'), false);
    assert.equal(H.heeftHouding('NPC'), true);
    assert.equal(H.standaardVoor(['antagonist'], 'god'), H.NEUTRAAL, 'ook met een rol erop');
  });

  // ── Schoonmaken ───────────────────────────────────────────────────────────
  it('houdt niet-ingesteld op null, ook na een export-import', () => {
    for (const leeg of [null, undefined, '']) assert.equal(H.schoon(leeg), null);
    assert.equal(H.schoon('onzin'), null, 'en onleesbaars telt als niet ingesteld');
  });

  it('knijpt een waarde buiten de schaal naar binnen', () => {
    assert.equal(H.schoon(0), 1);
    assert.equal(H.schoon(99), 5);
    assert.equal(H.schoon('4'), 4, 'ook als hij als tekst binnenkomt');
  });

  // ── Renown ────────────────────────────────────────────────────────────────
  it('vertaalt elke renownrang naar een houding', () => {
    assert.equal(H.RENOWN_NAAR_HOUDING.length, 6, 'zes treden: 0 = buitenstaander, dan vijf rangen');
    assert.equal(H.vanRenown(0), 3, 'een buitenstaander is onverschillig');
    assert.equal(H.vanRenown(5), 5, 'de hoogste rang is bondgenoot');
  });

  it('maakt een factie via renown nooit vijandig', () => {
    // Renown kan in deze app niet onder nul. Wie een factie tegen zich in het
    // harnas joeg zet dat zelf, en die eigen waarde wint.
    const uit = H.RENOWN_NAAR_HOUDING;
    assert.ok(uit.every(w => w >= 3), 'geen enkele rang levert 1 of 2 op');
  });

  it('loopt niet buiten de ladder bij een rare rangIdx', () => {
    assert.equal(H.vanRenown(-3), 3);
    assert.equal(H.vanRenown(99), 5);
  });

  // ── Wie het ziet ──────────────────────────────────────────────────────────
  it('laat de DM het effect altijd zien', () => {
    assert.equal(H.magZien({ isDM: true, groepHaaldeDC: false }), true);
  });

  it('houdt het effect weg bij de spelers tot iemand de DC haalt', () => {
    assert.equal(H.magZien({ isDM: false, groepHaaldeDC: false }), false);
    assert.equal(H.magZien({ isDM: false, groepHaaldeDC: true }), true);
  });

  // ── De DC ─────────────────────────────────────────────────────────────────
  it('gebruikt de campagnestandaard als een personage er geen heeft', () => {
    assert.equal(H.insightDC(null, 15), 15);
    assert.equal(H.insightDC(null, null), H.INSIGHT_DC_STANDAARD);
  });

  it('laat een eigen DC voorgaan', () => {
    assert.equal(H.insightDC(18, 12), 18);
  });

  it('weigert een onmogelijke DC', () => {
    assert.equal(H.insightDC(0, 12), 12, 'nul is niet ingesteld');
    assert.equal(H.insightDC(-5, 12), 12);
    assert.equal(H.insightDC(999, 12), 40, 'en boven de 40 is het geen check meer');
  });

  it('zet de naam in de toast', () => {
    assert.equal(H.toastVoor(5, 'Bram Kruik'), 'Je weet zeker dat Bram Kruik aan jouw kant staat.');
    assert.ok(H.toastVoor(3, 'Bram Kruik').startsWith('Bram Kruik'), 'ook als de zin ermee begint');
    assert.equal(H.toastVoor(9, 'Bram Kruik'), '', 'een trede die niet bestaat zegt niets');
  });
});
