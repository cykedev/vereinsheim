# Review: Best-Off — direkter Vergleich als letztes Tabellen-Kriterium

> PIV-Schritt 4 (review). Delegiert an den `code-reviewer`-Sub-Agenten gegen `git diff main...HEAD`.
> Branch: `feat/best-of-direktvergleich`.

## Verdict

**Keine Blocker, keine Majors.** Implementierung korrekt, deterministisch, gut getestet; der Spec-Flip
ist sauber als revert-fähig dokumentiert. Eine NIT — **behoben** in diesem Lauf.

## Vom Reviewer als sauber bestätigt

- **Position-4-Garantie**: Partition nach `(wins, duelDiff, duelsWon)` identisch zur Basis-Sortierung;
  head-to-head ordnet nur INNERHALB einer punktgleichen Gruppe. Tests bestätigen, dass ein Direktsieger
  mit schlechterer Satzdifferenz unten bleibt.
- **Terminierung**: Partition-Schleife schreitet mit `i = j` (`j ≥ i+1`) fort; keine Rekursion, keine
  Endlosschleife.
- **Within-group-Bilanz**: nur abgeschlossene Begegnungen, nur gegen Gruppenmitglieder — korrekt.
- **Stechschuss → Match-Sieg** im H2H: `status.winner` ist auch bei Stechschuss gesetzt; korrekt erfasst.
- **All-0:0:0-Zeilen** (Saisonstart): deterministisch (2er→open mit Gegner, N→open mit null) und harmlos.
- **Datenfluss** `directComparison` via `queries.ts` → Tabelle + PDF; gemeinsamer Formatter → konsistent.
- **Prop-Entfernung** vollständig: `scoringMode` (Tabelle + 2 Seiten), `scoringType` (PDF + 2 Routen);
  die Routen-`scoringType`-Konstanten speisen weiter die klassischen PDFs (kein Dangling). `formatRings`/
  `formatDecimal1` weiter von 6 anderen Dateien genutzt — Imports nicht verwaist.
- **Konventionen**: explizite Rückgabetypen; `bg-card` vorhanden; kein `window.*`/`DropdownMenu`.
  `bestRingteiler`/`bestRings`-Beibehaltung als **vertretbar** eingestuft (dokumentiert revert-fähig,
  analog `stechschuss-modell-flip`). Docs + graph-captured akkurat.

## NIT — behoben

**`even`-Annotation konnte eine echte Bilanz-Differenz im gespaltenen N-Gleichstand verschlucken.**
`bestOfStandingsSort.ts` (3+-Zweig). Bei einem 4er-Gleichstand mit Bilanzen +1,+1,−1,−1 (alle gespielt)
war die Reihenfolge zwar korrekt (A,B,C,D), aber alle vier Zeilen zeigten „ausgeglichen" — A (direkt 2:1)
sah aus wie D (1:2), und die Spalte erklärte die Platzierung nicht mehr. Trifft genau das Feature-Ziel
(Nachvollziehbarkeit) im seltenen N-Fall.

**Fix (Commit b0ce432):** `even` feuert nur noch, wenn die GANZE Gruppe vollständig gespielt UND auf einer
Bilanz gleichauf ist (echter Zirkel/Wash, z.B. 3-Zyklus A→B→C→A alle 1:1). Gespaltene Gruppen zeigen die
echte `record`-Bilanz je Zeile → die gruppenübergreifende Ordnung bleibt erklärbar. Reiner 3-Zyklus liest
weiter „ausgeglichen". Lock-Test ergänzt (`bestOfStandingsSort.test.ts`, 4er gespalten → record). Gate
danach grün (`pnpm check`: 17/17), 8/8 Sort-Tests grün.

## Status

Branch ist mergebar: alle Gates grün, Review clean, NIT behoben. Offen bleiben die nicht-blockierenden
Punkte aus dem Validate-Report (manueller Browser-Blick auf die On-Screen-Tabelle; Domänen-Abnahme der
Kriterien-Reihenfolge + alphabetischer Fallback durch den Sportleiter am echten Datensatz).
