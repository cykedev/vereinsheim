# Design: Small Fixes (Review-Plan R-01, R-02, R-08, R-11, R-12, R-13, R-14)

Erstellt: 2026-03-27
Basis: review-plan.md

---

## Scope

Alle kleinen Fixes aus dem Code-Review-Plan — aufgeteilt in zwei parallel arbeitende Agents.

---

## Agent 1 — Neue Dateien (R-01 + R-08)

### R-01 · Error Boundaries

Drei neue Dateien anlegen — alle `"use client"`:

| Datei                        | Zweck                  |
| ---------------------------- | ---------------------- |
| `src/app/error.tsx`          | Globale Fallback-Seite |
| `src/app/(app)/error.tsx`    | Eingeloggter Bereich   |
| `src/app/(public)/error.tsx` | Login-Bereich          |

Props: `error: Error & { digest?: string }` und `reset: () => void`
Inhalt: Deutschsprachige Fehlermeldung + Button "Seite neu laden" (`onClick={reset}`)
Styling: Zentriert, konsistent mit dem Rest der App (shadcn-Komponenten)

### R-08 · Loading States

Drei neue `loading.tsx`-Dateien für die schwersten Routen:

| Datei                                                   |
| ------------------------------------------------------- |
| `src/app/(app)/competitions/[id]/standings/loading.tsx` |
| `src/app/(app)/competitions/[id]/playoffs/loading.tsx`  |
| `src/app/(app)/competitions/[id]/ranking/loading.tsx`   |

Inhalt: `<Skeleton>`-Layout aus shadcn/ui, passend zur Struktur der jeweiligen Seite (Tabelle, Bracket, Rangliste).

---

## Agent 2 — Code-Fixes & Audits (R-02, R-11, R-12, R-13, R-14)

### R-02 · console.error(error) — Message extrahieren

In fünf bekannten Stellen das rohe `error`-Objekt durch die extrahierte Message ersetzen:

```ts
// Vorher
console.error("Fehler beim Starten der Playoffs:", error)

// Nachher
const msg = error instanceof Error ? error.message : String(error)
console.error("Fehler beim Starten der Playoffs:", msg)
```

Betroffene Dateien:

- `src/lib/competitions/actions.ts:454`
- `src/lib/playoffs/actions.ts:96, 348, 768`
- `src/lib/results/actions.ts:160`

### R-11 · Deprecated Type `MatchResultSummary` entfernen

Per `grep MatchResultSummary src/` prüfen ob der Type noch irgendwo referenziert wird.
Falls keine Treffer außer der Definition: Type aus `src/lib/results/types.ts` löschen.

### R-12 · isGuestRecord Filter Audit

Per grep alle `findMany`-Queries auf Participants finden:

```
grep -r "participant" src/lib --include="*.ts" | grep "findMany"
```

Jede Query prüfen ob `where: { isGuestRecord: false }` gesetzt ist.
Fehlende Filter ergänzen wo nötig.

### R-13 · dangerouslySetInnerHTML Kommentar

In `src/components/ui/chart.tsx` einen Kommentar direkt über dem `dangerouslySetInnerHTML`-Aufruf ergänzen, der erklärt warum es hier sicher ist (statische CSS-Variable-Strings, kein User-Input).

### R-14 · CSRF Dokumentation

In `src/lib/auth.ts` oder `src/lib/auth.config.ts` einen Kommentar ergänzen, der erklärt:

- NextAuth bietet impliziten CSRF-Schutz über Origin-Header-Validierung
- Server Actions sind durch das gleiche Mechanismus geschützt
- Kein manueller CSRF-Token nötig

---

## Ausgeschlossen (zu groß)

- R-03: Audit Log Lücken
- R-04: Fehlende Tests
- R-05: playoffs/actions.ts aufteilen
- R-06: competitions/actions.ts aufteilen
- R-09: ScoringMode Labels zentralisieren
- R-10: `use client` Audit
