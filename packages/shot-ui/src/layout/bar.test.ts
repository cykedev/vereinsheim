import { describe, expect, it } from "vitest"

import { BAR, BAR_PX } from "./bar"

/** Pixel einer Tailwind-Klasse mit Zahl am Ende: eine Stufe sind 4 px */
const px = (cls: string) => Number(cls.match(/(\d+)$/)?.[1]) * 4

describe("Klassen der Leiste", () => {
  it("passen zu `BAR_PX`", () => {
    for (const cls of [BAR.height, BAR.top, BAR.mdTop, BAR.scrollMargin])
      expect(px(cls), cls).toBe(BAR_PX)
  })

  it("zwei Leisten übereinander sind doppelt so hoch", () => {
    expect(px(BAR.mdScrollMarginTwo)).toBe(2 * BAR_PX)
  })

  it("das Fenster unter der Leiste zieht genau die Leiste ab", () => {
    expect(Number(BAR.screenBelow.match(/-([\d.]+)rem\)/)?.[1]) * 16).toBe(BAR_PX)
  })
})
