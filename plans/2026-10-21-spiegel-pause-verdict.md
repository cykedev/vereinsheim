# Spiegel: Was die Pause bewirkt hat

Branch `feat/spiegel-pause-verdict`, Worktree `.claude/worktrees/spiegel-pause-verdict` (parallele Sessions).

## Context

Die Karte „Pausen und Wiedereinstieg“ zeigt je Pause den Ø der bis zu drei Schüsse danach gegen den Ø der übrigen
(„danach Ø +0,19 Ringe je Schuss“) und schreibt dazu „Drei Schuss sind zu wenig für ein Urteil.“ (Beispiel auf
Produktion: zwei Pausen, beide +0,19 in ganzen Ringen, nachgerechnet und richtig.) Der User will wissen, was die Pause
bewirkt hat, zum Guten wie zum Schlechten, und hält ein Urteil für sinnvoll.

Eine Abschätzung (eigenes Skript, Luftgewehr σ 1,5 mm, 40 Schuss, Pause vor Schuss 21, exakter Permutationstest auf
den Unterschied der Mittel, 2 000 Läufe) ergab: ohne Wirkung 4,8 % „klar“; drei Schuss danach mit σ +60 % 44 %, mit
doppeltem σ 67 %; 1 mm Versatz nur 7,6 %. Ein Urteil erkennt also deutliche Wirkungen, kleine nicht.

Die Texte stehen zuerst im Textbuch (`vault/_attachments/textbuch-ringwerk-treffsicher.md`, Abschnitt „Spiegel: Was
die Pause bewirkt hat“, Nr. 1–3) und kommen erst nach der Freigabe in den Code ([[conventions]] §10).

## Approach

1. **Test im Fachkern:** `pauseRecovery` testet je Pause die Werte der bis zu drei Schüsse danach gegen die Werte der
   übrigen Schüsse mit einem **exakten Permutationstest auf den Unterschied der Mittel** (zweiseitig). Er zählt alle
   Auswahlen von k Werten aus allen n Werten aus (bei 40 Schuss und k = 3 sind es 9 880), in Zehnteln als ganze Zahlen.
   Warum nicht Mann-Whitney wie bei der Ermüdung: Die Karte zeigt den Unterschied der Mittel. Der Test auf genau diese
   Zahl kann der Zahl nicht widersprechen (Vorzeichen gleich), und mit drei gegen 37 Werte wäre `mannWhitney` nur
   genähert (exakt erst bis 20 je Seite).
2. **Mehrere Pausen:** Grenze je Pause 0,05 / m (Bonferroni, wie beim Ausreißer-Test), damit eine Scheibe mit vielen
   Pausen nicht öfter zufällig „klar“ zeigt.
3. **Genau 0 ohne Rundungsfehler:** Vorzeichen und „genau 0“ aus ganzen Zahlen (n_übrig · Summe_danach gegen
   k · Summe_übrig, in Zehnteln), wie bei der Ermüdung nach dem Review.
4. **Oberfläche:** Etikett je Zeile wie bei der Ermüdung, Urteil in der Beobachtung, eine klare Pause in den Kopf
   (`headline`), Hilfe nach Textbuch Nr. 3.
5. **Belege:** Simulation B22 (Fehlalarm, Trennschärfe), B1 zusätzlich mit einer Pause.

Nur Spiegel (`AnalysisPanel`, Beobachtungen und die Hilfe von `shot-help` nutzt nur Spiegel). Keine Änderung an
Schema, Projektion, Brücke oder Deploy-Vertrag; `pauseRecovery` ist keine Kennzahl der Projektion.

## Required Docs

- `vault/conventions.md` §10 (Textbuch zuerst, Schreibregeln)
- `packages/shot-core/CLAUDE.md` (ehrlich statt scheingenau, Urteil und Zahl ohne Widerspruch, Simulation nachziehen)
- `packages/shot-ui/CLAUDE.md`, `packages/shot-help/CLAUDE.md`, `apps/spiegel/CLAUDE.md` (Skriptprüfung)
- `vault/spiegel/spiegel-statistics.md` (Katalog Z4, „Viele Vergleiche“, Belege B1, B10)
- Textbuch, Abschnitt „Spiegel: Was die Pause bewirkt hat“

## Tasks

### T0 Freigabe der Texte (Circuit-Breaker)

Vor T1: Der Abschnitt im Textbuch trägt „freigegeben am …“. Sonst hält `/implement` an. Ändert der User Wortlaut, gilt
der Wortlaut im Textbuch.

### T1 Exakter Permutationstest in `stats.ts`

`packages/shot-core/src/stats.ts`, nach `mannWhitney`:

```ts
/**
 * Exakter Permutationstest auf den Unterschied der Mittel, zweiseitig: Anteil aller Auswahlen von |a| Werten aus
 * a und b zusammen, deren Mittel mindestens so weit vom Mittel der übrigen liegt wie das von a. Ganze Zahlen (etwa
 * Zehntel), damit Gleichstände genau zählen. Nur für eine kleine Gruppe (|a| bis 3), sonst Fehler; unter einem Wert
 * je Seite null.
 */
export function permutationMeanTest(a: readonly number[], b: readonly number[]): { p: number } | null
```

Rechnung über die Summe: Bei festem n und k ist |Ø_a − Ø_b| genau dann größer, wenn |n · Σa − k · Σalle| größer ist
(ganzzahlig, kein Gleitkomma). Aufzählen mit k geschachtelten Schleifen (k = 1, 2, 3); `assertFinite` und
`Number.isInteger` für alle Werte.

Tests in `stats.test.ts` (Handwerte):

- a = [10], b = [0, 0, 0] → p = 1/4 (eine von vier Auswahlen ist so extrem).
- a = [9, 9, 9], b = 37 × [5] → nur die Auswahl der drei Neunen ist so extrem, p = 1/9 880 (C(40, 3) = 9 880).
- a = [5, 5, 5], b = [5, 5, 5, 5] → p = 1 (alle gleich).
- Symmetrie: p(a, b) für a = [8, 9, 10], b = [5…] gleich p für die Spiegelung (Werte negiert).
- |a| = 4 wirft, leeres a oder b gibt null, eine Kommazahl wirft.

### T2 Urteil in `pauseRecovery`

`packages/shot-core/src/analysis/timing.ts`:

- `PauseEffect` um `clear: boolean` und `direction: "up" | "down" | null` erweitern (JSDoc: „klar nach dem exakten
  Permutationstest, Grenze 0,05 geteilt durch die Zahl der Pausen; Richtung nur wenn klar“).
- Die Werte bleiben in Zehnteln (`values` ist schon `valueTenths`). Je Pause `next` (bis zu drei) und `rest`; danach,
  wenn beide nicht leer:
  - `cross = rest.length * sum(next) - next.length * sum(rest)` (ganzzahlig);
  - `deltaRings = cross === 0 ? 0 : (meanOf(next) - meanOf(rest)) / 10`;
  - `p = permutationMeanTest(next, rest)?.p`.
- Nach der Schleife über alle Pausen (m = Zahl der Pausen): `clear = p !== undefined && p < 0.05 / m && cross !== 0`,
  `direction = clear ? (cross > 0 ? "up" : "down") : null`. Ohne Werte: `deltaRings: null, clear: false,
  direction: null`.
- Kommentar über der Funktion um das Urteil ergänzen.

Tests in `timing.test.ts`:

- Bestehende `toEqual` mit `{ afterShot: 7, deltaRings: null }` um `clear: false, direction: null` ergänzen.
- Neu: 40 Schuss, Pause vor Schuss 21, die drei danach je 7,0, die übrigen 37 abwechselnd 10,0 und 10,2 → `clear:
  true, direction: "down"`; die drei danach je 10,9 bei übrigen um 9,0 → `"up"`.
- Die drei danach mitten in der Streuung (9,9 · 10,1 · 10,0 bei übrigen zwischen 9 und 11) → `clear: false`.
- Zwei Pausen, eine davon mit p zwischen 0,025 und 0,05 (Fixture so bauen und p im Test über `permutationMeanTest`
  ausrechnen und prüfen) → bei einer Pause wäre sie klar, mit der zweiten nicht (Bonferroni).
- Gleiche Mittel: `deltaRings` genau 0, kein Urteil.
- Mutation: `0.05 / m` testweise durch `0.05` ersetzen, der Bonferroni-Test muss rot werden; danach aus einer
  `cp`-Sicherung zurück.

### T3 Belege

`packages/shot-help/scripts/simulate.ts`:

- neu B22 nach B21, Aufbau wie B10 (40 Schuss, Pause von fünf Minuten nach Schuss 20): Fehlalarm ohne Wirkung und
  „klar schwächer“ erkannt, wenn die drei Schuss danach σ ×1,6 bzw. ×2 haben; Luftgewehr σ 1,5 mm und Luftpistole
  σ 15 mm, Zehntel und ganze Ringe, 5 000 Läufe. Ausgabe wie B21.
- B1 zusätzlich mit derselben Pause nach Schuss 20 („B1 mit Pause“, 40 Schuss), Bedingung um
  `pauseRecovery(match, "decimal")?.effects.some((e) => e.clear)` ergänzt.
- Simulation laufen lassen, Block im Katalog (`vault/spiegel/spiegel-statistics.md`) um B22 und „B1 mit Pause“
  ergänzen, Kopfzeile des Blocks um „B22 und B1 mit Pause neu (21. Oktober 2026)“. Zeile Z4 im Katalog: „… je Schuss
  (B10); „klar“ nach exaktem Permutationstest auf den Unterschied der Mittel (zweiseitig, 95 %, bei m Pausen 0,05/m je
  Pause), Richtung wie das Vorzeichen (B22)“. „Viele Vergleiche“: „fünf Tests“ → „fünf Tests, dazu einer je Pause“.
- Liegt „B1 mit Pause“ über 22,2 % (also eher jede vierte), hält `/implement` an: Dann muss der Leitfaden („jede
  fünfte“) neu formuliert werden, und das ist ein Text für das Textbuch. Liegt der Fehlalarm von B22 in einer Zeile
  über 6 %, hält `/implement` ebenfalls an.

### T4 Beobachtungen

`packages/shot-ui/src/analysis/observations.ts`, Block „pause“:

- Je Pause der erste Satz wie bisher, danach (Textbuch Nr. 2): `direction === "up"` → „ Danach warst du klar
  stärker.“, `"down"` → „ Danach warst du klar schwächer.“, nicht klar und `deltaRings` ungleich 0 und nicht null →
  „ Das kann Zufall sein.“, sonst nichts. Die Sätze der Pausen mit „ “ verbinden; der Schlusssatz „Drei Schuss sind zu
  wenig, …“ entfällt.
- `notable: recovery.effects.some((e) => e.clear)`; `headline`: Satz und Urteil der ersten klaren Pause.
- Doc-Kommentar zu `notable` an `Observation`: „Pausen nur, wenn eine klar ist“.

Tests in `observations.test.ts` (Karte aus `fortyCard()` mit gesetzten Werten, wie „eine Scheibe sagt, was sie
zeigt“): klar schwächer, klar stärker, kann Zufall sein, genau im Schnitt ohne Zusatz; zwei Pausen ergeben zwei
Urteile; `keyObservations` zeigt bei einer klaren Pause deren Satz; kein Text enthält „Drei Schuss sind zu wenig“.

### T5 Karte „Pausen und Wiedereinstieg“

`packages/shot-ui/src/analysis/tabs/TimeTab.tsx`:

- In jeder Zeile „Vor Schuss …“ nach dem Text das `Verdict` (`ok` „klar stärker“, `warn` „klar schwächer“, `none`
  „kann Zufall sein“; kein Etikett bei `deltaRings` null oder 0). Der Wert der Zeile wird dafür JSX:
  `<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">{text}{verdict}</span>`.
- `Note` nach Textbuch Nr. 1, bei mehr als einer Pause der Satz zur strengeren Grenze mit der Zahl der Pausen.

Tests in `TimeTab.test.tsx`: Etikett je Zeile (`data-verdict`), der Satz zur Grenze nur bei zwei Pausen
(`fortyCard()` hat eine Pause nach Schuss 20; für zwei Pausen eine zweite Lücke einbauen), kein „Drei Schuss“.

### T6 Hilfe

`packages/shot-help/src/topics.ts`, Thema `pausen`: `read` neu, `caution` letzter Satz, `formula` um „; klar nach
exaktem Permutationstest auf den Unterschied der Mittel (zweiseitig, 95 %, bei m Pausen 0,05/m)“, Wortlaut aus
Textbuch Nr. 3. Leitfaden erzeugen (`pnpm --filter @vereinsheim/shot-help docs`). Test in `topics.test.ts`: `pausen.read`
enthält den Satz zu „klar“.

### T7 Skriptprüfung, Textbuch

- `apps/spiegel/tools/pruefen.ts`, Abschnitt „Eine Scheibe sagt, was sie zeigt“: Jede Zeile „Vor Schuss …“ der Karte
  „pausen“ mit „Ø“ trägt ein Etikett aus den drei Wörtern (gibt die Scheibe keine Pause her, „nicht belegt“ melden).
- Textbuch: Status „umgesetzt auf `feat/spiegel-pause-verdict`, nicht released“, die Abschätzung durch B22 ersetzen.
- Plan nach dem Merge löschen.

## Test steps

- `pnpm --filter @vereinsheim/shot-core test` nach T1 und T2 (inkl. Mutation).
- `pnpm --filter @vereinsheim/shot-help simulate` in T3.
- `pnpm --filter @vereinsheim/shot-ui test` nach T4 und T5, `pnpm --filter @vereinsheim/shot-help test` nach T6.
- `pnpm check` vor jedem Commit (Worktree: Node 24, `.env` der Apps verlinkt).

## Verification

- `pnpm check --force` grün im Worktree.
- `pnpm --filter spiegel pruefen --start --alle` ohne FAIL.
- Im Browser (Dev-Server des Worktrees, Demo-Konto): Karte „Pausen“ mit Etikett je Zeile, Beobachtung mit Urteil. Was
  die Demo-Daten nicht hergeben (etwa „klar schwächer“), steht im Bericht als „nicht belegt“ mit dem Markup-Test.
- Keine neue Brücke nötig.
