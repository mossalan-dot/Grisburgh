// HP-Grimoire — minimale, losstaande Express-server (Grisburgh-stijl).
// Serveert de statische frontend + één data-endpoint. Bewust klein gehouden:
// het kunstproject leeft in de frontend; de server doet alleen 'files uitdelen'.
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 4300;

// Statische frontend (public/). HTML/CSS/JS niet cachen zodat wijzigingen
// tijdens het bouwen meteen zichtbaar zijn (net als in de hoofd-app).
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.html', '.css', '.js'].includes(ext)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  },
}));

// De grimoire-data. Later te vervangen door een koppeling met Grisburgh's
// hp-spells.json / per-campagne opslag; nu een plat JSON-bestand.
app.get('/api/grimoire', (req, res) => {
  res.sendFile(path.join(__dirname, 'data', 'grimoire.json'));
});

app.listen(PORT, () => {
  console.log(`\n  ✶  Grimoire draait op http://localhost:${PORT}\n`);
});
