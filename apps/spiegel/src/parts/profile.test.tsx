import { randomUUID } from "node:crypto"

import { createElement, Fragment } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { setDiaryEnabled } from "@/diary/settings"
import { createPrismaClient } from "@/lib/db"

import { profileParts } from "./profile"

const db = createPrismaClient()
let userId: string

beforeAll(async () => {
  userId = (
    await db.user.create({
      data: { email: `profile-parts-${randomUUID().slice(0, 8)}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await db.user.delete({ where: { id: userId } })
  await db.$disconnect()
})

const html = async () =>
  renderToStaticMarkup(createElement(Fragment, null, (await profileParts(db, userId)).diary))

describe("Tagebuch im Profil", () => {
  it("aus: der Kasten sagt, was das Tagebuch ist, und bietet Einschalten; kein Link auf die Scheiben", async () => {
    const markup = await html()
    expect(markup).toContain("Aus. Im Tagebuch hältst du fest")
    expect(markup).toContain(">Einschalten<")
    expect(markup).not.toContain("data-all-cards")
  })

  it("an: „Alle Scheiben“ am Telefon über dem Kasten, der Ausschalten bietet", async () => {
    await setDiaryEnabled(db, userId, true)
    const markup = await html()
    expect(markup).toMatch(
      /<nav aria-label="Alle Scheiben" data-all-cards="true" class="lg:hidden">/
    )
    expect(markup).toContain('href="/cards"')
    expect(markup.indexOf("data-all-cards")).toBeLessThan(markup.indexOf("data-diary-profile"))
    expect(markup).toContain("An. In der unteren Leiste steht Tagebuch statt Scheiben.")
    expect(markup).toContain(">Ausschalten<")
  })
})
