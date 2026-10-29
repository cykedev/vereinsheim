// Texte zu den Belegen einer Scheibe ([[adr-033]]), für die Actions und den Browser (der eine zu große Datei gar nicht
// erst schickt). Gründe nennen die Datei beim Namen, gekürzt in der Mitte (`shortName`).

import { formatDecimal, formatWeekdayDate } from "@vereinsheim/lib/format"

import { shortName } from "./name"

/** so groß darf ein Beleg sein: Luft unter den 5 MiB je Anfrage (Caddy) für das Formular */
export const EVIDENCE_MAX_BYTES = 4 * 1024 * 1024

/** so viele Belege hängen höchstens an einer Scheibe */
export const EVIDENCE_LIMIT = 10

/** warum eine Datei nicht angehängt ist; die Grenze sagt `limitText` für alle Dateien zusammen */
export type EvidenceProblem = "tooLarge" | "unreadable" | "printout" | "duplicate" | "failed"

export const EVIDENCE_EMPTY = "Fotos oder PDFs zu dieser Scheibe, etwa eine Ergebnisliste."
export const EVIDENCE_GONE = "Diese Scheibe gibt es nicht mehr."
export const EVIDENCE_REMOVE_FAILED = "Das ließ sich nicht entfernen. Bitte noch einmal versuchen."

/** der Grund, warum eine Datei nicht angehängt ist, mit ihrem Namen */
export function evidenceProblemText(problem: EvidenceProblem, name: string): string {
  const quoted = `„${shortName(name)}“`
  switch (problem) {
    case "tooLarge":
      return `${quoted} ist zu groß, auch verkleinert.`
    case "unreadable":
      return `Spiegel kann ${quoted} nicht lesen. Nimm ein Foto (JPEG, PNG) oder ein PDF.`
    case "printout":
      return `${quoted} ist ein Ausdruck von Meyton und kein Beleg. Hole ihn unter „Scheibe holen“ mit „PDF hochladen“, dann liest Spiegel seine Werte.`
    case "duplicate":
      return `${quoted} hängt schon an dieser Scheibe.`
    case "failed":
      return `${quoted} ließ sich nicht speichern. Bitte noch einmal versuchen.`
  }
}

/** die Dateien, die über der Grenze nicht angehängt sind, in einem Satz */
export function limitText(names: readonly string[]): string {
  const limit = `An einer Scheibe hängen höchstens ${EVIDENCE_LIMIT} Belege.`
  return names.length === 1
    ? `„${shortName(names[0]!)}“ ist nicht angehängt. ${limit}`
    : `${names.length} Dateien sind nicht angehängt. ${limit}`
}

/** „1 Datei angehängt.“, „3 Dateien angehängt.“ */
export const attachedText = (n: number) => `${dateien(n)} angehängt.`

const dateien = (n: number) => (n === 1 ? "1 Datei" : `${n} Dateien`)

/** der Zustand der Zeile „Belege“: leer, die Zahl, bei voller Scheibe der Satz zur Grenze */
export function evidenceCountText(n: number): string {
  if (n === 0) return EVIDENCE_EMPTY
  if (n >= EVIDENCE_LIMIT)
    return `${dateien(n)}, mehr gehen nicht an eine Scheibe. Entferne einen, um einen neuen anzuhängen.`
  return dateien(n)
}

/** der Name, der für einen Beleg steht: der Name der Datei, ohne ihn „Foto“ oder „PDF“ */
export const evidenceName = ({ name, kind }: { name: string | null; kind: "photo" | "pdf" }) =>
  name ?? (kind === "pdf" ? "PDF" : "Foto")

/** „Foto · 1,4 MB · Sa 14.03.2026“, der Tag des Anhängens in der Zone der Anzeige */
export function evidenceMeta(
  info: { kind: "photo" | "pdf"; size: number; storedAtMs: number },
  timeZone: string
): string {
  const mb = formatDecimal(Math.max(0.1, info.size / 1_000_000), 1)
  const day = formatWeekdayDate(new Date(info.storedAtMs), timeZone)
  return `${info.kind === "pdf" ? "PDF" : "Foto"} · ${mb} MB · ${day}`
}

/** der Knopf, solange Dateien angehängt werden: „Wird angehängt…“, bei mehreren „Datei 2 von 3 wird angehängt…“ */
export const attachingText = (k: number, n: number) =>
  n === 1 ? "Wird angehängt…" : `Datei ${k} von ${n} wird angehängt…`
