# Voorstel: op de pof kopen, met een schuld die zich meldt

*Opgesteld 7 sep 2026. Nog niet gebouwd — ligt ter beoordeling.*

## Wat er al is

De Tweespalt kent leningen (`dmState.tweespalt.leningen[characterId]`):
één lening per personage bij Taevin Woekeling, 30% rente **per dag**,
samengesteld, met een schuldbewijs als losse regel in de knapzak
(`ts_leen_…`) die alleen de DM mag weghalen — dat weghalen ís het aflossen.

Daar zitten vier dingen scheef, en die moeten eerst goed voordat er een tweede
schuldsoort bij komt:

1. **De rente loopt op de kalender.** De party speelt geen realtime dagen.
   Er staat nu één lening open in Grisburgh: 28,80 florinde, aangegaan op
   26 april, 134 dagen geleden. Bij 30% per dag samengesteld staat daar
   vandaag 5,8 × 10¹⁸ centeling tegenover — meer geld dan er in de wereld is.
   Dat is geen woekeraar meer, dat is een softwarefout.
2. **De DM ziet niets.** Er is geen overzicht van openstaande schulden; het
   staat alleen in het paneel van de speler zelf. Een schuld die niemand ziet
   is geen verhaallijn.
3. **Aflossen bestaat niet.** De enige weg is: de DM gooit het schuldbewijs
   weg. Er is geen "betaal (deels) terug".
4. **De lening gaat langs de gedeelde beurs heen.** Het geleende bedrag wordt
   op `dmState.playerCurrency` bijgeschreven, terwijl alle drie de party's in
   Grisburgh met een gedeelde beurs spelen. Je leent dus geld dat je nergens
   ziet staan. Zie hieronder — dit geldt voor meer diensten.

## Voorstel

### 1. Eén schuldenregister

Niet per dienst een eigen regeling, maar `dmState.schulden[characterId] = [ … ]`
met per schuld: `{ id, bron ('winkel'|'tweespalt'|…), bronId, bronNaam,
hoofdsomCl, rentePerRust, rustStandBijAanvang, opeisbaarNa, omschrijving }`.
De Tweespalt-lening wordt daar één soort van; zijn bestaande gegevens zijn in
één migratie om te zetten.

### 2. Rente per lange rust, niet per dag

Zelfde keuze als bij het wisselende winkelassortiment: de teller die er sinds
7 sep is (`g.rustTellers.long`) is de klok van de campagne. Verschuldigd =
`hoofdsom × (1 + rente)^(rusten sinds aanvang)`. Een schuld groeit dan tijdens
het spel en staat stil tussen twee sessies. En 30% per nacht is nog steeds
angstaanjagend zonder absurd te worden.

### 3. Per winkel instelbaar

In het Winkel-tabblad, bij de bestaande instellingen: **schrijft aan** (uit als
standaard), **tot hoeveel**, en **rente per lange rust**. Zo blijft het de keuze
van de DM per handelaar — de smid die je kent schrijft aan, de marktkraam niet.

### 4. Wat de speler ziet

Nu krijgt hij bij te weinig geld een weigering met het tekort erbij. Schrijft de
winkel aan, dan komt daar één knop bij: **Op de pof (487 Florinde)**. Hij krijgt
het voorwerp en een **schuldbrief** in zijn boedel — dezelfde vorm als het
Tweespalt-schuldbewijs, dus meteen herkenbaar: bedrag, bij wie, rente, en niet
zelf weg te halen.

### 5. Wat de DM ziet

Het stuk dat vandaag ontbreekt. Een blok **Schulden** in de Meesterkamer: wie,
bij wie, hoofdsom, wat er nu staat, hoeveel rusten open. Per regel twee knoppen:
*Afbetalen* (bedrag van de beurs, schuldbrief weg) en *Kwijtschelden*.
Deelbetaling mag: het bedrag is een veld.

### 6. De haak voor een encounter

Bij een lange rust kijkt de server of een schuld `opeisbaarNa` passeert. Zo ja:
de schuld gaat op `opeisbaar` en de DM krijgt het te zien — één regel in de
rust-samenvatting die hij toch al leest. Daarna beslist hij wat er gebeurt.

Mooie bijvangst: het **briefsysteem** ligt er al (`_bezorgBrief`, verzegelde
envelop met lakzegel). Een opeisbare schuld die zich meldt als brief van de
schuldeiser laat het aan tafel binnenkomen in plaats van in een lijstje. De DM
kan er dan een encounter, een factie-overname of een klus aan hangen — dat
verzint hij zelf, de app levert alleen het moment.

### 7. Wat ik niet zou bouwen

Rente die automatisch van de beurs wordt afgeschreven, of een speler die
geblokkeerd raakt. Het is een verhaalhaakje, geen boekhoudmachine. En geen
tweede schuldsoort naast de Tweespalt: één register.

## Eerst repareren: de gedeelde beurs wordt omzeild

Vier diensten lezen en schrijven `dmState.playerCurrency` rechtstreeks in plaats
van via `_effectiveCurrency()` / `_deductCurrency()`:

| Dienst | Wat er misgaat |
|---|---|
| **Ursula** (`/ursula/voorspel`) | betaalt uit de eigen beurs; met een gedeelde beurs kan een speler met 0 op zak niets vragen |
| **De Gock** (`/gock/opdracht`) | idem |
| **De Tweespalt** (`/tweespalt/leen`) | schrijft het geleende bedrag bij op de eigen beurs |
| **De Heeren** (`/heeren/job/:id/uitslag`) | keert de opbrengst uit op de eigen beurs |

Alle drie de party's in Grisburgh spelen met de gedeelde beurs aan, dus dit
speelt nu. Het is dezelfde fout die de winkel had en die op 7 sep is
rechtgezet; hetzelfde recept werkt hier. Dit hoort vóór het schuldenregister,
want krediet dat in de verkeerde beurs landt is erger dan geen krediet.
