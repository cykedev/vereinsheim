# Öffentliches PDF: Cache-Tag aus der Wettbewerbs-ID statt aus dem Slug

**App:** ringwerk (treffsicher nicht betroffen — kein `public-pdf`-Tag dort)
**Branch:** `feat/public-pdf-cache-tag-by-id`
**Incident:** [[public-pdf-cache-tag-orphaning]] (Abschnitt „Offen" wird hiermit aufgelöst)

## 1. Context (warum)

Die öffentliche PDF-Route cacht den Render via `unstable_cache` mit dem **Key**
`["public-pdf-buffer", competitionId, phaseTag]`, aber dem **Tag** `public-pdf:${slug}`
(`apps/ringwerk/src/app/api/public/c/[slug]/pdf/route.ts:133`). Key und Tag hängen damit an
zwei verschiedenen Identitäten: die eine unveränderlich, die andere umbenennbar.

Wird der Slug umbenannt, bildet der neue Slug einen anderen Tag — der bestehende Cache-Eintrag
liegt weiter unter dem alten Key mit dem alten Tag und ist **nicht mehr invalidierbar**.
`update.ts:200-205` mildert das nur, weil es konservativ alten *und* neuen Slug revalidiert; jeder
Schreibpfad, der den Slug nicht kennt (und jede Änderung an den Daten *nach* der Umbenennung),
greift ins Leere.

Der Tag wird deshalb aus der **Wettbewerbs-ID** gebildet — derselben Identität wie der Key. Damit
kann eine Umbenennung strukturell nichts verwaisen lassen, und
`revalidatePublicSlugForCompetition` (das den Slug erst per DB-Query auflöst) entfällt komplett:
alle 11 Aufrufer haben die `competitionId` bereits zur Hand.

## 2. Approach

### 2.1 Neues Modul statt `_shared.ts`

Der Tag-Builder wandert aus `lib/competitions/actions/_shared.ts` in ein eigenes kleines Modul
**`apps/ringwerk/src/lib/competitions/publicPdfCache.ts`**. Grund: `_shared.ts` zieht `db` und
`zod`/`BaseSchema` mit; die öffentliche Route braucht für einen String-Helper keine davon. Das
Muster gibt es im Ordner schon (`publicSlug.ts` pur ↔ `publicSlugQueries.ts` DB-behaftet).

```ts
// apps/ringwerk/src/lib/competitions/publicPdfCache.ts
import { revalidateTag } from "next/cache"

/**
 * Cache-Tag des gerenderten öffentlichen PDFs. Bewusst aus der **unveränderlichen**
 * Wettbewerbs-ID gebildet, nicht aus dem umbenennbaren `publicSlug` — sonst verwaist der
 * Eintrag bei einer Umbenennung unter dem alten Tag und ist nicht mehr invalidierbar
 * (siehe vault/incidents/public-pdf-cache-tag-orphaning.md).
 */
export function publicPdfCacheTag(competitionId: string): string {
  return `public-pdf:${competitionId}`
}

/**
 * Invalidiert das gecachte öffentliche PDF eines Wettbewerbs.
 *
 * Aus jeder schreibenden Action aufrufen, die Daten im öffentlichen PDF verändert — Ergebnisse,
 * Serien, Playoff-Duelle, Teilnehmer-Ein-/Austritt, Slug-/Status-Wechsel. Der 24h-Render-Cache
 * bleibt, wird aber bei jeder relevanten Änderung sofort verworfen; anonyme Leser sehen
 * höchstens bis zur nächsten mutierenden Action einen alten Stand.
 *
 * Kein `isPublic`-Gate nötig: existiert kein Eintrag unter dem Tag, ist der Aufruf ein No-op.
 * Genau dafür ist die alte DB-Auflösung (`revalidatePublicSlugForCompetition`) entfallen.
 */
export function revalidatePublicPdf(competitionId: string): void {
  // "max"-Profil: alle Einträge mit diesem Tag sofort verwerfen
  revalidateTag(publicPdfCacheTag(competitionId), "max")
}
```

### 2.2 Cache-Key mitziehen (Deploy-Migration)

Next speichert die Tags **mit dem Cache-Eintrag**. Nach dem Deploy liegen die bestehenden
Einträge unter unverändertem Key, tragen aber noch den alten Slug-Tag — ein
`revalidateTag("public-pdf:<id>")` würde sie bis zu 24 h nicht treffen. Deshalb wird die
Key-Präfix-Konstante einmalig mitgezogen: `"public-pdf-buffer"` → `"public-pdf-buffer-v2"`.
Danach entstehen alle Einträge unter dem neuen Tag.

### 2.3 `revalidatePath` ist **nicht** zusätzlich nötig

Die Route setzt `export const dynamic = "force-dynamic"` (`route.ts:32`), damit die
Passwortprüfung pro Request läuft. Es gibt folglich keinen Full-Route-/ISR-Cache über
`/api/public/c/[slug]/pdf` — der einzige Cache ist das `unstable_cache` im Inneren, und der Tag
deckt ihn vollständig ab. Ein `revalidatePath` über den Slug-Pfad wäre wirkungslos und wird
nicht ergänzt. (Der Response trägt zusätzlich `Cache-Control: private, max-age=0,
must-revalidate`.) — Diese Prüfung ist Teil des Auftrags und hier mit Begründung beantwortet.

### 2.4 Die drei Pfad-Wrapper werden synchron

`revalidatePublicSlugForCompetition` war die **einzige** asynchrone Zeile in
`revalidateEventPaths`, `revalidateSeasonPaths` und `revalidateCompetitionParticipantPaths`. Sie
werden zu `void`-Funktionen; die 13 Aufrufstellen verlieren ihr `await`. (Kein Lint-Risiko:
`require-await`/`await-thenable` sind in `@vereinsheim/config` nicht aktiv — der Umbau erfolgt
trotzdem, weil ein `async` ohne `await` totes Zeremoniell wäre.)

## 3. Files to change

| Datei | Änderung |
| --- | --- |
| `apps/ringwerk/src/lib/competitions/publicPdfCache.ts` | **neu** — `publicPdfCacheTag(competitionId)` + `revalidatePublicPdf(competitionId)` |
| `apps/ringwerk/src/lib/competitions/publicPdfCache.test.ts` | **neu** — Tag aus ID, stabil über Slug-Umbenennung |
| `apps/ringwerk/src/lib/competitions/actions/_shared.ts` | `publicPdfCacheTag`, `revalidatePublicSlug`, `revalidatePublicSlugForCompetition` **entfernen**; `revalidateTag`- und `db`-Import prüfen/aufräumen |
| `apps/ringwerk/src/app/api/public/c/[slug]/pdf/route.ts` | `tags: [publicPdfCacheTag(competitionId)]`, Key-Präfix `-v2`, Parameter `slug` aus `renderPdfBuffer` entfernen, Kommentarblock nachziehen |
| `apps/ringwerk/src/app/api/public/c/[slug]/pdf/route.test.ts` | `unstable_cache`-Mock erfasst Key + Options; zwei neue Fälle |
| `apps/ringwerk/src/lib/competitions/actions/create.ts` | `revalidatePublicSlug(parsed.data.publicSlug)` → `revalidatePublicPdf(competition.id)` |
| `apps/ringwerk/src/lib/competitions/actions/update.ts` | Slug-Set-Logik ersetzen durch `revalidatePublicPdf(id)` |
| `apps/ringwerk/src/lib/competitions/actions/setStatus.ts` | → `revalidatePublicPdf(id)` |
| `apps/ringwerk/src/lib/playoffs/actions/start.ts` | → `revalidatePublicPdf(competitionId)` |
| `apps/ringwerk/src/lib/playoffs/actions/{match,saveDuel,deleteDuel}.ts` | `await revalidatePublicSlugForCompetition(x)` → `revalidatePublicPdf(x)` |
| `apps/ringwerk/src/lib/results/actions.ts` | dito |
| `apps/ringwerk/src/lib/results/bestOf/{saveBestOfDuel,saveStechschuss,deleteLatestBestOfDuel}.ts` | dito |
| `apps/ringwerk/src/lib/series/_shared.ts` | Wrapper synchron, `db`-Import prüfen |
| `apps/ringwerk/src/lib/competitionParticipants/_shared.ts` | Wrapper synchron |
| `apps/ringwerk/src/lib/series/{eventSeries,saveSeasonSeries,updateSeasonSeries,deleteSeasonSeries}.ts` | `await` an den Wrappern entfernen (6 Stellen) |
| `apps/ringwerk/src/lib/competitionParticipants/{updateMeta,withdraw,enroll,unenroll}.ts` | dito (7 Stellen) |
| `apps/ringwerk/src/lib/results/actions.test.ts`, `.../bestOfActions.test.ts` | tote `competitionFindUniqueMock`-Defaults entfernen |
| `vault/incidents/public-pdf-cache-tag-orphaning.md` | „Offen" → gelöst, mit Datum + Verweis |
| `vault/apps/ringwerk/pdf-public-urls.md` | TL;DR: „tagged by slug" → „tagged by competition id" |

## Required Docs

Der Implementierer liest **vorab**:

- `vault/incidents/public-pdf-cache-tag-orphaning.md` — der Befund, inkl. der Prüf-Falle (SQL)
- `vault/apps/ringwerk/pdf-public-urls.md` — das betroffene Subsystem
- `vault/conventions.md` §6 (ActionResult-Kanon), §8 (Quality-Gates: alle fünf grün, `next build`
  ist bei Änderungen an Server Actions Pflicht)
- `vault/apps/ringwerk/ringwerk-code-conventions.md` — insbesondere die Prüf-Regel „über die
  Action oder die `no-store`-Route verifizieren, nicht per SQL"

## 4. Tasks (bite-sized, je ein Commit)

### Task 1 — Modul + Unit-Test

1. `apps/ringwerk/src/lib/competitions/publicPdfCache.ts` mit dem Code aus §2.1 anlegen.
2. `apps/ringwerk/src/lib/competitions/publicPdfCache.test.ts` anlegen:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest"

const { revalidateTagMock } = vi.hoisted(() => ({ revalidateTagMock: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: revalidateTagMock }))

import { publicPdfCacheTag, revalidatePublicPdf } from "./publicPdfCache"

describe("publicPdfCacheTag", () => {
  beforeEach(() => vi.resetAllMocks())

  it("bildet den Tag aus der Wettbewerbs-ID", () => {
    expect(publicPdfCacheTag("cmp_123")).toBe("public-pdf:cmp_123")
  })

  it("bleibt über eine Slug-Umbenennung hinweg identisch", () => {
    // Der Slug ist kein Eingabewert mehr — dieselbe ID, egal wie der Wettbewerb heißt.
    const before = publicPdfCacheTag("cmp_123")
    const after = publicPdfCacheTag("cmp_123")
    expect(after).toBe(before)
  })

  it("trennt verschiedene Wettbewerbe", () => {
    expect(publicPdfCacheTag("a")).not.toBe(publicPdfCacheTag("b"))
  })
})

describe("revalidatePublicPdf", () => {
  beforeEach(() => vi.resetAllMocks())

  it("verwirft den Eintrag der ID mit dem max-Profil", () => {
    revalidatePublicPdf("cmp_123")
    expect(revalidateTagMock).toHaveBeenCalledWith("public-pdf:cmp_123", "max")
  })

  it("braucht kein isPublic-Gate — kein DB-Zugriff", async () => {
    // Das Modul importiert @/lib/db nicht; ein Import-Fehler wäre hier sichtbar.
    const mod = await import("./publicPdfCache")
    expect(Object.keys(mod).sort()).toEqual(["publicPdfCacheTag", "revalidatePublicPdf"])
  })
})
```

3. Gate: `pnpm --filter ringwerk test -- publicPdfCache`

### Task 2 — Route auf den ID-Tag umstellen

1. Import ergänzen: `import { publicPdfCacheTag } from "@/lib/competitions/publicPdfCache"`.
2. `renderPdfBuffer` verliert den `slug`-Parameter:

```ts
async function renderPdfBuffer(competitionId: string, phaseTag: PhaseTag): Promise<Buffer> {
  const cached = unstable_cache(
    async () => {
      const buf = await buildAndRenderBuffer(competitionId, phaseTag)
      return buf.toString("base64")
    },
    // "-v2": Key einmalig mitgezogen, damit nach dem Deploy keine Einträge mit dem alten
    // Slug-Tag überleben (Next speichert die Tags mit dem Eintrag).
    ["public-pdf-buffer-v2", competitionId, phaseTag],
    { revalidate: 86400, tags: [publicPdfCacheTag(competitionId)] }
  )
  const b64 = await cached()
  return Buffer.from(b64, "base64")
}
```

3. Aufruf in `GET` anpassen: `await renderPdfBuffer(competition.id, phaseTag)`.
4. Kommentarblock über der Funktion (`route.ts:115-120`) korrigieren: „Tagged so server actions
   can revalidate per slug" → „Tagged by competition id — the slug is renamable, the id is not
   (see vault/incidents/public-pdf-cache-tag-orphaning.md)."
5. `slug` bleibt im `GET` in Gebrauch (SLUG_REGEX, `resolveSlug`, `Content-Disposition`) — nichts
   entfernen.
6. Gates: `pnpm --filter ringwerk exec tsc --noEmit`, `pnpm --filter ringwerk lint`

### Task 3 — Route-Test: der Tag kommt aus der ID

Der `next/cache`-Mock in `route.test.ts:54-58` verwirft Key und Options. Er erfasst sie künftig:

```ts
// unstable_cache: identity wrapper so the inner function is invoked directly per request.
// Key + options werden mitgeschrieben, damit Tests den Cache-Tag prüfen können.
const { cacheCalls } = vi.hoisted(() => ({
  cacheCalls: [] as { keyParts: unknown; options: { tags?: string[] } | undefined }[],
}))
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(
    fn: T,
    keyParts?: unknown,
    options?: { tags?: string[] }
  ) => {
    cacheCalls.push({ keyParts, options })
    return fn
  },
}))
```

`cacheCalls.length = 0` in das bestehende `beforeEach` aufnehmen (neben `vi.resetAllMocks()` —
`resetAllMocks` räumt das Array nicht auf). Dann zwei Fälle in der Describe-Gruppe zum Caching:

```ts
it("taggt den Render-Cache mit der Wettbewerbs-ID, nicht mit dem Slug", async () => {
  resolveSlugMock.mockResolvedValue({ ...baseCompetition, publicSlug: "alter-slug" })
  await GET(makeRequest(), { params: Promise.resolve({ slug: "alter-slug" }) })

  expect(cacheCalls).toHaveLength(1)
  expect(cacheCalls[0].options?.tags).toEqual(["public-pdf:comp1"])
  expect(cacheCalls[0].options?.tags?.[0]).not.toContain("alter-slug")
})

it("bleibt nach einer Slug-Umbenennung unter demselben Tag invalidierbar", async () => {
  // Derselbe Wettbewerb, neuer Slug — der Tag darf sich nicht ändern, sonst verwaist
  // der Eintrag unter dem alten Tag (public-pdf-cache-tag-orphaning).
  resolveSlugMock.mockResolvedValue({ ...baseCompetition, publicSlug: "alter-slug" })
  await GET(makeRequest(), { params: Promise.resolve({ slug: "alter-slug" }) })

  resolveSlugMock.mockResolvedValue({ ...baseCompetition, publicSlug: "neuer-slug" })
  await GET(makeRequest(), { params: Promise.resolve({ slug: "neuer-slug" }) })

  expect(cacheCalls).toHaveLength(2)
  expect(cacheCalls[1].options?.tags).toEqual(cacheCalls[0].options?.tags)
  // Auch der Key hängt an der ID — Key und Tag teilen dieselbe Identität.
  expect(cacheCalls[1].keyParts).toEqual(cacheCalls[0].keyParts)
})
```

Hinweis für den Implementierer: `baseCompetition` (`route.test.ts:85`) hat kein `publicSlug`-Feld
— die Route liest es nicht. Es wird in den beiden Fällen nur zur Lesbarkeit mitgegeben; wenn
`resolveSlug`s Rückgabetyp das nicht zulässt, den Spread weglassen und `baseCompetition` direkt
verwenden (die Slug-Variation steckt dann allein im `params`).

Gate: `pnpm --filter ringwerk test -- pdf/route`

### Task 4 — `_shared.ts` aufräumen + alle Aufrufer nachziehen

1. `apps/ringwerk/src/lib/competitions/actions/_shared.ts`: `publicPdfCacheTag`,
   `revalidatePublicSlug` und `revalidatePublicSlugForCompetition` löschen. Danach ist
   `revalidateTag` unbenutzt (Import auf `revalidatePath` reduzieren) und `db` unbenutzt
   (Import löschen) — mit `pnpm --filter ringwerk lint` (`no-unused-vars` = error) bestätigen.
2. `create.ts:162`: der Block

```ts
if (parsed.data.isPublic && parsed.data.publicSlug) {
  revalidatePublicSlug(parsed.data.publicSlug)
}
```

wird zu `revalidatePublicPdf(competition.id)` — ohne Gate, weil bei einem gerade erzeugten
Wettbewerb ohnehin kein Eintrag existiert und der Aufruf damit ein No-op ist. Import in
`create.ts:9` entsprechend aufteilen.

3. `update.ts:200-205`: der Set-Umweg über alten/neuen Slug entfällt vollständig:

```ts
// Der Tag hängt an der ID, nicht am Slug — eine Umbenennung kann nichts verwaisen lassen.
revalidatePublicPdf(id)
```

4. `setStatus.ts:67-70`: `if (competition.publicSlug) { revalidatePublicSlug(...) }` →
   `revalidatePublicPdf(id)` (Gate entfällt, s.o.).
5. `playoffs/actions/start.ts:94`: `revalidatePublicSlug(competition.publicSlug)` →
   `revalidatePublicPdf(competitionId)`. Prüfen, ob `publicSlug` danach noch im `select` der
   Query (`start.ts:26`) gebraucht wird — wenn nicht, aus dem `select` entfernen.
6. Die 11 `await revalidatePublicSlugForCompetition(x)`-Stellen (siehe §3) zu
   `revalidatePublicPdf(x)`, Imports auf `@/lib/competitions/publicPdfCache` umstellen.
7. Die drei Wrapper synchron machen:

```ts
// series/_shared.ts
export function revalidateEventPaths(competitionId: string): void {
  revalidatePath(`/competitions/${competitionId}/series`)
  revalidatePath(`/competitions/${competitionId}/ranking`)
  revalidatePublicPdf(competitionId)
}
export function revalidateSeasonPaths(competitionId: string): void { /* analog, /standings */ }

// competitionParticipants/_shared.ts
export function revalidateCompetitionParticipantPaths(competitionId: string): void {
  revalidatePath(`/competitions/${competitionId}/participants`)
  revalidatePath("/competitions")
  revalidatePublicPdf(competitionId)
}
```

8. Die 13 `await`s an diesen Wrappern entfernen (Dateien in §3).
9. Tote Test-Doubles: in `results/actions.test.ts:89-90` und `results/bestOfActions.test.ts`
   (5 Stellen) existierte `competitionFindUniqueMock` **nur** für die DB-Auflösung in
   `revalidatePublicSlugForCompetition` — `db.competition.findUnique` wird in `src/lib/results/*`
   sonst nicht aufgerufen. Defaults + Kommentar entfernen und, wenn danach keine Verwendung
   bleibt, `competitionFindUniqueMock` samt `competition: { findUnique: … }` aus dem `db`-Mock
   löschen. Vorher pro Datei mit `grep -n competitionFindUnique` gegenprüfen; die Tests müssen
   grün bleiben.
10. Gate: `/check` für ringwerk (alle fünf).

### Task 5 — Vault nachziehen

1. `vault/incidents/public-pdf-cache-tag-orphaning.md`: den Abschnitt „Offen (Empfehlung, nicht
   umgesetzt)" ersetzen durch einen Abschnitt „**Behoben** (2026-09-09)": Tag kommt aus
   `publicPdfCacheTag(competitionId)` in `lib/competitions/publicPdfCache.ts`,
   `revalidatePublicSlug`/`revalidatePublicSlugForCompetition` sind zu
   `revalidatePublicPdf(competitionId)` verschmolzen, Key auf `-v2` gezogen. Punkt 1 des Befunds
   (SQL invalidiert nichts) bleibt gültig und bleibt stehen — das ist eine Eigenschaft des
   Cachings, keine Regression. Frontmatter: `keywords` um `publicPdfCache`,
   `revalidatePublicPdf` ergänzen, `relates_to` um `[[ringwerk-code-conventions]]`.
2. `vault/apps/ringwerk/pdf-public-urls.md`: TL;DR „24h-Cache (tagged by slug)" →
   „24h-Cache (tagged by competition id, nicht am Slug — Umbenennung kann nicht verwaisen)";
   `keywords` um `publicPdfCache`/`revalidatePublicPdf` ergänzen.
3. `/sync-graph` laufen lassen (`vault-lint` muss grün sein — der Stop-Hook blockt sonst).

## 5. Verification

Automatisiert:

1. `/check` für ringwerk — alle fünf Gates grün (`lint`, `format:check`, `test`, `tsc`,
   `next build`). `next build` ist hier Pflicht: es werden Server Actions angefasst.
2. `grep -rn "revalidatePublicSlug\|public-pdf:\${slug}\|publicPdfCacheTag(slug" apps/ringwerk/src`
   → **keine** Treffer.
3. `grep -rn "public-pdf-buffer\"" apps/ringwerk/src` → keine Treffer (nur `-v2`).

Manuell — **über die Server-Action, nicht per SQL** (hier lag der eigentliche Stolperstein des
Incidents: eine SQL-Änderung umgeht die Invalidierung, das PDF bleibt bis zu 24 h alt und man
misstraut dann dem Feature statt der Prüfmethode):

4. Dev-Postgres läuft (`docker compose -f docker-compose.dev.yml up -d`), `pnpm dev`.
5. Einen SEASON- oder EVENT-Wettbewerb im UI veröffentlichen (`isPublic` + Slug, z.B.
   `probe-alt`), `/api/public/c/probe-alt/pdf` abrufen → PDF wird gerendert und gecacht.
6. **Über das Bearbeiten-Formular** den Slug auf `probe-neu` umbenennen (Server Action
   `updateCompetition`). `/api/public/c/probe-neu/pdf` abrufen → PDF kommt.
7. Jetzt **über das UI** eine im PDF sichtbare Datenänderung fahren (eine Serie eintragen bzw.
   ein Ergebnis speichern — Server Action, nicht `psql`).
8. `/api/public/c/probe-neu/pdf` erneut abrufen → das PDF enthält die neue Zeile **sofort**.
   Vor diesem Change war genau das der Fehlerfall: der Eintrag hing noch am Tag von `probe-alt`
   und die Invalidierung über den neuen Slug traf ihn nicht.
9. Gegenprobe, dass die Prüfmethode selbst trägt: dieselbe Änderung per `psql` machen und
   erneut abrufen → das PDF bleibt erwartungsgemäß alt. Das ist **kein** Bug, sondern die in
   `ringwerk-code-conventions` festgehaltene Regel.

## 6. Scope-Grenzen

- **Kein** `revalidatePath` über den Slug-Pfad (Begründung §2.3).
- Punkt 1 des Incidents (SQL umgeht die Invalidierung) wird **nicht** „behoben" — das ist
  inhärent an `unstable_cache` und bleibt als Prüf-Regel dokumentiert.
- Kein Umbau des 24h-`revalidate`-Fensters, keine Änderung an Auth/Passwortprüfung, keine
  Änderung am `Cache-Control`-Header.
- treffsicher bleibt unberührt.
