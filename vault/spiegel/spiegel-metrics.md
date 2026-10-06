---
id: spiegel-metrics
type: concept
title: "Spiegel — Kennzahlen, Verläufe und Vergleiche"
aliases: [kennzahlen, metrics, kennzahlen-registry, verläufe, vergleiche]
keywords: [kennzahl, metric, registry, inscoring, counterpart, ganze ringe, zehntel, umschalten, metricshot, computemetric, extremespread, segmentgroups, definemetric, schwerpunkt, mpi, streukreis, kleinster kreis, welzl, mittlerer radius, streuung, ellipse, teiler, intervall, tempo, ermüdung, verlauf, trend, rekord, bestleistung, vergleich, baseline, 30-tage-schnitt, beobachtung, insight, trefferkreis, trefferlage, nur probe, je schuss, r50, median, mindestzahl, ausreißer, visier verstellt, disziplin-familie]
part_of: ["[[spiegel]]"]
relates_to: ["[[statistics-visualization]]", "[[spiegel-data-model]]", "[[spiegel-ui-design]]", "[[spiegel-edge-cases]]"]
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
  appliesTo: ["match", "probe"],  // Ringe nur "match"
  minShots: 3,                    // darunter kein Wert
  nSensitive: true,               // wächst mit der Schusszahl
  compute: (shots) => 2 * smallestEnclosingCircle(shots).radiusMm,
})
```

`appliesTo`, `minShots` und `nSensitive` kommen aus dem Sonderfall-Katalog: Sie steuern, ob eine Probe-Scheibe einen Wert bekommt, ab wann er gilt und ob ein Vergleich gleich viele Schüsse braucht. Eine neue Kennzahl ist eine Funktion plus Test. Ändert sich eine Formel, steigt die Version, und Spiegel rechnet die gespeicherten Werte neu ([[spiegel-ingest-pipeline]]). Die Funktionen liegen in `packages/shot-core` und laufen auf Server und Client.

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

- **Probe zählt, wo es Sinn ergibt.** Eine Scheibe nur mit Probe bekommt alle Kennzahlen zu Lage und Tempo, nur kein Ergebnis. Verläufe zeigen sie mit dem Schalter „Probe einbeziehen“ (SF-01).
- **Je Schuss statt Summe:** Ringe und Zehntel laufen im Verlauf als Ø je Schuss; Summen nur für vollständige Scheiben (SF-07).
- **Streumaße hängen an der Schusszahl.** Der Streukreis wächst mit jedem Schuss. Für Verläufe zählen der mittlere Radius, der Radius um die Hälfte der Treffer (R50) oder der Median der Streukreise je Zehnerserie (SF-60).
- **Mindestzahl:** Jede Kennzahl nennt, ab wie vielen Schüssen sie gilt (Streukreis ab 3, Ellipse ab 5). Darunter steht kein Wert, nicht 0 (SF-61).
- **Ausreißer:** Fehlschüsse und verdächtige Schüsse sind markiert. Robuste Maße und der Gruppen-Zoom lassen sie weg, der Streukreis zeigt sie (SF-14).
- **Visier verstellt:** Verstellt jemand in der Probe oder zwischen Serien das Visier, springt der Schwerpunkt mit Absicht. Der Versatz Probe → Wertung zählt deshalb nur die letzten fünf Probeschüsse, und ein Ereignis „Visier verstellt“ teilt die Gruppe (SF-63).
- **Tempo:** Median der Intervalle; Pausen über drei Minuten zählen getrennt (SF-62).
- **Freihand und Auflage** bleiben getrennte Familien (SF-65).
- **Merkmale filtern:** Neu gewertete, nur aus dem PDF stammende und ausgenommene Scheiben zählen nicht für Rekorde, ebenso Status `I` (ungültig) und Sonderwertungen wie Preisschießen.
- **Ganzring-Disziplinen:** Liefert Meyton keine Zehntel, rechnet Spiegel sie aus x/y und kennzeichnet sie als eigene Kennzahl (SF-18). Fehlen Lage und Zehntel, bleibt die Wertung in ganzen Ringen; in Zehnteln gibt es dann keinen Wert.
- **Ganze Ringe oder Zehntel:** Jede wertbasierte Kennzahl gibt es in beiden Wertungen, damit die Oberfläche überall umschalten kann ([[spiegel-ui-design]]). Rekorde und Verläufe laufen je Wertung getrennt.

## Beobachtungen in Worten

Wo ein Satz reicht, steht er über dem Diagramm: „Serie 3 war deine engste (Streukreis 38,2 mm). Serie 4 streut 21 % weiter.“ Die Sätze entstehen aus denselben Kennzahlen, nicht aus Freitext.

## Umsetzung

`packages/shot-core` (SP-1.2, Oktober 2026) setzt die Registry und die ersten 16 Kennzahlen um (`geometry`, `time`, `metrics`):

- **Eingabe** ist ein schlanker `MetricShot` (Lage, Wert, Ring, Innenzehner, Abstand, Zeit, Probe oder Wertung, Serie, Merkmale). Schüsse ohne Lage zählen bei Lage-Kennzahlen nicht mit, ohne Wert nicht beim Ergebnis, ohne Zeit nicht beim Tempo.
- **Streukreis** ist der kleinste Kreis um die Trefferzentren, Mitte zu Mitte, deterministisch nach Welzl berechnet und gegen Brute Force getestet. Daneben gibt es den größten Abstand zweier Treffer (`extremeSpread`), bis SP-0.6 klärt, welches der beiden Meytons „Trefferkreis“ ist.
- **Radien und Streuung:** mittlerer Radius (Mittel der Abstände zum Schwerpunkt), R50 (ihr Median, ohne markierte Ausreißer), Streuung x/y mit n − 1, Streu-Ellipse aus der Kovarianz.
- **Tempo:** Median der Intervalle; Intervalle über 180 s sind Pausen und zählen getrennt.
- **Versatz Probe → Wertung** nimmt die letzten fünf Probeschüsse; `segmentGroups` teilt eine Gruppe an einem Schuss, nach dem das Visier verstellt wurde.
- **Wertung:** Wertbasierte Kennzahlen tragen `scoring` (ganze Ringe oder Zehntel) und ihr Gegenstück (`counterpart`); `inScoring` wählt die passende. Ganze Ringe brauchen nur den Ring, Zehntel den Zehntelwert.
- **Kennzahlen:** Ergebnis und Ø je Schuss (je in ganzen Ringen und in Zehnteln), Zehner, Innenzehner, bester Teiler, Schwerpunkt-Abstand, Streukreis, mittlerer Radius, R50, Streuung x und y, Tempo, längste Pause, Versatz Probe → Wertung. Die übrigen Kennzahlen der Tabelle oben (Ermüdung, Wanderung, Tempo-Konstanz, …) kommen über dieselbe Registry dazu, sobald eine Ansicht sie braucht.
