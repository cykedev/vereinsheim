// Gemeinsame Helfer der PDF-Render-Tests (kein Testfile — wird nur von *.test.tsx importiert).

import { inflateSync } from "node:zlib"

/**
 * Extract readable text from a PDF buffer.
 * Decompresses FlateDecode streams and decodes hex-encoded text in TJ operators.
 */
export function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("binary")
  const parts: string[] = [raw]

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null
  while ((match = streamRegex.exec(raw)) !== null) {
    try {
      const streamBytes = Buffer.from(match[1], "binary")
      const decompressed = inflateSync(streamBytes).toString("latin1")
      const decoded = decompressed.replace(/\[([^\]]*)\] TJ/g, (_m, content: string) => {
        const texts: string[] = []
        const hexRegex = /<([0-9a-fA-F]+)>/g
        let hexMatch: RegExpExecArray | null
        while ((hexMatch = hexRegex.exec(content)) !== null) {
          try {
            texts.push(Buffer.from(hexMatch[1], "hex").toString("latin1"))
          } catch {
            // skip
          }
        }
        return texts.join("") + " "
      })
      parts.push(decoded)
    } catch {
      // not a compressed stream — skip
    }
  }
  return parts.join("\n")
}

/** Seitenzahl aus dem PDF-Buffer (pdfkit schreibt keine Object-Streams; `/Pages` ausgeschlossen). */
export function pageCount(buffer: Buffer): number {
  return buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0
}

export function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1
}

/** Öffentlicher Link wie ihn ein interner Export erhält (ohne Zugangscode). */
export const TEST_PUBLIC_LINK = {
  displayUrl: "https://ringwerk.example.org/api/public/c/liga-2026/pdf",
  qrUrl: "https://ringwerk.example.org/api/public/c/liga-2026/pdf",
}

/** 60 offene Paarungen (120 verschiedene Teilnehmer) — genug für mehrere Seiten. */
export function manyMatchups(round: string) {
  return Array.from({ length: 60 }, (_, i) => ({
    id: `m${i}`,
    round,
    roundIndex: Math.floor(i / 6) + 1,
    status: "PENDING",
    homeParticipant: { id: `h${i}`, firstName: "Anna", lastName: `Huber-${i}`, withdrawn: false },
    awayParticipant: { id: `a${i}`, firstName: "Bert", lastName: `Schmidt-${i}`, withdrawn: false },
    results: [],
  }))
}
