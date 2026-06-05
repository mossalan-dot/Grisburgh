/**
 * render-statblock.js — gedeelde monster-statblock render met kennisniveaus (feature #3).
 * Gebruikt door het DM-paneel (altijd 'volledig') én het Bestiarium (getierd per groep).
 *
 *   naam     → alleen identiteit (naam + size/type/alignment), rest vergrendeld.
 *   deels    → + verdediging, ability scores, saves/skills/resistances/senses/languages.
 *   volledig → + traits, actions, reactions, legendary actions, Challenge Rating.
 *
 * Op 'volledig' is de output identiek aan de oude _statblockHtml (regressie-veilig).
 */

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const _sbMod = score => { const m = Math.floor(((score || 10) - 10) / 2); return (m >= 0 ? '+' : '') + m; };
const _sbMdLine = t => (t || '')
  .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>');
const _sbMdBlock = t => (t || '').split('\n').filter(l => l.trim())
  .map(l => `<p class="sb-p">${_sbMdLine(esc(l))}</p>`).join('');
const _icon = (...a) => window.icon?.(...a) || '';

const _TIERS = { naam: 0, deels: 1, volledig: 2 };

export function renderStatblock(m, { niveau = 'volledig' } = {}) {
  const sb   = m.statblock || {};
  const tier = _TIERS[niveau] ?? 2;
  const ATTRS  = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  const header = `
    <div class="sb-header">
      <div class="sb-name">${esc(m.name)}</div>
      <div class="sb-sub">${[sb.size, sb.type, sb.alignment].filter(Boolean).map(esc).join(' ')}</div>
    </div>`;

  // ── Naam-niveau: alleen identiteit ──
  if (tier < 1) {
    return `<div class="sb-block">
      ${header}
      <div class="sb-rule"></div>
      <div class="sb-locked">${_icon('lock')} Nog niet onderzocht — vecht ertegen of laat het onderzoeken om meer te onthullen.</div>
    </div>`;
  }

  const props = [
    ['savingThrows',          'Saving Throws'],
    ['skills',                'Skills'],
    ['damageVulnerabilities', 'Damage Vulnerabilities'],
    ['damageResistances',     'Damage Resistances'],
    ['damageImmunities',      'Damage Immunities'],
    ['conditionImmunities',   'Condition Immunities'],
    ['senses',                'Senses'],
    ['languages',             'Languages'],
  ].filter(([k]) => sb[k]).map(([k, label]) =>
    `<div class="sb-prop"><span class="sb-prop-label">${label}</span>${esc(sb[k])}</div>`
  ).join('');

  const defensive = `
    ${sb.ac    ? `<div class="sb-prop"><span class="sb-prop-label">Armor Class</span>${esc(sb.ac)}</div>` : ''}
    ${(sb.hp || m.maxHp) ? `<div class="sb-prop"><span class="sb-prop-label">Hit Points</span>${m.maxHp}${sb.hp ? ` (${esc(sb.hp)})` : ''}</div>` : ''}
    ${sb.speed ? `<div class="sb-prop"><span class="sb-prop-label">Speed</span>${esc(sb.speed)}</div>` : ''}`;

  const scores = `
    <div class="sb-scores">
      ${LABELS.map((lbl, i) => `<div class="sb-score-cell">
        <div class="sb-score-label">${lbl}</div>
        <div class="sb-score-val">${sb[ATTRS[i]] ?? 10}</div>
        <div class="sb-score-mod">(${_sbMod(sb[ATTRS[i]] ?? 10)})</div>
      </div>`).join('')}
    </div>`;

  let tail;
  if (tier >= 2) {
    // ── Volledig: props + CR + traits/actions ──
    const cr = (sb.cr || sb.xp)
      ? `<div class="sb-prop"><span class="sb-prop-label">Challenge</span>${esc(sb.cr || '?')}${sb.xp ? ` (${sb.xp} XP)` : ''}</div>`
      : '';
    tail = `${props}${cr}
      ${sb.traits           ? `<div class="sb-rule"></div>${_sbMdBlock(sb.traits)}` : ''}
      ${sb.actions          ? `<div class="sb-rule"></div><div class="sb-section-label">Actions</div>${_sbMdBlock(sb.actions)}` : ''}
      ${sb.reactions        ? `<div class="sb-rule"></div><div class="sb-section-label">Reactions</div>${_sbMdBlock(sb.reactions)}` : ''}
      ${sb.legendaryActions ? `<div class="sb-rule"></div><div class="sb-section-label">Legendary Actions</div>${_sbMdBlock(sb.legendaryActions)}` : ''}`;
  } else {
    // ── Deels: verdedigende props tonen, traits/actions/CR vergrendeld ──
    tail = `${props}
      <div class="sb-rule"></div>
      <div class="sb-locked">${_icon('lock')} Volledige kennis nodig voor traits, actions en Challenge Rating.</div>`;
  }

  return `<div class="sb-block">
    ${header}
    <div class="sb-rule"></div>
    ${defensive}
    <div class="sb-rule"></div>
    ${scores}
    <div class="sb-rule"></div>
    ${tail}
  </div>`;
}
