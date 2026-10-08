# Plan: Form der Gruppe ohne Ausreißer (Spiegel, P8)

- Branch: `feat/spiegel-form-ohne-ausreisser` (von `main` 0790cec)
- Katalog: P8 (Form der Gruppe), V6 (Ausreißer) in `vault/spiegel/spiegel-statistics.md`
- Anlass: Validierung des schrittweisen Ausreißer-Tests. Bei „Zwei Abreißer“ meldet die Form „gestreckt,
  a/b 3,99“, weil die zwei Abreißer die Ellipse ziehen. Der User: „Form ohne Ausreißer als Plan, direkt
  umsetzen“ (8. Oktober 2026).

## Kontext

`groupShape` (`packages/shot-core/src/analysis/precision.ts`) rechnet die Kovarianz-Ellipse über alle Schüsse
mit Lage. Ein Abreißer streckt sie in seine Richtung, und Mauchlys Test meldet eine Streckung, die die Gruppe
nicht hat. Das Diagramm `ShapeChart` legt die Ellipse um den Schwerpunkt **aller** Punkte. Nimmt die Form die
Ausreißer heraus, gehört die Ellipse um den Schwerpunkt der übrigen.

## Ansatz

- `groupShape` nimmt die von `outliers` (V6) markierten Schüsse heraus und rechnet über die übrigen.
  Gibt es noch kein Urteil über Ausreißer (unter fünf Schuss), zählen alle. `n` ist die Zahl der Schüsse,
  über die die Form rechnet; davon hängen Grenze und Test ab.
- `GroupShape` bekommt zwei Felder:
  - `without: readonly number[]`: die Nummern der herausgenommenen Schüsse in Abgabefolge (aus `outliers`)
  - `centerUm: Point`: der Schwerpunkt der Schüsse, über die die Form rechnet, also die Mitte der Ellipse
- `ShapeChart` legt die Ellipse und den Schwerpunkt auf `shape.centerUm`. Alle Punkte stehen relativ dazu,
  die Ausreißer weiter rot mit Ring außerhalb.
- Die Karte nennt bei „Verhältnis a/b“ die Grundlage: „gestreckt ab 2,96 bei 8 Schuss (ohne Ausreißer
  9, 10)“. Die Notiz lautet: „Ellipse: 2 σ entlang der Hauptachsen, ohne die Ausreißer (rote Punkte).“
- Keine anderen Auswertungen ändern sich. Lage (Hotelling), σ, R50 und Streukreis rechnen weiter über alle
  Schüsse. Nur die Form fragt nach der Gestalt der Gruppe, und dabei verfälscht ein Abreißer das Bild am
  stärksten.

Verworfen: die Ausreißer in der Seite oder im Diagramm herausnehmen. Der Fachkern rechnet, die Oberfläche
zeichnet (Regel in `packages/shot-ui/CLAUDE.md`). Und die Grenze (`ratioLimit`) hängt am selben n.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/analysis/precision.ts` | `groupShape` ohne Ausreißer, `without`, `centerUm`, Doku-Kommentar |
| `packages/shot-core/src/analysis/precision.test.ts` | Tests im Block „Form und Ringbreiten (P8, P9)“ |
| `packages/shot-ui/src/analysis/charts/ShapeChart.tsx` | Mitte = `shape.centerUm` |
| `packages/shot-ui/src/analysis/tabs/PrecisionTab.tsx` | Grundlage bei a/b, Notiz |
| `packages/shot-ui/src/analysis/tabs/PrecisionTab.test.tsx` | Test für Grundlage und Mitte der Ellipse |
| `packages/shot-help/src/topics.ts` | Thema `form-der-gruppe`: `what`, `caution`, `formula`; Zahlen aus B17 |
| `vault/spiegel/spiegel-statistics.md` | P8-Zeile, Block „Belege aus Simulationen“ (B1, B17) |
| `vault/spiegel/spiegel-statistics-help.md` | neu erzeugt (`pnpm --filter @vereinsheim/shot-help run docs`) |
| `tools/labor/pruefung.js` | Prüfungen im Block „Zwei Abreißer“ |

Nicht geändert wird die Spielwiese (`tools/spielwiese`, Prototyp ohne Bau-Skript, Artifact Version 13). Ihr
Diagramm zentriert auf alle Punkte; erst ein neuer Bau zeigte die Ellipse versetzt. Steht im Bericht.

## Required Docs

- `packages/shot-core/CLAUDE.md` (Testwerte aus Hand-Rechnung, Simulation nachziehen, Abgabefolge)
- `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md`, `packages/shot-help/CLAUDE.md`
- `vault/conventions.md` §9

## Aufgaben

### Task 1: Tests zuerst (shot-core)

In `precision.test.ts` im Block „Form und Ringbreiten (P8, P9)“ ergänzen. Die Kreispunkte bilden dieselbe
Konstruktion wie `ring8` im Ausreißer-Block: acht Punkte auf 1 mm, Winkel 0°, 45°, … 315°, auf ganze µm
gerundet. Für sie gilt sxx = syy = Σcos²·10⁶/7 ≈ 571 400 µm² und sxy ≈ 0. Die Ellipse ist also rund,
a = b ≈ 756 µm.

1. „SPREAD: ohne Ausreißer nichts herausgenommen, Mitte der Schwerpunkt“: `groupShape(SPREAD)` hat
   `without` `[]` und `centerUm` gleich `centroid` der SPREAD-Lagen. Die bisherigen Werte (Halbachsen
   √5,2·10⁶ und √2,8·10⁶) bleiben.
2. „Abreißer zählen für die Form nicht“: acht im Kreis plus die zwei Abreißer bei (4000 | 0) und
   (4000 | 400) (n = 10, die V6-Tests markieren sie als 9 und 10). Erwartet wird:
   - `n` 8, `without` `[9, 10]`
   - `elongated` false und `ratio` < 1,01
   - `centerUm` bis 1 µm bei (0 | 0)
   - `majorUm` bis 1 µm bei √(Σ der acht dx² ÷ 7); im Test aus den gerundeten Kreispunkten berechnen, nicht
     aus `covarianceEllipse`
   Kommentar: Mit den Abreißern wäre die Gruppe gestreckt; Gegenprobe in Task 2.
3. „unter fünf Schuss kein Urteil über Ausreißer: alle zählen“: SPREAD-Schüsse 1 bis 4 haben `without`
   `[]` und `n` 4.

`pnpm --filter @vereinsheim/shot-core exec vitest run src/analysis/precision.test.ts`: Tests 2 und 3 (neue
Felder) sowie 1 fallen rot, weil die Felder fehlen.

### Task 2: `groupShape` ohne Ausreißer (shot-core)

```ts
export interface GroupShape {
  /** Schüsse, über die die Form rechnet: alle mit Lage ohne die Ausreißer (V6) */
  n: number
  /** Nummern der herausgenommenen Ausreißer in Abgabefolge; leer ohne Ausreißer oder unter fünf Schuss */
  without: readonly number[]
  /** Schwerpunkt der Schüsse, über die die Form rechnet: die Mitte der Ellipse */
  centerUm: Point
  // … die übrigen Felder wie bisher
}

export function groupShape(shots: readonly MetricShot[]): GroupShape | null {
  const verdict = outliers(shots)
  const out = new Set(verdict?.flagged.map((f) => f.shot))
  const points = positioned(shots.filter((shot) => !out.has(shot)))
  const n = points.length
  const center = centroid(points)
  const ellipse = n >= 3 ? covarianceEllipse(points) : null
  if (!center || !ellipse || !(ellipse.majorUm > 0)) return null
  // … wie bisher
  return { n, without: verdict?.flagged.map((f) => f.number) ?? [], centerUm: center, ...ellipse, … }
}
```

Den Doku-Kommentar ergänzen: „ohne die von `outliers` (V6) markierten Schüsse: Ein Abreißer streckte die
Ellipse in seine Richtung (Oktober 2026)“. Die Mindestzahl bleibt drei Schüsse **ohne** Ausreißer.

Prüfung: Tests grün. Gegenprobe: `out` leer lassen → Test 2 rot (dann `elongated` true und `n` 10).
Commit: `feat(shot-core): leave flagged outliers out of the group shape`.

### Task 3: Diagramm und Karte (shot-ui)

1. `ShapeChart.tsx`: `const center = shape.centerUm` statt `centroid(points)`, der Import von `centroid`
   entfällt. Die Reihenfolge bleibt: erst `shape` holen, ohne `shape` `null`.
2. `PrecisionTab.tsx`, Zeile „Verhältnis a/b“: Das Muted lautet
   `` ` · gestreckt ab ${…} bei ${shape.n} Schuss${shape.without.length ? ` (ohne Ausreißer ${shape.without.join(", ")})` : ""}` ``.
   Die Notiz lautet „Ellipse: 2 σ entlang der Hauptachsen, ohne die Ausreißer (rote Punkte).“
3. `PrecisionTab.test.tsx` um einen Test ergänzen. Eine Karte mit zwei Abreißern (acht im Kreis plus
   (4000 | 0) und (4000 | 400), alles Wertung) rendern und prüfen:
   - Der Kartentext enthält „bei 8 Schuss (ohne Ausreißer 9, 10)“ und „nicht nachweisbar“.
   - Im SVG von `form-der-gruppe` liegt das Mittel der `cx`-Werte der Punkte ohne `data-outlier` bis 0,5 px am
     `cx` der Ellipse.
4. `pnpm --filter @vereinsheim/shot-ui test` grün. Commit:
   `fix(shot-ui): center the shape chart on the group without its outliers`.

### Task 4: Simulation, Texte, Katalog

1. `pnpm --filter @vereinsheim/shot-help simulate`, Ausgabe ins Ledger. Erwartet wird, dass sich nur B1 und
   B17 ändern; sie rufen `groupShape` auf. Ändert sich eine andere Zeile, ist das ein Breaker: HALT.
2. Im Block „Belege aus Simulationen“ von `vault/spiegel/spiegel-statistics.md` die Zeilen B1 und B17
   ersetzen und die Stand-Zeile um „, Form ohne Ausreißer (8. Oktober 2026)“ ergänzen.
3. Die P8-Zeile ergänzen: „ohne die von V6 markierten Ausreißer (seit Oktober 2026; vorher streckte ein
   Abreißer die Ellipse)“. Ihre Zahlen (Median a/b 1,33 und 1,21, 28 %) aus der neuen B17-Ausgabe übernehmen.
4. `packages/shot-help/src/topics.ts`, Thema `form-der-gruppe`:
   - `what`: „Die Streuung als Ellipse, ohne die Ausreißer: Das Verhältnis a/b sagt, wie gestreckt sie ist,
     der Winkel, in welche Richtung. Ein einzelner Abreißer zöge die Ellipse sonst in seine Richtung.“
   - `caution`: die Zahlen aus B17 übernehmen.
   - `formula`: „Halbachsen a, b aus der Kovarianz der Schüsse ohne Ausreißer; gestreckt, wenn
     W = 4a²b² / (a² + b²)² < 0,05^(2/(n − 2)) (Mauchly, exakt)“
5. `pnpm --filter @vereinsheim/shot-help run docs`, dann `pnpm --filter @vereinsheim/shot-help test`.
6. Commit: `docs(spiegel): describe the group shape without outliers and refresh its evidence`.

### Task 5: Labor

In `tools/labor/pruefung.js` im Block „Zwei Abreißer“ (Reiter Präzision) zwei Prüfungen ergänzen:

- „Zwei Abreißer: die Form rechnet ohne sie“: `S().groupShape(base())` hat `n` 8, `without` `[9, 10]` und
  `elongated` false. Der Kartentext von `form-der-gruppe` enthält „(ohne Ausreißer 9, 10)“ und „nicht
  nachweisbar“.
- „Zwei Abreißer: die Ellipse sitzt auf der Gruppe“: Im SVG der Form liegt das Mittel der `cx` der Punkte
  ohne `data-outlier` bis 0,5 px am `cx` der Ellipse.

`pnpm --filter @vereinsheim/labor pruefen`: 0 FAIL. Gegenprobe: Mit `centroid(points)` aller Punkte im
`ShapeChart` muss die zweite Prüfung rot werden.
Commit: `test(labor): check the group shape without the two flyers`.

## Verification

- `pnpm check` grün, Skriptprüfung 0 FAIL.
- Sichtprüfung im Labor: Luftgewehr, „Zwei Abreißer“, Reiter Präzision. Die Ellipse liegt rund um die acht
  Punkte, die zwei roten Punkte stehen außerhalb, und die Karte sagt „nicht nachweisbar“ und
  „(ohne Ausreißer 9, 10)“. Beim Luftpistolen-Beispiel ist Schuss 27 ausgenommen.
- Bericht `reports/2026-10-08-spiegel-form-ohne-ausreisser.md`.
