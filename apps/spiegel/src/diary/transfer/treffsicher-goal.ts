// Ziele und Abläufe aus Treffsicher im Tagebuch ([[spiegel-account-transfer]], [[adr-033]] Nachtrag 2b): welche Felder
// wohin. Rein; den Schlüssel gibt der Aufrufer, geschrieben über `upsertImportedGoal`/`upsertImportedRoutine`.

import { formatIsoDate } from "@vereinsheim/lib/format"

import { routineSteps } from "../routines/validation"

export interface ImportedGoal {
  importKey: string
  familyId: number | null
  title: string
  note: string | null
  kind: "result" | "process"
  /** Tage in der Anzeige-Zone, beide eingeschlossen */
  from: string
  to: string
}

export interface ImportedRoutine {
  importKey: string
  familyId: number | null
  name: string
  steps: { title: string; description?: string }[]
}

const text = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Ein Ziel aus Treffsicher: Satz, Beschreibung als Notiz, Art, Zeitraum als Kalendertage in der Anzeige-Zone (kein
 * Abend: ein Zeitraum beginnt um Mitternacht). Keine Messung und keine Antwort, die rät Spiegel nicht. Die Familie,
 * wenn alle verknüpften Einheiten mit Familie dieselbe haben; dazu die Verknüpfungen, deren Abend außerhalb des
 * Zeitraums liegt, und die, deren Einheit das Konto nicht hat (beide für den Bericht).
 */
export function goalFromTreffsicher(
  goal: {
    title: string
    description: string | null
    type: "RESULT" | "PROCESS"
    dateFrom: string
    dateTo: string
    sessionIds: readonly string[]
  },
  context: {
    importKey: string
    sessionOf: (id: string) => { familyId: number | null; day: string } | undefined
    timeZone: string
  }
): { goal: ImportedGoal; outside: number; unknown: number } {
  const from = formatIsoDate(new Date(goal.dateFrom), context.timeZone)
  const to = formatIsoDate(new Date(goal.dateTo), context.timeZone)
  const linked = goal.sessionIds.map(context.sessionOf)
  const known = linked.filter((session) => session !== undefined)
  const families = new Set(
    known.flatMap((session) => (session.familyId === null ? [] : [session.familyId]))
  )
  return {
    goal: {
      importKey: context.importKey,
      familyId: families.size === 1 ? [...families][0] : null,
      title: goal.title.trim(),
      note: text(goal.description),
      kind: goal.type === "RESULT" ? "result" : "process",
      from,
      to,
    },
    outside: known.filter((session) => session.day < from || session.day > to).length,
    unknown: linked.length - known.length,
  }
}

/** die Schritte, wie Treffsicher sie speichert: `{ order, title, description? }` */
function orderedSteps(raw: unknown): { title: string; description?: string }[] | null {
  if (!Array.isArray(raw)) return null
  const rows = raw as { order?: unknown; title?: unknown; description?: unknown }[]
  if (rows.some((row) => typeof row !== "object" || row === null || typeof row.order !== "number"))
    return null
  const steps = [...rows]
    .sort((a, b) => (a.order as number) - (b.order as number))
    .map((row) => {
      const description = typeof row.description === "string" ? text(row.description) : null
      return { title: row.title, ...(description ? { description } : {}) }
    })
  const parsed = routineSteps.safeParse(steps)
  return parsed.success ? parsed.data : null
}

/** alle Texte der Schritte, so wie sie stehen, für einen Ablauf, dessen Schritte nicht zu lesen sind */
function allText(raw: unknown): string {
  const strings: string[] = []
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      if (value.trim()) strings.push(value.trim())
    } else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === "object") Object.values(value).forEach(walk)
  }
  walk(raw)
  return strings.join("\n")
}

/**
 * Ein Ablauf aus Treffsicher: Name, Familie über den Namen der Disziplin (oder keine), Schritte nach `order`. Lehnt
 * `routineSteps` die Schritte ab, kommt der Ablauf als ein Schritt mit dem Text aller Schritte (`flattened`, Bericht);
 * nichts geht verloren und nichts bricht ab.
 */
export function routineFromTreffsicher(
  routine: { name: string; discipline: { name: string } | null; steps: unknown },
  context: { importKey: string; familyOf: (disciplineName: string) => number | null }
): { routine: ImportedRoutine; flattened: boolean } {
  const steps = orderedSteps(routine.steps)
  const base = {
    importKey: context.importKey,
    familyId: routine.discipline ? context.familyOf(routine.discipline.name) : null,
    name: routine.name.trim(),
  }
  if (steps) return { routine: { ...base, steps }, flattened: false }
  const all = allText(routine.steps)
  return { routine: { ...base, steps: all ? [{ title: all }] : [] }, flattened: true }
}
