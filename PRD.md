# PRD: Cozy Color Companion

> Companion webapp voor bij het inkleuren met stiften — ambient sfeer, kleurinspiratie, sessietracking en een gamified leersysteem.

---

## 1. Productvisie

Een warme, rustgevende webapp die je naast je kleurboek legt terwijl je met stiften aan tafel zit. De app biedt achtergrondgeluiden, kleurpaletten als inspiratie, een sessie-timer, en een gamified oefenprogramma van 20 lessen verdeeld over 5 leerpaden.

**Doelgroep**: Volwassenen die als hobby inkleuren met stiften (markers, fineliners).
**Platform**: Mobiel-first (tablet/telefoon naast kleurboek), ook bruikbaar op desktop.
**Deployment**: Zelfde patroon als Cozy Draw — enkel statische bestanden, geen build-stap, geen server. Openen via `companion.html` in een browser of via GitHub Pages.

---

## 2. Technische Opzet

### 2.1 Architectuur

| Aspect | Keuze |
|---|---|
| Bestandsformaat | Single-file HTML (`companion.html`) met inline CSS + JS |
| Framework | Geen — vanilla HTML/CSS/JS |
| State management | `localStorage` voor alle persistente data |
| Audio | Web Audio API (procedureel gegenereerd, geen externe bestanden) |
| Offline | PWA via bestaande service worker (uitgebreid) |
| Build-stap | Geen |

### 2.2 Bestandsstructuur (na implementatie)

```
Cozy/
├── index.html              ← Cozy Draw (bestaand)
├── companion.html          ← Cozy Color Companion (nieuw)
├── manifest.json           ← Bijgewerkt met companion
├── sw.js                   ← Bijgewerkt met companion caching
├── icon-192.png            ← Gedeeld
├── icon-512.png            ← Gedeeld
└── README.md               ← Bijgewerkt
```

### 2.3 Cross-app navigatie

- Cozy Draw krijgt een link-knop naar Companion in de topbar
- Companion krijgt een link-knop naar Draw in de topbar

---

## 3. Features

### 3.1 Navigatie

**Bottom tab-bar** met 5 tabs (mobile-first):

| Tab | Icoon | Naam |
|---|---|---|
| 1 | Home | Dashboard |
| 2 | Muzieknoot | Ambient |
| 3 | Palet | Kleuren |
| 4 | Klok | Sessie |
| 5 | Boek | Lessen |

**Top bar** bevat:
- App-titel "Cozy Color Companion"
- **Mute-knop** (altijd zichtbaar, ongeacht actieve tab)
- Link naar Cozy Draw

---

### 3.2 Dashboard (Tab 1)

Het dashboard toont een overzicht van alle voortgang:

| Element | Beschrijving |
|---|---|
| Streak-teller | Huidige streak (opeenvolgende dagen met sessie) + beste streak |
| Sterren-totaal | X / 60 sterren behaald (20 lessen × max 3 sterren) |
| Badges | Visuele weergave van 5 pad-badges (behaald of locked) |
| Pad-voortgang | Progressiebalk per leerpad (0-4 lessen voltooid) |
| Cozy Master | Speciale titel/badge die verschijnt als alle 20 lessen voltooid zijn |
| Laatste sessie | Datum, duur en notities van de laatst voltooide sessie |
| Snel verder | Knop naar de eerstvolgende niet-voltooide les |

---

### 3.3 Ambient (Tab 2)

Achtergrondgeluiden die de kleurervaring verrijken. Meerdere geluiden tegelijk afspeelbaar.

#### Beschikbare geluiden

| Geluid | Icoon | Techniek |
|---|---|---|
| Regen | Druppel | Brown noise → lowpass filter (600Hz) + white noise → bandpass (3kHz) voor druppels, LFO op gain |
| Haardvuur | Vlam | Brown noise → lowpass (300Hz) voor lichaam + stochastische noise-grains (highpass 1-8kHz) voor geknetter |
| Bos | Boom | Bandpass-gefilterde noise voor wind + oscillator-chirps (AM/FM synthese) voor vogels |
| Oceaan | Golf | Brown noise → bandpass (500Hz), twee LFO's (iets verschillende snelheden) op filter-freq en gain voor golfbeweging |
| Wind | Wind | White noise → bandpass (800Hz) + highpass (200Hz), drie LFO's voor windvlagen en turbulentie |
| Lo-fi | Noot | Detuned triangle-oscillatoren (Cmaj7-akkoord, 3 stemmen per noot), lowpass filter met LFO voor warmte |

#### Audio-architectuur

```
[Geluid] → [Kanaal Gain] ──┐
[Geluid] → [Kanaal Gain] ──┼→ [Master Gain] → [DynamicsCompressor] → speakers
[Geluid] → [Kanaal Gain] ──┘
```

- **Per kanaal**: eigen aan/uit toggle + volume-slider
- **Master volume**: slider in ambient-tab
- **Mute-knop** (in topbar): `audioCtx.suspend()` / `audioCtx.resume()` — stopt daadwerkelijk audio processing (bespaart CPU/batterij)
- **DynamicsCompressor** voorkomt clipping bij meerdere lagen

#### Noise-buffers

Drie gedeelde noise-buffers (4 seconden, geloopt):
- **White noise**: `Math.random() * 2 - 1`
- **Pink noise**: Paul Kellet's methode met filter state variabelen
- **Brown noise**: Brownian motion (`lastOut + 0.02 * white) / 1.02`)

#### iOS Safari compatibiliteit

- AudioContext aanmaken/hervatten vereist user gesture → unlock bij eerste tap
- `visibilitychange` event afhandelen voor `interrupted` state
- `webkitAudioContext` fallback voor oudere versies

---

### 3.4 Kleuren (Tab 3)

Kleurpaletten als inspiratie bij het kiezen van stiften.

#### Paletten

| Palet | Kleuren (6-8 per palet) |
|---|---|
| Herfstwarmte | Kastanje, Kaneel, Zand, Goudgeel, Baksteenrood, Mosgroen |
| Wintermagie | IJsblauw, Sneeuwwit, Dennegroen, Bessenrood, Zilvergrijs, Nachtblauw |
| Lentefris | Mintgroen, Zachtroze, Lavendel, Citroengeel, Lichtkoraal, Hemelsblauw |
| Zomeravond | Warm oranje, Koraalrood, Turquoise, Goud, Zandbeige, Dieppaars |
| Pastel Droom | Pastelroze, Pastelblauw, Pastelgeel, Pastelgroen, Pastelpaars, Pastelkoraal |
| Aardse Tinten | Terracotta, Olijfgroen, Warmbruin, Okergeel, Steengrijs, Roestoranje |
| Bessen & Bloemen | Frambozenrood, Pruimenpaars, Pioenroze, Bladgroen, Mauve, Bordeaux |
| Oceaan Bries | Diepblauw, Zeegroen, Schuimwit, Koraalpink, Zandgoud, Aquamarijn |

#### UI per palet
- Naam + thema-emoji
- Kleurcirkels met hex-code label
- Tik op kleur → vergroot weergave met naam en hex
- "Kopieer hex" functionaliteit

---

### 3.5 Sessie (Tab 4)

Timer en tracking voor inkleursessies.

| Feature | Beschrijving |
|---|---|
| Timer | Groot digitaal display (HH:MM:SS), Start / Pauze / Stop knoppen |
| Pauze-herinnering | Zachte notificatie na 30 minuten (instelbaar) — "Tijd voor een pauze!" |
| Notities | Tekstveld om te noteren wat je gekleurd hebt |
| Sessie opslaan | Na stoppen: sessie opgeslagen met datum, duur, notities |
| Sessie-geschiedenis | Lijst van afgelopen sessies (datum, duur, notities) |
| Statistieken | Totale kleurtijd, aantal sessies, gemiddelde sessieduur |

#### Streak-logica
- Een streak-dag telt als er minimaal 1 sessie van ≥5 minuten is voltooid
- Streak reset als er een kalenderdag wordt overgeslagen
- Opgeslagen in localStorage: `{ current, best, lastDate }`

---

### 3.6 Lessen (Tab 5)

20 lessen verdeeld over 5 leerpaden, met gamification.

#### Leerpad-overzicht

**Pad 1: Lijnen & Contouren** (badge: "Lijnmeester")

| Les | Titel | Inhoud |
|---|---|---|
| 1-1 | Basislijnen | Rechte lijnen, curves, golven, zigzag. Houd de stift op dezelfde hoek, begin langzaam. |
| 1-2 | Contouren tekenen | Vormen volgen met een vaste hand. Oefen met cirkels, vierkanten, werk naar complexere vormen. |
| 1-3 | Patronen maken | Herhalende patronen: stippen, strepen, schubben, mandala-elementen. Ritme en regelmaat. |
| 1-4 | Decoratieve randen | Sierlijsten, borders, frames. Combineer geleerde patronen tot decoratieve randen. |

**Pad 2: Kleur & Inkleuren** (badge: "Kleurkenner")

| Les | Titel | Inhoud |
|---|---|---|
| 2-1 | Kleur basics | Kleurencirkel, warme vs koude kleuren, complementaire kleuren. Welke stiften combineer je? |
| 2-2 | Egaal inkleuren | Gelijkmatige dekking: in één richting kleuren, niet te hard drukken, overlappen. |
| 2-3 | Kleurovergangen | Van licht naar donker, gradient effecten. Begin met de lichtste kleur, bouw op. |
| 2-4 | Blending | Kleuren mengen met stiften, overgangseffecten, kleurlagen over elkaar. |

**Pad 3: Licht & Schaduw** (badge: "Schaduwmeester")

| Les | Titel | Inhoud |
|---|---|---|
| 3-1 | Licht begrijpen | Waar komt het licht vandaan? Bepaal een lichtbron, markeer de lichte en donkere zijden. |
| 3-2 | Schaduwen tekenen | Basisschaduw: donkerder aan de achterkant, lichter richting lichtbron. Drukgradiënten. |
| 3-3 | Diepte creëren | Voorgrond/achtergrond, overlapping, grootteperspectief. Hoe maak je iets 3D? |
| 3-4 | Sfeerverlichting | Kaarslichteffect, gouden uur, warm vs koel licht. Kleurkeuze bij lichtbronnen. |

**Pad 4: Cozy Elementen** (badge: "Cozy Creator")

| Les | Titel | Inhoud |
|---|---|---|
| 4-1 | Kopjes & mokken | Warme drankjes tekenen: stoom, reflecties, gezellige details. Kleur en textuur. |
| 4-2 | Kaarsen & lantaarns | Vlam inkleuren, lichtgloed rond kaarsen, wax textuur, warm-koud contrast. |
| 4-3 | Texturen | Breiwerk, hout, stof, bont — hoe suggereer je textuur met stiften? Patronen en druk. |
| 4-4 | Seizoenssfeer | Herfstbladeren, wintersneeuw, lentebloemen. Kleurpaletten per seizoen. |

**Pad 5: Finishing Touches** (badge: "Afwerkmeester")

| Les | Titel | Inhoud |
|---|---|---|
| 5-1 | Accenten plaatsen | Highlights met lichte kleuren, witte accenten (gelpen), details die het verschil maken. |
| 5-2 | Compositie | Balans in je tekening, focal point, waar het oog naartoe gaat. Kleurgewicht verdelen. |
| 5-3 | Stijl ontwikkelen | Experimenteer, meng technieken, vind je eigen voorkeur. Welke combinaties passen bij jou? |
| 5-4 | Het meesterwerk | Alles samenvoegen: gebruik alle geleerde technieken in één kleurplaat. Finale uitdaging. |

#### Les-detailweergave

Elke les opent als een full-screen panel met:

| Element | Beschrijving |
|---|---|
| Titel | Lesnaam met padnummer |
| Theorie | 3-5 alinea's instructietekst over de techniek |
| Tips | 3-5 praktische tips (bullet list) |
| Oefening | Beschrijving van wat je met je eigen stiften en kleurboek oefent |
| Voltooien | "Ik heb geoefend!" knop → opent sterren-beoordeling |
| Sterren | Zelfbeoordeling 1-3 sterren na voltooiing |
| Terug-knop | Terug naar lesoverzicht |

---

### 3.7 Gamification

#### Sterren

- Elke les: zelfbeoordeling van 1-3 sterren na voltooiing
- 1 ster = "Geprobeerd", 2 sterren = "Ging goed", 3 sterren = "Top!"
- Maximaal 60 sterren totaal (20 lessen × 3)
- Sterren kunnen opnieuw behaald worden (herspelen van les verbetert score)

#### Badges

| Badge | Voorwaarde |
|---|---|
| Lijnmeester | Alle 4 lessen van Pad 1 voltooid |
| Kleurkenner | Alle 4 lessen van Pad 2 voltooid |
| Schaduwmeester | Alle 4 lessen van Pad 3 voltooid |
| Cozy Creator | Alle 4 lessen van Pad 4 voltooid |
| Afwerkmeester | Alle 4 lessen van Pad 5 voltooid |

#### Unlock-systeem

- Eerste les van elk pad: altijd beschikbaar
- Volgende les: pas beschikbaar na voltooiing van de vorige les in hetzelfde pad
- Vergrendelde lessen tonen een slot-icoon en grijze styling

#### Streaks

- Dagelijkse streak telt bij minimaal 1 sessie van ≥5 minuten
- Streak-teller toont huidige en beste streak
- Visuele vuuranimatie bij streak ≥7 dagen

#### Cozy Master

- Eindbeloning: "Cozy Master" titel
- Voorwaarde: alle 20 lessen voltooid (minimaal 1 ster per les)
- Speciale visuele badge op dashboard
- Confetti-animatie bij behalen

---

## 4. Data Model (localStorage)

```json
{
  "cozyCompanion": {
    "lessons": {
      "1-1": { "completed": true, "stars": 3 },
      "1-2": { "completed": true, "stars": 2 },
      "1-3": { "completed": false, "stars": 0 }
    },
    "sessions": [
      {
        "date": "2026-02-17",
        "duration": 2400,
        "notes": "Mandala pagina 12"
      }
    ],
    "streak": {
      "current": 5,
      "best": 12,
      "lastDate": "2026-02-17"
    },
    "settings": {
      "volume": 50,
      "muted": false,
      "pauseReminder": 30,
      "activeSounds": ["rain", "fire"]
    }
  }
}
```

---

## 5. Visueel Ontwerp

### 5.1 Design System

Hergebruik van Cozy Draw's warme kleurenpalet:

```css
:root {
  --bg:        #fdf6ec;    /* Crème achtergrond */
  --panel:     #faf0db;    /* Paneel achtergrond */
  --panel-alt: #f5e6c8;    /* Alternatief paneel */
  --border:    #e8d5b5;    /* Zachte randen */
  --text:      #5a4a3a;    /* Warme tekst */
  --accent:    #d4896a;    /* Koraal accent */
  --accent2:   #7eb5a6;    /* Mint accent */
  --shadow:    rgba(90, 74, 58, .12);
  --radius:    14px;
  --star:      #f0c27f;    /* Ster-goud */
  --locked:    #ccc;       /* Vergrendeld grijs */
  --success:   #7eb5a6;    /* Voltooiing groen */
}
```

### 5.2 Typografie

- Font: `'Segoe UI', system-ui, -apple-system, sans-serif` (zelfde als Draw)
- Koppen: `font-weight: 600`
- Body tekst: `0.85rem`, `line-height: 1.6`

### 5.3 Layout

- **Mobile-first**: optimaal op 375-428px breed (telefoon naast kleurboek)
- **Bottom navigation**: 56px hoog, 5 tabs met icoon + label
- **Top bar**: 48px hoog, titel links, mute-knop rechts
- **Content area**: scrollbaar, padding 16px
- **Cards**: `border-radius: 14px`, zachte schaduw, paneel-achtergrond

### 5.4 Animaties

- Tab-wisseling: fade transition (150ms)
- Les-detail: slide-in van rechts (200ms)
- Badge behaald: scale bounce (300ms)
- Cozy Master: confetti-regen (canvas-gebaseerd, 3 seconden)
- Streak-vuur: CSS animated gradient glow
- Ambient particles: zachte floating particles op achtergrond (hergebruik van Draw)

---

## 6. Implementatieplan

### Fase 1: Basis-structuur
1. HTML-structuur met 5 tabs en navigatie
2. CSS design system en responsive layout
3. Tab-navigatie logica
4. localStorage state management

### Fase 2: Ambient Audio
5. Noise-buffer generatie (white, pink, brown)
6. 6 ambient geluiden implementeren (rain, fire, forest, ocean, wind, lo-fi)
7. Mixer met per-kanaal volume + master mute
8. iOS Safari compatibility (user gesture unlock, interrupted state)

### Fase 3: Kleuren & Sessie
9. Kleurpalet-data en UI
10. Sessie-timer met start/pauze/stop
11. Pauze-herinnering
12. Sessie-opslag en geschiedenis

### Fase 4: Lessen & Gamification
13. Lesdata (20 lessen, volledige instructietekst)
14. Les-overzicht UI met lock/unlock states
15. Les-detailweergave
16. Sterren-beoordeling systeem
17. Badge-systeem
18. Streak-tracking
19. Cozy Master eindbeloning

### Fase 5: Afronding
20. Dashboard met voortgangsoverzicht
21. Cross-app navigatie (Draw ↔ Companion)
22. Service worker + manifest updaten
23. Ambient particles achtergrond
24. Testen op mobiel (touch, iOS Safari)

---

## 7. Acceptatiecriteria

- [ ] App opent als standalone HTML bestand zonder server/build
- [ ] 5 tabs navigeerbaar via bottom bar
- [ ] Mute-knop altijd zichtbaar en werkend
- [ ] 6 ambient geluiden individueel schakelbaar en layerbaar
- [ ] 8 kleurpaletten toonbaar met hex-codes
- [ ] Sessie-timer start/pauze/stop met opslag
- [ ] 20 lessen leesbaar met theorie, tips en oefening
- [ ] Unlock-systeem: les pas beschikbaar na vorige
- [ ] Sterren (1-3) toekenbaar per les
- [ ] 5 badges uitreikbaar bij pad-voltooiing
- [ ] Streak-tracking over dagen heen
- [ ] Cozy Master titel bij 20/20 lessen
- [ ] Dashboard toont alle voortgang
- [ ] Werkt offline (PWA)
- [ ] Responsief op mobiel (375px+)
- [ ] Geen externe dependencies
