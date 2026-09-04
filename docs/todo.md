# Todo

Eén plek voor wat er nog ligt. Bijgewerkt 4 sep 2026. De uitwerking staat in de
werkdocumenten waar naar verwezen wordt; hier staat alleen wát er ligt en hoe
groot het is.

## Nu aan de beurt

- [ ] **Testronde afmaken** — blok 1 rest: portretfilmpje bij inzoomen, en of het
      groepswachtwoord in de DM-ingang echt alleen díé party toont. Daarna blok 2
      t/m 10. → `docs/testronde.md`

## Tafelscherm-effecten → `docs/tafelscherm-effecten.md`

- [ ] **Effectlaag naar `<body>`** — moet eerst: nu zit `.display-fx` op z-index 5
      binnen het sfeerscherm, terwijl het gevecht er als fixed overlay (55)
      overheen ligt. Zonder dit werkt geen enkel effect tijdens een gevecht — en
      dat is juist waar laag HP ontstaat. Klein werk.
- [ ] **Catalogus + geluid** — dertien effecten, flits vs. toestand, klank vast aan
      het effect (WebAudio, geen bestanden).
- [ ] **Wond-flits automatisch** bij `player:hp-updated`, per campagne aan/uit.
- [ ] Vier openstaande vragen onderaan dat document (welke effecten, auto aan/uit,
      lopen toestanden af, gesynthetiseerd of samples).

## Multi-DM, resterende stappen → `docs/multi-dm-plan.md`

- [ ] **6. Wizard + minicampagne** — campagnenaam → munten → modules → **namen van
      diensten** → kaart → eerste party met wachtwoord → eerste personage.
      Waarschuwen dat party's later niet samen te voegen zijn. Grootste stap.
- [ ] **7. Handleiding + visuele rondleiding** — leunt op stap 6.
- [ ] **8. Mediabudget** — teller per campagne + verkleinen bij upload. Naar voren
      halen als de schijf eerder knelt.
- [ ] **9. Gefaseerd uitrollen** — vlag per campagne, deployvolgorde, en een
      teruggang die geoefend is.

## Scherven (klein, los op te pakken)

- [ ] **`meta.heeren` bestaat niet** — enige dienst zonder configuratieblok, dus
      niet te hernoemen; valt terug op "Dievengilde".
- [ ] **Facties & Aanzien heeft geen sectienaam** — losse facties wel, de sectie
      niet. Kleinste oplossing: `meta.factiesLabel`.
- [ ] **App-iconen en logo zijn van Grisburgh** — de PWA installeert bij elke
      campagne met hetzelfde wapen. Embleem is al per campagne; de iconen niet.
- [ ] **Oude bestanden op de server** — `/var/www/grisburgh/public/` heeft nog
      losse `app.js`, `theme.css` en `render-relatiemap.js` uit deploys van juni.
      Nergens meer naar gelinkt; opruimen zodra we zeker weten dat niets ze pakt.
- [ ] **Dode code van de previewtoggle** — de knop is uit de balk, `dmToggleClick`
      en `state.dmPreview` staan er nog. Laten staan tot zeker is dat je hem niet
      terugwilt.

## Afgesproken maar nog niet ingepland

- [ ] **Samenvoegen van party's** — verhuizen laat voorwerpbezit en onthulde
      geheimen achter. Als dit vaker gaat spelen: één actie die de twaalf
      groepsvelden echt omzet, geen losse verhuisknop.
