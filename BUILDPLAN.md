# Bouwplan: Cozy Color Companion

## Probleem
Het schrijven van companion.html als één groot bestand (~1500+ regels) loopt vast.

## Oplossing
Verdeel het bouwen in **8 kleine stappen**. Elke stap produceert een werkend bestand dat incrementeel groeit.

---

## Stap 1: Skelet + Navigatie
**Output**: companion.html met werkende tab-navigatie, top bar met mute-knop, bottom nav.
**Inhoud**: HTML structuur, CSS design system, tab-switching JS.
**Geen**: Nog geen audio, data, of functionaliteit.
**~200 regels**

## Stap 2: Ambient Audio Engine
**Toevoegen aan**: companion.html
**Inhoud**: Noise buffers, 6 geluiden, mixer, mute-knop werkt.
**~200 regels JS erbij**

## Stap 3: Kleurpaletten
**Toevoegen aan**: companion.html
**Inhoud**: 8 paletten data + render in Kleuren-tab.
**~100 regels erbij**

## Stap 4: Sessie Timer
**Toevoegen aan**: companion.html
**Inhoud**: Timer UI, start/pauze/stop, pauze-herinnering, sessie opslaan.
**~120 regels erbij**

## Stap 5: Lesdata + Lesoverzicht
**Toevoegen aan**: companion.html
**Inhoud**: 20 lessen data-objecten, pad-overzicht UI, lock/unlock states.
**~300 regels erbij**

## Stap 6: Les Detail + Sterren
**Toevoegen aan**: companion.html
**Inhoud**: Les-detail panel, sterren-beoordeling, les voltooien.
**~150 regels erbij**

## Stap 7: Dashboard + Gamification
**Toevoegen aan**: companion.html
**Inhoud**: Dashboard renders, badges, streaks, Cozy Master.
**~150 regels erbij**

## Stap 8: Afronding
**Bestanden**: sw.js, manifest.json, index.html (link toevoegen)
**Inhoud**: Service worker update, cross-app navigatie, commit + push.
**~50 regels aanpassingen**

---

## Totaal: 8 concrete commits, elk beheersbaar.
