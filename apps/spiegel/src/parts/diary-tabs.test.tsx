import { randomUUID } from "node:crypto"

import { createElement, Fragment } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { setDiaryEnabled } from "@/diary/settings"
import { createPrismaClient } from "@/lib/db"

import { cardsDiaryTabs } from "./diary-tabs"

const db = createPrismaClient()
let userId: string

beforeAll(async () => {
  userId = (
    await db.user.create({
      data: { email: `diary-tabs-${randomUUID().slice(0, 8)}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await db.user.delete({ where: { id: userId } })
  await db.$disconnect()
})

describe("Reiterzeile des Tagebuchs auf der Liste der Scheiben", () => {
  it("ohne Tagebuch keine", async () => {
    expect(await cardsDiaryTabs(db, userId)).toBeNull()
  })

  it("mit Tagebuch die Reiter des Tagebuchs, „Scheiben“ gewählt", async () => {
    await setDiaryEnabled(db, userId, true)
    const html = renderToStaticMarkup(
      createElement(Fragment, null, await cardsDiaryTabs(db, userId))
    )
    expect(html).toContain("data-diary-switch")
    expect(html).toMatch(/<a(?=[^>]*href="\/cards")(?=[^>]*aria-current="page")[^>]*>Scheiben</)
    expect(html).toContain('href="/diary"')
  })
})
