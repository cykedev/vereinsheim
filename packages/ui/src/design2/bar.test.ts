import { describe, expect, it } from "vitest"

import { BAR_PX, JUMP_BAR } from "./bar"

/** Pixel einer Tailwind-Klasse mit Zahl am Ende: eine Stufe sind 4 px */
const px = (cls: string) => Number(cls.match(/(\d+)$/)?.[1]) * 4

describe("Klassen der Leiste", () => {
  it("passen zu `BAR_PX`", () => {
    for (const cls of [JUMP_BAR.height, JUMP_BAR.mdTop, JUMP_BAR.scrollMargin])
      expect(px(cls), cls).toBe(BAR_PX)
  })

  it("zwei Leisten übereinander sind doppelt so hoch", () => {
    expect(px(JUMP_BAR.mdScrollMarginTwo)).toBe(2 * BAR_PX)
  })

  it("das Fenster unter der Leiste zieht genau die Leiste ab", () => {
    expect(Number(JUMP_BAR.screenBelow.match(/-([\d.]+)rem\)/)?.[1]) * 16).toBe(BAR_PX)
  })
})
