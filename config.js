module.exports = {
  port:            process.env.PORT             || 3000,
  dmPassword:      process.env.DM_PASSWORD      || 'grisburgh-dm',
  sessionSecret:   process.env.SESSION_SECRET   || 'dev-only-session-secret',
  sandboxPassword: process.env.SANDBOX_PASSWORD || '',   // leeg = geen wachtwoord vereist
  // Geen fallback: zonder TABLET_PASSWORD in de omgeving is tablet-login uitgeschakeld.
  // Productie (PM2) moet deze env-var zetten — nooit een echt wachtwoord in dit bestand.
  tabletPassword:  process.env.TABLET_PASSWORD  || null,
  // Lokale ontwikkeling: automatisch als DM ingelogd (geen wachtwoord nodig).
  // Alleen aan als DEV_AUTO_DM=1 — dat staat uitsluitend in het `npm run dev`-script,
  // dus productie (PM2 → `node server.js`) krijgt dit NOOIT.
  devAutoDM:       process.env.DEV_AUTO_DM === '1',
};
