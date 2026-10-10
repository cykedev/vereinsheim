---
id: spiegel-metrics
type: concept
title: "Spiegel — Kennzahlen, Verläufe und Vergleiche"
aliases: [kennzahlen, metrics, kennzahlen-registry, verläufe, vergleiche]
keywords: [kennzahl, metric, registry, selectshots, shotsteps, sigma, zehnerquote, tempo-streuung, dauer, eligibleshots, inshotorder, onmissing, abgabefolge, platzhalter, inscoring, counterpart, ganze ringe, zehntel, umschalten, metricshot, computemetric, extremespread, segmentgroups, definemetric, schwerpunkt, mpi, streukreis, kleinster kreis, welzl, mittlerer radius, streuung, ellipse, teiler, intervall, tempo, ermüdung, verlauf, trend, rekord, bestleistung, vergleich, baseline, 30-tage-schnitt, beobachtung, insight, trefferkreis, trefferlage, nur probe, je schuss, r50, median, mindestzahl, ausreißer, visier verstellt, disziplin-familie]
part_of: ["[[spiegel]]"]
relates_to: ["[[statistics-visualization]]", "[[spiegel-data-model]]", "[[spiegel-ui-design]]", "[[spiegel-edge-cases]]"]
---

**TL;DR** Jede Kennzahl ist eine reine, versionierte Funktion mit Einheit, Richtung (besser höher oder niedriger) und Ebenen (Serie, Scheibe; je Schuss zeigt die Schusstabelle die Rohwerte). Daraus ergeben sich ohne weiteren Code die Kachel in der Session, die Spalte im Serienvergleich, der Verlauf über Monate, der direkte Vergleich und der Rekord.

## Registry

```ts
defineMetric({
  key: "group.enclosingDiameter",
  label: "Streukreis",
  unit: "mm",
  decimals: 1,
  scopes: ["series", "card"],
  better: "lower",
  version: 1,
  appliesTo: ["match", "probe"], // Ergebnisse nur "match"
  minShots: 3,                   // darunter kein Wert
  nSensitive: true,              // hängt von der Schusszahl ab
  excludeMisses: false,          // zeigt Fehlschüsse; R50 lässt sie weg
  needs: "position",             // Schüsse ohne Lage zählen nicht
  onMissing: "drop",             // Summen dagegen: "null"
  compute: (shots) => {
    const circle = smallestEnclosingCircle(points(shots))
    return circle === null ? null : (2 * circle.radiusUm) / 1000
  },
})
```

`appliesTo`, `minShots`, `nSensitive`, `excludeMisses`, `needs` und `onMissing` kommen aus dem Sonderfall-Katalog: Sie steuern, ob eine Probe-Scheibe einen Wert bekommt, ab wann er gilt, ob ein Vergleich gleich viele Schüsse braucht und was mit Ausreißern und fehlenden Angaben geschieht. Eine neue Kennzahl ist eine Funktion plus Test. Ändert sich eine Formel, steigt die Version, und Spiegel rechnet die gespeicherten Werte neu ([[spiegel-ingest-pipeline]]). Die Funktionen liegen in `packages/shot-core` und laufen auf Server und Client.

## Kennzahlen für den Anfang

| Gruppe | Kennzahlen |
|---|---|
| Ergebnis | Ringe, Zehntel, Ø je Schuss, Zehner, Innenzehner, bester Teiler, Streuung der Serienergebnisse |
| Trefferbild | Schwerpunkt x/y, Schwerpunkt-Abstand, Streukreis (kleinster Kreis um alle Treffer), R50, Präzision σ, Streuung x/y, Streu-Ellipse (Achsen, Winkel) |
| Zeit | Dauer, Tempo (Median der Intervalle), Tempo-Konstanz, Pausen, Zeit bis zum ersten Wertungsschuss |
| Verlauf in der Einheit | Ermüdung (letzte gegen erste zehn), erster Wertungsschuss nach der Probe, Wanderung des Schwerpunkts zwischen den Serien |
| ~~Probe gegen Wertung~~ | entfiel mit U4: keine Probe neben Wertung (wie am Ausdruck) |

Meyton druckt eigene Streumaße: **Trefferkreis** und **Trefferlage**, gesamt und je Serie ([[meyton-printout]]). Spiegel zeigt sie daneben und klärt an den Rohdaten, ob „Trefferkreis“ der kleinste Kreis um alle Treffer oder der größte Abstand zweier Treffer ist.

## Verläufe

- Jede Kennzahl über die Zeit. **Disziplin-Familie ist Pflichtfilter** (wie in Treffsicher nie gemischte Disziplinen, [[statistics-visualization]]; die Familie fasst Varianten wie „LP 40“ und „LP 40 alt“ zusammen).
- Zeitraum, Training oder Wettkampf (automatisch aus Meyton: Status, Starterliste), Wert je Scheibe, Woche oder Monat, gleitender Schnitt.
- Marker für Ereignisse („neuer Griff“, „neues Munitionslos“).
- Rekorde fallen nebenbei ab: beste Scheibe, beste Serie, bester Teiler, engster Streukreis; nur aus vollständigen Wertungsserien (SF-66).

## Direkte Vergleiche

- Serie gegen Serie, Scheibe gegen Scheibe, Zeitraum gegen Zeitraum, Merkmal A gegen B (braucht Tags), gegen den eigenen Schnitt.
- Schütze gegen Schütze nur mit beidseitiger Freigabe.
- **Gleiche Schusszahl:** ein Streukreis über 40 Schuss ist fast immer größer als über 10; Vergleiche nutzen deshalb gleich lange Ausschnitte oder Maße, die kaum von der Schusszahl abhängen (siehe unten).
- Darstellung: beide Gruppen auf einer Scheibe (zwei feste, farbenblind geprüfte Farben), daneben eine Tabelle mit Differenz und „besser/schlechter“ je nach Richtung der Kennzahl.

## Vergleichbarkeit und Robustheit

Die Regeln aus dem Sonderfall-Katalog ([[spiegel-edge-cases]]), die jede Kennzahl beachten muss:

- **Wie am Ausdruck, Probe als Training.** Eine Scheibe mit Wertung rechnet nur über die Wertung, eine Scheibe nur mit Probe auf der Scheibe wie Wertung, auch mit Ergebnis je Serie und gesamt (`asOnPrintout` im Fachkern, U4; User, 8. Oktober 2026). Verläufe und Rekorde zeigen sie nur mit dem Schalter „Probe einbeziehen“ (SF-01).
- **Je Schuss statt Summe:** Ringe und Zehntel laufen im Verlauf als Ø je Schuss; Summen nur für vollständige Scheiben (SF-07).
- **Streumaße hängen an der Schusszahl.** Der Streukreis wird mit jedem Schuss größer oder bleibt gleich, R50 fällt bei kleinem n leicht zu klein aus (bei 10 Schuss etwa 4 %). Für Verläufe über unterschiedliche Schusszahlen zählt deshalb σ̂ (Rayleigh-σ, kaum n-abhängig); die anderen nur bei gleichem n (SF-60).
- **Mindestzahl:** Jede Kennzahl nennt, ab wie vielen Schüssen sie gilt (Streukreis ab 3, Form ab 3 und ihr Winkel ab 10, R50 ab 5). Darunter steht kein Wert, nicht 0 (SF-61).
- **Ausreißer:** Fehlschüsse sind markiert. Robuste Maße (R50) und der Gruppen-Zoom lassen sie weg; Streukreis und Streuung zeigen sie (SF-14).
- **Verdächtige Schüsse** (Platzhalter, Handeintrag) zählen nur mit ihrem amtlichen Wert zum Ergebnis. In Lage, Abstand und Tempo fehlen sie, sie geben keinen Teiler-Rekord und werden nicht gezeichnet (SF-15). Ob eine Scheibe mit Platzhalter für Scheiben-Rekorde zählt, entscheidet SP-2.1.
- **Fehlende Angaben:** Ein Schuss ohne die nötige Angabe fällt weg. Summen und Zählungen geben dann keinen Wert, denn eine Summe über einen Teil der Schüsse ist kein Ergebnis.
- **Reihenfolge:** Es zählt die Abgabefolge, nicht die Uhr; springt die Uhr zurück oder fehlt ein Schuss mitten in der Folge, zählt der Abstand daneben nicht als Tempo (SF-30).
- **Visier verstellt:** Verstellt jemand in der Probe oder zwischen Serien das Visier, springt der Schwerpunkt mit Absicht. Spiegel fragt Verstellungen nicht ab (User, 8. Oktober 2026); den Versatz Probe → Wertung gibt es seit U4 nicht mehr (SF-63).
- **Tempo:** Median der Intervalle; Pausen zählen getrennt (SF-62). Pause ist ein Abstand deutlich länger als der eigene Takt (siehe unten).
- **Freihand und Auflage** bleiben getrennte Familien (SF-65).
- **Merkmale filtern:** Neu gewertete, nur aus dem PDF stammende und ausgenommene Scheiben zählen nicht für Rekorde, ebenso Status `I` (ungültig) und Sonderwertungen wie Preisschießen.
- **Ganzring-Disziplinen:** Liefert Meyton keine Zehntel, rechnet Spiegel sie aus x/y und kennzeichnet die Schüsse als neu gewertet (SF-18). Fehlen Lage und Zehntel, bleibt die Wertung in ganzen Ringen; in Zehnteln gibt es dann keinen Wert.
- **Ganze Ringe oder Zehntel:** Jede wertbasierte Kennzahl gibt es in beiden Wertungen, damit die Oberfläche überall umschalten kann ([[spiegel-ui-design]]). Rekorde und Verläufe laufen je Wertung getrennt.

## Beobachtungen in Worten

Wo ein Satz reicht, steht er über dem Diagramm: „Serie 3 war deine engste (Streukreis 38,2 mm). Serie 4 streut 21 % weiter.“ Die Sätze entstehen aus denselben Kennzahlen, nicht aus Freitext.

## Umsetzung

`packages/shot-core` (SP-1.2, Oktober 2026) setzt die Registry und die ersten Kennzahlen um (`geometry`, `time`, `metrics`); SP-1.10 ergänzt sechs weitere und die Analyse einer Scheibe (`stats`, `analysis`, Katalog [[spiegel-statistics]]). Heute 22 Kennzahlen:

- **Eingabe** ist ein schlanker `MetricShot` (Abgabefolge, Lage, Wert, Ring, Innenzehner, Abstand, Zeit, Probe oder Wertung, Serie, Merkmale). Schüsse ohne gültige Lage zählen bei Lage-Kennzahlen nicht mit, ohne Wert nicht beim Ergebnis, ohne Zeit nicht beim Tempo; ungültige Zahlen (NaN, unendlich, negativer Abstand) gelten als fehlend. `eligibleShots` nennt die Schüsse, über die eine Kennzahl rechnet.
- **Streukreis** ist der kleinste Kreis um die Trefferzentren, Mitte zu Mitte, deterministisch nach Welzl berechnet und gegen Brute Force getestet. Daneben gibt es den größten Abstand zweier Treffer (`extremeSpread`), bis SP-0.6 klärt, welches der beiden Meytons „Trefferkreis“ ist.
- **Radien und Streuung:** R50 (Median der Abstände zum Schwerpunkt, ohne markierte Fehlschüsse), Streuung x/y mit n − 1, Streu-Ellipse aus der Kovarianz.
- **Tempo:** Median der Intervalle; Pausen zählen getrennt. Pause ist ein Abstand über dem 2,5-Fachen des Medians der Abstände bis 180 s, mindestens 60 s, über 180 s immer; unter fünf Abständen nur über 180 s (User, 10. Oktober 2026, `plans/2026-10-10-spiegel-pausen-relativ.md`). Eine Auswahl (Serie) nimmt die Schwelle ihrer ganzen Karte. Die Zeiten kommen in Abgabefolge; ein Rücksprung der Uhr oder ein fehlender Schuss (Sprung in `seq`) trennt die Folge, statt eine falsche Pause zu erzeugen. Eine Probe zwischen zwei Wertungsschüssen ist kein fehlender Schuss: Über die Wertung zählt der Abstand von Wertungsschuss zu Wertungsschuss (SF-04); dafür bekommt die Rechnung die ganze Karte.
- **Versatz Probe → Wertung** (S1, S4) entfiel mit U4 (9. Oktober 2026): Eine Scheibe ist wie am Ausdruck, es gibt keine Probe neben Wertung ([[adr-027]], `asOnPrintout`).
- **Wertung:** Wertbasierte Kennzahlen tragen `scoring` (ganze Ringe oder Zehntel) und ihr Gegenstück (`counterpart`); `inScoring` wählt die passende. Ganze Ringe brauchen nur den Ring, Zehntel den Zehntelwert; die Einheit ist in beiden Fällen „Ringe“. Gleich in beiden Wertungen sind nur Zehner, Innenzehner und die Zehnerquote. Die Auswertungen in `analysis` nehmen die Wertung als Parameter (Konstanz, Quoten, Serienkurve, Ermüdung, Trend, gleitender Schnitt, längste Folge, Ausreißer-Verlust, Wiedereinstieg; Probe gegen Wertung bis U4).
- **Kennzahlen:** Ergebnis und Ø je Schuss (je in ganzen Ringen und in Zehnteln), Zehner, Zehnerquote, Innenzehner, bester Teiler, Schwerpunkt-Abstand, Streukreis, R50, Präzision σ (Rayleigh-σ̂, kaum n-abhängig, für Verläufe über verschiedene Schusszahlen), Streuung x und y, Tempo, Tempo-Streuung, Dauer; jede trägt ihre Katalog-ID (`catalogId`). Mittlerer Radius, Höhe, Breite, längste Pause und Versatz Probe → Wertung sind entfernt (Oktober 2026, [[spiegel-statistics]]). R50 gilt als n-abhängig: Er fällt bei kleinem n leicht zu klein aus. Die übrigen Kennzahlen der Tabelle oben (Ermüdung, Wanderung, …) kommen über dieselbe Registry dazu, sobald eine Ansicht sie braucht.
- **Nummern:** `shotNumbers` nummeriert jeden Schuss in der Abgabefolge seiner Art (Wertung ab 1, Probe ab 1), unabhängig davon, welche Angaben ihm fehlen; alle Auswertungen nennen Schüsse mit diesen Nummern.
