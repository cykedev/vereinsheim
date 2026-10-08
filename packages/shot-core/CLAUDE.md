# @vereinsheim/shot-core — Claude Scope-Notiz

Fachkern von Spiegel (SP-1.1, Oktober 2026): Scheibenbilder als Daten, Wertung wie Meyton,
Meyton-Disziplinen und die Gegenprobe; seit SP-1.2 auch Geometrie, Tempo und die
Kennzahlen-Registry, seit SP-1.10 die Analyse einer Scheibe (`stats`, `analysis`). Reine Funktionen ohne Dependencies, isomorph (Server und Client). Noch hängt
keine App daran; der Spiegel-Ingest (SP-1.6) und die Ansichten (SP-1.8) bauen darauf auf.
Fachwissen: `vault/spiegel/spiegel-target-library.md`, `vault/spiegel/spiegel-metrics.md`,
`vault/spiegel/spiegel-statistics.md` (Katalog), Sonderfälle: `vault/spiegel/spiegel-edge-cases.md`.

## Exporte

| Export                              | Datei               | Inhalt                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vereinsheim/shot-core/units`      | `src/units.ts`      | `mmToUm` (ganze µm oder Fehler)                                                                                                                                                                                                                                                        |
| `@vereinsheim/shot-core/targets`    | `src/targets.ts`    | `defineTarget`, `LG_10M`, `LP_10M`, `TARGETS`, `MAX_DECIMAL_TENTHS`                                                                                                                                                                                                                    |
| `@vereinsheim/shot-core/scoring`    | `src/scoring.ts`    | `scoreFromCoordinates`, `scoreFromDistance`, `distanceUm`, Teiler                                                                                                                                                                                                                      |
| `@vereinsheim/shot-core/discipline` | `src/discipline.ts` | `parseDisciplineId`, `resolveTarget`, `suggestFamily`, Vollständigkeit                                                                                                                                                                                                                 |
| `@vereinsheim/shot-core/verify`     | `src/verify.ts`     | `checkShot`, `verifyCard`, `suggestTargets`, `rescore` (Neu-Wertung)                                                                                                                                                                                                                   |
| `@vereinsheim/shot-core/geometry`   | `src/geometry.ts`   | Schwerpunkt, Streukreis, `extremeSpread`, Radien, Streuung, Ellipse                                                                                                                                                                                                                    |
| `@vereinsheim/shot-core/time`       | `src/time.ts`       | `tempo` in Abgabefolge: Intervalle, Pausen über 180 s, Lücken, Uhrsprünge                                                                                                                                                                                                              |
| `@vereinsheim/shot-core/metrics`    | `src/metrics.ts`    | `defineMetric`, `METRICS`, `metricByKey`, `computeMetric`, `eligibleShots`, `selectShots`, `inScoring`, `inShotOrder`, `shotNumbers`, `shotSteps`, `stepsInOrder`, `timesWithGaps`, `timesInOrder`, `shotDistanceUm`, `FLAG_*`                                                         |
| `@vereinsheim/shot-core/stats`      | `src/stats.ts`      | Quantil, Median, MAD, IQR, Wilson, lnΓ, c4, χ²- und F-Quantile, Theil-Sen, Mann-Kendall, Ausgleichsgerade, Mann-Whitney, zweiseitiges p der Normalverteilung                                                                                                                           |
| `@vereinsheim/shot-core/analysis`   | `src/analysis/*.ts` | Analyse einer Scheibe: Ergebnis, Präzision, Lage, Zeit, Verlauf, Probe, Datenlage; über viele Scheiben (`period.ts`: Werte je Scheibe, Verlauf, Formband, Boden und Decke, Umfang, Vergleich, eigener Schnitt) und Rekorde (`records.ts`); `ANALYSIS_CATALOG` (Funktion → Katalog-IDs) |

## Regeln

- **Ganze Mikrometer.** Scheibenbilder in mm notieren und nur über `defineTarget` anlegen; es prüft,
  dass jede Zehntelgrenze auf einem ganzen µm liegt. Neue Scheiben nur mit Quelle (Sportordnung).
- **Exakte Wertung, kein Epsilon.** `scoring.ts` vergleicht ganzzahlig (x² + y² gegen b(k)², Abstand
  auf 0,01 µm gerundet). Die naive Formel `floor((11 − d ÷ W) · 10)` liegt an neun Grenzen je Scheibe
  einen Zehntel zu tief (Test „Grenzen“).
- **Disziplinen über die ganze DisziplinID** (Regelnummer und Schusscode), nie über Regelbereiche
  allein: 0610 ist LP Liga und ISSF-Luftgewehr-Finale, 0100 die französische Luftpistole (SF-70).
  Danach der Name (ganzes Wort LG/LP), dann unbekannt. Der Katalog nennt nur Regeln, er schreibt die
  Meyton-Liste nicht ab (urheberrechtlich geschützt).
- **Die Schusszahl ist ein Hinweis** (SF-09): 000 offen, über 100 kein verlässlicher Hinweis. Gegen
  sie zählen nur Wertungsschüsse (SF-02).
- Kein `server-only`, keine Node-APIs, kein `"use server"`; Just-in-time wie `packages/lib`. Eine
  Next-App, die das Paket nutzt, braucht es in `transpilePackages` (`packages/config/next/index.mjs`).
- Bekannte Disziplinen mit eigener Scheibe stehen als Nullzeile im Katalog (`target: null`) und bleiben
  unbekannt, bis die Bibliothek ihre Scheibe kennt.
- Was nicht hier liegt: Zeichnen (`shot-ui`, SP-1.8), die Skalen der SSMDB2-Felder (Adapter in
  SP-1.6).
- **Kennzahlen nur über `defineMetric`**, mit Katalog-ID (`catalogId`), Test und festem Erwartungswert
  (nicht nur „nicht null“).
  Ändert sich eine Formel, steigt ihre `version`. `computeMetric` wendet die Regeln aus dem
  Sonderfall-Katalog an: `appliesTo` (SF-01), `needs` mit gültigen, endlichen Angaben, `onMissing`
  („null“ für Summen und Zählungen, SF-07), `minShots` (SF-61), Fehlschüsse nur bei `excludeMisses`
  (SF-14), verdächtige Schüsse nur mit ihrem Wert (SF-15). `nSensitive` ist ein Hinweis für Vergleiche
  (SF-60), das n liefert `eligibleShots`. `compute` nie direkt aufrufen.
- **Reihenfolge ist die Abgabefolge** (`seq`, SF-30): `inShotOrder`; `tempo` erwartet die Zeiten in
  Abgabefolge und zählt einen Rücksprung der Uhr weder als Intervall noch als Pause; fehlt ein Schuss
  mitten in der Folge (Sprung in `seq`), zählt der Abstand daneben nicht.
- **`toBeCloseTo` nimmt null als 0.** Wo eine Kennzahl 0 ergeben soll, erst `not.toBeNull()` prüfen
  (Helfer `expectNear` in `metrics.test.ts`).
- **Ganze Ringe und Zehntel sind immer umschaltbar.** Jede wertbasierte Kennzahl gibt es in beiden
  Wertungen (`scoring` + `counterpart`, gleiche Regeln), `inScoring` wählt; ein Registry-Test erzwingt
  das Paar. Ausnahme sind nur Zehner, Innenzehner und die Zehnerquote, die in beiden Wertungen gleich sind. Ganze Ringe
  brauchen nur `ring` (`needs: "ring"`), Zehntel den Zehntelwert (SF-18). Wertbasierte Auswertungen in
  `analysis/*` nehmen `scoring` als Pflichtparameter (`analysis/values.ts`); Schwellen stehen in
  Zehnteln (100 = 10,0). Nur die Zehntelverteilung gibt es allein in Zehnteln.
- **Auswertungen wählen wie die Registry.** `analysis/*` nutzt `selectShots` und `shotSteps`/
  `timesWithGaps`, keine eigene Filter- oder Lückenlogik; welche Schüsse gemeint sind (Wertung, eine
  Serie, die Probe), wählt der Aufrufer. Schussnummern kommen immer aus `shotNumbers` (je Art, über
  alle gegebenen Schüsse), nie aus Positionen in einer gefilterten Liste. Erst die ganze Karte ordnen
  (`inShotOrder`), dann auswählen, und Abstände über `stepsInOrder`/`timesInOrder`: So folgen
  Reihenfolge und Nummern derselben Ordnung, auch wenn einem Schuss Abgabefolge und Zeit fehlen.
- **Keine Zahl, die aus einer anderen folgt** (Oktober 2026, Maßstab Sa): Eine Kennzahl oder Auswertung
  bleibt nur, wenn sie eine eigene Frage beantwortet. Was sich aus einer anderen ergibt (Sa aus σ, Ringverlust
  aus dem Ergebnis, Netto-Zeit aus den Abständen, bester Schuss aus dem besten Teiler), fällt weg. Im Katalog
  bleibt die Zeile mit „entfernt“ und Grund; IDs werden nie wiederverwendet. Ein Wert, den eine Stichprobe
  an sich selbst misst (Lage-Verlust), wird außerhalb der Stichprobe geschätzt (Leave-one-out).
- **Neue Auswertung, neuer Katalog-Eintrag:** Jede exportierte Funktion aus `./analysis` steht mit ihren
  Katalog-IDs in `ANALYSIS_CATALOG` (Test erzwingt das), und `@vereinsheim/shot-help` braucht für jede
  dieser IDs eine Erklärung (Test dort). Ohne Erklärung bleibt das Gate rot.
- **Simulation nachziehen:** Ändert sich eine Auswertung, die eine Zahl in einem Hilfetext belegt
  (Trend, Ringverlust, Ausreißer, Form, σ, Probe, Vergleich zweier Zeiträume, Formband),
  `pnpm --filter @vereinsheim/shot-help simulate`
  laufen lassen und den Block „Belege aus Simulationen“ in `vault/spiegel/spiegel-statistics.md` samt den
  zitierenden Texten angleichen. Das Gate prüft das nicht (Laufzeit, Zufallszahlen).
- **Über viele Scheiben** (Plan L2, Oktober 2026): Einheit ist die Scheibe. Werte je Scheibe kommen aus der
  Registry (`cardValues`), Tests laufen über Scheiben, nie über alle Schüsse. Familie, Woche, Monat und Tag
  wählt der Aufrufer, denn die Anzeige-Zeitzone liegt in der App. Eine Scheibe nur mit Probe zählt nur mit
  `includeProbeOnly`, dann über `cardShots` (`analysis/card-shots.ts`, nicht exportiert) wie
  `probeOnlyAsMatch` in shot-ui.
- **Ehrlich statt scheingenau.** Unsicherheit nur mit einem anerkannten Verfahren (Wilson, χ²,
  Hotelling mit F(2, n − 2), Mann-Kendall mit Bindungskorrektur über die Normalnäherung, Ausreißer
  schrittweise als verallgemeinerter ESD nach Rosner, je Schritt der weiteste gegen die übrigen mit
  F(2, 2(m − 2)), Bonferroni und α 0,04, Form mit Mauchly, Vergleich zweier Zeiträume mit Mann-Whitney,
  genau ausgezählt bis 20 Scheiben je Seite); Aussagen wie „echt“ oder „klar“ nur über der
  Grenze, sonst kein Urteil. Ein Urteil und die Zahl daneben dürfen sich nicht
  widersprechen (der Trend ist nur „klar“, wenn die Gerade dieselbe Richtung zeigt wie der Test; ein
  Vergleich ist nur „höher“ oder „tiefer“, wenn Rangtest und Mittel dieselbe Richtung zeigen). Unter
  der Mindestzahl `null`. Testwerte aus Tabellen oder Hand-Rechnung, nicht aus der eigenen
  Implementierung; Testdaten symmetrisch und ganzzahlig, wenn sie einen Schwerpunkt in der Mitte
  brauchen (`Math.round` rundet −x,5 anders als x,5).
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
