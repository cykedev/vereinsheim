import { describe, expect, it } from "vitest"
import { buildStarterListRows } from "@/lib/pdf/eventStarterList"

type CP = Parameters<typeof buildStarterListRows>[0]["participants"][number]

function makeCp(opts: Partial<CP> & { lastName: string; firstName: string }): CP {
  return {
    status: "ACTIVE",
    participant: { firstName: opts.firstName, lastName: opts.lastName },
    discipline: opts.discipline ?? null,
    ...opts,
  } as CP
}

describe("buildStarterListRows", () => {
  it("excludes WITHDRAWN participants", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "Active" }),
        makeCp({ firstName: "W", lastName: "Withdrawn", status: "WITHDRAWN" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].lastName).toBe("Active")
  })

  it("sorts rows alphabetically by lastName then firstName", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "Zimmermann" }),
        makeCp({ firstName: "B", lastName: "Bauer" }),
        makeCp({ firstName: "A", lastName: "Bauer" }), // same last name, earlier first name
        makeCp({ firstName: "C", lastName: "Müller" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows.map((r) => `${r.lastName} ${r.firstName}`)).toEqual([
      "Bauer A",
      "Bauer B",
      "Müller C",
      "Zimmermann A",
    ])
  })

  it("assigns unique start numbers 1..n", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "One" }),
        makeCp({ firstName: "B", lastName: "Two" }),
        makeCp({ firstName: "C", lastName: "Three" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    const nrs = rows.map((r) => r.nr).sort((a, b) => a - b)
    expect(nrs).toEqual([1, 2, 3])
  })

  it("numbers are shuffled independently of name order", () => {
    // With random()=0: Fisher–Yates on [1,2,3] always swaps with index 0.
    // i=2: swap(2,0) → [3,2,1]; i=1: swap(1,0) → [2,3,1]
    // Rows are sorted alphabetically: One, Three, Two (de locale)
    // Assigned numbers: One→2, Three→3, Two→1
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "One" }),
        makeCp({ firstName: "B", lastName: "Two" }),
        makeCp({ firstName: "C", lastName: "Three" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    // Names must be in alphabetical order
    expect(rows.map((r) => r.lastName)).toEqual(["One", "Three", "Two"])
    // Numbers must be a permutation of [1,2,3] but NOT [1,2,3] in order
    const nrs = rows.map((r) => r.nr)
    expect([...nrs].sort((a, b) => a - b)).toEqual([1, 2, 3])
    // With this deterministic random the numbers are shuffled (not sequential)
    expect(nrs).not.toEqual([1, 2, 3])
  })

  it("uses participant discipline when set (mixed event)", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({
          firstName: "A",
          lastName: "Mix",
          discipline: { name: "Luftgewehr" },
        }),
      ],
      competitionDisciplineName: null,
      random: () => 0,
    })
    expect(rows[0].disciplineName).toBe("Luftgewehr")
  })

  it("falls back to competition discipline when participant has none (fixed event)", () => {
    const rows = buildStarterListRows({
      participants: [makeCp({ firstName: "A", lastName: "Fix", discipline: null })],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows[0].disciplineName).toBe("Luftpistole")
  })

  it("returns null disciplineName when neither participant nor competition has one", () => {
    const rows = buildStarterListRows({
      participants: [makeCp({ firstName: "A", lastName: "None", discipline: null })],
      competitionDisciplineName: null,
      random: () => 0,
    })
    expect(rows[0].disciplineName).toBeNull()
  })

  it("returns empty array when there are no ACTIVE participants", () => {
    const rows = buildStarterListRows({
      participants: [makeCp({ firstName: "W", lastName: "Out", status: "WITHDRAWN" })],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows).toEqual([])
  })
})
