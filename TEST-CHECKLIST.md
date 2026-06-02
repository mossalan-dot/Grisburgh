# Test-checklist — wijzigingen vanaf zondag 1 juni 2026

Vink af na handmatig testen op grisburgh.nl. Testlogin: `window.app.testLogin()` → Test McTestface (groep 3).

---

## 1 — Diensten toegang per groep
*Commit: `55da60d`*

- [ ] DM-paneel → groepsinstellingen: schakelaar per dienst (herberg, gock, tweespalt, ursula, tempel) zichtbaar
- [ ] Zet één dienst op "verborgen" voor groep 3 → speler ziet die dienst niet meer in het menu
- [ ] Zet terug op "beschikbaar" → dienst verschijnt weer

---

## 2 — Ursula: voorspelsessie + brief
*Commit: `55da60d`*

**Als speler (Test McTestface):**
- [ ] Navigeer naar Diensten → Madame Ursula
- [ ] Klik "Voorspelling vragen" — er verschijnt een zintuigenformulier (oog, oor, neus, tong, hand)
- [ ] Kies vier zintuigen en bevestig — voorspelling wordt getoond
- [ ] Controleer Berichten-tab: brief van Ursula aanwezig met de voorspelling
- [ ] Brief heeft SVG-iconen (geen emoji) voor de zintuigen

**Als DM:**
- [ ] DM-paneel → voorspellingslog: de gemaakte voorspelling is zichtbaar

---

## 3 — SVG-iconen in berichten-tab en Ursula-dienst
*Commits: `0d6b3a9`, `55da60d`*

- [ ] Ursula-dienst UI: geen emoji zichtbaar (dienst-opties, prijskaartjes)
- [ ] Ursula-brief in berichten-tab: zintuig-iconen zijn SVG (eye, zap, flask-conical, potion, heart)
- [ ] Brievenhoofd (letterhead): dobbelsteensicoon en maansicoon zijn SVG

---

## 4 — Tempel redesign
*Commit: `ca66180`*

**Godlijst (overzicht):**
- [ ] Navigeer naar Diensten → Tempel
- [ ] Ronde avatars per god zichtbaar (of initiaal als er geen portret is)
- [ ] Naam + doméin onder elke god
- [ ] Eed-badge zichtbaar als speler al een eed heeft afgelegd

**Tempel-interieur (na klikken op een god):**
- [ ] Terug-knop linksboven werkt (→ godlijst)
- [ ] Priester-begroeting zichtbaar (of leeg als DM niks heeft ingevuld)
- [ ] Knoppen: **Zegening** en **Eed** aanwezig (geen emoji, SVG-iconen)

**Eed-cinema:**
- [ ] Klik "Eed" → zwart overlay verschijnt
- [ ] Tekst schrijft zich met typewriter-effect
- [ ] Bevestigen / Annuleren knoppen werken
- [ ] Na bevestigen: eed opgeslagen, andere eden geblokkeerd voor deze speler

**Zegening:**
- [ ] Klik "Zegening" → betaling vindt plaats
- [ ] Zegening verschijnt in spelerstabblad → Boedel (onder losse items)

**DM-paneel:**
- [ ] Tempel-instellingen: per god imageId, priestImageId, backdropId, priesterGreet instelbaar

---

## 5 — Knapzak: boedelinventaris verwijderd + navigatiepijltjes
*Commit: `7c5a36d`*

- [ ] Boedel-tabblad: **geen** "Boedelinventaris"-sectie meer zichtbaar
- [ ] Carousel-pijltjes staan **linksboven en rechtsboven** op het kaartje (niet verticaal gecentreerd naast de kaart)
- [ ] Pijltjes blijven op vaste positie, ongeacht kaartvariatie in hoogte
- [ ] Attack/heal damage pills: klikken opent het dobbelsteenpaneel met animatie

---

## 6 — Zeldzaamheid op voorwerpkaartjes
*Commits: `5efc8b0`, `8562703`*

**Archief → Voorwerpen (grid):**
- [ ] Common: subtiele grijze rand
- [ ] Uncommon: groene rand + groene hover-glow
- [ ] Rare: blauwe rand + hover-glow
- [ ] Very Rare: paarse rand + permanente subtiele gloed + shimmer-animatie
- [ ] Legendary: gouden rand + permanente gloed + shimmer
- [ ] Detail-modal: rariteit-tekst in de bijpassende kleur

**Boedel-tabblad (carousel):**
- [ ] Rariteit zichtbaar als gekleurde pill-badge (◆ + label)
- [ ] Very Rare / Legendary: badge heeft een zachte glow

*Testdata: Test McTestface heeft 5 testvoorwerpen met elke zeldzaamheid (Common t/m Legendary)*

---

## 7 — Skill trees (Progressie-tabblad)
*Commits: `2d0dbe1` t/m `7c529c3`*

**Basisweergave:**
- [ ] Nieuw tabblad "Progressie" zichtbaar in spelerstabblad (tussen Boedel en Spreukenboek)
- [ ] Tijdlijn toont klasse-features voor Test McTestface (Wizard L7)
- [ ] Subklasse-features (Evoker) correct gelabeld met "subklasse"-tag
- [ ] Human soort-traits (Resourceful, Skillful, Versatile) zichtbaar
- [ ] Vergrendelde levels (>7) zijn visueel gedimmed

**Categorie-iconen:**
- [ ] Geen emoji — alle categorieën tonen SVG-iconen (zap, heart, shield, crossed-swords, etc.)

**Kaartweergave:**
- [ ] Schakel naar kaarten-view (tweede knop rechtsboven in het tabblad)
- [ ] Kaartjes getoond per feature, vergrendelde kaartjes hebben slot-indicator
- [ ] Favorieten-ster werkt (☆ → ★, blijft na herladen)

**Feature-detail (modal):**
- [ ] Klik op een kaartje/tijdlijn-feature → modal opent met beschrijving
- [ ] Favoriet-knop in modal werkt

**DM-editor:**
- [ ] Ingelogd als DM: "✏️ Bewerk"-knop zichtbaar in Progressie-tab
- [ ] Editor opent: klassen en soorten links, features rechts
- [ ] Nieuwe klasse aanmaken werkt
- [ ] Feature toevoegen aan bestaande klasse werkt
- [ ] Opslaan → verandering zichtbaar bij herlaad

---

## 8 — Keuze-registratie bij features
*Commit: `4849ea4`*

- [ ] "Ability Score Improvement" in de tijdlijn heeft een invoerveld "Noteer jouw keuze…"
- [ ] Typ een waarde (bijv. "+2 Intelligence") → veld opslaan (klik ergens anders)
- [ ] Herlaad de pagina → keuze is bewaard
- [ ] Kaartweergave: de ingevulde keuze toont als donkere chip op het kaartje
- [ ] Detail-modal: "Jouw keuze"-sectie met invoerveld onderaan
- [ ] Locked features (niveau nog niet bereikt): invoerveld is uitgeschakeld (grijs)

---

*Bijgewerkt: 2 juni 2026 — alle bovenstaande wijzigingen zijn live op grisburgh.nl*
