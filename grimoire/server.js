// HP-Grimoire — minimale, losstaande Express-server (Grisburgh-stijl).
// Serveert de statische frontend + één data-endpoint. Bewust klein gehouden:
// het kunstproject leeft in de frontend; de server doet alleen 'files uitdelen'.
const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 4300;
const DATA = path.join(__dirname, 'data');

// Meerdere databronnen samenvoegen tot één grimoire-respons. Zo blijft de
// showcase (grimoire.json) los van de grote canon-/fanon-lijsten, met nette diffs.
function laadGrimoire() {
  const base = JSON.parse(fs.readFileSync(path.join(DATA, 'grimoire.json'), 'utf8'));
  const extra = [];
  for (const f of ['spells-canon.json', 'spells-fanon.json']) {
    const p = path.join(DATA, f);
    if (fs.existsSync(p)) {
      const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(arr)) extra.push(...arr);
    }
  }
  return { ...base, spells: [...(base.spells || []), ...extra] };
}

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
  try {
    res.json(laadGrimoire());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  ✶  Grimoire draait op http://localhost:${PORT}\n`);
});
