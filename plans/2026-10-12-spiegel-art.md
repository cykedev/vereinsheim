# Spiegel: Art der Scheibe festlegen und speichern

## Kontext

Offener Einzelpunkt aus [[spiegel-roadmap]] (User, 12. Oktober 2026): Ob eine Scheibe Wettkampf oder Training ist, kommt
sonst von nirgendwo. `Card.kind` gibt es, gesetzt wird es nur von `seed:own` (alle „training“). Gebraucht wird die Art
für die Vorgabe der Wertung (Wettkampf in der amtlichen, `plans/2026-10-12-spiegel-wertung.md`), den Filter „Art“ in
Liste und Fortschritt, die Rekorde „nur Wettkampf“ und später Wettkampf gegen Training (W1–W4, SP-2.7).

Geprüft vor dem Plan:
- **`Status` der SSMDB2 taugt nicht als Vorschlag:** An der Vereinsanlage ist er bei allen 1.532 Scheiben leer
  (Erkundung vom 9. Oktober 2026, `SELECT Status, COUNT(*) FROM Scheiben GROUP BY Status`).
- **Die einzige Spur ist die `Rangliste`**, ein freier Vereinstext („Training-LP“, „Uebung-LG“, „RWK_Verein_LG1“,
  „LG Vereinsmeister“, „Jahrespreis“, „König-LP“, …). Als Vorschlag ginge sie nur über eine Zuordnung des Admins
  ([[adr-029]]: nichts Vereinsspezifisches im Code), und lesen kann sie erst der Adapter (SP-1.6 b), den es noch nicht
  gibt.
- **Die Projektion hängt nicht an der Art** (`saveProjection` rechnet mit `kind: "training"`; die Übersichten filtern
  die Art beim Lesen). Ein Wechsel rechnet nichts neu.

Entschieden mit dem User am 12. Oktober 2026 („ja passt“): Schalter in der Ergebnis-Box neben der Wertung; ohne Wahl
gilt die Art der Quelle, vorerst Training; der Vorschlag aus der Rangliste ist ein eigener Punkt mit dem Adapter.

## Entscheidungen

- **Daten wie bei der Wertung:** `Card.kind` bleibt die Art der Quelle (heute `seed:own`, später der Adapter, jeder
  Stand schreibt sie neu). Neu `Card.kindChoice CardKind?`, die Wahl des Schützen; `writeRevision` fasst sie nie an, so
  übersteht sie neue Lesungen. **Es gilt `kindChoice ?? kind`.**
- **Lesen liefert die geltende Art:** `OverviewCard.kind` und `PageCard.kind` sind `kindChoice ?? kind`. Daraus folgen
  ohne weitere Änderung der Filter „Art“, das Kennzeichen in der Liste (Pokal), die Metazeile der Scheibe, die Rekorde
  „nur Wettkampf“ und die Vorgabe der Wertung (`cardScoring` bekommt die geltende Art). Eine gewählte Wertung bleibt.
- **Speichern:** Server Action `setCardKind(cardId, kind)` in `src/lib/card-kind-actions.ts`, nur eigene, nicht gelöschte
  Scheiben (auch für Admins); eine Scheibe nur aus Probe ist immer Training und lässt sich nicht umstellen. Danach
  `revalidatePath("/", "layout")`: Die Art ändert Filter, Rekorde und über die Wertung der Scheibe die häufigste Wertung
  ihrer Familie.
- **Bedienung:** In der Ergebnis-Box der Seite einer Scheibe unter der Wertung ein Umschalter „Training | Wettkampf“
  (`KindSwitch` aus `shot-ui`, Segment mit dem Namen „Art“), automatisch gespeichert; ein Tippen auf das aktive Segment
  speichert nichts, ein Fehler steht als Text darunter (wie die Wertung). Bei einer Scheibe nur aus Probe kein Schalter.
- **Die Seite folgt der Vorgabe:** Ändert sich `card.scoring` vom Server (die Art verschiebt die Vorgabe, etwa
  Training → Wettkampf: von „wie am Stand“ auf amtlich), stellt die Seite ihre Ansicht auf die neue Wertung. Eine selbst
  gewählte Wertung ist gespeichert und damit `card.scoring`, sie bleibt.
- **Speichern und Fehler einmal:** `saveScoring` wird allgemein (`saveChoice` in `src/lib/save-choice.ts`, Text des
  Fehlers als Parameter), dazu ein Hook `useSavedChoice` (`src/components/shell/useSavedChoice.ts`) für gezeigt sofort,
  Gleichheit, Fehler. `ScoringControl` und das neue `KindControl` nutzen ihn.
- **Labor:** unverändert (keine Datenbank, die Arten der Saison stehen fest); `KindSwitch` hat einen Markup-Test in
  `shot-ui`.
- **Nicht hier:** mehrere Scheiben auf einmal markieren (Auswahl, N4); Vorschlag aus der Rangliste (Admin-Zuordnung, mit
  dem Adapter SP-1.6 b).

## Aufgaben

1. **Schema** (ohne Marker: Schema und Migration sind für den Autopiloten gesperrt, der User hat sie beauftragt):
   - `apps/spiegel/prisma/schema.prisma`, in `Card` nach `kind`:
     ```prisma
     // vom Schützen auf der Seite der Scheibe gewählt; null: die Art der Quelle (`kind`). Ein Stand schreibt nur `kind`
     kindChoice        CardKind?
     ```
   - `prisma/migrations/20261010175045_init/migration.sql` neu aus `pnpm exec prisma migrate diff --from-empty
     --to-schema prisma/schema.prisma --script` ohne die Zeilen `-- CreateSchema` und `CREATE SCHEMA`; im Wegwerf-Postgres
     (`postgres:15-alpine`) anwenden, `migrate diff --from-config-datasource` muss „This is an empty migration.“ melden.
   - Dev-Datenbank additiv nachziehen (`migrate diff --from-config-datasource … --script | prisma db execute --stdin`),
     `prisma generate`; danach dem User sagen, dass er zurücksetzen kann, dann `seed:own`.
   - Test in `src/lib/db/cards.test.ts`: `kindChoice` gesetzt, ein neuer Stand mit `kind: "training"` ändert sie nicht.
2. **Lesen und Schreiben** (`src/lib/db/reads.ts`, `src/lib/db/cards.ts`):
   - `OVERVIEW_SELECT` und `PAGE_CARD_SELECT` mit `kindChoice`; `toOverview` und `toPageCard` setzen
     `kind: row.kindChoice ?? row.kind`; `scoringOfRow` nimmt dieselbe geltende Art.
   - `chooseCardKind(db, { cardId, ownerId, kind }): Promise<"saved" | "missing" | "probeOnly">` in `cards.ts`: eigene,
     nicht gelöschte Scheibe (sonst `missing`), mit `projection.probeOnly` → `probeOnly`, sonst `updateMany` mit
     `kindChoice` und `saved`.
   - Tests in `reads.test.ts`: Wahl vor Quelle in Übersicht und Seite; Training → Wettkampf verschiebt die Wertung der
     Scheibe von „wie am Stand“ (Zehntel der Testscheiben) auf amtlich (ganze Ringe); eine gewählte Wertung bleibt.
3. **Server Action** `src/lib/card-kind-actions.ts` (`"use server"`): `setCardKind(cardId: string, kind: CardKind)`.
   Sitzung wie `scoring-actions.ts` (`getAuthSession`, nicht `mustChangePassword`, sonst `{ error: "Nicht angemeldet" }`),
   Art `training` oder `competition` (sonst `{ error: "Unbekannte Art." }`), `isCardId` (sonst `{ error: "Die Scheibe gibt
   es nicht." }`); `missing` → dieselbe Meldung, `probeOnly` → `{ error: "Eine Scheibe nur aus Probe ist Training." }`;
   danach `revalidatePath("/", "layout")`, `{ success: true }`; Fehler aus der Datenbank → `{ error: "Die Art ließ sich
   nicht speichern." }`. Tests `card-kind-actions.test.ts`: eigene, fremde (auch Admin), gelöschte, unbekannte Scheibe,
   nur Probe, ungültige Art, ohne Sitzung, mit Passwort vom Admin.
4. **shot-ui** `packages/shot-ui/src/controls/KindSwitch.tsx`: `KindSwitch({ kind, onChange, className })` mit
   `Segmented` (`label="Art"`, Optionen `training` „Training“ und `competition` „Wettkampf“); Export
   `"./controls/KindSwitch"` in `packages/shot-ui/package.json`; Markup-Test in `controls/controls.test.tsx` (Name „Art“,
   aktive Option).
5. **App:**
   - `src/lib/scoring-save.ts` → `src/lib/save-choice.ts`: `saveChoice<T>(save, value, notSaved)`; Test umziehen
     (`save-choice.test.ts`), dazu ein Fall mit eigenem Text.
   - `src/components/shell/useSavedChoice.ts`: `useSavedChoice<T extends string>(value, save, notSaved, onShow?)` →
     `{ shown, change, error }` (`useOptimistic`, `useTransition`, Gleichheit, `saveChoice`).
   - `ScoringControl` auf den Hook; neu `src/components/shell/KindControl.tsx` (`KindSwitch` mit Fehlertext).
   - `CardScreen`: im Platz `scoring` von `CardResult` beide untereinander, `KindControl` nur ohne
     `probeOnlyShots(card.shots)`; `save={(kind) => setCardKind(card.id, kind)}`. Folgt der Vorgabe: Zustand
     `seenScoring`, bei neuem `card.scoring` `dispatch({ type: "setScoring", scoring: card.scoring })` (Muster wie
     `seen` der Darstellung).
   - Test in `src/lib/overview.test.ts`: eine Scheibe mit `kindChoice: "competition"` steht im Filter „Wettkampf“ der
     Liste und nicht im Filter „Training“.
6. **Doku:**
   - [[spiegel-navigation]]: Abschnitt „Art der Scheibe (12. Oktober 2026)“; [[spiegel-db-schema]]: `Card.kindChoice`;
     [[spiegel-roadmap]]: Einzelpunkt erledigt, neuer Einzelpunkt „Vorschlag der Art aus der Rangliste
     (Admin-Zuordnung), mit dem Adapter SP-1.6 b“; [[meyton-ssmdb2]]: `Status` an der Vereinsanlage bei allen 1.532
     Scheiben leer.
   - `apps/spiegel/CLAUDE.md` (Art wie die Wertung: Quelle und Wahl, `setCardKind`, `useSavedChoice`),
     `packages/shot-ui/CLAUDE.md` (Export `controls/KindSwitch`).

## Dateien

- `apps/spiegel/prisma/schema.prisma`, `prisma/migrations/20261010175045_init/migration.sql`
- `apps/spiegel/src/lib/db/{cards,reads}.ts` und Tests, `src/lib/card-kind-actions.ts` und Test,
  `src/lib/save-choice.ts` und Test (statt `scoring-save.ts`), `src/lib/overview.test.ts`
- `apps/spiegel/src/components/shell/{useSavedChoice.ts,ScoringControl.tsx,KindControl.tsx}`,
  `src/components/card/CardScreen.tsx`
- `packages/shot-ui/src/controls/{KindSwitch.tsx,controls.test.tsx}`, `packages/shot-ui/package.json`
- Doku wie in Aufgabe 6

## Required Docs

- `apps/spiegel/CLAUDE.md` (Wertung je Scheibe und je Familie, eine Migration bis zum Deploy, Tests gegen die
  Dev-Datenbank), `packages/shot-ui/CLAUDE.md`, `vault/conventions.md` §6 (ActionResult), §9, §10
- [[spiegel-navigation]] („Wertung je Scheibe und je Familie“), [[spiegel-db-schema]], [[meyton-ssmdb2]] („Status und
  Wertungsmodus“), [[adr-029]]
- `plans/2026-10-12-spiegel-wertung.md` und `reports/2026-10-12-spiegel-wertung-review.md` (gleiches Muster)

## Tests

- **Datenbank:** `kindChoice` übersteht einen neuen Stand; Übersicht und Seite liefern die Wahl vor der Quelle; die
  Wertung der Scheibe folgt der geltenden Art, eine gewählte bleibt; `chooseCardKind` eigene, fremde, gelöschte, nur
  Probe.
- **Action:** wie Aufgabe 3.
- **Übersicht:** Filter „Wettkampf“ und „Training“ nach der geltenden Art.
- **shot-ui:** `KindSwitch` Name „Art“, aktive Option.
- **Speichern:** `saveChoice` gespeichert, Fehler der Action, abgelehnter Aufruf, eigener Text.

## Verifikation

- `pnpm check` vom Repo-Root, Labor `pruefen`, `vault-lint`.
- Browser (eigene Scheiben nach Zurücksetzen und `seed:own`, frischer Tab):
  - LP 20 vom 22.05.2026 (Training, am Stand Zehntel, amtlich ganze Ringe): auf „Wettkampf“ gestellt → Metazeile
    „Wettkampf“, die Seite zeigt 170 ganze Ringe; nach Neuladen weiter Wettkampf.
  - Liste: die Zeile mit Pokal, vorn fett 170 ganze Ringe; Filter „Wettkampf“ zeigt sie, „Training“ nicht.
  - Scheibe nur aus Probe: kein Schalter der Art.
  - Tippen auf das aktive Segment: kein POST. Konsole ohne Fehler.
