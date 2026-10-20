import type { HelpText } from "@vereinsheim/ui/design2/help"

// Erklärungen der Zahlen, die Leser eines Wettbewerbs nicht von selbst verstehen; das Blatt der Hilfe im Rahmen zeigt
// sie. Der Wortlaut ist im Textbuch freigegeben (vault/_attachments/textbuch-ringwerk-treffsicher.md, „Ringwerk:
// Hilfe (WD0)“) und folgt den Schreibregeln ([[conventions]] §10). Er beschreibt, was `lib/scoring`, `lib/standings`
// und `lib/playoffs` rechnen.

export const HELP_TOPICS = {
  teiler: {
    title: "Teiler",
    short: "Wie nah der beste Schuss einer Serie an der Mitte liegt. Kleiner ist besser.",
    what: "Der Teiler misst den Abstand des besten Schusses einer Serie zur Mitte der Scheibe. Er steht auf dem Ausdruck der Serie und wird zusammen mit den Ringen eingetragen.",
    read: "Kleiner ist besser. In der Rangliste einer Saison steht der kleinste Teiler aus allen Serien. Er kann aus einer anderen Serie stammen als die besten Ringe.",
    caution:
      "Der Teiler sagt nichts über die übrigen Schüsse der Serie. Ein einziger sehr guter Schuss genügt.",
  },
  ringteiler: {
    title: "Ringteiler",
    short: "Ringe und Teiler einer Serie in einer Zahl. Kleiner ist besser.",
    what: "Der Ringteiler zählt die Ringe, die bis zur höchsten Ringzahl fehlen, und legt den Teiler dazu. Bei zehn Schuss ist die höchste Ringzahl 100, in Zehnteln 109.",
    read: "Kleiner ist besser. Beispiel: 96 Ringe und Teiler 35,0 ergeben 100 − 96 + 35,0 = 39,0. Ein Ring weniger wiegt so viel wie ein Teiler, der um 1,0 größer ist.",
    caution:
      "In einem gemischten Wettbewerb geht der korrigierte Teiler ein, nicht der Teiler vom Ausdruck.",
    formula:
      "Ringteiler = höchste Ringzahl − Ringe + Teiler × Faktor, auf eine Stelle gerundet. Höchste Ringzahl bei zehn Schuss: 100, in Zehnteln 109. Faktor: der Faktor der Disziplin in gemischten Wettbewerben, sonst 1.",
  },
  "corrected-teiler": {
    title: "Korrigierter Teiler",
    short:
      "Der Teiler mal dem Faktor der Disziplin. So lassen sich verschiedene Disziplinen vergleichen.",
    what: "In einem gemischten Wettbewerb schießen die Teilnehmer verschiedene Disziplinen. Ihre Teiler sind nicht direkt vergleichbar. Ringwerk nimmt deshalb jeden Teiler mal den Faktor seiner Disziplin. Luftgewehr hat den Faktor 1,0. Luftpistole hat als Standard 0,333. Ein Teiler von 90 mit der Luftpistole zählt dann wie 30,0.",
    read: "Kleiner ist besser, wie beim Teiler. Die Spalte zeigt den Teiler nach der Korrektur. Der Ringteiler rechnet mit demselben Wert. Auch ein Duell vergleicht den korrigierten Teiler.",
    caution:
      "Die Korrektur gilt nur in gemischten Wettbewerben. Hat ein Wettbewerb eine feste Disziplin, zählt der Teiler vom Ausdruck. Die Faktoren stehen in der App unter „Disziplinen“.",
    formula: "korrigierter Teiler = Teiler × Faktor der Disziplin.",
  },
  "season-order": {
    title: "Reihenfolge der Rangliste",
    short: "Die Rangliste ordnet nach einem Bestwert. Bei Gleichstand entscheidet der Ringteiler.",
    what: "Jeder Teilnehmer hat drei Bestwerte, jeder aus einer einzelnen Serie: die meisten Ringe, den kleinsten Teiler und den kleinsten Ringteiler. Die Rangliste ordnet nach einem davon. Welcher es ist, legt der Wettbewerb fest. Ein Tipp auf einen anderen Spaltenkopf ordnet nach dieser Spalte.",
    read: "Oben stehen alle, die genug Serien haben. Darunter stehen grau alle, denen noch Serien fehlen. Wie viele Serien es braucht, steht oben bei „Mindest“. Ganz unten stehen alle ohne Serie. Bei gleichem Wert entscheidet der kleinere Ringteiler. Ist auch der gleich, teilen sich beide den Platz. Die kleinen Plätze an den Werten zeigen die Plätze 1 bis 3 jeder Spalte unter denen mit genug Serien.",
    caution:
      "Das PDF ordnet immer nach der Spalte, die der Wettbewerb festlegt. Ein Tipp auf einen Spaltenkopf ändert nur die Ansicht auf dem Bildschirm.",
  },
  "season-alternating": {
    title: "Abwechselnde Reihenfolge",
    short: "Die Plätze gehen abwechselnd nach den besten Ringen und nach dem besten Teiler.",
    what: "Platz 1 bekommt, wer die meisten Ringe hat. Platz 2 bekommt, wer unter den übrigen den kleinsten Teiler hat. Platz 3 geht wieder nach Ringen, Platz 4 nach dem Teiler, und so weiter. Bei „Teiler/Ringe“ beginnt der Teiler. Jeder Teilnehmer steht nur einmal in der Liste.",
    read: "Hervorgehoben ist der Wert, der den Platz gebracht hat. Der andere ist zurückgenommen. Der Ringteiler steht nur zur Information da. Erst kommen alle mit genug Serien, dann die übrigen, beide Gruppen abwechselnd. Ganz unten stehen alle ohne Serie. Bei gleichem Wert entscheidet der Name.",
    caution: "Die Spaltenköpfe ordnen hier nicht um. Die Reihenfolge ist die Wertung.",
  },
  "best-of-table": {
    title: "Tabelle im Best-of",
    short:
      "Siege zählen zuerst. Bei Gleichstand entscheiden die Sätze, dann der direkte Vergleich.",
    what: "Jede Begegnung besteht aus mehreren Duellen, den Sätzen. Einen Satz gewinnt, wer in der Wertung des Wettbewerbs besser ist, zum Beispiel mit dem kleineren Ringteiler. Ist ein Satz auch nach den Stichkriterien gleich, zählt er für keinen. Wer mehr Sätze gewinnt, gewinnt die Begegnung. Steht es nach allen Sätzen gleich, entscheidet ein Stechschuss: ein Schuss in Zehnteln, der höhere Wert gewinnt. Die gleichen Sätze zählen dann für den Sieger.",
    read: "Die Tabelle ordnet nach Siegen, dann nach der Satzdifferenz, dann nach den gewonnenen Sätzen. Stehen danach zwei oder mehr gleich, entscheidet der direkte Vergleich: ihre Begegnungen untereinander. Die Spalte „Direktvergleich“ zeigt ihn. Am Telefon steht sie nicht da, im PDF schon. Bei zweien steht dort das Ergebnis ihrer Begegnung und der Gegner. Bei dreien oder mehr steht ihre Bilanz untereinander. „offen“ heißt: Eine Begegnung untereinander fehlt noch. „ausgeglichen“ heißt: Alle haben untereinander dieselbe Bilanz, etwa weil jeder einmal gewonnen hat. Bei „offen“ zählt bis dahin die Bilanz der gespielten Begegnungen. Wo die Bilanz gleich ist, ordnet der Name. Wer nur noch am Namen hängt, teilt sich den Platz.",
    caution:
      "Begegnungen mit einem zurückgezogenen Teilnehmer zählen für niemanden. Zurückgezogene stehen durchgestrichen am Ende.",
  },
  "league-table": {
    title: "Tabelle der Liga",
    short:
      "Punkte zählen zuerst. Bei Gleichstand entscheiden der direkte Vergleich und dann der beste Ringteiler.",
    what: "Jede Paarung ist ein Duell über eine Serie. Ein Sieg bringt 2 Punkte, ein Unentschieden 1 Punkt, eine Niederlage keinen. Ein Freilos bringt 2 Punkte. In „Sp.“ und „S“ zählt es nicht mit. Wer das Duell gewinnt, hängt von der Wertung ab. Beim Ringteiler gewinnt der kleinere, bei Gleichstand gewinnen mehr Ringe, dann der kleinere Teiler. Bei Ringen gewinnen mehr Ringe, dann der kleinere Teiler. Beim Teiler gewinnt der kleinere Teiler, dann mehr Ringe.",
    read: "„Sp.“ sind gespielte Duelle. „S“, „U“ und „N“ sind Siege, Unentschieden und Niederlagen. Bei gleichen Punkten zählen zuerst die Punkte aus den Duellen dieser Teilnehmer untereinander. Dann zählt der beste Ringteiler aus allen Duellen, bei Wertung nach Ringen die meisten Ringe. Ist auch das gleich, teilen sich beide den Platz.",
    caution:
      "Paarungen mit einem zurückgezogenen Teilnehmer zählen nicht. Zurückgezogene stehen durchgestrichen am Ende.",
  },
  playoffs: {
    title: "Playoffs",
    short:
      "Die Besten der Gruppenphase spielen gegeneinander. Wer ein Match verliert, scheidet aus.",
    what: "Die Sportleitung startet die Playoffs, wenn alle Paarungen der Gruppenphase gespielt sind. Je nach Wettbewerb kommen die besten 16 ins Achtelfinale, die besten 8 ins Viertelfinale oder die besten 4 ins Halbfinale. Zurückgezogene zählen nicht mit. Gesetzt wird nach der Tabelle der Gruppenphase. Der Erste trifft auf den Letzten der Qualifizierten, der Zweite auf den Vorletzten, und so weiter. Teilen sich zwei einen Platz, zählt die Reihenfolge, in der die Tabelle sie zeigt.",
    read: "Ein Match gewinnt, wer zuerst genug Duelle gewinnt. Bei Best-of-5 sind das 3. Die Zahlen auf der Karte sind die gewonnenen Duelle. Ein Duell gewinnt der kleinere Ringteiler. Bei Gleichstand gewinnen mehr Ringe, dann der kleinere Teiler. Ist auch das gleich, zählt das Duell für keinen, und ein weiteres folgt. Für jede neue Runde setzt Ringwerk neu: Der Beste der Verbliebenen nach der Tabelle der Gruppenphase trifft auf den Schwächsten.",
    caution:
      "Die Paarungen einer Runde stehen erst fest, wenn die Runde davor fertig ist. Die Namen, die der Turnierbaum vorher in den leeren Feldern zeigt, sind nur eine Vorschau. Die neue Setzung kann anders ausfallen.",
  },
  finale: {
    title: "Finale",
    short:
      "Ein Duell entscheidet. Bei Gleichstand zählen die Stichkriterien, dann folgt die Verlängerung.",
    what: "Im Finale schießen beide eine Serie. Es zählt zuerst das Hauptkriterium des Wettbewerbs, als Standard die Ringe. Ist es gleich, entscheidet das erste Stichkriterium, dann das zweite. Beides legt der Wettbewerb fest. Die Karte des Finales nennt sie: „Primär“ ist das Hauptkriterium, „TB“ ein Stichkriterium.",
    read: "Steht es nach allen Kriterien gleich, folgt die Verlängerung: ein weiteres Duell nach denselben Regeln. Das geht so weiter, bis ein Duell entscheidet. Wer es gewinnt, hat das Finale gewonnen.",
    caution: "Die Verlängerung hat keine Grenze. Es folgen so viele Duelle, bis eines entscheidet.",
  },
} as const satisfies Record<string, HelpText>

export type HelpTopicId = keyof typeof HELP_TOPICS

/** die Erklärung zu einem Thema; null: unbekannt oder kein Thema offen */
export const helpTopic = (id: string | null): HelpText | null =>
  id !== null && id in HELP_TOPICS ? HELP_TOPICS[id as HelpTopicId] : null
