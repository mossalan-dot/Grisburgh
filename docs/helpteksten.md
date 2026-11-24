_155 sleutels · 31 aangepast in **grisburgh** · rest is de standaard uit de code._

# Helpteksten

Gegenereerd met `node scripts/helpteksten.js grisburgh`.

Pas de tekst hieronder aan en voer hem terug met:

```bash
node scripts/helpteksten.js grisburgh --lees docs/helpteksten.md            # tonen wat er verandert
node scripts/helpteksten.js grisburgh --lees docs/helpteksten.md --schrijf  # doorvoeren
```

**Wat je mag wijzigen:** de regel achter `Titel:` en de tekst onder elke `###`-kop.
Laat de `##`-regel met de sleutel staan — daar wordt op gematcht. De `>`-regels zijn
aantekeningen en worden genegeerd, net als de `#`-koppen die de hoofdstukken maken.
Markdown in de tekst mag: `**vet**`, `*cursief*`, en `[[Naam]]` wordt een link naar
een kaartje.

Achter een `###`-kop mag `{alleen jij}` of `{alleen spelers}` staan: die stap komt dan
alleen in het boekje van die rol. Zonder merkteken leest iedereen hem.

Elke `###`-kop is één **stap**: de uitleg bladert erdoorheen met pijltjes. Een stap
erbij zetten of weghalen mag, zolang er minstens één overblijft.

Teksten die gelijk blijven aan de standaard worden **niet** vastgelegd in deze campagne,
zodat latere verbeteringen in de code vanzelf doorkomen.

## Waar je aan zou beginnen

> Deze lijst is afgeleid, niet gekozen: hij wijst alleen aan waar de vorm uiteenloopt.

- **155 boekjes, 584 stappen, 26696 woorden.** Gemiddeld 3.8 stap per boekje en 46 woorden per stap.
- **3 boekjes van één stap.** Vaak één zin die alleen zegt wát het scherm is. Wat kun je er doen, en waar klik je? — `hulp_kijk_personages_sheet`, `party`, `personage_wildmagic`
- **2 met meer dan 90 woorden per stap.** Een stap is een schermpje om doorheen te bladeren; daar past geen alinea in. — `dm_verzoeken_personage`, `hulp_heldenboek_editor`

---

## Inhoud

**Je eerste avond** · 1

- [`wizard`](#wizard) — De opstartwizard · 7 stappen, 315 w · _aangepast_

**Het spelerstabblad** · 26

- [`party`](#party) — Party · 1 stap, 33 w · _aangepast_
- [`stemronde`](#stemronde) — Het mooiste moment van de avond · 4 stappen, 133 w · _aangepast_
- [`personage`](#personage) — Mijn personage · 4 stappen, 147 w · _aangepast_
- [`gedaante`](#gedaante) — Je gedaante · 2 stappen, 77 w · _aangepast_
- [`personage_hp`](#personage_hp) — HP · 4 stappen, 134 w · _aangepast_
- [`personage_statussen`](#personage_statussen) — Actieve statussen · 2 stappen, 61 w · _aangepast_
- [`rage`](#rage) — Rage · 4 stappen, 110 w · _aangepast_
- [`klassekracht`](#klassekracht) — Klassekrachten · 11 stappen, 457 w · _aangepast_
- [`dagkeuze`](#dagkeuze) — Je keuze van vandaag · 2 stappen, 87 w · _aangepast_
- [`summons`](#summons) — Opgeroepen · 4 stappen, 133 w
- [`personage_wildmagic`](#personage_wildmagic) — Wild Magic Surge · 1 stap, 39 w · _aangepast_
- [`personage_stats`](#personage_stats) — Gevechtswaarden · 4 stappen, 149 w
- [`personage_wapens`](#personage_wapens) — Weapons & Damage Cantrips · 4 stappen, 122 w
- [`personage_abilities`](#personage_abilities) — Ability Scores · 2 stappen, 58 w
- [`personage_skills`](#personage_skills) — Skills · 3 stappen, 71 w
- [`personage_proficiencies`](#personage_proficiencies) — Proficiencies · 2 stappen, 60 w
- [`personage_talen`](#personage_talen) — Languages & Senses · 2 stappen, 54 w
- [`personage_tap`](#personage_tap) — Aan de tap · 2 stappen, 55 w
- [`personage_emotes`](#personage_emotes) — Emotes · 2 stappen, 51 w
- [`personage_wiejebent`](#personage_wiejebent) — Wie je bent · 2 stappen, 60 w
- [`knapzak`](#knapzak) — Boedel · 4 stappen, 126 w · _aangepast_
- [`progressie`](#progressie) — Features & Traits · 3 stappen, 101 w · _aangepast_
- [`spreukenboek`](#spreukenboek) — Spreukenboek · 3 stappen, 128 w · _aangepast_
- [`spreuken_toevoegen`](#spreuken_toevoegen) — _geen titel_ · 0 stappen, 0 w
- [`spreukenboek_boek`](#spreukenboek_boek) — Het opengeslagen boek · 4 stappen, 245 w · _aangepast_
- [`spreukenboek_inhoud`](#spreukenboek_inhoud) — Inhoudsopgave · 2 stappen, 100 w · _aangepast_

**Het archief** · 6

- [`personages`](#personages) — Personages · 5 stappen, 162 w · _aangepast_
- [`locaties`](#locaties) — Locaties · 5 stappen, 174 w · _aangepast_
- [`organisaties`](#organisaties) — Organisaties · 5 stappen, 145 w · _aangepast_
- [`voorwerpen`](#voorwerpen) — Voorwerpen · 7 stappen, 242 w · _aangepast_
- [`documenten`](#documenten) — Documenten · 5 stappen, 145 w · _aangepast_
- [`bestiarium`](#bestiarium) — Bestiarium · 2 stappen, 76 w · _aangepast_

**Een kaartje bekijken** · 8

- [`hulp_kijk_personages_info`](#hulp_kijk_personages_info) — Dit personage · 6 stappen, 396 w · _aangepast_
- [`hulp_kijk_personages_sheet`](#hulp_kijk_personages_sheet) — Het blad · 1 stap, 43 w
- [`hulp_kijk_locaties_info`](#hulp_kijk_locaties_info) — Deze plek · 3 stappen, 122 w
- [`hulp_kijk_locaties_kaart`](#hulp_kijk_locaties_kaart) — Waar ligt dit · 2 stappen, 72 w
- [`hulp_kijk_locaties_voorraad`](#hulp_kijk_locaties_voorraad) — De voorraad · 2 stappen, 71 w
- [`hulp_kijk_organisaties_info`](#hulp_kijk_organisaties_info) — Deze organisatie · 2 stappen, 102 w
- [`hulp_kijk_organisaties_organogram`](#hulp_kijk_organisaties_organogram) — Organogram · 2 stappen, 56 w
- [`hulp_kijk_voorwerpen_info`](#hulp_kijk_voorwerpen_info) — Dit voorwerp · 2 stappen, 67 w

**Een kaartje bewerken** · 9

- [`hulp_bewerk_personages_info`](#hulp_bewerk_personages_info) — Een personage · 7 stappen, 436 w
- [`hulp_bewerk_personages_sheet`](#hulp_bewerk_personages_sheet) — Statblock · 4 stappen, 221 w
- [`hulp_bewerk_locaties_info`](#hulp_bewerk_locaties_info) — Een locatie · 5 stappen, 281 w
- [`hulp_bewerk_locaties_kaart`](#hulp_bewerk_locaties_kaart) — Kaart & dungeon · 3 stappen, 126 w
- [`hulp_bewerk_locaties_winkel`](#hulp_bewerk_locaties_winkel) — De winkel · 6 stappen, 352 w
- [`hulp_bewerk_organisaties_info`](#hulp_bewerk_organisaties_info) — Een organisatie · 5 stappen, 276 w
- [`hulp_bewerk_organisaties_organogram`](#hulp_bewerk_organisaties_organogram) — Organogram · 3 stappen, 151 w
- [`hulp_bewerk_voorwerpen_info`](#hulp_bewerk_voorwerpen_info) — Een voorwerp · 6 stappen, 308 w
- [`hulp_bewerk_beeld`](#hulp_bewerk_beeld) — Beeld · 3 stappen, 103 w

**Naslag** · 4

- [`vaardigheden`](#vaardigheden) — Naslag · 7 stappen, 441 w
- [`hulp_heldenboek_kaart`](#hulp_heldenboek_kaart) — Een kaart bewerken · 5 stappen, 340 w
- [`hulp_heldenboek_editor`](#hulp_heldenboek_editor) — Iets toevoegen aan de naslag · 10 stappen, 993 w
- [`spreuken`](#spreuken) — Spreuken — de bibliotheek · 6 stappen, 311 w · _rolverdeling_

**Avontuur** · 8

- [`logboek`](#logboek) — Logboek · 3 stappen, 108 w
- [`prikbord`](#prikbord) — Het prikbord · 3 stappen, 121 w
- [`kaart`](#kaart) — De kaart · 2 stappen, 76 w
- [`hulp_kaart_wereld`](#hulp_kaart_wereld) — Een kaart bewerken · 2 stappen, 62 w
- [`dungeon`](#dungeon) — Dungeonkaarten · 9 stappen, 395 w · _rolverdeling_
- [`hulp_kaart_dungeon`](#hulp_kaart_dungeon) — Een dungeon bewerken · 3 stappen, 128 w
- [`hulp_dungeon_nieuw`](#hulp_dungeon_nieuw) — Een nieuwe dungeonkaart · 5 stappen, 198 w
- [`bastion`](#bastion) — Het bastion · 11 stappen, 886 w · _rolverdeling_

**De diensten** · 10

- [`markt`](#markt) — De Markt · 4 stappen, 177 w
- [`winkel`](#winkel) — In de winkel · 6 stappen, 202 w
- [`magizoo`](#magizoo) — Vivarius · 4 stappen, 184 w · _aangepast_
- [`herberg`](#herberg) — De Swarte Cat · 4 stappen, 175 w · _aangepast_
- [`tweespalt`](#tweespalt) — De Tweespalt · 4 stappen, 169 w · _aangepast_
- [`tempel`](#tempel) — De Tempel · 4 stappen, 167 w · _aangepast_
- [`ursula`](#ursula) — Madame Ursula · 3 stappen, 115 w · _aangepast_
- [`gock`](#gock) — Juliaan de Gock · 3 stappen, 94 w · _aangepast_
- [`woekeraar`](#woekeraar) — De geldschieter · 4 stappen, 151 w
- [`facties`](#facties) — Facties & aanzien · 5 stappen, 212 w · _aangepast_

**Het gevecht** · 1

- [`gevecht`](#gevecht) — Gevecht · 2 stappen, 64 w

**De meesterkamer** · 39

- [`akte_schrijven`](#akte_schrijven) — Een akte schrijven · 7 stappen, 512 w
- [`dm_checklist`](#dm_checklist) — Klaar om te spelen? · 3 stappen, 162 w
- [`dm_terugblik`](#dm_terugblik) — Wat voorafging · 5 stappen, 276 w
- [`dm_tafelscherm_fx`](#dm_tafelscherm_fx) — Effecten op het tafelscherm · 5 stappen, 220 w
- [`hulp_muziek`](#hulp_muziek) — Muziek uit Spotify · 6 stappen, 308 w
- [`dm_gevecht`](#dm_gevecht) — Gevechten en monsters · 3 stappen, 65 w · _aangepast_
- [`dm_gevecht_editor`](#dm_gevecht_editor) — Een gevecht bouwen · 7 stappen, 434 w
- [`dm_loot_vondsten`](#dm_loot_vondsten) — De vondsten · 3 stappen, 130 w
- [`dm_loot_editor`](#dm_loot_editor) — Een vondst maken · 7 stappen, 343 w
- [`dm_loot_goud`](#dm_loot_goud) — Goud in een vondst · 3 stappen, 130 w
- [`dm_loot_sjablonen`](#dm_loot_sjablonen) — Oude sjablonen · 2 stappen, 68 w
- [`dm_loot_deelnemers`](#dm_loot_deelnemers) — Wie deelt mee · 2 stappen, 58 w
- [`dm_loot_uitslag`](#dm_loot_uitslag) — De uitslag · 3 stappen, 84 w
- [`dm_rust_starten`](#dm_rust_starten) — Rust starten · 3 stappen, 123 w
- [`dm_rust_sfeer`](#dm_rust_sfeer) — Sfeer & gebeurtenissen · 3 stappen, 112 w
- [`dm_tafels_tabellen`](#dm_tafels_tabellen) — Tabellen · 4 stappen, 127 w
- [`dm_tafels_namen`](#dm_tafels_namen) — Namen trekken · 3 stappen, 105 w
- [`dm_tafels_weer`](#dm_tafels_weer) — Het weer · 2 stappen, 63 w
- [`dm_geluiden_standaard`](#dm_geluiden_standaard) — Vaste geluiden · 4 stappen, 101 w
- [`dm_geluiden_diensten`](#dm_geluiden_diensten) — Geluid per dienst · 3 stappen, 113 w
- [`dm_geluiden_facties`](#dm_geluiden_facties) — Sfeerloop per factie · 2 stappen, 58 w
- [`dm_geluiden_rust`](#dm_geluiden_rust) — Geluid bij de rust · 2 stappen, 56 w
- [`dm_geluiden_condities`](#dm_geluiden_condities) — Conditiegeluiden · 3 stappen, 80 w
- [`dm_geluiden_fx`](#dm_geluiden_fx) — Klanken bij een effect · 3 stappen, 138 w
- [`dm_geluiden_decors`](#dm_geluiden_decors) — Decors · 3 stappen, 115 w
- [`dm_geluiden_spelers`](#dm_geluiden_spelers) — Spelersgeluiden · 3 stappen, 89 w
- [`dm_post_brief`](#dm_post_brief) — Een brief sturen · 5 stappen, 224 w
- [`dm_post_geschiedenis`](#dm_post_geschiedenis) — Verstuurde post · 2 stappen, 48 w
- [`dm_gunnen`](#dm_gunnen) — Gunnen · 5 stappen, 201 w
- [`dm_verzoeken_personage`](#dm_verzoeken_personage) — Een nieuw personage · 3 stappen, 315 w
- [`dm_verzoeken_multiclass`](#dm_verzoeken_multiclass) — Multiclass-verzoeken · 3 stappen, 90 w
- [`dm_verzoeken_spreuken`](#dm_verzoeken_spreuken) — Spreukverzoeken · 2 stappen, 87 w
- [`dm_verzoeken_voorwerpen`](#dm_verzoeken_voorwerpen) — Voorwerpverzoeken · 2 stappen, 66 w
- [`dm_verzoeken_verkoop`](#dm_verzoeken_verkoop) — Aangeboden aan een winkel · 3 stappen, 115 w
- [`dm_verzoeken_lening`](#dm_verzoeken_lening) — Wil lenen · 4 stappen, 133 w
- [`dm_verzoeken_onderpand`](#dm_verzoeken_onderpand) — Onderpand · 3 stappen, 114 w
- [`dm_verzoeken_onderzoek`](#dm_verzoeken_onderzoek) — Onderzoeksdossiers · 2 stappen, 65 w
- [`dm_toegang_diensten`](#dm_toegang_diensten) — Diensten per party · 3 stappen, 94 w
- [`dm_toegang_facties`](#dm_toegang_facties) — Facties per party · 2 stappen, 60 w

**De meesterkamer: de diensten instellen** · 30

- [`dm_dienst_algemeen`](#dm_dienst_algemeen) — Algemeen · 4 stappen, 137 w
- [`dm_markt`](#dm_markt) — De Markt · 3 stappen, 111 w
- [`dm_markt_winkels`](#dm_markt_winkels) — Winkels · 3 stappen, 106 w
- [`dm_markt_gebieden`](#dm_markt_gebieden) — Gebieden · 3 stappen, 110 w
- [`dm_magizoo`](#dm_magizoo) — De magizoöloog · 2 stappen, 70 w
- [`dm_magizoo_adoptie`](#dm_magizoo_adoptie) — Adoptie · 3 stappen, 110 w
- [`dm_herberg_tap`](#dm_herberg_tap) — Aan de tap · 4 stappen, 173 w
- [`dm_herberg_rust`](#dm_herberg_rust) — Overnachten · 2 stappen, 92 w
- [`dm_gokhuis`](#dm_gokhuis) — Het gokhuis · 3 stappen, 130 w
- [`dm_gokhuis_beheer`](#dm_gokhuis_beheer) — Gokken · 6 stappen, 258 w
- [`dm_gokhuis_partijen`](#dm_gokhuis_partijen) — Strijdperk — partijen · 4 stappen, 144 w
- [`dm_gokhuis_inschrijvingen`](#dm_gokhuis_inschrijvingen) — In het strijdperk · 3 stappen, 120 w
- [`dm_gokhuis_event`](#dm_gokhuis_event) — Een event aanmaken · 2 stappen, 43 w
- [`dm_tempel`](#dm_tempel) — De tempel · 2 stappen, 64 w
- [`dm_tempel_goden`](#dm_tempel_goden) — Goden · 7 stappen, 245 w
- [`dm_tempel_eden`](#dm_tempel_eden) — Actieve eden & vloeken · 2 stappen, 60 w
- [`dm_tempel_prijzen`](#dm_tempel_prijzen) — Standaardprijzen · 2 stappen, 68 w
- [`dm_waarzegger`](#dm_waarzegger) — De waarzegger · 2 stappen, 59 w
- [`dm_waarzegger_akte`](#dm_waarzegger_akte) — Voorspellingen per akte · 4 stappen, 185 w
- [`dm_detective`](#dm_detective) — De detective · 4 stappen, 164 w
- [`dm_detective_geruchten`](#dm_detective_geruchten) — Praatjes om rond te laten gaan · 5 stappen, 197 w
- [`dm_woekeraar`](#dm_woekeraar) — De geldschieter · 3 stappen, 184 w
- [`dm_woekeraar_voorwaarden`](#dm_woekeraar_voorwaarden) — Wat hij vraagt · 3 stappen, 99 w
- [`dm_woekeraar_escalatie`](#dm_woekeraar_escalatie) — Als er niet betaald wordt · 5 stappen, 172 w
- [`dm_woekeraar_brieven`](#dm_woekeraar_brieven) — Wat hij schrijft · 4 stappen, 324 w
- [`dm_woekeraar_ontspan`](#dm_woekeraar_ontspan) — Wie hem kan stoppen · 3 stappen, 90 w
- [`dm_woekeraar_register`](#dm_woekeraar_register) — Schulden · 6 stappen, 301 w
- [`dm_facties`](#dm_facties) — Facties · 8 stappen, 482 w
- [`dm_facties_rangen`](#dm_facties_rangen) — Rangen · 7 stappen, 441 w
- [`dm_facties_leden`](#dm_facties_leden) — Leden van een factie · 3 stappen, 162 w

**Instellingen** · 13

- [`inst_onderdelen`](#inst_onderdelen) — Onderdelen van deze campagne · 3 stappen, 223 w
- [`inst_campagne`](#inst_campagne) — De campagne · 3 stappen, 176 w
- [`inst_valuta`](#inst_valuta) — Namen voor valuta · 3 stappen, 138 w
- [`inst_levelup`](#inst_levelup) — Level omhoog · 4 stappen, 203 w
- [`inst_materiaal`](#inst_materiaal) — Material components · 2 stappen, 152 w
- [`inst_personage`](#inst_personage) — Zelf een personage maken · 9 stappen, 746 w
- [`inst_gevecht`](#inst_gevecht) — In het gevecht · 5 stappen, 297 w
- [`inst_heldenboek`](#inst_heldenboek) — Wat spelers in de naslag zien · 3 stappen, 171 w
- [`inst_bastion`](#inst_bastion) — Bastion · 3 stappen, 114 w
- [`inst_partys`](#inst_partys) — Party's · 7 stappen, 367 w
- [`inst_beheer`](#inst_beheer) — Beheer · 4 stappen, 177 w
- [`inst_campagnes`](#inst_campagnes) — Campagnes en modules · 4 stappen, 160 w
- [`inst_export`](#inst_export) — Export & backup · 4 stappen, 187 w

---

# Je eerste avond

Het enige boekje dat een DM ziet vóórdat er iets staat. Toon: hij heeft nog niets en moet weten waar hij begint.

## `wizard`

> Helpknop in: wizard.js:391
> Nu: **aangepast in deze campagne**
> 7 stappen · 315 woorden · 45 per stap
> De standaard telt 10 stap(pen).

Titel: De opstartwizard

### Wizard

Een nieuwe campagne is leeg en de keuzes die ertoe doen staan verspreid. Deze wizard loopt ze één keer langs en in de volgorde waarin je ze nodig hebt. 

Geen enkele stap is verplicht. Wat je overslaat vind je terug bij **Instellingen** en **Diensten**. De wizard zelf staat daar ook, onder *Opstartwizard doorlopen*.

### Een waarschuwing over party's

Deel je party's in zoals je ze aan tafel speelt. Een personage verhuizen kan later wel, maar alles wat de **party** over de wereld weet blijft achter. Twee party's samenvoegen kan helemaal niet.

### Beschikbare onderdelen

De beheerder bepaalt welke onderdelen voor deze campagne **vrij** te gebruiken zijn. Daarbinnen kies je zelf wat je gebruikt: in de wizard en later bij *Instellingen → Campagne*.

### Valuta

De app volgt de bestaande valutaverhoudingen: 1 gold piece = 10 silver pieces = 100 copper pieces. Alleen de namen van de munten kun je bepalen.

**Electrum en platinum** hebben in de beurs geen eigen plek: de app rekent ze om bij het invoeren (1 EP = 5 SP, 1 PP = 10 GP). Een *vondst* noemt ze wél bij naam.

### Gevechtsinformatie

Hier bepaal je hoeveel informatie je spelers zien tijdens een gevecht. Het gaat om drie standen, van weinig naar veel. 

- **Minimale informatie**: spelers zien of de tegenstander nog bij bewustzijn is, verder niets. 
- **Omschrijvingen**: spelers krijgen omschrijvingen te zien, zoals ongedeerd, geschramd, gehavend en zwaar gewond. Je spelers voelen het verloop zonder te rekenen. Dit is de standaard. 
- **Exacte getallen**: spelers zien de HP van elke tegenstander.

Welke informatie een party in het **bestiarium** heeft, gaat altijd voor.

### Afbeeldingen importeren

Je kunt hier kiezen of je de afbeeldingen van zaken uit het naslagwerk (classes, subclasses, species, backgrounds, features, feats, spells) overneemt of zelf afbeeldingen toevoegt.

Je kunt de bestaande afbeeldingen later alsnog importeren via *Instellingen → Campagne*.

### Later bekijken

Alles uit de wizard staat bij **Instellingen**, en de namen van je diensten bij **Diensten**. Onderdelen aan- of uitzetten kan daar ook.

---

# Het spelerstabblad

De zes subtabs van een speler, in de volgorde waarin ze op het scherm staan: Party · Personage · Boedel · Progressie · Spreukenboek. Toon: je legt iets uit aan iemand die het spel spéélt, niet aan iemand die het maakt — dus geen instellingen en geen "je bepaalt".

## `party`

> Helpknop in: app.js:9295
> Nu: **aangepast in deze campagne**
> 1 stap · 33 woorden · 33 per stap
> De standaard telt 4 stap(pen).

Titel: Party

### Party

Dit tabblad toont de andere leden van jouw party. Je kunt zien wie aanwezig en afwezig is voor de sessie. Je ziet hier ook je tijdelijke metgezellen, summons en familiars en gevangengenomen tegenstanders.

---

## `stemronde`

> Helpknop in: stemronde.js:150, stemronde.js:150
> Nu: **aangepast in deze campagne**
> 4 stappen · 133 woorden · 33 per stap
> De standaard telt 4 stap(pen).

Titel: Het mooiste moment van de avond

### Stemronde

Aan het eind van een sessie stemt iedere speler welk moment het mooiste was: een vondst, een grap, een sprong van het dak. Op jezelf stemmen kan niet. De winnaar krijgt **Heroic Inspiration**. Op het tafelscherm is je ingezonden motivatie te lezen.

### How do you want to do this?

Wie vanavond een genadeslag uitdeelde ("How do you want to do this?"), staat als geheugensteun onder de kandidaten.

### Anoniem

Je ziet hoeveel spelers er gestemd hebben, maar niet wie op wie. De motivaties komen bij de uitslag naamloos en door elkaar op tafel.

### Sluiten

Je sluit de ronde wanneer je dat wilt. Wie dan nog niet stemde, telt niet mee. Bij een **gelijke stand** kies jij wie wint. Had de winnaar al Heroic Inspiration, dan zegt de melding dat. De speler mag de **Heroic Inspiration** dan doorgeven. **Afbreken** sluit de module zonder winnaar.

---

## `personage`

> Helpknop in: app.js:9441
> Nu: **aangepast in deze campagne**
> 4 stappen · 147 woorden · 37 per stap
> De standaard telt 4 stap(pen).

Titel: Mijn personage

### Je blad

Alles wat je tijdens een sessie bij de hand wilt hebben: je HP, wapens, ability scores en conditions. Elk blok heeft rechtsboven een eigen boekje met uitleg over dát blok.

### Wat je zelf invult

De witte vakjes kun je zelf invullen en aanpassen. Wat de app uit je class, level en scores kan afleiden, wordt voor je ingevuld. Je mag dat altijd handmatig veranderen.

### Je DM kijkt mee

Je HP, conditions en wild shapes gaan meteen naar het scherm van je DM en naar het scherm op tafel. De DM kan je HP en conditions aanpassen. Je hoeft dus nergens in de app aan te geven dat je geraakt bent.

### Level en multiclass

Je **level** en je **multiclass** wordt gecontroleerd door je DM. Een level komt erbij via *Level omhoog*, een tweede class via een verzoek bij die level-up. Je **subclass** kies je zelf, één keer. Daarna staat dat vast en kan alleen je DM het nog omzetten.

---

## `gedaante`

> Helpknop in: klassekracht.js:107
> Nu: **aangepast in deze campagne**
> 2 stappen · 77 woorden · 39 per stap
> De standaard telt 4 stap(pen).

Titel: Je gedaante

### Wild shape

Zolang je in een ander gedaante verkeert, staat er een melding bovenaan je blad, met de waarden van het dier naast die van je personage. Zo hoef je nergens te zoeken wat er nu geldt. Met **Terug** verander je weer in jezelf.

### Wat is wat?

Bij wild shape neem je de AC, speed, Strength, Dexterity, Constitution en actions over van het dier waarin je verandert. Je HP, Hit Dice, Intelligence, Wisdom en Charisme en je class features neem je mee.

---

## `personage_hp`

> Helpknop in: app.js:9456
> Nu: **aangepast in deze campagne**
> 4 stappen · 134 woorden · 34 per stap
> De standaard telt 4 stap(pen).

Titel: HP

### Je levenspunten

Met **+** en **−** houd je bij hoeveel HP je nog hebt; het getal rechts is je maximum. Je portret kleurt mee. Zo weet de party hoe je ervoor staat, zonder dat iemand het hoeft te vragen.

### Temporary HP

Een speler kan Temporary HP krijgen. Dat is een aparte buffer die als eerste wordt geraakt. Temporary HP **stapelt niet**: krijg je een nieuwe hoeveelheid, dan geldt de hoogste van de twee. Een Long Rest verwijdert Temporary HP.

### Hit Dice

De bolletjes zijn je Hit Dice, afgeleid uit je class en level. Bij een Short Rest zet je Hit Dice in om te genezen. Een Long Rest geeft je Hit Dice terug.

### Exhaustion

Zes bolletjes die je DM aanvinkt. De app telt ze alleen: wat een niveau met je doet, geldt aan tafel. Elke Long Rest haalt er een af.

---

## `personage_statussen`

> Helpknop in: app.js:9522
> Nu: **aangepast in deze campagne**
> 2 stappen · 61 woorden · 31 per stap
> De standaard telt 2 stap(pen).

Titel: Actieve statussen

### Conditions

Elke condition die op je portret staat — Poisoned, Prone, Concentration, maar ook iets wat je zelf aanzette zoals Raging. Tik er een aan en je leest wat het doet.

### Wie ze zet

Meestal worden conditions door je DM ingesteld, vanuit het gevecht. Een paar zet je zelf aan door iets te doen: in Rage gaan, Wild Shape gebruiken, een spell die Concentration vereist.

---

## `rage`

> Helpknop in: rage.js:90
> Nu: **aangepast in deze campagne**
> 4 stappen · 110 woorden · 28 per stap
> De standaard telt 7 stap(pen).

Titel: Rage

### Rage!

Druk op Rage en je voelt de woede opborrelen. De app streept een use af en zet *Raging* op je token als er gevochten wordt. Zolang je raast staat er een rode rand om je scherm en zie je onder de knop wat er nu voor je geldt.

### Wat de app niet doet

De app berekent geen worpen voor je. Rage Damage, Advantage op Strength en de Resistance staan uitgelegd, maar optellen doe je zelf.

### Terugkrijgen

Na een **Short Rest** krijg je één use terug, na een **Long Rest** alles. Hoeveel je er hebt groeit met je level.

### Concentration

Wie in Rage gaat verliest zijn Concentration. Stond die op je portret, dan haalt de app hem weg.

---

## `klassekracht`

> Helpknop in: klassekracht.js:364
> Nu: **aangepast in deze campagne**
> 11 stappen · 457 woorden · 42 per stap
> De standaard telt 13 stap(pen).

Titel: Klassekrachten

### Class features

Iedere class heeft een onderscheidende feature. Druk op deze kracht en de app streept af wat het kost, doet wat er standaard te doen valt (genezen, een slot terugzetten, een toestand op je portret) en laat het op het tafelscherm zien. Aanvallen en saves gooi je nog steeds zelf.

Onder elke teller staat wat een **Short Rest** teruggeeft. Een **Long Rest** zet alles terug.

### Subclasses

Heeft je subclass iets dat aan tafel belangrijk is, dan staat het onder een eigen kopje met zijn naam: de **Superiority Dice** en manoeuvres van een Battle Master, de **Psionic Energy Dice** van een Psi Warrior of Soulknife, **Portent** van een Diviner, de **Arcane Ward** van een Abjurer, **Warrior of the Gods** van een Zealot, en de **Channel Divinity**-opties van elk domein en elke eed van een Cleric. Een subclass die alleen een vaste bonus geeft, heeft geen aparte knop nodig en staat er dus niet.

### Emotes

Heb je bepaalde emotes, dan kun je onder **Klanken** per kracht een emote kiezen. Die klinkt op het tafelscherm zodra je de kracht gebruikt.

### Bard

Een Bard kan iemand uit de party **Bardic Inspiration** geven. Die staat dan bovenaan zíjn blad met de knop **Gebruiken**. Na zijn eerste worp tikt hij erop, de dobbelsteen rolt en iedereen ziet wat erbij komt. Een speler kan maar een Bardic Inspiration hebben.

### Cleric en Paladin

**Divine Spark** geneest of doet schade. **Turn Undead** en **Divine Sense** tonen de DC en het bereik.  **Divine Smite** kost een spell slot naar keuze en rolt de Radiant damage.

### Druid

Een Druid kent een beperkt aantal Beast-gedaantes. Dat is gekoppeld aan bepaalde regels. Kies ze onder **Bekende gedaantes**; filter daar op de omgeving waar een beest leeft (Arctic, Forest, Underwater). Na een Long Rest mag je er een wisselen.

### Druid: Wild Shape

Kies een van je bekende gedaantes. De omgeving kleurt het moment op het tafelscherm. Je krijgt je Temporary HP, je token draagt Wild Shape, en het blijft staan tot je het beëindigt.

### Fighter en Monk

**Second Wind** rolt je genezing. **Action Surge** en **Indomitable** tellen af en laten de tafel zien wat er gebeurt. Een Monk geeft zijn Focus Points uit aan **Flurry of Blows**, **Patient Defense**, **Step of the Wind** en **Stunning Strike**

### Ranger en Rogue

**Hunter's Mark** is bedoeld voor één vijand uit het lopende gevecht. Het merkteken staat op zijn token en jouw Concentration op de jouwe. Als het gevecht afloopt vervalt het. **Sneak Attack** rolt je extra dice in één keer.

### Sorcerer

**Innate Sorcery** loopt één minuut en eindigt vanzelf met het gevecht. **Metamagic** vraagt welke optie en rekent de kosten af. Met **Font of Magic** verander je een spell slot in punten of andersom.

### Warlock, Wizard en Artificer

**Eldritch Blast** rolt elke blast apart. **Magical Cunning** haalt de helft van je Pact Magic-slots terug. **Arcane Recovery**: kies zelf welke slots, samen niet meer dan het budget.

---

## `dagkeuze`

> Helpknop in: dagkeuze.js:50
> Nu: **aangepast in deze campagne**
> 2 stappen · 87 woorden · 44 per stap
> De standaard telt 2 stap(pen).

Titel: Je keuze van vandaag

### Eén keuze per dag

Sommige class features laten je bij een Long Rest iets kiezen dat de hele dag geldt. Wat je koos staat hier, zodat je er niet naar hoeft te zoeken.

## `summons


Titel: Opgeroepen

### Summons en familiars

Alles wat je zelf hebt opgeroepen: een familiar, een rijdier, een geest uit een spell. Je roept ze op met **Roep op** en stuurt ze weg met het kruisje.

Een familiar loopt met je mee door de stad. Begint er een gevecht, dan staat hij er vanzelf bij, met jouw plek in de beurtvolgorde.

---

## `summons`

> Helpknop in: summons.js:57
> Nu: de standaard uit de code
> 4 stappen · 133 woorden · 33 per stap

Titel: Opgeroepen

### Wie er naast je loopt

Alles wat je zelf hebt opgeroepen: een familiar, een rijdier, een geest uit een spell. Je roept ze op met **Roep op** en stuurt ze weg met het kruisje.

### Ook buiten een gevecht

Een familiar loopt met je mee door de stad. Begint er een gevecht, dan staat hij er vanzelf bij, met jouw plek in de beurtvolgorde — en als het gevecht uit is, blijft hij gewoon staan.

### Soms vraagt hij om cijfers

Van zeven van de vijfentwintig kennen we het statblock; de rest staat in een boek waaruit we niets mogen overnemen. Dan vraagt hij één keer om HP en AC, onthoudt ze, en is de volgende keer weer één klik.

### Een rust haalt niets weg

Hoe lang iets blijft verschilt per spell, en dat weet de app niet. Dus wist hij niets, maar zet er *van voor je rust* bij. Wegsturen blijft aan jou.

---

## `personage_wildmagic`

> Helpknop in: app.js:9546
> Nu: **aangepast in deze campagne**
> 1 stap · 39 woorden · 39 per stap
> De standaard telt 2 stap(pen).

Titel: Wild Magic Surge

### Alleen voor een Wild Magic Sorcerer

Cast je een spell van level 1 of hoger, dan kan je DM je om een d20 roll vragen. Een 20 laat de magie uit de hand lopen. Wát er gebeurt, is te zien op de Wild Magic Table.

---

## `personage_stats`

> Helpknop in: app.js:9559
> Nu: de standaard uit de code
> 4 stappen · 149 woorden · 37 per stap

Titel: Gevechtswaarden

### De strook in één oogopslag

AC, Speed, Initiative, Proficiency Bonus, Hit Dice en Passive Perception — de getallen waar in een gevecht naar gevraagd wordt. De witte vakjes vul je zelf; de rest rekent de app uit je class, level en ability scores.

### AC laten uitrekenen

Het knopje naast AC kijkt naar wat er in je boedel ligt: kies je harnas en je shield, en hij telt Base AC, je Dexterity en de cap van dat harnassoort bij elkaar op. Je ziet de som voordat je hem overneemt.

### Het blijft jouw getal

De uitkomst is een voorstel, geen slot: je mag het veld altijd overtypen. Een Monk, een Barbarian of een randgeval dat nergens in past wint het van de rekensom.

### Waarschuwingen tellen niet af

Ben je niet proficient met je harnas, of is het te zwaar voor je Strength, dan zegt hij dat — maar hij haalt er geen AC van af. Dat zijn regels voor aan tafel, geen getal dat stilletjes lager uitvalt.

---

## `personage_wapens`

> Helpknop in: app.js:9624
> Nu: de standaard uit de code
> 4 stappen · 122 woorden · 31 per stap

Titel: Weapons & Damage Cantrips

### Waar je mee aanvalt

De regels die je tijdens een gevecht nodig hebt: naam, je aanvalsbonus of Save DC, en de schade met zijn type. Je vult ze zelf in — dit is je eigen spiekbriefje.

### Uit je boedel en je cantrips

Met het knapzakknopje kies je aan welke wapens en damage cantrips je werkelijk draagt; wat je aanvinkt komt als regel in de tabel. De **+** zet een lege regel neer voor iets wat nergens staat.

### Wat de app zelf invult

Hij leest de eigenschappen van het wapen: Finesse of Ranged pakt je Dexterity, de rest je Strength, en bij Finesse je hoogste van de twee. Een magische bonus en je proficiency telt hij erbij op.

### En wat je zelf beslist

Elk vakje is overtypbaar. De app vult voor; of het aan tafel ook zo uitpakt, bepalen jij en je DM.

---

## `personage_abilities`

> Helpknop in: app.js:9657
> Nu: de standaard uit de code
> 2 stappen · 58 woorden · 29 per stap

Titel: Ability Scores

### De zes scores

Vul je scores in zoals ze op je character sheet staan. De **modifier** eronder rekent de app zelf uit — die hoef je nergens bij te houden.

### Saving throws

Vink aan waar je proficient in bent; de bonus loopt dan mee met je Proficiency Bonus, en die volgt je level. Verandert er iets, dan klopt het de volgende sessie vanzelf.

---

## `personage_skills`

> Helpknop in: app.js:9692
> Nu: de standaard uit de code
> 3 stappen · 71 woorden · 24 per stap

Titel: Skills

### Waar je goed in bent

Alle achttien skills met de ability waar ze aan hangen. De bonus volgt uit je score; je vinkt alleen aan waar je proficient in bent.

### Expertise

Klik een tweede keer en de skill staat op **Expertise**: je Proficiency Bonus telt dubbel. Een derde klik zet hem weer uit.

### Zelf bijstellen

Met de pijltjes leg je er handmatig iets bovenop, voor een feature of een voorwerp dat een bonus geeft die nergens anders vandaan komt.

---

## `personage_proficiencies`

> Helpknop in: app.js:9729
> Nu: de standaard uit de code
> 2 stappen · 60 woorden · 30 per stap

Titel: Proficiencies

### Waar je mee overweg kunt

Je wapens, harnassen, tools en instrumenten, zoals je class, species en background ze geven. Het is een lijst die je zelf bijhoudt.

### De app leest mee

Twee plekken kijken hiernaar: de wapentabel, die je proficiency bij je aanvalsbonus optelt, en de AC-rekenaar, die waarschuwt als je een harnas draagt waar je niet mee overweg kunt. Hoe netter dit staat, hoe beter die twee kloppen.

---

## `personage_talen`

> Helpknop in: app.js:9754
> Nu: de standaard uit de code
> 2 stappen · 54 woorden · 27 per stap

Titel: Languages & Senses

### Wat je verstaat en wat je waarneemt

De talen die je spreekt, en bijzondere zintuigen als Darkvision of Tremorsense, met hun bereik. Allebei komen ze van je species, je class of iets wat je onderweg oppikte.

### Een aantekening, geen mechaniek

De app doet er zelf niets mee: ze staan hier zodat jij en je DM er aan tafel naar kunnen wijzen als het ertoe doet.

---

## `personage_tap`

> Helpknop in: app.js:9773
> Nu: de standaard uit de code
> 2 stappen · 55 woorden · 28 per stap

Titel: Aan de tap

### Wat je op hebt

Wat je bij de waard bestelde en nu nog bij je draagt: een voordeel op een bepaalde worp, een warme buik, een status met een korte beschrijving.

### Tot je volgende lange rust

Ze gelden tot je slaapt en verdwijnen dan vanzelf. Het is een aantekening die je bij je draagt — of het voordeel geldt, beslist je DM aan tafel.

---

## `personage_emotes`

> Helpknop in: app.js:9792
> Nu: de standaard uit de code
> 2 stappen · 51 woorden · 26 per stap

Titel: Emotes

### Je eigen klanken

Korte geluidsfragmenten die bij jouw personage horen — een strijdkreet, een zucht, een lach. Tikken speelt hem af op het scherm op tafel.

### Waar ze vandaan komen

Je neemt ze op toen je je personage maakte, of je DM zet ze voor je klaar. Is het jouw beurt in een gevecht, dan staat dat erbij.

---

## `personage_wiejebent`

> Helpknop in: app.js:9809
> Nu: de standaard uit de code
> 2 stappen · 60 woorden · 30 per stap

Titel: Wie je bent

### De mens achter de cijfers

Je uiterlijk, je karakter, je idealen, je band met de anderen en wat je dwarszit. Niets hiervan rekent mee — het staat er om op terug te vallen als iemand vraagt wie je eigenlijk bent.

### Dichtgeklapt, met opzet

Het blok staat dicht omdat je het niet elke beurt nodig hebt. Klik de kop om het open te vouwen; wat je typt bewaart zichzelf.

---

## `knapzak`

> Helpknop in: app.js:9844
> Nu: **aangepast in deze campagne**
> 4 stappen · 126 woorden · 32 per stap
> De standaard telt 4 stap(pen).

Titel: Boedel

### Boedel en beurs

Hier staan al je bezittingen: je beurs, voorwerpen en de zegeningen en voordelen die je hebt. Scroll door de carrousel om al je voorwerpen te zien. Klik op een kaartje om het volledig te bekijken. Je kunt ook nieuwe voorwerpen, waarvoor de DM (nog) geen kaartje heeft aangemaakt, handmatig toevoegen.

### Charges en damage

Sommige voorwerpen hebben *charges* (oplaadpunten). Klik op een bolletje om een charge te verbruiken. Wapens met schade tonen een knopje. Klik erop om een dobbelsteen te werpen.

### Zegeningen, vloeken en voordelen

Je actieve zegeningen, eden, vloeken en factievoordelen staan apart vermeld. Klik op "bekijk zegening" of "bekijk eed" om het bijbehorende voorwerpkaartje te openen.

### Gedeelde beurs

Standaard houd je je eigen geldbeurs bij. Als de groep daarvoor kiest, kan de beurs ook gedeeld worden. Je moet elkaar dan wel een beetje vertrouwen.

---

## `progressie`

> Helpknop in: render-progressie.js:657
> Nu: **aangepast in deze campagne**
> 3 stappen · 101 woorden · 34 per stap
> De standaard telt 4 stap(pen).

Titel: Features & Traits

### Alles wat je kunt

Elke class feature, elke species trait en elke keuze die daarbij hoort, geordend per level. Wat nog boven je huidige level ligt is grijs getint. Met het sterretje filter je op je favorieten; met **+** voeg je iets toe dat nergens vandaan komt maar wel op je blad hoort.

### Bijhouden en aantekenen

Open een feature en je ziet hoeveel charges hij heeft. Klik een bolletje om een charge te verbruiken.

### Keuzes

Waar je iets moet kiezen — een feat, een subclass, een Ability Score Improvement — staat dat bij de trede waar het hoort. **Change** naast een gemaakte keuze zet hem open om te wijzigen.

---

## `spreukenboek`

> Helpknop in: app.js:10130
> Nu: **aangepast in deze campagne**
> 3 stappen · 128 woorden · 43 per stap
> De standaard telt 3 stap(pen).

Titel: Spreukenboek

### Spreukenboek

Hier staan jouw spreuken, geordend op level. Dat moet niet verward worden met het tabblad Spells bij Naslag: dat is de hele bibliotheek. Bovenaan zie je je Spell Save DC, en Spell Attack Bonus. Op de linkerpagina zie je de beschikbare spell slots. Klik op een spreuk voor de volledige beschrijving.

### Spell slots

Je spell slots worden weergegeven als bolletjes per level. Een gevuld bolletje is beschikbaar, een leeg bolletje is verbruikt. Klik op een bolletje om het te markeren als verbruikt, of klik opnieuw om het terug te zetten. Slots herstellen na een lange rust. Klik op het plusje om een spell slot van een hoger level te gebruiken.

### Vastgepinde spreuken

Veelgebruikte spreuken kun je vastpinnen via de bladwijzer op het kaartje. Zo kun je ze snel raadplegen tijdens een gevecht.

---

## `spreuken_toevoegen`

> Helpknop in: app.js:5441
> Nu: de standaard uit de code
> 0 stappen · 0 woorden

Titel: 

---

## `spreukenboek_boek`

> Helpknop in: app.js:4808
> Nu: **aangepast in deze campagne**
> 4 stappen · 245 woorden · 61 per stap
> De standaard telt 4 stap(pen).

Titel: Het opengeslagen boek

### Inhoudsopgave

Een overzicht van al je spreuken per level. Je kunt ook zoeken: typ een naam of school en klik **+** om een spreuk aan je boek toe te voegen. Spreuken die je al hebt staan bovenaan onder *Jouw spreuken*.

### Deze spreuk

Alles wat je aan de spreuk kunt hangen die openligt om het spreukenboek. De **incantatie**, de spreukformule die jij uitspreekt, verschijnt als een briefje op de linkerpagina. Bij **Concentration** kun je de Concentration-teller starten of stoppen.

### Material

Heeft een spreuk een M-component, dan staat onder de gegevens wat het materiaal waard is en of de spreuk het **verbruikt**. Kies **Altijd bij de hand** als een component pouch of focus het dekt, of als je het (dure) voorwerp gewoon bezit. Kies **Voorraad** als je het telt. Elke keer dat je voor deze spreuk een slot afvinkt gaat er één exemplaar af, en met − en + stel je bij wat je hebt. 

Is je voorraad op, dan houdt het boek je cast even vast. Je kunt **toch casten** (je hebt het wél, of de DM gaf het je), **niet casten**, of — als je DM dat toestaat — het bedrag **uit de beurs afrekenen**. Dat bedrag is een voorstel. Staat er "per target" in de tekst, typ dan zelf het juiste getal.

### Bladeren

Met de pijlen links en rechts blader je door je spreuken; op een telefoon kun je ook vegen. Het rode lint in het boek markeert een favoriet. Klik erop om hem aan of uit te zetten.

---

## `spreukenboek_inhoud`

> Helpknop in: app.js:4877
> Nu: **aangepast in deze campagne**
> 2 stappen · 100 woorden · 50 per stap
> De standaard telt 2 stap(pen).

Titel: Inhoudsopgave

### Bladeren

Klik op een spreuk en het boek slaat die bladzijde op. Zoeken gaat met het veld bovenaan. Typ je iets dat niet in je boek staat, dan zoekt hij ook in de spreuken die je nog *kunt* leren.

Een ★ betekent altijd paraat. Een cantrip heb je altijd paraat. Een vinkje betekent dat je de spell voor vandaag hebt voorbereid.

### De drie knoppen

**Vinkje**: zet een spreuk klaar. Hij loopt drie standen af: niet paraat, paraat, altijd paraat. 

**Potlood**: schrijf de incantatie: de woorden die jij uitspreekt als je hem cast. Die verschijnen op de bladzijde.

**Prullenbak**: haal de spreuk uit je boek.

---

# Het archief

De vijf kaartjes-tabs plus het bestiarium. Allemaal dezelfde vraag: wát staat hier, en wat betekent het dat een kaartje er wél of niet in staat?

## `personages`

> Helpknop in: render-campagne.js:3451 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> 5 stappen · 162 woorden · 32 per stap
> De standaard telt 5 stap(pen).

Titel: Personages

### Personages

Hier vind je de **personages** die je hebt ontmoet: de NPC’s én de avonturiers van het gezelschap. Klik op een kaart voor details, relaties, roddels en geheimen. De DM bepaalt wie en wat zichtbaar is.

### Zoeken en bladeren

Type in het zoekveld een naam of een woord uit de beschrijving. In een geopend kaartje blader je met de pijltjes (of door te vegen) naar het volgende kaartje.

### Tik om te openen

Elk kaartje toont alleen een gezicht en een naam. **Tik erop** en het wordt groot. **Tik nog eens** en het draait om naar het volgende blad: gegevens, beschrijving, roddels en geheimen. Met de icoontjes onderaan spring je meteen naar een blad.

### Het hele kaartje

Het pijltjesknopje rechtsonder vergroot het kaartje tot het volledige venster, met o.a. het stat block en de kaart. Het andere knopje (of Escape) maakt het weer klein.

### Favorieten

Met de **ster** bewaar je een personage bij je favorieten. Die liggen als een stapeltje linksboven. Tik erop en ze waaieren uit tot een eigen rij, met een rood lint.

---

## `locaties`

> Helpknop in: render-campagne.js:3451 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> 5 stappen · 174 woorden · 35 per stap
> De standaard telt 3 stap(pen).

Titel: Locaties

### Locaties

Hier vind je alle **plekken** die je hebt bezocht. Klik op een kaart voor details, relaties, roddels en geheimen. De DM bepaalt wat zichtbaar is.

### Zoeken en bladeren

Type in het zoekveld een naam of een woord uit de beschrijving. In een geopend kaartje blader je met de pijltjes (of door te vegen) naar het volgende kaartje. Een locatie met het type *Winkel* heeft een voorraad waar je voorwerpen kunt kopen en verkopen. Filter via de trechter op o.a. *Winkel*. Klik op een kaart voor meer informatie.

### Tik om te openen

Elk kaartje toont alleen een afbeelding en een naam. **Tik erop** en het wordt groot. **Tik nog eens** en het draait om naar het volgende blad: gegevens, beschrijving, roddels en geheimen. Met de icoontjes onderaan spring je meteen naar een blad.

### Het hele kaartje

Het pijltjesknopje rechtsonder vergroot het kaartje tot het volledige venster. Het andere knopje (of Escape) maakt het weer klein.

### Favorieten

Met de **ster** bewaar je een locatie bij je favorieten. Die liggen als een stapeltje linksboven. Tik erop en ze waaieren uit tot een eigen rij, met een rood lint.

---

## `organisaties`

> Helpknop in: render-campagne.js:3451 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> 5 stappen · 145 woorden · 29 per stap
> De standaard telt 3 stap(pen).

Titel: Organisaties

### Organisaties

Gilden, ordes en groeperingen in de wereld. Klik op een kaart voor hun doel, leden en banden met andere partijen. De DM bepaalt wat zichtbaar is.

### Zoeken en bladeren

Type in het zoekveld een naam of een woord uit de beschrijving. In een geopend kaartje blader je met de pijltjes (of door te vegen) naar het volgende kaartje.

### Tik om te openen

Elk kaartje toont alleen een afbeelding en een naam. **Tik erop** en het wordt groot. **Tik nog eens** en het draait om naar het volgende blad: gegevens, beschrijving, roddels en geheimen. Met de icoontjes onderaan spring je meteen naar een blad.

### Het hele kaartje

Het pijltjesknopje rechtsonder vergroot het kaartje tot het volledige venster. Het andere knopje (of Escape) maakt het weer klein.

### Favorieten

Met de **ster** bewaar je een organisatie bij je favorieten. Die liggen als een stapeltje linksboven. Tik erop en ze waaieren uit tot een eigen rij, met een rood lint.

---

## `voorwerpen`

> Helpknop in: render-campagne.js:3451 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> 7 stappen · 242 woorden · 35 per stap
> De standaard telt 3 stap(pen).

Titel: Voorwerpen

### Voorwerpen

Wapens, uitrusting en magische items. Je kunt voorwerpen claimen, ruilen en in winkels kopen en verkopen. Klik op een kaart voor de eigenschappen. De DM bepaalt wat zichtbaar is.

### Zegeningen en gunsten

Die horen hier ook, maar ze staan niet in de gewone lijst: met 98 van de 288 zouden ze de rest verdringen. Ga naar **Archief → Zegeningen & Gunsten** en je ziet precies die kaartjes — het is dezelfde lijst met het filter al gezet, dus je kunt er gewoon doorheen zoeken en bladeren.

### Geclaimde en geschonken voorwerpen

Voorwerpen die je hebt geclaimd of die de DM je heeft gegeven, verschijnen op je personagetabblad. Sommige voorwerpen kunnen maar een aantal keer gebruikt worden. Andere voorwerpen hebben een beperkt aantal *charges*, die opladen na een Short of Long Rest.

### Zoeken en bladeren

Type in het zoekveld een naam of een woord uit de beschrijving. In een geopend kaartje blader je met de pijltjes (of door te vegen) naar het volgende kaartje.

### Tik om te openen

Elk kaartje toont alleen een afbeelding en een naam. **Tik erop** en het wordt groot. **Tik nog eens** en het draait om naar het volgende blad: gegevens, beschrijving, roddels en geheimen. Met de icoontjes onderaan spring je meteen naar een blad.

### Het hele kaartje

Het pijltjesknopje rechtsonder vergroot het kaartje tot het volledige venster. Het andere knopje (of Escape) maakt het weer klein.

### Favorieten

Met de **ster** bewaar je een voorwerp bij je favorieten. Die liggen als een stapeltje linksboven. Tik erop en ze waaieren uit tot een eigen rij, met een rood lint.

---

## `documenten`

> Helpknop in: render-campagne.js:3451 (de kaartjes-tab geeft het entiteitstype als sleutel door)
> Nu: **aangepast in deze campagne**
> 5 stappen · 145 woorden · 29 per stap
> De standaard telt 3 stap(pen).

Titel: Documenten

### Documenten

Brieven, aktes, kaarten en aantekeningen die je onderweg verzamelt. Klik op een kaart voor de de volledige tekst. De DM onthult documenten wanneer ze relevant worden.

### Zoeken en bladeren

Type in het zoekveld een naam of een woord uit de beschrijving. In een geopend kaartje blader je met de pijltjes (of door te vegen) naar het volgende kaartje.

### Tik om te openen

Elk kaartje toont alleen een afbeelding en een naam. **Tik erop** en het wordt groot. **Tik nog eens** en het draait om naar het volgende blad: gegevens, beschrijving, roddels en geheimen. Met de icoontjes onderaan spring je meteen naar een blad.

### Het hele kaartje

Het pijltjesknopje rechtsonder vergroot het kaartje tot het volledige venster. Het andere knopje (of Escape) maakt het weer klein.

### Favorieten

Met de **ster** bewaar je een document bij je favorieten. Die liggen als een stapeltje linksboven. Tik erop en ze waaieren uit tot een eigen rij, met een rood lint.

---

## `bestiarium`

> Helpknop in: render-bestiarium.js:116
> Nu: **aangepast in deze campagne**
> 2 stappen · 76 woorden · 38 per stap
> De standaard telt 4 stap(pen).

Titel: Bestiarium

### Bestiarium

Het bestiarium toont alle wezens die de party heeft ontmoet. Hoe meer je van een wezen weet, hoe meer info je ziet. De DM onthult wezens automatisch bij het eerste contact. Verdere kennis moet je verdienen.

### Kennisniveaus

Er zijn drie kennisniveaus. 
- **Naam**: je herkent het wezen maar weet verder niets. 
- **Deels**: je weet de base stats, resistances en senses. 
- **Volledig**: je weet alles: traits, actions en Challenge Rating. 

De **Magizoöloog** kan het kennisniveau verhogen.

---

# Een kaartje bekijken

Het detailvenster, per soort kaartje en per tabblad daarbinnen. Dit leest iedereen, speler en DM.

## `hulp_kijk_personages_info`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **personages**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: **aangepast in deze campagne**
> 6 stappen · 396 woorden · 66 per stap
> De standaard telt 5 stap(pen).

Titel: Dit personage

### Wie is dit?

Onder de naam staan de rol, race en class. De beschrijving vertelt wat je van het personage weet. Namen die je al kent zijn klikbaar. Een badge op de kaart laat zien of het personage een verkoper of antagonist is.

### Roddels en geheimen

Op een personagekaartje kun je **roddels** en **geheimen** vinden. De **roddel** is wat er over iemand verteld wordt. Bij meerdere roddels blader je met de pijltjes. Een **geheim** zie je pas als je het ontdekt hebt. Onthulde geheimen kunnen alles veranderen wat je van iemand dacht te weten.

### Waar hoort dit personage bij?

Onder **Waar hoort dit personage bij?** staat waaraan het personage verbonden is. Is hij eigenaar van een herberg, lid van een gilde of verkoper in een winkel? Klik erop om daarheen te gaan.

### Zichtbaarheid

Bij zichtbaarheid geef je aan wat de actieve party of dit personage zichtbaar of nog verborgen is. Ook kan een personage op de status vaag staan. Dat betekent dat spelers de naam zien, maar geen verdere informatie hebben.

### Toestand

Met **Huurling** neem je hem in dienst bij de **actieve party**, voor een loon per dag. De app stelt 2 gouden munten voor (de PHB-prijs voor een geschoolde kracht; een ongeschoolde kost er 2 zilveren) — tik in wat er aan tafel is afgesproken. Hij wordt meteen medestander.

Een dag is een **lange rust**: dan gaat het loon uit de beurs van wie betaalt (of de gedeelde beurs). Is daar te weinig, dan krijgt hij niets en telt hij dat. Na **twee dagen** zonder loon wil hij vertrekken — je ziet het op zijn knop en krijgt een melding — maar hij gaat pas als jij op *Laat hem gaan* drukt. Betalen kan ook achteraf: *Achterstand betalen* doet het in één keer.

### Gevangen nemen

Met **Gevangen** in de knoppenrij zet je hem vast bij de **actieve party**; je mag erbij zetten waar ze hem houden. Hij komt dan bij de spelers in het partytabblad te staan, naast de medestanders, en zijn kaartje krijgt tralies over het portret. Dezelfde knop laat hem weer vrij.

Twee dingen gebeuren erbij. Liep hij als **medestander** mee, dan gaat hij daar af (je krijgt eerst de vraag). En stond zijn kaartje voor deze party op **verborgen**, dan wordt het **vaag**: ze hebben hem in handen, dus ze weten dát hij er is — maar zijn naam en gegevens onthul je zelf. Het geldt per party: bij een andere party kan hij gewoon vrij rondlopen.

---

## `hulp_kijk_personages_sheet`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **personages**, tabblad **sheet**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 1 stap · 43 woorden · 43 per stap

Titel: Het blad

### Statblock

De gevechtsgegevens: **AC** (hoe moeilijk hij te raken is), **HP**, speed, de zes ability scores met hun modifier, en zijn traits en actions. Bij een huisdier hoort het blok dat past bij het level van zijn baasje — hij groeit met je mee.

---

## `hulp_kijk_locaties_info`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **locaties**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 3 stappen · 122 woorden · 41 per stap

Titel: Deze plek

### Wat je ziet

De beschrijving vertelt wat deze plek is. Onder de naam staat het **type** en het gebied waarin het ligt. Namen in de tekst die je al kent zijn klikbaar: zo loop je van een herberg naar zijn waard en verder.

### Wie hier bij hoort

Onder de beschrijving staat wie aan deze plek verbonden is — de eigenaar, de waard, vaste gasten — met hun rol ervoor. Staat er een knop omheen, dan heb je dat kaartje al ontdekt en kun je erop klikken.

### Roddels en geheimen

De **roddel** is wat je hier hebt opgevangen; er komen er soms meer bij naarmate je vaker langsgaat. Bij meerdere blader je met de pijltjes. Een **geheim** verschijnt pas als je het ontdekt hebt — wat je niet ziet, weet je nog niet.

---

## `hulp_kijk_locaties_kaart`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **locaties**, tabblad **kaart**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 2 stappen · 72 woorden · 36 per stap

Titel: Waar ligt dit

### Op de kaart

Een uitsnede van de kaart rond deze plek, met een rode stip erop. *Toon op de hele kaart* opent de kaart zelf; linksboven kom je met één klik weer terug bij dit kaartje.

### Plattegrond

Staat er een plattegrond bij, dan hoort die bij dit gebouw of deze kelder. Je ziet er alleen de ruimtes op die je party al ontdekt heeft — de rest blijft in het donker tot je er bent geweest.

---

## `hulp_kijk_locaties_voorraad`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **locaties**, tabblad **voorraad**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 2 stappen · 71 woorden · 36 per stap

Titel: De voorraad

### Kopen

Wat hier in de schappen ligt, met de prijs in de munt van de campagne. Klik een voorwerp om het te kopen; het bedrag gaat van je beurs af (of van de gedeelde beurs, als je die gebruikt) en het voorwerp komt in je boedel.

### Niet alles ligt er altijd

Sommige winkels tonen maar een deel van hun voorraad en verversen dat om de zoveel tijd. Kom je later terug, dan kan er iets anders liggen.

---

## `hulp_kijk_organisaties_info`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **organisaties**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 2 stappen · 102 woorden · 51 per stap

Titel: Deze organisatie

### Wat je ziet

Het type en het motto staan onder de naam; de beschrijving vertelt waar ze voor staan. Onder **Wie hoort hier bij?** staan de leden die je kent, met hun rol of rang; onder **Waar hoort deze organisatie bij?** staat waar de organisatie zelf onder valt — en of ze een **factie** zijn waar je aanzien bij kunt opbouwen.

### Roddels en geheimen

Wat er over ze verteld wordt staat bij de **roddel**; bij meerdere blader je met de pijltjes. Een **geheim** verschijnt pas als je het ontdekt hebt — bij een gilde of een bende is dat vaak het interessantste dat er over te weten valt.

---

## `hulp_kijk_organisaties_organogram`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **organisaties**, tabblad **organogram**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 2 stappen · 56 woorden · 28 per stap

Titel: Organogram

### Wie staat boven wie

De structuur zoals je die kent: bovenaan wie leidt, daaronder wie aan hem rapporteert. Klik een naam om zijn kaartje te openen.

### Onbekend

Staat er **Onbekend**, dan weet je dát die plek bestaat maar niet wie hem vult — de rol staat er wel bij. Ontmoet je hem later, dan verschijnt zijn naam vanzelf op deze plek.

---

## `hulp_kijk_voorwerpen_info`

> Detailvenster van een kaartje (wat een speler leest) — kaartjes van het type **voorwerpen**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 2 stappen · 67 woorden · 34 per stap

Titel: Dit voorwerp

### Wat je ziet

De kleur van de rand is de **rarity**: grijs (Common) tot goud (Legendary). Staat er *Requires Attunement*, dan moet je je er tijdens een rust aan binden voordat het werkt. Een schadewaarde is een knop: klik erop om de dobbelsteen te gooien.

### Charges

Heeft het voorwerp **Charges**, dan staan die als bolletjes in je boedel. Ze laden vanzelf weer op bij het soort rust dat erbij vermeld staat.

---

# Een kaartje bewerken

Dezelfde tabbladen, maar nu de editor — altijd alleen de DM. Zonder soort in de naam (`hulp_bewerk_beeld`) geldt het boekje voor élk kaartje; dat is de terugval als er geen eigen tekst is.

## `hulp_bewerk_personages_info`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **personages**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 7 stappen · 436 woorden · 62 per stap

Titel: Een personage

### Houding tegenover de groep

Vijf treden van **bondgenoot** tot **vijandig**. Laat je hem met rust, dan rekent de app hem uit — de knop die aanstaat heeft dan een stippellijn. Klik je een trede aan, dan is hij van jou; dezelfde trede nog eens aantikken zet hem terug op uitgerekend. De **Insight-DC** eronder is wat een speler moet halen om die houding te doorzien.

### Type, rollen en kant

Drie verschillende vragen. **Type** zegt wat voor kaartje dit is: NPC, speler, dier of god. **Rollen** zeggen welke functie hij vervult — *verkoper* zet een voorraad aan, *antagonist* geeft kleur en een badge, allebei tegelijk mag. **Kant** zegt aan welke kant hij in een gevecht staat.

### Houding tegenover de groep

Eén waarde van **vijandig** tot **bondgenoot**. Op het kaartje is er in rust niets van te zien; de houding verschijnt pas als je erover gaat, als een baan licht (vriendelijk) of schaduw (vijandig) die overtrekt. *Wantrouwig* is iemand die je op afstand houdt maar wel praat; *welgezind* helpt als het hem niet te veel kost.

Laat je het veld leeg, dan rekent de app hem uit: eerst de renown van zijn factie, anders de standaard van zijn rol (een antagonist begint vijandig, een huisdier welgezind). Zetten gaat het snelst met het **balkje links op het kaartje** zelf — en de trede die aanstaat nog eens aantikken zet hem terug op uitgerekend. Een god en een speler staan niet op deze schaal.

### Flavour & geheimen

**Flavour** zijn zinnetjes om voor te lezen; de app onthoudt per regel of hij al verteld is. **Geheimen** onthul je per regel en per party. Bij een personage kun je per geheim aanvinken dat het onthullen hem tot vijand maakt: hij krijgt dan de rol antagonist, komt aan de kant van de vijand te staan en zijn alignment schuift op naar Evil.

### Waar hoort dit personage bij?

Waar dit personage bij hoort: eigenaar van een herberg, lid van een gilde. Kies een locatie of organisatie plus een rol met **Verbinding toevoegen**. Diezelfde regel komt te staan bij *Wie hoort hier bij?* van dát kaartje — een verbinding staat maar op één plek, dus je kunt hem van beide kanten leggen en van beide kanten weghalen. Onderaan staat **Verkoopt bij**: dat is dezelfde soort verbinding, maar dan naar de winkel waar zijn waren liggen.

### Bij een dier

Een dier kun je te adopteren zetten met een prijs, en per party een **eigenaar** geven. Het dier staat dan op hun partytabblad, is te vullen in een gevecht, en zijn statblok groeit mee met het level van dat personage.

### Aantekeningen

Wat je zelf wilt onthouden: hoe je hem speelt, wat er nog moet gebeuren, welke stem hij heeft. Spelers krijgen dit nooit te zien, ook niet als het kaartje zichtbaar is.

---

## `hulp_bewerk_personages_sheet`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **personages**, tabblad **sheet**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 4 stappen · 221 woorden · 55 per stap

Titel: Statblock

### Statblock

De gevechtsgegevens: AC, HP, speed, abilities, traits en actions. Vul je hier iets in, dan verschijnt het kaartje in de **monsterbibliotheek** en kun je hem in een gevecht zetten — hij komt níét in het bestiarium, want dat is wat de spelers aan beesten verzamelen. HP schrijf je zoals in een statblock: `32 (5d8+10)`.

### Meegroeien met het baasje

Bij een dier is het blok hierboven het dier vanaf level 1. Een **tier** neemt het over zodra zijn eigenaar dat level haalt, en zegt alleen wát er verandert — wat je leeg laat komt uit de basis. "Hetzelfde beest, maar taaier" is dus een AC en een HP, geen overgetypt blok. Twee tiers vanaf hetzelfde level kan niet. Laat je het leeg, dan blijft hij altijd het statblok hierboven: een rijdier of een opgeroepen wezen groeit nu eenmaal niet mee.

### Meerdere statblokken

Bij een NPC is het dezelfde persoon in een andere ontmoeting. Het blok hierboven is de **basis**; elk extra statblok zegt alleen wat er anders is. Welke versie geldt kies je ná het opslaan — op het kaartje zelf, in de strook boven het statblok, of onder de monsterregel in een encounter. Die keuze staat per party.

### Afdrukken

Bij een spelerspersonage heet dit blad *Character Sheet* en kun je het afdrukken of als pdf bewaren; bij een NPC, dier of god drukt hij alleen het statblok af.

---

## `hulp_bewerk_locaties_info`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **locaties**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 5 stappen · 281 woorden · 56 per stap

Titel: Een locatie

### Type

Het **type** zegt wat voor plek dit is. De lijst staat in groepen: gebieden (rijk, streek, stad, dorp, wijk), gebouwen, landschap en overig. Drie types kunnen méér, en onder de keuzelijst staat wat dat is: *Winkel* krijgt een eigen tabblad met voorraad, en *Herberg* en *Tempel* kunnen aan een dienst gekoppeld worden. Kunnen, niet moeten — je kunt drie herbergen hebben waarvan er één de dienst is.

### Gebied

Waar dit in ligt: een stad, een streek, een wijk of een gebouw. Wijst het naar een bestaand locatiekaartje, dan kun je doorklikken en ontstaan er ketens — een herberg in een wijk, in een stad, in een streek. Vrije tekst mag ook; bestaat de naam nog niet, dan biedt hij aan er een kaartje voor te maken.

### Wie hoort hier bij?

Eigenaar, waard, personeel, stamgasten — personages én organisaties, met per regel een rol. Een naam die een kaartje heeft wordt een knop waar je doorheen klikt; wat geen kaartje heeft blijft gewoon tekst. Dezelfde regel verschijnt bij *Waar hoort dit … bij?* op dát kaartje — de kop noemt daar het soort kaartje: een verbinding staat maar op één plek, dus je legt en verwijdert hem van beide kanten.

### Flavour & geheimen

**Flavour** zijn losse zinnetjes om voor te lezen; de app houdt per regel bij of hij al verteld is, dus iemand met drie roddels levert drie avonden op. **Geheimen** onthul je per regel en per party, in het detailvenster.

### Koppelingen

Onderaan staat wat dit kaartje **elders** is: de herberg van de campagne, of de tempel van een god uit de Tempel-dienst. Die koppeling staat maar op één plek — je kunt hem hier leggen of in het paneel van die dienst, en je ziet aan beide kanten hetzelfde.

---

## `hulp_bewerk_locaties_kaart`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **locaties**, tabblad **kaart**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 3 stappen · 126 woorden · 42 per stap

Titel: Kaart & dungeon

### Op de kaart

Kies een kaart en **klik in het beeld** om de speld te zetten; nog eens klikken verplaatst hem. **Dubbelklikken** zoomt in op die plek (en op de hoogste stand weer helemaal uit), ingezoomd sleep je om te schuiven. Ook bij een nieuw kaartje: de speld wordt geplaatst zodra je opslaat.

### Wat het oplevert

Een kaartje met een speld krijgt rechtsonder een knopje dat meteen de juiste kaart opent, en toont in het detailvenster een uitsnede van zijn omgeving. Vanuit de grote kaart brengt de knop linksboven je terug naar het kaartje.

### Dungeonkaart

Hangt er een plattegrond aan deze plek, kies hem dan hier. Een kamer kiezen mag, maar hoeft niet — de hele kaart volstaat. De plattegrond zelf teken en beheer je bij Dungeons; hier leg je alleen de koppeling.

---

## `hulp_bewerk_locaties_winkel`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **locaties**, tabblad **winkel**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 6 stappen · 352 woorden · 59 per stap

Titel: De winkel

### Voorraad

Wat hier te koop is. Voeg voorwerpen toe, of laad de voorraad van een andere winkel in als vertrekpunt. Prijzen schrijf je met een komma — `12,34` is 12 goud, 3 zilver en 4 koper — of in munten (`5 gp 2 sp`). De voorraad hoort bij de **locatie**; een verkoper wijst er alleen naar.

### Wisselend assortiment

Niet alles ligt altijd in de schappen: laat de winkel elke zoveel uur een deel van de voorraad tonen. Winkels met hetzelfde woord bij *Zelfde selectie als* verversen tegelijk en tonen dezelfde selectie.

### Zelf afrekenen aan tafel

In het detailvenster van de winkel reken je af namens een speler, en koop je met *Inkopen van de party* spullen van hen over: je vinkt aan wat de winkel overneemt, zet er een bedrag per stuk bij en rekent af. Het voorwerp verdwijnt uit de boedel; het geld gaat naar de partybeurs als die gedeeld is, anders naar die speler.

### Koopt in van spelers

Staat dit uit, dan is er voor de speler geen verkoopkant: geen lijst, geen knop, geen uitleg — hij ziet niet eens dat het bestaat. Zet je het aan, dan krijgt hij in het winkelvenster zijn eigen boedel te zien met wat deze winkel ervoor biedt: het **percentage van de winkelprijs** dat je hier instelt. Zegeningen, gunsten en class-features blijven altijd buiten de handel, net als alles wat op het voorwerpkaartje zelf *niet verkoopbaar* heet.

### Het percentage is een bod, geen prijs

Biedt een speler iets aan, dan gaat er niets meteen over de toonbank. Het aanbod komt bij **Verzoeken** te staan met het berekende bedrag ernaast — dat veld mag je overtypen. Is er aan tafel om gepingeld, dan betaal je uit wat jullie afspraken; weiger je, dan houdt hij zijn spullen.

### Een winkel kan blut raken

Zet je *beperkte kas* aan, dan is dat wat deze handelaar per nacht kan uitgeven aan inkopen. Bied je er meer aan, dan weigert de app met het bedrag dat nog over is en vraagt of je er tóch doorheen wilt — want aan tafel mag een smid altijd nog naar zijn spaarpot lopen. Na een lange rust is de kas weer vol; laat je het vinkje uit, dan is er geen grens en verandert er niets.

---

## `hulp_bewerk_organisaties_info`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **organisaties**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 5 stappen · 276 woorden · 55 per stap

Titel: Een organisatie

### Type en motto

Gilden, ordes, facties en bendes. Het **type** en het **motto** komen op het kaartje te staan; de beschrijving vertelt waar ze voor staan.

### Gebied en leden

Bij **Gebied** koppel je waar ze zitten. Bij **Wie hoort hier bij?** zet je de leider en de leden neer, met per regel hun rang of rol — personages én andere organisaties. Die regels verschijnen ook op hun eigen kaartjes.

### Rollen

Een rol is een **functie binnen de organisatie** — kwartiermeester, archivaris, zwaardmeester. Bij *Rollen binnen deze organisatie* schrijf je één keer op wat zo'n functie inhoudt; in de ledenlijst kies je hem daarna uit de keuzelijst, en dan is het woord daar een knop naar die uitleg. Je spelers lezen hem ook, zodra ze het kaartje kennen.

Een rol die je maar één keer gebruikt hoef je niet eerst te beschrijven: het rolveld bij een lid blijft gewoon vrije tekst.

**Een rang is geen rol.** De ladder van een factie is wat een *speler* beklimt met renown; een rol is wat iemand dóét. Hangt er een factie aan dit kaartje, dan blijven dat twee lijsten naast elkaar.

### Het teken

Het **teken** is het merk van deze organisatie: het staat op haar kaartje en op de speld op de kaart. Laat je het leeg, dan volgt het vanzelf haar *type* — een gilde krijgt een ander teken dan een bende.

Hangt er een **factie** aan dit kaartje, dan is dit meteen haar embleem; je hoeft daar dus niets apart in te stellen.

### Factie

Onderaan koppel je dit kaartje aan een **factie** uit het Facties-paneel. Dat is dezelfde koppeling die daar staat, dus je kunt hem van twee kanten leggen; renown, rangen en boons blijven in dat paneel.

---

## `hulp_bewerk_organisaties_organogram`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **organisaties**, tabblad **organogram**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 3 stappen · 151 woorden · 50 per stap

Titel: Organogram

### Waar het vandaan komt

De ledenlijst staat op dit tabblad: één regel per persoon of organisatie, met een rol. Vul je bij een regel *Valt onder* een naam uit diezelfde lijst in, dan komt hij daaronder te hangen. Onder de lijst staat **Waar hoort deze organisatie bij?**: dezelfde vraag van de andere kant, voor als deze organisatie zelf ergens onder valt.

### Zonder invullen

Heb je nergens *Valt onder* ingevuld, dan maakt hij er een tweelaags schema van op rol: wie leidt (Leider, Oprichter, Eigenaar, Hoofd, Kapitein…) staat boven, de rest eronder. Dat is een vertrekpunt, geen echte structuur — vul de chefs in en het klopt.

### Wat spelers zien

Een lid waarvan hun party het kaartje nog niet kent staat er als **Onbekend** — met zijn rol, zonder zijn naam. Zo zien ze de vorm van de organisatie en blijft het uitzoeken wie erin zit het spel. Een naam die je nooit aan een kaartje koppelt blijft wél gewoon leesbaar.

---

## `hulp_bewerk_voorwerpen_info`

> Kaartjes-editor (alleen de DM) — kaartjes van het type **voorwerpen**, tabblad **info**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 6 stappen · 308 woorden · 51 per stap

Titel: Een voorwerp

### Wat het doet bij gebruik

Onder de werking **healing** staan drie velden: een *genezingsformule* (echte HP, afgetopt op je maximum), *tijdelijke HP* (komt er bovenop, telt niet mee in je maximum, en de hoogste wint — ze stapelen niet) en een *status* met een korte beschrijving, die geldt tot de volgende lange rust. Een kroegdrankje vult meestal alleen die laatste twee.

### Type en rarity

Het **type** staat in groepen (wapens & harnas, magische voorwerpen, verbruik, uitrusting) en bepaalt welke velden erbij komen — onder de keuzelijst staat wat je krijgt. De **rarity** kleurt de rand van het kaartje; Very Rare en Legendary krijgen bovendien een gloed.

### Prijs en exemplaren

De **prijs** mag met een komma (`12,34`) of in munten (`5 gp 2 sp`). Bij **exemplaren** kies je of er maar één van is, of meerdere spelers er elk één van kunnen hebben, of ieder er een aantal van bijhoudt (met teller). Wat winkels niet mogen overnemen vink je aan bij *Niet te verkopen aan winkels*.

### Charges

Heeft het voorwerp ladingen, zet dan *Charges* aan. Het **maximum** is een getal. **Herlaadt bij** kent drie standen: helemaal vol na een lange rust, helemaal vol na een korte rust, of een deel terug met een worp — dan verschijnt het veld waarin je die worp zet (`1d3`). *Speler mag zijn eigen maximum bijstellen* geeft de speler ±-knopjes bij de bolletjes in zijn boedel; handig als het maximum per exemplaar verschilt.

### Wie heeft het

Bij een bestaand voorwerp staat rechts het tabblad **Bezit**: wie het heeft, in welke party, hoeveel exemplaren en hoeveel charges er nog in zitten. Daar deel je het ook uit — en neem je het weer af als je één keer te veel klikte.

### Waar het te koop is

Dat leg je niet hier vast maar in de **voorraad van de winkel**. Het voorwerp toont daarna vanzelf een regel *Te koop* met de winkel erachter — één plek, twee kanten, net als bij de betrokkenen op een locatie.

---

## `hulp_bewerk_beeld`

> Kaartjes-editor (alleen de DM) — elk soort kaartje (terugval), tabblad **beeld**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.
> Nu: de standaard uit de code
> 3 stappen · 103 woorden · 34 per stap

Titel: Beeld

### Afbeelding

Het portret of de gevel van dit kaartje. Met het **focuspunt** bepaal je welk deel in beeld blijft als de afbeelding bijgesneden wordt — handig bij een portret waar het hoofd niet in het midden staat. De twee voorbeelden ernaast tonen de echte uitsnedes: het kaartje (breed) en het ronde portret.

### Meer beelden

Extra afbeeldingen komen als carrousel in het detailvenster te staan.

### Filmpje

Een kort **filmpje** speelt op het portret van dit kaartje; bij een spelerspersonage ook op de landingspagina terwijl erop wordt ingezoomd, en in het dashboard als de speler erop klikt. Maximaal 8 MB. Langer dan zes seconden mag, maar stopt dan vanzelf.

---

# Naslag

Het Heldenboek en de spreukenbibliotheek: niet over déze campagne maar over het spel. Toon: dit is een naslagwerk, zeg wat je er kunt opzoeken.

## `vaardigheden`

> Helpknop in: render-vaardigheden.js:5829
> Nu: de standaard uit de code
> 7 stappen · 441 woorden · 63 per stap

Titel: Naslag

### Alles bij elkaar, niet alleen wat jij hebt

Hier staan de **class features**, **subclass features**, **species traits**, **feats**, **Epic Boons** en **backgrounds** van deze wereld bij elkaar. Wat jóuw personage ervan heeft, staat op je tijdlijn onder Progressie; dit is de plek om op te zoeken wat er te krijgen valt.

### Vier deuren, dan één laag

Je begint met vier keuzes: **Classes**, **Species**, **Backgrounds** en **Feats & Epic Boons**. Achter een deur staan alle classes (of de species, of de backgrounds); kies er een en je krijgt het kaartje met hit die, saving throws, proficiencies en skills, daaronder de **subclasses** als kaartjes, en daaronder pas de losse features. Zo hoef je nooit door vijfhonderd regels te kijken om te zien wat een Wizard is.

### Zoeken gaat er dwars doorheen

Typ je iets in het zoekveld, dan krijg je treffers uit **alles** — ongeacht welke deur openstond. De indeling hoeft dus nooit in de weg te staan van "waar stond dat ook alweer". Met de knop linksboven ben je weer terug bij de vier deuren.

### Zelf iets toevoegen

Met de **+** maak je twee soorten dingen: *een regel binnen iets* (een feature van een class, een trait van een species, een feat) of *iets nieuws* — een eigen class, subclass, species of background. Dat laatste is een lege houder; de features hang je er daarna in. Elke tegellaag heeft ook een gestippelde tegel vooraan die het formulier meteen goed zet.

### Meenemen of overnemen

De **downloadknop** pakt alles wat jij zelf hebt ingetikt in één bestand — om mee te nemen naar een andere campagne of te geven aan een andere DM. Standaard gaat alleen mee wat je bij *Herkomst* op **Zelf verzonnen** zette: overgenomen tekst hoort niet gepubliceerd te worden. Vul bij *Waaruit?* in waar het vandaan komt, dan is dat over een jaar nog na te gaan.

### Staat er soms geen tekst?

Dan mag hij hier niet staan. De **SRD**-teksten zijn vrij te gebruiken en staan er voluit; de rest niet, en daar staat een knop *Lees hem elders* die je naar een naslagpagina brengt. Wat de DM zelf schreef staat er altijd.

### Soms alleen een naam

Staat er bij een class of subclass alleen een rij **namen** zonder tekst, dan brengt de app die features niet mee maar weet hij wel dát ze bestaan. Je kunt ze opzoeken met de knop *Naslag*, en er zelf tekst in zetten als je ze aan tafel gebruikt.

Bij de meeste staat het **level** erbij. Dat komt uit het boek waar die subclass in staat, omgerekend naar deze tafel: je kiest je subclass op level 3, dus wat in een boek van 2014 eerder kwam — een domein op 1, een school op 2 — staat hier op 3. Ontbreekt het level, dan zegt het kaartje van de subclass op welke levels déze class zijn features geeft.

---

## `hulp_heldenboek_kaart`

> Helpknop in: render-vaardigheden.js:3728 (venster)
> Nu: de standaard uit de code
> 5 stappen · 340 woorden · 68 per stap

Titel: Een kaart bewerken

### Wat je hier bewerkt

De **class, subclass of species zelf** — niet zijn features. Die hebben elk hun eigen kaartje in de lijst eronder, met een eigen potlood.

De beschrijving staat bovenaan het kaartje, vóór de features. Komt hij uit de SRD, dan staat die tekst er al in en mag je hem gewoon aanpassen: wat jij schrijft wint, en de meegeleverde tekst blijft eronder liggen voor campagnes die niets wijzigden.

### Core Traits

Alleen bij een class. Dit is wat op zijn kaartje staat én wat de app gebruikt om Hit Dice te rollen en Spell Slots af te leiden.

De velden staan vóór-ingevuld met wat de app zelf weet. **Laat je ze zo staan, dan verandert er niets** — en lift je mee op latere verbeteringen. Typ je iets anders, dan geldt dat in jouw campagne. Vooral nodig voor een class die de app níét meebrengt, zoals een eigen orde.

**Class Type** (martial, half-caster, full caster) bepaalt het icoontje van een class die de app niet kent.

### Multiclassen

Onderaan staan twee regels: wat je nodig hebt om in deze class **bij te beginnen**, en wat je er dan aan **training** bij krijgt. Voor de twaalf classes uit de SRD vult de app ze zelf; voor een eigen class of een Blood Hunter is dit de enige plek waar ze vandaan komen.

### Afbeelding en focuspunt

De kaart heeft twee kanten: een plaat met de naam erop, en de gegevens. Kies hier het beeld voor de voorkant.

Het **focuspunt** bepaalt welk deel in beeld blijft. Een portret is hoog en de kaart is breed, dus zonder bijstellen valt er van alles af — meestal net het gezicht. Sleep het kruis naar wat er móét blijven staan; het voorbeeld ernaast toont de echte uitsnede.

### Kleur van een subclass

Alleen bij een subclass. De kleur die je kiest kleurt zijn kaartje én al zijn features in de lijst eronder.

Dat is geen versiering: vink je er twee aan om ze te vergelijken, dan lopen hun features door elkaar in de volgorde waarin je ze krijgt. De kleur zegt dan in één oogopslag welke regel van wie is.

---

## `hulp_heldenboek_editor`

> Helpknop in: render-vaardigheden.js:4558 (venster)
> Nu: de standaard uit de code
> 10 stappen · 993 woorden · 99 per stap

Titel: Iets toevoegen aan de naslag

### Eerst: wát maak je?

De lijst bovenaan is de vraag waar de rest uit volgt. **Een regel binnen iets** is een feature: iets wat je op een bepaald level krijgt van je class, subclass, species of background. **Iets nieuws beginnen** is de houder zelf — een eigen class, subclass, species of background, nog zonder features.

Daarom vraagt een houder niet om een level: hij ís geen regel op een ladder. De features hang je er daarna aan, met *Feature van een…*.

### Herkomst en waaruit

**Herkomst** zegt alleen óf het overgenomen is. Zet je iets anders dan *zelf verzonnen*, dan komt er een veld **Waaruit?** bij: de naam van het boek, of van de tafelgenoot die het bedacht.

Dat is geen boekhouding om de boekhouding. Het bepaalt wat je later mag meenemen naar een andere campagne: zelf verzonnen mag mee, overgenomen tekst niet. Over een jaar weet je het niet meer.

### Beschrijving

Bij een feature: wat het doet. Bij een houder: wat het **is** — dat staat bovenaan het kaartje, vóór de features. Een lege regel begint een nieuwe alinea, en met de knoppen erboven maak je vet, cursief of gekleurd.

Neem geen tekst over uit een boek dat niet van jou is. Vat het samen in je eigen woorden; dan mag het mee en leest het bovendien korter.

### Een tabel erbij

Sommige features zijn een tabel: wat je op welk level krijgt, of waar je op rolt. De knop met de twee kolommen zet er een neer, en de regel **boven** de tabel wordt zijn kop — die verdwijnt dan uit de lopende tekst en komt erboven te staan. Wil je geen kop, laat die regel dan weg of eindig hem op een leesteken; dan leest de app hem als een gewone zin.

In een cel werkt dezelfde opmaak als in de rest van de tekst: vet, cursief en `[[verwijzingen]]`. **Spreuknamen hoef je niet te linken** — staat er *Spells* of *Spreuken* boven die kolom, dan maakt de app er vanzelf knoppen van.

### Meer kolommen

Elke extra pijp is een kolom erbij; de kopregel bepaalt hoeveel het er zijn, en een rij die er te weinig heeft wordt vanzelf aangevuld. De pijpen hoef je niet netjes uit te lijnen en de streepjesregel mag weg. Met het **oogje** rechts zie je precies wat er op het kaartje komt te staan.

### Alleen bij een feat: soort, prerequisite en spreuken

**Soort** is de indeling van de Player's Handbook 2024: *Origin* (die krijg je bij je background), *General* (die kies je bij een Ability Score Improvement), *Fighting Style* en *Epic Boon*. Daarachter staan twee die niet uit de PHB komen maar er wel zijn: *Dark Gift* (Van Richten's Guide to Ravenloft — Aberrant Anatomy) en *Dragonmark* (Eberron — Aberrant Dragonmark, Mark of Detection). Dat zijn ze alle zes; meer soorten bestaan er niet. Hoort een Fighting Style maar bij één class, dan zet je dat in **Prerequisite** — dat is geen eigen soort. Niets kiezen mag — beter leeg dan een soort die niet klopt.

**Prerequisite** is wat de feat vraagt: *Strength 13*, de Abjuration-school, of een training. Het **minimumlevel** staat in een eigen vakje ernaast — Abjuration Adept vraagt allebei, en in één tekstvak kan de app er niets mee. Op het kaartje worden ze als één regel getoond. Staat er een armor training in, dan rekent de app zelf uit welke classes die geven; die hoef je dus niet ook nog aan te vinken.

**Geeft spreuk**: namen met een komma ertussen. De app zoekt op welke classlijsten die spreuken staan en zet de feat daar bij *Geeft een spreuk*.

### Sluit aan op

Welke classes hebben hier iets aan? Dat kan zijn omdat de feat ze noemt — Magic Initiate geeft clericspreuken — of omdat hij bij hun manier van spelen hoort.

Het is een **wegwijzer en geen eis**: de feat blijft voor iedereen te kiezen. Hij staat dichtgevouwen omdat je hem bij de meeste feats niet aanraakt; het getal achter de kop zegt hoeveel er aanstaan.

### Wat laat deze feature kiezen?

Een feature die zegt *"kies een skill"* of *"je leert een taal naar keuze"* is voor een lezer duidelijk en voor de app niets. Met een **keuzeblok** wordt het een invulveld in de personagemaker, en landt wat hij kiest op zijn blad.

Per blok: **wat** hij kiest (skill, taal, gereedschap, spreuk, feat, ability of een vrije keuze), **hoeveel**, en wat het hem **geeft** — proficiency, expertise of +1/+2. Daaronder staat **waaruit**: alles van die soort, een eigen lijst met komma's ertussen, *uit wat je al hebt* (zo werkt Expertise), of *de skills van deze class* — die lijst kent de app al, dus die hoef je niet over te typen.

Alleen bij een keuze die aan tafel valt — *"kies een wezen dat je kunt zien"* — zet je er niets neer. Een invulveld dat vraagt welk wezen je kiest is erger dan geen invulveld.

### Meer dan één keuze, of eerst een vorm

Veel features laten je **twee** dingen kiezen: Giant's Power geeft een taal én een cantrip, Student of War een gereedschap én een skill. Druk dan op *Keuze erbij*. Geef ze allebei een **label** — "Taal", "Cantrip" — anders staat dezelfde featurenaam twee keer boven twee lege velden.

Soms kies je eerst wélke vorm van de feature je neemt, en pas die vorm bepaalt de rest: een Half-Elf kiest tussen Skill Versatility (twee skills) en Drow Magic (drie spreuken). Zet de soort dan op **een vorm**, schrijf de namen eronder, en zet achter de vorm die iets te kiezen geeft wat dat is — *2 skill*, *1 language*. De maker toont die vervolgkeuze pas zodra die vorm gekozen is, en haalt hem weer weg als de speler wisselt.

### Een worptabel wordt een tafel

Noemt de eerste kolomkop een steen — **d6**, **d100** — dan staat er onder de tabel een knop *Bewaren als tafel*. Eén klik en hij staat in de Tafels-tab, waar je hem kunt rollen en hergebruiken.

Het is een **kopie**: de tekst van de feature blijft staan zoals hij is. En het werkt alleen bij een worptabel: een overzicht van wat je per level krijgt is geen tafel om op te rollen, en die hoort niet tussen je dobbeltabellen te belanden.

---

## `spreuken`

> Helpknop in: render-spreuken.js:565
> Nu: de standaard uit de code
> 6 stappen · 311 woorden · 52 per stap · rolverdeling (speler)

Titel: Spreuken — de bibliotheek

### Dit zijn niet jouw spreuken

Deze bibliotheek bevat álle spreuken die in deze wereld bestaan — honderden, van elke class en elk level, en daarnaast wat de DM voor deze campagne zelf verzon. Je kunt er alles in opzoeken, maar je kent het niet uit je hoofd: wat jouw personage daadwerkelijk kan, staat in je eigen Spreukenboek onder je personage.

### Tik om te openen

Elke spreuk is een kaartje met een plaat (of het teken van zijn school) en een naam; het getal linksboven is het level, een C is een cantrip. **Tik erop** en het wordt groot; **tik nog eens** en het draait om naar het volgende blad: gegevens, beschrijving en At Higher Levels. Zoek je op een woord uit de tekst, dan opent hij meteen op dat blad. Het pijltjesknopje rechtsonder opent de hele spreuk, en Escape maakt het kaartje weer klein.

### Een spreuk aanvragen {alleen spelers}

In een open kaartje staat onderaan een **plus**: daarmee vraag je de DM om die spreuk in je boek. Een zandloper betekent dat hij nog moet beslissen, een vinkje dat hij erin staat — dat vinkje zie je ook op het dichte kaartje.

### Waar staan mijn eigen spreuken dan?

Ga naar je personage en kies het tabblad Spreukenboek. Daar staat alleen wat jij kent, met je Spell Save DC, je spell attack bonus en je spell slots. Wat je daar niet ziet, kun je ook niet casten — hoe verleidelijk het hier ook staat.

### Waar is het dan goed voor?

Om op te zoeken wat een spreuk van een tegenstander doet, om te kijken wat je bij een volgend level zou kunnen leren, of om een scroll of staf op te zoeken die je gevonden hebt. Filter op class, level of school, of zoek op naam.

### Nieuwe spreuken leren

Spreuken komen in je eigen boek terecht via je class (bij een level-up), via een scroll of via de DM. Rondkijken in de bibliotheek voegt niets toe aan je boek — vraag het je DM als je denkt dat er iets ontbreekt.

---

# Avontuur

Wat er achter de kompasknop zit: logboek, prikbord, kaarten, dungeons en het bastion. Hier staan DM en speler het vaakst op hetzelfde scherm, dus let op de rolverdeling.

## `logboek`

> Helpknop in: render-archief.js:231
> Nu: de standaard uit de code
> 3 stappen · 108 woorden · 36 per stap

Titel: Logboek

### Verslagen

Hier staan de sessieverslagen van de campagne, aangevuld met notities van de DM. Je kunt door aktes bladeren via de navigatie bovenaan.

### Genadeslagen

Elke keer dat iemand bij **How do you want to do this?** beschreef hoe hij een tegenstander velde, staat dat bovenin onder **Genadeslagen** — de nieuwste eerst, met wie het deed en tegen wie. Ze staan ook in het verslag van hun eigen gevecht; hier lees je ze bij elkaar. Zolang er nog niemand een beschreef, staat de knop er niet.

### Missies (prikbord)

Op het prikbord staan alle missies van de campagne, ingedeeld op status: Beschikbaar, In uitvoering, Voltooid en Mislukt. Klik op een missiekaartje voor de details.

---

## `prikbord`

> Helpknop in: render-relatiemap.js:102
> Nu: de standaard uit de code
> 3 stappen · 121 woorden · 40 per stap

Titel: Het prikbord

### Wat het is

Een bord van de **party**: wie horen bij wie, wie hebben jullie waar gezien, welk vermoeden hangt aan welke naam. Elke party heeft haar eigen bord en iedereen in die party ziet hetzelfde.

### Prikken en verbinden

**Kaartje** zet een personage, locatie of organisatie op het bord — of een blanco notitie met je eigen tekst. **Draad** spant een lijn tussen twee kaartjes; klik op een draad om er een woord bij te zetten of hem weg te halen. Kaartjes sleep je waar je ze hebben wilt.

### Organogram

Zet een hele organisatie in één keer neer: de leden komen eronder te hangen, met een draad naar hun baas. Wat de party nog niet kent, komt niet mee — ook geen verbinding die achter een geheim zit.

---

## `kaart`

> Helpknop in: app.js:3744, render-kaart.js:134
> Nu: de standaard uit de code
> 2 stappen · 76 woorden · 38 per stap

Titel: De kaart

### De kaarten

Alle kaarten die je party kent, van de wereld tot een enkele kelder. Klik een kaart om hem groot te openen.

### Rondkijken

Sleep om te schuiven; **dubbelklik** om in te zoomen op die plek, en nog eens voor verder. De knop met de twee schuine pijltjes maakt hem weer passend. Een speld is een plek die je kent — klik erop voor zijn kaartje; sluit je dat, dan sta je weer op dezelfde plek op de kaart.

---

## `hulp_kaart_wereld`

> Helpknop in: app.js:3979
> Nu: de standaard uit de code
> 2 stappen · 62 woorden · 31 per stap

Titel: Een kaart bewerken

### Naam en beschrijving

De naam staat op het kaartje in de galerij en boven de kaart zelf; de beschrijving staat eronder, zodat je bij zes kaarten nog weet welke welke is.

### Wie ziet wat

Een hoofdkaart is voor iedereen zichtbaar. Wat een speler erop ziet hangt aan de **locaties**: een speld erft de zichtbaarheid van het kaartje waar hij bij hoort. Verberg dus de locatie, niet de kaart.

---

## `dungeon`

> Helpknop in: app.js:3979, render-dungeon.js:325
> Nu: de standaard uit de code
> 9 stappen · 395 woorden · 44 per stap · rolverdeling (speler + dm)

Titel: Dungeonkaarten

### Kamer voor kamer {alleen spelers}

Een kerker of gebouw gaat open naarmate je erdoorheen loopt: je DM onthult een ruimte als je er binnenstapt. Wat nog bedekt is, blijft in de mist — dat je daar niets ziet betekent niet dat er niets is.

### Doorgangen {alleen spelers}

Een pijl op de kaart brengt je naar een andere plattegrond: een trap, een luik, een lift. Klik hem aan en je springt mee; terug gaat net zo.

### Wat de symbolen zeggen {alleen spelers}

Een schedel, een munt, een slot: markeringen die je DM heeft achtergelaten. Ze verklappen niet wát er ligt, alleen dát er iets is.

### Fog of war {alleen jij}

De kamers van een dungeon worden **per party** onthuld. Klik een kamer aan en gebruik *Onthul* — of het oogje in de kamerlijst. Verbergen kan net zo goed weer; wat verborgen is, is voor die party nooit geweest.

### Kamers tekenen {alleen jij}

Kies een vorm — **rechthoek**, **rond** of **polygoon** — en sleep hem over de plattegrond; bij een polygoon klik je de hoeken en sluit je af met een dubbelklik. Met het **pijltje** selecteer je: slepen verplaatst de kamer, de bolletjes op de punten stellen hem bij. Naast een kamer klikken sluit dat weer.

### Doorgangen leggen {alleen jij}

Een **doorgang** verbindt deze kamer met een kamer op een andere plattegrond; op de kaart verschijnt een pijl waarmee je erheen springt. Hij wordt altijd tweezijdig gelegd. Het kan een trap zijn, maar net zo goed een lift, een luik of een teleportcirkel.

### Symbolen, vondsten en tegenstand {alleen jij}

De **symbolen** (schedel, munt, slot, vinkje) zijn markeringen op de kaart; per symbool bepaal je of de spelers hem zien — zo geef je een hint zonder alles te verklappen. Koppel je een **vondst** of een **gevecht** aan de kamer, dan verschijnt het bijbehorende symbool vanzelf: gestippeld, en alleen voor jou. Klikken op de munt opent meteen de verdeling.

### Vondsten in een kamer {alleen jij}

Onder *Vondsten* hangt de buit die hier te halen valt. Typ wat er te vinden is en druk op plus, of koppel een vondst die je al in het Loot-tabblad gemaakt hebt. De DC ernaast is een aantekening voor jou — de spelers gooien aan tafel en jij beslist. Met het muntje maak je er een verdeling van; het kruisje koppelt de vondst los zonder hem weg te gooien.

### Party-toegang {alleen jij}

Het **oogje** op het kaartje in de galerij zet de stand voor de party die nu speelt: verborgen → zichtbaar met mist → uitgespeeld. Andere party's houden hun eigen stand, dus dezelfde kaart dient meerdere groepen zonder dat hun voortgang door elkaar loopt.

---

## `hulp_kaart_dungeon`

> Helpknop in: app.js:3979
> Nu: de standaard uit de code
> 3 stappen · 128 woorden · 43 per stap

Titel: Een dungeon bewerken

### Naam, beschrijving en beeld

De thumbnail is het plaatje op het kaartje in de galerij. Dat kaartje snijdt bij, dus sleep het kruisje naar wat in beeld moet blijven — net als bij een personage of een aktebanner.

### Verdieping

**0** is de begane grond, **−1** een kelder, **1** de eerste verdieping. Leeg laten als deze kaart niet bij een gebouw met verdiepingen hoort. Welke kaarten samen één gebouw vormen leidt de app af uit de **trappen** die je ertussen tekent; bovenin verschijnen dan knopjes om te wisselen.

### Zichtbaarheid

Die zet je niet hier maar op het kaartje zelf, met het oogje — en hij geldt voor de **actieve party**, net als bij elk ander kaartje. Drie standen: verborgen, zichtbaar met fog-of-war (kamers onthul je één voor één), en uitgespeeld (de hele plattegrond ligt open).

---

## `hulp_dungeon_nieuw`

> Helpknop in: render-dungeon.js:1791, render-dungeon.js:1791 (venster)
> Nu: de standaard uit de code
> 5 stappen · 198 woorden · 40 per stap

Titel: Een nieuwe dungeonkaart

### Twee manieren

Je **uploadt een plattegrond** — een kaart die je ergens vandaan hebt, waar je daarna kamers overheen legt om ze te onthullen — of je **tekent zelf**. Dat laatste geeft je een leeg doek met een raster; de kamers teken je er daarna op met de gereedschappen.

### Eén vakje is vijf voet

Dat is geen instelling maar de maat waarmee 5e rekent. Het getal achter de grootte zegt dus meteen hoe groot je dungeon in voeten is: 30 × 20 vakjes is 150 × 100 voet. Een zaal van tien bij tien vakjes is vijftig voet breed — ruim genoeg voor een gevecht met tien man.

### Tekenen gaat op het raster

Een kamer klikt vast op de vakjes, zodat muren netjes aansluiten. Houd **Alt** ingedrukt om er langs te tekenen — handig voor een grot of een schuine gang.

### Meerdere verdiepingen

Bij een geüploade plattegrond geef je ze hier in één keer op; de app maakt er één kaart per verdieping van en houdt ze bij elkaar. Teken je zelf, dan maak je één kaart en voeg je verdiepingen later toe.

### De stijl bepaalt alleen hoe het eruitziet

Donkersteen, Perkament, Leisteen, Blauwdruk of Mosgroen — het verandert de kleuren van vloer, muur en raster, verder niets. Je kunt hem later omzetten zonder dat er een kamer verschuift.

---

## `bastion`

> Helpknop in: bastion.js:66, bastion.js:96
> Nu: de standaard uit de code
> 11 stappen · 886 woorden · 81 per stap · rolverdeling (speler + dm)

Titel: Het bastion

### Wat het is

Een **Bastion** is de thuisbasis van jullie party: een plek met **facilities** die tussen de avonturen door voor je werken. Het komt uit de *Dungeon Master's Guide* van 2024, met één verschil: hier heeft de **party** één bastion samen, niet elk personage een eigen.

Er zijn twee soorten facilities. **Basic Facilities** (een slaapkamer, een keuken) zijn sfeer. **Special Facilities** (een Smithy, een Library, een Garden) krijgen elke turn een **order**: Craft, Empower, Harvest, Recruit, Research, Trade of Maintain.

### Een order geven {alleen spelers}

Tik op een order onder een facility om hem voor te stellen, en schrijf erbij wat je precies wilt — "een longsword", "alles over de Vergeten Kapel". Een ander mag je voorstel vervangen; wat de DM **vastlegde** (het slotje) niet.

De DM rondt de turn af en schrijft erbij wat het opleverde. Dat lees je terug in het logboek onderaan.

### Een order geven {alleen jij}

Spelers stellen orders **voor** (een zandloper); wat jij kiest ligt **vast** (een slotje) en kan een speler niet overschrijven. Wil je dat zij het zelf vastleggen, dan zet je dat bij Instellingen → *Bastion*.

**Turn afronden** zet elke order in het logboek, met een vak waarin je schrijft wat hij opleverde. Daarna zijn de orders weg en begint de telling opnieuw.

### Hoeveel facilities {alleen jij}

Elk personage geeft het bastion **2** special facilities op level 5, **4** op 9, **5** op 13 en **6** op 17 — bij elkaar opgeteld voor de hele party. Vind je dat te veel of te weinig, vul dan bij het potlood een eigen getal in; leeg laten betekent weer "reken het uit".

Kies je een facility boven het level van de party, één met een prerequisite die niemand haalt, of één te veel: de app zegt het, maar **houdt niets tegen**. Het is jouw tafel.

### Wanneer is het een turn?

Een **Bastion Turn** valt ongeveer elke zeven dagen. De app telt dat in **lange rusten** van de party — dezelfde klok als de winkels die verversen. Na zeven nachten staat er een banier bovenaan, en hoort de DM het meteen na de lange rust.

### Voorvallen bij een turn {alleen jij}

Stond een facility op **Maintain** of bleef er eentje zonder order, dan is er die week niemand die oplet — en rolt de app één voorval. Welke tafel dat is kies je bij *Instellingen → Bastion*; het voorval komt in het logboek van die turn en verschijnt op het **tafelscherm**, niet bij je spelers.

De Bastion Events uit de Dungeon Master's Guide leveren we niet mee: die tekst mogen we niet delen. Je wijst dus een tafel van je eigen campagne aan, net als bij de rust. Kies je er geen, dan rolt er niets.

### Verdedigers en een aanval {alleen jij}

Het **aantal verdedigers** houd je zelf bij met de plus en de min. De app telt het niet uit: hoeveel een Barrack of een Armory er geeft staat in de DMG, en die getallen leveren we niet mee — wél staat eronder wélke van jouw facilities er volgens hun eigen werking geven.

**Aanval rollen** gooit zes stenen, of vier als je *Verdedigingsmuren* hebt aangevinkt (beide aantallen zijn instelbaar). Wat een worp betekent staat ook in dat boek, dus de app bewaart de stenen zoals ze vielen en vraagt je wat het aan tafel werd. Dat komt als eigen regel in het logboek.

### Bouwen kost geld en tijd {alleen jij}

Boven de lijst met facilities staan drie vakjes: **kost**, **nachten** en wie het betaalt. Vul je ze in, dan gaat het geld van de beurs (de gedeelde beurs als die aanstaat) en staat de facility zolang *in aanbouw* — met een band erover en het aantal nachten dat nog te gaan is. Die nachten tellen in lange rusten, net als de Bastion Turn: de party bepaalt het tempo, niet de kalender.

Allebei leeg laten mag: dan staat hij er gewoon. Hoevéél een facility kost staat in de Dungeon Master's Guide, dus dat vul je zelf in.

### Een eigen plaat per facility {alleen jij}

Met het beeld-knopje op een facility kies je er een plaat bij uit je mediabibliotheek — dezelfde kiezer als overal. Hij ligt achter het kaartje met een sluier erover, zodat de tekst leesbaar blijft. Het kruisje ernaast haalt hem weer weg.

### Empower en de voorvallen {alleen jij}

Niet elke Empower-order raakt de voorvallen: elke facility heeft zijn eigen Empower-effect. Twee ervan gaan erover.

De **Meditation Chamber** op Empower laat de volgende worp **twee keer** rollen; jij kiest welke het werd. De **helms** uit Eberron (Lyrandar, Orien, Navigator's) doen het omgekeerde: die rollen juist een voorval, alsof je Maintain had gegeven.

Verder rolt er een voorval als een facility op Maintain stond of zonder order bleef — dan is er niemand die oplet.

### Wat een order oplevert {alleen jij}

Bij het afronden van een turn staat onder elke order een regel met **Geld**, **Voorwerp**, **Verdedigers** en **Naar wie**. Wat je daar invult wordt echt verwerkt: het bedrag gaat naar de beurs (de gedeelde beurs van de party als die aanstaat), het voorwerp belandt in de boedel, en de verdedigers tellen op.

Geld schrijf je zoals overal: *12 fl* of *3,50*. Een **minteken** ervoor betekent dat het kóst in plaats van opbrengt — zo betaal je een Recruit. Bij Voorwerp typ je de naam van een **kaartje uit je archief**; kent de app die naam niet, dan zegt hij dat en gaat die regel zonder voorwerp mee.

Hoevéél een Trade of een Craft opbrengt staat in de Dungeon Master's Guide, dus dat vul je zelf in. De app doet het rekenwerk en de administratie; jij tekent af — zoals bij een bod van een winkel of een beloning.

---

# De diensten

In de volgorde van het menu (`DIENST_GROEPEN`): kopen en verkopen, rust en vermaak, raad en zegen, krediet en aanzien. Elk boekje hangt aan de kop van één dienst, dus het hoort over díé plek te gaan — wie er staat, wat je er kunt, wat het kost.

## `markt`

> Helpknop in: app.js:13484, wizard.js:46 (dienstkop)
> Nu: de standaard uit de code
> 4 stappen · 177 woorden · 44 per stap

Titel: De Markt

### Alle winkels op één plek

Hier staan de winkels die je gezelschap kent en vandaag kan bereiken, met het gebied waarin ze liggen. Je ziet in één oogopslag waar je terecht kunt; kopen doe je binnen, in de winkel zelf.

### Zoeken over alle winkels tegelijk

Typ een voorwerp en je ziet **waar het ligt en wat het kost**, goedkoopste bovenaan. Scheelt prijs per winkel, dan staat er *goedkoopst* bij; zijn ze allemaal gelijk, dan staat er niets — dat is dan geen keuze. Een prijs die je met de beurs van de party niet kunt betalen kleurt rood.

### Kopen doe je in de winkel

Klik een winkel (of een regel in de zoekresultaten) en je **loopt naar binnen**: de gevel, de winkelier, en zijn schappen. Daar koop je, en na een aankoop blijf je gewoon in de winkel staan. *Markt* linksboven brengt je terug.

### Wat je niet ziet

Alleen winkels die je party **ontdekt heeft** en die tijdens deze akte bereikbaar zijn. Een winkel met een **wisselend assortiment** die je nog niet bezocht hebt, geeft zijn voorraad niet prijs — daar moet je langs. De DM ziet alles, met erbij waarom iets voor de party dicht zit.

---

## `winkel`

> Helpknop in: app.js:13612
> Nu: de standaard uit de code
> 6 stappen · 202 woorden · 34 per stap

Titel: In de winkel

### Achter de toonbank

Je staat in één winkel: de winkelier, zijn groet en zijn schappen. Wat erin ligt is wat hij vandaag heeft. *Markt* linksboven brengt je terug naar het overzicht.

### Kopen

Kies het aantal en klik **Kopen**. Het bedrag gaat van je eigen beurs af, of van de gedeelde beurs als die aanstaat. Kun je het niet betalen, dan kleurt de prijs rood en gebeurt er niets.

### Verkopen

Koopt deze winkel in, dan staat onder de voorraad je eigen boedel met wat hij ervoor biedt. **Aanbieden** stuurt het naar je DM; je krijgt het geld zodra hij aftekent. Zie je dit blok niet, dan koopt deze winkel niets in. Zegeningen, gunsten en class-features blijven buiten de handel.

### Afdingen doe je aan tafel

Er is geen knop om te onderhandelen: dat speel je uit. Het bod van de winkel is een uitgangspunt — je DM mag het bedrag bijstellen voor hij uitbetaalt, omhoog zowel als omlaag.

### Uitverkocht

Een doorgestreepte regel is er even niet. Bij een winkel met een **wisselend assortiment** ligt er elke keer iets anders in de schappen; wat je vandaag ziet is wat er vandaag is.

### Wat iets ís

Klik de naam van een voorwerp: dan opent zijn **kaartje**, met de beschrijving, het beeld en wat het doet. Daarna kun je gewoon terug.

---

## `magizoo`

> Helpknop in: app.js:14621 (dienstkop), dm-panel.js:7344 (dienstkop), wizard.js:49 (dienstkop)
> Nu: **aangepast in deze campagne**
> 4 stappen · 184 woorden · 46 per stap
> De standaard telt 2 stap(pen).

Titel: Vivarius

### Wat je hier kunt

Vivarius is de magizoöloog: hij weet van beesten. Twee dingen doet hij voor je — hij **onderzoekt** een wezen dat je bent tegengekomen, en hij heeft dieren **ter adoptie**. Die twee staan in eigen tabbladen boven het paneel.

### Onderzoek

Kies een wezen uit je bestiarium en geef hem de opdracht. Elk onderzoek kost geld en kost tijd: het antwoord komt niet meteen. Hij tilt je kennis één stap op — van alleen de naam, naar de hoofdzaken, naar het hele statblock.

### Kennisniveaus

Er zijn drie: **naam** (je herkent het wezen en weet verder niets), **deels** (AC, ability scores, resistances en senses) en **volledig** (traits, actions en de Challenge Rating). Hoe meer je weet, hoe preciezer je in een gevecht ziet hoe het ervoor staat: bij *deels* en *volledig* staat er een getal in plaats van een balk.

### Adoptie

Wat vandaag in de kooien zit, staat onder *Adoptie*. Een dier kost geld en krijgt een naam van jou; daarna loopt het met je mee en vecht het aan jouw kant, met een statblock dat meegroeit met jouw level. Eén dier per gezelschap — en een dier kan sterven.

---

## `herberg`

> Helpknop in: app.js:13943 (dienstkop), wizard.js:43 (dienstkop)
> Nu: **aangepast in deze campagne**
> 4 stappen · 175 woorden · 44 per stap
> De standaard telt 2 stap(pen).

Titel: De Swarte Cat

### Wat je hier kunt

De Swarte Cat is de herberg van Grisburgh. Je komt er voor twee dingen, en die staan in eigen tabbladen: horen wat er in de stad gebeurt, en iets eten of drinken.

### Roddels

Brÿlwaen, de waardin, vertelt je wat ze aan de toog heeft opgevangen over mensen en plekken. Het kost niets. Wel is het druk, dus ze heeft niet altijd tijd voor je — en elke roddel vertelt ze maar één keer.

### Aan de tap

Op de kaart staan drank en maaltijden met hun prijs. Je bestelt zelf; het bedrag gaat van je beurs af, of van de gedeelde beurs als die aanstaat. Wat een bestelling doet staat op het kaartje erbij: genezing, **Temporary HP**, of een aantekening die je tot je volgende lange rust bij je draagt.

### Blijven slapen

Je kunt in De Swarte Cat ook overnachten. Dat regelt je DM voor het hele gezelschap tegelijk: een lange rust binnen zet je HP en je spell slots terug en schrijft de prijs van de overnachting af. Binnen slapen levert bovendien andere voorvallen op dan een nacht in het veld.

---

## `tweespalt`

> Helpknop in: app.js:15414 (dienstkop), wizard.js:44 (dienstkop)
> Nu: **aangepast in deze campagne**
> 4 stappen · 169 woorden · 42 per stap
> De standaard telt 2 stap(pen).

Titel: De Tweespalt

### Wat je hier kunt

De Tweespalt is het gokhuis. Drie dingen kun je er: wedden op wat er elders gebeurt, zelf de ring in stappen, en bij Taevin Woekeling geld lenen. De eerste twee staan in eigen tabbladen.

### Wedden

Onder *Wedden* staan de weddenschappen die openstaan, elk met zijn opties. Kies waar je op gokt, zet je bedrag in en bevestig. De uitslag komt niet van een knop maar van de tafel: valt het jouw kant op, dan keert je DM de winst uit.

### Het Strijdperk

Onder *Strijdperk* staan de partijen waarvoor je jezelf kunt inschrijven, met wat het oplevert. Je vecht dan zelf: je DM zet het gevecht op en bepaalt de uitslag. Je inzet ben je kwijt als je verliest.

### Lenen van Taevin

Kom je geld tekort, dan leent Taevin het je. Let op de rente: die loopt per **lange rust** van je gezelschap, niet per dag — haast je dus niet met slapen als je rood staat. Je kunt in één keer of in delen aflossen, en lost je niets af, dan komt hij het halen.

---

## `tempel`

> Helpknop in: app.js:14972, app.js:15052, wizard.js:47 (dienstkop)
> Nu: **aangepast in deze campagne**
> 4 stappen · 167 woorden · 42 per stap
> De standaard telt 3 stap(pen).

Titel: De Tempel

### Wat je hier kunt

In de Tempel staan de goden van Grisburgh, elk met een eigen domein en een eigen priester. Klik een god aan om naar binnen te gaan. Daar kun je twee dingen: een **zegening** kopen, en een **eed** zweren.

### Zegeningen

Een zegening is een tijdelijk voordeel. Je betaalt, en dan beslist de worp: wélke zegen van die god je krijgt, en hoeveel keer je hem mag gebruiken. Hij komt als kaartje in je boedel. Eén zegening per god — een nieuwe vervangt de oude — en zodra de laatste keer op is, is hij weg.

### Eden

Een eed is blijvend en gaat met een plechtigheid gepaard. Je krijgt er een vaste bonus voor terug. Je kunt maar één eed tegelijk dragen, dus kies met beleid: zweren is niet zomaar terug te draaien.

### Vloeken

Verzaak je je eed, dan volgt een vloek. Die raak je kwijt door in de tempel boete te doen, en dat is duur. De tempel kijkt daarbij naar wat je deed, niet naar wat je van plan was.

---

## `ursula`

> Helpknop in: app.js:14896 (dienstkop), dm-panel.js:7466 (dienstkop), wizard.js:48 (dienstkop)
> Nu: **aangepast in deze campagne**
> 3 stappen · 115 woorden · 38 per stap
> De standaard telt 2 stap(pen).

Titel: Madame Ursula

### Wat je hier kunt

Madame Ursula leest de toekomst. Eén keer per akte kan het gezelschap een voorspelling vragen over wat komt; de uitslag is voor iedereen tegelijk te lezen. Wat ze zegt is vaag en poëtisch, nooit een belofte.

### De vijf zintuigen

Je vraagt haar vijf zintuigen te bevragen: zien, horen, ruiken, proeven, voelen. Ze rolt een d6 — bij een 1 tot 5 komt er één zintuig door, bij een 6 alle vijf. Wélk zintuig het wordt, beslist het lot.

### De harde kern

Onder het beeldspel zit soms een concreet gegeven: een naam of een plek. Dat komt er alleen bij de hoogste worp uit. Krijg je het niet, dan heb je een beeld en geen aanwijzing — en dat is de bedoeling.

---

## `gock`

> Helpknop in: app.js:14279 (dienstkop), dm-panel.js:7148 (dienstkop), wizard.js:45 (dienstkop)
> Nu: **aangepast in deze campagne**
> 3 stappen · 94 woorden · 31 per stap
> De standaard telt 2 stap(pen).

Titel: Juliaan de Gock

### Wat je hier kunt

Juliaan de Gock is privédetective. Twee dingen doet hij tegen betaling: hij **zoekt iets uit** voor je, en hij **brengt iets in de wereld** dat je verspreid wil hebben.

### Onderzoek

Kies een persoon, locatie of organisatie en geef hem de opdracht. Na een dag ligt zijn rapport in je postvak. Wat hij vindt hangt af van wat er te vinden is — en soms van wie er niet gevonden wil worden.

### Roddels verspreiden

Je kunt hem ook een gerucht laten rondbrengen over iemand of iets: waar of niet. Wat dat uitricht beslist de tafel, niet de app.

---

## `woekeraar`

> Helpknop in: app.js:14552 (dienstkop), wizard.js:50 (dienstkop)
> Nu: de standaard uit de code
> 4 stappen · 151 woorden · 38 per stap

Titel: De geldschieter

### Hij leent, als enige

Geen winkel schrijft aan, geen tempel geeft krediet. Als je geld tekortkomt is er één adres, en dat is het zijne. Dat maakt een schuld ook iets dat je kunt vertellen: je weet bij wie je in het krijt staat.

### Vragen gaat langs de DM

Je vult in hoeveel je nodig hebt en waarvoor. Hij denkt erover na — de DM beslist of je het krijgt, en voor hoeveel. Eén schuld tegelijk: los eerst af voor je opnieuw aanklopt.

### De rente loopt op rust

Niet op de kalender: elke **lange rust** van je gezelschap is een nacht die telt. Haast je dus niet met slapen als je rood staat. Het bedrag groeit tot een plafond; daarna stopt hij met tellen — en dan komt hij het halen.

### Aflossen

Alles in één keer, of een deel. Bij een deel wordt wat overblijft de nieuwe hoofdsom en beginnen de nachten opnieuw te tellen — aflossen loont dus, ook als je er niet helemaal uitkomt.

---

## `facties`

> Helpknop in: app.js:9816, app.js:15621 (dienstkop), app.js:15735
> Nu: **aangepast in deze campagne**
> 5 stappen · 212 woorden · 42 per stap
> De standaard telt 4 stap(pen).

Titel: Facties & aanzien

### Wat dit is

Facties zijn organisaties in Grisburgh waarmee je gezelschap een band kan opbouwen. Wat je voor ze doet levert **aanzien** op, en met aanzien klim je in hun rangen. Op het overzicht staan de facties die je kent; klik er een aan om naar binnen te gaan.

### De hiërarchie

Elke factie heeft zes treden. In het factiescherm staat onder *De hele hiërarchie* de hele ladder: welke je bereikt hebt, waar je nu staat, en hoeveel aanzien de volgende trede vraagt. Zo zie je in één keer wat er nog boven je ligt.

### Rangen en voordelen

Bereik je een nieuwe trede, dan krijg je daar vanzelf iets voor terug: een voorwerp, een bedrag, of een dienst die de factie voor je uitvoert. Wat het precies doet staat op het kaartje dat je ontvangt.

### Missies

Hangt je DM een missie aan een factie en zet hij hem open voor jullie, dan staat hij hier met een knop **Accepteer**. Hij vraagt hem aan; je DM tekent af. Per factie loopt er één missie tegelijk. Alle missies die je hebt lopen, staan bij elkaar onder *Avontuur → Missies*.

### Aanzien en beloning

Zodra je DM een missie op voltooid zet, komt het aanzien erbij. Bereik je daarmee een nieuwe trede, dan worden de gunsten meteen uitgedeeld; een geldbedrag gaat naar de gedeelde beurs of wordt eerlijk verdeeld.

---

# Het gevecht

Het gevechtsscherm, dat speler en DM allebei openen.

## `gevecht`

> Helpknop in: dm-panel.js:10819
> Nu: de standaard uit de code
> 2 stappen · 64 woorden · 32 per stap

Titel: Gevecht

### Gevechtsweergave

Tijdens een gevecht zie je bovenaan de initiatiefvolgorde met wie er aan de beurt is. De actieve deelnemer is goudgekleurd gemarkeerd. Condities (vergiftigd, verblind, etc.) zijn zichtbaar als iconen naast de naam.

### HP-balken van vijanden

Vijanden zonder bestiarium-kennis tonen een ruwe balk in drie segmenten: gezond, gewond, kritiek. Als je het wezen deels of volledig kent (via de Magizoöloog), zie je een nauwkeurige balk met exacte HP.

---

# De meesterkamer

De tabs van het meesterpaneel, in de volgorde van de zijbalk. Toon: je praat tegen de DM, over wat hij instelt en wanneer hij het gebruikt.

## `akte_schrijven`

> Helpknop in: akte-schrijven.js:886
> Nu: de standaard uit de code
> 7 stappen · 512 woorden · 73 per stap

Titel: Een akte schrijven

### Schrijven en spelen in één scherm

Links staan de **secties** van je hoofdstuk — elke `##`-kop is er een. Je kunt ze **verslepen** om een scène te verplaatsen; alles wat eronder hangt gaat mee. Onderaan die kolom staat wat niet bij één plek in de tekst hoort: **Rust** en de **character sheets**.

### Invoegen zonder tekens te typen

Onder **Invoegen** staat alles wat je in een akte kwijt kunt: een sectie, een lijst, een tabel, een voorleesblok, een gevecht, een tabel om te rollen, een vondst, een kamer, een geluid, muziek, een brief, een missie. Elk item heeft een sneltoets (**Alt** + de letter erachter). *Kaartje* en *Beeld* staan los, want die gebruik je in bijna elke alinea; een kaartje kan ook met `[[` — dan zoekt de app mee.

### Een missie verzetten vanuit je tekst

Het blok **Missie** zet een missie op het bord op de plek in het verhaal waar het gebeurt. Zonder meer wordt hij **Beschikbaar** — hier horen ze ervan. Wil je iets anders, zet dat er met een punt achter: `De verdwenen klok · voltooid`. Dat mag ook *in uitvoering*, *mislukt* of *verborgen*. Het geldt voor de party die vanavond speelt, en één klik terug zet hem weer waar hij stond.

### Geluid

Het blok **Geluid** haalt een geluid bij naam uit je mediabibliotheek en laat het tijdens het spelen aan de hele party horen — niet alleen aan jou in je eigen browser. Zet je **loop** of **herhaal** achter de naam, dan blijft het doorlopen; dat is dezelfde afspraak als bij een muziekblok. *Muziek* is voor Spotify, *Geluid* voor je eigen bestanden.

### Omgeving

Het blok **Omgeving** laat de plek zelf iets doen: de grond beeft, het water stijgt, een altaar zegent. Je kiest een effect uit de catalogus (`aardbeving`, `storm`, `heilig-licht`…) en zet er desgewenst met een puntje een eigen tekst achter: `aardbeving · De mijngang stort in`. Tijdens het spelen zet **Op tafel** het op het tafelscherm met de Saving Throw erbij, en bovenin krijg je het afhandelpaneel: tik per speler aan wie slaagde en druk op **Toepassen**. Buiten een gevecht gaat de schade van het blad af; een conditie zet je dan zelf, want die heeft buiten een gevecht geen token om op te staan.

### Tekst en beeld, en Spelen

**Tekst en beeld** zet je tekst links en het perkament rechts, zodat je ziet wat je maakt. Het perkament **loopt mee**: scroll je in de tekst, dan schuift het mee, en de alinea waar je cursor staat krijgt een streepje in de kantlijn. Klik je in het perkament, dan springt de cursor naar diezelfde regel in de tekst. **Spelen** toont alleen het perkament, met de knoppen erbij: onthullen bij een naam, *Toon aan spelers* bij een beeld, *Start gevecht* bij een gevechtsblok. Die knoppen doen het écht — het is dezelfde weergave als de lade onderin tijdens het spelen.

### Namen, importeren en exporteren

**Namen** laat zien welke `[[namen]]` uit je tekst nog geen kaartje hebben — het getal op de knop is dat aantal, en je maakt ze er meteen bij. Achter **⋯** kun je een `.md` **importeren** (dat vervángt de tekst) of je hoofdstuk **exporteren** als bestand, bijvoorbeeld om het in je Obsidian-vault te zetten. Opslaan hoeft niet: dat gebeurt terwijl je typt.

---

## `dm_checklist`

> Helpknop in: dm-panel.js:13006 (venster), dm-panel.js:13006 (venster)
> Nu: de standaard uit de code
> 3 stappen · 162 woorden · 54 per stap

Titel: Klaar om te spelen?

### Waarvoor dit is

Een lijst om te lézen, vlak voordat je begint — geen formulier, er wordt niets bewaard. Een nieuwe DM weet niet wat er aan tafel klaar moet staan, en een ervaren DM vergeet het ene ding dat hij deze keer níét standaard had.

### Vinkje of vraagteken

Een **vinkje** betekent dat de app het zelf heeft nagekeken: meldt er een tafelscherm, staat de juiste party actief, hangt er een akte in de regie-balk, is de muziek gekoppeld en op een apparaat gezet.

Een **vraagteken** betekent dat alleen jij het weet. De privésessie van Spotify geeft hun API niet vrij, en of het geluid uit de juiste boxen komt weet alleen wie in de kamer zit. Een vinkje dat niets betekent is erger dan geen vinkje.

### Bereikbaarheid

Die regel vertelt wat er nú dichtstaat — de diensten die je in deze akte uitvinkte, de kaartjes die onbereikbaar zijn, en of je party de stad uit is. De app kan niet weten of dat klopt voor vanavond; jij wel.

---

## `dm_terugblik`

> Helpknop in: dm-panel.js:3219
> Nu: de standaard uit de code
> 5 stappen · 276 woorden · 55 per stap

Titel: Wat voorafging

### Waar het voor is

Aan het begin van een avond weet de helft van de tafel niet meer waar ze gebleven waren. De terugblik maakt van je vorige sessieverslag een korte trailer op het tafelscherm: een titelkaart, de akte, je samenvatting woord voor woord over trage beelden, het citaat, wie ze ontmoetten, en dan *gaat het verder*.

### Wat erin komt

Alleen wat de **actieve party** al kent. Het verslag moet voor hen zichtbaar zijn, de beelden moeten voor hen onthuld zijn (die van het verslag zelf, plus wat er tijdens die akte op tafel kwam), en een personage krijgt pas een portret als zijn kaartje voor hen op zichtbaar staat. Een naam uit de tekst die ze nog niet kennen staat er dus wel als woord, maar zonder gezicht. Spelerspersonages staan niet bij *Wie u ontmoette* — die zitten aan tafel — maar komen aan het eind wel langs.

### Kiezen en afspelen

Standaard staat het laatste verslag klaar. **Op het tafelscherm** speelt hem daar af; **Zelf bekijken** speelt hem alleen op jouw scherm, zodat je eerst ziet hoe je tekst zich laat lezen. Hetzelfde kan vanuit een verslag in het Logboek.

### Tijdens het afspelen

Tikken of de pijl naar rechts springt naar het volgende shot, Escape sluit. Vanaf de regie-balk zet de monitor-knop het tafelscherm terug op sfeer, en dat breekt ook een lopende terugblik af. Een lang verslag houdt op na achttien zinsbrokken; schrijf de terugblik dus vooral in je **samenvatting**, kort en in de verleden tijd.

### Muziek

Zonder instelling zingt de app zelf: een lage drone met een dreun bij de titel. Wil je echte muziek, hang dan bij **Geluiden → Momenten → Terugblik** een bestand; dat zwelt aan bij het begin en sterft weg bij het eind.

---

## `dm_tafelscherm_fx`

> Helpknop in: dm-panel.js:3149
> Nu: de standaard uit de code
> 5 stappen · 220 woorden · 44 per stap

Titel: Effecten op het tafelscherm

### Twee soorten

Een effect onder **Eenmalig** flitst en ruimt zichzelf op — een wond, bliksem, een schokgolf. Een effect onder **Blijft staan** blijft op het scherm tot jij hem uitzet: mist, gif, vuur, duister. Dat verschil is er omdat een toestand een uitknop nodig heeft; zonder dat zou je scherm groen blijven omdat je tweemaal drukte.

### Scherm vrij

Haalt de lopende toestand weg. Er kan er maar één tegelijk staan — een nieuwe vervangt de vorige — maar een flits mag er wél overheen: een rode klap over je groene gifwaas.

### Overal, ook in een gevecht

De effectlaag ligt over álles heen: het sfeerscherm, een getoonde afbeelding, de dungeonkaart en de gevechtsweergave. Dat laatste is waar het om gaat, want laag HP ontstaat nu eenmaal in een gevecht.

### Vanzelf bij HP

Bij **Instellingen → In het gevecht** kun je het scherm laten meepraten als er HP verschuift: een rode flits bij een klap, feller bij zware schade, en een donkerrode schemer zolang er iemand op 0 ligt. Dat gaat alleen af op wat je aan tafel als klap opschrijft — genezing uit een rust, hit dice of een level-up doet niets. Standaard uit.

### Rustig aan met de felle

Bliksem, kritiek en de aardbeving zijn felle wisselingen. Wie in zijn systeem heeft staan dat hij minder beweging wil, krijgt ze zachter en zonder schok. Zit er iemand aan tafel die daar gevoelig voor is, gebruik ze dan spaarzaam.

---

## `hulp_muziek`

> Helpknop in: dm-panel.js:13794
> Nu: de standaard uit de code
> 6 stappen · 308 woorden · 51 per stap

Titel: Muziek uit Spotify

### Koppelen: de client-id

Maak op **developer.spotify.com/dashboard** een app aan — die hoort bij jóúw Spotify-account, en de client-id eruit is niet geheim. Zet in die app het **Redirect-URI** dat hier in het scherm staat; het moet er letterlijk in staan, inclusief het campagnepad. Kies bij de instellingen van die app **Web API**, en ook **Web Playback SDK** als je het geluid uit het tafelscherm wilt laten komen. Een tweede campagne heeft dus een eigen redirect-URI in datzelfde dashboard.

### Hoe het werkt

${window._campagneNaam()} speelt zelf niets af: het drukt op **play** bij Spotify. In een akte zet je een muziekstap neer (de muzieknoot in het regie-script); tijdens het spelen start je die met de muzieknoot in de regie-balk. Per stap kies je of het nummer één keer speelt of blijft herhalen.

### Waar komt het geluid uit

Standaard uit het apparaat waarop jij Spotify hebt draaien — meestal de laptop waarop je de regie bedient. Kies je *Het tafelscherm*, dan meldt de tablet zich zelf aan als Spotify-speler; die moet dan wel open staan en één keer aangeraakt zijn, want een browser mag pas geluid maken na een aanraking.

### Wat Spotify eist

**Premium**, anders weigert Spotify het afspelen op afstand. En er speelt maar **één stream per account**: luistert er iemand anders op hetzelfde account, dan nemen jullie het van elkaar over.

### Het volume

Het getal stuurt het volume van de speler waar je naartoe speelt. Laat je het leeg, dan blijft staan wat er stond — handig als je het aan tafel met de knop op je speaker regelt.

### Je aanbevelingen

Wat je aan tafel draait telt gewoon mee voor Discover Weekly en Wrapped. Een **privésessie** valt niet vanuit een app aan te zetten — Spotify heeft daar geen knop voor in zijn API. Zet hem zelf aan in Spotify (profiel → *Privésessie*), of — handiger omdat je het niet kunt vergeten — zet je sfeermuziek in eigen afspeellijsten en vink daar *Uitsluiten van je smaakprofiel* aan.

---

## `dm_gevecht`

> Helpknop in: dm-panel.js:1017 (subtabbalk)
> Nu: **aangepast in deze campagne**
> 3 stappen · 65 woorden · 22 per stap

Titel: Gevechten en monsters

### Initiative tracker

Voeg spelers en monsters toe aan het gevecht. Klik op "Start gevecht" om de initiative-ronde te beginnen. Het combat-scherm is zichtbaar voor alle spelers.

### HP beheren

Klik op het HP-getal van een combatant om schade of genezing toe te passen. Gebruik het schildicoon voor tijdelijke HP.

### Monsters toevoegen

Ga naar het subtabblad "Monsters" om monsters uit het bestiarium toe te voegen. Kies een encounter of voeg individuele monsters toe.

---

## `dm_gevecht_editor`

> Helpknop in: dm-panel.js:4834 (venster), dm-panel.js:4834 (venster)
> Nu: de standaard uit de code
> 7 stappen · 434 woorden · 62 per stap

Titel: Een gevecht bouwen

### Monsters

Zoek een statblock en zet erbij hoeveel je er wilt. Het aantal HP mag je per regel overschrijven — dan rolt de app ze niet uit maar neemt hij jouw getal. Een naam die je zelf intikt wint van de naam van het statblock: zo vecht de party tegen *Gorgo Hoornkop* en niet tegen "Minotaur of Baphomet".

### Thema

De twee kleuren die straks onder het gevecht liggen — jouw kant en de overkant. Je ziet ze in de lijst al op het kaartje, zodat je weet welke sfeer eraan hangt voor je hem opent.

### Buit

Koppel een **vondst** die je bij Loot gemaakt hebt; die verdeel je na afloop met de lootverdeler. Een gevecht dat nog losse buit had van vroeger houdt die zolang je geen vondst koppelt — zo raakt een oud gevecht niets kwijt door één keer op te slaan.

### Waar hoort het bij

Een **akte** groepeert je gevechten in de lijst en in het logboek. Een gevecht kan ook aan een dungeonkamer of aan een partij in het strijdperk hangen; die koppeling leg je daar, niet hier.

### Overgang

Hoe het tafelscherm het gevecht inluidt: drie witte flitsen en dan zet een patroon het beeld dicht — een spiraal, balken, een cirkel, scherven of een veeg. **Willekeurig** kiest er elke keer een; **Geen overgang** gaat meteen naar *Roll Initiative*.

### Lair Actions

Vecht de party in het hol van iets dat een lair heeft, dan is de lair op **initiative 20** aan de beurt (na wie 20 of hoger gooide). Elke regel is een **effect**: kies er een uit de catalogus — een aardbeving, een storm, stijgend water, vlammen, giftige nevel, een aftelling tot een explosie, of juist iets gunstigs zoals heilig licht, een helende bron of een beschermend altaar. Het effect vult de Saving Throw, de schade en de conditie in; elk veld mag je daarna aanpassen, en de tekst is wat er op tafel staat. **Eigen** is alleen tekst, zonder mechaniek.

### Tijdens het gevecht

Op initiative 20 krijg je bovenin je regels als knoppen; jij kiest. Het tafelscherm toont het effect met de Saving Throw eronder, en jij krijgt per doelwit drie knoppen: **Mislukt**, **Geslaagd** of **Niet geraakt**. De schade is al gerold — overtyp hem als de tafel anders gooide — en **Toepassen** zet hem op de tokens: heel bij mislukt, half of niets bij geslaagd, plus de conditie. Bij een gunstig effect kies je wie erin stond. Een **aftelling** gaat niet meteen af: rechtsboven op tafel tikt een penning elke nieuwe ronde één omlaag, en op nul gaat het effect alsnog af. Dezelfde regel twee rondes achter elkaar mag niet; de app zet *vorige ronde* erbij, maar houdt je niet tegen.

---

## `dm_loot_vondsten`

> Helpknop in: dm-panel.js:10041
> Nu: de standaard uit de code
> 3 stappen · 130 woorden · 43 per stap

Titel: De vondsten

### De bibliotheek van wat er ligt

Elke vondst is één ding dat de party kan vinden. Ze blijven staan nadat je ze onthuld hebt (met de melding *onthuld*), zodat je terug kunt zien wat waar lag.

### Onthullen

Vink één of meer vondsten aan en klik op de knop eronder. Dat bouwt één verdeling waarin elk voorwerp onthoudt uit wélke vondst het komt — "uit de haard" en "onder de plavuizen" blijven dus gescheiden. In het venster dat opent stel je nog bij; pas als je op onthullen drukt, zien de spelers iets.

### Kopiëren in plaats van sjablonen

Wil je zoiets als een vondst die je al hebt, kies hem dan bij *of kopieer een bestaande*. Je krijgt een nieuwe vondst met dezelfde DC, hetzelfde goud en dezelfde voorwerpen — alleen niet op dezelfde plek, want twee kisten liggen zelden in dezelfde kamer.

---

## `dm_loot_editor`

> Helpknop in: dm-panel.js:10068 (venster), dm-panel.js:10068 (venster), dm-panel.js:10111
> Nu: de standaard uit de code
> 7 stappen · 343 woorden · 49 per stap

Titel: Een vondst maken

### Wat een vondst is

Eén ding dat de party kan vinden: de geldzak in de haard, het zwaard onder de plavuizen. Eén kamer kan er meerdere hebben, en elk krijgt zijn eigen naam — die naam staat later bij de buit, zodat "uit de haard" en "onder de plavuizen" gescheiden blijven.

### De DC is een aantekening

Het getal is voor jou, niet voor de app. De spelers gooien aan tafel en jij beslist; onthullen is altijd een klik. Er wordt dus nergens een worp ingevoerd of bijgehouden wie wat gooide.

### Geld

Vul één bedrag in met een komma: **1,34** is 1 Gold, 3 Silver en 4 Copper. Wil je het aan het toeval overlaten, zet dan een bereik bij *Of gerold* — dat wordt pas bij het onthullen gegooid, zodat je ziet wat het geworden is voordat het scherm opengaat.

### Waar hij ligt

Koppel de vondst aan een kamer van een **dungeon**, dan verschijnt daar vanzelf het muntje — alleen op jouw scherm, met een stippellijn. Klikken op dat muntje bouwt meteen de verdeling.

### Een voorwerp, of een worp

Een regel is óf een vast voorwerp (eventueel gekoppeld aan een kaartje, dan kan de speler het openen), óf een **worp op een tafel**. Die twee sluiten elkaar uit. Kies je een tafel, dan bepaalt de worp bij het onthullen wat erin lag — en komt de naam overeen met een voorwerpkaartje, dan wordt dat vanzelf gekoppeld.

### Waarom een tafel en geen loterij

Er wás een knop "willekeurig, van deze zeldzaamheid". Die trok uit álle voorwerpkaartjes van dat niveau — ook het zwaard van de antagonist of een questvoorwerp dat nooit in een kist hoort te liggen. Een tafel is een lijst die jij hebt samengesteld: daar staat alleen in wat mág vallen. Oude regels met die knop blijven werken; nieuwe krijgen hem niet meer.

### Mimic

Vink *Dit is een mimic* aan en de kist blijkt een wezen: er valt niets te verdelen, het tafelscherm krijgt dezelfde kist met een andere ontknoping, en jij krijgt de vraag of het gevecht meteen moet beginnen. Het mimic-gevecht hoef je niet zelf te maken — de app zet het klaar met het Mimic-statblok uit de SRD, en gebruikt daarna steeds dat ene.

---

## `dm_loot_goud`

> Helpknop in: dm-panel.js:10145
> Nu: de standaard uit de code
> 3 stappen · 130 woorden · 43 per stap

Titel: Goud in een vondst

### Eén bedrag met een komma

Vul in wat erin zit: **1,34** is 1 Gold, 3 Silver en 4 Copper — het leest als gewoon geld, want de tweede munt is een tiende van de eerste en de derde een honderdste.

### Of laat het rollen

Vul in plaats daarvan een bereik in, in één veld: **2-5**, of met komma's **2,34-8,10**. Het bedrag wordt dan pas **bij het onthullen** gegooid, zodat je ziet wat het geworden is voordat het scherm opengaat — en zodat dezelfde kist twee keer iets anders kan opleveren.

### Electrum en platinum

Die worden bij het invoeren omgerekend (ep = 5 zilver, pp = 10 goud): in de beurs bestaan ze niet. In de vondst worden ze wél bij naam genoemd — het is oud geld dat je víndt — en dan staat er bij de buit "waaronder 3 Lion d'or".

---

## `dm_loot_sjablonen`

> Helpknop in: dm-panel.js:10051
> Nu: de standaard uit de code
> 2 stappen · 68 woorden · 34 per stap

Titel: Oude sjablonen

### Waarom ze weg zijn

Een sjabloon was een vondst die nergens lag en niet onthuld kon worden — een tweede soort ding om te onthouden, voor iets wat je in de praktijk oploste met "geef me zoiets als die vorige kist". Dat doet **kopiëren** nu, bij het aanmaken.

### Wat je ermee doet

Wat je al had staat er nog. *Gebruiken* maakt er een gewone vondst van; daarna kun je het sjabloon weggooien. Er gaat niets verloren.

---

## `dm_loot_deelnemers`

> Helpknop in: dm-panel.js:9783
> Nu: de standaard uit de code
> 2 stappen · 58 woorden · 29 per stap

Titel: Wie deelt mee

### Waar de lijst vandaan komt

Loopt er een gevecht, dan zijn het de spelers daaruit; anders iedereen die bij de party *actief* staat. Zo deelt een speler die er vanavond niet is ook niet mee in de buit.

### Zelf bijstellen

Vink iemand aan of uit voordat je onthult. Handig als een personage bewust ergens anders was, of juist meeliep zonder in het gevecht te staan.

---

## `dm_loot_uitslag`

> Helpknop in: dm-panel.js:9639
> Nu: de standaard uit de code
> 3 stappen · 84 woorden · 28 per stap

Titel: De uitslag

### Wie krijgt wat

Per voorwerp staat hier wie het geclaimd heeft en wat de worp was. Bij meerdere claims wint de hoogste worp; bij gelijkspel gooien alleen die spelers opnieuw.

### Bijstellen mag

De uitslag is een voorstel, geen vonnis — je kunt een voorwerp alsnog aan iemand anders geven voordat je afsluit. Aan tafel wordt er nu eenmaal geruild.

### Afsluiten

Bij het afsluiten gaat alles daadwerkelijk naar de boedel van de spelers en wordt het goud verdeeld. Daarna is de fase voorbij en staat de vondst als onthuld te boek.

---

## `dm_rust_starten`

> Helpknop in: dm-panel.js:10412
> Nu: de standaard uit de code
> 3 stappen · 123 woorden · 41 per stap

Titel: Rust starten

### Waar en wat

Kies eerst de plek — **in het veld** of **in de herberg** — en dan lang of kort. De rust geldt voor de hele party en iedereen krijgt hetzelfde cinematische scherm te zien; het tafelscherm toont de partybrede variant.

### Wat er gebeurt

Een lange rust zet HP op maximum, herlaadt spell slots en item-charges, geeft **al** je Hit Dice terug en haalt één level Exhaustion weg. Een korte rust doet de shortRest-items en de pact-slots van een Warlock; Hit Dice besteden doet de speler daar zelf.

### In de herberg kost het geld

Daar wordt de overnachtingsprijs per speler afgeschreven en worden er twee roddels per speler onthuld — die prijs stel je in bij Diensten → Herberg. Wie vanavond niet meespeelt (zie *Waarvan actief* bij de party) doet ook hier niet mee.

---

## `dm_rust_sfeer`

> Helpknop in: dm-panel.js:10430
> Nu: de standaard uit de code
> 3 stappen · 112 woorden · 37 per stap

Titel: Sfeer & gebeurtenissen

### Een beeld per soort rust

Kies een achtergrond voor het veld en voor de korte rust; de herberg gebruikt zijn eigen gevel. Die verschijnt achter het rustscherm, dus het is meteen duidelijk wáár ze slapen.

### Een voorval per speler

Koppel een tabel en elke speler rolt bij een lange rust zijn **eigen** voorval — hij ziet alleen het zijne, het tafelscherm toont ze allemaal. Bevat een regel een bedrag (`{+3kn}`), dan wordt dat meteen verrekend bij die speler.

### Binnen en buiten apart

Je kunt een aparte tabel zetten voor het veld en voor de herberg: wat je wakker maakt in het bos is iets anders dan wat er in een taveerne gebeurt. De algemene tabel is het vangnet als er voor die plek niets staat.

---

## `dm_tafels_tabellen`

> Helpknop in: dm-panel.js:3726
> Nu: de standaard uit de code
> 4 stappen · 127 woorden · 32 per stap

Titel: Tabellen

### Wat een tafel is

Een lijst met uitkomsten waar je op gooit: geruchten in de haven, wat er in de zak van een dief zit, welk voorval de nacht verstoort. Kies er een en gooi; de uitslag komt eronder te staan.

### Bereiken en gewicht

Een regel mag een bereik dragen (`1-5: tekst`) zodat de ene uitkomst vaker valt dan de andere. Met **Dobbel** kies je de steen — leeg is d100. Eén getal mag ook (`7: tekst`).

### Geld in een regel

Een regel kan een bedrag verrekenen: `{+3kn}` of `{-1fl}` treft één willekeurige speler, met `@party` erachter iedereen. Zo betaalt een nachtelijke dief zich vanzelf uit.

### Waar ze nog meer opduiken

Een tafel is ook te koppelen aan een **voorwerp** (een Wand of Wonder), aan de **rust** als gebeurtenissen-tabel, en aan een `|`-tabel in een akte — die krijgt daar zijn eigen worpknop.

---

## `dm_tafels_namen`

> Helpknop in: dm-panel.js:3701
> Nu: de standaard uit de code
> 3 stappen · 105 woorden · 35 per stap

Titel: Namen trekken

### Waarvoor

Voor het moment dat een speler vraagt hoe de herbergier heet en jij dat nooit bedacht hebt. Eén klik geeft een naam die bij deze wereld past; neem hem over of gooi opnieuw.

### Waar ze vandaan komen

Uit je eigen naamtabellen, gesplitst naar mannelijk en vrouwelijk. Zijn er geen, dan valt hij terug op de meegeleverde lijst. Wil je andere namen, maak dan een tabel met het type *namen* bij **Tabellen** hieronder.

### Meteen een kaartje

Een naam die blijft hangen verdient een kaartje: tik hem over in een nieuw personage, of schrijf hem in je akte als `[[Naam]]` — dan krijg je daar de plus om hem ter plekke aan te maken.

---

## `dm_tafels_weer`

> Helpknop in: dm-panel.js:3710
> Nu: de standaard uit de code
> 2 stappen · 63 woorden · 32 per stap

Titel: Het weer

### Eén worp, één dag

Kies het seizoen en gooi: je krijgt temperatuur, neerslag en wind. Bedoeld om aan tafel voor te lezen als de party naar buiten stapt — er wordt niets van opgeslagen en het heeft geen effect op regels.

### Het seizoen bepaalt de kansen

Elke tabel heeft zijn eigen verdeling: een winterworp geeft vaker vorst, een zomerworp vaker warmte en onweer. Het seizoen blijft staan tot je het zelf verzet.

---

## `dm_geluiden_standaard`

> Helpknop in: dm-panel.js:9265 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:9276
> Nu: de standaard uit de code
> 4 stappen · 101 woorden · 25 per stap

Titel: Vaste geluiden

### Wanneer ze klinken

Deze spelen vanzelf: bij schade en genezing, bij een beurtwisseling, en aan het eind van een gevecht. Je hoeft er tijdens het spelen niets voor te doen.

### Laat ze kort zijn

Ze klinken bovenop wat er al speelt en soms een paar keer per ronde. Een klank van een halve seconde werkt; een fanfare gaat irriteren.

### Ook op een vast moment

Onderaan staan de klanken die bij één gebeurtenis horen: als de spelers de buit te zien krijgen, en als iemand een level omhoog gaat. Die klinken één keer — geen loop.

### Leeg mag ook

Wat je niet invult, klinkt niet. Er komt geen vervanging uit de app — stilte is een keuze.

---

## `dm_geluiden_diensten`

> Helpknop in: dm-panel.js:9193
> Nu: de standaard uit de code
> 3 stappen · 113 woorden · 38 per stap

Titel: Geluid per dienst

### Begint vanzelf

Loopt iemand een dienst binnen — de herberg, de tempel, het gokhuis — dan begint deze loop op zijn eigen toestel. Daar is geen sessie of tafelscherm voor nodig. Naast het boekje van die dienst staat een **luidsprekertje** waarmee hij het zelf kan dempen; die keuze blijft op zijn toestel staan en geldt voor alle loops, ook die van de rust. Heb je voor een dienst niets ingesteld, dan staat die knop er niet.

### Een decor gaat voor

Speelt er een decor voor de hele tafel, dan heeft dat voorrang: dat is het geluid van de scène waar jullie samen in zitten.

### Ook per factie

Elke factie kan een eigen loop hebben, zodat het gildehuis anders klinkt dan de tempel.

---

## `dm_geluiden_facties`

> Helpknop in: dm-panel.js:9195
> Nu: de standaard uit de code
> 2 stappen · 58 woorden · 29 per stap

Titel: Sfeerloop per factie

### Wat het doet

Opent een speler het scherm van deze factie, dan begint deze loop zachtjes te spelen. Zo klinkt het gilde anders dan de tempel, zonder dat jij iets hoeft te starten.

### Kies iets dat mag herhalen

Het speelt in een lus zolang dat scherm openstaat, dus kies iets zonder duidelijk begin en eind. Een fanfare van acht seconden wordt na drie keer een grap.

---

## `dm_geluiden_rust`

> Helpknop in: dm-panel.js:9248
> Nu: de standaard uit de code
> 2 stappen · 56 woorden · 28 per stap

Titel: Geluid bij de rust

### Drie momenten

Een loop voor de rust in het veld, een voor de herberg en een voor de korte rust. Die klinkt zolang het rustscherm in beeld is — bij de spelers en op het tafelscherm.

### Zachter is beter

Onder een rustscherm wordt er gepraat: dit is achtergrond, geen muziek om naar te luisteren. Krekels, een haardvuur, regen op een dak.

---

## `dm_geluiden_condities`

> Helpknop in: dm-panel.js:9280
> Nu: de standaard uit de code
> 3 stappen · 80 woorden · 27 per stap

Titel: Conditiegeluiden

### Alle condities die de app kent

De lijst komt uit dezelfde bron als de conditiekaartjes en de tokens, dus elke condition die je op een deelnemer kunt zetten staat hier — je hoeft niet meer te kiezen uit een handvol.

### De zwaarste wint

Staan er meerdere tegelijk op iemand, dan klinkt alleen de zwaarste. Anders zou het bij een goede ronde een kakofonie worden.

### Concentration is de uitzondering

Die klinkt niet bij het toepassen maar bij het begin van elke nieuwe ronde, zolang er iemand concentreert — het is een herinnering, geen gebeurtenis.

---

## `dm_geluiden_fx`

> Helpknop in: dm-panel.js:9285
> Nu: de standaard uit de code
> 3 stappen · 138 woorden · 46 per stap

Titel: Klanken bij een effect

### Ze maken zichzelf

Deze klanken worden in de browser gemaakt met een paar tonen en wat ruis — er staat geen bestand tegenover. Dat scheelt laadtijd en licentiegedoe, en bij een nieuwe campagne klinkt het meteen zonder dat jij iets hoeft te vullen. Voor een dreun of een tik is dat prima; een overtuigende donderslag krijg je er niet mee.

### Een eigen klank wint

Kies je hier een bestand uit de bibliotheek, dan vervangt dat de gemaakte klank. Doe dat vooral bij **donder**, **regen** en de **aardbeving** — daar hoor je het verschil. Het kruisje zet hem terug op de gemaakte klank; er blijft dus nooit iets stils achter.

### Niet elk effect klinkt

Mist, gif en vuur staan er niet bij: die hóren stil te zijn, want ze blijven staan. Een klank die blijft doorlopen is een sfeerloop, en die stel je in bij Diensten of bij de akte.

---

## `dm_geluiden_decors`

> Helpknop in: dm-panel.js:9265 (de subtab-balk stelt de sleutel samen uit het actieve tabje)
> Nu: de standaard uit de code
> 3 stappen · 115 woorden · 38 per stap

Titel: Decors

### Wat een decor is

Een sfeerloop die je aanzet voor de hele tafel: regen op een dak, een drukke markt, wind over een vlakte. Hij klinkt vooral op het **tafelscherm** (dat is de speaker die iedereen hoort); een speler kan hem op zijn eigen toestel aanzetten met de dempknop in de kop.

### Eén tegelijk

Er speelt één decor. Zet je een ander aan, dan vervangt die de vorige — je hoeft dus niets uit te zetten voor je iets anders kiest.

### Momenten en diensten

Daaronder staan de klanken die de app **zelf** op het juiste moment speelt: een korte klank bij het onthullen van buit of een level-up, de loop tijdens een rust, en een sfeerloop per dienst die begint zodra iemand daar binnenloopt.

---

## `dm_geluiden_spelers`

> Helpknop in: dm-panel.js:9265 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:9292
> Nu: de standaard uit de code
> 3 stappen · 89 woorden · 30 per stap

Titel: Spelersgeluiden

### Een beurtgeluid

Per speler kun je een klank instellen die speelt als hij aan de beurt is. Handig aan een volle tafel: je hoort dat het jouw beurt is voordat je het ziet.

### Vier emotes

Elk een label en een geluid. Ze verschijnen als knoppen op zijn eigen kaartje en in de gevechtsoverlay, zodat een speler zelf iets kan laten klinken — een strijdkreet, een zucht, een lach.

### Van de speler, niet van jou

Laat ze er zelf een kiezen. Het is het enige geluid in de app dat van hén is, en dat is precies waarom het werkt.

---

## `dm_post_brief`

> Helpknop in: dm-panel.js:12375
> Nu: de standaard uit de code
> 5 stappen · 224 woorden · 45 per stap

Titel: Een brief sturen

### Dit is de snelle post

Hier schrijf je een brief die je **nu** verstuurt: een briefje van de waard, een dreigement, een bericht dat een speler onderweg krijgt. Een brief die je vóór de sessie voorbereidt en die bij een akte hoort, maak je als **document** — dan is hij een kaartje dat je kunt onthullen, dat in het archief blijft staan en dat je opnieuw kunt gebruiken.

### Aan wie

Aan één speler of aan de hele party. De brief komt in hun Berichten-tab te staan en blijft daar bewaard — het is post, geen melding die voorbijschiet.

### Van wie komt hij

Eén veld: kies een kaartje uit de lijst, of typ gewoon een naam. Kies je een kaartje, dan kan de speler het openen en ziet hij wie het is; een naam zonder kaartje blijft precies dat — handig voor een boodschapper die er verder niet toe doet.

### Handschrift en briefhoofd

Twee dingen die allebei "stijl" heten. Het **handschrift** bepaalt hoe de tekst eruitziet (dezelfde lijst als bij documenten, zodat dezelfde schrijver er overal hetzelfde uitziet); het **briefhoofd** zegt van welke dienst hij komt — de lila brief van de waarzegger, het logo van de detective.

### Cinematisch bezorgen

Zet je *cinematisch* aan, dan krijgt de speler eerst een verzegelde envelop die hij zelf moet openbreken — en gaat dezelfde brief naar het tafelscherm. Bewaar dat voor de brieven die ertoe doen; als alles een gebeurtenis is, is niets het.

---

## `dm_post_geschiedenis`

> Helpknop in: dm-panel.js:12463
> Nu: de standaard uit de code
> 2 stappen · 48 woorden · 24 per stap

Titel: Verstuurde post

### Wat hier staat

Alles wat je eerder verstuurde, met datum en ontvanger. Handig om terug te lezen wat een NPC ooit beloofd heeft — spelers onthouden dat namelijk wél.

### Opnieuw gebruiken

Een eerdere brief is de snelste opzet voor de volgende: open hem, pas de tekst aan en stuur hem naar iemand anders.

---

## `dm_gunnen`

> Helpknop in: dm-panel.js:12166 (subtabbalk)
> Nu: de standaard uit de code
> 5 stappen · 201 woorden · 40 per stap

Titel: Gunnen

### Wat van jou naar een speler gaat

Een **level omhoog**, **inspiration** en **exhaustion**, per speler. Dit stond op drie plekken die je moest kennen om te vinden: inspiratie achter een rechtermuisklik, level omhoog onderaan de Rust-tab, en uitputting nergens.

### Gunnen, niet uitvoeren

Een level zet je klaar; de speler kiest zelf zijn HP en wat hij met een ASI doet. Inspiration verzilvert hij zelf. Een klik op een knop die al aanstaat trekt het weer in.

### Op het portret

Alles wat je hier geeft verschijnt als **badge** op het portret van die speler: zijn portret draait om en toont wat er op hem zit. Exhaustion en een vloek kan hij niet zelf wegklikken — die staan er tot jij ze weghaalt.

### Milestone of XP

Speelt de campagne op **Milestone**, dan is dit de knop waarmee je een level gunt. Op **XP** staat een level-up vanzelf klaar zodra iemand over de drempel komt en hoef je hier niets te doen — punten uitdelen gaat met de XP-knop in de regie-balk. Welk van de twee geldt, stel je in bij Instellingen → Campagne → Level omhoog.

### Terugdraaien kan

Een per ongeluk gegund level haal je met dezelfde knop weer weg zolang de speler hem nog niet verzilverd heeft. Daarna is het zijn blad, en draai je het terug op zijn personage.

---

## `dm_verzoeken_personage`

> Helpknop in: dm-panel.js:12188
> Nu: de standaard uit de code
> 3 stappen · 315 woorden · 105 per stap

Titel: Een nieuw personage

### Wat je hier ziet

Iemand heeft met het partywachtwoord van een van je partys een personage gemaakt. Je ziet zijn naam, zijn species, class en background, zijn zes scores, zijn HP en zijn AC — en met welke manier hij die scores bepaalde. Daaronder wat hij onderweg koos (ASI of feat per level), hoeveel spreuken hij koos, het begin van zijn verhaal en zijn **geheimen voluit**: die zijn juist voor jou.

Wat er niet klopt staat eronder als opmerking. Die blokkeren niets: het is jouw tafel, en soms is de uitzondering juist de bedoeling.

Werkt de speler intussen verder, dan haalt hij hem bij je terug — dan verdwijnt hij hier tot hij hem opnieuw verzegelt. Zo gun je nooit iets anders dan wat je las.

### Zelf de maker gebruiken

Naast de plus in het Personages-tabblad staat een tweede knop: dezelfde maker, maar dan voor jou. Twee dingen gelden daar niet. Je typt geen **partywachtwoord** — je ziet alle party's, dus je kiest er een — en wat je maakt hoeft niet **langs jou**: het zegel maakt het personage meteen aan, met kaartje, blad en hit points.

Handig voor een NPC met een echt blad, voor een speler die er niet is, of om zelf te zien wat je spelers krijgen. De schakelaar waarmee je de maker voor hen uitzet raakt deze knop niet — die gaat over hén.

Sluit je halverwege, dan wordt het halve kaartje weggegooid (hij vraagt het eerst): jij hebt geen "verder met" zoals een speler, dus anders bleef het voorgoed staan.

### Gunnen of terugsturen

**Gunnen** maakt het personage echt: het kaartje met zijn portret, het profiel, zijn hit points, zijn spreukenboek, zijn boedel, zijn beurs en zijn plek in de party. Daarna kan hij met hetzelfde partywachtwoord inloggen en staat hij tussen de portretten.

**Terugsturen** vraagt om een reden. Die leest hij zodra hij zijn concept weer opent, en hij kan er meteen aan verder werken — er gaat niets verloren.

---

## `dm_verzoeken_multiclass`

> Helpknop in: dm-panel.js:12198
> Nu: de standaard uit de code
> 3 stappen · 90 woorden · 30 per stap

Titel: Multiclass-verzoeken

### Waarom het langs jou gaat

Een tweede klasse verandert het personage ingrijpend en is in de meeste campagnes een gesprek, geen knop. De speler vraagt het aan; jij keurt goed of af.

### Wat er gebeurt bij goedkeuren

De klasse komt op het profiel te staan met level **0**. Pas bij zijn volgende level-up krijgt hij daar zijn eerste level in — inclusief de Hit Die en de features die daarbij horen. Twee klassen is het maximum.

### De eisen staan erbij

Je ziet wat 5e vraagt en wat dit personage heeft, maar ook hier blokkeert de app niets: een campagne mag zijn eigen afspraken hebben.

---

## `dm_verzoeken_spreuken`

> Helpknop in: dm-panel.js:12193
> Nu: de standaard uit de code
> 2 stappen · 87 woorden · 44 per stap

Titel: Spreukverzoeken

### Wat hier staat

Een speler die een spreuk uit de bibliotheek in zijn eigen boek wil, vraagt het eerst aan jou — net als bij een voorwerp. Keur je goed, dan schrijft de app hem in zijn boek; wijs je af, dan krijgt hij dat te horen.

### De regel wordt voorgerekend, niet afgedwongen

Bij het verzoek staat of de spreuk op de lijst van zijn class staat — maar de app weigert niets uit zichzelf. De uitzonderingen zijn in 5e eerder regel dan uitzondering: Magic Initiate, een feat, een scroll, multiclass, een uitgebreide subklasselijst. Jij beslist.

---

## `dm_verzoeken_voorwerpen`

> Helpknop in: dm-panel.js:12205
> Nu: de standaard uit de code
> 2 stappen · 66 woorden · 33 per stap

Titel: Voorwerpverzoeken

### Wat hier staat

Een speler vraagt een voorwerp uit de bibliotheek aan, of wil er een van een ander overnemen. Keur je goed, dan komt het in zijn boedel te staan met het aantal dat je meegeeft.

### Onderling geven gaat buiten jou om

Spullen die spelers aan elkaar geven komen hier niet langs — dat is een ding over de tafel schuiven. Wil je dat niet, dan zet je het ruilen uit bij de party.

---

## `dm_verzoeken_verkoop`

> Helpknop in: dm-panel.js:12210
> Nu: de standaard uit de code
> 3 stappen · 115 woorden · 38 per stap

Titel: Aangeboden aan een winkel

### Wat hier staat

Een speler biedt iets uit zijn boedel aan bij een winkel die inkoopt. Er is nog niets gebeurd: het voorwerp is van hem en het geld van de winkel, tot jij aftekent.

### Het bedrag mag je overtypen

Het veld staat voorgevuld met het bod van de winkel — het percentage dat op het locatiekaartje is ingesteld. Heb je aan tafel laten pingelen, gerold of gewoon een ander getal genoemd, dan zet je dát in het veld. Uitbetalen doet wat er staat.

### Waar het geld heen gaat

Naar de gedeelde partybeurs als die aanstaat, anders naar de speler zelf — dezelfde regel als bij kopen. Het voorwerp verdwijnt uit zijn boedel; bij een stapel alleen het aantal dat hij aanbood. Weiger je, dan verandert er niets.

---

## `dm_verzoeken_lening`

> Helpknop in: dm-panel.js:12215
> Nu: de standaard uit de code
> 4 stappen · 133 woorden · 33 per stap

Titel: Wil lenen

### Hij vraagt het, jij tekent

Een speler vraagt de geldschieter om geld. Dat gaat langs jou, net als een spreuk of een multiclass — een geldschieter die automatisch ja zegt is een geldautomaat.

### Het bedrag mag je aanpassen

Het veld naast het verzoek is wat hij **werkelijk** krijgt. Dat is het afdingen dat aan tafel gebeurt: hij vraagt vijftig, jij maakt er dertig van, of je leent hem meer dan verstandig is.

### Waarvoor

De speler vult in waar hij het geld voor nodig heeft. Dat is geen administratie maar materiaal: een schuldeiser die weet waar je geld heen ging, weet waar je zwak zit. Het blijft bij de schuld staan.

### Weigeren mag, met een reden

Zeg je nee, dan vraagt de app om een reden. Die mag leeg blijven, maar wat je invult komt in zijn post te staan — ook als hij op dat moment niet verbonden is.

---

## `dm_verzoeken_onderpand`

> Helpknop in: dm-panel.js:12220
> Nu: de standaard uit de code
> 3 stappen · 114 woorden · 38 per stap

Titel: Onderpand

### Jij wijst aan

De schuldeiser wil iets meenemen, en de app kiest dat **niet** voor je. Het zwaard van zijn vader en een touw van tien voet staan allebei in de knapzak; alleen jij weet welk van de twee een scène is.

### Niets meenemen mag ook

Laat de keuzelijst op *hij neemt niets mee* staan en er verdwijnt niets. De trap gaat wél door: hij is langs geweest en hij vond niets van zijn gading. Dat is ook een mededeling.

### Wat de speler ziet

Het voorwerp verdwijnt uit zijn bezit en er komt een regel voor in de plaats: *In onderpand*. Daarbij krijgt hij een brief van de schuldeiser. Lost hij de schuld volledig af, dan krijgt hij het terug — dat was de afspraak.

---

## `dm_verzoeken_onderzoek`

> Helpknop in: dm-panel.js:12227
> Nu: de standaard uit de code
> 2 stappen · 65 woorden · 33 per stap

Titel: Onderzoeksdossiers

### Wat hier staat

De vragen die spelers bij de detective hebben neergelegd. Elk dossier is één vraag over een persoon, plek of voorwerp; jij schrijft het antwoord en bepaalt wanneer het klaar is.

### Tijd en prijs

Een dossier kost geld en tijd — dat is de hele charme: de party moet wachten en ondertussen doorspelen. Zet hem op klaar wanneer het verhaal daaraan toe is, niet wanneer de klok het zegt.

---

## `dm_toegang_diensten`

> Helpknop in: dm-panel.js:2150
> Nu: de standaard uit de code
> 3 stappen · 94 woorden · 31 per stap

Titel: Diensten per party

### Drie standen

**Beschikbaar** — ze kunnen er alles. **Zichtbaar** — ze zien dat het bestaat maar kunnen er niets (handig voor iets dat nog gesloten is). **Verborgen** — het bestaat niet voor hen.

### De server bewaakt het mee

Dit is geen kwestie van een tabblad verbergen: de schrijfroutes van een dienst weigeren een speler wiens party hem niet open heeft. Een scherm dat nog openstond blijft dus niet stiekem werken.

### Jij komt er altijd langs

Als DM kun je elke dienst openen en er namens de tafel handelen, ook als hij voor die party dicht staat. Anders kon je niet testen wat je net hebt ingesteld.

---

## `dm_toegang_facties`

> Helpknop in: dm-panel.js:2148, dm-panel.js:2148 (venster)
> Nu: de standaard uit de code
> 2 stappen · 60 woorden · 30 per stap

Titel: Facties per party

### Kennen ze deze factie?

Een factie die uitstaat bestaat voor die party niet: hij staat niet in de lijst, en hun aanzien erbij is onzichtbaar. Zet hem aan op het moment dat ze ervan horen — dat is vaak een scène waard.

### Per party, niet per campagne

Twee party's in dezelfde wereld hoeven niet dezelfde namen te kennen. Wat de ene groep ontdekt heeft, blijft voor de andere dicht.

---

# De meesterkamer: de diensten instellen

Per dienst de achterkant, in dezelfde volgorde als de diensten zelf. Hier hoort te staan wát je invult en wat de speler er straks van ziet — niet hoe het is opgeslagen.

## `dm_dienst_algemeen`

> Helpknop in: dm-panel.js:1090 (venster), dm-panel.js:1090 (sectiekop)
> Nu: de standaard uit de code
> 4 stappen · 137 woorden · 34 per stap

Titel: Algemeen

### Naam

Hoe deze plek in jouw campagne heet — de eigennaam van het huis, niet *de herberg*. De tab hierboven houdt de soortnaam, zodat het paneel ook klopt in een campagne waar het huis anders heet.

### Eerst waar, dan wie

Koppel een **locatie**; aan zo'n kaartje hangt meestal al een eigenaar, en die vult zich dan vanzelf in. Typ er gerust iemand anders overheen — jouw keuze wint. Leeg laten mag ook: dan is er geen kaartje om te openen.

### De achtergrond komt van de locatie

Je staat letterlijk in die herberg: het beeld van het locatiekaartje wordt de achtergrond van de scène. Wil je iets anders, kies dan een **eigen achtergrond**; *Weghalen* geeft het kaartje weer terug.

### Begroeting

Koppel een **tafel** met begroetingen: er wordt er bij elk bezoek één gekozen, zodat dezelfde waard je niet elke avond met dezelfde zin aankijkt. Eén regel gedraagt zich als vroeger.

---

## `dm_markt`

> Helpknop in: dm-panel.js:1552 (de dienstenbalk stelt de sleutel samen uit de actieve dienst), dm-panel.js:7245 (venster), dm-panel.js:7245 (sectiekop)
> Nu: de standaard uit de code
> 3 stappen · 111 woorden · 37 per stap

Titel: De Markt

### Eén plek voor alle winkels

De Markt is een **weergave**, geen tweede voorraad: hij toont de winkels die deze party kan zien, met hun schappen. Klikken opent de winkel zelf. De voorraad blijft dus op het kaartje van die winkel staan, en daar beheer je hem ook.

### Zoeken over alles heen

Zoeken gaat over alle winkels tegelijk en zet de prijzen naast elkaar — handig, want hetzelfde voorwerp ligt soms bij drie winkels voor drie prijzen.

### Een roterende winkel rolt hier niet

De Markt leest de schappen alleen. Had een winkel zijn assortiment nog niet gerold, dan staat hij hier leeg in plaats van dat de app het stiekem voor hem doet — anders zou een blik op de Markt ieders schappen in één klap vastzetten.

---

## `dm_markt_winkels`

> Helpknop in: dm-panel.js:7282
> Nu: de standaard uit de code
> 3 stappen · 106 woorden · 35 per stap

Titel: Winkels

### Deze lijst maak je niet zelf

Elke **locatie of verkoper met een voorraad** staat er vanzelf in. De keten erachter komt uit het veld *Gebied* op het kaartje; wijst dat naar zichzelf, dan stopt de keten daar. Klik een naam om het kaartje te openen.

### Een controlelijst

Alle winkels met de gebiedsketen die eruit volgt. Hiermee zie je je eigen data: een winkel die zichzelf als gebied heeft, komt nooit onder de stad uit — dat valt hier meteen op.

### Wat een speler ziet

De Markt toont alleen winkels die deze party kan zien, en een doorklik naar het voorwerpkaartje alleen als ze dat kaartje kennen. Naam, prijs en beeld gaan wel mee: dat ligt in de etalage.

---

## `dm_markt_gebieden`

> Helpknop in: dm-panel.js:7252 (venster), dm-panel.js:7252 (sectiekop)
> Nu: de standaard uit de code
> 3 stappen · 110 woorden · 37 per stap

Titel: Gebieden

### Waarvoor dit is

Vink aan welke gebieden je spelers als **knop** op de Markt te zien krijgen. Vink je niets aan, dan kiest de app zelf een zinnige laag — daar is de knop *Alles uit* voor.

### Waar een winkel ligt is afgeleid

Uit het veld *Gebied* op het locatiekaartje van de winkel, dat naar een andere locatie wijst — bijvoorbeeld *De Kruidenier › Havenwijk › De stad › Het continent*. Een winkel valt onder élk lid van die keten.

### Jij kiest welke laag telt

Alle wijken als losse knop is zelden wat je wilt. Vink daarom aan welke gebieden als filter op de Markt verschijnen; jouw volgorde is de volgorde op het scherm. Staat er niets, dan leidt de app ze zelf af.

---

## `dm_magizoo`

> Helpknop in: dm-panel.js:1552 (de dienstenbalk stelt de sleutel samen uit de actieve dienst)
> Nu: de standaard uit de code
> 2 stappen · 70 woorden · 35 per stap

Titel: De magizoöloog

### Twee dingen

Hij verkoopt **metgezellen** en hij weet iets van **wezens**: tegen betaling brengt hij het bestiarium van de party een niveau verder. Wat er te koop is en wat het kost, stel je hier in.

### Een dier groeit mee

Een metgezel heeft statblokken per niveau; welke geldt, hangt af van het level van zijn baasje. Eén dier per party, en als hij sneuvelt is dat echt — dat hoort bij het aangaan van de band.

---

## `dm_magizoo_adoptie`

> Helpknop in: dm-panel.js:7369 (venster), dm-panel.js:7369 (sectiekop)
> Nu: de standaard uit de code
> 3 stappen · 110 woorden · 37 per stap

Titel: Adoptie

### Wat hier staat

Elk dier dat te adopteren is, met zijn prijs en waar hij woont: **vrij**, of bij een party — met de naam die zij hem gaven. Een overleden dier blijft staan maar is niet meer te adopteren.

### Een dier aanbieden

Dat doe je op het kaartje van het dier zelf: zet *adopteerbaar* aan en geef hem een prijs. Hier lees je het aanbod; daar stel je het samen — één plek, twee kanten.

### Eén per party

Een party kan maar één metgezel tegelijk hebben. Zolang ze er een hebben, is er voor hen niets te adopteren; de andere party’s merken daar niets van. Het statblok van het dier groeit mee met het level van zijn baasje.

---

## `dm_herberg_tap`

> Helpknop in: dm-panel.js:6288 (venster), dm-panel.js:6288 (sectiekop)
> Nu: de standaard uit de code
> 4 stappen · 173 woorden · 43 per stap

Titel: Aan de tap

### Het menu

Wat er te drinken en te eten is, met een prijs. Een speler bestelt het zelf; het bedrag gaat van zijn beurs af, of van de gedeelde beurs als die aanstaat.

### Temporary HP en een status

Per regel kun je **Temporary HP** meegeven (een getal of een worp als `1d6`) en een status met een korte beschrijving. Allebei gelden tot de volgende lange rust. Het is een aantekening die de speler bij zich draagt, geen regel die de app afdwingt.

### Koppel het aan een voorwerpkaartje

Bestaat het drankje ook als kaartje, koppel het dan. Vanaf dat moment bepaalt het **kaartje** wat het doet — tijdelijke HP, de status, genezing — en bepaalt deze regel alleen de prijs en de sfeertekst. Hetzelfde drankje doet dan precies hetzelfde of je het aan de bar drinkt of straks uit je knapzak pakt. Een regel zonder koppeling houdt zijn eigen velden, zoals hij ze had.

### Sfeer boven mechaniek

Een bestelling is vooral een reden om iets te laten gebeuren — de waard vertelt een roddel, iemand aan de bar kijkt op. Wat een drankje verder doet, beslis jij aan tafel.

---

## `dm_herberg_rust`

> Helpknop in: dm-panel.js:6276 (venster), dm-panel.js:6276 (sectiekop)
> Nu: de standaard uit de code
> 2 stappen · 92 woorden · 46 per stap

Titel: Overnachten

### Wat een nacht kost

De prijs geldt **per persoon** en gaat er bij een lange rust hier automatisch af — van de eigen beurs, of van de gedeelde beurs als die aanstaat. Eén bedrag, met een komma: *2,50* is 2 gold en 5 silver — of hoe jouw munten ook heten.

### Wat je opvangt

Een nacht in de herberg onthult **roddels** van kaartjes die deze party al kent — je stelt hier in hoeveel per speler. Nul betekent: hier wordt niet gepraat. Op = op: de pot is eindig, dus een stille herberg spreidt hem uit over meer avonden.

---

## `dm_gokhuis`

> Helpknop in: dm-panel.js:1552 (de dienstenbalk stelt de sleutel samen uit de actieve dienst)
> Nu: de standaard uit de code
> 3 stappen · 130 woorden · 43 per stap

Titel: Het gokhuis

### Wat het is

Een huis waar spelers geld kunnen inzetten: op een spel, op een gevecht in het strijdperk, of bij de geldschieter. De naam, de baas en de sfeer stel je hier in.

### Lenen kost

De geldschieter rekent rente **per lange rust**, niet per kalenderdag — de party bepaalt zo zelf het tempo. Er zit een plafond op; daarna stopt het tellen en komt hij het halen. Dat is een scène, geen som.

### Aflossen doet de speler zelf

Onder de leningbanner staan twee knoppen: **Alles aflossen** en **Een deel aflossen**. Het geld gaat van zijn beurs af en het schuldbewijs verdwijnt zodra er niets meer staat. Bij een deel wordt de rest de nieuwe hoofdsom en beginnen de nachten opnieuw te tellen — wie aflost hoort er iets voor terug te krijgen. Jij krijgt het te zien bij Verzoeken.

---

## `dm_gokhuis_beheer`

> Helpknop in: dm-panel.js:6825 (venster), dm-panel.js:6825 (sectiekop)
> Nu: de standaard uit de code
> 6 stappen · 258 woorden · 43 per stap

Titel: Gokken

### Een weddenschap opzetten

Geef hem een **soort** (een vrij woord: gevecht, race, steekspel), een naam, en minstens twee **opties** om op te wedden. Wat loopt staat bovenaan; wat voorbij is zit in de uitklap *Afgelopen*.

### Kansen moeten 100% zijn

De kansen verdelen één uitkomst, dus ze tellen op tot honderd. Doen ze dat niet, dan weigert de app het met het getal dat je wél hebt erbij — telden ze op tot 90, dan viel er een tiende van de tijd niets en zag niemand dat.

### Wat er wordt uitbetaald

De **payout** naast een optie is wat de winst *bovenop* de inleg komt. Bij ×3 krijgt een speler die 10 inzet zijn tientje terug plus twintig: dertig in totaal. Verliest hij, dan is zijn inleg weg. Het huis heeft geen kas: winst komt uit het niets en verlies verdwijnt erin — de app rekent alleen de beurs van de speler bij en af.

### Wanneer de uitslag valt

**Na de volgende lange rust**, of **jij bepaalt de winnaar** als je het zelf wilt sturen. Er stond een timer in minuten, maar de party speelt geen echte uren: die liep tijdens een pauze net zo hard door en besliste een gevecht vier keer per sessie.

### Wie er inzet

Onder een weddenschap staat wie erop gewed heeft, met portret en naam, waarop, en hoeveel. Na afloop staat er een vinkje of een kruisje bij.

### Leningen

De speler lost zelf af, met de knoppen onder zijn leningbanner. Blijft er een lening hangen van een personage dat niet meer bestaat, dan kun jij hem uit `dm-state.json` halen — er is daar nog geen knop voor; dat komt met de Geldschieter-dienst (zie `docs/voorstel-woekeraar.md`).

---

## `dm_gokhuis_partijen`

> Helpknop in: dm-panel.js:6884 (venster), dm-panel.js:6884 (sectiekop)
> Nu: de standaard uit de code
> 4 stappen · 144 woorden · 36 per stap

Titel: Strijdperk — partijen

### Een partij

Een kamp waar een speler zich zelf voor inschrijft: een naam, zijn tegenstander, een sfeerregel, wat de inleg kost en wat er te winnen valt. Dit is iets anders dan **Gokken** hierboven — daar wedden ze op iemand ánders.

### Hang er een gevecht aan

Kies bij **Gevecht** de encounter die deze tegenstander is, dan zet je hem met één knop op tafel in plaats van hem ter plekke bij elkaar te zoeken. XP en buit komen uit die encounter, dus die stel je daar in en niet hier.

### De verborgen eindbaas

Vink je een partij als verborgen aan, dan verschijnt hij pas als alle andere verslagen zijn. Zo bouw je een ladder met een verrassing bovenaan.

### De uitslag bepaal jij

Het gevecht wordt aan tafel gespeeld of verteld; jij zet daarna wie er gewonnen heeft. Bij een overwinning betaalt de app het prijzengeld uit. Die keuze is onomkeerbaar — de inzetten worden er meteen mee verrekend.

---

## `dm_gokhuis_inschrijvingen`

> Helpknop in: dm-panel.js:6895, dm-panel.js:12237
> Nu: de standaard uit de code
> 3 stappen · 120 woorden · 40 per stap

Titel: In het strijdperk

### Iemand staat in het zand

Een speler heeft zich voor een partij gemeld; zijn inleg is al afgeschreven. Hij staat hier én in het gokhuis, en telt mee in het cijfer op het tabblad — want hij wacht op jou.

### Eén partij tegelijk

Wie ingeschreven staat kan zich nergens anders voor melden tot deze partij uitgevochten is. Anders stond hij op vijf affiches tegelijk en betaalde hij vijf keer inleg voor één avond. Een verslagen tegenstander is gesloten: daar kan niemand meer tegen aantreden.

### Je tekent de uitslag

Het gevecht speel je aan tafel — hang er een **encounter** aan bij de partij, dan zet je hem met één knop op. Daarna: **Overwinning** betaalt het prijzengeld uit en sluit de tegenstander, **Nederlaag** laat het bij de inleg die hij al kwijt is.

---

## `dm_gokhuis_event`

> Helpknop in: dm-panel.js:6838
> Nu: de standaard uit de code
> 2 stappen · 43 woorden · 22 per stap

Titel: Een event aanmaken

### Waar wordt op gewed

Geef het event een naam en minstens twee opties — paardenrace, hanengevecht, welke raadsheer het haalt. De spelers kiezen er een en zetten in.

### De uitbetaling

Per optie stel je de verhouding in. Een uitslag die iedereen zag aankomen levert weinig op; de verrassing betaalt.

---

## `dm_tempel`

> Helpknop in: dm-panel.js:1552 (de dienstenbalk stelt de sleutel samen uit de actieve dienst)
> Nu: de standaard uit de code
> 2 stappen · 64 woorden · 32 per stap

Titel: De tempel

### Waar de goden vandaan komen

Er is geen ingebouwd pantheon: een god ontstaat uit **Blessing-kaartjes met een godnaam** (zegen, eed of vloek). Hier voeg je daar volgorde, domein, symbool, prijs en portretten aan toe.

### Zegen, eed, vloek

Een **zegen** koop je en komt in je boedel. Een **eed** is een belofte met een gevolg — wie er een zweert, kan geen tweede zweren. Een **vloek** hangt iemand aan tot hij hem kwijtraakt.

---

## `dm_tempel_goden`

> Helpknop in: dm-panel.js:7628 (venster), dm-panel.js:7628 (sectiekop)
> Nu: de standaard uit de code
> 7 stappen · 245 woorden · 35 per stap

Titel: Goden

### Koppelen, niet overtikken

Een god werkt als een dienst: je wijst het **kaartje van de god**, van zijn **priester** en van de **locatie** aan. Wat op zo'n kaartje staat — beeld, beschrijving, geheimen — hoeft hier niet nog eens. De locatie levert ook de achtergrond van het altaar.

### De inhoud staat op de Blessing-kaartjes

Zegen, vloek, de tekst van de eed, de permanente zegen en de eenmalige zegens beheer je in het archief. Die kaartjes zijn leidend; hier staat alleen hoe de god **heet** en hoe zijn altaar **oogt**.

### Eigen prijzen

Wat een **zegen**, een **eed** en de **boete** bij déze god kosten. Leeg laten betekent: de standaardprijs hierboven. Een strenge god mag duurder vergeven dan een milde.

### Wat er van hem is

Onderaan staan de **zegeningen, eden en vloeken** die in het archief aan deze god hangen (het veld *god* op het voorwerpkaartje). Klik erop om het kaartje te openen — dáár schrijf je de inhoud; hier zie je alleen dat het er is.

### Wie het altaar ziet

Een god verschijnt pas in de tempel als het **locatiekaartje** van zijn altaar voor die party zichtbaar is: je kent een altaar als je de plek kent. Een god zonder locatie staat er altijd — "geen plek" is geen geheim.

### De priester begroet je

Koppel een **tafel** met begroetingen, net als bij een dienst: er wordt er bij elk bezoek één gekozen. *Nieuw* maakt er meteen een en opent hem in Tafels.

### Volgorde is redactie

De volgorde die je hier zet is de volgorde in de tempel. Zet de goden die er in jouw verhaal toe doen bovenaan; de rest mag daaronder wachten.

---

## `dm_tempel_eden`

> Helpknop in: dm-panel.js:7625 (venster), dm-panel.js:7625 (sectiekop)
> Nu: de standaard uit de code
> 2 stappen · 60 woorden · 30 per stap

Titel: Actieve eden & vloeken

### Wie draagt wat

Per speler wat er op hem rust. Zo zie je in één blik waarom iemand iets niet mag of juist moet — en hoef je het niet op zijn blad te zoeken.

### Losmaken doe jij

Een eed of vloek verdwijnt niet vanzelf: die haal je hier weg als de scène daarom vraagt. Dat is bewust een handeling van de DM, geen aftellende klok.

---

## `dm_tempel_prijzen`

> Helpknop in: dm-panel.js:7617 (venster), dm-panel.js:7617 (sectiekop)
> Nu: de standaard uit de code
> 2 stappen · 68 woorden · 34 per stap

Titel: Standaardprijzen

### Voor alle altaren tegelijk

Wat een **eenmalige zegen**, een **eed** en de **boete na een vloek** kosten. Een god met een eigen prijs wint hiervan; laat je die leeg, dan geldt wat hier staat.

### Eén bedrag

Schrijf het zoals je het uitspreekt: *2,50* is 2 ${window._muntNamen().fl} en 5 ${window._muntNamen().kn}, en *5 gp 2 sp* mag ook. Een kaal getal telt als hoofdmunt. Zo blijft het kloppen in een campagne die haar munten anders noemt.

---

## `dm_waarzegger`

> Helpknop in: dm-panel.js:1552 (de dienstenbalk stelt de sleutel samen uit de actieve dienst)
> Nu: de standaard uit de code
> 2 stappen · 59 woorden · 30 per stap

Titel: De waarzegger

### Wat ze doet

Een speler komt langs voor een voorspelling: hij kiest vier zintuiglijke indrukken en krijgt daarna een brief met wat zij daarin ziet. Prijs en sfeer stel je hier in.

### De tekst is van jou

Een voorspelling hoort vaag genoeg te zijn om later te kloppen, en scherp genoeg om aan tafel iets los te maken. Wat zij zegt schrijf jij dus zelf, per akte.

---

## `dm_waarzegger_akte`

> Helpknop in: dm-panel.js:7480
> Nu: de standaard uit de code
> 4 stappen · 185 woorden · 46 per stap

Titel: Voorspellingen per akte

### Waarom per akte

Wat zij ziet hangt af van waar het verhaal staat. Per akte leg je vast wat er te voorspellen valt; komt een speler langs, dan krijgt hij wat bij de **volgende** akte hoort — voorspellen gaat over wat komt. Loopt er geen akte, dan is ze dicht.

### Vijf zintuigen, één kern

Schrijf per zintuig een beeld: wat je ziet, hoort, ruikt, proeft, voelt. De worp bepaalt hoeveel ervan doorkomen. De **concrete kern** — een naam of een plek — komt er alleen bij een 6 uit; dat is het harde gegeven onder het beeldspel.

### Of laat het variëren

Elk zintuig mag ook een **tafel** zijn in plaats van één vaste zin. Dan ziet de ene ziener vuur en de andere een gezicht in het water, en is een tweede bezoek aan dezelfde akte nog de moeite waard. Zelfde veld als bij een begroeting: kiezen, *Nieuw* maakt er een met je huidige tekst in, *Bewerken* opent hem bij Tafels. Laat je de tafel leeg, dan geldt de tekst erboven.

### Eén per speler

De app onthoudt wie welke voorspelling al gehad heeft, zodat twee spelers niet hetzelfde briefje krijgen. Met *Reset party-worp* mag een party het over doen.

---

## `dm_detective`

> Helpknop in: dm-panel.js:1552 (de dienstenbalk stelt de sleutel samen uit de actieve dienst)
> Nu: de standaard uit de code
> 4 stappen · 164 woorden · 41 per stap

Titel: De detective

### Wat hij doet

Spelers leggen een vraag bij hem neer over een persoon, plek of voorwerp. Dat kost geld en tijd; het antwoord schrijf jij. Zo kunnen ze iets uitzoeken zonder dat de hele tafel stilvalt.

### Wanneer het rapport er ligt

Na de volgende **lange rust**. Niet na zoveel uur op de klok — de party speelt geen echte uren, dus een wachttijd in minuten verloopt tijdens een pauze net zo hard als tijdens een sessie. Dezelfde maat als de Magizoöloog en de schappen van een winkel.

### Het antwoord is een scène

Schrijf wat hij *gevonden* heeft, niet wat waar is — een detective kan zich vergissen, of net te laat komen. Dat maakt van een opzoekactie een verhaallijn.

### Weetjes uit een tafel

Vindt hij niets bijzonders, dan komt hij terug met een **weetje**: een losse regel over die persoon. Die regels staan in een tafel, net als de begroetingen — één voorraad waar de app er bij elk rapport één uit kiest. `{naam}` wordt de naam van wie er onderzocht is. Kies geen tafel en hij gebruikt de meegeleverde weetjes.

---

## `dm_detective_geruchten`

> Helpknop in: dm-panel.js:12232
> Nu: de standaard uit de code
> 5 stappen · 197 woorden · 39 per stap

Titel: Praatjes om rond te laten gaan

### Wat hier staat

Een speler heeft de detective betaald om iets over iemand rond te laten gaan, en schreef het zelf. Het ligt bij jou omdat het een **verhaalstap** is en geen aankoop — het veld is bewerkbaar, dus wat jullie aan tafel afspraken wint van wat hij intikte.

### Wat er gebeurt bij akkoord

Het wordt een **roddel op het kaartje** van het doelwit, met een masker ernaast zodat jij ziet dat het geplant is en door wie. De herberg trekt het naar voren, dus het komt bij de eerstvolgende lange rust terug — uit de mond van een vreemde aan de bar. De speler krijgt een brief van de detective en een buff tot zijn volgende lange rust.

### Het kan terugslaan

Bij het rondstrooien wordt één keer gerold. Op een 1 wordt het praatje naar de bron herleid: dan staat het niet op het doelwit maar op de **spelers zelf**, en de buff komt er niet. Dat is de prijs van liegen in het openbaar.

### Alleen voor hún tafel

Een geplant praatje gaat alleen rond bij de party die het plantte. Een andere groep heeft niets te maken met hun leugen en krijgt hem niet te horen.

### Weigeren

Dan krijgt de speler zijn geld terug — hij heeft er niets voor gehad.

---

## `dm_woekeraar`

> Helpknop in: dm-panel.js:1552 (de dienstenbalk stelt de sleutel samen uit de actieve dienst)
> Nu: de standaard uit de code
> 3 stappen · 184 woorden · 61 per stap

Titel: De geldschieter

### Waarvoor hij er is

Geen winkel schrijft aan en geen tempel geeft krediet — als een party geld tekortkomt is hij het enige adres. Dat maakt een schuld iets dat je kunt spelen: er is iemand aan wie het verschuldigd is, en die iemand heeft een naam.

Hij duikt ook buiten dit scherm op: bij de markt als er te weinig in de beurs zit, en bij het gokhuis als iemand wil doorspelen. Dat gebeurt alleen zolang deze dienst aanstaat.

### Jij beslist, niet de app

Een speler vraagt een bedrag en zegt waarvoor. Dat verzoek komt hier binnen en blijft staan tot jij het goedkeurt of afwijst — je mag ook een lager bedrag teruggeven. De app leent nooit uit zichzelf.

Eén schuld per speler tegelijk. Pas als die afgelost is kan er een nieuwe bij.

### Wie hem te zien krijgt

Zijn deur staat per groep los, net als bij elke andere dienst: bij **Toegang** zet je hem op verborgen, zichtbaar of beschikbaar. Verborgen betekent dat hij niet in het menu staat — de party weet niet dat hij bestaat.

Zet je hem op beschikbaar, dan onthult de app meteen zijn kaartje en zijn plek voor die groep.

---

## `dm_woekeraar_voorwaarden`

> Helpknop in: dm-panel.js:6584 (venster), dm-panel.js:6584 (sectiekop)
> Nu: de standaard uit de code
> 3 stappen · 99 woorden · 33 per stap

Titel: Wat hij vraagt

### Rente per nacht, niet per dag

De rente loopt per **lange rust** van de party, niet op de kalender: een party speelt geen echte dagen. Op de kalender stond één lening ooit op 4,5 × 10¹⁹ — meer geld dan er in de wereld is.

### Het plafond

Boven dit veelvoud van de hoofdsom telt hij niet verder. Dat is geen genade maar een omslagpunt: vanaf dat moment is de schuld **opeisbaar** en begint hij te escaleren. Vijf keer is een goede waarde; lager maakt hem ongeduldiger.

### Het hoogste bedrag

Hoeveel hij in één keer uitleent. Je kunt bij het goedkeuren alsnog afdingen, dus dit is het dak, niet de regel.

---

## `dm_woekeraar_escalatie`

> Helpknop in: dm-panel.js:6599 (venster), dm-panel.js:6599 (sectiekop)
> Nu: de standaard uit de code
> 5 stappen · 172 woorden · 34 per stap

Titel: Als er niet betaald wordt

### Staat standaard uit

Zonder deze schakelaar groeit een schuld alleen maar. Dat is een geldige campagne: niet elke tafel wil dat er iemand aanklopt.

### Drie trappen, per nacht

**Brief** → **onderpand** → **bezoek**. Elke lange rust schuift een opgeëiste schuld een trap op, en bij elke trap krijgt de speler een brief. Wat er die nacht gebeurde staat in het rustoverzicht.

### Jij houdt de teugels

De app stuurt de brief, maar bij **onderpand** wijs jij aan wat er verdwijnt (uit de spullen van de hele party), en bij **bezoek** start jij het gevecht wanneer het uitkomt. De app begint nooit uit zichzelf een gevecht.

### Opeisen

Normaal wacht hij tot het plafond bereikt is. Met **Opeisen** bij een schuld begint het meteen — handig als het verhaal erom vraagt en de cijfers nog niet.

### Wie hij stuurt

Bij de laatste trap komt er iemand langs. Vul je een naam in, dan noemt de brief hem; laat je het leeg, dan staat er *er komt iemand langs* — en dat leest aan tafel vaak dreigender dan een naam die niemand nog kent. Het gevecht zelf koppel je als encounter.

---

## `dm_woekeraar_brieven`

> Helpknop in: dm-panel.js:6633 (venster), dm-panel.js:6633 (sectiekop)
> Nu: de standaard uit de code
> 4 stappen · 324 woorden · 81 per stap

Titel: Wat hij schrijft

### Drie brieven

Elke trap heeft er een. De **herinnering** komt vanzelf, de nacht nadat een schuld opeisbaar werd. **Wat ik meenam** gaat naar de hele party op het moment dat jij aanwijst wat hij meeneemt. **De laatste** komt de nacht daarna, en noemt wie er langskomt.

Laat je een veld leeg, dan staat er de tekst die de app meelevert: kort en dreigend, zonder namen. Schrijf hem gerust om naar de stem van jouw geldschieter.

### De haakjes

Een brief noemt bedragen en namen die pas op het moment zelf bekend zijn. Die vul je niet in, die zet je tussen accolades:

**Alle drie:** `{bedrag}` — wat er op dat moment openstaat.

**De herinnering:** `{waarvoor}` — de zin "Je leende het voor …", of niets als de speler niets invulde.

**Wat ik meenam:** `{voorwerp}`, `{van}` (van wie hij het pakte) en `{wie}` (de schuldenaar — of "iemand onder jullie" als je hem geheim houdt).

**De laatste:** `{wie}` — de naam van wie je stuurt, of "iemand" als je het leeg liet.

### Onderwerp en handschrift

Elke brief heeft een onderwerp — dat is wat er in de postlijst staat. Laat je het leeg, dan heet hij zoals de app hem noemt (Een herinnering, Wat ik meenam, De laatste).

Het **handschrift** geldt voor alle drie: het is dezelfde hand. Dezelfde lijst als bij een factiebrief of een document, dus een brief van hem ziet er overal hetzelfde uit.

De knop **Sjabloon** zet de meegeleverde tekst in het veld, zodat je kunt bijschaven in plaats van met een leeg vel te beginnen.

### Waar ze aankomen

In het berichtentabblad van de speler, als een verzegelde brief die openvouwt. De eerste en de laatste gaan naar de schuldenaar alleen; die over het onderpand gaat naar **iedereen** in de party — dat is het hele punt van die trap.

Op het tafelscherm komen ze niet uit zichzelf. Wil je er een aan tafel tonen, dan zet je hem als briefstap in een akte; daar zit de knop *Op het tafelscherm leggen*.

---

## `dm_woekeraar_ontspan`

> Helpknop in: dm-panel.js:6659 (venster), dm-panel.js:6659 (sectiekop)
> Nu: de standaard uit de code
> 3 stappen · 90 woorden · 30 per stap

Titel: Wie hem kan stoppen

### Een woordje, geen kwijtschelding

Staat een party hoog genoeg aan bij een factie die je hier aanvinkt, dan stopt de rente en valt het bedrag terug naar de hoofdsom. De schuld blijft bestaan; het woekeren stopt. Iemand met gezag heeft een woordje gedaan.

### Welke facties

Dat is aan jou: in de ene stad is het de wacht, in de andere het dievengilde. Welke macht iets betekent is geen regel van de app.

### En als het aanzien wegzakt

Dan begint het tellen opnieuw vanaf **dat** moment, niet met terugwerkende kracht. Een gunst die je verspeelt kost je de toekomst, niet het verleden.

---

## `dm_woekeraar_register`

> Helpknop in: dm-panel.js:6685
> Nu: de standaard uit de code
> 6 stappen · 301 woorden · 50 per stap

Titel: Schulden

### Waarom dit er staat

Schuld zat in een hoek van het gokhuis: één soort, bij één schuldeiser, en nergens een overzicht. Een schuld die niemand ziet is geen verhaallijn — die vergeet je, en dan staat er opeens een bedrag waar niemand meer van weet waar het vandaan kwam.

### Wat je ziet

Per schuld: wie, bij wie, wat hij **leende**, wat er **nu staat**, hoeveel nachten er verstreken zijn en tegen welke rente. Groeit het bedrag, dan licht het op. Is het plafond bereikt (vijf keer de hoofdsom), dan telt hij niet verder — dan komt de schuldeiser het halen, en dat is jouw scène.

### De rente loopt op rust

Niet op de kalender. Elke **lange rust** van de party is een nacht die telt. Dat is bewust: een party speelt geen echte dagen, en op de kalender stond één lening ooit op 4,5 × 10¹⁹ — meer geld dan er in de wereld is.

### Zonder eigenaar

Een schuld op naam van een personage dat niet meer bestaat staat apart. Niemand kan hem afbetalen en hij telt wel door. Ruim hem op — of laat hem staan als er nog een verhaal aan vastzit.

### Aflossen doet de speler

Onder zijn leningbanner staan de knoppen. Jij hoeft niets te doen; je ziet het langskomen bij Verzoeken. **Kwijtschelden** kan hier wel — dat is een gunst, en die hoort bij jou.

### Opeisen

Normaal wacht de schuldeiser tot het plafond bereikt is. Met **Opeisen** begint hij meteen: bij elke lange rust schuift de schuld een trap op. **Trap 1** is een brief. **Trap 2** vraagt om onderpand — jij wijst bij Verzoeken aan wat er verdwijnt. **Trap 3** is het bezoek: de schuld krijgt een gevecht, en jij start het wanneer het uitkomt. Bij elke trap krijgt de speler een brief, en in het rustoverzicht staat wat er die nacht gebeurde. Zet *escalatie* aan bij de instellingen; zonder dat groeit de schuld alleen.

---

## `dm_facties`

> Helpknop in: dm-panel.js:1552 (de dienstenbalk stelt de sleutel samen uit de actieve dienst), dm-panel.js:8392
> Nu: de standaard uit de code
> 8 stappen · 482 woorden · 60 per stap

Titel: Facties

### Wat een factie is

Een groep met een naam, een embleem en een **ladder** van rangen. Hoe meer aanzien een party heeft, hoe hoger ze staan — en hoe meer er voor hen opengaat.

### De lijst is de stand

Per factie zie je hier wat je aan tafel nodig hebt: het **oogje** (kent de party ze al), hun renown en rang, een veld om renown toe te kennen — tik in wat de daad waard was, een min-getal haalt eraf — en de knop om een uitnodiging te sturen. Alles wat je instelt zit achter **Bewerken**, in een eigen venster: kaartjes, leden, brief en rangen. Dat stond hier in een uitklap en werd een blad vol velden waar de stand in verdween.

### Het embleem komt van het kaartje

Een factie hangt aan een organisatiekaartje, en dáár kies je haar teken (veld **Teken**). Laat je het leeg, dan volgt het het type van de organisatie — een gilde krijgt een pakket, een bende een schedel. Zo staat het teken op één plek en klopt het overal: in de kaartenlijst, in het organogram en op het lakzegel van haar brieven.

### Hoe de sectie heet

De naam boven dit onderdeel stel je zelf in (bij ons *Facties & Aanzien*). Zo kan het in jouw wereld net zo goed *Huizen* of *Orden* heten.

### Zich voorstellen per brief

Een factie kan zich met één klik voorstellen aan de actieve party: dat onthult haar en bezorgt elke speler een verzegelde brief. Een mooiere binnenkomst dan een vinkje omzetten. Het tabje **Brief** heeft dezelfde velden als een gewone brief bij de post — afzender, onderwerp, datum in de spelwereld, handschrift, briefhoofd en inhoud — plus de kleur van de lak. Laat je de afzender leeg, dan tekent het hoofd van de factie.

### Drie koppelingen, elk met een taak

Bij *Algemeen* wijs je drie kaartjes aan, en ze doen alle drie iets anders. De **organisatie** is wíé ze zijn: daar komt hun embleem vandaan, en haar organogram is de ledenlijst van deze factie — hier lees je die, daar bewerk je hem. De **locatie** is wáár ze zitten: die geeft de achtergrond van hun scherm, en een winkel op die plek verschijnt als verkoper van de factie. Het **hoofd** is wie er tekent: hij is de afzender van de uitnodiging als je dat veld leeg laat. Het hoofd volgt meestal al uit het organogram, dus meestal hoef je hem niet zelf te kiezen.

### En wat er verder aan vastzit

De **begroeting** komt uit een tafel, net als bij een dienst: meerdere openingszinnen, en de app kiest er een. Een **voorwerp** dat je aan een rang hangt krijgt op zijn eigen kaartje de regel *Gunst — <rang>*, zichtbaar zodra de party de factie kent. En een **missie** koppel je aan een factie op het prikbord; daar zet je ook wat hij aan renown oplevert. Overal geldt dezelfde regel: het gegeven staat op één plek, en je kunt het van twee kanten leggen.

### Onthullen

Spelers zien een factie pas als jij haar onthult (het oogje). Het renown pas je hier aan; de ladder bepaalt wat er dan opengaat.

---

## `dm_facties_rangen`

> Helpknop in: dm-panel.js:8027 (subtabtabel)
> Nu: de standaard uit de code
> 7 stappen · 441 woorden · 63 per stap

Titel: Rangen

### Elke rang zegt zelf vanaf hoeveel

Een rang heeft een naam en een eigen drempel: *vanaf zoveel renown*. Een trede erbij is dus één knop — naam en getal, klaar. De volgorde volgt uit de getallen, dus je hoeft ze niet op volgorde in te tikken. Er stond hier een apart veld met komma’s (`0,1,3,10,25,50`) dat op positie moest matchen met de lijst eronder; haalde je er een rang tussenuit, dan schoof de hele ladder een plek op zonder dat iets dat zei.

### Renown hoeft niet het enige te zijn

Onder de rangnaam staat *en pas bij*: een **level** en een aantal **voltooide missies** van deze factie. Het boek doet dat ook — vanaf de derde trede wil een gilde meer zien dan alleen aanzien. Laat je ze leeg, dan telt alleen renown. Het level is dat van het hoogste personage in de party.

### Voorrekenen, niet blokkeren

De eis houdt niemand tegen: de rang volgt uit de renown, en de speler ziet ernaast staan wat er gevraagd wordt en wat hij heeft — met een vinkje of een slotje. Jij beslist aan tafel of het telt. Dezelfde regel als bij multiclassen en spreukverzoeken.

### Waar de getallen vandaan komen

Een nieuwe factie begint op **0, 1, 3, 10, 25 en 50**: de vijf rangen van het boek, met een trede ervóór voor wie nog geen lid is. Die heet *Buitenstaander*, want die naam beschrijft de mechaniek en niet jouw wereld — de rest vul je zelf in. Zet je ze anders, dan houdt de app jouw getallen.

### Wat een trede oplevert

Regel voor regel, met vooraan wat voor soort gunst het is. Er zijn er vijf, en ze doen allemaal iets op het moment dat de party de rang haalt.

### De vijf soorten

**Afspraak** is een regel die in hun boedel komt: onderdak, een korting, vrije doorgang — heeft geen korte naam nodig, de regel zelf mag de gunst zijn. **Voorwerp** geeft het kaartje echt in bezit, met het aantal dat je erbij zet. **Winkel** zet een winkel open voor deze party: hij verschijnt op de Markt en ze kunnen er kopen. **Hulp** is iemand die ze mógen inroepen — niet iemand die er voortaan is; je stelt in hoe lang hij blijft en wanneer ze hem weer mogen roepen. **Titel** verschijnt bij de speler zodra hij de rang haalt.

### Wat er wél en niet wordt uitgedeeld

Een afspraak, een voorwerp en een winkel worden **één keer** toegekend en onthouden, dus renown die heen en weer beweegt levert niet twee keer hetzelfde zwaard op. Een titel en hulp worden niet uitgedeeld: de titel staat op de ladder, en hulp vraag je met een knop bij de factie. Koppel je een voorwerp, dan staat op het kaartje van dat voorwerp voortaan dat het de gunst van deze rang is — te zien zodra de party de factie kent.

---

## `dm_facties_leden`

> Helpknop in: dm-panel.js:8027 (subtabtabel)
> Nu: de standaard uit de code
> 3 stappen · 162 woorden · 54 per stap

Titel: Leden van een factie

### Eén lijst: het organogram

Wie bij een factie hoort staat in het **organogram** van haar organisatiekaartje — daar geef je iemand een rol en zet je hem onder een ander. Wat je hier ziet is een spiegel daarvan; klik de naam van de organisatie om hem te bewerken. Er was hier ook een eigen ledenlijst met een apart rangveld: twee lijsten voor één vraag, die uit elkaar liepen.

### Van twee kanten te leggen

Je kunt het ook op het kaartje van de persoon zelf zeggen, bij *Waar hoort dit personage bij?*. Dat schrijft in hetzelfde organogram — één plek waar het staat, twee kanten om het te leggen. Heeft de factie nog geen organisatiekaartje, dan is er geen plek om het te bewaren; koppel dat eerst bij **Algemeen**.

### Hoe het bij de spelers oogt

Wie niemand boven zich heeft staat onder **Leiding**, de rest onder de naam van zijn chef. Een lid waarvan de party het personagekaartje nog niet kent, verschijnt niet bij naam — een organisatie ontmantelen is het spel, en de ledenlijst is niet gratis.

---

# Instellingen

Eén keer goed zetten en daarna vergeten, in de volgorde van de drie tabjes (Campagne · Party's · Beheer). Toon: zeg wat de keuze betekent en wat de gevolgen zijn, niet waar de knop staat.

## `inst_onderdelen`

> Helpknop in: dm-panel.js:13437
> Nu: de standaard uit de code
> 3 stappen · 223 woorden · 74 per stap

Titel: Onderdelen van deze campagne

### Wat dit doet

Elk vinkje is een stuk van de app. Haal je er een weg, dan **verdwijnt het helemaal** — de knop in de zijbalk, het tabblad in de Meesterkamer, de routes erachter, en ook bij je spelers. Geen grijze knop die zegt "binnenkort": die belooft iets.

Wat je uitzet blijft wel staan. Zet je het later weer aan, dan is alles er nog precies zoals je het achterliet.

### Diensten en hun delen

Een dienst doet soms twee dingen die los van elkaar staan: je kunt in een herberg slapen én drinken, maar niet elke herberg schenkt. Die delen staan ingesprongen onder hun eigen dienst — *Aan de tap* en *Roddels* onder de herberg, *Eden en vloeken* onder de tempel, *Strijdperk* onder het gokhuis, *Adoptie* onder de magizoöloog.

Zet je de dienst zelf uit, dan doen zijn delen er niet meer toe; die verdwijnen vanzelf mee.

### Iets erbij nemen

Alles wat hier staat kun je aan- en uitzetten, ook wat standaard uit stond. Een deel van de app begint uit omdat niet elke tafel het wil — de geldschieter die aanklopt, de eed die je niet meer terugneemt, de geruchten die je kunt laten rondgaan. Dat zijn keuzes over je spel, niet over of je ze mag.

Wat je **helemaal niet ziet staan** heeft de beheerder voor deze campagne dichtgezet. Dat is dan een beslissing, en die haal je bij hem terug.

---

## `inst_campagne`

> Helpknop in: dm-panel.js:9265 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:13460
> Nu: de standaard uit de code
> 3 stappen · 176 woorden · 59 per stap

Titel: De campagne

### Titel en ondertitel

De **titel** is de naam van je wereld: hij staat op de landingspagina, in de kop en als naam van de app op een beginscherm. De **ondertitel** staat eronder — een regel sfeer, of de naam van de groep.

### Embleem: het wapen ín de app

Het **embleem** is het wapen dat je in de app zelf ziet: groot op de landingspagina, klein in de kop. Het is een gewone afbeelding uit de mediabibliotheek, dus een schild, een zegel of een wapenschild werkt allemaal.

### App-icoon: het wapen búiten de app

Het **app-icoon** is een ander ding: dat is het plaatje dat je telefoon of tablet gebruikt zodra je de app aan je beginscherm toevoegt, plus het icoon in het tabblad van de browser. Daarom staat het los van het embleem — een embleem mag een brede tekening zijn, een icoon moet als vierkantje van een halve centimeter nog leesbaar zijn. Laat je het leeg, dan wordt het meegeleverde wapen gebruikt. Een app die al op een beginscherm staat houdt zijn oude icoon tot hij er opnieuw op wordt gezet; dat bewaart het besturingssysteem, daar kunnen wij niets aan doen.

---

## `inst_valuta`

> Helpknop in: dm-panel.js:13483
> Nu: de standaard uit de code
> 3 stappen · 138 woorden · 46 per stap

Titel: Namen voor valuta

### Drie munten, vaste verhouding

Je campagne mag haar munten noemen zoals je wilt — de verhouding blijft die van het boek: **1 gold = 10 silver = 100 copper**. De afkortingen gp/sp/cp staan erbij zodat een tabel uit een boek altijd klopt, ook als jouw munten Daalder, Stuiver en Duit heten.

### Electrum en platinum

Die twee hebben géén eigen plek in de beurs: wat je erin typt wordt bij het invoeren omgerekend (ep = 5 silver, pp = 10 gold). Een vondst mag dus een platinum stuk bevatten; het staat daarna gewoon als goud in de beurs. Geef je ze een naam, dan wordt die alleen gebruikt om te tónen: *"waaronder 3 Lion d'or"* bij een vondst.

### Hernoemen kan altijd

De namen zijn opmaak, geen administratie — al het bezit staat als getal opgeslagen. Je kunt dus halverwege een campagne je munten omdopen zonder dat er iets kwijtraakt.

---

## `inst_levelup`

> Helpknop in: dm-panel.js:13535
> Nu: de standaard uit de code
> 4 stappen · 203 woorden · 51 per stap

Titel: Level omhoog

### XP of Milestone

Bij **Milestone** gun jij het level: je zet een level-up klaar wanneer het verhaal daar is. Bij **XP** wordt hij verdiend — je deelt punten uit met de XP-knop in de regie-balk (die het bedrag van het lopende gevecht al voorstelt) en de level-up staat vanzelf klaar zodra iemand over de drempel komt. Omzetten kan altijd.

### De nullijn bij XP

Speelde je eerst op Milestone, dan heeft iedereen wel een level maar nog geen XP en staat elke balk op nul. De knop **Ieders XP op de nullijn zetten** geeft ieder het minimum dat bij zijn huidige level hoort; wie al meer had houdt dat, en niemand krijgt er een level-up van. Twee keer drukken kan dus geen kwaad.

### Hoe komt de HP erbij

Drie manieren: het **gemiddelde** (het vaste getal uit het boek), **in de app gooien** (de server gooit de hit die) of **zelf gooien** aan tafel, waarna de speler zijn worp intikt en de server hem toetst. Wat je hier uitvinkt kan een speler niet kiezen; de server weigert een manier die uitstaat. Vink je alles uit, dan kan niemand meer omhoog — dat wordt daarom geweigerd.

### Hoogste level

Waar de tijdlijn ophoudt. Twintig is de normale grens van 5e; hoger zet hem alleen open, het vult geen nieuwe features in.

---

## `inst_materiaal`

> Helpknop in: dm-panel.js:13550
> Nu: de standaard uit de code
> 2 stappen · 152 woorden · 76 per stap

Titel: Material components

### Wat de spelers bijhouden

In hun spreukenboek kiezen spelers per spreuk met een M-component of ze het materiaal **altijd bij de hand** hebben (een component pouch of focus dekt alles zonder prijs) of een **voorraad** bijhouden die bij elke cast één omlaag gaat. Verbruikt materiaal met een prijs (*a diamond worth 300+ GP, which the spell consumes*) begint vanzelf als voorraad van nul.

### Afrekenen uit de beurs

Zet je dit aan, dan krijgt een speler wiens voorraad op is de keuze om het materiaal meteen uit de beurs te betalen — de gedeelde partybeurs als die aanstaat, anders zijn eigen. Het bedrag komt uit de tekst van de spreuk en staat in een veld dat hij mag overtypen; is er te weinig geld, dan weigert de server.

Staat het uit, dan is die knop er niet en weigert de server het ook. De speler kan dan nog steeds *toch casten*: de app houdt geen spreuk tegen, hij rekent alleen voor.

---

## `inst_personage`

> Helpknop in: dm-panel.js:13618
> Nu: de standaard uit de code
> 9 stappen · 746 woorden · 83 per stap

Titel: Zelf een personage maken

### Waarom dit er is

Een speler kon zijn blad altijd al bijwerken, maar het **kaartje** aanmaken kon alleen jij. Een nieuwe speler stond daardoor niet tussen de portretten en kwam nergens binnen — en jij moest midden in een sessie een leeg kaartje maken terwijl de rest wachtte.

Nu maakt hij er zelf een. De drempel is het **partywachtwoord**: wie dat heeft zit aan tafel, dezelfde afspraak als bij het inloggen.

### Het bestaat pas als jij het gunt

Wat hij maakt is een **concept** en geen kaartje. Het staat nergens in je wereld: niet in de partylijst, niet in een gevecht, niet op het tafelscherm. Je vindt het op één plek — **Vragen → Nieuw personage** — met zijn hele blad erbij: wat hij koos, wat daaruit volgt, en wat de app erover op te merken heeft.

Gun je het, dan ontstaan het kaartje, het profiel en zijn HP in één keer, in de party waar hij het wachtwoord van had. Stuur je het terug, dan hoort daar een reden bij; die leest hij zodra hij verder gaat.

### De scores

Vier manieren, en jij zegt welke er aan jouw tafel mogen: de **standaardreeks**, **point buy**, **rollen** (zes keer 4d6, de laagste eraf, in de app) en **vrij intikken** voor een personage dat elders gemaakt is.

De app rekent voor maar houdt niets tegen. Kiest iemand scores die niet kunnen, dan staat dat als opmerking op jouw scherm en beslis jij.

### Herkansingen bij rollen

Rollen gebeurt op de server, dus herladen is geen gratis nieuwe worp. Standaard geldt **wat je rolt, dat is het**. Wil je een speler een slechte set laten overdoen, zet hier hoe vaak — een herkansing werpt altijd de **hele set** opnieuw, niet één score.

Na het rollen koppelt de speler elke worp zelf aan de ability die hij wil.

### Op welk level de party begint

Standaard begint iedereen op 1. Zet je het hoger, dan begint een nieuw personage daar meteen op en kan er niet boven gevraagd worden. Zijn HP, proficiency, hit dice en het aantal spreuken rekenen mee, en zijn subclass vraagt de maker zodra zijn beginlevel hoog genoeg is.

De **Ability Score Improvements en feats** die hij onderweg had gekregen kiest hij ook meteen, op dezelfde levels als op zijn Progressie-tijdlijn — daar staan ze na het gunnen gewoon als gekozen. Een feat met een voorwaarde (Level 4+, een andere feat, een species) houdt de maker niet tegen; dat zie jij.

### Verhaal en geheimen

Een speler kan zijn achtergrondverhaal schrijven en **geheimen** meegeven die niemand aan tafel kent. Het verhaal wordt de beschrijving op zijn kaartje; de geheimen worden gewone geheimregels, die jij per regel onthult wanneer het moment daar is — net als bij elk ander kaartje. Hij ziet ze zelf ook pas terug als jij ze onthult.

### Twee classes tegelijk beginnen

Staat het beginlevel op 2 of hoger, dan kan een speler zijn levels over **twee classes** verdelen — Fighter 3 / Rogue 2 bijvoorbeeld. Het staat achter een uitklapper bij de class: het is de uitzondering, en wie het niet zoekt hoort er geen last van te hebben.

Zijn hit dice tellen dan per class (3d10 + 2d8) en de **eisen** staan erbij zoals overal in deze app: voorrekenen, niet blokkeren. Haalt hij de Strength 13 voor Paladin niet, dan lees jij dat bij het gunnen en beslis jij.

### Alignment en wat je toelaat

Bij de naam staat nu ook **alignment**. Negen stuks; welke er te kiezen zijn bepaal jij. De drie kwaadaardige staan er standaard niet bij, want aan de ene tafel is een kwaadaardig personage een personage en aan de andere een probleem — het vinkje staat hier. *Unaligned* ontbreekt met opzet: dat is wat een beest is, niet iets wat je voor een personage kiest. Op een kaartje in het archief kan het wél, want daar staan ook wezens.

Daaronder vink je aan **uit welke boeken** ze mogen kiezen. Niets aanvinken betekent alles — zo was het altijd al, dus wie niets kiest merkt er niets van. Vink je wél iets aan, dan verdwijnt alles daarbuiten uit de maker: classes, subclasses, species, backgrounds en feats. Wat géén boek draagt blijft altijd staan; dat is eigen werk van je campagne.

De schakelaars per class en subclass in *Instellingen → Campagne* blijven daarbovenop gelden — die zijn de uitzondering op deze regel.

### Rommel in zijn zak

De app verzint geen trinkets — wat er in je zak zit hoort bij jouw wereld. Wijs hier een **tafel van je eigen campagne** aan, dan rolt elke nieuwe speler daar één keer op en gaat de uitkomst als voorwerp mee in zijn boedel.

Eén keer: opnieuw rollen tot er iets leuks staat is geen worp meer.

---

## `inst_gevecht`

> Helpknop in: dm-panel.js:13689
> Nu: de standaard uit de code
> 5 stappen · 297 woorden · 59 per stap

Titel: In het gevecht

### Wat zien spelers van andermans HP?

Drie standen. **Alleen of hij nog meedoet** geeft geen balk en geen woord — je ziet wie eruit ligt, verder niets; voor een DM die spanning belangrijker vindt dan boekhouding. **Een balk en een woord** is de standaard: *ongedeerd*, *gewond*, *stervend*, met een balk die op tienden is afgerond zodat je het getal er niet uit terugrekent. **De cijfers** toont gewoon 34/52.

### Wat er níét onder valt

AC en het statblock blijven in alle drie de standen verborgen. Die lopen via het **bestiarium**: wat de party bestudeerd heeft mag ze zien, en dat is precies wat de Magizoöloog verkoopt. Zou de stand *de cijfers* ook het statblock vrijgeven, dan kreeg je in ronde één gratis waar hij 50 goudstukken voor vraagt.

### Bestudeerde monsters

Heeft de party een wezen op *deels* of *volledig* staan, dan hoort daar de beloning bij: AC, statblock en de cijfers. Alleen in de stand **alleen of hij nog meedoet** houdt de instelling de HP alsnog tegen — die DM zei nu eenmaal "bij mij geen cijfers in het gevecht". Het statblock blijft ook dan gewoon leesbaar.

### Wat altijd van jou blijft

Je eigen personage zie je volledig, en alles wat aan jou toebehoort: een geadopteerd dier, iets wat je oproept. Het is jouw beest en je moet kunnen zien of het de volgende klap overleeft. Andere spelers en hún metgezellen zie je zoals de stand hierboven zegt.

### Visuele effecten bij schade

Zet je dit aan, dan praat het **tafelscherm** mee zodra er HP verandert: een rode flits als iemand een klap krijgt, een feller beeld bij zware schade, en een donkerrode schemer zolang er iemand op 0 ligt.

Alleen schade doet iets. Genezing uit een rust of een level-up laat het scherm met rust — anders flitste het bij elke lange rust, en dan betekent een flits niets meer. Het volgt dus wat je aan tafel als klap opschrijft.

---

## `inst_heldenboek`

> Helpknop in: dm-panel.js:13694
> Nu: de standaard uit de code
> 3 stappen · 171 woorden · 57 per stap

Titel: Wat spelers in de naslag zien

### Waarom je dit zou doen

Niet elke wereld heeft alles. Misschien bestaat de Artificer bij jou niet, of houd je een subclass achter tot iemand hem verdient. Een **vinkje betekent zichtbaar**; wat je uitvinkt bestaat voor je spelers niet — geen grijze regel, geen "hier mis je iets", gewoon weg.

Het geldt voor de hele campagne, niet per party. De naslag is een naslagwerk: wat erin staat bestaat in je wereld, en dat is voor iedereen aan tafel hetzelfde.

### Wat je niet kunt uitzetten

Een class of subclass die iemand **speelt**. Zijn tijdlijn haalt zijn features hier vandaan; zou je hem verbergen, dan kijkt hij naar een leeg blad zonder te snappen waarom. De app weigert dat en zegt bij wie het staat.

Wil je er toch vanaf, dan verzet je eerst zijn class op zijn blad.

### Nieuw materiaal staat aan

We bewaren wat er **uit** staat, niet wat er aan staat. Een class die je er morgen bij maakt is dus meteen zichtbaar — je hoeft niet te onthouden dat je hem ergens moet aanvinken. Zelfde afspraak als bij de bereikbaarheid van een dienst.

---

## `inst_bastion`

> Helpknop in: dm-panel.js:13666
> Nu: de standaard uit de code
> 3 stappen · 114 woorden · 38 per stap

Titel: Bastion

### Vanaf welk level

In de DMG krijg je een bastion op **level 5**. Zet je dit lager, dan telt een personage op dat level al voor twee special facilities. Stichten kun je altijd; dit getal bepaalt alleen wat de app voorrekent.

### Nachten per Bastion Turn

Hoeveel **lange rusten** van de party er tussen twee turns zitten. De DMG zegt zeven dagen. Zet je de melding uit, dan telt de app niet mee en rond jij de turn af wanneer het jou uitkomt.

### Spelers leggen orders zelf vast

Standaard **stellen spelers voor** en leg jij vast — zo kunnen twee spelers niet elkaars order omgooien zonder dat jij het ziet. Zet je dit aan, dan ligt wat een speler kiest meteen vast. Afronden blijft altijd bij jou.

---

## `inst_partys`

> Helpknop in: dm-panel.js:9265 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:12807 (venster), dm-panel.js:12807 (venster), dm-panel.js:13768
> Nu: de standaard uit de code
> 7 stappen · 367 woorden · 52 per stap

Titel: Party's

### Eén regel per party

Elke party staat op één regel met het aantal personages en een slotje als er een wachtwoord is. Klik erop en je krijgt alles van díé party bij elkaar: naam, wachtwoord, wie erbij hoort, wie er vanavond meespeelt en de gedeelde beurs.

### Personages: koppelen en losmaken

Onder **Personages** staat wie bij deze party hóórt — dat is blijvend, het staat op het kaartje van het personage zelf. Losmaken met het kruisje betekent dat hij bij geen enkele party meer hoort en dus niets meer van de campagne ziet. Wat bij de party ligt blijft daar: voorwerpkaartjes, onthulde geheimen en welke kaartjes ontdekt zijn staan per party, niet per personage. De vraag vóór het losmaken zegt precies hoeveel dat er zijn.

### Waarvan actief is iets anders

Onder **Waarvan actief** zet je iemand tijdelijk buiten de sessie — de speler die er niet is. Dat bepaalt wie meedoet bij rust, bij het verdelen van buit en bij het vullen van een gevecht, en het is met één klik terug te draaien. Bewust de afwezigen die bewaard worden en niet de aanwezigen: een personage dat erbij komt doet dan vanzelf mee.

### Eén zak of ieder zijn eigen

Staat de gedeelde beurs **aan**, dan is dát de portemonnee van de party: iedereen ziet hetzelfde bedrag, en alles wat gekocht of gevonden wordt gaat erin en eruit. Staat hij **uit**, dan heeft elke speler zijn eigen beurs.

### Per party

De schakelaar geldt per party, en hij staat daarom in het kaartje van díé party — zo verzet je nooit per ongeluk de beurs van een tafel die je niet bedoelde. Wil je ze naast elkaar zien, open dan de party's een voor een; er is bewust geen tweede lijst met alle saldo's, want twee weergaven van hetzelfde bedrag lopen vroeg of laat uit elkaar.

### Omzetten raakt geen geld kwijt

De twee zakken bestaan naast elkaar: zet je de gedeelde beurs uit, dan komt ieders eigen beurs weer tevoorschijn zoals die was, en het gedeelde bedrag blijft staan tot je hem weer aanzet. Er verdwijnt dus niets, maar reken er ook niet op dat geld mee verhuist.

### Het wachtwoord van een party

Dat is wat je je spelers stuurt; ze kiezen daarna zelf hun personage. Groepswachtwoorden blijven leesbaar staan — je moet ze kunnen opzoeken als iemand het kwijt is. Jouw eigen DM-wachtwoord staat onder **Beheer** en wordt wél versleuteld.

---

## `inst_beheer`

> Helpknop in: dm-panel.js:9265 (de subtab-balk stelt de sleutel samen uit het actieve tabje), dm-panel.js:13787
> Nu: de standaard uit de code
> 4 stappen · 177 woorden · 44 per stap

Titel: Beheer

### Jouw DM-wachtwoord

Geldt alleen voor deze campagne en wordt **versleuteld** opgeslagen, zodat het niet leesbaar in een backup staat. Twee keer intikken, want met een typefout hierin sluit je jezelf buiten.

### Op de openingspagina

Het kale adres toont een keuzepagina met alle campagnes die zich laten zien. Vink dit uit en deze campagne staat er niet tussen; wie het pad kent komt er nog gewoon in.

### Naslag elders

Niet elke regeltekst mag in de app staan: wat niet in de vrije SRD zit heeft bij ons geen beschrijving. **Linken mag wel.** Hier zet je waarnaar die verwijzing gaat — een zoekopdracht met `{zoek}` erin, of `{naam}` en `{soort}` als je het zelf wil samenstellen. Leeg is een zoekmachine, en dat werkt beter dan een diepe link: die verlept zodra de andere site zijn adressen verandert.

### Campagnes en modules

Alleen de beheerder ziet dit. Per campagne staat hier het DM-wachtwoord, welke campagne de **standaard** is (waar het kale adres naartoe stuurt) en welke **modules** aanstaan. Wat uit staat verdwijnt uit beeld — bij de DM én bij zijn spelers; er komt geen grijze "binnenkort"-knop voor in de plaats.

---

## `inst_campagnes`

> Helpknop in: dm-panel.js:13756
> Nu: de standaard uit de code
> 4 stappen · 160 woorden · 40 per stap

Titel: Campagnes en modules

### Alleen de beheerder

Dit blok zie jij omdat je de beheerder bent. Elke campagne heeft haar eigen wereld, party's en wachtwoord; hier staan ze naast elkaar. *Openen* brengt je erheen — je logt daar in met **haar** DM-wachtwoord, niet het jouwe.

### De standaard

Eén campagne is de standaard: daar landt het kale webadres, en daar komt een bezoeker terecht die nog nergens is ingelogd. De rest is bereikbaar via zijn eigen adres.

### Modules

Wat uit staat verdwijnt uit beeld — bij jou én bij je spelers. Er komt geen grijze "binnenkort"-knop voor in de plaats: een dienst die deze campagne niet heeft, bestaat er gewoon niet. Aanzetten kan altijd weer, en er gaat niets verloren zolang hij uit staat.

### Een nieuwe campagne

Naam, ondertitel en meteen een **DM-wachtwoord** — zonder dat komt er niemand in, want alleen de standaardcampagne valt terug op het serverwachtwoord. De vraag *XP of Milestone* staat er ook bij; die bepaalt de hele level-up-kant, en je kunt hem later omzetten bij Campagne → Level omhoog.

---

## `inst_export`

> Helpknop in: dm-panel.js:13826
> Nu: de standaard uit de code
> 4 stappen · 187 woorden · 47 per stap

Titel: Export & backup

### Twee uitdraaien

Het **campagneboek** is je campagne in verhalende vorm: een inhoudsopgave, de sessies op volgorde en een register van personages, locaties en voorwerpen. De **character sheets** zijn de printbare bladen van de actieve party. Allebei kun je ze in je browser als pdf bewaren.

### Wat er níét in staat

De uitdraai gebruikt dezelfde filter als de app zelf: wat een party nog niet ontdekt heeft, gaat niet mee. Geef je een bestand aan je spelers, dan staan jouw aantekeningen, de geheimen en het regie-script er dus niet in.

### En naar binnen

Onder dezelfde kop staat de weg terug: vijf **Obsidian-sjablonen** om een kaartje buiten de app voor te bereiden, en de knop om ingevulde `.md`-bestanden weer in te lezen. Het `type`-veld in het YAML-blok bepaalt wat het wordt.

Die twee stonden in een tabblad zonder knop, en waren dus nergens te bereiken; sinds 14 oktober 2026 staan in- en uitgaand bij elkaar.

### De echte backup draait vanzelf

Dit is een uitdraai om te lezen, geen reservekopie. Elke nacht maakt de server een kopie van alle campagnes en bewaart die dertig dagen; de character sheets gaan daar als HTML in mee. Je hoeft hier dus niets te doen om veilig te zitten.

---
