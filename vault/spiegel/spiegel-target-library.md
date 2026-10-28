---
id: spiegel-target-library
type: concept
title: "Spiegel — Scheibenbilder, Disziplinen und Wertung"
aliases: [scheibenbilder, scheiben-setups, target-library, wertungsformel]
keywords: [scheibenbild, scheibe, ringdurchmesser, ringabstand, spiegel, innenzehner, kaliber, messlehre, zehntelwertung, abschneiden, teiler, disziplinid, regelnummer, dsb-sportordnung, issf, luftgewehr, luftpistole, kk, zimmerstutzen, 25m pistole, duell, schnellfeuer, gegenprobe, preisscheibe, shot-core, katalog, regelkollision, schusscode, disziplin-familie, neu werten, falsche disziplin, scheibenbild erkennen, offene schusszahl]
part_of: ["[[spiegel]]"]
documented_in: ["[[src-meyton-recherche-2026-10]]", "[[src-meyton-live-display]]", "[[src-meyton-disziplin-erstellen]]"]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-data-model]]", "[[spiegel-edge-cases]]"]
---

**TL;DR** Jede Disziplin braucht ein Scheibenbild als reine Daten (Ringe, Spiegel, Innenzehner, Ringabstand, Kaliber). Die Kette lautet DisziplinID (Regelnummer und Schusscode) → Scheibenbild, mit Admin-Zuordnung vorneweg und dem Namen als Rückfall. Mit Scheibenbild und Kaliber rechnet Spiegel jeden Zehntelwert aus x/y nach; am echten Meyton-Ausdruck stimmen alle geprüften Werte.

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

- Die achtstellige DisziplinID kodiert Entfernung, Regelnummer und Schusscode ([[meyton-ssmdb2]]). Beispiele: LG 40 = `10110040`, LP 40 = `10210040`, „LP 40 alt“ = `19210040`, KK 60 liegend = `40180060`. Meytons Standardlisten stehen im Handbuch „Disziplin erstellen“ ([[src-meyton-disziplin-erstellen]]).
- **Die Regelnummer allein ist nicht eindeutig (SF-70):** `10610040` ist „LP Liga“, `10610220` „ISSF AR Men Final“; `10100040` ist die französische Luftpistole, obwohl DSB-Regeln 01.xx Gewehre sind. Spiegel prüft deshalb Regelnummer **und** Schusscode und nie Regelbereiche allein.
- **Auflösung in fester Reihenfolge:**
  1. Admin-Zuordnung für DisziplinID und Name der Anlage, auch „ohne Scheibe“ für eine vereinseigene Disziplin mit eigener Scheibe (ADR-029). Bedienbar unter Admin → Disziplinen: Scheibe, Familie, Wertung (Vorgabe für Training und Wettkampf), Schusszahl, Serienlänge und Ignorieren. Dort legt der Admin auch Disziplinen ohne Meyton-ID an („Neue Disziplin“, `createDiscipline`: Name je Anlage eindeutig, Familie und Scheibe Pflicht, gleich eingeordnet), für Scheiben von Hand, von fremden Anlagen und aus Treffsicher ([[adr-033]], 1d). Das Einlesen legt eine neue Disziplin jederzeit selbst an, mit dem Vorschlag aus den Schritten 2 bis 4 (oder der Zuordnung einer eingeordneten Disziplin derselben Nummer, wenn Meyton sie umbenannt hat); eingeordnet ist sie erst, wenn ein Admin sie prüft (`confirmedAt`). Ändern sich Scheibe oder Schusszahl, rechnet Spiegel die vorhandenen Scheiben aus den gespeicherten Schüssen nach (`refreshStaleDisciplineCards`).
  2. Katalog für 10 m (genaue Nummern, keine Bereiche). Luftgewehr: 0110, 0111 (Auflage), 0120, 0193, 0194, 0195, Liga 0510, 0520, 0530, 0531, 0540, 0550, ISSF 0710–0713, Training 1009–1018 (mit den Teiler- und verdeckten Varianten), alt 9110. Luftpistole: 0210, 0211 (Auflage), Liga 0610, 0620, 0630, 0631, 0640, 0650, ISSF 0810–0813, Training 1109–1117, alt 9210. ISSF-Finale: 0610–0617 nur mit Schusscode 220 (gerade Luftgewehr, ungerade Luftpistole). Bekannte Disziplinen mit eigener Scheibe bleiben unbekannt, statt über den Namen auf die Standardscheibe zu fallen: Kyffhäuser (1062), 12-kreisig (1064), Löwenbräu-Finale (7401, 7402) und LP5 (0216, DSB 2.16 mit Fallscheibe).
  3. Name: ganzes Wort LG oder Luftgewehr bzw. LP, LP5 oder Luftpistole; kommt beides oder keines vor, bleibt es offen. Kein Namens-Rückfall, wenn die ID eine andere Entfernung nennt.
  4. Unbekannt: Spiegel schlägt das Scheibenbild vor, das alle amtlichen Zehntelwerte erklärt, und ein Admin bestätigt. Bis dahin zeigt Spiegel die Treffer auf einem neutralen Raster mit dem Merkmal `disziplin-unbekannt` (SF-17).
- **Je Stellung ein Scheibenbild:** bei der 25-m-Pistole ist Stellung 1 die Präzisions-, Stellung 2 die Duellscheibe. Für 10 m gilt dasselbe Bild für alle Stellungen.
- **Der Schusscode ist nur ein Hinweis (SF-09):** Eine Schusszahl des Admins geht vor (`plannedShotsOf`: null aus der ID, 0 keine feste, sonst die Zahl), etwa „Kranzl LG“ mit Code 020 und drei Schüssen. `000` heißt offen (Meytons „LG/LP Training Spiegel“), `001`–`100` sind geplante Wertungsschüsse. Über 100 gibt es keinen verlässlichen Hinweis: Bei 10 m stehen dort Varianten-Codes (220 Finale, 240 Liga Bayern), anderswo auch echte Zahlen (120 bei ISSF 3x40). Gegen die Schusszahl zählen nur Wertungsschüsse. Offen (SP-0.6): ob „Training Spiegel“ in Ringen wertet oder mit Meytons Trainingsscheibe nur Treffer zählt; bis dahin zeichnet Spiegel sie auf der Standardscheibe.
- **Familien:** Jede Disziplin gehört zu einer Familie, in der Verläufe zusammen laufen (LG oder LP, Freihand oder Auflage). Auflage kommt aus der Regel (0111, 0211) oder dem Namen; Spiegel schlägt vor, der Admin bestätigt (SF-64).
- Ob ganz oder zehntel gewertet wird, steht je Treffer im Feld `Wertung` (seit ShootMaster 5.2). Zehntel rechnet Spiegel immer, auch bei Ganzring-Disziplinen; Ringe und Zehntel sind getrennte Kennzahlen (SF-18).

## Wertung

Meyton wertet über den inneren Trefferrand und schneidet Nachkommastellen zugunsten des Schützen ab. Laut eigener Angabe misst Meyton auf 1/100 mm; der Teiler hat aber eine bzw. zwei Nachkommastellen davon. Lage und genauer Abstand ergeben an 640 Schüssen nahe und fern jeder Grenze dasselbe (9. Oktober 2026). **Meyton legt jede Grenze 10 µm großzügiger als die Regel:** Ein Schuss erreicht einen Wert, wenn sein Abstand unter Grenze + 10 µm liegt, beim Innenzehner ebenso. So stimmen 43 000 von 43 000 Schüssen der Vereinsanlage aus zwei Jahren, Luftgewehr wie Luftpistole; nach der reinen Regel lägen gut 3 % ein Zehntel zu tief (SF-75, [[src-ssmdb2-kopie-2026-10-09]]).

> Zehntel = 10 + (Zehnerradius + halbes Kaliber − Abstand) ÷ Ringabstand, auf eine Stelle abgeschnitten, höchstens 10,9. Ganzring = abgeschnittener Zehntelwert; unter 1 ist ein Fehlschuss.

Bei Luftgewehr, Luftpistole und KK ergibt Zehnerradius plus halbes Kaliber genau einen Ringabstand (Luftpistole 5,75 + 2,25 = 8 mm); dann vereinfacht sich die Formel zu „11 − Abstand ÷ Ringabstand“. Innenzehner ist ein Schuss bis Innenzehnerradius plus halbes Kaliber (Luftpistole 2,5 + 2,25 = 4,75 mm, also ab 10,4).

Der **Teiler** ist der Abstand Schussmitte zu Scheibenmitte in 1/100 mm. Einen Teilerfaktor für die Luftpistole kennt die Sportordnung nicht; er steht in der jeweiligen Ausschreibung (üblich: LP-Teiler ÷ 2,6 bis 3,0). Spiegel speichert den rohen Teiler und rechnet Faktoren nur in der Ansicht.

**Neu werten:** Lage und Abstand hängen nicht vom Scheibenbild ab; Spiegel nimmt den Abstand aus dem Teiler, aus dem Meyton selbst wertet (Meyton rechnet ihn aus der Lage auf 1/100 mm und speichert ihn auf 0,1 µm), sonst die Lage. War am Stand die falsche Disziplin gewählt, wertet Spiegel die Scheibe mit dem richtigen Bild neu; die Werte sind dann nicht amtlich und tragen das Merkmal `neu-gewertet` (SF-16). Gebaut ist der Teil mit demselben Bild: Der Schütze wählt an der Scheibe eine andere Disziplin derselben Scheibe (Auflage statt Freihand, andere Schusszahl), Werte und Lage bleiben ([[spiegel-navigation]] „Disziplin einer Scheibe“). Das Neu-Werten mit einem anderen Bild ist offen.

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

## Umsetzung

`packages/shot-core` setzt diese Note um: Scheibenbilder über `defineTarget` in ganzen µm, die Wertung aus Lage oder Abstand, die Auflösung der DisziplinID und die Gegenprobe. Gerechnet wird exakt und ganzzahlig: Die Zehntelgrenzen b(k) = R + 10 µm − (k − 100) · W ÷ 10 liegen auf ganzen µm, verglichen wird strikt (`MEYTON_TOLERANCE_UM`). Die naive Gleitkomma-Formel `floor((11 − d ÷ W) · 10)` liegt an neun Grenzen je Scheibe einen Zehntel zu tief, etwa bei d = 63,2 mm auf der Luftpistole. Die Gegenprobe zählt einen Nachbarwert als Grenzfall, wenn er innerhalb der Messauflösung erreichbar ist (Lage 1/100 mm, Teiler 1/10 davon).
