# Plan: Verlauf beim Vergleichen über die Zeit

> PIV-Handoff-Artefakt. Läuft im aktuellen Tree auf `feat/compare-time-axis` (kein Worktree, ADR-024). Ein
> Prototyp liegt als `stash@{0}` („prototype: compare chart over time since start“) auf diesem Branch und ist an echten
> Daten geprüft (Desktop 1052 px dunkel und hell, Telefon 375 px hell). Die Tasks übernehmen ihn dateiweise und
> ergänzen, was dort fehlt.

## Context (warum)

Befund des Users am 7. November 2026 auf der Seite Vergleichen, „Letzte 6 Monate“ gegen „Zeitraum davor“: Der Verlauf
legt die Scheiben beider Zeiträume nach ihrer Nummer übereinander (`xIndex` in
[`PeriodChart.tsx`](../packages/shot-ui/src/period/PeriodChart.tsx), Z. 105–108). Daraus folgt:

- A „endet“ früher, wenn A weniger Scheiben hat, obwohl beide Zeiträume gleich lang sind.
- Pausen verschwinden. In den Dev-Daten fehlt B der April, auf der Achse nach Nummer war das nicht zu sehen.
- Die Ablesung paart unverbundene Scheiben („im Vergleich 8,80 Ringe“), ebenso „Werte als Tabelle“ („Scheibe · A · B“).
- Eine Wahl der Kennzahl gibt es hier nicht, im Fortschritt schon (Ø je Schuss, Streuung, Zehner, Tempo).

Der Zeitraum davor selbst stimmt: gleich lang, endet am Beginn von A (`compareRange` in
[`calendar.ts`](../packages/shot-ui/src/period/calendar.ts)). Begründet war die Achse nach Nummer in
[`spiegel-langzeit`](../vault/spiegel/spiegel-langzeit.md) („Mit Vergleich“): Nach Kalender ließen sich zwei Zeiträume
nicht übereinanderlegen. Keine ADR betroffen; ADR-034 (Punkte und Abstand je Scheibe) bleibt, wie sie ist.

**Geprüft und nicht betroffen:** Satz, Tabelle, Bild und Tests der Seite Vergleichen; „Werde ich besser?“ im
Fortschritt; „Form der letzten 90 Tage“ auf Start (alle über gleich lange Zeiträume); der Abstand „zum Schnitt der 5
Scheiben davor“ (bewusst je Scheibe, ADR-034); zwei Scheiben und Wettkampf/Training (kein Verlauf).

**Entscheidung des Users** (7. November 2026): Variante 2, beide Zeiträume übereinander auf der Zeit seit ihrem
Beginn. Verworfen: eine durchgehende Achse mit B links und A rechts (Variante 1). Farben wie im Bild darüber und wie bei
zwei Scheiben. Die Kennzahl ist wählbar wie im Fortschritt.

## Approach (die freigegebene Oberfläche)

- **Achse:** x ist die Zeit seit dem Beginn des eigenen Zeitraums. Die Achse ist so lang wie der längere der beiden;
  ein kürzerer Vergleich endet früher.
- **Punkte:** beide Seiten gefüllt in `compare-a` (Blau) und `compare-b` (Orange) mit dunklem Saum, wie die Punkte im
  Bild. Hohl heißt auf beiden Seiten „nur Probe“, der Ring außen „Wettkampf“. Kein Band.
- **Linien:** je Seite der Schnitt der letzten fünf in ihrer Farbe, gestrichelt, solange „bisher“. B rechnet der Server
  wie A über die Schüsse (`averageOf`, ADR-034), nicht mehr der Browser als Mittel der Werte.
- **Unter der Achse** zwei Zeilen Monate: oben die von A mit Strichen in Blau, darunter die von B mit Strichen in
  Orange, jeder Monat an seiner Stelle im eigenen Zeitraum. Text in der Schriftfarbe.
- **Legende:** wie `SideLegend` unter dem Bild (gefüllte Punkte, Namen der Seiten).
- **Lineal:** wählt Scheiben beider Seiten in ihrer Folge auf der Achse; liegen Punkte übereinander, entscheidet die
  Höhe (`useRuler` mit `ys`). Ablesung: „<Name der Seite> · <Datum> · [Wettkampf ·] <Wert> · <Abstand zum Schnitt
  davor>“, ohne „im Vergleich …“. Der Abstand gilt auch für Scheiben von B (gerechnet über die Familie wie für A).
- **Werte als Tabelle:** Spalten „Datum · Zeitraum · <Kennzahl>“, erst A, dann B, je nach Datum.
- **Kennzahl:** `PeriodChartBar` mit `view={null}` unter der Überschrift „Verlauf“ (Kennzahl und „?“). Die Wahl steht in
  der Adresse als `metric=` mit denselben Codes wie im Fortschritt (`METRIC_CODES`), die Vorgabe Ø je Schuss fällt
  weg. „Genauer vergleichen“ und der Umschalter im Fortschritt nehmen die Kennzahl des Fortschritts mit. Der Wechsel
  hält die Seite an ihrer Stelle (am Prototyp gemessen: `scrollY` vor und nach gleich).
- **Fortschritt** bleibt unverändert („je Scheibe“ über dem Datum, „je Monat“).

## Files to change

| Datei | Task | Änderung |
|---|---|---|
| [`packages/shot-ui/src/period/model.ts`](../packages/shot-ui/src/period/model.ts) | T1 | `compareCards`, `compareTrend`, Abstand auch für B, `lightPeriodModel` |
| [`packages/shot-ui/src/period/model.test.ts`](../packages/shot-ui/src/period/model.test.ts) | T1 | Tests der neuen Felder |
| [`packages/shot-ui/src/period/__snapshots__/season.test.ts.snap`](../packages/shot-ui/src/period/__snapshots__/season.test.ts.snap) | T1 | neue Felder, nach Abgleich |
| [`packages/shot-ui/src/period/light.test.tsx`](../packages/shot-ui/src/period/light.test.tsx) | T1 | leichtes Modell mit Vergleich zeichnet gleich |
| [`packages/shot-ui/src/period/PeriodChart.tsx`](../packages/shot-ui/src/period/PeriodChart.tsx) | T2 | Vergleich über die Zeit, Farben, Lineal, Monatszeilen, Tabelle |
| [`packages/shot-ui/src/period/PeriodChart.test.tsx`](../packages/shot-ui/src/period/PeriodChart.test.tsx) | T2 | die zwei Tests des Vergleichs neu, Gegenprobe |
| [`packages/shot-ui/src/nav/routes.ts`](../packages/shot-ui/src/nav/routes.ts) | T3 | `metric` an `CompareQuery` (Zeiträume), Codec |
| [`packages/shot-ui/src/nav/navigate.ts`](../packages/shot-ui/src/nav/navigate.ts) | T3 | `compareFromProgress` nimmt die Kennzahl mit |
| [`packages/shot-ui/src/nav/routes.test.ts`](../packages/shot-ui/src/nav/routes.test.ts), [`navigate.test.ts`](../packages/shot-ui/src/nav/navigate.test.ts) | T3 | Hin und zurück, Vorgabe, Ungültiges |
| [`apps/spiegel/tools/measure.ts`](../apps/spiegel/tools/measure.ts) | T3 | Abfrage mit `metric` |
| [`apps/spiegel/src/lib/compare.ts`](../apps/spiegel/src/lib/compare.ts) | T4 | `periodModel` mit der Kennzahl der Abfrage |
| [`apps/spiegel/src/lib/compare.test.ts`](../apps/spiegel/src/lib/compare.test.ts) | T4 | Kennzahl kommt an, Linie von B |
| [`apps/spiegel/src/components/compare/CompareScreen.tsx`](../apps/spiegel/src/components/compare/CompareScreen.tsx) | T4 | `PeriodChartBar`, Kennzahl im `chartKey` |
| [`apps/spiegel/tools/pruefen.ts`](../apps/spiegel/tools/pruefen.ts) | T5 | Zählung der Punkte, Monatszeilen, Lineal auf B, Wahl der Kennzahl |
| [`packages/shot-help/src/topics.ts`](../packages/shot-help/src/topics.ts) | T6 | „Verlauf und Form“: ein Absatz zum Vergleich |
| [`vault/spiegel/spiegel-statistics-help.md`](../vault/spiegel/spiegel-statistics-help.md) | T6 | neu erzeugt (`docs`) |
| [`vault/spiegel/spiegel-vergleichen.md`](../vault/spiegel/spiegel-vergleichen.md), [`spiegel-langzeit.md`](../vault/spiegel/spiegel-langzeit.md) | T6 | Entscheidung, Verworfenes |
| [`packages/shot-ui/CLAUDE.md`](../packages/shot-ui/CLAUDE.md), [`apps/spiegel/CLAUDE.md`](../apps/spiegel/CLAUDE.md) | T6 | Zeilen zu `PeriodChart` und Vergleichen |

Kein Schema, keine Migration, kein Deploy-Vertrag, keine Änderung an der Brücke.

## Required Docs

- [`vault/spiegel/spiegel-vergleichen.md`](../vault/spiegel/spiegel-vergleichen.md) — Aufbau der Seite, Punkt 4 „Verlauf
  und Zahlen bei zwei Zeiträumen“, „Das Bild“ (Farben).
- [`vault/spiegel/spiegel-langzeit.md`](../vault/spiegel/spiegel-langzeit.md) — Abschnitt zum Verlauf „Mit Vergleich“.
- [`vault/decisions/adr-034.md`](../vault/decisions/adr-034.md) — Schnitt über Schüsse, Punkte je Scheibe.
- [`packages/shot-ui/CLAUDE.md`](../packages/shot-ui/CLAUDE.md) — Regeln zu Diagrammen und Lineal, Adressen, leichtes
  Modell.
- [`vault/conventions.md`](../vault/conventions.md) §9 „Charakterisierungstests müssen die falsche Quelle erkennen
  können“, „Neue Felder ändern eine Charakterisierung“, „Prettier im Paket aufrufen“, §10 „So schreiben wir“.

---

## Tasks (/implement, je ein Commit, `pnpm check` grün davor)

Den Prototyp je Task dateiweise holen: `git checkout stash@{0} -- <datei>`, dann anpassen. Nie `git stash pop` auf
einmal.

### T1. Modell: Scheiben und Linie des Vergleichs, Abstand auch für B

`model.ts` aus dem Stash übernehmen. Er bringt:

- `PeriodModel.compareCards: PeriodItem[] | null` (die Scheiben von B ohne die geteilten, `otherCards`) und
  `PeriodModel.compareTrend: { points: TrendPoint[]; spread: number | null } | null`
  (`periodTrend(compareValues, averageOf(chartMetric))`).
- `deltasBefore(familyValues, deltaIds, …)` mit `deltaIds` = Ids von A und B, wenn es einen Vergleich gibt.
- `lightPeriodModel`: `compareCards` über `lightCard`, `compareTrend` ohne `sd` in den Punkten.

Tests in `model.test.ts` (neues `it` im `describe` mit `compareTo`):

```ts
it("Vergleich: Scheiben, Linie über die Schüsse und Abstand auch für B", () => {
  // B mit verschieden langen Scheiben: das Mittel der Werte und der Schnitt über die Schüsse gehen auseinander
  const unequal = [
    periodCard("u0", 100, [100, 100, 100, 100]),
    periodCard("u1", 101, [80]),
    periodCard("u2", 102, [90, 90]),
  ]
  const m = model([...now, ...unequal], { compare: { type: "previous" } })
  const inA = new Set(m.cards.map((c) => c.id))
  expect(m.compareCards?.map((c) => c.id).sort()).toEqual(["u0", "u1", "u2"])
  expect(m.compareCards?.some((c) => inA.has(c.id))).toBe(false)
  expect(m.compareTrend?.points).toHaveLength(m.compareValues?.length ?? -1)
  // gepoolt: an u0 über alle Schüsse (2 · 9,0 + 8,0 + 4 · 10,0) / 7 ≈ 9,43, nicht das Mittel der Werte 9,0
  const last = m.compareTrend?.points.at(-1)?.mean
  expect(last).not.toBeCloseTo(periodTrend(m.compareValues ?? []).points.at(-1)?.mean ?? NaN, 6)
  for (const id of ["u1", "u0"]) expect(m.deltas.has(id)).toBe(true)
})
```

`periodCard` kommt aus `./testSeason`, `periodTrend` aus `@vereinsheim/shot-core/analysis`. Die Werte im Kommentar
beim Schreiben an den echten Zahlen prüfen (die Wertung der Fixture ist Zehntel, die Kennzahl der Ø je Schuss; u2 ist
die älteste Scheibe der Familie und hat keinen Abstand). Gegenprobe: `compareTrend` testweise mit `periodTrend(compareValues)` ohne `averageOf` rechnen, der
Test muss rot werden; danach zurück (aus einer `cp`-Sicherung, nicht `git checkout`).

`light.test.tsx`: den vorhandenen Vergleich von vollem und leichtem Modell um einen Fall mit
`compare: { type: "previous" }` erweitern (gleiches Markup).

Schnappschuss `season.test.ts`: vor `vitest -u` die alte `.snap` kopieren, danach mit einem kleinen Skript beide
vergleichen. Erlaubt sind nur die neuen Felder `compareCards` und `compareTrend` und in `deltas` zusätzliche Einträge
für Ids von B in den Fällen mit Vergleich („zeitraum davor“, „benannt gegen benannt“); jeder alte Wert bleibt gleich.

**Commit:** `feat(shot-ui): period model carries cards and trend of the compared period`

### T2. Verlauf: beide Zeiträume über die Zeit seit ihrem Beginn

`PeriodChart.tsx` aus dem Stash übernehmen (ohne die Kreise links in den Monatszeilen, die im Stash schon fehlen).
Danach:

- `PeriodChartModel` nimmt `compareCards` und `compareTrend` fest in den `Pick` auf (nicht `Partial`), der Fallback
  `?? periodTrend(compare)` entfällt.
- Doc-Kommentar über `PeriodChart` bleibt wie im Stash (beschreibt Achse, Farben, Monatszeilen).

`PeriodChart.test.tsx`: die beiden Tests im `describe("Verlauf je Monat und im Vergleich")` ersetzen.

```ts
it("mit Vergleich beide Zeiträume über die Zeit seit ihrem Beginn, mit Legende und zwei Zeilen Monate", () => {
  const now = TWELVE.slice(6) // 42 bis 27 Tage vor jetzt: A beginnt spät in den 90 Tagen
  const before = [9, 10, 9].map((v, i) => periodCard(`v${i}`, 100 + i, [v * 10])) // spät in B
  const html = render([...now, ...before], { compare: { type: "previous" } })
  expect(html).toMatch(/data-legend="true"[\s\S]*Letzte 90 Tage[\s\S]*Zeitraum davor/)
  expect(count(html, /data-compare-point="/g)).toBe(3)
  expect(count(html, /data-card-point="/g)).toBe(6)
  expect(html).not.toContain("data-band")
  expect(html).toContain('data-month-row="a"')
  expect(html).toContain('data-month-row="b"')
  // Gegenprobe zur Achse nach Nummer: Dort stünde die erste Scheibe von B über der ersten von A
  const xs = (attr: string) =>
    [...html.matchAll(new RegExp(`<g ${attr}="[^"]*"[^>]*>(?:<circle[^>]*data-competition[^>]*/>)?<circle cx="([\\d.]+)"`, "g"))]
      .map((m) => Number(m[1]))
  expect(Math.min(...xs("data-compare-point"))).toBeGreaterThan(Math.min(...xs("data-card-point")) + 50)
})

it("Farben der Seiten wie im Bild: beide gefüllt, B ohne Ring; Ablesung nennt die Seite; Tabelle nach Datum", () => {
  const now = TWELVE.slice(6)
  const before = [9, 10, 9].map((v, i) => periodCard(`v${i}`, 100 + i, [v * 10]))
  const html = render([...now, ...before], { compare: { type: "previous" } }, "v1", {
    a: "var(--compare-a)",
    b: "var(--compare-b)",
  })
  expect(html).not.toContain("var(--primary)")
  expect(count(html, /data-compare-point="[^"]*"[^>]*><circle[^>]*fill="var\(--compare-b\)"[^>]*stroke="var\(--shot-edge\)"/g)).toBe(3)
  expect(count(html, /data-card-point="[^"]*"[^>]*>(?:<circle[^>]*data-competition[^>]*\/>)?<circle[^>]*fill="var\(--(?:compare-a|card)\)"/g)).toBe(6)
  expect(html).toContain("background:var(--compare-b)")
  // die Ablesung der gewählten Scheibe von B
  expect(html).toMatch(/Zeitraum davor · \d\d\.\d\d\.\d{4} · /)
  expect(html).not.toContain("im Vergleich")
  expect(html).toMatch(/<th scope="col"[^>]*>Datum<\/th><th scope="col"[^>]*>Zeitraum<\/th>/)
  expect(html).toContain('data-ruler="true"')
})
```

Die Muster beim Schreiben am echten Markup prüfen (Reihenfolge der Attribute in `renderToStaticMarkup`), nicht
abschwächen. Gegenprobe für den ersten Test: `xSince` für B testweise auf `range.fromMs` statt `compareRange.fromMs`
setzen (B fiele vor A) und die Achse nach Nummer nachstellen (`x` = Index), beide Male muss die letzte Erwartung rot
werden.

**Commit:** `feat(shot-ui): compare chart over time since each period's start`

### T3. Adresse: die Kennzahl des Verlaufs beim Vergleichen

`routes.ts`, anders als im Stash mit Pflichtfeld:

```ts
| {
    type: "periods"
    family: string | null
    a: PeriodChoice
    b: PeriodChoice | "previous"
    kind: CardKind
    includeWarmup: boolean
    /** Kennzahl des Verlaufs, wie im Fortschritt */
    metric: PeriodMetricKey
  }
```

- `DEFAULT_COMPARE` bekommt `metric: DEFAULT_PROGRESS.metric`.
- `compareQueryToParams`: nach `warmup` das Paar `["metric", query.metric === DEFAULT_PROGRESS.metric ? null :
  (METRIC_CODES.find(([key]) => key === query.metric)?.[1] ?? null)]`. Den Doc-Kommentar um `metric` ergänzen.
- `compareQueryFromParams`: `metric` wie in `progressQueryFromParams` (Code → Schlüssel, nur `PROGRESS_METRICS`,
  sonst Vorgabe).
- `navigate.ts`, `compareFromProgress`: `Pick<ProgressQuery, "choice" | "compare" | "kind" | "includeWarmup" |
  "metric">`, im Ergebnis `metric: query.metric`; Doc-Kommentar: „Familie, Art, Einschießen und Kennzahl gehen mit“.
- `apps/spiegel/tools/measure.ts`: `metric: "result.decimalMean"` in der Abfrage.
- Jede Abfrage-Literale in Tests ergänzen, die `tsc` meldet (heute neun Stellen mit `type: "periods"`).

Tests:

- `routes.test.ts`, im `describe` der Seite Vergleichen: `/compare?metric=sigma` ergibt `metric: "group.sigma"`;
  `urlFromRoute` mit `metric: "group.sigma"` schreibt `metric=sigma` nach `warmup`; mit der Vorgabe steht kein `metric`
  in der Adresse; `metric=location` und `metric=quatsch` ergeben die Vorgabe (Lage bietet der Verlauf nicht an);
  `type=cards&metric=sigma` hat kein Feld `metric`.
- `navigate.test.ts`: `compareFromProgress({ ...DEFAULT_PROGRESS, metric: "group.sigma" }, "lg-10m")` gibt eine Adresse
  mit `metric=sigma`.

**Commit:** `feat(shot-ui): compare query keeps the chart metric`

### T4. Seite Vergleichen: Wahl der Kennzahl

- `apps/spiegel/src/lib/compare.ts`: im `periodModel` der Zeiträume `metric: query.metric` in den `state`.
- `CompareScreen.tsx` aus dem Stash übernehmen und anpassen: Überschrift „Verlauf“, darunter `PeriodChartBar` mit
  `metric={query.metric}` (bei Zeiträumen; die Leiste steht nur dort), `view={null}`, `onMetric={(metric) => go({
  ...query, metric })}`, `onView={() => {}}`, `onHelp={() => onHelp("verlauf-und-form")}`. Der `chartKey` nimmt
  `asked.metric` auf. `HelpButton` bleibt importiert (Kopf der Seite).
- `compare.test.ts`, im Test „zwei Zeiträume: Verlauf und Werte wie im Fortschritt“: mit `{ ...query, metric:
  "group.sigma" }` ist `period?.metric.key` gleich `"group.sigma"`, `period?.compareTrend?.points.length` gleich
  `period?.compareValues?.length`; ohne Angabe (`DEFAULT_PROGRESS.metric`) `"result.decimalMean"`.

**Commit:** `feat(spiegel): choose the chart metric when comparing periods`

### T5. Skriptprüfung

In `apps/spiegel/tools/pruefen.ts`, Abschnitt „Seite Vergleichen“ (um Z. 2549):

- Zählung: `a: $$("[data-compare-history] [data-card-point]").length`, `b: $$("[data-compare-history]
  [data-compare-point]").length` (heute zählt `circle:not([data-compare-point])` mit dem neuen Markup auch B).
- Neue Felder in derselben Auswertung: `rows: $$("[data-compare-history] [data-month-row]").map((g) =>
  g.getAttribute("data-month-row")).join("")` muss `"ab"` sein.
- Neue Prüfung „Zwei Zeiträume: das Lineal liest eine Scheibe von B ab“: die Mitte des ersten Kreises in
  `[data-compare-point]` über `getBoundingClientRect` holen, dort klicken (wie die Prüfung des Fortschritts bei
  Z. 1910 ff.), danach muss die Zeile über dem Diagramm mit dem zweiten Namen der Legende beginnen und `" · "`
  enthalten.
- Neue Prüfung „Zwei Zeiträume: die Kennzahl wechselt in der Adresse, der Verlauf bleibt an seiner Stelle“: `top` von
  `[data-compare-history]` merken, den Knopf `[role=radio]` mit Text „Streuung“ im Verlauf klicken (`settle` bis die
  Adresse `metric=sigma` trägt), dann `location.search` enthält `metric=sigma`, der Knopf ist `aria-checked="true"`,
  `top` weicht um höchstens 2 px ab.

**Commit:** `test(spiegel): script checks for the compare chart over time`

### T6. Hilfe und Doku

- `packages/shot-help/src/topics.ts`, Thema `verlauf-und-form`, am Ende von `what` anhängen (Wortlaut zur Freigabe mit
  diesem Plan, danach ins Textbuch Spiegel übernehmen):

  > Beim Vergleichen zweier Zeiträume liegen beide übereinander, jeder in seiner Farbe. Eine Scheibe steht dort, wo
  > sie in ihrem Zeitraum liegt, gezählt ab dessen Beginn. Unter der Achse stehen die Monate beider Zeiträume: oben die
  > des gewählten, darunter die des Vergleichs.

  Danach `pnpm --filter @vereinsheim/shot-help docs` (schreibt `vault/spiegel/spiegel-statistics-help.md`).
- `vault/spiegel/spiegel-vergleichen.md`, Punkt 4: „Scheiben übereinander“, „A gefüllt, B als Ring“ und „Die Kennzahl
  des Verlaufs ist der Ø je Schuss, eine Wahl gibt es hier nicht“ ersetzen durch die Oberfläche aus „Approach“, mit
  Datum 7. November 2026 und dem Verworfenen: die Achse nach Nummer (die drei Folgen aus „Context“) und die durchgehende
  Achse (Variante 1). Die Kennzahl in der Adresse (`metric`) nennen. Frontmatter-`keywords:` um „zeitachse seit beginn
  übereinander monate beider zeiträume kennzahl im vergleich“ ergänzen (einzeilig lassen).
- `vault/spiegel/spiegel-langzeit.md`, „Mit Vergleich“: neuer Wortlaut „Beide Zeiträume liegen übereinander auf der
  Zeit seit ihrem Beginn, jeder in seiner Farbe. Unter der Achse stehen die Monate beider ([[spiegel-vergleichen]]).“
  Den alten Grund („Getrennt nach Kalender …“) streichen.
- `packages/shot-ui/CLAUDE.md`, Zeile `period/PeriodChart`: „Vergleich übereinander auf der Zeit seit ihrem Beginn, je
  Seite gefüllt in ihrer Farbe, zwei Zeilen Monate“; Zeile `period/model`: `compareCards`, `compareTrend`.
- `apps/spiegel/CLAUDE.md`, Regel „Vergleichen“: „mit Wahl der Kennzahl des Verlaufs (`metric` in der Adresse)“.
- `/sync-graph` (vault-lint grün). Prettier nicht auf `vault/`.

**Commit:** `docs(spiegel): compare chart over time and metric choice`

### Abschluss

`git diff stash@{0} -- <dateien>` zeigt nur die gewollten Abweichungen (Pflichtfeld `metric`, `Pick` statt `Partial`);
dann `git stash drop stash@{0}`.

## Verification (/validate)

1. `pnpm check` grün (lint, format:check, test, tsc, next build).
2. Im Browser auf `localhost:3002/compare?a=6m` mit den echten Daten des Users (er meldet sich selbst an), 1052 px
   dunkel und 375 px hell:
   - beide Seiten gefüllt in Blau und Orange, zwei Zeilen Monate, Legende wie unter dem Bild;
   - ein Tipp auf einen Punkt von B nennt „Zeitraum davor · …“;
   - „Streuung“, „Zehner“, „Tempo“ wechseln Adresse und Verlauf, die Seite bleibt stehen;
   - am Telefon `innerWidth === visualViewport.width`;
   - „Werte als Tabelle“: Datum · Zeitraum · Wert;
   - ein benannter, kürzerer Zeitraum als B endet früher auf der Achse (falls ein benannter Zeitraum in den Daten liegt,
     sonst im Bericht als „nicht belegt“ mit dem Test aus T2).
3. `pnpm --filter spiegel pruefen --start` nach `seed:own --demo` in einem Befehl mit dem Zurückstellen
   (`seed:own --email …`), nur nach einem Go des Users und mit freiem Port 3012 (`lsof -i :3012`).
4. Fortschritt unverändert: „je Scheibe“ und „je Monat“ im Browser einmal ansehen.
