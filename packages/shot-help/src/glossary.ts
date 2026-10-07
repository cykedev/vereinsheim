// Die Begriffe der Analyse, kurz erklärt; aus jeder Erklärung verlinkbar.

import type { GlossaryEntry } from "./types"

export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: "Schwerpunkt", text: "Mittelpunkt aller Treffer (Meyton: Trefferlage)." },
  {
    term: "Streukreis",
    text: "Kleinster Kreis um alle Trefferzentren, Mitte zu Mitte; die Zahl ist sein Durchmesser. Meyton druckt einen „Trefferkreis“; ob er genau dasselbe misst, prüft Spiegel noch an Rohdaten.",
  },
  {
    term: "Vertrauensellipse",
    text: "Bereich um den gemessenen Schwerpunkt, in dem der wahre Schwerpunkt mit großer Sicherheit (95 %) liegt. Liegt die Scheibenmitte darin, ist ein Versatz nicht belegt. Sie schrumpft mit der Schusszahl, die Gruppe nicht.",
  },
  {
    term: "σ (Sigma)",
    text: "Typische Streuung um den Schwerpunkt in mm, kaum von der Schusszahl abhängig.",
  },
  {
    term: "R50",
    text: "Radius um den Schwerpunkt, in dem die Hälfte der Treffer liegt, ohne Fehlschüsse.",
  },
  {
    term: "Fehlschuss",
    text: "Ein Nuller oder ein Treffer weit außen, in den Daten markiert; R50 lässt ihn weg, die übrigen Maße zählen ihn mit.",
  },
  {
    term: "Verdächtiger Schuss",
    text: "Platzhalter oder Handeintrag; er zählt nur mit seinem amtlichen Wert, nie mit Lage, Teiler oder Zeit.",
  },
  { term: "Teiler", text: "Abstand des Treffers zur Mitte in 1/100 mm." },
  {
    term: "Innenzehner",
    text: "Beim Luftgewehr ist der 0,5-mm-Punkt in der Mitte ganz weggeschossen, bei der Luftpistole berührt der Treffer den inneren Ring von 5 mm.",
  },
  {
    term: "Median",
    text: "Der mittlere Wert: Die Hälfte liegt darüber, die Hälfte darunter.",
  },
  { term: "IQR", text: "Breite des Fensters, in dem die mittlere Hälfte der Werte liegt." },
  { term: "MAD", text: "Typische Abweichung eines Werts vom Median." },
  { term: "Standardabweichung (SD)", text: "Typische Abweichung vom Durchschnitt." },
  {
    term: "95-%-Bereich",
    text: "Wo der wahre Wert bei dieser Schusszahl mit großer Sicherheit liegt.",
  },
  {
    term: "Hotelling-Test",
    text: "Prüft, ob ein Versatz des Schwerpunkts mehr als Zufall ist.",
  },
  {
    term: "Wilson-Bereich",
    text: "Der 95-%-Bereich einer Quote, auch bei 0 oder 100 % sinnvoll.",
  },
  {
    term: "Mann-Kendall-Test",
    text: "Prüft, ob die Werte über die Scheibe eher steigen oder fallen, und kommt mit vielen gleichen Werten zurecht.",
  },
  {
    term: "Mauchly-Test",
    text: "Prüft, ob eine Gruppe wirklich gestreckt ist oder nur zufällig unrund aussieht.",
  },
  {
    term: "Bonferroni",
    text: "Wer viele Schüsse prüft, findet zufällig einen auffälligen; die Grenze wird deshalb mit der Schusszahl strenger.",
  },
  {
    term: "von-Neumann-Verhältnis",
    text: "Vergleicht die Sprünge von Schuss zu Schuss mit der Streuung; bei unabhängigen Schüssen liegt es um 2.",
  },
]
