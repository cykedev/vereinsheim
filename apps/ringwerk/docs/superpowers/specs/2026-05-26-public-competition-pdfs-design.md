# Public Competition PDFs — Design

**Date:** 2026-05-26
**Status:** Draft

## Goal

Expose the main result PDF of selected competitions via a stable, unauthenticated URL so the club's public website can link to "current standings" without coordinating per-year link updates. The exposed URL is phase-agnostic — it serves whichever PDF best reflects the current state of the competition.

## Scope

**In scope:**

- New `isPublic` toggle, `publicSlug` field, and optional `publicPasswordHash` field on `Competition`
- One public route per slug that returns a PDF (live-rendered, cached 24h)
- Optional HTTP Basic Auth gate per competition (single shared password, hashed with bcrypt)
- Edit-form UI to toggle public visibility, edit the slug, and set/clear the password
- Cache invalidation hooks on status transitions and slug edits

**Out of scope:**

- Public HTML pages, JSON API, embeddable widgets — only PDF
- Multiple PDFs per competition (only the "main" PDF per type)
- URL redirects after slug change — old URL just 404s
- Audit-log entries for publishing/unpublishing (read-only side effect)
- Rate limiting or hotlink protection — on-prem deployment, low expected traffic

## User Story

As an admin maintaining the club website, I want a stable PDF link per competition (e.g. `…/api/public/c/jahrespreisschiessen/pdf`) that I can paste once on the website and that always reflects the current state of the competition. When the Liga moves to Playoffs, the same URL should automatically serve the Playoff bracket instead of the schedule. When next year's Jahrespreisschiessen starts, the same URL should switch to point at the new competition without any change on the website.

## URL Shape

```
GET /api/public/c/<slug>/pdf
```

- Lives outside `proxy.ts`'s auth matcher (verified: matcher covers `/`, `/competitions`, `/participants`, `/disciplines`, `/admin`, `/account` — none cover `/api/*`)
- One URL per competition — server picks the right PDF based on competition type and phase
- Slug is lowercase, dash-separated, 3–60 chars, regex `^[a-z0-9](-?[a-z0-9])+$`
- The `/pdf` path segment mirrors the existing pattern `/api/competitions/[id]/pdf/<type>` and is preferred over a `.pdf` suffix for consistency. The PDF filename in `Content-Disposition` is `<slug>.pdf`, so saved files still get a `.pdf` extension.

## PDF Selection Logic

For the competition resolved by the slug lookup (see next section), the route serves:

| Competition type | Condition                       | PDF                            |
| ---------------- | ------------------------------- | ------------------------------ |
| EVENT            | always                          | `EventRankingPdf`              |
| SEASON           | always                          | `SeasonStandingsPdf`           |
| LEAGUE           | no `PlayoffMatch` rows exist    | `SchedulePdf` (Spielplan+Tab.) |
| LEAGUE           | one or more `PlayoffMatch` rows | `PlayoffsPdf` (Bracket)        |

The "playoff phase active" check reuses whatever query/flag the existing Liga implementation already uses to detect Playoff start — discovered during plan writing, not specified here.

## Slug Resolution

Goal: a single slug can be carried forward across years of similar competitions without dead links.

**Active-claim rule:** A slug is "claimed" by a competition when `isPublic = true AND status = ACTIVE`. Only one such competition may exist per slug at any time. Other statuses (DRAFT, COMPLETED, ARCHIVED) do not claim a slug — they remain attached to it but can be displaced.

**Resolution at request time:**

1. Look up `Competition` where `publicSlug = <slug> AND isPublic = true AND status = ACTIVE` → if found, serve this one (live state)
2. Otherwise, look up the most recent (`ORDER BY createdAt DESC`) `Competition` where `publicSlug = <slug> AND isPublic = true AND status IN (COMPLETED, ARCHIVED)` → if found, serve this one (historical fallback)
3. Otherwise → HTTP 404

**Database constraint:** A partial unique index enforces the active-claim rule at the DB level:

```sql
CREATE UNIQUE INDEX competition_public_slug_active_unique
ON "Competition" ("publicSlug")
WHERE "isPublic" = true AND status = 'ACTIVE';
```

This is added as raw SQL inside the Prisma migration (Prisma cannot express partial unique indexes directly).

**Action-layer validation:** Server actions that can create an active claim (`updateCompetition`, `updateCompetitionStatus` transitioning to ACTIVE) re-run the conflict check before saving, so users get a clear error message instead of a database constraint failure:

> "Slug ist bereits vom aktiven Wettbewerb '<Name>' belegt. Wählen Sie einen anderen Slug oder schließen Sie den anderen Wettbewerb zuerst ab."

## Slug Lifecycle

- **First publish:** Toggling `isPublic = true` for the first time pre-fills the slug field from the competition name (slugify: lowercase, ASCII transliteration of umlauts ä→ae etc., dashes for spaces, strip everything else). The admin sees the proposed slug and can edit it before saving.
- **Editable after publish:** The slug can be changed at any later point (subject to the active-claim conflict check). Old URLs become 404 — accepted trade-off; documented in the edit UI as a warning.
- **Unpublish:** Setting `isPublic = false` leaves the slug stored on the competition but releases the active claim. Re-enabling publishing later restores the same URL (assuming no other ACTIVE competition has taken the slug in the meantime, in which case the action returns a conflict error).
- **Archive/Complete:** No effect on the stored slug. The competition simply stops being the "ACTIVE claimant" and becomes eligible for the fallback path.

## Schema Changes

```prisma
model Competition {
  // … existing fields …
  isPublic           Boolean @default(false)
  publicSlug         String?
  publicPasswordHash String?  // bcrypt hash, null = no password protection

  // No @unique on publicSlug — see partial index in migration
}
```

The partial unique index is added as raw SQL in the migration body.

## Password Protection (optional)

A public competition can carry an optional shared password. When set, the public PDF route enforces HTTP Basic Auth before serving:

- **Storage:** `publicPasswordHash` is a bcrypt hash with cost factor 12 (matches the existing convention in `src/lib/users/actions.ts`). Plaintext password is never stored or logged.
- **Single shared password** per competition — there is no concept of multiple credentials, no usernames. Username field in the Basic Auth dialog is ignored.
- **Setting/changing:** in the edit form, an optional "Passwort (optional)" text input. Behaviour:
  - Empty input + no existing hash → no protection
  - Empty input + existing hash → keep the existing password (do not overwrite)
  - Non-empty input → set/replace the hash
  - Separate checkbox "Passwort entfernen" → clears the hash on save
- **Visibility cue:** the form shows a static hint "Passwort ist gesetzt" when a hash exists (the plaintext is never readable).
- **Realm:** `WWW-Authenticate: Basic realm="<competition.name>", charset="UTF-8"` so the browser dialog includes the competition name.
- **Failure mode:** missing or wrong credentials → HTTP 401 with the same `WWW-Authenticate` header (browser reprompts). Never reveals whether the slug exists, the password is wrong, or the competition is unpublished — all conditions look identical from the outside.

## UI Changes

### Edit form (`/competitions/[id]/edit`)

A new section after the existing "Allgemein" fields:

- **Switch** "Auf Vereins-Website veröffentlichen" — bound to `isPublic`
- When switch is on, a **slug input** appears:
  - Pre-filled from name on first toggle, retained from previous publish otherwise
  - Inline validation (regex, length)
  - Live URL preview below the field: `…/api/public/c/<slug>/pdf`
  - Helper text when slug differs from stored value: "Hinweis: Die bestehende öffentliche URL wird ungültig."
  - Helper text when the slug is currently held by another ACTIVE competition (server-side check on submit): the error message from the action
- When switch is on, a **password section** appears below the slug:
  - Text input `type="password"`, name `publicPassword`, optional
  - When the competition already has a `publicPasswordHash`: static hint "Passwort ist gesetzt. Leer lassen, um es beizubehalten."
  - When no hash exists: hint "Optional — leer lassen für ungeschützten Zugriff."
  - Checkbox "Passwort entfernen" — only visible when a hash exists. When checked, server clears the hash regardless of the password input.
  - Minimum password length when set: 4 characters (low bar — this is a shared website password, not user login)

The switch, slug input, and password section follow existing form patterns in the file — no new component library work.

### New competition form (`/competitions/new`)

Same fields as the edit form, off by default. Most new competitions will start as DRAFT, so the active-claim conflict is rare at create time — but the check still runs if the user creates a competition directly as ACTIVE with `isPublic = true`.

### Public marker in lists

A small badge "Öffentlich" next to the competition name on the competitions list page when `isPublic = true`, so admins can tell at a glance which competitions are exposed. No badge on archived competitions (since they no longer hold the active claim — showing the badge would be misleading).

## Caching & Invalidation

### Caching strategy

The public route uses `dynamic = "force-dynamic"` (so the auth check runs on every request) combined with `unstable_cache` from `next/cache` for the expensive PDF render step:

```ts
// src/app/api/public/c/[slug]/pdf/route.ts
export const dynamic = "force-dynamic"

const getCachedPdfBuffer = unstable_cache(
  async (competitionId: string, phaseTag: string) => buildPdfBuffer(competitionId, phaseTag),
  ["public-pdf"],
  { revalidate: 86400, tags: [`public-pdf:${slug}`] }
)
```

- **Auth check fresh on every request:** ensures password-protected PDFs are never served from cache to unauthenticated clients
- **PDF buffer cached 24h** per `(competitionId, phaseTag)` key — `phaseTag` is `"schedule" | "playoffs" | "ranking" | "standings"` so Liga phase transitions naturally produce different cache entries
- **No cron, no disk** — same as before
- **First-request latency** after cache expiry: ~1–2 seconds (PDF render). Subsequent requests inside 24h: the auth check + cache lookup is sub-100ms.

### Manual invalidation

`revalidateTag('public-pdf:<slug>')` is called from any server action that can change which PDF should be served under a slug. The tag-based approach evicts the cached buffers for that slug regardless of phase.

| Action                    | When                                                |
| ------------------------- | --------------------------------------------------- |
| `updateCompetition`       | After save, if `isPublic`, slug or name changed     |
| `updateCompetitionStatus` | After save, if competition has `isPublic = true`    |
| `startPlayoffs`           | After Playoffs start (Liga URL must switch PDF)     |
| `forceDeleteCompetition`  | After delete, if the deleted competition had a slug |

For actions like `enterResult`, `addEventSeries`, `addSeasonSeries` — these can change the contents of the PDF but not which competition the slug points at. We accept up to 24h staleness here; otherwise we'd be invalidating on every result entry, defeating the cache. This trade-off is consistent with the "täglich aktualisiert reicht" requirement.

For affected slugs, both the _previously_ and the _newly_ responsible slugs get their tags revalidated when applicable (e.g. on slug edit, both old and new tag get evicted). The password change does NOT require cache invalidation because the auth check runs on every request, not from cache.

## Auth and Security

- `proxy.ts` matcher does **not** match `/api/public/*` — verify during implementation that the existing matcher list excludes this prefix
- Route is unauthenticated by design
- Server-side check inside the route: 404 if no competition resolves; never expose details about _why_ a slug 404s
- Slug regex prevents path traversal or weird characters; Prisma parameter binding prevents injection
- Password check (when enabled): bcrypt `compare` on every request — constant-time within bcrypt's implementation; protects against timing-leak password discovery
- Response headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="<slug>.pdf"`
  - `Cache-Control: private, max-age=0, must-revalidate` for the public route response — the response body itself must NOT be cached by intermediaries because each request needs to revalidate the password. Internal `unstable_cache` handles the expensive PDF render.
  - On 401: `WWW-Authenticate: Basic realm="<competition.name>", charset="UTF-8"`

## Components Touched / Added

| Path                                                          | Change                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `prisma/schema.prisma`                                        | + `isPublic`, `publicSlug`, `publicPasswordHash`                     |
| `prisma/migrations/<timestamp>_add_competition_public_slug/…` | new migration with partial unique index                              |
| `src/app/api/public/c/[slug]/pdf/route.ts`                    | new route handler                                                    |
| `src/lib/competitions/publicSlug.ts`                          | new: `slugify(name)`, `resolveSlug(slug)`, conflict check            |
| `src/lib/competitions/publicSlug.test.ts`                     | new: slug generation + resolution test cases                         |
| `src/lib/competitions/actions.ts`                             | extend update/status actions with slug validation + `revalidatePath` |
| `src/lib/competitions/types.ts`                               | include `isPublic`, `publicSlug` in returned shapes                  |
| `src/lib/competitions/queries.ts`                             | include new fields in selects                                        |
| `src/components/app/competitions/CompetitionForm.tsx`         | add publish switch + slug input                                      |
| `src/app/(app)/competitions/page.tsx`                         | "Öffentlich" badge on the competition card/row                       |
| `.claude/docs/features.md`                                    | document the public PDF feature                                      |
| `.claude/docs/architecture.md`                                | add `/api/public/c/[slug]/pdf` route to the routes list              |

## Test Plan

**Unit tests (`publicSlug.test.ts`):**

- `slugify("Jahrespreisschiessen 2026")` → `"jahrespreisschiessen-2026"`
- `slugify("Schützenmeister-Pokal")` → `"schuetzenmeister-pokal"`
- Slug regex rejects empty, too short, leading/trailing dashes, non-ASCII
- `resolveSlug` returns ACTIVE claimant when present
- `resolveSlug` returns most-recent COMPLETED/ARCHIVED fallback when no ACTIVE claimant
- `resolveSlug` returns null when no match
- `resolveSlug` ignores `isPublic = false` rows even with matching slug

**Action tests (`actions.test.ts` additions):**

- Setting `isPublic = true` on a new competition succeeds; slug is stored
- Conflicting slug on a second ACTIVE+isPublic competition returns the German error message; nothing is saved
- Setting `isPublic = false` releases the slug for reuse by another competition
- Status transition COMPLETED → ACTIVE while another ACTIVE+isPublic holds the slug returns the same error

**Route handler tests** (if existing PDF routes have integration tests; otherwise rely on manual verification):

- 404 when slug does not exist
- 404 when slug exists but `isPublic = false`
- 200 + correct PDF when ACTIVE claimant exists
- 200 + correct PDF when only archived holder exists
- LEAGUE without playoffs → SchedulePdf
- LEAGUE with playoffs → PlayoffsPdf

**Action tests (additional):**

- `updateCompetition` with `publicPassword = "abc1"` stores a bcrypt hash, not plaintext
- `updateCompetition` with empty `publicPassword` and existing hash → hash is preserved
- `updateCompetition` with `removePublicPassword = true` → hash is cleared
- Password shorter than 4 chars is rejected

**Route handler tests (password):**

- Competition with password + no `Authorization` header → 401 with `WWW-Authenticate: Basic`
- Wrong password → 401
- Correct password → 200 + PDF
- Password removed after being set → URL works without auth

**Manual verification:**

- Create a Jahrespreisschiessen 2026 SEASON, mark public, copy URL, open anonymously → PDF loads
- Archive it, create Jahrespreisschiessen 2027 with same slug → same URL now shows 2027
- Archive 2027 too → URL shows 2027 (most recent fallback)
- Start a Liga, publish, check URL → Spielplan PDF
- Start Playoffs → URL switches to Playoffs PDF (after cache invalidation)
- Set password on a public competition → browser shows Basic Auth dialog on URL access; correct password loads PDF; wrong password reprompts; cancel shows empty page

## Open Questions / Decisions

None remaining — design closed pending plan-writing.
