# Plan: Diagramm-Lineal (Spiegel, L1 / SP-1.8 Schritt 5)

- Branch: `feat/spiegel-diagramm-lineal` (von `main` 6dd9e36)
- Grundlage:
  - [[spiegel-mobile]]: Prinzip 4 „Antippen ersetzt Hover“; Befund „Werte nur per Hover“; Empfehlung
    „Diagramme“
  - [[spiegel-langzeit]]: L1 als Voraussetzung für den Verlauf über Scheiben
- Anlass: User, 8. Oktober 2026: „plan für L1“.

## Kontext

Die Einzelwerte von Verlauf, Rhythmus, Zehntel-Säulen und Richtungsuhr stehen nur im SVG-`<title>`.
- Auf dem Telefon erscheinen sie nie, am Desktop nur beim Überfahren.
- `role="img"` verbirgt sie auch vor dem Screenreader.

Ringbalken und Serien-Diagramm schreiben ihre Werte schon als Text. Form, Probe auf der Scheibe und Lage-Pfad
sind Felder mit Punkten in der Ebene; bei ihnen ist die Lage selbst der Wert.

Der Verlauf über viele Scheiben (L3) braucht dasselbe Ablesen per Antippen und den Weg vom Punkt zur Scheibe.
Deshalb entsteht das Lineal als allgemeiner Baustein.

## Entscheidungen

- **D1 Welche Diagramme:**
  - Ein Lineal bekommen Verlauf (Wert je Schuss), Rhythmus (Abstand vor Schuss n) und Zehntel-Säulen (Schüsse
    je Zehntel).
  - „Werte als Tabelle“ bekommen diese drei und die Richtungsuhr.
  - Serien-Diagramm, Ringbalken und die Felder bleiben, wie sie sind.
- **D2 Geste:**
  - Tippen wählt den nächsten Wert, waagrechtes Ziehen wandert mit. Senkrecht scrollt die Seite weiter
    (`touch-action: pan-y`).
  - Ein zweites Tippen auf denselben Wert hebt die Wahl auf, wie auf der Scheibe.
  - Mit der Tastatur: Das Diagramm ist fokussierbar. Pfeil links und rechts wandern, Pos1 und Ende springen an
    die Ränder, Escape hebt auf.
- **D3 Werte fest über dem Diagramm:**
  - Eine Zeile mit fester Höhe steht über dem SVG, damit nichts springt.
  - Ohne Wahl zeigt sie den Hinweis „Tippe oder ziehe im Diagramm, um Werte abzulesen.“, mit Wahl die Werte,
    etwa „Schuss 23 · 9,7 · Schnitt der letzten zehn 9,52“.
  - Ein Wechsel wird Screenreadern gemeldet (`aria-live="polite"`).
  - Im Diagramm markiert eine senkrechte Linie die Stelle, der gewählte Punkt oder die Säule ist hervorgehoben.
- **D4 Kopplung an die Scheibe:**
  - Ziehen ändert die Scheibe nicht. Nach der Regel in `packages/shot-ui/CLAUDE.md` springt alles, was
    außerhalb der Scheibe die Scheibe ändert, zu ihr; bei jedem Ziehen spränge die Seite.
  - Die Zeile von Verlauf und Rhythmus hat deshalb den Knopf „Auf der Scheibe“. Er wählt den Schuss auf der
    Scheibe und springt mit Rücksprung („Zurück zu ‚Zeit und Verlauf‘“).
  - Umgekehrt: Ist auf der Scheibe ein Wertungsschuss gewählt, steht das Lineal in Verlauf und Rhythmus auf ihm.
- **D5 Werte als Tabelle:**
  - Zugeklappt unter dem Diagramm (`details`, „Werte als Tabelle“), für alle und für Screenreader.
  - Die Kernaussage trägt schon die Notiz unter jedem Diagramm (Trend, Median der Abstände), das SVG behält
    sein Label.
  - `<title>` entfällt dort, wo es ein Lineal gibt; bei der Richtungsuhr ersetzt die Tabelle es.
- **D6 Allgemein für später:** `useRuler` und die Zeile kennen nur eine Folge von x-Positionen. Der Verlauf
  über Scheiben (L3) nutzt sie wieder, dort mit „Scheibe öffnen“ statt „Auf der Scheibe“.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/analysis/charts/ruler.ts` | neu: `nearestIndex`, `stepIndex`, `toSvgX` (rein) |
| `packages/shot-ui/src/analysis/charts/ruler.test.ts` | neu |
| `packages/shot-ui/src/analysis/charts/Ruler.tsx` | neu: `useRuler`, `RulerReadout`, `RulerMark`, `ValuesTable` |
| `packages/shot-ui/src/analysis/charts/Ruler.test.tsx` | neu: Markup-Tests |
| `packages/shot-ui/src/analysis/charts/frame.tsx` | `ChartSvg` nimmt zusätzliche SVG-Props (Handler, `tabIndex`, Stil) |
| `packages/shot-ui/src/analysis/charts/CourseChart.tsx` | Lineal, Zeile, Tabelle, ohne `<title>`, `chosenNumber`, `onShow` |
| `packages/shot-ui/src/analysis/charts/RhythmChart.tsx` | ebenso |
| `packages/shot-ui/src/analysis/charts/DecimalHistogram.tsx` | Lineal und Tabelle, ohne `<title>` |
| `packages/shot-ui/src/analysis/charts/ClockChart.tsx` | Tabelle statt `<title>` |
| `packages/shot-ui/src/analysis/charts/charts.test.tsx` | Tests für die vier Diagramme |
| `packages/shot-ui/src/analysis/tabs/index.ts` | `CardContext`: `chosenShot`, `onShowShot` |
| `packages/shot-ui/src/analysis/tabs/TimeTab.tsx` | reicht beides an Verlauf und Rhythmus |
| `packages/shot-ui/src/analysis/AnalysisPanel.tsx` | Prop `onChoose(index, series)`, ermittelt `chosenShot` aus `state.chosen` |
| `packages/shot-ui/src/analysis/AnalysisPanel.test.tsx` | Test der Kopplung im Markup |
| `tools/labor/src/App.tsx` | `onChoose` der Analyse: Schuss wählen und zur Scheibe springen |
| `tools/labor/pruefung.js` | Prüfungen: Antippen, Ziehen, „Auf der Scheibe“, Tabelle, `touch-action` |
| `vault/spiegel/spiegel-mobile.md`, `vault/spiegel/spiegel-ui-design.md`, `vault/spiegel/spiegel-roadmap.md`, `packages/shot-ui/CLAUDE.md` | Doku |

## Required Docs

- `packages/shot-ui/CLAUDE.md` (Regeln zu Diagrammen, Sprung zur Scheibe, Markup-Tests), `tools/labor/CLAUDE.md`
  (Eigenheiten der Skriptprüfung: synthetische Tasten lösen nichts aus)
- `vault/spiegel/spiegel-mobile.md` (Prinzipien), `vault/conventions.md` §2, §3, §9

## Aufgaben

### Task 1: reine Funktionen (Tests zuerst)

`charts/ruler.ts`:

```ts
/** Index des nächsten Werts zu einer x-Position (Pixel im SVG); bei Gleichstand der frühere; leer: null */
export function nearestIndex(xs: readonly number[], x: number): number | null
/** einen Schritt weiter (−1, +1) oder an den Rand (−Infinity, +Infinity), in den Grenzen 0 … n − 1; ohne Wahl
    beginnt „rechts“ beim ersten, „links“ beim letzten Wert */
export function stepIndex(index: number | null, delta: number, n: number): number | null
/** x im SVG aus clientX: das SVG ist `width` Pixel breit, auf dem Schirm aber `rect.width` (h-auto w-full) */
export function toSvgX(clientX: number, rect: { left: number; width: number }, width: number): number
```

Tests in `ruler.test.ts`:
- `nearestIndex([10, 20, 30], 24)` ist 1, `…, 25)` ist 1 (Gleichstand, der frühere), `…, 26)` ist 2,
  `…, -100)` ist 0, `([], 5)` ist null.
- `stepIndex(null, 1, 5)` ist 0, `stepIndex(null, -1, 5)` ist 4, `stepIndex(4, 1, 5)` ist 4,
  `stepIndex(2, -Infinity, 5)` ist 0, `stepIndex(2, Infinity, 5)` ist 4, `stepIndex(null, 1, 0)` ist null.
- `toSvgX(150, { left: 50, width: 300 }, 600)` ist 200.

### Task 2: Lineal als Baustein

`charts/Ruler.tsx` (`"use client"`):

- **`useRuler(xs: readonly number[], width: number, preset: number | null)`** liefert
  `{ index, setIndex, svgProps }`.
  - `preset` setzt die Wahl, sobald es sich ändert (die Scheibe gibt den Schuss vor).
  - `svgProps` sind:
    - `tabIndex: 0`, `style: { touchAction: "pan-y", cursor: "crosshair" }`
    - `onPointerDown`: mit `toSvgX` und `nearestIndex` den Index setzen; `setPointerCapture` in
      `try/catch`, weil ein synthetisches Ereignis keinen echten Zeiger hat; merken, ob es derselbe Index war
    - `onPointerMove` bei gedrücktem Zeiger: Index nachführen und „bewegt“ merken
    - `onPointerUp`: War es derselbe Index und ohne Bewegung, heißt das zweites Tippen, die Wahl wird
      aufgehoben.
    - `onKeyDown`: Pfeil links und rechts gehen ±1, Pos1 und Ende an die Ränder (`stepIndex`), Escape hebt auf.
      Mit `preventDefault`, damit die Seite nicht scrollt.
- **`RulerReadout({ text, action })`**: eine Zeile mit `min-h-7`, `aria-live="polite"`,
  `text-[13px]`.
  - Ohne `text` steht der Hinweis „Tippe oder ziehe im Diagramm, um Werte abzulesen.“ in `muted-foreground`.
  - Mit `text` stehen die Werte in `foreground-2` und, wenn `action` da ist, rechts ein Knopf
    (`action.label`, `action.onClick`) wie die übrigen Textknöpfe (`text-primary`, `font-semibold`).
- **`RulerMark({ x, top, bottom })`**: eine senkrechte Linie `var(--foreground-2)`, 1 px, `data-ruler`, ohne
  Zeigerereignisse.
- **`ValuesTable({ caption, columns, rows })`**: `<details data-values>`, „Werte als Tabelle“ als
  `summary`, darin eine Tabelle mit `caption` (sr-only), Kopfzeile aus `columns` und Zeilen aus `rows`
  (Strings). Zahlen rechtsbündig, `tabular-nums`, `text-[13px]`.

`frame.tsx`: `ChartSvg` nimmt `svgProps?: SVGProps<SVGSVGElement>` und gibt sie an das `<svg>` weiter (vor
`className`, damit Rahmenklassen bleiben).

Tests in `Ruler.test.tsx` (Markup): Hinweis ohne Text; Werte und Knopf mit Text; `aria-live`; die Tabelle ist
zugeklappt, hat die Spalten und die Zeilen; `RulerMark` trägt `data-ruler` und `pointer-events="none"`.

### Task 3: Verlauf

`CourseChart` bekommt `chosenNumber?: number | null` (Schussnummer) und `onShow?: (number: number) => void`.
- **Lineal:** `useRuler(avg.map((p) => x(p.number)), width, Index von chosenNumber in avg oder null)`, die
  `svgProps` an `ChartSvg`.
- **Wahl:** `RulerMark` bei `x(avg[index].number)` von `PAD.top − 6` bis `HEIGHT − PAD.bottom`. Der gewählte
  Punkt hat `r` 5,5 und `data-chosen`.
- **Zeile über dem SVG** (Rückgabe als Fragment mit `RulerReadout`, dann `ChartSvg`, dann `ValuesTable`):
  „Schuss {n} · {Wert} · Schnitt der letzten zehn {meanRings}“. Bei `partial` heißt es „Schnitt bisher“.
  Die Aktion „Auf der Scheibe“ ruft `onShow(n)`, nur wenn `onShow` da ist.
- **Tabelle:** Spalten „Schuss“, „Wert“, „Schnitt“, je Punkt eine Zeile.
- `<title>` entfällt.

Tests in `charts.test.tsx`:
- 12 Schüsse mit `chosenNumber` 5: Der Punkt 5 trägt `data-chosen`, die Zeile nennt „Schuss 5 · “, es gibt
  ein `data-ruler`, aber kein `<title>`.
- Ohne `chosenNumber` stehen der Hinweis und kein `data-ruler`.
- Die Tabelle hat 12 Zeilen.
- Ohne `onShow` gibt es keinen Knopf „Auf der Scheibe“.

### Task 4: Rhythmus

`RhythmChart` macht es wie der Verlauf über `timed`.
- Die Zeile lautet „vor Schuss {n}: {Dauer}“, bei einer Pause mit „(Pause)“, dazu „Median der letzten fünf
  {Dauer}“, wenn es ihn gibt.
- Die gewählte Säule hat `data-chosen` und `fillOpacity` 0,9.
- `chosenNumber` bezieht sich auf die Schussnummer **nach** dem Abstand.
- Aktion „Auf der Scheibe“ mit `onShow(n)`.
- Tabelle mit den Spalten „vor Schuss“, „Abstand“, „Median der letzten fünf“.

Tests analog zu Task 3, dazu eine Pause in der Zeile mit „(Pause)“.

### Task 5: Zehntel-Säulen und Richtungsuhr

- **`DecimalHistogram`:** Lineal über die belegten Zehntel, `xs` = `center(t)` für jedes `present`.
  - Zeile „{Zehntel}: {Anzahl} Schuss“, keine Aktion.
  - Tabelle mit den Spalten „Zehntel“ und „Schuss“, nur belegte Zehntel.
  - `<title>` entfällt.
- **`ClockChart`:** `<title>` entfällt. Darunter eine Tabelle mit den Spalten „Richtung“ und „Schuss“, je
  belegte Stunde eine Zeile („3 Uhr“).

Tests: Säulen mit dem Hinweis in der Zeile, einer Tabelle nur der belegten Zehntel und ohne `<title>`;
Richtungsuhr mit so vielen Tabellenzeilen wie belegten Stunden und ohne `<title>`.

### Task 6: Kopplung über die Analyse

- **`CardContext`** (`tabs/index.ts`) bekommt:
  - `chosenShot?: MetricShot | null`: der auf der Scheibe gewählte Schuss, wenn er in der Grundlage liegt
  - `onShowShot?: (shot: MetricShot) => void`
- **`AnalysisPanel`:**
  - Neue optionale Prop `onChoose?: (index: number, series: SeriesKey | null) => void`.
  - `chosenShot = state.chosen ? shots[state.chosen.index] : null`, nur wenn er in `input.base` liegt.
  - `onShowShot = onChoose ? (shot) => onChoose(shots.indexOf(shot), seriesKeyOf(shot)) : undefined`.
  - Beides kommt in den `CardContext`; die Abhängigkeiten des `useMemo` werden ergänzt.
- **`TimeTab`:** Verlauf und Rhythmus bekommen `chosenNumber` (aus `shotNumbers(base)` für `chosenShot`) und
  `onShow`. `onShow` ordnet die Nummer über `shotNumbers(base)` einem Schuss zu und ruft `onShowShot`.

Test in `AnalysisPanel.test.tsx`:
- `renderTab("time", …)` mit einem Zustand, in dem `chosen` auf Wertungsschuss 7 steht: Der Verlauf hat
  `data-chosen` bei Punkt 7.
- Mit `onChoose` gibt es den Knopf „Auf der Scheibe“, ohne nicht.
- `renderTab` braucht dafür die Optionen `state`-Teil `chosen` und `onChoose` (`testPanel.ts`
  erweitern).

### Task 7: Labor

- **`App.tsx`:**
  - `chooseFromAnalysis = useCallback((index, series) => { choose(index, series); jumpTo(scheibe, label) })`.
    `label` ist die Beschriftung des aktuellen Reiters aus `ANALYSIS_TABS`.
  - An `AnalysisPanel` geht `onChoose={chooseFromAnalysis}`.
- **`pruefung.js`**, im Reiter „Zeit und Verlauf“. Ein Hilfsmittel `pointerAt(svg, x)` löst `pointerdown` und
  `pointerup` als `PointerEvent` an der Stelle aus (clientX aus dem SVG-Rechteck), dann wird geprüft:
  - **Antippen:** Antippen von Punkt 23 → die Zeile nennt „Schuss 23 · “, es gibt ein `[data-ruler]`.
  - **Ziehen:** `pointerdown` bei Punkt 10, `pointermove` bis Punkt 30, `pointerup` → die Zeile nennt
    „Schuss 30 · “.
  - **Zweites Tippen:** noch einmal auf 30 tippen → der Hinweis steht wieder.
  - **„Auf der Scheibe“:** Punkt 14 antippen, dann der Knopf → die Ablesung der Scheibe nennt „Schuss 14 ·
    angetippt“.
  - **Von der Scheibe zum Verlauf:** Ist auf der Scheibe Schuss 14 gewählt, trägt der Verlauf `data-chosen` bei
    14.
  - **Telefon (375 × 812):** „Auf der Scheibe“ springt, die Pille „Zurück zu ‚Zeit und Verlauf‘“ erscheint.
  - **Richtungsuhr und Säulen:** Je eine Tabelle mit so vielen Zeilen wie belegten Stunden und Zehnteln.
  - **Gesten:** Alle Diagramme mit Lineal haben `touch-action: pan-y`.

  Danach Abwahl und zurück, damit die folgenden Prüfungen ihren Stand behalten.
- **Gegenproben:** `nearestIndex` immer 0 → Antippen rot; `preset` ignorieren → Kopplung rot.

### Task 8: Doku

- **`vault/spiegel/spiegel-mobile.md`:** „Offen: Diagramm-Lineal“ → erledigt, mit D2 bis D4.
- **`vault/spiegel/spiegel-ui-design.md`:** im Abschnitt „Analyse einer Scheibe“ ein Punkt „Lineal“.
- **`vault/spiegel/spiegel-roadmap.md`:** SP-1.8 Schritt 5 erledigt.
- **`vault/spiegel/spiegel-langzeit.md`:** L1 erledigt.
- **`packages/shot-ui/CLAUDE.md`:** Regel „kein Wert nur im SVG-`<title>`“ (Lineal oder Tabelle), Export-Zeile
  für `charts/Ruler` nur, wenn exportiert. Er bleibt intern; L3 exportiert ihn bei Bedarf.

## Teststeps

- `ruler.test.ts` vor der Umsetzung rot, danach grün.
- Markup-Tests der Diagramme und der Analyse grün; jede neue Prüfung per Gegenprobe rot.
- `pnpm --filter @vereinsheim/labor pruefen`: 0 FAIL, die Gegenproben aus Task 7 machen sie rot.

## Verification

- `pnpm check` grün.
- Sichtprüfung im Labor:
  - **Desktop 1280 × 900:** Antippen, Ziehen, Pfeiltasten und „Auf der Scheibe“ funktionieren, und die Pille
    bringt zurück.
  - **Telefon 375 × 812:** Antippen und senkrechtes Scrollen über dem Diagramm gehen beide.
- Bericht `reports/2026-10-08-spiegel-diagramm-lineal.md`.
- **Nicht belegt:** echtes Telefon (Safari), VoiceOver.
