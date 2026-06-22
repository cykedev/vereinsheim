# Public Competition PDFs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the main result PDF of selected competitions via a stable URL (`/api/public/c/<slug>/pdf`), optionally protected by a shared HTTP Basic Auth password, so the club's public website can link to "current standings" without per-year link updates.

**Architecture:** Add `isPublic` + `publicSlug` + `publicPasswordHash` (bcrypt) to `Competition` (partial unique index ensures only one ACTIVE+isPublic competition holds a given slug). A new public route reads the slug, runs an optional Basic Auth check on every request, then serves a PDF whose expensive render step is cached for 24h via `unstable_cache` keyed by `(competitionId, phaseTag)`. Server actions invalidate the cache via `revalidateTag` on status / slug / publish changes.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + PostgreSQL (partial unique index via raw SQL), `@react-pdf/renderer`, Zod v4, vitest, shadcn/ui.

**Spec:** [.claude/docs/superpowers/specs/2026-05-26-public-competition-pdfs-design.md](../specs/2026-05-26-public-competition-pdfs-design.md)

## Required Docs

Subagents implementing this plan must read the baseline docs from CLAUDE.md, plus:

- `.claude/docs/code-conventions.md` — Zod, useActionState, layer order
- `.claude/docs/reference-files.md` — existing PDF route pattern, server-action pattern
- `.claude/docs/ui-patterns.md` — for the UI tasks

---

## File Structure

**New files:**

- `src/lib/competitions/publicSlug.ts` — pure helpers: `slugify`, `resolveSlug`, `findActiveSlugConflict`
- `src/lib/competitions/publicSlug.test.ts` — unit tests for the helpers
- `src/app/api/public/c/[slug]/pdf/route.ts` — public PDF route handler

**Modified files:**

- `prisma/schema.prisma` — add `isPublic`, `publicSlug`, `publicPasswordHash` to `Competition`
- `prisma/migrations/<timestamp>_competition_public_slug/migration.sql` — add fields + partial unique index (after `prisma migrate dev`, hand-edit SQL)
- `src/lib/competitions/types.ts` — add fields to `CompetitionListItem` + `CompetitionDetail`
- `src/lib/competitions/queries.ts` — include the fields in selects
- `src/lib/competitions/actions/_shared.ts` — extend `BaseSchema`, add `revalidatePublicSlug(slug)` helper
- `src/lib/competitions/actions/create.ts` — conflict check on create with `isPublic = true`
- `src/lib/competitions/actions/update.ts` — slug edit + conflict check + cache invalidation
- `src/lib/competitions/actions.test.ts` — new action tests
- `src/components/app/competitions/CompetitionForm.tsx` — publish switch + slug input + URL preview
- `src/app/(app)/competitions/page.tsx` — "Öffentlich" badge on the cards
- `.claude/docs/features.md` — document the feature
- `.claude/docs/architecture.md` — add the new route + library file

---

## Task 1: Schema + migration

**Files:**

- Modify: `prisma/schema.prisma` (around line 187, inside `model Competition`)
- Create: `prisma/migrations/<timestamp>_competition_public_slug/migration.sql`

- [ ] **Step 1: Add fields to `Competition` model**

In `prisma/schema.prisma`, find the line `status CompetitionStatus @default(ACTIVE)` inside `model Competition` and add the three new fields immediately after it:

```prisma
  status CompetitionStatus @default(ACTIVE)

  // Veröffentlichung: macht eine PDF-Variante unter /api/public/c/<slug>/pdf erreichbar.
  // Nur eine ACTIVE-Wettbewerb pro Slug zulässig (partial unique index, siehe Migration).
  isPublic           Boolean @default(false)
  publicSlug         String?
  // bcrypt hash, null = kein Passwortschutz. Plaintext wird nie gespeichert.
  publicPasswordHash String?
```

(The `@@index([status])` further down stays unchanged.)

- [ ] **Step 2: Generate migration**

Run the project command:

```bash
/migrate competition_public_slug
```

This produces a file like `prisma/migrations/<timestamp>_competition_public_slug/migration.sql` with `ALTER TABLE "Competition" ADD COLUMN …` statements.

- [ ] **Step 3: Append partial unique index to the generated migration**

Open the generated `migration.sql` and append at the end:

```sql
-- Aktive Slug-Reservierung: nur ein ACTIVE+isPublic Wettbewerb pro publicSlug.
CREATE UNIQUE INDEX "Competition_publicSlug_active_unique"
  ON "Competition" ("publicSlug")
  WHERE "isPublic" = true AND "status" = 'ACTIVE';
```

Re-run `/migrate competition_public_slug` if it complains; otherwise the partial index is applied next `prisma migrate dev`. If the migration already ran without the index, drop the DB (`/db-reset`) and re-run, or write a follow-up migration. The cleanest path is to add the SQL **before** `/migrate` finishes — re-run the migrate command after editing.

- [ ] **Step 4: Verify schema**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx prisma migrate status
```

Expected: "Database schema is up to date" with the new migration listed.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add Competition.isPublic, publicSlug, publicPasswordHash with partial unique index"
```

---

## Task 2: Slug helpers (TDD)

**Files:**

- Create: `src/lib/competitions/publicSlug.ts`
- Create: `src/lib/competitions/publicSlug.test.ts`

- [ ] **Step 1: Write failing tests for `slugify`**

Create `src/lib/competitions/publicSlug.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { slugify, SLUG_REGEX } from "./publicSlug"

describe("slugify", () => {
  it("lowercases and dash-joins basic names", () => {
    expect(slugify("Jahrespreisschiessen 2026")).toBe("jahrespreisschiessen-2026")
  })

  it("transliterates German umlauts", () => {
    expect(slugify("Schützenmeister-Pokal")).toBe("schuetzenmeister-pokal")
    expect(slugify("Großer Preis ÄÖÜß")).toBe("grosser-preis-aeoeuess")
  })

  it("strips punctuation and collapses dashes", () => {
    expect(slugify("Kranzl 2026 — Runde #1!!")).toBe("kranzl-2026-runde-1")
  })

  it("trims leading and trailing dashes", () => {
    expect(slugify("---Liga---")).toBe("liga")
  })

  it("returns empty string for input that produces nothing valid", () => {
    expect(slugify("***")).toBe("")
    expect(slugify("")).toBe("")
  })
})

describe("SLUG_REGEX", () => {
  it("accepts valid slugs", () => {
    expect(SLUG_REGEX.test("liga")).toBe(true)
    expect(SLUG_REGEX.test("jahrespreisschiessen-2026")).toBe(true)
    expect(SLUG_REGEX.test("abc")).toBe(true)
  })

  it("rejects too short, dashes at edges, uppercase, non-ascii", () => {
    expect(SLUG_REGEX.test("ab")).toBe(false)
    expect(SLUG_REGEX.test("-liga")).toBe(false)
    expect(SLUG_REGEX.test("liga-")).toBe(false)
    expect(SLUG_REGEX.test("Liga")).toBe(false)
    expect(SLUG_REGEX.test("liga--2026")).toBe(false)
    expect(SLUG_REGEX.test("löwen")).toBe(false)
  })

  it("accepts up to 60 chars and rejects 61+", () => {
    expect(SLUG_REGEX.test("a".repeat(60))).toBe(true)
    expect(SLUG_REGEX.test("a".repeat(61))).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm test -- src/lib/competitions/publicSlug.test.ts
```

Expected: FAIL — `publicSlug.ts` does not exist.

- [ ] **Step 3: Implement `slugify` + `SLUG_REGEX`**

Create `src/lib/competitions/publicSlug.ts`:

```ts
import { db } from "@/lib/db"

/** Valid public slug: lowercase alphanumeric + single dashes, 3–60 chars, no leading/trailing dash, no double-dash. */
export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

const UMLAUT_MAP: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  Ä: "ae",
  Ö: "oe",
  Ü: "ue",
}

/**
 * Convert a competition name into a URL-safe slug.
 * - Lowercase
 * - German umlauts transliterated (ä→ae, ö→oe, ü→ue, ß→ss)
 * - Everything except [a-z0-9] becomes a dash
 * - Collapse multiple dashes, trim from both ends
 * Returns empty string if nothing valid remains. Length is NOT clamped — callers must check SLUG_REGEX
 * (which enforces 3–60 chars when used with .test()) before storing.
 */
export function slugify(name: string): string {
  const transliterated = name.replace(/[äöüßÄÖÜ]/g, (c) => UMLAUT_MAP[c] ?? c)
  const lowered = transliterated.toLowerCase()
  const dashed = lowered.replace(/[^a-z0-9]+/g, "-")
  return dashed.replace(/^-+|-+$/g, "")
}
```

Update `SLUG_REGEX` to enforce length:

```ts
export const SLUG_REGEX = /^(?=.{3,60}$)[a-z0-9]+(-[a-z0-9]+)*$/
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm test -- src/lib/competitions/publicSlug.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add failing tests for `resolveSlug`**

Append to `publicSlug.test.ts`:

```ts
import { resolveSlug, findActiveSlugConflict } from "./publicSlug"
import { db } from "@/lib/db"

// These tests assume a working dev DB. They use db.competition directly.
describe("resolveSlug", () => {
  beforeEach(async () => {
    await db.competition.deleteMany({ where: { publicSlug: "test-slug" } })
  })

  it("returns null when no competition matches", async () => {
    expect(await resolveSlug("test-slug")).toBeNull()
  })

  it("returns ACTIVE+isPublic competition when present", async () => {
    const active = await createTestCompetition({
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "test-slug",
    })
    const result = await resolveSlug("test-slug")
    expect(result?.id).toBe(active.id)
  })

  it("ignores isPublic=false rows", async () => {
    await createTestCompetition({ status: "ACTIVE", isPublic: false, publicSlug: "test-slug" })
    expect(await resolveSlug("test-slug")).toBeNull()
  })

  it("falls back to most recent COMPLETED/ARCHIVED when no ACTIVE claim exists", async () => {
    const older = await createTestCompetition({
      status: "ARCHIVED",
      isPublic: true,
      publicSlug: "test-slug",
      createdAt: new Date("2024-01-01"),
    })
    const newer = await createTestCompetition({
      status: "COMPLETED",
      isPublic: true,
      publicSlug: "test-slug",
      createdAt: new Date("2025-01-01"),
    })
    const result = await resolveSlug("test-slug")
    expect(result?.id).toBe(newer.id)
  })

  it("prefers ACTIVE claim over ARCHIVED predecessors", async () => {
    await createTestCompetition({ status: "ARCHIVED", isPublic: true, publicSlug: "test-slug" })
    const active = await createTestCompetition({
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "test-slug",
    })
    const result = await resolveSlug("test-slug")
    expect(result?.id).toBe(active.id)
  })
})

describe("findActiveSlugConflict", () => {
  it("returns null when no other ACTIVE+isPublic competition holds the slug", async () => {
    expect(await findActiveSlugConflict("no-such-slug", "other-id")).toBeNull()
  })

  it("returns the conflicting competition's name + id", async () => {
    const existing = await createTestCompetition({
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "test-slug",
      name: "Test Competition",
    })
    const result = await findActiveSlugConflict("test-slug", "different-id")
    expect(result).toEqual({ id: existing.id, name: "Test Competition" })
  })

  it("does not flag the same competition as its own conflict", async () => {
    const c = await createTestCompetition({
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "test-slug",
    })
    expect(await findActiveSlugConflict("test-slug", c.id)).toBeNull()
  })
})

// Helper — adjust required fields to match your Competition schema (name, type, scoringMode, etc.)
async function createTestCompetition(
  overrides: Partial<{
    status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED"
    isPublic: boolean
    publicSlug: string | null
    name: string
    createdAt: Date
  }>
) {
  // Find or create a test user to satisfy createdByUserId
  const user =
    (await db.user.findFirst()) ??
    (await db.user.create({
      data: { email: `test-${Date.now()}@example.com`, name: "Test", role: "ADMIN" },
    }))
  return db.competition.create({
    data: {
      name: overrides.name ?? "Test",
      type: "EVENT",
      scoringMode: "RINGS",
      shotsPerSeries: 10,
      status: overrides.status ?? "ACTIVE",
      isPublic: overrides.isPublic ?? false,
      publicSlug: overrides.publicSlug ?? null,
      createdAt: overrides.createdAt,
      createdByUserId: user.id,
    },
  })
}
```

- [ ] **Step 6: Run tests, verify they fail**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm test -- src/lib/competitions/publicSlug.test.ts
```

Expected: FAIL — `resolveSlug` and `findActiveSlugConflict` not defined.

- [ ] **Step 7: Implement `resolveSlug` + `findActiveSlugConflict`**

Append to `src/lib/competitions/publicSlug.ts`:

```ts
import type { Competition } from "@/generated/prisma/client"

/**
 * Resolve a public slug to a Competition.
 * 1. Prefer the ACTIVE+isPublic claimant if any.
 * 2. Otherwise fall back to the most recently created (createdAt DESC) COMPLETED/ARCHIVED+isPublic holder.
 * 3. Return null if no isPublic competition has this slug.
 */
export async function resolveSlug(slug: string): Promise<Competition | null> {
  const active = await db.competition.findFirst({
    where: { publicSlug: slug, isPublic: true, status: "ACTIVE" },
  })
  if (active) return active

  return db.competition.findFirst({
    where: {
      publicSlug: slug,
      isPublic: true,
      status: { in: ["COMPLETED", "ARCHIVED"] },
    },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Check whether another ACTIVE+isPublic competition already holds this slug.
 * `excludeId` is the competition currently being edited (excluded from the check).
 * Returns { id, name } of the conflicting competition, or null if none.
 */
export async function findActiveSlugConflict(
  slug: string,
  excludeId: string | null
): Promise<{ id: string; name: string } | null> {
  const conflict = await db.competition.findFirst({
    where: {
      publicSlug: slug,
      isPublic: true,
      status: "ACTIVE",
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  })
  return conflict
}
```

- [ ] **Step 8: Run tests, verify they pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm test -- src/lib/competitions/publicSlug.test.ts
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/competitions/publicSlug.ts src/lib/competitions/publicSlug.test.ts
git commit -m "feat(competitions): add publicSlug helpers (slugify, resolveSlug, findActiveSlugConflict)"
```

---

## Task 3: Extend types + queries

**Files:**

- Modify: `src/lib/competitions/types.ts`
- Modify: `src/lib/competitions/queries.ts`

- [ ] **Step 1: Add fields to `CompetitionListItem` and `CompetitionDetail`**

Open `src/lib/competitions/types.ts`. Add the following fields to **both** `CompetitionListItem` and `CompetitionDetail` types — place them after the `status` field in each:

```ts
isPublic: boolean
publicSlug: string | null
hasPublicPassword: boolean // derived: true if publicPasswordHash is set; hash itself is never exposed to client
```

The hash itself is never typed into client-bound objects — only the boolean.

- [ ] **Step 2: Update queries to include the new fields**

Open `src/lib/competitions/queries.ts`. Find every `select: { … }` or `competition.findMany`/`findUnique` call that produces a `CompetitionListItem` or `CompetitionDetail`. Add the three new selects:

```ts
      isPublic: true,
      publicSlug: true,
      publicPasswordHash: true,
```

Then, in the mapping that produces the typed return value (look for `return { …, name, status, … }`), transform the hash into the boolean:

```ts
      hasPublicPassword: row.publicPasswordHash != null,
```

…and **do not** include `publicPasswordHash` in the returned object. Only the boolean leaves `queries.ts`.

Use `grep -n "select\b" src/lib/competitions/queries.ts` to find every place that needs adjusting.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/competitions/types.ts src/lib/competitions/queries.ts
git commit -m "feat(competitions): expose isPublic and publicSlug in types and queries"
```

---

## Task 4: Extend `_shared.ts` (schema + revalidation helper)

**Files:**

- Modify: `src/lib/competitions/actions/_shared.ts`

- [ ] **Step 1: Add `isPublic`, `publicSlug`, `publicPassword`, `removePublicPassword` to `BaseSchema`**

Open `src/lib/competitions/actions/_shared.ts`. Inside `BaseSchema` (right after `disciplineId`), add:

```ts
    isPublic: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    publicSlug: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
    // Plaintext password — never persisted as-is. Empty string / null = "leave existing hash alone"
    publicPassword: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
    // "Passwort entfernen" checkbox — if true, clear the hash regardless of publicPassword
    removePublicPassword: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
```

Then in the existing `.superRefine` block, add the slug-format and password-length checks:

```ts
if (data.isPublic) {
  if (!data.publicSlug) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Slug ist erforderlich, wenn 'Auf Vereins-Website veröffentlichen' aktiv ist",
      path: ["publicSlug"],
    })
  } else if (!SLUG_REGEX.test(data.publicSlug)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Slug: 3–60 Zeichen, nur a–z, 0–9 und Bindestriche, keine doppelten Bindestriche",
      path: ["publicSlug"],
    })
  }
}
if (data.publicPassword !== null && data.publicPassword.length < 4) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Passwort muss mindestens 4 Zeichen haben",
    path: ["publicPassword"],
  })
}
```

Add the import at the top:

```ts
import { SLUG_REGEX } from "../publicSlug"
```

- [ ] **Step 2: Add `revalidatePublicSlug` helper (tag-based)**

In the same file, replace the existing `revalidatePath` import line with both helpers, and add the helper below `revalidateCompetitionPaths`:

```ts
import { revalidatePath, revalidateTag } from "next/cache"

// (existing revalidateCompetitionPaths stays unchanged)

export function publicPdfCacheTag(slug: string): string {
  return `public-pdf:${slug}`
}

export function revalidatePublicSlug(slug: string | null | undefined): void {
  if (!slug) return
  revalidateTag(publicPdfCacheTag(slug))
}
```

Tag-based eviction matches the route handler's `unstable_cache` tag (Task 9), and works regardless of which phaseTag is currently cached.

- [ ] **Step 3: Verify TypeScript**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/competitions/actions/_shared.ts
git commit -m "feat(competitions): extend BaseSchema (publish + slug + password) and add tag-based revalidatePublicSlug helper"
```

---

## Task 5: Update `createCompetition`

**Files:**

- Modify: `src/lib/competitions/actions/create.ts`

- [ ] **Step 1: Add imports**

At the top of `src/lib/competitions/actions/create.ts`, add:

```ts
import bcrypt from "bcryptjs"
import { findActiveSlugConflict } from "../publicSlug"
import { revalidatePublicSlug } from "./_shared"
```

(`revalidatePublicSlug` may already be implicitly available via the `_shared` import — make sure it's exported.)

- [ ] **Step 2: Pass new fields through to the schema parser**

In the `safeParse` block (around line 22), add the four new form fields:

```ts
      isPublic: formData.get("isPublic"),
      publicSlug: formData.get("publicSlug"),
      publicPassword: formData.get("publicPassword"),
      removePublicPassword: formData.get("removePublicPassword"),
```

- [ ] **Step 3: Conflict check before insert**

After the discipline existence check and before `db.competition.create`, add:

```ts
if (parsed.data.isPublic && parsed.data.publicSlug) {
  const conflict = await findActiveSlugConflict(parsed.data.publicSlug, null)
  if (conflict) {
    return {
      error: `Slug ist bereits vom aktiven Wettbewerb '${conflict.name}' belegt. Wählen Sie einen anderen Slug oder schließen Sie den anderen Wettbewerb zuerst ab.`,
    }
  }
}
```

- [ ] **Step 4: Hash password if provided**

For creation, the "leave existing hash alone" case doesn't apply (no row yet), so the rule simplifies to: if `removePublicPassword` is true or `publicPassword` is null → store null; otherwise hash it.

Before `db.competition.create`, add:

```ts
const publicPasswordHash =
  parsed.data.removePublicPassword || parsed.data.publicPassword == null
    ? null
    : await bcrypt.hash(parsed.data.publicPassword, 12)
```

- [ ] **Step 5: Persist the new fields in `db.competition.create`**

Inside the `create({ data: { … } })` payload, add (place near the top with other base fields):

```ts
      isPublic: parsed.data.isPublic,
      publicSlug: parsed.data.publicSlug,
      publicPasswordHash,
```

- [ ] **Step 6: Revalidate public slug on creation**

After the `create()`, before the `revalidateCompetitionPaths()` call, add:

```ts
if (parsed.data.isPublic && parsed.data.publicSlug) {
  revalidatePublicSlug(parsed.data.publicSlug)
}
```

- [ ] **Step 7: Verify TypeScript**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/competitions/actions/create.ts
git commit -m "feat(competitions): support isPublic/publicSlug/publicPassword in createCompetition"
```

---

## Task 6: Update `updateCompetition`

**Files:**

- Modify: `src/lib/competitions/actions/update.ts`

- [ ] **Step 1: Add imports**

At the top of `src/lib/competitions/actions/update.ts`, add:

```ts
import bcrypt from "bcryptjs"
import { findActiveSlugConflict } from "../publicSlug"
import { revalidatePublicSlug } from "./_shared"
```

- [ ] **Step 2: Load existing publish state**

In the existing `Promise.all` that fetches `competition` (around line 19), extend the `select` to include the current slug, publish state, status, and the existing hash:

```ts
    db.competition.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        scoringMode: true,
        status: true,
        isPublic: true,
        publicSlug: true,
        publicPasswordHash: true,
      },
    }),
```

- [ ] **Step 3: Pass new fields through to schema parser**

Inside the `safeParse({ ... })` call, add:

```ts
      isPublic: formData.get("isPublic"),
      publicSlug: formData.get("publicSlug"),
      publicPassword: formData.get("publicPassword"),
      removePublicPassword: formData.get("removePublicPassword"),
```

- [ ] **Step 4: Conflict check when publishing or changing slug**

After `if (!parsed.success) return …`, before `db.competition.update`, add:

```ts
const willBePublic = parsed.data.isPublic
const willHaveSlug = parsed.data.publicSlug
const isActive = competition.status === "ACTIVE"

if (willBePublic && willHaveSlug && isActive) {
  const conflict = await findActiveSlugConflict(willHaveSlug, id)
  if (conflict) {
    return {
      error: `Slug ist bereits vom aktiven Wettbewerb '${conflict.name}' belegt. Wählen Sie einen anderen Slug oder schließen Sie den anderen Wettbewerb zuerst ab.`,
    }
  }
}
```

- [ ] **Step 5: Decide what to do with the password hash**

The three-way semantics are:

| Inputs                                                       | Result                        |
| ------------------------------------------------------------ | ----------------------------- |
| `removePublicPassword = true`                                | hash → null                   |
| `publicPassword` non-null (and `removePublicPassword` false) | hash → bcrypt(publicPassword) |
| `publicPassword` null AND `removePublicPassword` false       | leave existing hash unchanged |

Implement before the `update`:

```ts
let publicPasswordHashUpdate: string | null | undefined
if (parsed.data.removePublicPassword) {
  publicPasswordHashUpdate = null
} else if (parsed.data.publicPassword != null) {
  publicPasswordHashUpdate = await bcrypt.hash(parsed.data.publicPassword, 12)
} else {
  publicPasswordHashUpdate = undefined // Prisma: do not touch the column
}
```

- [ ] **Step 6: Persist the new fields in the update**

Inside the `update({ data: { … } })` payload, alongside `name:`, add:

```ts
      isPublic: parsed.data.isPublic,
      publicSlug: parsed.data.publicSlug,
      publicPasswordHash: publicPasswordHashUpdate,
```

(Prisma treats `undefined` as "no change" — that's why the third case above uses `undefined`.)

- [ ] **Step 7: Revalidate both old and new slug paths**

After the `db.competition.update` and `auditLog.create`, before `revalidateCompetitionPaths()`, add:

```ts
// Old slug must be revalidated if it changed or publishing was turned off
if (competition.publicSlug && competition.publicSlug !== parsed.data.publicSlug) {
  revalidatePublicSlug(competition.publicSlug)
}
if (competition.isPublic && !parsed.data.isPublic && competition.publicSlug) {
  revalidatePublicSlug(competition.publicSlug)
}
// New slug
if (parsed.data.isPublic && parsed.data.publicSlug) {
  revalidatePublicSlug(parsed.data.publicSlug)
}
```

Note: changing the password does **not** require cache invalidation — the auth check happens on every request, not from cache.

- [ ] **Step 8: Verify TypeScript**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/competitions/actions/update.ts
git commit -m "feat(competitions): support publicSlug/publicPassword edits with conflict check + cache invalidation"
```

---

## Task 7: Update `setCompetitionStatus`

**Files:**

- Modify: `src/lib/competitions/actions/update.ts`

- [ ] **Step 1: Load slug + publish state**

In `setCompetitionStatus` (around line 118), extend the `findUnique` select:

```ts
const competition = await db.competition.findUnique({
  where: { id },
  select: { id: true, name: true, status: true, isPublic: true, publicSlug: true },
})
```

- [ ] **Step 2: Conflict check when transitioning into ACTIVE**

After the `ALLOWED_TRANSITIONS` check, before the `db.competition.update`, add (using the static `findActiveSlugConflict` import added in Task 6 Step 1):

```ts
if (status === "ACTIVE" && competition.isPublic && competition.publicSlug) {
  const conflict = await findActiveSlugConflict(competition.publicSlug, id)
  if (conflict) {
    return {
      error: `Slug '${competition.publicSlug}' ist bereits vom aktiven Wettbewerb '${conflict.name}' belegt. Wählen Sie einen anderen Slug oder schließen Sie den anderen Wettbewerb zuerst ab.`,
    }
  }
}
```

- [ ] **Step 3: Revalidate public slug after any status change**

After the `auditLog.create`, before `revalidateCompetitionPaths()`, add:

```ts
if (competition.publicSlug) {
  revalidatePublicSlug(competition.publicSlug)
}
```

This covers two cases worth invalidating:

- ACTIVE → COMPLETED/ARCHIVED: the slug now falls back to whichever other holder exists (or to historical view of this competition itself)
- COMPLETED/ARCHIVED → ACTIVE: this competition becomes the live claimant

- [ ] **Step 4: Also invalidate on Liga playoff start**

The `startPlayoffs` action (in `src/lib/playoffs/actions/start.ts`) currently doesn't touch the competition. For Liga competitions whose URL must switch from Spielplan to Playoffs PDF, we need to invalidate after playoffs start.

Open `src/lib/playoffs/actions/start.ts`. After the playoff matches are created and the audit log entry is written (search for `PLAYOFFS_STARTED`), and before the existing `revalidatePath` calls (if any), add:

```ts
const comp = await db.competition.findUnique({
  where: { id: competitionId },
  select: { isPublic: true, publicSlug: true },
})
if (comp?.isPublic && comp.publicSlug) {
  revalidateTag(`public-pdf:${comp.publicSlug}`)
}
```

Add `import { revalidateTag } from "next/cache"` at the top if not already imported.

- [ ] **Step 5: Verify TypeScript**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/competitions/actions/update.ts src/lib/playoffs/actions/start.ts
git commit -m "feat(competitions): invalidate public PDF cache on status change and playoff start"
```

---

## Task 8: Action-level tests for slug rules

**Files:**

- Modify: `src/lib/competitions/actions.test.ts`

- [ ] **Step 1: Add tests for `createCompetition` slug behavior**

Open `src/lib/competitions/actions.test.ts`. Append a new `describe` block:

```ts
describe("createCompetition — public slug", () => {
  it("creates a competition with isPublic + slug", async () => {
    const fd = new FormData()
    fd.set("name", "Public Test")
    fd.set("type", "EVENT")
    fd.set("scoringMode", "RINGS")
    fd.set("shotsPerSeries", "10")
    fd.set("isPublic", "on")
    fd.set("publicSlug", "public-test-event")

    const result = await createCompetition(null, fd)
    expect("data" in result && result.data?.id).toBeTruthy()

    const created = await db.competition.findFirst({ where: { publicSlug: "public-test-event" } })
    expect(created?.isPublic).toBe(true)
  })

  it("rejects a second ACTIVE+isPublic competition with the same slug", async () => {
    // Arrange: existing ACTIVE+isPublic
    await db.competition.create({
      data: {
        name: "First",
        type: "EVENT",
        scoringMode: "RINGS",
        shotsPerSeries: 10,
        status: "ACTIVE",
        isPublic: true,
        publicSlug: "conflict-slug",
        createdByUserId: (await db.user.findFirst())!.id,
      },
    })

    const fd = new FormData()
    fd.set("name", "Second")
    fd.set("type", "EVENT")
    fd.set("scoringMode", "RINGS")
    fd.set("shotsPerSeries", "10")
    fd.set("isPublic", "on")
    fd.set("publicSlug", "conflict-slug")

    const result = await createCompetition(null, fd)
    expect(
      "error" in result && typeof result.error === "string" && result.error.includes("'First'")
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Add tests for `updateCompetition` and `setCompetitionStatus`**

Append:

```ts
describe("updateCompetition — public slug", () => {
  it("rejects switching to a slug held by another ACTIVE+isPublic competition", async () => {
    const userId = (await db.user.findFirst())!.id
    const other = await db.competition.create({
      data: {
        name: "Other Active",
        type: "EVENT",
        scoringMode: "RINGS",
        shotsPerSeries: 10,
        status: "ACTIVE",
        isPublic: true,
        publicSlug: "taken",
        createdByUserId: userId,
      },
    })
    const target = await db.competition.create({
      data: {
        name: "Target",
        type: "EVENT",
        scoringMode: "RINGS",
        shotsPerSeries: 10,
        status: "ACTIVE",
        isPublic: false,
        publicSlug: null,
        createdByUserId: userId,
      },
    })

    const fd = new FormData()
    fd.set("name", "Target")
    fd.set("scoringMode", "RINGS")
    fd.set("shotsPerSeries", "10")
    fd.set("isPublic", "on")
    fd.set("publicSlug", "taken")
    // ... include other form fields required by BaseSchema (eventDate, allowGuests, etc., empty strings)

    const result = await updateCompetition(target.id, null, fd)
    expect(
      "error" in result &&
        typeof result.error === "string" &&
        result.error.includes("'Other Active'")
    ).toBe(true)
  })
})

describe("setCompetitionStatus — public slug", () => {
  it("blocks transition to ACTIVE when another ACTIVE+isPublic holds the slug", async () => {
    const userId = (await db.user.findFirst())!.id
    await db.competition.create({
      data: {
        name: "Holder",
        type: "EVENT",
        scoringMode: "RINGS",
        shotsPerSeries: 10,
        status: "ACTIVE",
        isPublic: true,
        publicSlug: "year-cup",
        createdByUserId: userId,
      },
    })
    const draft = await db.competition.create({
      data: {
        name: "Next Year",
        type: "EVENT",
        scoringMode: "RINGS",
        shotsPerSeries: 10,
        status: "DRAFT",
        isPublic: true,
        publicSlug: "year-cup",
        createdByUserId: userId,
      },
    })

    const result = await setCompetitionStatus(draft.id, "ACTIVE")
    expect(
      "error" in result && typeof result.error === "string" && result.error.includes("'Holder'")
    ).toBe(true)
  })
})
```

- [ ] **Step 3: Add tests for password hashing semantics**

Append:

```ts
describe("updateCompetition — public password", () => {
  it("hashes the password and stores no plaintext", async () => {
    const userId = (await db.user.findFirst())!.id
    const target = await db.competition.create({
      data: {
        name: "Pw Target",
        type: "EVENT",
        scoringMode: "RINGS",
        shotsPerSeries: 10,
        status: "ACTIVE",
        isPublic: true,
        publicSlug: "pw-target",
        createdByUserId: userId,
      },
    })

    const fd = buildBaseFormData({ name: "Pw Target" })
    fd.set("isPublic", "on")
    fd.set("publicSlug", "pw-target")
    fd.set("publicPassword", "geheim")

    await updateCompetition(target.id, null, fd)

    const after = await db.competition.findUnique({ where: { id: target.id } })
    expect(after?.publicPasswordHash).toBeTruthy()
    expect(after?.publicPasswordHash).not.toContain("geheim")
    expect(await bcrypt.compare("geheim", after!.publicPasswordHash!)).toBe(true)
  })

  it("leaves existing hash alone when password input is empty", async () => {
    const userId = (await db.user.findFirst())!.id
    const existingHash = await bcrypt.hash("origpass", 12)
    const target = await db.competition.create({
      data: {
        name: "Keep Pw",
        type: "EVENT",
        scoringMode: "RINGS",
        shotsPerSeries: 10,
        status: "ACTIVE",
        isPublic: true,
        publicSlug: "keep-pw",
        publicPasswordHash: existingHash,
        createdByUserId: userId,
      },
    })

    const fd = buildBaseFormData({ name: "Keep Pw" })
    fd.set("isPublic", "on")
    fd.set("publicSlug", "keep-pw")
    // publicPassword intentionally not set

    await updateCompetition(target.id, null, fd)

    const after = await db.competition.findUnique({ where: { id: target.id } })
    expect(after?.publicPasswordHash).toBe(existingHash)
  })

  it("clears the hash when removePublicPassword is checked", async () => {
    const userId = (await db.user.findFirst())!.id
    const target = await db.competition.create({
      data: {
        name: "Clear Pw",
        type: "EVENT",
        scoringMode: "RINGS",
        shotsPerSeries: 10,
        status: "ACTIVE",
        isPublic: true,
        publicSlug: "clear-pw",
        publicPasswordHash: await bcrypt.hash("toremove", 12),
        createdByUserId: userId,
      },
    })

    const fd = buildBaseFormData({ name: "Clear Pw" })
    fd.set("isPublic", "on")
    fd.set("publicSlug", "clear-pw")
    fd.set("removePublicPassword", "on")

    await updateCompetition(target.id, null, fd)

    const after = await db.competition.findUnique({ where: { id: target.id } })
    expect(after?.publicPasswordHash).toBeNull()
  })

  it("rejects passwords shorter than 4 characters", async () => {
    const userId = (await db.user.findFirst())!.id
    const target = await db.competition.create({
      data: {
        name: "Short Pw",
        type: "EVENT",
        scoringMode: "RINGS",
        shotsPerSeries: 10,
        status: "ACTIVE",
        isPublic: true,
        publicSlug: "short-pw",
        createdByUserId: userId,
      },
    })

    const fd = buildBaseFormData({ name: "Short Pw" })
    fd.set("isPublic", "on")
    fd.set("publicSlug", "short-pw")
    fd.set("publicPassword", "abc")

    const result = await updateCompetition(target.id, null, fd)
    expect("error" in result).toBe(true)
  })
})

// Helper to satisfy BaseSchema's required fields in tests. Adapt to whatever
// the existing test file's helper conventions are.
function buildBaseFormData(overrides: { name: string }): FormData {
  const fd = new FormData()
  fd.set("name", overrides.name)
  fd.set("scoringMode", "RINGS")
  fd.set("shotsPerSeries", "10")
  // Add any other required fields the existing actions.test.ts already sets in its helpers
  return fd
}
```

Add the import at the top of the test file:

```ts
import bcrypt from "bcryptjs"
```

- [ ] **Step 4: Run the test file**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm test -- src/lib/competitions/actions.test.ts
```

Expected: new tests PASS. If pre-existing tests fail because of FormData fields not being set, fill in the missing required fields (mirror what tests for other actions in the file already do).

**Hinweis Zod-Fehler:** Der Test `expect("error" in result).toBe(true)` für das kurze Passwort prüft auf ein Top-Level `error`-Property. Zod-Feldfehler kommen aber ggf. als `fieldErrors`. Schau zuerst, wie bestehende Action-Tests Validierungsfehler prüfen (z.B. `result?.fieldErrors?.publicPassword`), und passe den Test entsprechend an.

- [ ] **Step 4: Commit**

```bash
git add src/lib/competitions/actions.test.ts
git commit -m "test(competitions): cover public-slug conflict checks on create/update/status"
```

---

## Task 9: Public PDF route

**Files:**

- Create: `src/app/api/public/c/[slug]/pdf/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/public/c/[slug]/pdf/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import bcrypt from "bcryptjs"
import { resolveSlug, SLUG_REGEX } from "@/lib/competitions/publicSlug"
import { hasPlayoffsStarted, getPlayoffBracket } from "@/lib/playoffs/queries"
import {
  getCompetitionById,
  getEventWithSeries,
  getSeasonWithSeries,
} from "@/lib/competitions/queries"
import { getMatchupsForCompetition } from "@/lib/matchups/queries"
import { getStandingsForCompetition } from "@/lib/standings/queries"
import { rankEventParticipants, rankEventTeams } from "@/lib/scoring/rankEventParticipants"
import { calculateSeasonStandings } from "@/lib/scoring/calculateSeasonStandings"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import { EventRankingPdf } from "@/lib/pdf/EventRankingPdf"
import { SeasonStandingsPdf } from "@/lib/pdf/SeasonStandingsPdf"
import { SchedulePdf } from "@/lib/pdf/SchedulePdf"
import { PlayoffsPdf } from "@/lib/pdf/PlayoffsPdf"

// The auth check must run on every request, so we cannot use route-level revalidate.
// The expensive PDF render is cached separately via unstable_cache (see renderPdfBuffer).
export const dynamic = "force-dynamic"

type PhaseTag = "ranking" | "standings" | "schedule" | "playoffs"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params

  // Defensive: malformed slug → 404 immediately, do not hit DB
  if (!SLUG_REGEX.test(slug)) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const competition = await resolveSlug(slug)
  if (!competition) {
    return new NextResponse("Not Found", { status: 404 })
  }

  // === Password check ===================================================
  if (competition.publicPasswordHash) {
    const authHeader = req.headers.get("authorization")
    const provided = parseBasicAuthPassword(authHeader)
    const ok = provided != null && (await bcrypt.compare(provided, competition.publicPasswordHash))
    if (!ok) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": `Basic realm="${escapeRealm(competition.name)}", charset="UTF-8"`,
        },
      })
    }
  }

  // === Pick PDF type and render =========================================
  let phaseTag: PhaseTag
  if (competition.type === "EVENT") {
    phaseTag = "ranking"
  } else if (competition.type === "SEASON") {
    phaseTag = "standings"
  } else if (competition.type === "LEAGUE") {
    phaseTag = (await hasPlayoffsStarted(competition.id)) ? "playoffs" : "schedule"
  } else {
    return new NextResponse("Not Found", { status: 404 })
  }

  const buffer = await renderPdfBuffer(competition.id, phaseTag, slug)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slug}.pdf"`,
      // Each request must hit the route so the password check runs. Internal PDF
      // render is cached via unstable_cache below.
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}

// === Auth helpers ============================================================

/** Decode the password portion of a Basic Authorization header. Returns null if absent or malformed. */
function parseBasicAuthPassword(header: string | null): string | null {
  if (!header) return null
  const [scheme, encoded] = header.split(" ", 2)
  if (scheme?.toLowerCase() !== "basic" || !encoded) return null
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8")
    const idx = decoded.indexOf(":")
    if (idx < 0) return decoded // No colon → treat whole string as password (lenient)
    return decoded.slice(idx + 1)
  } catch {
    return null
  }
}

/** Sanitize the competition name for inclusion in the WWW-Authenticate realm parameter. */
function escapeRealm(name: string): string {
  return name.replace(/[\\"]/g, "")
}

// === PDF buffer cache ========================================================
// Key: (competitionId, phaseTag). Tagged so server actions can revalidate per slug.

async function renderPdfBuffer(
  competitionId: string,
  phaseTag: PhaseTag,
  slug: string
): Promise<Buffer> {
  const cached = unstable_cache(
    () => buildAndRenderBuffer(competitionId, phaseTag),
    ["public-pdf-buffer", competitionId, phaseTag],
    { revalidate: 86400, tags: [`public-pdf:${slug}`] }
  )
  return cached()
}

async function buildAndRenderBuffer(competitionId: string, phaseTag: PhaseTag): Promise<Buffer> {
  let element: ReactElement<DocumentProps>
  if (phaseTag === "ranking") element = await buildEventRankingElement(competitionId)
  else if (phaseTag === "standings") element = await buildSeasonStandingsElement(competitionId)
  else if (phaseTag === "schedule") element = await buildScheduleElement(competitionId)
  else element = await buildPlayoffsElement(competitionId)
  return renderToBuffer(element)
}

// === PDF builders ============================================================
// Mirror the existing protected PDF routes under /api/competitions/[id]/pdf/<type>.
// Identical prop shapes — same PDF components rendered the same way.

async function buildEventRankingElement(
  competitionId: string
): Promise<ReactElement<DocumentProps>> {
  const data = await getEventWithSeries(competitionId)
  if (!data) throw new Error("Competition not found while rendering public PDF")
  const { competition, series } = data

  const ranked = rankEventParticipants(series, {
    scoringMode: competition.scoringMode,
    targetValue: competition.targetValue,
    targetValueType: competition.targetValueType,
    discipline: competition.discipline,
  })
  const isTeamEvent = (competition.teamSize ?? 0) >= 2
  const teamScoring = competition.teamScoring ?? "SUM"
  const teamRanked = isTeamEvent ? rankEventTeams(ranked, teamScoring, competition.scoringMode) : []

  return createElement(EventRankingPdf, {
    competitionName: competition.name,
    disciplineName: competition.discipline?.name ?? null,
    eventDate: competition.eventDate,
    scoringMode: competition.scoringMode,
    targetValueType: competition.targetValueType,
    shotsPerSeries: competition.shotsPerSeries,
    targetValue: competition.targetValue,
    isMixed: !competition.disciplineId,
    entries: ranked,
    teamEntries: isTeamEvent ? teamRanked : undefined,
    teamScoring: isTeamEvent ? teamScoring : undefined,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>
}

async function buildSeasonStandingsElement(
  competitionId: string
): Promise<ReactElement<DocumentProps>> {
  const data = await getSeasonWithSeries(competitionId)
  if (!data) throw new Error("Competition not found while rendering public PDF")
  const { competition, participants } = data

  const standings = calculateSeasonStandings(
    participants.map((p) => ({
      participantId: p.participantId,
      participantName: `${p.lastName}, ${p.firstName}`,
      series: p.series,
    })),
    competition.minSeries
  )

  return createElement(SeasonStandingsPdf, {
    competitionName: competition.name,
    disciplineName: competition.discipline?.name ?? null,
    seasonStart: competition.seasonStart,
    seasonEnd: competition.seasonEnd,
    scoringMode: competition.scoringMode,
    shotsPerSeries: competition.shotsPerSeries,
    minSeries: competition.minSeries,
    isMixed: !competition.disciplineId,
    entries: standings,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>
}

async function buildScheduleElement(competitionId: string): Promise<ReactElement<DocumentProps>> {
  const [competition, standings, matchups] = await Promise.all([
    getCompetitionById(competitionId),
    getStandingsForCompetition(competitionId),
    getMatchupsForCompetition(competitionId),
  ])
  if (!competition) throw new Error("Competition not found while rendering public PDF")

  return createElement(SchedulePdf, {
    leagueName: competition.name,
    disciplineName: competition.discipline?.name ?? "Gemischt",
    scoringType: getEffectiveScoringType(competition.scoringMode, competition.discipline),
    standings,
    matchups,
    firstLegDeadline: competition.hinrundeDeadline,
    secondLegDeadline: competition.rueckrundeDeadline,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>
}

async function buildPlayoffsElement(competitionId: string): Promise<ReactElement<DocumentProps>> {
  const [competition, bracket] = await Promise.all([
    getCompetitionById(competitionId),
    getPlayoffBracket(competitionId),
  ])
  if (!competition) throw new Error("Competition not found while rendering public PDF")

  return createElement(PlayoffsPdf, {
    leagueName: competition.name,
    disciplineName: competition.discipline?.name ?? "Gemischt",
    scoringType: getEffectiveScoringType(competition.scoringMode, competition.discipline),
    bracket,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>
}
```

**Notes:**

- All four builders intentionally mirror the existing protected routes (`src/app/api/competitions/[id]/pdf/{ranking,standings,schedule,playoffs}/route.ts`). If you spot real duplication and want to extract shared builders into `src/lib/pdf/builders.ts`, do it — but only if it removes friction, not pre-emptively.
- `dynamic = "force-dynamic"` ensures the route handler runs on every request so the Basic Auth check is always enforced. The expensive `renderToBuffer` is cached via `unstable_cache`, so cache hits are fast (~50 ms).
- The cache tag is `public-pdf:<slug>` — server actions in Task 4 use the matching `revalidateTag` helper.
- `Cache-Control: private, max-age=0, must-revalidate` — the response body must NOT be cached by intermediaries or shared between visitors with different credentials.
- `new Uint8Array(buffer)` wrapping matches the convention used by the protected routes (works around Node Buffer vs. fetch BodyInit typing).
- **`unstable_cache` Hinweis:** Die `renderPdfBuffer`-Funktion erzeugt die Cache-Funktion inline per Request. Next.js verwendet denselben Cache-Key — sollte funktionieren. Falls das Caching aber nicht greift, die Cache-Funktion auf Modulebene verschieben (einmal definiert, nicht pro Request neu erstellt).

- [ ] **Step 2: Verify `proxy.ts` does not block the route**

Pre-verified: `src/proxy.ts` matcher lists only `/`, `/competitions/:path*`, `/participants/:path*`, `/disciplines/:path*`, `/admin/:path*`, `/account/:path*` — `/api/public/*` ist nicht abgedeckt. No change needed.

- [ ] **Step 3: Manual smoke test**

Start the dev server:

```bash
docker compose -f docker-compose.dev.yml up app
```

In another shell, mark an existing competition as public:

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma studio
# or just edit via the UI once Task 10 is done
```

For now, set `isPublic = true` and `publicSlug = test` directly on a Competition row, then hit:

```bash
curl -I http://localhost:3000/api/public/c/test/pdf
```

Expected: HTTP 200, `Content-Type: application/pdf`.

```bash
curl -I http://localhost:3000/api/public/c/does-not-exist/pdf
```

Expected: HTTP 404.

For the password path, manually set `publicPasswordHash` on the same row using `bcrypt.hash("geheim", 12)` output (e.g. via `node -e 'require("bcryptjs").hash("geheim", 12).then(console.log)'`):

```bash
curl -I http://localhost:3000/api/public/c/test/pdf
```

Expected: HTTP 401, `WWW-Authenticate: Basic realm="…"`.

```bash
curl -I -u :wrong http://localhost:3000/api/public/c/test/pdf
```

Expected: HTTP 401.

```bash
curl -I -u :geheim http://localhost:3000/api/public/c/test/pdf
```

Expected: HTTP 200, `Content-Type: application/pdf`.

- [ ] **Step 4: Verify TypeScript + tests**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
docker compose -f docker-compose.dev.yml run --rm app npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/public/c/
git commit -m "feat(api): add public PDF route /api/public/c/[slug]/pdf with phase-aware Liga PDF selection"
```

---

## Task 10: Edit-form UI (publish switch + slug input)

**Files:**

- Modify: `src/components/app/competitions/CompetitionForm.tsx`

- [ ] **Step 1: Add state hooks**

In the `CompetitionForm` component, after the existing `useState` calls (around line 80), add:

```tsx
const [isPublic, setIsPublic] = useState<boolean>(competition?.isPublic ?? false)
const [publicSlug, setPublicSlug] = useState<string>(competition?.publicSlug ?? "")
const [publicPassword, setPublicPassword] = useState<string>("")
const [removePublicPassword, setRemovePublicPassword] = useState<boolean>(false)

const hasExistingPassword = competition?.hasPublicPassword ?? false
```

Also import `slugify` at the top:

```tsx
import { slugify, SLUG_REGEX } from "@/lib/competitions/publicSlug"
```

- [ ] **Step 2: Pre-fill slug from name on first publish**

Add a `useEffect`:

```tsx
// When the user first turns the publish switch on, pre-fill the slug from the name
// (only if the slug input is currently empty). Subsequent edits to either field are left alone.
useEffect(() => {
  if (isPublic && publicSlug.trim() === "" && name) {
    setPublicSlug(slugify(name))
  }
}, [isPublic]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Render the publish section in the form**

Find a sensible location in the JSX (after the name field and before type-specific sections — look for the closing tag of the "Allgemein" group). Insert:

```tsx
<div className="space-y-4 rounded-lg border bg-card p-4">
  <div className="flex items-start gap-3">
    <Checkbox
      id="isPublic"
      name="isPublic"
      checked={isPublic}
      onCheckedChange={(v) => setIsPublic(v === true)}
    />
    <div className="space-y-1">
      <Label htmlFor="isPublic">Auf Vereins-Website veröffentlichen</Label>
      <p className="text-sm text-muted-foreground">
        Stellt das Haupt-PDF dieses Wettbewerbs unter einer öffentlichen URL bereit.
      </p>
    </div>
  </div>

  {isPublic && (
    <div className="space-y-4 pl-7">
      <div className="space-y-2">
        <Label htmlFor="publicSlug">Slug</Label>
        <Input
          id="publicSlug"
          name="publicSlug"
          value={publicSlug}
          onChange={(e) => setPublicSlug(e.target.value)}
          placeholder="z.B. jahrespreisschiessen"
          maxLength={60}
        />
        <p className="text-xs text-muted-foreground">
          URL: <code>/api/public/c/{publicSlug || "<slug>"}/pdf</code>
        </p>
        {publicSlug && !SLUG_REGEX.test(publicSlug) && (
          <p className="text-xs text-destructive">
            Slug: 3–60 Zeichen, nur a–z, 0–9 und Bindestriche, keine doppelten Bindestriche.
          </p>
        )}
        {isEdit && competition?.publicSlug && competition.publicSlug !== publicSlug && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Hinweis: Die bestehende öffentliche URL (
            <code>/api/public/c/{competition.publicSlug}/pdf</code>) wird ungültig.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="publicPassword">Passwort (optional)</Label>
        <Input
          id="publicPassword"
          name="publicPassword"
          type="password"
          value={publicPassword}
          onChange={(e) => setPublicPassword(e.target.value)}
          placeholder={hasExistingPassword ? "●●●●●●●●" : ""}
          autoComplete="new-password"
          disabled={removePublicPassword}
        />
        <p className="text-xs text-muted-foreground">
          {hasExistingPassword
            ? "Passwort ist gesetzt. Leer lassen, um es beizubehalten."
            : "Optional — leer lassen für ungeschützten Zugriff. Mindestens 4 Zeichen."}
        </p>
        {publicPassword && publicPassword.length < 4 && (
          <p className="text-xs text-destructive">Passwort muss mindestens 4 Zeichen haben.</p>
        )}
        {hasExistingPassword && (
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="removePublicPassword"
              name="removePublicPassword"
              checked={removePublicPassword}
              onCheckedChange={(v) => setRemovePublicPassword(v === true)}
            />
            <Label htmlFor="removePublicPassword" className="text-sm font-normal">
              Passwort entfernen
            </Label>
          </div>
        )}
      </div>
    </div>
  )}
</div>
```

If the form is large, prefer adding this block near the top of the JSX, just below the name input — it's part of the "general" fields, not type-specific.

- [ ] **Step 4: Render server error for `publicSlug` field**

The form already renders `state?.error` for top-level errors. If the existing form has field-level error rendering (look for `state?.error?.fieldErrors`), make sure `publicSlug` errors are shown next to the input.

- [ ] **Step 5: Visual verification with `/run`**

Skip if you cannot run the dev server. Otherwise:

```bash
# In project root
/run
```

Open `/competitions/new`, create a new EVENT, tick "Auf Vereins-Website veröffentlichen", see the slug auto-fill from the name, save. Reopen `/competitions/<id>/edit` and verify the value is persisted.

- [ ] **Step 6: Verify TypeScript + format**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
docker compose -f docker-compose.dev.yml run --rm app npm run format:check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/app/competitions/CompetitionForm.tsx
git commit -m "feat(ui): add 'Auf Vereins-Website veröffentlichen' switch and slug input to competition form"
```

---

## Task 11: "Öffentlich" badge on competitions list

**Files:**

- Modify: `src/app/(app)/competitions/page.tsx`

- [ ] **Step 1: Add badge next to the competition name on active competitions**

In `src/app/(app)/competitions/page.tsx`, find the active competitions block (around line 207) — the `<div className="flex flex-wrap items-center gap-2">` that already contains `<span>{c.name}</span>`, `<CompetitionTypeBadge />`, and the discipline `<Badge>`. After the discipline badge, add:

```tsx
{
  c.isPublic && (
    <Badge variant="outline" className="text-xs">
      Öffentlich
    </Badge>
  )
}
```

Do the **same** for the draft block higher up (around line 181) so the marker is visible everywhere a competition appears in the list. Skip the archived/completed sections — those competitions no longer hold the active claim and showing the badge would be misleading.

- [ ] **Step 2: Visual verification**

Open `/competitions`. Confirm: active competition with `isPublic = true` shows the "Öffentlich" badge; the same competition after archiving does **not**.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/competitions/page.tsx
git commit -m "feat(ui): show 'Öffentlich' badge on active competitions that are published"
```

---

## Task 12: Documentation sync

**Files:**

- Modify: `.claude/docs/features.md`
- Modify: `.claude/docs/architecture.md`

- [ ] **Step 1: Add a section to `features.md`**

Find the "Visualisierung & Auswertung" section and append a new subsection:

```markdown
### Öffentliche PDF-URL (Website-Verlinkung)

Wettbewerbe können mit `isPublic = true` und einem `publicSlug` markiert werden, um ihr Haupt-PDF unter `/api/public/c/<slug>/pdf` ohne Login verfügbar zu machen.

- **Auswahl Haupt-PDF:** EVENT → Rangliste, SEASON → Standings, LEAGUE → Spielplan+Tabelle vor Playoff-Start, Playoff-Bracket nach Start
- **Slug-Verwaltung:** Ein Slug darf nur von **einem** ACTIVE+isPublic Wettbewerb gleichzeitig belegt sein (Partial Unique Index). Sobald der Wettbewerb auf COMPLETED/ARCHIVED gesetzt wird, ist der Slug für einen Nachfolger wieder frei.
- **Stabile URL über Jahre:** Beispiel Jahrespreisschiessen → jährlich neuer Wettbewerb übernimmt denselben Slug, die Website-URL bleibt gleich.
- **Lookup-Reihenfolge:** ACTIVE-Claimant zuerst, sonst jüngster (createdAt DESC) COMPLETED/ARCHIVED-Holder.
- **Optionaler Passwortschutz:** Pro Wettbewerb kann ein bcrypt-gehashtes Passwort gesetzt werden. Browser zeigt nativen HTTP-Basic-Auth-Dialog. Benutzername wird ignoriert (geteiltes Passwort pro Wettbewerb).
- **Cache:** PDF-Buffer 24h via `unstable_cache` (keyed by competitionId + phaseTag, tagged `public-pdf:<slug>`); Auth-Check läuft auf jeder Anfrage. Invalidierung via `revalidateTag` in update/status/startPlayoffs Actions.
- **Berechtigung:** Schalter im Edit-Formular für ADMIN/MANAGER. Öffentliche Route ist unauthentisiert (außer optional via Basic-Auth-Passwort).
```

- [ ] **Step 2: Update `architecture.md` routes list**

In the routes block (around line 17), add the new route in the API section:

```
/api/public/c/[slug]/pdf            ← Öffentliches PDF (Haupt-Artefakt des Wettbewerbs, 24h Cache)
```

In the directory tree (around line 110), add inside `app/api/`:

```
api/
  public/
    c/
      [slug]/
        pdf/
          route.ts         ← Öffentliches PDF (resolveSlug, phase-aware)
```

And in the `lib/competitions/` section (around line 158), add:

```
publicSlug.ts             ← slugify, resolveSlug, findActiveSlugConflict (testpflichtig)
publicSlug.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add .claude/docs/features.md .claude/docs/architecture.md
git commit -m "docs: document public competition PDF URL feature"
```

---

## Task 13: Quality gates + end-to-end manual verification

**Files:** none directly; this task verifies the whole branch.

- [ ] **Step 1: Run `/check`**

```bash
/check
```

Expected: all green (lint, format, tests, tsc).

- [ ] **Step 2: Year-rollover scenario test (manual)**

With the dev server running:

1. Create a SEASON competition "Jahrespreisschiessen 2026", `isPublic = true`, slug `jahrespreisschiessen`. Status = ACTIVE.
2. Open `http://localhost:3000/api/public/c/jahrespreisschiessen/pdf` in a private browser window (anonymous, no session). Expect: PDF loads.
3. In the admin UI, set the competition status to COMPLETED, then ARCHIVED.
4. Hit the URL again. Expect: still loads (historical fallback).
5. Create "Jahrespreisschiessen 2027" with the same slug, status = ACTIVE, `isPublic = true`. Expect: save succeeds (the 2026 one is archived, not blocking).
6. Hit the URL again. Expect: now shows the 2027 PDF (the live ACTIVE claimant).
7. Try to create a third ACTIVE+isPublic competition with the same slug. Expect: save fails with the German error message naming "Jahrespreisschiessen 2027".

- [ ] **Step 3: Password protection test (manual)**

1. On a published competition (slug `passwd-test`), set "Passwort" to `geheim` and save.
2. Open `/api/public/c/passwd-test/pdf` in a fresh private browser window. Expect: browser shows native Basic Auth dialog with the competition name as realm.
3. Enter any username, password `falsch` → dialog reprompts.
4. Enter password `geheim` → PDF loads.
5. Edit the competition, check "Passwort entfernen", save. Reload the URL anonymously → PDF loads without prompt.
6. Edit again, set password `andere` (note: existing-hash hint is gone since we just removed it). Save. URL should now prompt for the new password.

- [ ] **Step 4: Liga phase-switch test (manual)**

1. Create a LEAGUE, mark it `isPublic`, slug `test-liga`, ACTIVE.
2. Hit `/api/public/c/test-liga/pdf`. Expect: Spielplan+Tabelle PDF.
3. Add enough participants and run `/playoffs/start` (or the UI button) to trigger `PLAYOFFS_STARTED`.
4. Hit the URL again. Expect: Playoff-Bracket PDF (cache was invalidated by the action).

- [ ] **Step 5: Lessons + consolidate-lessons + doc sync**

If anything surprised you during implementation, add an entry to `.claude/tasks/lessons.md` in the format `| YYYY-MM-DD | Was schiefgelaufen ist | Die Regel die es verhindert |`. At minimum one entry per session.

Then run `/consolidate-lessons` per the project workflow.

- [ ] **Step 6: Final commit (only if `/consolidate-lessons` produced changes)**

```bash
git status
# only if there are changes:
git add .claude/
git commit -m "docs: lessons learned from public PDF feature"
```

---

## Self-Review Checklist (filled in before plan handoff)

- **Spec coverage:**
  - Schema (`isPublic`, `publicSlug`, `publicPasswordHash`, partial unique index): Task 1 ✓
  - Slug helpers (slugify, resolveSlug, conflict check): Task 2 ✓
  - Type + query updates (with `hasPublicPassword` projection, hash never client-bound): Task 3 ✓
  - Action-level conflict checks + password hashing + cache invalidation: Tasks 4–8 ✓
  - Public route handler with phase-aware PDF selection + Basic Auth gate + `unstable_cache`: Task 9 ✓
  - Edit-form UI (switch + slug + URL preview + password + remove-password checkbox): Task 10 ✓
  - Badge on competitions list: Task 11 ✓
  - Documentation: Task 12 ✓
  - Quality gates + manual verification (incl. password scenarios): Task 13 ✓

- **Placeholder scan:** No `TODO` placeholders. All builder bodies in Task 9 are written inline.

- **Type consistency:** `slugify`, `SLUG_REGEX`, `resolveSlug`, `findActiveSlugConflict`, `revalidatePublicSlug` are referenced consistently across tasks.
