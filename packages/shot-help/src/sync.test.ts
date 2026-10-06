import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { GUIDE_FILE, guideSection, renderGuideMarkdown } from "./markdown"

describe("Vault-Leitfaden", () => {
  it("der Abschnitt zwischen den Markern ist der aus den Daten erzeugte", () => {
    const note = readFileSync(new URL(`../../../${GUIDE_FILE}`, import.meta.url), "utf8")
    expect(
      guideSection(note),
      "Leitfaden veraltet: pnpm --filter @vereinsheim/shot-help docs"
    ).toBe(renderGuideMarkdown())
  })
})
