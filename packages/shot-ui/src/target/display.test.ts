import { describe, expect, it } from "vitest"

import {
  DEFAULT_TARGET_DISPLAY,
  parseTargetDisplay,
  serializeTargetDisplay,
  type TargetDisplay,
} from "./display"

describe("Darstellung der Scheibe als Voreinstellung", () => {
  it("ohne Wert die Vorgabe: Schwerpunkt und Streukreis an, Nummern und Ellipse aus, übrige blass, ganze Scheibe", () => {
    expect(parseTargetDisplay(null)).toEqual(DEFAULT_TARGET_DISPLAY)
    expect(parseTargetDisplay(undefined)).toEqual(DEFAULT_TARGET_DISPLAY)
    expect(DEFAULT_TARGET_DISPLAY).toEqual({
      layers: { mpi: true, circle: true, numbers: false, ellipse: false },
      others: "dim",
      view: "target",
    })
  })

  it("hin und zurück", () => {
    const display: TargetDisplay = {
      layers: { mpi: false, circle: true, numbers: true, ellipse: true },
      others: "hide",
      view: "group",
    }
    expect(parseTargetDisplay(serializeTargetDisplay(display))).toEqual(display)
  })

  it("kaputt, alt oder fremd: Feld für Feld die Vorgabe", () => {
    expect(parseTargetDisplay("kein json")).toEqual(DEFAULT_TARGET_DISPLAY)
    expect(parseTargetDisplay("[1,2]")).toEqual(DEFAULT_TARGET_DISPLAY)
    expect(
      parseTargetDisplay(JSON.stringify({ layers: { numbers: true, mpi: "ja" }, others: "weg" }))
    ).toEqual({
      layers: { mpi: true, circle: true, numbers: true, ellipse: false },
      others: "dim",
      view: "target",
    })
    expect(parseTargetDisplay(JSON.stringify({ others: "hide", extra: 1 }))).toEqual({
      ...DEFAULT_TARGET_DISPLAY,
      others: "hide",
    })
    expect(parseTargetDisplay(JSON.stringify({ view: "group" })).view).toBe("group")
    expect(parseTargetDisplay(JSON.stringify({ view: "zoom" })).view).toBe("target")
  })
})
