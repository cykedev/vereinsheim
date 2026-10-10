import { markShots, type CardMark, type MarkShot } from "@vereinsheim/shot-core/projection"

/** die Lagen aus der Seite (kompakt, nach Id) für die kleinen Scheiben der Bausteine */
export function marksById(marks: Record<string, CardMark[]>): Map<string, MarkShot[]> {
  return new Map(Object.entries(marks).map(([id, cardMarks]) => [id, markShots(cardMarks)]))
}
