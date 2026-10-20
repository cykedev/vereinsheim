import { createElement as h } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { confirms, notices, render, reset } from "@/test/confirm-capture"

// Ein Mitglied mit Ergebnissen lässt sich nur zurückziehen (die Action lehnt das Entfernen ab). Der Papierkorb zeigt
// dann den Hinweis und bietet nichts zum Bestätigen an. Ein Gast geht mit seinen Ergebnissen, dort fragt der Dialog.

vi.mock("react", async (original) => {
  const capture = await import("@/test/confirm-capture")
  return { ...(await original<typeof import("react")>()), useState: capture.useStateStub }
})
vi.mock("@vereinsheim/ui/button", async () => (await import("@/test/confirm-capture")).buttonStub())
vi.mock("@vereinsheim/ui/design2/decision-dialog", async () =>
  (await import("@/test/confirm-capture")).decisionDialogStub()
)

const { UnenrollAction } = await import("./ConfirmActions")

const props = { name: "Anna Birke", team: null, isPending: false, onConfirm: vi.fn() }

beforeEach(() => {
  reset()
  vi.clearAllMocks()
})

describe("Aus dem Wettbewerb entfernen", () => {
  it("Mitglied mit Ergebnissen: nur der Hinweis, keine Bestätigung", () => {
    render(h(UnenrollAction, { ...props, guest: false, results: 2 }))
    expect(notices).toEqual(["Anna Birke lässt sich nicht entfernen"])
    expect(confirms).toHaveLength(0)
  })

  it("Mitglied ohne Ergebnisse: eine Bestätigung, sie entfernt genau einmal", () => {
    render(h(UnenrollAction, { ...props, guest: false, results: 0 }))
    expect(notices).toEqual([])
    expect(confirms).toHaveLength(1)
    confirms[0].run()
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
  })

  it("Gast mit Ergebnissen: eine Bestätigung", () => {
    render(h(UnenrollAction, { ...props, name: "Anna", guest: true, results: 2 }))
    expect(notices).toEqual([])
    expect(confirms).toHaveLength(1)
  })
})
