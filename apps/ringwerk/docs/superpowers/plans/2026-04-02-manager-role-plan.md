# MANAGER-Rolle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die MANAGER-Rolle vollständig implementieren — Nutzer mit dieser Rolle können Wettbewerbe, Ergebnisse, Teilnehmer und Disziplinen verwalten, haben aber keinen Zugriff auf die Nutzerverwaltung (`/admin/`) und Hard-Deletes.

**Architecture:** Zwei Helper-Funktionen `canManage(role)` und `isAdmin(role)` in `auth-helpers.ts` zentralisieren die Berechtigungslogik. Alle ~45 Role-Checks in Server Actions werden auf den passenden Helper umgestellt. Die Navigation bekommt eine eigene `canManage`-Variable, damit Teilnehmer/Disziplin-Links auch für MANAGER sichtbar sind.

**Tech Stack:** Prisma (Enum-Migration), TypeScript, Vitest, Next.js Server Actions

---

## Required Docs

- `.claude/docs/code-conventions.md` — immer
- `.claude/docs/reference-files.md` — immer
- `.claude/docs/data-model.md` — Rollenmodell verstehen

---

## Dateien im Überblick

| Datei                                             | Aktion | Zweck                                                                                 |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                            | Modify | `MANAGER` zum `UserRole` Enum hinzufügen                                              |
| `prisma/migrations/…`                             | Create | Migration `add_manager_role`                                                          |
| `src/lib/auth-helpers.ts`                         | Modify | `canManage()` und `isAdmin()` hinzufügen                                              |
| `src/lib/auth-helpers.test.ts`                    | Create | Tests für die neuen Helper-Funktionen                                                 |
| `src/lib/competitions/actions/create.ts`          | Modify | `isAdmin` → `canManage`                                                               |
| `src/lib/competitions/actions/update.ts`          | Modify | beide Checks → `canManage`                                                            |
| `src/lib/competitions/actions/delete.ts`          | Modify | `deleteCompetition` → `canManage`, `forceDeleteCompetition` → `isAdmin`               |
| `src/lib/disciplines/actions.ts`                  | Modify | create/update/archive → `canManage`, delete → `isAdmin`                               |
| `src/lib/participants/actions.ts`                 | Modify | alle 3 Checks → `canManage`                                                           |
| `src/lib/competitionParticipants/actions.ts`      | Modify | alle 5 Checks → `canManage`                                                           |
| `src/lib/series/actions.ts`                       | Modify | alle 5 Checks → `canManage`                                                           |
| `src/lib/results/actions.ts`                      | Modify | 1 Check → `canManage`                                                                 |
| `src/lib/matchups/actions.ts`                     | Modify | 1 Check → `canManage`                                                                 |
| `src/lib/playoffs/actions/start.ts`               | Modify | 1 Check → `canManage`                                                                 |
| `src/lib/playoffs/actions/match.ts`               | Modify | 1 Check → `canManage`                                                                 |
| `src/lib/playoffs/actions/duel.ts`                | Modify | 2 Checks → `canManage`                                                                |
| `src/lib/playoffs/actions/manualDuel.ts`          | Modify | 1 Check → `canManage`                                                                 |
| `src/lib/users/actions.ts`                        | Modify | Zod-Schema: `["ADMIN", "USER"]` → `["ADMIN", "MANAGER", "USER"]`                      |
| `src/components/app/shell/Navigation.tsx`         | Modify | `isAdmin` aufteilen in `canManage` + `isAdmin`                                        |
| `src/lib/competitions/actions.test.ts`            | Modify | MANAGER-Tests: canManage-Aktionen ✓, forceDelete ✗                                    |
| `src/lib/disciplines/actions.test.ts`             | Modify | MANAGER-Tests: create/update/archive ✓, delete ✗                                      |
| `src/lib/users/actions.test.ts`                   | Modify | MANAGER-Tests: createUser/updateUser/setUserActive ✗; MANAGER als Rolle im Formular ✓ |
| `src/lib/competitionParticipants/actions.test.ts` | Modify | MANAGER-Tests: alle Aktionen ✓                                                        |
| `src/lib/series/actions.test.ts`                  | Modify | MANAGER-Tests: alle Aktionen ✓                                                        |
| `.claude/docs/data-model.md`                      | Modify | `UserRole` Enum-Beschreibung aktualisieren (implementiert)                            |

---

## Task 1: Schema — MANAGER zum UserRole Enum hinzufügen

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Enum erweitern**

In `prisma/schema.prisma` Zeile 17–20, `MANAGER` zwischen `ADMIN` und `USER` einfügen:

```prisma
enum UserRole {
  ADMIN
  MANAGER
  USER
}
```

- [ ] **Step 2: Migration erstellen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx prisma migrate dev --name add_manager_role
```

Erwartete Ausgabe: `Your database is now in sync with your schema.`

- [ ] **Step 3: Commit**

```
feat(schema): add MANAGER to UserRole enum
```

---

## Task 2: Helper-Funktionen — canManage und isAdmin (TDD)

**Files:**

- Create: `src/lib/auth-helpers.test.ts`
- Modify: `src/lib/auth-helpers.ts`

- [ ] **Step 1: Testdatei anlegen (failing)**

Neue Datei `src/lib/auth-helpers.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { canManage, isAdmin } from "@/lib/auth-helpers"

describe("canManage", () => {
  it("gibt true für ADMIN zurück", () => {
    expect(canManage("ADMIN")).toBe(true)
  })

  it("gibt true für MANAGER zurück", () => {
    expect(canManage("MANAGER")).toBe(true)
  })

  it("gibt false für USER zurück", () => {
    expect(canManage("USER")).toBe(false)
  })

  it("gibt false für unbekannte Rolle zurück", () => {
    expect(canManage("")).toBe(false)
  })
})

describe("isAdmin", () => {
  it("gibt true für ADMIN zurück", () => {
    expect(isAdmin("ADMIN")).toBe(true)
  })

  it("gibt false für MANAGER zurück", () => {
    expect(isAdmin("MANAGER")).toBe(false)
  })

  it("gibt false für USER zurück", () => {
    expect(isAdmin("USER")).toBe(false)
  })

  it("gibt false für unbekannte Rolle zurück", () => {
    expect(isAdmin("")).toBe(false)
  })
})
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/auth-helpers.test.ts
```

Erwartet: FAIL — `canManage is not a function`

- [ ] **Step 3: Helper-Funktionen in auth-helpers.ts implementieren**

Am Ende von `src/lib/auth-helpers.ts` anhängen:

```typescript
export function canManage(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER"
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN"
}
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/auth-helpers.test.ts
```

Erwartet: 8 Tests grün

- [ ] **Step 5: Commit**

```
feat(auth): add canManage and isAdmin role helpers
```

---

## Task 3: Refactoring — alle Role-Checks auf Helper umstellen

**Hinweis:** Dieser Task berührt viele Dateien, gehört aber in einen einzigen isolierten Commit. Keine neuen Tests — bestehende Tests müssen weiterhin bestehen.

**Files:**

- Modify: `src/lib/competitions/actions/create.ts`
- Modify: `src/lib/competitions/actions/update.ts`
- Modify: `src/lib/competitions/actions/delete.ts`
- Modify: `src/lib/disciplines/actions.ts`
- Modify: `src/lib/participants/actions.ts`
- Modify: `src/lib/competitionParticipants/actions.ts`
- Modify: `src/lib/series/actions.ts`
- Modify: `src/lib/results/actions.ts`
- Modify: `src/lib/matchups/actions.ts`
- Modify: `src/lib/playoffs/actions/start.ts`
- Modify: `src/lib/playoffs/actions/match.ts`
- Modify: `src/lib/playoffs/actions/duel.ts`
- Modify: `src/lib/playoffs/actions/manualDuel.ts`

- [ ] **Step 1: Import in jede betroffene Datei hinzufügen**

Jede der folgenden Dateien importiert bereits `getAuthSession` aus `@/lib/auth-helpers`. Den Import in jeder Datei erweitern:

```typescript
import { getAuthSession, canManage, isAdmin } from "@/lib/auth-helpers"
```

Betroffene Dateien:

- `src/lib/competitions/actions/create.ts`
- `src/lib/competitions/actions/update.ts`
- `src/lib/competitions/actions/delete.ts`
- `src/lib/disciplines/actions.ts`
- `src/lib/participants/actions.ts`
- `src/lib/competitionParticipants/actions.ts`
- `src/lib/series/actions.ts`
- `src/lib/results/actions.ts`
- `src/lib/matchups/actions.ts`
- `src/lib/playoffs/actions/start.ts`
- `src/lib/playoffs/actions/match.ts`
- `src/lib/playoffs/actions/duel.ts`
- `src/lib/playoffs/actions/manualDuel.ts`

- [ ] **Step 2: Role-Checks umstellen — canManage-Aktionen**

In den folgenden Dateien jeden `session.user.role !== "ADMIN"` Check durch `!canManage(session.user.role)` ersetzen:

| Datei                                | Funktionen                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `competitions/actions/create.ts`     | `createCompetition`                                                                                        |
| `competitions/actions/update.ts`     | `updateCompetition`, `setCompetitionStatus`                                                                |
| `competitions/actions/delete.ts`     | `deleteCompetition` (nur diese — nicht `forceDeleteCompetition`)                                           |
| `disciplines/actions.ts`             | `createDiscipline`, `updateDiscipline`, `setDisciplineArchived` (nicht `deleteDiscipline`)                 |
| `participants/actions.ts`            | `createParticipant`, `updateParticipant`, `setParticipantActive`                                           |
| `competitionParticipants/actions.ts` | `enrollParticipant`, `unenrollParticipant`, `withdrawParticipant`, `revokeWithdrawal`, `updateStartNumber` |
| `series/actions.ts`                  | `saveEventSeries`, `deleteEventSeries`, `saveSeasonSeries`, `updateSeasonSeries`, `deleteSeasonSeries`     |
| `results/actions.ts`                 | `saveMatchResult`                                                                                          |
| `matchups/actions.ts`                | alle Checks                                                                                                |
| `playoffs/actions/start.ts`          | alle Checks                                                                                                |
| `playoffs/actions/match.ts`          | alle Checks                                                                                                |
| `playoffs/actions/duel.ts`           | alle Checks                                                                                                |
| `playoffs/actions/manualDuel.ts`     | alle Checks                                                                                                |

Vorher:

```typescript
if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }
```

Nachher:

```typescript
if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }
```

- [ ] **Step 3: Role-Checks umstellen — isAdmin-Aktionen**

In den folgenden Funktionen `session.user.role !== "ADMIN"` durch `!isAdmin(session.user.role)` ersetzen. Auch den Import in `users/actions.ts` erweitern: `import { getAuthSession, isAdmin } from "@/lib/auth-helpers"`.

| Datei                            | Funktionen                                  |
| -------------------------------- | ------------------------------------------- |
| `competitions/actions/delete.ts` | `forceDeleteCompetition`                    |
| `disciplines/actions.ts`         | `deleteDiscipline`                          |
| `users/actions.ts`               | `createUser`, `updateUser`, `setUserActive` |

**Nicht anfassen (bewusst ausgelassen):**

- `src/proxy.ts` — prüft `token.role === "ADMIN"` für `/admin/*`-Routen; bleibt unverändert
- `src/app/(app)/admin/layout.tsx` — prüft `role !== "ADMIN"`; bleibt unverändert
- `src/lib/admin/actions.ts` — kapselt den Check in `requireAdminSession()`; bleibt unverändert

Vorher:

```typescript
if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }
```

Nachher:

```typescript
if (!isAdmin(session.user.role)) return { error: "Keine Berechtigung" }
```

- [ ] **Step 4: Alle bestehenden Tests ausführen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run
```

Erwartet: alle Tests grün (keine Verhaltensänderung, nur Refactoring)

- [ ] **Step 5: Commit**

```
refactor(auth): use canManage/isAdmin helpers in all server actions
```

---

## Task 4: MANAGER-Berechtigungstests in Aktions-Testdateien

**Files:**

- Modify: `src/lib/competitions/actions.test.ts`
- Modify: `src/lib/disciplines/actions.test.ts`
- Modify: `src/lib/competitionParticipants/actions.test.ts`
- Modify: `src/lib/series/actions.test.ts`

- [ ] **Step 1: managerSession-Konstante in jede Testdatei hinzufügen**

In jeder der vier Testdateien direkt nach `const userSession = { ... }` einfügen:

```typescript
const managerSession = { user: { id: "u3", role: "MANAGER" } }
```

- [ ] **Step 2: MANAGER-Tests in competitions/actions.test.ts hinzufügen**

Im `describe("deleteCompetition")` Block nach dem bestehenden USER-Test:

```typescript
it("erlaubt MANAGER das Löschen (ohne Daten)", async () => {
  getAuthSessionMock.mockResolvedValue(managerSession)
  competitionFindUniqueMock.mockResolvedValue({ id: "c1" })
  competitionParticipantCountMock.mockResolvedValue(0)
  matchupCountMock.mockResolvedValue(0)
  playoffMatchCountMock.mockResolvedValue(0)
  competitionDeleteMock.mockResolvedValue({})
  const result = await deleteCompetition("c1")
  expect(result).toEqual({ success: true })
})
```

Im `describe("forceDeleteCompetition")` Block nach dem bestehenden USER-Test:

```typescript
it("verweigert MANAGER das endgültige Löschen", async () => {
  getAuthSessionMock.mockResolvedValue(managerSession)
  const result = await forceDeleteCompetition("c1", "Testbewerb")
  expect(result).toEqual({ error: "Keine Berechtigung" })
})
```

Im `describe("createCompetition")` Block nach dem bestehenden USER-Test:

```typescript
it("erlaubt MANAGER das Erstellen", async () => {
  getAuthSessionMock.mockResolvedValue(managerSession)
  disciplineFindUniqueMock.mockResolvedValue({ id: "d1", scoringType: "WHOLE" })
  competitionCreateMock.mockResolvedValue({ id: "new1" })
  auditLogCreateMock.mockResolvedValue({})
  const fd = makeFormData({
    name: "Testwettbewerb",
    type: "EVENT",
    scoringMode: "RINGS",
    shotsPerSeries: "10",
    disciplineId: "d1",
  })
  const result = await createCompetition(null, fd)
  expect(result).toEqual({ success: true })
})
```

- [ ] **Step 3: MANAGER-Tests in disciplines/actions.test.ts hinzufügen**

Im `describe("createDiscipline")` Block nach dem bestehenden USER-Test:

```typescript
it("erlaubt MANAGER das Erstellen", async () => {
  getAuthSessionMock.mockResolvedValue(managerSession)
  createMock.mockResolvedValue({ id: "d1" })
  auditLogCreateMock.mockResolvedValue({})
  const result = await createDiscipline(
    null,
    makeFormData({ name: "LP", scoringType: "WHOLE", teilerFaktor: "1.0" })
  )
  expect(result).toEqual({ success: true })
})
```

Im `describe("deleteDiscipline")` Block nach dem bestehenden USER-Test:

```typescript
it("verweigert MANAGER das Löschen", async () => {
  getAuthSessionMock.mockResolvedValue(managerSession)
  const result = await deleteDiscipline("d1")
  expect(result).toEqual({ error: "Keine Berechtigung" })
  expect(deleteMock).not.toHaveBeenCalled()
})
```

Im `describe("setDisciplineArchived")` Block nach dem bestehenden USER-Test:

```typescript
it("erlaubt MANAGER das Archivieren", async () => {
  getAuthSessionMock.mockResolvedValue(managerSession)
  findUniqueMock.mockResolvedValue({ id: "d1", name: "LP", isArchived: false })
  updateMock.mockResolvedValue({})
  auditLogCreateMock.mockResolvedValue({})
  const result = await setDisciplineArchived("d1", true)
  expect(result).toEqual({ success: true })
})
```

- [ ] **Step 4: MANAGER-Tests in competitionParticipants/actions.test.ts**

Für jede Funktion mit einem bestehenden USER-Fehlertest einen entsprechenden MANAGER-Erfolgstest hinzufügen. Muster (gleiche Session-Mock-Strategie wie für Admin, aber `managerSession`). Für `enrollParticipant`:

```typescript
it("erlaubt MANAGER das Einschreiben", async () => {
  getAuthSessionMock.mockResolvedValue(managerSession)
  // … gleiche Mocks wie im Admin-Erfolgstest dieser Funktion
})
```

- [ ] **Step 5: MANAGER-Tests in series/actions.test.ts**

Für `saveEventSeries` und `saveSeasonSeries` je einen MANAGER-Erfolgstest hinzufügen (analog Step 4 — gleiche Mocks wie im Admin-Erfolgstest, aber `managerSession`).

- [ ] **Step 6: Tests ausführen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/competitions/actions.test.ts src/lib/disciplines/actions.test.ts src/lib/competitionParticipants/actions.test.ts src/lib/series/actions.test.ts
```

Erwartet: alle Tests grün

- [ ] **Step 7: Commit**

```
test(auth): add MANAGER permission tests for actions
```

---

## Task 5: users/actions.ts — MANAGER als wählbare Rolle

**Files:**

- Modify: `src/lib/users/actions.ts`
- Modify: `src/lib/users/actions.test.ts`

- [ ] **Step 1: Zod-Schema in users/actions.ts erweitern**

In `src/lib/users/actions.ts` Zeile 30 (`CreateUserSchema`) und Zeile 39 (`UpdateUserSchema`):

Vorher:

```typescript
role: z.enum(["ADMIN", "USER"] as const, { message: "Ungültige Rolle" }),
```

Nachher (in beiden Schemas):

```typescript
role: z.enum(["ADMIN", "MANAGER", "USER"] as const, { message: "Ungültige Rolle" }),
```

- [ ] **Step 2: Test für MANAGER-Rolle im Formular hinzufügen**

In `src/lib/users/actions.test.ts` im `describe("createUser")` Block:

```typescript
it("erstellt einen MANAGER-Nutzer", async () => {
  getAuthSessionMock.mockResolvedValue(adminSession)
  userFindUniqueMock.mockResolvedValue(null)
  userCreateMock.mockResolvedValue({ id: "new1" })
  bcryptHashMock.mockResolvedValue("hashed")
  auditLogCreateMock.mockResolvedValue({})
  const result = await createUser(
    null,
    makeFormData({
      name: "Maria Manager",
      email: "manager@example.com",
      tempPassword: "sicheresPasswort1",
      role: "MANAGER",
    })
  )
  expect(result).toEqual({ success: true })
})
```

Im `describe("createUser")` Block auch sicherstellen dass MANAGER createUser nicht aufrufen kann:

```typescript
it("verweigert MANAGER das Anlegen von Nutzern", async () => {
  getAuthSessionMock.mockResolvedValue(managerSession)
  const result = await createUser(
    null,
    makeFormData({
      name: "X",
      email: "x@example.com",
      tempPassword: "sicheresPasswort1",
      role: "USER",
    })
  )
  expect(result).toEqual({ error: "Keine Berechtigung" })
})
```

Die `managerSession` Konstante am Anfang der Datei hinzufügen (nach `userSession`):

```typescript
const managerSession = { user: { id: "u3", role: "MANAGER" } }
```

- [ ] **Step 3: Tests ausführen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/users/actions.test.ts
```

Erwartet: alle Tests grün

- [ ] **Step 4: Commit**

```
feat(users): allow MANAGER role in user creation form
```

---

## Task 6: Navigation — canManage/isAdmin aufteilen

**Files:**

- Modify: `src/components/app/shell/Navigation.tsx`

- [ ] **Step 1: Zeile 45–46 in Navigation.tsx ersetzen**

Vorher:

```typescript
const isAdmin = role === "ADMIN"
const visibleNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems
```

Nachher:

```typescript
const canManage = role === "ADMIN" || role === "MANAGER"
const isAdmin = role === "ADMIN"
const visibleNavItems = canManage ? [...navItems, ...adminNavItems] : navItems
```

- [ ] **Step 2: /check ausführen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint && npm run format:check && npx vitest run && npx tsc --noEmit
```

Erwartet: alle Gates grün

- [ ] **Step 3: Commit**

```
feat(navigation): show participants and disciplines for MANAGER
```

---

## Task 7: Doku aktualisieren

**Files:**

- Modify: `.claude/docs/data-model.md`

- [ ] **Step 1: UserRole Enum-Eintrag in data-model.md prüfen und aktualisieren**

In `.claude/docs/data-model.md` im Abschnitt `## Enums → Bestehende Enums`:

Vorher:

```
- Role: ADMIN | MANAGER | USER
```

Nachher (falls noch ein Hinweis wie "geplant" vorhanden — sonst keine Änderung nötig):

```
- Role: ADMIN | MANAGER | USER
```

Den Benutzer-Abschnitt prüfen: `MANAGER: kann Wettbewerbe, Ergebnisse, Teilnehmer und Disziplinen verwalten; kein Zugriff auf Nutzerverwaltung (/admin/) und Force-Delete` — sicherstellen dass kein "(geplant)"-Hinweis vorhanden ist.

- [ ] **Step 2: Commit**

```
docs: mark MANAGER role as implemented in data-model
```
