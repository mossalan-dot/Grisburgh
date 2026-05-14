module.exports = {
  port:            process.env.PORT             || 3000,
  dmPassword:      process.env.DM_PASSWORD      || 'grisburgh-dm',
  sessionSecret:   process.env.SESSION_SECRET   || '***VERWIJDERD***',
  sandboxPassword: process.env.SANDBOX_PASSWORD || '',   // leeg = geen wachtwoord vereist
  tabletPassword:  process.env.TABLET_PASSWORD  || '***VERWIJDERD***',
};
