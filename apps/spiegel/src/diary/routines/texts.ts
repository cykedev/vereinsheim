// Sichtbare Texte der Schuss-Abläufe an einer Stelle (Textbuch Spiegel, „Tagebuch (2b)“). Rückfragen stehen in
// `../consequences.ts`.

export const ROUTINE_TEXTS = {
  box: "Abläufe",
  steps: (n: number) => (n === 1 ? "1 Schritt" : `${n} Schritte`),
  empty: (family: string) =>
    `Noch kein Ablauf für ${family}. Schreib auf, wie du einen Schuss aufbaust.`,
  emptyAny: "Noch kein Ablauf. Schreib auf, wie du einen Schuss aufbaust.",
  newRoutine: "Neuer Ablauf",
  noFamily: "Ohne Disziplin",
  noFamilyLead: "Abläufe ohne Disziplin. Mit einer Disziplin stehen sie in deren Faden.",
  back: "Faden",
  meta: (family: string, steps: number) =>
    `${family} · ${steps === 1 ? "1 Schritt" : `${steps} Schritte`}`,
  setFamily: "Disziplin festlegen",
  setFamilyHint: "Dann steht der Ablauf im Faden dieser Disziplin.",
  thisRoutine: "Dieser Ablauf",
  stepsAndName: "Schritte und Name",
  edit: "Bearbeiten",
  family: "Disziplin",
  change: "Ändern",
  set: "Festlegen",
  familySaved: "Disziplin geändert.",
  remove: "Löschen",
  removeState: "Danach liegt der Ablauf 30 Tage im Papierkorb im Profil.",
  deleted: "Ablauf gelöscht",
  trashKind: "Ablauf",
} as const

export const ROUTINE_FORM_TEXTS = {
  titleNew: "Neuer Ablauf",
  titleEdit: "Ablauf bearbeiten",
  name: "Name",
  namePlaceholder: "zum Beispiel: Mein Ablauf",
  family: "Disziplin",
  steps: "Schritte",
  hint: (n: number) =>
    `Jeder Absatz ist ein Schritt. Die erste Zeile ist sein Titel, was darunter steht, die Erklärung. Gerade: ${n === 1 ? "1 Schritt" : `${n} Schritte`}.`,
  discard: "Verwerfen",
  save: "Speichern",
  create: "Ablauf anlegen",
  created: "Ablauf angelegt.",
  saved: "Ablauf gespeichert.",
} as const

export const ROUTINE_ERRORS = {
  name: "Bitte einen Namen.",
  nameLong: "Höchstens 200 Zeichen.",
  steps: "Bitte mindestens einen Schritt.",
  tooMany: "Höchstens 200 Schritte.",
  stepLong: "Ein Schritt ist zu lang. Ein Titel hat höchstens 300 Zeichen, eine Erklärung 2.000.",
  missing: "Diesen Ablauf gibt es nicht mehr.",
} as const
