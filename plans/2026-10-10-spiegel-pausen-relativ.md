# Pausen relativ zum eigenen Takt

## Kontext

Der User (10. Oktober 2026): In den eigenen Scheiben sieht man im Timing oft Abstände, die deutlich länger sind als
der Durchschnitt, aber nicht als Pause gelten, weil sie unter der festen Schwelle liegen. Heute ist eine Pause jeder
Abstand über 180 s (`PAUSE_THRESHOLD_MS`, `shot-core/time.ts`, SF-62).

An den 30 echten LP-Scheiben des Users (906 Abstände, Median je Scheibe 25 bis 52 s):

| Regel | Pausen | Befund |
| --- | --- | --- |
| fest 180 s (heute) | 3 | nur 220 s und mehr |
| 2,5-fach des eigenen Medians | 10 | 129 bis 311 s, dazu 85 s bei einem Median von 33 s |
| Tukey „weit außen“ (Q3 + 3·IQR) | 37 | schon 54 bis 70 s: der Takt ist so gleichmäßig, dass kleine Ausreißer auffallen |

Die relative Regel findet genau die Abstände, die dem User auffielen (146 s, 165 s, 166 s, 171 s bei rund 40 s Takt).
An der LP 60 zeigt sie eine Pause nach jeder Zehnerserie (vor Schuss 11, 21, 31).

## Ansatz

- **Regel an einer Stelle** (`shot-core/time.ts`):
  - Pause ist ein Abstand über der Schwelle der Schussfolge.
  - Schwelle = das 2,5-Fache (`PAUSE_FACTOR`) des Medians der Abstände bis 180 s, mindestens 60 s (`PAUSE_MIN_MS`),
    höchstens 180 s (`PAUSE_ALWAYS_MS`: darüber ist es wie bisher immer eine Pause).
  - Unter 5 Abständen (`PAUSE_MIN_INTERVALS`) gilt nur die feste Grenze von 180 s.
  - `pauseThresholdMs(gapsMs)` und `gapsOf(times)`; `tempo(times, thresholdMs?)` nimmt die Schwelle und gibt sie
    zurück.
- **Eine Schwelle je Scheibe:** Eine Auswahl (eine Serie, die Wertung) nimmt die Schwelle aus dem Takt der ganzen
  Karte in den Arten der Auswahl (`pauseThresholdOf(shots, context)` in `metrics.ts`). So sieht eine Serie dieselben
  Pausen wie die Scheibe.
  - Z1 (Tempo) und Z2 (Tempo-Streuung) bekommen Version 3.
  - Z4 (Pausen und Wiedereinstieg) und Z5 (Rhythmus) nehmen dieselbe Schwelle (`timing.ts`).
- **Oberfläche** (`shot-ui`):
  - Reiter „Zeit“: Die Karte „Pausen und Wiedereinstieg“ nennt die Schwelle („Pause: mehr als 1:45 min, das
    2,5-Fache deines Takts von 42 s“), ohne Pause „Keine Pause“.
  - Der Rhythmus sagt „Pausen zählen nicht hinein“.
  - Schusstabelle: eine Pause (mit derselben Schwelle) als m:ss mit „Pause“, andere Abstände in Sekunden (nach dem
    Review so entschieden: m:ss heißt Pause, wie im Reiter „Zeit“).
- **Hilfe** (`shot-help`): Definition in „Tempo“, „Rhythmus“, „Pausen und Wiedereinstieg“ neu, Leitfaden neu
  erzeugt.
- **Vault:** `spiegel-metrics.md`, SF-62 in `spiegel-edge-cases.md`, Z1/Z4/Z5 in `spiegel-statistics.md`.

## Dateien

- `packages/shot-core/src/time.ts`, `time.test.ts`, `metrics.ts` (nur `pace`, `pauseThresholdOf`, Versionen Z1/Z2),
  `metrics.test.ts`, `analysis/timing.ts`, `analysis/timing.test.ts`, `CLAUDE.md`
- `packages/shot-ui/src/shots.ts` (Pausen je Schuss für die Tabelle), `table/ShotTable.tsx`,
  `analysis/tabs/TimeTab.tsx` und Tests
- `packages/shot-help/src/topics.ts`, erzeugter Leitfaden im Vault
- `tools/labor/pruefung.js` (Prüfungen zu Pausen)
- Vault-Notes wie oben

## Required Docs

- `packages/shot-core/CLAUDE.md` (Kennzahlen, `version`, Ehrlich statt scheingenau, Simulation), `packages/shot-ui/CLAUDE.md`,
  `vault/conventions.md`, `vault/spiegel/spiegel-statistics.md` (Z1–Z5)

## Tests

- `time.test.ts`:
  - Schwelle nach Handwerten (Median 40 s → 100 s; Median 20 s → 60 s; Median 90 s → 180 s);
  - unter 5 Abständen 180 s;
  - eine Pause zählt nicht in den Median;
  - Rücksprung und Lücke wie bisher.
- `metrics.test.ts`: Eine Serie nimmt die Schwelle der ganzen Karte; Gegenprobe mit der Schwelle aus der Serie allein
  ergibt ein anderes Tempo.
- `timing.test.ts`: Z4 erkennt eine Pause von 2:00 min bei 40 s Takt, Z5 markiert sie, Wiedereinstieg wie bisher.
- shot-ui: Tabelle markiert die Pause, Reiter „Zeit“ nennt die Schwelle.
- Labor: an der echten LP 60 drei Pausen (vor Schuss 11, 21, 31).

## Verifikation

- `pnpm check` grün.
- Labor gebaut, Skriptprüfung 0 FAIL.
- Sichtprüfung: Reiter „Zeit“ an der echten LP 60.
- Artifact neu veröffentlicht.
