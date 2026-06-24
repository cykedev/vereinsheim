# Plan: Best-Off-Liga — direkter Vergleich als letztes Tabellen-Kriterium

> PIV-Schritt 1 (plan). Handoff-Artefakt für `/implement`. Branch: `feat/best-of-direktvergleich`.
> Domänen-Korrektur des Sportleiters an der `BEST_OF_SINGLE`-Tabelle (apps/ringwerk). Spec-Flip in
> derselben Klasse wie der `stechschuss-modell-flip` (2026-06-18) — zentral gekapselt, revidierbar.

## Kontext (warum)

Im Liga-Modus `BEST_OF_SINGLE` ist das **letzte** Tabellen-Kriterium heute der „beste Wert" einer
Einzelserie (`bestRingteiler` bzw. `bestRings`, je nach `scoringMode`) — siehe
[bestOfStandingsSort.ts](../apps/ringwerk/src/lib/standings/bestOfStandingsSort.ts) und
[features.md](../apps/ringwerk/docs/features.md) §„Liga-Modus BEST_OF_SINGLE → Tabelle". Der Sportleiter
möchte stattdessen den **direkten Vergleich** (head-to-head): Bei Gleichstand entscheidet, wer die
**Begegnung gegeneinander** gewonnen hat.

Zwei Probleme, die der Plan löst:

1. **Logik:** Der direkte Vergleich muss als Kriterium 4 eingezogen werden (ersetzt den Wert). Anders als
   die skalaren Spalten ist er **relational** (paarweise) — bei 3er-Gleichstand eine Mini-Liga, die
   zyklisch sein kann; bei noch offener Begegnung gar nicht entscheidbar. Beides muss deterministisch
   und korrekt fallen.
2. **Nachvollziehbarkeit:** Heute sind die Spalten links→rechts = Kriterien 1–4, die letzte zeigt den
   Wert. Wenn der Wert verschwindet, muss die letzte Spalte den **direkten Vergleich sichtbar machen**,
   damit man sieht, *warum* zwei punktgleiche Zeilen so stehen — sonst wirkt die Sortierung willkürlich.

**Prior Art im Repo:** Die klassische Liga (`DOUBLE_ROUND_ROBIN`) nutzt den direkten Vergleich bereits —
[standingsSort.ts → `sortWithDirectComparison`](../apps/ringwerk/src/lib/standings/standingsSort.ts):
Gruppen gleicher Punkte bilden → Kopf-an-Kopf-Bilanz **innerhalb der Gruppe** → danach sortieren. Wir
spiegeln dieses Muster, mit drei bewussten Unterschieden (siehe Ansatz).

## Entscheidungen (vom User bestätigt, 2026-06-24)

1. **Wert-Spalte ERSETZEN** durch eine Spalte „Direktvergleich" (Spalten = Kriterien 1:1).
2. **Anzeige im Gleichstand:** beim **2er-Gleichstand** das konkrete Match-Ergebnis + Gegner
   (`„2:1 · Müller"`, Sieg grün, Niederlage gedämpft); beim **3er+-Gleichstand** die Direktbilanz
   (`„2:0"`); für **nicht** umkämpfte Zeilen `„—"`.
3. **Fallback, wenn der direkte Vergleich nicht entscheidet** (Begegnung noch offen ODER zyklischer
   N-Gleichstand): **alphabetisch** sortieren, **aber mit sichtbarem Hinweis warum** — `„offen"` (Begegnung
   noch nicht gespielt) bzw. `„ausgeglichen"` (gespielt, aber gleich/zyklisch) — in **Tabelle und PDF**.

Neue Sortierkette (head-to-head bleibt auf **Position 4**, wie spezifiziert — es ersetzt das *letzte*
Kriterium, nicht ein früheres):

1. Siege (`wins`) absteigend
2. Satzdifferenz (`duelDiff`) absteigend
3. gewonnene Sätze (`duelsWon`) absteigend
4. **NEU: direkter Vergleich** — Mini-Liga-Bilanz innerhalb der punktgleichen Gruppe
5. Nachname alphabetisch (deterministischer Rest)

## Ansatz

### Datenfluss (keine neue DB-Query)

[`calculateBestOfStandings`](../apps/ringwerk/src/lib/standings/calculateBestOfStandings.ts) kennt in der
Matchup-Schleife bereits den Match-Sieger (`status.winner`) **und** die Satz-Bilanz (`bestOfDuelTally` →
`homeWins`/`awayWins`). Daraus bauen wir eine **Head-to-Head-Map** und reichen sie in den Sort. Eine neue
Property auf `BestOfStandingRow` fließt über den Re-Export in
[queries.ts](../apps/ringwerk/src/lib/standings/queries.ts) **automatisch** in Tabelle und PDF — kein
Touch an `queries.ts`/Routen nötig.

**Match-Sieger als Maß** (nicht per-Duell `determineOutcome` wie die klassische Liga): „wer hat die
Begegnung gewonnen" = der Sieger der Best-of-N-Begegnung, inkl. per Stechschuss entschiedener. Das ist die
fachlich richtige Lesart von „direkter Vergleich" im Best-of-Format.

### Typen ([bestOfStandingsTypes.ts](../apps/ringwerk/src/lib/standings/bestOfStandingsTypes.ts))

```typescript
/**
 * Erklärt die Platzierung einer Zeile, wenn sie sich wins+duelDiff+duelsWon mit anderen teilt
 * (Kriterium 4 = direkter Vergleich). null = Zeile ist NICHT in einem umkämpften Gleichstand
 * (Rang folgt aus den Spalten links davon) → wird als „—" dargestellt.
 */
export type DirectComparison =
  | { kind: "decided"; result: "win" | "loss"; satz: [number, number]; opponent: string } // 2er, gespielt
  | { kind: "record"; wins: number; losses: number }                                       // 3er+, Bilanz entscheidet
  | { kind: "open"; opponent: string | null }                                              // Begegnung offen → alphabetisch
  | { kind: "even" }                                                                        // gespielt, aber gleich/zyklisch

/** Direktes Begegnungsergebnis aus Sicht eines Teilnehmers (intern, calculate → sort). */
export interface DirectResult {
  duelsWon: number  // eigene Satzsiege in der direkten Begegnung
  duelsLost: number // Satzsiege des Gegners
  won: boolean      // hat diese Person die Begegnung gewonnen
}
export type HeadToHead = Map<string, Map<string, DirectResult>>
```

Auf `BestOfStandingRow` ergänzen: `directComparison: DirectComparison | null`.

`bestRingteiler` / `bestRings` **bleiben** auf der Row und werden weiter berechnet (revert-fähig, zentral —
gleiches Prinzip wie beim Stechschuss-Flip), sind aber **kein Sort-/Anzeige-Kriterium mehr**. Kommentar an
beiden Feldern + an der Berechnung.

### Head-to-Head-Aufbau ([calculateBestOfStandings.ts](../apps/ringwerk/src/lib/standings/calculateBestOfStandings.ts))

In der bestehenden Matchup-Schleife, nach `if (status.kind !== "complete") continue` und dem
`bestOfDuelTally`-Aufruf (`tally`), beide Richtungen eintragen:

```typescript
// homeId/awayId, status.winner ("A"=home), tally.{homeWins,awayWins} sind hier bereits vorhanden.
const homeWon = status.winner === "A"
setH2H(headToHead, homeId, awayId, { duelsWon: tally.homeWins, duelsLost: tally.awayWins, won: homeWon })
setH2H(headToHead, awayId, homeId, { duelsWon: tally.awayWins, duelsLost: tally.homeWins, won: !homeWon })
```

`headToHead` vor der Schleife als `new Map()` anlegen; `setH2H` als kleiner Helfer (in
[bestOfStandingsHelpers.ts](../apps/ringwerk/src/lib/standings/bestOfStandingsHelpers.ts)). Rows bei der
Konstruktion mit `directComparison: null` initialisieren. Aufruf:
`sortStandings(active, headToHead)` (siehe nächster Punkt).

### Sortierung + Annotation ([bestOfStandingsSort.ts](../apps/ringwerk/src/lib/standings/bestOfStandingsSort.ts))

Neue Signatur: `sortStandings(rows: BestOfStandingRow[], headToHead: HeadToHead): BestOfStandingRow[]`.
**`scoringMode` entfällt** — es wurde nur für das Wert-Kriterium gebraucht; die neuen Kriterien
(wins/duelDiff/duelsWon/Match-Sieger/Name) sind modus-unabhängig (der Modus steckte schon im
Match-Sieger).

Algorithmus:

1. Stabil nach `wins` desc, `duelDiff` desc, `duelsWon` desc sortieren.
2. In **maximale Läufe** gleicher `(wins,duelDiff,duelsWon)` partitionieren → Gruppen.
3. Pro Gruppe der Größe 1: `directComparison = null`.
4. Pro Gruppe ≥ 2: je Mitglied `m` die Direktbilanz **gegen die übrigen Gruppenmitglieder** aus
   `headToHead` zählen (`wins_m`, `losses_m`, `played_m`); Gruppe nach `(wins_m − losses_m)` desc, dann
   `lastName.localeCompare(_, "de")` ordnen; danach `directComparison` setzen:
   - **Gruppengröße == 2** (`o` = der andere): `res = headToHead.get(m)?.get(o)`.
     - `res` vorhanden → `{ kind: "decided", result: res.won ? "win" : "loss", satz: [res.duelsWon, res.duelsLost], opponent: o.lastName }`
     - sonst (offen) → `{ kind: "open", opponent: o.lastName }`
   - **Gruppengröße ≥ 3:**
     - `played_m < group.length − 1` (m hat nicht gegen alle gespielt) → `{ kind: "open", opponent: null }`
     - sonst, wenn `(wins_m − losses_m)` von einem anderen Gruppenmitglied geteilt wird (zyklisch/gleich)
       → `{ kind: "even" }`
     - sonst → `{ kind: "record", wins: wins_m, losses: losses_m }`

Ranking-Zuweisung in `calculateBestOfStandings` bleibt unverändert (`sorted.forEach((r,i) => r.rank = i+1)`).

### Geteilte Anzeige-Formatierung (neu: `apps/ringwerk/src/lib/standings/formatDirectComparison.ts`)

Eine **reine** Funktion, die Tabelle und PDF identisch nutzen (Text + semantischer Ton; das Mapping
Ton→Styling macht jeder Renderer selbst):

```typescript
import type { DirectComparison } from "./bestOfStandingsTypes"

export type DirectComparisonTone = "win" | "loss" | "pending" | "muted"

export function formatDirectComparison(dc: DirectComparison | null): {
  text: string
  tone: DirectComparisonTone
} {
  if (!dc) return { text: "—", tone: "muted" }
  switch (dc.kind) {
    case "decided":
      return { text: `${dc.satz[0]}:${dc.satz[1]} · ${dc.opponent}`, tone: dc.result === "win" ? "win" : "loss" }
    case "record":
      return { text: `${dc.wins}:${dc.losses}`, tone: dc.wins > dc.losses ? "win" : "muted" }
    case "open":
      return { text: dc.opponent ? `offen · ${dc.opponent}` : "offen", tone: "pending" }
    case "even":
      return { text: "ausgeglichen", tone: "muted" }
  }
}
```

### Tabelle ([BestOfStandingsTable.tsx](../apps/ringwerk/src/components/app/standings/BestOfStandingsTable.tsx))

- Letzte `<th>` von `{showRings ? "Best. Ringe" : "Best. RT"}` → **„Direktvergleich"** (gleiche Klassen,
  `hidden … sm:table-cell`; Ausrichtung `text-right` beibehalten).
- Letzte `<td>`: `formatDirectComparison(row.directComparison)` rendern; Ton→Klasse:
  `win` → `text-emerald-600 dark:text-emerald-400 font-medium`, `loss` → `text-muted-foreground`,
  `pending` → `text-amber-600 dark:text-amber-400 italic`, `muted` → `text-muted-foreground`.
- `showRings`/`scoringType`/die `formatRings`/`formatDecimal1`-Imports werden für diese Spalte nicht mehr
  gebraucht → entfernen, falls sonst ungenutzt (tsc/lint prüfen).

### PDF ([BestOfSchedulePdf.tsx](../apps/ringwerk/src/lib/pdf/BestOfSchedulePdf.tsx), Funktion `BestOfStandingsSection`)

- Spaltenbreiten `WS` (Summe muss 515 bleiben): `best: 90` → `direct: 110`, dafür `name: 150 → 130`.
- Header-Zelle `{showRings ? "Best. Ringe" : "Best. RT"}` → **„Direktvergleich"**.
- Datenzelle: `formatDirectComparison(row.directComparison)`; Ton→PDF-Style: `win` → `{ color: "#047857" }`
  + fett, `pending` → `styles.statusPending`-Farbe, sonst Default `styles.tableCell`. (Inline-`style`
  analog zu den vorhandenen `tableCell`-Verwendungen.)
- `showRings` + die `formatRings`/`formatDecimal1`-Imports entfernen, falls dann ungenutzt.
- `opponent` = nur Nachname (Breite); lange Namen sind selten und dürfen umbrechen.

### Drei bewusste Unterschiede zur klassischen Liga (für den Reviewer)

1. **Position:** klassisch = direkter Vergleich auf Pos. 2 (direkt nach Punkten); Best-Off = Pos. 4 (nach
   Satzdiff/Satzverhältnis) — explizite Sportleiter-Vorgabe.
2. **Tiefster Fallback:** klassisch behält den Wert nach dem direkten Vergleich; Best-Off **nicht**
   (alphabetisch) — Sportleiter-Entscheid.
3. **Annotation:** die Nachvollziehbarkeits-Spalte (inkl. „offen") ist **neu** und gibt es in der
   klassischen Tabelle nicht.

## Zu ändernde / neue Dateien

**Neu:**
- `apps/ringwerk/src/lib/standings/formatDirectComparison.ts` (+ `formatDirectComparison.test.ts`)
- `apps/ringwerk/src/lib/standings/bestOfStandingsSort.test.ts` (Sort-/Annotation-Unit-Tests — heute
  **keine** Tests auf `sortStandings`)

**Geändert:**
- `apps/ringwerk/src/lib/standings/bestOfStandingsTypes.ts` (`DirectComparison`, `DirectResult`,
  `HeadToHead`; Feld `directComparison`; Kommentare an `bestRingteiler`/`bestRings`)
- `apps/ringwerk/src/lib/standings/calculateBestOfStandings.ts` (H2H bauen, `directComparison: null`
  init, `sortStandings(active, headToHead)`)
- `apps/ringwerk/src/lib/standings/bestOfStandingsHelpers.ts` (`setH2H`-Helfer)
- `apps/ringwerk/src/lib/standings/bestOfStandingsSort.ts` (neue Signatur, Gruppen-Resolution + Annotation,
  Wert-Kriterium raus)
- `apps/ringwerk/src/lib/standings/calculateBestOfStandings.test.ts` (Test 6 + 7 umschreiben; Kommentare in
  „3-way tie broken by Satzdifferenz" + „Head-to-head loser ranks higher …" korrigieren; 2–3 Integrations-
  Cases ergänzen)
- `apps/ringwerk/src/components/app/standings/BestOfStandingsTable.tsx` (letzte Spalte)
- `apps/ringwerk/src/lib/pdf/BestOfSchedulePdf.tsx` (letzte Spalte + `WS`-Breiten)
- `apps/ringwerk/docs/features.md` (§„Liga-Modus BEST_OF_SINGLE → Tabelle": Spalten- + Kriterienliste, neue
  Kriterium-4-Erklärung inkl. offen/ausgeglichen-Annotation)
- `.claude/graph-captured.mjs` (Incident `best-of-standings-direct-comparison-tiebreak` + Relationen +
  `Keywords:`) → danach `node .claude/build-graph.mjs`, `.claude/knowledge-graph.json` mit-committen

**Nicht betroffen:** Prisma-Schema/Migration, Server-Actions, `queries.ts`, PDF-Routen, die zweite App.

## Required Docs (vom Implementer vor dem Code zu lesen)

- [apps/ringwerk/docs/code-conventions.md](../apps/ringwerk/docs/code-conventions.md) — Testkonventionen
  (Vitest neben Code, AAA), reine Domänen-Funktionen
- [apps/ringwerk/docs/reference-files.md](../apps/ringwerk/docs/reference-files.md) — bestehende Muster
- [apps/ringwerk/docs/data-model.md](../apps/ringwerk/docs/data-model.md) — Best-of / Scoring-Domäne
- [apps/ringwerk/docs/features.md](../apps/ringwerk/docs/features.md) §„Liga-Modus BEST_OF_SINGLE" (wird
  editiert) + §„Wertungsmodi"
- [apps/ringwerk/docs/ui-patterns.md](../apps/ringwerk/docs/ui-patterns.md) — Tabellen, PDF-Konventionen
- [docs/shared-conventions.md](../docs/shared-conventions.md) §3 (Typografie: Unicode-`…`, Farben) + §9
  (Domänenentscheidungen am echten Datensatz gegenprüfen)
- **Prior Art:** [apps/ringwerk/src/lib/standings/standingsSort.ts](../apps/ringwerk/src/lib/standings/standingsSort.ts)
  (`sortWithDirectComparison` — Muster) und
  [apps/ringwerk/src/lib/scoring/bestOf.ts](../apps/ringwerk/src/lib/scoring/bestOf.ts)
  (`bestOfDuelTally`, `resolveBestOf`, `BestOfStatus`)

## Aufgaben (je ein fokussierter Commit; Verhalten + Tests zusammen)

1. **Typen + Format-Helfer.** `DirectComparison`/`DirectResult`/`HeadToHead` + Feld `directComparison` in
   `bestOfStandingsTypes.ts`; neue `formatDirectComparison.ts` + `formatDirectComparison.test.ts` (alle vier
   `kind`-Fälle + `null`). Kompiliert isoliert, ändert noch kein Verhalten.
2. **H2H + Sort-Logik (Kern).** `setH2H`-Helfer; H2H-Aufbau + `directComparison: null`-Init in
   `calculateBestOfStandings`; `sortStandings` auf neue Signatur + Gruppen-Resolution + Annotation,
   Wert-Kriterium entfernt. Tests: neue `bestOfStandingsSort.test.ts`; in `calculateBestOfStandings.test.ts`
   Test 6/7 umschreiben + Kommentare korrigieren + Integrations-Cases (siehe Testschritte). `/check` grün.
3. **Tabelle.** Letzte Spalte in `BestOfStandingsTable.tsx` auf „Direktvergleich" + `formatDirectComparison`.
4. **PDF.** Letzte Spalte + `WS`-Breiten in `BestOfSchedulePdf.tsx` auf „Direktvergleich" +
   `formatDirectComparison`.
5. **Doku + Graph.** `features.md` §Best-Of-Tabelle aktualisieren; Incident in `graph-captured.mjs` +
   `node .claude/build-graph.mjs`; `knowledge-graph.json` mit-committen.

## Testschritte (explizit)

**`formatDirectComparison.test.ts`** (neu): `null` → „—"/muted; `decided` win → „2:1 · Müller"/win;
`decided` loss → „1:2 · …"/loss; `record` 2:0 → „2:0"/win, 0:2 → „0:2"/muted; `open` mit/ohne Gegner →
„offen · …"/„offen"/pending; `even` → „ausgeglichen"/muted.

**`bestOfStandingsSort.test.ts`** (neu; ruft `sortStandings(rows, headToHead)` mit synthetischen Rows + H2H):
- **2er-Gleichstand, gespielt:** A & B gleich auf wins/duelDiff/duelsWon, A schlug B 2:1 → A vor B; A
  `directComparison = decided/win/[2,1]/„B-Name"`, B `decided/loss/[1,2]/„A-Name"`.
- **2er-Gleichstand, offen:** kein H2H-Eintrag A↔B → alphabetisch; beide `open` mit Gegnername.
- **3er Mini-Liga entscheidbar:** A>B, B>C, A>C (Bilanzen 2:0 / 1:1 / 0:2) → Reihenfolge A,B,C; A `record 2:0`,
  C `record 0:2`. (Mittelfeld B teilt keine Bilanz → `record 1:1`.)
- **3er zyklisch:** A>B, B>C, C>A (alle 1:1) → alphabetisch; alle `even`.
- **3er mit offener Begegnung:** ein internes Paar ohne H2H → betroffene Mitglieder `open`.
- **Kein Gleichstand:** eindeutige wins/duelDiff/duelsWon → alle `directComparison = null`.

**`calculateBestOfStandings.test.ts`** (Integration; bestätigt H2H end-to-end):
- **Test 6 umschreiben** („RINGS mode …"): A & B beide 1 Sieg, **A schlägt B direkt** → A vor B per direktem
  Vergleich; assert `directComparison.kind === "decided"` für A (`result "win"`). Alte `bestRings`-als-
  Tiebreak-Assertion entfernen.
- **Test 7 umschreiben** („RINGTEILER mode …") analog: direkter Vergleich entscheidet, nicht `bestRingteiler`.
- **„3-way tie broken by Satzdifferenz" (Z.166)** + **„Head-to-head loser ranks higher …" (Z.279):**
  Assertions bleiben (Satzdiff trennt vor Kriterium 4) — nur die Kommentare „head-to-head is NOT a criterion"
  → „head-to-head ist Kriterium 4, hier nicht erreicht, da Satzdifferenz bereits trennt".
- **Neu:** echter 4er-Round-Robin, in dem zwei Teilnehmer auf wins+duelDiff+duelsWon gleich sind und der
  **direkte Vergleich** (Kriterium 4) den Ausschlag gibt → korrekte Reihenfolge + `directComparison`.

Lauf: `pnpm --filter ringwerk test` (oder `/test ringwerk`) muss grün sein; danach `/check` (alle fünf).

## Verifikation

- **`/check`** grün: `lint`, `format:check`, `test`, `tsc --noEmit`, `next build` (alle für ringwerk).
- **`tsc`** beweist, dass `directComparison` typkorrekt durch `queries.ts` in Tabelle + PDF fließt.
- **Manuell (im `/validate`):** Best-Off-Liga im Dev-Server (`pnpm dev --filter ringwerk`, :3000) mit
  einem 2er-Gleichstand öffnen → letzte Spalte „Direktvergleich" zeigt „x:y · Gegner"; eine noch offene
  Begegnung zwischen Punktgleichen → „offen · Gegner" + alphabetisch. PDF unter
  `/api/competitions/[id]/pdf/schedule` zeigt dieselbe Spalte.
- **Drift-Gate** (`scripts/consistency-check.sh`) bleibt grün: geänderte Dateien sind ringwerk-lokal (Tabelle
  app-spezifisch, PDF app-spezifisch) — keine der byte-identischen Shared-Dateien betroffen.

## Offene Punkte / Domänen-Check

- **Am echten Datensatz gegenprüfen** (shared-conventions §9 + Lehre aus `stechschuss-modell-flip`): die
  Kriterien-Reihenfolge (Pos. 4) **und** der alphabetische Fallback sollten vom Sportleiter an einer echten
  Tabelle bestätigt werden, bevor „endgültig". Die Logik ist zentral in `bestOfStandingsSort.ts` gekapselt →
  ein späterer Flip (z.B. Wert als tieferer Fallback statt alphabetisch) berührt nur diese eine Stelle.
- **`bestRingteiler`/`bestRings`** bleiben berechnet, aber unbenutzt — bewusst (revert-fähig). Falls der
  Reviewer „kein totes Datenfeld" bevorzugt: in einem Folgeschritt entfernbar (Row-Typ + calculate + Tests).
