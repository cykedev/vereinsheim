# Plan: Ausreißer schrittweise prüfen (Spiegel, V6)

- Branch: `feat/spiegel-ausreisser` (von `main`; vor `/implement` auf `main` nach dem Merge von
  `feat/spiegel-mobile-layout` neu aufsetzen, in der Hauptsession, weil `rebase` im Autopilot gesperrt ist)
- Katalog: V6 (Ausreißer), V7 (Ringverlust durch Ausreißer) in `vault/spiegel/spiegel-statistics.md`
- Anlass: Frage des Users im Labor, „warum gibt es immer maximal einen Ausreißer?“ (8. Oktober 2026)

## Kontext

`outliers` (`packages/shot-core/src/analysis/precision.ts`) prüft heute jeden Schuss einzeln gegen die
übrigen: T = d² / (2S² (1 + 1/(n − 1))) gegen das (1 − 0,05/n)-Quantil von F(2, 2(n − 2)). Eine Obergrenze für
die Zahl der Ausreißer gibt es nicht. Liegen aber zwei Abreißer nah beieinander, zählt beim Test des einen der
andere zu den „übrigen“. Er zieht deren Schwerpunkt zu sich und bläht ihre Streuung auf. So verdecken sich die
beiden (Maskierung):

- **Simulation B14 (heute):** 10 Schuss, zwei bei 5σ: Mindestens einer wird nur in 13,7 % der Fälle erkannt.
  Der Hilfetext sagt das offen („von zwei gleich weiten meist keinen“).
- **Nachgerechnet:** Zehnerserie Luftgewehr (`LG_SERIES` des Labors), die letzten zwei Schüsse bei (5,2 | 4,3)
  und (5,6 | 4,7) mm. Einzeln geprüft liegen sie bei T 4,16 und 5,84, die Grenze ist 7,51: kein Ausreißer.
  Gegen die acht übrigen allein läge jeder über T 20.
- Bei 40 Schuss wirkt die Verdeckung schwächer: Ein zweiter Abreißer neben Schuss 27 der Labor-Scheibe
  (Luftpistole) wird je nach Lage mitgefunden oder nicht.

## Ansatz

Der verallgemeinerte ESD-Test nach Rosner (1983), auf die Ebene übertragen:

1. Aus den m noch übrigen Schüssen den mit dem größten T nehmen, T wie heute gegen die anderen m − 1. Er wird
   mit dem (1 − α/m)-Quantil von F(2, 2(m − 2)) verglichen.
2. Diesen Schuss beiseitelegen und mit den übrigen weitermachen, höchstens `outlierSteps(n)` Schritte und nur
   solange mindestens fünf Schuss übrig sind.
3. Ausreißer sind die ersten r beiseitegelegten Schüsse. r ist der **letzte** Schritt, dessen T über seiner
   Grenze liegt. Ein früherer Schritt darf darunter bleiben. Genau das hebt die Maskierung auf: Ist der erste
   von zwei nahen Abreißern weg, fällt der zweite klar auf, und beide zählen.

Kein Schuss fällt aus der Wertung. Schnittstelle und Rückgabe bleiben gleich (`{ n, flagged }`, markierte
Schüsse in Abgabefolge). `outlierLoss` (V7), die Präzisionskarte, das Diagramm „Form der Gruppe“ und die
Beobachtungen arbeiten unverändert mit `flagged`.

## Entscheidungen

- **D1 Verfahren:** verallgemeinerter ESD wie oben. Verworfen wurden zwei Varianten:
  - Beide Abreißer zusammen gegen den Rest testen (Paare): bei 40 Schuss 780 Paare, und die Grenze wäre nicht
    sauber.
  - Robuste Mitte und Streuung (Median, MCD): Die exakte F-Verteilung ginge verloren, die Fehlalarmrate müsste
    ganz neu belegt werden.
- **D2 Höchstzahl der Schritte:** `n < 10 ? 1 : max(2, ⌊n/10⌋)`. Ab 10 Schuss heißt das höchstens jeder
  zehnte Schuss, mindestens zwei, darunter einer. Unter 10 Schuss bleibt es beim einzelnen Test, dort können
  sich zwei weiterhin verdecken. Das steht im Hilfetext.
- **D3 α = 0,04 je Schritt** statt 0,05. Prototyp mit 20 000 Wiederholungen je Fall, rund σ 1,5 mm, Seeds
  7000 + n:

  | Variante | Fehlalarm bei 5 / 8 / 10 / 12 / 15 / 20 / 30 / 40 / 60 Schuss |
  |---|---|
  | heute (ein Test, α 0,05) | 4,9 / 5,1 / 5,3 / – / – / 5,2 / – / 4,7 / 4,9 % |
  | ESD, α 0,05 | 4,9 / 5,1 / **6,5** / 5,8 / 5,4 / 5,6 / 4,8 / 4,9 / 5,0 % |
  | **ESD, α 0,04 (Empfehlung)** | 4,0 / 3,9 / 5,2 / 4,6 / 4,3 / 4,5 / 4,0 / 4,0 / 4,0 % |

  Treffer, 5000 Wiederholungen, Abreißer bei 5σ:

  | Fall | heute | ESD α 0,04 |
  |---|---|---|
  | 10 Schuss, einer | 90 % | 87 % |
  | 10 Schuss, zwei zufällig verteilt, beide erkannt | 0 % (einer in 13 %) | 75 % |
  | 10 Schuss, zwei nah beieinander, beide erkannt | 0 % | 82 % |
  | 20 Schuss, zwei nah, beide | 0 % (einer in 39 %) | 98 % |
  | 40 Schuss, drei nah, alle | 0 % (einer in 41 %) | 100 % |

  Strengere Grenzen nur für spätere Schritte (α 0,025, 0,05/k, 0,01) senkten den Fehlalarm bei 10 Schuss
  kaum, kosteten aber viel Trefferquote (zwei nah bei 10 Schuss: 73 %, 73 %, 52 %). Der Labor-Abreißer
  (Luftpistole, Schuss 27, T 8,9) bleibt mit der neuen Grenze 7,58 markiert.
- **D4 Labor:** ein neues Beispiel beim Luftgewehr, „Zwei Abreißer“, das zeigt, was sich ändert. Die
  Zehnerserie bekommt als Schuss 9 und 10 die zwei nahen Abreißer von oben (8,3 und 8,0 Ringe). Heute findet
  die Regel keinen, künftig beide (Schritt 1: T 5,84 bei Grenze 7,95; Schritt 2: T 21,71 bei Grenze 8,17).
- **D5 Spielwiese** (`tools/spielwiese/template.html`): bleibt unverändert, sie ist Referenz bis zur Portierung.
  _Berichtigt im Review:_ Eine eigene Kopie der Regel hat sie nicht. `entry.ts` bindet `shot-core/analysis` ein,
  sie rechnet also schrittweise. Nur ihr Hinweis unter der Karte nannte die alte Regel; er ist auf den Text
  der Präzisionskarte gezogen.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/analysis/precision.ts` | `outliers` schrittweise, `OUTLIER_ALPHA` 0,04, `outlierSteps`, `strongest`; Doku-Kommentar |
| `packages/shot-core/src/analysis/precision.test.ts` | Tests für α, Freiheitsgrade, Faktor, Maskierung, einen Schritt unter 10, kein Mitreißen |
| `packages/shot-core/CLAUDE.md` | Regel „Ehrlich statt scheingenau“: Ausreißer schrittweise |
| `packages/shot-help/scripts/simulate.ts` | B14 mit „beide erkannt“ und dem Fall „nah beieinander“ |
| `packages/shot-help/src/topics.ts` | Thema `ausreisser`: `what`, `caution`, `formula` |
| `packages/shot-ui/src/analysis/tabs/PrecisionTab.tsx` | Hinweis unter der Karte „Ausreißer“ |
| `vault/spiegel/spiegel-statistics.md` | V6-Zeile, Block „Belege aus Simulationen“ (B1, B2, B14) |
| `vault/spiegel/spiegel-statistics-help.md` | neu erzeugt (`pnpm --filter @vereinsheim/shot-help run docs`) |
| `tools/labor/src/samples.ts` | Beispiel `pair` „Zwei Abreißer“ (nur Luftgewehr) |
| `tools/labor/pruefung.js` | Prüfungen für das neue Beispiel |

Keine geschützten Pfade. `packages/shot-help/scripts/` ist nicht das geschützte `scripts/` im Wurzelverzeichnis.
Die Datei trotzdem mit dem Edit-Werkzeug ändern und nicht per Shell-Einzeiler: Die Einzeiler-Prüfung des
Guards erkennt `/scripts/` auch mitten im Pfad.

## Required Docs

- `packages/shot-core/CLAUDE.md` (Regeln „Ehrlich statt scheingenau“, „Simulation nachziehen“, „Neue Auswertung,
  neuer Katalog-Eintrag“, Testwerte aus Hand-Rechnung)
- `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md`
- `vault/spiegel/spiegel-statistics.md` (V6, V7, Block „Belege aus Simulationen“)
- `vault/conventions.md` §9 (Eigenschaftstests per Mutation gegenprüfen, `toBeCloseTo` und null)

## Aufgaben

### Task 1: Tests zuerst (shot-core)

Datei `packages/shot-core/src/analysis/precision.test.ts`, Block `describe("Ausreißer (V6, V7)")`. Für n = 9
(acht im Kreis von 1 mm plus Testschuss) gilt T = d²/1 285 714 (S² = 8·10⁶/14, Faktor 9/8). Neue Grenze:
(1 − 0,04/9)-Quantil von F(2, 14) = 8,1748. Formel für F(2, ν): x = (ν/2)·(q^(−2/ν) − 1) mit q = α/m.

1. Den Kopfkommentar auf die neue Grenze umschreiben: „Grenze F(2, 14) beim Quantil 1 − 0,04/9 = 8,1748“.
2. Test „jeder gegen die übrigen …“ umbenennen in „der weiteste gegen die übrigen mit F(2, 2(m − 2)),
   Bonferroni und α 0,04“:
   - 2,8 mm: T 6,10, keiner. Kommentar: „ohne Bonferroni (Grenze 4,09) wäre es ein Ausreißer“.
   - 3,2 mm: T 7,96, keiner. Kommentar: „mit α 0,05 (Grenze 7,70), mit 2(n − 1) Freiheitsgraden (7,74) oder ohne
     (1 + 1/(n − 1)) (T 8,96) wäre er drüber“.
   - 3,3 mm: T 8,47, nur er (`[9]`, `xUm` 3300).
3. Test „die Grenze nutzt 2(n − 2) Freiheitsgrade“ (3,1 mm) entfällt, 3,2 mm deckt das ab.
4. Neue Tests:
   - „zwei nahe Abreißer verdecken sich nicht mehr (Schritt 2 zählt, auch wenn Schritt 1 darunter bleibt)“:
     `[...ring8, {xUm 4000, yUm 0}, {xUm 4000, yUm 400}]` (n = 10) → `[9, 10]`. Kommentar: Einzeln T 4,07 und
     4,15 (heute keiner, Grenze 7,51). Schritt 1: T 4,148 bei Grenze 7,9526. Schritt 2 gegen die acht im Kreis:
     T 12,446 bei Grenze 8,1748.
   - „unter 10 Schuss nur ein Schritt“: Sieben im Kreis von 1 mm (`ring7`, Winkel 360/7·i, gerundet wie
     `ring8`) plus dieselben zwei (n = 9) → `[]`. Kommentar: T 3,61 und 3,68 bei Grenze 8,17.
   - „ein weiter Schuss reißt keinen normalen mit“: `[...ring8, {0, 0}, {4000, 0}]` (n = 10) → `[10]`.
     Kommentar: Schritt 1 T 14,4 bei Grenze 7,95; Schritt 2 T 1,15 bei Grenze 8,17.
5. Unverändert grün bleiben müssen „sind die übrigen alle an einer Stelle“, „die Nummer zählt alle Schüsse“, „ein
   weiter Schuss fällt auf“ und alle `outlierLoss`-Tests (3,3 mm bleibt markiert).
6. `pnpm --filter @vereinsheim/shot-core exec vitest run src/analysis/precision.test.ts`: Die neuen Tests zu
   Maskierung und 3,2 mm fallen rot, aus dem richtigen Grund (heutige Regel). Commit erst mit Task 2.

### Task 2: schrittweiser Test (shot-core)

In `packages/shot-core/src/analysis/precision.ts` `OUTLIER_ALPHA` und `outliers` ersetzen:

```ts
/** Irrtum des Ausreißer-Tests je Schritt: 0,04, damit der Fehlalarm über alle Schritte bei etwa 5 % bleibt */
const OUTLIER_ALPHA = 0.04

/** höchstens so viele Schritte: unter 10 Schuss einer, sonst jeder zehnte Schuss, mindestens zwei */
const outlierSteps = (n: number) => (n < 10 ? 1 : Math.max(2, Math.floor(n / 10)))

/** der Schuss, der am weitesten von den übrigen liegt, gemessen an ihrer Streuung: Index und T */
function strongest(points: readonly Point[]): { index: number; t: number } {
  const m = points.length
  let best = { index: 0, t: -1 }
  points.forEach((p, i) => {
    const others = points.filter((_, j) => j !== i)
    const center = centroid(others) as Point
    const s2 = distancesTo(others, center).reduce((sum, r) => sum + r * r, 0) / (2 * (m - 2))
    const d2 = (p.xUm - center.xUm) ** 2 + (p.yUm - center.yUm) ** 2
    const t = s2 > 0 ? d2 / (2 * s2 * (1 + 1 / (m - 1))) : d2 > 0 ? Number.POSITIVE_INFINITY : 0
    if (t > best.t) best = { index: i, t }
  })
  return best
}

export function outliers(shots: readonly MetricShot[]): { n: number; flagged: Outlier[] } | null {
  const selected = selectShots(shots, { need: "position" })
  const n = selected.length
  if (n < 5) return null
  const numbers = shotNumbers(shots)
  let rest = selected.map((shot) => ({ shot, point: { xUm: shot.xUm as number, yUm: shot.yUm as number } }))
  const removed: MetricShot[] = []
  let count = 0
  for (let step = 1; step <= outlierSteps(n) && rest.length >= 5; step++) {
    const m = rest.length
    const { index, t } = strongest(rest.map((r) => r.point))
    // der letzte Schritt über seiner Grenze zählt, auch wenn ein früherer darunter blieb (Maskierung)
    if (t > fQuantile2(1 - OUTLIER_ALPHA / m, 2 * (m - 2))) count = step
    removed.push(rest[index].shot)
    rest = rest.filter((_, j) => j !== index)
  }
  const out = new Set(removed.slice(0, count))
  return {
    n,
    flagged: selected
      .filter((shot) => out.has(shot))
      .map((shot) => ({ shot, number: numbers.get(shot) as number })),
  }
}
```

Den Doku-Kommentar über `outliers` (V6) neu schreiben. Er nennt die Schritte, die Höchstzahl (D2), α 0,04 (D3),
die simulierte Fehlalarmrate (Werte aus B2 nach Task 5), die Grenze unter 10 Schuss und „kein Schuss fällt aus
der Wertung“. Den Satz zur gegenseitigen Verdeckung ersetzt der Hinweis, dass sie erst ab 10 Schuss aufgehoben
wird. Der Kommentar über `outlierLoss` bleibt.

Prüfung: Die Tests aus Task 1 sind grün, `pnpm --filter @vereinsheim/shot-core test` ebenso. Gegenprobe
(Mutation): Wird `count = step` zu `if (t <= grenze) break` (Abbruch beim ersten Schritt unter der Grenze),
muss der Maskierungstest rot werden. `outlierSteps` auf `() => 1` muss ihn ebenfalls rot machen.
Commit: `feat(shot-core): test outliers step by step so two close flyers no longer mask each other`.

### Task 3: Folgen in shot-ui

1. `pnpm --filter @vereinsheim/shot-ui test`. Die Tests lesen `outliers(BASE)` dynamisch
   (`PrecisionTab.test.tsx`, `mobile.test.tsx`). Fällt ein Test, weil er eine Nummer aus der alten Regel fest
   erwartet, nimmt er den neuen Wert aus `outliers` (nicht aus der Darstellung).
2. In `packages/shot-ui/src/analysis/tabs/PrecisionTab.tsx` die Notiz unter der Karte „Ausreißer“ ersetzen
   durch:
   „Schrittweise geprüft: der weiteste gegen die übrigen, dann ohne ihn der nächste (F-Test mit Bonferroni). In
   einer runden normalen Gruppe meldet die Regel höchstens in 5 % der Scheiben einen Ausreißer, bei gestreckten
   Gruppen öfter. Kein Schuss fällt aus der Wertung.“
3. Commit: `fix(shot-ui): describe the stepwise outlier rule under the outlier card`.

### Task 4: Simulation B14 erweitern

In `packages/shot-help/scripts/simulate.ts` den Block B14 (mit dem Edit-Werkzeug) ersetzen:

```ts
// B14: Ausreißer bei 10 Schuss: ein Schuss bei 5σ; zwei bei 5σ, zufällig verteilt oder nah beieinander
for (const [far, near, seed] of [
  [1, false, 14_001],
  [2, false, 14_002],
  [2, true, 14_102],
] as const) {
  let one = 0
  let all = 0
  repeat(5_000, seed, (rand) => {
    const base = 2 * Math.PI * rand.uniform()
    const shots = card(rand, { ...LG, n: 10 }).map((s, i) => {
      if (i < 10 - far) return s
      const angle = near ? base + 0.15 * (i - (10 - far)) : 2 * Math.PI * rand.uniform()
      const xUm = Math.round(5 * 1500 * Math.cos(angle))
      const yUm = Math.round(5 * 1500 * Math.sin(angle))
      const score = scoreFromCoordinates(LG_10M, xUm, yUm)
      return { ...s, xUm, yUm, decimalTenths: score.decimalTenths, ring: score.ring }
    })
    const flagged = new Set(outliers(shots)?.flagged.map((f) => f.shot) ?? [])
    const found = shots.slice(10 - far).filter((s) => flagged.has(s)).length
    if (found > 0) one++
    if (found === far) all++
  })
  out(
    "B14",
    `10 Schuss, ${far} bei 5σ${near ? " nah beieinander" : ""}: mindestens einer erkannt in ${share(one, 5_000)}${far > 1 ? `, beide in ${share(all, 5_000)}` : ""}`
  )
}
```

Prüfung: `pnpm --filter @vereinsheim/shot-help exec tsc --noEmit` ist grün. Der Lauf folgt in Task 5.

### Task 5: Simulation laufen lassen, Zahlen und Texte nachziehen

1. `pnpm --filter @vereinsheim/shot-help simulate`, Ausgabe vollständig ins Ledger.
2. **Abnahme (Breaker):** B2 rund liegt bei 10, 20, 40 und 60 Schuss jeweils ≤ 5,5 %. B14 „2 bei 5σ nah“
   ergibt „beide“ ≥ 70 %. Wird eine der beiden Bedingungen verfehlt: HALT, die Entscheidung geht an den User.
3. In `vault/spiegel/spiegel-statistics.md`:
   - im Block „Belege aus Simulationen“ die Zeilen B1, B2 und B14 durch die neue Ausgabe ersetzen,
   - die Zeile „Stand nach SP-1.12 (7. Oktober 2026)“ um „, Ausreißer schrittweise (8. Oktober 2026)“ ergänzen,
   - V6 neu fassen: „schrittweise (verallgemeinerter ESD nach Rosner, in der Ebene): der weiteste Schuss gegen
     die übrigen m, T = d²/(2S²(1 + 1/(m−1))) gegen F(2, 2(m−2)) beim Quantil 1 − 0,04/m, dann ohne ihn weiter;
     höchstens max(2, ⌊n/10⌋) Schritte ab 10 Schuss, darunter einer; Ausreißer sind die bis zum letzten Schritt
     über seiner Grenze. Fehlalarm in einer runden Normalgruppe ⟨B2 rund, Spanne⟩, bei gestreckten mehr
     (a/b 2: ⟨B2 a/b 2, Spanne⟩). Zwei nahe Abreißer verdecken sich ab 10 Schuss nicht mehr (B14). Bis
     Oktober 2026 jeder Schuss einzeln mit α 0,05 (zwei gleich weite bei 10 Schuss: einer in 13,7 %)“. Die
     Spannen ⟨…⟩ sind die gerundeten Grenzwerte der B2-Zeilen aus Schritt 1, etwa „4 bis 5 %“.
4. In `packages/shot-help/src/topics.ts`, Thema `ausreisser` (die Zahlen in eckigen Klammern aus dem Lauf
   übernehmen, gerundet wie im bisherigen Text):
   - `what`: „Spiegel prüft die Treffer Schritt für Schritt: zuerst den, der am weitesten von den übrigen liegt,
     gemessen an ihrer Streuung, dann ohne ihn den nächsten, ab 10 Schuss bis zu jedem zehnten Schuss. So
     verdecken sich zwei nahe Ausreißer nicht gegenseitig. Bei einer ganz normalen, runden Gruppe meldet die
     Regel höchstens in 5 % der Scheiben fälschlich einen Ausreißer. Ist die Gruppe deutlich gestreckt (a/b um
     2), passiert das öfter, umso öfter, je mehr Schüsse die Scheibe hat: bei 10 Schuss in etwa [B2 a/b 2 bei
     10] %, bei 60 Schuss in etwa [B2 a/b 2 bei 60] % der Scheiben.“
   - `caution`: „Ein Ausreißer liegt weit von deiner Gruppe, nicht unbedingt weit von der Mitte: Liegt die
     Gruppe neben der Mitte, kann er sogar Ringe bringen. Unter 10 Schuss prüft Spiegel nur einen Schritt, dort
     können sich zwei gleich weite Ausreißer noch verdecken. Bei 10 Schuss findet die Regel einen einzelnen sehr
     weiten Schuss in etwa [B14 einer, in Zehnteln] von zehn Fällen, von zwei nah beieinander in etwa [B14 nah
     beide, in Zehnteln] von zehn Fällen beide.“
   - `formula`: „Schritt für Schritt mit den m übrigen Schüssen: T = d² / (2S² (1 + 1/(m − 1))) für den
     weitesten gegen das (1 − 0,04/m)-Quantil von F(2, 2(m − 2)), dann ohne ihn weiter; höchstens max(2, ⌊n/10⌋)
     Schritte ab 10 Schuss, darunter einer; Ausreißer sind alle bis zum letzten Schritt über seiner Grenze;
     Kosten = Σ (Median der übrigen − vᵢ) über die markierten Schüsse“
5. Im Doku-Kommentar von `outliers` (Task 2) die Fehlalarmraten aus B2 eintragen.
6. `pnpm --filter @vereinsheim/shot-help run docs` erzeugt `vault/spiegel/spiegel-statistics-help.md` neu.
   Danach `pnpm --filter @vereinsheim/shot-help test` (Stil-, Themen- und Sync-Tests).
7. Commit: `docs(spiegel): back the stepwise outlier rule with new simulations and help texts`.

### Task 6: Labor-Beispiel „Zwei Abreißer“

1. In `tools/labor/src/samples.ts`:
   - `SampleId` um `"pair"` erweitern.
   - In `SAMPLES["lg-10m"]` nach der Zehnerserie einfügen: `{ id: "pair", label: "Zwei Abreißer", hint: "Die
     Zehnerserie, die letzten beiden Schüsse als Abreißer dicht beieinander (8,3 und 8,0). Einzeln gegen die
     übrigen geprüft, verdecken sie sich; schrittweise geprüft, fallen beide auf." }`
   - Eine Konstante `PAIR_FLYERS = [[5200, 4300], [5600, 4700]]`. In `rawSample` für `"pair"` die Punkte von
     `LG_SERIES` nehmen, die letzten beiden durch `PAIR_FLYERS` ersetzt, sonst wie `"series"`.
2. In `tools/labor/pruefung.js` nach den Prüfungen zur Präzision (Abschnitt mit „Präzision: Abreißer rot und mit
   Ring“) einfügen: Luftgewehr wählen, „Zwei Abreißer“ wählen, Reiter „Präzision“, dann vier Prüfungen:
   - „Zwei Abreißer: beide markiert“: Die Karte `ausreisser` enthält „Schuss 9, Schuss 10“.
   - Im Diagramm der Form sind zwei Punkte mit `data-outlier="true"`.
   - Unter Überblick steht in den Beobachtungen „Die Schüsse 9, 10 fallen als Ausreißer aus der Gruppe“.
   - Zum Nachrechnen über den Prüfhaken: `L().analysis.outliers(L().shots.filter((s) => s.kind === "match"))`
     liefert die Nummern `[9, 10]`, und `L().analysis.outlierLoss(…, "decimal")` liefert `count` 2 und `loss`
     4,5. Die Werte sind 10,7 / 10,5 / 10,4 / 10,4 / 10,4 / 10,4 / 10,6 / 10,2 / 8,3 / 8,0, der Median der
     übrigen ist 10,4, also (10,4 − 8,3) + (10,4 − 8,0) = 4,5. Heute: `count` 0.

   Danach zurück auf Luftpistole und „40 Schuss mit Probe“, damit die folgenden Prüfungen ihren Stand behalten.
3. `pnpm --filter @vereinsheim/labor pruefen`: 0 FAIL. Gegenprobe: Mit `outlierSteps` auf `() => 1` fallen die
   neuen Prüfungen rot.
4. `tools/labor/CLAUDE.md`: Bei den Beispielen nennen, dass „Zwei Abreißer“ die Verdeckung zeigt.
5. Commit: `feat(labor): add a ten-shot series with two close flyers`.

### Task 7: Doku

1. `packages/shot-core/CLAUDE.md`, Regel „Ehrlich statt scheingenau“: „Ausreißer gegen die übrigen mit
   F(2, 2(n − 2)) und Bonferroni“ wird zu „Ausreißer schrittweise (verallgemeinerter ESD nach Rosner, je Schritt
   der weiteste gegen die übrigen mit F(2, 2(m − 2)), Bonferroni, α 0,04)“.
2. `vault/spiegel/spiegel-statistics.md` hat Task 5 schon nachgezogen. `node .claude/vault-lint.mjs` muss valide
   melden.
3. Commit: `docs(shot-core): name the stepwise outlier rule`.

## Teststeps (zusammengefasst)

- shot-core: die neuen Tests aus Task 1 erst rot (heutige Regel), dann grün. Mutationen aus Task 2 machen
  den Maskierungstest rot.
- shot-ui, shot-help: alle Tests grün, Sync-Test des Leitfadens grün.
- Simulation: die Abnahme aus Task 5, Schritt 2.
- Labor: 0 FAIL, Gegenprobe aus Task 6.

## Verification

- `pnpm check`: alle Tasks grün.
- `pnpm --filter @vereinsheim/labor pruefen`: 0 FAIL.
- Sichtprüfung im Labor: Luftgewehr, „Zwei Abreißer“, Reiter Präzision. Beide Punkte sind rot mit Ring, die
  Karte nennt „Schuss 9, Schuss 10“ und Kosten von 4,5 Ringen. Beim Luftpistolen-Beispiel bleibt
  Schuss 27 der einzige.
- Bericht `reports/2026-10-08-spiegel-ausreisser-schrittweise.md` mit Simulationsausgabe, Gegenproben und dem,
  was nicht belegt ist (gestreckte Gruppen: kein affiner Test, wie bisher).

## Nicht Teil dieses Plans

- Ein affiner Test für gestreckte Gruppen (V6 „offen“, unverändert).
- Die Spielwiese (D5).
- Kosten je einzelnem Ausreißer (V7 bleibt die Summe).
