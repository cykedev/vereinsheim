# Plan: Ringwerk, Befunde aus den Bestätigungsdialogen

Stand: 20. Oktober 2026 · Branch: `feat/ringwerk-dialog-befunde` (von `feat/design2-all-apps` 9329db17, zurück dorthin)

## Kontext

Beim Umbau der 16 Bestätigungsdialoge auf `DecisionDialog` (Plan `2026-10-16-design2-all-apps.md`, Teil W „Folgen vor
dem Bestätigen“) wurden die Folgen aus den Actions abgelesen. Dabei fielen Stellen auf, an denen Oberfläche und Action
nicht zusammenpassen oder Daten still verloren gehen können. Jener Abschnitt durfte keine Action ändern, deshalb sind
sie offen. Alle sind am Code bestätigt (Stand 9329db17):

1. **Kasten „Wettbewerb löschen“ auch für die Sportleitung.** `src/app/(app)/competitions/[id]/edit/page.tsx` rendert
   `ForceDeleteCompetitionSection` für jede Rolle mit `canManage`. `forceDeleteCompetition` lässt nur ADMIN zu; die
   Sportleitung tippt den Namen und bekommt „Keine Berechtigung“.
2. **Disziplin löschen prüft nur `Competition.disciplineId`** (`src/lib/disciplines/actions.ts`, `deleteDiscipline`).
   - `Series.disciplineId` steht auf `ON DELETE RESTRICT`. Eine Disziplin, die nur in gemischten Wettbewerben Serien
     hat, lässt sich nicht löschen, und statt einer Meldung kommt ein Serverfehler.
   - **Neu gefunden, schwerer:** `CompetitionParticipant.disciplineId` steht auf `ON DELETE SET NULL`. Ist die
     Disziplin in einem gemischten Wettbewerb Teilnehmern zugeordnet, die noch keine Serie haben, gelingt das Löschen,
     und diese Teilnehmer verlieren ihre Disziplin lautlos.
   - Prüfung und Löschen laufen nicht in einer Transaktion (conventions §9).
3. **Entfernen aus dem Wettbewerb lässt Serien zurück** (`src/lib/competitionParticipants/unenroll.ts`). Bei einem
   eingeschriebenen Mitglied (kein Gast) löscht die Action nur die Einschreibung. Die Serien bleiben in der Datenbank,
   ohne Einschreibung, und erscheinen nirgends mehr. Für Paarungen sperrt die Action schon („Bitte Rückzug
   verwenden“), für Serien nicht.
4. **Kein Protokolleintrag** für `advanceRound` (`src/lib/playoffs/actions/match.ts`), `generateCompetitionSchedule`
   (`src/lib/matchups/actions.ts`) und `unenrollParticipant`. Wer eine Runde angelegt, einen Spielplan neu erzeugt oder
   jemanden entfernt hat, lässt sich nicht nachvollziehen.
5. **Kleinere Lücken:**
   - Kein `toast.success` nach „Ergebnis löschen“ (`DeleteEventSeriesButton`), „Serie löschen“
     (`DeleteSeasonSeriesButton`) und „Wettbewerb mit allen Daten löschen“ (`ForceDeleteCompetitionSection`)
     (conventions §2).
   - Den Nachnamen beim Löschen eines Teilnehmers mit allen Daten prüft nur der Client. `deleteParticipant(id, true)`
     bekommt ihn nicht; anders als `forceDeleteCompetition`, das den Namen selbst prüft.

Ringwerk trägt den Wettkampfbetrieb. Es gilt „Ringwerk: Betrieb sichern“ aus dem Design-2-Plan, mit einer Ausnahme:
**Dieser Plan ändert Server-Actions.** Das ist sein Zweck. Keine Schema-Änderung, keine Migration, keine gespeicherten
Daten werden umgeschrieben oder gelöscht.

## Ansatz

Jede Änderung sperrt oder protokolliert; keine löscht mehr als heute.

- **B1:** Kasten nur für ADMIN. Die Action bleibt, wie sie ist.
- **B2:** `deleteDiscipline` zählt in einer Transaktion Wettbewerbe, Einschreibungen und Serien mit der Disziplin und
  löscht nur, wenn alle drei 0 sind. Meldung wie heute.
- **B3:** Entfernen eines Mitglieds mit Ergebnissen sperrt, wie bei Paarungen. Der Weg ist dann „Zurückziehen“; die
  Ergebnisse zählen nicht mehr, bleiben aber gespeichert. Gäste bleiben, wie sie sind (Gast und Ergebnisse werden
  gelöscht; der Dialog sagt das schon). Die Oberfläche zeigt in dem Fall gleich einen Hinweis (`NoticeDialog`).
- **B4:** Drei neue Protokoll-Ereignisse, je in der Transaktion der Action.
- **B5:** Erfolgsmeldungen; `deleteParticipant` bekommt den getippten Nachnamen und prüft ihn selbst.

Bestehende Serien ohne Einschreibung in der Produktion werden **nicht** angefasst. B3 zählt sie nur (lesend, der User
führt die Abfrage aus); was damit geschieht, entscheidet der User danach in einer eigenen Aufgabe.

**Festgelegt in diesem Plan** (beim Freigeben änderbar):

- **E1** B3 sperrt statt zu löschen. Die andere Möglichkeit (Serien beim Entfernen mitlöschen) verliert Ergebnisse, die
  vielleicht noch gebraucht werden.
- **E2** Neue Protokoll-Ereignisse: `SCHEDULE_GENERATED` („Spielplan generiert“), `SCHEDULE_REGENERATED` („Spielplan neu
  generiert“), `PLAYOFF_ROUND_CREATED` („Playoff-Runde angelegt“, Details: Runde), `PARTICIPANT_UNENROLLED`
  („Teilnehmer aus Wettbewerb entfernt“, Details: Name, Gast ja/nein).
- **E3** B5 ändert die Signatur von `deleteParticipant` auf `(id, force, confirmationLastName?)`. Der
  Charakterisierungstest `src/components/app/confirmations.test.tsx` erwartet dann bewusst den dritten Wert
  (`"p1", true, " Birke "`). Das ist die einzige Änderung an diesem Test.
- **E4** Der Ausgangsstand des Prüfbestands (`tools/pruefdaten/referenz/`) wird nach B4 neu aufgenommen: `pruefdaten`
  ruft `generateCompetitionSchedule` und `advanceRound` selbst auf, die Protokollseiten der Ligen bekommen also neue
  Zeilen. Vorher belegt der Vergleich, dass **nur** diese Zeilen neu sind (Haltepunkt B7).
- **E5** Zurück nach `feat/design2-all-apps`, Release zusammen mit Ringwerks Design 2. Die Texte liegen dort
  (`lib/consequences.ts`, Textbuch). B2 betrifft nur ein Admin-Löschen einer Disziplin in gemischten Wettbewerben;
  das Risiko bis dahin ist klein.

## Required Docs

- `vault/conventions.md` §2 (Toasts), §6 (ActionResult), §9 („Prüfen und Löschen gehören in dieselbe Transaktion“,
  „Mocks für Abfragen filtern nach der Bedingung“), §10 (Schreibregeln)
- `apps/ringwerk/CLAUDE.md` (Abschnitt „Vor jedem Release“), `vault/apps/ringwerk/ringwerk-code-conventions.md`,
  `vault/apps/ringwerk/ringwerk-data-model.md`
- Plan `plans/2026-10-16-design2-all-apps.md`, Abschnitt „Ringwerk: Betrieb sichern“ und Teil R (Prüfbestand)
- `vault/apps/ringwerk/ringwerk-pruefbestand.md`, `vault/apps/ringwerk/ringwerk-design2.md` („Dialoge mit Folgen“)
- `vault/_attachments/textbuch-ringwerk-treffsicher.md`, Abschnitt „Ringwerk: Folgen vor dem Bestätigen“

## Geschützte Schritte und Haltepunkte

- **B0 Textbuch (Haltepunkt):** Der User gibt die neuen Texte frei, erst dann Code.
- **B6 Abfrage an der Produktion (Haltepunkt, User):** nur lesend, der User führt sie aus.
- **B7 Ausgangsstand neu (Haltepunkt):** `pruefen:aufnehmen` schreibt `tools/pruefdaten/referenz/` nur nach Freigabe
  (`apps/ringwerk/CLAUDE.md`, Punkt 6).
- Alle anderen Tasks kann `/implement` autonom abarbeiten; keiner berührt geschützte Pfade.

---

## B0 — Textbuch (Haltepunkt)

Neuer Abschnitt „Ringwerk: Befunde (B0)“ in `vault/_attachments/textbuch-ringwerk-treffsicher.md`, je „alt → neu“:

- **Dialog 6 „Aus dem Wettbewerb entfernen“:**
  - entfällt: „(nur mit Ergebnissen, kein Gast) Die {2} Ergebnisse erscheinen nicht mehr. Gelöscht werden sie nicht.“
  - Was nicht passiert, alt: „Das Protokoll bekommt keinen Eintrag.“ → wird unter „Was dann passiert“: „Im Protokoll
    des Wettbewerbs steht danach ein Eintrag.“
  - Worum, alt: „… Es gibt {2} Ergebnisse.“ → bleibt nur für Gäste (bei Mitgliedern mit Ergebnissen kommt 6b).
- **Neu 6b, Hinweis (Mitglied mit Ergebnissen):**
  - Titel: „{Anna Birke} lässt sich nicht entfernen“
  - Text: „{Anna Birke} hat in diesem Wettbewerb schon {2} Ergebnisse. Damit sie nicht verloren gehen, lässt sich
    {Anna Birke} nur zurückziehen. Dann zählen die Ergebnisse nicht mehr, bleiben aber gespeichert.“
  - Knopf: Schließen
  - Meldung der Action im selben Fall: „Teilnehmer hat schon Ergebnisse und kann nicht entfernt werden. Bitte
    zurückziehen.“
- **Dialog 12 „Nächste Runde anlegen“:** „Das Protokoll bekommt keinen Eintrag.“ → unter „Was dann passiert“: „Im
  Protokoll des Wettbewerbs steht danach ein Eintrag.“
- **Dialog 16 „Spielplan (neu) generieren“:** dasselbe wie 12, in beiden Varianten.
- **Dialog 7 „Disziplin löschen“, Vorher prüfen:** „… Wird die Disziplin in einem Wettbewerb verwendet, geht das nicht.
  …“ → „… Wird die Disziplin in einem Wettbewerb verwendet, auch nur für einzelne Teilnehmer, geht das nicht. …“
- **Protokoll-Bezeichnungen** (E2): „Spielplan generiert“, „Spielplan neu generiert“, „Playoff-Runde angelegt“,
  „Teilnehmer aus Wettbewerb entfernt“.
- **Erfolgsmeldungen:** „Ergebnis gelöscht.“, „Serie gelöscht.“, „Wettbewerb gelöscht.“
- **Meldung der Action bei falschem Nachnamen:** „Der eingegebene Nachname stimmt nicht mit dem Teilnehmer überein.“

**HALT:** Der User liest und gibt frei.

## B1 — „Wettbewerb löschen“ nur für Admins

- `src/app/(app)/competitions/[id]/edit/page.tsx`: `isAdmin` aus `@/lib/auth-helpers` importieren und den Kasten nur
  rendern, wenn `isAdmin(session.user.role)`:
  ```tsx
  {isAdmin(session.user.role) && (
    <div className="pt-6">
      <ForceDeleteCompetitionSection
        competitionId={id}
        competitionName={competition.name}
        isPublic={competition.isPublic}
      />
    </div>
  )}
  ```
- `tools/pruefen-ringwerk/ablaeufe.ts`, Schritt „erzwungen löschen verweigert (Sportleitung)“: umbenennen in „kein
  Löschen mit allen Daten für die Sportleitung“; statt Knopf, Name und Meldung prüft er
  `!btn("Wettbewerb mit allen Daten löschen")` auf `/competitions/${id}/edit` und danach wie heute, dass Wettbewerb und
  Serien in der Datenbank bleiben.
- Test: Die Ablehnung durch die Action deckt `lib/competitions/actions.test.ts` schon ab („verweigert MANAGER das
  Löschen“). Neu ist nur die Seite; sie prüft der Ablauf.

## B2 — Disziplin löschen nur ohne jede Verwendung

- `src/lib/disciplines/actions.ts`, `deleteDiscipline`: nach Session-/Rollenprüfung alles in einer Transaktion:
  ```ts
  const result = await db.$transaction(async (tx) => {
    const discipline = await tx.discipline.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!discipline) return { error: "Disziplin nicht gefunden." } as const
    const [competitions, enrolments, series] = await Promise.all([
      tx.competition.count({ where: { disciplineId: id } }),
      tx.competitionParticipant.count({ where: { disciplineId: id } }),
      tx.series.count({ where: { disciplineId: id } }),
    ])
    if (competitions + enrolments + series > 0) {
      return { error: "Disziplin kann nicht gelöscht werden — sie wird in Wettbewerben verwendet." } as const
    }
    await tx.auditLog.create({ data: { eventType: "DISCIPLINE_DELETED", entityType: "DISCIPLINE", entityId: id,
      userId: session.user.id, details: { name: discipline.name } } })
    await tx.discipline.delete({ where: { id } })
    return { success: true } as const
  }, { isolationLevel: "Serializable" })
  if ("success" in result) revalidateDisciplinePaths()
  return result
  ```
- `src/lib/disciplines/actions.test.ts`, `describe("deleteDiscipline")`: das Mock der drei `count` filtert nach
  `where.disciplineId` über eine Fixture mit Zeilen für die eigene **und** eine fremde Disziplin (conventions §9). Neue
  Fälle:
  - „sperrt, wenn nur eine Einschreibung die Disziplin trägt“ (Wettbewerb 0, Einschreibung 1, Serie 0) → Fehler,
    `discipline.delete` nicht gerufen
  - „sperrt, wenn nur Serien die Disziplin tragen“ (gemischter Wettbewerb) → Fehler
  - „löscht, wenn nur eine fremde Disziplin verwendet wird“ → `delete` genau einmal mit `{ where: { id } }`, ein
    Protokolleintrag
  - Gegenprobe: `tx.competitionParticipant.count` testweise aus der Summe nehmen → der erste neue Fall wird rot.
- `src/lib/consequences.ts`, `disciplineDelete`: Text „Vorher prüfen“ wie in B0; `consequences.test.ts` nachziehen.

## B3 — Entfernen sperrt bei Ergebnissen

- `src/lib/competitionParticipants/unenroll.ts`: Prüfung und Löschen in eine Transaktion (`Serializable`). Für
  Nicht-Gäste vor dem Löschen:
  ```ts
  const results = await tx.series.count({
    where: { participantId: cp.participantId, competitionId: cp.competitionId },
  })
  if (results > 0) return { error: "Teilnehmer hat schon Ergebnisse und kann nicht entfernt werden. Bitte zurückziehen." }
  ```
  Die Paarungs-Sperre wandert mit in die Transaktion. Gäste wie heute (Serien, Einschreibung, stiller Teilnehmer,
  leeres Team). Der Protokolleintrag kommt in B4.
- Oberfläche: `CompetitionParticipantActions` gibt `UnenrollAction` schon `results` (`entry.seriesCount`) und `guest`.
  `UnenrollAction` zeigt bei `!guest && results > 0` statt des `DecisionDialog` den `NoticeDialog` aus
  `unenrollBlocked({ name, results })` (neu in `lib/consequences.ts`, Text 6b). `unenroll()` verliert die Zeile
  „Ergebnisse erscheinen nicht mehr“ und nennt „Es gibt {n} Ergebnisse.“ nur noch für Gäste.
- Tests:
  - `src/lib/competitionParticipants/actions.test.ts`, `describe("unenrollParticipant")`: neu „sperrt ein Mitglied mit
    Ergebnissen“ (Mock `series.count` filtert nach `participantId` **und** `competitionId`, Fixture mit Serien desselben
    Teilnehmers in einem anderen Wettbewerb) → Fehler, `competitionParticipant.delete` nicht gerufen; „entfernt ein
    Mitglied, das nur in einem anderen Wettbewerb Ergebnisse hat“ → gelöscht. Bestehende Fälle auf `$transaction`
    anpassen.
  - neu `src/components/app/competitionParticipants/participant-actions/UnenrollAction.test.tsx` (Stellvertreter aus
    `src/test/confirm-capture.ts`): Mitglied mit Ergebnissen → `notices` hat den Titel 6b, `confirms` ist leer; Gast
    mit Ergebnissen → eine Bestätigung.
  - `src/components/app/confirmations.test.tsx` bleibt unverändert (sein Fall hat `seriesCount: 0`).
  - `consequences.test.ts`: Wortlaut 6 und 6b.
- **B6 Abfrage an der Produktion (Haltepunkt, User, nur lesend):** Wie viele Serien liegen heute ohne Einschreibung?
  ```sql
  SELECT c.name, count(*) FROM "Series" s JOIN "Competition" c ON c.id = s."competitionId"
  WHERE s."matchupId" IS NULL AND NOT EXISTS (
    SELECT 1 FROM "CompetitionParticipant" cp
    WHERE cp."competitionId" = s."competitionId" AND cp."participantId" = s."participantId")
  GROUP BY c.name ORDER BY c.name;
  ```
  Das Ergebnis kommt in den Validierungsbericht. Was mit solchen Serien geschieht, ist nicht Teil dieses Plans.

## B4 — Protokolleinträge

- `src/lib/auditLog/types.ts`: die vier Ereignisse aus E2 in `AuditEventType` und `AUDIT_EVENT_LABELS`.
- `src/lib/auditLog/description.ts` und `formatDetails.ts`: Fälle für die vier Ereignisse (Runde über `ROUND_LABELS`,
  Name, Gast).
- `src/lib/matchups/actions.ts`, `generateCompetitionSchedule`: in der Transaktion vor dem `deleteMany` zählen, ob schon
  Paarungen da sind (`tx.matchup.count({ where: { competitionId } })`), und nach dem `createMany`
  `tx.auditLog.create` mit `SCHEDULE_REGENERATED` bzw. `SCHEDULE_GENERATED`, `entityType: "COMPETITION"`,
  `details: { matchups: matchupData.length }`.
- `src/lib/playoffs/actions/match.ts`: `handleMatchCompletion` bekommt `userId`; nach dem Anlegen (Finale wie andere
  Runden) `tx.auditLog.create` mit `PLAYOFF_ROUND_CREATED`, `details: { round: nextRound }`.
- `src/lib/competitionParticipants/unenroll.ts`: in der Transaktion aus B3 `PARTICIPANT_UNENROLLED`,
  `entityType: "COMPETITION_PARTICIPANT"`, `details: { participantId, name, isGuest }`.
- `src/lib/consequences.ts`: Zeilen aus B0 für 6, 12, 16.
- Tests: je Action ein Fall „schreibt einen Protokolleintrag in der Transaktion“ (Mock `tx.auditLog.create`, genau
  einmal, mit `eventType` und Details); `generateCompetitionSchedule` einmal ohne und einmal mit bestehenden Paarungen;
  ein Fehler vor dem Anlegen schreibt keinen Eintrag. Neu `src/lib/auditLog/description.test.ts`: je neues Ereignis
  Bezeichnung und Beschreibung (Runde als „Halbfinale“, Gast markiert).

## B5 — Erfolgsmeldungen, Nachname auf dem Server

- `DeleteEventSeriesButton`, `DeleteSeasonSeriesButton`: im Erfolgsfall `toast.success("Ergebnis gelöscht.")` bzw.
  `toast.success("Serie gelöscht.")`. `ForceDeleteCompetitionSection`: vor `router.push("/competitions")`
  `toast.success("Wettbewerb gelöscht.")`.
- `src/lib/participants/delete.ts`: `deleteParticipant(id, force, confirmationLastName?: string)`. Bei `force`:
  `if ((confirmationLastName ?? "").trim() !== participant.lastName) return { error: "Der eingegebene Nachname stimmt nicht mit dem Teilnehmer überein." }`
  vor der Transaktion.
- `useParticipantRowActions.handleDelete(force)`: ruft `deleteParticipant(participantId, force, force ? confirmName : undefined)`.
- Tests:
  - `src/lib/participants/actions.test.ts`, `describe("deleteParticipant (force=true)")`: bestehende Fälle mit
    Nachnamen; neu „lehnt einen falschen Nachnamen ab, ohne zu löschen“ und „ohne Nachnamen“.
  - `src/components/app/confirmations.test.tsx` (E3): Erwartung `("p1", true, " Birke ")`; Erfolgsmeldung in den
    drei Fällen `expect(mocks.toastSuccess).toHaveBeenCalledTimes(1)`.

## B7 — Abgleich und Ausgangsstand (Haltepunkt)

1. `pnpm --filter ringwerk build`, `pnpm --filter ringwerk pruefdaten`, `pnpm --filter ringwerk pruefen:vergleichen`.
2. Erwartet: Fehler **nur** auf Seiten `audit-log@…` von Ligen, und dort nur neue Zeilen „Spielplan generiert“,
   „Spielplan neu generiert“, „Playoff-Runde angelegt“. Jede andere Abweichung ist ein Befund und stoppt den Plan.
3. **HALT:** Der User sieht den Befund (`reports/ringwerk-vergleich/<zeit>/befund.md`) und gibt die neue Aufnahme frei.
4. `pnpm --filter ringwerk pruefdaten`, `pnpm --filter ringwerk pruefen:aufnehmen`, committen
   (`tools/pruefdaten/referenz/`), danach `pruefdaten` + `pruefen:vergleichen`: 0 Fehler.
5. `pruefdaten`, `pruefen:ablaeufe`: grün (bekannt: Disziplin nach Feldfehler).

## B8 — Doku

- `vault/apps/ringwerk/ringwerk-data-model.md` bzw. `ringwerk-features.md`: Entfernen sperrt bei Ergebnissen;
  Disziplin löschen nur ohne jede Verwendung; neue Protokoll-Ereignisse.
- `vault/apps/ringwerk/ringwerk-pruefbestand.md`: Ausgangsstand neu aufgenommen, mit Datum der Aufnahme und Grund (neue Protokollzeilen).
- Textbuch: Status von B0 auf „freigegeben“; im Abschnitt „Befunde beim Ablesen“ die erledigten markieren.

## Tests (Überblick)

| Wo | Was |
| --- | --- |
| `lib/disciplines/actions.test.ts` | drei Zählungen, gefilterte Mocks, Gegenprobe |
| `lib/competitionParticipants/actions.test.ts` | Sperre bei Ergebnissen, Protokolleintrag, Transaktion |
| `lib/matchups/actions.test.ts` | Protokoll generiert/neu generiert, kein Eintrag bei Abbruch |
| `lib/playoffs/actions/match.test.ts` | Protokoll je angelegte Runde, auch Finale |
| `lib/participants/actions.test.ts` | Nachname auf dem Server |
| `lib/consequences.test.ts` | Wortlaut 6, 6b, 7, 12, 16 |
| `components/app/confirmations.test.tsx` | dritter Wert (E3), Erfolgsmeldungen |
| neu `UnenrollAction.test.tsx` | Hinweis statt Bestätigung bei Ergebnissen |
| neu `lib/auditLog/description.test.ts` | vier neue Ereignisse |

## Verifikation

- `pnpm check` grün; `./scripts/consistency-check.sh` OK.
- `git diff --stat feat/design2-all-apps -- apps/ringwerk/prisma` leer (keine Migration).
- B7: Vergleich vor der Neuaufnahme nur mit den erwarteten Protokollzeilen, danach 0 Fehler; Abläufe grün.
- `pnpm --filter ringwerk pruefen` 0 FAIL; Treffsicher und Spiegel `pruefen` laufen nicht (kein geteilter Code
  geändert), außer `packages/*` ändert sich doch.
- R7 an der Kopie der echten Daten: `pruefen:aufnehmen --echt` vor, `pruefen:vergleichen --echt` nach dem Branch,
  0 Fehler (dort laufen keine Actions, die Protokollseiten bleiben gleich).
- `/review` gegen diesen Plan und „Ringwerk: Betrieb sichern“; Rückführung nach `feat/design2-all-apps` nur mit OK des
  Users, per Fast-Forward oder Rebase.
