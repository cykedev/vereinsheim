# Spec: Audit Log Gaps (R-03)

Erstellt: 2026-03-28

## Ziel

Alle sicherheits- und verwaltungsrelevanten Mutations in User-, Participant-, Discipline- und Competition-Actions werden ins Audit Log geschrieben. Damit entsteht ein lückenloses Protokoll aller Stammdaten-Änderungen.

---

## Scope

Betrifft ausschließlich:

- `src/lib/auditLog/types.ts` — neue Event-Typen, Labels, Kategorie, Formatierung
- `src/lib/users/actions.ts` — 4 neue `auditLog.create`-Calls
- `src/lib/participants/actions.ts` — 4 neue `auditLog.create`-Calls
- `src/lib/disciplines/actions.ts` — 4 neue `auditLog.create`-Calls
- `src/lib/competitions/actions.ts` — 3 neue `auditLog.create`-Calls
- `.claude/docs/features.md` — Audit-Log-Tabelle aktualisieren

---

## Neue Event-Typen (15)

### User (4)

| Event              | Auslöser               | competitionId |
| ------------------ | ---------------------- | ------------- |
| `USER_CREATED`     | `createUser`           | null          |
| `USER_UPDATED`     | `updateUser`           | null          |
| `USER_DEACTIVATED` | `setUserActive(false)` | null          |
| `USER_REACTIVATED` | `setUserActive(true)`  | null          |

### Participant (4)

| Event                     | Auslöser                      | competitionId |
| ------------------------- | ----------------------------- | ------------- |
| `PARTICIPANT_CREATED`     | `createParticipant`           | null          |
| `PARTICIPANT_UPDATED`     | `updateParticipant`           | null          |
| `PARTICIPANT_DEACTIVATED` | `setParticipantActive(false)` | null          |
| `PARTICIPANT_REACTIVATED` | `setParticipantActive(true)`  | null          |

### Discipline (4)

| Event                 | Auslöser                      | competitionId |
| --------------------- | ----------------------------- | ------------- |
| `DISCIPLINE_CREATED`  | `createDiscipline`            | null          |
| `DISCIPLINE_UPDATED`  | `updateDiscipline`            | null          |
| `DISCIPLINE_ARCHIVED` | `setDisciplineArchived(true)` | null          |
| `DISCIPLINE_DELETED`  | `deleteDiscipline`            | null          |

### Competition (3)

| Event                        | Auslöser               | competitionId    |
| ---------------------------- | ---------------------- | ---------------- |
| `COMPETITION_CREATED`        | `createCompetition`    | neu angelegte ID |
| `COMPETITION_UPDATED`        | `updateCompetition`    | bestehende ID    |
| `COMPETITION_STATUS_CHANGED` | `setCompetitionStatus` | bestehende ID    |

Competition-Events erscheinen im Wettbewerbs-Protokoll **und** global. Alle anderen nur global.

---

## Details-Snapshots

Details sind immer denormalisiert — kein Verweis, Snapshot zum Zeitpunkt der Aktion.

| Event(s)                                             | details-Felder                        |
| ---------------------------------------------------- | ------------------------------------- |
| `USER_CREATED`, `USER_UPDATED`                       | `{ fullName, email, role }`           |
| `USER_DEACTIVATED`, `USER_REACTIVATED`               | `{ fullName, email }`                 |
| `PARTICIPANT_CREATED`, `PARTICIPANT_UPDATED`         | `{ firstName, lastName }`             |
| `PARTICIPANT_DEACTIVATED`, `PARTICIPANT_REACTIVATED` | `{ firstName, lastName }`             |
| `DISCIPLINE_CREATED`, `DISCIPLINE_UPDATED`           | `{ name, scoringType, teilerFaktor }` |
| `DISCIPLINE_ARCHIVED`, `DISCIPLINE_DELETED`          | `{ name }`                            |
| `COMPETITION_CREATED`, `COMPETITION_UPDATED`         | `{ name, type, scoringMode }`         |
| `COMPETITION_STATUS_CHANGED`                         | `{ name, from, to }`                  |

---

## Neue Kategorie `"admin"`

Alle 15 neuen Event-Typen erhalten die Kategorie `"admin"`.

- `AuditEventCategory` in `types.ts` um `"admin"` erweitern
- `AUDIT_EVENT_CATEGORY`-Map: alle 15 neuen Events auf `"admin"` mappen
- `AuditLogList`-Komponente: Badge-Styling für `"admin"` ergänzen (analog zu `"destructive"`)

---

## Formatierung (`formatAuditDetails` + `getAuditDescription`)

Neue Switch-Cases für alle 15 Event-Typen:

**`getAuditDescription`** (Kurzbeschreibung in der Listenansicht):

- User-Events: `fullName`
- Participant-Events: `${firstName} ${lastName}`
- Discipline-Events: `name`
- Competition-Events: `name`
- `COMPETITION_STATUS_CHANGED`: `${name}: ${from} → ${to}`

**`formatAuditDetails`** (Label/Wert-Tabelle in der Detailansicht):

- User: Name, E-Mail, Rolle
- Participant: Vorname, Nachname
- Discipline: Name, Kürzel, Teiler-Faktor (nur bei CREATED/UPDATED)
- Competition: Name, Typ, Wertungsmodus (nur bei CREATED/UPDATED); Von/Nach (nur bei STATUS_CHANGED)

---

## entityType-Konvention

| Gruppe      | entityType      |
| ----------- | --------------- |
| User        | `"USER"`        |
| Participant | `"PARTICIPANT"` |
| Discipline  | `"DISCIPLINE"`  |
| Competition | `"COMPETITION"` |

`entityId` = die jeweilige Datensatz-ID (userId, participantId, disciplineId, competitionId).

---

## Nicht im Scope

- `setDisciplineArchived(false)` (Reaktivierung einer Disziplin) — kein eigenes Event, da in der UI nicht vorgesehen
- `changeOwnPassword` — bewusst kein Audit-Eintrag (nur eigenes Passwort; kein Admin-Vorgang)
- `forceDeleteCompetition` — bereits im `destructive`-Bereich von `competitions/actions.ts` geloggt
- `COMPETITION_ARCHIVED` — wird über `setCompetitionStatus` abgebildet (`COMPETITION_STATUS_CHANGED` mit `to: "ARCHIVED"`)
