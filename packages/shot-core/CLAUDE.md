# @vereinsheim/shot-core — Claude Scope-Notiz

Fachkern von Spiegel (SP-1.1, Oktober 2026): Scheibenbilder als Daten, Wertung wie Meyton,
Meyton-Disziplinen und die Gegenprobe; seit SP-1.2 auch Geometrie, Tempo und die
Kennzahlen-Registry. Reine Funktionen ohne Dependencies, isomorph (Server und Client). Noch hängt
keine App daran; der Spiegel-Ingest (SP-1.6) und die Ansichten (SP-1.8) bauen darauf auf.
Fachwissen: `vault/spiegel/spiegel-target-library.md`, `vault/spiegel/spiegel-metrics.md`,
Sonderfälle: `vault/spiegel/spiegel-edge-cases.md`.

## Exporte

| Export                              | Datei               | Inhalt                                                                                                           |
| ----------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@vereinsheim/shot-core/units`      | `src/units.ts`      | `mmToUm` (ganze µm oder Fehler)                                                                                  |
| `@vereinsheim/shot-core/targets`    | `src/targets.ts`    | `defineTarget`, `LG_10M`, `LP_10M`, `TARGETS`, `MAX_DECIMAL_TENTHS`                                              |
| `@vereinsheim/shot-core/scoring`    | `src/scoring.ts`    | `scoreFromCoordinates`, `scoreFromDistance`, `distanceUm`, Teiler                                                |
| `@vereinsheim/shot-core/discipline` | `src/discipline.ts` | `parseDisciplineId`, `resolveTarget`, `suggestFamily`, Vollständigkeit                                           |
| `@vereinsheim/shot-core/verify`     | `src/verify.ts`     | `checkShot`, `verifyCard`, `suggestTargets`, `rescore` (Neu-Wertung)                                             |
| `@vereinsheim/shot-core/geometry`   | `src/geometry.ts`   | Schwerpunkt, Streukreis, `extremeSpread`, Radien, Streuung, Ellipse                                              |
| `@vereinsheim/shot-core/time`       | `src/time.ts`       | `tempo` in Abgabefolge: Intervalle, Pausen über 180 s, Lücken, Uhrsprünge                                        |
| `@vereinsheim/shot-core/metrics`    | `src/metrics.ts`    | `defineMetric`, `METRICS`, `metricByKey`, `computeMetric`, `eligibleShots`, `inScoring`, `inShotOrder`, `FLAG_*` |

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
- **Kennzahlen nur über `defineMetric`**, mit Test und festem Erwartungswert (nicht nur „nicht null“).
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
  das Paar. Ausnahme sind nur Zehner und Innenzehner, die in beiden Wertungen gleich sind. Ganze Ringe
  brauchen nur `ring` (`needs: "ring"`), Zehntel den Zehntelwert (SF-18).
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
