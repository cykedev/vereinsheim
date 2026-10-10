// Die eingefrorene Form der Fälle unter `cases/v1/<SF-ID>/`, damit auch eine Brücke in Go sie liest:
// `expected.json` (Fall, Lesungen, Vorgabe je Scheibe), `snapshots.json` (je Lesung die Snapshots v1) und
// `steps/NN.sql` (je Lesung die Anweisungen vom vorigen Stand). JSON mit einer Zeile je Tabellenzeile.

import { CASES, runCase, type CaseOutput } from "./cases/index"

export const CASES_DIR = "cases/v1"

/** JSON mit Einrückung; jede Zeile einer Tabelle (`rows`) und jede Zahlenreihe auf einer Zeile */
export function stringify(value: unknown, indent = "", key = ""): string {
  const inner = `${indent}  `
  if (Array.isArray(value)) {
    if (!value.length) return "[]"
    // Zahlenreihen in einer Zeile („[5, 0]“, die Nummern 1 bis 40); Texte je in ihrer Zeile
    if (value.every((item) => item === null || typeof item === "number"))
      return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`
    const items =
      key === "rows"
        ? value.map((item) => `${inner}${JSON.stringify(item)}`)
        : value.map((item) => `${inner}${stringify(item, inner)}`)
    return `[\n${items.join(",\n")}\n${indent}]`
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    if (!entries.length) return "{}"
    return `{\n${entries
      .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${stringify(v, inner, k)}`)
      .join(",\n")}\n${indent}}`
  }
  return JSON.stringify(value)
}

const pad = (n: number) => String(n).padStart(2, "0")

/** die Dateien eines Falls: Pfad relativ zum Paket → Inhalt */
export function caseFiles(output: CaseOutput): Record<string, string> {
  const dir = `${CASES_DIR}/${output.id}`
  const files: Record<string, string> = {
    [`${dir}/expected.json`]: `${stringify({
      id: output.id,
      title: output.title,
      description: output.description,
      readings: output.readings.map(({ reading, observedAt, note }) => ({
        reading,
        observedAt,
        note,
      })),
      cards: output.expected,
    })}\n`,
    [`${dir}/snapshots.json`]: `${stringify(
      output.readings.map(({ reading, observedAt, snapshots }) => ({
        reading,
        observedAt,
        snapshots,
      }))
    )}\n`,
  }
  output.sql.forEach((sql, i) => {
    files[`${dir}/steps/${pad(i + 1)}.sql`] =
      `-- ${output.id}, Lesung ${i + 1}: ${output.readings[i].note}\n${sql || "-- keine Änderung\n"}`
  })
  return files
}

/** alle Dateien aller Fälle */
export function allCaseFiles(): Record<string, string> {
  return Object.assign({}, ...CASES.map((definition) => caseFiles(runCase(definition))))
}
