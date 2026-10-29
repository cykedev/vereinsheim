import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

// Der Test über alle Server Actions: Jede Fassade mit "use server" steht in `coverage-table.ts` mit jeder exportierten
// Funktion und ihrer Entscheidung für ein umgezogenes Konto. Eine neue Action ohne Eintrag macht den Test rot.

const h = vi.hoisted(() => {
  const internal: Record<string, ReturnType<typeof vi.fn>> = {}
  const pick = (names: string[]) =>
    Object.fromEntries(
      names.map((name) => [name, (internal[name] = vi.fn(async () => ({ success: true })))])
    )
  /** Disziplinen nach `where.id` wie Prisma: eine der Anlage, eine eigene, sonst keine */
  const disciplines: Record<string, { isSystem: boolean }> = {
    "system-1": { isSystem: true },
    "own-1": { isSystem: false },
  }
  const writes: Array<ReturnType<typeof vi.fn>> = []
  const write = () => {
    const spy = vi.fn(async () => ({}))
    writes.push(spy)
    return spy
  }
  const model = (name: string) => ({
    findUnique: vi.fn(async (args?: { where?: { id?: unknown } }) =>
      name === "discipline" ? (disciplines[String(args?.where?.id)] ?? null) : null
    ),
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    ...Object.fromEntries(
      ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"].map(
        (method) => [method, write()]
      )
    ),
  })
  const models: Record<string, ReturnType<typeof model>> = {}
  const db = new Proxy(
    { $transaction: write() },
    {
      get: (target, key: string) =>
        key in target ? target[key as "$transaction"] : (models[key] ??= model(key)),
    }
  )
  return { internal, pick, writes, db, getAuthSession: vi.fn() }
})

vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: h.getAuthSession }))
vi.mock("@/lib/db", () => ({ db: h.db }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async () => true), hash: vi.fn(async () => "hash") },
}))
vi.mock("@/lib/sessions/actions/sessionActions", () =>
  h.pick([
    "createSessionAction",
    "deleteSessionAction",
    "getSessionByIdAction",
    "getSessionsAction",
    "toggleFavouriteAction",
    "updateSessionAction",
  ])
)
vi.mock("@/lib/sessions/actions/meytonActions", () => h.pick(["previewMeytonImportAction"]))
vi.mock("@/lib/sessions/actions/attachmentActions", () =>
  h.pick(["uploadAttachmentAction", "deleteAttachmentAction"])
)
vi.mock("@/lib/sessions/actions/mentalActions", () =>
  h.pick([
    "saveFeedbackAction",
    "savePrognosisAction",
    "saveReflectionAction",
    "saveWellbeingAction",
  ])
)
vi.mock("@/lib/goals/actions/getGoals", () =>
  h.pick([
    "getGoalByIdAction",
    "getGoalsForSelectionAction",
    "getGoalsWithAssignmentsAction",
    "getGoalSessionOptionsAction",
  ])
)
vi.mock("@/lib/goals/actions/mutateGoals", () =>
  h.pick([
    "createGoalAction",
    "createGoalAndRedirectAction",
    "deleteGoalAction",
    "updateGoalAction",
    "updateGoalAssignmentsAction",
  ])
)
vi.mock("@/lib/disciplines/actions/favouriteDiscipline", () =>
  h.pick(["setFavouriteDisciplineAction"])
)
vi.mock("@/lib/disciplines/actions/getDisciplines", () =>
  h.pick([
    "getDisciplineByIdAction",
    "getDisciplineForDetailAction",
    "getDisciplineUsageAction",
    "getDisciplinesAction",
    "getDisciplinesForManagementAction",
    "getFavouriteDisciplineIdAction",
    "getHiddenDisciplineIdsAction",
  ])
)
vi.mock("@/lib/disciplines/actions/hideDiscipline", () => h.pick(["toggleHiddenDisciplineAction"]))
vi.mock("@/lib/disciplines/actions/mutateDiscipline", () =>
  h.pick([
    "archiveDisciplineAction",
    "createDisciplineAction",
    "deleteDisciplineAction",
    "setDisciplineArchivedAction",
    "updateDisciplineAction",
  ])
)
vi.mock("@/lib/admin/actions/getAdminSystemDisciplines", () =>
  h.pick(["getAdminSystemDisciplinesAction"])
)
vi.mock("@/lib/admin/actions/getAdminUsers", () =>
  h.pick(["getAdminUserByIdAction", "getAdminUsersAction"])
)
vi.mock("@/lib/admin/actions/loginRateLimit", () =>
  h.pick([
    "clearLoginRateLimitBucketAction",
    "getAdminBlockedLoginRateLimitBucketsAction",
    "getAdminLoginRateLimitInsightsAction",
  ])
)
vi.mock("@/lib/admin/actions/userMutations", () =>
  h.pick(["createUserAction", "setUserActiveAction", "updateUserAction"])
)

import * as account from "@/lib/account/actions"
import * as admin from "@/lib/admin/actions"
import * as disciplines from "@/lib/disciplines/actions"
import * as goals from "@/lib/goals/actions"
import * as sessions from "@/lib/sessions/actions"
import * as routines from "@/lib/shot-routines/actions"

import { WRITE_PATHS } from "./coverage-table"
import { MOVED_TEXTS } from "./texts"

const MODULES: Record<string, Record<string, unknown>> = {
  "lib/sessions/actions.ts": sessions,
  "lib/goals/actions.ts": goals,
  "lib/shot-routines/actions.ts": routines,
  "lib/disciplines/actions.ts": disciplines,
  "lib/admin/actions.ts": admin,
  "lib/account/actions.ts": account,
}

const FACADES = Object.entries(WRITE_PATHS).map(([file, table]) => ({
  file,
  table,
  module: MODULES[file] ?? {},
}))

const SRC = join(__dirname, "../..")
const REFUSAL = { error: MOVED_TEXTS.refusal }

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return path.endsWith("src/generated") ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function signIn(moved: boolean, role: "USER" | "ADMIN" = "USER") {
  h.getAuthSession.mockResolvedValue({
    user: { id: "user-1", role, movedToSpiegel: moved, sessionVersion: 0 },
  })
}

function call(fn: (...args: unknown[]) => unknown, first?: unknown): Promise<unknown> {
  const args: unknown[] = Array.from({ length: Math.max(fn.length, 1) }, () => new FormData())
  if (first !== undefined) args[0] = first
  return Promise.resolve(fn(...args)).catch((error: unknown) => error)
}

const ENTRIES = FACADES.flatMap(({ module, table }) =>
  Object.entries(table).map(([name, kind]) => ({
    name,
    kind,
    fn: module[name] as (...args: unknown[]) => unknown,
  }))
)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Schreibwege eines umgezogenen Kontos", () => {
  it('nur die sechs Fassaden tragen "use server"', () => {
    const files = sourceFiles(SRC).filter((path) =>
      /^\s*["']use server["']/m.test(readFileSync(path, "utf8"))
    )
    expect(files.map((path) => relative(SRC, path)).sort()).toEqual(
      FACADES.map((f) => f.file).sort()
    )
  })

  it.each(FACADES)(
    "$file: jede exportierte Funktion hat eine Entscheidung",
    ({ module, table }) => {
      const exported = Object.entries(module).filter(([, value]) => typeof value === "function")
      expect(exported.map(([name]) => name).sort()).toEqual(Object.keys(table).sort())
    }
  )

  it.each(ENTRIES.filter((e) => e.kind === "own"))(
    "$name: umgezogen abgelehnt, nichts geschrieben",
    async ({ name, fn }) => {
      signIn(true)
      const result = await call(fn)
      if (name === "createGoalAndRedirect") {
        expect(String(result)).toContain("REDIRECT:/goals/new")
      } else {
        expect(result).toEqual(REFUSAL)
      }
      expect(h.internal[`${name}Action`] ?? vi.fn()).not.toHaveBeenCalled()
      for (const spy of h.writes) expect(spy).not.toHaveBeenCalled()
    }
  )

  it.each(ENTRIES.filter((e) => e.kind === "own"))(
    "$name: nicht umgezogen läuft die Action",
    async ({ name, fn }) => {
      signIn(false)
      const result = await call(fn)
      expect(result).not.toEqual(REFUSAL)
      const inner = h.internal[`${name}Action`]
      if (inner) expect(inner).toHaveBeenCalledTimes(1)
    }
  )

  it.each(ENTRIES.filter((e) => e.kind === "read" || e.kind === "admin"))(
    "$name: bleibt auch umgezogen",
    async ({ name, fn }) => {
      signIn(true, "ADMIN")
      const result = await call(fn)
      expect(result).not.toEqual(REFUSAL)
      const inner = h.internal[`${name}Action`]
      if (inner) expect(inner).toHaveBeenCalledTimes(1)
    }
  )
})

describe("Disziplinen eines umgezogenen Kontos", () => {
  const form = (isSystem: boolean) => {
    const data = new FormData()
    data.set("isSystem", String(isSystem))
    return data
  }
  const BY_ID = ENTRIES.filter((e) => e.kind === "discipline" && e.name !== "createDiscipline")

  it.each([
    [false, "USER", false, true],
    [true, "USER", true, false],
    [true, "USER", false, false],
    [true, "ADMIN", true, true],
    [true, "ADMIN", false, false],
  ] as const)(
    "createDiscipline: umgezogen %s, %s, Disziplin der Anlage %s → erlaubt %s",
    async (moved, role, isSystem, allowed) => {
      signIn(moved, role)
      const result = await disciplines.createDiscipline(null, form(isSystem))
      expect(result).toEqual(allowed ? { success: true } : REFUSAL)
      expect(h.internal.createDisciplineAction).toHaveBeenCalledTimes(allowed ? 1 : 0)
    }
  )

  it.each(BY_ID)(
    "$name: Mitglied abgelehnt, Admin nur an der Disziplin der Anlage",
    async ({ name, fn }) => {
      const inner = h.internal[`${name}Action`]
      for (const [role, id, allowed] of [
        ["USER", "system-1", false],
        ["USER", "own-1", false],
        ["ADMIN", "system-1", true],
        ["ADMIN", "own-1", false],
      ] as const) {
        vi.clearAllMocks()
        signIn(true, role)
        const result = await call(fn, id)
        expect(result).toEqual(allowed ? { success: true } : REFUSAL)
        expect(inner).toHaveBeenCalledTimes(allowed ? 1 : 0)
      }
      vi.clearAllMocks()
      signIn(false)
      expect(await call(fn, "own-1")).toEqual({ success: true })
    }
  )
})
