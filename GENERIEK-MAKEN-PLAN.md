# Grisburgh → generieke campagne-manager — stappenplan

> **Analysedocument. Niks geprogrammeerd.** In kaart gebracht: wat er nodig is om de app
> bruikbaar te maken voor andere DM's, los van de Grisburgh-lore. Met effort-inschatting
> (S/klein · M/midden · L/groot) en een aanbevolen fasering.
>
> Bevindingen zijn geverifieerd in de code; file-ankers staan erbij.

---

## 0. Eerst kiezen: welk ambitieniveau?

Twee fundamenteel verschillende doelen — ze bepalen 80% van het werk:

| | **A. Zelf-hostbaar (single-tenant)** | **B. Gehoste dienst (multi-tenant SaaS)** |
|---|---|---|
| Wie draait het | Elke DM draait z'n eigen instance (clone + run) | Eén instance, veel DM's met accounts |
| Lore loskoppelen | ✅ nodig | ✅ nodig |
| Taal/valuta/thema config | ✅ nodig | ✅ nodig |
| Accounts/auth | ❌ niet (één DM-wachtwoord per instance volstaat) | ✅ groot: accounts, isolatie, invites, rollen |
| Hosting/billing/AVG | ❌ niet | ✅ groot |
| Inschatting | ~weken | ~maanden |

**Aanbeveling:** eerst **A** volledig (lore-vrij, configureerbaar, zelf-hostbaar). **B** is een latere, veel grotere stap die op A voortbouwt. De rest van dit document is geordend zodat A → B incrementeel kan.

---

## Wat al generiek is (de fundering staat)

- ✅ **Multi-campagne-isolatie** — `lib/storage.js`: AsyncLocalStorage + `data/campaigns/<id>/`; actieve campagne per request (`runInCampaign`).
- ✅ **Campagne aanmaken vanuit code** — `createCampaign(id, meta)` (`lib/storage.js:54`), aangeroepen via `POST /campaigns` (`routes/api.js:4291`) en een DM-formulier (`dm-panel.js:3512`).
- ✅ **Lege start** — nieuwe campagnes starten met lege datastructuren (`DEFAULTS` in `storage.js`); géén Grisburgh-data ingebakken. Lore leeft dus in *data*, niet in code.
- ✅ **Generieke entiteiten** — personages/locaties/organisaties/voorwerpen zijn neutrale D&D-archetypes.
- ✅ **Generieke kern** — combat, dice, kaart, relatiemap, socket-sync, zichtbaarheid per groep: lore-agnostisch.
- ✅ **Per-campagne meta** — `meta.json` houdt al `appTitle`, `appSubtitle`, `theme`, `currency`, `spellSource`, `hoofdstukken`.

> Conclusie: het is **geen herbouw**. Het is lore uit code halen + een handvol vastgebakken aannames configureerbaar maken + onboarding.

---

## 1. Lore loskoppelen van code → data/config  *(kern van de vraag)*

### 1a. Diensten generiek maken — **L** (grootste structurele klus)
De 8 diensten (`herberg, tweespalt, gock, ursula, tempel, heeren, facties, magizoo`) zijn **hardcoded over 9+ bestanden / 20+ verwijzingen**:
- `routes/api.js:4461` `_DIENSTEN_NAMEN` + per dienst een vast GET/POST/PUT-endpoint.
- `public/index.html` nav-knoppen (`:111`), section-divs (`:208`), DM-tabs (`:257`).
- `public/js/app.js` `DIENSTEN_SECTIONS` (`:770`), labels (`:272`), backdrop-kleuren (`:246`), zichtbaarheidschecks (`:1964`).
- `public/js/dm-panel.js` `_DIENSTEN_TABS` (`:369`), subtab-render (`:514`), `_DIENSTEN_META` (`:869`).

**Twee aanpakken (spectrum):**
- **Pragmatisch (M):** behoud 8 "service-slots", maar maak ze **volledig hernoembaar + uitschakelbaar** en verwijder alle lore-defaults. Een DM die geen "zieneres" wil, zet 'm uit. Snel, maar het aantal/typen diensten blijft vast.
- **Volledig data-driven (L):** diensten-registry naar `meta.json` (per dienst: key, naam, type/template, icon, prijsvelden, config). Nav, DM-tabs en routing **dynamisch** genereren uit die config. Endpoints generaliseren naar `GET /dienst/:key` met een handler per *dienst-type* (waarzeggerij, onderzoek, gokken, winkel…). Geeft echte vrijheid (diensten toevoegen zonder code).

> Advies: begin pragmatisch (slots hernoembaar + lore-defaults eruit), met de data-driven registry als doel-architectuur. De secundaire-diensten-plannen (`DIENSTEN-SECUNDAIR-PLAN.md`) passen mooi in een "dienst-type"-model.

### 1b. Lore-strings uit code halen — **M**
Niet alles is overridebaar; een paar plekken zijn écht ingebakken:
- **Factie-omschrijvingen** met Grisburgh-geografie: De Cooperatie / De Roodzwaarden (`routes/api.js:5615–5665`) → naar data/config.
- **NPC-namen in generatoren**: Zilvertong, Zemelaar, Luimpoort, "De Gock huurde…" (`routes/api.js:4379, 5326, 6048`) → parametriseren of naar config-pools.
- **"buiten Grisburgh"-toggle** (`meta.buitenGrisburgh`, o.a. `app.js` magizoo/diensten) → hernoem naar generiek "buiten de stad" / config-label.
- **Afzender-mapping** `THEMA_AFZENDER` (`routes/api.js:874`) → koppel aan dienst-config i.p.v. vaste namen.
- Veel andere namen zijn **al** overridebaar via `config.naam || 'De Magizoöloog'` — die vereisen alleen dat de *default* neutraal wordt (bv. "De Zieneres", "De Onderzoeker").

### 1c. "Grisburgh" als woord in code — **S**
~7 letterlijke `'Grisburgh'`-refs in code (`routes/api.js:3476, 5618…`, `dm-panel.js:3552`) → vervang door `meta.appTitle` of een neutrale term.

---

## 2. Inhoud scheiden van engine — **S–M**

- **Grisburgh-campagne = voorbeeld, niet default.** De data in `data/campaigns/grisburgh/` niet meeleveren als standaard. Opties: (a) lege campagne als start, (b) optioneel importeerbare "Grisburgh-demo" als showcase.
- **Spreukenbron is lore-gevoelig.** `public/data/hp-spells.json` is Harry Potter-thematisch; `spells-2024.json` is generiek 5e. Maak `meta.spellSource` echt schakelbaar en lever een **generieke 5e-spreukenlijst** als default.
- **Class-progression is generiek D&D** (`public/data/class-progression.json`, 12 klassen 2024) — behouden. Wel: zie §7 (juridisch/SRD).
- **Seed-template** definiëren: welke bestanden + minimale inhoud een werkende lege campagne nodig heeft (al grotendeels in `storage.js DEFAULTS`).

---

## 3. Vastgebakken aannames configureerbaar maken

### 3a. Valuta — **M**
- Namen staan in `meta.currency` maar zijn **write-once** (geen edit-endpoint). Verhouding 1 fl = 10 kn = 100 cl is **hardcoded** in `toCl`/`fromCl` (`routes/api.js:958`), met 50+ aanroepen.
- Nodig: `PUT /meta/currency` (namen) + `toCl/fromCl` laten lezen uit config voor de ratio. Aanroepsites hoeven niet allemaal aangeraakt als de helpers config-bewust worden.

### 3b. Thema/styling — **M**
- Perkament-look is hardcoded in `theme.css` + Tailwind-config in `index.html` (hex-kleuren, geen CSS-variabelen). `meta.theme` wordt opgeslagen maar **nergens toegepast**.
- Nodig: kleurenpalet naar **CSS-variabelen**, een paar kant-en-klare thema's, en `meta.theme` toepassen (class op `<html>` of variabelen injecteren). Lettertypes/teksturen optioneel per thema.

### 3c. App-identiteit — **S**
- `appTitle`/`appSubtitle` zijn al editbaar (`PUT /meta/app`, `routes/api.js:3412`). Logo/favicon per campagne toevoegen is een kleine uitbreiding.

### 3d. Taal / i18n — **L** (grootste *tedious* klus)
- UI is volledig NL, **geen i18n-laag**. ~1.000–1.500 inline NL-strings in `app.js`/`dm-panel.js`/`render-*.js`/`index.html`, plus ~130 NL **server-foutmeldingen** (`routes/api.js`) en ~5 in `routes/auth.js` — die laatste worden als JSON naar de client gestuurd.
- Nodig: strings extraheren naar een sleutel→tekst-tabel (NL + EN), een kleine `t('key')`-helper client- én serverside. Mechanisch maar omvangrijk.
- **Fasering:** kan ná A1 (eerst NL houden), maar voor "andere DM's" is **Engels** vrijwel zeker nodig. Overweeg minstens een EN-vertaling naast NL.

---

## 4. Onboarding voor een nieuwe DM — **M**

- **First-run / installatie:** DM-wachtwoord zetten, eerste campagne aanmaken (nu via env `DM_PASSWORD` + handmatig). 
- **"Nieuwe campagne"-wizard:** bouwt voort op `createCampaign` — vraag naam, taal, valuta(namen+ratio), thema, spreukenbron, en **welke diensten aan**. 
- **Voorbeeld/demo-campagne** om te verkennen (los van de echte data).
- **Documentatie:** `README` voor self-hosters + `.env.example`.

---

## 5. Auth & tenancy — alleen bij ambitie B — **L**

Huidig: **single-DM**, één `DM_PASSWORD` uit env (`config.js`, `routes/auth.js:15`); spelers loggen in met `characterId` + groepswachtwoord (`auth.js:103`). DM en speler kunnen niet tegelijk in dezelfde browser.

Voor **single-instance (A)** is dit prima — niets te doen behalve env-config.

Voor **multi-tenant (B)** nodig:
- DM-**accounts** (identiteit, niet één gedeeld wachtwoord) + sessie met `dmId`.
- **Data-isolatie** uitbreiden: campagnes onder `data/dm/<dmId>/campaigns/<id>/`; AsyncLocalStorage met `dmId`+`campaignId`.
- **Rollen** (eigenaar / co-DM), **speler-uitnodigingen** per campagne (geen globale karakterlijst).
- Login vervangen door account-flow (e-mail/OAuth/API-key).
- AVG/privacy, back-ups per tenant, rate-limiting.

---

## 6. Deployment generiek maken — **S–M**

Nu hardcoded in docs (niet in code): server-IP `46.224.156.154`, domein `grisburgh.nl`, pad `/var/www/grisburgh/`, PM2-naam `grisburgh`, handmatige back-up via SSH (`CLAUDE.md`).
- `.env`: `PORT`, `DM_PASSWORD`, `SESSION_SECRET`, `DATA_DIR`. (Port is al env-baar.)
- **Dockerfile / docker-compose** voor 1-command self-host (volume voor `data/`).
- **Geparametriseerd back-upscript** (campagne-onafhankelijk).
- `README`/deploy-docs ontdaan van Grisburgh-specifieke waarden of als template.

---

## 7. Ruleset & juridisch — **S beslissing, L indien breder**

- **D&D 5e-aannames** zijn diep: 6 ability scores, spell slots, 12 klassen/subklassen, condition-namen, `spellSource:'dnd5e'`. Voor "andere **D&D**-DM's" is dat prima — **niet** generaliseren. Alleen abstraheren als je óók andere systemen (PF, OSR…) wilt → **L**, waarschijnlijk buiten scope.
- **SRD vs PHB (belangrijk bij distributie):** als de app publiek/herbruikbaar wordt, mag alleen **SRD-gelicentieerde** content meegeleverd worden. Controleer dat `class-progression.json` / spreukteksten SRD-veilig zijn (de 2024-PHB-features kunnen problematisch zijn). Eventueel: alleen SRD meeleveren, PHB-content laat de DM zelf invoeren.

---

## Aanbevolen fasering

| Fase | Inhoud | Effort | Resultaat |
|---|---|---|---|
| **A0** | Ambitie kiezen (A vs B); SRD-check (§7) | S | Scope helder |
| **A1** | Lore uit code: diensten hernoembaar + lore-defaults neutraal (§1a pragmatisch), factie/NPC-strings + "Grisburgh"-refs naar config (§1b/c) | M–L | App is lore-vrij in NL |
| **A2** | Valuta + thema configureerbaar (§3a/b), app-identiteit (§3c) | M | DM maakt 'm visueel eigen |
| **A3** | Onboarding-wizard + demo-campagne + README/.env (§4, §6) | M | Nieuwe DM kan zelfstandig starten |
| **A4** | i18n-laag + EN-vertaling (§3d) | L | Internationaal bruikbaar |
| **A5** | Diensten volledig data-driven (§1a volledig) | L | Diensten zonder code toevoegen |
| **B**  | Accounts + multi-tenant + hosting (§5) | XL | Gehoste dienst |

> Snelste zinvolle mijlpaal: **A1 + A2 + A3** → een andere (Nederlandstalige) DM kan de app clonen, een eigen campagne opzetten met eigen naam/valuta/thema/diensten, zonder Grisburgh-lore. A4 voegt Engels toe; B is een apart traject.

---

## Belangrijkste beslissingen (voor de DM)

1. **Ambitie:** zelf-hostbaar (A) of gehoste dienst (B)? Bepaalt of §5 nodig is.
2. **Taal:** NL-only houden, of i18n + Engels (§3d)? Grootste tedious post.
3. **Diensten:** pragmatisch hernoembaar (snel) of volledig data-driven (vrij maar L)?
4. **Distributie/SRD:** publiek herbruikbaar maken? Dan content juridisch schonen (§7).
5. **Valuta/ratio:** alleen namen configureerbaar, of ook denominaties/verhoudingen?

---

## Niet onderschatten

- **i18n** is de grootste verborgen kostenpost (~1.500 strings, client + server).
- **Diensten ontkoppelen** raakt veel bestanden tegelijk — doe het in één samenhangende slag, niet stukje bij beetje (anders blijft de hardcoded lijst op plekken achter).
- **Grisburgh-data** is waardevol als **showcase** — niet weggooien, maar als importeerbare demo bewaren.
- **Versies bumpen / thema bewaken / geen emoji** blijven gelden zolang er aan de bestaande UI geschaafd wordt (`CLAUDE.md`).
