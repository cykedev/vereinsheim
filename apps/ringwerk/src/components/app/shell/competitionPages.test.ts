import { describe, expect, it } from "vitest"

import { competitionTabs } from "./competitionPages"

describe("competitionTabs", () => {
  it("die gezeigte Seite und ihre Ziele in fester Reihenfolge", () => {
    expect(competitionTabs("c1", "participants", ["playoffs", "schedule"])).toEqual([
      { href: "/competitions/c1/schedule", label: "Spielplan & Tabelle" },
      { href: "/competitions/c1/playoffs", label: "Playoffs" },
      { href: "/competitions/c1/participants", label: "Teilnehmer" },
    ])
  })

  it("Rangliste von Event und Saison, Serien vor Teilnehmern, nichts doppelt", () => {
    expect(
      competitionTabs("c1", "series", ["participants", "ranking", "series"]).map((t) => t.label)
    ).toEqual(["Rangliste", "Serien erfassen", "Teilnehmer"])
    expect(competitionTabs("c1", "standings", []).map((t) => t.href)).toEqual([
      "/competitions/c1/standings",
    ])
  })
})
