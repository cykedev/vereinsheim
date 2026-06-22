import { describe, expect, it } from "vitest"
import { generateSchedule } from "./generateSchedule"

describe("generateSchedule", () => {
  describe("Grundstruktur", () => {
    it("gibt leeres Array bei weniger als 2 Teilnehmern zurück", () => {
      expect(generateSchedule([])).toEqual([])
      expect(generateSchedule(["a"])).toEqual([])
    })

    it("erzeugt Hin- und Rückrunde", () => {
      const result = generateSchedule(["a", "b", "c", "d"])
      const firstLeg = result.filter((m) => m.round === "FIRST_LEG")
      const secondLeg = result.filter((m) => m.round === "SECOND_LEG")
      expect(firstLeg.length).toBeGreaterThan(0)
      expect(secondLeg.length).toBeGreaterThan(0)
    })
  })

  describe("Gerade Teilnehmerzahl (4 Teilnehmer)", () => {
    const ids = ["a", "b", "c", "d"]
    const result = generateSchedule(ids)
    const firstLeg = result.filter((m) => m.round === "FIRST_LEG")
    const secondLeg = result.filter((m) => m.round === "SECOND_LEG")

    it("erzeugt 6 Paarungen in der Hinrunde (n*(n-1)/2)", () => {
      expect(firstLeg).toHaveLength(6)
    })

    it("erzeugt 6 Paarungen in der Rückrunde", () => {
      expect(secondLeg).toHaveLength(6)
    })

    it("hat 3 Spieltage in der Hinrunde (n-1)", () => {
      const roundIndices = [...new Set(firstLeg.map((m) => m.roundIndex))]
      expect(roundIndices).toHaveLength(3)
      expect(roundIndices.sort()).toEqual([1, 2, 3])
    })

    it("hat 2 Paarungen pro Spieltag in der Hinrunde", () => {
      for (let r = 1; r <= 3; r++) {
        const roundMatchups = firstLeg.filter((m) => m.roundIndex === r)
        expect(roundMatchups).toHaveLength(2)
      }
    })

    it("kein Freilos bei gerader Teilnehmerzahl", () => {
      expect(result.every((m) => m.awayId !== null)).toBe(true)
    })

    it("jeder Teilnehmer spielt gegen jeden anderen genau 1x in der Hinrunde", () => {
      for (const id of ids) {
        const opponents = firstLeg
          .filter((m) => m.homeId === id || m.awayId === id)
          .map((m) => (m.homeId === id ? m.awayId : m.homeId))
        const uniqueOpponents = new Set(opponents)
        expect(uniqueOpponents.size).toBe(ids.length - 1)
      }
    })

    it("Rückrunde spiegelt Hinrunde (Heimrecht getauscht)", () => {
      for (const fl of firstLeg) {
        const mirror = secondLeg.find(
          (sl) =>
            sl.homeId === fl.awayId && sl.awayId === fl.homeId && sl.roundIndex === fl.roundIndex
        )
        expect(mirror).toBeDefined()
      }
    })
  })

  describe("Ungerade Teilnehmerzahl (5 Teilnehmer)", () => {
    const ids = ["a", "b", "c", "d", "e"]
    const result = generateSchedule(ids)
    const firstLeg = result.filter((m) => m.round === "FIRST_LEG")
    const secondLeg = result.filter((m) => m.round === "SECOND_LEG")
    const byeMatchups = result.filter((m) => m.awayId === null)

    it("hat 5 Spieltage in der Hinrunde (n Spieltage für n ungerade)", () => {
      const roundIndices = [...new Set(firstLeg.map((m) => m.roundIndex))]
      expect(roundIndices).toHaveLength(5)
    })

    it("jeder Teilnehmer hat genau 1 Freilos in der Hinrunde", () => {
      const firstLegByes = byeMatchups.filter((m) => m.round === "FIRST_LEG")
      expect(firstLegByes).toHaveLength(5)
      const byeHomes = firstLegByes.map((m) => m.homeId)
      const uniqueByeHomes = new Set(byeHomes)
      expect(uniqueByeHomes.size).toBe(5)
      for (const id of ids) {
        expect(uniqueByeHomes.has(id)).toBe(true)
      }
    })

    it("jeder Teilnehmer spielt gegen jeden anderen genau 1x in der Hinrunde", () => {
      const realMatchups = firstLeg.filter((m) => m.awayId !== null)
      for (const id of ids) {
        const opponents = realMatchups
          .filter((m) => m.homeId === id || m.awayId === id)
          .map((m) => (m.homeId === id ? m.awayId : m.homeId))
        const uniqueOpponents = new Set(opponents)
        expect(uniqueOpponents.size).toBe(ids.length - 1)
      }
    })

    it("kein Teilnehmer spielt zweimal an einem Spieltag (Hinrunde)", () => {
      const realMatchups = firstLeg.filter((m) => m.awayId !== null)
      const roundIndices = [...new Set(realMatchups.map((m) => m.roundIndex))]
      for (const r of roundIndices) {
        const roundMatchups = realMatchups.filter((m) => m.roundIndex === r)
        const participantsInRound: string[] = []
        for (const m of roundMatchups) {
          participantsInRound.push(m.homeId)
          if (m.awayId) participantsInRound.push(m.awayId)
        }
        const unique = new Set(participantsInRound)
        expect(unique.size).toBe(participantsInRound.length)
      }
    })

    it("Rückrunde hat gleichviele Matchups wie Hinrunde", () => {
      expect(secondLeg).toHaveLength(firstLeg.length)
    })
  })

  describe("2 Teilnehmer (Sonderfall)", () => {
    const ids = ["a", "b"]
    const result = generateSchedule(ids)

    it("erzeugt genau 2 Paarungen (je 1 Hin- und Rückrunde)", () => {
      expect(result).toHaveLength(2)
    })

    it("Rückrunde spiegelt Hinrunde", () => {
      const fl = result.find((m) => m.round === "FIRST_LEG")!
      const sl = result.find((m) => m.round === "SECOND_LEG")!
      expect(sl.homeId).toBe(fl.awayId)
      expect(sl.awayId).toBe(fl.homeId)
    })
  })
})
