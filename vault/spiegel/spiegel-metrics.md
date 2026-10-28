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

`appliesTo`, `minShots`, `nSensitive`, `excludeMisses`, `needs` und `onMissing` kommen aus dem Sonderfall-Katalog: Sie steuern, ob eine Probe-Scheibe einen Wert bekommt, ab wann er gilt, ob ein Vergleich gleich viele Schüsse braucht und was mit Ausreißern und fehlenden Angaben geschieht. `pooling` sagt, wie ein Wert über die Schüsse vieler Scheiben zusammengeht (Mittel mit `perShot`, Streuung einer Richtung, Rayleigh-σ; ohne Angabe bleibt er eine Zahl je Scheibe, [[adr-034]]). Eine neue Kennzahl ist eine Funktion plus Test. Ändert sich eine Formel, steigt die Version, und Spiegel rechnet die gespeicherten Werte neu ([[spiegel-ingest-pipeline]]). Die Funktionen liegen in `packages/shot-core` und laufen auf Server und Client.

**Angaben ohne Einzelschüsse** ([[adr-033]], Nachtrag 27. Oktober 2026): Eine Scheibe kann Serien-Summen, ein
Gesamtergebnis und eine Trefferlage als Summe tragen (`PeriodCard.sums`, `CardSums`), jede mit ihrer Schusszahl.

- **`summary`** an der Kennzahl gibt den Wert aus diesen Angaben; nur Kennzahlen der Ebene Scheibe, nie eine Streuung
  (`defineMetric` prüft das). Genau fünf tragen sie: Ergebnis und Ø je Schuss in beiden Wertungen (E1, E2) und der
  Schwerpunkt-Abstand (L2) aus der Trefferlage. Zehner, Innenzehner, Teiler, Streuung und Tempo fehlen ohne Schüsse.
- **Kaskade:** erst die Schüsse (`computeMetric`); geben sie keinen Wert, die Serien-Summen, wenn jede den Wert der
  Wertung trägt, sonst das Gesamtergebnis (`sumsResult`, in Zehnteln), sonst fehlt er (`summaryValue`). So nimmt eine
  Scheibe mit Schüssen in ganzen Ringen und Serien-Summen mit Zehnteln die Zehntel aus den Summen.
- **Kein `sd` aus Summen:** Werte aus Summen tragen keine Streuung der Schusswerte; ein Zeitraum mit solchen Scheiben
  urteilt mit dem Rangtest über die Scheiben (`compareValues`).
- **Need `innerTen`:** Innenzehner brauchen eine bekannte Angabe und einen Ring; ein unbekannter (eingetragen ohne Lage)
  gibt keinen Wert, nicht 0 (`result.innerTens` Version 2).
- **Grundlage in der Projektion** (`CardDetail`, `cardDetail`): woher das Ergebnis je Wertung kommt (Schüsse, Serien,
  Gesamtergebnis), wie viele Schüsse eine Lage und eine Zeit haben, die Mitte aus Lagen je Schuss oder aus der
  Trefferlage mit ihrer Schusszahl. `pooledCenter` führt Mitten gewichtet mit ihrer Schusszahl zusammen, nur für
  Versatz und Richtung; Urteile nehmen nur Lagen je Schuss.
- **Serien in der Projektion** (`CardProjection.series`, `ProjectedSeries`, `PROJECTION_VERSION` 7): je Serie Nummer,
  Schusszahl und Summe in ganzen Ringen und in Zehnteln, wie unter der Scheibe (`seriesCurve` über die Schüsse wie am
  Ausdruck, ohne Schüsse die Serien-Summen). So zählen Ziele des Tagebuchs („Serie ab X“) ohne Schüsse zu lesen
  ([[spiegel-diary]]).
- **Schusszahl:** `shotCountOf` zählt die Schüsse wie am Ausdruck, ohne sie die Schusszahl der Summen (Umfang,
  `printedShots`). „Nur Probe“ ist eine Scheibe erst mit mindestens einem Schuss; eine ohne Werte zählt in keiner Zahl.
  Probe neben Summen der Wertung (Probe je Schuss, Wertung nur als Summe) zählt nicht; es zählt die Wertung aus den
  Summen. Eine Scheibe nur aus Probe zählt nur mit „Probe einbeziehen“, auch nicht über eine Trefferlage als Summe.

## Kennzahlen für den Anfang

| Gruppe | Kennzahlen |
|---|---|
| Ergebnis | Ringe, Zehntel, Ø je Schuss, Zehner, Innenzehner, bester Teiler, Streuung der Serienergebnisse |
| Trefferbild | Schwerpunkt x/y, Schwerpunkt-Abstand, Streukreis (kleinster Kreis um alle Treffer), R50, Präzision σ, Streuung x/y, Streu-Ellipse (Achsen, Winkel) |
| Zeit | Dauer, Tempo (Median der Intervalle), Tempo-Konstanz, Pausen, Zeit bis zum ersten Wertungsschuss |
| Verlauf in der Einheit | Ermüdung (letzte gegen erste zehn), erster Wertungsschuss nach der Probe, Wanderung des Schwerpunkts zwischen den Serien |
| ~~Probe gegen Wertung~~ | entfiel mit U4: keine Probe neben Wertung (wie am Ausdruck) |

Meyton druckt eigene Streumaße: **Trefferkreis** und **Trefferlage**, gesamt und je Serie ([[meyton-printout]]). Spiegel zeigt sie daneben. Meytons „Trefferkreis“ ist der kleinste Kreis um die Schussmitten plus Kaliber, auf 1/100 mm gerundet, die Trefferlage der Schwerpunkt, abgeschnitten ([[meyton-printout]], SF-76).

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

- **Wie am Ausdruck, Probe als Training.** Eine Scheibe mit Wertung rechnet nur über die Wertung, eine Scheibe nur mit Probe auf der Scheibe wie Wertung, auch mit Ergebnis je Serie und gesamt (`asOnPrintout` im Fachkern). Verläufe und Rekorde zeigen sie nur mit dem Schalter „Probe einbeziehen“ (SF-01).
- **Je Schuss statt Summe:** Ringe und Zehntel laufen im Verlauf als Ø je Schuss; Summen nur für vollständige Scheiben (SF-07).
- **Streumaße hängen an der Schusszahl.** Der Streukreis wird mit jedem Schuss größer oder bleibt gleich, R50 fällt bei kleinem n leicht zu klein aus (bei 10 Schuss etwa 4 %). Für Verläufe über unterschiedliche Schusszahlen zählt deshalb σ̂ (Rayleigh-σ, kaum n-abhängig); die anderen nur bei gleichem n (SF-60).
- **Mindestzahl:** Jede Kennzahl nennt, ab wie vielen Schüssen sie gilt (Streukreis ab 3, Form ab 3 und ihr Winkel ab 10, R50 ab 5). Darunter steht kein Wert, nicht 0 (SF-61).
- **Ausreißer:** Fehlschüsse sind markiert. Robuste Maße (R50) und der Gruppen-Zoom lassen sie weg; Streukreis und Streuung zeigen sie (SF-14).
- **Verdächtige Schüsse** (Platzhalter, Handeintrag) zählen nur mit ihrem amtlichen Wert zum Ergebnis. In Lage, Abstand und Tempo fehlen sie, sie geben keinen Teiler-Rekord und werden nicht gezeichnet (SF-15). Eine Scheibe mit Platzhalter zählt nicht für Scheiben-Rekorde (`records.ts`).
- **Fehlende Angaben:** Ein Schuss ohne die nötige Angabe fällt weg. Summen und Zählungen geben dann keinen Wert, denn eine Summe über einen Teil der Schüsse ist kein Ergebnis.
- **Reihenfolge:** Es zählt die Abgabefolge, nicht die Uhr; springt die Uhr zurück oder fehlt ein Schuss mitten in der Folge, zählt der Abstand daneben nicht als Tempo (SF-30).
- **Visier verstellt:** Verstellt jemand in der Probe oder zwischen Serien das Visier, springt der Schwerpunkt mit Absicht. Spiegel fragt Verstellungen nicht ab, und einen Versatz Probe → Wertung gibt es nicht: Wie am Ausdruck steht keine Probe neben der Wertung (SF-63).
- **Tempo:** Median der Intervalle; Pausen zählen getrennt (SF-62). Pause ist ein Abstand deutlich länger als der eigene Takt (siehe unten).
- **Freihand und Auflage** bleiben getrennte Familien (SF-65).
- **Merkmale filtern:** Neu gewertete, nur aus dem PDF stammende und ausgenommene Scheiben zählen nicht für Rekorde, ebenso Status `I` (ungültig) und Sonderwertungen wie Preisschießen.
- **Ganzring-Disziplinen:** Liefert Meyton keine Zehntel, rechnet Spiegel sie aus x/y und kennzeichnet die Schüsse als neu gewertet (SF-18). Fehlen Lage und Zehntel, bleibt die Wertung in ganzen Ringen; in Zehnteln gibt es dann keinen Wert.
- **Ganze Ringe oder Zehntel:** Jede wertbasierte Kennzahl gibt es in beiden Wertungen, damit die Oberfläche überall umschalten kann ([[spiegel-ui-design]]). Rekorde und Verläufe laufen je Wertung getrennt.

## Beobachtungen in Worten

Wo ein Satz reicht, steht er über dem Diagramm: „Serie 3 war deine engste (Streukreis 38,2 mm). Serie 4 streut 21 % weiter.“ Die Sätze entstehen aus denselben Kennzahlen, nicht aus Freitext.

## Umsetzung

`packages/shot-core` setzt die Registry und die Kennzahlen um (`geometry`, `time`, `metrics`), dazu die Analyse einer Scheibe (`stats`, `analysis`, Katalog [[spiegel-statistics]]). Heute 22 Kennzahlen:

- **Eingabe** ist ein schlanker `MetricShot` (Abgabefolge, Lage, Wert, Ring, Innenzehner, Abstand, Zeit, Probe oder Wertung, Serie, Merkmale). Schüsse ohne gültige Lage zählen bei Lage-Kennzahlen nicht mit, ohne Wert nicht beim Ergebnis, ohne Zeit nicht beim Tempo; ungültige Zahlen (NaN, unendlich, negativer Abstand) gelten als fehlend. `eligibleShots` nennt die Schüsse, über die eine Kennzahl rechnet.
- **Streukreis** ist der kleinste Kreis um die Trefferzentren, Mitte zu Mitte, deterministisch nach Welzl berechnet und gegen Brute Force getestet. Daneben gibt es den größten Abstand zweier Treffer (`extremeSpread`); Meytons „Trefferkreis“ ist der Streukreis plus Kaliber.
- **Radien und Streuung:** R50 (Median der Abstände zum Schwerpunkt, ohne markierte Fehlschüsse), Streuung x/y mit n − 1, Streu-Ellipse aus der Kovarianz.
- **Tempo:** Median der Intervalle; Pausen zählen getrennt. Pause ist ein Abstand über dem Doppelten des Medians der Abstände bis 180 s, mindestens 60 s, über 180 s immer; unter fünf Abständen nur über 180 s. Eine Auswahl (Serie) nimmt die Schwelle ihrer ganzen Karte, nur aus Schüssen mit gültiger Zeit; die Schwelle steht auf ganzen Sekunden. Der Median nimmt alle Abstände bis 180 s, auch spätere Pausen: Wenige Pausen verschieben ihn kaum, ist die Hälfte der Abstände lang, wird die Schwelle 180 s. Die Zeiten kommen in Abgabefolge; ein Rücksprung der Uhr oder ein fehlender Schuss (Sprung in `seq`) trennt die Folge, statt eine falsche Pause zu erzeugen. Eine Probe zwischen zwei Wertungsschüssen ist kein fehlender Schuss: Über die Wertung zählt der Abstand von Wertungsschuss zu Wertungsschuss (SF-04); dafür bekommt die Rechnung die ganze Karte.
- **Wertung:** Wertbasierte Kennzahlen tragen `scoring` (ganze Ringe oder Zehntel) und ihr Gegenstück (`counterpart`); `inScoring` wählt die passende. Ganze Ringe brauchen nur den Ring, Zehntel den Zehntelwert; die Einheit ist in beiden Fällen „Ringe“. Gleich in beiden Wertungen sind nur Zehner, Innenzehner und die Zehnerquote. Die Auswertungen in `analysis` nehmen die Wertung als Parameter (Konstanz, Quoten, Serienkurve, Ermüdung, Trend, gleitender Schnitt, längste Folge, Ausreißer-Verlust, Wiedereinstieg).
- **Kennzahlen:** Ergebnis und Ø je Schuss (je in ganzen Ringen und in Zehnteln), Zehner, Zehnerquote, Innenzehner, bester Teiler, Schwerpunkt-Abstand, Streukreis, R50, Präzision σ (Rayleigh-σ̂, kaum n-abhängig, für Verläufe über verschiedene Schusszahlen), Streuung x und y, Tempo, Tempo-Streuung, Dauer; jede trägt ihre Katalog-ID (`catalogId`). Mittlerer Radius, Höhe, Breite, längste Pause und Versatz Probe → Wertung führt Spiegel nicht ([[spiegel-statistics]]). R50 gilt als n-abhängig: Er fällt bei kleinem n leicht zu klein aus. Die übrigen Kennzahlen der Tabelle oben (Ermüdung, Wanderung, …) kommen über dieselbe Registry dazu, sobald eine Ansicht sie braucht.
- **Nummern:** `shotNumbers` nummeriert jeden Schuss in der Abgabefolge seiner Art (Wertung ab 1, Probe ab 1), unabhängig davon, welche Angaben ihm fehlen; alle Auswertungen nennen Schüsse mit diesen Nummern.
