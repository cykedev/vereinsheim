import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

// ─── Hoisted mocks ─────────────────────────────────────────────────────────
const {
  resolveSlugMock,
  hasPlayoffsStartedMock,
  getCompetitionByIdMock,
  getEventWithSeriesMock,
  getSeasonWithSeriesMock,
  getMatchupsForCompetitionMock,
  getStandingsForCompetitionMock,
  getPlayoffBracketMock,
  bcryptCompareMock,
  renderToBufferMock,
} = vi.hoisted(() => ({
  resolveSlugMock: vi.fn(),
  hasPlayoffsStartedMock: vi.fn(),
  getCompetitionByIdMock: vi.fn(),
  getEventWithSeriesMock: vi.fn(),
  getSeasonWithSeriesMock: vi.fn(),
  getMatchupsForCompetitionMock: vi.fn(),
  getStandingsForCompetitionMock: vi.fn(),
  getPlayoffBracketMock: vi.fn(),
  bcryptCompareMock: vi.fn(),
  renderToBufferMock: vi.fn(),
}))

vi.mock("@/lib/competitions/publicSlugQueries", () => ({
  resolveSlug: resolveSlugMock,
}))
vi.mock("@/lib/playoffs/queries", () => ({
  hasPlayoffsStarted: hasPlayoffsStartedMock,
  getPlayoffBracket: getPlayoffBracketMock,
}))
vi.mock("@/lib/competitions/queries", () => ({
  getCompetitionById: getCompetitionByIdMock,
  getEventWithSeries: getEventWithSeriesMock,
  getSeasonWithSeries: getSeasonWithSeriesMock,
}))
vi.mock("@/lib/matchups/queries", () => ({
  getMatchupsForCompetition: getMatchupsForCompetitionMock,
}))
vi.mock("@/lib/standings/queries", () => ({
  getStandingsForCompetition: getStandingsForCompetitionMock,
}))
vi.mock("bcryptjs", () => ({ default: { compare: bcryptCompareMock } }))
// Only override renderToBuffer — the PDF components transitively need StyleSheet, Document,
// View, Text, etc. from the real module.
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>()
  return { ...actual, renderToBuffer: renderToBufferMock }
})
// unstable_cache: identity wrapper so the inner function is invoked directly per request.
// Key parts and options are recorded so tests can assert on the cache tag.
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
// Stub the heavy ranking modules — they're imported but only their builder functions run,
// and those flow into renderToBuffer which is mocked.
vi.mock("@/lib/scoring/rankEventParticipants", () => ({
  rankEventParticipants: () => [],
  rankEventTeams: () => [],
}))
vi.mock("@/lib/scoring/calculateSeasonStandings", () => ({
  calculateSeasonStandings: () => [],
}))
vi.mock("@/lib/series/scoring-format", () => ({
  getEffectiveScoringType: () => "WHOLE",
}))

import { GET } from "./route"

// ─── Helpers ────────────────────────────────────────────────────────────────
// The route only reads `req.headers.get("authorization")` — a plain Request is sufficient
// behaviour-wise. We cast to NextRequest to satisfy the route signature.
function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers()
  if (authHeader) headers.set("authorization", authHeader)
  return new Request("https://example.com/api/public/c/slug/pdf", { headers }) as NextRequest
}

function basicAuth(password: string, user = ""): string {
  return `Basic ${Buffer.from(`${user}:${password}`, "utf-8").toString("base64")}`
}

const baseCompetition = {
  id: "comp1",
  name: "Test Competition",
  type: "EVENT" as const,
  publicPasswordHash: null as string | null,
}

const eventCompetitionWithSeries = {
  competition: {
    id: "comp1",
    name: "Test Event",
    scoringMode: "RINGS",
    targetValue: null,
    targetValueType: null,
    discipline: { id: "d1", name: "LP", teilerFaktor: { toNumber: () => 1.0 } },
    disciplineId: "d1",
    teamSize: null,
    teamScoring: null,
    shotsPerSeries: 10,
    eventDate: new Date("2026-05-01"),
  },
  series: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  cacheCalls.length = 0 // resetAllMocks does not touch the recorded cache calls
  renderToBufferMock.mockResolvedValue(Buffer.from("fake-pdf"))
  // Default builder query mocks return safe shapes for the EVENT path
  getEventWithSeriesMock.mockResolvedValue(eventCompetitionWithSeries)
  getSeasonWithSeriesMock.mockResolvedValue({
    competition: {
      id: "comp1",
      name: "Test Season",
      scoringMode: "RINGS",
      discipline: null,
      disciplineId: null,
      shotsPerSeries: 10,
      seasonStart: null,
      seasonEnd: null,
      minSeries: 20,
    },
    participants: [],
  })
  getCompetitionByIdMock.mockResolvedValue({
    id: "comp1",
    name: "Test League",
    scoringMode: "RINGTEILER",
    discipline: { name: "LP" },
    hinrundeDeadline: null,
    rueckrundeDeadline: null,
  })
  getStandingsForCompetitionMock.mockResolvedValue([])
  getMatchupsForCompetitionMock.mockResolvedValue([])
  getPlayoffBracketMock.mockResolvedValue([])
})

async function callRoute(slug: string, init?: { authHeader?: string }) {
  return GET(makeRequest(init?.authHeader), { params: Promise.resolve({ slug }) })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("public PDF route — slug resolution", () => {
  it("returns 404 for a malformed slug (does not hit DB)", async () => {
    const res = await callRoute("INVALID slug!!")
    expect(res.status).toBe(404)
    expect(resolveSlugMock).not.toHaveBeenCalled()
  })

  it("returns 404 when no competition holds the slug", async () => {
    resolveSlugMock.mockResolvedValue(null)
    const res = await callRoute("missing-slug")
    expect(res.status).toBe(404)
  })
})

describe("public PDF route — password protection", () => {
  it("returns 401 with WWW-Authenticate when password is set and no auth header", async () => {
    resolveSlugMock.mockResolvedValue({
      ...baseCompetition,
      publicPasswordHash: "hash",
    })
    const res = await callRoute("test-slug")
    expect(res.status).toBe(401)
    expect(res.headers.get("WWW-Authenticate")).toMatch(/^Basic realm="Test Competition"/)
  })

  it("returns 401 when password is wrong", async () => {
    resolveSlugMock.mockResolvedValue({
      ...baseCompetition,
      publicPasswordHash: "hash",
    })
    bcryptCompareMock.mockResolvedValue(false)
    const res = await callRoute("test-slug", { authHeader: basicAuth("wrong") })
    expect(res.status).toBe(401)
  })

  it("returns 200 PDF when password is correct", async () => {
    resolveSlugMock.mockResolvedValue({
      ...baseCompetition,
      publicPasswordHash: "hash",
    })
    bcryptCompareMock.mockResolvedValue(true)
    const res = await callRoute("test-slug", { authHeader: basicAuth("secret") })
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    expect(bcryptCompareMock).toHaveBeenCalledWith("secret", "hash")
  })

  it("escapes quotes and backslashes from the competition name in the realm parameter", async () => {
    resolveSlugMock.mockResolvedValue({
      ...baseCompetition,
      name: 'Tricky\\Name"Quote',
      publicPasswordHash: "hash",
    })
    const res = await callRoute("test-slug")
    const realm = res.headers.get("WWW-Authenticate") ?? ""
    expect(realm).not.toContain("\\")
    expect(realm).toContain('realm="TrickyNameQuote"')
  })
})

describe("public PDF route — Cache-Control", () => {
  it("sets 'private, max-age=0, must-revalidate' so the auth check runs per request", async () => {
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, publicPasswordHash: null })
    const res = await callRoute("test-slug")
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate")
  })
})

describe("public PDF route — render cache identity", () => {
  it("tags the render cache with the competition id, not with the slug", async () => {
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, publicPasswordHash: null })
    await callRoute("alter-slug")

    expect(cacheCalls).toHaveLength(1)
    expect(cacheCalls[0].options?.tags).toEqual(["public-pdf:comp1"])
    expect(cacheCalls[0].options?.tags?.[0]).not.toContain("alter-slug")
  })

  it("stays invalidatable under the same tag after a slug rename", async () => {
    // Same competition, new slug — the tag must not move, otherwise the entry orphans
    // under the old tag and no revalidateTag call can ever reach it again
    // (vault/incidents/public-pdf-cache-tag-orphaning.md).
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, publicPasswordHash: null })
    await callRoute("alter-slug")
    await callRoute("neuer-slug")

    expect(cacheCalls).toHaveLength(2)
    expect(cacheCalls[1].options?.tags).toEqual(cacheCalls[0].options?.tags)
    // The key hangs on the id too — key and tag share one identity.
    expect(cacheCalls[1].keyParts).toEqual(cacheCalls[0].keyParts)
  })

  it("separates the cache entries of the four PDF phases", async () => {
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, type: "EVENT" })
    await callRoute("test-slug")
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, type: "SEASON" })
    await callRoute("test-slug")

    expect(cacheCalls).toHaveLength(2)
    expect(cacheCalls[1].keyParts).not.toEqual(cacheCalls[0].keyParts)
    // ... but both hang on the one tag, so one revalidation clears every phase.
    expect(cacheCalls[1].options?.tags).toEqual(cacheCalls[0].options?.tags)
  })
})

describe("public PDF route — phase selection", () => {
  it("EVENT competitions render the event ranking PDF", async () => {
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, type: "EVENT" })
    const res = await callRoute("test-slug")
    expect(res.status).toBe(200)
    expect(getEventWithSeriesMock).toHaveBeenCalledWith("comp1")
    expect(getSeasonWithSeriesMock).not.toHaveBeenCalled()
  })

  it("SEASON competitions render the season standings PDF", async () => {
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, type: "SEASON" })
    const res = await callRoute("test-slug")
    expect(res.status).toBe(200)
    expect(getSeasonWithSeriesMock).toHaveBeenCalledWith("comp1")
  })

  it("LEAGUE competitions render the schedule PDF before playoffs", async () => {
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, type: "LEAGUE" })
    hasPlayoffsStartedMock.mockResolvedValue(false)
    const res = await callRoute("test-slug")
    expect(res.status).toBe(200)
    expect(getMatchupsForCompetitionMock).toHaveBeenCalledWith("comp1")
    expect(getPlayoffBracketMock).not.toHaveBeenCalled()
  })

  it("LEAGUE competitions render the playoffs PDF after playoffs start", async () => {
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, type: "LEAGUE" })
    hasPlayoffsStartedMock.mockResolvedValue(true)
    const res = await callRoute("test-slug")
    expect(res.status).toBe(200)
    expect(getPlayoffBracketMock).toHaveBeenCalledWith("comp1")
    expect(getMatchupsForCompetitionMock).not.toHaveBeenCalled()
  })

  it("returns 404 for unsupported competition types", async () => {
    resolveSlugMock.mockResolvedValue({ ...baseCompetition, type: "WAT" as unknown as "EVENT" })
    const res = await callRoute("test-slug")
    expect(res.status).toBe(404)
  })
})
