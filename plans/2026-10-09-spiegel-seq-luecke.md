# Plan: Eine späte Probe ist keine Lücke

- **Anlass:** Befund aus der Session „Schießanlage-Datenerfassung und Visualisierung“ (9. Oktober 2026): `seq`
  läuft über Probe und Wertung. Eine Probe nach dem ersten Wertungsschuss lässt in der Liste nur der Wertung
  einen Sprung in `seq`, und `stepsInOrder` hält jeden Sprung für einen fehlenden Schuss (Regel aus SF-30). Der
  Abstand über die Probe wird `null`; eine Pause darüber sehen weder Pausen (Z4) noch Rhythmus (Z5) noch die
  `time.*`-Kennzahlen.
- **Branch:** `feat/spiegel-seq-luecke` auf `main` (f6db751), im Worktree `.claude/worktrees/spiegel-seq-luecke`
  (die andere Session arbeitet im Haupt-Checkout).
- **Sonderfälle:** SF-04 („Zurück von Wertung auf Probe“: verdreht Intervalle und Pausen) und SF-30 (Abgabefolge,
  fehlender Schuss).

## Kontext

Belegt mit drei Tests, die heute rot sind (Commit nach diesem Plan, als `it.fails`):

| Test | Fall | heute |
|---|---|---|
| `timing.test.ts` „… (ganze Karte)“ | `pauseRecovery` über die ganze Karte: 10 Wertung, 300 s Pause zwischen 6 und 7, eine Probe darin (seq 7, 460 s) | `pauses` 0 statt 1 |
| `timing.test.ts` „… (nur Wertung)“ | dieselbe Karte, nur die Wertung (wie `base`) | `pauses` 0, Rhythmus ohne Pause vor 7 |
| `TimeTab.test.tsx` „… verdeckt die Pause nicht“ | Beispielkarte „40 Schuss“, Probe in der Pause vor Wertungsschuss 21 | keine Pausenlinie statt `[21]` |

Wichtig für die Lösung: Auch **über die ganze Karte** verschwindet die Pause. `pauseRecovery` wählt erst die
Wertung aus und prüft dann die Lücken; die Probe ist zu dem Zeitpunkt schon weg. Eine Liste allein kann nicht
unterscheiden, ob seq 7 eine Probe war oder ein verlorener Schuss. Die Regel braucht also die ganze Karte.

Betroffen sind alle Stellen, die Abstände über eine Auswahl nur einer Art rechnen:

- `analysis/timing.ts`: `pauseRecovery` (Z4), `rhythmProfile` (Z5), `tempoSpread` (Z2);
- Registry: `time.intervalMedian` (Z1), `time.tempoSpread` (Z2), `time.duration` (Z3, nur über den Uhrsprung);
- `analysis/position.ts`: `drift` (ein Sprung über eine Lücke zählt nicht);
- shot-ui: Reiter Zeit (Verlauf mit Pausenlinien, Rhythmus, Tempo, Pausen), Reiter Lage (Drift), Überblick
  (Tempo-Kachel), Beobachtungen (Pausen, Tempo), Kacheln an der Scheibe (Tempo, Hinweis „1 Pause über 3 min
  nicht gezählt“ bei Auswahl „ohne Probe“);
- Zeitraum: `cardValues` rechnet Kennzahlen über die Wertung einer Karte.

Nicht betroffen: `sighterSummary` (nur die Probe vor der Wertung, also lückenlos), die Simulationen in
`shot-help/scripts/simulate.ts` (Karten ohne Probe zwischen Wertungsschüssen; Ergebnisse bleiben gleich, kein neuer
Lauf nötig), `shotIntervals` der Schusstabelle (rechnet schon über die ganze Karte, siehe D4).

## Entscheidungen

- **D1 Wie zählt der Abstand über eine Probe? (vom User zu entscheiden; Empfehlung A)**

  Beispiel: Wertung 6 bei 210 s, Probe bei 460 s, Wertung 7 bei 510 s.

  | | Regel | Pause vor Schuss 7 | Probe mitten im Takt (20 s + 25 s) |
  |---|---|---|---|
  | **A (empfohlen)** | Ein Sprung, den auf der Karte nur Schüsse der anderen Art füllen, ist **keine Lücke**. In der Auswahl „ohne Probe“ gilt der Abstand von Wertungsschuss zu Wertungsschuss. | ja, 300 s | 45 s zählt ins Tempo |
  | B | wie A, aber ein solcher Abstand bis 180 s zählt **nicht** ins Tempo (er umfasst zwei Schussabstände); nur Pausen | ja, 300 s | zählt nicht |
  | C | Abstände immer zum vorigen Schuss der Karte, wie die Schusstabelle; eine Pause vor einer Probe geht an den nächsten Wertungsschuss | ja, 250 s | 25 s zählt |

  Begründung für A: „Ohne Probe“ heißt, die Probe gehört nicht zur Folge, die ausgewertet wird. Die Zeit
  dafür ist Zeit zwischen zwei Wertungsschüssen, wie Absetzen oder Durchatmen. Die Lückenregel aus SF-30 ist für
  **unbekannte** Daten da (der Schuss fehlt, seine Zeit fehlt); hier ist nichts unbekannt. A ist eine Regel
  ohne dritte Sorte von Abstand (B bräuchte im Rhythmus eine Säule, die weder Takt noch Pause ist), und eine
  Pause mit Probeschüssen danach (Unterbrechung, dann Probe, dann weiter) bleibt als eine Pause vor dem nächsten
  Wertungsschuss sichtbar. Der Preis: Eine einzelne Probe mitten im Takt macht einen Abstand im Tempo länger
  (er umfasst zwei Schussabstände); bei 40 Schuss ist das einer von 39 Abständen.

  Weiter gilt: Fehlt der Karte eine Nummer ganz, oder liegt dazwischen ein Schuss **derselben** Art, der der
  Auswahl nur fehlt (ohne Zeit, Platzhalter), bleibt es eine Lücke. Eine Auswahl mit beiden Arten hat keine
  „andere Art“; für sie ändert sich nichts.

  Der Plan beschreibt A. Bei B oder C ändern sich Task 1 (Regel), die Handwerte in Task 1–3 und die Hilfe
  (Task 5); die Verdrahtung (Task 2–4) bleibt.

- **D2 Woher kommt die Karte? (Empfehlung, keine Rückfrage nötig)**
  - `stepsInOrder` und die Helfer darüber nehmen einen optionalen **Kontext** `{ card, kinds }`: die ganze Karte
    und die Arten der Auswahl. Ohne Kontext ist jeder Sprung eine Lücke, wie heute; bestehende Aufrufe und Tests
    bleiben gültig.
  - Die Arten kommen aus der **Auswahl vor dem Filtern nach Angaben**, nicht aus den Schüssen mit Zeit: Fehlt
    in „alle mit Probe“ jeder Probe die Zeit, ist die Probe trotzdem Teil der Auswahl und keine durchlässige
    andere Art. Dafür `contextOf(selection, card)`.
  - Die Auswertungen bekommen einen optionalen letzten Parameter `card` (Standard: die gegebenen Schüsse),
    `computeMetric(metric, shots, card?)` ebenso; `compute` bekommt den Kontext als zweites Argument.
  - shot-ui: `AnalysisInput.card` = die ganze Karte in der Form von `base` (bei nur Probe `base` selbst). Jeder
    Aufruf, der Abstände rechnet, gibt sie mit.
- **D3 Eine Regel überall:** Pausen, Rhythmus, Tempo, Dauer, Drift, der Hinweis der Kacheln und die Werte im
  Zeitraum folgen derselben Regel. Die drei `time.*`-Kennzahlen steigen auf Version 2 (die Formel hängt jetzt
  vom Kontext ab).
- **D4 Nicht im Umfang:** die Schusstabelle. Sie zeigt den Abstand zum vorigen Schuss **der Karte**, auch bei
  Auswahl (bewusste Regel in `shotIntervals`); bei „ohne Probe“ steht die Pause dann auf der ausgeblendeten
  Probezeile, Schuss 7 zeigt 50 s. Ob die Tabelle bei einer Auswahl der Regel aus D1 folgen soll, ist eine eigene
  Frage, falls gewünscht ein Folgeplan.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/metrics.ts` | `ShotContext`, `contextOf`, `stepsInOrder`/`shotSteps`/`timesInOrder`/`timesWithGaps` mit Kontext, `compute(shots, context)`, `computeMetric(…, card?)`, `time.*` Version 2, Kopfkommentar |
| `packages/shot-core/src/metrics.test.ts` | Regel und Registry mit Handwerten |
| `packages/shot-core/src/analysis/timing.ts` (+ Test) | `card` in `pauseRecovery`, `rhythmProfile`, `tempoSpread`; Kopfkommentar |
| `packages/shot-core/src/analysis/position.ts` (+ Test) | `card` in `drift` |
| `packages/shot-core/src/analysis/period.ts` (+ Test) | `cardValues` mit `whole` als Karte |
| `packages/shot-ui/src/analysis/input.ts` (+ neuer Test) | `card` |
| `packages/shot-ui/src/analysis/tabs/TimeTab.tsx` (+ Test), `tabs/PositionTab.tsx` | Karte mitgeben |
| `packages/shot-ui/src/analysis/charts/CourseChart.tsx`, `charts/RhythmChart.tsx` | Prop `card` |
| `packages/shot-ui/src/analysis/observations.ts`, `overview.ts` (+ Test) | Karte mitgeben |
| `packages/shot-ui/src/metrics/MetricTiles.tsx` (+ Test) | Kennzahlen und Pausen-Hinweis mit Karte |
| `packages/shot-help/src/topics.ts` | je ein Satz bei Tempo und Pausen |
| `vault/spiegel/spiegel-edge-cases.md`, `vault/spiegel/spiegel-metrics.md` | SF-04, Tempo |
| `packages/shot-core/CLAUDE.md`, `packages/shot-ui/CLAUDE.md` | Regel, Exporte |

## Required Docs

- `packages/shot-core/CLAUDE.md` (Regeln „Reihenfolge ist die Abgabefolge“, „Auswertungen wählen wie die
  Registry“, „Kennzahlen nur über `defineMetric`“, „Ehrlich statt scheingenau“: Handwerte)
- `packages/shot-ui/CLAUDE.md` (Analyse über `analysisInput`, Markup-Tests)
- `tools/labor/CLAUDE.md` (Prüfung `pruefen`, 0 FAIL)
- `vault/spiegel/spiegel-edge-cases.md` (SF-04, SF-30, Leitregel 2)
- `vault/conventions.md` §9 („`toBeCloseTo` nimmt `null` als 0“, „Eigenschaftstests per Mutation gegenprüfen“)

## Aufgaben

### Task 1: Die Regel im Fachkern (`metrics.ts`)

1. Nach `ShotStep` einfügen:

   ```ts
   /** Woher eine Auswahl stammt: die ganze Karte und die Arten der Auswahl (SF-04) */
   export interface ShotContext {
     card: readonly MetricShot[]
     kinds: readonly ShotKind[]
   }

   /**
    * Kontext einer Auswahl aus einer Karte. Die Arten kommen aus der Auswahl selbst, vor jedem Filter nach
    * Angaben: Eine Probe ohne Zeit in „alle mit Probe“ bleibt Teil der Auswahl.
    */
   export function contextOf(
     selection: readonly MetricShot[],
     card: readonly MetricShot[]
   ): ShotContext {
     return { card, kinds: [...new Set(selection.map((shot) => shot.kind))] }
   }
   ```

2. `stepsInOrder` ersetzen (Doc-Kommentar ergänzen um den Absatz zu `context`):

   ```ts
   /**
    * … (bisheriger Text) …
    * Mit `context` ist ein Sprung in `seq`, den auf der Karte nur Schüsse einer Art füllen, die die Auswahl
    * nicht hat, keine Lücke (SF-04: eine Probe zwischen zwei Wertungsschüssen). Fehlt der Karte eine Nummer
    * oder liegt dazwischen ein Schuss einer Art der Auswahl (ohne Zeit, Platzhalter), bleibt es eine. Ohne
    * `context` ist jeder Sprung eine Lücke.
    */
   export function stepsInOrder(ordered: readonly MetricShot[], context?: ShotContext): ShotStep[] {
     const withSeq = ordered.every((shot) => finite(shot.seq))
     // Nummern, die keine Lücke aufreißen: Schüsse der Karte einer Art, die die Auswahl nicht hat
     const others = new Set(
       (context?.card ?? [])
         .filter((shot) => !context?.kinds.includes(shot.kind) && finite(shot.seq))
         .map((shot) => shot.seq as number)
     )
     const filled = (from: number, to: number) => {
       if (to - from - 1 > others.size) return false
       for (let seq = from + 1; seq < to; seq++) if (!others.has(seq)) return false
       return true
     }
     return ordered.map((shot, i) => {
       const from = ordered[i - 1]?.seq as number
       const to = shot.seq as number
       return { shot, gapBefore: withSeq && i > 0 && to - from > 1 && !filled(from, to) }
     })
   }
   ```

3. Durchreichen: `shotSteps(shots, context?)`, `timesWithGaps(shots, context?)`, `timesInOrder(ordered,
   context?)` geben `context` an `stepsInOrder` weiter. `pace(shots, context?)` ebenso.
4. `MetricDefinition.compute`: `(shots: readonly MetricShot[], context: ShotContext) => number | null`, im
   Doc-Kommentar: „`context`: Karte und Arten der Auswahl, für Abstände (SF-04)“. Die drei `time.*` rechnen mit
   `pace(shots, context)`, alle anderen ignorieren das Argument (keine Änderung nötig, TypeScript erlaubt das).
5. `computeMetric(metric, shots, card = shots)`: `metric.compute(eligible, contextOf(shots, card))`. Doc:
   „`card`: die ganze Karte, aus der `shots` stammen; nur für Abstände (SF-04)“.
6. `time.intervalMedian`, `time.tempoSpread`, `time.duration`: `version: 2`.
7. Kopfkommentar Zeile 16: „Die Reihenfolge ist die Abgabefolge `seq`, nicht die Uhr (SF-30); eine Probe
   zwischen zwei Wertungsschüssen ist in einer Auswahl nur der Wertung keine Lücke (SF-04).“

**Tests** (`metrics.test.ts`, neuer `describe("Lücken in der Abgabefolge (SF-04, SF-30)")`), Hilfsschüsse
`at(seq, kind, s)` = `{ ...MATCH[0], seq, kind, series: kind === "match" ? 1 : null, firedAtMs: s * 1000 }`:

- Karte `CARD5`: Wertung seq 1 (0 s), 2 (40 s), Probe seq 3 (70 s), Wertung 4 (100 s), 5 (160 s);
  `MATCH4` = die vier Wertungsschüsse.
- `stepsInOrder(MATCH4).map((s) => s.gapBefore)` → `[false, false, true, false]` (ohne Kontext wie bisher).
- `stepsInOrder(MATCH4, contextOf(MATCH4, CARD5))` → `[false, false, false, false]`.
- Karte ohne seq 3 (`CARD5` ohne die Probe): mit Kontext → `[false, false, true, false]`.
- seq 3 ist ein Wertungsschuss ohne Zeit: `stepsInOrder(selectShots(inShotOrder(card), { kinds: ["match"], need:
  "time" }), contextOf(card.filter(match), card))` → Lücke vor seq 4.
- Auswahl beider Arten, die Probe ohne Zeit: `stepsInOrder(selectShots(inShotOrder(card), { need: "time" }),
  contextOf(card, card))` → Lücke vor seq 4 (die Probe gehört zur Auswahl).
- Riesiger Sprung (seq 1 und 1 000 000, eine Probe dazwischen): Lücke, ohne Schleife über eine Million.
- Registry, `time.intervalMedian` (Handwerte): `computeMetric(m, MATCH4)` → 50 (Abstände 40, 60);
  `computeMetric(m, MATCH4, CARD5)` → 60 (40, 60, 60); `computeMetric(m, CARD5)` → 35 (40, 30, 30, 60). Vorher je
  `not.toBeNull()`.
- `metricByKey("time.intervalMedian")?.version` usw. → 2.
- Mutation: `filled` testweise auf `return true` setzen → der Test „Karte ohne seq 3“ muss rot werden; auf
  `return false` → „mit Kontext“ rot. Danach zurück.

### Task 2: Auswertungen (`timing.ts`, `position.ts`, `period.ts`)

1. `timing.ts`:
   - `intervals(ordered, numbers, context?)` → `stepsInOrder(ordered, context)`.
   - `pauseRecovery(shots, scoring, card = shots)`: `intervals(selected, shotNumbers(shots), { card, kinds: MATCH
     })`. Doc: „`card`: die ganze Karte, aus der `shots` stammen; eine Probe zwischen zwei Wertungsschüssen ist
     keine Lücke (SF-04)“.
   - `rhythmProfile(shots, window = 5, card = shots)`: `intervals(timed(shots), shotNumbers(shots),
     contextOf(shots, card))`.
   - `tempoSpread(shots, card = shots)`: `tempo(timesInOrder(timed(shots), contextOf(shots, card)))`.
   - Kopfkommentar: „… fehlt ein Schuss oder springt die Uhr zurück, zählt der Abstand nicht (SF-30); eine Probe
     zwischen zwei Wertungsschüssen ist keine Lücke, wenn die Karte mitkommt (SF-04).“
2. `position.ts`: `drift(shots, card = shots)`: `stepsInOrder(selectShots(inShotOrder(shots), { need: "position"
   }), contextOf(shots, card))`; Doc-Satz zu SF-04.
3. `period.ts` `cardValues`: `const chosen = cardShots(…)`, `computeMetric(scored, chosen.match, chosen.whole)`.

**Tests:**

- `timing.test.ts`: die beiden `it.fails` werden `it`. „ganze Karte“ zusätzlich `totalPauseMs` → 300 000. „nur
  Wertung“ ruft `pauseRecovery(LATE_SIGHTER_MATCH, "decimal", LATE_SIGHTER)` (pauses 1, afterShot 7, deltaRings
  −4/7) und `rhythmProfile(LATE_SIGHTER_MATCH, 5, LATE_SIGHTER)[6]` → `{ number: 7, intervalMs: 300_000, pause:
  true, medianMs: 40_000 }`; ohne Karte bleibt `intervalMs` `null` (Standard unverändert).
  `tempoSpread(LATE_SIGHTER_MATCH, LATE_SIGHTER)` → n 8, IQR 10 000, Median 45 000 (wie `EVENING`).
- `position.test.ts`: vier Wertungsschüsse auf der x-Achse bei 0, 1000, 4000, 5000 µm (seq 1, 2, 4, 5), Probe seq 3.
  Schwerpunkt 2500; Σr² = 17 000 000 µm², durch 3. Sprünge 1000, 3000, 1000 µm.
  Mit Karte: (11 000 000/3) / (17 000 000/3) = **11/17**. Ohne Karte (Sprung über die Lücke fällt weg):
  (2 000 000/2) / (17 000 000/3) = **3/17**. Je `toBeCloseTo(…, 9)` nach `not.toBeNull()`.
- `period.test.ts`: eine `PeriodCard` mit `CARD5`-Schüssen, `cardValues([card], time.intervalMedian, "decimal")`
  → `value` 60, `n` 4.

### Task 3: shot-ui verdrahten

1. `analysis/input.ts`: Feld `card: readonly MetricShot[]` („die ganze Karte in der Form von `base`: bei nur
   Probe die Probe als Wertung; für Abstände, SF-04“); `card: match.length ? shots : base`.
2. `tabs/TimeTab.tsx`: `const { base, card, scoring } = input`; `rhythmProfile(base, 5, card)`,
   `tempoSpread(base, card)`, beide `computeMetric(…, base, card)`, `pauseRecovery(base, scoring, card)`;
   `CourseChart` und `RhythmChart` bekommen `card={card}`.
3. `charts/CourseChart.tsx`: Prop `card?: readonly MetricShot[]`, `pauseRecovery(shots, scoring, card)`.
   `charts/RhythmChart.tsx`: Prop `card?`, `rhythmProfile(shots, 5, card)`.
4. `tabs/PositionTab.tsx`: `drift(base, card)`.
5. `observations.ts`: `pauseRecovery(base, scoring, card)`, `tempoSpread(base, card)`.
6. `overview.ts`: `tempoSpread(base, card)`, `computeMetric(time.intervalMedian, base, card)`.
7. `metrics/MetricTiles.tsx`: `computeMetric(metric, selected, shots)`; Hinweis
   `tempo(timesInOrder(selectShots(inShotOrder(selected), { need: "time" }), contextOf(selected, shots)))`.
   (`eligibleShots` bleibt, das n hängt nicht an Abständen.)

**Tests:** gemeinsame Hilfe in `analysis/testCard.ts`: `withSighterAfter(card, matchNumber, atMs?)` setzt nach
Wertungsschuss `matchNumber` eine Probe (Lage wie der Schuss davor, ohne Serie, Zeit `atMs` oder die Mitte des
Abstands) und rückt `seq` danach um eins.

- `TimeTab.test.tsx`: `it.fails` → `it` (über `withSighterAfter(fortyCard(), 20, t20 + 200_000)`); dazu im
  Rhythmus `data-interval="21" data-pause="true"`.
- neu `analysis/input.test.ts`: gemischte Karte → `card` sind alle Schüsse; nur Probe → `card === base`.
- `overview.test.ts`: `withSighterAfter(fortyCard(), 5)` → die Tempo-Kachel zeigt den Wert von
  `computeMetric(time.intervalMedian, base, card)` (gerundet wie die Kachel), und der unterscheidet sich vom Wert
  ohne Karte (Probe-Rechnung vor dem Plan: 56 gegen 54 s).
- `observations`: im selben Test (oder `overview.test.ts`) mit der Probe in der Pause der Satz „nach der Pause
  vor Schuss 21“.
- `MetricTiles.test.tsx`: Probe in der Pause vor 21, Auswahl „ohne Probe“ → Tempo-Kachel mit „1 Pause über 3 min
  nicht gezählt“.

### Task 4: Hilfe und Doku

1. `packages/shot-help/src/topics.ts`:
   - Tempo (`what`, Zeile „Das Tempo ist der Median …“): anhängen „Schießt du zwischendurch Probe, zählt der
     Abstand von Wertungsschuss zu Wertungsschuss.“
   - „Pausen und Wiedereinstieg“ (`what`): anhängen „Probeschüsse in der Pause gehören zur Pause.“
2. `vault/spiegel/spiegel-edge-cases.md`, SF-04: Absicherung „Leitregel 2; in einer Auswahl nur der Wertung ist
   ein Sprung in `seq`, den nur Probe füllt, keine Lücke: Abstände und Pausen gelten von Wertungsschuss zu
   Wertungsschuss (`stepsInOrder` mit Kontext, 9. Oktober 2026)“; Prüfen „Schießprotokoll, Fixture, Tests in
   `metrics.test.ts` und `timing.test.ts`“.
3. `vault/spiegel/spiegel-metrics.md`, Abschnitt Tempo: nach „… trennt die Folge, statt eine falsche Pause zu
   erzeugen.“ den Satz „Eine Probe zwischen zwei Wertungsschüssen ist kein fehlender Schuss: Über die Wertung
   zählt der Abstand von Wertungsschuss zu Wertungsschuss (SF-04).“
4. `packages/shot-core/CLAUDE.md`: Exporte `metrics` um `contextOf`, `ShotContext`; Regel „Reihenfolge ist die
   Abgabefolge“ um „… zählt der Abstand daneben nicht; füllen den Sprung auf der Karte nur Schüsse der anderen
   Art (Probe zwischen Wertung, SF-04), ist er keine Lücke. Dafür braucht die Rechnung die ganze Karte: `card`
   bzw. `contextOf`.“
5. `packages/shot-ui/CLAUDE.md`: `analysis/input`-Zeile um `card`; Regel „Die Analyse rechnet über
   `analysisInput`“ um „Abstände (Pausen, Rhythmus, Tempo, Drift) bekommen `card` mit, damit eine späte Probe
   keine Lücke reißt (SF-04).“
6. `pnpm vault:lint` bzw. `/sync-graph`, falls die Vault-Notes Schema-Probleme melden.

### Task 5: Gate und Labor

1. `pnpm check` (alle fünf Gates grün).
2. `pnpm --filter @vereinsheim/labor pruefen` → „0 FAIL“. Die Beispiele haben keine Probe zwischen
   Wertungsschüssen, die Werte bleiben gleich; die Prüfung belegt, dass die Seite weiter läuft.

## Teststeps

| Schritt | Befehl | Erwartung |
|---|---|---|
| Regel | `pnpm --filter @vereinsheim/shot-core test -- metrics` | neue Fälle grün, Mutationen in Task 1 rot |
| Auswertungen | `pnpm --filter @vereinsheim/shot-core test -- timing position period` | grün, keine `it.fails` mehr |
| Bausteine | `pnpm --filter @vereinsheim/shot-ui test` | grün |
| Hilfe | `pnpm --filter @vereinsheim/shot-help test` | grün |
| Gate | `pnpm check` | 5 von 5 grün |
| Labor | `pnpm --filter @vereinsheim/labor pruefen` | 0 FAIL |

## Verification

- Die drei Tests aus „Kontext“ sind `it` und grün; ohne Karte verhalten sich alle Funktionen wie vorher (die
  bestehenden Tests laufen unverändert).
- `grep -n "it.fails" packages/shot-core/src packages/shot-ui/src -r` liefert nichts.
- Jeder Aufruf von `pauseRecovery`, `rhythmProfile`, `tempoSpread`, `drift` und `computeMetric` mit `time.*` in
  shot-ui gibt die Karte mit (`grep` über die Namen, Liste im Validierungsbericht).
- Validierungsbericht `reports/2026-10-09-spiegel-seq-luecke.md` mit der Entscheidung D1 und den Handwerten.

## Nachtrag nach dem Review (9. Oktober 2026)

- **Nur die Probe ist durchlässig.** Task 1 machte jeden Schuss einer Art durchlässig, die die Auswahl nicht hat. In
  einer Auswahl der Probe wurden damit Wertungsschüsse zwischen früher und später Probe zu keiner Lücke, und aus
  der Wertung wurde eine Pause der Probe. Freigegeben war „Füllen nur Probeschüsse den Sprung …“, deshalb zählen
  jetzt nur Probeschüsse und nur in einer Auswahl ohne Probe (`stepsInOrder`, Test „nur die Probe ist
  durchlässig“).
- **Gegenprobe der Regel:** Test „Probe vorn füllt keine fremde Lücke“. Er wird rot, wenn `filled` nur die Anzahl
  der Probeschüsse prüft statt ihrer Nummern.
- **Übergaben in shot-ui einzeln abgesichert:** Drift (Reiter Lage), Median und Tempo-Streuung (Reiter Zeit),
  Pausen-Karte, Tempo-Satz der Beobachtungen; jede zurückgenommene Übergabe macht einen Test rot.
- **Labor-Prüfung** rechnet Kacheln und Drift mit der Karte nach, wie die Bausteine.
