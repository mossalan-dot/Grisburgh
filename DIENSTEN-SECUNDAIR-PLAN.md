# Grisburgh — Secundaire functies per dienst (brainstorm)

> **Brainstormdocument.** Ideeën + globale aanpak, nog géén volledige technische specs.
> Idee: elke dienst krijgt — net als De Magizoöloog (onderzoek + adoptie, zie `HUISDIEREN-PLAN.md`) —
> een **tweede functie** binnen dezelfde dienst: een extra sectie/tab op de dienstpagina met eigen
> DM-config. Volledige bouwplannen (datamodel, endpoints, code-ankers) volgen later, per dienst.

---

## Patroon (geldt voor élke secundaire functie)

- **Plek:** een tweede sectie op de bestaande dienstpagina (toggle "primair / secundair" of twee blokken onder elkaar), niet een nieuwe dienst. Hergebruik het scene-stramien (`herberg-scene` / portret / groet / `ts-beurs`).
- **Server:** een extra `GET`-veld in de bestaande dienst-response + één nieuw `POST`-endpoint voor de actie + uitbreiding van de `PUT /meta/<dienst>` whitelist voor de nieuwe config.
- **DM-config:** uitbreiden van `_render<Dienst>Settings()` in `dm-panel.js`.
- **Afspraken (uit `CLAUDE.md`):** NL UI / Engelse D&D-termen; iconen via `icon()`, **geen emoji**; perkament-thema; **versies bumpen**; **backup spelersdata** vóór serverwijziging die het spelerstabblad raakt; socket altijd `io.to(campaignId).emit(...)`; betaalde/destructieve acties achter `confirm()`.

---

## Stand van zaken — wie heeft al een tweede functie?

| Dienst | Primair | Secundair (bestaand) |
|---|---|---|
| **Tweespalt** (gokhal) | Weddenschappen | ✅ Leensysteem (Taevin Woekeling, 30% rente) |
| **Tempel** | Zegening | ✅ Eed + Vloek/Boete |
| **Heeren van de Nacht** | Klusjes | ✅ Rang/prestige-ladder |
| **Magizoöloog** | Monsteronderzoek | ✅ Adoptie van huisdieren (gepland — `HUISDIEREN-PLAN.md`) |
| **Herberg** | Roddels vragen | ⬜ — **gekozen om uit te werken** |
| **Facties** | Rang/boons bekijken (passief) | ⬜ — **gekozen om uit te werken** |
| **Gock** (detective) | Onderzoek → dossier | ⬜ (idee onderaan) |
| **Ursula** (zieneres) | Voorspelling (5 zintuigen) | ⬜ (idee onderaan) |

Code-ankers van de primaire diensten (voor latere uitwerking):
`herberg` `GET routes/api.js:5780` · `app.js:7768` · DM `dm-panel.js` `_renderHerbergSettings`.
`facties` `GET routes/api.js:5685` (geen eigen render — ingebed in Campagne-UI).

---

## ★ Gekozen om uit te werken

### 1. Herberg — "Kost & Logies"

**In-fictie:** dezelfde waard/herberg (bv. De Swarte Cat). Naast roddels biedt de waard nu eten en een bed.

**Spelersloop (globaal):**
- **Een kamer boeken** → markeert een Long Rest met een tijdelijk voordeel ("well-fed"/uitgerust): bv. eenmalige Inspiration of een kleine bonus tot de volgende Long Rest. Levert een buff-item/notitie in **Boedel**.
- **Een dagschotel kopen** → kortdurend voordeel (sfeer + lichte mechaniek, bv. tijdelijke temp HP of voordeel op één check), eveneens als item in Boedel.

**Kosten/levering:** prijs in florinde (DM-instelbaar per optie); levering via het bestaande "brief/item-naar-Boedel"-mechanisme (`_bezorgBrief` / item toevoegen). Eventueel een dag-cooldown per speler.

**Globale aanpak:**
- *Server:* `GET /herberg` krijgt `logies: { kamerPrijs, schotelPrijs, kamerBuff, schotelBuff, beschikbaar }`. Nieuw `POST /herberg/boek` (modus: `kamer` | `schotel`): saldo-check + betaling + item/buff naar Boedel + socket `player:currency-updated`.
- *Frontend:* tweede blok in `renderHerberg()` ("Kost & Logies") met twee knoppen + `confirm()`.
- *DM-config:* prijzen + buff-omschrijving + aan/uit per optie in `_renderHerbergSettings()`.

**Aandachtspunten:** raakt Boedel/playerItems → **backup vooraf**. Buffs zijn beschrijvend (DM handhaaft de regel), geen automatische mechanica — sluit aan bij de bestaande "geen auto-afhandeling"-lijn.

---

### 2. Facties — "Gunsten & opdrachten"

**In-fictie:** de bestaande facties (adellijk huis, gilde, orde…). De dienst is nu **passief** (je bekíjkt alleen je rang/boons). Doel: er een eigen actieloop aan toevoegen.

**Spelersloop (globaal):**
- **Gunst vragen** → besteed reputatie (of florinde) voor een concrete factie-gunst: korting bij factie-handelaren, toegang tot factie-goederen/locatie, of een eenmalige introductie/aanbeveling.
- **Opdracht aannemen** → een factie-klus (DM-gegenereerd of -gekozen) die bij voltooiing reputatie/rang oplevert — vergelijkbaar met het Heeren-klussysteem, maar "legaal" en factie-specifiek.

**Kosten/levering:** gunsten kosten reputatie of florinde; opdrachten leveren reputatie → kan rang/boons ontgrendelen (bestaande rang-data hergebruiken). Resultaat via brief naar Berichten.

**Globale aanpak:**
- *Server:* `GET /facties` krijgt per factie `gunsten: [...]` + `opdrachten: [...]` + de reputatie/rang van de speler. Nieuw `POST /facties/gunst` en `POST /facties/opdracht` (aannemen) + DM-afhandeling (voltooien → reputatie bijwerken).
- *Frontend:* facties heeft nu geen eigen renderfunctie (ingebed in Campagne-UI) → **eerst beslissen** of dit een eigen dienstpagina/sectie wordt of in de bestaande factie-UI past. Dit is het grootste open punt.
- *DM-config:* gunsten/opdrachten per factie beheren; reputatie-drempels voor rang.

**Aandachtspunten:** overlap met de Heeren-ladder — hergebruik dat patroon i.p.v. dupliceren. Reputatie is een nieuw veld per speler/factie → datamodel zorgvuldig kiezen. Omdat facties nu DM-gestuurd/passief is, is dit de meest ingrijpende van de twee.

---

## Overige ideeën (niet nu uitwerken)

- **Gock — Opsporing & schaduwen:** vermist voorwerp terugvinden of NPC volgen → onthult een locatie op de kaart of levert een bewegingslog. *Alt: discretie/alibi (haak op Heeren).*
- **Ursula — Vloek-lezing & amulet:** detecteer of een speler een curse/brandmerk draagt (sterke lore-haak: Corellins onzichtbare brandmerk uit *Dauwdag*), of koop een beschermend amulet met eenmalig effect → Boedel. *Alt: tarot/droomduiding met een "Lot"-rerolltoken.*

---

## Vervolgstappen

1. Akkoord op de richting van **Herberg — Kost & Logies** en **Facties — Gunsten & opdrachten**.
2. Voor Facties eerst de plek bepalen (eigen dienstpagina vs. bestaande factie-UI) + het reputatie-datamodel.
3. Daarna per dienst een volledig bouwplan (zoals `HUISDIEREN-PLAN.md`): datamodel, endpoints, frontend, code-ankers, testplan.
