import { describe, expect, it } from "vitest"

import { OLD_WORDS } from "../admin/consequences"
import {
  attachedText,
  attachingText,
  EVIDENCE_EMPTY,
  EVIDENCE_GONE,
  EVIDENCE_LIMIT,
  EVIDENCE_REMOVE_FAILED,
  evidenceCountText,
  evidenceMeta,
  evidenceName,
  evidenceProblemText,
  limitText,
  type EvidenceProblem,
} from "./texts"

const zone = "Europe/Berlin"
// Sa 14.03.2026 um 10 Uhr in Berlin
const march14 = Date.UTC(2026, 2, 14, 9)

describe("Texte der Belege im Wortlaut des Textbuchs", () => {
  it("Zeile: leer, gefüllt, voll", () => {
    expect(EVIDENCE_LIMIT).toBe(10)
    expect(evidenceCountText(0)).toBe("Fotos oder PDFs zu dieser Scheibe, etwa eine Ergebnisliste.")
    expect(EVIDENCE_EMPTY).toBe(evidenceCountText(0))
    expect(evidenceCountText(1)).toBe("1 Datei")
    expect(evidenceCountText(3)).toBe("3 Dateien")
    expect(evidenceCountText(10)).toBe(
      "10 Dateien, mehr gehen nicht an eine Scheibe. Entferne einen, um einen neuen anzuhängen."
    )
  })

  it("Knopf beim Anhängen", () => {
    expect(attachingText(1, 1)).toBe("Wird angehängt…")
    expect(attachingText(2, 3)).toBe("Datei 2 von 3 wird angehängt…")
  })

  it("Datei ohne Namen und die Zeile darunter", () => {
    expect(evidenceName({ name: null, kind: "photo" })).toBe("Foto")
    expect(evidenceName({ name: null, kind: "pdf" })).toBe("PDF")
    expect(evidenceName({ name: "IMG_2041.jpg", kind: "photo" })).toBe("IMG_2041.jpg")
    expect(evidenceMeta({ kind: "photo", size: 1_400_000, storedAtMs: march14 }, zone)).toBe(
      "Foto · 1,4 MB · Sa 14.03.2026"
    )
    expect(
      evidenceMeta({ kind: "pdf", size: 20_000, storedAtMs: march14 + 86_400_000 }, zone)
    ).toBe("PDF · 0,1 MB · So 15.03.2026")
    expect(evidenceMeta({ kind: "pdf", size: 240_000, storedAtMs: march14 }, zone)).toBe(
      "PDF · 0,2 MB · Sa 14.03.2026"
    )
  })

  it("Bericht: angehängt", () => {
    expect(attachedText(1)).toBe("1 Datei angehängt.")
    expect(attachedText(2)).toBe("2 Dateien angehängt.")
  })

  it("Bericht: je Grund ein Satz mit dem Namen", () => {
    const name = "Liste.pdf"
    expect(evidenceProblemText("printout", name)).toBe(
      "„Liste.pdf“ ist ein Ausdruck von Meyton und kein Beleg. Hole ihn unter „Scheibe holen“ mit „PDF hochladen“, dann liest Spiegel seine Werte."
    )
    expect(evidenceProblemText("tooLarge", name)).toBe("„Liste.pdf“ ist zu groß, auch verkleinert.")
    expect(evidenceProblemText("unreadable", name)).toBe(
      "Spiegel kann „Liste.pdf“ nicht lesen. Nimm ein Foto (JPEG, PNG) oder ein PDF."
    )
    expect(evidenceProblemText("duplicate", name)).toBe(
      "„Liste.pdf“ hängt schon an dieser Scheibe."
    )
    expect(evidenceProblemText("failed", name)).toBe(
      "„Liste.pdf“ ließ sich nicht speichern. Bitte noch einmal versuchen."
    )
  })

  it("Bericht: Grenze für eine und für mehrere Dateien", () => {
    expect(limitText(["a.jpg"])).toBe(
      "„a.jpg“ ist nicht angehängt. An einer Scheibe hängen höchstens 10 Belege."
    )
    expect(limitText(["a.jpg", "b.jpg"])).toBe(
      "2 Dateien sind nicht angehängt. An einer Scheibe hängen höchstens 10 Belege."
    )
  })

  it("lange Namen in der Mitte gekürzt", () => {
    const text = evidenceProblemText("printout", `print_${"7".repeat(60)}c2.pdf`)
    expect(text).toMatch(/^„print_7+…7*c2\.pdf“ ist ein Ausdruck/)
  })

  it("Scheibe weg, Entfernen gescheitert", () => {
    expect(EVIDENCE_GONE).toBe("Diese Scheibe gibt es nicht mehr.")
    expect(EVIDENCE_REMOVE_FAILED).toBe(
      "Das ließ sich nicht entfernen. Bitte noch einmal versuchen."
    )
  })

  it("kein Text mit Semikolon, drei Punkten oder alten Wörtern", () => {
    const problems: EvidenceProblem[] = [
      "tooLarge",
      "unreadable",
      "printout",
      "duplicate",
      "failed",
    ]
    const texts = [
      ...problems.map((p) => evidenceProblemText(p, "Liste.pdf")),
      limitText(["a.jpg"]),
      limitText(["a.jpg", "b.jpg"]),
      attachedText(1),
      attachedText(3),
      evidenceCountText(0),
      evidenceCountText(2),
      evidenceCountText(10),
      attachingText(1, 1),
      attachingText(2, 3),
      EVIDENCE_GONE,
      EVIDENCE_REMOVE_FAILED,
    ]
    for (const text of texts) expect(text).not.toMatch(OLD_WORDS)
  })
})
