# Grisburgh voor meerdere DM's — werkdocument

Status: **plan, nog niets gebouwd.** Bijgewerkt 3 sep 2026.
Dit document leeft naast `CLAUDE.md`; als een stap af is, verhuist de blijvende
kennis daarheen en blijft hier alleen de voortgang staan.

---

## Doel en grenzen

Eerst **één, hooguit twee bevriende DM's** op dezelfde server, gratis, als
playtest. Gaat er iets stuk tijdens hun sessie, dan is dat geen incident maar
feedback — het wordt verwerkt, niet meteen gefikst. Pas na hun playtests komen
er eventueel meer bij.

Bewust **niet** in deze ronde:
- co-DM (speltechnisch onopgelost, niet alleen technisch)
- content delen tussen campagnes (alleen generieke zaken zouden ooit kunnen:
  spreuken, monsters, class features — geen noodzaak nu)
- import van bestaand materiaal (foutgevoelig; handmatig invoeren dus)
- eigen thema of logo per campagne (perkament blijft, take it or leave it)
- Engelse UI — Nederlands is juist het onderscheidende punt
- export/snapshot voor andere DM's

## Vaste keuzes

| Onderwerp | Keuze |
|---|---|
| Tenant | De campagne. Eén DM mag meerdere campagnes hebben, met meerdere groepen. |
| Speler | Per campagne een eigen personage en dus een eigen login; groepswachtwoord blijft (geen accounts, geen e-mail). |
| Wachtwoorden | De nieuwe DM stelt zijn eigen DM- én groepswachtwoorden in. Tabletwachtwoord per campagne. |
| Uitnodigen | Alan maakt de DM handmatig aan. |
| Modules aanzetten | Alleen Alan, stapsgewijs, met uitleg erbij als een module vrijgegeven wordt. |
| Module uit | Verdwijnt volledig uit beeld (geen grijze "binnenkort"-items). |
| Valuta | D&D-generiek: gp/sp/cp als standaard, hernoembaar. Grisburgh houdt Florinde/Knaker/Centeling. |
| URL | `grisburgh.nl/<naam>` per campagne; landingspagina verwijst door. |
| Progressie & spreuken | Nieuwe campagnes krijgen de **structuur** (namen, levels, school, casting time…) zonder beschrijvingen, met een tekstveld dat de DM zelf vult. Per campagne opgeslagen. |
| Backups | Automatisch op de server; als een wijziging andermans content raakt ook handmatig vooraf. Plus een kopie bij Alan. |
| Deploy tijdens andermans sessie | Even afstemmen per app; geen onderhoudsscherm nodig. |
| Tempo | Stapsgewijs, met smoke tests per stap. |

## Modules

**Mee in de startset**

Archief (personages, locaties, organisaties, voorwerpen, documenten) ·
Logboek · Missies · Prikbord (relatiemap) · Kaarten · Spelers & groepen ·
Boedel · Progressie · Spreukenboek · Berichten · Gevecht + encounters +
monsters *(zonder bestiarium-kaartjes; spelers krijgen geen statblocks, alleen
in de testcampagne)* · Tafels · Geluiden · Dobbelstenen · Herberg · Arena
*(nu De Tweespalt)* · Detective *(nu De Gock)* · Rust

**Nog niet mee** — onvoldoende doorontwikkeld of te campagne-eigen:

Tempel · Madame Ursula · Magizoöloog · Facties · Bestiarium · Aktes en de
regie/Meesterkamer-verhaallijn

## Bekende scherven (gevonden in de code, nog niet gefikst)

| Waar | Wat |
|---|---|
| `render-kaart.js:43` | Valt terug op de **ingebouwde** kaart `/assets/map-grisburgh.jpg` zodra een campagne er zelf geen heeft. DM 2 ziet dan Grisburgh's stadskaart met zijn eigen campagnenaam eronder. |
| `routes/api.js`, `lib/character-sheet.js` | Munteenheid Florinde/Knaker/Centeling zit als **fallback in de code**; `meta.json` van Grisburgh heeft helemaal geen `currency`. Moet omgekeerd: expliciet in meta, gp/sp/cp als standaard. |
| `render-relatiemap.js:86`, `index.html:120` | "Jonkers prikbord" — eigennaam uit de campagne, moet "Prikbord". |
| `index.html:6`, `app.js:866` | Hardcoded "Grisburgh" (titel) en "Swarte Cat". |
| `public/data/spells-2024.json` | 539 spreuken, allemaal `source: "phb2024"` — volledige PHB-teksten, geen SRD. Zelfde afweging als bij de progressiebeschrijvingen: naar buiten toe alleen namen + feitelijke velden. |
| `_DIENST_SVC_KEYS` / `_DIENST_AMB_LABELS` / `data-section` | Diensten zijn **vaste secties** met eigen HTML, CSS en endpoints; hun configuratie staat wél al in `meta.json` (naam, afbeeldingen, prijzen), dus hernoemen kan zonder verbouwing. |

## Serverbudget (gemeten 3 sep 2026)

38 GB schijf, 27 GB vrij; 3,8 GB RAM waarvan ~0,5 GB in gebruik. Geheugen is
geen knelpunt. De schijf gaat volledig op aan beeldmateriaal:

- Grisburgh 2,3 GB (waarvan 2,2 GB `files/`, 56 MB thumbnails)
- Prewett 119 MB · Sandbox 52 KB

Richtlijn: ~5 GB vrijhouden voor systeem, logs en backups → ruimte voor acht à
tien campagnes van 2 GB. Aandachtspunt: portretten van 1,5–2 MB terwijl de
thumbnail 600px is. Verkleinen bij upload scheelt een factor honderd.

## Stappen

Elke stap eindigt met: Grisburgh doet nog exact wat het deed.

1. **Isolatie, DM-accounts en `/naam`-routing.**
   Campagne-id uit de URL, gebonden aan de sessie. DM-accounts met gehashte
   wachtwoorden (Alan wordt account nummer één). Tabletwachtwoord per campagne.
   *Harde voorwaarde vooraf:* een testsuite die als DM 2 inlogt en dan probéért
   bij Grisburgh te komen — lezen én schrijven, elk endpoint. Slaagt die aanval
   ergens, dan gaat er niemand op. Na deze stap kan DM 2 er al op, met alles aan.
2. **Backups automatisch.** Dagelijks alle JSON per campagne met rotatie (klein:
   kilobytes) plus een kopie bij Alan. Vóór stap 3, want daarna wordt er aan
   gedeelde code gezeten.
3. **Namen, munten en kaart generiek.** Zie "bekende scherven".
4. **Modules per campagne.** `meta.modules`, gefilterd in zijbalk én
   Meesterkamer. Grisburgh alles op `true` — dat is meteen de smoke test.
5. **Kale progressie en spreuken**, per campagne opgeslagen, met invulvelden.
6. **Wizard + minicampagne.** Campagnenaam → munten → modules → diensten
   hernoemen → kaart uploaden (optioneel) → eerste groep met wachtwoord →
   eerste personage.
7. **Handleiding + visuele rondleiding.** Handleiding te downloaden na de wizard
   en terug te vinden bij Instellingen; functioneel, over spelen, niet over code.
   Rondleiding als doorklikbare pagina met afbeeldingen op een eigen link.
8. **Mediabudget.** Teller per campagne + verkleinen bij upload. Naar voren te
   halen als de schijf eerder knelt.

## Open vragen

1. Landingspagina: ziet iedereen de lijst met campagnes, of alleen wie zijn
   eigen `/naam` kent?
2. Wordt Alan `/grisburgh`? Dan verandert de URL die spelers in hun telefoon
   hebben staan. Alternatief: `grisburgh.nl` zonder pad blijft Grisburgh en
   alleen nieuwe DM's krijgen een pad.
3. Backup naar Alan: script dat hij zelf draait, of automatisch naar iCloud? Hoe
   lang bewaren — dertig dagen?
4. Arena en detective: alleen de naam voor DM 2, of ook de mechaniek eronder
   (arena-gevechten, onderzoeksopdrachten)? Die zijn op Grisburgh geschreven.
5. "Eerste personage" in de wizard: een kaartje in het archief, of meteen een
   speler-personage met profiel en groepskoppeling?
6. Rondleiding: schermafbeeldingen uit Grisburgh (mooier gevuld, maar spoilers
   voor de eigen spelers) of uit de minicampagne?
