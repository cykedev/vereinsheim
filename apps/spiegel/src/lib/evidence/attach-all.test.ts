import { describe, expect, it } from "vitest"

import { attachAll, reportLines } from "./attach-all"
import { EVIDENCE_GONE, EVIDENCE_NO_SESSION, limitText } from "./texts"

const file = (name: string, type = "image/jpeg") => new File(["x"], name, { type })
const ok = async (f: File) => ({ ok: true as const, file: f })
const quiet = () => {}

/** zählt die Anfragen; antwortet je Name mit Erfolg oder einem Satz */
function server(answers: Record<string, string> = {}) {
  const calls: string[] = []
  return {
    calls,
    attach: async (f: File) => {
      calls.push(f.name)
      const error = answers[f.name]
      return error ? { error } : ({ success: true } as const)
    },
  }
}

describe("attachAll", () => {
  it("drei Dateien bei einem freien Platz: eine hängt an, zwei in einem Satz ohne Anfrage", async () => {
    const s = server()
    const report = await attachAll([file("a.jpg"), file("b.jpg"), file("c.jpg")], {
      free: 1,
      prepare: ok,
      attach: s.attach,
      onProgress: quiet,
    })
    expect(s.calls).toEqual(["a.jpg"])
    expect(report).toEqual({ attached: 1, lines: [limitText(["b.jpg", "c.jpg"])] })
    expect(reportLines(report)).toEqual(["1 Datei angehängt.", limitText(["b.jpg", "c.jpg"])])
  })

  it("ein Fehler des Servers senkt den freien Platz nicht", async () => {
    const s = server({ "a.jpg": "„a.jpg“ hängt schon an dieser Scheibe." })
    const report = await attachAll([file("a.jpg"), file("b.jpg")], {
      free: 1,
      prepare: ok,
      attach: s.attach,
      onProgress: quiet,
    })
    expect(s.calls).toEqual(["a.jpg", "b.jpg"])
    expect(report).toEqual({ attached: 1, lines: ["„a.jpg“ hängt schon an dieser Scheibe."] })
  })

  it("zu groß oder nicht lesbar im Browser: Grund mit dem Namen, ohne Anfrage", async () => {
    const s = server()
    const report = await attachAll([file("gross.heic"), file("kaputt.png"), file("gut.jpg")], {
      free: 5,
      prepare: async (f) =>
        f.name === "gross.heic"
          ? { ok: false, problem: "tooLarge" }
          : f.name === "kaputt.png"
            ? { ok: false, problem: "unreadable" }
            : { ok: true, file: f },
      attach: s.attach,
      onProgress: quiet,
    })
    expect(s.calls).toEqual(["gut.jpg"])
    expect(report.lines).toEqual([
      "„gross.heic“ ist zu groß, auch verkleinert.",
      "Spiegel kann „kaputt.png“ nicht lesen. Nimm ein Foto (JPEG, PNG) oder ein PDF.",
    ])
  })

  it("ohne Scheibe oder Sitzung bricht es ab", async () => {
    for (const stop of [EVIDENCE_GONE, EVIDENCE_NO_SESSION]) {
      const s = server({ "a.jpg": stop })
      const report = await attachAll([file("a.jpg"), file("b.jpg")], {
        free: 5,
        prepare: ok,
        attach: s.attach,
        onProgress: quiet,
      })
      expect(s.calls).toEqual(["a.jpg"])
      expect(report).toEqual({ attached: 0, lines: [stop] })
      expect(reportLines(report)).toEqual([stop])
    }
  })

  it("meldet der Server die Grenze, gilt sie auch für die folgenden Dateien, in einem Satz", async () => {
    const s = server({ "a.jpg": limitText(["a.jpg"]) })
    const report = await attachAll([file("a.jpg"), file("b.pdf", "application/pdf")], {
      free: 2,
      prepare: ok,
      attach: s.attach,
      onProgress: quiet,
    })
    expect(s.calls).toEqual(["a.jpg"])
    expect(report).toEqual({ attached: 0, lines: [limitText(["a.jpg", "b.pdf"])] })
  })

  it("eine geworfene Anfrage gilt als gescheitert, mit dem Namen", async () => {
    const report = await attachAll([file("a.jpg")], {
      free: 1,
      prepare: ok,
      attach: async () => {
        throw new Error("Netz")
      },
      onProgress: quiet,
    })
    expect(report.lines).toEqual([
      "„a.jpg“ ließ sich nicht speichern. Bitte noch einmal versuchen.",
    ])
  })

  it("Fortschritt je Datei mit Anfrage; ging alles, kein Bericht", async () => {
    const progress: string[] = []
    const report = await attachAll([file("a.jpg"), file("b.jpg")], {
      free: 5,
      prepare: ok,
      attach: server().attach,
      onProgress: (k, n) => progress.push(`${k}/${n}`),
    })
    expect(progress).toEqual(["1/2", "2/2"])
    expect(report).toEqual({ attached: 2, lines: [] })
    expect(reportLines(report)).toEqual([])
  })
})
