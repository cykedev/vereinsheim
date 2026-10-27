import { mkdtemp, rm } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { buildPdf } from "@vereinsheim/meyton-pdf/test-pdf"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { fetchCardById, fetchCardByLink, fetchCardByUpload, stopCardFetch } =
  await import("./actions")

// Die Actions holen an der ersten Anlage (eine je Installation); ohne Anlage in der Dev-Datenbank entfallen die Fälle
// mit Anlage. Ein Server im Test liefert einen erfundenen Ausdruck mit einer ID, die keine echte Scheibe trägt.

const HEX = "7fff0b01"
let user: string
let hasSite = false
let server: Server
let base: string
let pdf: Uint8Array
let dir: string
let previousUploadDir: string | undefined

beforeAll(async () => {
  user = (
    await db.user.create({
      data: { email: `fetch-action-${Date.now()}@example.com`, name: "A", passwordHash: "-" },
    })
  ).id
  hasSite = (await db.site.count()) > 0
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-fetch-actions-"))
  process.env.UPLOAD_DIR = dir
  pdf = await buildPdf({
    pages: [[{ str: `ID: ${HEX} - Seite: 1`, x: 258, y: 26 }]],
    info: { CreationDate: "D:20261002195212+02'00'" },
  })
  server = createServer((request, response) => {
    if (request.url === "/print.pdf") {
      response.writeHead(200, { "content-type": "application/pdf" })
      response.end(pdf)
      return
    }
    response.writeHead(404)
    response.end()
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await db.card.deleteMany({ where: { ownerId: user } })
  await db.cardRequest.deleteMany({ where: { userId: user } })
  await db.user.delete({ where: { id: user } })
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = previousUploadDir
  await rm(dir, { recursive: true, force: true })
  await db.$disconnect()
})

const signIn = () => (mocks.session = { user: { id: user, role: "USER" } })

describe("Scheibe holen (Actions)", () => {
  it("ohne Sitzung nichts", async () => {
    mocks.session = null
    const refused = { error: "Das geht gerade nicht. Lade die Seite neu." }
    expect(await fetchCardById("ff914420", "2026-10-21", null)).toEqual(refused)
    expect(await fetchCardByLink(`${base}/print.pdf`, null)).toEqual(refused)
    expect(await stopCardFetch(1)).toEqual(refused)
  })

  it("Feldfehler der ID und des Tags", async () => {
    if (!hasSite) return
    signIn()
    expect(await fetchCardById("ff91442", "2999-01-01", null)).toEqual({
      error: {
        id: ["Die ID hat acht Zeichen aus Ziffern und a bis f, wie unten auf dem Ausdruck."],
        day: ["Bitte den Tag der Scheibe wählen, nicht nach heute."],
      },
    })
  })

  it("Link: erst fragen, mit Wahl angelegt; danach liegt sie schon da", async () => {
    if (!hasSite) return
    signIn()
    const asked = await fetchCardByLink(`${base}/print.pdf`, null)
    expect(asked).toEqual({
      success: true,
      data: {
        kind: "choose",
        hex: HEX,
        day: "2026-10-02",
        relifts: false,
        disciplineId: null,
        values: false,
      },
    })
    const site = await db.site.findFirstOrThrow({ orderBy: { id: "asc" }, select: { id: true } })
    const discipline = await db.discipline.findFirst({
      where: {
        siteId: site.id,
        confirmedAt: { not: null },
        ignoredAt: null,
        familyId: { not: null },
        targetId: { not: null },
      },
      select: { id: true },
    })
    if (!discipline) return
    const created = await fetchCardByLink(`${base}/print.pdf`, {
      disciplineId: discipline.id,
      kind: "training",
    })
    expect(created).toMatchObject({ success: true, data: { kind: "created" } })
    expect(await fetchCardByLink(`${base}/print.pdf`, null)).toMatchObject({
      success: true,
      data: { kind: "opened", attached: true },
    })
    // eine fremde Kennung eines Auftrags lässt sich nicht beenden
    const [request] = await db.cardRequest.findMany({ where: { userId: user } })
    mocks.session = { user: { id: "jemand-anderes", role: "ADMIN" } }
    expect(await stopCardFetch(request.id)).toEqual({
      error: "Spiegel holt diese Scheibe schon nicht mehr. Lade die Seite neu.",
    })
    signIn()
    expect(await stopCardFetch(request.id)).toEqual({ success: true })
  })

  it("Upload: zu groß, kein PDF", async () => {
    if (!hasSite) return
    signIn()
    const upload = (bytes: Uint8Array, name = "ausdruck.pdf") => {
      const form = new FormData()
      form.set("file", new File([Buffer.from(bytes)], name, { type: "application/pdf" }))
      return fetchCardByUpload(form)
    }
    expect(await upload(new Uint8Array(1024 * 1024 + 1))).toEqual({
      error: "Die Datei ist größer als 1 MB. Ein Ausdruck hat rund 40 KB.",
    })
    expect(await upload(new TextEncoder().encode("<html>kein PDF</html>"))).toEqual({
      error: "Das ist kein PDF.",
    })
  })

  it("Link ins Leere und eine Wahl, die nicht stimmt", async () => {
    signIn()
    expect(await fetchCardByLink("kein link", null)).toEqual({
      error: "Das ist kein Link auf einen Ausdruck.",
    })
    expect(
      await fetchCardByLink(`${base}/print.pdf`, { disciplineId: -1, kind: "training" })
    ).toEqual({ error: "Diese Disziplin steht nicht zur Wahl. Lade die Seite neu." })
  })
})
