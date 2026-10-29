// Mehrere Belege in einem Zug ([[adr-033]]): je Datei eine Anfrage, nacheinander, im Browser. Rein bis auf die
// übergebenen Schritte, damit die Regeln des Berichts ohne Browser testbar sind.

import { evidenceFileName } from "./name"
import { isPdfFile } from "./shrink"
import {
  attachedText,
  EVIDENCE_GONE,
  EVIDENCE_NO_SESSION,
  evidenceName,
  evidenceProblemText,
  isLimitText,
  limitText,
} from "./texts"

type Prepared = { ok: true; file: File } | { ok: false; problem: "tooLarge" | "unreadable" }

/** was nach dem Anhängen unter der Liste steht; `lines` leer, wenn alles anhängt */
export interface AttachReport {
  attached: number
  lines: string[]
}

/**
 * Hängt die Dateien in der Folge der Auswahl an, solange Platz ist (`free`). Dateien über der Grenze gehen ohne Anfrage
 * in einen Satz, die übrigen Gründe je Datei. Meldet der Server die Grenze (eine zweite Seite war schneller), gilt sie
 * auch für die folgenden Dateien. Ohne Scheibe oder Sitzung bricht es ab.
 */
export async function attachAll(
  files: readonly File[],
  {
    free,
    prepare,
    attach,
    onProgress,
  }: {
    free: number
    prepare: (file: File) => Promise<Prepared>
    /** die Action; ihr Fehler ist ein fertiger Satz */
    attach: (file: File) => Promise<{ success: true } | { error: string }>
    onProgress: (k: number, n: number) => void
  }
): Promise<AttachReport> {
  let attached = 0
  const lines: string[] = []
  const overLimit: string[] = []
  for (const [i, file] of files.entries()) {
    const name = evidenceName({
      name: evidenceFileName(file.name),
      kind: isPdfFile(file) ? "pdf" : "photo",
    })
    if (free <= 0) {
      overLimit.push(name)
      continue
    }
    onProgress(i + 1, files.length)
    const prepared = await prepare(file)
    if (!prepared.ok) {
      lines.push(evidenceProblemText(prepared.problem, name))
      continue
    }
    let result
    try {
      result = await attach(prepared.file)
    } catch {
      result = { error: evidenceProblemText("failed", name) }
    }
    if ("success" in result) {
      attached += 1
      free -= 1
    } else if (isLimitText(result.error)) {
      overLimit.push(name)
      free = 0
    } else {
      lines.push(result.error)
      if (result.error === EVIDENCE_GONE || result.error === EVIDENCE_NO_SESSION) break
    }
  }
  if (overLimit.length) lines.push(limitText(overLimit))
  return { attached, lines }
}

/** der Bericht als Sätze: zuerst, wie viele angehängt sind, wenn etwas fehlt */
export const reportLines = (report: AttachReport) =>
  report.lines.length && report.attached
    ? [attachedText(report.attached), ...report.lines]
    : report.lines
