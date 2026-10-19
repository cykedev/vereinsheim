import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// Portale hängen erst im Browser ein; hier rendert der Inhalt an Ort und Stelle
vi.mock("radix-ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("radix-ui")>()
  const Portal = ({ children }: { children: React.ReactNode }) => children
  return {
    ...actual,
    Dialog: { ...actual.Dialog, Portal },
    AlertDialog: { ...actual.AlertDialog, Portal },
  }
})

const { Dialog, DialogContent, DialogTitle } = await import("./dialog")
const { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } =
  await import("./alert-dialog")
const { EmptyState } = await import("./empty-state")
const { ConfirmDialog } = await import("../shell/ConfirmDialog")

describe("Dialoge in Design 2", () => {
  it("Dialog: Kartenfläche mit großem Radius über abgedunkeltem Hintergrund, Titel in der Schrift der Marke", () => {
    const html = renderToStaticMarkup(
      h(Dialog, { open: true }, h(DialogContent, null, h(DialogTitle, null, "Titel")))
    )
    expect(html).toMatch(/data-slot="dialog-overlay" [^>]*class="[^"]*bg-scrim/)
    expect(html).toMatch(/data-slot="dialog-content" [^>]*class="[^"]*bg-card[^"]*rounded-2xl/)
    expect(html).toMatch(/data-slot="dialog-title" [^>]*class="[^"]*font-display/)
  })

  it("Bestätigung: dieselbe Fläche und derselbe Titel", () => {
    const html = renderToStaticMarkup(
      h(
        AlertDialog,
        { open: true },
        h(
          AlertDialogContent,
          null,
          h(AlertDialogTitle, null, "Titel"),
          h(AlertDialogDescription, null, "Satz")
        )
      )
    )
    expect(html).toMatch(/data-slot="alert-dialog-overlay" [^>]*class="[^"]*bg-scrim/)
    expect(html).toMatch(
      /data-slot="alert-dialog-content" [^>]*class="[^"]*bg-card[^"]*rounded-2xl/
    )
    expect(html).toMatch(/data-slot="alert-dialog-title" [^>]*class="[^"]*font-display/)
  })
})

describe("Bestätigung mit Folge", () => {
  it("Knopf einer zerstörenden Aktion: Schrift auf dem Rot aus einem Token, das es gibt", () => {
    const html = renderToStaticMarkup(
      h(ConfirmDialog, {
        open: true,
        onOpenChange: () => {},
        title: "Löschen?",
        description: "Satz",
        confirmLabel: "Löschen",
        destructive: true,
        onConfirm: () => {},
      })
    )
    expect(html).toMatch(/class="[^"]*bg-destructive text-primary-foreground[^"]*"[^>]*>Löschen</)
    expect(html).not.toContain("destructive-foreground")
  })
})

describe("Leerzustand", () => {
  it("in der Karte von Design 2", () => {
    const html = renderToStaticMarkup(h(EmptyState, { title: "Noch nichts da" }))
    expect(html).toMatch(/data-slot="card" class="[^"]*rounded-2xl/)
    expect(html).toContain("Noch nichts da")
  })
})
