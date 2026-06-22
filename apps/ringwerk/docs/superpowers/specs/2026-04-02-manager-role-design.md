# Design: MANAGER-Rolle

**Datum:** 2026-04-02
**Status:** Approved

---

## Kontext

Das Datenmodell dokumentiert drei Rollen: `ADMIN | MANAGER | USER`. Im Schema und Code existieren bisher nur `ADMIN` und `USER`. Die MANAGER-Rolle ermöglicht es, einen Nutzer anzulegen der Wettbewerbe, Ergebnisse, Teilnehmer und Disziplinen verwalten kann — ohne Zugriff auf die Nutzerverwaltung (`/admin/`) und destruktive Hard-Deletes.

---

## Berechtigungsmodell

| Aktion                                                               | USER | MANAGER | ADMIN |
| -------------------------------------------------------------------- | ---- | ------- | ----- |
| Lesen (alle Daten)                                                   | ✓    | ✓       | ✓     |
| Wettbewerbe erstellen/bearbeiten/archivieren                         | —    | ✓       | ✓     |
| Ergebnisse/Serien erfassen                                           | —    | ✓       | ✓     |
| Teilnehmer verwalten (erstellen, bearbeiten, einschreiben, abmelden) | —    | ✓       | ✓     |
| Disziplinen verwalten (erstellen, bearbeiten, archivieren)           | —    | ✓       | ✓     |
| Matchups / Playoffs verwalten                                        | —    | ✓       | ✓     |
| Hard-Deletes (`forceDeleteCompetition`, `deleteDiscipline`, etc.)    | —    | —       | ✓     |
| Nutzerverwaltung (`/admin/`)                                         | —    | —       | ✓     |
| MANAGER-Rolle vergeben                                               | —    | —       | ✓     |

**Gast-Auto-Delete:** Wenn ein Gast aus einem Event abgemeldet wird, löscht die App dessen Datensatz automatisch als Nebeneffekt. Das ist kein direkter Hard-Delete-Aufruf — MANAGER darf Gäste abmelden.

---

## Architektur

### 1. Datenschicht

- `UserRole` Enum in `prisma/schema.prisma` erhält `MANAGER` zwischen `ADMIN` und `USER`
- Neue Migration: `add_manager_role`
- `users/actions.ts`: Zod-Schema für Rollenwahl von `["ADMIN", "USER"]` auf `["ADMIN", "MANAGER", "USER"]` erweitert

### 2. Berechtigungslogik — Helper-Funktionen

Zwei neue Funktionen in `src/lib/auth-helpers.ts`:

```ts
export function canManage(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER"
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN"
}
```

Alle ~45 Role-Checks in Server Actions werden umgestellt:

- `!canManage(role)` → verwaltende Operationen (Wettbewerbe, Ergebnisse, Teilnehmer, Disziplinen, Matchups, Playoffs)
- `!isAdmin(role)` → Hard-Deletes, User-Actions, Admin-Actions

### 3. Navigation & Route-Guards

**`Navigation.tsx`:** Die lokale `isAdmin`-Variable wird aufgetrennt:

```ts
const canManage = role === "ADMIN" || role === "MANAGER"
const isAdmin = role === "ADMIN"
```

- Teilnehmer- und Disziplinen-Links: sichtbar für `canManage`
- Admin-Zahnrad: sichtbar nur für `isAdmin`

**Route-Guards bleiben auf ADMIN:**

- `proxy.ts` (Middleware): `/admin/*` nur für `token.role === "ADMIN"`
- `app/(app)/admin/layout.tsx`: `role !== "ADMIN"` → redirect

### 4. Tests

Bestehende Action-Tests werden um gezielte Berechtigungs-Fälle ergänzt:

- MANAGER darf verwaltende Aktionen ausführen (positiv)
- MANAGER wird bei Hard-Deletes / User-Actions mit `"Keine Berechtigung"` abgewiesen (negativ)

Kein Seed-Nutzer — MANAGER wird beim Testen manuell über die Nutzerverwaltung angelegt.

---

## Nicht im Scope

- Granularere Berechtigungen innerhalb der MANAGER-Rolle
- MANAGER kann keine anderen Nutzer anlegen oder Rollen vergeben
- Keine Änderungen an der Audit-Log-Logik

---

## Dateien mit Role-Checks (Umstellungsscope)

| Datei                                | Checks                                                                | Ziel-Helper      |
| ------------------------------------ | --------------------------------------------------------------------- | ---------------- |
| `competitions/actions/create.ts`     | 1                                                                     | `canManage`      |
| `competitions/actions/update.ts`     | 2                                                                     | `canManage`      |
| `competitions/actions/delete.ts`     | `deleteCompetition`: `canManage`, `forceDeleteCompetition`: `isAdmin` |
| `disciplines/actions.ts`             | create/update/archive: `canManage`, delete: `isAdmin`                 |
| `participants/actions.ts`            | create/update/enroll/withdraw: `canManage`                            |
| `competitionParticipants/actions.ts` | 5 Checks                                                              | `canManage`      |
| `series/actions.ts`                  | 5 Checks                                                              | `canManage`      |
| `results/actions.ts`                 | 1                                                                     | `canManage`      |
| `matchups/actions.ts`                | 1                                                                     | `canManage`      |
| `playoffs/actions/start.ts`          | 1                                                                     | `canManage`      |
| `playoffs/actions/match.ts`          | 1                                                                     | `canManage`      |
| `playoffs/actions/duel.ts`           | 2                                                                     | `canManage`      |
| `playoffs/actions/manualDuel.ts`     | 1                                                                     | `canManage`      |
| `users/actions.ts`                   | 3                                                                     | `isAdmin`        |
| `admin/actions.ts`                   | via `requireAdminSession()`                                           | bleibt `isAdmin` |
