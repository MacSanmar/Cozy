# PRD: Cozy Drawing Companion App

## Vision
Een web app die je begeleidt terwijl je op papier cozy drawings maakt en inkleurt. De app is je persoonlijke tekencoach: ze biedt stapsgewijze lessen, houdt je voortgang bij, en maakt het leerproces leuk door gamification.

**Kernidee:** Je tekent/kleurt op papier → de app leert je technieken, geeft tips, en beloont je progressie.

---

## Doelgroep
- Volwassenen die cozy/relaxed tekeningen maken als hobby
- Beginners tot gevorderden
- Primair mobiel/tablet gebruik (naast je tekenpapier)

---

## 20 Lessen — Overzicht

Georganiseerd in **5 leerpaden** (topics) met elk **4 lessen** van beginner → gevorderd.

### 🌿 Leerpad 1: Lijnen & Contouren
| Les | Niveau | Titel | Inhoud |
|-----|--------|-------|--------|
| 1 | ⭐ | Eerste Lijnen | Basislijnvoering: rechte lijnen, bogen, eenvoudige vormen |
| 2 | ⭐⭐ | Vloeiende Contouren | Doorlopende lijnen tekenen zonder te stoppen, flow oefenen |
| 3 | ⭐⭐⭐ | Lijndikte & Expressie | Variatie in lijndikte voor diepte en karakter |
| 4 | ⭐⭐⭐⭐ | Details & Patronen | Fijne details, decoratieve patronen in contouren |

### 🎨 Leerpad 2: Kleur & Inkleuren
| Les | Niveau | Titel | Inhoud |
|-----|--------|-------|--------|
| 5 | ⭐ | Kleur Basics | Kleurencirkel, warme vs koude kleuren kiezen |
| 6 | ⭐⭐ | Egaal Inkleuren | Technieken voor gelijkmatig inkleuren zonder strepen |
| 7 | ⭐⭐⭐ | Kleurcombinaties | Complementaire kleuren, harmonie, sfeer creëren |
| 8 | ⭐⭐⭐⭐ | Blending & Overgangen | Zachte kleurovergangen en mengtechnieken |

### 💡 Leerpad 3: Licht & Schaduw
| Les | Niveau | Titel | Inhoud |
|-----|--------|-------|--------|
| 9 | ⭐ | Licht Begrijpen | Waar komt het licht vandaan? Basis licht/donker |
| 10 | ⭐⭐ | Eenvoudige Schaduwen | Schaduwen toevoegen aan simpele vormen |
| 11 | ⭐⭐⭐ | Diepte Creëren | Meerdere schaduwlagen, 3D-effect |
| 12 | ⭐⭐⭐⭐ | Sfeerverlichting | Kaarslicht, zonlicht, magisch licht - sfeer met schaduw |

### 🏡 Leerpad 4: Cozy Elementen
| Les | Niveau | Titel | Inhoud |
|-----|--------|-------|--------|
| 13 | ⭐ | Simpele Cozy Items | Kopjes, kaarsen, blaadjes - basisvormen |
| 14 | ⭐⭐ | Texturen Tekenen | Hout, stof, breigoed - materialen suggereren |
| 15 | ⭐⭐⭐ | Cozy Scènes Opbouwen | Composities: een hoekje, een raam, een tafel |
| 16 | ⭐⭐⭐⭐ | Seizoenen & Sfeer | Herfst, winter, lente, zomer - sfeer vastleggen |

### ✨ Leerpad 5: Finishing Touches
| Les | Niveau | Titel | Inhoud |
|-----|--------|-------|--------|
| 17 | ⭐ | Accenten & Highlights | Witte accenten, glans, lichtpuntjes toevoegen |
| 18 | ⭐⭐ | Achtergronden | Eenvoudige achtergronden die de tekening versterken |
| 19 | ⭐⭐⭐ | Lettering & Tekst | Cozy teksten en quotes toevoegen aan je tekening |
| 20 | ⭐⭐⭐⭐ | Meesterwerk | Alle technieken combineren in één complete cozy tekening |

---

## Lesstructuur (per les)

Elke les heeft **dezelfde opbouw**:

```
1. 📖 Introductie        — Korte uitleg wat je gaat leren (tekst + voorbeeldafbeelding)
2. 🎯 Doel               — Wat je aan het eind kunt ("Na deze les kun je...")
3. 📝 Stap-voor-stap     — 3-5 concrete stappen met visuele voorbeelden
4. 💡 Tips               — 2-3 praktische tips
5. 🏋️ Oefening           — Opdracht om op papier te doen
6. ✅ Klaar!             — Markeer als voltooid, verdien beloning
```

---

## Gamification Systeem

### Progressie per Leerpad
- Elk leerpad toont een **voortgangsbalk** (0/4 → 4/4 lessen)
- Leerpad krijgt een **badge** als alle 4 lessen zijn afgerond
- Visuele status: 🔒 Locked → 🟡 In Progress → 🟢 Completed

### Unlock Systeem
- Leerpad 1 les 1 is altijd open
- Volgende les in een leerpad unlockt na voltooien vorige les
- Leerpaden zelf zijn onafhankelijk: je kunt in meerdere leerpaden tegelijk werken
- Les 20 (Meesterwerk) unlockt pas als minstens **3 van de 4** leerpaden volledig zijn afgerond

### Beloningen
| Actie | Beloning |
|-------|----------|
| Les voltooid | ⭐ Ster + korte animatie |
| Leerpad voltooid (4/4) | 🏆 Badge van dat leerpad |
| 3 lessen op één dag | 🔥 Streak-bonus |
| Alle 20 lessen klaar | 👑 Cozy Master titel |
| 7 dagen achter elkaar actief | 📅 Weekstreak |

### Profiel / Dashboard
- Overzicht van alle leerpaden + progressie
- Totaal sterren verzameld
- Badges vitrine
- Streak-teller
- "Volgende aanbevolen les" suggestie

---

## Technische Specificaties

### Platform
- **Mobile-first** responsive web app (PWA)
- Werkt offline (alle content lokaal)
- Geen account nodig — progressie in localStorage
- Geen externe dependencies — vanilla HTML/CSS/JS

### Data Opslag
- `localStorage` voor:
  - Voltooide lessen
  - Verdiende badges & sterren
  - Streak data (datums)
  - Actief leerpad

### Pagina's / Views
1. **Dashboard** — Overzicht leerpaden, progressie, badges
2. **Leerpad overzicht** — 4 lessen van dat pad, status per les
3. **Les view** — De les zelf (stap-voor-stap)
4. **Profiel** — Badges, sterren, streaks

### Navigatie
- Eenvoudige tab-navigatie onderin (Dashboard | Leerpaden | Profiel)
- Back-knop in les/leerpad views
- Smooth transitions tussen views

### Stijl & Sfeer
- Warm, cozy kleurenpalet (beige, warm bruin, zacht groen, roze accenten)
- Afgeronde hoeken, zachte schaduwen
- Handgetekende/schetsmatige UI-elementen
- Subtiele animaties bij beloningen
- Font: warm en leesbaar (bijv. rounded sans-serif)

---

## Integratie met Bestaande App

De huidige `index.html` is een **tekenapp** (digitaal tekenen op canvas). De nieuwe companion app is een apart concept (begeleiding bij fysiek tekenen op papier).

### Aanpak
- De companion app wordt de **nieuwe hoofdpagina** (`index.html`)
- De bestaande digitale tekenapp verhuist naar `draw.html`
- Link vanuit de companion app naar de digitale tekenapp ("Wil je digitaal oefenen?")
- Gedeelde PWA-wrapper (één manifest, één service worker)

---

## Scope & Prioriteiten

### MVP (v1)
- [ ] Dashboard met 5 leerpaden
- [ ] Alle 20 lessen met tekst-content
- [ ] Unlock systeem (lineair per leerpad)
- [ ] Les voltooien + sterren
- [ ] Leerpad badges
- [ ] localStorage persistentie
- [ ] Offline werking (PWA)
- [ ] Mobile-first responsive design

### v2 (nice-to-have)
- [ ] Streak systeem
- [ ] Animaties bij beloningen
- [ ] Link naar digitale tekenapp
- [ ] Gedetailleerdere visuele voorbeelden per les
- [ ] Print-vriendelijke oefenbladen

---

## Succescriteria
1. Gebruiker kan zelfstandig door lessen navigeren terwijl ze op papier tekent
2. Progressie wordt bewaard tussen sessies
3. Gamification motiveert om door te gaan met lessen
4. App werkt volledig offline
5. Laadt snel en voelt responsief aan op telefoon/tablet
