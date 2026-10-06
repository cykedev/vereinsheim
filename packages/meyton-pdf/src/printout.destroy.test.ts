import { describe, expect, it, vi } from "vitest"

import { buildPdf } from "./__fixtures__/buildPdf"

// pdf.js gibt Worker und Puffer erst mit loadingTask.destroy() frei; das muss auf jedem Weg passieren.
const destroyed = vi.fn()

vi.mock("unpdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("unpdf")>()
  return {
    ...actual,
    getDocumentProxy: async (...args: Parameters<typeof actual.getDocumentProxy>) => {
      const pdf = await actual.getDocumentProxy(...args)
      const destroy = pdf.loadingTask.destroy.bind(pdf.loadingTask)
      pdf.loadingTask.destroy = async () => {
        destroyed()
        return destroy()
      }
      return pdf
    },
  }
})

const { readPrintout } = await import("./printout")

describe("readPrintout räumt auf", () => {
  it("nach Erfolg und nach einer gerissenen Grenze", async () => {
    const footer = [{ str: "ID: ff914420 - Seite: 1", x: 258, y: 26 }]
    await readPrintout(await buildPdf({ pages: [footer] }))
    expect(destroyed).toHaveBeenCalledTimes(1)
    const pages = Array.from({ length: 11 }, () => footer)
    await expect(readPrintout(await buildPdf({ pages }))).rejects.toThrow(/mehr als 10 Seiten/)
    expect(destroyed).toHaveBeenCalledTimes(2)
  })
})
