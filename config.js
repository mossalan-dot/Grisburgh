module.exports = {
  port:            process.env.PORT             || 3000,
  dmPassword:      process.env.DM_PASSWORD      || 'grisburgh-dm',
  sessionSecret:   process.env.SESSION_SECRET   || '***VERWIJDERD***',
  sandboxPassword: process.env.SANDBOX_PASSWORD || '',   // leeg = geen wachtwoord vereist
  tabletPassword:  process.env.TABLET_PASSWORD  || '***VERWIJDERD***',
  // Lokale ontwikkeling: automatisch als DM ingelogd (geen wachtwoord nodig).
  // Alleen aan als DEV_AUTO_DM=1 — dat staat uitsluitend in het `npm run dev`-script,
  // dus productie (PM2 → `node server.js`) krijgt dit NOOIT.
  devAutoDM:       process.env.DEV_AUTO_DM === '1',
};
