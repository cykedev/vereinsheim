import { describe, expect, it } from "vitest"

import { isDiaryPath } from "./diary-path"

describe("isDiaryPath", () => {
  it("/diary und alles darunter", () => {
    for (const path of ["/diary", "/diary/thread", "/diary/new", "/diary/c123"])
      expect(isDiaryPath(path), path).toBe(true)
  })

  it("keine andere Seite, auch nicht mit demselben Anfang", () => {
    for (const path of ["/", "/diaryx", "/cards", "/profile/diary"])
      expect(isDiaryPath(path), path).toBe(false)
  })
})
