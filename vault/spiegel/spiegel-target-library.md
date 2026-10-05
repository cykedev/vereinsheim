---
id: spiegel-target-library
type: concept
title: "Spiegel — Scheibenbilder, Disziplinen und Wertung"
aliases: [scheibenbilder, scheiben-setups, target-library, wertungsformel]
keywords: [scheibenbild, scheibe, ringdurchmesser, ringabstand, spiegel, innenzehner, kaliber, messlehre, zehntelwertung, abschneiden, teiler, disziplinid, regelnummer, dsb-sportordnung, issf, luftgewehr, luftpistole, kk, zimmerstutzen, 25m pistole, duell, schnellfeuer, gegenprobe, preisscheibe]
part_of: ["[[spiegel]]"]
documented_in: ["[[src-meyton-recherche-2026-10]]", "[[src-meyton-live-display]]"]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-data-model]]"]
---

**TL;DR** Jede Disziplin braucht ein Scheibenbild als reine Daten (Ringe, Spiegel, Innenzehner, Ringabstand, Kaliber). Die Kette lautet DisziplinID → Regelnummer → Disziplin → Scheibenbild je Stellung. Mit Scheibenbild und Kaliber rechnet Spiegel jeden Zehntelwert aus x/y nach; am echten Meyton-Ausdruck stimmen alle geprüften Werte.

## Bibliothek für Version 1

Der Verein hat nur 10-m-Stände (Luftgewehr und Luftpistole, jeweils auch Auflage); Version 1 braucht deshalb nur die ersten beiden Zeilen, der Rest ist Referenz für später und für andere Vereine. Maße in mm nach DSB-Sportordnung 2026 (Teil 0, Anhang 0.20), gleich ISSF 2026. Die Ringe haben gleiche Abstände: Ø(n) = Ø10 + 2 · Ringabstand · (10 − n).

| Scheibe | Ø 10 | Innenzehner | Ringabstand | Ø außen | Spiegel (schwarz) | Kaliber |
|---|---|---|---|---|---|---|
| Luftgewehr 10 m | 0,5 (Punkt) | Punkt weg (≥ 10,2) | 2,5 | 45,5 | 30,5 (Ringe 4–9) | 4,5 |
| Luftpistole 10 m | 11,5 | 5,0 | 8,0 | 155,5 | 59,5 (7–10) | 4,5 |
| KK 50 m | 10,4 | 5,0 | 8,0 | 154,4 | 112,4 (in Ring 3) | 5,6 |
| Zimmerstutzen 15 m | 4,5 | – | 4,5 | 85,5 | 40,5 (6–10) | 4,65 |
| 25 m Präzision, 50 m Pistole, 100 m | 50 | 25 | 25 | 500 | 200 (7–10) | je Waffe |
| 25 m Duell, Schnellfeuer | 100 | 50 | 40 | 500 (Ring 5) | nur Ringe 5–10 | je Waffe |
| 300 m Gewehr | 100 | 50 | 50 | 1000 | 600 (5–10) | je Patrone |

Später: Laufende Scheibe, Armbrust 10 m/30 m, Preis- und Spaßscheiben (zum Beispiel „Schach 10“).

## Scheibenbild als Daten

```json
{
  "id": "issf-10m-luftpistole", "version": 1,
  "ringDiametersMm": [155.5, 139.5, 123.5, 107.5, 91.5, 75.5, 59.5, 43.5, 27.5, 11.5],
  "innerTenDiameterMm": 5.0,
  "blackFromRing": 7,
  "ringWidthMm": 8.0,
  "gaugeMm": 4.5,
  "decimal": { "max": 10.9, "rounding": "truncate" },
  "labels": { "rings": [1, 2, 3, 4, 5, 6, 7, 8] }
}
```

Gezeichnet wird daraus eine SVG-Scheibe (Papier, Spiegel, Ringlinien, Ringzahlen), Treffer in echter Kalibergröße.

## Von der DisziplinID zum Scheibenbild

- Die achtstellige DisziplinID kodiert Entfernung, Regelnummer und Schusszahl ([[meyton-ssmdb2]]). Beispiele: LG 40 = `10110040`, LP 40 = `10210040`, KK 60 liegend = `40180060`, ZS 30 = `20130030`.
- Die Ziffern 2–5 sind nur bei DSB-Disziplinen die DSB-Regel. Training, Liga und ISSF nutzen Meyton-eigene Nummern (zum Beispiel `11010010` „LG Probe + 10 Wertung“, `10510040` „LG Liga“). Der Regelkatalog kennt beide Arten.
- **Je Stellung ein Scheibenbild:** bei der 25-m-Pistole ist Stellung 1 die Präzisions-, Stellung 2 die Duellscheibe.
- Die SSMDB2 enthält keine Geometrie; auch Meyton rät zu einer eigenen Tabelle. Für eigene Disziplin-Varianten des Vereins (zum Beispiel „LP 40 alt“) greift ein Rückfall: Entfernung 10 m plus Namensanfang LG oder LP. Für alles andere, etwa Preisscheiben, ordnet ein Admin den Disziplinnamen einem Scheibenbild zu.
- Ob ganz oder zehntel gewertet wird, steht je Treffer im Feld `Wertung` (seit ShootMaster 5.2).

## Wertung

Meyton wertet über den inneren Trefferrand, rechnet auf 1/100 mm und schneidet Nachkommastellen zugunsten des Schützen ab:

> Zehntel = 10 + (Zehnerradius + halbes Kaliber − Abstand) ÷ Ringabstand, auf eine Stelle abgeschnitten, höchstens 10,9. Ganzring = abgeschnittener Zehntelwert; unter 1 ist ein Fehlschuss.

Bei Luftgewehr, Luftpistole und KK ergibt Zehnerradius plus halbes Kaliber genau einen Ringabstand (Luftpistole 5,75 + 2,25 = 8 mm); dann vereinfacht sich die Formel zu „11 − Abstand ÷ Ringabstand“. Innenzehner ist ein Schuss bis Innenzehnerradius plus halbes Kaliber (Luftpistole 2,5 + 2,25 = 4,75 mm, also ab 10,4).

Der **Teiler** ist der Abstand Schussmitte zu Scheibenmitte in 1/100 mm. Einen Teilerfaktor für die Luftpistole kennt die Sportordnung nicht; er steht in der jeweiligen Ausschreibung (üblich: LP-Teiler ÷ 2,6 bis 3,0). Spiegel speichert den rohen Teiler und rechnet Faktoren nur in der Ansicht.

## Gegenprobe

Spiegel rechnet den Zehntelwert jedes Schusses aus x/y nach. Weicht er vom Meyton-Wert ab, ist das Scheibenbild falsch oder die Achsen sind vertauscht. Am Meyton-Ausdruck vom 2. Oktober 2026 (Luftpistole, [[meyton-printout]]) stimmen alle sechs Teiler mit Schussnummer:

| Schuss | Teiler | 11 − Abstand ÷ 8 | Wert im Ausdruck |
|---|---|---|---|
| 8 | 331,8 | 10,585 | 10,5* ✓ |
| 2 | 396,4 | 10,505 | 10,5* ✓ |
| 15 | 547,4 | 10,316 | 10,3 ✓ |
| 23 | 2656 | 7,680 | 7,6 ✓ |
| 5 | 3369 | 6,789 | 6,7 ✓ |
| 27 | 3831 | 6,211 | 6,2 ✓ |

Diese Werte sind die ersten Testfälle für `packages/shot-core` (SP-1.1).
