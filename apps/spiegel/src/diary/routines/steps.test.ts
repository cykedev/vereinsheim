import { describe, expect, it } from "vitest"

import { stepsToText, textToSteps, type RoutineStep } from "./steps"

describe("Schritte als Text", () => {
  it("hin und zurück ohne Verlust: mit und ohne Erklärung, mehrzeilig, ein Schritt", () => {
    const steps: RoutineStep[] = [
      {
        title: "Griff fassen",
        description: "Hand ganz hoch an den Griff.\nErst fühlen, dann schauen.",
      },
      { title: "Atmen" },
      { title: "Heben und Druckpunkt", description: "Ruhig." },
    ]
    expect(stepsToText(steps)).toBe(
      "Griff fassen\nHand ganz hoch an den Griff.\nErst fühlen, dann schauen.\n\nAtmen\n\nHeben und Druckpunkt\nRuhig."
    )
    expect(textToSteps(stepsToText(steps))).toEqual(steps)
    expect(textToSteps(stepsToText([{ title: "Nur einer" }]))).toEqual([{ title: "Nur einer" }])
  })

  it("trägt 55 Schritte", () => {
    const steps = Array.from({ length: 55 }, (_, i) => ({ title: `Schritt ${i + 1}` }))
    expect(textToSteps(stepsToText(steps))).toEqual(steps)
  })

  it("Leerraum am Rand, mehrere Leerzeilen und Windows-Zeilenenden", () => {
    expect(textToSteps("\r\n  Erster  \r\n  erklärt \r\n\r\n\r\n\n  Zweiter\n \n")).toEqual([
      { title: "Erster", description: "erklärt" },
      { title: "Zweiter" },
    ])
    expect(textToSteps("   \n\n  ")).toEqual([])
  })

  it("eine Leerzeile in einer Erklärung wird beim Schreiben eine Zeile, damit kein neuer Schritt entsteht", () => {
    const text = stepsToText([{ title: "Stand", description: "Füße\n\nHüfte" }])
    expect(textToSteps(text)).toEqual([{ title: "Stand", description: "Füße\nHüfte" }])
  })
})
