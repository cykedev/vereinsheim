export const GOAL_TYPE_LABELS: Record<string, string> = {
  RESULT: "Ergebnisziel",
  PROCESS: "Prozessziel",
}

export function toDateInputValue(date: Date): string {
  return new Date(date).toISOString().slice(0, 10)
}
