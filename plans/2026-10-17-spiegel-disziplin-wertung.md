# Plan: Spiegel — Wertung der Disziplin als Vorgabe für Training und Wettkampf

> PIV-Handoff-Artefakt. Branch `feat/spiegel-disziplin-wertung`, im Worktree
> `.claude/worktrees/spiegel-disziplinen-mapping-f1338a` (ADR-024). Keine Migration, kein Deploy-Vertrag, keine ADR,
> kein Update der Brücke. Ein Kommentar in `schema.prisma` (geschützter Pfad) ändert sich, deshalb läuft T3 Schritt 1
> interaktiv. Ein Commit je Task.

## Context (warum)

Die Wertung einer Scheibe kommt heute aus `cardScoring` (`apps/spiegel/src/lib/scoring.ts`): gewählt, sonst
**Wettkampf** in der Wertung der Disziplin (`Discipline.officialScoring`), **Training** wie am Stand
(`Card.standScoring`, die häufigste Anzeigeart am Monitor), ohne beides Zehntel. Die Disziplin wirkt damit fast nur auf
Wettkämpfe. Im Training entscheidet, was am Monitor eingestellt war, und das schaltet jeder anders.

Entscheidung des Users (17. Oktober 2026): **Eine Wertung je Disziplin als Vorgabe für Training und Wettkampf**, mit
„Wie am Stand angezeigt“ als Standard (`officialScoring` null, wie heute ohne Einstellung).

## Approach

- **Regel:** `cardScoring` = gewählt, sonst die Wertung der Disziplin, sonst wie am Stand, sonst Zehntel. Die Art der
  Scheibe spielt für die Vorgabe keine Rolle mehr. Eine Scheibe nur aus Probe hat wie heute keine Wertung der Disziplin
  (`reads.ts` gibt dann `official` null), also wie am Stand.
- **Familie:** unverändert (gespeichert, sonst die häufigste Wertung ihrer Scheiben). Sie folgt damit von selbst.
- **„amtlich“ am Umschalter:** `ScoringToggle` nennt die Wertung der Disziplin im Namen „amtlich“. Das stimmt nur für
  einen Wettkampf (so druckt Meyton). Die Seite einer Scheibe gibt `official` deshalb nur bei einem Wettkampf weiter.
- **Spalte bleibt:** `Discipline.officialScoring` behält den Namen (keine Migration), nur der Kommentar im Schema sagt
  die neue Bedeutung.
- **Liste und Art:** Der Dialog zur Art einer Liste (`rankingKind`) verspricht heute, dass ein Wettkampf in der Wertung
  der Disziplin zählt und Training wie am Stand. Das stimmt nicht mehr; der Satz zur Wertung entfällt.
- **Nicht im Umfang:** getrennte Wertungen für Training und Wettkampf (verworfen), eine Spalte umbenennen.

## Required Docs

- [`apps/spiegel/CLAUDE.md`](../apps/spiegel/CLAUDE.md) („Wertung je Scheibe und je Familie“, „Art der Scheibe wie die
  Wertung“, „Kein Knopf ohne Folge“)
- [`vault/conventions.md`](../vault/conventions.md) §9, §10 (So schreiben wir, `OLD_WORDS`)
- [`vault/spiegel/spiegel-navigation.md`](../vault/spiegel/spiegel-navigation.md) („Wertung je Scheibe und je Familie“)
- Auto-Memory: Node v24 in Bash, `pnpm check && git commit`, Autopilot-Marker entfernen

## Textbuch-Auszug (neue und geänderte Texte)

**Blatt einer Disziplin, Feld „Wertung“** (bisher „Wertung im Wettkampf“):
- Überschrift und Beschriftung: „Wertung“
- Erklärung: „So zählt Spiegel jede Scheibe dieser Disziplin, im Training wie im Wettkampf. Ein Schütze kann es an jeder
  Scheibe selbst umstellen.“
- Möglichkeiten: „Zehntel“, „Ganze Ringe“, „Wie am Stand angezeigt“ (bisher „Nicht festgelegt“)
- darunter wie bisher die Anzeige am Stand („Am Stand meist … angezeigt: …“)

**Dialog `disciplineChange`, Satz zur Wertung:**
- „Die Scheiben dieser Disziplin zählen dann in {Zehnteln|ganzen Ringen}.“
- „Die Scheiben dieser Disziplin zählen dann so, wie am Stand angezeigt.“
- „Was nicht passiert“ bekommt dazu: „Hat ein Schütze für eine Familie Zehntel oder ganze Ringe gewählt, bleibt es
  dabei.“

**Dialog `rankingKind`:** Der zweite Satz unter „Was dann passiert“ entfällt in allen drei Fällen
(„Spiegel zeigt das Ergebnis dann so, wie die Disziplin im Wettkampf gewertet wird …“, „… so wie am Stand …“, „Das
angezeigte Ergebnis kann wechseln …“).

## Tasks

### T1 — Regel und Umschalter

Dateien: `apps/spiegel/src/lib/scoring.ts`, `apps/spiegel/src/lib/scoring.test.ts`,
`apps/spiegel/src/lib/db/reads.test.ts`, `apps/spiegel/src/components/card/CardScreen.tsx`.

1. `cardScoring`:
   ```ts
   /**
    * Die Wertung einer Scheibe: gewählt, sonst die Wertung der Disziplin (Vorgabe für Training und Wettkampf), sonst wie
    * am Stand; ohne alles Zehntel
    */
   export function cardScoring(card: {
     official: Scoring | null
     stand: Scoring | null
     choice: Scoring | null
   }): Scoring {
     return card.choice ?? card.official ?? card.stand ?? "decimal"
   }
   ```
   `kind` fällt aus der Signatur; `scoringOfRow` in `reads.ts` gibt es nicht mehr weiter (Typen folgen). Kopfkommentar
   der Datei: „(gewählt, sonst die Wertung der Disziplin, sonst wie am Stand)“.
2. `scoring.test.ts`: der Test „Wettkampf: amtlich …“ wird „die Wertung der Disziplin vor der Anzeige am Stand, ohne
   beides Zehntel“: `{ official: "rings", stand: "decimal" }` → rings, `{ official: null, stand: "rings" }` → rings,
   `{ official: null, stand: null }` → decimal; „gewählt vor der Vorgabe“ ohne `kind`.
3. `reads.test.ts`, die zwei Tests, die die alte Regel halten (beim Ausprobieren der neuen Regel als einzige rot):
   - „Wettkampf in der amtlichen, Training wie am Stand, …“ wird „die Wertung der Disziplin für Training und
     Wettkampf, nur Probe wie am Stand, die Wahl vor der Vorgabe; Übersicht und Seite gleich“: jede Scheibe mit
     `official` hat `scoring` „rings“ (die Testdisziplin wertet ganze Ringe), eine nur aus Probe „decimal“ (am Stand
     Zehntel), LG ohne Wertung der Disziplin „decimal“; Training und Wettkampf je auf der Seite „rings“; die Wahl
     „decimal“ an einem Training gewinnt in Übersicht und Seite.
   - „die gewählte Art vor der Art der Quelle …; die Vorgabe der Wertung folgt ihr“ wird „…; die Wertung hängt nicht an
     der Art“: Training „rings“, nach `kindChoice: "competition"` weiter „rings“, die Art ist „competition“; mit
     `scoringChoice: "decimal"` „decimal“.
4. `CardScreen.tsx`: am `ScoringToggle` `official={card.kind === "competition" ? card.official : undefined}` mit
   Kommentar „„amtlich“ nur im Wettkampf: so druckt Meyton; im Training ist die Wertung der Disziplin nur eine
   Vorgabe“. Der Kommentar über `seenScoring` sagt statt „Die Art verschiebt die Vorgabe (Training → Wettkampf …)“:
   „Ändert der Admin die Wertung der Disziplin, kommt eine andere Vorgabe“.
5. Gegenprobe per Mutation: in `cardScoring` `card.official` und `card.stand` testweise tauschen → mindestens ein Test
   in `scoring.test.ts` und `reads.test.ts` rot (Backup per `cp`).
6. Commit `feat(spiegel): the discipline scoring presets training and competition`.

### T2 — Texte und Feld im Admin

Dateien: `apps/spiegel/src/components/admin/DisciplineForm.tsx`, `apps/spiegel/src/components/admin/DisciplineList.test.tsx`,
`apps/spiegel/src/lib/admin/consequences.ts`, `apps/spiegel/src/lib/admin/consequences.test.ts`,
`apps/spiegel/src/lib/admin/discipline-model.ts`.

1. `DisciplineForm.tsx`: Abschnitt „Wertung“ mit der Erklärung und den Möglichkeiten aus dem Auszug (`SCORING_OPTIONS`
   Label „Wie am Stand angezeigt“ für `open`). Der Wert `open` und `saveDiscipline` bleiben gleich.
2. `consequences.ts`: in `disciplineChange` die beiden Sätze zur Wertung und der zusätzliche „Was nicht passiert“-Satz
   aus dem Auszug; `RANKING_HAPPENS` wird ein `Record<RankingChoice, string>` nur mit dem ersten Satz, `rankingKind`
   setzt `happens: [ … counts ]`.
3. `discipline-model.ts`: Kommentar an `standText` „Vorschlag für die Wertung der Disziplin“.
4. Tests: Wortlaut in `consequences.test.ts` (Wertung in ganzen Ringen, wie am Stand, neuer „nicht“-Satz, Liste ohne
   Satz zur Wertung); `DisciplineList.test.tsx` prüft „Wie am Stand angezeigt“ und die Erklärung und im ignorierten
   Blatt `not.toContain("So zählt Spiegel jede Scheibe")` statt „Wertung im Wettkampf“; `OLD_WORDS` bleibt grün.
5. Commit `feat(spiegel): texts for the discipline scoring preset`.

### T3 — Doku und Schema-Kommentar

Dateien: `apps/spiegel/prisma/schema.prisma` (nur Kommentar, **interaktiv**: geschützter Pfad), `apps/spiegel/CLAUDE.md`,
`vault/spiegel/spiegel-navigation.md`, `vault/spiegel/spiegel-data-model.md`.

1. `schema.prisma` an `officialScoring`: „// Wertung der Disziplin (Admin), Vorgabe für Training und Wettkampf; im
   Wettkampf die amtliche (SF-74); null: wie am Stand“. Danach `prisma validate` und `prisma migrate diff` gegen den
   vorigen Stand: leer.
2. `apps/spiegel/CLAUDE.md`, Regel „Wertung je Scheibe und je Familie“: „Die **Scheibe**: gewählt
   (`Card.scoringChoice`), sonst die Wertung der Disziplin (Admin → Disziplinen, für Training und Wettkampf), sonst wie
   am Stand (`Card.standScoring` …), ohne alles Zehntel.“ Regel „Art der Scheibe“: den Satz „Ändert die Art die Vorgabe
   der Wertung, folgt die Seite (`seenScoring` …)“ ersetzen durch „Die Art ändert die Wertung nicht; `ScoringToggle`
   nennt die Wertung der Disziplin nur im Wettkampf ‚amtlich‘.“
3. `spiegel-navigation.md`, „Wertung einer Scheibe“: die drei Punkte werden „gewählt, sonst die Wertung der Disziplin
   (Admin, für Training und Wettkampf, im Wettkampf die amtliche, SF-74), sonst wie am Stand, ohne alles Zehntel“.
4. `spiegel-data-model.md`, Zeile „Amtliche Wertung der Scheibe“: „**Wertung der Disziplin** setzt der Admin; sie ist
   die Vorgabe jeder Scheibe, im Wettkampf die amtliche (so druckt Meyton), nie aus `Treffer.Wertung` (SF-74).“
5. `vault-lint` grün. Commit `docs(spiegel): the discipline scoring presets training and competition`.

## Test steps

- `pnpm --filter spiegel test src/lib/scoring.test.ts src/lib/db/reads.test.ts src/lib/admin src/components/admin`
- vor jedem Commit `pnpm check` im Worktree.

## Verification

1. `pnpm check` grün.
2. Im Browser (Dev-Server, Konto mit Scheiben, vom User angemeldet oder Demo-Konto per `seed:own --demo; …; seed:own` in
   einem Befehl): eine Disziplin auf „Ganze Ringe“ stellen → Trainingsscheiben dieser Disziplin öffnen in ganzen Ringen,
   der Umschalter sagt nicht „amtlich“; ein Wettkampf sagt „amtlich“; „Wie am Stand angezeigt“ → Training wieder wie am
   Monitor.
3. Was die Dev-Daten nicht hergeben (etwa kein Wettkampf in der Disziplin), steht im Bericht als „nicht belegt“ mit dem
   Test, der es deckt.
