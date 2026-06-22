# Audit Log Gaps (R-03) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Stammdaten-Mutations (User, Participant, Discipline, Competition) schreiben einen Audit-Log-Eintrag — damit entsteht ein lückenloses globales Protokoll.

**Architecture:** 15 neue Event-Typen in `auditLog/types.ts`, neue Kategorie `"admin"`, Badge-Farbe in `AuditLogList`, dann `auditLog.create`-Calls in 4 Actions-Dateien. Keine Schema-Migration nötig — das AuditLog-Modell bleibt unverändert.

**Tech Stack:** Next.js Server Actions, Prisma, TypeScript

## Required Docs

Beyond the baseline, no additional docs required for this plan.

> **Hinweis zu Tests:** Für diese Actions existieren noch keine Tests (R-04). Da das gesamte Test-Setup für Actions noch aussteht, wird R-03 ohne neue Tests implementiert. R-04 deckt die Action-Tests ab.

---

## Dateiübersicht

**Modify:**

- `src/lib/auditLog/types.ts` — 15 neue Event-Typen, Kategorie, Labels, Formatierung
- `src/components/app/auditLog/AuditLogList.tsx` — Badge-Farbe für `"admin"`
- `src/lib/users/actions.ts` — 4 neue `auditLog.create`-Calls
- `src/lib/participants/actions.ts` — 4 neue `auditLog.create`-Calls
- `src/lib/disciplines/actions.ts` — 4 neue `auditLog.create`-Calls
- `src/lib/competitions/actions.ts` — 3 neue `auditLog.create`-Calls

---

## Task 1: `auditLog/types.ts` — 15 neue Event-Typen

**Files:**

- Modify: `src/lib/auditLog/types.ts`

- [ ] **Schritt 1: `AuditEventType` um 15 Werte erweitern**

Aktuelle Union-Zeilen 1–15 ersetzen:

```ts
export type AuditEventType =
  | "PARTICIPANT_WITHDRAWN"
  | "WITHDRAWAL_REVOKED"
  | "RESULT_ENTERED"
  | "RESULT_CORRECTED"
  | "PLAYOFF_RESULT_ENTERED"
  | "PLAYOFF_RESULT_CORRECTED"
  | "PLAYOFF_DUEL_DELETED"
  | "PLAYOFFS_STARTED"
  | "EVENT_SERIES_ENTERED"
  | "EVENT_SERIES_CORRECTED"
  | "EVENT_SERIES_DELETED"
  | "SEASON_SERIES_ENTERED"
  | "SEASON_SERIES_CORRECTED"
  | "SEASON_SERIES_DELETED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "PARTICIPANT_CREATED"
  | "PARTICIPANT_UPDATED"
  | "PARTICIPANT_DEACTIVATED"
  | "PARTICIPANT_REACTIVATED"
  | "DISCIPLINE_CREATED"
  | "DISCIPLINE_UPDATED"
  | "DISCIPLINE_ARCHIVED"
  | "DISCIPLINE_DELETED"
  | "COMPETITION_CREATED"
  | "COMPETITION_UPDATED"
  | "COMPETITION_STATUS_CHANGED"
```

- [ ] **Schritt 2: `AUDIT_EVENT_LABELS` um 15 Einträge erweitern**

Am Ende von `AUDIT_EVENT_LABELS` (nach `SEASON_SERIES_DELETED: "Saison-Serie gelöscht"`) hinzufügen:

```ts
  USER_CREATED: "Nutzer angelegt",
  USER_UPDATED: "Nutzer bearbeitet",
  USER_DEACTIVATED: "Nutzer deaktiviert",
  USER_REACTIVATED: "Nutzer reaktiviert",
  PARTICIPANT_CREATED: "Teilnehmer angelegt",
  PARTICIPANT_UPDATED: "Teilnehmer bearbeitet",
  PARTICIPANT_DEACTIVATED: "Teilnehmer deaktiviert",
  PARTICIPANT_REACTIVATED: "Teilnehmer reaktiviert",
  DISCIPLINE_CREATED: "Disziplin angelegt",
  DISCIPLINE_UPDATED: "Disziplin bearbeitet",
  DISCIPLINE_ARCHIVED: "Disziplin archiviert",
  DISCIPLINE_DELETED: "Disziplin gelöscht",
  COMPETITION_CREATED: "Wettbewerb angelegt",
  COMPETITION_UPDATED: "Wettbewerb bearbeitet",
  COMPETITION_STATUS_CHANGED: "Wettbewerb-Status geändert",
```

- [ ] **Schritt 3: `AuditEventCategory` um `"admin"` erweitern**

```ts
export type AuditEventCategory = "participant" | "result" | "playoff" | "destructive" | "admin"
```

- [ ] **Schritt 4: `AUDIT_EVENT_CATEGORY` um 15 Einträge erweitern**

Am Ende des Objekts (nach `SEASON_SERIES_DELETED: "destructive"`) hinzufügen:

```ts
  USER_CREATED: "admin",
  USER_UPDATED: "admin",
  USER_DEACTIVATED: "admin",
  USER_REACTIVATED: "admin",
  PARTICIPANT_CREATED: "admin",
  PARTICIPANT_UPDATED: "admin",
  PARTICIPANT_DEACTIVATED: "admin",
  PARTICIPANT_REACTIVATED: "admin",
  DISCIPLINE_CREATED: "admin",
  DISCIPLINE_UPDATED: "admin",
  DISCIPLINE_ARCHIVED: "admin",
  DISCIPLINE_DELETED: "admin",
  COMPETITION_CREATED: "admin",
  COMPETITION_UPDATED: "admin",
  COMPETITION_STATUS_CHANGED: "admin",
```

- [ ] **Schritt 5: `getAuditDescription` um neue Cases erweitern**

Im `switch (eventType)`-Block nach dem `default`-Case (vor der schließenden `}`) einfügen:

```ts
    case "USER_CREATED":
    case "USER_UPDATED":
    case "USER_DEACTIVATED":
    case "USER_REACTIVATED":
      return d.fullName ? s(d.fullName) : (d.email ? s(d.email) : null)

    case "PARTICIPANT_CREATED":
    case "PARTICIPANT_UPDATED":
    case "PARTICIPANT_DEACTIVATED":
    case "PARTICIPANT_REACTIVATED":
      return d.firstName && d.lastName ? `${s(d.firstName)} ${s(d.lastName)}` : null

    case "DISCIPLINE_CREATED":
    case "DISCIPLINE_UPDATED":
    case "DISCIPLINE_ARCHIVED":
    case "DISCIPLINE_DELETED":
      return d.name ? s(d.name) : null

    case "COMPETITION_CREATED":
    case "COMPETITION_UPDATED":
      return d.name ? s(d.name) : null

    case "COMPETITION_STATUS_CHANGED":
      return d.name ? `${s(d.name)}: ${s(d.from)} → ${s(d.to)}` : null
```

- [ ] **Schritt 6: `formatAuditDetails` um neue Cases erweitern**

Im `switch (eventType)`-Block nach dem letzten `case "SEASON_SERIES_DELETED":...break` (vor der schließenden `}`) einfügen:

```ts
    case "USER_CREATED":
    case "USER_UPDATED":
      if (d.fullName) rows.push({ label: "Name", value: str(d.fullName) })
      rows.push({ label: "E-Mail", value: str(d.email) })
      rows.push({ label: "Rolle", value: str(d.role) })
      break

    case "USER_DEACTIVATED":
    case "USER_REACTIVATED":
      if (d.fullName) rows.push({ label: "Name", value: str(d.fullName) })
      rows.push({ label: "E-Mail", value: str(d.email) })
      break

    case "PARTICIPANT_CREATED":
    case "PARTICIPANT_UPDATED":
    case "PARTICIPANT_DEACTIVATED":
    case "PARTICIPANT_REACTIVATED":
      rows.push({ label: "Vorname", value: str(d.firstName) })
      rows.push({ label: "Nachname", value: str(d.lastName) })
      break

    case "DISCIPLINE_CREATED":
    case "DISCIPLINE_UPDATED":
      rows.push({ label: "Name", value: str(d.name) })
      rows.push({ label: "Wertungsart", value: str(d.scoringType) })
      if (d.teilerFaktor != null) rows.push({ label: "Teiler-Faktor", value: str(d.teilerFaktor) })
      break

    case "DISCIPLINE_ARCHIVED":
    case "DISCIPLINE_DELETED":
      rows.push({ label: "Name", value: str(d.name) })
      break

    case "COMPETITION_CREATED":
    case "COMPETITION_UPDATED":
      rows.push({ label: "Name", value: str(d.name) })
      rows.push({ label: "Typ", value: str(d.type) })
      rows.push({ label: "Wertungsmodus", value: str(d.scoringMode) })
      break

    case "COMPETITION_STATUS_CHANGED":
      rows.push({ label: "Wettbewerb", value: str(d.name) })
      rows.push({ label: "Von", value: str(d.from) })
      rows.push({ label: "Nach", value: str(d.to) })
      break
```

- [ ] **Schritt 7: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: kein Fehler

---

## Task 2: `AuditLogList.tsx` — Badge-Farbe für `"admin"`

**Files:**

- Modify: `src/components/app/auditLog/AuditLogList.tsx`

- [ ] **Schritt 1: `"admin"` zur `CATEGORY_BADGE_CLASS`-Map hinzufügen**

Suche nach:

```ts
const CATEGORY_BADGE_CLASS: Record<AuditEventCategory, string> = {
  participant: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  result: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  playoff: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  destructive: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}
```

Ersetzen mit:

```ts
const CATEGORY_BADGE_CLASS: Record<AuditEventCategory, string> = {
  participant: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  result: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  playoff: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  destructive: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  admin: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: kein Fehler

- [ ] **Schritt 3: Commit**

```
feat(audit): add 15 new admin event types with badge and formatting
```

---

## Task 3: `users/actions.ts` — Audit Log für User-Mutations

**Files:**

- Modify: `src/lib/users/actions.ts`

- [ ] **Schritt 1: Import hinzufügen**

Direkt nach dem Import-Block (nach `import type { ActionResult } from "@/lib/types"`) einfügen:

```ts
import type { AuditEventType } from "@/lib/auditLog/types"
```

Hinweis: `AuditEventType` wird als Typ-Assertion genutzt um Tippfehler im Event-Namen zu verhindern.

- [ ] **Schritt 2: `createUser` — Ergebnis erfassen und Log schreiben**

Suche nach:

```ts
const passwordHash = await bcrypt.hash(parsed.data.tempPassword, BCRYPT_COST)
await db.user.create({
  data: { name: parsed.data.name, email, passwordHash, role: parsed.data.role },
})

revalidateUserPaths()
return { success: true }
```

Ersetzen mit:

```ts
const passwordHash = await bcrypt.hash(parsed.data.tempPassword, BCRYPT_COST)
const newUser = await db.user.create({
  data: { name: parsed.data.name, email, passwordHash, role: parsed.data.role },
  select: { id: true },
})

await db.auditLog.create({
  data: {
    eventType: "USER_CREATED" satisfies AuditEventType,
    entityType: "USER",
    entityId: newUser.id,
    userId: session.user.id,
    details: {
      fullName: parsed.data.name ?? null,
      email,
      role: parsed.data.role,
    },
  },
})

revalidateUserPaths()
return { success: true }
```

- [ ] **Schritt 3: `updateUser` — Log nach dem Update schreiben**

Suche nach:

```ts
await db.user.update({ where: { id }, data: updateData })
revalidateUserPaths()
return { success: true }
```

Ersetzen mit:

```ts
await db.user.update({ where: { id }, data: updateData })

await db.auditLog.create({
  data: {
    eventType: "USER_UPDATED" satisfies AuditEventType,
    entityType: "USER",
    entityId: id,
    userId: session.user.id,
    details: {
      fullName: parsed.data.name ?? null,
      email,
      role: parsed.data.role,
    },
  },
})

revalidateUserPaths()
return { success: true }
```

- [ ] **Schritt 4: `setUserActive` — Name und E-Mail in den Select aufnehmen**

Suche nach:

```ts
const user = await db.user.findUnique({
  where: { id },
  select: { id: true, role: true, isActive: true },
})
```

Ersetzen mit:

```ts
const user = await db.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true, role: true, isActive: true },
})
```

- [ ] **Schritt 5: `setUserActive` — Log nach dem Update schreiben**

Suche nach:

```ts
await db.user.update({ where: { id }, data: { isActive } })
revalidateUserPaths()
return { success: true }
```

Ersetzen mit:

```ts
await db.user.update({ where: { id }, data: { isActive } })

const eventType: AuditEventType = isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED"
await db.auditLog.create({
  data: {
    eventType,
    entityType: "USER",
    entityId: id,
    userId: session.user.id,
    details: {
      fullName: user.name ?? null,
      email: user.email,
    },
  },
})

revalidateUserPaths()
return { success: true }
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: kein Fehler

- [ ] **Schritt 7: Commit**

```
feat(audit): log user mutations (created, updated, deactivated, reactivated)
```

---

## Task 4: `participants/actions.ts` — Audit Log für Participant-Mutations

**Files:**

- Modify: `src/lib/participants/actions.ts`

- [ ] **Schritt 1: Import hinzufügen**

Nach `import type { ActionResult } from "@/lib/types"` einfügen:

```ts
import type { AuditEventType } from "@/lib/auditLog/types"
```

- [ ] **Schritt 2: `createParticipant` — Ergebnis erfassen und Log schreiben**

Suche nach:

```ts
await db.participant.create({
  data: {
    firstName: parsed.data.firstName.trim(),
    lastName: parsed.data.lastName.trim(),
    contact,
    createdByUserId: session.user.id,
  },
})

revalidateParticipantPaths()
return { success: true }
```

Ersetzen mit:

```ts
const newParticipant = await db.participant.create({
  data: {
    firstName: parsed.data.firstName.trim(),
    lastName: parsed.data.lastName.trim(),
    contact,
    createdByUserId: session.user.id,
  },
  select: { id: true },
})

await db.auditLog.create({
  data: {
    eventType: "PARTICIPANT_CREATED" satisfies AuditEventType,
    entityType: "PARTICIPANT",
    entityId: newParticipant.id,
    userId: session.user.id,
    details: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
    },
  },
})

revalidateParticipantPaths()
return { success: true }
```

- [ ] **Schritt 3: `updateParticipant` — Log nach dem Update schreiben**

Suche nach:

```ts
await db.participant.update({
  where: { id },
  data: {
    firstName: parsed.data.firstName.trim(),
    lastName: parsed.data.lastName.trim(),
    contact,
  },
})

revalidateParticipantPaths()
return { success: true }
```

Ersetzen mit:

```ts
await db.participant.update({
  where: { id },
  data: {
    firstName: parsed.data.firstName.trim(),
    lastName: parsed.data.lastName.trim(),
    contact,
  },
})

await db.auditLog.create({
  data: {
    eventType: "PARTICIPANT_UPDATED" satisfies AuditEventType,
    entityType: "PARTICIPANT",
    entityId: id,
    userId: session.user.id,
    details: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
    },
  },
})

revalidateParticipantPaths()
return { success: true }
```

- [ ] **Schritt 4: `setParticipantActive` — Select um Name erweitern**

Suche nach:

```ts
const participant = await db.participant.findUnique({
  where: { id },
  select: { id: true, isActive: true },
})
```

Ersetzen mit:

```ts
const participant = await db.participant.findUnique({
  where: { id },
  select: { id: true, firstName: true, lastName: true, isActive: true },
})
```

- [ ] **Schritt 5: `setParticipantActive` — Log nach dem Update schreiben**

Suche nach:

```ts
await db.participant.update({ where: { id }, data: { isActive } })
revalidateParticipantPaths()
return { success: true }
```

Ersetzen mit:

```ts
await db.participant.update({ where: { id }, data: { isActive } })

const eventType: AuditEventType = isActive ? "PARTICIPANT_REACTIVATED" : "PARTICIPANT_DEACTIVATED"
await db.auditLog.create({
  data: {
    eventType,
    entityType: "PARTICIPANT",
    entityId: id,
    userId: session.user.id,
    details: {
      firstName: participant.firstName,
      lastName: participant.lastName,
    },
  },
})

revalidateParticipantPaths()
return { success: true }
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: kein Fehler

- [ ] **Schritt 7: Commit**

```
feat(audit): log participant mutations (created, updated, deactivated, reactivated)
```

---

## Task 5: `disciplines/actions.ts` — Audit Log für Discipline-Mutations

**Files:**

- Modify: `src/lib/disciplines/actions.ts`

- [ ] **Schritt 1: Import hinzufügen**

Nach `import type { ActionResult } from "@/lib/types"` einfügen:

```ts
import type { AuditEventType } from "@/lib/auditLog/types"
```

- [ ] **Schritt 2: `createDiscipline` — Ergebnis erfassen und Log schreiben**

Suche nach:

```ts
await db.discipline.create({ data: parsed.data })
revalidateDisciplinePaths()
return { success: true }
```

Ersetzen mit:

```ts
const newDiscipline = await db.discipline.create({
  data: parsed.data,
  select: { id: true },
})

await db.auditLog.create({
  data: {
    eventType: "DISCIPLINE_CREATED" satisfies AuditEventType,
    entityType: "DISCIPLINE",
    entityId: newDiscipline.id,
    userId: session.user.id,
    details: {
      name: parsed.data.name,
      scoringType: parsed.data.scoringType,
      teilerFaktor: parsed.data.teilerFaktor,
    },
  },
})

revalidateDisciplinePaths()
return { success: true }
```

- [ ] **Schritt 3: `updateDiscipline` — Log nach dem Update schreiben**

Suche nach:

```ts
await db.discipline.update({ where: { id }, data: parsed.data })
revalidateDisciplinePaths()
return { success: true }
```

Ersetzen mit:

```ts
await db.discipline.update({ where: { id }, data: parsed.data })

await db.auditLog.create({
  data: {
    eventType: "DISCIPLINE_UPDATED" satisfies AuditEventType,
    entityType: "DISCIPLINE",
    entityId: id,
    userId: session.user.id,
    details: {
      name: parsed.data.name,
      scoringType: parsed.data.scoringType,
      teilerFaktor: parsed.data.teilerFaktor,
    },
  },
})

revalidateDisciplinePaths()
return { success: true }
```

- [ ] **Schritt 4: `setDisciplineArchived` — Select um Name erweitern**

Suche nach:

```ts
const discipline = await db.discipline.findUnique({
  where: { id },
  select: { id: true, isArchived: true },
})
```

Ersetzen mit:

```ts
const discipline = await db.discipline.findUnique({
  where: { id },
  select: { id: true, name: true, isArchived: true },
})
```

- [ ] **Schritt 5: `setDisciplineArchived` — Log nach dem Update schreiben**

Suche nach:

```ts
await db.discipline.update({ where: { id }, data: { isArchived: archive } })
revalidateDisciplinePaths()
return { success: true }
```

Ersetzen mit:

```ts
await db.discipline.update({ where: { id }, data: { isArchived: archive } })

await db.auditLog.create({
  data: {
    eventType: "DISCIPLINE_ARCHIVED" satisfies AuditEventType,
    entityType: "DISCIPLINE",
    entityId: id,
    userId: session.user.id,
    details: { name: discipline.name },
  },
})

revalidateDisciplinePaths()
return { success: true }
```

- [ ] **Schritt 6: `deleteDiscipline` — Select um Name erweitern**

Suche nach:

```ts
const discipline = await db.discipline.findUnique({
  where: { id },
  select: { id: true },
})
```

Ersetzen mit:

```ts
const discipline = await db.discipline.findUnique({
  where: { id },
  select: { id: true, name: true },
})
```

- [ ] **Schritt 7: `deleteDiscipline` — Log vor dem Löschen schreiben**

Suche nach:

```ts
await db.discipline.delete({ where: { id } })
revalidateDisciplinePaths()
return { success: true }
```

Ersetzen mit:

```ts
await db.auditLog.create({
  data: {
    eventType: "DISCIPLINE_DELETED" satisfies AuditEventType,
    entityType: "DISCIPLINE",
    entityId: id,
    userId: session.user.id,
    details: { name: discipline.name },
  },
})

await db.discipline.delete({ where: { id } })
revalidateDisciplinePaths()
return { success: true }
```

Hinweis: Der Log-Eintrag wird **vor** dem Löschen geschrieben, damit `entityId` noch referenzierbar ist und kein FK-Problem entsteht (AuditLog hat kein FK auf Discipline).

- [ ] **Schritt 8: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: kein Fehler

- [ ] **Schritt 9: Commit**

```
feat(audit): log discipline mutations (created, updated, archived, deleted)
```

---

## Task 6: `competitions/actions.ts` — Audit Log für Competition-Mutations

**Files:**

- Modify: `src/lib/competitions/actions.ts`

- [ ] **Schritt 1: Import hinzufügen**

Nach `import type { CompetitionStatus } from "@/generated/prisma/client"` einfügen:

```ts
import type { AuditEventType } from "@/lib/auditLog/types"
```

- [ ] **Schritt 2: `createCompetition` — Log nach dem Create schreiben**

Suche nach:

```ts
  revalidateCompetitionPaths()
  return { success: true, data: { id: competition.id } }
}

// ─────────────────────────────────────────────────────────────
// UPDATE
```

Ersetzen mit:

```ts
  await db.auditLog.create({
    data: {
      eventType: "COMPETITION_CREATED" satisfies AuditEventType,
      entityType: "COMPETITION",
      entityId: competition.id,
      userId: session.user.id,
      competitionId: competition.id,
      details: {
        name,
        type,
        scoringMode,
      },
    },
  })

  revalidateCompetitionPaths()
  return { success: true, data: { id: competition.id } }
}

// ─────────────────────────────────────────────────────────────
// UPDATE
```

- [ ] **Schritt 3: `updateCompetition` — Log nach dem Update schreiben**

Suche nach:

```ts
  revalidateCompetitionPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// STATUS
```

Ersetzen mit:

```ts
  await db.auditLog.create({
    data: {
      eventType: "COMPETITION_UPDATED" satisfies AuditEventType,
      entityType: "COMPETITION",
      entityId: id,
      userId: session.user.id,
      competitionId: id,
      details: {
        name: parsed.data.name,
        type: competition.type,
        scoringMode: parsed.data.scoringMode,
      },
    },
  })

  revalidateCompetitionPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// STATUS
```

- [ ] **Schritt 4: `setCompetitionStatus` — Select um `name` erweitern**

Suche nach:

```ts
const competition = await db.competition.findUnique({
  where: { id },
  select: { id: true, status: true },
})
```

Ersetzen mit:

```ts
const competition = await db.competition.findUnique({
  where: { id },
  select: { id: true, name: true, status: true },
})
```

- [ ] **Schritt 5: `setCompetitionStatus` — Log nach dem Update schreiben**

Suche nach:

```ts
  await db.competition.update({ where: { id }, data: { status } })
  revalidateCompetitionPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DELETE
```

Ersetzen mit:

```ts
  await db.competition.update({ where: { id }, data: { status } })

  await db.auditLog.create({
    data: {
      eventType: "COMPETITION_STATUS_CHANGED" satisfies AuditEventType,
      entityType: "COMPETITION",
      entityId: id,
      userId: session.user.id,
      competitionId: id,
      details: {
        name: competition.name,
        from: competition.status,
        to: status,
      },
    },
  })

  revalidateCompetitionPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DELETE
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: kein Fehler

- [ ] **Schritt 7: Commit**

```
feat(audit): log competition mutations (created, updated, status changed)
```

---

## Task 7: Abschluss — `/check` ausführen

**Files:** keine Änderungen

- [ ] **Schritt 1: Vollständigen Quality-Check ausführen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint && \
docker compose -f docker-compose.dev.yml run --rm app npm run format:check && \
docker compose -f docker-compose.dev.yml run --rm app npm run test && \
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: alle Checks grün

- [ ] **Schritt 2: `/commit-msg` ausführen**

Commit-Message für den gesamten Diff generieren.
