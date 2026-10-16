# Plan: Spiegel — sechs kleine offene Punkte

> PIV-Handoff-Artefakt. Branch `feat/spiegel-kleinkram`, läuft im Worktree
> `.claude/worktrees/spiegel-open-small-tasks-6f576f` (ADR-024). Keine Schema-Änderung, keine Migration, kein
> Deploy-Vertrag, keine ADR berührt. Ein Commit je Task.

## Context (warum)

Unter „Offene Einzelpunkte“ in [`vault/spiegel/spiegel-roadmap.md`](../vault/spiegel/spiegel-roadmap.md) stehen sechs
Punkte, die keine Entscheidung des Users brauchen:

1. Ein Schütze auf `/admin` landet auf der Anmeldung statt auf dem Start.
2. Die Höhe der Sprungleiste (56 px) und der Seitenrand (16 px) stehen ohne gemeinsame Konstante in drei Hooks und als
   `top-14`/`scroll-mt-14` in neun Dateien.
3. Dieselbe Regel mehrfach: das Muster der Katalog-IDs, die häufigste Serienlänge, die Abstände zwischen Schüssen.
4. Die Tabellen der Ratenbegrenzung ragen bei 800 px aus der Karte.
5. `OLD_WORDS` prüft `heldBackText` und den Zustand einer Brücke (`STATUS_TEXT`) nicht.
6. Das Gedächtnis der Bereiche verwirft die gewählte Scheibe im Fortschritt, wenn die Adresse keine Familie trug.

Nicht im Umfang: eine Ansicht der Rate-Limit-Auswertung fürs Telefon, neue Wörter für Brücke und Einlesen (erst ins
Textbuch), alle Punkte, die eine Entscheidung brauchen.

## Approach

- **(1)** `proxy.ts` lässt jedes angemeldete Konto durch und leitet in einer Middleware-Funktion ein Konto ohne
  Admin-Rolle auf `/admin…` nach `/` um, wie `requireAdmin` es auf jeder Admin-Seite tut. Ein Prädikat `isAdminPath`
  dient Proxy und `AppShell`.
- **(2)** Ein Modul `packages/shot-ui/src/layout/bar.ts` mit `BAR_PX`, `EDGE_PX` und den Tailwind-Klassen, die an der
  Höhe der Leiste hängen, als ganze Literale (Tailwind findet nur ganze Klassen; `@source` der App schließt
  `packages/shot-ui/src` ein). Ein Test hält Klassen und Zahl gleich. Die Reihenfolge der Klassen im Markup bleibt, die
  Markup-Tests bleiben unverändert grün.
- **(3)** Jede Regel einmal im Fachkern: `CATALOG_ID` aus `metrics.ts`, `modalLength` in `stats.ts` (nicht in
  `analysis/`, sonst verlangt `catalog.test.ts` einen Katalogeintrag), `intervalsInOrder` in `metrics.ts`. Die Kopien in
  `timing.ts`, `result.ts`, `records.ts`, `shot-ui/shots.ts`, `SeriesChart.tsx` und den beiden Tests rufen sie.
- **(4)** Die Seite ist ein Grid (`Page`), die Abschnitte sind Grid-Elemente mit `min-width: auto`; die Tabelle mit
  `min-w-[860px]` zieht so die Spalte breit. Die beiden Abschnitte der Ratenbegrenzung in Spiegel bekommen
  `min-w-0 grid-cols-1` (`grid-cols-1` ist `minmax(0, 1fr)`), dann scrollt die Tabelle in ihrem `overflow-x-auto`.
  `@vereinsheim/ui` bleibt unverändert (Ringwerk und Treffsicher nutzen dieselbe Tabelle).
- **(5)** `STATUS_TEXT` zieht aus der Client-Komponente in ein reines Modul `src/lib/admin/bridge-status.ts`
  (`site.ts` importiert `db`, das darf nicht in den Client). Ein Test prüft alle Zustände und `heldBackText` gegen
  `OLD_WORDS`. Die heutigen Texte enthalten keine alten Wörter; der Test schützt künftige Änderungen.
- **(6)** `areaLinks` behält `chosen`, wenn die gemerkte Adresse keine Familie trug (die Familie hat dann der Server
  aufgelöst, der Client kennt sie nicht). Gehört die Scheibe doch zu einer anderen Familie, findet `periodReading` sie
  nicht und zeigt die Ablesung ohne Wahl (`packages/shot-ui/src/period/model.ts`, `picked` undefined); das ist
  harmlos.

## Required Docs

- [`vault/conventions.md`](../vault/conventions.md) §8 (Gates, Cache der Pakete), §9 (Mutation, Markup-Tests), §10
  (Design 2, Schreibregeln, `OLD_WORDS`)
- [`apps/spiegel/CLAUDE.md`](../apps/spiegel/CLAUDE.md), [`packages/shot-core/CLAUDE.md`](../packages/shot-core/CLAUDE.md),
  [`packages/shot-ui/CLAUDE.md`](../packages/shot-ui/CLAUDE.md)
- [`vault/spiegel/spiegel-navigation.md`](../vault/spiegel/spiegel-navigation.md) („Bereiche merken sich ihren Zustand“)
- Auto-Memory: Demo-Seed in einem Befehl zurückholen, Stop-Gate prüft den Haupt-Checkout (Gate im Worktree selbst
  laufen lassen), `.env`-Links im Worktree

## Tasks

### T1 — Nicht-Admin auf `/admin` geht zum Start

Dateien: `apps/spiegel/src/lib/admin-path.ts` (neu), `apps/spiegel/src/lib/admin-path.test.ts` (neu),
`apps/spiegel/src/proxy.ts`, `apps/spiegel/src/components/shell/AppShell.tsx`, `apps/spiegel/tools/pruefen.ts`.

1. `admin-path.ts`:
   ```ts
   /** gehört die Adresse zu Admin: `/admin` und alles darunter, nicht etwa `/administration` */
   export const isAdminPath = (pathname: string) =>
     pathname === "/admin" || pathname.startsWith("/admin/")
   ```
2. `admin-path.test.ts`: `/admin`, `/admin/users`, `/admin/site` → true; `/`, `/administration`, `/cards`,
   `/profile/admin` → false.
3. `proxy.ts`:
   ```ts
   import { NextResponse } from "next/server"
   import { withAuth } from "next-auth/middleware"

   import { isAdminPath } from "@/lib/admin-path"
   import { AUTH_SECRET } from "@/lib/auth-secret"

   export const proxy = withAuth(
     (req) => {
       // ein Konto ohne Admin-Rolle geht zum Start, wie `requireAdmin` auf jeder Admin-Seite
       if (isAdminPath(req.nextUrl.pathname) && req.nextauth.token?.role !== "ADMIN")
         return NextResponse.redirect(new URL("/", req.url))
     },
     {
       secret: AUTH_SECRET,
       pages: { signIn: "/login" },
       callbacks: { authorized: ({ token }) => Boolean(token) },
     }
   )
   ```
   Den Kopfkommentar anpassen: „/admin nur für Admins, sonst zum Start“. `config.matcher` bleibt.
4. `AppShell.tsx`: `pathname.startsWith("/admin/")` → `isAdminPath(pathname)`.
5. `pruefen.ts`: neuer Abschnitt nach „Papierkorb“:
   ```ts
   await section("Admin ohne Rolle", () => adminWithoutRole(page))
   ```
   mit
   ```ts
   /** das Demo-Konto ist kein Admin: `/admin` führt zum Start, nicht zur Anmeldung */
   async function adminWithoutRole(page: Page) {
     await page.viewport(1280, 900)
     await page.goto(`${BASE}/admin`)
     const path = await page.ev<string>("location.pathname")
     check("Admin ohne Rolle: Start statt Anmeldung", path === "/", path)
   }
   ```
   (`page.goto` ohne Warte-Ausdruck wie in `openAndBar`.)

Test: `pnpm --filter spiegel test -- admin-path`.

### T2 — Höhe der Leiste und Seitenrand an einer Stelle

Dateien: `packages/shot-ui/src/layout/bar.ts` (neu), `packages/shot-ui/src/layout/bar.test.ts` (neu),
`useTargetFit.ts`, `useActiveSection.ts`, `useReturnJump.ts`, `SectionNav.tsx`, `SectionBlock.tsx`, `CardPage.tsx`,
`PeriodPage.tsx` (alle `packages/shot-ui/src/layout/`), `packages/shot-ui/src/analysis/AnalysisPanel.tsx`,
`packages/shot-ui/src/analysis/tabs/OverviewTab.tsx`, `packages/shot-ui/src/list/EveningList.tsx`,
`packages/shot-ui/CLAUDE.md`.

1. `bar.ts`:
   ```ts
   /** Höhe der Sprungleiste oben und der Reiter der Analyse (`h-14`); Abschnitte und klebende Spalten beginnen darunter */
   export const BAR_PX = 56
   /** Luft zwischen Inhalt und Fensterrand */
   export const EDGE_PX = 16

   /**
    * Die Klassen, die an der Höhe der Leiste hängen. Tailwind findet nur ganze Klassen im Quelltext, deshalb stehen sie
    * hier als Literale; `bar.test.ts` hält sie bei `BAR_PX`.
    */
   export const BAR = {
     height: "h-14",
     top: "top-14",
     mdTop: "md:top-14",
     scrollMargin: "scroll-mt-14",
     /** zwei Leisten übereinander: Sprungleiste und Reiter der Analyse */
     mdScrollMarginTwo: "md:scroll-mt-28",
   } as const
   ```
2. `bar.test.ts`: aus jeder Klasse die Zahl am Ende lesen (`Number(cls.match(/(\d+)$/)![1]) * 4`); `height`, `top`,
   `mdTop`, `scrollMargin` ergeben `BAR_PX`, `mdScrollMarginTwo` ergibt `2 * BAR_PX`.
3. Hooks: `useTargetFit` — `NAV_PX`/`AIR_PX` entfallen, `BAR_PX`/`EDGE_PX` importieren (Kommentare an den Konstanten
   wandern sinngemäß in die Formel-Zeile); `useActiveSection` — `const LINE_PX = BAR_PX + 40` (Kommentar: „Leiste plus
   40 px Luft“); `useReturnJump(topInset = BAR_PX)`.
4. Klassen: jede Stelle aus `grep -rn "top-14\|scroll-mt-14\|scroll-mt-28\|h-14" packages/shot-ui/src` außer Tests
   und `AppFrame.tsx` (die untere Leiste, `--app-bar`, ist eine andere Höhe) ersetzt das Literal durch `BAR.*` über
   `cn(...)`, **an derselben Position** in der Klassenliste, z.B. in `CardPage.tsx`:
   `cn("grid min-w-0", BAR.scrollMargin, "content-start gap-7 md:sticky", BAR.mdTop, "md:self-start")`. `top-0` in
   `AnalysisPanel` bleibt. Die Markup-Tests (`CardPage.test.tsx`, `PeriodPage.test.tsx`, `mobile.test.tsx`) werden
   **nicht** angefasst und müssen grün bleiben.
5. `packages/shot-ui/CLAUDE.md`: in der Zeile mit `scroll-mt-14` (Abschnitt Layout) auf `BAR` in `layout/bar.ts`
   verweisen.

Test: `pnpm --filter @vereinsheim/shot-ui test`. Danach `grep -rn "top-14\|scroll-mt-14\|scroll-mt-28" packages/shot-ui/src`
zeigt nur `bar.ts` und Tests; `grep -rn "\b56\b" packages/shot-ui/src/layout` zeigt nur `bar.ts`.

### T3 — Jede Regel einmal im Fachkern

Dateien: `packages/shot-core/src/metrics.ts`, `packages/shot-core/src/metrics.test.ts`,
`packages/shot-core/src/stats.ts`, `packages/shot-core/src/stats.test.ts`,
`packages/shot-core/src/analysis/{timing,result,records}.ts`, `packages/shot-core/src/analysis/catalog.test.ts`,
`packages/shot-help/src/topics.test.ts`, `packages/shot-ui/src/shots.ts`,
`packages/shot-ui/src/analysis/charts/SeriesChart.tsx`, `packages/shot-core/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`.

1. Katalog-IDs: in `metrics.ts` `const CATALOG_ID` → `export const CATALOG_ID` mit Doku „Form einer Katalog-ID
   ([[spiegel-statistics]]): Buchstabe der Gruppe, dann die Nummer“. `catalog.test.ts` und `shot-help/topics.test.ts`
   importieren es aus `../metrics` bzw. `@vereinsheim/shot-core/metrics` (shot-help hat shot-core schon als
   devDependency) statt eigener Regex.
2. Häufigste Serienlänge: in `stats.ts`
   ```ts
   /** häufigster Wert, bei Gleichstand der größere; ohne Werte null (die Länge voller Serien einer Scheibe) */
   export function modalLength(lengths: readonly number[]): number | null {
     const counts = new Map<number, number>()
     for (const length of lengths) counts.set(length, (counts.get(length) ?? 0) + 1)
     const sorted = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])
     return sorted.length ? sorted[0][0] : null
   }
   ```
   `stats.test.ts`: `[]` → null; `[10,10,10,4]` → 10; `[5,5,10,10]` → 10 (Gleichstand: die längere); `[10,5,5]` → 5.
   `result.ts` (`seriesConsistency`): die drei Zeilen der Map → `const modal = modalLength(series.map((s) => s.shots))`
   als `as number` (series ist dort nicht leer, die Funktion kehrt vorher zurück). `records.ts`: die lokale Funktion entfällt, Import aus `../stats`. `SeriesChart.tsx`:
   die lokale Funktion entfällt, `modalLength(series.map((p) => p.shots)) as number` aus
   `@vereinsheim/shot-core/stats` (ab zwei Serien nie null).
3. Abstände: in `metrics.ts` hinter `timesInOrder`
   ```ts
   export interface ShotInterval {
     shot: MetricShot
     /** Abstand zum vorigen Schuss in ms; null beim ersten, nach einer Lücke, ohne Zeit und bei einem Rücksprung der Uhr */
     intervalMs: number | null
   }

   /** Abstand jedes Schusses zum vorigen, für Schüsse, die schon in Abgabefolge stehen (siehe `stepsInOrder`; SF-30) */
   export function intervalsInOrder(ordered: readonly MetricShot[], context?: ShotContext): ShotInterval[] {
     const steps = stepsInOrder(ordered, context)
     return steps.map((step, i) => {
       const now = step.shot.firedAtMs
       const then = steps[i - 1]?.shot.firedAtMs
       const gap =
         !step.gapBefore && Number.isFinite(now) && Number.isFinite(then)
           ? (now as number) - (then as number)
           : Number.NaN
       return { shot: step.shot, intervalMs: gap >= 0 ? gap : null }
     })
   }
   ```
   `timing.ts` `intervals()` → `intervalsInOrder(ordered, context).map((step) => ({ ...step, number:
   numbers.get(step.shot) as number }))`. `shot-ui/shots.ts` `shotIntervals` → `intervalsInOrder(inShotOrder(shots),
   context ? contextOf(shots, context) : undefined)`, daraus die `Map` je Schuss wie heute. `metrics.test.ts`: ein
   Test für `intervalsInOrder` mit Lücke in `seq`, fehlender Zeit und Rücksprung der Uhr (jeweils null), sonst die
   Differenz.
4. Gegenprobe (conventions §9): in `modalLength` testweise `b[0] - a[0]` → `a[0] - b[0]` und in `intervalsInOrder`
   `gap >= 0` → `true`; je ein Test muss rot werden. Dateien vorher mit `cp` sichern und daraus zurückholen (nicht
   `git checkout`).
5. `CLAUDE.md` von shot-core (Tabelle der Exporte: `CATALOG_ID`, `intervalsInOrder`, `modalLength`) und shot-ui
   (`shotIntervals` nutzt `intervalsInOrder`) nachziehen.

Test: `pnpm --filter @vereinsheim/shot-core test && pnpm --filter @vereinsheim/shot-help test && pnpm --filter @vereinsheim/shot-ui test`.

### T4 — Tabellen der Ratenbegrenzung bleiben in der Karte

Datei: `apps/spiegel/src/app/(app)/admin/users/page.tsx`.

Beide Abschnitte („Gesperrte Anmeldungen“, „Anmeldeversuche“):
`className="grid max-w-3xl gap-3 …"` → `className="grid min-w-0 max-w-3xl grid-cols-1 gap-3 …"`.

Kein Unit-Test (reines Layout); Prüfung im Browser unter Verification.

### T5 — Zustände der Brücke unter `OLD_WORDS`

Dateien: `apps/spiegel/src/lib/admin/bridge-status.ts` (neu), `apps/spiegel/src/lib/admin/site.test.ts`,
`apps/spiegel/src/components/admin/SiteForms.tsx`.

1. `bridge-status.ts`:
   ```ts
   import type { HeartbeatV1 } from "@vereinsheim/ingest-contract/api"

   /** Zustand einer Brücke aus ihrem letzten Heartbeat in Worten, für „Anlage und Brücke“ */
   export const BRIDGE_STATUS_TEXT: Record<NonNullable<HeartbeatV1["status"]>, string> = { …die sechs Einträge
   wörtlich aus SiteForms… }
   ```
2. `SiteForms.tsx`: lokale `STATUS_TEXT` entfällt, `BRIDGE_STATUS_TEXT[bridge.status]`.
3. `site.test.ts`: neuer `describe("Texte der Brücke ohne alte Wörter")`: jeder Wert von `BRIDGE_STATUS_TEXT` und
   `heldBackText` für `[{ displayMode: 0, cards: 2 }, { displayMode: 5, cards: 1 }]` matcht nicht `OLD_WORDS`
   (Import aus `./consequences`).
4. Gegenprobe: testweise einen Status-Text um „; Sperre“ ergänzen → Test rot; zurück.

Test: `pnpm --filter spiegel test -- site`.

### T6 — Gewählte Scheibe im Fortschritt bleibt ohne gemerkte Familie

Dateien: `packages/shot-ui/src/nav/areas.ts`, `packages/shot-ui/src/nav/areas.test.ts`,
`vault/spiegel/spiegel-navigation.md`.

1. `areaLinks`:
   `chosen: progressFamily === progress.family ? progress.chosen : null` →
   `chosen: progress.family === null || progressFamily === progress.family ? progress.chosen : null`.
   Doku der Funktion ergänzen: „Trug die gemerkte Adresse keine Familie, hat der Server sie aufgelöst; die Wahl bleibt.“
2. `areas.test.ts`, neuer Fall: Gedächtnis `progress: { page: "progress", query: { ...DEFAULT_PROGRESS, family: null,
   chosen: "c7" }, section: null }`, `areaLinks(memory, "lg-freihand").progress` → URL enthält `family=lg-freihand`
   und `pick=c7`. Der bestehende Fall (andere Familie gemerkt → Wahl fällt) bleibt grün.
3. Gegenprobe: die neue Bedingung `progress.family === null ||` entfernen → neuer Test rot.
4. `spiegel-navigation.md`, Abschnitt „Bereiche merken sich ihren Zustand“: ein Satz zur Regel aus 1.

Test: `pnpm --filter @vereinsheim/shot-ui test -- areas`.

### T7 — Roadmap nachziehen

Datei: `vault/spiegel/spiegel-roadmap.md`. Die sechs Punkte aus „Offene Einzelpunkte“ entfernen: „Ein Schütze auf
`/admin` …“, „Höhe der Leiste …“, „Dieselbe Regel mehrfach …“, beim Punkt „Admin-Tabellen der Ratenbegrenzung“ nur den
Überlauf (übrig bleibt: „Die Auswertung der Ratenbegrenzung hat keine Ansicht fürs Telefon“), beim Punkt „Alte Wörter
…“ nur den letzten Satz zu `OLD_WORDS`, „Gedächtnis der Bereiche …“. Danach `node .claude/vault-lint.mjs` grün.

## Verification

1. Gate im Worktree (das Stop-Gate prüft den Haupt-Checkout): `pnpm check` grün (lint, format:check, test, tsc,
   `next build` für Spiegel).
2. Skriptprüfung gegen den gebauten Stand dieses Worktrees (`--start`, :3012), Demo-Daten in **einem** Befehl
   zurückholen:
   `pnpm --filter spiegel seed:own --demo; pnpm --filter spiegel pruefen --start; pnpm --filter spiegel seed:own`. Erwartet:
   alle Abschnitte PASS, darunter „Admin ohne Rolle: Start statt Anmeldung“ und die Abschnitte zu Ankern, Kleben und
   Platz der Scheibe (decken T2 ab). Danach die Zahl der Scheiben von `admin@example.com` prüfen.
3. T4 im Browser (Dev-Server dieses Worktrees über `preview_start`, Admin-Konto, angemeldet vom User): zwei
   Testzeilen anlegen,
   `docker compose -f docker-compose.dev.yml exec -T db psql -U postgres -d spiegel -c "INSERT INTO \"LoginRateLimitBucket\" (key, attempts, \"windowStartedAt\", \"blockedUntil\", \"lastAttemptAt\", \"updatedAt\") VALUES ('email:probe-a@example.test', 9, now(), now() + interval '1 hour', now(), now()), ('ip:203.0.113.7', 12, now(), now() + interval '1 hour', now(), now())"`;
   `/admin/users` bei 800 × 900: für jeden Abschnitt `section.scrollWidth <= section.clientWidth` und
   `document.documentElement.scrollWidth <= innerWidth` (per `javascript_tool`), Screenshot. Danach
   `… -c "DELETE FROM \"LoginRateLimitBucket\" WHERE key IN ('email:probe-a@example.test', 'ip:203.0.113.7')"` und
   Zeilenzahl prüfen. Bei 1280 px dieselbe Prüfung (nichts verrutscht).
4. T6 im Browser: `/cards?family=<Familie A>` öffnen, dann `/progress?pick=<id einer Scheibe aus A>` ohne Familie,
   dann über die Navigation zu Scheiben und zurück zu Fortschritt: die Adresse trägt `pick=`. Gibt es nur eine Familie
   in den Dev-Daten, steht das im Bericht als „nicht belegt“, abgedeckt durch den Test aus T6.
5. T1 ohne Admin-Konto im Browser: abgedeckt durch die Skriptprüfung (Demo-Konto, Rolle USER). Abgemeldet führt
   `/admin` weiter zur Anmeldung: `curl -sI http://localhost:3002/admin | grep -i location` zeigt `/login`.
