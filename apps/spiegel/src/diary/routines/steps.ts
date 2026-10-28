// Die Schritte eines Ablaufs als ein Text und zurück: Jeder Absatz ist ein Schritt, die erste Zeile sein Titel, die
// übrigen Zeilen die Erklärung. Rein; so lässt sich ein Ablauf mit zwei Schritten wie einer mit fünfzig in einem Feld
// bearbeiten.

export interface RoutineStep {
  title: string
  description?: string
}

export const STEPS_MAX = 200
export const STEP_TITLE_MAX = 300
export const STEP_DESCRIPTION_MAX = 2000

/** die Schritte als Text: Absätze, durch eine Leerzeile getrennt */
export function stepsToText(steps: readonly RoutineStep[]): string {
  return steps
    .map((step) => {
      // eine Leerzeile in der Erklärung würde beim Lesen einen neuen Schritt beginnen
      const description = step.description?.replace(/\n\s*\n+/g, "\n").trim()
      return description ? `${step.title}\n${description}` : step.title
    })
    .join("\n\n")
}

/** der Text als Schritte: Leerzeilen trennen, Leerraum am Rand fällt weg, ein Schritt ohne Erklärung hat keine */
export function textToSteps(text: string): RoutineStep[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
    .filter((lines) => lines.length > 0)
    .map(([title, ...rest]) => {
      const description = rest.join("\n")
      return description ? { title, description } : { title }
    })
}
