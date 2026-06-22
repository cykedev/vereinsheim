# Spec: R-04 Action Tests

**Datum:** 2026-03-28
**Branch:** feat/r-04-action-tests
**Basis:** Review-Plan R-04 — Fehlende Tests für Series-, User- und Results-Actions

---

## Ziel

Vollständige Testabdeckung für alle vier Action-Module, die bisher keine oder unvollständige Tests haben:

1. `src/lib/series/actions.ts` — 5 Funktionen, bisher 0 Tests
2. `src/lib/users/actions.ts` — 4 Funktionen, bisher 0 Tests
3. `src/lib/results/actions.ts` — 1 Funktion, bisher 0 Tests
4. `src/lib/competitionParticipants/actions.ts` — 3 Funktionen ohne Tests (`withdrawParticipant`, `revokeWithdrawal`, `updateStartNumber`)

---

## Ansatz

Jede Datei folgt dem etablierten Muster aus `competitions/actions.test.ts`:

- `vi.hoisted()` für alle Mocks
- `vi.mock()` für Module (`@/lib/auth-helpers`, `next/cache`, `@/lib/db`)
- `describe`-Block pro Funktion
- `beforeEach`: `vi.resetAllMocks()` + Happy-Path-Defaults
- `it`-Cases für Auth-Guards, Validierung, Business Logic und Erfolgs-Pfad
- Mocks liefern realistische Daten (keine leeren `{}`)

---

## Scope pro Datei

### 1. `src/lib/series/actions.test.ts` _(neu)_

**Mocks:** `getAuthSession`, `revalidatePath`, `db.competition.findUnique`, `db.competitionParticipant.findUnique`, `db.competitionParticipant.findFirst`, `db.discipline.findUnique`, `db.series.findUnique`, `db.series.create`, `db.series.update`, `db.series.delete`, `db.auditLog.create`

#### `saveEventSeries`

- Fehler ohne Session
- Fehler ohne Admin-Rolle
- Fehler: Competition nicht gefunden
- Fehler: Competition-Typ ist SEASON (nicht EVENT)
- Fehler: Competition ist ARCHIVED
- Fehler: CP nicht in Wettbewerb eingeschrieben
- Fehler: Validierung — fehlende Ringe
- Fehler: Validierung — negativer Teiler
- Neue Serie anlegen (kein `existing` → `db.series.create`)
- Vorhandene Serie korrigieren (`existing` vorhanden → `db.series.update`)
- Disziplin aus CP verwenden (wenn `cp.disciplineId` gesetzt)
- Disziplin aus Competition verwenden (wenn `cp.disciplineId` null)

#### `deleteEventSeries`

- Fehler ohne Session
- Fehler ohne Admin-Rolle
- Fehler: Serie nicht gefunden
- Fehler: Serie gehört nicht zur angegebenen competitionId
- Erfolg: Serie gelöscht, auditLog geschrieben, revalidatePath aufgerufen

#### `saveSeasonSeries`

- Fehler ohne Session
- Fehler ohne Admin-Rolle
- Fehler: Competition nicht gefunden
- Fehler: Competition-Typ ist EVENT (nicht SEASON)
- Fehler: Competition ist ARCHIVED
- Fehler: CP nicht in Wettbewerb eingeschrieben
- Fehler: Validierung — fehlendes sessionDate
- Disziplin-Auflösung: disciplineId aus formData
- Disziplin-Auflösung: disciplineId aus CP (kein formData-Wert)
- Erfolg: Serie erstellt, auditLog geschrieben

#### `updateSeasonSeries`

- Fehler ohne Session
- Fehler: Serie nicht gefunden
- Fehler: Serie gehört nicht zur angegebenen competitionId
- Fehler: CP nicht in Wettbewerb eingeschrieben
- Erfolg: Serie aktualisiert, auditLog geschrieben

#### `deleteSeasonSeries`

- Fehler ohne Session
- Fehler: Serie nicht gefunden
- Fehler: Serie gehört nicht zur angegebenen competitionId
- Erfolg: Serie gelöscht, auditLog geschrieben

---

### 2. `src/lib/users/actions.test.ts` _(neu)_

**Mocks:** `getAuthSession`, `revalidatePath`, `bcrypt.hash`, `bcrypt.compare`, `db.user.findUnique`, `db.user.findFirst`, `db.user.create`, `db.user.update`, `db.user.count`, `db.auditLog.create`

**Hinweis:** `bcrypt` wird via `vi.mock("bcryptjs", ...)` gemockt, damit Tests schnell bleiben (kein echter Hash).

#### `createUser`

- Fehler ohne Session
- Fehler ohne Admin-Rolle
- Fehler: Validierung — ungültige E-Mail
- Fehler: Validierung — zu kurzes Passwort
- Fehler: E-Mail wird bereits verwendet
- Erfolg: User erstellt, auditLog mit `USER_CREATED` geschrieben

#### `updateUser`

- Fehler ohne Session
- Fehler: User nicht gefunden
- Fehler: E-Mail-Konflikt mit einem anderen User
- Fehler: eigenen Account deaktivieren nicht erlaubt
- Fehler: letzten aktiven Admin degradieren nicht erlaubt (adminCount === 0)
- Fehler: letzten aktiven Admin deaktivieren nicht erlaubt
- Erfolg ohne Passwort-Reset
- Erfolg mit Passwort-Reset (passwordHash gesetzt, sessionVersion++, neues Hash via bcrypt)
- auditLog `USER_UPDATED` geschrieben

#### `setUserActive`

- Fehler ohne Session
- Fehler: User nicht gefunden
- No-op: isActive ist bereits gleich dem gewünschten Wert → `{ success: true }`, kein DB-Update
- Fehler: eigenen Account deaktivieren nicht erlaubt
- Fehler: letzten aktiven Admin deaktivieren nicht erlaubt
- Erfolg: deaktivieren → auditLog `USER_DEACTIVATED`
- Erfolg: reaktivieren → auditLog `USER_REACTIVATED`

#### `changeOwnPassword`

- Fehler ohne Session
- Fehler: Passwörter stimmen nicht überein (via `validatePasswordChangeInput`)
- Fehler: User nicht in DB gefunden
- Fehler: aktuelles Passwort falsch (bcrypt.compare → false)
- Erfolg: neues passwordHash gesetzt, sessionVersion++

---

### 3. `src/lib/results/actions.test.ts` _(neu)_

**Mocks:** `getAuthSession`, `revalidatePath`, `db.matchup.findUnique`, `db.$transaction`, `db.auditLog.create`

#### `saveMatchResult`

- Fehler ohne Session
- Fehler ohne Admin-Rolle
- Fehler: Matchup nicht gefunden
- Fehler: Matchup-Status ist BYE
- Fehler: kein Away-Participant (`awayParticipantId` null)
- Fehler: keine Disziplin konfiguriert
- Ersterfassung: `series.length === 0` → auditLog `RESULT_ENTERED`
- Korrektur: `series.length > 0` → auditLog `RESULT_CORRECTED`
- Fehler: Transaction wirft Exception → `{ error: "Ergebnis konnte nicht gespeichert werden." }`

---

### 4. `src/lib/competitionParticipants/actions.test.ts` _(erweitern)_

Bestehende Tests für `enrollParticipant` und `unenrollParticipant` bleiben unverändert.

**Neue Mocks ergänzen:** `competitionParticipantUpdateMock` (im `vi.hoisted`-Block), `playoffMatchCountMock` (bereits vorhanden)

#### `withdrawParticipant`

- Fehler ohne Session
- Fehler ohne Admin-Rolle
- Fehler: CP nicht gefunden
- Fehler: CP-Status ist bereits WITHDRAWN
- Fehler: Playoffs haben begonnen (`playoffMatch.count > 0`)
- Erfolg: Status → WITHDRAWN, auditLog `PARTICIPANT_WITHDRAWN` geschrieben

#### `revokeWithdrawal`

- Fehler ohne Session
- Fehler: CP nicht gefunden
- Fehler: CP-Status ist nicht WITHDRAWN
- Fehler: Playoffs haben begonnen
- Erfolg: Status → ACTIVE, auditLog `WITHDRAWAL_REVOKED` geschrieben

#### `updateStartNumber`

- Fehler ohne Session
- Fehler: CP nicht gefunden
- Erfolg: Startnummer gesetzt (Zahl)
- Erfolg: Startnummer auf null gesetzt

---

## Nicht im Scope

- Keine Tests für pure Berechnungsfunktionen (bereits in `calculateResult.test.ts` abgedeckt)
- Keine Integration-Tests gegen echte DB
- Keine Tests für `revalidatePath`-Pfade (nur dass es aufgerufen wird, nicht mit welchem Pfad)

---

## Qualitätskriterien

- Alle Tests grün nach `npm run test`
- Mock-Daten realistisch (echte IDs, Namen, Felder — kein leeres `{}`)
- Jeder Test prüft einen klar abgegrenzten Fall
- `auditLog.create` wird in Erfolgs-Cases auf korrekten `eventType` geprüft
