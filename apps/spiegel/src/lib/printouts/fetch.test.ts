import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { buildPdf } from "@vereinsheim/meyton-pdf/test-pdf"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { fetchPrintout, MAX_URL_LENGTH } from "./fetch"

// Ein Server im Test spielt die Gegenseite: ein erfundener Ausdruck, eine Weiterleitung, Fehler, zu große und
// langsame Antworten.

const MIB = 1024 * 1024

let pdf: Uint8Array
let server: Server
let base: string

beforeAll(async () => {
  pdf = await buildPdf({
    pages: [[{ str: "ID: ff914420 - Seite: 1", x: 258, y: 26 }]],
    info: { CreationDate: "D:20261002195212+02'00'" },
  })
  server = createServer((request, response) => {
    switch (request.url) {
      case "/print_x.pdf":
        response.writeHead(200, { "content-type": "application/pdf" })
        response.end(pdf)
        return
      case "/redirect":
        response.writeHead(302, { location: "/print_x.pdf" })
        response.end()
        return
      case "/big":
        response.writeHead(200, { "content-length": String(2 * MIB) })
        response.write(pdf)
        return
      case "/chunked": {
        response.writeHead(200, { "content-type": "application/pdf" })
        const chunk = Buffer.alloc(64 * 1024, 0x20)
        chunk.write("%PDF-1.4\n")
        let sent = 0
        const next = () => {
          if (sent >= 1.5 * MIB || response.destroyed) return response.end()
          sent += chunk.length
          response.write(chunk, next)
        }
        next()
        return
      }
      case "/html":
        response.writeHead(200, { "content-type": "text/html" })
        response.end("<html>Fehler</html>")
        return
      case "/slow":
        response.writeHead(200, { "content-type": "application/pdf" })
        response.write("%PDF-1.4\n")
        return
      default:
        response.writeHead(404)
        response.end("nicht da")
    }
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
})

describe("fetchPrintout", () => {
  it("holt das PDF mit Dateinamen", async () => {
    const result = await fetchPrintout(`${base}/print_x.pdf`)
    expect(result).toMatchObject({ kind: "fetched", fileName: "print_x.pdf" })
    if (result.kind !== "fetched") throw new Error("nicht geholt")
    expect(Buffer.from(result.bytes).equals(Buffer.from(pdf))).toBe(true)
  })

  it("folgt keiner Weiterleitung", async () => {
    expect(await fetchPrintout(`${base}/redirect`)).toEqual({ kind: "failed", reason: "redirect" })
  })

  it("Status außer 200", async () => {
    expect(await fetchPrintout(`${base}/missing`)).toEqual({
      kind: "failed",
      reason: "httpStatus",
    })
  })

  it("zu groß: vorab nach Content-Length und beim Lesen gezählt", async () => {
    expect(await fetchPrintout(`${base}/big`)).toEqual({ kind: "failed", reason: "tooLarge" })
    expect(await fetchPrintout(`${base}/chunked`)).toEqual({ kind: "failed", reason: "tooLarge" })
  })

  it("kein PDF", async () => {
    expect(await fetchPrintout(`${base}/html`)).toEqual({ kind: "failed", reason: "notPdf" })
  })

  it("Zeitgrenze für alles, auch für einen Körper, der nicht endet", async () => {
    const started = Date.now()
    expect(await fetchPrintout(`${base}/slow`, { timeoutMs: 200 })).toEqual({
      kind: "failed",
      reason: "timeout",
    })
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it("ungültige Adressen", async () => {
    for (const url of [
      "ftp://x/a.pdf",
      "http://u:p@127.0.0.1/a.pdf",
      "nicht eine adresse",
      `http://127.0.0.1/${"a".repeat(MAX_URL_LENGTH)}.pdf`,
    ]) {
      expect(await fetchPrintout(url)).toEqual({ kind: "failed", reason: "badUrl" })
    }
  })

  it("nicht erreichbar", async () => {
    const closed = createServer()
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve))
    const { port } = closed.address() as AddressInfo
    await new Promise((resolve) => closed.close(resolve))
    expect(await fetchPrintout(`http://127.0.0.1:${port}/a.pdf`)).toEqual({
      kind: "failed",
      reason: "unreachable",
    })
  })
})
