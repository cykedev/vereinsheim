// Der Anker, mit dem das Labor geladen wurde, gilt nur für die erste Ansicht. Später trägt die Adresse den Anker
// der vorigen Seite (Sprungleiste, Reiter); eine neu geöffnete Seite beginnt oben (User, 9. Oktober 2026:
// „Beispielscheibe öffnen springt gleich zur Analyse“).

const AT_LOAD = typeof location === "undefined" ? "" : location.hash
let first = true

/** der Anker beim Laden, solange die erste Ansicht steht; danach "" */
export const loadAnchor = (): string => (first ? AT_LOAD : "")

/** nach einem Wechsel der Ansicht gilt der Anker beim Laden nicht mehr */
export const leaveFirstView = (): void => {
  first = false
}
