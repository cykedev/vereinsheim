---
id: spiegel-metrics
type: concept
title: "Spiegel — Kennzahlen, Verläufe und Vergleiche"
aliases: [kennzahlen, metrics, kennzahlen-registry, verläufe, vergleiche]
keywords: [kennzahl, metric, registry, definemetric, schwerpunkt, mpi, streukreis, kleinster kreis, welzl, mittlerer radius, streuung, ellipse, teiler, intervall, tempo, ermüdung, verlauf, trend, rekord, bestleistung, vergleich, baseline, 30-tage-schnitt, beobachtung, insight, trefferkreis, trefferlage]
part_of: ["[[spiegel]]"]
relates_to: ["[[statistics-visualization]]", "[[spiegel-data-model]]", "[[spiegel-ui-design]]"]
---

**TL;DR** Jede Kennzahl ist eine reine, versionierte Funktion mit Einheit, Richtung (besser höher oder niedriger) und Ebenen (Schuss, Serie, Scheibe). Daraus ergeben sich ohne weiteren Code die Kachel in der Session, die Spalte im Serienvergleich, der Verlauf über Monate, der direkte Vergleich und der Rekord.

## Registry

```ts
export const streukreis = defineMetric({
  key: "group.enclosingDiameter",
  label: "Streukreis",
  unit: "mm",
  scopes: ["series", "card"],
  better: "lower",
  version: 1,
  compute: (shots) => 2 * smallestEnclosingCircle(shots).radiusMm,
})
```

Eine neue Kennzahl ist eine Funktion plus Test. Ändert sich eine Formel, steigt die Version, und Spiegel rechnet die gespeicherten Werte neu ([[spiegel-ingest-pipeline]]). Die Funktionen liegen in `packages/shot-core` und laufen auf Server und Client.

## Kennzahlen für den Anfang

| Gruppe | Kennzahlen |
|---|---|
| Ergebnis | Ringe, Zehntel, Ø je Schuss, Zehner, Innenzehner, bester Teiler, Streuung der Serienergebnisse |
| Trefferbild | Schwerpunkt x/y, Schwerpunkt-Abstand, Streukreis (kleinster Kreis um alle Treffer), mittlerer Radius, Streuung x/y, Streu-Ellipse (Achsen, Winkel) |
| Zeit | Dauer, Ø Intervall, Tempo-Konstanz, längste Pause, Zeit bis zum ersten Wertungsschuss |
| Verlauf in der Einheit | Ermüdung (letzte gegen erste zehn), erster Wertungsschuss nach der Probe, Wanderung des Schwerpunkts zwischen den Serien |
| Probe gegen Wertung | Versatz der Schwerpunkte, Zahl der Probeschüsse |

Meyton druckt eigene Streumaße: **Trefferkreis** und **Trefferlage**, gesamt und je Serie ([[meyton-printout]]). Spiegel zeigt sie daneben und klärt an den Rohdaten, ob „Trefferkreis“ der kleinste Kreis um alle Treffer oder der größte Abstand zweier Treffer ist.

## Verläufe

- Jede Kennzahl über die Zeit. **Disziplin ist Pflichtfilter** (wie in Treffsicher: nie gemischte Disziplinen, [[statistics-visualization]]).
- Zeitraum, Training oder Wettkampf (automatisch aus Meyton: Status, Starterliste), Wert je Scheibe, Woche oder Monat, gleitender Schnitt.
- Marker für Ereignisse („neuer Griff“, „neues Munitionslos“).
- Rekorde fallen nebenbei ab: beste Scheibe, beste Serie, bester Teiler, engster Streukreis.

## Direkte Vergleiche

- Serie gegen Serie, Scheibe gegen Scheibe, Zeitraum gegen Zeitraum, Merkmal A gegen B (braucht Tags), gegen den eigenen Schnitt.
- Schütze gegen Schütze nur mit beidseitiger Freigabe.
- **Gleiche Schusszahl:** ein Streukreis über 40 Schuss ist immer größer als über 10; Vergleiche weisen darauf hin.
- Darstellung: beide Gruppen auf einer Scheibe (zwei feste, farbenblind geprüfte Farben), daneben eine Tabelle mit Differenz und „besser/schlechter“ je nach Richtung der Kennzahl.

## Beobachtungen in Worten

Wo ein Satz reicht, steht er über dem Diagramm: „Serie 3 war deine engste (Streukreis 38,2 mm). Serie 4 streut 21 % weiter.“ Die Sätze entstehen aus denselben Kennzahlen, nicht aus Freitext.
