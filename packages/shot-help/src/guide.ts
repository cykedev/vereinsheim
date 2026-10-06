// Einstieg („So liest du die Zahlen“), Erklärungen zur Oberfläche und typische Fehlschlüsse.

import type { GuideItem, ViewHelp } from "./types"

/** Einstieg: einmal oben erklärt, damit die Karten kurz bleiben */
export const READING_GUIDE: readonly GuideItem[] = [
  {
    title: "Schusszahl n",
    text: "Jede Zahl steht auf einer Grundlage, die Zeile „Grundlage“ unter der Analyse nennt sie. Reicht die Schusszahl nicht, steht „–“ mit dem Grund („ab 10 Schuss“), nie eine 0.",
  },
  {
    title: "95-%-Bereich",
    text: "„σ 1,12 mm, 95 %: 0,96 bis 1,36 mm“ heißt: Mit dieser Schusszahl liegt dein wahrer Wert mit großer Sicherheit in diesem Bereich. Mehr Schüsse machen ihn schmaler. Bei 10 Schuss reicht er für σ von etwa einem Viertel darunter bis knapp die Hälfte darüber, erst bei rund 120 Schuss auf etwa ±10 %.",
  },
  {
    title: "„Echt“ und „unklar“",
    text: "„Echt“ heißt: mit 95 % kein Zufall. „Unklar“ heißt nicht „gibt es nicht“, sondern: Diese Schüsse reichen nicht, um es zu zeigen. Mehr Schüsse oder mehrere Scheiben klären es. „Unklar“ ist ein ehrliches Ergebnis, kein Fehler.",
  },
  {
    title: "Ganze Ringe oder Zehntel",
    text: "Oben umschalten; jede Auswertung über Werte gibt es in beiden. In ganzen Ringen gehen Feinheiten verloren (10,0 und 10,9 sind beide eine 10), deshalb ist ein Trend dort seltener „klar“. Gleich bleiben Zehner, Innenzehner und Zehnerquote.",
  },
  {
    title: "Probe und Wertung",
    text: "Lage, Streuung und Tempo der Analyse rechnen über die Wertung. Die Probe hat einen eigenen Reiter; nach einer Visierverstellung zählt nur die Probe danach.",
  },
  {
    title: "Nummern",
    text: "Wertungsschüsse heißen 1, 2, 3 …, Probeschüsse P1, P2 …, in der Reihenfolge der Abgabe. Fehlt einem Schuss eine Angabe, behält er trotzdem seine Nummer.",
  },
  {
    title: "Median statt Durchschnitt",
    text: "Wo „Median“ steht, zählt der mittlere Wert: Die Hälfte liegt darüber, die Hälfte darunter. Ein einzelner Ausreißer verschiebt ihn kaum, den Durchschnitt (Ø) schon.",
  },
  {
    title: "Millimeter statt Teiler",
    text: "Der Teiler ist der Abstand zur Mitte in 1/100 mm. Für Gruppen rechnet Spiegel in Millimetern um ihren eigenen Schwerpunkt.",
  },
]

/** Erklärungen zu Elementen der Oberfläche, die keine Statistik sind */
export const VIEW_HELP: readonly ViewHelp[] = [
  {
    id: "beobachtungen",
    title: "Beobachtungen in Worten",
    what: "Die wichtigsten Befunde dieser Scheibe als Sätze, gebildet aus denselben Zahlen wie die Karten.",
    read: "„Echt“ oder „klar“ steht nur, wenn ein Test es mit 95 % zeigt. Sonst sagt der Satz ehrlich, dass die Schüsse nicht reichen.",
  },
  {
    id: "probe-auf-der-scheibe",
    title: "Probe auf der Scheibe",
    what: "Die Probeschüsse um die Mitte, vor der Visierverstellung gestrichelt, dazu der Schwerpunkt der Wertung als kleiner geviertelter Kreis.",
  },
]

/** Typische Fehlschlüsse */
export const FALLACIES: readonly GuideItem[] = [
  {
    title: "Eine Scheibe ist kein Muster",
    text: "Ermüdung, Pausen und Trends zeigen sich erst über mehrere Scheiben.",
  },
  {
    title: "Mehr Schüsse, größerer Streukreis",
    text: "Wer 40 Schuss mit 10 Schuss vergleicht, vergleicht die Schusszahl. Für Vergleiche σ nehmen.",
  },
  {
    title: "„Unklar“ ist ein Ergebnis",
    text: "Es sagt: noch nicht genug Daten. Wer trotzdem am Visier dreht, korrigiert oft den Zufall.",
  },
  {
    title: "Nach einem Rekord kommt meist eine schwächere Scheibe",
    text: "Das ist Statistik (Regression zur Mitte), kein Formverlust.",
  },
  {
    title: "Ganze Ringe verstecken Feinheiten",
    text: "10,0 und 10,9 sind beide eine 10; für die Analyse sind Zehntel genauer.",
  },
]
