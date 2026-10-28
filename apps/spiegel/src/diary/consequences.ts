// Folgen jeder Aktion im Tagebuch in Alltagsworten („Kein Knopf ohne Folge“, [[conventions]] §10). Eine Quelle für
// Dialoge und Tests, ohne Pronomen für Personen. Reine Funktionen.

import type { Decision } from "@vereinsheim/ui/design2/decision-dialog"

export type { Decision }

export function diaryOn(): Decision {
  return {
    title: "Tagebuch einschalten?",
    about: "Du schaltest das Tagebuch ein.",
    happens: [
      "In der unteren Leiste steht dann „Tagebuch“ statt „Scheiben“.",
      "Alle Scheiben findest du dann im Profil und über Start. Am Computer stehen sie weiter in der Seitenleiste.",
      "Nur du siehst dein Tagebuch. Der Admin sieht nichts davon.",
    ],
    notHappening: ["An deinen Scheiben ändert sich nichts."],
    undo: "Im Profil wieder ausschalten.",
    confirmLabel: "Einschalten",
    destructive: false,
  }
}

export function diaryOff(): Decision {
  return {
    title: "Tagebuch ausschalten?",
    about: "Du schaltest das Tagebuch aus.",
    happens: [
      "In der Leiste steht wieder „Scheiben“.",
      "Auf Start und auf der Seite einer Scheibe steht dann nichts mehr vom Tagebuch.",
    ],
    notHappening: [
      "Deine Einträge bleiben gespeichert. Sie sind nur nicht zu sehen.",
      "An deinen Scheiben ändert sich nichts.",
    ],
    undo: "Im Profil wieder einschalten. Dann sind alle Einträge wieder da.",
    confirmLabel: "Ausschalten",
    destructive: false,
  }
}

/** eine Scheibe aus dem Eintrag lösen; mit bewerteten Serien geht deren Ausführung mit */
export function diaryCardRelease({
  when,
  executions,
}: {
  when: string
  executions: number
}): Decision {
  return {
    title: "Scheibe aus dem Eintrag nehmen?",
    about: `Du nimmst die Scheibe vom ${when.replace(" · ", " um ")} aus diesem Eintrag.`,
    happens: [
      "Die Scheibe steht dann in keinem Eintrag. Von selbst kommt sie nicht wieder dazu.",
      ...(executions > 0 ? ["Deine Bewertung ihrer Serien (Ausführung) ist dann weg."] : []),
    ],
    notHappening: [
      "Die Scheibe bleibt in Spiegel, mit allen Schüssen.",
      "Die übrigen Angaben im Eintrag bleiben.",
    ],
    undo: "Im Blatt „Scheiben ändern“ wieder anhaken.",
    confirmLabel: "Herausnehmen",
    destructive: executions > 0,
  }
}

/** einen gefüllten Abschnitt leeren; danach ist er wieder eine Zeile mit „+“ */
export function diarySectionRemove({ name, day }: { name: string; day: string }): Decision {
  return {
    title: `${name} leeren?`,
    about: `Du leerst ${name} im Eintrag vom ${day}.`,
    happens: [
      "Was hier eingetragen ist, ist dann weg. Der Abschnitt ist wieder eine Zeile mit „+“.",
    ],
    notHappening: ["Die übrigen Angaben im Eintrag bleiben."],
    undo: "Neu eintragen.",
    confirmLabel: "Leeren",
    destructive: true,
  }
}

export function diaryEntryDelete({
  day,
  family,
}: {
  day: string
  family: string | null
}): Decision {
  return {
    title: "Eintrag löschen?",
    about: family
      ? `Du löschst den Eintrag vom ${day} (${family}).`
      : `Du löschst den Eintrag vom ${day}.`,
    happens: [
      "Er liegt 30 Tage im Papierkorb (im Profil). So lange steht er nirgends, auch nicht auf Start und an den Scheiben.",
      "Danach löscht Spiegel ihn endgültig, mit Notiz, Befinden, Prognose und Feedback.",
      "Seine Scheiben sind sofort frei. Sie kommen in einen anderen Eintrag dieses Abends oder in einen neuen.",
    ],
    notHappening: [
      "Die Scheiben bleiben in Spiegel, mit allen Schüssen.",
      "Deine anderen Einträge bleiben.",
    ],
    undo: "30 Tage lang im Papierkorb wiederherstellen. Dann kommen die Scheiben zurück, die in keinem anderen Eintrag stecken.",
    confirmLabel: "Löschen",
    destructive: true,
  }
}

export function diaryEntryPurgeNow({ day }: { day: string }): Decision {
  return {
    title: "Eintrag endgültig löschen?",
    about: `Du löschst den Eintrag vom ${day} endgültig.`,
    happens: ["Spiegel löscht ihn sofort, mit allen Angaben."],
    notHappening: ["Die Scheiben bleiben in Spiegel."],
    undo: "Das lässt sich nicht rückgängig machen.",
    confirmLabel: "Endgültig löschen",
    destructive: true,
  }
}

/** die Seite mit einem ungespeicherten Text verlassen */
export function diaryDiscard(): Decision {
  return {
    title: "Änderungen verwerfen?",
    about: "Im Eintrag ist ein Text geändert und noch nicht gespeichert.",
    happens: ["Die Änderungen sind weg."],
    notHappening: ["Was schon gespeichert war, bleibt."],
    undo: "Den Text neu schreiben.",
    confirmLabel: "Verwerfen",
    destructive: true,
  }
}

/** ein Ziel in den Papierkorb */
export function goalDelete({ title }: { title: string }): Decision {
  return {
    title: "Ziel löschen?",
    about: `Du löschst das Ziel „${title}“.`,
    happens: [
      "Es liegt 30 Tage im Papierkorb (im Profil). So lange steht es nirgends, auch nicht auf Start.",
      "Danach löscht Spiegel es endgültig, mit Notiz und Antwort.",
    ],
    notHappening: ["Scheiben und Einträge bleiben, wie sie sind."],
    undo: "30 Tage lang im Papierkorb wiederherstellen.",
    confirmLabel: "Löschen",
    destructive: true,
  }
}

export function goalPurgeNow({ title }: { title: string }): Decision {
  return {
    title: "Ziel endgültig löschen?",
    about: `Du löschst das Ziel „${title}“ endgültig.`,
    happens: ["Spiegel löscht es sofort, mit allen Angaben."],
    notHappening: ["Scheiben und Einträge bleiben."],
    undo: "Das lässt sich nicht rückgängig machen.",
    confirmLabel: "Endgültig löschen",
    destructive: true,
  }
}

/** das Formular eines Ziels mit Ungespeichertem verlassen */
export function goalDiscard(): Decision {
  return {
    title: "Änderungen verwerfen?",
    about: "Am Ziel ist etwas geändert und noch nicht gespeichert.",
    happens: ["Die Änderungen sind weg."],
    notHappening: ["Was schon gespeichert war, bleibt."],
    undo: "Neu eintragen.",
    confirmLabel: "Verwerfen",
    destructive: true,
  }
}

/** einen Ablauf in den Papierkorb */
export function routineDelete({ name }: { name: string }): Decision {
  return {
    title: "Ablauf löschen?",
    about: `Du löschst den Ablauf „${name}“.`,
    happens: [
      "Er liegt 30 Tage im Papierkorb (im Profil). So lange steht er nirgends, auch nicht im Faden.",
      "Danach löscht Spiegel ihn endgültig, mit allen Schritten.",
    ],
    notHappening: ["Einträge und Faden bleiben, wie sie sind."],
    undo: "30 Tage lang im Papierkorb wiederherstellen.",
    confirmLabel: "Löschen",
    destructive: true,
  }
}

export function routinePurgeNow({ name }: { name: string }): Decision {
  return {
    title: "Ablauf endgültig löschen?",
    about: `Du löschst den Ablauf „${name}“ endgültig.`,
    happens: ["Spiegel löscht ihn sofort, mit allen Schritten."],
    notHappening: ["Einträge und Faden bleiben."],
    undo: "Das lässt sich nicht rückgängig machen.",
    confirmLabel: "Endgültig löschen",
    destructive: true,
  }
}

/** das Formular eines Ablaufs mit Ungespeichertem verlassen */
export function routineDiscard(): Decision {
  return {
    title: "Änderungen verwerfen?",
    about: "Am Ablauf ist etwas geändert und noch nicht gespeichert.",
    happens: ["Die Änderungen sind weg."],
    notHappening: ["Was schon gespeichert war, bleibt."],
    undo: "Neu schreiben.",
    confirmLabel: "Verwerfen",
    destructive: true,
  }
}
