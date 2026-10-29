import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { Wellbeing } from "@/generated/prisma/client"
import { sessionDelete } from "@/lib/consequences"

// Eine Einheit eines Kontos, das nach Spiegel umgezogen ist: alles lesen, nichts ändern (`readOnly`).

vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string } & Record<string, unknown>) =>
    h("a", { href, ...props }),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/sessions/actions", () => ({
  deleteSession: vi.fn(),
  toggleFavourite: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  saveWellbeing: vi.fn(),
  saveReflection: vi.fn(),
  savePrognosis: vi.fn(),
  saveFeedback: vi.fn(),
}))

const { SessionDetailHeaderActions } = await import("../sessions/detail/SessionDetailHeaderActions")
const { AttachmentSection } = await import("../sessions/AttachmentSection")
const { WellbeingSection } = await import("../sessions/WellbeingSection")
const { ReflectionSection } = await import("../sessions/ReflectionSection")

const DECISION = sessionDelete({
  when: "Mi 14.10.2026 um 18:30",
  discipline: "Luftgewehr",
  type: "Training",
  attachments: 0,
  goals: 0,
})

const actions = (readOnly?: boolean) =>
  renderToStaticMarkup(
    h(SessionDetailHeaderActions, {
      sessionId: "s1",
      isFavourite: false,
      deleteDecision: DECISION,
      readOnly,
    })
  )

const ATTACHMENTS = [
  { id: "a1", filePath: "u/a1.pdf", fileType: "PDF", originalName: "Ausdruck.pdf", label: null },
]

const WELLBEING = {
  id: "w1",
  sessionId: "s1",
  sleep: 80,
  energy: 70,
  stress: 30,
  motivation: 90,
} as Wellbeing

describe("Einheit nur lesend", () => {
  it("Aktionen: PDF und Zurück, kein Bearbeiten, Löschen oder Favorit", () => {
    const html = actions(true)
    expect(html).toContain('href="/sessions/s1/export/pdf"')
    expect(html).toContain('href="/sessions"')
    expect(html).not.toContain('href="/sessions/s1/edit"')
    expect(html).not.toContain('aria-label="Löschen"')
    expect(html).not.toContain("Als Favorit markieren")
  })

  it("Aktionen ohne readOnly wie bisher", () => {
    const html = actions()
    expect(html).toContain('href="/sessions/s1/edit"')
    expect(html).toContain('aria-label="Löschen"')
    expect(html).toContain("Als Favorit markieren")
  })

  it("Anhänge: ansehen, nicht hochladen oder löschen", () => {
    const html = renderToStaticMarkup(
      h(AttachmentSection, { sessionId: "s1", attachments: ATTACHMENTS, readOnly: true })
    )
    expect(html).toContain('href="/api/uploads/u/a1.pdf"')
    expect(html).not.toContain('type="file"')
    expect(html).not.toContain("löschen")
    const editable = renderToStaticMarkup(
      h(AttachmentSection, { sessionId: "s1", attachments: ATTACHMENTS })
    )
    expect(editable).toContain('type="file"')
    expect(editable).toContain("Anhang Ausdruck.pdf löschen")
  })

  it("Befinden mit und ohne Daten: kein Knopf", () => {
    for (const initialData of [WELLBEING, null]) {
      const html = renderToStaticMarkup(
        h(WellbeingSection, { sessionId: "s1", initialData, readOnly: true })
      )
      expect(html).not.toContain("<button")
    }
    expect(
      renderToStaticMarkup(
        h(WellbeingSection, { sessionId: "s1", initialData: null, readOnly: true })
      )
    ).toContain("Noch nicht erfasst.")
    expect(
      renderToStaticMarkup(h(WellbeingSection, { sessionId: "s1", initialData: null }))
    ).toContain("Befinden erfassen")
  })

  it("Reflexion ohne Daten: kein Knopf", () => {
    const html = renderToStaticMarkup(
      h(ReflectionSection, { sessionId: "s1", initialData: null, readOnly: true })
    )
    expect(html).toContain("Noch nicht erfasst.")
    expect(html).not.toContain("<button")
  })
})
