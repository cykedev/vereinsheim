# Small Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zwei parallel ausführbare Agents beheben alle kleinen Findings aus dem Code-Review-Plan (R-01, R-02, R-08, R-11, R-12, R-13, R-14).

**Architecture:** Agent 1 erstellt neue Dateien (Error Boundaries + Loading States). Agent 2 führt Code-Fixes und Audits durch. Beide arbeiten an disjunkten Dateien — kein Merge-Konflikt möglich. Am Ende läuft `/check` in jedem Agent separat.

**Tech Stack:** Next.js App Router (error.tsx / loading.tsx Konventionen), shadcn/ui pattern, Tailwind CSS, Prisma

## Required Docs

Beyond the baseline, no additional docs required for this plan.

---

## AGENT 1 — Neue Dateien (R-01 + R-08)

### Task 1: Skeleton-Komponente hinzufügen

**Files:**

- Create: `src/components/ui/skeleton.tsx`

Wird von den Loading-States in Task 3 benötigt. Folgt dem Pattern der anderen UI-Komponenten (z.B. `card.tsx`).

- [ ] **Schritt 1: Datei anlegen**

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
}

export { Skeleton }
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: kein Fehler

---

### Task 2: Error Boundaries (R-01)

**Files:**

- Create: `src/app/error.tsx`
- Create: `src/app/(app)/error.tsx`
- Create: `src/app/(public)/error.tsx`

Alle drei Dateien sind `"use client"` (Next.js Anforderung für error.tsx). Die Props sind vom Next.js Framework vorgegeben. Fehlertext auf Deutsch.

- [ ] **Schritt 1: Globale Error Boundary anlegen**

`src/app/error.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Globaler Fehler:", msg)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
      <p className="text-sm text-muted-foreground">Ein unerwarteter Fehler ist aufgetreten.</p>
      <Button onClick={reset} variant="outline">
        Seite neu laden
      </Button>
    </div>
  )
}
```

- [ ] **Schritt 2: Error Boundary für den eingeloggten Bereich anlegen**

`src/app/(app)/error.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AppError({ error, reset }: Props) {
  useEffect(() => {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler im App-Bereich:", msg)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
      <p className="text-sm text-muted-foreground">Ein unerwarteter Fehler ist aufgetreten.</p>
      <Button onClick={reset} variant="outline">
        Seite neu laden
      </Button>
    </div>
  )
}
```

- [ ] **Schritt 3: Error Boundary für den Login-Bereich anlegen**

`src/app/(public)/error.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function PublicError({ error, reset }: Props) {
  useEffect(() => {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler im Login-Bereich:", msg)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
      <p className="text-sm text-muted-foreground">Ein unerwarteter Fehler ist aufgetreten.</p>
      <Button onClick={reset} variant="outline">
        Seite neu laden
      </Button>
    </div>
  )
}
```

- [ ] **Schritt 4: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: kein Fehler

---

### Task 3: Loading States (R-08)

**Files:**

- Create: `src/app/(app)/competitions/[id]/standings/loading.tsx`
- Create: `src/app/(app)/competitions/[id]/playoffs/loading.tsx`
- Create: `src/app/(app)/competitions/[id]/ranking/loading.tsx`

Nutzt die in Task 1 erstellte `Skeleton`-Komponente. Jede `loading.tsx` zeigt ein Skeleton-Layout passend zur Seite (Tabelle für standings/ranking, Bracket-Placeholder für playoffs). Loading States werden von Next.js automatisch während des Server-Side-Renderings angezeigt — kein `"use client"` nötig.

- [ ] **Schritt 1: Loading für Standings anlegen** (Saison-Tabelle)

`src/app/(app)/competitions/[id]/standings/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function StandingsLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Schritt 2: Loading für Playoffs anlegen** (Bracket-Ansicht)

`src/app/(app)/competitions/[id]/playoffs/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function PlayoffsLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-8">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="flex flex-col gap-6">
            {Array.from({ length: 4 }).map((_, row) => (
              <Skeleton key={row} className="h-20 w-44" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Schritt 3: Loading für Ranking anlegen** (Event-Rangliste)

`src/app/(app)/competitions/[id]/ranking/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function RankingLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Schritt 4: `/check` ausführen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint && \
docker compose -f docker-compose.dev.yml run --rm app npm run format:check && \
docker compose -f docker-compose.dev.yml run --rm app npm run test && \
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: alle Checks grün

---

## AGENT 2 — Code-Fixes & Audits (R-02, R-11, R-12, R-13, R-14)

### Task 4: console.error — Error-Message extrahieren (R-02)

**Files:**

- Modify: `src/lib/competitions/actions.ts:445`
- Modify: `src/lib/playoffs/actions.ts:96`
- Modify: `src/lib/playoffs/actions.ts:348`
- Modify: `src/lib/playoffs/actions.ts:768`
- Modify: `src/lib/results/actions.ts:160`

An jeder Stelle das rohe `error`-Objekt durch eine extrahierte Message ersetzen, damit keine internen Stacktraces / DB-Details in Prod-Logs landen.

- [ ] **Schritt 1: `competitions/actions.ts:445` fixen**

Suche nach:

```ts
console.error("Fehler beim endgültigen Löschen des Wettbewerbs:", error)
```

Ersetzen mit:

```ts
const msg = error instanceof Error ? error.message : String(error)
console.error("Fehler beim endgültigen Löschen des Wettbewerbs:", msg)
```

- [ ] **Schritt 2: `playoffs/actions.ts:96` fixen**

Suche nach:

```ts
console.error("Fehler beim Starten der Playoffs:", error)
```

Ersetzen mit:

```ts
const msg = error instanceof Error ? error.message : String(error)
console.error("Fehler beim Starten der Playoffs:", msg)
```

- [ ] **Schritt 3: `playoffs/actions.ts:348` fixen**

Suche nach:

```ts
console.error("Fehler beim Speichern des Playoff-Ergebnisses:", error)
```

Ersetzen mit:

```ts
const msg = error instanceof Error ? error.message : String(error)
console.error("Fehler beim Speichern des Playoff-Ergebnisses:", msg)
```

- [ ] **Schritt 4: `playoffs/actions.ts:768` fixen**

Suche nach:

```ts
console.error("Fehler beim Anlegen des Duells:", error)
```

Ersetzen mit:

```ts
const msg = error instanceof Error ? error.message : String(error)
console.error("Fehler beim Anlegen des Duells:", msg)
```

- [ ] **Schritt 5: `results/actions.ts:160` fixen**

Suche nach:

```ts
console.error("Fehler beim Speichern des Ergebnisses:", error)
```

Ersetzen mit:

```ts
const msg = error instanceof Error ? error.message : String(error)
console.error("Fehler beim Speichern des Ergebnisses:", msg)
```

---

### Task 5: Deprecated Type entfernen (R-11)

**Files:**

- Modify: `src/lib/results/types.ts`

`MatchResultSummary` in `src/lib/results/types.ts` ist als deprecated markiert und als Alias auf `SeriesSummary` definiert. Es gibt einen gleichnamigen Typ in `src/lib/matchups/types.ts` — der ist ein unabhängiges Interface und wird aktiv verwendet (kein Berührungspunkt).

- [ ] **Schritt 1: Prüfen ob der Typ aus `results/types.ts` irgendwo importiert wird**

```bash
grep -r "from.*results/types" src/ --include="*.ts" --include="*.tsx" | grep -v "results/types.ts"
```

Dann prüfen ob einer der importierenden Orte `MatchResultSummary` nutzt:

```bash
grep -r "MatchResultSummary" src/ --include="*.ts" --include="*.tsx"
```

Erwartet: Alle Treffer zeigen auf `src/lib/matchups/types.ts` und dessen Consumer (ResultEntryDialog, ScheduleView) — kein Import aus `results/types.ts`.

- [ ] **Schritt 2: Deprecated Type aus `src/lib/results/types.ts` löschen**

Datei lesen, dann die Zeile entfernen:

```ts
/** @deprecated Bitte SeriesSummary verwenden */
export type MatchResultSummary = SeriesSummary
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: kein Fehler

---

### Task 6: isGuestRecord Filter Audit (R-12)

**Files:** Keine Änderung erwartet — dies ist eine Verifikations-Aufgabe.

Die Sorge: `participant.findMany`-Queries ohne `isGuestRecord: false` würden Ghost-Datensätze in der Teilnehmerliste anzeigen.

- [ ] **Schritt 1: Alle `participant.findMany`-Queries auflisten**

```bash
grep -rn "db\.participant\.findMany" src/ --include="*.ts"
```

Erwartet — alle 4 Treffer in `src/lib/participants/queries.ts` — alle haben bereits `isGuestRecord: false` in der `where`-Klausel.

- [ ] **Schritt 2: Prüfen ob `competitionParticipant.findMany` Queries participant-Daten exponieren ohne Filter**

```bash
grep -rn "competitionParticipant\.findMany" src/ --include="*.ts"
```

Für jede Query prüfen: wird `participant: { select: ... }` gejoined? Falls ja: ist das der Kontext einer Admin-Liste (wo Gäste ausgeblendet werden sollen) oder einer wettkampf-spezifischen Ansicht (wo Gäste erwünscht sind)?

Hinweis: In wettkampf-spezifischen Views (standings, participants, ranking) sollen Gäste erscheinen — dort ist kein Filter nötig.

- [ ] **Schritt 3: Ergebnis dokumentieren**

Falls alle Queries korrekt sind: keine Änderungen, Ergebnis kurz im Chat festhalten.

Falls eine Query den Filter fehlt: `where`-Klausel entsprechend ergänzen und `/check` ausführen.

---

### Task 7: dangerouslySetInnerHTML Kommentar (R-13)

**Files:**

- Modify: `src/components/ui/chart.tsx`

- [ ] **Schritt 1: Kommentar über `dangerouslySetInnerHTML` ergänzen**

In `src/components/ui/chart.tsx` Zeile ~77, direkt vor dem `<style`-Element:

```tsx
  return (
    <style
      dangerouslySetInnerHTML={{
        // CSS-Variablen pro Chart-ID isolieren, damit mehrere Charts mit unterschiedlichen Paletten koexistieren.
```

Der Kommentar ist bereits vorhanden (steht im `__html`-Wert). Stattdessen einen Sicherheits-Kommentar _oberhalb_ von `<style` ergänzen:

Suche nach:

```tsx
  return (
    <style
      dangerouslySetInnerHTML={{
```

Ersetzen mit:

```tsx
  return (
    // dangerouslySetInnerHTML ist hier sicher: der String wird ausschliesslich aus
    // statischen Chart-Konfigurationswerten (CSS-Variablen-Namen und Farbwerten) zusammengesetzt.
    // Kein User-Input fliesst in diesen String ein.
    <style
      dangerouslySetInnerHTML={{
```

---

### Task 8: CSRF Dokumentation (R-14)

**Files:**

- Modify: `src/lib/auth.ts`

- [ ] **Schritt 1: CSRF-Schutz-Kommentar in `auth.ts` ergänzen**

Am Anfang von `src/lib/auth.ts`, nach den Imports, vor der ersten Konstante, diesen Kommentar ergänzen:

Suche nach:

```ts
const TRUST_PROXY_HEADERS_FOR_RATE_LIMIT = process.env.AUTH_TRUST_PROXY_HEADERS === "true"
```

Ersetzen mit:

```ts
// CSRF-Schutz: Next.js Server Actions sind durch den Same-Origin-Check des Browsers geschuetzt.
// NextAuth prueft zusaetzlich den Origin-Header bei POST-Requests. Ein manueller CSRF-Token
// ist deshalb nicht noetig — der Schutz ist im Framework implizit vorhanden.
const TRUST_PROXY_HEADERS_FOR_RATE_LIMIT = process.env.AUTH_TRUST_PROXY_HEADERS === "true"
```

- [ ] **Schritt 2: `/check` ausführen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint && \
docker compose -f docker-compose.dev.yml run --rm app npm run format:check && \
docker compose -f docker-compose.dev.yml run --rm app npm run test && \
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: alle Checks grün
