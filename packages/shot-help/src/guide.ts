// Einstieg („So liest du die Zahlen“), Erklärungen zur Oberfläche und typische Fehlschlüsse.

import type { GuideItem, ViewHelp } from "./types"

/** Einstieg: einmal oben erklärt, damit die Karten kurz bleiben */
export const READING_GUIDE: readonly GuideItem[] = [
  {
    title: "Schusszahl n",
    text: "Jede Zahl steht auf einer Grundlage, die Zeile „Datenlage“ unter der Analyse nennt sie. Reicht die Schusszahl nicht, steht „–“ mit dem Grund („ab 10 Schuss“), nie eine 0.",
  },
  {
    title: "„Sicher zwischen …“",
    text: "„Streuung 1,12 mm, sicher zwischen 0,94 und 1,36 mm“ heißt bei 30 Schuss: Dein wahrer Wert liegt mit großer Sicherheit (95 von 100) in diesem Bereich. Mehr Schüsse machen ihn schmaler. Bei 10 Schuss reicht er für σ von etwa einem Viertel darunter bis knapp die Hälfte darüber, erst bei rund 120 Schuss auf etwa ±10 %.",
  },
  {
    title: "„Sicher“ und „kann Zufall sein“",
    text: "„Sicher“ heißt: Reiner Zufall brächte ein so deutliches Ergebnis nur in 5 von 100 Fällen. Weil auf einer Scheibe mehrere Tests laufen, zeigt trotzdem etwa jede fünfte ganz normale Scheibe irgendwo ein „sicher versetzt“, „gestreckt“, „klar“ oder einen Ausreißer. Mit einer Pause ist es etwa jede vierte, denn auch jede Pause bekommt einen Test. „Kann Zufall sein“ heißt nicht „gibt es nicht“, sondern: Diese Schüsse reichen nicht, um es zu zeigen oder auszuschließen. Mehr Schüsse oder mehrere Scheiben klären es. „Passt“ an der Lage heißt dasselbe: kein Versatz belegt. Auf den Karten heißt das auch „nicht klar“ oder „kein Versatz nachweisbar“; es ist ein ehrliches Ergebnis, kein Fehler.",
  },
  {
    title: "Ganze Ringe oder Zehntel",
    text: "Auf der Scheibe und auf Start im Kreis neben der großen Zahl umschalten, unter Scheiben und im Fortschritt am Chip neben „Filter“. Ergebnis, Ø, Serien und Quoten gibt es in beiden. Einzelne Schüsse stehen immer in Zehnteln: in den Schüssen, in der Ablesung, im Verlauf je Schuss und in der Zehntelverteilung. In ganzen Ringen gehen Feinheiten verloren (10,0 und 10,9 sind beide eine 10); beim Luftgewehr ist ein Trend dort deshalb etwas seltener „klar“. Gleich bleiben Zehner, Innenzehner und Zehnerquote.",
  },
  {
    title: "Wie am Ausdruck",
    text: "Eine Scheibe in Spiegel ist, was der Ausdruck zeigt: Mit dem ersten Wertungsschuss löscht die Anlage die Probe, also rechnet Spiegel über die Wertung. Eine Scheibe nur mit Probe zeigt Spiegel wie Wertung, mit Schüssen 1, 2, 3 …, Serien zu zehn und Ergebnis; das schwarze Eck oben rechts an der Scheibe und an den kleinen Scheiben der Serien erinnert daran, dass es Probe ist.",
  },
  {
    title: "Nummern",
    text: "Schüsse heißen 1, 2, 3 … in der Reihenfolge der Abgabe, eine Scheibe nur aus Probe ebenso. Fehlt einem Schuss eine Angabe, behält er trotzdem seine Nummer.",
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
    id: "trefferbild",
    title: "Trefferbild",
    what: "Jeder Treffer in Kalibergröße, gefärbt nach seinem Ring: 10 rot, 9 gold, 8 türkis, 7 und weniger violett. Eine Scheibe nur aus Probe trägt oben rechts ein schwarzes Eck. Die Treffer sind leicht durchscheinend, damit du siehst, wo sie sich überlagern.",
    read: "Die Knöpfe in den Ecken blenden ein: unten links den Schwerpunkt (kleiner schwarz-weiß geviertelter Kreis, der Mittelpunkt deiner Treffer) und den Streukreis (blauer Ring um alle Treffer; seine Zahl misst Mitte zu Mitte), unten rechts die Vertrauensellipse (gestrichelt: wo dein wahrer Schwerpunkt mit großer Sicherheit liegt; liegt die Mitte darin, ist ein Versatz nicht belegt) und die Schussnummern. Oben links zoomt die Lupe auf deine Treffer und wieder zurück; daneben zeigt der Knopf mit den Punkten die übrigen Schüsse blass oder blendet sie aus.",
  },
  {
    id: "langzeit-trefferbild",
    title: "Trefferbild über den Zeitraum",
    what: "Alle Schüsse der Scheiben im Zeitraum auf einer Scheibe, wo sie lagen. Ab 50 Schuss hat jeder Treffer die Farbe der Dichte an seiner Stelle: Gelb heißt, dort liegen deine Schüsse oft, Violett, dort selten, Hellviolett ganz selten. Unter 50 Schuss trägt jeder Treffer die Farbe seines Rings. Der runde Knopf oben links zeigt statt der Treffer Umrisse wie beim Vergleichen: durchgezogen die Fläche mit der Hälfte der Schüsse, gestrichelt die mit 9 von 10. Über 3.000 Schuss zeigt das Bild nur noch die Umrisse. Der geviertelte Kreis ist die Mitte aller Schüsse. Ohne gesicherten Versatz sagt der Satz, wo deine Mitte liegt und dass das noch nicht sicher ist.",
    read: "Der Satz unter dem Bild ist die Antwort: zuerst, ob deine Lage über den Zeitraum versetzt ist, dann, ob deine Gruppe in eine Richtung zieht. Die Belege stehen in der Analyse: die Form als Ellipse unter „Präzision“, die Lage über die Zeit unter „Lage“.",
  },
  {
    id: "vergleichen",
    title: "Vergleichen",
    what: "Zwei Seiten nebeneinander: zwei Scheiben, zwei Zeiträume oder deine Wettkämpfe gegen dein Training im selben Zeitraum. A ist blau, B orange. Bei zwei Scheiben zählt jeder Schuss einzeln. Bei Zeiträumen auch, solange deine Abende gleich liegen. Liegen sie verschieden, zählt jeder Abend für sich, damit ein einzelner Abend nicht alles bestimmt.",
    read: "Der Satz oben ist die Antwort. Das Bild zeigt beide Seiten auf der Scheibe. Mit vielen Schüssen zeigt es Umrisse: durchgezogen die Fläche mit der Hälfte der Schüsse, gestrichelt die mit 9 von 10. Bei wenigen Schüssen steht jeder Schuss als Punkt in der Farbe seiner Seite. Die geviertelten Kreise mit dem farbigen Ring sind die beiden Mitten. Die Lupe zeigt die ganze Scheibe. Die Tabelle nennt alle Zahlen beider Seiten. Ein Wert in Gold unterscheidet sich klar und ist der bessere.",
  },
  {
    id: "beobachtungen",
    title: "Beobachtungen in Worten",
    what: "Die wichtigsten Befunde dieser Scheibe als Sätze, gebildet aus denselben Zahlen wie die Karten.",
    read: "„Sicher“ oder „klar“ steht nur, wenn ein Test es zeigt: Reiner Zufall brächte das nur in 5 von 100 Fällen. Sonst sagt der Satz ehrlich, dass die Schüsse nicht reichen. Weil mehrere Tests laufen, trifft es bei etwa jeder fünften ganz normalen Scheibe einmal zufällig zu. Mit einer Pause ist es etwa jede vierte.",
  },
  {
    id: "grundlage",
    title: "Grundlage und Herkunft",
    what: "Nicht jede Scheibe bringt alles mit. Gemessen heißt: Die Anlage hat jeden Schuss mit Wert, Lage und Zeit geliefert. Vom Ausdruck heißt: Die Werte stammen vom Papier, das die Anlage gedruckt hat. Eingetragen heißt: Die Werte sind von Hand eingegeben oder aus Treffsicher übernommen. Je nach Herkunft hat eine Scheibe Schüsse mit Lage, nur Serien-Summen oder nur ein Gesamtergebnis.",
    read: "Jede Zahl rechnet nur über die Scheiben, die dafür etwas mitbringen. Zählen nicht alle, steht darunter die Grundlage, etwa „über 12 von 20 Scheiben · 6 ohne Lage je Schuss“. Ergebnis und Ø je Schuss kommen auch aus Summen. Streuung, Tempo und jedes Urteil über die Lage brauchen Einzelschüsse. Die Mitte der Schüsse aus einer Summe zählt beim Versatz mit, nie bei der Streuung. Wo ein Wert fehlt, steht „–“ mit dem Grund.",
  },
]

/** Typische Fehlschlüsse */
export const FALLACIES: readonly GuideItem[] = [
  {
    title: "Eine Scheibe ist kein Muster",
    text: "Was eine Scheibe zeigt, gilt für diesen Abend. Ob Ermüdung, Pausen oder ein Abfall dich regelmäßig betreffen, zeigt erst der Vergleich über mehrere Scheiben.",
  },
  {
    title: "Mehr Schüsse, größerer Streukreis",
    text: "Bei gleicher Präzision ist der Streukreis über 40 Schuss im Mittel rund 30 % größer als über 10. Wer so vergleicht, vergleicht vor allem die Schusszahl. Für Vergleiche σ nehmen.",
  },
  {
    title: "„Kann Zufall sein“ ist ein Ergebnis",
    text: "Es sagt: Diese Schüsse zeigen nichts, was über den Zufall hinausgeht. Vielleicht gibt es nichts, vielleicht ist es für diese Schusszahl zu klein. Wer trotzdem auf einen Versatz reagiert, den der Zufall erklärt, verschiebt seine Gruppe oft weg von der Mitte und verliert dabei im Mittel Ringe.",
  },
  {
    title: "Nach einem Rekord kommt meist eine schwächere Scheibe",
    text: "Das ist meist Statistik (Regression zur Mitte) und für sich kein Zeichen von Formverlust.",
  },
  {
    title: "Ganze Ringe verstecken Feinheiten",
    text: "10,0 und 10,9 sind beide eine 10; für die Analyse sind Zehntel genauer.",
  },
]
