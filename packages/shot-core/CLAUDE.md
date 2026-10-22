# @vereinsheim/shot-core — Claude Scope-Notiz

Fachkern von Spiegel: Scheibenbilder als Daten, Wertung wie Meyton, Meyton-Disziplinen und die Gegenprobe,
Geometrie, Tempo, die Kennzahlen-Registry, die Analyse einer und vieler Scheiben (`stats`, `analysis`) und die
Projektion für die Datenbank. Reine Funktionen ohne Dependencies, isomorph (Server und Client). `apps/spiegel`
nutzt ihn für Projektion und Lagen beim Schreiben, die Ansichten (`shot-ui`) für alles Gerechnete.
Fachwissen: `vault/spiegel/spiegel-target-library.md`, `vault/spiegel/spiegel-metrics.md`,
`vault/spiegel/spiegel-statistics.md` (Katalog), Sonderfälle: `vault/spiegel/spiegel-edge-cases.md`.

## Exporte

| Export                              | Datei                        | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@vereinsheim/shot-core/units`      | `src/units.ts`               | `mmToUm` (ganze µm oder Fehler)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `@vereinsheim/shot-core/targets`    | `src/targets.ts`             | `defineTarget`, `LG_10M`, `LP_10M`, `TARGETS`, `MAX_DECIMAL_TENTHS`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `@vereinsheim/shot-core/scoring`    | `src/scoring.ts`             | `scoreFromCoordinates`, `scoreFromDistance`, `distanceUm`, Teiler, `MEYTON_TOLERANCE_UM`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `@vereinsheim/shot-core/discipline` | `src/discipline.ts`          | `parseDisciplineId`, `resolveTarget`, `suggestFamily`, `suggestIgnore`, `plannedShotsOf`, Vollständigkeit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@vereinsheim/shot-core/verify`     | `src/verify.ts`              | `checkShot`, `verifyCard`, `suggestTargets`, `rescore` (Neu-Wertung)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `@vereinsheim/shot-core/geometry`   | `src/geometry.ts`            | Schwerpunkt, Streukreis, `extremeSpread`, Radien, Streuung, Ellipse                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `@vereinsheim/shot-core/time`       | `src/time.ts`                | `tempo` in Abgabefolge: Intervalle, Pausen relativ zum Takt (`pauseThresholdMs`: über dem Doppelten des Medians, 60 s bis 180 s), Lücken, Uhrsprünge                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `@vereinsheim/shot-core/metrics`    | `src/metrics.ts`             | `defineMetric`, `CATALOG_ID` (Form einer Katalog-ID, auch für die Tests von shot-help), `METRICS`, `metricByKey`, `computeMetric`, `eligibleShots`, `selectShots`, `inScoring`, `inShotOrder`, `shotNumbers`, `probeOnlyAsMatch`, `asOnPrintout`, `shotSteps`, `stepsInOrder`, `contextOf`, `ShotContext`, `timesWithGaps`, `timesInOrder`, `intervalsInOrder` (Abstand je Schuss, dem Schuss zugeordnet; `tempo` rechnet dieselbe Regel über `timesInOrder`), `pauseThresholdOf` (Schwelle der Karte), `isDrawn` (steht auf der Scheibe: mit Lage, ohne verdächtige), `shotDistanceUm`, `FLAG_*`, `CARD_FLAGS`/`CardFlag` (jede Kennung an einer Scheibe)                                                                                                                                                                                                                                                                                                                                                                                 |
| `@vereinsheim/shot-core/stats`      | `src/stats.ts`               | Quantil, Median, `modalLength` (häufigste Serienlänge, bei Gleichstand die längere), MAD, IQR, Wilson, lnΓ, c4, χ²- und F-Quantile, Rand der F- und χ²-Verteilung (`fSurvival`, `chiSquareSurvival`, `incompleteBeta`), Theil-Sen, Mann-Kendall, Ausgleichsgerade, Mann-Whitney, exakter Permutationstest auf den Unterschied der Mittel (kleine Gruppe bis 3 Werte), zweiseitiges p der Normalverteilung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@vereinsheim/shot-core/analysis`   | `src/analysis/*.ts`          | Analyse einer Scheibe: Ergebnis, Präzision, Lage, Zeit, Verlauf, Datenlage (keine Auswertung der Probe, S1–S4 entfernt); über viele Scheiben (`period.ts`: Werte je Scheibe, Verlauf, Formband, Boden und Decke, Umfang, Vergleich, eigener Schnitt), Rekorde (`records.ts`) und das Trefferbild eines Zeitraums (`pattern.ts`: `periodShape` L9, `positionPoints` und `positionOverTime` L10, `outlierDirection` L7, `periodPattern` für den Browser; Raster in `density.ts`, Hotelling in `hotelling.ts`, beide nicht exportiert), Vergleichen (`compare.ts`: `compareSides` A gegen B mit Δ = A − B, `compareCenters` Hotelling für zwei Stichproben, `compareCenterGroups` Lage zweier Zeiträume über zwei Ebenen, `compareShots` zwei Scheiben Schuss für Schuss C2, `comparePicture` Umrisse oder Punkte beider Seiten; `compareSamples` in `period.ts`), über zwei Ebenen (`levels.ts`: `shotGroup`, `levelEstimate`, `levelTestZero`, `levelCompare`, `pooledValue`, `compareValues`); `ANALYSIS_CATALOG` (Funktion → Katalog-IDs) |
| `@vereinsheim/shot-core/projection` | `src/analysis/projection.ts` | Projektion je Scheibe für die Datenbank (ADR-031): `cardProjection` (Kennzahlen der Ebene Scheibe in beiden Wertungen, Rekord-Kandidaten, Merkmale), `projectedValues`, `projectedRecords` und `projectedVolume` (wie `cardValues`, `periodRecords`, `trainingVolume`, ohne Schüsse), `projectedEligible` (zählt für Rekorde), `recordsInView` (Filter der Rekorde nach Art und Probe, auch für andere Eingaben aus Kandidaten), `pooledMean` (Ø je Schuss über mehrere Scheiben zusammen), `projectCard` (Scheibe mit Schüssen → `ProjectedCard`), `cardMarks`/`markShots` (Lagen für die kleinen Scheiben, 10 µm), `projectionVersion`                                                                                                                                                                                                                                                                                                                                                                                                   |

## Regeln

- **Ganze Mikrometer.** Scheibenbilder in mm notieren und nur über `defineTarget` anlegen; es prüft,
  dass jede Zehntelgrenze auf einem ganzen µm liegt. Neue Scheiben nur mit Quelle (Sportordnung).
- **Exakte Wertung, kein Epsilon.** `scoring.ts` vergleicht ganzzahlig (x² + y² gegen b(k)², Abstand
  auf 0,01 µm gerundet). Die naive Formel `floor((11 − d ÷ W) · 10)` liegt an neun Grenzen je Scheibe
  einen Zehntel zu tief (Test „Grenzen“).
- **Wertung wie Meyton, nicht wie die Regel.** Jede Grenze (Zehntel, Fehlschuss, Innenzehner) liegt um
  `MEYTON_TOLERANCE_UM` = 10 µm weiter außen, und der Abstand muss darunter liegen (strikt). Belegt an
  43 000 von 43 000 Schüssen der Vereinsanlage (SF-75); vier Grenzabstände (`__fixtures__/meyton-toleranz.ts`) legen T
  auf 10 µm fest. Die Gegenprobe an echten Schüssen (ein Abend mit Ausdruck, 953 wertbare Schüsse aus zwei Jahren) liest
  `__fixtures__/private.ts` aus dem gitignorten `__fixtures__/private/` (ADR-029); ohne die Dateien laufen diese Tests
  nicht. Echte Schüsse kommen nie ins Repo. Die Scheibenbilder bleiben regelgerecht, gezeichnet wird ohne Toleranz.
- **Disziplinen über die ganze DisziplinID** (Regelnummer und Schusscode), nie über Regelbereiche
  allein: 0610 ist LP Liga und ISSF-Luftgewehr-Finale, 0100 die französische Luftpistole (SF-70).
  Danach der Name (ganzes Wort LG/LP), dann unbekannt. Der Katalog nennt nur Regeln, er schreibt die
  Meyton-Liste nicht ab (urheberrechtlich geschützt).
- **Die Schusszahl ist ein Hinweis** (SF-09): 000 offen, über 100 kein verlässlicher Hinweis. Gegen
  sie zählen nur Wertungsschüsse (SF-02).
- Kein `server-only`, keine Node-APIs, kein `"use server"`; Just-in-time wie `packages/lib`. Eine
  Next-App, die das Paket nutzt, braucht es in `transpilePackages` (Spiegel: `apps/spiegel/next.config.ts`).
- Bekannte Disziplinen mit eigener Scheibe stehen als Nullzeile im Katalog (`target: null`) und bleiben
  unbekannt, bis die Bibliothek ihre Scheibe kennt; dazu gehören Meytons Vereinsspiele (Regeln 8000 bis
  8154, nur der belegte Bereich) und Trainingsscheiben, die „LG“/„LP“ im Namen tragen. Vereinseigene
  Disziplinen ohne Scheibe stehen nicht im Katalog, sondern in der Admin-Zuordnung mit `targetId: null`
  (ADR-029).
- Was nicht hier liegt: Zeichnen (`shot-ui`), die Skalen der SSMDB2-Felder (Adapter in
  `apps/spiegel/src/lib/ingest/meyton-ssmdb2.ts`).
- **Kennzahlen nur über `defineMetric`**, mit Katalog-ID (`catalogId`), Test und festem Erwartungswert
  (nicht nur „nicht null“).
  Ändert sich eine Formel, steigt ihre `version`. `computeMetric` wendet die Regeln aus dem
  Sonderfall-Katalog an: `appliesTo` (SF-01), `needs` mit gültigen, endlichen Angaben, `onMissing`
  („null“ für Summen und Zählungen, SF-07), `minShots` (SF-61), Fehlschüsse nur bei `excludeMisses`
  (SF-14), verdächtige Schüsse nur mit ihrem Wert (SF-15), Schüsse über der Soll-Zahl mit Wert 0 und Zeit, ohne
  Lage und Abstand (SF-08, `FLAG_OVER_TARGET`). `nSensitive` ist ein Hinweis für Vergleiche
  (SF-60), das n liefert `eligibleShots`. `compute` nie direkt aufrufen.
- **Pausen relativ zum eigenen Takt:** Pause ist
  ein Abstand über dem Doppelten des Medians der Abstände bis drei Minuten, mindestens 60 s, über drei Minuten immer;
  unter fünf Abständen nur die drei Minuten; die Schwelle steht auf ganzen Sekunden. Die Regel steht nur in `time.ts`
  (`pauseRule` mit Grundlage `takt`, `mindestens`, `hoechstens`, `fest`). Eine Auswahl nimmt die Regel ihrer ganzen
  Karte (`pauseRuleOf`, `pauseThresholdOf`), nur aus Schüssen mit gültiger Zeit, damit eine Serie dieselben Pausen
  sieht wie die Scheibe. Hat die Karte keinen Schuss der Arten der Auswahl (nur Probe, als Wertung gezeigt), gilt die
  Auswahl selbst, nie still drei Minuten.
- **Reihenfolge ist die Abgabefolge** (`seq`, SF-30): `inShotOrder`; `tempo` erwartet die Zeiten in
  Abgabefolge und zählt einen Rücksprung der Uhr weder als Intervall noch als Pause; fehlt ein Schuss
  mitten in der Folge (Sprung in `seq`), zählt der Abstand daneben nicht. Füllen den Sprung auf der Karte
  nur Probeschüsse (Probe zwischen Wertung, SF-04), ist er in einer Auswahl ohne Probe keine Lücke; nur die
  Probe ist durchlässig, Wertungsschüsse in einer Auswahl der Probe bleiben eine Lücke. Dafür braucht die
  Rechnung die ganze Karte in derselben Form wie die Auswahl: `card` an `computeMetric`, `pauseRecovery`,
  `rhythmProfile`, `tempoSpread`, `drift`, sonst `contextOf`.
- **Projektion gleich Live-Rechnung** (ADR-031): Die Übersichten lesen Werte und Rekord-Kandidaten je
  Scheibe aus der Projektion, die beim Schreiben einer Revision entsteht. Rekorde sind dafür zerlegt in Kandidaten je
  Scheibe (`cardRecordCandidates`) und ihr Zusammenführen (`combineRecords`); `periodRecords` nutzt beides. Die
  Projektion rechnet beide Wertungen und mit Probe; gefiltert wird beim Lesen wie in `cardValues` und `periodRecords`.
  `projection.test.ts` hält die Gleichheit an den erzeugten Scheiben und jedem Sonderfall fest. Ändert sich eine Formel,
  steigt ihre `version` und damit `projectionVersion()`; ändert sich ein Kandidat oder die Form der Projektion, steigt
  `PROJECTION_VERSION` (dazu gehören die Lagen aus `cardMarks`, die mit der Projektion gespeichert und im Test mit
  festgeschrieben werden). Das gilt auch für geteilte Logik dahinter (`cardShots`, `asOnPrintout`, Rundung, Streukreis):
  Ein Test schreibt Version und Ausgabe an den Fixtures fest und wird rot, wenn sich nur die Ausgabe ändert. Die
  Projektion rechnet in Abgabefolge (`inShotOrder`), unabhängig von der Folge der Eingabe. Eine neue Filterregel in
  `periodRecords` oder `cardValues` braucht dieselbe in `projectedRecords`/`projectedValues` (Filter der Rekorde in
  `recordsInView`, das auch `itemRecords` in `shot-ui` nimmt) und eine Testscheibe, an der sie greift.
- **`toBeCloseTo` nimmt null als 0.** Wo eine Kennzahl 0 ergeben soll, erst `not.toBeNull()` prüfen
  (Helfer `expectNear` in `metrics.test.ts`).
- **Eine Scheibe wie am Ausdruck** ([[adr-027]]): `asOnPrintout` gibt mit Wertung nur die Wertungsschüsse
  (eine Probe zwischen Wertung, SF-04, fällt ebenso weg), nur Probe als Training (`probeOnlyAsMatch`), sonst dieselbe
  Liste. Die Seite einer Scheibe und `cardShots` rufen nur sie; `cardShots` behält die ganze Karte als Kontext für
  Abstände (SF-04 bleibt robust). Eine Auswertung der Probe neben Wertung gibt es nicht.
- **Ganze Ringe und Zehntel sind immer umschaltbar.** Jede wertbasierte Kennzahl gibt es in beiden
  Wertungen (`scoring` + `counterpart`, gleiche Regeln), `inScoring` wählt; ein Registry-Test erzwingt
  das Paar. Ausnahme sind nur Zehner, Innenzehner und die Zehnerquote, die in beiden Wertungen gleich sind. Ganze Ringe
  brauchen nur `ring` (`needs: "ring"`), Zehntel den Zehntelwert (SF-18). Wertbasierte Auswertungen in
  `analysis/*` nehmen `scoring` als Pflichtparameter (`analysis/values.ts`); Schwellen stehen in
  Zehnteln (100 = 10,0). Nur die Zehntelverteilung gibt es allein in Zehnteln; einzelne Schüsse zeigt `shot-ui` immer
  in Zehnteln (`formatShotValue`).
- **Auswertungen wählen wie die Registry.** `analysis/*` nutzt `selectShots` und `shotSteps`/
  `timesWithGaps`, keine eigene Filter- oder Lückenlogik; welche Schüsse gemeint sind (Wertung, eine
  Serie, die Probe), wählt der Aufrufer. Schussnummern kommen immer aus `shotNumbers` (je Art, über
  alle gegebenen Schüsse), nie aus Positionen in einer gefilterten Liste. Erst die ganze Karte ordnen
  (`inShotOrder`), dann auswählen, und Abstände über `stepsInOrder`/`timesInOrder`: So folgen
  Reihenfolge und Nummern derselben Ordnung, auch wenn einem Schuss Abgabefolge und Zeit fehlen.
- **Keine Zahl, die aus einer anderen folgt:** Eine Kennzahl oder Auswertung
  bleibt nur, wenn sie eine eigene Frage beantwortet. Was sich aus einer anderen ergibt (Sa aus σ, Ringverlust
  aus dem Ergebnis, Netto-Zeit aus den Abständen, bester Schuss aus dem besten Teiler), fällt weg. Im Katalog
  bleibt die Zeile mit „entfernt“ und Grund; IDs werden nie wiederverwendet. Ein Wert, den eine Stichprobe
  an sich selbst misst (Lage-Verlust), wird außerhalb der Stichprobe geschätzt (Leave-one-out).
- **Neue Auswertung, neuer Katalog-Eintrag:** Jede exportierte Funktion aus `./analysis` steht mit ihren
  Katalog-IDs in `ANALYSIS_CATALOG` (Test erzwingt das), und `@vereinsheim/shot-help` braucht für jede
  dieser IDs eine Erklärung (Test dort). Ohne Erklärung bleibt das Gate rot.
- **Simulation nachziehen:** Ändert sich eine Auswertung, die eine Zahl in einem Hilfetext belegt
  (Trend, Ringverlust, Ausreißer, Form, σ, Probe, Vergleich zweier Zeiträume, Formband, Wiedereinstieg nach Pausen),
  `pnpm --filter @vereinsheim/shot-help simulate`
  laufen lassen und den Block „Belege aus Simulationen“ in `vault/spiegel/spiegel-statistics.md` samt den
  zitierenden Texten angleichen. Das Gate prüft das nicht (Laufzeit, Zufallszahlen).
- **Über viele Scheiben** ([[adr-034]]): Werte je Scheibe kommen aus der Registry (`cardValues`, bei
  `pooling: "mean"` mit `sd`). Was über einen Zeitraum zusammengeht, rechnet `pooledValue` über die Schüsse (`pooling`
  an der Kennzahl: Mittel, Streuung einer Richtung, Rayleigh-σ; ohne Pooling das Mittel je Scheibe), Urteile laufen über
  zwei Ebenen (`levels.ts`: Vortest auf Wandern der Abende mit `WANDER_ALPHA` 0,25, ohne Wandern alle Schüsse, sonst
  jeder Abend; `compareValues`, `positionOverTime`, `compareCenterGroups`). Ein Schnitt über mehrere Scheiben
  (`periodTrend`, R8) nimmt dieselbe Regel. Familie, Woche, Monat und Tag
  wählt der Aufrufer, denn die Anzeige-Zeitzone liegt in der App. Eine Scheibe nur mit Probe zählt nur mit
  `includeProbeOnly`, dann als Training (`asOnPrintout` → `probeOnlyAsMatch`, `metrics`), dieselbe Regel wie auf der Seite einer
  Scheibe (shot-ui ergänzt nur `fromProbe`). Welche Schüsse zählen, sagt `cardShots` (`analysis/card-shots.ts`,
  nicht exportiert): Registry-Kennzahlen über die Wertung, Auswertungen mit eigenen Nummern über die ganze
  Karte.
- **Ehrlich statt scheingenau.** Unsicherheit nur mit einem anerkannten Verfahren (Wilson, χ²,
  Hotelling mit F(2, n − 2), Mann-Kendall mit Bindungskorrektur über die Normalnäherung, Ausreißer
  schrittweise als verallgemeinerter ESD nach Rosner, je Schritt der weiteste gegen die übrigen mit
  F(2, 2(m − 2)), Bonferroni und α 0,04, Form mit Mauchly, Zahlen über einen Zeitraum über zwei Ebenen mit Vortest
  (Bancroft, belegt in B19, B25, B28, B29), ohne Streuung der Schusswerte Mann-Whitney, genau ausgezählt bis 20 Scheiben
  je Seite, Wirkung einer Pause mit dem exakten Permutationstest auf den Unterschied
  der Mittel, bei m Pausen 0,05/m); Aussagen wie „echt“ oder „klar“ nur über der
  Grenze, sonst kein Urteil. Ein Urteil und die Zahl daneben dürfen sich nicht
  widersprechen (der Trend ist nur „klar“, wenn die Gerade dieselbe Richtung zeigt wie der Test; ein
  Vergleich ist nur „höher“ oder „tiefer“, wenn Rangtest und Mittel dieselbe Richtung zeigen). Unter
  der Mindestzahl `null`. Testwerte aus Tabellen oder Hand-Rechnung, nicht aus der eigenen
  Implementierung; Testdaten symmetrisch und ganzzahlig, wenn sie einen Schwerpunkt in der Mitte
  brauchen (`Math.round` rundet −x,5 anders als x,5).
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
