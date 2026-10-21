# Spiegel: Ein Tipp im Verlauf wählt die getroffene Scheibe

Branch `feat/spiegel-period-ruler-same-day`, Worktree `.claude/worktrees/spiegel-period-ruler-same-day`.

## Context

Im Fortschritt (`/progress`, „je Scheibe“) stehen die Scheiben eines Abends fast an derselben Stelle: x kommt aus der
Uhrzeit (`xTime(v.atMs)`), Minuten liegen Bruchteile eines Pixels auseinander, die Punkte (r 4,5) überdecken sich
waagrecht. Das Lineal (`useRuler` in `packages/shot-ui/src/analysis/charts/ChartRuler.tsx`) wählt nur nach x
(`nearestIndex` in `ruler.ts`). Ein Tipp auf einen von mehreren übereinanderliegenden Punkten wählt deshalb den, dessen
x zufällig am nächsten liegt, nicht den getroffenen. Nachgestellt am 21. Oktober 2026 mit dem Demo-Konto (1440 px): drei
Scheiben vom 25.09. bei x 691, y 421 / 451 / 558; ein Tipp auf die mittlere wählte die oberste. Die Skriptprüfung meldet
„FAIL Fortschritt: ein Tipp in den Verlauf wählt die Scheibe für Ablesung und Liste“.

## Approach

- **Zuerst x, dann y:** Ohne Höhen bleibt alles wie heute (alle anderen Diagramme, auch Treffsicher). Mit Höhen nimmt
  das Lineal den nach x nächsten Wert und dazu alle, deren x höchstens 4 px weiter weg ist (ein Punkt ist 9 px breit,
  näher beieinander überdecken sie sich); unter diesen gewinnt der nach y nächste, bei Gleichstand der frühere. So
  bleibt das Lineal ein senkrechter Strich, der beim waagrechten Ziehen wandert; nur in einem Stapel entscheidet die
  Höhe des Fingers. Verworfen: reiner 2-D-Abstand, weil dann beim Ziehen ein höherer Punkt weiter links den nächsten
  rechts überspringen könnte.
- **Tastatur bleibt in zeitlicher Folge** (`stepIndex` über die Indizes), auch durch einen Stapel.
- Nur der Verlauf eines Zeitraums gibt Höhen (`PeriodChart`, „je Scheibe“ und Vergleich); „je Monat“ nicht.

## Required Docs

- `packages/shot-ui/CLAUDE.md` (Karten und Diagramme der Analyse, Lineal; Seite eines Zeitraums)
- `apps/spiegel/CLAUDE.md` (Skriptprüfung)
- `vault/conventions.md` §9 (Markup-Tests ohne jsdom)

## Tasks

### T1 `ruler.ts`: nächster Wert mit Höhe

- `nearestIndex(xs, x, ys?, y?)`: ohne `ys` (oder ohne `y`) unverändert. Mit beiden: `best` wie heute; Kandidaten alle
  `i` mit `|xs[i] − x| ≤ |xs[best] − x| + SAME_X_PX` (`SAME_X_PX = 4`, exportiert); unter ihnen das kleinste
  `|ys[i] − y|`, bei Gleichstand der kleinere Index.
- `toSvgY(clientY, rect: { top; width }, width)`: wie `toSvgX`, mit demselben Maßstab (das SVG skaliert gleichmäßig,
  `h-auto w-full`).
- Tests in `ruler.test.ts` (Handwerte): `nearestIndex([100, 100.3, 100.6], 100.5, [20, 50, 80], 52)` → 1, ohne Höhen
  → 2; Abstand größer als 4 px: `nearestIndex([100, 110], 101, [80, 20], 20)` → 0 (x geht vor); Gleichstand in y →
  der frühere; `toSvgY(150, { top: 50, width: 300 }, 600)` → 200.

### T2 `useRuler`: Höhen optional

- `useRuler(xs, width, preset, onPick, ys?)`: `at(event)` gibt mit `ys` auch `toSvgY(event.clientY, …)` an
  `nearestIndex`. JSDoc: „`ys`: Höhen der Werte; liegen Werte waagrecht übereinander, wählt die Höhe des Zeigers“.
- Test in `ChartRuler.test.tsx`: die Signatur bleibt für die bestehenden Aufrufe gleich (Markup unverändert).

### T3 `PeriodChart`: Höhen an das Lineal

- Den Maßstab für y (`ys`, `lo`, `hi`, `step`, `yMin`, `yMax`, `y`) vor `useRuler` ziehen, als reine Funktion
  `valueScale(...)` in derselben Datei; Verhalten gleich (die bestehenden Markup-Tests und Snapshots bleiben grün).
- `useRuler(xs, width, preset, onPick, mode === "months" || !enough ? undefined : values.map((v) => y(v.value)))`.
- Test in `PeriodChart.test.tsx`: Markup unverändert (bestehende Tests), dazu ein Test für `valueScale` mit Handwerten,
  wenn sie exportiert wird; sonst keiner (Verhalten liegt in T1).

### T4 Skriptprüfung

- `apps/spiegel/tools/pruefen.ts`, Abschnitt „Fortschritt“: neue Prüfung „Fortschritt: ein Tipp auf eine von mehreren
  Scheiben eines Abends wählt genau sie“. Sucht im Verlauf einen Stapel (Punkte mit |Δx| < 4 px), tippt auf den
  mittleren oder unteren und prüft Ablesung und Liste. Ohne Stapel in den Daten: „nicht belegt“ melden.
- Die bestehende Prüfung „ein Tipp in den Verlauf wählt die Scheibe …“ muss wieder grün sein.

### T5 Doku

- `packages/shot-ui/CLAUDE.md`, Regel „Karten und Diagramme der Analyse“: ein Satz zu `ys` (Stapel im Verlauf eines
  Zeitraums wählt die Höhe des Zeigers).

## Test steps

- `pnpm --filter @vereinsheim/shot-ui test` nach T1 bis T3.
- `pnpm check` vor jedem Commit (Worktree: Node 24, `.env` verlinkt).

## Verification

- `pnpm check --force` grün.
- `pnpm --filter spiegel pruefen --start --alle` ohne FAIL (heute 1 FAIL).
- Im Browser (Demo-Konto, 1440 px): Tipp auf jeden der drei Punkte vom 25.09. wählt genau ihn; Pfeiltasten gehen in
  zeitlicher Folge durch den Stapel.
- Keine Texte, kein Textbuch nötig. Keine neue Brücke.
