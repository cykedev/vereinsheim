// Folgen im eigenen Tagebuch: Einheiten, Anhänge, Ziele, Abläufe, ungespeicherte Änderungen.

import type { Decision } from "@vereinsheim/ui/design2/decision-dialog"

export function sessionDelete({
  when,
  discipline,
  type,
  attachments,
  goals,
}: {
  /** Tag und Uhrzeit, etwa „Mi 14.10.2026 um 18:30“ */
  when: string
  discipline: string | null
  /** Art der Einheit, etwa „Training“ */
  type: string
  attachments: number
  goals: number
}): Decision {
  return {
    title: `Einheit vom ${when} löschen?`,
    about: `Die Einheit vom ${when} steht in deinem Tagebuch. ${discipline ? `${discipline}, ${type}` : type}.`,
    happens: [
      "Die Einheit verschwindet aus dem Tagebuch und aus der Statistik.",
      "Mit ihr gehen die Serien und Schüsse, das Befinden, die Prognose, das Feedback und die Reflexion.",
      ...(attachments === 1 ? ["Die angehängte Datei wird gelöscht."] : []),
      ...(attachments > 1 ? [`Die ${attachments} angehängten Dateien werden gelöscht.`] : []),
      ...(goals === 1 ? ["1 Ziel zählt diese Einheit nicht mehr mit."] : []),
      ...(goals > 1 ? [`${goals} Ziele zählen diese Einheit nicht mehr mit.`] : []),
    ],
    notHappening: ["Die Ziele selbst bleiben. Die Disziplin und deine Abläufe bleiben."],
    undo: "Nicht möglich. Die Einheit lässt sich nur neu erfassen.",
    confirmLabel: "Einheit löschen",
    destructive: true,
  }
}

export function attachmentDelete({ name }: { name: string }): Decision {
  return {
    title: `Anhang „${name}“ löschen?`,
    about: `Die Datei „${name}“ hängt an dieser Einheit.`,
    happens: ["Die Datei wird gelöscht und verschwindet aus der Einheit."],
    notHappening: ["Die Einheit und ihre Ergebnisse bleiben."],
    undo: "Nicht möglich. Hast du die Datei noch, kannst du sie neu hochladen.",
    confirmLabel: "Anhang löschen",
    destructive: true,
  }
}

export function goalDelete({
  title,
  from,
  to,
  sessions,
}: {
  title: string
  /** erster und letzter Tag, etwa „01.09.2026“ */
  from: string
  to: string
  /** zugeordnete Einheiten */
  sessions: number
}): Decision {
  const assigned =
    sessions === 1
      ? " 1 Einheit ist ihm zugeordnet."
      : sessions > 1
        ? ` ${sessions} Einheiten sind ihm zugeordnet.`
        : ""
  return {
    title: `Ziel „${title}“ löschen?`,
    about: `Das Ziel gilt vom ${from} bis ${to}.${assigned}`,
    happens: [
      "Das Ziel verschwindet unter „Ziele“.",
      ...(sessions === 1 ? ["Die Einheit zeigt es nicht mehr an."] : []),
      ...(sessions > 1 ? [`Die ${sessions} Einheiten zeigen es nicht mehr an.`] : []),
    ],
    notHappening: ["Keine Einheit wird gelöscht. Ergebnisse und Statistik bleiben gleich."],
    undo: "Nicht möglich. Du kannst das Ziel neu anlegen und die Einheiten wieder zuordnen.",
    confirmLabel: "Ziel löschen",
    destructive: true,
  }
}

export function routineDelete({ name, steps }: { name: string; steps: number }): Decision {
  return {
    title: `Ablauf „${name}“ löschen?`,
    about:
      steps === 0
        ? `Der Ablauf „${name}“ hat noch keine Schritte.`
        : `Der Ablauf „${name}“ beschreibt deinen Schuss in ${steps === 1 ? "1 Schritt" : `${steps} Schritten`}.`,
    happens: ["Der Ablauf verschwindet unter „Ablauf“."],
    notHappening: [
      "Einheiten bleiben. Was du in einer Reflexion zum Ablauf notiert hast, bleibt stehen.",
    ],
    undo: "Nicht möglich. Du kannst den Ablauf neu anlegen.",
    confirmLabel: "Ablauf löschen",
    destructive: true,
  }
}

export function leaveUnsaved(): Decision {
  return {
    title: "Ohne Speichern verlassen?",
    about: "Du hast hier etwas geändert und noch nicht gespeichert.",
    happens: ["Deine Änderungen gehen verloren."],
    notHappening: ["Was vorher gespeichert war, bleibt."],
    undo: "Nicht möglich. Mit „Abbrechen“ bleibst du hier und kannst speichern.",
    confirmLabel: "Verwerfen",
    destructive: true,
  }
}
