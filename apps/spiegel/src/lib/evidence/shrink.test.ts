import { describe, expect, it } from "vitest"

import { fitWithin, isPdfFile, jpegNameOf, prepareEvidence, SHRINK_STEPS } from "./shrink"
import { EVIDENCE_MAX_BYTES } from "./texts"

describe("Beleg im Browser vorbereiten", () => {
  it("die lange Kante auf höchstens die Grenze, Seitenverhältnis bleibt, nie größer", () => {
    expect(fitWithin(4032, 3024, 2400)).toEqual({ width: 2400, height: 1800 })
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(800, 600, 2400)).toEqual({ width: 800, height: 600 })
  })

  it("Stufen werden kleiner, die letzte ist die kleinste", () => {
    const last = SHRINK_STEPS[SHRINK_STEPS.length - 1]!
    expect(SHRINK_STEPS.every((s) => s.edge >= last.edge && s.quality >= last.quality)).toBe(true)
  })

  it("ein PDF bleibt, wie es ist, ein zu großes nicht", async () => {
    expect(isPdfFile({ type: "", name: "Scan.PDF" })).toBe(true)
    const small = new File(["%PDF-1.4"], "scan.pdf", { type: "application/pdf" })
    expect(await prepareEvidence(small)).toEqual({ ok: true, file: small })
    const big = new File([new Uint8Array(EVIDENCE_MAX_BYTES + 1)], "scan.pdf")
    expect(await prepareEvidence(big)).toEqual({ ok: false, problem: "tooLarge" })
  })

  it("ein neu gezeichnetes Foto behält den Stamm des Originals mit der Endung .jpg", () => {
    expect(jpegNameOf("IMG_2041.HEIC")).toBe("IMG_2041.jpg")
    expect(jpegNameOf(".jpg")).toBe("beleg.jpg")
    expect(jpegNameOf("")).toBe("beleg.jpg")
    expect(jpegNameOf("foto.final.png")).toBe("foto.final.jpg")
    expect(jpegNameOf("Ergebnisliste")).toBe("Ergebnisliste.jpg")
  })
})
